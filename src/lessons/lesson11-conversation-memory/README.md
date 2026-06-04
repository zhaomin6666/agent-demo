# 第 11 课：多轮对话记忆，让 Agent 记住上下文

## 前言

前面几节课，我们已经把一个简单的 LLM Demo 逐步升级成了一个具备工程雏形的 Agent。

第 5 课开始，我们学习了 Tool Calling，让模型可以选择工具。

第 6 课封装了 `ToolExecutor`，统一执行工具调用。

第 7 课实现了手写版 `Agent Loop`，让模型可以多轮调用工具。

第 8 课正式引入 LangGraph，把手写的 `for` 循环 Agent Loop 改造成了状态图。

第 9 课增强了 LangGraph 的 `AgentState`，记录执行轨迹、中间状态、停止原因和最后一次工具结果。

第 10 课引入了 Checkpoint，通过 `MemorySaver + thread_id` 让 Agent 状态可以保存和恢复。

第 11 课继续在第 10 课基础上升级：

> 把 Checkpoint 能力整理成更清晰的多轮对话记忆机制。

第 10 课解决的是：

```text
状态如何保存和恢复？
```

第 11 课要解决的是：

```text
保存下来的状态，如何更适合多轮对话？
```

也就是说，第 10 课有了底层状态保存能力，第 11 课要开始设计“会话记忆策略”。

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解 checkpoint 和 conversation memory 的关系
2. 避免每轮重复追加 SystemMessage
3. 封装 conversation input 创建逻辑
4. 在调用模型前裁剪 messages，避免上下文无限增长
5. 保留 checkpoint 中的完整执行历史
6. 让 thread_id 的多轮对话更像真实聊天系统
```

本节不会新增业务工具。

仍然继续使用前面几课的两个工具：

```text
search_knowledge_base
create_ticket
```

重点是优化多轮对话时的消息管理方式。

---

## 二、为什么第 10 课还不够？

第 10 课里，我们已经可以做到：

```text
相同 thread_id 继承历史状态
不同 thread_id 隔离状态
getState 查看最新状态
getStateHistory 查看 checkpoint 历史
```

但是它还存在几个工程问题。

### 1. SystemMessage 不应该每轮都追加

第一轮对话需要 `SystemMessage`，因为它告诉模型：

```text
你是谁
你有哪些规则
什么时候调用工具
什么时候停止工具调用
```

但是后续轮次如果每次都重新追加 `SystemMessage`，消息历史会越来越乱。

错误示例：

```text
SystemMessage
HumanMessage
AIMessage
ToolMessage
AIMessage
SystemMessage
HumanMessage
AIMessage
...
```

更合理的方式是：

```text
第一轮：SystemMessage + HumanMessage
后续轮：只追加新的 HumanMessage
```

---

### 2. messages 会越来越长

Checkpoint 会不断保存历史消息。

随着多轮对话进行，`messages` 会越来越多。

例如：

```text
第 1 轮：4 条消息
第 2 轮：8 条消息
第 3 轮：12 条消息
第 4 轮：16 条消息
```

如果每次都把完整 `messages` 传给模型，会带来几个问题：

```text
1. token 消耗越来越高
2. 响应越来越慢
3. 超过模型上下文长度
4. 历史噪音影响模型判断
```

所以需要做消息窗口裁剪。

---

### 3. 输入创建逻辑不应该都写在 index.ts

第 10 课里，我们有：

```ts
createFirstTurnInput()
createNextTurnInput()
```

这两个函数写在 `index.ts` 里可以跑通，但从工程结构看不够清晰。

多轮对话记忆是一个独立职责，应该单独放到 `memory/` 目录中。

---

## 三、本节核心设计

第 11 课采用一个简单但实用的设计：

```text
Checkpoint 保存完整历史
模型调用前只取最近一部分消息
SystemMessage 只在第一轮加入
```

也就是说：

```text
完整历史：用于审计、回放、恢复、Trace
消息窗口：用于控制模型上下文长度
```

这两个概念要分开。

不能为了省 token 就直接删除 checkpoint 里的历史。

更合理的做法是：

```text
历史完整保存
上下文按需裁剪
```

---

## 四、本节目录结构

本节直接基于第 10 课复制。

创建第 11 课目录：

```bash
cp -r src/lessons/lesson10-langgraph-checkpoint src/lessons/lesson11-conversation-memory
```

Windows PowerShell：

```powershell
Copy-Item -Recurse src/lessons/lesson10-langgraph-checkpoint src/lessons/lesson11-conversation-memory
```

新增 `memory` 目录：

```bash
mkdir -p src/lessons/lesson11-conversation-memory/memory
```

最终目录结构：

```text
src/lessons/lesson11-conversation-memory/
  data/
    knowledge-docs.ts

  tools/
    search-knowledge-base.tool.ts
    create-ticket.tool.ts
    index.ts

  executor/
    tool-executor.ts

  model/
    create-model.ts

  graph/
    agent-state.ts
    create-agent-graph.ts

  memory/
    conversation-input.ts
    message-window.ts

  index.ts
```

这些文件从第 10 课复制即可，不需要修改：

```text
data/knowledge-docs.ts
tools/search-knowledge-base.tool.ts
tools/create-ticket.tool.ts
tools/index.ts
executor/tool-executor.ts
model/create-model.ts
graph/agent-state.ts
```

本节重点新增或修改：

```text
memory/conversation-input.ts
memory/message-window.ts
graph/create-agent-graph.ts
index.ts
package.json
```

---

## 五、配置 package.json

在 `package.json` 中增加第 11 课脚本：

```json
{
  "scripts": {
    "lesson:11": "tsx src/lessons/lesson11-conversation-memory/index.ts"
  }
}
```

保留前面已有的 `lesson:01` 到 `lesson:10`，这里只需要新增这一行。

运行第 11 课：

```bash
pnpm lesson:11
```

---

## 六、新增 message-window.ts

文件路径：

```text
src/lessons/lesson11-conversation-memory/memory/message-window.ts
```

这个文件负责：

```text
从完整 messages 中，挑选真正传给模型的消息窗口
```

代码如下：

```ts
import {
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

export type MessageWindowOptions = {
  maxRecentMessages: number;
};

export function selectMessagesForModel(
  messages: BaseMessage[],
  options: MessageWindowOptions,
): BaseMessage[] {
  const systemMessage = messages.find(
    (message) => message instanceof SystemMessage,
  );

  const nonSystemMessages = messages.filter(
    (message) => !(message instanceof SystemMessage),
  );

  const recentMessages = nonSystemMessages.slice(-options.maxRecentMessages);

  if (!systemMessage) {
    return recentMessages;
  }

  return [systemMessage, ...recentMessages];
}
```

---

## 七、理解 message window

这个函数的策略很简单：

```text
1. 从 messages 中找到第一条 SystemMessage
2. 过滤出所有非 SystemMessage
3. 只保留最近 N 条非 SystemMessage
4. 最终返回：SystemMessage + 最近 N 条消息
```

例如完整历史是：

```text
SystemMessage
HumanMessage 1
AIMessage 1
ToolMessage 1
AIMessage 2
HumanMessage 2
AIMessage 3
HumanMessage 3
AIMessage 4
```

如果 `maxRecentMessages = 4`，最终传给模型的是：

```text
SystemMessage
HumanMessage 2
AIMessage 3
HumanMessage 3
AIMessage 4
```

这样既保留了系统规则，又避免上下文无限增长。

注意：

> 这里裁剪的是“传给模型的消息”，不是删除 checkpoint 里的消息。

Checkpoint 中仍然保存完整历史。

---

## 八、新增 conversation-input.ts

文件路径：

```text
src/lessons/lesson11-conversation-memory/memory/conversation-input.ts
```

这个文件负责：

```text
根据当前 thread 是否已有历史，决定是否追加 SystemMessage
```

代码如下：

```ts
import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import type { AgentState } from "../graph/agent-state.js";

export type ConversationInputParams = {
  userInput: string;
  systemPrompt: string;
  hasHistory: boolean;
};

export type ConversationInput = {
  messages: BaseMessage[];
  loopCount: number;
  currentNode: string;
  stopReason: "running";
  lastToolResult: null;
  maxIterationsReached: false;
};

export function createConversationInput(
  params: ConversationInputParams,
): ConversationInput {
  const messages = params.hasHistory
    ? [new HumanMessage(params.userInput)]
    : [
        new SystemMessage(params.systemPrompt),
        new HumanMessage(params.userInput),
      ];

  return {
    messages,
    loopCount: 0,
    currentNode: "start",
    stopReason: "running",
    lastToolResult: null,
    maxIterationsReached: false,
  };
}

export function hasConversationHistory(
  state: Partial<AgentState> | undefined,
): boolean {
  return (state?.messages?.length ?? 0) > 0;
}
```

---

## 九、理解 conversation input

第 10 课中，我们写了两个函数：

```ts
createFirstTurnInput()
createNextTurnInput()
```

第 11 课把它们升级成一个统一函数：

```ts
createConversationInput()
```

它通过 `hasHistory` 判断当前 thread 是否已经有历史。

如果没有历史：

```ts
[
  new SystemMessage(params.systemPrompt),
  new HumanMessage(params.userInput),
]
```

如果已有历史：

```ts
[
  new HumanMessage(params.userInput),
]
```

这样可以避免多轮对话中反复追加 `SystemMessage`。

---

## 十、hasConversationHistory 的作用

```ts
export function hasConversationHistory(
  state: Partial<AgentState> | undefined,
): boolean {
  return (state?.messages?.length ?? 0) > 0;
}
```

这个函数用于判断当前 thread 是否已经有历史消息。

后面在 `index.ts` 中会这样使用：

```ts
const latestStateBeforeInvoke = await params.graph.getState(config);

const hasHistory = hasConversationHistory(latestStateBeforeInvoke.values);
```

如果当前 thread 是第一次调用，通常没有历史。

如果已经调用过一次，checkpoint 中就会有 `messages`。

---

## 十一、修改 create-agent-graph.ts

文件路径：

```text
src/lessons/lesson11-conversation-memory/graph/create-agent-graph.ts
```

这个文件从第 10 课复制，然后只改三处。

---

## 十二、增加导入

新增：

```ts
import { selectMessagesForModel } from "../memory/message-window.js";
```

它的作用是让 LLM 节点在调用模型前，先做消息窗口裁剪。

---

## 十三、修改 AgentGraphOptions

第 10 课中：

```ts
export type AgentGraphOptions = {
  maxIterations: number;
  checkpointer: MemorySaver;
};
```

第 11 课改成：

```ts
export type AgentGraphOptions = {
  maxIterations: number;
  checkpointer: MemorySaver;
  memory: {
    maxRecentMessages: number;
  };
};
```

新增的配置是：

```ts
memory: {
  maxRecentMessages: number;
}
```

意思是：

> 每次调用模型时，最多保留最近多少条非 SystemMessage。

---

## 十四、修改 llmNode

第 10 课中，LLM 节点直接把完整状态里的 `messages` 传给模型：

```ts
const aiMessage = await modelWithTools.invoke(state.messages);
```

第 11 课改成：

```ts
const messagesForModel = selectMessagesForModel(state.messages, {
  maxRecentMessages: options.memory.maxRecentMessages,
});

const aiMessage = await modelWithTools.invoke(messagesForModel);
```

完整的 `llmNode` 如下：

```ts
async function llmNode(state: AgentState) {
  const nextLoopCount = state.loopCount + 1;

  console.log(
    `\n========== LangGraph LLM 节点，第 ${nextLoopCount} 轮 ==========`,
  );

  const messagesForModel = selectMessagesForModel(state.messages, {
    maxRecentMessages: options.memory.maxRecentMessages,
  });

  console.log("\n状态中的 messages 数量:");
  console.log(state.messages.length);

  console.log("\n实际传给模型的 messages 数量:");
  console.log(messagesForModel.length);

  const aiMessage = await modelWithTools.invoke(messagesForModel);

  console.log("\n模型返回 content:");
  console.log(aiMessage.content);

  console.log("\n模型返回 tool_calls:");
  console.log(JSON.stringify(aiMessage.tool_calls ?? [], null, 2));

  return {
    messages: [aiMessage],
    loopCount: nextLoopCount,
    currentNode: "llm",
    traceSteps: [
      createTraceStep({
        event: "llm_end",
        nodeName: "llm",
        loopCount: nextLoopCount,
        message: `LLM 调用完成，状态消息数：${state.messages.length}，实际传入模型消息数：${messagesForModel.length}，tool_calls 数量：${
          aiMessage.tool_calls?.length ?? 0
        }`,
      }),
    ],
  };
}
```

其他节点逻辑保持第 10 课不变。

也就是说，`toolNode`、`shouldContinue`、`finalAnswerNode`、`maxIterationFallbackNode` 都可以继续沿用。

---

## 十五、create-agent-graph.ts 的关键变化总结

第 11 课对 `create-agent-graph.ts` 的改动可以总结为：

```text
1. 引入 selectMessagesForModel
2. AgentGraphOptions 增加 memory.maxRecentMessages
3. llmNode 中不再直接传 state.messages
4. llmNode 改为传 messagesForModel
5. trace 中记录状态消息数和实际传入模型的消息数
```

核心变化是：

```ts
const messagesForModel = selectMessagesForModel(state.messages, {
  maxRecentMessages: options.memory.maxRecentMessages,
});
```

这就是消息窗口裁剪。

---

## 十六、修改 index.ts

文件路径：

```text
src/lessons/lesson11-conversation-memory/index.ts
```

这一课的 `index.ts` 重点演示：

```text
1. 自动判断当前 thread 是否已有历史
2. 有历史时不再重复追加 SystemMessage
3. 多轮调用同一个 thread
4. 观察 checkpoint 中 messages 变多
5. 观察实际传给模型的 messages 被限制在窗口内
```

完整代码如下：

```ts
import { MemorySaver } from "@langchain/langgraph";

import {
  createAgentGraph,
  type ToolCallingModel,
} from "./graph/create-agent-graph.js";
import { ToolExecutor } from "./executor/tool-executor.js";
import {
  createConversationInput,
  hasConversationHistory,
} from "./memory/conversation-input.js";
import { createModel } from "./model/create-model.js";
import { tools } from "./tools/index.js";

const systemPrompt = `
你是一个企业 AI 知识库 / Agent Demo 助手。

规则：
1. 如果用户问的是企业知识库、RAG、文档接入、检索优化、Agent 工具规范，优先调用 search_knowledge_base。
2. 如果用户要求创建工单、反馈问题、提交故障，调用 create_ticket。
3. 如果用户同时要求“先查询知识库，再创建工单”，必须先调用 search_knowledge_base，拿到结果后再决定是否调用 create_ticket。
4. 工具结果足够回答用户时，请停止调用工具，直接输出最终答案。
5. 不要重复使用相同参数调用同一个工具。
6. 不要编造内部系统信息，能查工具就查工具。
7. 如果工具执行失败，请基于工具错误信息给用户一个友好的解释。
`;

type ThreadConfig = {
  configurable: {
    thread_id: string;
  };
};

type AgentGraph = ReturnType<typeof createAgentGraph>;

function createThreadConfig(threadId: string): ThreadConfig {
  return {
    configurable: {
      thread_id: threadId,
    },
  };
}

async function runConversationTurn(params: {
  graph: AgentGraph;
  threadId: string;
  userInput: string;
}) {
  const config = createThreadConfig(params.threadId);

  const latestStateBeforeInvoke = await params.graph.getState(config);

  const hasHistory = hasConversationHistory(latestStateBeforeInvoke.values);

  const input = createConversationInput({
    userInput: params.userInput,
    systemPrompt,
    hasHistory,
  });

  console.log("\n\n========================================");
  console.log("thread_id：", params.threadId);
  console.log("是否已有历史：", hasHistory);
  console.log("用户输入：", params.userInput);

  const result = await params.graph.invoke(input, config);

  const finalMessage = result.messages.at(-1);

  console.log("\n========== 多轮对话结果 ==========");
  console.log("当前节点：", result.currentNode);
  console.log("停止原因：", result.stopReason);
  console.log("本轮循环轮次：", result.loopCount);

  console.log("\n最终回答：");
  console.log(finalMessage?.content);

  console.log("\nCheckpoint 中累计 messages 数量：", result.messages.length);
  console.log("累计 traceSteps 数量：", result.traceSteps.length);
  console.log("累计工具执行记录数量：", result.toolExecutionRecords.length);

  const latestStateAfterInvoke = await params.graph.getState(config);

  console.log("\n========== 最新 Checkpoint 简要信息 ==========");
  console.log(
    "checkpoint_id：",
    latestStateAfterInvoke.config.configurable?.checkpoint_id,
  );
  console.log("messages.length：", latestStateAfterInvoke.values.messages.length);
  console.log("stopReason：", latestStateAfterInvoke.values.stopReason);
}

async function main() {
  const model = createModel();

  const modelWithTools = model.bindTools(tools) as ToolCallingModel;

  const toolExecutor = new ToolExecutor(tools);

  const checkpointer = new MemorySaver();

  const graph = createAgentGraph(modelWithTools, toolExecutor, {
    maxIterations: 5,
    checkpointer,
    memory: {
      maxRecentMessages: 8,
    },
  });

  const threadId = "lesson11-conversation-a";

  await runConversationTurn({
    graph,
    threadId,
    userInput: "我们的企业知识库支持哪些数据源接入？",
  });

  await runConversationTurn({
    graph,
    threadId,
    userInput: "那如果检索效果不好，一般可以怎么优化？",
  });

  await runConversationTurn({
    graph,
    threadId,
    userInput: "基于刚才的优化建议，帮我创建一个中优先级工单。",
  });

  await runConversationTurn({
    graph,
    threadId,
    userInput: "你还记得我刚才问的是哪类系统问题吗？",
  });
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 十七、理解 runConversationTurn

`runConversationTurn` 是本节入口文件的核心函数。

它的流程是：

```text
1. 根据 threadId 创建 config
2. 调用 graph.getState(config) 获取当前 thread 最新状态
3. 判断当前 thread 是否已有历史
4. 调用 createConversationInput 创建输入
5. 调用 graph.invoke(input, config)
6. 打印最终回答和 checkpoint 信息
```

关键代码：

```ts
const latestStateBeforeInvoke = await params.graph.getState(config);

const hasHistory = hasConversationHistory(latestStateBeforeInvoke.values);
```

这两行用来判断当前会话是不是第一次执行。

如果没有历史，就传入：

```text
SystemMessage + HumanMessage
```

如果已有历史，就只传入：

```text
HumanMessage
```

---

## 十八、理解 memory.maxRecentMessages

在创建 graph 时，我们增加了：

```ts
memory: {
  maxRecentMessages: 8,
}
```

意思是：

> 每次调用模型时，最多取最近 8 条非 SystemMessage，再加上 SystemMessage。

例如完整 checkpoint 中已经有 20 条消息。

实际传给模型的可能只有：

```text
SystemMessage + 最近 8 条非 SystemMessage
```

这样可以控制上下文长度。

---

## 十九、为什么 checkpoint 保存完整历史，但模型只看一部分？

这是一个很重要的工程设计。

如果直接删除历史，会有问题：

```text
1. 无法完整审计
2. 无法回放历史执行过程
3. 无法做 trace 分析
4. 无法做人工介入后的恢复
5. 无法排查用户历史问题
```

所以更推荐：

```text
checkpoint 保存完整历史
模型调用前做窗口裁剪
```

完整历史用于系统管理。

裁剪后的窗口用于模型推理。

这两个用途不同，不能混在一起。

---

## 二十、运行第 11 课

执行：

```bash
pnpm lesson:11
```

本节会使用同一个 `thread_id` 连续执行 4 轮：

```text
第 1 轮：
我们的企业知识库支持哪些数据源接入？

第 2 轮：
那如果检索效果不好，一般可以怎么优化？

第 3 轮：
基于刚才的优化建议，帮我创建一个中优先级工单。

第 4 轮：
你还记得我刚才问的是哪类系统问题吗？
```

重点观察输出中的两类数量。

第一类：

```text
Checkpoint 中累计 messages 数量
```

它会越来越多，说明 checkpoint 里保存了完整历史。

第二类：

```text
实际传给模型的 messages 数量
```

它会被限制在 `maxRecentMessages` 附近，说明消息窗口裁剪生效。

---

## 二十一、预期观察结果

你会看到类似输出：

```text
thread_id： lesson11-conversation-a
是否已有历史： false
用户输入： 我们的企业知识库支持哪些数据源接入？

状态中的 messages 数量:
2

实际传给模型的 messages 数量:
2
```

第二轮：

```text
thread_id： lesson11-conversation-a
是否已有历史： true
用户输入： 那如果检索效果不好，一般可以怎么优化？

状态中的 messages 数量:
6

实际传给模型的 messages 数量:
6
```

随着轮次增加，checkpoint 中的消息数量会继续增加。

当完整消息数量超过窗口大小后，你会看到：

```text
状态中的 messages 数量:
16

实际传给模型的 messages 数量:
9
```

为什么是 9？

因为：

```text
1 条 SystemMessage + 最近 8 条非 SystemMessage
```

这说明 memory window 生效了。

---

## 二十二、第 11 课和第 10 课的区别

第 10 课：

```text
用 checkpointer 保存状态
用 thread_id 区分会话
```

第 11 课：

```text
把 checkpoint 能力整理成多轮对话记忆
控制 SystemMessage 追加逻辑
控制传给模型的上下文窗口
```

第 10 课更像是：

```text
状态保存机制
```

第 11 课更像是：

```text
会话记忆策略
```

也可以这样理解：

```text
Checkpoint 是底层存储能力
Conversation Memory 是业务使用策略
```

---

## 二十三、这一课和企业级 Agent 的关系

企业级 Agent 很少是一次性问答。

更多场景是：

```text
用户先问一个问题
Agent 查询知识库
用户继续追问
Agent 需要理解“刚才”的含义
用户要求创建工单
Agent 需要基于之前上下文创建工单
用户再问处理进度
Agent 需要知道之前创建了什么
```

如果没有记忆，每一轮都是孤立的。

如果只保存历史、不控制上下文，后续又会遇到 token 和上下文长度问题。

所以第 11 课的意义是：

> 让 Agent 初步具备真实聊天系统中的会话记忆管理能力。

---

## 二十四、Java 后端视角理解

第 10 课像是建了一张流程状态表：

```java
public class AgentCheckpoint {
    private String threadId;
    private String checkpointId;
    private String stateJson;
    private LocalDateTime createdAt;
}
```

第 11 课像是在业务层封装了一个会话记忆服务：

```java
public class ConversationMemoryService {

    public AgentInput createInput(String threadId, String userInput) {
        AgentState state = checkpointRepository.findLatest(threadId);

        if (state.hasHistory()) {
            return AgentInput.onlyHumanMessage(userInput);
        }

        return AgentInput.withSystemPrompt(systemPrompt, userInput);
    }

    public List<Message> selectMessagesForModel(List<Message> messages) {
        return messageWindow.select(messages);
    }
}
```

也就是说：

```text
Checkpoint 是底层存储
ConversationMemory 是业务策略
MessageWindow 是上下文控制
```

这和后端项目中把 Repository、Service、Policy 分开是一个思路。

---

## 二十五、后续还能怎么优化？

本节只是做了最简单的消息窗口。

真实项目中，多轮记忆还可以继续优化。

### 1. 摘要记忆

当消息太长时，可以把更早的对话总结成摘要。

结构可能是：

```text
SystemMessage
SummaryMessage
最近 N 条消息
```

这样既保留长期上下文，又控制 token。

---

### 2. 长期记忆

把用户偏好、项目背景、常用信息保存到数据库。

例如：

```text
用户常问的问题类型
用户所在项目
用户使用的系统
用户常用语言
```

长期记忆不一定每次都放进 messages，可以按需检索。

---

### 3. 按消息类型裁剪

现在我们是简单保留最近 N 条非 SystemMessage。

后续可以更精细：

```text
优先保留 HumanMessage
保留最近一次 ToolMessage
删除无用中间日志
压缩较长 AIMessage
```

---

### 4. 按 token 数裁剪

当前是按消息条数裁剪。

更准确的方式是按 token 数裁剪。

例如：

```text
最多保留 6000 token 的上下文
```

这会比按消息数量更稳定。

---

## 二十六、TypeScript Tips

### 1. `Partial<AgentState>`

```ts
export function hasConversationHistory(
  state: Partial<AgentState> | undefined,
): boolean {
  return (state?.messages?.length ?? 0) > 0;
}
```

`Partial<AgentState>` 表示 `AgentState` 里的字段都可以是可选的。

因为新 thread 第一次调用时，`getState(config).values` 可能还没有完整状态字段。

---

### 2. 可选链 `?.`

```ts
state?.messages?.length
```

意思是：

```text
如果 state 存在，再读 messages
如果 messages 存在，再读 length
否则返回 undefined
```

这样可以避免空值报错。

---

### 3. 空值合并 `??`

```ts
state?.messages?.length ?? 0
```

意思是：

```text
如果左边是 null 或 undefined，就使用 0
```

所以当没有历史消息时，这里会返回 `0`。

---

### 4. `slice(-N)`

```ts
const recentMessages = nonSystemMessages.slice(-options.maxRecentMessages);
```

`slice(-N)` 表示取数组最后 N 条。

例如：

```ts
[1, 2, 3, 4, 5].slice(-2)
```

结果是：

```text
[4, 5]
```

这很适合实现最近消息窗口。

---

### 5. 类型只导入

```ts
import {
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
```

`type BaseMessage` 表示只导入类型，不导入运行时代码。

这是 TypeScript 中比较推荐的写法。

---

## 二十七、本节总结

第 11 课完成了多轮对话记忆的初步封装。

核心收获：

```text
1. Checkpoint 提供状态保存能力
2. Conversation Memory 是状态保存之上的使用策略
3. thread_id 代表一条会话
4. 第一轮需要 SystemMessage，后续轮次只追加 HumanMessage
5. 长对话不能无限把所有 messages 都传给模型
6. 可以在 LLM 节点前做 message window 裁剪
7. checkpoint 可以保存完整历史，模型调用只使用最近窗口
8. 这为后续 API 服务化和真实聊天系统打基础
```

本节最重要的一句话：

> Checkpoint 负责保存状态，Conversation Memory 负责决定如何使用这些状态。

---

## 二十八、下一课预告

下一课进入：

# 第 12 课：Human-in-the-loop 入门，高风险工具调用前人工确认

第 12 课会开始处理企业 Agent 中非常关键的问题：

```text
模型不能直接执行所有操作型工具。
```

比如：

```text
创建工单
提交审批
删除数据
发送通知
修改订单
```

这些操作型工具在真实系统中通常需要用户确认。

第 12 课会学习：

```text
1. 区分查询型工具和操作型工具
2. 设计 pendingAction 状态
3. 拦截高风险工具调用
4. 让用户确认后再执行工具
5. 初步实现 Human-in-the-loop
```

第 11 课解决的是：

```text
Agent 如何记住上下文？
```

第 12 课要解决的是：

```text
Agent 执行高风险操作前，如何让人参与确认？
```
