# 第 8 课：引入 LangGraph，把 Agent Loop 改造成状态图

## 前言

前面几节课已经完成了 AI Agent Demo 的基础能力。

第 1 课完成了：

```text
TypeScript 项目初始化
pnpm 包管理
LangChain.js 调用大模型
阿里云百炼 / 通义千问 OpenAI 兼容接口接入
```

第 2 课学习了：

```text
SystemMessage
HumanMessage
AIMessage
ChatPromptTemplate
Prompt 模板
```

第 3 课学习了：

```text
让大模型输出 JSON
使用 zod 校验结构化结果
处理模型输出不稳定的问题
```

第 4 课完成了：

```text
封装 Intent Classifier
将意图识别逻辑封装成 class
增加 fallback 兜底
为后续 Agent 工具调用做准备
```

第 5 课开始进入 Tool Calling：

```text
定义 Tool
bindTools 绑定工具
模型返回 tool_calls
程序执行工具
工具结果回传给模型
模型生成最终回答
```

第 6 课完成了 ToolExecutor 封装：

```text
统一管理工具
统一查找工具
统一执行 tool_calls
统一处理工具不存在和工具异常
记录工具执行日志
```

第 7 课完成了两个关键升级：

```text
1. 从单次 Tool Calling 升级为 Agent Loop
2. 从单文件 Demo 升级为模块化目录结构
```

第 8 课继续在第 7 课基础上升级。

这一课会正式引入 LangGraph.js，把上一课手写的 `for` 循环 Agent Loop 改造成状态图。

第 7 课是：

```text
for 循环版 Agent Loop
```

第 8 课会变成：

```text
LangGraph 状态图版 Agent
```

LangGraph 的作用不是替我们写 Prompt，也不是替我们设计 Agent 业务逻辑，而是提供一个更适合长期运行、有状态、可控制流程的 Agent / workflow 编排框架。官方文档也说明，LangGraph 提供的是用于 long-running、stateful workflow 或 Agent 的底层支撑能力，并不会抽象掉 Prompt 或架构本身。

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解为什么需要 LangGraph
2. 理解 StateGraph、State、Node、Edge 的基本概念
3. 把第 7 课手写 Agent Loop 改造成 LangGraph 状态图
4. 定义 AgentState
5. 定义 LLM 节点
6. 定义 Tool 节点
7. 定义条件边 shouldContinue
8. 保留第 7 课的模块化目录结构
9. 为后续持久化、人工确认、人类介入做准备
```

本节不会增加新的业务工具。

重点是把 Agent 的流程表达方式从：

```text
代码里的 for 循环
```

升级成：

```text
显式的状态图
```

---

## 二、为什么需要 LangGraph？

第 7 课中，我们已经手写了一个 Agent Loop。

流程是：

```text
用户输入
  ↓
模型调用
  ↓
如果模型返回 tool_calls，则执行工具
  ↓
工具结果放回 messages
  ↓
继续调用模型
  ↓
直到模型不再返回 tool_calls，或者达到最大循环次数
```

这个流程用 TypeScript 写出来，大概是：

```ts
for (let iteration = 1; iteration <= maxIterations; iteration++) {
  const aiMessage = await modelWithTools.invoke(messages);

  messages.push(aiMessage);

  const toolCalls = aiMessage.tool_calls ?? [];

  if (toolCalls.length === 0) {
    return finalAnswer;
  }

  const executionResult = await toolExecutor.execute(toolCalls);

  messages.push(...executionResult.messages);
}
```

这种写法可以跑通，也很适合理解底层原理。

但是随着 Agent 变复杂，问题会越来越明显。

例如后续我们可能需要：

```text
1. 判断是否继续调用工具
2. 判断是否达到最大轮次
3. 判断是否需要人工确认
4. 判断工具执行是否失败
5. 判断是否需要进入 RAG 检索
6. 判断是否需要转人工
7. 记录每一步执行轨迹
8. 支持流程中断后恢复
```

如果这些逻辑全部写在一个 `for` 循环里，代码会越来越难维护。

所以需要一种更清晰的方式表达 Agent 流程。

这就是 LangGraph 的价值。

LangGraph 可以把原本隐藏在代码循环中的流程，拆成：

```text
State：状态
Node：节点
Edge：边
Conditional Edge：条件边
```

这样 Agent 流程就不再只是一个长函数，而是一张明确的状态图。

---

## 三、从 Agent Loop 到状态图

第 7 课的 Agent Loop 可以抽象成下面这张流程图：

```text
调用模型
  ↓
判断是否有 tool_calls
  ├── 没有 tool_calls → 结束
  └── 有 tool_calls → 执行工具
                         ↓
                       回到调用模型
```

第 8 课用 LangGraph 表达后，会变成：

```text
START
  ↓
llm
  ↓
shouldContinue
  ├── 没有 tool_calls → END
  ├── 有 tool_calls 且没超过最大轮次 → tools
  └── 有 tool_calls 但达到最大轮次 → max_iteration_fallback
                                      ↓
                                    END

tools
  ↓
llm
```

可以看到，业务逻辑没有本质变化。

变化的是表达方式。

第 7 课是：

```text
用 for 循环表达流程
```

第 8 课是：

```text
用节点和边表达流程
```

这也是学习 LangGraph 时最重要的理解方式：

> LangGraph 不是让 Agent 变神秘，而是把 Agent 的执行流程显式拆成状态、节点和边。

---

## 四、本节目录结构

本节新建第 8 课目录：

```text
src/lessons/lesson08-langgraph-agent/
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

和第 7 课相比，主要变化是：

```text
agent/
  agent-loop.ts
```

变成了：

```text
graph/
  agent-state.ts
  create-agent-graph.ts
```

也就是说，本节不再手写 `AgentLoop` 类，而是用 LangGraph 定义状态图。

---

## 五、安装 LangGraph

在项目根目录执行：

```bash
pnpm add @langchain/langgraph
```

然后创建目录：

```bash
mkdir -p src/lessons/lesson08-langgraph-agent/data
mkdir -p src/lessons/lesson08-langgraph-agent/tools
mkdir -p src/lessons/lesson08-langgraph-agent/executor
mkdir -p src/lessons/lesson08-langgraph-agent/model
mkdir -p src/lessons/lesson08-langgraph-agent/graph
```

---

## 六、配置 package.json

在 `package.json` 中增加第 8 课脚本：

```json
{
  "scripts": {
    "lesson:01": "tsx src/lessons/lesson01-first-llm-call/index.ts",
    "lesson:02": "tsx src/lessons/lesson02-prompt-messages/index.ts",
    "lesson:03": "tsx src/lessons/lesson03-structured-output/index.ts",
    "lesson:04": "tsx src/lessons/lesson04-intent-classifier/index.ts",
    "lesson:05": "tsx src/lessons/lesson05-tool-calling/index.ts",
    "lesson:06": "tsx src/lessons/lesson06-tool-executor/index.ts",
    "lesson:07": "tsx src/lessons/lesson07-agent-loop/index.ts",
    "lesson:08": "tsx src/lessons/lesson08-langgraph-agent/index.ts"
  }
}
```

运行第 8 课：

```bash
pnpm lesson:08
```

---

## 七、准备模拟知识库数据

文件路径：

```text
src/lessons/lesson08-langgraph-agent/data/knowledge-docs.ts
```

代码如下：

```ts
export type KnowledgeDoc = {
  id: string;
  title: string;
  content: string;
  tags: string[];
};

export const knowledgeDocs: KnowledgeDoc[] = [
  {
    id: "doc-001",
    title: "企业知识库支持的数据源",
    content:
      "企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源。后续会扩展数据库表和工单系统数据。",
    tags: ["knowledge_base", "datasource", "rag"],
  },
  {
    id: "doc-002",
    title: "RAG 检索效果不好怎么办",
    content:
      "如果 RAG 检索效果不好，可以从文档切分、Embedding 模型、召回数量、关键词补充、重排序、Prompt 约束等方面优化。",
    tags: ["knowledge_base", "rag", "retrieval"],
  },
  {
    id: "doc-003",
    title: "Agent 工具调用规范",
    content:
      "Agent 调用工具前应先判断意图，工具入参必须通过 schema 校验，工具执行失败时需要有兜底响应。",
    tags: ["agent", "tool_calling"],
  },
];
```

这里仍然使用内存数组模拟企业知识库。

后续进入 RAG 阶段时，这里可以替换成：

```text
向量数据库
全文检索引擎
文档解析结果
企业知识库 API
数据库查询接口
```

---

## 八、定义知识库查询工具

文件路径：

```text
src/lessons/lesson08-langgraph-agent/tools/search-knowledge-base.tool.ts
```

代码如下：

```ts
import { tool } from "@langchain/core/tools";
import * as z from "zod";

import { knowledgeDocs } from "../data/knowledge-docs.js";

export const searchKnowledgeBaseTool = tool(
  async ({ query }) => {
    const lowerQuery = query.toLowerCase();

    const results = knowledgeDocs.filter((doc) => {
      return (
        doc.title.toLowerCase().includes(lowerQuery) ||
        doc.content.toLowerCase().includes(lowerQuery) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    });

    return JSON.stringify(
      {
        query,
        count: results.length,
        results,
      },
      null,
      2,
    );
  },
  {
    name: "search_knowledge_base",
    description:
      "查询企业 AI 知识库中的内部资料。当用户询问知识库、RAG、文档接入、检索优化、Agent 工具规范时使用。",
    schema: z.object({
      query: z
        .string()
        .describe("用于检索知识库的关键词，例如：RAG、数据源、工具调用规范"),
    }),
  },
);
```

这里继续保持第 7 课的规则：

```text
本地相对路径 import 要加 .js
```

所以是：

```ts
import { knowledgeDocs } from "../data/knowledge-docs.js";
```

而不是：

```ts
import { knowledgeDocs } from "../data/knowledge-docs";
```

---

## 九、定义工单创建工具

文件路径：

```text
src/lessons/lesson08-langgraph-agent/tools/create-ticket.tool.ts
```

代码如下：

```ts
import { tool } from "@langchain/core/tools";
import * as z from "zod";

export const createTicketTool = tool(
  async ({ title, description, priority }) => {
    const ticketNo = `TICKET-${Date.now()}`;

    return JSON.stringify(
      {
        ticketNo,
        title,
        description,
        priority,
        status: "created",
        message: "工单已创建，后续将由技术支持人员跟进。",
      },
      null,
      2,
    );
  },
  {
    name: "create_ticket",
    description:
      "创建技术支持工单。当用户明确要求反馈问题、创建工单、提交故障、联系技术支持时使用。如果用户要求先查询知识库再创建工单，应先等待知识库查询结果，再调用本工具。",
    schema: z.object({
      title: z.string().describe("工单标题，简短概括用户遇到的问题"),
      description: z.string().describe("工单详细描述"),
      priority: z.enum(["low", "medium", "high"]).describe("工单优先级"),
    }),
  },
);
```

这个工具代表操作型工具。

在真实企业项目中，创建工单、提交审批、发送通知、修改订单等工具都属于操作型工具。

这类工具后续通常需要加入：

```text
权限校验
参数校验
审计日志
二次确认
失败重试
```

---

## 十、统一导出工具列表

文件路径：

```text
src/lessons/lesson08-langgraph-agent/tools/index.ts
```

代码如下：

```ts
import type { StructuredToolInterface } from "@langchain/core/tools";

import { createTicketTool } from "./create-ticket.tool.js";
import { searchKnowledgeBaseTool } from "./search-knowledge-base.tool.js";

export const tools: StructuredToolInterface[] = [
  searchKnowledgeBaseTool,
  createTicketTool,
];
```

这个文件继续作为工具注册中心。

后续新增工具时，只需要：

```text
1. 在 tools 目录下新增 xxx.tool.ts
2. 在 tools/index.ts 中引入
3. 加入 tools 数组
```

---

## 十一、封装 ToolExecutor

文件路径：

```text
src/lessons/lesson08-langgraph-agent/executor/tool-executor.ts
```

代码如下：

```ts
import { ToolMessage, type AIMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";

export type ToolCall = NonNullable<AIMessage["tool_calls"]>[number];

export type ToolExecutionStatus = "success" | "tool_not_found" | "error";

export type ToolExecutionRecord = {
  toolName: string;
  toolCallId?: string;
  args: unknown;
  status: ToolExecutionStatus;
  content: string;
  errorMessage?: string;
  durationMs: number;
};

export type ToolExecutionResult = {
  messages: ToolMessage[];
  records: ToolExecutionRecord[];
  hasError: boolean;
};

export class ToolExecutor {
  private readonly toolMap: Map<string, StructuredToolInterface>;

  constructor(tools: StructuredToolInterface[]) {
    this.toolMap = new Map(tools.map((item) => [item.name, item]));
  }

  async execute(toolCalls: ToolCall[]): Promise<ToolExecutionResult> {
    const messages: ToolMessage[] = [];
    const records: ToolExecutionRecord[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeOne(toolCall);

      messages.push(result.message);
      records.push(result.record);
    }

    return {
      messages,
      records,
      hasError: records.some((record) => record.status !== "success"),
    };
  }

  private async executeOne(toolCall: ToolCall): Promise<{
    message: ToolMessage;
    record: ToolExecutionRecord;
  }> {
    const startTime = Date.now();
    const selectedTool = this.toolMap.get(toolCall.name);

    if (!selectedTool) {
      const content = JSON.stringify(
        {
          status: "tool_not_found",
          message: `未找到工具：${toolCall.name}`,
        },
        null,
        2,
      );

      const message = new ToolMessage({
        content,
        tool_call_id: toolCall.id ?? `${toolCall.name}-missing-id`,
        name: toolCall.name,
      });

      return {
        message,
        record: {
          toolName: toolCall.name,
          toolCallId: toolCall.id,
          args: toolCall.args,
          status: "tool_not_found",
          content,
          errorMessage: `未找到工具：${toolCall.name}`,
          durationMs: Date.now() - startTime,
        },
      };
    }

    try {
      const message = await selectedTool.invoke(toolCall);
      const content = this.stringifyContent(message.content);

      return {
        message,
        record: {
          toolName: toolCall.name,
          toolCallId: toolCall.id,
          args: toolCall.args,
          status: "success",
          content,
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "未知工具执行错误";

      const content = JSON.stringify(
        {
          status: "error",
          message: `工具 ${toolCall.name} 执行失败`,
          errorMessage,
        },
        null,
        2,
      );

      const message = new ToolMessage({
        content,
        tool_call_id: toolCall.id ?? `${toolCall.name}-error-id`,
        name: toolCall.name,
      });

      return {
        message,
        record: {
          toolName: toolCall.name,
          toolCallId: toolCall.id,
          args: toolCall.args,
          status: "error",
          content,
          errorMessage,
          durationMs: Date.now() - startTime,
        },
      };
    }
  }

  private stringifyContent(content: unknown): string {
    if (typeof content === "string") {
      return content;
    }

    return JSON.stringify(content, null, 2);
  }
}
```

这个文件继续沿用第 6、7 课的 ToolExecutor。

区别是：第 8 课中，它不再被 `AgentLoop` 调用，而是会被 LangGraph 的 `tools` 节点调用。

---

## 十二、封装模型创建函数

文件路径：

```text
src/lessons/lesson08-langgraph-agent/model/create-model.ts
```

代码如下：

```ts
import "dotenv/config";

import { ChatOpenAI } from "@langchain/openai";

export function createModel() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseURL = process.env.DASHSCOPE_BASE_URL;

  if (!apiKey) {
    throw new Error("缺少环境变量 DASHSCOPE_API_KEY");
  }

  if (!baseURL) {
    throw new Error("缺少环境变量 DASHSCOPE_BASE_URL");
  }

  return new ChatOpenAI({
    model: "qwen3.6-flash",
    temperature: 0,
    apiKey,
    configuration: {
      baseURL,
    },
    streamUsage: false,
  });
}
```

模型创建继续单独放在 `model/create-model.ts` 中。

后续如果需要切换模型、增加 debug fetch、修改 temperature，都只需要改这个文件。

---

## 十三、定义 AgentState

文件路径：

```text
src/lessons/lesson08-langgraph-agent/graph/agent-state.ts
```

代码如下：

```ts
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import type { ToolExecutionRecord } from "../executor/tool-executor.js";

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  loopCount: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),

  toolExecutionRecords: Annotation<ToolExecutionRecord[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;
```

这是本节最重要的新增文件之一。

在 LangGraph 中，State 可以理解成整个流程共享的上下文。

在本节中，我们的状态包含三个字段：

```text
messages：模型对话消息
loopCount：当前循环轮次
toolExecutionRecords：工具执行记录
```

### 1. messages

```ts
messages: Annotation<BaseMessage[]>({
  reducer: messagesStateReducer,
  default: () => [],
}),
```

`messages` 用来保存整个对话历史。

包括：

```text
SystemMessage
HumanMessage
AIMessage
ToolMessage
```

这里使用了 `messagesStateReducer`。

它的作用是：当节点返回新的 messages 时，不是覆盖旧 messages，而是追加到旧 messages 后面。LangGraph.js 官方也提供了 `MessagesAnnotation` / 消息 reducer 这类机制，用于处理消息状态的合并。

### 2. loopCount

```ts
loopCount: Annotation<number>({
  reducer: (_left, right) => right,
  default: () => 0,
}),
```

`loopCount` 用来记录当前 LLM 调用轮次。

这里的 reducer 是：

```ts
(_left, right) => right
```

意思是：新值覆盖旧值。

例如：

```text
旧值：1
新值：2
最终：2
```

### 3. toolExecutionRecords

```ts
toolExecutionRecords: Annotation<ToolExecutionRecord[]>({
  reducer: (left, right) => left.concat(right),
  default: () => [],
}),
```

这个字段用来记录工具执行日志。

这里的 reducer 是：

```ts
(left, right) => left.concat(right)
```

意思是：新的工具执行记录追加到旧记录后面。

这样每次工具执行结果都能被保存下来。

---

## 十四、创建 AgentGraph

文件路径：

```text
src/lessons/lesson08-langgraph-agent/graph/create-agent-graph.ts
```

代码如下：

```ts
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";

import { ToolExecutor } from "../executor/tool-executor.js";
import {
  AgentStateAnnotation,
  type AgentState,
} from "./agent-state.js";

export type ToolCallingModel = {
  invoke(messages: BaseMessage[]): Promise<AIMessage>;
};

export type AgentGraphOptions = {
  maxIterations: number;
};

export function createAgentGraph(
  modelWithTools: ToolCallingModel,
  toolExecutor: ToolExecutor,
  options: AgentGraphOptions,
) {
  async function llmNode(state: AgentState) {
    console.log(
      `\n========== LangGraph LLM 节点，第 ${state.loopCount + 1} 轮 ==========`,
    );

    const aiMessage = await modelWithTools.invoke(state.messages);

    console.log("\n模型返回 content:");
    console.log(aiMessage.content);

    console.log("\n模型返回 tool_calls:");
    console.log(JSON.stringify(aiMessage.tool_calls ?? [], null, 2));

    return {
      messages: [aiMessage],
      loopCount: state.loopCount + 1,
    };
  }

  async function toolNode(state: AgentState) {
    console.log("\n========== LangGraph Tool 节点 ==========");

    const lastMessage = state.messages.at(-1);

    if (!(lastMessage instanceof AIMessage)) {
      return {
        messages: [],
        toolExecutionRecords: [],
      };
    }

    const toolCalls = lastMessage.tool_calls ?? [];

    const executionResult = await toolExecutor.execute(toolCalls);

    console.log("\n工具执行日志:");
    console.log(JSON.stringify(executionResult.records, null, 2));

    return {
      messages: executionResult.messages,
      toolExecutionRecords: executionResult.records,
    };
  }

  function shouldContinue(state: AgentState) {
    const lastMessage = state.messages.at(-1);

    if (!(lastMessage instanceof AIMessage)) {
      return END;
    }

    const toolCalls = lastMessage.tool_calls ?? [];

    if (toolCalls.length === 0) {
      return END;
    }

    if (state.loopCount >= options.maxIterations) {
      return "max_iteration_fallback";
    }

    return "tools";
  }

  async function maxIterationFallbackNode() {
    const message = new AIMessage({
      content:
        "已达到最大工具调用轮次。为避免 Agent 陷入循环，本次流程已停止。请简化问题或稍后重试。",
    });

    return {
      messages: [message],
    };
  }

  return new StateGraph(AgentStateAnnotation)
    .addNode("llm", llmNode)
    .addNode("tools", toolNode)
    .addNode("max_iteration_fallback", maxIterationFallbackNode)
    .addEdge(START, "llm")
    .addConditionalEdges("llm", shouldContinue)
    .addEdge("tools", "llm")
    .addEdge("max_iteration_fallback", END)
    .compile();
}
```

这个文件是第 8 课的核心。

它定义了：

```text
1. LLM 节点
2. Tool 节点
3. 最大轮次兜底节点
4. 条件判断函数 shouldContinue
5. 节点之间的边
```

LangGraph 的 `StateGraph` 会通过节点读写共享 State 来完成流程编排，图定义完成后需要通过 `.compile()` 编译成可运行对象。

---

## 十五、理解 LLM 节点

代码如下：

```ts
async function llmNode(state: AgentState) {
  console.log(
    `\n========== LangGraph LLM 节点，第 ${state.loopCount + 1} 轮 ==========`,
  );

  const aiMessage = await modelWithTools.invoke(state.messages);

  console.log("\n模型返回 content:");
  console.log(aiMessage.content);

  console.log("\n模型返回 tool_calls:");
  console.log(JSON.stringify(aiMessage.tool_calls ?? [], null, 2));

  return {
    messages: [aiMessage],
    loopCount: state.loopCount + 1,
  };
}
```

LLM 节点的职责是：

```text
读取当前 messages
  ↓
调用绑定了 tools 的模型
  ↓
拿到 AIMessage
  ↓
把 AIMessage 写回 messages
  ↓
loopCount + 1
```

这里返回的是部分状态更新：

```ts
return {
  messages: [aiMessage],
  loopCount: state.loopCount + 1,
};
```

它不是返回完整 State，而是只返回本节点修改的字段。

这也是 LangGraph 的常见写法：

```text
节点读取完整 State
节点返回部分 State 更新
LangGraph 根据 reducer 合并状态
```

---

## 十六、理解 Tool 节点

代码如下：

```ts
async function toolNode(state: AgentState) {
  console.log("\n========== LangGraph Tool 节点 ==========");

  const lastMessage = state.messages.at(-1);

  if (!(lastMessage instanceof AIMessage)) {
    return {
      messages: [],
      toolExecutionRecords: [],
    };
  }

  const toolCalls = lastMessage.tool_calls ?? [];

  const executionResult = await toolExecutor.execute(toolCalls);

  console.log("\n工具执行日志:");
  console.log(JSON.stringify(executionResult.records, null, 2));

  return {
    messages: executionResult.messages,
    toolExecutionRecords: executionResult.records,
  };
}
```

Tool 节点的职责是：

```text
从 messages 中取最后一条消息
  ↓
确认它是 AIMessage
  ↓
读取 AIMessage.tool_calls
  ↓
交给 ToolExecutor 执行
  ↓
返回 ToolMessage[]
  ↓
返回工具执行记录
```

这里的 `ToolExecutor` 是第 6 课封装的工具执行层。

第 8 课没有废弃它，而是把它复用到了 LangGraph 的 Tool 节点中。

这也说明前面的工程化封装是有价值的。

---

## 十七、理解条件边 shouldContinue

代码如下：

```ts
function shouldContinue(state: AgentState) {
  const lastMessage = state.messages.at(-1);

  if (!(lastMessage instanceof AIMessage)) {
    return END;
  }

  const toolCalls = lastMessage.tool_calls ?? [];

  if (toolCalls.length === 0) {
    return END;
  }

  if (state.loopCount >= options.maxIterations) {
    return "max_iteration_fallback";
  }

  return "tools";
}
```

`shouldContinue` 的作用是决定 LLM 节点之后走哪里。

它有三种结果。

第一种，没有 tool_calls：

```ts
return END;
```

说明模型已经给出最终回答，流程结束。

第二种，有 tool_calls，并且还没有达到最大轮次：

```ts
return "tools";
```

说明需要进入 Tool 节点执行工具。

第三种，有 tool_calls，但是已经达到最大轮次：

```ts
return "max_iteration_fallback";
```

说明 Agent 可能陷入循环，需要走兜底节点。

这部分对应第 7 课里的：

```ts
if (toolCalls.length === 0) {
  return finalAnswer;
}

if (iteration >= maxIterations) {
  return fallback;
}
```

现在这些判断从 `for` 循环里拆出来，变成了 LangGraph 的条件边。

---

## 十八、理解图的定义

最后这段代码定义了完整的图：

```ts
return new StateGraph(AgentStateAnnotation)
  .addNode("llm", llmNode)
  .addNode("tools", toolNode)
  .addNode("max_iteration_fallback", maxIterationFallbackNode)
  .addEdge(START, "llm")
  .addConditionalEdges("llm", shouldContinue)
  .addEdge("tools", "llm")
  .addEdge("max_iteration_fallback", END)
  .compile();
```

可以逐句理解。

### 1. 创建状态图

```ts
new StateGraph(AgentStateAnnotation)
```

表示创建一个基于 `AgentStateAnnotation` 的状态图。

### 2. 添加节点

```ts
.addNode("llm", llmNode)
.addNode("tools", toolNode)
.addNode("max_iteration_fallback", maxIterationFallbackNode)
```

这里定义了三个节点：

```text
llm：调用模型
tools：执行工具
max_iteration_fallback：最大轮次兜底
```

### 3. 添加起点边

```ts
.addEdge(START, "llm")
```

表示图从 `START` 开始后，先进入 `llm` 节点。

### 4. 添加条件边

```ts
.addConditionalEdges("llm", shouldContinue)
```

表示 `llm` 节点执行完后，下一步由 `shouldContinue` 决定。

### 5. 工具节点执行完回到 LLM

```ts
.addEdge("tools", "llm")
```

表示工具执行完后，再回到 LLM 节点。

这就是 Agent Loop。

### 6. 最大轮次兜底后结束

```ts
.addEdge("max_iteration_fallback", END)
```

表示兜底节点执行完后，流程结束。

### 7. 编译图

```ts
.compile()
```

图定义完成后，需要 compile 成可执行对象。

之后就可以调用：

```ts
graph.invoke(...)
```

---

## 十九、编写入口文件

文件路径：

```text
src/lessons/lesson08-langgraph-agent/index.ts
```

代码如下：

```ts
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

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

async function main() {
  const model = createModel();

  const modelWithTools = model.bindTools(tools) as ToolCallingModel;

  const toolExecutor = new ToolExecutor(tools);

  const graph = createAgentGraph(modelWithTools, toolExecutor, {
    maxIterations: 5,
  });

  const inputs = [
    "我们的企业知识库支持哪些数据源接入？",
    "先查一下 RAG 检索效果不好怎么办，然后基于查询结果帮我创建一个中优先级工单。",
    "知识库搜索 PDF 内容经常搜不到，帮我创建一个高优先级工单。",
  ];

  for (const input of inputs) {
    console.log("\n\n========================================");
    console.log("用户输入：", input);

    const result = await graph.invoke({
      messages: [new SystemMessage(systemPrompt), new HumanMessage(input)],
    });

    const finalMessage = result.messages.at(-1);

    console.log("\n========== LangGraph 最终结果 ==========");
    console.log("循环轮次：", result.loopCount);
    console.log("最终回答：");
    console.log(finalMessage?.content);

    console.log("\n工具执行总记录：");
    console.log(JSON.stringify(result.toolExecutionRecords, null, 2));
  }
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

入口文件现在只负责组装：

```text
创建模型
  ↓
绑定工具
  ↓
创建 ToolExecutor
  ↓
创建 AgentGraph
  ↓
调用 graph.invoke
```

Agent 流程本身已经被封装到 `graph/create-agent-graph.ts` 中。

---

## 二十、运行代码

执行：

```bash
pnpm lesson:08
```

运行后可以重点观察输出。

示例输出结构如下：

```text
========================================
用户输入： 我们的企业知识库支持哪些数据源接入？

========== LangGraph LLM 节点，第 1 轮 ==========

模型返回 tool_calls:
[
  {
    "name": "search_knowledge_base",
    "args": {
      "query": "企业知识库支持的数据源"
    }
  }
]

========== LangGraph Tool 节点 ==========

工具执行日志:
[
  {
    "toolName": "search_knowledge_base",
    "status": "success",
    "durationMs": 1
  }
]

========== LangGraph LLM 节点，第 2 轮 ==========

模型返回 tool_calls:
[]

========== LangGraph 最终结果 ==========
循环轮次： 2
最终回答：
企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源。后续会扩展数据库表和工单系统数据。
```

这个输出说明流程是：

```text
LLM 节点
  ↓
Tool 节点
  ↓
LLM 节点
  ↓
END
```

也就是 LangGraph 版 Agent Loop 已经跑通。

---

## 二十一、测试多步任务

本节最值得观察的是这个输入：

```text
先查一下 RAG 检索效果不好怎么办，然后基于查询结果帮我创建一个中优先级工单。
```

理想情况下，执行过程是：

```text
第 1 轮：
LLM 节点调用 search_knowledge_base
  ↓
Tool 节点执行知识库查询

第 2 轮：
LLM 节点看到知识库结果后，调用 create_ticket
  ↓
Tool 节点创建工单

第 3 轮：
LLM 节点不再返回 tool_calls
  ↓
输出最终回答
```

这说明 Agent 已经具备了多轮任务编排能力。

当然，实际模型表现可能会有差异。

有时模型可能会在一轮里同时返回多个 tool_calls。

有时模型可能会跳过查询，直接创建工单。

这属于 Agent 工程中的真实问题。

后续可以通过优化：

```text
System Prompt
工具 description
工具拆分方式
流程控制逻辑
状态字段
```

来提升稳定性。

---

## 二十二、第 8 课和第 7 课的区别

第 7 课是手写 Agent Loop：

```text
for 循环
  ↓
调用模型
  ↓
判断 tool_calls
  ↓
执行工具
  ↓
继续循环
```

第 8 课是 LangGraph 状态图：

```text
StateGraph
  ↓
llm node
  ↓
conditional edge
  ↓
tools node
  ↓
llm node
```

两者做的事情很像，但表达方式不同。

第 7 课适合理解底层流程。

第 8 课更适合后续工程扩展。

可以简单理解为：

```text
第 7 课：先手写流程，理解 Agent Loop
第 8 课：再用 LangGraph，把流程图形化、状态化、节点化
```

---

## 二十三、这节课和 Agent 的关系

Agent 和普通 LLM 应用最大的区别，不只是能不能聊天，而是能不能围绕任务进行多步执行。

普通 LLM 应用是：

```text
用户输入
  ↓
模型回答
```

Tool Calling 是：

```text
用户输入
  ↓
模型选择工具
  ↓
程序执行工具
  ↓
模型回答
```

Agent Loop 是：

```text
用户输入
  ↓
模型选择工具
  ↓
程序执行工具
  ↓
工具结果回传模型
  ↓
模型继续判断下一步
  ↓
继续调用工具或输出最终回答
```

LangGraph 则进一步把这个流程表达成：

```text
状态
节点
边
条件边
```

也就是说：

> LangGraph 让 Agent 的执行流程从代码循环升级成显式的状态机。

这对企业级 Agent 很重要。

因为企业 Agent 往往不是简单问答，而是有复杂流程：

```text
先判断意图
再检索知识库
再判断是否需要创建工单
再判断是否需要人工确认
再输出最终回答
```

这种流程用图结构表达会更清晰。

---

## 二十四、Java 后端视角理解 LangGraph

作为 Java 后端开发者，可以把 LangGraph 理解成一个轻量级流程编排器。

如果流程很简单，我们可以直接写：

```java
while (...) {
    // 调模型
    // 判断是否要调工具
    // 调工具
}
```

但如果流程越来越复杂，比如：

```text
审批流
订单状态流转
任务编排
异常分支
人工确认
```

通常不会把所有逻辑写在一个 `while` 里，而是会抽象成：

```text
状态
节点
条件
流转
```

LangGraph 在 Agent 场景中也类似。

可以这样类比：

| LangGraph 概念     | Java 后端类比              |
| ---------------- | ---------------------- |
| State            | 流程上下文 / ProcessContext |
| Node             | 流程节点 / Handler / Step  |
| Edge             | 固定流程流转                 |
| Conditional Edge | 条件分支                   |
| START            | 流程开始                   |
| END              | 流程结束                   |
| reducer          | 状态合并规则                 |
| compile          | 构建可执行流程                |

本节中的流程可以类比为：

```text
ProcessContext
  ↓
LLMStep
  ↓
ShouldContinueCondition
  ↓
ToolStep
  ↓
LLMStep
```

这样就比直接写一大段循环代码更容易维护。

---

## 二十五、企业级 LangGraph 后续可以扩展什么？

本节只是把 Agent Loop 改造成状态图。

真实企业项目中，LangGraph 还可以继续扩展很多能力。

### 1. 更丰富的 AgentState

目前状态只有：

```text
messages
loopCount
toolExecutionRecords
```

后续可以增加：

```text
userId
sessionId
traceId
intent
currentStep
stopReason
lastToolResult
needHumanApproval
```

这样 Agent 的执行过程会更可观测。

---

### 2. 人工确认节点

对于高风险工具，可以增加人工确认节点。

例如：

```text
LLM 生成操作计划
  ↓
human_approval_node
  ↓
用户确认后再执行 tool_node
```

这适合：

```text
删除数据
修改订单
提交审批
发送通知
执行付款
```

---

### 3. 错误处理节点

当前工具失败后，只是把错误信息作为 ToolMessage 返回给模型。

后续可以增加专门的错误处理节点：

```text
tool_node
  ↓
如果失败 → error_handler_node
  ↓
生成友好提示或转人工
```

---

### 4. RAG 检索节点

后续进入 RAG 阶段时，可以新增：

```text
retrieve_node
rerank_node
generate_answer_node
```

这样知识库问答就不一定只是一个 Tool，而可以是一个独立子流程。

---

### 5. 持久化和恢复

目前所有状态都在内存里。

真实系统中，Agent 可能需要：

```text
保存执行状态
中途失败后恢复
支持长时间任务
支持用户稍后继续
```

这也是 LangGraph 适合复杂 Agent 的重要原因之一。官方也把 durable execution、human-in-the-loop、memory、debugging 等列为 LangGraph 的核心能力方向。

---

## 二十六、Tips：本节涉及的 TypeScript 写法

本节重点仍然是 Agent 工程化和 LangGraph，TypeScript 内容只做简要记录。

### 1. `typeof AgentStateAnnotation.State`

```ts
export type AgentState = typeof AgentStateAnnotation.State;
```

这表示从 `AgentStateAnnotation` 自动推导 State 类型。

类似第 3 课中用 zod 推导类型：

```ts
type IntentResult = z.infer<typeof IntentSchema>;
```

好处是不用手写一遍 State 类型，避免类型和 Annotation 不一致。

---

### 2. `Annotation.Root`

```ts
export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
});
```

可以理解成定义 LangGraph 的流程上下文结构。

类似 Java 中定义：

```java
public class AgentState {
    private List<BaseMessage> messages;
    private Integer loopCount;
    private List<ToolExecutionRecord> toolExecutionRecords;
}
```

---

### 3. reducer

```ts
reducer: (left, right) => left.concat(right)
```

reducer 的作用是告诉 LangGraph：

```text
当节点返回新值时，如何和旧状态合并。
```

例如工具执行记录，我们希望是追加：

```text
旧记录 + 新记录
```

而不是覆盖。

---

### 4. `state.messages.at(-1)`

```ts
const lastMessage = state.messages.at(-1);
```

`at(-1)` 表示取数组最后一个元素。

类似：

```ts
state.messages[state.messages.length - 1]
```

只是写法更简洁。

---

### 5. `addConditionalEdges`

```ts
.addConditionalEdges("llm", shouldContinue)
```

表示从 `llm` 节点出来后，不是固定走某个节点，而是由 `shouldContinue` 函数决定下一步去哪。

这类似 Java 流程中的条件分支：

```java
if (hasToolCalls) {
    return "tools";
} else {
    return "end";
}
```

---

### 6. 本地相对导入继续加 `.js`

本节继续使用 NodeNext / Node16 规则：

```ts
import { createModel } from "./model/create-model.js";
```

本地相对路径加 `.js`。

第三方包不用加：

```ts
import { ChatOpenAI } from "@langchain/openai";
```

后续课程继续遵守：

```text
本地相对路径：加 .js
npm 包路径：不加 .js
```

---

## 二十七、本节总结

第 8 课完成了一个关键升级：

```text
把手写 Agent Loop 改造成 LangGraph 状态图
```

核心收获：

```text
1. 第 7 课用 for 循环手写 Agent Loop
2. 第 8 课用 StateGraph 表达 Agent Loop
3. State 是整个流程共享的上下文
4. Node 负责读取 State 并返回部分 State 更新
5. Edge 负责定义节点之间的固定流转
6. Conditional Edge 负责根据状态决定下一步
7. messages 需要 reducer 来追加历史消息
8. ToolExecutor 可以复用到 LangGraph 的 Tool 节点中
9. LangGraph 更适合复杂 Agent 流程、状态管理和后续扩展
```

本节最重要的一句话：

> LangGraph 不是让 Agent 变神秘，而是把原本隐藏在循环里的执行流程显式拆成状态、节点和边。

---

## 二十八、下一课预告

下一课进入：

# 第 9 课：LangGraph 状态增强，记录执行轨迹和中间状态

第 9 课会继续在第 8 课基础上扩展：

```text
1. 扩展 AgentState
2. 记录 stopReason
3. 记录每一步执行轨迹
4. 记录当前节点名称
5. 记录最后一次工具调用结果
6. 记录是否达到最大轮次
7. 为后续持久化和 LangSmith 调试做准备
```

第 8 课完成的是：

```text
把 Agent Loop 改造成状态图
```

第 9 课会继续做：

```text
让状态图更可观测、更适合调试和工程化落地
```
