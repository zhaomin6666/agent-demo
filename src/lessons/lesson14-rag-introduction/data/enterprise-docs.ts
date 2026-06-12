export type EnterpriseDoc = {
  id: string;
  title: string;
  content: string;
  source: string;
  tags: string[];
};

export const enterpriseDocs: EnterpriseDoc[] = [
  {
    id: "doc-001",
    title: "企业知识库支持的数据源",
    content:
      "企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源。后续计划扩展数据库表、工单系统数据和接口文档。",
    source: "knowledge-base-guide.md",
    tags: ["knowledge_base", "datasource", "rag"],
  },
  {
    id: "doc-002",
    title: "RAG 检索效果不好怎么办",
    content:
      "如果 RAG 检索效果不好，可以从文档切分、Embedding 模型、召回数量、关键词补充、重排序、Prompt 约束等方面优化。",
    source: "rag-optimization.md",
    tags: ["knowledge_base", "rag", "retrieval"],
  },
  {
    id: "doc-003",
    title: "Agent 工具调用规范",
    content:
      "Agent 调用工具前应先判断用户意图。工具入参必须通过 schema 校验。工具执行失败时需要有兜底响应。操作型工具应结合权限控制和人工确认。",
    source: "agent-tool-policy.md",
    tags: ["agent", "tool_calling", "security"],
  },
  {
    id: "doc-004",
    title: "工单创建权限说明",
    content:
      "viewer 用户只能查询知识库，不能创建工单。support 和 admin 用户可以创建工单，但创建工单前仍然需要经过人工确认。",
    source: "ticket-permission.md",
    tags: ["permission", "ticket", "security"],
  },
  {
    id: "doc-005",
    title: "企业知识库回答规范",
    content:
      "知识库问答必须优先基于检索到的资料回答。如果资料中没有相关内容，应明确说明当前知识库中没有找到可靠依据，不能编造答案。",
    source: "answer-policy.md",
    tags: ["rag", "answer_policy"],
  },
];