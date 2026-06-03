# 第 9 课：LangGraph 状态增强，记录执行轨迹和中间状态

## 前言

前面几节课已经完成了 AI Agent Demo 的核心基础。

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

第 7 课完成了 Agent Loop 和模块化拆分：

```text
从单次 Tool Calling 升级为 Agent Loop
从单文件 Demo 升级为模块化目录结构
```

第 8 课正式引入 LangGraph：

```text
使用 StateGraph 表达 Agent 流程
定义 LLM 节点
定义 Tool 节点
定义 shouldContinue 条件边
把手写 Agent Loop 改造成状态图
```

第 9 课继续在第 8 课基础上做增强。

这一课的重点不是新增工具，也不是新增复杂业务，而是让 Agent 的运行过程更清晰、更容易调试、更容易复盘。

也就是说，第 9 课要解决的问题是：

> Agent 不只是要能跑，还要能看清楚它是怎么跑的。

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 扩展 AgentState
2. 记录 currentNode
3. 记录 stopReason
4. 记录 traceSteps
5. 记录 lastToolResult
6. 记录 maxIterationsReached
7. 让 LangGraph 执行结果更适合调试和复盘
```

第 8 课的 State 主要包含：

```text
messages
loopCount
toolExecutionRecords
```

第 9 课会扩展为：

```text
messages
loopCount
currentNode
stopReason
traceSteps
toolExecutionRecords
lastToolResult
maxIterationsReached
```

这样每次 Agent 执行结束后，我们不仅能看到最终回答，还能看到：

```text
Agent 执行到了哪个节点
Agent 为什么停止
Agent 一共执行了几轮
Agent 调用了哪些工具
最后一次工具执行结果是什么
是否触发最大轮次保护
完整执行轨迹是什么
```

---

## 二、为什么要增强 AgentState？

第 8 课中，我们已经把 Agent Loop 改造成 LangGraph 状态图。

流程大致是：

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

这个流程已经可以正常运行。

但是在真实企业项目中，仅仅知道“最终回答是什么”是不够的。

因为 Agent 的问题往往不是代码完全不能跑，而是：

```text
为什么模型选择了这个工具？
为什么没有继续调用工具？
为什么工具执行失败后没有正确兜底？
为什么模型重复调用同一个工具？
为什么流程提前结束了？
为什么触发了最大轮次？
```

如果没有状态记录和执行轨迹，排查这些问题会非常困难。

所以我们需要把 Agent 执行过程中的关键信息记录下来。

这就是第 9 课要做的事情：

> 为 Agent 增加可观测性，让每一次执行都可以复盘。

---

## 三、本节目录结构

本节新建第 9 课目录：

```text
src/lessons/lesson09-langgraph-state/
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

和第 8 课相比，主要修改：

```text
graph/agent-state.ts
graph/create-agent-graph.ts
index.ts
```

其他文件可以继续沿用第 8 课的结构。

---

## 四、配置 package.json

在 `package.json` 中增加第 9 课脚本：

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
    "lesson:08": "tsx src/lessons/lesson08-langgraph-agent/index.ts",
    "lesson:09": "tsx src/lessons/lesson09-langgraph-state/index.ts"
  }
}
```

运行第 9 课：

```bash
pnpm lesson:09
```

---

## 五、本节整体流程设计

第 8 课的流程是：

```text
用户输入
  ↓
LangGraph LLM 节点
  ↓
判断是否需要调用工具
  ↓
Tool 节点执行工具
  ↓
回到 LLM 节点
  ↓
最终回答
```

第 9 课会在这个流程上增加状态记录：

```text
用户输入
  ↓
LLM 节点
  ↓
记录 LLM 执行轨迹
  ↓
shouldContinue 条件判断
  ↓
Tool 节点
  ↓
记录工具执行结果
  ↓
记录 lastToolResult
  ↓
最终结束节点
  ↓
记录 stopReason
```

也就是说，第 9 课不是改变 Agent 的业务流程，而是增强执行过程中的状态信息。

---

## 六、准备模拟知识库数据

文件路径：

```text
src/lessons/lesson09-langgraph-state/data/knowledge-docs.ts
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

后续进入 RAG 阶段后，这里会逐步升级成真实的文档加载、切分、Embedding 和向量检索。

---

## 七、定义工具

本节继续使用两个工具。

第一个工具：

```text
search_knowledge_base
```

用于模拟知识库查询。

文件路径：

```text
src/lessons/lesson09-langgraph-state/tools/search-knowledge-base.tool.ts
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

第二个工具：

```text
create_ticket
```

用于模拟创建技术支持工单。

文件路径：

```text
src/lessons/lesson09-langgraph-state/tools/create-ticket.tool.ts
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

统一导出工具列表：

```ts
import type { StructuredToolInterface } from "@langchain/core/tools";

import { createTicketTool } from "./create-ticket.tool.js";
import { searchKnowledgeBaseTool } from "./search-knowledge-base.tool.js";

export const tools: StructuredToolInterface[] = [
  searchKnowledgeBaseTool,
  createTicketTool,
];
```

---

## 八、继续复用 ToolExecutor

第 9 课继续复用第 6 课封装的 ToolExecutor。

文件路径：

```text
src/lessons/lesson09-langgraph-state/executor/tool-executor.ts
```

核心职责仍然是：

```text
根据 toolCall.name 查找工具
执行工具
处理工具不存在
处理工具执行异常
返回 ToolMessage
记录 ToolExecutionRecord
```

核心类型如下：

```ts
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
```

这部分在第 9 课中没有大的变化。

真正变化的是：ToolExecutor 的执行结果会被写入 LangGraph State 中，成为后续调试和复盘的一部分。

---

## 九、封装模型创建函数

文件路径：

```text
src/lessons/lesson09-langgraph-state/model/create-model.ts
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

模型创建函数继续单独放在 `model/create-model.ts` 中。

后续如果要切换模型、调整 temperature、增加请求日志，只需要改这个文件。

---

## 十、增强 AgentState

文件路径：

```text
src/lessons/lesson09-langgraph-state/graph/agent-state.ts
```

代码如下：

```ts
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import type { ToolExecutionRecord } from "../executor/tool-executor.js";

export type AgentStopReason =
  | "running"
  | "final_answer"
  | "max_iterations"
  | "non_ai_message";

export type AgentTraceEvent =
  | "llm_start"
  | "llm_end"
  | "route_to_tools"
  | "route_to_end"
  | "route_to_max_iterations"
  | "tool_start"
  | "tool_end"
  | "fallback";

export type AgentTraceStep = {
  event: AgentTraceEvent;
  nodeName: string;
  loopCount: number;
  message: string;
  createdAt: string;
};

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  loopCount: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),

  currentNode: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "start",
  }),

  stopReason: Annotation<AgentStopReason>({
    reducer: (_left, right) => right,
    default: () => "running",
  }),

  traceSteps: Annotation<AgentTraceStep[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),

  toolExecutionRecords: Annotation<ToolExecutionRecord[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),

  lastToolResult: Annotation<ToolExecutionRecord | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),

  maxIterationsReached: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => false,
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;

export function createTraceStep(params: {
  event: AgentTraceEvent;
  nodeName: string;
  loopCount: number;
  message: string;
}): AgentTraceStep {
  return {
    ...params,
    createdAt: new Date().toISOString(),
  };
}
```

这是本节最重要的文件。

下面逐个理解新增字段。

---

## 十一、理解 currentNode

```ts
currentNode: Annotation<string>({
  reducer: (_left, right) => right,
  default: () => "start",
}),
```

`currentNode` 表示当前执行到哪个节点。

例如：

```text
llm
tools
final_answer
max_iteration_fallback
```

它的 reducer 是：

```ts
(_left, right) => right
```

意思是新值覆盖旧值。

这很适合记录“当前状态”。

---

## 十二、理解 stopReason

```ts
export type AgentStopReason =
  | "running"
  | "final_answer"
  | "max_iterations"
  | "non_ai_message";
```

`stopReason` 用来记录 Agent 为什么停止。

可能值包括：

```text
running：流程还在运行
final_answer：模型已经输出最终答案
max_iterations：达到最大轮次
non_ai_message：最后一条消息不是 AIMessage
```

State 中定义如下：

```ts
stopReason: Annotation<AgentStopReason>({
  reducer: (_left, right) => right,
  default: () => "running",
}),
```

有了 `stopReason`，最终输出时就可以直接知道：

```text
Agent 是正常结束？
还是因为最大轮次保护而结束？
还是出现了异常状态？
```

---

## 十三、理解 traceSteps

```ts
export type AgentTraceStep = {
  event: AgentTraceEvent;
  nodeName: string;
  loopCount: number;
  message: string;
  createdAt: string;
};
```

`traceSteps` 用来记录 Agent 的执行轨迹。

例如：

```json
{
  "event": "llm_end",
  "nodeName": "llm",
  "loopCount": 1,
  "message": "LLM 调用完成，tool_calls 数量：1",
  "createdAt": "2026-06-03T10:00:00.000Z"
}
```

State 中定义如下：

```ts
traceSteps: Annotation<AgentTraceStep[]>({
  reducer: (left, right) => left.concat(right),
  default: () => [],
}),
```

这里的 reducer 是：

```ts
(left, right) => left.concat(right)
```

意思是新 trace 追加到旧 trace 后面。

这就像后端系统里的流程日志。

---

## 十四、理解 lastToolResult

```ts
lastToolResult: Annotation<ToolExecutionRecord | null>({
  reducer: (_left, right) => right,
  default: () => null,
}),
```

`lastToolResult` 用来保存最后一次工具调用结果。

初始值是：

```text
null
```

当 Tool 节点执行后，会更新成最后一条工具执行记录。

这样最终输出时，我们可以快速看到：

```text
最后调用了哪个工具？
工具是否成功？
入参是什么？
耗时多少？
错误信息是什么？
```

这对排查问题非常有用。

---

## 十五、理解 maxIterationsReached

```ts
maxIterationsReached: Annotation<boolean>({
  reducer: (_left, right) => right,
  default: () => false,
}),
```

这个字段用于记录是否触发最大轮次保护。

如果 Agent 反复调用工具，没有正常结束，就可能进入：

```text
max_iteration_fallback
```

此时设置：

```ts
maxIterationsReached: true
```

最终输出时就可以知道：

```text
这次流程是因为达到最大轮次而停止的。
```

---

## 十六、修改 create-agent-graph.ts

文件路径：

```text
src/lessons/lesson09-langgraph-state/graph/create-agent-graph.ts
```

核心代码如下：

```ts
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";

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
};
```

这里继续定义一个简化版 `ToolCallingModel`：

```ts
export type ToolCallingModel = {
  invoke(messages: BaseMessage[]): Promise<AIMessage>;
};
```

它的作用是：让 `createAgentGraph` 不依赖具体模型实现。

只要一个对象有 `invoke(messages)` 方法，并返回 `AIMessage`，就可以作为模型使用。

这类似 Java 里的接口：

```java
public interface ToolCallingModel {
    AIMessage invoke(List<BaseMessage> messages);
}
```

---

## 十七、增强 LLM 节点

LLM 节点代码如下：

```ts
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
```

和第 8 课相比，这里新增了：

```ts
currentNode: "llm"
```

以及：

```ts
traceSteps: [
  createTraceStep({
    event: "llm_end",
    nodeName: "llm",
    loopCount: nextLoopCount,
    message: `LLM 调用完成，tool_calls 数量：...`,
  }),
]
```

也就是说，每次 LLM 节点执行结束后，都会记录一条 trace。

---

## 十八、增强 Tool 节点

Tool 节点代码如下：

```ts
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
```

这部分新增了几个状态更新：

```ts
currentNode: "tools"
```

表示当前节点是工具节点。

```ts
toolExecutionRecords: executionResult.records
```

将工具执行记录写入 State。

```ts
lastToolResult
```

记录最后一次工具执行结果。

```ts
traceSteps
```

记录工具执行完成的轨迹。

---

## 十九、增加 final_answer 节点

第 8 课中，如果模型没有返回 `tool_calls`，就直接进入 `END`。

第 9 课做了一个改造：

```ts
if (toolCalls.length === 0) {
  return "final_answer";
}
```

也就是说，不再直接结束，而是先进入 `final_answer` 节点。

代码如下：

```ts
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
```

这样做的好处是：

```text
在流程真正 END 之前，可以写入 stopReason 和 traceSteps。
```

否则直接 END 的话，我们就没有机会记录“为什么结束”。

---

## 二十、增强最大轮次兜底节点

最大轮次兜底节点代码如下：

```ts
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
```

如果 Agent 达到最大轮次，会更新：

```ts
stopReason: "max_iterations"
maxIterationsReached: true
```

并追加一条 fallback trace。

---

## 二十一、完整图结构

最终图定义如下：

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

对应流程：

```text
START
  ↓
llm
  ↓
shouldContinue
  ├── 没有 tool_calls → final_answer → END
  ├── 有 tool_calls 且没超过最大轮次 → tools → llm
  └── 有 tool_calls 但达到最大轮次 → max_iteration_fallback → END
```

和第 8 课相比，主要区别是多了：

```text
final_answer 节点
更多 State 字段
更多 trace 记录
更清晰的 stopReason
```

---

## 二十二、入口文件 index.ts

文件路径：

```text
src/lessons/lesson09-langgraph-state/index.ts
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
    console.log("当前节点：", result.currentNode);
    console.log("停止原因：", result.stopReason);
    console.log("循环轮次：", result.loopCount);
    console.log("是否达到最大轮次：", result.maxIterationsReached);

    console.log("\n最终回答：");
    console.log(finalMessage?.content);

    console.log("\n最后一次工具结果：");
    console.log(JSON.stringify(result.lastToolResult, null, 2));

    console.log("\n执行轨迹：");
    console.log(JSON.stringify(result.traceSteps, null, 2));

    console.log("\n工具执行总记录：");
    console.log(JSON.stringify(result.toolExecutionRecords, null, 2));
  }
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

入口文件重点输出：

```text
当前节点
停止原因
循环轮次
是否达到最大轮次
最终回答
最后一次工具结果
执行轨迹
工具执行总记录
```

这就是第 9 课和第 8 课最大的区别。

---

## 二十三、运行代码

执行：

```bash
pnpm lesson:09
```

你会看到类似输出：

```text
========== LangGraph 最终结果 ==========
当前节点： final_answer
停止原因： final_answer
循环轮次： 2
是否达到最大轮次： false

最终回答：
企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源。

最后一次工具结果：
{
  "toolName": "search_knowledge_base",
  "status": "success",
  "durationMs": 1
}

执行轨迹：
[
  {
    "event": "llm_end",
    "nodeName": "llm",
    "loopCount": 1,
    "message": "LLM 调用完成，tool_calls 数量：1",
    "createdAt": "2026-06-03T10:00:00.000Z"
  },
  {
    "event": "tool_end",
    "nodeName": "tools",
    "loopCount": 1,
    "message": "工具执行完成，执行数量：1，是否存在错误：false",
    "createdAt": "2026-06-03T10:00:01.000Z"
  },
  {
    "event": "llm_end",
    "nodeName": "llm",
    "loopCount": 2,
    "message": "LLM 调用完成，tool_calls 数量：0",
    "createdAt": "2026-06-03T10:00:02.000Z"
  },
  {
    "event": "route_to_end",
    "nodeName": "final_answer",
    "loopCount": 2,
    "message": "模型没有继续返回 tool_calls，流程正常结束。",
    "createdAt": "2026-06-03T10:00:03.000Z"
  }
]
```

这个输出说明：

```text
第 1 轮模型调用了工具
Tool 节点执行了工具
第 2 轮模型给出了最终回答
流程进入 final_answer 节点
stopReason 是 final_answer
```

这样我们就能完整复盘 Agent 的执行过程。

---

## 二十四、第 9 课和第 8 课的区别

第 8 课重点是：

```text
把 Agent Loop 改造成 LangGraph 状态图
```

第 9 课重点是：

```text
增强 LangGraph 状态图的可观测性
```

第 8 课能回答：

```text
Agent 最终答了什么？
调用了哪些工具？
```

第 9 课能进一步回答：

```text
Agent 执行到了哪个节点？
Agent 为什么停止？
Agent 走过哪些步骤？
Agent 最后一次工具结果是什么？
是否达到最大轮次？
```

这就是从“能跑”到“可调试”的升级。

---

## 二十五、这节课和 Agent 的关系

企业级 Agent 最怕的问题不是“没调用模型”，而是：

```text
模型调用了，但不知道它为什么这么做。
```

如果没有 trace，排查问题就会很困难。

例如用户反馈：

```text
为什么它没有帮我创建工单？
```

如果只有最终回答，我们很难判断。

但如果有 trace，就可以看到：

```text
第 1 轮模型是否返回 tool_calls？
返回的是 search_knowledge_base 还是 create_ticket？
工具是否执行成功？
第 2 轮模型为什么没有继续调用 create_ticket？
stopReason 是什么？
```

所以第 9 课的意义是：

> 为 Agent 增加可观测性，让每一次执行都可以复盘。

---

## 二十六、Java 后端视角理解

可以把第 9 课理解成给流程上下文加更多字段。

类似 Java 中：

```java
public class AgentProcessContext {
    private List<BaseMessage> messages;
    private Integer loopCount;
    private String currentNode;
    private String stopReason;
    private List<TraceStep> traceSteps;
    private List<ToolExecutionRecord> toolExecutionRecords;
    private ToolExecutionRecord lastToolResult;
    private Boolean maxIterationsReached;
}
```

每个流程节点执行时，都会更新一部分上下文。

例如 LLM 节点：

```java
public class LlmNode {
    public PartialState handle(AgentProcessContext context) {
        // 调用模型
        // loopCount + 1
        // 追加 trace
    }
}
```

Tool 节点：

```java
public class ToolNode {
    public PartialState handle(AgentProcessContext context) {
        // 执行工具
        // 记录 toolExecutionRecords
        // 更新 lastToolResult
    }
}
```

这和企业后端中的流程引擎、审批流、订单状态机非常像。

---

## 二十七、企业级 Agent 为什么需要可观测性？

真实 Agent 系统上线后，用户不会只问：

```text
它能不能回答？
```

还会问：

```text
为什么它这么回答？
为什么它没有调用工具？
为什么它调用错了工具？
为什么它重复调用工具？
为什么它没有创建工单？
为什么它执行到一半停止了？
```

如果系统没有 trace，只能靠猜。

所以企业级 Agent 至少应该记录：

```text
用户输入
模型输出
模型 tool_calls
工具入参
工具返回
工具执行耗时
错误信息
停止原因
最终回答
```

第 9 课就是这个方向的第一步。

---

## 二十八、Tips：本节涉及的 TypeScript 写法

本节重点仍然是 Agent 工程化，TypeScript 只做简要记录。

### 1. 字符串联合类型

```ts
export type AgentStopReason =
  | "running"
  | "final_answer"
  | "max_iterations"
  | "non_ai_message";
```

这表示 `AgentStopReason` 只能是这几个字符串之一。

类似 Java 中的枚举：

```java
enum AgentStopReason {
    RUNNING,
    FINAL_ANSWER,
    MAX_ITERATIONS,
    NON_AI_MESSAGE
}
```

---

### 2. `as const`

```ts
stopReason: "final_answer" as const
```

这里是告诉 TypeScript：

```text
这个值不是普通 string，而是字面量类型 "final_answer"
```

否则 TypeScript 可能会把它推断成普通 `string`。

---

### 3. `left.concat(right)`

```ts
reducer: (left, right) => left.concat(right)
```

用于追加数组状态。

类似 Java：

```java
left.addAll(right);
```

---

### 4. `ToolExecutionRecord | null`

```ts
lastToolResult: Annotation<ToolExecutionRecord | null>({
  reducer: (_left, right) => right,
  default: () => null,
})
```

意思是：

```text
lastToolResult 要么是 ToolExecutionRecord，要么是 null
```

初始时没有工具结果，所以是 `null`。

---

### 5. `new Date().toISOString()`

```ts
createdAt: new Date().toISOString()
```

生成当前时间的 ISO 字符串。

适合日志记录和后续存储。

---

## 二十九、本节总结

第 9 课完成了 LangGraph 状态增强。

核心收获：

```text
1. State 不只是保存 messages，还可以保存 Agent 的运行状态
2. currentNode 可以说明当前停在哪个节点
3. stopReason 可以说明 Agent 为什么停止
4. traceSteps 可以记录完整执行轨迹
5. lastToolResult 可以快速查看最后一次工具结果
6. maxIterationsReached 可以判断是否触发最大轮次保护
7. reducer 决定了节点返回的新状态如何合并到旧状态
8. 可观测性是企业级 Agent 工程落地的重要基础
```

本节最重要的一句话：

> 企业级 Agent 不仅要能完成任务，还要能解释自己是怎么完成任务的。

---

## 三十、下一课预告

下一课进入：

# 第 10 课：LangGraph 持久化入门，使用 Checkpoint 保存 Agent 状态

第 10 课会继续在第 9 课基础上学习：

```text
1. 为什么 Agent 需要持久化
2. 什么是 checkpoint
3. 什么是 thread_id
4. 如何使用 MemorySaver 保存状态
5. 如何按 thread_id 恢复会话
6. 如何查看最新 State
7. 如何查看 State 历史
```

第 9 课解决的是：

```text
Agent 执行过程可观测
```

第 10 课要解决的是：

```text
Agent 状态可保存、可恢复、可继续
```
