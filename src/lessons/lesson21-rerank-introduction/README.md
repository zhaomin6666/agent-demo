# 第 21 课：Rerank 入门，对混合检索结果进行二次排序

## 前言

第 20 课我们完成了混合检索。

在第 20 课中，RAG Tool 的检索能力已经从单一路向量检索升级成了：

```text
关键词检索 KeywordRetriever
  +
向量检索 MemoryVectorStore
  ↓
HybridRetriever
```

也就是说，系统既可以处理语义相似问题，也可以兼顾文件名、工具名、错误码、专有名词这类精确匹配场景。

但是到这里还有一个问题：

> 混合检索能召回更多候选资料，但召回结果的排序不一定就是最优的。

比如用户问：

```text
agent-tool-policy.md 里关于工具调用安全是怎么说的？
```

系统可能会召回多个 chunk：

```text
1. Agent 工具调用规范
2. RAG 检索效果不好怎么办
3. 企业知识库支持的数据源
```

这些资料可能都有一点相关性，但明显第一个才是最重要的。

所以第 21 课要做的是：

> 在混合检索之后增加一层 Rerank，对候选结果进行二次排序。

这一课的核心不是“找更多资料”，而是：

> 把已经找出来的资料重新排好顺序。

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解为什么需要 rerank
2. 复用第 20 课的 HybridRetriever
3. 新增 SimpleRuleBasedReranker
4. 新增 RerankedRetriever
5. 扩大初筛候选数量
6. 根据标题、来源、正文、命中关键词做二次打分
7. 把 rerank 分数和原因写入 context
8. 让 RAG Tool 使用 rerank 后的检索结果
```

第 20 课解决的是：

```text
如何让 RAG 检索更稳定、更全面？
```

第 21 课解决的是：

```text
初步召回结果出来后，如何把最有用的资料排到更前面？
```

---

## 二、为什么需要 Rerank？

混合检索已经比单纯向量检索更稳定，但它仍然属于“初筛召回”。

初筛召回的目标是：

```text
尽量不要漏掉可能相关的资料。
```

但是初筛阶段不一定能保证排序完全准确。

例如用户问：

```text
RAG 检索效果不好应该怎么优化？
```

混合检索可能召回：

```text
RAG 检索效果不好怎么办
企业知识库支持的数据源
Agent 工具调用规范
```

这些资料中，第一条最相关。

但如果某些 chunk 的关键词命中比较多，或者向量分数偏高，就可能出现排序不够理想的问题。

所以真实 RAG 系统中常见两阶段流程：

```text
第一阶段：Retrieval / Recall
尽量多召回候选资料

第二阶段：Rerank
对候选资料重新排序，把最相关的排到前面
```

可以简单理解为：

```text
Retrieval 负责“找出来”
Rerank 负责“排好序”
```

---

## 三、Retrieval 和 Rerank 的区别

Retrieval 更关注：

```text
召回率
```

也就是不要漏掉相关资料。

Rerank 更关注：

```text
排序质量
```

也就是把最相关、最有用的资料放到前面。

真实 RAG 系统中，常见流程是：

```text
用户问题
  ↓
召回 top 20 / top 50
  ↓
rerank
  ↓
取 top 3 / top 5
  ↓
交给模型生成答案
```

如果没有 rerank，模型可能会拿到一些不太相关的上下文。

这会影响最终回答质量。

第 21 课先不接真实 rerank 模型，而是实现一个规则版 reranker，帮助我们理解工程流程。

---

## 四、本节整体流程

第 21 课的整体流程是：

```text
用户问题
  ↓
HybridRetriever 初筛召回更多候选
  ↓
SimpleRuleBasedReranker 二次打分
  ↓
RerankedRetriever 重新排序
  ↓
返回最终 topK
  ↓
RagQaChain 构造 context
  ↓
RAG Tool 返回答案
  ↓
Agent 输出最终回答
```

第 20 课是：

```text
RagQaChain → HybridRetriever
```

第 21 课改成：

```text
RagQaChain → RerankedRetriever → HybridRetriever
```

也就是说，`RagQaChain` 仍然不需要关心底层细节。

它只知道自己依赖的是一个 `RetrievalEngine`。

至于这个 `RetrievalEngine` 内部有没有 rerank，不影响上层调用。

---

## 五、本节目录结构

第 21 课直接基于第 20 课复制：

```bash
cp -r src/lessons/lesson20-hybrid-retrieval src/lessons/lesson21-rerank-introduction
```

Windows PowerShell：

```powershell
Copy-Item -Recurse src/lessons/lesson20-hybrid-retrieval src/lessons/lesson21-rerank-introduction
```

新增 `rerank` 目录：

```bash
mkdir -p src/lessons/lesson21-rerank-introduction/rerank
```

最终目录结构：

```text
src/lessons/lesson21-rerank-introduction/
  documents/
  loader/
  embedding/
  vector-store/

  retrieval/
    retrieval-types.ts
    keyword-retriever.ts
    hybrid-retriever.ts

  rerank/
    reranker-types.ts
    simple-rule-based-reranker.ts
    reranked-retriever.ts

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

这些文件从第 20 课复制即可，本节不用修改：

```text
documents/*
loader/*
embedding/*
vector-store/*
retrieval/keyword-retriever.ts
retrieval/hybrid-retriever.ts
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
rerank/reranker-types.ts
rerank/simple-rule-based-reranker.ts
rerank/reranked-retriever.ts
rag/rag-context-builder.ts
rag/rag-qa-chain.ts
tools/search-knowledge-base.tool.ts
rag-runtime.ts
index.ts
package.json
```

---

## 六、配置 package.json

在 `package.json` 中新增第 21 课脚本：

```json
{
  "scripts": {
    "lesson:21": "tsx src/lessons/lesson21-rerank-introduction/index.ts"
  }
}
```

运行第 21 课：

```bash
pnpm lesson:21
```

---

## 七、修改 retrieval-types.ts

文件路径：

```text
src/lessons/lesson21-rerank-introduction/retrieval/retrieval-types.ts
```

第 21 课要在检索结果中增加 rerank 信息。

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

  originalScore?: number;
  rerankScore?: number;
  rerankReasons?: string[];
};

export type RetrievalEngine = {
  similaritySearch(
    query: string,
    options: RetrievalSearchOptions,
  ): Promise<RetrievalSearchResult[]>;
};
```

---

## 八、理解新增字段

第 20 课中：

```text
score = 混合检索融合后的分数
```

第 21 课加入 rerank 后，我们需要区分两个阶段的分数。

所以新增：

```ts
originalScore?: number;
rerankScore?: number;
rerankReasons?: string[];
```

字段含义：

```text
originalScore：初筛阶段的混合检索分数
rerankScore：二次排序后的最终分数
rerankReasons：为什么这个结果被 rerank 到当前位置
```

这样做的好处是方便调试。

当某条结果被排到前面时，我们可以看到：

```text
它原来的分数是多少？
rerank 后的分数是多少？
它是因为标题命中被加分？
还是因为文件名命中被加分？
还是因为同时被向量检索和关键词检索召回？
```

RAG 系统想要持续优化，必须能看到这些中间过程。

---

## 九、新增 reranker-types.ts

文件路径：

```text
src/lessons/lesson21-rerank-introduction/rerank/reranker-types.ts
```

代码如下：

```ts
import type { RetrievalSearchResult } from "../retrieval/retrieval-types.js";

export type RerankInput = {
  query: string;
  results: RetrievalSearchResult[];
};

export type Reranker = {
  rerank(input: RerankInput): Promise<RetrievalSearchResult[]>;
};
```

---

## 十、理解 Reranker 接口

这个接口很简单：

```ts
export type Reranker = {
  rerank(input: RerankInput): Promise<RetrievalSearchResult[]>;
};
```

它表示：

```text
输入用户问题和初筛结果
输出重新排序后的结果
```

这样设计的好处是后续可以替换实现。

比如现在使用：

```text
SimpleRuleBasedReranker
```

以后可以换成：

```text
LLM Reranker
专门的 Rerank 模型
基于交叉编码器的 Reranker
业务规则 + 模型混合 Reranker
```

只要实现同一个 `Reranker` 接口，上层就不用大改。

这和 Java 后端里的接口设计是一样的思路。

---

## 十一、新增 simple-rule-based-reranker.ts

文件路径：

```text
src/lessons/lesson21-rerank-introduction/rerank/simple-rule-based-reranker.ts
```

代码如下：

```ts
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
```

---

## 十二、理解 SimpleRuleBasedReranker

`SimpleRuleBasedReranker` 是本节最核心的新增能力。

它会根据几个信号重新打分：

```text
1. 原始混合检索分数 originalScore
2. 查询词是否命中文档标题
3. 查询词是否命中文档来源或文件名
4. 查询词是否命中文档正文
5. 关键词检索命中的关键词数量
6. 是否同时被向量检索和关键词检索召回
```

核心公式是：

```ts
const rerankScore = clampScore(
  originalScore * 0.55 +
    titleScore * 0.18 +
    sourceScore * 0.12 +
    contentScore * 0.1 +
    matchedKeywordScore * 0.05 +
    multiSourceBoost,
);
```

可以理解为：

```text
保留原始混合检索分数作为主要依据
再根据标题、来源、正文、关键词命中情况进行调整
```

这里不是为了做一个非常完美的 reranker，而是为了把 rerank 的工程结构跑通。

---

## 十三、为什么标题和来源要加权？

如果用户问：

```text
agent-tool-policy.md 里关于工具调用安全是怎么说的？
```

那么命中文件名 `agent-tool-policy.md` 非常重要。

这时：

```text
sourceScore
```

就应该发挥作用。

如果用户问：

```text
RAG 检索效果不好应该怎么优化？
```

那么命中文档标题：

```text
RAG 检索效果不好怎么办
```

也非常重要。

这时：

```text
titleScore
```

就应该发挥作用。

所以 reranker 不只是看原始分数，还会额外关注：

```text
title
source
content
matchedKeywords
retrievalSources
```

这样排序更容易符合用户问题的真实意图。

---

## 十四、为什么要有 multiSourceBoost？

代码中有：

```ts
const multiSourceBoost =
  result.retrievalSources.length >= 2 ? 0.08 : 0;
```

意思是：

```text
如果同一个 chunk 同时被向量检索和关键词检索召回，就额外加一点分。
```

原因是：

```text
向量检索认为它语义相关
关键词检索也认为它字面相关
```

两路检索都命中，通常说明这个结果更值得信任。

所以这里给一个小的 boost。

这不是绝对正确的规则，但在学习阶段很容易理解。

---

## 十五、新增 reranked-retriever.ts

文件路径：

```text
src/lessons/lesson21-rerank-introduction/rerank/reranked-retriever.ts
```

代码如下：

```ts
import type {
  RetrievalEngine,
  RetrievalSearchOptions,
  RetrievalSearchResult,
} from "../retrieval/retrieval-types.js";
import type { Reranker } from "./reranker-types.js";

export type RerankedRetrieverOptions = {
  baseRetriever: RetrievalEngine;
  reranker: Reranker;
  candidateKMultiplier?: number;
};

export class RerankedRetriever implements RetrievalEngine {
  constructor(private readonly options: RerankedRetrieverOptions) {}

  async similaritySearch(
    query: string,
    searchOptions: RetrievalSearchOptions,
  ): Promise<RetrievalSearchResult[]> {
    const candidateTopK =
      searchOptions.topK * (this.options.candidateKMultiplier ?? 4);

    const candidates = await this.options.baseRetriever.similaritySearch(
      query,
      {
        topK: candidateTopK,
        minScore: searchOptions.minScore,
      },
    );

    if (candidates.length === 0) {
      return [];
    }

    const rerankedResults = await this.options.reranker.rerank({
      query,
      results: candidates,
    });

    return rerankedResults.slice(0, searchOptions.topK);
  }
}
```

---

## 十六、理解 RerankedRetriever

`RerankedRetriever` 是一个包装器。

它内部有两个对象：

```text
baseRetriever：负责初筛召回
reranker：负责二次排序
```

核心流程是：

```ts
const candidates = await this.options.baseRetriever.similaritySearch(
  query,
  {
    topK: candidateTopK,
    minScore: searchOptions.minScore,
  },
);

const rerankedResults = await this.options.reranker.rerank({
  query,
  results: candidates,
});

return rerankedResults.slice(0, searchOptions.topK);
```

也就是：

```text
先多找一些候选
再重新排序
最后只返回最终 topK
```

这很接近真实 RAG 系统里的召回 + 重排流程。

---

## 十七、为什么 RerankedRetriever 也实现 RetrievalEngine？

第 20 课已经让 `RagQaChain` 依赖了：

```ts
RetrievalEngine
```

所以只要 `RerankedRetriever` 也实现：

```ts
similaritySearch(query, options)
```

它就可以直接替换原来的 `HybridRetriever`。

这就是抽象接口的好处。

第 20 课中：

```text
RagQaChain → HybridRetriever
```

第 21 课中：

```text
RagQaChain → RerankedRetriever → HybridRetriever
```

上层调用方式不用变：

```ts
ragQaChain.invoke(question)
```

但底层检索链路已经增强了。

---

## 十八、修改 rag-context-builder.ts

文件路径：

```text
src/lessons/lesson21-rerank-introduction/rag/rag-context-builder.ts
```

把 context 改成显示 rerank 信息。

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
        `最终分数：${score.toFixed(4)}`,
        `初筛分数：${(result.originalScore ?? score).toFixed(4)}`,
        `Rerank 分数：${(result.rerankScore ?? score).toFixed(4)}`,
        `向量分数：${(result.vectorScore ?? 0).toFixed(4)}`,
        `关键词分数：${(result.keywordScore ?? 0).toFixed(4)}`,
        `命中关键词：${result.matchedKeywords?.join(", ") || "无"}`,
        `Rerank 原因：${result.rerankReasons?.join("；") || "无"}`,
        `内容：${chunk.content}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}
```

---

## 十九、为什么 context 里要放 Rerank 信息？

第 20 课我们已经在 context 里放了：

```text
检索来源
向量分数
关键词分数
命中关键词
```

第 21 课继续加入：

```text
初筛分数
Rerank 分数
Rerank 原因
```

这样就可以观察：

```text
这个结果原来分数是多少？
rerank 后分数是多少？
为什么被排到前面？
是不是标题命中？
是不是文件名命中？
是不是同时被两路召回？
```

调 RAG 的时候，不能只看最终答案。

很多时候答案不好，不是模型生成出了问题，而是检索排序就已经错了。

所以把这些中间信息打印出来，非常有利于排查问题。

---

## 二十、修改 rag-qa-chain.ts

文件路径：

```text
src/lessons/lesson21-rerank-introduction/rag/rag-qa-chain.ts
```

第 20 课的 `RagQaChain` 已经依赖 `RetrievalEngine`，所以主体不用大改。

只需要让返回结果里包含 rerank 信息。

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
    originalScore?: number;
    rerankScore?: number;
    rerankReasons: string[];
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
        originalScore: result.originalScore,
        rerankScore: result.rerankScore,
        rerankReasons: result.rerankReasons ?? [],
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

## 二十一、修改 rag-runtime.ts

文件路径：

```text
src/lessons/lesson21-rerank-introduction/rag-runtime.ts
```

把第 20 课的 `HybridRetriever` 包一层 `RerankedRetriever`。

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
import { SimpleRuleBasedReranker } from "./rerank/simple-rule-based-reranker.js";
import { RerankedRetriever } from "./rerank/reranked-retriever.js";
import { MemoryVectorStore } from "./vector-store/memory-vector-store.js";

export type RagRuntime = {
  ragQaChain: RagQaChain;
  documentCount: number;
  chunkCount: number;
  embeddingCount: number;
  retrievalMode: "hybrid_with_rerank";
};

export async function createRagRuntime(params: {
  model: RagChatModel;
}): Promise<RagRuntime> {
  const docsDir = path.resolve(
    process.cwd(),
    "src/lessons/lesson21-rerank-introduction/documents",
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

  const reranker = new SimpleRuleBasedReranker();

  const rerankedRetriever = new RerankedRetriever({
    baseRetriever: hybridRetriever,
    reranker,
    candidateKMultiplier: 4,
  });

  const ragQaChain = new RagQaChain(params.model, rerankedRetriever, {
    topK: 3,
    minScore: 0.3,
  });

  return {
    ragQaChain,
    documentCount: documents.length,
    chunkCount: chunks.length,
    embeddingCount: chunkEmbeddings.length,
    retrievalMode: "hybrid_with_rerank",
  };
}
```

---

## 二十二、理解 rag-runtime.ts 的变化

第 20 课是：

```ts
const ragQaChain = new RagQaChain(params.model, hybridRetriever, {
  topK: 3,
  minScore: 0.3,
});
```

第 21 课变成：

```ts
const reranker = new SimpleRuleBasedReranker();

const rerankedRetriever = new RerankedRetriever({
  baseRetriever: hybridRetriever,
  reranker,
  candidateKMultiplier: 4,
});

const ragQaChain = new RagQaChain(params.model, rerankedRetriever, {
  topK: 3,
  minScore: 0.3,
});
```

也就是说：

```text
RagQaChain 不再直接使用 HybridRetriever
而是使用带 rerank 的 RerankedRetriever
```

实际链路变成：

```text
RagQaChain
  ↓
RerankedRetriever
  ↓
HybridRetriever
  ↓
KeywordRetriever + MemoryVectorStore
```

---

## 二十三、修改 search-knowledge-base.tool.ts

文件路径：

```text
src/lessons/lesson21-rerank-introduction/tools/search-knowledge-base.tool.ts
```

第 20 课的工具可以继续用，但第 21 课建议把 rerank 信息也输出出来，方便观察。

代码如下：

```ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { RagQaChain } from "../rag/rag-qa-chain.js";

export function createSearchKnowledgeBaseTool(ragQaChain: RagQaChain) {
  return tool(
    async ({ query }) => {
      const answer = await ragQaChain.invoke(query);

      return JSON.stringify(
        {
          status: answer.searchResults.length > 0 ? "success" : "no_evidence",
          query: answer.question,
          answer: answer.answer,
          sources: answer.searchResults.map((result) => ({
            title: result.title,
            source: result.source,
            score: Number(result.score.toFixed(4)),
            originalScore:
              result.originalScore === undefined
                ? undefined
                : Number(result.originalScore.toFixed(4)),
            rerankScore:
              result.rerankScore === undefined
                ? undefined
                : Number(result.rerankScore.toFixed(4)),
            vectorScore:
              result.vectorScore === undefined
                ? undefined
                : Number(result.vectorScore.toFixed(4)),
            keywordScore:
              result.keywordScore === undefined
                ? undefined
                : Number(result.keywordScore.toFixed(4)),
            retrievalSources: result.retrievalSources,
            matchedKeywords: result.matchedKeywords,
            rerankReasons: result.rerankReasons,
            contentPreview: result.contentPreview,
          })),
        },
        null,
        2,
      );
    },
    {
      name: "search_knowledge_base",
      description:
        "查询企业知识库。适用于回答企业知识库、RAG、文档接入、检索优化、Agent 工具规范、权限控制、人工确认等内部资料相关问题。",
      schema: z.object({
        query: z
          .string()
          .min(1)
          .describe("用户想要查询的知识库问题，应该保留用户原始语义。"),
      }),
    },
  );
}
```

---

## 二十四、修改 index.ts

文件路径：

```text
src/lessons/lesson21-rerank-introduction/index.ts
```

大部分代码沿用第 20 课，只需要改日志和测试问题。

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

  console.log("\n========== Agent + Reranked RAG Tool 最终结果 ==========");
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

  console.log("\n========== Reranked RAG Runtime 初始化完成 ==========");
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
    threadId: "lesson21-viewer-source-file",
    userContext: viewerUser,
    userInput: "agent-tool-policy.md 里关于工具调用安全是怎么说的？",
  });

  await runConversationTurn({
    graph,
    threadId: "lesson21-viewer-rag-optimization",
    userContext: viewerUser,
    userInput: "RAG 检索效果不好应该怎么优化？",
  });

  await runConversationTurn({
    graph,
    threadId: "lesson21-viewer-datasource",
    userContext: viewerUser,
    userInput: "知识库支持 PDF、Word 和 Markdown 文档接入吗？",
  });

  await runConversationTurn({
    graph,
    threadId: "lesson21-support-query-then-ticket",
    userContext: supportUser,
    userInput:
      "先查知识库了解工具调用权限和人工确认的要求，然后创建一个中优先级工单跟进。",
    approval: {
      approved: true,
      comment: "客服确认基于 rerank 后的知识库结果创建工单。",
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

## 二十五、运行第 21 课

执行：

```bash
pnpm lesson:21
```

你会先看到：

```text
========== Reranked RAG Runtime 初始化完成 ==========
检索模式： hybrid_with_rerank
文档数量： 3
Chunk 数量： 若干
Embedding 数量： 若干
```

然后会测试 4 个场景：

```text
1. 查询指定文件 agent-tool-policy.md
2. 查询 RAG 检索优化
3. 查询文档接入能力
4. 先查知识库再创建工单
```

---

## 二十六、场景 1：查询指定文件 agent-tool-policy.md

输入：

```text
agent-tool-policy.md 里关于工具调用安全是怎么说的？
```

这个问题有明显的文件名：

```text
agent-tool-policy.md
```

Reranker 应该更偏向：

```text
source 命中 agent-tool-policy.md 的 chunk
```

你可以在工具结果里重点观察：

```text
originalScore
rerankScore
rerankReasons
```

如果命中文件名，通常会看到类似原因：

```text
来源或文件名命中查询关键词
```

这说明 reranker 对精确文件名查询起到了作用。

---

## 二十七、场景 2：查询 RAG 检索优化

输入：

```text
RAG 检索效果不好应该怎么优化？
```

预期命中：

```text
RAG 检索效果不好怎么办
```

Reranker 应该根据：

```text
标题命中查询关键词
正文内容命中查询关键词
同时被向量检索和关键词检索召回
```

把相关 chunk 排到更前。

这个场景验证的是：

```text
rerank 能不能进一步增强语义相关资料的排序稳定性。
```

---

## 二十八、场景 3：查询文档接入能力

输入：

```text
知识库支持 PDF、Word 和 Markdown 文档接入吗？
```

这个问题里有多个精确词：

```text
PDF
Word
Markdown
文档
接入
```

Reranker 应该更偏向：

```text
企业知识库支持的数据源
```

因为这个文档正文中包含这些精确词。

如果工具结果中出现：

```text
正文内容命中查询关键词
关键词检索命中：PDF, Word, Markdown
```

说明规则版 rerank 正在发挥作用。

---

## 二十九、场景 4：先查知识库再创建工单

输入：

```text
先查知识库了解工具调用权限和人工确认的要求，然后创建一个中优先级工单跟进。
```

预期流程：

```text
Agent 调用 search_knowledge_base
  ↓
RAG Tool 内部使用 RerankedRetriever
  ↓
返回工具调用规范相关答案
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
加入 rerank 后，Agent + Tool + 权限 + 人工确认流程仍然正常。
```

也就是说，我们增强的是 RAG Tool 内部检索排序能力，不影响外层 Agent 流程。

---

## 三十、第 21 课和第 20 课的区别

第 20 课：

```text
HybridRetriever
  ↓
RagQaChain
```

第 21 课：

```text
HybridRetriever
  ↓
SimpleRuleBasedReranker
  ↓
RerankedRetriever
  ↓
RagQaChain
```

第 20 课解决的是：

```text
关键词检索和向量检索如何融合？
```

第 21 课解决的是：

```text
融合后的候选结果如何二次排序？
```

可以简单理解为：

```text
第 20 课：召回更多可能相关的资料
第 21 课：把更相关的资料排到前面
```

---

## 三十一、Java 后端视角理解

第 20 课像这样：

```java
List<SearchResult> results = hybridRetriever.search(query, topK);
```

第 21 课变成：

```java
List<SearchResult> candidates = hybridRetriever.search(query, topK * 4);

List<SearchResult> reranked = reranker.rerank(query, candidates);

return reranked.stream()
    .limit(topK)
    .toList();
```

如果用 Java 类设计，大概是：

```java
public class RerankedRetriever implements Retriever {

    private final Retriever baseRetriever;
    private final Reranker reranker;

    public List<SearchResult> search(String query, int topK) {
        List<SearchResult> candidates = baseRetriever.search(query, topK * 4);

        List<SearchResult> reranked = reranker.rerank(query, candidates);

        return reranked.stream()
            .limit(topK)
            .toList();
    }
}
```

对应本节 TypeScript：

```text
Retriever → RetrievalEngine
HybridRetriever → baseRetriever
SimpleRuleBasedReranker → reranker
RerankedRetriever → 包装器
```

所以第 21 课本质上是在原有检索器外面套了一层排序增强器。

---

## 三十二、企业级 RAG 中 Rerank 的价值

真实企业 RAG 中，rerank 非常常见。

因为初筛召回往往追求“多找一些可能相关的资料”，但最终交给模型的上下文数量有限。

如果排序不好，模型拿到的资料就可能不够准确。

Rerank 的价值在于：

```text
1. 提升 topK 结果质量
2. 把更相关的 chunk 排到前面
3. 减少无关上下文进入 Prompt
4. 提高答案准确性
5. 降低模型胡乱引用资料的概率
```

真实项目中，rerank 可以有多种实现方式：

```text
规则 rerank
BM25 + 向量分数融合
LLM 判断相关性
专门的 rerank 模型
业务特征加权
用户权限和文档时效性加权
```

本节的规则版 reranker 只是第一步。

后续接真实 rerank 模型时，可以复用同样的工程结构。

---

## 三十三、TypeScript Tips

### 1. 接口式对象类型

```ts
export type Reranker = {
  rerank(input: RerankInput): Promise<RetrievalSearchResult[]>;
};
```

这是 TypeScript 中常见的接口式类型。

只要对象有 `rerank` 方法，就符合这个类型。

---

### 2. 包装器模式

```ts
export class RerankedRetriever implements RetrievalEngine {
  constructor(private readonly options: RerankedRetrieverOptions) {}
}
```

`RerankedRetriever` 并不自己做底层检索。

它是包了一层：

```text
baseRetriever + reranker
```

这就是包装器模式。

---

### 3. 可选字段默认值

```ts
const leftScore = left.rerankScore ?? left.score;
```

如果 `rerankScore` 存在，就用 rerank 分数。

如果不存在，就退回原始 `score`。

---

### 4. clampScore

```ts
function clampScore(score: number): number {
  return Math.max(0, Math.min(score, 1));
}
```

这个函数把分数限制在 0 到 1 之间。

避免加权和 boost 后分数超过 1。

---

### 5. 排序逻辑

```ts
.sort((left, right) => {
  const leftScore = left.rerankScore ?? left.score;
  const rightScore = right.rerankScore ?? right.score;

  return rightScore - leftScore;
});
```

这里表示按 rerank 分数从高到低排序。

如果写反，就会把低分结果排到前面。

---

### 6. Math.max 防止除零

```ts
const matchedKeywordScore =
  (result.matchedKeywords?.length ?? 0) / Math.max(terms.length, 1);
```

这里用：

```ts
Math.max(terms.length, 1)
```

是为了避免 `terms.length` 为 0 时出现除以 0。

---

## 三十四、本节总结

第 21 课完成了规则版 Rerank。

核心收获：

```text
1. Retrieval 负责召回候选，Rerank 负责二次排序
2. 混合检索后的排序不一定最佳，所以需要 rerank
3. RerankedRetriever 可以包装任意 RetrievalEngine
4. SimpleRuleBasedReranker 根据标题、来源、正文和命中关键词打分
5. originalScore 用于保存初筛分数
6. rerankScore 用于表示二次排序后的分数
7. rerankReasons 有助于调试和解释排序原因
8. Rerank 可以提升最终进入 Prompt 的资料质量
9. 第 21 课为后续接入真实 rerank 模型打基础
```

本节最重要的一句话：

> Rerank 的核心不是“找更多资料”，而是“把已经找出来的资料重新排好顺序”。

---

## 三十五、下一课预告

下一课进入：

# 第 22 课：RAG Evaluation 入门，构建最小评测集

第 21 课解决的是：

```text
如何把检索结果排得更好？
```

但是还有一个更工程化的问题：

```text
我们怎么知道 RAG 效果到底有没有变好？
```

如果没有评测集，每次调参数都只能靠感觉。

所以第 22 课会开始做 RAG Evaluation：

```text
1. 构建最小评测集
2. 定义测试问题
3. 定义 expectedSources
4. 批量运行 RAG 检索
5. 统计命中率
6. 为后续调参和优化提供依据
```

第 22 课开始，RAG 就会从“能跑”进入“可评估、可优化”的阶段。
