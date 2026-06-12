# 第 18 课：RAG QA Chain，把检索结果交给模型生成答案

## 前言

第 17 课我们完成了内存版 Vector Store。

到目前为止，RAG 这条链路已经走到了“检索”阶段：

```text id="7zssz7"
用户问题
  ↓
embedQuery
  ↓
queryVector
  ↓
MemoryVectorStore.similaritySearch
  ↓
相关 chunk
```

也就是说，第 17 课解决的是：

```text id="ihzgc7"
如何从知识库中找到和用户问题最相关的资料？
```

但是 RAG 不只是检索。

真正的知识库问答还需要继续往后走一步：

```text id="v3l551"
找到资料
  ↓
拼接上下文
  ↓
交给 Chat Model
  ↓
生成最终答案
```

所以第 18 课要完成一个最小可用的 RAG QA Chain。

它会把前面几课的能力串起来：

```text id="53rbmk"
文档加载
  ↓
文档切分
  ↓
Embedding
  ↓
Vector Store 检索
  ↓
Context 构造
  ↓
Chat Model 回答
```

这一课完成后，我们就真正拥有了一个最小版企业知识库问答链路。

---

## 一、本节目标

本节主要完成以下内容：

```text id="8w6n67"
1. 复用第 17 课的 MemoryVectorStore
2. 新增 RAG context builder
3. 新增 RagQaChain
4. 使用 similaritySearch 检索相关 chunk
5. 把检索结果拼成 context
6. 调用 Chat Model 生成最终答案
7. 如果检索不到可靠资料，直接返回无依据回答
8. 为第 19 课“把 RAG 封装成 Tool”做准备
```

第 17 课解决的是：

```text id="pfd5v1"
如何找到相关资料？
```

第 18 课解决的是：

```text id="v3vqcs"
找到资料后，如何基于资料生成可靠答案？
```

这一课的核心思想是：

> 先找资料，再让模型基于资料回答；没有资料，就不要编造。

---

## 二、RAG QA Chain 是什么？

可以把 RAG QA Chain 理解成一个知识库问答服务。

它的职责是：

```text id="v8lqkd"
接收用户问题
  ↓
去知识库里找相关资料
  ↓
把资料整理成上下文
  ↓
让大模型基于上下文回答
  ↓
返回答案和引用来源
```

它不是单纯调用模型。

也不是单纯检索文档。

它是一个编排层。

前面几课分别完成了 RAG 的不同零件：

```text id="nbq5kf"
第 15 课：文档加载与切分
第 16 课：把 chunk 转成向量
第 17 课：用向量相似度检索相关 chunk
第 18 课：把检索结果交给模型生成答案
```

到第 18 课，RAG 才真正形成闭环。

---

## 三、本节整体流程

第 18 课的完整流程是：

```text id="4f13q6"
Markdown 文档
  ↓
loadMarkdownDocuments
  ↓
LoadedDocument[]
  ↓
splitDocumentsIntoChunks
  ↓
DocumentChunk[]
  ↓
embedChunks
  ↓
ChunkEmbedding[]
  ↓
MemoryVectorStore
  ↓
similaritySearch(question)
  ↓
SimilaritySearchResult[]
  ↓
buildRagContext
  ↓
Chat Model
  ↓
RagQaAnswer
```

和第 17 课相比，本节新增的是：

```text id="ku6d50"
buildRagContext
RagQaChain
Chat Model 生成答案
无依据拒答策略
```

第 17 课只负责：

```text id="umw86u"
找到相关 chunk
```

第 18 课负责：

```text id="3r9ij1"
基于相关 chunk 生成最终答案
```

---

## 四、本节目录结构

第 18 课直接基于第 17 课复制。

创建目录：

```bash id="0n0oxh"
cp -r src/lessons/lesson17-memory-vector-store src/lessons/lesson18-rag-qa-chain
```

Windows PowerShell：

```powershell id="haw9hz"
Copy-Item -Recurse src/lessons/lesson17-memory-vector-store src/lessons/lesson18-rag-qa-chain
```

新增两个目录：

```bash id="f5k5fo"
mkdir -p src/lessons/lesson18-rag-qa-chain/{rag,model}
```

第 18 课需要重新使用聊天模型，所以把前面课程中的 `model/create-model.ts` 复制过来即可。

```bash id="fqw8jr"
cp src/lessons/lesson14-rag-introduction/model/create-model.ts src/lessons/lesson18-rag-qa-chain/model/create-model.ts
```

Windows PowerShell：

```powershell id="stpdch"
Copy-Item src/lessons/lesson14-rag-introduction/model/create-model.ts src/lessons/lesson18-rag-qa-chain/model/create-model.ts
```

最终目录结构：

```text id="elc786"
src/lessons/lesson18-rag-qa-chain/
  documents/
    knowledge-base-guide.md
    rag-optimization.md
    agent-tool-policy.md

  loader/
    markdown-loader.ts
    text-splitter.ts

  embedding/
    create-embedding-model.ts
    chunk-embedding.ts

  vector-store/
    cosine-similarity.ts
    memory-vector-store.ts

  model/
    create-model.ts

  rag/
    rag-context-builder.ts
    rag-qa-chain.ts

  index.ts
```

这些文件从第 17 课复制即可，不需要修改：

```text id="x1hvgk"
documents/knowledge-base-guide.md
documents/rag-optimization.md
documents/agent-tool-policy.md
loader/markdown-loader.ts
loader/text-splitter.ts
embedding/create-embedding-model.ts
embedding/chunk-embedding.ts
vector-store/cosine-similarity.ts
vector-store/memory-vector-store.ts
```

`model/create-model.ts` 从第 14 课复制即可，不需要重新写。

本节重点新增或修改：

```text id="nl1bqb"
rag/rag-context-builder.ts
rag/rag-qa-chain.ts
index.ts
package.json
```

---

## 五、配置 package.json

在 `package.json` 中新增第 18 课脚本：

```json id="p9cqgo"
{
  "scripts": {
    "lesson:18": "tsx src/lessons/lesson18-rag-qa-chain/index.ts"
  }
}
```

运行第 18 课：

```bash id="7yzp6n"
pnpm lesson:18
```

---

## 六、新增 rag-context-builder.ts

文件路径：

```text id="ym0nrw"
src/lessons/lesson18-rag-qa-chain/rag/rag-context-builder.ts
```

代码如下：

```ts id="o0pbnu"
import type { SimilaritySearchResult } from "../vector-store/memory-vector-store.js";

export function buildRagContext(results: SimilaritySearchResult[]): string {
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
        `相似度分数：${score.toFixed(4)}`,
        `内容：${chunk.content}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}
```

---

## 七、理解 rag-context-builder

第 17 课中的检索结果是结构化对象：

```ts id="gh4ej9"
SimilaritySearchResult[]
```

每一条结果中包含：

```text id="b8fpel"
chunkEmbedding
score
```

但是 Chat Model 更适合接收文本上下文，而不是复杂对象。

所以 `buildRagContext` 的作用是：

```text id="gvv9yi"
把检索结果转换成模型可以阅读的资料上下文。
```

例如它会把检索结果拼成：

```text id="y8q41l"
资料 1
标题：RAG 检索效果不好怎么办
来源：rag-optimization.md
相似度分数：0.8123
内容：如果 RAG 检索效果不好，可以从文档切分、Embedding 模型、召回数量、关键词补充、重排序、Prompt 约束等方面优化。

---

资料 2
标题：Agent 工具调用规范
来源：agent-tool-policy.md
相似度分数：0.7231
内容：操作型工具应结合权限控制和人工确认。
```

这个 context 会被放进 Prompt 里，交给模型作为回答依据。

---

## 八、为什么 context 要带来源和分数？

本节的 context 中包含：

```text id="h5wlng"
标题
来源
相似度分数
内容
```

其中最重要的是：

```text id="d6g751"
来源
内容
```

来源用于让模型在答案最后给出参考资料。

内容用于让模型基于资料回答。

相似度分数主要用于调试和观察。

在真实项目中，相似度分数不一定要暴露给终端用户，但对开发和排查很有帮助。

例如当回答不准确时，可以先看：

```text id="pvvaxh"
是不是检索结果本身就不相关？
是不是 topK 太大？
是不是 minScore 太低？
是不是 chunk 切分质量不好？
```

---

## 九、新增 rag-qa-chain.ts

文件路径：

```text id="ucyrwb"
src/lessons/lesson18-rag-qa-chain/rag/rag-qa-chain.ts
```

代码如下：

```ts id="1a4ws9"
import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import { buildRagContext } from "./rag-context-builder.js";
import type {
  MemoryVectorStore,
  SimilaritySearchResult,
} from "../vector-store/memory-vector-store.js";

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
    private readonly vectorStore: MemoryVectorStore,
    private readonly options: RagQaChainOptions,
  ) {}

  async invoke(question: string): Promise<RagQaAnswer> {
    const searchResults = await this.vectorStore.similaritySearch(question, {
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

  private toSearchResultSummaries(results: SimilaritySearchResult[]) {
    return results.map((result) => {
      const { chunkEmbedding, score } = result;
      const { chunk } = chunkEmbedding;

      return {
        chunkId: chunk.id,
        title: chunk.title,
        source: chunk.source,
        score,
        contentPreview: chunk.content.slice(0, 120),
      };
    });
  }
}
```

---

## 十、理解 RagQaChain

`RagQaChain` 是第 18 课的核心。

它把三个动作串起来：

```text id="veztyn"
1. 检索相关资料
2. 构造资料上下文
3. 调用模型生成答案
```

核心代码是：

```ts id="wpkolo"
const searchResults = await this.vectorStore.similaritySearch(question, {
  topK: this.options.topK,
  minScore: this.options.minScore,
});

const context = buildRagContext(searchResults);

const response = await this.model.invoke([...]);
```

这就是一个完整的 RAG QA 主流程。

可以简单理解为：

```text id="3vmo8t"
RagQaChain = Retriever + Context Builder + Chat Model
```

---

## 十一、理解 RagQaAnswer

`RagQaChain` 最终返回的是：

```ts id="zjsx6h"
export type RagQaAnswer = {
  question: string;
  answer: string;
  context: string;
  searchResults: {
    chunkId: string;
    title: string;
    source: string;
    score: number;
    contentPreview: string;
  }[];
};
```

字段含义：

```text id="yfapsq"
question：用户问题
answer：最终回答
context：拼接后的资料上下文
searchResults：检索结果摘要
```

为什么要返回 `context` 和 `searchResults`？

因为开发 RAG 系统时，不能只看最终答案。

还要能排查：

```text id="12pv2z"
检索到了哪些资料？
资料是否相关？
分数是否合理？
模型有没有基于资料回答？
```

所以本节把中间结果也返回出来，方便调试。

---

## 十二、为什么要有 minScore？

第 17 课我们提过一个问题：

```text id="78wu2g"
Vector Store 总会返回 topK，但 topK 不一定可靠。
```

例如用户问：

```text id="fcbkca"
接口响应很慢应该怎么排查？
```

但当前知识库里没有接口性能排查文档。

如果不设置阈值，系统仍然会返回几个“相对最像”的 chunk。

这些 chunk 不一定真的能回答问题。

如果把它们交给模型，模型可能会硬答，甚至编造。

所以第 18 课在 `RagQaChainOptions` 中加入：

```ts id="no44nw"
export type RagQaChainOptions = {
  topK: number;
  minScore: number;
};
```

调用检索时传入：

```ts id="qu2msz"
minScore: this.options.minScore
```

如果没有任何结果达到阈值：

```ts id="fj5l6p"
if (searchResults.length === 0) {
  return this.createNoEvidenceAnswer(question);
}
```

直接返回无依据回答。

---

## 十三、为什么无依据时不调用模型？

当检索结果为空时，本节直接返回：

```ts id="2a7j6x"
return this.createNoEvidenceAnswer(question);
```

而不是继续调用 Chat Model。

原因是：

```text id="yvwpqx"
没有资料上下文时，模型容易依靠自身知识编造答案。
```

企业知识库问答追求的不是“什么都能说两句”，而是：

```text id="31ixsb"
有资料就基于资料回答
没有资料就明确说没有可靠依据
```

所以这里采用的是：

```text id="b8ghij"
没有可靠资料 → 不调用模型 → 直接拒答
```

这是一种非常重要的企业 RAG 安全策略。

---

## 十四、理解 Prompt 设计

本节的系统提示词是：

```text id="qk6ieq"
你是一个企业知识库问答助手。

回答规则：
1. 必须优先基于【资料上下文】回答。
2. 如果资料上下文中没有相关信息，请明确说“当前知识库中没有找到可靠依据”。
3. 不要编造企业内部制度、系统能力、接口说明。
4. 回答要简洁、清晰，适合企业内部用户阅读。
5. 回答最后请列出参考来源，格式为“参考来源：xxx”。
```

这里有几个关键点。

### 1. 要求基于资料回答

```text id="3rnywz"
必须优先基于【资料上下文】回答。
```

这句话的作用是把模型限制在资料范围内。

---

### 2. 要求不要编造

```text id="mub6gr"
不要编造企业内部制度、系统能力、接口说明。
```

企业知识库问答最怕的不是回答慢，而是一本正经地胡说。

所以这个约束很重要。

---

### 3. 要求给出来源

```text id="pznmgb"
回答最后请列出参考来源，格式为“参考来源：xxx”。
```

RAG 的一个重要价值就是可追溯。

用户不仅要知道答案，还要知道答案来自哪里。

---

## 十五、修改 index.ts

文件路径：

```text id="os7qa4"
src/lessons/lesson18-rag-qa-chain/index.ts
```

代码如下：

```ts id="ce9gix"
import path from "node:path";

import { createEmbeddingModel } from "./embedding/create-embedding-model.js";
import { embedChunks } from "./embedding/chunk-embedding.js";
import { loadMarkdownDocuments } from "./loader/markdown-loader.js";
import { splitDocumentsIntoChunks } from "./loader/text-splitter.js";
import { createModel } from "./model/create-model.js";
import { RagQaChain } from "./rag/rag-qa-chain.js";
import { MemoryVectorStore } from "./vector-store/memory-vector-store.js";

async function main() {
  const docsDir = path.resolve(
    process.cwd(),
    "src/lessons/lesson18-rag-qa-chain/documents",
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

  const model = createModel();

  const ragQaChain = new RagQaChain(model, vectorStore, {
    topK: 3,
    minScore: 0.3,
  });

  console.log("\n========== RAG QA Chain 初始化完成 ==========");
  console.log("文档数量：", documents.length);
  console.log("Chunk 数量：", chunks.length);
  console.log("Embedding 数量：", chunkEmbeddings.length);

  const questions = [
    "知识库可以接入哪些类型的资料？",
    "知识库召回不准应该怎么优化？",
    "创建工单前需要做哪些安全控制？",
    "接口响应很慢应该怎么排查？",
  ];

  for (const question of questions) {
    console.log("\n\n========================================");
    console.log("用户问题：", question);

    const answer = await ragQaChain.invoke(question);

    console.log("\n========== 检索结果 ==========");
    console.log(
      answer.searchResults.map((result) => ({
        chunkId: result.chunkId,
        title: result.title,
        source: result.source,
        score: result.score.toFixed(4),
        contentPreview: result.contentPreview,
      })),
    );

    console.log("\n========== 资料上下文 ==========");
    console.log(answer.context || "无");

    console.log("\n========== RAG 最终回答 ==========");
    console.log(answer.answer);
  }
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 十六、理解 index.ts

入口文件整体分成两部分。

第一部分是初始化 RAG 数据链路：

```ts id="m74bag"
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
```

这部分负责：

```text id="6p3vsl"
加载文档
切分 chunk
生成向量
初始化 Vector Store
```

第二部分是初始化问答链：

```ts id="hk9s3v"
const model = createModel();

const ragQaChain = new RagQaChain(model, vectorStore, {
  topK: 3,
  minScore: 0.3,
});
```

这里把：

```text id="deries"
Chat Model
MemoryVectorStore
topK
minScore
```

组合成一个完整的 `RagQaChain`。

之后就可以通过：

```ts id="sxqkzw"
const answer = await ragQaChain.invoke(question);
```

完成一次 RAG 问答。

---

## 十七、运行第 18 课

执行：

```bash id="5p6bqa"
pnpm lesson:18
```

你会看到类似输出：

```text id="cb4z4p"
========== RAG QA Chain 初始化完成 ==========
文档数量： 3
Chunk 数量： 8
Embedding 数量： 8
```

然后会依次测试四个问题：

```text id="oi8qfl"
1. 知识库可以接入哪些类型的资料？
2. 知识库召回不准应该怎么优化？
3. 创建工单前需要做哪些安全控制？
4. 接口响应很慢应该怎么排查？
```

每个问题都会打印：

```text id="f4kou2"
检索结果
资料上下文
RAG 最终回答
```

---

## 十八、测试问题 1：知识库可以接入哪些类型的资料？

问题：

```text id="2l75b2"
知识库可以接入哪些类型的资料？
```

预期流程：

```text id="berwto"
similaritySearch
  ↓
命中“企业知识库支持的数据源”
  ↓
构造 context
  ↓
模型基于资料回答
```

预期回答类似：

```text id="fk8nve"
企业知识库当前可以接入 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等资料。后续还计划扩展数据库表、工单系统数据和接口文档。

参考来源：knowledge-base-guide.md
```

这个问题验证的是：

```text id="x4reia"
RAG 能否基于知识库资料回答数据源相关问题。
```

---

## 十九、测试问题 2：知识库召回不准应该怎么优化？

问题：

```text id="uoo5h8"
知识库召回不准应该怎么优化？
```

预期命中：

```text id="675u3n"
RAG 检索效果不好怎么办
```

预期回答会提到：

```text id="ckrrsq"
文档切分
Embedding 模型
召回数量
关键词补充
重排序
Prompt 约束
混合检索
```

这个问题验证的是：

```text id="571rj1"
用户表达和文档原文不完全一样时，语义检索是否仍然能找到相关资料。
```

---

## 二十、测试问题 3：创建工单前需要做哪些安全控制？

问题：

```text id="aokwmr"
创建工单前需要做哪些安全控制？
```

预期命中：

```text id="dqy8os"
Agent 工具调用规范
```

预期回答会提到：

```text id="e3g8a9"
操作型工具应结合权限控制和人工确认
创建工单前应该先检查用户权限
再根据风险等级决定是否需要人工确认
工具入参必须通过 schema 校验
工具执行失败时需要有兜底响应
```

这个问题把前面第 12、13 课的安全机制串起来了：

```text id="mf7y30"
第 12 课：Human-in-the-loop
第 13 课：工具权限控制
第 18 课：通过 RAG 从知识库资料中回答相关问题
```

---

## 二十一、测试问题 4：接口响应很慢应该怎么排查？

问题：

```text id="zcmov0"
接口响应很慢应该怎么排查？
```

当前文档里没有接口性能排查相关资料。

如果所有检索结果都低于：

```ts id="ftv9ae"
minScore: 0.3
```

则会直接返回：

```text id="hcgq46"
当前知识库中没有找到可靠依据，无法基于已有资料回答这个问题。建议补充相关文档后再查询。
```

这就是第 18 课新增的拒答策略。

相比直接让模型回答，这种方式更适合企业知识库场景。

因为企业内部问答更重视：

```text id="0id3ir"
可靠性
可追溯
不编造
```

---

## 二十二、第 18 课和第 17 课的区别

第 17 课：

```text id="8nwl6v"
只检索，不回答
```

第 18 课：

```text id="bja7p9"
先检索，再回答
```

第 17 课输出的是：

```ts id="vsuqzo"
SimilaritySearchResult[]
```

第 18 课输出的是：

```ts id="lq485j"
RagQaAnswer
```

可以这样理解：

```text id="i1dmyw"
第 17 课：Retriever 阶段
第 18 课：Retriever + Generator 阶段
```

第 18 课已经形成了一个完整的最小 RAG 问答闭环。

---

## 二十三、RAG QA Chain 的工程结构

第 18 课代码可以拆成三个层次。

### 1. 数据处理层

```text id="gf06gk"
loadMarkdownDocuments
splitDocumentsIntoChunks
embedChunks
```

负责把原始文档变成向量数据。

---

### 2. 检索层

```text id="73x7fc"
MemoryVectorStore
similaritySearch
```

负责根据用户问题找到相关 chunk。

---

### 3. 生成层

```text id="yocdze"
RagQaChain
buildRagContext
Chat Model
```

负责基于检索资料生成最终答案。

这样的拆分有一个好处：

```text id="yih8ax"
每一层都可以单独替换。
```

例如后续可以：

```text id="q2theo"
把 MemoryVectorStore 替换成真实向量数据库
把本地 documents 替换成企业文档系统
把 createModel 替换成其他聊天模型
把 buildRagContext 改成更复杂的引用格式
```

---

## 二十四、为什么第 18 课很关键？

第 18 课是 RAG 阶段的一个分水岭。

第 14 课只是用内存数组模拟 RAG。

第 15 课开始处理真实文档。

第 16 课生成向量。

第 17 课实现语义检索。

第 18 课把检索和生成串起来。

所以从这一课开始，这个 Demo 已经不只是“局部能力练习”，而是形成了一个最小可用的知识库问答系统。

可以简单理解为：

```text id="bd9x4d"
第 15 课：资料进来
第 16 课：资料向量化
第 17 课：资料找出来
第 18 课：资料变答案
```

---

## 二十五、Java 后端视角理解

可以把第 18 课理解成一个完整的知识库问答服务。

如果用 Java 类比，大概是：

```java id="y893ad"
public class RagQaService {

    private final VectorStore vectorStore;
    private final ContextBuilder contextBuilder;
    private final ChatModel chatModel;

    public RagAnswer answer(String question) {
        List<SearchResult> results = vectorStore.similaritySearch(question, 3, 0.3);

        if (results.isEmpty()) {
            return RagAnswer.noEvidence(question);
        }

        String context = contextBuilder.build(results);

        String answer = chatModel.generate(question, context);

        return RagAnswer.success(question, answer, results);
    }
}
```

对应本节代码：

```text id="ntx50b"
VectorStore → MemoryVectorStore
ContextBuilder → buildRagContext
ChatModel → createModel()
RagQaService → RagQaChain
```

所以 `RagQaChain` 本质上就是一个服务编排层。

它不负责具体的文档加载，也不负责具体的相似度计算。

它负责把已有组件串起来，完成一次完整的问答请求。

---

## 二十六、企业级 RAG 中 QA Chain 的注意点

本节只是最小版本。

真实企业项目中，QA Chain 还要考虑很多问题。

### 1. 检索结果质量

如果检索结果不相关，后面的生成再好也没有意义。

所以需要持续关注：

```text id="8zw2xp"
chunk 切分质量
Embedding 模型效果
topK 配置
minScore 阈值
rerank 效果
metadata 过滤
```

---

### 2. Prompt 约束

企业 RAG 的 Prompt 不能太随意。

通常需要强调：

```text id="n53o1g"
必须基于资料回答
没有资料就说明没有依据
不要编造内部流程
不要编造系统能力
回答要带来源
```

这些约束直接影响最终答案的可靠性。

---

### 3. 引用来源

用户需要知道答案来自哪里。

所以真实系统中可能会返回：

```text id="5ygdzn"
文档标题
文档来源
章节标题
chunkId
原文片段
链接
更新时间
```

第 18 课只是简单返回 `source`，后续可以继续增强。

---

### 4. 拒答策略

当资料不足时，系统应该拒答，而不是硬答。

常见策略包括：

```text id="dvkvew"
检索结果为空时拒答
最高分低于阈值时拒答
资料内容不包含答案时拒答
模型回答前再次判断依据是否充分
```

本节先实现了最简单的：

```text id="dglkjf"
searchResults.length === 0 时拒答
```

---

### 5. 可观测性

RAG 系统很容易出现“答案不准，但不知道哪里错了”的问题。

所以需要记录：

```text id="owhw8b"
用户问题
检索结果
相似度分数
拼接后的 context
模型输入
模型输出
最终答案
```

本节把 `context` 和 `searchResults` 都返回出来，就是为了方便观察和调试。

---

## 二十七、TypeScript Tips

### 1. 类型复用

```ts id="9f8xb6"
import type {
  MemoryVectorStore,
  SimilaritySearchResult,
} from "../vector-store/memory-vector-store.js";
```

这里复用了第 17 课的类型。

这样做可以避免重复定义类型，也能保证不同模块之间的数据结构一致。

---

### 2. private 私有方法

```ts id="qvqgdh"
private createNoEvidenceAnswer(question: string): RagQaAnswer {
  // ...
}
```

`private` 表示这个方法只能在 `RagQaChain` 类内部使用。

这和 Java 中的 `private` 基本一致。

适合封装类内部逻辑，例如：

```text id="vbuxl4"
创建无依据回答
转换检索结果摘要
```

---

### 3. String(response.content)

```ts id="e2uk59"
answer: String(response.content),
```

模型返回的 `content` 类型可能不是严格的 `string`。

为了让 `RagQaAnswer.answer` 保持稳定的字符串类型，这里用 `String()` 做一次转换。

---

### 4. contentPreview

```ts id="3f0awo"
contentPreview: chunk.content.slice(0, 120),
```

检索结果中不一定要打印完整 chunk 内容。

这里截取前 120 个字符，方便控制台查看。

这在真实系统里也很常见：

```text id="4j92ln"
列表展示摘要
详情页展示完整内容
```

---

### 5. 类的组合

```ts id="hrsh97"
constructor(
  private readonly model: RagChatModel,
  private readonly vectorStore: MemoryVectorStore,
  private readonly options: RagQaChainOptions,
) {}
```

`RagQaChain` 并不自己创建模型和向量库，而是通过构造函数传入。

这样做的好处是：

```text id="h00bmj"
方便测试
方便替换实现
职责更清晰
```

这和 Java 后端中的依赖注入思想很接近。

---

## 二十八、本节总结

第 18 课完成了一个最小可用的 RAG QA Chain。

核心收获：

```text id="p6we0i"
1. RAG 不只是检索，还要基于检索结果生成答案
2. similaritySearch 负责找相关 chunk
3. buildRagContext 负责把检索结果拼成上下文
4. RagQaChain 负责串联检索、上下文构造和模型回答
5. minScore 可以过滤低相关资料
6. 没有可靠资料时可以直接拒答，不调用模型
7. context 和 searchResults 对调试 RAG 很重要
8. 第 18 课已经形成最小 RAG 问答闭环
```

本节最重要的一句话：

> RAG QA Chain 的核心是：先找资料，再让模型基于资料回答；没有资料，就不要编造。

---

## 二十九、下一课预告

下一课进入：

# 第 19 课：把 RAG 封装成 Tool，接入现有 Agent

第 18 课完成的是一个独立的 RAG QA Chain。

第 19 课要把它封装成工具：

```text id="j3mtyv"
search_knowledge_base
```

然后接回前面的 Agent 框架中。

最终流程会变成：

```text id="v7v0mh"
用户问题
  ↓
Agent 判断是否需要查询知识库
  ↓
调用 search_knowledge_base 工具
  ↓
工具内部执行 RAG QA Chain
  ↓
Agent 基于工具结果回答
```

第 18 课解决的是：

```text id="csa3mp"
如何基于知识库资料生成答案？
```

第 19 课要解决的是：

```text id="62ec22"
如何让 Agent 把 RAG 当成一个工具来使用？
```
