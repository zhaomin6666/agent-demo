import type { StructuredToolInterface } from "@langchain/core/tools";

import { createTicketTool } from "./create-ticket.tool.js";
import { searchKnowledgeBaseTool } from "./search-knowledge-base.tool.js";

export const tools: StructuredToolInterface[] = [
  searchKnowledgeBaseTool,
  createTicketTool,
];