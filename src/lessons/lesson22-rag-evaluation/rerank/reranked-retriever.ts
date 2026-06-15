import type {
  RetrievalEngine,
  RetrievalSearchOptions,
  RetrievalSearchResult,
} from "../retrieval/retrieval-types.js";
import type { Reranker } from "./reranker-types.js";

export type RerankedRetrieverOptions = {
  baseRetriever: RetrievalEngine;
  reranker: Reranker;
  candidateKMultiplier?: number;
};

export class RerankedRetriever implements RetrievalEngine {
  constructor(private readonly options: RerankedRetrieverOptions) {}

  async similaritySearch(
    query: string,
    searchOptions: RetrievalSearchOptions,
  ): Promise<RetrievalSearchResult[]> {
    const candidateTopK =
      searchOptions.topK * (this.options.candidateKMultiplier ?? 4);

    const candidates = await this.options.baseRetriever.similaritySearch(
      query,
      {
        topK: candidateTopK,
        minScore: searchOptions.minScore,
      },
    );

    if (candidates.length === 0) {
      return [];
    }

    const rerankedResults = await this.options.reranker.rerank({
      query,
      results: candidates,
    });

    return rerankedResults.slice(0, searchOptions.topK);
  }
}