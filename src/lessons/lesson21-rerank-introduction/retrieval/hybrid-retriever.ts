import type { MemoryVectorStore } from "../vector-store/memory-vector-store.js";
import type { KeywordRetriever } from "./keyword-retriever.js";
import type {
  RetrievalEngine,
  RetrievalSearchOptions,
  RetrievalSearchResult,
  RetrievalSource,
} from "./retrieval-types.js";

export type HybridRetrieverOptions = {
  vectorStore: MemoryVectorStore;
  keywordRetriever: KeywordRetriever;
  vectorWeight: number;
  keywordWeight: number;
  candidateKMultiplier?: number;
};

export class HybridRetriever implements RetrievalEngine {
  constructor(private readonly options: HybridRetrieverOptions) {}

  async similaritySearch(
    query: string,
    searchOptions: RetrievalSearchOptions,
  ): Promise<RetrievalSearchResult[]> {
    const candidateTopK =
      searchOptions.topK * (this.options.candidateKMultiplier ?? 3);

    const [vectorResults, keywordResults] = await Promise.all([
      this.options.vectorStore.similaritySearch(query, {
        topK: candidateTopK,
      }),
      this.options.keywordRetriever.similaritySearch(query, {
        topK: candidateTopK,
      }),
    ]);

    const resultMap = new Map<string, RetrievalSearchResult>();

    for (const result of vectorResults) {
      const chunkId = result.chunkEmbedding.chunk.id;

      resultMap.set(chunkId, {
        chunkEmbedding: result.chunkEmbedding,
        score: 0,
        vectorScore: result.score,
        keywordScore: 0,
        retrievalSources: ["vector"],
        matchedKeywords: [],
      });
    }

    for (const result of keywordResults) {
      const chunkId = result.chunkEmbedding.chunk.id;

      const existing = resultMap.get(chunkId);

      if (!existing) {
        resultMap.set(chunkId, {
          chunkEmbedding: result.chunkEmbedding,
          score: 0,
          vectorScore: 0,
          keywordScore: result.keywordScore ?? result.score,
          retrievalSources: ["keyword"],
          matchedKeywords: result.matchedKeywords ?? [],
        });

        continue;
      }

      existing.keywordScore = result.keywordScore ?? result.score;
      existing.matchedKeywords = result.matchedKeywords ?? [];
      addRetrievalSource(existing, "keyword");
    }

    return Array.from(resultMap.values())
      .map((result) => {
        const vectorScore = result.vectorScore ?? 0;
        const keywordScore = result.keywordScore ?? 0;

        const totalScore =
          vectorScore * this.options.vectorWeight +
          keywordScore * this.options.keywordWeight;

        // console.log(
        //   "chunkId:" +
        //     result.chunkEmbedding.chunk.id +
        //     ", v_score:" +
        //     vectorScore +
        //     ", k_score:" +
        //     keywordScore +
        //     ", t_score:" +
        //     totalScore,
        // );

        return {
          ...result,
          score: totalScore,
        };
      })
      .filter((result) => result.score >= (searchOptions.minScore ?? -1))
      .sort((left, right) => right.score - left.score)
      .slice(0, searchOptions.topK);
  }
}

function addRetrievalSource(
  result: RetrievalSearchResult,
  source: RetrievalSource,
) {
  if (result.retrievalSources.includes(source)) {
    return;
  }

  result.retrievalSources.push(source);
}
