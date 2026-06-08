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
