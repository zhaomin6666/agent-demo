import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { RagQaChain } from "../rag/rag-qa-chain.js";

export function createSearchKnowledgeBaseTool(ragQaChain: RagQaChain) {
  return tool(
    async ({ query }) => {
      const answer = await ragQaChain.invoke(query);

      return JSON.stringify(
        {
          status: answer.searchResults.length > 0 ? "success" : "no_evidence",
          query: answer.question,
          answer: answer.answer,
          sources: answer.searchResults.map((result) => ({
            title: result.title,
            source: result.source,
            score: Number(result.score.toFixed(4)),
            contentPreview: result.contentPreview,
          })),
        },
        null,
        2,
      );
    },
    {
      name: "search_knowledge_base",
      description:
        "查询企业知识库。适用于回答企业知识库、RAG、文档接入、检索优化、Agent 工具规范、权限控制、人工确认等内部资料相关问题。",
      schema: z.object({
        query: z
          .string()
          .min(1)
          .describe("用户想要查询的知识库问题，应该保留用户原始语义。"),
      }),
    },
  );
}