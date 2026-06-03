import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import type { ToolExecutionRecord } from "../executor/tool-executor.js";

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  loopCount: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),

  toolExecutionRecords: Annotation<ToolExecutionRecord[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;