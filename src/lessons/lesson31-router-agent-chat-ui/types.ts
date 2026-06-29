export type TargetAgent =
  | "tech_explainer"
  | "code_helper"
  | "study_planner"
  | "general_fallback";

export type RouterDecision = {
  targetAgent: TargetAgent;
  confidence: number;
  reason: string;
};

export type AgentStreamRequest = {
  message: string;
  sessionId?: string;
};

export type TraceStatus = "running" | "completed" | "failed";

export type TraceStep = {
  id: string;
  title: string;
  status: TraceStatus;
  detail?: string;
  timestamp: string;
  durationMs?: number;
};

export type SourceItem = {
  id: string;
  title: string;
  type: "lesson" | "doc" | "memory" | "tool";
  url?: string;
  snippet: string;
};

export type AgentStreamChunk =
  | {
      type: "trace";
      step: TraceStep;
    }
  | {
      type: "router";
      decision: RouterDecision;
    }
  | {
      type: "source";
      source: SourceItem;
    }
  | {
      type: "delta";
      content: string;
    };

export type AgentInput = {
  message: string;
  routerDecision: RouterDecision;
};

export type AgentOutput = {
  agentName: TargetAgent;
  answer: string;
};