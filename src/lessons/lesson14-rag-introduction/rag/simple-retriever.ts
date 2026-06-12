import type { EnterpriseDoc } from "../data/enterprise-docs.js";

export type RetrievedDoc = EnterpriseDoc & {
  score: number;
  matchedKeywords: string[];
};

export type SimpleRetrieverOptions = {
  topK: number;
};

export class SimpleRetriever {
  constructor(
    private readonly docs: EnterpriseDoc[],
    private readonly options: SimpleRetrieverOptions,
  ) {}

  retrieve(query: string): RetrievedDoc[] {
    const keywords = this.extractKeywords(query);

    const scoredDocs = this.docs
      .map((doc) => {
        const matchedKeywords = keywords.filter((keyword) =>
          this.isKeywordMatched(doc, keyword),
        );

        return {
          ...doc,
          score: matchedKeywords.length,
          matchedKeywords,
        };
      })
      .filter((doc) => doc.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, this.options.topK);

    return scoredDocs;
  }

  private extractKeywords(query: string): string[] {
    return query
      .toLowerCase()
      .split(/[\s,，。？?、]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private isKeywordMatched(doc: EnterpriseDoc, keyword: string): boolean {
    const searchableText = [
      doc.title,
      doc.content,
      doc.source,
      ...doc.tags,
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(keyword);
  }
}