import type { StructuredToolInterface } from "@langchain/core/tools";

import type { TraceRecorder } from "../observability/trace-recorder.js";
import type { RagQaChain } from "../rag/rag-qa-chain.js";
import { createTicketTool } from "./create-ticket.tool.js";
import { createSearchKnowledgeBaseTool } from "./search-knowledge-base.tool.js";

export function createTools(params: {
  ragQaChain: RagQaChain;
  traceRecorder?: TraceRecorder;
}): StructuredToolInterface[] {
  return [
    createSearchKnowledgeBaseTool(params.ragQaChain, params.traceRecorder),
    createTicketTool,
  ];
}
