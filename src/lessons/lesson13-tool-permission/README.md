# 第 13 课：工具权限控制，为 Tool Calling 增加用户权限判断

## 前言

前面几节课，我们已经把 AI Agent Demo 从简单的大模型调用，逐步升级成了一个具备企业级工程雏形的 Agent。

第 5 课开始，我们学习了 Tool Calling，让模型可以根据用户意图选择工具。

第 6 课封装了 `ToolExecutor`，统一处理工具查找、工具执行、异常处理和执行日志。

第 7 课实现了手写版 `Agent Loop`，让模型可以多轮调用工具完成任务。

第 8 课引入 LangGraph，把手写的循环流程改造成状态图。

第 9 课增强了 `AgentState`，记录执行轨迹、停止原因、当前节点和最后一次工具结果。

第 10 课引入 Checkpoint，通过 `MemorySaver + thread_id` 实现状态保存和恢复。

第 11 课整理了多轮对话记忆，避免重复追加 `SystemMessage`，并在调用模型前做消息窗口裁剪。

第 12 课实现了 Human-in-the-loop，让高风险工具调用前先经过人工确认。

第 13 课继续强化企业级 Agent 的安全能力：

> 为 Tool Calling 增加用户权限控制。

这一课要解决的问题是：

```text
模型提出了工具调用请求，但当前用户有没有资格执行这个工具？
```

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解工具权限控制的作用
2. 增加 UserContext
3. 为不同工具配置所需角色
4. 在 LangGraph 路由阶段检查权限
5. 在 ToolExecutor 执行前再次检查权限
6. 未授权时返回友好错误
7. 记录权限拦截日志
8. 区分权限控制和人工确认
```

第 12 课解决的是：

```text
高风险操作是否需要用户确认？
```

第 13 课解决的是：

```text
用户有没有权限执行这个工具？
```

这两个问题不能混在一起。

---

## 二、权限控制和人工确认的区别

权限控制回答的是：

```text
你有没有资格执行？
```

人工确认回答的是：

```text
你是否确认要执行？
```

举个例子：

```text
viewer 用户：可以查询知识库，但不能创建工单
support 用户：可以创建工单，但创建前需要确认
admin 用户：可以执行当前所有工具，但高风险操作仍然可以要求确认
```

所以企业级 Agent 的安全流程应该是：

```text
模型提出工具调用
  ↓
检查用户是否有权限
  ↓
如果无权限，直接拒绝
  ↓
如果有权限，再判断是否需要人工确认
  ↓
确认通过后执行工具
```

不能因为用户点击了确认，就绕过权限控制。

也就是说：

```text
有权限 ≠ 可以直接执行
确认了 ≠ 可以绕过权限
```

---

## 三、本节目录结构

本节直接基于第 12 课复制。

创建第 13 课目录：

```bash
cp -r src/lessons/lesson12-human-approval src/lessons/lesson13-tool-permission
```

Windows PowerShell：

```powershell
Copy-Item -Recurse src/lessons/lesson12-human-approval src/lessons/lesson13-tool-permission
```

新增 `security` 目录：

```bash
mkdir -p src/lessons/lesson13-tool-permission/security
```

最终目录结构：

```text
src/lessons/lesson13-tool-permission/
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

  security/
    tool-permission-policy.ts

  graph/
    agent-state.ts
    create-agent-graph.ts

  index.ts
```

这些文件从第 12 课复制即可，暂时不需要修改：

```text
data/knowledge-docs.ts
tools/search-knowledge-base.tool.ts
tools/create-ticket.tool.ts
tools/index.ts
model/create-model.ts
memory/message-window.ts
approval/tool-risk-policy.ts
```

本节重点新增或修改：

```text
security/tool-permission-policy.ts
graph/agent-state.ts
memory/conversation-input.ts
executor/tool-executor.ts
graph/create-agent-graph.ts
index.ts
package.json
```

---

## 四、配置 package.json

在 `package.json` 中新增第 13 课脚本：

```json
{
  "scripts": {
    "lesson:13": "tsx src/lessons/lesson13-tool-permission/index.ts"
  }
}
```

保留前面已有的 `lesson:01` 到 `lesson:12`，这里只需要新增这一行。

运行第 13 课：

```bash
pnpm lesson:13
```

---

## 五、新增 tool-permission-policy.ts

文件路径：

```text
src/lessons/lesson13-tool-permission/security/tool-permission-policy.ts
```

这个文件负责定义：

```text
哪些角色可以执行哪些工具
```

代码如下：

```ts
import type { ToolCall } from "../executor/tool-executor.js";
import type {
  ToolPermissionDecision,
  UserContext,
  UserRole,
} from "../graph/agent-state.js";

type ToolPermissionConfig = {
  requiredRoles: UserRole[];
  description: string;
};

const TOOL_PERMISSION_CONFIG: Record<string, ToolPermissionConfig> = {
  search_knowledge_base: {
    requiredRoles: ["viewer", "support", "admin"],
    description: "查询知识库，所有已登录用户都可以使用。",
  },

  create_ticket: {
    requiredRoles: ["support", "admin"],
    description: "创建工单，需要客服或管理员角色。",
  },
};

export function checkToolPermission(params: {
  toolCall: ToolCall;
  userContext: UserContext | null;
}): ToolPermissionDecision {
  const config = TOOL_PERMISSION_CONFIG[params.toolCall.name];

  if (!params.userContext) {
    return {
      allowed: false,
      toolName: params.toolCall.name,
      requiredRoles: config?.requiredRoles ?? ["admin"],
      userRoles: [],
      reason: "当前请求缺少用户上下文，无法执行工具。",
    };
  }

  if (!config) {
    return {
      allowed: false,
      toolName: params.toolCall.name,
      requiredRoles: ["admin"],
      userRoles: params.userContext.roles,
      reason: `工具 ${params.toolCall.name} 未配置权限策略，默认拒绝执行。`,
    };
  }

  const allowed = config.requiredRoles.some((role) =>
    params.userContext.roles.includes(role),
  );

  return {
    allowed,
    toolName: params.toolCall.name,
    requiredRoles: config.requiredRoles,
    userRoles: params.userContext.roles,
    reason: allowed
      ? `用户具备执行工具 ${params.toolCall.name} 的权限。`
      : `用户缺少执行工具 ${params.toolCall.name} 所需角色：${config.requiredRoles.join(
          ", ",
        )}`,
  };
}

export function findFirstDeniedToolPermission(params: {
  toolCalls: ToolCall[];
  userContext: UserContext | null;
}): ToolPermissionDecision | null {
  for (const toolCall of params.toolCalls) {
    const decision = checkToolPermission({
      toolCall,
      userContext: params.userContext,
    });

    if (!decision.allowed) {
      return decision;
    }
  }

  return null;
}
```

---

## 六、理解权限策略

这里定义了两个工具的权限。

```ts
const TOOL_PERMISSION_CONFIG: Record<string, ToolPermissionConfig> = {
  search_knowledge_base: {
    requiredRoles: ["viewer", "support", "admin"],
    description: "查询知识库，所有已登录用户都可以使用。",
  },

  create_ticket: {
    requiredRoles: ["support", "admin"],
    description: "创建工单，需要客服或管理员角色。",
  },
};
```

含义是：

```text
search_knowledge_base：viewer、support、admin 都可以执行
create_ticket：support、admin 可以执行
```

所以：

```text
viewer 可以查询知识库
viewer 不能创建工单
support 可以查询知识库，也可以创建工单
admin 可以执行当前所有工具
```

---

## 七、为什么未知工具要默认拒绝？

在 `checkToolPermission` 中，如果某个工具没有配置权限策略：

```ts
if (!config) {
  return {
    allowed: false,
    toolName: params.toolCall.name,
    requiredRoles: ["admin"],
    userRoles: params.userContext.roles,
    reason: `工具 ${params.toolCall.name} 未配置权限策略，默认拒绝执行。`,
  };
}
```

这里采用的是：

```text
默认拒绝策略
```

这在安全系统中非常重要。

因为如果新工具上线后忘记配置权限，而系统默认允许，就可能出现越权调用。

所以更安全的原则是：

```text
没有明确允许，就默认拒绝。
```

---

## 八、修改 agent-state.ts

文件路径：

```text
src/lessons/lesson13-tool-permission/graph/agent-state.ts
```

基于第 12 课修改，新增：

```text
UserRole
UserContext
ToolPermissionDecision
permission_denied stopReason
permissionDecision 状态字段
userContext 状态字段
```

完整代码如下：

```ts
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import type { ToolExecutionRecord } from "../executor/tool-executor.js";

export type UserRole = "viewer" | "support" | "admin";

export type UserContext = {
  userId: string;
  username: string;
  roles: UserRole[];
  department?: string;
};

export type ToolPermissionDecision = {
  allowed: boolean;
  toolName: string;
  requiredRoles: UserRole[];
  userRoles: UserRole[];
  reason: string;
};

export type AgentStopReason =
  | "running"
  | "final_answer"
  | "max_iterations"
  | "non_ai_message"
  | "human_rejected"
  | "permission_denied";

export type AgentTraceEvent =
  | "llm_start"
  | "llm_end"
  | "route_to_tools"
  | "route_to_end"
  | "route_to_max_iterations"
  | "route_to_human_approval"
  | "route_to_permission_denied"
  | "permission_checked"
  | "permission_granted"
  | "permission_denied"
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

  userContext: Annotation<UserContext | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),

  permissionDecision: Annotation<ToolPermissionDecision | null>({
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

## 九、理解 UserContext

```ts
export type UserContext = {
  userId: string;
  username: string;
  roles: UserRole[];
  department?: string;
};
```

`UserContext` 表示当前调用 Agent 的用户信息。

例如：

```ts
const viewerUser: UserContext = {
  userId: "user-viewer-001",
  username: "viewer-user",
  roles: ["viewer"],
  department: "业务部门",
};
```

在真实系统中，这个信息通常来自：

```text
登录态
JWT Token
Session
网关认证信息
后端用户服务
```

Agent 不应该自己判断用户是谁，而应该接收后端认证系统传入的用户上下文。

---

## 十、理解 ToolPermissionDecision

```ts
export type ToolPermissionDecision = {
  allowed: boolean;
  toolName: string;
  requiredRoles: UserRole[];
  userRoles: UserRole[];
  reason: string;
};
```

这个类型用于记录一次权限判断结果。

例如允许：

```json
{
  "allowed": true,
  "toolName": "search_knowledge_base",
  "requiredRoles": ["viewer", "support", "admin"],
  "userRoles": ["viewer"],
  "reason": "用户具备执行工具 search_knowledge_base 的权限。"
}
```

例如拒绝：

```json
{
  "allowed": false,
  "toolName": "create_ticket",
  "requiredRoles": ["support", "admin"],
  "userRoles": ["viewer"],
  "reason": "用户缺少执行工具 create_ticket 所需角色：support, admin"
}
```

这个信息可以用于：

```text
返回友好错误
记录审计日志
排查权限问题
后续展示到前端
```

---

## 十一、修改 conversation-input.ts

文件路径：

```text
src/lessons/lesson13-tool-permission/memory/conversation-input.ts
```

第 11、12 课的输入里还没有 `userContext`。

第 13 课要把用户上下文放进 State。

完整代码如下：

```ts
import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import type { AgentState, UserContext } from "../graph/agent-state.js";

export type ConversationInputParams = {
  userInput: string;
  systemPrompt: string;
  hasHistory: boolean;
  userContext: UserContext;
};

export type ConversationInput = {
  messages: BaseMessage[];
  loopCount: number;
  currentNode: string;
  stopReason: "running";
  lastToolResult: null;
  maxIterationsReached: false;
  userContext: UserContext;
  permissionDecision: null;
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
    userContext: params.userContext,
    permissionDecision: null,
  };
}

export function hasConversationHistory(
  state: Partial<AgentState> | undefined,
): boolean {
  return (state?.messages?.length ?? 0) > 0;
}
```

核心变化是输入参数新增：

```ts
userContext: UserContext;
```

返回值新增：

```ts
userContext: params.userContext,
permissionDecision: null,
```

这样每次调用 Agent 时，State 中都会带着当前用户信息。

---

## 十二、修改 ToolExecutor

文件路径：

```text
src/lessons/lesson13-tool-permission/executor/tool-executor.ts
```

第 13 课要在 `ToolExecutor` 执行前增加第二层权限检查。

为什么已经在图路由中检查权限了，还要在执行器里再检查一次？

因为安全逻辑不能只依赖一层。

更合理的做法是：

```text
Graph 路由层：提前拦截，给用户更友好的提示
ToolExecutor 层：最终防线，确保无权限工具绝不执行
```

完整代码如下：

```ts
import { ToolMessage, type AIMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";

import { checkToolPermission } from "../security/tool-permission-policy.js";
import type { UserContext } from "../graph/agent-state.js";

export type ToolCall = NonNullable<AIMessage["tool_calls"]>[number];

export type ToolExecutionStatus =
  | "success"
  | "tool_not_found"
  | "error"
  | "permission_denied";

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

  async execute(
    toolCalls: ToolCall[],
    userContext: UserContext | null,
  ): Promise<ToolExecutionResult> {
    const messages: ToolMessage[] = [];
    const records: ToolExecutionRecord[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeOne(toolCall, userContext);

      messages.push(result.message);
      records.push(result.record);
    }

    return {
      messages,
      records,
      hasError: records.some((record) => record.status !== "success"),
    };
  }

  private async executeOne(
    toolCall: ToolCall,
    userContext: UserContext | null,
  ): Promise<{
    message: ToolMessage;
    record: ToolExecutionRecord;
  }> {
    const startTime = Date.now();

    const permissionDecision = checkToolPermission({
      toolCall,
      userContext,
    });

    if (!permissionDecision.allowed) {
      const content = JSON.stringify(
        {
          status: "permission_denied",
          message: "当前用户无权执行该工具。",
          permissionDecision,
        },
        null,
        2,
      );

      const message = new ToolMessage({
        content,
        tool_call_id: toolCall.id ?? `${toolCall.name}-permission-denied-id`,
        name: toolCall.name,
      });

      return {
        message,
        record: {
          toolName: toolCall.name,
          toolCallId: toolCall.id,
          args: toolCall.args,
          status: "permission_denied",
          content,
          errorMessage: permissionDecision.reason,
          durationMs: Date.now() - startTime,
        },
      };
    }

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

---

## 十三、ToolExecutor 的关键变化

### 1. execute 新增 userContext

第 12 课中：

```ts
async execute(toolCalls: ToolCall[]): Promise<ToolExecutionResult>
```

第 13 课改成：

```ts
async execute(
  toolCalls: ToolCall[],
  userContext: UserContext | null,
): Promise<ToolExecutionResult>
```

也就是说，执行工具时必须知道当前用户是谁。

---

### 2. 增加 permission_denied 状态

```ts
export type ToolExecutionStatus =
  | "success"
  | "tool_not_found"
  | "error"
  | "permission_denied";
```

当用户无权执行工具时，记录状态为：

```text
permission_denied
```

---

### 3. 执行前检查权限

```ts
const permissionDecision = checkToolPermission({
  toolCall,
  userContext,
});

if (!permissionDecision.allowed) {
  // 返回 permission_denied
}
```

这保证了无权限工具不会被真正执行。

---

## 十四、修改 create-agent-graph.ts

文件路径：

```text
src/lessons/lesson13-tool-permission/graph/create-agent-graph.ts
```

这个文件基于第 12 课修改。

核心变化：

```text
1. 在 shouldContinue 中先检查权限
2. 如果无权限，进入 permission_denied 节点
3. 如果有权限，再判断是否需要 human_approval
4. toolNode 调用 ToolExecutor 时传入 userContext
```

---

## 十五、增加导入

在第 12 课基础上增加：

```ts
import { findFirstDeniedToolPermission } from "../security/tool-permission-policy.js";
```

完整导入区域类似：

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
import { findFirstDeniedToolPermission } from "../security/tool-permission-policy.js";
import {
  AgentStateAnnotation,
  createTraceStep,
  type AgentState,
  type HumanApprovalResult,
} from "./agent-state.js";
```

---

## 十六、修改 shouldContinue

第 12 课中，是先判断是否需要人工确认。

第 13 课要先判断权限。

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

  const deniedPermission = findFirstDeniedToolPermission({
    toolCalls,
    userContext: state.userContext,
  });

  if (deniedPermission) {
    return "permission_denied";
  }

  if (hasApprovalRequiredToolCall(toolCalls)) {
    return "human_approval";
  }

  return "tools";
}
```

这里的顺序非常重要：

```text
先检查权限
再判断人工确认
最后执行工具
```

如果用户没有权限，就不应该进入人工确认。

因为确认不能绕过权限。

---

## 十七、新增 permissionDeniedNode

```ts
async function permissionDeniedNode(state: AgentState) {
  const lastMessage = state.messages.at(-1);

  if (!(lastMessage instanceof AIMessage)) {
    return {
      currentNode: "permission_denied",
      stopReason: "non_ai_message" as const,
      traceSteps: [
        createTraceStep({
          event: "permission_denied",
          nodeName: "permission_denied",
          loopCount: state.loopCount,
          message: "最后一条消息不是 AIMessage，无法进行权限判断。",
        }),
      ],
    };
  }

  const deniedPermission = findFirstDeniedToolPermission({
    toolCalls: lastMessage.tool_calls ?? [],
    userContext: state.userContext,
  });

  const message = new AIMessage({
    content: deniedPermission
      ? `当前用户无权执行工具 ${deniedPermission.toolName}。原因：${deniedPermission.reason}`
      : "当前用户无权执行该工具。",
  });

  return {
    messages: [message],
    currentNode: "permission_denied",
    stopReason: "permission_denied" as const,
    permissionDecision: deniedPermission,
    traceSteps: [
      createTraceStep({
        event: "permission_denied",
        nodeName: "permission_denied",
        loopCount: state.loopCount,
        message: deniedPermission
          ? `权限拦截：${deniedPermission.reason}`
          : "权限拦截：未知权限错误。",
      }),
    ],
  };
}
```

这个节点的作用是：

```text
生成无权限提示
记录 permissionDecision
写入 traceSteps
结束流程
```

---

## 十八、修改 toolNode

第 12 课中：

```ts
const executionResult = await toolExecutor.execute(toolCalls);
```

第 13 课改成：

```ts
const executionResult = await toolExecutor.execute(
  toolCalls,
  state.userContext,
);
```

完整关键部分：

```ts
const toolCalls = lastMessage.tool_calls ?? [];

const executionResult = await toolExecutor.execute(
  toolCalls,
  state.userContext,
);
```

这样 `ToolExecutor` 执行工具时，也能拿到当前用户上下文。

---

## 十九、修改图结构

第 13 课新增节点：

```ts
.addNode("permission_denied", permissionDeniedNode)
```

新增边：

```ts
.addEdge("permission_denied", END)
```

完整图结构：

```ts
return new StateGraph(AgentStateAnnotation)
  .addNode("llm", llmNode)
  .addNode("tools", toolNode)
  .addNode("human_approval", humanApprovalNode)
  .addNode("human_rejected", humanRejectedNode)
  .addNode("permission_denied", permissionDeniedNode)
  .addNode("final_answer", finalAnswerNode)
  .addNode("max_iteration_fallback", maxIterationFallbackNode)
  .addEdge(START, "llm")
  .addConditionalEdges("llm", shouldContinue)
  .addConditionalEdges("human_approval", routeAfterApproval)
  .addEdge("tools", "llm")
  .addEdge("human_rejected", END)
  .addEdge("permission_denied", END)
  .addEdge("final_answer", END)
  .addEdge("max_iteration_fallback", END)
  .compile({
    checkpointer: options.checkpointer,
  });
```

最终流程：

```text
START
  ↓
llm
  ↓
shouldContinue
  ├── 没有 tool_calls → final_answer → END
  ├── 无权限工具 → permission_denied → END
  ├── 有权限 + 高风险工具 → human_approval
  │                          ├── 同意 → tools → llm
  │                          └── 拒绝 → human_rejected → END
  ├── 有权限 + 普通工具 → tools → llm
  └── 达到最大轮次 → max_iteration_fallback → END
```

---

## 二十、修改 index.ts

文件路径：

```text
src/lessons/lesson13-tool-permission/index.ts
```

这一课要模拟三种用户：

```text
viewer：只能查询知识库，不能创建工单
support：可以查询知识库，也可以创建工单，但创建前需要确认
admin：可以执行所有当前工具
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
import type {
  HumanApprovalResult,
  UserContext,
} from "./graph/agent-state.js";

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
9. 如果用户没有工具权限，请不要尝试绕过权限限制。
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

const viewerUser: UserContext = {
  userId: "user-viewer-001",
  username: "viewer-user",
  roles: ["viewer"],
  department: "业务部门",
};

const supportUser: UserContext = {
  userId: "user-support-001",
  username: "support-user",
  roles: ["support"],
  department: "客服部门",
};

const adminUser: UserContext = {
  userId: "user-admin-001",
  username: "admin-user",
  roles: ["admin"],
  department: "平台管理部",
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
  userContext: UserContext;
  approval?: HumanApprovalResult;
}) {
  const config = createThreadConfig(params.threadId);

  const latestStateBeforeInvoke = await params.graph.getState(config);

  const hasHistory = hasConversationHistory(latestStateBeforeInvoke.values);

  const input = createConversationInput({
    userInput: params.userInput,
    systemPrompt,
    hasHistory,
    userContext: params.userContext,
  });

  console.log("\n\n========================================");
  console.log("thread_id：", params.threadId);
  console.log("当前用户：", params.userContext.username);
  console.log("用户角色：", params.userContext.roles.join(", "));
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

  console.log("\n========== 工具权限控制最终结果 ==========");
  console.log("当前节点：", result.currentNode);
  console.log("停止原因：", result.stopReason);
  console.log("本轮循环轮次：", result.loopCount);

  console.log("\n最终回答：");
  console.log(finalMessage?.content);

  console.log("\n权限判断结果：");
  console.log(JSON.stringify(result.permissionDecision, null, 2));

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
    threadId: "lesson13-viewer-query",
    userContext: viewerUser,
    userInput: "我们的企业知识库支持哪些数据源接入？",
  });

  await runConversationTurn({
    graph,
    threadId: "lesson13-viewer-create-ticket",
    userContext: viewerUser,
    userInput: "帮我创建一个高优先级工单，反馈知识库 PDF 搜不到。",
    approval: {
      approved: true,
      comment: "即使这里模拟同意，也应该因为权限不足而不能执行。",
      reviewer: "viewer-user",
      reviewedAt: new Date().toISOString(),
    },
  });

  await runConversationTurn({
    graph,
    threadId: "lesson13-support-create-ticket",
    userContext: supportUser,
    userInput: "帮我创建一个中优先级工单，反馈 RAG 检索效果不好。",
    approval: {
      approved: true,
      comment: "客服确认创建工单。",
      reviewer: "support-user",
      reviewedAt: new Date().toISOString(),
    },
  });

  await runConversationTurn({
    graph,
    threadId: "lesson13-admin-create-ticket",
    userContext: adminUser,
    userInput: "帮我创建一个低优先级工单，记录 Agent 工具调用规范优化建议。",
    approval: {
      approved: true,
      comment: "管理员确认创建工单。",
      reviewer: "admin-user",
      reviewedAt: new Date().toISOString(),
    },
  });
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 二十一、运行第 13 课

执行：

```bash
pnpm lesson:13
```

本节会测试四个场景：

```text
1. viewer 查询知识库
2. viewer 创建工单
3. support 创建工单
4. admin 创建工单
```

---

## 二十二、场景 1：viewer 查询知识库

输入：

```text
用户角色：viewer
用户输入：我们的企业知识库支持哪些数据源接入？
```

预期结果：

```text
search_knowledge_base 权限检查通过
正常调用知识库查询工具
返回知识库支持的数据源
```

因为 `search_knowledge_base` 的 requiredRoles 是：

```ts
["viewer", "support", "admin"]
```

而当前用户拥有：

```ts
["viewer"]
```

所以权限判断应该通过。

---

## 二十三、场景 2：viewer 创建工单

输入：

```text
用户角色：viewer
用户输入：帮我创建一个高优先级工单，反馈知识库 PDF 搜不到。
```

预期结果：

```text
create_ticket 权限检查不通过
进入 permission_denied
不会进入 human_approval
不会执行 create_ticket
```

注意：这里即使传入了模拟确认：

```ts
approval: {
  approved: true,
  comment: "即使这里模拟同意，也应该因为权限不足而不能执行。",
}
```

它也不会生效。

因为权限检查发生在人工确认之前。

---

## 二十四、场景 3：support 创建工单

输入：

```text
用户角色：support
用户输入：帮我创建一个中优先级工单，反馈 RAG 检索效果不好。
```

预期结果：

```text
create_ticket 权限检查通过
进入 human_approval
用户确认
执行 create_ticket
最终返回工单创建结果
```

因为 `support` 有创建工单权限。

但是 `create_ticket` 仍然是高风险工具，所以仍然需要人工确认。

---

## 二十五、场景 4：admin 创建工单

输入：

```text
用户角色：admin
用户输入：帮我创建一个低优先级工单，记录 Agent 工具调用规范优化建议。
```

预期结果：

```text
create_ticket 权限检查通过
进入 human_approval
用户确认
执行 create_ticket
最终返回工单创建结果
```

`admin` 有创建工单权限。

---

## 二十六、运行中遇到的小坑：some 回调必须返回值

本节调试时发现了一个很典型的 TS/JS 小坑。

一开始代码写成了：

```ts
const allowed = config.requiredRoles.some((role) => {
  params.userContext?.roles.includes(role);
});
```

看起来好像逻辑没问题，但结果一直是 `false`。

原因是：

```text
箭头函数使用 {} 函数体时，必须显式 return。
```

上面这段代码虽然执行了：

```ts
params.userContext?.roles.includes(role);
```

但是没有把结果返回给 `some()`。

所以每次回调返回的都是：

```ts
undefined
```

`some()` 只有在回调返回 `true` 时才会返回 `true`。

正确写法有两种。

### 写法 1：去掉大括号，使用隐式返回

```ts
const allowed = config.requiredRoles.some((role) =>
  params.userContext.roles.includes(role),
);
```

### 写法 2：保留大括号，显式 return

```ts
const allowed = config.requiredRoles.some((role) => {
  return params.userContext.roles.includes(role);
});
```

本节最终使用第一种写法：

```ts
const allowed = config.requiredRoles.some((role) =>
  params.userContext.roles.includes(role),
);
```

这个问题很常见，后面写 `map`、`filter`、`some`、`every` 时都要注意。

---

## 二十七、第 13 课和第 12 课的区别

第 12 课：

```text
高风险操作需要用户确认。
```

第 13 课：

```text
用户必须先有权限，才有资格进入确认流程。
```

第 12 课解决的是：

```text
你确认要执行吗？
```

第 13 课解决的是：

```text
你有资格执行吗？
```

正确顺序应该是：

```text
先权限判断
再人工确认
最后执行工具
```

而不是：

```text
先确认
再看有没有权限
```

更不能是：

```text
用户确认了，所以可以绕过权限。
```

---

## 二十八、企业级 Agent 的两层安全控制

到第 13 课为止，我们已经实现了两层安全控制。

### 第一层：权限控制

问题是：

```text
用户有没有资格执行这个工具？
```

例如：

```text
viewer 不能 create_ticket
support 可以 create_ticket
admin 可以 create_ticket
```

### 第二层：人工确认

问题是：

```text
用户是否确认要执行这个操作？
```

例如：

```text
support 有权限创建工单
但创建前仍然需要确认
```

这两层不能混淆。

```text
有权限 ≠ 可以直接执行
确认了 ≠ 可以绕过权限
```

---

## 二十九、Java 后端视角理解

可以把第 13 课类比成后端接口权限控制。

普通后端接口可能是：

```java
@PostMapping("/tickets")
public Ticket createTicket(
    @CurrentUser User user,
    @RequestBody CreateTicketRequest request
) {
    permissionService.check(user, "create_ticket");
    return ticketService.create(request);
}
```

Agent 工具调用也一样：

```text
模型提出 create_ticket
  ↓
permissionService.check(userContext, "create_ticket")
  ↓
无权限：拒绝
  ↓
有权限：继续判断是否需要人工确认
  ↓
确认通过：执行工具
```

所以 Agent 工具本质上也应该像后端接口一样受权限控制。

---

## 三十、后续还能怎么优化？

本节只是权限控制的入门版本。

真实企业项目中还可以继续扩展。

### 1. 更细的权限模型

当前只有角色：

```text
viewer
support
admin
```

后续可以增加：

```text
权限码
部门
租户
数据范围
项目空间
资源归属
```

例如：

```text
ticket:create
ticket:delete
knowledge:read
knowledge:manage
```

---

### 2. 工具权限配置外部化

当前权限配置写在代码里：

```ts
const TOOL_PERMISSION_CONFIG = { ... }
```

真实项目中可以改成：

```text
数据库配置
配置中心
后台管理页面
JSON 配置文件
```

这样新增工具时，不一定需要修改代码。

---

### 3. 数据权限

有些用户虽然有工具权限，但只能操作自己部门的数据。

例如：

```text
华东区域用户只能查询华东项目
客服 A 只能处理自己负责的工单
供应商只能查看自己的信息
```

这属于数据权限，不只是工具权限。

---

### 4. 审计日志

权限拒绝、人工确认、工具执行都应该记录审计日志。

字段可以包括：

```text
threadId
userId
username
roles
toolName
toolArgs
permissionDecision
approvalResult
executionResult
createdAt
```

---

## 三十一、TypeScript Tips

### 1. Record

```ts
const TOOL_PERMISSION_CONFIG: Record<string, ToolPermissionConfig> = {
  search_knowledge_base: {
    requiredRoles: ["viewer", "support", "admin"],
    description: "查询知识库，所有已登录用户都可以使用。",
  },
};
```

`Record<string, ToolPermissionConfig>` 表示：

```text
这是一个对象
key 是 string
value 是 ToolPermissionConfig
```

类似 Java 里的：

```java
Map<String, ToolPermissionConfig>
```

---

### 2. some

```ts
const allowed = config.requiredRoles.some((role) =>
  params.userContext.roles.includes(role),
);
```

`some()` 表示：

```text
只要数组里有一个元素满足条件，就返回 true。
```

在这里表示：

```text
只要用户拥有任意一个所需角色，就允许执行。
```

---

### 3. includes

```ts
params.userContext.roles.includes(role)
```

`includes()` 用于判断数组中是否包含某个值。

例如：

```ts
["viewer"].includes("viewer")
```

结果是：

```text
true
```

---

### 4. 箭头函数隐式返回

```ts
const allowed = config.requiredRoles.some((role) =>
  params.userContext.roles.includes(role),
);
```

这个写法没有 `{}`，所以会自动返回表达式结果。

如果使用 `{}`，必须写 `return`：

```ts
const allowed = config.requiredRoles.some((role) => {
  return params.userContext.roles.includes(role);
});
```

---

### 5. 默认拒绝策略

```ts
if (!config) {
  return {
    allowed: false,
    reason: `工具 ${params.toolCall.name} 未配置权限策略，默认拒绝执行。`,
  };
}
```

这是安全设计里的重要原则：

```text
没有明确允许，就默认拒绝。
```

---

## 三十二、本节总结

第 13 课完成了工具权限控制。

核心收获：

```text
1. Agent 工具调用也必须做权限控制
2. userContext 表示当前用户身份和角色
3. 每个工具应该有权限策略
4. 未配置权限策略的工具默认拒绝
5. 权限控制应该发生在人工确认之前
6. ToolExecutor 执行前也要再次检查权限
7. viewer 可以查询知识库，但不能创建工单
8. support 和 admin 可以创建工单，但仍然需要人工确认
9. 权限控制和人工确认是两层不同的安全机制
```

本节最重要的一句话：

> 企业级 Agent 的工具调用，本质上也是后端接口调用，必须遵守权限控制。

---

## 三十三、下一课预告

下一课进入：

# 第 14 课：RAG 入门，理解企业知识库问答流程

从第 14 课开始，我们会正式进入 RAG 阶段。

第 14 课主要学习：

```text
1. RAG 是什么
2. 企业知识库为什么需要 RAG
3. 文档加载、切分、向量化、检索、生成的完整流程
4. Tool Calling 和 RAG 的区别
5. 用内存数据模拟一个最小 RAG 流程
```

第 13 课解决的是：

```text
用户有没有权限执行工具？
```

第 14 课要开始解决：

```text
Agent 如何从企业知识库中找到可靠资料，再基于资料回答用户？
```
