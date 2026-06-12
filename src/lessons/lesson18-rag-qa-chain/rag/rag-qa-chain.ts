import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import { buildRagContext } from "./rag-context-builder.js";
import type {
  MemoryVectorStore,
  SimilaritySearchResult,
} from "../vector-store/memory-vector-store.js";

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
    contentPreview: string;
  }[];
};

export type RagChatModel = {
  invoke(messages: BaseMessage[]): Promise<{
    content: unknown;
  }>;
};

export class RagQaChain {
  constructor(
    private readonly model: RagChatModel,
    private readonly vectorStore: MemoryVectorStore,
    private readonly options: RagQaChainOptions,
  ) {}

  async invoke(question: string): Promise<RagQaAnswer> {
    const searchResults = await this.vectorStore.similaritySearch(question, {
      topK: this.options.topK,
      minScore: this.options.minScore,
    });

    if (searchResults.length === 0) {
      return this.createNoEvidenceAnswer(question);
    }

    const context = buildRagContext(searchResults);

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

    return {
      question,
      answer: String(response.content),
      context,
      searchResults: this.toSearchResultSummaries(searchResults),
    };
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

  private toSearchResultSummaries(results: SimilaritySearchResult[]) {
    return results.map((result) => {
      const { chunkEmbedding, score } = result;
      const { chunk } = chunkEmbedding;

      return {
        chunkId: chunk.id,
        title: chunk.title,
        source: chunk.source,
        score,
        contentPreview: chunk.content.slice(0, 120),
      };
    });
  }
}