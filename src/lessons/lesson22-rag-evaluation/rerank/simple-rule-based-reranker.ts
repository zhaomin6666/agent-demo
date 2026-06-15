import type { RetrievalSearchResult } from "../retrieval/retrieval-types.js";
import type { RerankInput, Reranker } from "./reranker-types.js";

const RERANK_TERMS = [
  "知识库",
  "数据源",
  "资料",
  "文档",
  "接入",
  "rag",
  "召回",
  "检索",
  "搜索",
  "优化",
  "embedding",
  "向量",
  "工单",
  "权限",
  "人工确认",
  "工具",
  "agent",
  "tool",
  "schema",
  "pdf",
  "word",
  "markdown",
  "接口",
  "响应",
  "排查",
  "agent-tool-policy.md",
];

export class SimpleRuleBasedReranker implements Reranker {
  async rerank(input: RerankInput): Promise<RetrievalSearchResult[]> {
    const terms = extractRerankTerms(input.query);

    return input.results
      .map((result) => rerankOneResult(result, terms))
      .sort((left, right) => {
        const leftScore = left.rerankScore ?? left.score;
        const rightScore = right.rerankScore ?? right.score;

        return rightScore - leftScore;
      });
  }
}

function rerankOneResult(
  result: RetrievalSearchResult,
  terms: string[],
): RetrievalSearchResult {
  const chunk = result.chunkEmbedding.chunk;

  const titleScore = calculateMatchScore(chunk.title, terms);
  const sourceScore = calculateMatchScore(chunk.source, terms);
  const contentScore = calculateMatchScore(chunk.content, terms);
  const matchedKeywordScore =
    (result.matchedKeywords?.length ?? 0) / Math.max(terms.length, 1);

  const multiSourceBoost =
    result.retrievalSources.length >= 2 ? 0.08 : 0;

  const originalScore = result.score;

  const rerankScore = clampScore(
    originalScore * 0.55 +
      titleScore * 0.18 +
      sourceScore * 0.12 +
      contentScore * 0.1 +
      matchedKeywordScore * 0.05 +
      multiSourceBoost,
  );

  return {
    ...result,
    score: rerankScore,
    originalScore,
    rerankScore,
    rerankReasons: buildRerankReasons({
      titleScore,
      sourceScore,
      contentScore,
      matchedKeywordScore,
      multiSourceBoost,
      retrievalSources: result.retrievalSources,
      matchedKeywords: result.matchedKeywords ?? [],
    }),
  };
}

function extractRerankTerms(query: string): string[] {
  const normalizedQuery = query.toLowerCase();

  const termsFromSplit = normalizedQuery
    .split(/[\s,，。？?、：:；;（）()]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  const knownTerms = RERANK_TERMS.filter((term) =>
    normalizedQuery.includes(term.toLowerCase()),
  );

  return Array.from(new Set([...termsFromSplit, ...knownTerms]));
}

function calculateMatchScore(text: string, terms: string[]): number {
  if (terms.length === 0) {
    return 0;
  }

  const normalizedText = text.toLowerCase();

  const matchedCount = terms.filter((term) =>
    normalizedText.includes(term.toLowerCase()),
  ).length;

  return matchedCount / terms.length;
}

function buildRerankReasons(params: {
  titleScore: number;
  sourceScore: number;
  contentScore: number;
  matchedKeywordScore: number;
  multiSourceBoost: number;
  retrievalSources: string[];
  matchedKeywords: string[];
}): string[] {
  const reasons: string[] = [];

  if (params.retrievalSources.length >= 2) {
    reasons.push("同时被向量检索和关键词检索召回");
  }

  if (params.titleScore > 0) {
    reasons.push("标题命中查询关键词");
  }

  if (params.sourceScore > 0) {
    reasons.push("来源或文件名命中查询关键词");
  }

  if (params.contentScore > 0) {
    reasons.push("正文内容命中查询关键词");
  }

  if (params.matchedKeywordScore > 0) {
    reasons.push(`关键词检索命中：${params.matchedKeywords.join(", ")}`);
  }

  if (params.multiSourceBoost > 0) {
    reasons.push("多路检索结果一致，增加可信度");
  }

  if (reasons.length === 0) {
    reasons.push("主要依据初筛检索分数排序");
  }

  return reasons;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(score, 1));
}