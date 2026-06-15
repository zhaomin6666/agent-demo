# 第 22 课：RAG Evaluation 入门，构建最小评测集

## 前言

前面几课，我们一直在增强 RAG 的能力。

从第 18 课开始，我们已经完成了：

```text
第 18 课：RAG QA Chain
第 19 课：RAG as Agent Tool
第 20 课：Hybrid Retrieval
第 21 课：Rerank
```

到第 21 课为止，RAG 链路已经变成了：

```text
用户问题
  ↓
HybridRetriever
  ↓
RerankedRetriever
  ↓
RagQaChain
  ↓
最终答案
```

也就是说，系统现在已经可以：

```text
加载文档
切分文档
生成向量
混合检索
二次排序
基于资料回答
作为 Agent Tool 被调用
```

但是到这里会出现一个更工程化的问题：

> 我们怎么知道 RAG 效果到底有没有变好？

比如我们调整了：

```text
topK
minScore
vectorWeight
keywordWeight
rerank 权重
chunk 大小
overlap 大小
```

这次修改到底是优化，还是只是看起来更好？

如果没有评测集，每次都只能靠手动试几个问题，判断会非常主观。

所以第 22 课开始，我们要给 RAG 建立一个最小评测系统。

这一课的核心是：

> 没有评测集，就没有可靠的 RAG 优化。

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解为什么 RAG 需要 Evaluation
2. 构建最小评测集 evaluation dataset
3. 定义 question、expectedSources、shouldHaveEvidence
4. 批量运行 RagQaChain
5. 提取实际检索来源 actualSources
6. 判断 expectedSources 是否命中
7. 统计通过率、命中率、无依据识别是否正确
8. 输出一份最小评测报告
```

第 21 课解决的是：

```text
如何把检索结果排得更好？
```

第 22 课解决的是：

```text
如何判断 RAG 检索效果到底好不好？
```

从这一课开始，RAG 不只是“能跑”，还要开始变成“可评估、可调优”。

---

## 二、为什么需要 RAG Evaluation？

做 RAG 很容易陷入一个误区：

```text
我手动问了几个问题，看起来回答得不错，所以效果应该还可以。
```

但真实项目里，这样是不够的。

因为 RAG 系统的效果受很多因素影响：

```text
文档质量
chunk 切分
Embedding 模型
向量检索
关键词检索
rerank
topK
minScore
Prompt
答案拒答策略
```

每次改一个参数，都可能导致某些问题变好，另一些问题变差。

例如把：

```text
vectorWeight: 0.7
keywordWeight: 0.3
```

改成：

```text
vectorWeight: 0.8
keywordWeight: 0.2
```

可能会出现：

```text
语义类问题变好了
文件名类问题变差了
精确关键词问题命中率下降了
```

再比如提高：

```text
minScore: 0.3 → 0.5
```

可能会出现：

```text
无依据问题识别更好了
但一些本来能回答的问题被误判为无依据
```

所以 RAG 优化不能只靠感觉。

需要有一组固定问题，每次修改后都跑一遍，看整体表现有没有变好。

这就是 RAG Evaluation 的价值。

---

## 三、本节评估什么？

RAG Evaluation 可以评估很多东西。

比如：

```text
检索来源是否正确
答案是否准确
答案是否完整
答案是否引用来源
是否出现幻觉
无依据问题是否正确拒答
回答是否简洁
```

但第 22 课先不做复杂评估。

我们先评估最核心的一件事：

> 检索来源是否命中预期文档。

例如：

```text
用户问题：知识库支持 PDF、Word 文档接入吗？
预期来源：knowledge-base-guide.md
实际来源：knowledge-base-guide.md
结果：通过
```

再比如：

```text
用户问题：接口响应很慢应该怎么排查？
预期：当前知识库没有资料
实际：没有检索到可靠资料
结果：通过
```

本节主要评估两类问题：

```text
1. 有资料的问题，是否能命中正确来源
2. 没有资料的问题，是否能正确返回 no evidence
```

这已经能覆盖 RAG 系统最基础、也最关键的能力。

---

## 四、本节整体流程

第 22 课的整体流程是：

```text
Evaluation Dataset
  ↓
RagEvaluator
  ↓
逐条调用 RagQaChain.invoke(question)
  ↓
提取 actualSources
  ↓
和 expectedSources 比较
  ↓
生成 EvaluationResult
  ↓
输出 EvaluationReport
```

也就是说，本节不是重新实现 RAG。

而是用评测器去调用真实的 RAG 链路。

这样评测结果才有意义。

---

## 五、本节目录结构

第 22 课直接基于第 21 课复制：

```bash
cp -r src/lessons/lesson21-rerank-introduction src/lessons/lesson22-rag-evaluation
```

Windows PowerShell：

```powershell
Copy-Item -Recurse src/lessons/lesson21-rerank-introduction src/lessons/lesson22-rag-evaluation
```

新增 `evaluation` 目录：

```bash
mkdir -p src/lessons/lesson22-rag-evaluation/evaluation
```

最终目录结构：

```text
src/lessons/lesson22-rag-evaluation/
  documents/
  loader/
  embedding/
  vector-store/
  retrieval/
  rerank/
  rag/
  tools/
  executor/
  model/
  memory/
  approval/
  security/
  graph/

  evaluation/
    evaluation-dataset.ts
    rag-evaluator.ts
    evaluation-report.ts

  rag-runtime.ts
  index.ts
```

这些文件从第 21 课复制即可，本节不需要修改：

```text
documents/*
loader/*
embedding/*
vector-store/*
retrieval/*
rerank/*
rag/*
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
evaluation/evaluation-dataset.ts
evaluation/rag-evaluator.ts
evaluation/evaluation-report.ts
rag-runtime.ts
index.ts
package.json
```

---

## 六、配置 package.json

在 `package.json` 中新增第 22 课脚本：

```json
{
  "scripts": {
    "lesson:22": "tsx src/lessons/lesson22-rag-evaluation/index.ts"
  }
}
```

运行第 22 课：

```bash
pnpm lesson:22
```

---

## 七、新增 evaluation-dataset.ts

文件路径：

```text
src/lessons/lesson22-rag-evaluation/evaluation/evaluation-dataset.ts
```

代码如下：

```ts
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
```

---

## 八、理解 EvaluationCase

每一个评测用例都是一个固定问题。

类型如下：

```ts
export type EvaluationCase = {
  id: string;
  question: string;
  expectedSources: string[];
  shouldHaveEvidence: boolean;
  note: string;
};
```

字段含义：

```text
id：评测用例编号
question：测试问题
expectedSources：期望命中的来源文档
shouldHaveEvidence：是否应该找到资料
note：这条用例的测试目的
```

例如：

```ts
{
  id: "rag-optimization-semantic",
  question: "知识库召回不准应该怎么优化？",
  expectedSources: ["rag-optimization.md"],
  shouldHaveEvidence: true,
  note: "表达和标题不完全一致，测试语义检索和混合检索能力。",
}
```

这条用例测试的是：

```text
用户表达和文档标题不完全一样时，RAG 是否还能命中正确资料。
```

这就是评测集的价值。

它不是随便写几个问题，而是每个问题都对应一个明确的测试目的。

---

## 九、为什么要有 expectedSources？

`expectedSources` 表示这条问题理论上应该命中的文档。

例如：

```ts
expectedSources: ["knowledge-base-guide.md"]
```

意思是：

```text
这个问题应该命中 knowledge-base-guide.md。
```

实际运行时，我们会从 RAG 返回结果中提取：

```text
actualSources
```

然后比较：

```text
expectedSources 是否出现在 actualSources 中
```

如果命中，说明检索结果符合预期。

如果没命中，说明这条问题可能存在检索问题。

比如：

```text
问题：知识库支持 PDF、Word 文档接入吗？
预期来源：knowledge-base-guide.md
实际来源：rag-optimization.md
结果：失败
```

这就说明系统把问题召回到了错误资料上。

---

## 十、为什么要有 shouldHaveEvidence？

不是所有问题都应该查到答案。

比如：

```text
接口响应很慢应该怎么排查？
```

当前这几篇文档里没有接口性能排查资料。

所以它的配置是：

```ts
expectedSources: [],
shouldHaveEvidence: false,
```

这类问题非常重要。

因为一个好的 RAG 系统不应该强行回答所有问题。

它需要知道：

```text
什么时候应该回答
什么时候应该说没有可靠依据
```

所以评测集中一定要有 no evidence 类型的问题。

否则系统可能看起来“很会回答”，但其实是在胡乱回答。

---

## 十一、新增 rag-evaluator.ts

文件路径：

```text
src/lessons/lesson22-rag-evaluation/evaluation/rag-evaluator.ts
```

代码如下：

```ts
import type { RagQaChain, RagQaAnswer } from "../rag/rag-qa-chain.js";
import type { EvaluationCase } from "./evaluation-dataset.js";

export type EvaluationResult = {
  caseId: string;
  question: string;
  note: string;

  expectedSources: string[];
  actualSources: string[];

  shouldHaveEvidence: boolean;
  hasEvidence: boolean;

  hitExpectedSource: boolean;
  hitCount: number;
  missedSources: string[];
  unexpectedSources: string[];

  passed: boolean;
  failureReason: string;

  answerPreview: string;
  searchResults: RagQaAnswer["searchResults"];
};

export class RagEvaluator {
  constructor(private readonly ragQaChain: RagQaChain) {}

  async evaluateCase(testCase: EvaluationCase): Promise<EvaluationResult> {
    const answer = await this.ragQaChain.invoke(testCase.question);

    const actualSources = unique(
      answer.searchResults.map((result) => result.source),
    );

    const missedSources = testCase.expectedSources.filter(
      (source) => !actualSources.includes(source),
    );

    const unexpectedSources = actualSources.filter(
      (source) => !testCase.expectedSources.includes(source),
    );

    const hitCount = testCase.expectedSources.length - missedSources.length;

    const hasEvidence = answer.searchResults.length > 0;

    const hitExpectedSource =
      testCase.expectedSources.length === 0
        ? !hasEvidence
        : hitCount > 0;

    const passed = calculatePassed({
      shouldHaveEvidence: testCase.shouldHaveEvidence,
      hasEvidence,
      hitExpectedSource,
    });

    return {
      caseId: testCase.id,
      question: testCase.question,
      note: testCase.note,

      expectedSources: testCase.expectedSources,
      actualSources,

      shouldHaveEvidence: testCase.shouldHaveEvidence,
      hasEvidence,

      hitExpectedSource,
      hitCount,
      missedSources,
      unexpectedSources,

      passed,
      failureReason: passed
        ? ""
        : buildFailureReason({
            shouldHaveEvidence: testCase.shouldHaveEvidence,
            hasEvidence,
            missedSources,
            actualSources,
          }),

      answerPreview: answer.answer.slice(0, 160),
      searchResults: answer.searchResults,
    };
  }

  async evaluateAll(testCases: EvaluationCase[]): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const testCase of testCases) {
      const result = await this.evaluateCase(testCase);
      results.push(result);
    }

    return results;
  }
}

function calculatePassed(params: {
  shouldHaveEvidence: boolean;
  hasEvidence: boolean;
  hitExpectedSource: boolean;
}): boolean {
  if (!params.shouldHaveEvidence) {
    return !params.hasEvidence;
  }

  return params.hasEvidence && params.hitExpectedSource;
}

function buildFailureReason(params: {
  shouldHaveEvidence: boolean;
  hasEvidence: boolean;
  missedSources: string[];
  actualSources: string[];
}): string {
  if (!params.shouldHaveEvidence && params.hasEvidence) {
    return `预期无依据，但实际检索到了来源：${params.actualSources.join(", ")}`;
  }

  if (params.shouldHaveEvidence && !params.hasEvidence) {
    return "预期应该有依据，但实际没有检索到资料。";
  }

  if (params.missedSources.length > 0) {
    return `未命中预期来源：${params.missedSources.join(", ")}`;
  }

  return "未知失败原因。";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
```

---

## 十二、理解 RagEvaluator

`RagEvaluator` 的职责是：

```text
执行评测用例，并判断是否通过。
```

核心逻辑是：

```ts
const answer = await this.ragQaChain.invoke(testCase.question);
```

也就是说，评测器会把每条评测问题丢给真实的 `RagQaChain`。

然后提取实际来源：

```ts
const actualSources = unique(
  answer.searchResults.map((result) => result.source),
);
```

再和预期来源比较：

```ts
const missedSources = testCase.expectedSources.filter(
  (source) => !actualSources.includes(source),
);
```

最终得到：

```text
expectedSources：预期来源
actualSources：实际来源
missedSources：漏掉的来源
passed：是否通过
failureReason：失败原因
```

这个过程和写自动化测试很像。

---

## 十三、评测通过规则

本节的通过规则非常简单。

如果：

```ts
shouldHaveEvidence = true
```

那么要求：

```text
必须检索到资料
并且至少命中一个 expectedSources
```

如果：

```ts
shouldHaveEvidence = false
```

那么要求：

```text
不应该检索到资料
```

对应代码：

```ts
function calculatePassed(params: {
  shouldHaveEvidence: boolean;
  hasEvidence: boolean;
  hitExpectedSource: boolean;
}): boolean {
  if (!params.shouldHaveEvidence) {
    return !params.hasEvidence;
  }

  return params.hasEvidence && params.hitExpectedSource;
}
```

这是一个最小版本。

后续可以继续扩展，比如：

```text
预期来源必须排在 Top 1
必须命中全部 expectedSources
答案中必须包含某些关键词
答案不能包含某些错误内容
必须带参考来源
no evidence 问题不能调用模型
```

但第 22 课先从最基础的来源命中评估开始。

---

## 十四、为什么 evaluateAll 用串行执行？

代码中：

```ts
async evaluateAll(testCases: EvaluationCase[]): Promise<EvaluationResult[]> {
  const results: EvaluationResult[] = [];

  for (const testCase of testCases) {
    const result = await this.evaluateCase(testCase);
    results.push(result);
  }

  return results;
}
```

这里是串行执行，而不是 `Promise.all` 并行。

原因是每条评测都会调用：

```text
Embedding 服务
Chat Model
RAG 检索链路
```

如果一次性并发太多，容易触发接口限流，也不方便观察日志顺序。

当前评测集只有几条用例，串行执行更稳。

后续如果评测集变大，可以再做并发控制，比如：

```text
每次并发 3 条
失败自动重试
记录每条耗时
保存 JSON 报告
```

---

## 十五、新增 evaluation-report.ts

文件路径：

```text
src/lessons/lesson22-rag-evaluation/evaluation/evaluation-report.ts
```

代码如下：

```ts
import type { EvaluationResult } from "./rag-evaluator.js";

export type EvaluationSummary = {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  evidenceCases: number;
  evidencePassed: number;
  noEvidenceCases: number;
  noEvidencePassed: number;
};

export function summarizeEvaluation(
  results: EvaluationResult[],
): EvaluationSummary {
  const total = results.length;

  const passed = results.filter((result) => result.passed).length;

  const evidenceCases = results.filter(
    (result) => result.shouldHaveEvidence,
  );

  const noEvidenceCases = results.filter(
    (result) => !result.shouldHaveEvidence,
  );

  const evidencePassed = evidenceCases.filter(
    (result) => result.passed,
  ).length;

  const noEvidencePassed = noEvidenceCases.filter(
    (result) => result.passed,
  ).length;

  return {
    total,
    passed,
    failed: total - passed,
    passRate: total === 0 ? 0 : passed / total,
    evidenceCases: evidenceCases.length,
    evidencePassed,
    noEvidenceCases: noEvidenceCases.length,
    noEvidencePassed,
  };
}

export function printEvaluationReport(results: EvaluationResult[]) {
  const summary = summarizeEvaluation(results);

  console.log("\n========== RAG Evaluation Summary ==========");
  console.log("总用例数：", summary.total);
  console.log("通过数量：", summary.passed);
  console.log("失败数量：", summary.failed);
  console.log("通过率：", `${(summary.passRate * 100).toFixed(2)}%`);
  console.log(
    "有依据问题通过：",
    `${summary.evidencePassed}/${summary.evidenceCases}`,
  );
  console.log(
    "无依据问题通过：",
    `${summary.noEvidencePassed}/${summary.noEvidenceCases}`,
  );

  console.log("\n========== RAG Evaluation Details ==========");

  for (const result of results) {
    console.log("\n----------------------------------------");
    console.log("用例：", result.caseId);
    console.log("结果：", result.passed ? "PASS" : "FAIL");
    console.log("问题：", result.question);
    console.log("说明：", result.note);

    console.log("预期来源：", formatList(result.expectedSources));
    console.log("实际来源：", formatList(result.actualSources));
    console.log("是否应该有依据：", result.shouldHaveEvidence);
    console.log("实际是否有依据：", result.hasEvidence);

    if (!result.passed) {
      console.log("失败原因：", result.failureReason);
    }

    console.log("\n检索结果：");
    for (const [index, searchResult] of result.searchResults.entries()) {
      console.log(`Top ${index + 1}`);
      console.log("title:", searchResult.title);
      console.log("source:", searchResult.source);
      console.log("score:", searchResult.score.toFixed(4));
      console.log(
        "originalScore:",
        searchResult.originalScore?.toFixed(4) ?? "无",
      );
      console.log(
        "rerankScore:",
        searchResult.rerankScore?.toFixed(4) ?? "无",
      );
      console.log("retrievalSources:", searchResult.retrievalSources.join(", "));
      console.log("matchedKeywords:", searchResult.matchedKeywords.join(", "));
      console.log("rerankReasons:", searchResult.rerankReasons.join("；"));
    }

    console.log("\n答案预览：");
    console.log(result.answerPreview || "无");
  }
}

function formatList(values: string[]): string {
  return values.length === 0 ? "无" : values.join(", ");
}
```

---

## 十六、理解 Evaluation Report

`evaluation-report.ts` 负责输出评测报告。

报告分两层：

```text
Summary：总体结果
Details：每条用例详情
```

总体结果包括：

```text
总用例数
通过数量
失败数量
通过率
有依据问题通过情况
无依据问题通过情况
```

每条用例详情包括：

```text
问题
测试说明
预期来源
实际来源
是否通过
失败原因
检索结果
答案预览
```

这份报告的意义是：

> 以后每次修改 RAG 参数，都可以跑一遍 lesson:22，看效果有没有退化。

---

## 十七、修改 rag-runtime.ts

文件路径：

```text
src/lessons/lesson22-rag-evaluation/rag-runtime.ts
```

这个文件从第 21 课复制后，只需要改路径和确认 `retrievalMode`。

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
    "src/lessons/lesson22-rag-evaluation/documents",
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

## 十八、为什么第 22 课还复用 RagQaChain？

因为我们这次不是重新实现 RAG，而是评估现有 RAG。

所以核心对象仍然是：

```text
RagQaChain
```

评测器只是批量调用：

```ts
ragQaChain.invoke(question)
```

然后检查结果。

这也是评测系统的基本思路：

```text
不要为了评测重写一套逻辑
而是评估真实运行链路
```

否则评测结果就可能和真实系统不一致。

---

## 十九、修改 index.ts

文件路径：

```text
src/lessons/lesson22-rag-evaluation/index.ts
```

第 22 课不再跑 Agent 场景，而是跑评测集。

代码如下：

```ts
import { evaluationDataset } from "./evaluation/evaluation-dataset.js";
import { printEvaluationReport } from "./evaluation/evaluation-report.js";
import { RagEvaluator } from "./evaluation/rag-evaluator.js";
import { createModel } from "./model/create-model.js";
import { createRagRuntime } from "./rag-runtime.js";

async function main() {
  const model = createModel();

  const ragRuntime = await createRagRuntime({
    model,
  });

  console.log("\n========== RAG Evaluation 初始化完成 ==========");
  console.log("检索模式：", ragRuntime.retrievalMode);
  console.log("文档数量：", ragRuntime.documentCount);
  console.log("Chunk 数量：", ragRuntime.chunkCount);
  console.log("Embedding 数量：", ragRuntime.embeddingCount);
  console.log("评测用例数量：", evaluationDataset.length);

  const evaluator = new RagEvaluator(ragRuntime.ragQaChain);

  const results = await evaluator.evaluateAll(evaluationDataset);

  printEvaluationReport(results);
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 二十、为什么第 22 课不跑 Agent？

第 19、20、21 课都在跑 Agent 场景。

但第 22 课先不跑 Agent，而是直接评估：

```text
RagQaChain
```

原因是：

```text
本节重点是评估 RAG 检索效果
而不是评估 Agent 工具调用决策
```

如果把 Agent 也放进来，评测变量会变多：

```text
Agent 是否调用工具
工具参数是否正确
RAG 检索是否正确
最终回答是否正确
```

这样不利于定位问题。

所以第 22 课先评估 RAG 本身。

后续如果需要，可以再做 Agent Evaluation。

---

## 二十一、运行第 22 课

执行：

```bash
pnpm lesson:22
```

你会看到类似输出：

```text
========== RAG Evaluation 初始化完成 ==========
检索模式： hybrid_with_rerank
文档数量： 3
Chunk 数量： 若干
Embedding 数量： 若干
评测用例数量： 7
```

然后输出总体报告：

```text
========== RAG Evaluation Summary ==========
总用例数： 7
通过数量： 6
失败数量： 1
通过率： 85.71%
有依据问题通过： 6/6
无依据问题通过： 0/1
```

以及每条用例详情。

实际结果会受到当前模型、Embedding、分数阈值和检索策略影响。

所以你的输出可能和示例略有不同。

---

## 二十二、如何解读评测结果？

如果某条用例是：

```text
PASS
```

说明当前 RAG 配置在这条问题上符合预期。

如果某条用例是：

```text
FAIL
```

不一定是坏事。

它说明我们发现了一个可优化点。

例如：

```text
用例：no-evidence-performance
问题：接口响应很慢应该怎么排查？
预期：无依据
实际：检索到了 rag-optimization.md
结果：FAIL
```

这说明当前系统可能存在：

```text
minScore 太低
关键词召回太宽
rerank 仍然把弱相关资料排进来了
no evidence 判断不够严格
```

这就是评测的价值。

它不是为了证明系统完美，而是为了告诉我们：

```text
哪里需要继续优化。
```

---

## 二十三、为什么 no evidence 用例可能失败？

当前知识库文档中有：

```text
RAG 检索效果不好怎么办
Agent 工具调用规范
企业知识库支持的数据源
```

用户问：

```text
接口响应很慢应该怎么排查？
```

虽然没有接口性能排查资料，但问题中有：

```text
接口
响应
排查
```

而前面 `KeywordRetriever` 的 `KNOWN_TERMS` 里也包含这些词。

这可能导致系统召回一些不相关资料。

如果这条用例失败，说明下一步可以考虑：

```text
1. 提高 minScore
2. 对 no evidence 使用更严格阈值
3. 删除过宽关键词
4. 增加答案前的 evidence check
5. 增加更细粒度的文档类型判断
6. 引入更强的 rerank 或 relevance judge
```

这就是 RAG 调优的实际过程。

先发现问题，再针对性优化。

---

## 二十四、第 22 课和第 21 课的区别

第 21 课：

```text
继续增强 RAG 检索链路
```

第 22 课：

```text
开始评估 RAG 检索效果
```

第 21 课关注：

```text
怎么让结果排得更好？
```

第 22 课关注：

```text
怎么知道结果是不是真的更好？
```

可以简单理解为：

```text
第 21 课：优化能力
第 22 课：衡量能力
```

如果没有第 22 课，后续继续调参数就会越来越靠感觉。

有了评测集后，优化才有依据。

---

## 二十五、Java 后端视角理解

可以把第 22 课理解成给 RAG 写测试用例。

在 Java 中可能类似：

```java
@Test
void shouldHitDatasourceDocument() {
    RagAnswer answer = ragQaService.answer("企业知识库支持哪些类型的数据源？");

    assertTrue(answer.getSources().contains("knowledge-base-guide.md"));
}
```

批量评测可以理解为：

```java
for (EvaluationCase testCase : evaluationDataset) {
    RagAnswer answer = ragQaService.answer(testCase.getQuestion());

    EvaluationResult result = evaluator.evaluate(testCase, answer);

    report.add(result);
}
```

对应本节 TypeScript：

```text
EvaluationCase → 测试用例
RagEvaluator → 测试执行器
EvaluationResult → 单条测试结果
EvaluationReport → 测试报告
```

所以第 22 课本质上是在给 RAG 建一个最小测试框架。

---

## 二十六、企业级 RAG Evaluation 的价值

真实企业项目中，RAG Evaluation 非常重要。

因为 RAG 经常需要持续迭代：

```text
新增文档
更新文档
换 Embedding 模型
调整 chunk 策略
调整检索权重
调整 rerank
调整 Prompt
增加权限过滤
```

如果没有评测，每次上线都不知道有没有破坏已有效果。

评测集可以帮助我们发现：

```text
哪些问题一直稳定
哪些问题经常失败
哪些参数调整导致退化
哪些文档需要补充
哪些问题应该拒答
```

后续甚至可以把评测集接入 CI 流程。

例如：

```text
每次修改 RAG 检索逻辑
自动跑 evaluation
通过率低于阈值就提示风险
```

这样 RAG 才能从 Demo 走向工程化。

---

## 二十七、TypeScript Tips

### 1. 类型复用

```ts
import type { RagQaChain, RagQaAnswer } from "../rag/rag-qa-chain.js";
```

这里直接复用已有的 RAG 类型。

这样评测系统和真实 RAG 返回结构保持一致。

---

### 2. 数组 filter

```ts
const missedSources = testCase.expectedSources.filter(
  (source) => !actualSources.includes(source),
);
```

这段代码用于找出：

```text
预期应该命中，但实际没有命中的来源。
```

---

### 3. Set 去重

```ts
function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
```

如果多个 chunk 都来自同一个 source，只需要保留一个来源。

所以这里用 `Set` 去重。

---

### 4. 类型索引访问

```ts
searchResults: RagQaAnswer["searchResults"];
```

这表示直接复用 `RagQaAnswer` 类型中的 `searchResults` 字段类型。

好处是：

```text
如果以后 RagQaAnswer.searchResults 结构变了，这里也能跟着更新。
```

---

### 5. 串行执行评测

```ts
for (const testCase of testCases) {
  const result = await this.evaluateCase(testCase);
  results.push(result);
}
```

这里是串行执行，不是并行。

原因是每条评测都会调用模型和 Embedding 服务。

串行更稳，不容易触发限流。

---

### 6. 通过率计算

```ts
passRate: total === 0 ? 0 : passed / total
```

这里要处理 `total === 0` 的情况。

否则如果没有评测用例，就会出现除以 0 的问题。

---

## 二十八、本节总结

第 22 课完成了最小 RAG Evaluation。

核心收获：

```text
1. RAG 不能只靠手动感觉判断效果
2. Evaluation Dataset 用于固定测试问题和预期结果
3. expectedSources 用于判断检索是否命中正确资料
4. shouldHaveEvidence 用于测试系统是否能正确拒答
5. RagEvaluator 负责批量执行评测
6. Evaluation Report 可以输出通过率和失败原因
7. 评测失败不是坏事，而是暴露优化方向
8. 第 22 课让 RAG 从“能跑”进入“可评估”
9. 有了评测集，后续调参和优化才有依据
```

本节最重要的一句话：

> 没有评测集，就没有可靠的 RAG 优化。

---

## 二十九、下一课预告

下一课进入：

# 第 23 课：Observability 入门，为 RAG 和 Agent 增加运行观测日志

第 22 课解决的是：

```text
如何评估 RAG 效果？
```

但是当评测失败时，我们还需要知道：

```text
系统运行过程中到底发生了什么？
```

所以第 23 课会开始做 Observability。

主要内容包括：

```text
1. 定义 trace event
2. 记录 RAG 检索过程
3. 记录 tool call 过程
4. 记录评测过程
5. 输出结构化运行日志
6. 为后续调试和面试讲解做准备
```

第 22 课让我们知道“哪里失败了”。

第 23 课会帮助我们看清“为什么失败”。
