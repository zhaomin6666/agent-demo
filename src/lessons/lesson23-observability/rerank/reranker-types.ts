import type { RetrievalSearchResult } from "../retrieval/retrieval-types.js";

export type RerankInput = {
  query: string;
  results: RetrievalSearchResult[];
};

export type Reranker = {
  rerank(input: RerankInput): Promise<RetrievalSearchResult[]>;
};