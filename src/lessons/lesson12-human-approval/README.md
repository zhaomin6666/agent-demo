# 第 12 课：Human-in-the-loop 入门，高风险工具调用前人工确认

## 前言

前面几节课，我们已经把 AI Agent Demo 从一个简单的大模型调用，逐步升级成了一个具备工程雏形的企业级 Agent。

第 5 课开始，我们学习了 Tool Calling，让模型可以根据用户意图选择工具。

第 6 课封装了 `ToolExecutor`，统一负责工具查找、工具执行、异常处理和执行日志。

第 7 课实现了手写版 `Agent Loop`，让模型可以多轮调用工具完成任务。

第 8 课正式引入 LangGraph，把手写的 `for` 循环 Agent Loop 改造成了状态图。

第 9 课增强了 `AgentState`，记录了执行轨迹、停止原因、当前节点和最后一次工具调用结果。

第 10 课引入了 Checkpoint，通过 `MemorySaver + thread_id` 实现了状态保存和恢复。

第 11 课进一步整理了多轮对话记忆，避免重复追加 `SystemMessage`，并在调用模型前做消息窗口裁剪。

第 12 课继续往企业级 Agent 的安全方向推进：

> 模型不能直接执行所有操作型工具，高风险操作必须先经过人工确认。

比如：

```text
创建工单
提交审批
删除数据
发送通知
修改订单
发起付款
```

这些动作在真实业务系统中，通常不能让模型直接执行，而是需要进入人工确认流程。

所以本节课开始学习：

> Human-in-the-loop，也就是让人在关键节点参与 Agent 执行流程。

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解 Human-in-the-loop 的作用
2. 区分查询型工具和操作型工具
3. 把 create_ticket 视为需要人工确认的高风险工具
4. 使用 interrupt() 暂停 LangGraph 执行
5. 使用 Command({ resume }) 恢复 LangGraph 执行
6. 用户同意后再执行工具
7. 用户拒绝后终止工具执行
8. 继续复用第 11 课的 checkpoint 和 conversation memory
```

第 11 课解决的是：

```text
Agent 如何记住上下文？
```

第 12 课要解决的是：

```text
Agent 执行高风险操作前，如何让人参与确认？
```

---

## 二、为什么需要 Human-in-the-loop？

在前面的课程中，Agent 已经可以自动调用工具。

例如：

```text
用户：我们的企业知识库支持哪些数据源接入？
Agent：调用 search_knowledge_base
```

这种查询型工具通常风险较低，因为它只是读取信息。

但是如果用户说：

```text
帮我创建一个高优先级工单。
```

模型可能会调用：

```text
create_ticket
```

这个工具会产生业务数据。

在真实企业系统中，这类操作可能会带来影响：

```text
创建错误工单
重复提交审批
误删数据
误发通知
修改错误订单
触发不必要的业务流程
```

所以企业级 Agent 不能简单理解为：

```text
模型想调用什么工具，系统就执行什么工具。
```

更合理的方式是：

```text
模型提出操作
  ↓
系统判断是否高风险
  ↓
高风险操作进入人工确认
  ↓
用户确认后再执行
  ↓
用户拒绝则终止执行
```

这就是 Human-in-the-loop 的价值。

---

## 三、查询型工具和操作型工具

在企业 Agent 中，可以先把工具简单分成两类。

### 1. 查询型工具

查询型工具只读取信息，不修改业务数据。

例如：

```text
查询知识库
查询订单状态
查询供应商信息
查询审批进度
查询库存信息
```

这类工具通常可以直接执行。

本项目中的：

```text
search_knowledge_base
```

就是查询型工具。

---

### 2. 操作型工具

操作型工具会产生、修改或触发业务动作。

例如：

```text
创建工单
提交审批
修改订单
删除记录
发送通知
执行付款
```

这类工具通常需要更严格的控制。

本项目中的：

```text
create_ticket
```

就是操作型工具。

所以第 12 课先设计一个简单规则：

```text
search_knowledge_base：不需要人工确认
create_ticket：需要人工确认
```

---

## 四、本节整体流程

第 11 课的流程是：

```text
START
  ↓
llm
  ↓
shouldContinue
  ├── 没有 tool_calls → final_answer → END
  ├── 普通工具 → tools → llm
  └── 达到最大轮次 → max_iteration_fallback → END
```

第 12 课加入 Human-in-the-loop 后，流程变成：

```text
START
  ↓
llm
  ↓
shouldContinue
  ├── 没有 tool_calls → final_answer → END
  ├── 普通工具 → tools → llm
  ├── 高风险工具 → human_approval
  │                    ├── 用户同意 → tools → llm
  │                    └── 用户拒绝 → human_rejected → END
  └── 达到最大轮次 → max_iteration_fallback → END
```

核心变化是新增了：

```text
human_approval
human_rejected
pendingAction
humanApprovalResult
```

---

## 五、本节目录结构

本节直接基于第 11 课复制。

创建第 12 课目录：

```bash
cp -r src/lessons/lesson11-conversation-memory src/lessons/lesson12-human-approval
```

Windows PowerShell：

```powershell
Copy-Item -Recurse src/lessons/lesson11-conversation-memory src/lessons/lesson12-human-approval
```

新增 `approval` 目录：

```bash
mkdir -p src/lessons/lesson12-human-approval/approval
```

最终目录结构：

```text
src/lessons/lesson12-human-approval/
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

  memory/
    conversation-input.ts
    message-window.ts

  approval/
    tool-risk-policy.ts

  graph/
    agent-state.ts
    create-agent-graph.ts

  index.ts
```

这些文件从第 11 课复制即可，暂时不需要修改：

```text
data/knowledge-docs.ts
tools/search-knowledge-base.tool.ts
tools/create-ticket.tool.ts
tools/index.ts
executor/tool-executor.ts
model/create-model.ts
memory/conversation-input.ts
memory/message-window.ts
```

本节重点新增或修改：

```text
approval/tool-risk-policy.ts
graph/agent-state.ts
graph/create-agent-graph.ts
index.ts
package.json
```

---

## 六、配置 package.json

在 `package.json` 中增加第 12 课脚本：

```json
{
  "scripts": {
    "lesson:12": "tsx src/lessons/lesson12-human-approval/index.ts"
  }
}
```

保留前面已有的 `lesson:01` 到 `lesson:11`，这里只需要新增这一行。

运行第 12 课：

```bash
pnpm lesson:12
```

---

## 七、新增 tool-risk-policy.ts

文件路径：

```text
src/lessons/lesson12-human-approval/approval/tool-risk-policy.ts
```

这个文件负责判断哪些工具需要人工确认。

当前我们先把：

```text
create_ticket
```

视为需要人工确认的高风险工具。

代码如下：

```ts
import type { ToolCall } from "../executor/tool-executor.js";
import type { PendingAction } from "../graph/agent-state.js";

const APPROVAL_REQUIRED_TOOL_NAMES = new Set(["create_ticket"]);

export function findApprovalRequiredToolCalls(
  toolCalls: ToolCall[],
): ToolCall[] {
  return toolCalls.filter((toolCall) =>
    APPROVAL_REQUIRED_TOOL_NAMES.has(toolCall.name),
  );
}

export function hasApprovalRequiredToolCall(toolCalls: ToolCall[]): boolean {
  return findApprovalRequiredToolCalls(toolCalls).length > 0;
}

export function buildPendingAction(toolCalls: ToolCall[]): PendingAction | null {
  const approvalRequiredToolCall = findApprovalRequiredToolCalls(toolCalls)[0];

  if (!approvalRequiredToolCall) {
    return null;
  }

  return {
    actionId: `approval-${Date.now()}`,
    toolName: approvalRequiredToolCall.name,
    toolCallId: approvalRequiredToolCall.id,
    args: approvalRequiredToolCall.args,
    riskLevel: "high",
    reason: "该工具会创建业务数据，需要用户确认后才能执行。",
    createdAt: new Date().toISOString(),
  };
}
```

---

## 八、理解工具风险策略

这里定义了一个集合：

```ts
const APPROVAL_REQUIRED_TOOL_NAMES = new Set(["create_ticket"]);
```

意思是：

```text
create_ticket 需要人工确认。
```

后续判断工具调用时，只要发现 `toolCall.name` 在这个集合里，就认为它需要人工确认。

现在规则很简单，但真实项目中可以继续扩展。

例如：

```text
按工具配置风险等级
按用户角色判断权限
按业务数据金额判断风险
按操作影响范围判断风险
按租户配置判断是否需要审批
```

比如可以扩展成：

```ts
const TOOL_RISK_CONFIG = {
  search_knowledge_base: {
    riskLevel: "low",
    approvalRequired: false,
  },
  create_ticket: {
    riskLevel: "medium",
    approvalRequired: true,
  },
  delete_order: {
    riskLevel: "high",
    approvalRequired: true,
  },
};
```

本节先保持简单，重点理解 Human-in-the-loop 主流程。

---

## 九、修改 agent-state.ts

文件路径：

```text
src/lessons/lesson12-human-approval/graph/agent-state.ts
```

这个文件基于第 11 课修改。

新增三个核心内容：

```text
PendingAction
HumanApprovalResult
human_rejected stopReason
```

完整代码如下：

```ts
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import type { ToolExecutionRecord } from "../executor/tool-executor.js";

export type AgentStopReason =
  | "running"
  | "final_answer"
  | "max_iterations"
  | "non_ai_message"
  | "human_rejected";

export type AgentTraceEvent =
  | "llm_start"
  | "llm_end"
  | "route_to_tools"
  | "route_to_end"
  | "route_to_max_iterations"
  | "route_to_human_approval"
  | "tool_start"
  | "tool_end"
  | "approval_required"
  | "approval_granted"
  | "approval_rejected"
  | "fallback";

export type AgentTraceStep = {
  event: AgentTraceEvent;
  nodeName: string;
  loopCount: number;
  message: string;
  createdAt: string;
};

export type PendingAction = {
  actionId: string;
  toolName: string;
  toolCallId?: string;
  args: unknown;
  riskLevel: "high";
  reason: string;
  createdAt: string;
};

export type HumanApprovalResult = {
  approved: boolean;
  comment?: string;
  reviewer?: string;
  reviewedAt?: string;
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

  pendingAction: Annotation<PendingAction | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),

  humanApprovalResult: Annotation<HumanApprovalResult | null>({
    reducer: (_left, right) => right,
    default: () => null,
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

---

## 十、理解 PendingAction

```ts
export type PendingAction = {
  actionId: string;
  toolName: string;
  toolCallId?: string;
  args: unknown;
  riskLevel: "high";
  reason: string;
  createdAt: string;
};
```

`PendingAction` 表示当前等待人工确认的动作。

例如，当模型想调用 `create_ticket` 时，会生成一个待确认动作：

```json
{
  "actionId": "approval-1710000000000",
  "toolName": "create_ticket",
  "toolCallId": "call_xxx",
  "args": {
    "title": "RAG 检索效果优化工单",
    "description": "用户反馈知识库检索效果不好",
    "priority": "medium"
  },
  "riskLevel": "high",
  "reason": "该工具会创建业务数据，需要用户确认后才能执行。",
  "createdAt": "2026-06-08T10:00:00.000Z"
}
```

它的作用是告诉用户：

```text
Agent 准备执行什么工具？
工具参数是什么？
为什么需要确认？
风险等级是什么？
```

---

## 十一、理解 HumanApprovalResult

```ts
export type HumanApprovalResult = {
  approved: boolean;
  comment?: string;
  reviewer?: string;
  reviewedAt?: string;
};
```

`HumanApprovalResult` 表示人工确认结果。

用户同意时：

```json
{
  "approved": true,
  "comment": "确认创建高优先级工单。",
  "reviewer": "demo-user",
  "reviewedAt": "2026-06-08T10:00:00.000Z"
}
```

用户拒绝时：

```json
{
  "approved": false,
  "comment": "先不创建工单，等进一步确认问题范围。",
  "reviewer": "demo-user",
  "reviewedAt": "2026-06-08T10:00:00.000Z"
}
```

后续流程会根据 `approved` 决定：

```text
approved = true → 执行工具
approved = false → 终止工具执行
```

---

## 十二、理解新增 State 字段

新增的两个状态字段是：

```ts
pendingAction: Annotation<PendingAction | null>({
  reducer: (_left, right) => right,
  default: () => null,
}),

humanApprovalResult: Annotation<HumanApprovalResult | null>({
  reducer: (_left, right) => right,
  default: () => null,
}),
```

它们都采用覆盖型 reducer：

```ts
(_left, right) => right
```

因为当前只需要记录“最新的待确认动作”和“最新的确认结果”。

---

## 十三、修改 create-agent-graph.ts

文件路径：

```text
src/lessons/lesson12-human-approval/graph/create-agent-graph.ts
```

这个文件基于第 11 课修改。

核心变化：

```text
1. 引入 interrupt
2. 判断高风险工具
3. 新增 human_approval 节点
4. 新增 human_rejected 节点
5. shouldContinue 中把高风险工具路由到 human_approval
6. 用户确认通过后才进入 tools
```

---

## 十四、修改导入

在第 11 课基础上修改导入：

```ts
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import {
  END,
  START,
  StateGraph,
  interrupt,
  type MemorySaver,
} from "@langchain/langgraph";

import {
  ToolExecutor,
  type ToolExecutionRecord,
} from "../executor/tool-executor.js";
import {
  buildPendingAction,
  hasApprovalRequiredToolCall,
} from "../approval/tool-risk-policy.js";
import { selectMessagesForModel } from "../memory/message-window.js";
import {
  AgentStateAnnotation,
  createTraceStep,
  type AgentState,
  type HumanApprovalResult,
} from "./agent-state.js";
```

新增的关键内容是：

```text
interrupt
buildPendingAction
hasApprovalRequiredToolCall
HumanApprovalResult
```

`interrupt` 用来暂停 LangGraph 执行。

`buildPendingAction` 用来生成待确认动作。

`hasApprovalRequiredToolCall` 用来判断当前工具调用里是否包含高风险工具。

---

## 十五、修改 shouldContinue

第 11 课中，`shouldContinue` 只判断：

```text
没有 tool_calls → final_answer
达到最大轮次 → max_iteration_fallback
否则 → tools
```

第 12 课要增加高风险工具判断。

代码如下：

```ts
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

  if (hasApprovalRequiredToolCall(toolCalls)) {
    return "human_approval";
  }

  return "tools";
}
```

这里最关键的是：

```ts
if (hasApprovalRequiredToolCall(toolCalls)) {
  return "human_approval";
}
```

也就是说：

```text
如果模型要调用 create_ticket，不要直接进入 tools，而是先进入 human_approval。
```

---

## 十六、新增 humanApprovalNode

```ts
async function humanApprovalNode(state: AgentState) {
  const lastMessage = state.messages.at(-1);

  if (!(lastMessage instanceof AIMessage)) {
    return {
      currentNode: "human_approval",
      stopReason: "non_ai_message" as const,
      traceSteps: [
        createTraceStep({
          event: "approval_rejected",
          nodeName: "human_approval",
          loopCount: state.loopCount,
          message: "最后一条消息不是 AIMessage，无法进行人工确认。",
        }),
      ],
    };
  }

  const pendingAction = buildPendingAction(lastMessage.tool_calls ?? []);

  if (!pendingAction) {
    return {
      currentNode: "human_approval",
      pendingAction: null,
      traceSteps: [
        createTraceStep({
          event: "approval_required",
          nodeName: "human_approval",
          loopCount: state.loopCount,
          message: "未发现需要人工确认的工具调用。",
        }),
      ],
    };
  }

  const approvalResult = interrupt({
    type: "tool_approval",
    message: `工具 ${pendingAction.toolName} 需要人工确认后才能执行。`,
    pendingAction,
  }) as HumanApprovalResult;

  const normalizedApprovalResult: HumanApprovalResult = {
    approved: Boolean(approvalResult.approved),
    comment: approvalResult.comment,
    reviewer: approvalResult.reviewer ?? "demo-user",
    reviewedAt: approvalResult.reviewedAt ?? new Date().toISOString(),
  };

  return {
    currentNode: "human_approval",
    pendingAction,
    humanApprovalResult: normalizedApprovalResult,
    traceSteps: [
      createTraceStep({
        event: normalizedApprovalResult.approved
          ? "approval_granted"
          : "approval_rejected",
        nodeName: "human_approval",
        loopCount: state.loopCount,
        message: normalizedApprovalResult.approved
          ? `用户已确认执行工具：${pendingAction.toolName}`
          : `用户拒绝执行工具：${pendingAction.toolName}`,
      }),
    ],
  };
}
```

---

## 十七、理解 interrupt

核心代码是：

```ts
const approvalResult = interrupt({
  type: "tool_approval",
  message: `工具 ${pendingAction.toolName} 需要人工确认后才能执行。`,
  pendingAction,
}) as HumanApprovalResult;
```

当执行到 `interrupt()` 时，LangGraph 会暂停执行。

调用方会拿到一个中断结果，里面包含：

```text
type
message
pendingAction
```

也就是告诉外部系统：

```text
当前流程暂停了
需要用户确认
这是待确认的工具和参数
```

之后，外部系统可以展示一个确认 UI。

例如：

```text
Agent 准备创建工单：
标题：xxx
优先级：high
原因：该工具会创建业务数据

[确认执行] [取消]
```

用户点击后，再通过 `Command({ resume })` 恢复流程。

---

## 十八、新增 routeAfterApproval

```ts
function routeAfterApproval(state: AgentState) {
  if (state.humanApprovalResult?.approved) {
    return "tools";
  }

  return "human_rejected";
}
```

这个函数负责人工确认后的路由。

如果用户同意：

```text
human_approval → tools
```

如果用户拒绝：

```text
human_approval → human_rejected
```

---

## 十九、新增 humanRejectedNode

```ts
async function humanRejectedNode(state: AgentState) {
  const message = new AIMessage({
    content:
      "已取消执行该操作。由于该工具调用需要人工确认，而你选择了拒绝，因此本次不会执行对应工具。",
  });

  return {
    messages: [message],
    currentNode: "human_rejected",
    stopReason: "human_rejected" as const,
    pendingAction: null,
    traceSteps: [
      createTraceStep({
        event: "approval_rejected",
        nodeName: "human_rejected",
        loopCount: state.loopCount,
        message: "用户拒绝了高风险工具调用，流程结束。",
      }),
    ],
  };
}
```

如果用户拒绝工具调用，Agent 不会进入 `tools` 节点，而是直接生成一条取消执行的消息，并结束流程。

这可以避免模型绕过人工确认，直接执行操作型工具。

---

## 二十、修改 toolNode

工具执行成功后，可以清空 `pendingAction`。

在 `toolNode` 的返回值中增加：

```ts
pendingAction: null,
```

完整返回结构类似：

```ts
return {
  messages: executionResult.messages,
  currentNode: "tools",
  toolExecutionRecords: executionResult.records,
  lastToolResult,
  pendingAction: null,
  traceSteps: [
    createTraceStep({
      event: "tool_end",
      nodeName: "tools",
      loopCount: state.loopCount,
      message: `工具执行完成，执行数量：${executionResult.records.length}，是否存在错误：${executionResult.hasError}`,
    }),
  ],
};
```

这样当用户确认并成功执行工具后，待确认动作就被清掉。

---

## 二十一、修改图结构

第 12 课的图结构如下：

```ts
return new StateGraph(AgentStateAnnotation)
  .addNode("llm", llmNode)
  .addNode("tools", toolNode)
  .addNode("human_approval", humanApprovalNode)
  .addNode("human_rejected", humanRejectedNode)
  .addNode("final_answer", finalAnswerNode)
  .addNode("max_iteration_fallback", maxIterationFallbackNode)
  .addEdge(START, "llm")
  .addConditionalEdges("llm", shouldContinue)
  .addConditionalEdges("human_approval", routeAfterApproval)
  .addEdge("tools", "llm")
  .addEdge("human_rejected", END)
  .addEdge("final_answer", END)
  .addEdge("max_iteration_fallback", END)
  .compile({
    checkpointer: options.checkpointer,
  });
```

相比第 11 课，新增：

```text
human_approval
human_rejected
human_approval 后的条件边
```

最终流程是：

```text
START
  ↓
llm
  ↓
shouldContinue
  ├── 没有 tool_calls → final_answer → END
  ├── 普通工具 → tools → llm
  ├── 高风险工具 → human_approval
  │                    ├── 同意 → tools → llm
  │                    └── 拒绝 → human_rejected → END
  └── 达到最大轮次 → max_iteration_fallback → END
```

---

## 二十二、修改 index.ts

文件路径：

```text
src/lessons/lesson12-human-approval/index.ts
```

这个文件用来模拟三种情况：

```text
1. 高风险工具，用户同意
2. 高风险工具，用户拒绝
3. 安全查询工具，不需要确认
```

完整代码如下：

```ts
import { Command, MemorySaver } from "@langchain/langgraph";

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
import type { HumanApprovalResult } from "./graph/agent-state.js";

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
8. create_ticket 属于需要人工确认的操作型工具，确认通过后才能执行。
`;

type ThreadConfig = {
  configurable: {
    thread_id: string;
  };
};

type AgentGraph = ReturnType<typeof createAgentGraph>;

type InterruptPayload = {
  value?: unknown;
};

function createThreadConfig(threadId: string): ThreadConfig {
  return {
    configurable: {
      thread_id: threadId,
    },
  };
}

function getInterruptPayloads(result: unknown): unknown[] {
  const interrupts = (result as { __interrupt__?: InterruptPayload[] })
    .__interrupt__;

  if (!Array.isArray(interrupts)) {
    return [];
  }

  return interrupts.map((item) => item.value ?? item);
}

async function runConversationTurn(params: {
  graph: AgentGraph;
  threadId: string;
  userInput: string;
  approval?: HumanApprovalResult;
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

  const firstResult = await params.graph.invoke(input, config);

  const interruptPayloads = getInterruptPayloads(firstResult);

  if (interruptPayloads.length > 0) {
    console.log("\n========== 触发人工确认 ==========");
    console.log(JSON.stringify(interruptPayloads, null, 2));

    if (!params.approval) {
      console.log("\n当前流程已暂停，等待人工确认。");
      return;
    }

    console.log("\n========== 模拟人工确认结果 ==========");
    console.log(JSON.stringify(params.approval, null, 2));

    const resumedResult = await params.graph.invoke(
      new Command({
        resume: params.approval,
      }),
      config,
    );

    printFinalResult(resumedResult);
    return;
  }

  printFinalResult(firstResult);
}

function printFinalResult(result: Awaited<ReturnType<AgentGraph["invoke"]>>) {
  const finalMessage = result.messages.at(-1);

  console.log("\n========== Human-in-the-loop 最终结果 ==========");
  console.log("当前节点：", result.currentNode);
  console.log("停止原因：", result.stopReason);
  console.log("本轮循环轮次：", result.loopCount);

  console.log("\n最终回答：");
  console.log(finalMessage?.content);

  console.log("\n人工确认结果：");
  console.log(JSON.stringify(result.humanApprovalResult, null, 2));

  console.log("\n最后一次工具结果：");
  console.log(JSON.stringify(result.lastToolResult, null, 2));

  console.log("\nCheckpoint 中累计 messages 数量：", result.messages.length);
  console.log("累计 traceSteps 数量：", result.traceSteps.length);
  console.log("累计工具执行记录数量：", result.toolExecutionRecords.length);
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

  await runConversationTurn({
    graph,
    threadId: "lesson12-approval-approved",
    userInput: "知识库搜索 PDF 内容经常搜不到，帮我创建一个高优先级工单。",
    approval: {
      approved: true,
      comment: "确认创建高优先级工单。",
      reviewer: "demo-user",
      reviewedAt: new Date().toISOString(),
    },
  });

  await runConversationTurn({
    graph,
    threadId: "lesson12-approval-rejected",
    userInput: "帮我创建一个中优先级工单，反馈 RAG 检索效果不好。",
    approval: {
      approved: false,
      comment: "先不创建工单，等进一步确认问题范围。",
      reviewer: "demo-user",
      reviewedAt: new Date().toISOString(),
    },
  });

  await runConversationTurn({
    graph,
    threadId: "lesson12-safe-query",
    userInput: "我们的企业知识库支持哪些数据源接入？",
  });
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 二十三、理解 getInterruptPayloads

```ts
function getInterruptPayloads(result: unknown): unknown[] {
  const interrupts = (result as { __interrupt__?: InterruptPayload[] })
    .__interrupt__;

  if (!Array.isArray(interrupts)) {
    return [];
  }

  return interrupts.map((item) => item.value ?? item);
}
```

当图执行到 `interrupt()` 后，返回结果中会包含 `__interrupt__`。

这个函数负责把中断信息提取出来。

如果没有中断，则返回空数组。

---

## 二十四、理解 Command({ resume })

当触发人工确认后，流程会暂停。

如果我们有确认结果：

```ts
approval: {
  approved: true,
  comment: "确认创建高优先级工单。",
  reviewer: "demo-user",
  reviewedAt: new Date().toISOString(),
}
```

就可以用：

```ts
const resumedResult = await params.graph.invoke(
  new Command({
    resume: params.approval,
  }),
  config,
);
```

这表示：

```text
用人工确认结果恢复上次暂停的图执行。
```

注意这里必须使用同一个 `config`，也就是同一个 `thread_id`。

因为中断状态保存在对应的 checkpoint 中。

---

## 二十五、运行第 12 课

执行：

```bash
pnpm lesson:12
```

本节会执行三组测试。

---

### 1. 高风险工具，用户同意

输入：

```text
知识库搜索 PDF 内容经常搜不到，帮我创建一个高优先级工单。
```

模拟确认结果：

```json
{
  "approved": true,
  "comment": "确认创建高优先级工单。",
  "reviewer": "demo-user"
}
```

预期流程：

```text
llm
  ↓
发现 create_ticket
  ↓
human_approval
  ↓
用户同意
  ↓
tools
  ↓
llm
  ↓
final_answer
```

最终会真正执行 `create_ticket`。

---

### 2. 高风险工具，用户拒绝

输入：

```text
帮我创建一个中优先级工单，反馈 RAG 检索效果不好。
```

模拟确认结果：

```json
{
  "approved": false,
  "comment": "先不创建工单，等进一步确认问题范围。",
  "reviewer": "demo-user"
}
```

预期流程：

```text
llm
  ↓
发现 create_ticket
  ↓
human_approval
  ↓
用户拒绝
  ↓
human_rejected
  ↓
END
```

最终不会执行 `create_ticket`。

---

### 3. 安全查询工具，不需要确认

输入：

```text
我们的企业知识库支持哪些数据源接入？
```

预期流程：

```text
llm
  ↓
search_knowledge_base
  ↓
tools
  ↓
llm
  ↓
final_answer
```

因为 `search_knowledge_base` 是查询型工具，不需要人工确认。

---

## 二十六、第 12 课和第 11 课的区别

第 11 课关注的是：

```text
记忆
```

它解决的是：

```text
Agent 如何记住上下文？
```

第 12 课关注的是：

```text
安全执行
```

它解决的是：

```text
Agent 执行高风险操作前，如何让人参与确认？
```

第 11 课让 Agent 更像一个连续对话系统。

第 12 课让 Agent 更像一个可控的企业流程系统。

---

## 二十七、这一课和企业级 Agent 的关系

企业级 Agent 不是简单地让模型拥有工具权限。

真正可落地的企业 Agent 需要满足：

```text
可控
可审计
可追责
可回滚
可人工介入
```

Human-in-the-loop 就是其中非常重要的一环。

对于低风险工具：

```text
可以自动执行
```

对于高风险工具：

```text
必须先暂停
等待用户确认
确认后再继续
拒绝则终止
```

这可以有效降低模型误操作带来的风险。

本节最重要的一句话是：

> 企业级 Agent 不是让模型拥有无限操作权，而是让模型提出操作建议，由人确认后再执行。

---

## 二十八、Java 后端视角理解

第 12 课可以类比成审批流。

普通 Java 后端中可能会这样设计：

```java
public ToolExecutionResult executeTool(ToolCall toolCall) {
    if (riskPolicy.needApproval(toolCall)) {
        ApprovalTask task = approvalService.createTask(toolCall);
        return ToolExecutionResult.waitingApproval(task);
    }

    return toolExecutor.execute(toolCall);
}
```

如果用户同意：

```java
approvalService.approve(taskId);
toolExecutor.execute(toolCall);
```

如果用户拒绝：

```java
approvalService.reject(taskId);
return ToolExecutionResult.rejected();
```

LangGraph 中的流程类似：

```text
高风险工具调用
  ↓
interrupt 暂停
  ↓
checkpoint 保存状态
  ↓
用户确认
  ↓
Command resume 恢复
  ↓
继续执行工具或结束流程
```

所以可以理解为：

```text
interrupt = 创建一个等待人工处理的流程暂停点
Command resume = 带着人工处理结果继续执行流程
```

这和工作流引擎中的人工审批节点非常像。

---

## 二十九、后续还能怎么优化？

本节只是 Human-in-the-loop 的入门版本。

真实项目中还可以继续扩展。

### 1. 更细的风险等级

当前只有：

```text
high
```

后续可以扩展为：

```text
low
medium
high
critical
```

不同风险等级对应不同策略。

---

### 2. 用户权限结合审批

有些用户可以直接执行，有些用户必须审批。

例如：

```text
管理员：可以创建高优先级工单
普通用户：创建高优先级工单需要审批
游客：无权创建工单
```

这会在第 13 课继续学习。

---

### 3. 审批记录入库

真实系统中，审批记录应该保存到数据库。

字段可能包括：

```text
approvalId
threadId
toolName
toolArgs
riskLevel
reviewer
approved
comment
createdAt
reviewedAt
```

---

### 4. 前端确认页面

当前我们用代码模拟人工确认。

真实系统中应该有前端页面：

```text
展示待确认工具
展示工具参数
展示风险说明
确认按钮
拒绝按钮
```

后续做前端 Chat UI 时，可以把 Human-in-the-loop 展示出来。

---

## 三十、TypeScript Tips

### 1. `Set`

```ts
const APPROVAL_REQUIRED_TOOL_NAMES = new Set(["create_ticket"]);
```

`Set` 表示集合。

它适合判断某个值是否存在：

```ts
APPROVAL_REQUIRED_TOOL_NAMES.has(toolCall.name)
```

比数组 `includes` 更适合表达“规则集合”。

---

### 2. `unknown`

```ts
args: unknown;
```

`unknown` 表示当前不知道具体类型。

它比 `any` 更安全。

因为使用 `unknown` 时，后续如果要访问内部字段，需要先做类型判断。

---

### 3. 可选字段

```ts
toolCallId?: string;
comment?: string;
reviewer?: string;
reviewedAt?: string;
```

`?` 表示字段可选。

也就是说，这些字段可以存在，也可以不存在。

---

### 4. `Boolean()`

```ts
approved: Boolean(approvalResult.approved)
```

`Boolean()` 可以把值转换成布尔值。

例如：

```text
true → true
false → false
undefined → false
```

这里用于确保 `approved` 一定是布尔类型。

---

### 5. `Awaited<ReturnType<...>>`

```ts
function printFinalResult(result: Awaited<ReturnType<AgentGraph["invoke"]>>) {
  // ...
}
```

这表示：

```text
取 AgentGraph["invoke"] 的返回值类型
再取 Promise resolve 后的类型
```

也就是自动推导 `graph.invoke()` 最终返回的结果类型。

---

## 三十一、本节总结

第 12 课完成了 Human-in-the-loop 入门。

核心收获：

```text
1. 不是所有工具都应该由模型直接执行
2. 查询型工具通常可以直接执行
3. 操作型工具通常需要人工确认
4. create_ticket 被定义为高风险工具
5. pendingAction 用来保存待确认动作
6. humanApprovalResult 用来保存人工确认结果
7. interrupt() 可以暂停 LangGraph 执行
8. Command({ resume }) 可以恢复 LangGraph 执行
9. checkpointer + thread_id 是恢复执行的基础
10. 用户同意后进入 tools，用户拒绝后进入 human_rejected
```

本节最重要的一句话：

> 企业级 Agent 不是让模型拥有无限操作权，而是让模型提出操作建议，由人确认后再执行。

---

## 三十二、下一课预告

下一课进入：

# 第 13 课：工具权限控制，为 Tool Calling 增加用户权限判断

第 13 课会继续强化企业级安全能力。

主要学习：

```text
1. 增加 userContext
2. 为不同工具配置权限要求
3. ToolExecutor 执行前检查权限
4. 未授权时返回友好错误
5. 记录权限拦截日志
```

第 12 课解决的是：

```text
高风险操作是否需要用户确认？
```

第 13 课要解决的是：

```text
用户有没有权限执行这个工具？
```

这两个问题是企业级 Agent 安全体系中的两层控制：

```text
权限控制：你有没有资格执行？
人工确认：你是否确认要执行？
```
