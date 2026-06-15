export type EvaluationCase = {
  id: string;
  question: string;
  expectedSources: string[];
  shouldHaveEvidence: boolean;
  note: string;
};

export const evaluationDataset: EvaluationCase[] = [
  {
    id: "datasource-basic",
    question: "企业知识库支持哪些类型的数据源？",
    expectedSources: ["knowledge-base-guide.md"],
    shouldHaveEvidence: true,
    note: "基础数据源问题，应该命中知识库数据源文档。",
  },
  {
    id: "datasource-exact-keyword",
    question: "知识库支持 PDF、Word 和 Markdown 文档接入吗？",
    expectedSources: ["knowledge-base-guide.md"],
    shouldHaveEvidence: true,
    note: "包含 PDF、Word、Markdown 等精确关键词，应该命中数据源文档。",
  },
  {
    id: "rag-optimization-semantic",
    question: "知识库召回不准应该怎么优化？",
    expectedSources: ["rag-optimization.md"],
    shouldHaveEvidence: true,
    note: "表达和标题不完全一致，测试语义检索和混合检索能力。",
  },
  {
    id: "rag-optimization-direct",
    question: "RAG 检索效果不好怎么办？",
    expectedSources: ["rag-optimization.md"],
    shouldHaveEvidence: true,
    note: "和文档标题高度一致，应该稳定命中 RAG 优化文档。",
  },
  {
    id: "agent-tool-policy",
    question: "agent-tool-policy.md 里关于工具调用安全是怎么说的？",
    expectedSources: ["agent-tool-policy.md"],
    shouldHaveEvidence: true,
    note: "包含精确文件名，测试关键词检索和 rerank 对 source 的加权。",
  },
  {
    id: "ticket-security",
    question: "创建工单前需要做哪些权限控制和人工确认？",
    expectedSources: ["agent-tool-policy.md"],
    shouldHaveEvidence: true,
    note: "测试 Agent 工具安全规范相关问题。",
  },
  {
    id: "no-evidence-performance",
    question: "接口响应很慢应该怎么排查？",
    expectedSources: [],
    shouldHaveEvidence: false,
    note: "当前知识库没有接口性能排查资料，应该返回无可靠依据。",
  },
];