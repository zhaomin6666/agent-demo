import type { ChunkEmbedding } from "../embedding/chunk-embedding.js";
import type {
  RetrievalEngine,
  RetrievalSearchOptions,
  RetrievalSearchResult,
} from "./retrieval-types.js";

const KNOWN_TERMS = [
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
];

export class KeywordRetriever implements RetrievalEngine {
  constructor(private readonly items: ChunkEmbedding[]) {}

  async similaritySearch(
    query: string,
    options: RetrievalSearchOptions,
  ): Promise<RetrievalSearchResult[]> {
    const keywords = extractSearchTerms(query);

    if (keywords.length === 0) {
      return [];
    }

    return this.items
      .map((item) => {
        const matchedKeywords = keywords.filter((keyword) =>
          isKeywordMatched(item, keyword),
        );

        const keywordScore = matchedKeywords.length / keywords.length;

        return {
          chunkEmbedding: item,
          score: keywordScore,
          keywordScore,
          retrievalSources: ["keyword" as const],
          matchedKeywords,
        };
      })
      .filter((item) => item.keywordScore >= (options.minScore ?? 0))
      .sort((left, right) => right.score - left.score)
      .slice(0, options.topK);
  }
}

function extractSearchTerms(query: string): string[] {
  const normalizedQuery = query.toLowerCase();

  const termsFromSplit = normalizedQuery
    .split(/[\s,，。？?、：:；;（）()]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  const knownTerms = KNOWN_TERMS.filter((term) =>
    normalizedQuery.includes(term.toLowerCase()),
  );

  return Array.from(new Set([...termsFromSplit, ...knownTerms]));
}

function isKeywordMatched(item: ChunkEmbedding, keyword: string): boolean {
  const chunk = item.chunk;

  const metadataText = Object.values(chunk.metadata)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .join(" ");

  const searchableText = [
    chunk.id,
    chunk.documentId,
    chunk.title,
    chunk.source,
    chunk.content,
    metadataText,
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(keyword.toLowerCase());
}