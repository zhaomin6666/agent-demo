# 第 10 课：LangGraph 持久化入门，使用 Checkpoint 保存 Agent 状态

## 前言

前面几节课，我们已经把一个简单的 LLM Demo 一步步升级成了 Agent 雏形。

第 5 课开始，我们学习了 Tool Calling，让模型可以选择工具。

第 6 课封装了 `ToolExecutor`，统一执行工具调用。

第 7 课实现了手写版 `Agent Loop`，让模型可以多轮调用工具。

第 8 课正式引入 LangGraph，把手写的 `for` 循环 Agent Loop 改造成了状态图。

第 9 课继续增强 LangGraph 的 `AgentState`，记录了：

```text
currentNode
stopReason
traceSteps
lastToolResult
maxIterationsReached
toolExecutionRecords
```

这样 Agent 不只是能跑，还能看到它是怎么跑的。

第 10 课继续往企业级工程化推进：

> 使用 LangGraph Checkpoint，让 Agent 状态可以按 thread_id 保存和恢复。

也就是说，第 9 课解决的是：

```text
一次 Agent 执行过程如何可观测？
```

第 10 课要解决的是：

```text
多次 Agent 调用之间，状态如何保存和恢复？
```

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解 Checkpoint 是什么
2. 理解 thread_id 是什么
3. 使用 MemorySaver 创建内存版 checkpointer
4. 在 graph.compile({ checkpointer }) 中启用状态保存
5. 使用相同 thread_id 连续调用 Agent
6. 使用不同 thread_id 隔离不同会话
7. 使用 graph.getState 查看最新状态
8. 使用 graph.getStateHistory 查看状态历史
```

这一课先使用 `MemorySaver`。

它适合本地学习和 Demo。

生产环境中，通常会把内存版 checkpointer 换成数据库版本，例如 Postgres、MongoDB 或 SQLite。

---

## 二、为什么 Agent 需要 Checkpoint？

第 9 课中，虽然我们已经可以记录 Agent 的执行轨迹，但它仍然是一次性执行。

流程大概是：

```text
用户输入
  ↓
graph.invoke()
  ↓
LangGraph 执行
  ↓
返回最终 State
  ↓
本次调用结束
```

如果没有 Checkpoint，下一次再调用 `graph.invoke()` 时，默认不会自动继承上一次的状态。

但是企业级 Agent 通常需要：

```text
1. 多轮对话
2. 保存用户上下文
3. 失败后恢复
4. 人工确认后继续执行
5. 查看历史执行轨迹
6. 支持不同用户、不同会话隔离
```

这些能力都离不开状态保存。

所以 Checkpoint 的作用可以简单理解为：

> 在 Agent 执行过程中，自动保存每一步的状态快照。

---

## 三、什么是 thread_id？

`thread_id` 可以理解成一条会话的 ID。

例如：

```text
lesson10-thread-a
lesson10-thread-b
```

同一个 `thread_id` 代表同一条会话。

不同 `thread_id` 代表不同会话。

可以这样理解：

| 概念              | 类比              |
| --------------- | --------------- |
| `thread_id`     | 会话 ID / 流程实例 ID |
| checkpoint      | 某一时刻的流程状态快照     |
| MemorySaver     | 内存版状态保存器        |
| getState        | 查询当前最新状态        |
| getStateHistory | 查询历史状态快照        |

从 Java 后端视角看，`thread_id` 很像：

```text
conversationId
sessionId
processInstanceId
workflowId
```

也就是用来区分不同流程实例的唯一标识。

---

## 四、第 9 课和第 10 课的区别

第 9 课：

```text
一次 invoke 内部可观测
```

第 10 课：

```text
多次 invoke 之间可保存、可恢复
```

第 9 课解决的是：

```text
Agent 是怎么执行的？
```

第 10 课解决的是：

```text
Agent 的状态如何跨多轮会话保存？
```

可以简单理解为：

```text
第 9 课：给 Agent 加执行日志
第 10 课：给 Agent 加状态存档
```

---

## 五、本节目录结构

本节直接基于第 9 课复制。

创建第 10 课目录：

```bash
cp -r src/lessons/lesson09-langgraph-state src/lessons/lesson10-langgraph-checkpoint
```

Windows PowerShell：

```powershell
Copy-Item -Recurse src/lessons/lesson09-langgraph-state src/lessons/lesson10-langgraph-checkpoint
```

最终目录：

```text
src/lessons/lesson10-langgraph-checkpoint/
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

  index.ts
```

这些文件和第 9 课一致，直接复制即可：

```text
data/knowledge-docs.ts
tools/search-knowledge-base.tool.ts
tools/create-ticket.tool.ts
tools/index.ts
executor/tool-executor.ts
model/create-model.ts
graph/agent-state.ts
```

本节重点修改：

```text
graph/create-agent-graph.ts
index.ts
package.json
```

---

## 六、配置 package.json

在 `package.json` 中增加第 10 课脚本：

```json
{
  "scripts": {
    "lesson:10": "tsx src/lessons/lesson10-langgraph-checkpoint/index.ts"
  }
}
```

保留前面已有的 `lesson:01` 到 `lesson:09`，这里只需要新增这一行。

运行第 10 课：

```bash
pnpm lesson:10
```

---

## 七、修改 create-agent-graph.ts

文件路径：

```text
src/lessons/lesson10-langgraph-checkpoint/graph/create-agent-graph.ts
```

这个文件基于第 9 课修改。

主要变化只有两个：

```text
1. AgentGraphOptions 增加 checkpointer
2. compile 时传入 checkpointer
```

第 9 课中，图是这样编译的：

```ts
.compile();
```

第 10 课要改成：

```ts
.compile({
  checkpointer: options.checkpointer,
});
```

---

## 八、引入 MemorySaver 类型

原来第 9 课中的导入是：

```ts
import { END, START, StateGraph } from "@langchain/langgraph";
```

第 10 课改成：

```ts
import {
  END,
  START,
  StateGraph,
  type MemorySaver,
} from "@langchain/langgraph";
```

这里引入的是 `MemorySaver` 类型。

注意：

```ts
type MemorySaver
```

表示只在 TypeScript 类型检查阶段使用，运行时不会产生额外代码。

---

## 九、修改 AgentGraphOptions

第 9 课中：

```ts
export type AgentGraphOptions = {
  maxIterations: number;
};
```

第 10 课改成：

```ts
export type AgentGraphOptions = {
  maxIterations: number;
  checkpointer: MemorySaver;
};
```

也就是说，现在创建 AgentGraph 时，除了传入最大轮次，还要传入一个 checkpointer。

后面入口文件中会这样创建：

```ts
const checkpointer = new MemorySaver();

const graph = createAgentGraph(modelWithTools, toolExecutor, {
  maxIterations: 5,
  checkpointer,
});
```

---

## 十、修改 compile

第 9 课中，图定义最后是：

```ts
return new StateGraph(AgentStateAnnotation)
  .addNode("llm", llmNode)
  .addNode("tools", toolNode)
  .addNode("final_answer", finalAnswerNode)
  .addNode("max_iteration_fallback", maxIterationFallbackNode)
  .addEdge(START, "llm")
  .addConditionalEdges("llm", shouldContinue)
  .addEdge("tools", "llm")
  .addEdge("final_answer", END)
  .addEdge("max_iteration_fallback", END)
  .compile();
```

第 10 课改成：

```ts
return new StateGraph(AgentStateAnnotation)
  .addNode("llm", llmNode)
  .addNode("tools", toolNode)
  .addNode("final_answer", finalAnswerNode)
  .addNode("max_iteration_fallback", maxIterationFallbackNode)
  .addEdge(START, "llm")
  .addConditionalEdges("llm", shouldContinue)
  .addEdge("tools", "llm")
  .addEdge("final_answer", END)
  .addEdge("max_iteration_fallback", END)
  .compile({
    checkpointer: options.checkpointer,
  });
```

核心就是这段：

```ts
.compile({
  checkpointer: options.checkpointer,
});
```

这一步表示：

> 让 LangGraph 在执行过程中自动保存 checkpoint。

---

## 十一、create-agent-graph.ts 完整改动版

因为这个文件大部分逻辑和第 9 课一致，所以这里只强调：**除了引入 MemorySaver 类型、修改 AgentGraphOptions、修改 compile，其他节点逻辑保持不变。**

完整结构如下：

```ts
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import {
  END,
  START,
  StateGraph,
  type MemorySaver,
} from "@langchain/langgraph";

import {
  ToolExecutor,
  type ToolExecutionRecord,
} from "../executor/tool-executor.js";
import {
  AgentStateAnnotation,
  createTraceStep,
  type AgentState,
} from "./agent-state.js";

export type ToolCallingModel = {
  invoke(messages: BaseMessage[]): Promise<AIMessage>;
};

export type AgentGraphOptions = {
  maxIterations: number;
  checkpointer: MemorySaver;
};

export function createAgentGraph(
  modelWithTools: ToolCallingModel,
  toolExecutor: ToolExecutor,
  options: AgentGraphOptions,
) {
  async function llmNode(state: AgentState) {
    const nextLoopCount = state.loopCount + 1;

    console.log(
      `\n========== LangGraph LLM 节点，第 ${nextLoopCount} 轮 ==========`,
    );

    const aiMessage = await modelWithTools.invoke(state.messages);

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
          message: `LLM 调用完成，tool_calls 数量：${
            aiMessage.tool_calls?.length ?? 0
          }`,
        }),
      ],
    };
  }

  async function toolNode(state: AgentState) {
    console.log("\n========== LangGraph Tool 节点 ==========");

    const lastMessage = state.messages.at(-1);

    if (!(lastMessage instanceof AIMessage)) {
      return {
        currentNode: "tools",
        stopReason: "non_ai_message" as const,
        traceSteps: [
          createTraceStep({
            event: "tool_end",
            nodeName: "tools",
            loopCount: state.loopCount,
            message: "最后一条消息不是 AIMessage，无法执行工具。",
          }),
        ],
      };
    }

    const toolCalls = lastMessage.tool_calls ?? [];

    const executionResult = await toolExecutor.execute(toolCalls);

    console.log("\n工具执行日志:");
    console.log(JSON.stringify(executionResult.records, null, 2));

    const lastToolResult = getLastRecord(executionResult.records);

    return {
      messages: executionResult.messages,
      currentNode: "tools",
      toolExecutionRecords: executionResult.records,
      lastToolResult,
      traceSteps: [
        createTraceStep({
          event: "tool_end",
          nodeName: "tools",
          loopCount: state.loopCount,
          message: `工具执行完成，执行数量：${executionResult.records.length}，是否存在错误：${executionResult.hasError}`,
        }),
      ],
    };
  }

  function shouldContinue(state: AgentState) {
    const lastMessage = state.messages.at(-1);

    if (!(lastMessage instanceof AIMessage)) {
      return END;
    }

    const toolCalls = lastMessage.tool_calls ?? [];

    if (toolCalls.length === 0) {
      return "final_answer";
    }

    if (state.loopCount >= options.maxIterations) {
      return "max_iteration_fallback";
    }

    return "tools";
  }

  async function finalAnswerNode(state: AgentState) {
    return {
      currentNode: "final_answer",
      stopReason: "final_answer" as const,
      traceSteps: [
        createTraceStep({
          event: "route_to_end",
          nodeName: "final_answer",
          loopCount: state.loopCount,
          message: "模型没有继续返回 tool_calls，流程正常结束。",
        }),
      ],
    };
  }

  async function maxIterationFallbackNode(state: AgentState) {
    const message = new AIMessage({
      content:
        "已达到最大工具调用轮次。为避免 Agent 陷入循环，本次流程已停止。请简化问题或稍后重试。",
    });

    return {
      messages: [message],
      currentNode: "max_iteration_fallback",
      stopReason: "max_iterations" as const,
      maxIterationsReached: true,
      traceSteps: [
        createTraceStep({
          event: "fallback",
          nodeName: "max_iteration_fallback",
          loopCount: state.loopCount,
          message: `达到最大轮次 ${options.maxIterations}，执行兜底结束。`,
        }),
      ],
    };
  }

  return new StateGraph(AgentStateAnnotation)
    .addNode("llm", llmNode)
    .addNode("tools", toolNode)
    .addNode("final_answer", finalAnswerNode)
    .addNode("max_iteration_fallback", maxIterationFallbackNode)
    .addEdge(START, "llm")
    .addConditionalEdges("llm", shouldContinue)
    .addEdge("tools", "llm")
    .addEdge("final_answer", END)
    .addEdge("max_iteration_fallback", END)
    .compile({
      checkpointer: options.checkpointer,
    });
}

function getLastRecord(
  records: ToolExecutionRecord[],
): ToolExecutionRecord | null {
  if (records.length === 0) {
    return null;
  }

  return records[records.length - 1] ?? null;
}
```

---

## 十二、修改 index.ts

文件路径：

```text
src/lessons/lesson10-langgraph-checkpoint/index.ts
```

这个文件是本节重点。

它要演示三件事：

```text
1. 相同 thread_id 可以继承上下文
2. 不同 thread_id 互相隔离
3. 可以读取最新 checkpoint 和历史 checkpoint
```

---

## 十三、引入 MemorySaver

入口文件中增加：

```ts
import { MemorySaver } from "@langchain/langgraph";
```

然后在 `main` 中创建：

```ts
const checkpointer = new MemorySaver();
```

这就是本节的内存版状态保存器。

---

## 十四、定义 ThreadConfig 类型

```ts
type ThreadConfig = {
  configurable: {
    thread_id: string;
  };
};
```

这个类型表示调用 LangGraph 时传入的 config。

后面会这样使用：

```ts
const config = {
  configurable: {
    thread_id: "lesson10-thread-a",
  },
};
```

这里的 `thread_id` 就是会话 ID。

---

## 十五、封装 createThreadConfig

```ts
function createThreadConfig(threadId: string): ThreadConfig {
  return {
    configurable: {
      thread_id: threadId,
    },
  };
}
```

这样后面创建 config 就更清晰：

```ts
const config = createThreadConfig(params.threadId);
```

从 Java 后端视角看，这类似封装一个创建流程上下文配置的方法。

---

## 十六、第一轮输入和后续输入分开处理

第一轮输入：

```ts
function createFirstTurnInput(userInput: string) {
  return {
    messages: [new SystemMessage(systemPrompt), new HumanMessage(userInput)],
    loopCount: 0,
    currentNode: "start",
    stopReason: "running" as const,
    lastToolResult: null,
    maxIterationsReached: false,
  };
}
```

后续输入：

```ts
function createNextTurnInput(userInput: string) {
  return {
    messages: [new HumanMessage(userInput)],
    loopCount: 0,
    currentNode: "start",
    stopReason: "running" as const,
    lastToolResult: null,
    maxIterationsReached: false,
  };
}
```

为什么要分开？

因为第一轮需要放入 `SystemMessage`。

后续同一个 `thread_id` 下，checkpoint 中已经保存了历史消息，所以只需要追加新的 `HumanMessage`。

如果每一轮都追加一个新的 `SystemMessage`，消息历史会越来越混乱。

---

## 十七、为什么 loopCount 每轮重置为 0？

在输入中我们写了：

```ts
loopCount: 0
```

这是因为这里的 `loopCount` 表示：

> 本次用户输入触发的 Agent 内部循环轮数。

例如：

```text
用户第 1 句话：Agent 内部跑了 2 轮
用户第 2 句话：Agent 内部重新从 0 开始，又跑了 2 轮
```

所以每一轮新的用户输入，都可以把 `loopCount` 重置为 0。

而 `messages`、`traceSteps`、`toolExecutionRecords` 会继续累计，因为它们在 `agent-state.ts` 中配置的是追加型 reducer。

---

## 十八、封装 runTurn

```ts
async function runTurn(params: {
  graph: AgentGraph;
  threadId: string;
  userInput: string;
  isFirstTurn: boolean;
}) {
  const config = createThreadConfig(params.threadId);

  console.log("\n\n========================================");
  console.log("thread_id：", params.threadId);
  console.log("用户输入：", params.userInput);

  const input = params.isFirstTurn
    ? createFirstTurnInput(params.userInput)
    : createNextTurnInput(params.userInput);

  const result = await params.graph.invoke(input, config);

  const finalMessage = result.messages.at(-1);

  console.log("\n========== LangGraph 最终结果 ==========");
  console.log("当前节点：", result.currentNode);
  console.log("停止原因：", result.stopReason);
  console.log("本轮循环轮次：", result.loopCount);
  console.log("是否达到最大轮次：", result.maxIterationsReached);

  console.log("\n最终回答：");
  console.log(finalMessage?.content);

  console.log("\n当前线程累计消息数量：", result.messages.length);
  console.log("当前线程累计执行轨迹数量：", result.traceSteps.length);
  console.log("当前线程累计工具执行记录数量：", result.toolExecutionRecords.length);

  const latestState = await params.graph.getState(config);

  console.log("\n========== Checkpoint 最新状态 ==========");
  console.log("checkpoint_id：", latestState.config.configurable?.checkpoint_id);
  console.log("next：", latestState.next);
  console.log("createdAt：", latestState.createdAt);
  console.log("metadata.step：", latestState.metadata?.step);
  console.log("state.messages.length：", latestState.values.messages.length);
  console.log("state.stopReason：", latestState.values.stopReason);
}
```

这个方法做了几件事：

```text
1. 根据 threadId 创建 config
2. 根据是否第一轮，创建不同输入
3. 调用 graph.invoke(input, config)
4. 打印最终回答
5. 打印当前线程累计状态
6. 使用 graph.getState(config) 查看最新 checkpoint
```

重点是这行：

```ts
const result = await params.graph.invoke(input, config);
```

这里和前几课不同。

前几课是：

```ts
graph.invoke(input)
```

第 10 课变成：

```ts
graph.invoke(input, config)
```

因为我们需要通过 config 传入 `thread_id`。

---

## 十九、查看最新状态 getState

在 `runTurn` 里有这段：

```ts
const latestState = await params.graph.getState(config);
```

它的作用是：

> 查询当前 thread_id 对应的最新 checkpoint 状态。

我们打印了：

```ts
console.log("checkpoint_id：", latestState.config.configurable?.checkpoint_id);
console.log("next：", latestState.next);
console.log("createdAt：", latestState.createdAt);
console.log("metadata.step：", latestState.metadata?.step);
console.log("state.messages.length：", latestState.values.messages.length);
console.log("state.stopReason：", latestState.values.stopReason);
```

这些字段可以帮助我们观察：

```text
当前 checkpoint ID 是什么？
当前状态是否还有下一步？
当前状态是什么时候创建的？
当前 messages 累计了多少？
当前 stopReason 是什么？
```

---

## 二十、查看历史状态 getStateHistory

```ts
async function printStateHistory(params: {
  graph: AgentGraph;
  threadId: string;
  limit: number;
}) {
  const config = createThreadConfig(params.threadId);

  console.log("\n========== Checkpoint 历史记录 ==========");
  console.log("thread_id：", params.threadId);

  let count = 0;

  for await (const snapshot of params.graph.getStateHistory(config)) {
    count++;

    console.log(`\n--- checkpoint ${count} ---`);
    console.log("checkpoint_id：", snapshot.config.configurable?.checkpoint_id);
    console.log("next：", snapshot.next);
    console.log("createdAt：", snapshot.createdAt);
    console.log("metadata.step：", snapshot.metadata?.step);
    console.log("messages.length：", snapshot.values.messages.length);
    console.log("stopReason：", snapshot.values.stopReason);

    if (count >= params.limit) {
      break;
    }
  }
}
```

`getStateHistory` 可以查看某个 `thread_id` 的 checkpoint 历史。

因为它返回的是异步可迭代对象，所以这里使用：

```ts
for await...of
```

我们通过 `limit` 限制打印数量，避免输出太多。

---

## 二十一、index.ts 完整代码

```ts
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";

import {
  createAgentGraph,
  type ToolCallingModel,
} from "./graph/create-agent-graph.js";
import { ToolExecutor } from "./executor/tool-executor.js";
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

function createFirstTurnInput(userInput: string) {
  return {
    messages: [new SystemMessage(systemPrompt), new HumanMessage(userInput)],
    loopCount: 0,
    currentNode: "start",
    stopReason: "running" as const,
    lastToolResult: null,
    maxIterationsReached: false,
  };
}

function createNextTurnInput(userInput: string) {
  return {
    messages: [new HumanMessage(userInput)],
    loopCount: 0,
    currentNode: "start",
    stopReason: "running" as const,
    lastToolResult: null,
    maxIterationsReached: false,
  };
}

async function runTurn(params: {
  graph: AgentGraph;
  threadId: string;
  userInput: string;
  isFirstTurn: boolean;
}) {
  const config = createThreadConfig(params.threadId);

  console.log("\n\n========================================");
  console.log("thread_id：", params.threadId);
  console.log("用户输入：", params.userInput);

  const input = params.isFirstTurn
    ? createFirstTurnInput(params.userInput)
    : createNextTurnInput(params.userInput);

  const result = await params.graph.invoke(input, config);

  const finalMessage = result.messages.at(-1);

  console.log("\n========== LangGraph 最终结果 ==========");
  console.log("当前节点：", result.currentNode);
  console.log("停止原因：", result.stopReason);
  console.log("本轮循环轮次：", result.loopCount);
  console.log("是否达到最大轮次：", result.maxIterationsReached);

  console.log("\n最终回答：");
  console.log(finalMessage?.content);

  console.log("\n当前线程累计消息数量：", result.messages.length);
  console.log("当前线程累计执行轨迹数量：", result.traceSteps.length);
  console.log("当前线程累计工具执行记录数量：", result.toolExecutionRecords.length);

  const latestState = await params.graph.getState(config);

  console.log("\n========== Checkpoint 最新状态 ==========");
  console.log("checkpoint_id：", latestState.config.configurable?.checkpoint_id);
  console.log("next：", latestState.next);
  console.log("createdAt：", latestState.createdAt);
  console.log("metadata.step：", latestState.metadata?.step);
  console.log("state.messages.length：", latestState.values.messages.length);
  console.log("state.stopReason：", latestState.values.stopReason);
}

async function printStateHistory(params: {
  graph: AgentGraph;
  threadId: string;
  limit: number;
}) {
  const config = createThreadConfig(params.threadId);

  console.log("\n========== Checkpoint 历史记录 ==========");
  console.log("thread_id：", params.threadId);

  let count = 0;

  for await (const snapshot of params.graph.getStateHistory(config)) {
    count++;

    console.log(`\n--- checkpoint ${count} ---`);
    console.log("checkpoint_id：", snapshot.config.configurable?.checkpoint_id);
    console.log("next：", snapshot.next);
    console.log("createdAt：", snapshot.createdAt);
    console.log("metadata.step：", snapshot.metadata?.step);
    console.log("messages.length：", snapshot.values.messages.length);
    console.log("stopReason：", snapshot.values.stopReason);

    if (count >= params.limit) {
      break;
    }
  }
}

async function main() {
  const model = createModel();

  const modelWithTools = model.bindTools(tools) as ToolCallingModel;

  const toolExecutor = new ToolExecutor(tools);

  const checkpointer = new MemorySaver();

  const graph = createAgentGraph(modelWithTools, toolExecutor, {
    maxIterations: 5,
    checkpointer,
  });

  const threadA = "lesson10-thread-a";
  const threadB = "lesson10-thread-b";

  await runTurn({
    graph,
    threadId: threadA,
    userInput: "我们的企业知识库支持哪些数据源接入？",
    isFirstTurn: true,
  });

  await runTurn({
    graph,
    threadId: threadA,
    userInput: "那如果检索效果不好，一般可以怎么优化？",
    isFirstTurn: false,
  });

  await runTurn({
    graph,
    threadId: threadB,
    userInput: "知识库搜索 PDF 内容经常搜不到，帮我创建一个高优先级工单。",
    isFirstTurn: true,
  });

  await printStateHistory({
    graph,
    threadId: threadA,
    limit: 5,
  });
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 二十二、运行代码

执行：

```bash
pnpm lesson:10
```

本节会执行三次对话。

第一次：

```text
threadA：
我们的企业知识库支持哪些数据源接入？
```

第二次：

```text
threadA：
那如果检索效果不好，一般可以怎么优化？
```

第三次：

```text
threadB：
知识库搜索 PDF 内容经常搜不到，帮我创建一个高优先级工单。
```

重点观察：

```text
1. threadA 第二次会继承第一次的消息历史
2. threadB 是新线程，不会继承 threadA
3. 每次执行后都会打印最新 checkpoint
4. 最后会打印 threadA 的 checkpoint 历史
```

---

## 二十三、预期观察结果

你会看到类似输出：

```text
thread_id： lesson10-thread-a
用户输入： 我们的企业知识库支持哪些数据源接入？

当前线程累计消息数量： 4
当前线程累计执行轨迹数量： 4
当前线程累计工具执行记录数量： 1
```

第二次还是 `lesson10-thread-a`：

```text
thread_id： lesson10-thread-a
用户输入： 那如果检索效果不好，一般可以怎么优化？

当前线程累计消息数量： 8
当前线程累计执行轨迹数量： 8
当前线程累计工具执行记录数量： 2
```

这说明同一个 `thread_id` 的状态被保留下来了。

然后 `lesson10-thread-b` 是新线程：

```text
thread_id： lesson10-thread-b
用户输入： 知识库搜索 PDF 内容经常搜不到，帮我创建一个高优先级工单。
```

它不会继承 `threadA` 的消息历史。

---

## 二十四、MemorySaver 的局限

`MemorySaver` 很适合入门学习。

但是它有明显局限：

```text
1. 数据只存在内存中
2. 程序退出后状态丢失
3. 不适合多实例部署
4. 不适合生产环境
```

真实企业项目中，一般会用数据库保存 checkpoint。

例如：

```text
Postgres
MongoDB
SQLite
Redis + 数据库组合
```

不过从学习角度看，`MemorySaver` 已经足够帮助我们理解 checkpoint 的核心机制。

---

## 二十五、Java 后端视角理解

可以把第 10 课理解成：

```text
第 9 课：定义流程上下文 AgentState
第 10 课：把流程上下文按 thread_id 保存起来
```

Java 中可以类比成：

```java
public class ProcessInstance {
    private String threadId;
    private String checkpointId;
    private String stateJson;
    private String currentNode;
    private String stopReason;
    private LocalDateTime createdAt;
}
```

每次 Agent 节点执行后，保存一次状态：

```text
thread_id
checkpoint_id
state_json
metadata
created_at
```

下次同一个 `thread_id` 再进入系统时，先加载旧状态，再追加新的用户消息，然后继续执行。

这和工作流引擎、审批流、订单状态机非常像。

---

## 二十六、这一课和企业级 Agent 的关系

企业级 Agent 很少是一次性问答。

更多场景是：

```text
用户先问一个问题
Agent 查询知识库
用户继续追问
Agent 需要知道上一轮问的是什么
用户要求创建工单
Agent 需要基于之前的上下文创建工单
```

如果没有 checkpoint，每一轮都是孤立的。

有了 checkpoint，Agent 才能拥有最基础的会话连续性。

所以这一课非常关键：

> Checkpoint 是多轮记忆、人工介入、失败恢复的基础。

后续第 11 课的多轮对话记忆、第 12 课的人工确认，都会建立在第 10 课的 checkpoint 之上。

---

## 二十七、TypeScript Tips

### 1. ReturnType

```ts
type AgentGraph = ReturnType<typeof createAgentGraph>;
```

意思是提取 `createAgentGraph` 函数的返回值类型。

这样不用手写复杂的 LangGraph 返回类型。

可以理解成：

```text
让 TypeScript 帮我们推导 createAgentGraph 返回的类型
```

---

### 2. for await...of

```ts
for await (const snapshot of params.graph.getStateHistory(config)) {
  // ...
}
```

`getStateHistory` 返回的是异步可迭代对象，所以需要使用 `for await...of`。

可以类比 Java 中异步分页读取历史记录。

---

### 3. as const

```ts
stopReason: "running" as const
```

这里是告诉 TypeScript：

```text
这是字面量类型 "running"，不是普通 string
```

否则 TypeScript 可能会把它推断成普通 `string`，导致和 `AgentStopReason` 类型不匹配。

---

### 4. 类型只导入

```ts
import {
  END,
  START,
  StateGraph,
  type MemorySaver,
} from "@langchain/langgraph";
```

`type MemorySaver` 表示只导入类型。

运行时真正用到的值是在 `index.ts` 中导入的：

```ts
import { MemorySaver } from "@langchain/langgraph";
```

---

## 二十八、本节总结

第 10 课完成了 LangGraph Checkpoint 入门。

核心收获：

```text
1. Checkpoint 是 LangGraph 的状态快照机制
2. thread_id 是会话或流程实例 ID
3. MemorySaver 是内存版 checkpointer
4. compile({ checkpointer }) 可以开启状态保存
5. graph.invoke(input, config) 可以指定 thread_id
6. 相同 thread_id 会继承历史状态
7. 不同 thread_id 会隔离状态
8. getState 可以查看最新状态
9. getStateHistory 可以查看 checkpoint 历史
10. Checkpoint 是多轮记忆、人工介入、失败恢复的基础
```

本节最重要的一句话：

> Checkpoint 让 Agent 从一次性执行，升级成可保存、可恢复、可继续的有状态流程。

---

## 二十九、下一课预告

下一课进入：

# 第 11 课：多轮对话记忆，让 Agent 记住上下文

第 11 课会继续在第 10 课基础上优化：

```text
1. 避免重复追加 SystemMessage
2. 设计更清晰的 Conversation Memory
3. 控制 messages 长度
4. 优化多轮对话输入方式
5. 为后续 API 服务化做准备
```

第 10 课解决的是：

```text
状态如何保存和恢复？
```

第 11 课要解决的是：

```text
保存下来的状态如何更适合多轮对话？
```
