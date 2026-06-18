import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { TraceRecorder } from "../observability/trace-recorder.js";
import type { RagQaChain } from "../rag/rag-qa-chain.js";

export function createSearchKnowledgeBaseTool(
  ragQaChain: RagQaChain,
  traceRecorder?: TraceRecorder,
) {
  return tool(
    async ({ query }) => {
      const toolSpan = traceRecorder?.startSpan({
        type: "tool.call",
        name: "search_knowledge_base",
        input: {
          query,
        },
      });

      try {
        const answer = await ragQaChain.invoke(query, {
          traceId: toolSpan?.traceId,
        });

        const payload = {
          status: answer.searchResults.length > 0 ? "success" : "no_evidence",
          query: answer.question,
          answer: answer.answer,
          sources: answer.searchResults.map((result) => ({
            title: result.title,
            source: result.source,
            score: Number(result.score.toFixed(4)),
            originalScore:
              result.originalScore === undefined
                ? undefined
                : Number(result.originalScore.toFixed(4)),
            rerankScore:
              result.rerankScore === undefined
                ? undefined
                : Number(result.rerankScore.toFixed(4)),
            vectorScore:
              result.vectorScore === undefined
                ? undefined
                : Number(result.vectorScore.toFixed(4)),
            keywordScore:
              result.keywordScore === undefined
                ? undefined
                : Number(result.keywordScore.toFixed(4)),
            retrievalSources: result.retrievalSources,
            matchedKeywords: result.matchedKeywords,
            rerankReasons: result.rerankReasons,
            contentPreview: result.contentPreview,
          })),
        };

        toolSpan?.end({
          output: {
            status: payload.status,
            sourceCount: payload.sources.length,
            sources: payload.sources.map((source) => source.source),
          },
        });
        return JSON.stringify(payload, null, 2);
      } catch (error) {
        toolSpan?.fail(error);
        throw error;
      }
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
