import type { ChunkEmbedding } from "../embedding/chunk-embedding.js";

export type RetrievalSource = "vector" | "keyword";

export type RetrievalSearchOptions = {
  topK: number;
  minScore?: number;
};

export type RetrievalSearchResult = {
  chunkEmbedding: ChunkEmbedding;
  score: number;
  vectorScore?: number;
  keywordScore?: number;
  retrievalSources: RetrievalSource[];
  matchedKeywords?: string[];

  originalScore?: number;
  rerankScore?: number;
  rerankReasons?: string[];
};

export type RetrievalEngine = {
  similaritySearch(
    query: string,
    options: RetrievalSearchOptions,
  ): Promise<RetrievalSearchResult[]>;
};