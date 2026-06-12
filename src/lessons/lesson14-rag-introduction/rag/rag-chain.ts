import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { buildRagContext } from "./context-builder.js";
import type { SimpleRetriever } from "./simple-retriever.js";

export type RagAnswer = {
  question: string;
  answer: string;
  context: string;
  retrievedDocs: {
    id: string;
    title: string;
    source: string;
    score: number;
    matchedKeywords: string[];
  }[];
};

export type RagModel = {
  invoke(messages: Array<SystemMessage | HumanMessage>): Promise<{
    content: unknown;
  }>;
};

export class RagChain {
  constructor(
    private readonly model: RagModel,
    private readonly retriever: SimpleRetriever,
  ) {}

  async invoke(question: string): Promise<RagAnswer> {
    const retrievedDocs = this.retriever.retrieve(question);

    const context = buildRagContext(retrievedDocs);

    const response = await this.model.invoke([
      new SystemMessage(`
你是一个企业知识库问答助手。

回答规则：
1. 必须优先基于【资料上下文】回答。
2. 如果资料上下文中没有相关信息，请明确说“当前知识库中没有找到可靠依据”。
3. 不要编造企业内部制度、系统能力、接口说明。
4. 回答要简洁、清晰，适合企业内部用户阅读。
5. 如果资料中包含来源，请在回答最后简单列出参考来源。
`),
      new HumanMessage(`
【用户问题】
${question}

【资料上下文】
${context}
`),
    ]);

    return {
      question,
      answer: String(response.content),
      context,
      retrievedDocs: retrievedDocs.map((doc) => ({
        id: doc.id,
        title: doc.title,
        source: doc.source,
        score: doc.score,
        matchedKeywords: doc.matchedKeywords,
      })),
    };
  }
}