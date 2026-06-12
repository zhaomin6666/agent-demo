# 第 17 课：内存版 Vector Store，实现最小语义检索

## 前言

第 16 课我们完成了 Embedding 入门。

通过第 16 课，我们已经可以把文档 chunk 转成向量：

```text
DocumentChunk
  ↓
Embedding Model
  ↓
ChunkEmbedding
```

也就是说，每个文档片段现在都有了自己的语义向量。

但是只有向量还不够。

RAG 真正需要解决的问题是：

```text
用户问了一个问题
系统如何从所有文档 chunk 中找到最相关的几个？
```

这就是第 17 课要完成的内容：

> 实现一个最小版本的内存向量库 MemoryVectorStore，用向量相似度完成语义检索。

第 16 课解决的是：

```text
文档 chunk 如何变成向量？
```

第 17 课解决的是：

```text
有了向量以后，如何找到和用户问题最相似的文档片段？
```

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解什么是 Vector Store
2. 理解为什么需要 similarity search
3. 实现 cosine similarity
4. 实现 MemoryVectorStore
5. 使用 embedQuery 把用户问题转成向量
6. 用 queryVector 和 chunkVector 计算相似度
7. 返回 topK 个最相似 chunk
8. 为第 18 课 RAG QA Chain 做准备
```

这一课不会调用 Chat Model 生成最终答案。

它只做一件事：

```text
根据用户问题，从知识库 chunk 中找出最相关的资料。
```

---

## 二、什么是 Vector Store？

Vector Store 可以先理解成：

> 存储向量，并支持按相似度检索的存储系统。

在普通数据库中，我们经常按字段查询：

```sql
select * from document where title like '%RAG%';
```

这属于关键词或字段匹配。

而 Vector Store 关注的是：

```text
这个问题的语义，和哪些文档片段最接近？
```

所以它不是只看字面关键词，而是基于向量相似度进行检索。

基本流程是：

```text
文档 chunk
  ↓
生成 chunkVector
  ↓
存入 Vector Store

用户问题
  ↓
生成 queryVector
  ↓
和 Vector Store 中的 chunkVector 计算相似度
  ↓
返回 topK 个最相似 chunk
```

本节为了理解原理，不接真实向量数据库，而是把所有 `ChunkEmbedding` 放在内存数组里。

---

## 三、为什么需要 similarity search？

第 14 课我们做过关键词检索。

关键词检索的问题是：

```text
用户问题和文档内容必须有比较明显的字面匹配。
```

例如文档中写的是：

```text
RAG 检索效果不好怎么办
```

用户问的是：

```text
知识库召回不准应该怎么优化？
```

这两个表达字面不完全一致。

关键词检索可能不稳定。

但是从语义上看，它们其实是在问同一类问题：

```text
RAG / 知识库 检索 / 召回 效果不好 / 不准 如何优化
```

Embedding + Vector Store 的价值就在于：

```text
把文本转换成向量
再用向量相似度判断语义接近程度
```

这就是语义检索。

---

## 四、本节整体流程

第 17 课的整体流程是：

```text
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
similaritySearch(query)
  ↓
SimilaritySearchResult[]
```

相比第 16 课，本节新增的是：

```text
MemoryVectorStore
cosineSimilarity
similaritySearch
```

也就是从“生成向量”进入“使用向量检索”。

---

## 五、本节目录结构

第 17 课直接基于第 16 课复制。

创建目录：

```bash
cp -r src/lessons/lesson16-embedding-introduction src/lessons/lesson17-memory-vector-store
```

Windows PowerShell：

```powershell
Copy-Item -Recurse src/lessons/lesson16-embedding-introduction src/lessons/lesson17-memory-vector-store
```

新增 `vector-store` 目录：

```bash
mkdir -p src/lessons/lesson17-memory-vector-store/vector-store
```

最终目录结构：

```text
src/lessons/lesson17-memory-vector-store/
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

  index.ts
```

这些文件从第 16 课复制即可，不需要修改：

```text
documents/knowledge-base-guide.md
documents/rag-optimization.md
documents/agent-tool-policy.md
loader/markdown-loader.ts
loader/text-splitter.ts
embedding/create-embedding-model.ts
embedding/chunk-embedding.ts
```

本节重点新增或修改：

```text
vector-store/cosine-similarity.ts
vector-store/memory-vector-store.ts
index.ts
package.json
```

---

## 六、配置 package.json

在 `package.json` 中新增第 17 课脚本：

```json
{
  "scripts": {
    "lesson:17": "tsx src/lessons/lesson17-memory-vector-store/index.ts"
  }
}
```

运行第 17 课：

```bash
pnpm lesson:17
```

---

## 七、新增 cosine-similarity.ts

文件路径：

```text
src/lessons/lesson17-memory-vector-store/vector-store/cosine-similarity.ts
```

代码如下：

```ts
export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length) {
    throw new Error(
      `向量维度不一致：left=${left.length}, right=${right.length}`,
    );
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;

    dotProduct += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
```

---

## 八、理解 cosine similarity

余弦相似度用来衡量两个向量方向是否接近。

可以简单理解为：

```text
越接近 1：越相似
越接近 0：越不相关
越接近 -1：方向相反
```

在 RAG 检索中，我们通常会比较：

```text
用户问题向量 queryVector
文档片段向量 chunkVector
```

如果二者余弦相似度高，说明这个文档片段很可能和用户问题相关。

公式可以简单理解为：

```text
cosineSimilarity = 点积 / 两个向量长度相乘
```

代码中对应：

```ts
return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
```

这里不需要手算公式，重点是理解它的用途：

> 用一个数字衡量两个文本语义是否接近。

---

## 九、为什么要检查向量维度？

代码开头有一段：

```ts
if (left.length !== right.length) {
  throw new Error(
    `向量维度不一致：left=${left.length}, right=${right.length}`,
  );
}
```

这是因为两个向量必须维度一致，才能计算相似度。

例如：

```text
1024 维向量 可以和 1024 维向量计算
1024 维向量 不能和 768 维向量计算
```

真实项目中，如果不同文档使用了不同 Embedding 模型，或者模型维度配置不一致，就可能出现维度不一致问题。

所以这里提前检查，可以避免隐藏错误。

---

## 十、新增 memory-vector-store.ts

文件路径：

```text
src/lessons/lesson17-memory-vector-store/vector-store/memory-vector-store.ts
```

代码如下：

```ts
import type { EmbeddingsInterface } from "@langchain/core/embeddings";

import type { ChunkEmbedding } from "../embedding/chunk-embedding.js";
import { cosineSimilarity } from "./cosine-similarity.js";

export type SimilaritySearchOptions = {
  topK: number;
  minScore?: number;
};

export type SimilaritySearchResult = {
  chunkEmbedding: ChunkEmbedding;
  score: number;
};

export class MemoryVectorStore {
  constructor(
    private readonly embeddings: EmbeddingsInterface,
    private readonly items: ChunkEmbedding[],
  ) {}

  async similaritySearch(
    query: string,
    options: SimilaritySearchOptions,
  ): Promise<SimilaritySearchResult[]> {
    if (this.items.length === 0) {
      return [];
    }

    const queryVector = await this.embeddings.embedQuery(query);

    return this.items
      .map((item) => {
        return {
          chunkEmbedding: item,
          score: cosineSimilarity(queryVector, item.vector),
        };
      })
      .filter((item) => item.score >= (options.minScore ?? -1))
      .sort((left, right) => right.score - left.score)
      .slice(0, options.topK);
  }
}
```

---

## 十一、理解 MemoryVectorStore

`MemoryVectorStore` 是本节最核心的类。

它接收两个东西：

```ts
constructor(
  private readonly embeddings: EmbeddingsInterface,
  private readonly items: ChunkEmbedding[],
) {}
```

第一个是：

```text
embeddings
```

用于把用户问题转换成 query vector。

第二个是：

```text
items
```

也就是第 16 课生成的 `ChunkEmbedding[]`。

也可以理解为：

```text
MemoryVectorStore = Embedding 模型 + 已经生成向量的文档 chunk
```

---

## 十二、理解 similaritySearch

核心方法是：

```ts
async similaritySearch(
  query: string,
  options: SimilaritySearchOptions,
): Promise<SimilaritySearchResult[]>
```

它的执行流程是：

```text
1. 接收用户问题 query
2. 使用 embedQuery(query) 生成 queryVector
3. 遍历所有 ChunkEmbedding
4. 计算 queryVector 和 chunkVector 的余弦相似度
5. 按 score 从高到低排序
6. 返回 topK 个结果
```

对应代码：

```ts
const queryVector = await this.embeddings.embedQuery(query);

return this.items
  .map((item) => {
    return {
      chunkEmbedding: item,
      score: cosineSimilarity(queryVector, item.vector),
    };
  })
  .filter((item) => item.score >= (options.minScore ?? -1))
  .sort((left, right) => right.score - left.score)
  .slice(0, options.topK);
```

这就是一个最小版本的语义检索。

---

## 十三、为什么使用 embedQuery？

第 16 课中我们使用的是：

```ts
embedDocuments(texts)
```

它的作用是：

```text
把文档列表批量转成向量。
```

第 17 课新增使用：

```ts
embedQuery(query)
```

它的作用是：

```text
把用户问题转成查询向量。
```

在 RAG 中，一般会有两类向量：

```text
文档向量：提前生成，存入向量库
查询向量：用户提问时实时生成
```

流程是：

```text
文档 chunk → embedDocuments → chunkVector
用户问题 → embedQuery → queryVector
queryVector vs chunkVector → similaritySearch
```

---

## 十四、为什么需要 topK？

`topK` 表示返回最相似的前 K 条结果。

例如：

```ts
const results = await vectorStore.similaritySearch(query, {
  topK: 3,
});
```

意思是：

```text
从所有 chunk 中，找出最相似的 3 个。
```

RAG 中通常不会只取一个结果。

原因是：

```text
1. 一个问题可能需要多个资料片段共同回答
2. 单个 chunk 可能信息不完整
3. topK 可以提高召回率
4. 后续可以再通过 rerank 或 Prompt 选择更合适的内容
```

不过 topK 也不能无限大。

如果 topK 太大，模型拿到的上下文会包含太多噪音。

---

## 十五、minScore 的作用

本节的 `SimilaritySearchOptions` 中有：

```ts
export type SimilaritySearchOptions = {
  topK: number;
  minScore?: number;
};
```

`minScore` 是可选参数。

它表示：

```text
只返回相似度大于等于 minScore 的结果。
```

当前代码里：

```ts
.filter((item) => item.score >= (options.minScore ?? -1))
```

如果没有传 `minScore`，就默认使用 `-1`。

因为余弦相似度通常不会低于 `-1`，所以默认相当于不过滤。

后续真实 RAG 中，`minScore` 很有用。

比如：

```ts
const results = await vectorStore.similaritySearch(query, {
  topK: 3,
  minScore: 0.5,
});
```

如果所有结果分数都低于阈值，就可以认为：

```text
当前知识库没有找到足够相关的资料。
```

这对减少幻觉很重要。

---

## 十六、修改 index.ts

文件路径：

```text
src/lessons/lesson17-memory-vector-store/index.ts
```

代码如下：

```ts
import path from "node:path";

import { createEmbeddingModel } from "./embedding/create-embedding-model.js";
import { embedChunks } from "./embedding/chunk-embedding.js";
import { loadMarkdownDocuments } from "./loader/markdown-loader.js";
import { splitDocumentsIntoChunks } from "./loader/text-splitter.js";
import { MemoryVectorStore } from "./vector-store/memory-vector-store.js";

async function main() {
  const docsDir = path.resolve(
    process.cwd(),
    "src/lessons/lesson17-memory-vector-store/documents",
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

  console.log("\n========== Vector Store 初始化完成 ==========");
  console.log("文档数量：", documents.length);
  console.log("Chunk 数量：", chunks.length);
  console.log("Embedding 数量：", chunkEmbeddings.length);

  const queries = [
    "知识库可以接入哪些类型的资料？",
    "知识库召回不准应该怎么优化？",
    "创建工单前需要做哪些安全控制？",
    "接口响应很慢应该怎么排查？",
  ];

  for (const query of queries) {
    console.log("\n\n========================================");
    console.log("用户问题：", query);

    const results = await vectorStore.similaritySearch(query, {
      topK: 3,
    });

    console.log("\n========== 相似度检索结果 ==========");

    for (const [index, result] of results.entries()) {
      const { chunkEmbedding, score } = result;

      console.log(`\nTop ${index + 1}`);
      console.log("score:", score.toFixed(4));
      console.log("chunkId:", chunkEmbedding.chunk.id);
      console.log("title:", chunkEmbedding.chunk.title);
      console.log("source:", chunkEmbedding.chunk.source);
      console.log("content:");
      console.log(chunkEmbedding.chunk.content);
    }
  }
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 十七、理解 index.ts

入口文件整体流程和第 16 课很接近。

前半部分仍然是：

```text
加载文档
切分 chunk
生成 embedding
```

代码：

```ts
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
```

第 17 课新增的是：

```ts
const vectorStore = new MemoryVectorStore(embeddings, chunkEmbeddings);
```

然后对多个问题执行语义检索：

```ts
const results = await vectorStore.similaritySearch(query, {
  topK: 3,
});
```

最后打印每个结果的：

```text
score
chunkId
title
source
content
```

---

## 十八、运行第 17 课

执行：

```bash
pnpm lesson:17
```

你会看到类似输出：

```text
========== Vector Store 初始化完成 ==========
文档数量： 3
Chunk 数量： 8
Embedding 数量： 8
```

然后会对几个问题进行相似度检索。

每个问题会打印 topK 结果：

```text
Top 1
score: 0.8123
chunkId: rag-optimization-chunk-1
title: RAG 检索效果不好怎么办
source: rag-optimization.md
content:
...
```

这里最值得关注的是：

```text
score
```

它表示用户问题和该 chunk 的语义相似度。

---

## 十九、测试问题 1：知识库可以接入哪些类型的资料？

问题：

```text
知识库可以接入哪些类型的资料？
```

预期更可能命中：

```text
企业知识库支持的数据源
```

因为文档中有相关内容：

```text
企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源。
```

这个测试验证的是：

```text
语义检索能找到“数据源接入”相关资料。
```

---

## 二十、测试问题 2：知识库召回不准应该怎么优化？

问题：

```text
知识库召回不准应该怎么优化？
```

文档标题是：

```text
RAG 检索效果不好怎么办
```

用户问题和文档标题字面不同，但语义接近。

预期更可能命中：

```text
RAG 检索效果不好怎么办
```

这就是 Embedding 检索的价值：

```text
字面不完全一样，但语义相关。
```

如果只靠关键词匹配，这种问题可能不稳定。

---

## 二十一、测试问题 3：创建工单前需要做哪些安全控制？

问题：

```text
创建工单前需要做哪些安全控制？
```

预期更可能命中：

```text
Agent 工具调用规范
```

因为文档中写了：

```text
操作型工具应结合权限控制和人工确认。

例如创建工单、提交审批、发送通知、删除数据等工具，都应该先检查用户权限，再根据风险等级决定是否需要人工确认。
```

这个问题也把第 12、13 课的内容串起来了：

```text
高风险工具需要人工确认
工具调用需要权限控制
```

---

## 二十二、测试问题 4：接口响应很慢应该怎么排查？

问题：

```text
接口响应很慢应该怎么排查？
```

当前文档里没有专门讲接口性能排查。

但是当前 `similaritySearch` 仍然会返回 topK。

这说明一个问题：

> Vector Store 总会尽量找出“相对最相似”的结果，但不代表这些结果一定可靠。

所以真实 RAG 中还需要：

```text
minScore 阈值
rerank
答案阶段拒答
来源校验
```

例如后续可以这样调用：

```ts
const results = await vectorStore.similaritySearch(query, {
  topK: 3,
  minScore: 0.5,
});
```

如果检索结果都低于阈值，就可以认为当前知识库没有可靠依据。

---

## 二十三、第 17 课和第 16 课的区别

第 16 课输出的是：

```text
ChunkEmbedding[]
```

第 17 课新增的是：

```text
MemoryVectorStore
```

第 16 课解决：

```text
文档 chunk 如何变成向量？
```

第 17 课解决：

```text
如何用向量找到最相似的 chunk？
```

可以这样理解：

```text
第 16 课：建索引数据
第 17 课：用索引做检索
```

如果第 16 课是“把知识处理成可搜索的数据”，那第 17 课就是“真正执行搜索”。

---

## 二十四、为什么叫内存版 Vector Store？

真实项目中，文档 chunk 和向量一般不会只放在内存里。

它们会存到向量数据库或带向量能力的存储系统里。

例如：

```text
Postgres + pgvector
Milvus
Qdrant
Weaviate
Elasticsearch vector search
OpenSearch vector search
```

本节为了理解原理，先用内存数组模拟：

```text
ChunkEmbedding[]
```

虽然它不适合生产环境，但非常适合理解底层流程。

因为真正接向量数据库以后，核心思想仍然是：

```text
存储向量
生成查询向量
计算相似度
返回 topK
```

只是计算和存储从本地内存换成了专门的向量数据库。

---

## 二十五、Java 后端视角理解

可以把第 17 课理解成一个最小版搜索服务。

如果用 Java 类比，大概是：

```java
public class MemoryVectorStore {

    private final EmbeddingClient embeddingClient;
    private final List<ChunkEmbedding> items;

    public List<SearchResult> similaritySearch(String query, int topK) {
        List<Double> queryVector = embeddingClient.embedQuery(query);

        return items.stream()
            .map(item -> new SearchResult(
                item,
                cosineSimilarity(queryVector, item.getVector())
            ))
            .sorted((a, b) -> Double.compare(b.getScore(), a.getScore()))
            .limit(topK)
            .toList();
    }
}
```

第 17 课的 TypeScript 代码和这个 Java 思路基本一致。

也就是说：

```text
MemoryVectorStore 不是魔法
它本质上就是一个带相似度排序的搜索服务
```

---

## 二十六、企业级 RAG 中 Vector Store 的注意点

本节是内存版，真实项目中会复杂很多。

### 1. 向量数据持久化

生产环境不能每次启动都重新生成全部向量。

通常需要把向量持久化到：

```text
向量数据库
关系型数据库向量扩展
搜索引擎向量字段
对象存储 + 索引服务
```

---

### 2. 增量更新

企业文档会不断变化。

需要考虑：

```text
新增文档如何生成向量
修改文档如何更新向量
删除文档如何删除向量
文档版本如何管理
```

---

### 3. 检索阈值

topK 只能保证返回最相似的 K 条，但不能保证这些结果一定相关。

所以通常还需要：

```text
minScore
动态阈值
按文档类型设置阈值
低分拒答
```

---

### 4. 混合检索

单纯向量检索不一定适合所有问题。

真实项目中常见的是：

```text
关键词检索 + 向量检索 + rerank
```

例如：

```text
接口编号
订单号
文件名
专业术语
```

这些场景中，关键词检索可能比向量检索更稳定。

---

### 5. 权限过滤

企业知识库通常不是所有人都能看所有文档。

真实检索时还需要结合：

```text
用户角色
部门
项目
租户
文档密级
数据权限
```

也就是说，Vector Store 检索前后都可能需要做权限过滤。

---

## 二十七、TypeScript Tips

### 1. 可选参数

```ts
export type SimilaritySearchOptions = {
  topK: number;
  minScore?: number;
};
```

`minScore?: number` 表示这个字段可传可不传。

如果不传，就使用默认值。

---

### 2. 空值合并 `??`

```ts
.filter((item) => item.score >= (options.minScore ?? -1))
```

`??` 表示当左边是 `null` 或 `undefined` 时，使用右边的值。

所以：

```ts
options.minScore ?? -1
```

意思是：

```text
如果传了 minScore，就用 minScore
如果没传，就用 -1
```

---

### 3. entries()

```ts
for (const [index, result] of results.entries()) {
  console.log(`Top ${index + 1}`);
}
```

`entries()` 可以同时拿到数组下标和值。

这里：

```text
index：当前结果下标
result：当前检索结果
```

---

### 4. toFixed

```ts
score.toFixed(4)
```

把数字保留 4 位小数，方便打印相似度分数。

例如：

```text
0.8234567 → 0.8235
```

---

### 5. sort 排序

```ts
.sort((left, right) => right.score - left.score)
```

这是按相似度从高到低排序。

如果写成：

```ts
.sort((left, right) => left.score - right.score)
```

就会变成从低到高排序。

语义检索通常需要分数最高的结果排在前面。

---

## 二十八、本节总结

第 17 课完成了内存版 Vector Store。

核心收获：

```text
1. Vector Store 用于存储向量并进行相似度检索
2. 文档 chunk 通过 embedDocuments 生成 chunkVector
3. 用户问题通过 embedQuery 生成 queryVector
4. cosine similarity 可以衡量两个向量的相似度
5. MemoryVectorStore 通过遍历内存数组实现 similaritySearch
6. topK 表示返回最相似的前 K 条结果
7. minScore 可以用于过滤低相关结果
8. 低相关问题也可能返回结果，所以后续需要拒答策略
9. 内存版 Vector Store 适合理解原理，生产环境需要替换成真实向量库
```

本节最重要的一句话：

> Vector Store 的本质，是用向量相似度从知识库中找出最相关的文档片段。

---

## 二十九、下一课预告

下一课进入：

# 第 18 课：RAG QA Chain，把检索结果交给模型生成答案

第 17 课只完成了：

```text
用户问题 → similaritySearch → 相关 chunk
```

第 18 课会继续往后走：

```text
用户问题
  ↓
similaritySearch
  ↓
检索结果
  ↓
构造 context
  ↓
调用 Chat Model
  ↓
生成最终答案
```

第 18 课主要学习：

```text
1. 用户问题如何触发相似度检索
2. 检索结果如何拼成 context
3. 如何设计 RAG QA Prompt
4. 如何调用 Chat Model 生成答案
5. 如果检索分数太低，如何回答“没有可靠依据”
```

第 17 课解决的是：

```text
如何找到相关资料？
```

第 18 课要解决的是：

```text
找到资料后，如何基于资料生成可靠答案？
```
