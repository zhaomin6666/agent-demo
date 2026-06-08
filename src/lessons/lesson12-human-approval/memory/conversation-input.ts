import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import type { AgentState } from "../graph/agent-state.js";

export type ConversationInputParams = {
  userInput: string;
  systemPrompt: string;
  hasHistory: boolean;
};

export type ConversationInput = {
  messages: BaseMessage[];
  loopCount: number;
  currentNode: string;
  stopReason: "running";
  lastToolResult: null;
  maxIterationsReached: false;
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
  };
}

export function hasConversationHistory(
  state: Partial<AgentState> | undefined,
): boolean {
  return (state?.messages?.length ?? 0) > 0;
}