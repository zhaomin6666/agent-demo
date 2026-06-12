import type { EmbeddingsInterface } from "@langchain/core/embeddings";

import type { ChunkEmbedding } from "../embedding/chunk-embedding.js";
import { cosineSimilarity } from "./cosine-similarity.js";

export type SimilaritySearchOptions = {
  topK: number;
  minScore?: number;
};

export type SimilaritySearchResult = {
  chunkEmbedding: ChunkEmbedding;
  score: number;
};

export class MemoryVectorStore {
  constructor(
    private readonly embeddings: EmbeddingsInterface,
    private readonly items: ChunkEmbedding[],
  ) {}

  async similaritySearch(
    query: string,
    options: SimilaritySearchOptions,
  ): Promise<SimilaritySearchResult[]> {
    if (this.items.length === 0) {
      return [];
    }

    const queryVector = await this.embeddings.embedQuery(query);

    return this.items
      .map((item) => {
        return {
          chunkEmbedding: item,
          score: cosineSimilarity(queryVector, item.vector),
        };
      })
      .filter((item) => item.score >= (options.minScore ?? -1))
      .sort((left, right) => right.score - left.score)
      .slice(0, options.topK);
  }
}