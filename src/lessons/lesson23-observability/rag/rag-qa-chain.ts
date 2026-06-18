import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import type { TraceRecorder } from "../observability/trace-recorder.js";
import { buildRagContext } from "./rag-context-builder.js";
import type {
  RetrievalEngine,
  RetrievalSearchResult,
} from "../retrieval/retrieval-types.js";

export type RagQaChainOptions = {
  topK: number;
  minScore: number;
};

export type RagQaAnswer = {
  question: string;
  answer: string;
  context: string;
  searchResults: {
    chunkId: string;
    title: string;
    source: string;
    score: number;
    originalScore?: number;
    rerankScore?: number;
    rerankReasons: string[];
    vectorScore?: number;
    keywordScore?: number;
    retrievalSources: string[];
    matchedKeywords: string[];
    contentPreview: string;
  }[];
};

export type RagChatModel = {
  invoke(messages: BaseMessage[]): Promise<{
    content: unknown;
  }>;
};
export type RagQaInvokeOptions = {
  traceId?: string;
};
export class RagQaChain {
  constructor(
    private readonly model: RagChatModel,
    private readonly retriever: RetrievalEngine,
    private readonly options: RagQaChainOptions,
    private readonly traceRecorder?: TraceRecorder,
  ) {}

  async invoke(
    question: string,
    invokeOptions?: RagQaInvokeOptions,
  ): Promise<RagQaAnswer> {
    const ragSpan = this.traceRecorder?.startSpan({
      traceId: invokeOptions?.traceId,
      type: "rag.invoke",
      name: "RagQaChain.invoke",
      input: {
        question,
      },
      metadata: {
        topK: this.options.topK,
        minScore: this.options.minScore,
      },
    });
    try {
      const retrieveSpan = this.traceRecorder?.startSpan({
        traceId: ragSpan?.traceId,
        type: "rag.retrieve",
        name: "retriever.similaritySearch",
        input: {
          question,
        },
        metadata: {
          topK: this.options.topK,
          minScore: this.options.minScore,
        },
      });
      const searchResults = await this.retriever.similaritySearch(question, {
        topK: this.options.topK,
        minScore: this.options.minScore,
      });
      retrieveSpan?.end({
        output: {
          resultCount: searchResults.length,
          sources: this.toSourceList(searchResults),
          topResults: this.toSearchResultSummaries(searchResults).map(
            (result) => ({
              title: result.title,
              source: result.source,
              score: Number(result.score.toFixed(4)),
              rerankScore:
                result.rerankScore === undefined
                  ? undefined
                  : Number(result.rerankScore.toFixed(4)),
            }),
          ),
        },
      });

      if (searchResults.length === 0) {
        const noEvidenceAnswer = this.createNoEvidenceAnswer(question);

        ragSpan?.end({
          output: {
            status: "no_evidence",
            resultCount: 0,
          },
        });

        return noEvidenceAnswer;
      }

      const contextSpan = this.traceRecorder?.startSpan({
        traceId: ragSpan?.traceId,
        type: "rag.context",
        name: "buildRagContext",
        input: {
          resultCount: searchResults.length,
        },
      });

      const context = buildRagContext(searchResults);

      contextSpan?.end({
        output: {
          contextLength: context.length,
        },
      });

      const generateSpan = this.traceRecorder?.startSpan({
        traceId: ragSpan?.traceId,
        type: "rag.generate",
        name: "model.invoke",
        input: {
          question,
          contextLength: context.length,
        },
      });

      const response = await this.model.invoke([
        new SystemMessage(`
你是一个企业知识库问答助手。

回答规则：
1. 必须优先基于【资料上下文】回答。
2. 如果资料上下文中没有相关信息，请明确说“当前知识库中没有找到可靠依据”。
3. 不要编造企业内部制度、系统能力、接口说明。
4. 回答要简洁、清晰，适合企业内部用户阅读。
5. 回答最后请列出参考来源，格式为“参考来源：xxx”。
`),
        new HumanMessage(`
【用户问题】
${question}

【资料上下文】
${context}
`),
      ]);

      const answer = String(response.content);

      generateSpan?.end({
        output: {
          answerPreview: answer.slice(0, 160),
        },
      });

      const result = {
        question,
        answer,
        context,
        searchResults: this.toSearchResultSummaries(searchResults),
      };

      ragSpan?.end({
        output: {
          status: "success",
          resultCount: searchResults.length,
          sources: this.toSourceList(searchResults),
          answerPreview: answer.slice(0, 160),
        },
      });

      return result;
    } catch (error) {
      ragSpan?.fail(error);
      throw error;
    }
  }

  private createNoEvidenceAnswer(question: string): RagQaAnswer {
    return {
      question,
      answer:
        "当前知识库中没有找到可靠依据，无法基于已有资料回答这个问题。建议补充相关文档后再查询。",
      context: "",
      searchResults: [],
    };
  }

  private toSearchResultSummaries(results: RetrievalSearchResult[]) {
    return results.map((result) => {
      const { chunkEmbedding, score } = result;
      const { chunk } = chunkEmbedding;

      return {
        chunkId: chunk.id,
        title: chunk.title,
        source: chunk.source,
        score,
        originalScore: result.originalScore,
        rerankScore: result.rerankScore,
        rerankReasons: result.rerankReasons ?? [],
        vectorScore: result.vectorScore,
        keywordScore: result.keywordScore,
        retrievalSources: result.retrievalSources,
        matchedKeywords: result.matchedKeywords ?? [],
        contentPreview: chunk.content.slice(0, 120),
      };
    });
  }

  private toSourceList(results: RetrievalSearchResult[]): string[] {
    return Array.from(
      new Set(results.map((result) => result.chunkEmbedding.chunk.source)),
    );
  }
}
