import type { RetrievalSearchResult } from "../retrieval/retrieval-types.js";

export function buildRagContext(results: RetrievalSearchResult[]): string {
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
        `检索来源：${result.retrievalSources.join(", ")}`,
        `综合分数：${score.toFixed(4)}`,
        `向量分数：${(result.vectorScore ?? 0).toFixed(4)}`,
        `关键词分数：${(result.keywordScore ?? 0).toFixed(4)}`,
        `命中关键词：${result.matchedKeywords?.join(", ") || "无"}`,
        `内容：${chunk.content}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}