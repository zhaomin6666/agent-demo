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