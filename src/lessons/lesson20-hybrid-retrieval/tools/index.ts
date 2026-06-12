import type { StructuredToolInterface } from "@langchain/core/tools";

import type { RagQaChain } from "../rag/rag-qa-chain.js";
import { createTicketTool } from "./create-ticket.tool.js";
import { createSearchKnowledgeBaseTool } from "./search-knowledge-base.tool.js";

export function createTools(params: {
  ragQaChain: RagQaChain;
}): StructuredToolInterface[] {
  return [
    createSearchKnowledgeBaseTool(params.ragQaChain),
    createTicketTool,
  ];
}