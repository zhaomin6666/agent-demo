import type { RetrievedDoc } from "./simple-retriever.js";

export function buildRagContext(docs: RetrievedDoc[]): string {
  if (docs.length === 0) {
    return "当前知识库中没有检索到相关资料。";
  }

  return docs
    .map((doc, index) => {
      return [
        `资料 ${index + 1}`,
        `标题：${doc.title}`,
        `来源：${doc.source}`,
        `匹配关键词：${doc.matchedKeywords.join(", ") || "无"}`,
        `内容：${doc.content}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}