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
import { findFirstDeniedToolPermission } from "../security/tool-permission-policy.js";

export type ToolCallingModel = {
  invoke(messages: BaseMessage[]): Promise<AIMessage>;
};

export type AgentGraphOptions = {
  maxIterations: number;
  checkpointer: MemorySaver;
  memory: {
    maxRecentMessages: number;
  };
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

    const executionResult = await toolExecutor.execute(
      toolCalls,
      state.userContext,
    );

    console.log("\n工具执行日志:");
    console.log(JSON.stringify(executionResult.records, null, 2));

    const lastToolResult = getLastRecord(executionResult.records);

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
  }

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

  async function humanApproveNode(state: AgentState) {
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

  function routeAfterApproval(state: AgentState) {
    if (state.humanApprovalResult?.approved) {
      return "tools";
    }

    return "human_rejected";
  }

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
    .addNode("human_approval", humanApproveNode)
    .addNode("human_rejected", humanRejectedNode)
    .addNode("permission_denied", permissionDeniedNode)
    .addEdge(START, "llm")
    .addConditionalEdges("llm", shouldContinue)
    .addConditionalEdges("human_approval", routeAfterApproval)
    .addEdge("permission_denied", END)
    .addEdge("tools", "llm")
    .addEdge("human_rejected", END)
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
