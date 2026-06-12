# 第 20 课：混合检索，把关键词检索和向量检索结合起来

## 前言

第 19 课我们完成了 Agent 和 RAG 的第一次整合。

流程已经从独立 RAG：

```text
用户问题
  ↓
RagQaChain
  ↓
知识库答案
```

升级成了 Agentic RAG：

```text
用户问题
  ↓
Agent 判断是否需要工具
  ↓
调用 search_knowledge_base
  ↓
RAG Tool 内部执行 RagQaChain
  ↓
Agent 输出最终回答
```

也就是说，第 19 课解决的是：

```text
如何让 Agent 把 RAG 当成工具来使用？
```

但是到这里还有一个问题：

> 第 19 课的 RAG 主要依赖向量检索，而向量检索并不适合所有场景。

向量检索适合语义相似问题，比如：

```text
知识库召回不准应该怎么优化？
```

即使文档里写的是：

```text
RAG 检索效果不好怎么办？
```

向量检索也有机会找到相关内容。

但是有些问题更依赖精确匹配，比如：

```text
PDF 支持吗？
agent-tool-policy.md 里写了什么？
create_ticket 工具有权限限制吗？
错误码 E1001 怎么处理？
```

这些内容中，文件名、工具名、错误码、专有名词非常重要。

所以第 20 课要做的是：

> 把关键词检索和向量检索结合起来，形成一个最小版 Hybrid Retrieval。

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解为什么需要混合检索
2. 新增 KeywordRetriever
3. 复用第 17 课的 MemoryVectorStore
4. 新增 HybridRetriever
5. 合并关键词检索和向量检索结果
6. 对重复 chunk 做去重
7. 做简单分数融合
8. 让第 19 课的 RAG Tool 使用 HybridRetriever
```

第 19 课解决的是：

```text
如何让 Agent 把 RAG 当成工具来使用？
```

第 20 课解决的是：

```text
如何让 RAG 检索结果更稳定、更全面？
```

这一课的核心是：

> 用向量检索补语义，用关键词检索补精确匹配，再把两路结果融合起来。

---

## 二、为什么需要混合检索？

向量检索擅长语义相似。

比如用户问：

```text
知识库召回不准应该怎么优化？
```

文档里写的是：

```text
RAG 检索效果不好怎么办？
```

这两个表达字面不完全一样，但语义接近。

所以向量检索更容易发挥作用。

但是在企业知识库里，有很多问题不是单纯语义相似，而是需要精确命中。

比如：

```text
PDF 支持吗？
Word 能不能接入？
agent-tool-policy.md 里写了什么？
create_ticket 工具怎么控制权限？
错误码 E1001 怎么处理？
```

这些问题里，关键词非常关键。

如果用户明确提到了：

```text
PDF
Word
agent-tool-policy.md
create_ticket
E1001
```

那系统最好能直接识别这些词，而不是只靠向量语义相似。

所以真实 RAG 中常见的做法是：

```text
关键词检索 + 向量检索 + 结果融合
```

这就是混合检索。

---

## 三、关键词检索和向量检索的区别

可以先简单对比一下。

### 关键词检索

关键词检索关注的是：

```text
字面是否命中
```

适合：

```text
文件名
接口名
工具名
错误码
订单号
系统名称
专业术语
```

优点是：

```text
精确、稳定、容易解释
```

缺点是：

```text
不理解语义，同义表达可能搜不到
```

---

### 向量检索

向量检索关注的是：

```text
语义是否接近
```

适合：

```text
用户换一种说法
同义表达
模糊问题
自然语言问题
```

优点是：

```text
能处理语义相似
```

缺点是：

```text
对精确词、文件名、编号类信息不一定稳定
```

所以两者不是谁替代谁，而是互补关系。

---

## 四、本节整体流程

第 20 课的整体流程是：

```text
用户问题
  ↓
关键词检索 KeywordRetriever
  ↓
向量检索 MemoryVectorStore
  ↓
HybridRetriever 合并结果
  ↓
按 chunkId 去重
  ↓
分数融合
  ↓
返回 topK chunk
  ↓
RagQaChain 构造 context
  ↓
Chat Model 生成答案
  ↓
Agent 输出最终回答
```

第 19 课中：

```text
RagQaChain → MemoryVectorStore
```

第 20 课中：

```text
RagQaChain → HybridRetriever
```

也就是说，RAG QA Chain 的上层逻辑不变，但底层检索能力增强了。

---

## 五、本节目录结构

第 20 课直接基于第 19 课复制：

```bash
cp -r src/lessons/lesson19-rag-as-agent-tool src/lessons/lesson20-hybrid-retrieval
```

Windows PowerShell：

```powershell
Copy-Item -Recurse src/lessons/lesson19-rag-as-agent-tool src/lessons/lesson20-hybrid-retrieval
```

新增 `retrieval` 目录：

```bash
mkdir -p src/lessons/lesson20-hybrid-retrieval/retrieval
```

最终目录结构：

```text
src/lessons/lesson20-hybrid-retrieval/
  documents/
  loader/
  embedding/
  vector-store/

  retrieval/
    retrieval-types.ts
    keyword-retriever.ts
    hybrid-retriever.ts

  rag/
    rag-context-builder.ts
    rag-qa-chain.ts

  tools/
  executor/
  model/
  memory/
  approval/
  security/
  graph/

  rag-runtime.ts
  index.ts
```

这些文件从第 19 课复制即可，本节不需要修改：

```text
documents/*
loader/*
embedding/*
vector-store/cosine-similarity.ts
vector-store/memory-vector-store.ts
tools/*
executor/*
model/*
memory/*
approval/*
security/*
graph/*
```

本节重点新增或修改：

```text
retrieval/retrieval-types.ts
retrieval/keyword-retriever.ts
retrieval/hybrid-retriever.ts
rag/rag-context-builder.ts
rag/rag-qa-chain.ts
rag-runtime.ts
index.ts
package.json
```

---

## 六、配置 package.json

在 `package.json` 中新增第 20 课脚本：

```json
{
  "scripts": {
    "lesson:20": "tsx src/lessons/lesson20-hybrid-retrieval/index.ts"
  }
}
```

运行第 20 课：

```bash
pnpm lesson:20
```

---

## 七、新增 retrieval-types.ts

文件路径：

```text
src/lessons/lesson20-hybrid-retrieval/retrieval/retrieval-types.ts
```

代码如下：

```ts
import type { ChunkEmbedding } from "../embedding/chunk-embedding.js";

export type RetrievalSource = "vector" | "keyword";

export type RetrievalSearchOptions = {
  topK: number;
  minScore?: number;
};

export type RetrievalSearchResult = {
  chunkEmbedding: ChunkEmbedding;
  score: number;
  vectorScore?: number;
  keywordScore?: number;
  retrievalSources: RetrievalSource[];
  matchedKeywords?: string[];
};

export type RetrievalEngine = {
  similaritySearch(
    query: string,
    options: RetrievalSearchOptions,
  ): Promise<RetrievalSearchResult[]>;
};
```

---

## 八、理解 retrieval-types.ts

第 17 课的检索结果比较简单：

```text
chunkEmbedding
score
```

第 20 课要同时支持关键词检索和向量检索，所以检索结果需要包含更多信息。

```ts
export type RetrievalSearchResult = {
  chunkEmbedding: ChunkEmbedding;
  score: number;
  vectorScore?: number;
  keywordScore?: number;
  retrievalSources: RetrievalSource[];
  matchedKeywords?: string[];
};
```

字段含义：

```text
chunkEmbedding：被检索到的 chunk 及其向量
score：融合后的最终分数
vectorScore：向量检索分数
keywordScore：关键词检索分数
retrievalSources：结果来自 vector、keyword，还是两者都有
matchedKeywords：关键词检索命中的词
```

这样后续调试时可以看出：

```text
这个 chunk 是因为语义相似被召回的？
还是因为关键词命中被召回的？
还是两种检索都命中了？
```

---

## 九、为什么要抽象 RetrievalEngine？

这里定义了：

```ts
export type RetrievalEngine = {
  similaritySearch(
    query: string,
    options: RetrievalSearchOptions,
  ): Promise<RetrievalSearchResult[]>;
};
```

这相当于定义了一个检索接口。

只要某个对象实现了：

```text
similaritySearch(query, options)
```

它就可以被 `RagQaChain` 使用。

这样后续可以接入不同检索实现：

```text
MemoryVectorStore
KeywordRetriever
HybridRetriever
真实向量数据库
Elasticsearch / OpenSearch
带 rerank 的检索器
```

`RagQaChain` 不需要关心底层到底怎么检索，只需要关心：

```text
你能不能根据 query 返回检索结果？
```

这就是面向接口编程。

---

## 十、新增 keyword-retriever.ts

文件路径：

```text
src/lessons/lesson20-hybrid-retrieval/retrieval/keyword-retriever.ts
```

代码如下：

```ts
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
```

---

## 十一、理解 KeywordRetriever

`KeywordRetriever` 的职责是：

```text
根据用户问题中的关键词，从 chunk 中找出字面命中的内容。
```

它和向量检索不同。

向量检索关注：

```text
语义是否接近
```

关键词检索关注：

```text
字面是否命中
```

例如用户问：

```text
PDF 支持吗？
```

关键词检索会关注：

```text
PDF
```

只要文档标题、正文、来源、metadata 中出现了 `PDF`，就可以命中。

---

## 十二、为什么要有 KNOWN_TERMS？

中文不像英文天然用空格分词。

比如：

```text
知识库召回不准应该怎么优化？
```

如果只用空格切分，这句话可能很难拆出有效关键词。

所以本节定义了一个简单的业务词典：

```ts
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
```

这不是最终方案，只是为了学习混合检索做的简化处理。

真实项目中可以换成：

```text
中文分词器
业务词典
关键词抽取模型
BM25
Elasticsearch / OpenSearch
```

---

## 十三、关键词分数怎么算？

本节使用一个很简单的分数：

```ts
const keywordScore = matchedKeywords.length / keywords.length;
```

意思是：

```text
命中的关键词数量 / 查询关键词总数
```

例如用户问题提取出 4 个关键词：

```text
知识库
PDF
Word
资料
```

某个 chunk 命中了 3 个：

```text
PDF
Word
资料
```

那么分数就是：

```text
3 / 4 = 0.75
```

这不是最严谨的关键词检索算法，但足够帮助我们理解混合检索的流程。

---

## 十四、新增 hybrid-retriever.ts

文件路径：

```text
src/lessons/lesson20-hybrid-retrieval/retrieval/hybrid-retriever.ts
```

代码如下：

```ts
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

        return {
          ...result,
          score:
            vectorScore * this.options.vectorWeight +
            keywordScore * this.options.keywordWeight,
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
```

---

## 十五、理解 HybridRetriever

`HybridRetriever` 是本节最核心的类。

它做了五件事：

```text
1. 调用向量检索
2. 调用关键词检索
3. 合并两路结果
4. 对相同 chunk 去重
5. 用加权方式计算最终分数
```

核心逻辑是：

```ts
const [vectorResults, keywordResults] = await Promise.all([
  this.options.vectorStore.similaritySearch(query, {
    topK: candidateTopK,
  }),
  this.options.keywordRetriever.similaritySearch(query, {
    topK: candidateTopK,
  }),
]);
```

这里两路检索是并行执行的。

然后用 `Map` 按 `chunkId` 去重：

```ts
const resultMap = new Map<string, RetrievalSearchResult>();
```

最后进行分数融合：

```ts
score =
  vectorScore * this.options.vectorWeight +
  keywordScore * this.options.keywordWeight
```

---

## 十六、为什么要 candidateKMultiplier？

代码中有：

```ts
const candidateTopK =
  searchOptions.topK * (this.options.candidateKMultiplier ?? 3);
```

假设最终要返回：

```text
topK = 3
```

如果向量检索只取 3 条，关键词检索也只取 3 条，候选范围可能太小。

所以这里先扩大候选数量：

```text
candidateTopK = topK * 3
```

也就是先从两路检索中各取更多候选，再合并、去重、排序，最后再取最终 topK。

这样可以减少好结果在初筛阶段被漏掉的概率。

---

## 十七、为什么要分数融合？

向量检索和关键词检索的分数来源不同。

向量检索分数表示：

```text
语义相似度
```

关键词检索分数表示：

```text
关键词命中比例
```

所以需要融合成一个最终分数。

本节使用最简单的加权方式：

```text
最终分数 = 向量分数 * 向量权重 + 关键词分数 * 关键词权重
```

比如配置是：

```ts
vectorWeight: 0.7,
keywordWeight: 0.3,
```

表示：

```text
整体更相信向量检索
但关键词命中也会给结果加分
```

如果业务更依赖精确词，比如错误码、接口名、文件名，可以提高关键词权重。

---

## 十八、修改 rag-context-builder.ts

文件路径：

```text
src/lessons/lesson20-hybrid-retrieval/rag/rag-context-builder.ts
```

把它改成支持混合检索结果。

代码如下：

```ts
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
```

---

## 十九、为什么 context 里要显示检索来源？

第 18、19 课的 context 里主要有：

```text
标题
来源
相似度分数
内容
```

第 20 课加入了：

```text
检索来源
综合分数
向量分数
关键词分数
命中关键词
```

这是为了方便观察混合检索效果。

你可以看到每条资料是：

```text
只被向量检索召回
只被关键词检索召回
同时被两路检索召回
```

如果某个结果不相关，也能更容易判断原因。

例如：

```text
是向量检索召回错了？
是关键词太宽导致误命中了？
是融合权重不合理？
是 minScore 太低？
```

这些信息对调试 RAG 很重要。

---

## 二十、修改 rag-qa-chain.ts

文件路径：

```text
src/lessons/lesson20-hybrid-retrieval/rag/rag-qa-chain.ts
```

第 19 课的 `RagQaChain` 依赖的是 `MemoryVectorStore`。

第 20 课要改成依赖更抽象的 `RetrievalEngine`。

代码如下：

```ts
import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import { buildRagContext } from "./rag-context-builder.js";
import type {
  RetrievalEngine,
  RetrievalSearchResult,
} from "../retrieval/retrieval-types.js";

export type RagQaChainOptions = {
  topK: number;
  minScore: number;
};

export type RagQaAnswer = {
  question: string;
  answer: string;
  context: string;
  searchResults: {
    chunkId: string;
    title: string;
    source: string;
    score: number;
    vectorScore?: number;
    keywordScore?: number;
    retrievalSources: string[];
    matchedKeywords: string[];
    contentPreview: string;
  }[];
};

export type RagChatModel = {
  invoke(messages: BaseMessage[]): Promise<{
    content: unknown;
  }>;
};

export class RagQaChain {
  constructor(
    private readonly model: RagChatModel,
    private readonly retriever: RetrievalEngine,
    private readonly options: RagQaChainOptions,
  ) {}

  async invoke(question: string): Promise<RagQaAnswer> {
    const searchResults = await this.retriever.similaritySearch(question, {
      topK: this.options.topK,
      minScore: this.options.minScore,
    });

    if (searchResults.length === 0) {
      return this.createNoEvidenceAnswer(question);
    }

    const context = buildRagContext(searchResults);

    const response = await this.model.invoke([
      new SystemMessage(`
你是一个企业知识库问答助手。

回答规则：
1. 必须优先基于【资料上下文】回答。
2. 如果资料上下文中没有相关信息，请明确说“当前知识库中没有找到可靠依据”。
3. 不要编造企业内部制度、系统能力、接口说明。
4. 回答要简洁、清晰，适合企业内部用户阅读。
5. 回答最后请列出参考来源，格式为“参考来源：xxx”。
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
      searchResults: this.toSearchResultSummaries(searchResults),
    };
  }

  private createNoEvidenceAnswer(question: string): RagQaAnswer {
    return {
      question,
      answer:
        "当前知识库中没有找到可靠依据，无法基于已有资料回答这个问题。建议补充相关文档后再查询。",
      context: "",
      searchResults: [],
    };
  }

  private toSearchResultSummaries(results: RetrievalSearchResult[]) {
    return results.map((result) => {
      const { chunkEmbedding, score } = result;
      const { chunk } = chunkEmbedding;

      return {
        chunkId: chunk.id,
        title: chunk.title,
        source: chunk.source,
        score,
        vectorScore: result.vectorScore,
        keywordScore: result.keywordScore,
        retrievalSources: result.retrievalSources,
        matchedKeywords: result.matchedKeywords ?? [],
        contentPreview: chunk.content.slice(0, 120),
      };
    });
  }
}
```

---

## 二十一、为什么 RagQaChain 要依赖 RetrievalEngine？

第 19 课中：

```text
RagQaChain 直接依赖 MemoryVectorStore
```

这样会有一个问题：

```text
如果以后换成 HybridRetriever，需要改 RagQaChain
如果以后换成真实向量数据库，也需要改 RagQaChain
如果以后加 rerank，也还要改 RagQaChain
```

第 20 课改成：

```ts
private readonly retriever: RetrievalEngine
```

这样 `RagQaChain` 只关心：

```text
你能不能根据 query 返回检索结果？
```

至于底层是：

```text
向量检索
关键词检索
混合检索
真实向量数据库
带 rerank 的检索器
```

它都不需要知道。

这就是面向接口编程。

---

## 二十二、修改 rag-runtime.ts

文件路径：

```text
src/lessons/lesson20-hybrid-retrieval/rag-runtime.ts
```

把第 19 课中的单一路向量检索改成混合检索。

代码如下：

```ts
import path from "node:path";

import type { RagChatModel } from "./rag/rag-qa-chain.js";
import { createEmbeddingModel } from "./embedding/create-embedding-model.js";
import { embedChunks } from "./embedding/chunk-embedding.js";
import { loadMarkdownDocuments } from "./loader/markdown-loader.js";
import { splitDocumentsIntoChunks } from "./loader/text-splitter.js";
import { RagQaChain } from "./rag/rag-qa-chain.js";
import { HybridRetriever } from "./retrieval/hybrid-retriever.js";
import { KeywordRetriever } from "./retrieval/keyword-retriever.js";
import { MemoryVectorStore } from "./vector-store/memory-vector-store.js";

export type RagRuntime = {
  ragQaChain: RagQaChain;
  documentCount: number;
  chunkCount: number;
  embeddingCount: number;
  retrievalMode: "hybrid";
};

export async function createRagRuntime(params: {
  model: RagChatModel;
}): Promise<RagRuntime> {
  const docsDir = path.resolve(
    process.cwd(),
    "src/lessons/lesson20-hybrid-retrieval/documents",
  );

  const documents = await loadMarkdownDocuments({
    docsDir,
  });

  const chunks = splitDocumentsIntoChunks(documents, {
    maxChunkChars: 220,
    overlapChars: 40,
  });

  const embeddings = createEmbeddingModel();

  const chunkEmbeddings = await embedChunks({
    chunks,
    embeddings,
  });

  const vectorStore = new MemoryVectorStore(embeddings, chunkEmbeddings);

  const keywordRetriever = new KeywordRetriever(chunkEmbeddings);

  const hybridRetriever = new HybridRetriever({
    vectorStore,
    keywordRetriever,
    vectorWeight: 0.7,
    keywordWeight: 0.3,
    candidateKMultiplier: 3,
  });

  const ragQaChain = new RagQaChain(params.model, hybridRetriever, {
    topK: 3,
    minScore: 0.3,
  });

  return {
    ragQaChain,
    documentCount: documents.length,
    chunkCount: chunks.length,
    embeddingCount: chunkEmbeddings.length,
    retrievalMode: "hybrid",
  };
}
```

---

## 二十三、理解 rag-runtime.ts 的变化

第 19 课中：

```ts
const vectorStore = new MemoryVectorStore(embeddings, chunkEmbeddings);

const ragQaChain = new RagQaChain(params.model, vectorStore, {
  topK: 3,
  minScore: 0.3,
});
```

第 20 课中：

```ts
const vectorStore = new MemoryVectorStore(embeddings, chunkEmbeddings);

const keywordRetriever = new KeywordRetriever(chunkEmbeddings);

const hybridRetriever = new HybridRetriever({
  vectorStore,
  keywordRetriever,
  vectorWeight: 0.7,
  keywordWeight: 0.3,
  candidateKMultiplier: 3,
});

const ragQaChain = new RagQaChain(params.model, hybridRetriever, {
  topK: 3,
  minScore: 0.3,
});
```

变化很明显：

```text
原来 RagQaChain 直接使用向量检索
现在 RagQaChain 使用混合检索
```

但是 `RagQaChain` 的调用方式没有变：

```ts
ragQaChain.invoke(question)
```

这说明前面抽象 `RetrievalEngine` 是有价值的。

---

## 二十四、修改 index.ts

文件路径：

```text
src/lessons/lesson20-hybrid-retrieval/index.ts
```

这个文件大部分可以沿用第 19 课，只需要改路径、日志和测试问题。

代码如下：

```ts
import { Command, MemorySaver } from "@langchain/langgraph";

import {
  createAgentGraph,
  type ToolCallingModel,
} from "./graph/create-agent-graph.js";
import { ToolExecutor } from "./executor/tool-executor.js";
import {
  createConversationInput,
  hasConversationHistory,
} from "./memory/conversation-input.js";
import { createModel } from "./model/create-model.js";
import { createRagRuntime } from "./rag-runtime.js";
import { createTools } from "./tools/index.js";
import type {
  HumanApprovalResult,
  UserContext,
} from "./graph/agent-state.js";

const systemPrompt = `
你是一个企业 AI 知识库 / Agent Demo 助手。

规则：
1. 如果用户问的是企业知识库、RAG、文档接入、检索优化、Agent 工具规范、权限控制、人工确认等内部资料问题，优先调用 search_knowledge_base。
2. 如果用户要求创建工单、反馈问题、提交故障，调用 create_ticket。
3. 如果用户同时要求“先查询知识库，再创建工单”，必须先调用 search_knowledge_base，拿到结果后再决定是否调用 create_ticket。
4. 工具结果足够回答用户时，请停止调用工具，直接输出最终答案。
5. 不要重复使用相同参数调用同一个工具。
6. 不要编造内部系统信息，能查工具就查工具。
7. 如果工具执行失败，请基于工具错误信息给用户一个友好的解释。
8. create_ticket 属于需要人工确认的操作型工具，确认通过后才能执行。
9. 如果用户没有工具权限，请不要尝试绕过权限限制。
10. search_knowledge_base 的工具结果中如果 status 是 no_evidence，请明确说明当前知识库没有找到可靠依据。
`;

type ThreadConfig = {
  configurable: {
    thread_id: string;
  };
};

type AgentGraph = ReturnType<typeof createAgentGraph>;

type InterruptPayload = {
  value?: unknown;
};

const viewerUser: UserContext = {
  userId: "user-viewer-001",
  username: "viewer-user",
  roles: ["viewer"],
  department: "业务部门",
};

const supportUser: UserContext = {
  userId: "user-support-001",
  username: "support-user",
  roles: ["support"],
  department: "客服部门",
};

function createThreadConfig(threadId: string): ThreadConfig {
  return {
    configurable: {
      thread_id: threadId,
    },
  };
}

function getInterruptPayloads(result: unknown): unknown[] {
  const interrupts = (result as { __interrupt__?: InterruptPayload[] })
    .__interrupt__;

  if (!Array.isArray(interrupts)) {
    return [];
  }

  return interrupts.map((item) => item.value ?? item);
}

async function runConversationTurn(params: {
  graph: AgentGraph;
  threadId: string;
  userInput: string;
  userContext: UserContext;
  approval?: HumanApprovalResult;
}) {
  const config = createThreadConfig(params.threadId);

  const latestStateBeforeInvoke = await params.graph.getState(config);

  const hasHistory = hasConversationHistory(latestStateBeforeInvoke.values);

  const input = createConversationInput({
    userInput: params.userInput,
    systemPrompt,
    hasHistory,
    userContext: params.userContext,
  });

  console.log("\n\n========================================");
  console.log("thread_id：", params.threadId);
  console.log("当前用户：", params.userContext.username);
  console.log("用户角色：", params.userContext.roles.join(", "));
  console.log("是否已有历史：", hasHistory);
  console.log("用户输入：", params.userInput);

  const firstResult = await params.graph.invoke(input, config);

  const interruptPayloads = getInterruptPayloads(firstResult);

  if (interruptPayloads.length > 0) {
    console.log("\n========== 触发人工确认 ==========");
    console.log(JSON.stringify(interruptPayloads, null, 2));

    if (!params.approval) {
      console.log("\n当前流程已暂停，等待人工确认。");
      return;
    }

    console.log("\n========== 模拟人工确认结果 ==========");
    console.log(JSON.stringify(params.approval, null, 2));

    const resumedResult = await params.graph.invoke(
      new Command({
        resume: params.approval,
      }),
      config,
    );

    printFinalResult(resumedResult);
    return;
  }

  printFinalResult(firstResult);
}

function printFinalResult(result: Awaited<ReturnType<AgentGraph["invoke"]>>) {
  const finalMessage = result.messages.at(-1);

  console.log("\n========== Agent + Hybrid RAG Tool 最终结果 ==========");
  console.log("当前节点：", result.currentNode);
  console.log("停止原因：", result.stopReason);
  console.log("本轮循环轮次：", result.loopCount);

  console.log("\n最终回答：");
  console.log(finalMessage?.content);

  console.log("\n权限判断结果：");
  console.log(JSON.stringify(result.permissionDecision, null, 2));

  console.log("\n人工确认结果：");
  console.log(JSON.stringify(result.humanApprovalResult, null, 2));

  console.log("\n最后一次工具结果：");
  console.log(JSON.stringify(result.lastToolResult, null, 2));

  console.log("\nCheckpoint 中累计 messages 数量：", result.messages.length);
  console.log("累计 traceSteps 数量：", result.traceSteps.length);
  console.log("累计工具执行记录数量：", result.toolExecutionRecords.length);
}

async function main() {
  const model = createModel();

  const ragRuntime = await createRagRuntime({
    model,
  });

  console.log("\n========== Hybrid RAG Runtime 初始化完成 ==========");
  console.log("检索模式：", ragRuntime.retrievalMode);
  console.log("文档数量：", ragRuntime.documentCount);
  console.log("Chunk 数量：", ragRuntime.chunkCount);
  console.log("Embedding 数量：", ragRuntime.embeddingCount);

  const tools = createTools({
    ragQaChain: ragRuntime.ragQaChain,
  });

  const modelWithTools = model.bindTools(tools) as ToolCallingModel;

  const toolExecutor = new ToolExecutor(tools);

  const checkpointer = new MemorySaver();

  const graph = createAgentGraph(modelWithTools, toolExecutor, {
    maxIterations: 6,
    checkpointer,
    memory: {
      maxRecentMessages: 10,
    },
  });

  await runConversationTurn({
    graph,
    threadId: "lesson20-viewer-datasource",
    userContext: viewerUser,
    userInput: "知识库可以接入 PDF、Word 这类资料吗？",
  });

  await runConversationTurn({
    graph,
    threadId: "lesson20-viewer-retrieval",
    userContext: viewerUser,
    userInput: "知识库召回不准应该怎么优化？",
  });

  await runConversationTurn({
    graph,
    threadId: "lesson20-viewer-tool-policy",
    userContext: viewerUser,
    userInput: "agent-tool-policy.md 里关于工具调用安全是怎么说的？",
  });

  await runConversationTurn({
    graph,
    threadId: "lesson20-support-query-then-ticket",
    userContext: supportUser,
    userInput:
      "先查知识库了解 RAG 检索优化建议，然后创建一个中优先级工单跟进。",
    approval: {
      approved: true,
      comment: "客服确认基于混合检索结果创建工单。",
      reviewer: "support-user",
      reviewedAt: new Date().toISOString(),
    },
  });
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 二十五、运行第 20 课

执行：

```bash
pnpm lesson:20
```

你会先看到：

```text
========== Hybrid RAG Runtime 初始化完成 ==========
检索模式： hybrid
文档数量： 3
Chunk 数量： 若干
Embedding 数量： 若干
```

然后会测试 4 个场景：

```text
1. 查询 PDF、Word 资料接入
2. 查询知识库召回优化
3. 查询 agent-tool-policy.md 文件内容
4. 先查知识库再创建工单
```

---

## 二十六、场景 1：查询 PDF、Word 资料接入

输入：

```text
知识库可以接入 PDF、Word 这类资料吗？
```

这个问题中有明显关键词：

```text
PDF
Word
资料
知识库
```

预期会命中：

```text
企业知识库支持的数据源
```

因为文档中写了：

```text
企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源。
```

这个场景中，关键词检索会对 `PDF`、`Word` 这类精确词起到帮助作用。

---

## 二十七、场景 2：查询召回优化

输入：

```text
知识库召回不准应该怎么优化？
```

这个问题和文档标题：

```text
RAG 检索效果不好怎么办
```

语义接近，但字面不完全一样。

向量检索会比较有用。

同时关键词检索也可能命中：

```text
知识库
召回
优化
检索
```

所以这个场景可以体现混合检索的价值：

```text
向量检索负责语义相似
关键词检索负责字面增强
```

---

## 二十八、场景 3：查询文件名 agent-tool-policy.md

输入：

```text
agent-tool-policy.md 里关于工具调用安全是怎么说的？
```

这个问题包含精确文件名：

```text
agent-tool-policy.md
```

这种场景关键词检索更有优势。

因为向量检索不一定稳定识别文件名，但关键词检索可以直接命中 `source`。

预期命中：

```text
Agent 工具调用规范
```

这个场景验证的是：

```text
混合检索可以提升文件名、工具名、专有名词这类精确匹配场景的稳定性。
```

---

## 二十九、场景 4：先查知识库再创建工单

输入：

```text
先查知识库了解 RAG 检索优化建议，然后创建一个中优先级工单跟进。
```

预期流程：

```text
Agent 先调用 search_knowledge_base
  ↓
RAG Tool 内部使用 HybridRetriever
  ↓
返回检索优化建议
  ↓
Agent 再调用 create_ticket
  ↓
support 有权限
  ↓
触发人工确认
  ↓
确认通过后创建工单
```

这个场景验证的是：

```text
混合检索没有破坏 Agent + Tool + 权限 + 人工确认流程。
```

也就是说，我们增强的是 RAG Tool 内部的检索能力，Agent 外层流程仍然保持稳定。

---

## 三十、第 20 课和第 19 课的区别

第 19 课：

```text
Agent + RAG Tool
RAG Tool 内部主要用向量检索
```

第 20 课：

```text
Agent + RAG Tool
RAG Tool 内部使用混合检索
```

第 19 课解决：

```text
RAG 如何作为 Agent Tool 使用？
```

第 20 课解决：

```text
RAG Tool 如何检索得更稳定？
```

可以简单理解为：

```text
第 19 课：把 RAG 接入 Agent
第 20 课：增强 RAG 的检索能力
```

---

## 三十一、Java 后端视角理解

可以把第 20 课理解成搜索服务升级。

第 19 课类似：

```java
List<SearchResult> results = vectorStore.similaritySearch(query);
```

第 20 课变成：

```java
List<SearchResult> vectorResults = vectorStore.similaritySearch(query);
List<SearchResult> keywordResults = keywordSearch.search(query);

List<SearchResult> merged = hybridRetriever.merge(vectorResults, keywordResults);
```

也就是：

```text
单一路检索 → 多路检索 → 结果融合
```

如果用 Java 类比：

```java
public class HybridRetriever {

    private final VectorRetriever vectorRetriever;
    private final KeywordRetriever keywordRetriever;

    public List<SearchResult> search(String query, int topK) {
        List<SearchResult> vectorResults = vectorRetriever.search(query);
        List<SearchResult> keywordResults = keywordRetriever.search(query);

        return mergeAndRank(vectorResults, keywordResults, topK);
    }
}
```

对应本节 TypeScript：

```text
VectorRetriever → MemoryVectorStore
KeywordRetriever → KeywordRetriever
HybridRetriever → HybridRetriever
RagQaChain → 依赖 RetrievalEngine
```

---

## 三十二、企业级 RAG 中混合检索的价值

真实企业知识库中，混合检索非常常见。

原因是企业文档中既有自然语言，也有大量精确实体。

例如：

```text
接口名
表名
字段名
系统编码
错误码
文件名
工单编号
用户角色
权限码
```

这些内容如果只靠向量检索，可能不够稳定。

但如果只靠关键词检索，又会漏掉很多语义相似问题。

所以混合检索的价值是：

```text
1. 向量检索负责语义召回
2. 关键词检索负责精确召回
3. 两路结果互相补充
4. 融合排序后得到更稳的候选结果
```

后续如果再加上 rerank，就会更接近真实生产级 RAG 检索链路。

---

## 三十三、TypeScript Tips

### 1. 联合字面量类型

```ts
export type RetrievalSource = "vector" | "keyword";
```

表示 `RetrievalSource` 只能是：

```text
vector
keyword
```

不能随便写其他字符串。

这样可以减少拼写错误。

---

### 2. Promise.all 并行执行

```ts
const [vectorResults, keywordResults] = await Promise.all([
  this.options.vectorStore.similaritySearch(query, {
    topK: candidateTopK,
  }),
  this.options.keywordRetriever.similaritySearch(query, {
    topK: candidateTopK,
  }),
]);
```

这里向量检索和关键词检索可以并行执行。

这样比先执行向量检索、再执行关键词检索更合理。

---

### 3. Map 去重

```ts
const resultMap = new Map<string, RetrievalSearchResult>();
```

这里用 `chunkId` 作为 key。

如果同一个 chunk 同时被向量检索和关键词检索命中，就合并成一条结果。

---

### 4. 可选字段

```ts
vectorScore?: number;
keywordScore?: number;
matchedKeywords?: string[];
```

这些字段不是每条结果都有。

比如只来自向量检索的结果，可能没有 `matchedKeywords`。

所以后面使用时要写默认值：

```ts
(result.vectorScore ?? 0).toFixed(4)
```

---

### 5. 面向接口编程

```ts
export type RetrievalEngine = {
  similaritySearch(
    query: string,
    options: RetrievalSearchOptions,
  ): Promise<RetrievalSearchResult[]>;
};
```

`RagQaChain` 只依赖 `RetrievalEngine`，不关心具体实现。

这让后续替换检索器更方便。

---

### 6. as const

```ts
retrievalSources: ["keyword" as const]
```

这里的 `as const` 用来告诉 TypeScript：

```text
这是字面量 "keyword"
不是普通 string
```

否则 TypeScript 可能会把它推断成 `string`，和 `RetrievalSource` 类型不完全匹配。

---

## 三十四、本节总结

第 20 课完成了最小版混合检索。

核心收获：

```text
1. 向量检索适合语义相似
2. 关键词检索适合精确词、文件名、错误码、专有名词
3. HybridRetriever 可以合并两路检索结果
4. Map 可以用于按 chunkId 去重
5. 分数融合可以把 vectorScore 和 keywordScore 合成最终 score
6. RagQaChain 依赖 RetrievalEngine 后，可以灵活替换检索策略
7. context 中加入检索来源、分数和命中关键词，有助于调试
8. 第 20 课让 RAG Tool 的检索能力更接近真实企业场景
```

本节最重要的一句话：

> 混合检索的核心是：用向量检索补语义，用关键词检索补精确匹配，再把两路结果融合起来。

---

## 三十五、下一课预告

下一课进入：

# 第 21 课：Rerank 入门，对混合检索结果进行二次排序

第 20 课完成的是：

```text
关键词检索 + 向量检索 + 简单融合
```

但是融合后的结果不一定就是最终最佳顺序。

所以第 21 课会继续增强检索质量：

```text
1. 理解为什么 topK 初筛后还需要 rerank
2. 实现一个简单规则版 reranker
3. 根据问题和 chunk 内容做二次打分
4. 重新排序混合检索结果
5. 为后续真实 rerank 模型接入做准备
```

第 20 课解决的是：

```text
如何让 RAG 检索更稳定、更全面？
```

第 21 课要解决的是：

```text
初步召回结果出来后，如何把最有用的资料排到更前面？
```
