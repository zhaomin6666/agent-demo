# 第 23 课：Observability 入门，为 RAG 和 Agent 增加运行观测日志

## 前言

第 22 课我们完成了 RAG Evaluation。

通过评测集，我们已经可以知道：

```text
哪些问题通过了
哪些问题失败了
实际命中了哪些 source
是否正确识别 no evidence
整体通过率是多少
```

这解决的是：

```text
RAG 效果好不好？
```

但是如果某条评测失败，我们还需要进一步知道：

```text
为什么失败？
```

比如：

```text
是检索没有命中正确文档？
是 minScore 太低？
是 rerank 后把错误 chunk 排到了前面？
是 context 构造太长？
是模型生成时引用错了资料？
是工具调用参数不对？
```

如果没有运行过程日志，只看最终答案，很难定位问题。

所以第 23 课要做的是 Observability，也就是可观测性。

简单理解就是：

> 在关键节点手动埋点，记录结构化日志，让一次 RAG / Agent 调用过程可以被追踪、查看和分析。

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解为什么 Agent / RAG 需要 Observability
2. 新增 TraceEvent 类型
3. 新增 TraceRecorder
4. 新增 TraceReport
5. 给 RagQaChain 增加 trace
6. 给 RagEvaluator 增加 trace
7. 给 search_knowledge_base 工具增加 trace
8. 在 index.ts 中同时运行 evaluation 和 tool call demo
9. 最后输出结构化 Trace Report
```

第 22 课解决的是：

```text
RAG 效果好不好？
```

第 23 课解决的是：

```text
RAG 为什么好，为什么不好？
```

这一课的核心是：

> 没有 Observability，RAG 和 Agent 的问题就只能靠猜。

---

## 二、什么是 Observability？

Observability 可以先简单理解为：

```text
在系统运行过程中，记录关键节点的结构化日志。
```

普通 `console.log` 也能打印日志，但它通常比较零散。

比如：

```ts
console.log("开始检索");
console.log(results);
console.log("模型回答", answer);
```

这些日志能临时调试，但很难形成完整调用链。

第 23 课做的是结构化 trace：

```text
traceId：一次完整调用链
spanId：调用链中的某一步
type：事件类型
status：started / completed / failed
durationMs：耗时
input：输入
output：输出
metadata：额外信息
error：错误信息
```

这样我们就可以把一次 RAG 调用串起来：

```text
rag.invoke
  ↓
rag.retrieve
  ↓
rag.context
  ↓
rag.generate
```

也可以把一次评测串起来：

```text
evaluation.run
  ↓
evaluation.case
  ↓
rag.invoke
  ↓
rag.retrieve
  ↓
rag.context
  ↓
rag.generate
```

这就是可观测性的价值。

---

## 三、为什么 RAG / Agent 特别需要 Observability？

传统后端接口出问题，很多时候可以直接看：

```text
请求参数
SQL 日志
异常堆栈
返回值
```

但 RAG 和 Agent 的问题更复杂。

因为它们是多步骤链路：

```text
用户问题
  ↓
检索
  ↓
rerank
  ↓
context 构造
  ↓
模型生成
  ↓
工具调用
  ↓
最终回答
```

任何一步出问题，最终答案都可能变差。

例如用户问：

```text
企业知识库支持哪些类型的数据源？
```

如果回答错了，可能有很多原因：

```text
1. chunk 切分不合理
2. 向量检索没有命中正确 chunk
3. 关键词检索召回了无关文档
4. rerank 把错误资料排到了前面
5. context 太长导致模型忽略重点
6. 模型生成时没有严格基于资料
7. 工具调用参数不是用户原始问题
```

如果没有 trace，我们只能猜。

有了 trace，就可以看到每一步到底发生了什么。

---

## 四、本节整体流程

第 23 课会在原来的执行链路旁边增加一条 trace 记录链路：

```text
RagEvaluator
  ↓
TraceRecorder 记录 evaluation.case
  ↓
RagQaChain
  ↓
TraceRecorder 记录 rag.invoke / rag.retrieve / rag.context / rag.generate
  ↓
search_knowledge_base Tool
  ↓
TraceRecorder 记录 tool.call
  ↓
TraceReport 输出日志
```

最终我们希望看到类似：

```text
evaluation.run started
evaluation.case started
rag.invoke started
rag.retrieve started
rag.retrieve completed
rag.context completed
rag.generate completed
rag.invoke completed
evaluation.case completed
tool.call started
tool.call completed
```

这样后续调试时，就不是只看最终答案，而是可以看完整运行过程。

---

## 五、本节目录结构

第 23 课直接基于第 22 课复制：

```bash
cp -r src/lessons/lesson22-rag-evaluation src/lessons/lesson23-observability
```

Windows PowerShell：

```powershell
Copy-Item -Recurse src/lessons/lesson22-rag-evaluation src/lessons/lesson23-observability
```

新增 `observability` 目录：

```bash
mkdir -p src/lessons/lesson23-observability/observability
```

最终目录结构：

```text
src/lessons/lesson23-observability/
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

  observability/
    trace-types.ts
    trace-recorder.ts
    trace-report.ts

  rag-runtime.ts
  index.ts
```

这些文件从第 22 课复制即可，本节不需要修改：

```text
documents/*
loader/*
embedding/*
vector-store/*
retrieval/*
rerank/*
executor/*
model/*
memory/*
approval/*
security/*
graph/*
evaluation/evaluation-dataset.ts
evaluation/evaluation-report.ts
```

本节重点新增或修改：

```text
observability/trace-types.ts
observability/trace-recorder.ts
observability/trace-report.ts
rag/rag-qa-chain.ts
evaluation/rag-evaluator.ts
tools/search-knowledge-base.tool.ts
tools/index.ts
rag-runtime.ts
index.ts
package.json
```

---

## 六、配置 package.json

在 `package.json` 中新增第 23 课脚本：

```json
{
  "scripts": {
    "lesson:23": "tsx src/lessons/lesson23-observability/index.ts"
  }
}
```

运行：

```bash
pnpm lesson:23
```

---

## 七、新增 trace-types.ts

文件路径：

```text
src/lessons/lesson23-observability/observability/trace-types.ts
```

代码如下：

```ts
export type TraceEventStatus = "started" | "completed" | "failed";

export type TraceEventType =
  | "evaluation.run"
  | "evaluation.case"
  | "rag.invoke"
  | "rag.retrieve"
  | "rag.context"
  | "rag.generate"
  | "tool.call";

export type TraceEvent = {
  id: string;
  traceId: string;
  spanId: string;
  type: TraceEventType;
  name: string;
  status: TraceEventStatus;
  timestamp: string;
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  error?: string;
};

export type StartTraceSpanParams = {
  traceId?: string;
  type: TraceEventType;
  name: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
};

export type EndTraceSpanParams = {
  output?: unknown;
  metadata?: Record<string, unknown>;
};

export type ActiveTraceSpan = {
  traceId: string;
  spanId: string;
  end(params?: EndTraceSpanParams): void;
  fail(error: unknown, metadata?: Record<string, unknown>): void;
};
```

---

## 八、理解 TraceEvent

`TraceEvent` 表示系统运行过程中的一个事件。

例如：

```text
RAG 开始执行
RAG 检索完成
模型生成完成
工具调用完成
评测用例失败
```

字段含义如下：

```text
id：事件唯一 ID
traceId：一次完整调用链的 ID
spanId：当前步骤的 ID
type：事件类型
name：事件名称
status：started / completed / failed
timestamp：事件时间
durationMs：耗时
input：输入
output：输出
metadata：额外信息
error：错误信息
```

可以简单理解为：

```text
traceId 表示一整条链路
spanId 表示链路中的某一步
```

例如一次评测链路中可能有：

```text
traceId = trace-abc

span 1：evaluation.case
span 2：rag.invoke
span 3：rag.retrieve
span 4：rag.context
span 5：rag.generate
```

这样所有步骤都可以通过同一个 `traceId` 串起来。

---

## 九、新增 trace-recorder.ts

文件路径：

```text
src/lessons/lesson23-observability/observability/trace-recorder.ts
```

代码如下：

```ts
import { randomUUID } from "node:crypto";

import type {
  ActiveTraceSpan,
  EndTraceSpanParams,
  StartTraceSpanParams,
  TraceEvent,
} from "./trace-types.js";

export class TraceRecorder {
  private readonly events: TraceEvent[] = [];

  startSpan(params: StartTraceSpanParams): ActiveTraceSpan {
    const traceId = params.traceId ?? createId("trace");
    const spanId = createId("span");
    const startedAt = Date.now();

    this.events.push({
      id: createId("event"),
      traceId,
      spanId,
      type: params.type,
      name: params.name,
      status: "started",
      timestamp: new Date(startedAt).toISOString(),
      input: params.input,
      metadata: params.metadata,
    });

    return {
      traceId,
      spanId,
      end: (endParams?: EndTraceSpanParams) => {
        const endedAt = Date.now();

        this.events.push({
          id: createId("event"),
          traceId,
          spanId,
          type: params.type,
          name: params.name,
          status: "completed",
          timestamp: new Date(endedAt).toISOString(),
          durationMs: endedAt - startedAt,
          input: params.input,
          output: endParams?.output,
          metadata: {
            ...params.metadata,
            ...endParams?.metadata,
          },
        });
      },
      fail: (error: unknown, metadata?: Record<string, unknown>) => {
        const endedAt = Date.now();

        this.events.push({
          id: createId("event"),
          traceId,
          spanId,
          type: params.type,
          name: params.name,
          status: "failed",
          timestamp: new Date(endedAt).toISOString(),
          durationMs: endedAt - startedAt,
          input: params.input,
          metadata: {
            ...params.metadata,
            ...metadata,
          },
          error: normalizeError(error),
        });
      },
    };
  }

  getEvents(): TraceEvent[] {
    return [...this.events];
  }

  clear() {
    this.events.length = 0;
  }
}

function createId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
```

---

## 十、理解 TraceRecorder

`TraceRecorder` 负责记录 trace。

最核心的方法是：

```ts
startSpan(params)
```

使用方式类似：

```ts
const span = traceRecorder.startSpan({
  type: "rag.retrieve",
  name: "retriever.similaritySearch",
  input: {
    question,
  },
});

try {
  const results = await retriever.similaritySearch(question, options);

  span.end({
    output: {
      resultCount: results.length,
    },
  });
} catch (error) {
  span.fail(error);
}
```

它会记录：

```text
started：开始事件
completed：完成事件
failed：失败事件
```

也就是说，一个 span 通常会产生两条事件：

```text
开始时一条 started
结束时一条 completed 或 failed
```

所以如果你看到：

```text
rag.retrieve total=2, completed=1
```

这是正常的。

因为它包含：

```text
rag.retrieve started
rag.retrieve completed
```

---

## 十一、新增 trace-report.ts

文件路径：

```text
src/lessons/lesson23-observability/observability/trace-report.ts
```

代码如下：

```ts
import type { TraceEvent } from "./trace-types.js";
import type { TraceRecorder } from "./trace-recorder.js";

export function printTraceReport(traceRecorder: TraceRecorder) {
  const events = traceRecorder.getEvents();

  printTraceSummary(events);
  printTraceDetails(events);
}

function printTraceSummary(events: TraceEvent[]) {
  const completedEvents = events.filter(
    (event) => event.status === "completed",
  );

  const failedEvents = events.filter((event) => event.status === "failed");

  const groupedByType = groupBy(events, (event) => event.type);

  console.log("\n========== Trace Summary ==========");
  console.log("事件总数：", events.length);
  console.log("完成事件数：", completedEvents.length);
  console.log("失败事件数：", failedEvents.length);
  console.log("Trace 数量：", new Set(events.map((event) => event.traceId)).size);

  console.log("\n按类型统计：");
  for (const [type, typeEvents] of Object.entries(groupedByType)) {
    const completedCount = typeEvents.filter(
      (event) => event.status === "completed",
    ).length;

    const failedCount = typeEvents.filter(
      (event) => event.status === "failed",
    ).length;

    console.log(
      `- ${type}: total=${typeEvents.length}, completed=${completedCount}, failed=${failedCount}`,
    );
  }
}

function printTraceDetails(events: TraceEvent[]) {
  const displayEvents = events.filter((event) => event.status !== "started");

  console.log("\n========== Trace Details ==========");

  for (const event of displayEvents) {
    console.log("\n----------------------------------------");
    console.log("traceId:", event.traceId);
    console.log("spanId:", event.spanId);
    console.log("type:", event.type);
    console.log("name:", event.name);
    console.log("status:", event.status);
    console.log("durationMs:", event.durationMs ?? "无");

    if (event.error) {
      console.log("error:", event.error);
    }

    if (event.metadata) {
      console.log("metadata:", JSON.stringify(event.metadata, null, 2));
    }

    if (event.output) {
      console.log("output:", JSON.stringify(event.output, null, 2));
    }
  }
}

function groupBy<T>(
  values: T[],
  getKey: (value: T) => string,
): Record<string, T[]> {
  return values.reduce<Record<string, T[]>>((record, value) => {
    const key = getKey(value);

    record[key] ??= [];
    record[key].push(value);

    return record;
  }, {});
}
```

---

## 十二、理解 TraceReport

`TraceReport` 分成两部分：

```text
Trace Summary
Trace Details
```

Summary 负责看总体情况：

```text
事件总数
完成事件数
失败事件数
Trace 数量
按类型统计
```

Details 负责看每个完成或失败的步骤：

```text
traceId
spanId
type
name
status
durationMs
metadata
output
error
```

这份报告可以帮助我们快速判断：

```text
哪一步耗时高？
哪一步失败了？
RAG 检索返回了几个结果？
评测用例是否通过？
工具调用是否成功？
```

---

## 十三、修改 rag-qa-chain.ts

文件路径：

```text
src/lessons/lesson23-observability/rag/rag-qa-chain.ts
```

第 23 课要给 RAG 执行过程加 trace。

代码如下：

```ts
import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import type { TraceRecorder } from "../observability/trace-recorder.js";
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

export type RagQaInvokeOptions = {
  traceId?: string;
};

export class RagQaChain {
  constructor(
    private readonly model: RagChatModel,
    private readonly retriever: RetrievalEngine,
    private readonly options: RagQaChainOptions,
    private readonly traceRecorder?: TraceRecorder,
  ) {}

  async invoke(
    question: string,
    invokeOptions?: RagQaInvokeOptions,
  ): Promise<RagQaAnswer> {
    const ragSpan = this.traceRecorder?.startSpan({
      traceId: invokeOptions?.traceId,
      type: "rag.invoke",
      name: "RagQaChain.invoke",
      input: {
        question,
      },
      metadata: {
        topK: this.options.topK,
        minScore: this.options.minScore,
      },
    });

    try {
      const retrieveSpan = this.traceRecorder?.startSpan({
        traceId: ragSpan?.traceId,
        type: "rag.retrieve",
        name: "retriever.similaritySearch",
        input: {
          question,
        },
        metadata: {
          topK: this.options.topK,
          minScore: this.options.minScore,
        },
      });

      const searchResults = await this.retriever.similaritySearch(question, {
        topK: this.options.topK,
        minScore: this.options.minScore,
      });

      retrieveSpan?.end({
        output: {
          resultCount: searchResults.length,
          sources: this.toSourceList(searchResults),
          topResults: this.toSearchResultSummaries(searchResults).map(
            (result) => ({
              title: result.title,
              source: result.source,
              score: Number(result.score.toFixed(4)),
              rerankScore:
                result.rerankScore === undefined
                  ? undefined
                  : Number(result.rerankScore.toFixed(4)),
            }),
          ),
        },
      });

      if (searchResults.length === 0) {
        const noEvidenceAnswer = this.createNoEvidenceAnswer(question);

        ragSpan?.end({
          output: {
            status: "no_evidence",
            resultCount: 0,
          },
        });

        return noEvidenceAnswer;
      }

      const contextSpan = this.traceRecorder?.startSpan({
        traceId: ragSpan?.traceId,
        type: "rag.context",
        name: "buildRagContext",
        input: {
          resultCount: searchResults.length,
        },
      });

      const context = buildRagContext(searchResults);

      contextSpan?.end({
        output: {
          contextLength: context.length,
        },
      });

      const generateSpan = this.traceRecorder?.startSpan({
        traceId: ragSpan?.traceId,
        type: "rag.generate",
        name: "model.invoke",
        input: {
          question,
          contextLength: context.length,
        },
      });

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

      const answer = String(response.content);

      generateSpan?.end({
        output: {
          answerPreview: answer.slice(0, 160),
        },
      });

      const result = {
        question,
        answer,
        context,
        searchResults: this.toSearchResultSummaries(searchResults),
      };

      ragSpan?.end({
        output: {
          status: "success",
          resultCount: searchResults.length,
          sources: this.toSourceList(searchResults),
          answerPreview: answer.slice(0, 160),
        },
      });

      return result;
    } catch (error) {
      ragSpan?.fail(error);
      throw error;
    }
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

  private toSourceList(results: RetrievalSearchResult[]): string[] {
    return Array.from(
      new Set(results.map((result) => result.chunkEmbedding.chunk.source)),
    );
  }
}
```

---

## 十四、RagQaChain 现在记录了什么？

现在一次 RAG 调用会记录这些 span：

```text
rag.invoke：RAG 总调用
rag.retrieve：检索过程
rag.context：context 构造过程
rag.generate：模型生成过程
```

如果检索没有结果，则不会进入：

```text
rag.context
rag.generate
```

这很重要。

因为我们可以通过 trace 判断：

```text
这个问题是否真的调用了模型？
是否因为没有检索结果提前返回？
检索返回了几个 source？
context 长度是多少？
生成答案耗时多少？
```

---

## 十五、修改 rag-evaluator.ts

文件路径：

```text
src/lessons/lesson23-observability/evaluation/rag-evaluator.ts
```

给评测过程也加上 trace。

代码如下：

```ts
import type { TraceRecorder } from "../observability/trace-recorder.js";
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
  constructor(
    private readonly ragQaChain: RagQaChain,
    private readonly traceRecorder?: TraceRecorder,
  ) {}

  async evaluateCase(
    testCase: EvaluationCase,
    traceId?: string,
  ): Promise<EvaluationResult> {
    const caseSpan = this.traceRecorder?.startSpan({
      traceId,
      type: "evaluation.case",
      name: testCase.id,
      input: {
        question: testCase.question,
      },
      metadata: {
        expectedSources: testCase.expectedSources,
        shouldHaveEvidence: testCase.shouldHaveEvidence,
        note: testCase.note,
      },
    });

    try {
      const answer = await this.ragQaChain.invoke(testCase.question, {
        traceId: caseSpan?.traceId,
      });

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

      const result = {
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

      caseSpan?.end({
        output: {
          passed: result.passed,
          expectedSources: result.expectedSources,
          actualSources: result.actualSources,
          hasEvidence: result.hasEvidence,
          failureReason: result.failureReason || undefined,
        },
      });

      return result;
    } catch (error) {
      caseSpan?.fail(error);
      throw error;
    }
  }

  async evaluateAll(testCases: EvaluationCase[]): Promise<EvaluationResult[]> {
    const runSpan = this.traceRecorder?.startSpan({
      type: "evaluation.run",
      name: "RagEvaluator.evaluateAll",
      input: {
        caseCount: testCases.length,
      },
    });

    try {
      const results: EvaluationResult[] = [];

      for (const testCase of testCases) {
        const result = await this.evaluateCase(testCase, runSpan?.traceId);
        results.push(result);
      }

      runSpan?.end({
        output: {
          total: results.length,
          passed: results.filter((result) => result.passed).length,
          failed: results.filter((result) => !result.passed).length,
        },
      });

      return results;
    } catch (error) {
      runSpan?.fail(error);
      throw error;
    }
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

## 十六、RagEvaluator 现在记录了什么？

现在评测会记录：

```text
evaluation.run：整次评测运行
evaluation.case：每条评测用例
```

每条用例会记录：

```text
question
expectedSources
shouldHaveEvidence
actualSources
hasEvidence
passed
failureReason
```

这样一旦某条用例失败，我们不仅能看评测报告，还能看 trace 链路中对应的 RAG 检索过程。

---

## 十七、修改 search-knowledge-base.tool.ts

文件路径：

```text
src/lessons/lesson23-observability/tools/search-knowledge-base.tool.ts
```

给工具调用加 trace。

代码如下：

```ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { TraceRecorder } from "../observability/trace-recorder.js";
import type { RagQaChain } from "../rag/rag-qa-chain.js";

export function createSearchKnowledgeBaseTool(
  ragQaChain: RagQaChain,
  traceRecorder?: TraceRecorder,
) {
  return tool(
    async ({ query }) => {
      const toolSpan = traceRecorder?.startSpan({
        type: "tool.call",
        name: "search_knowledge_base",
        input: {
          query,
        },
      });

      try {
        const answer = await ragQaChain.invoke(query, {
          traceId: toolSpan?.traceId,
        });

        const payload = {
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
        };

        toolSpan?.end({
          output: {
            status: payload.status,
            sourceCount: payload.sources.length,
            sources: payload.sources.map((source) => source.source),
          },
        });

        return JSON.stringify(payload, null, 2);
      } catch (error) {
        toolSpan?.fail(error);
        throw error;
      }
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

## 十八、工具调用现在记录了什么？

现在调用 `search_knowledge_base` 时会记录：

```text
tool.call started
tool.call completed
```

并记录：

```text
query
status
sourceCount
sources
```

因为工具内部会调用 `RagQaChain`，所以同一个 trace 下还会出现：

```text
rag.invoke
rag.retrieve
rag.context
rag.generate
```

这样就能看到工具调用内部发生了什么。

---

## 十九、修改 tools/index.ts

文件路径：

```text
src/lessons/lesson23-observability/tools/index.ts
```

让工具创建时可以传入 `traceRecorder`。

代码如下：

```ts
import type { StructuredToolInterface } from "@langchain/core/tools";

import type { TraceRecorder } from "../observability/trace-recorder.js";
import type { RagQaChain } from "../rag/rag-qa-chain.js";
import { createTicketTool } from "./create-ticket.tool.js";
import { createSearchKnowledgeBaseTool } from "./search-knowledge-base.tool.js";

export function createTools(params: {
  ragQaChain: RagQaChain;
  traceRecorder?: TraceRecorder;
}): StructuredToolInterface[] {
  return [
    createSearchKnowledgeBaseTool(
      params.ragQaChain,
      params.traceRecorder,
    ),
    createTicketTool,
  ];
}
```

---

## 二十、修改 rag-runtime.ts

文件路径：

```text
src/lessons/lesson23-observability/rag-runtime.ts
```

让 `RagQaChain` 接收 `traceRecorder`。

代码如下：

```ts
import path from "node:path";

import type { TraceRecorder } from "./observability/trace-recorder.js";
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
  traceRecorder?: TraceRecorder;
}): Promise<RagRuntime> {
  const docsDir = path.resolve(
    process.cwd(),
    "src/lessons/lesson23-observability/documents",
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

  const ragQaChain = new RagQaChain(
    params.model,
    rerankedRetriever,
    {
      topK: 3,
      minScore: 0.3,
    },
    params.traceRecorder,
  );

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

## 二十一、修改 index.ts

文件路径：

```text
src/lessons/lesson23-observability/index.ts
```

第 23 课会做两件事：

```text
1. 运行第 22 课的 Evaluation
2. 单独调用一次 search_knowledge_base 工具，演示 tool call trace
```

代码如下：

```ts
import { evaluationDataset } from "./evaluation/evaluation-dataset.js";
import { printEvaluationReport } from "./evaluation/evaluation-report.js";
import { RagEvaluator } from "./evaluation/rag-evaluator.js";
import { createModel } from "./model/create-model.js";
import { printTraceReport } from "./observability/trace-report.js";
import { TraceRecorder } from "./observability/trace-recorder.js";
import { createRagRuntime } from "./rag-runtime.js";
import { createTools } from "./tools/index.js";

async function main() {
  const traceRecorder = new TraceRecorder();

  const model = createModel();

  const ragRuntime = await createRagRuntime({
    model,
    traceRecorder,
  });

  console.log("\n========== Observability Demo 初始化完成 ==========");
  console.log("检索模式：", ragRuntime.retrievalMode);
  console.log("文档数量：", ragRuntime.documentCount);
  console.log("Chunk 数量：", ragRuntime.chunkCount);
  console.log("Embedding 数量：", ragRuntime.embeddingCount);
  console.log("评测用例数量：", evaluationDataset.length);

  const evaluator = new RagEvaluator(
    ragRuntime.ragQaChain,
    traceRecorder,
  );

  const results = await evaluator.evaluateAll(evaluationDataset);

  printEvaluationReport(results);

  const tools = createTools({
    ragQaChain: ragRuntime.ragQaChain,
    traceRecorder,
  });

  const searchKnowledgeBaseTool = tools.find(
    (item) => item.name === "search_knowledge_base",
  );

  if (!searchKnowledgeBaseTool) {
    throw new Error("未找到 search_knowledge_base 工具");
  }

  console.log("\n========== Tool Call Observability Demo ==========");

  const toolResult = await searchKnowledgeBaseTool.invoke({
    query: "agent-tool-policy.md 里关于工具调用安全是怎么说的？",
  });

  console.log(toolResult);

  printTraceReport(traceRecorder);
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 二十二、如果只想运行一个评测用例

第 23 课的日志会比较多。

如果一次运行全部评测集，输出可能很杂。

可以把：

```ts
const results = await evaluator.evaluateAll(evaluationDataset);
```

改成只运行一个用例：

```ts
const targetCase = evaluationDataset[0];

if (!targetCase) {
  throw new Error("评测集为空，无法运行单条评测。");
}

const result = await evaluator.evaluateCase(targetCase);

printEvaluationReport([result]);
```

这样就只会运行：

```text
evaluationDataset[0]
```

如果想按 `id` 找，更推荐：

```ts
const targetCase = evaluationDataset.find(
  (item) => item.id === "rag-optimization-semantic",
);

if (!targetCase) {
  throw new Error("未找到指定评测用例。");
}

const result = await evaluator.evaluateCase(targetCase);

printEvaluationReport([result]);
```

这样比记数组下标更稳。

---

## 二十三、运行第 23 课

执行：

```bash
pnpm lesson:23
```

你会看到三部分输出。

第一部分是初始化信息：

```text
========== Observability Demo 初始化完成 ==========
检索模式： hybrid_with_rerank
文档数量： 3
Chunk 数量： 若干
Embedding 数量： 若干
评测用例数量： 7
```

第二部分是第 22 课已有的评测报告：

```text
========== RAG Evaluation Summary ==========
总用例数： 7
通过数量： ...
失败数量： ...
通过率： ...
```

第三部分是 Trace Report：

```text
========== Trace Summary ==========
事件总数： ...
完成事件数： ...
失败事件数： ...
Trace 数量： ...

按类型统计：
- evaluation.run: total=2, completed=1, failed=0
- evaluation.case: total=14, completed=7, failed=0
- rag.invoke: ...
- rag.retrieve: ...
- rag.context: ...
- rag.generate: ...
- tool.call: ...
```

这里的 `total=2` 并不是执行了两次，而是因为一次 span 会记录：

```text
started
completed
```

两条事件。

---

## 二十四、如何看 Trace Report？

重点看三个地方。

### 1. 失败事件数

```text
失败事件数： 0
```

如果这里不是 0，说明某个步骤异常了。

可以去 Details 里找：

```text
status: failed
error: ...
```

---

### 2. rag.retrieve 的输出

重点看：

```text
resultCount
sources
topResults
```

如果评测失败，先看 `rag.retrieve` 有没有命中预期 source。

例如：

```text
expectedSources: knowledge-base-guide.md
actualSources: rag-optimization.md
```

那就说明问题出在检索或 rerank。

---

### 3. evaluation.case 的输出

重点看：

```text
passed
expectedSources
actualSources
hasEvidence
failureReason
```

这可以直接定位是哪条用例失败。

---

## 二十五、为什么同一个 source 会出现多次？

在第 23 课观察日志时，你可能会看到：

```text
Top 1 source: knowledge-base-guide.md
Top 2 source: knowledge-base-guide.md
```

这是正常现象。

因为 RAG 检索单位是 chunk，不是完整文档。

流程是：

```text
Markdown 文档
  ↓
切分成多个 chunk
  ↓
每个 chunk 独立生成 embedding
  ↓
每个 chunk 独立参与检索和 rerank
```

所以同一个文档可能有多个 chunk 被召回。

它们的：

```text
title
source
```

可能一样，但：

```text
chunkId
content
contentPreview
score
```

不同。

分数不同，是因为每个 chunk 的内容不同，和用户问题的相关性也不同。

---

## 二十六、第 23 课和第 22 课的区别

第 22 课：

```text
告诉我们结果好不好
```

第 23 课：

```text
告诉我们过程发生了什么
```

第 22 课关注：

```text
Evaluation Result
```

第 23 课关注：

```text
Trace / Observability
```

可以简单理解为：

```text
Evaluation：结果层
Observability：过程层
```

两者配合起来，才有工程化调优能力。

---

## 二十七、Java 后端视角理解

可以把第 23 课理解成给服务加调用链日志。

在 Java 后端中，可能会有类似：

```java
TraceSpan span = tracer.startSpan("rag.retrieve");

try {
    List<SearchResult> results = retriever.search(query);

    span.end(Map.of(
        "resultCount", results.size(),
        "sources", results.stream().map(SearchResult::getSource).toList()
    ));
} catch (Exception e) {
    span.fail(e);
    throw e;
}
```

对应本节 TypeScript：

```text
TraceRecorder → tracer
TraceEvent → span event
TraceReport → 控制台观测报告
```

本质上就是：

```text
为关键步骤加结构化日志。
```

真实项目中也是类似思想，只是一般不会自己写 `TraceRecorder`，而是接入：

```text
LangSmith
OpenTelemetry
日志平台
APM
链路追踪系统
```

---

## 二十八、企业级 Observability 的价值

在真实企业项目里，Agent 和 RAG 的可观测性非常重要。

因为线上问题通常不是简单的代码报错，而是链路效果问题。

例如：

```text
用户说答案不准
用户说知识库明明有资料却没查到
用户说 Agent 创建了错误工单
用户说系统一直重复调用工具
用户说回答引用了无关文档
```

这时如果没有 trace，就很难排查。

有了 trace，可以快速定位：

```text
用户原始问题是什么
Agent 调用了哪个工具
工具参数是什么
检索召回了哪些 chunk
rerank 后排序是什么
最终 context 有多长
模型生成了什么
哪个步骤耗时最高
哪一步出现异常
```

这就是从 Demo 走向工程系统必须补的一层能力。

---

## 二十九、TypeScript Tips

### 1. 字面量联合类型

```ts
export type TraceEventStatus = "started" | "completed" | "failed";
```

这样可以限制 status 只能是这三个值，避免拼写错误。

---

### 2. unknown 用于通用输入输出

```ts
input?: unknown;
output?: unknown;
```

Trace 系统要记录不同类型的数据，所以这里用 `unknown`。

比 `any` 更安全。

---

### 3. 可选依赖

```ts
private readonly traceRecorder?: TraceRecorder
```

`traceRecorder` 是可选的。

这样没有 trace 的时候，原来的 RAG 仍然能运行。

---

### 4. 可选调用

```ts
ragSpan?.end(...)
```

如果 `ragSpan` 不存在，不会报错。

这适合处理可选 observability 能力。

---

### 5. Record 类型

```ts
metadata?: Record<string, unknown>;
```

`Record<string, unknown>` 表示：

```text
key 是 string
value 是 unknown
```

适合表示灵活的结构化元数据。

---

### 6. groupBy 泛型函数

```ts
function groupBy<T>(
  values: T[],
  getKey: (value: T) => string,
): Record<string, T[]> {
  // ...
}
```

这是一个通用工具函数。

任何数组都可以传进来，只要提供 `getKey`。

---

### 7. node:crypto 的 randomUUID

```ts
import { randomUUID } from "node:crypto";
```

这里用它生成 traceId、spanId、eventId。

这样每条事件都有唯一 ID。

---

## 三十、本节总结

第 23 课完成了最小 Observability 能力。

核心收获：

```text
1. Evaluation 告诉我们结果好不好
2. Observability 告诉我们过程发生了什么
3. TraceEvent 用于描述一次运行事件
4. TraceRecorder 用于记录 started / completed / failed
5. RagQaChain 可以记录检索、上下文构造、模型生成过程
6. RagEvaluator 可以记录每条评测用例的执行过程
7. search_knowledge_base 工具可以记录 tool call 过程
8. TraceReport 可以帮助我们观察失败原因和关键中间结果
9. 同一个 source 出现多次通常是因为同一文档被切成了多个 chunk
```

本节最重要的一句话：

> 没有 Observability，RAG 和 Agent 的问题就只能靠猜。

---

## 三十一、下一课预告

下一课进入：

# 第 24 课：API Server 入门，把 Agent Demo 封装成 HTTP 服务

第 23 课完成的是：

```text
让 RAG 和 Agent 的运行过程可观测
```

第 24 课会开始把前面的 Demo 服务化。

主要内容包括：

```text
1. 引入 Fastify
2. 新增 /health 接口
3. 新增 /api/rag/ask 接口
4. 复用 RagQaChain
5. 返回 answer、sources、traceId
6. 为后续前端 UI 做准备
```

到第 24 课开始，我们会从命令行 Demo 逐步过渡到真正可以被前端调用的 API 服务。
