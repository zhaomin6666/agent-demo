import type { SimilaritySearchResult } from "../vector-store/memory-vector-store.js";

export function buildRagContext(results: SimilaritySearchResult[]): string {
  if (results.length === 0) {
    return "当前知识库中没有检索到足够相关的资料。";
  }

  return results
    .map((result, index) => {
      const { chunkEmbedding, score } = result;
      const { chunk } = chunkEmbedding;

      return [
        `资料 ${index + 1}`,
        `标题：${chunk.title}`,
        `来源：${chunk.source}`,
        `相似度分数：${score.toFixed(4)}`,
        `内容：${chunk.content}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}