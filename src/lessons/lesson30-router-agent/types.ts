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

export type AgentInput = {
  message: string;
  routerDecision: RouterDecision;
};

export type AgentOutput = {
  agentName: TargetAgent;
  answer: string;
};

export type AgentRunResult = {
  userMessage: string;
  routerDecision: RouterDecision;
  output: AgentOutput;
};