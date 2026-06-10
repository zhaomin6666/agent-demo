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