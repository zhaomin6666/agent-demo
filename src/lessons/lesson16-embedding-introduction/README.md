# 第 16 课：Embedding 入门，把文本转换成向量

## 前言

第 15 课我们完成了文档加载与切分。

原始 Markdown 文档经过处理后，已经变成了标准的 `DocumentChunk`：

```text
Markdown 文档
  ↓
LoadedDocument
  ↓
DocumentChunk
```

也就是说，我们已经解决了：

```text
企业原始文档如何进入知识库？
```

但是只把文档切成 chunk 还不够。

如果后续用户问：

```text
RAG 检索效果不好应该怎么优化？
```

系统需要从很多 chunk 中找到最相关的内容。

如果只靠关键词匹配，会有一些问题：

```text
1. 用户换一种说法可能搜不到
2. 同义词、近义词难以匹配
3. 中文表达变化较多，关键词不稳定
4. 只能匹配字面内容，不能理解语义相似
```

所以第 16 课开始进入 RAG 中非常核心的一步：

> 把文本转换成向量，也就是 Embedding。

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解什么是 Embedding
2. 理解为什么 RAG 需要 Embedding
3. 使用 DashScope 的 text-embedding-v4 模型
4. 用 LangChain.js 的 OpenAIEmbeddings 调用 OpenAI 兼容接口
5. 把第 15 课生成的 DocumentChunk 转成 ChunkEmbedding
6. 打印向量维度和前几个向量值
7. 为第 17 课内存版 Vector Store 做准备
```

第 15 课解决的是：

```text
原始文档如何变成 chunk？
```

第 16 课解决的是：

```text
文档 chunk 如何变成可以做语义检索的向量？
```

---

## 二、什么是 Embedding？

可以先用一句话理解：

> Embedding 就是把文本转换成一组数字。

例如一段文本：

```text
RAG 检索效果不好怎么办？
```

经过 Embedding 模型后，会变成类似这样的数组：

```ts
[
  0.0123,
  -0.0851,
  0.2317,
  0.0042,
  ...
]
```

这个数组就是向量。

向量中的每个数字本身不需要我们直接理解。

我们只需要知道：

```text
语义相近的文本，向量距离通常也更近。
```

例如：

```text
RAG 检索效果不好怎么办？
知识库召回不准如何优化？
```

这两个句子的字面词不完全一样，但语义接近。

Embedding 的作用就是让系统可以从“字符串匹配”升级到“语义相似度计算”。

---

## 三、为什么 RAG 需要 Embedding？

第 14 课我们写过一个关键词版检索器。

它的逻辑大概是：

```text
看用户问题中的关键词，是否出现在文档标题、内容或标签中。
```

这种方式很直观，但它不理解语义。

例如用户问：

```text
知识库回答不准怎么调？
```

但文档中写的是：

```text
RAG 检索效果不好，可以从文档切分、Embedding 模型、召回数量、重排序等方面优化。
```

关键词可能对不上，但语义其实相关。

Embedding 检索的思路是：

```text
把用户问题转成向量
把文档 chunk 转成向量
计算两个向量的相似度
找出最相似的 chunk
```

所以 RAG 的语义检索核心是：

```text
文本 → 向量 → 相似度计算
```

---

## 四、Chat Model 和 Embedding Model 的区别

前面课程我们一直在用聊天模型：

```ts
new ChatOpenAI({
  model: "qwen3.6-flash",
})
```

聊天模型的作用是：

```text
输入消息
输出自然语言回答
```

第 16 课要用的是 Embedding 模型：

```ts
new OpenAIEmbeddings({
  model: "text-embedding-v4",
})
```

Embedding 模型的作用是：

```text
输入文本
输出数字向量
```

它们不是同一种模型。

可以这样理解：

```text
Chat Model：负责回答问题
Embedding Model：负责把文本变成可计算的语义向量
```

---

## 五、本节目录结构

第 16 课直接基于第 15 课复制。

创建目录：

```bash
cp -r src/lessons/lesson15-document-loader-splitter src/lessons/lesson16-embedding-introduction
```

Windows PowerShell：

```powershell
Copy-Item -Recurse src/lessons/lesson15-document-loader-splitter src/lessons/lesson16-embedding-introduction
```

新增 `embedding` 目录：

```bash
mkdir -p src/lessons/lesson16-embedding-introduction/embedding
```

最终目录结构：

```text
src/lessons/lesson16-embedding-introduction/
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

  index.ts
```

这些文件从第 15 课复制即可，不需要修改：

```text
documents/knowledge-base-guide.md
documents/rag-optimization.md
documents/agent-tool-policy.md
loader/markdown-loader.ts
loader/text-splitter.ts
```

本节重点新增或修改：

```text
embedding/create-embedding-model.ts
embedding/chunk-embedding.ts
index.ts
package.json
```

---

## 六、确认依赖

前面课程中我们已经安装过：

```bash
pnpm add @langchain/openai
```

如果前面的 `ChatOpenAI` 已经可以正常运行，这里一般不需要重复安装。

本节会使用：

```ts
import { OpenAIEmbeddings } from "@langchain/openai";
```

---

## 七、配置环境变量

继续使用前面课程已有的 `.env`：

```env
DASHSCOPE_API_KEY=你的阿里云百炼 API Key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

这里继续复用 DashScope 的 OpenAI 兼容模式。

需要注意的是：

```text
qwen3.6-flash 是聊天模型
text-embedding-v4 是 Embedding 模型
```

所以模型名不能写错。

---

## 八、配置 package.json

在 `package.json` 中新增第 16 课脚本：

```json
{
  "scripts": {
    "lesson:16": "tsx src/lessons/lesson16-embedding-introduction/index.ts"
  }
}
```

保留前面已有的 `lesson:01` 到 `lesson:15`，这里只需要新增这一行。

运行第 16 课：

```bash
pnpm lesson:16
```

---

## 九、新增 create-embedding-model.ts

文件路径：

```text
src/lessons/lesson16-embedding-introduction/embedding/create-embedding-model.ts
```

代码如下：

```ts
import "dotenv/config";

import { OpenAIEmbeddings } from "@langchain/openai";

export function createEmbeddingModel() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseURL = process.env.DASHSCOPE_BASE_URL;

  if (!apiKey) {
    throw new Error("缺少环境变量：DASHSCOPE_API_KEY");
  }

  if (!baseURL) {
    throw new Error("缺少环境变量：DASHSCOPE_BASE_URL");
  }

  return new OpenAIEmbeddings({
    model: "text-embedding-v4",
    apiKey,
    batchSize: 10,
    configuration: {
      baseURL,
    },
  });
}
```

---

## 十、理解 createEmbeddingModel

这个函数和前面课程中的 `createModel` 很像，但用途不同。

前面的 `createModel` 创建的是聊天模型：

```ts
new ChatOpenAI({
  model: "qwen3.6-flash",
})
```

这里创建的是 Embedding 模型：

```ts
new OpenAIEmbeddings({
  model: "text-embedding-v4",
})
```

核心配置包括：

```text
model：Embedding 模型名称
apiKey：DashScope API Key
baseURL：DashScope OpenAI 兼容接口地址
batchSize：每次批量处理的文本数量
```

这里设置：

```ts
batchSize: 10
```

是为了避免一次提交过多文本。

本节 chunk 数量不多，设置小一点更稳。

---

## 十一、新增 chunk-embedding.ts

文件路径：

```text
src/lessons/lesson16-embedding-introduction/embedding/chunk-embedding.ts
```

这个文件负责把 `DocumentChunk` 转成带向量的 `ChunkEmbedding`。

代码如下：

```ts
import type { EmbeddingsInterface } from "@langchain/core/embeddings";

import type { DocumentChunk } from "../loader/text-splitter.js";

export type ChunkEmbedding = {
  chunk: DocumentChunk;
  vector: number[];
  vectorDimension: number;
};

export async function embedChunks(params: {
  chunks: DocumentChunk[];
  embeddings: EmbeddingsInterface;
}): Promise<ChunkEmbedding[]> {
  if (params.chunks.length === 0) {
    return [];
  }

  const texts = params.chunks.map((chunk) => chunk.content);

  const vectors = await params.embeddings.embedDocuments(texts);

  return params.chunks.map((chunk, index) => {
    const vector = vectors[index];

    if (!vector) {
      throw new Error(`未获取到 chunk ${chunk.id} 对应的向量`);
    }

    return {
      chunk,
      vector,
      vectorDimension: vector.length,
    };
  });
}
```

---

## 十二、理解 ChunkEmbedding

第 15 课的核心对象是：

```ts
DocumentChunk
```

第 16 课的核心对象变成：

```ts
ChunkEmbedding
```

类型如下：

```ts
export type ChunkEmbedding = {
  chunk: DocumentChunk;
  vector: number[];
  vectorDimension: number;
};
```

可以理解为：

```text
DocumentChunk + Vector = ChunkEmbedding
```

字段含义：

```text
chunk：原始文档片段
vector：Embedding 模型生成的向量
vectorDimension：向量维度
```

后续第 17 课实现内存版 Vector Store 时，存储的基本单位就是：

```text
ChunkEmbedding[]
```

---

## 十三、为什么使用 EmbeddingsInterface？

代码中使用的是：

```ts
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
```

而不是直接依赖：

```ts
OpenAIEmbeddings
```

这样做的好处是：

```text
embedChunks 只依赖 Embedding 抽象接口
以后替换其他 Embedding 模型时，不需要修改 embedChunks
```

这和 Java 后端里“面向接口编程”是一个思路。

类似：

```java
public class ChunkEmbeddingService {

    private final EmbeddingClient embeddingClient;

    public List<ChunkEmbedding> embed(List<DocumentChunk> chunks) {
        return embeddingClient.embedDocuments(chunks);
    }
}
```

不关心具体实现是 DashScope、OpenAI，还是其他模型供应商。

---

## 十四、为什么使用 embedDocuments？

Embedding 通常有两个常用方法：

```text
embedDocuments：把多个文档文本批量转成向量
embedQuery：把用户查询转成向量
```

本节处理的是文档 chunk，所以使用：

```ts
const vectors = await params.embeddings.embedDocuments(texts);
```

第 17 课做语义检索时，会使用：

```ts
embedQuery(query)
```

把用户问题转成向量。

然后再计算：

```text
用户问题向量 和 文档 chunk 向量 的相似度
```

---

## 十五、修改 index.ts

文件路径：

```text
src/lessons/lesson16-embedding-introduction/index.ts
```

代码如下：

```ts
import path from "node:path";

import { createEmbeddingModel } from "./embedding/create-embedding-model.js";
import { embedChunks } from "./embedding/chunk-embedding.js";
import { loadMarkdownDocuments } from "./loader/markdown-loader.js";
import { splitDocumentsIntoChunks } from "./loader/text-splitter.js";

async function main() {
  const docsDir = path.resolve(
    process.cwd(),
    "src/lessons/lesson16-embedding-introduction/documents",
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

  console.log("\n========== 文档加载结果 ==========");
  console.log(
    documents.map((document) => ({
      id: document.id,
      title: document.title,
      source: document.source,
      contentLength: document.content.length,
    })),
  );

  console.log("\n========== Chunk 切分结果 ==========");
  console.log(
    chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      title: chunk.title,
      contentLength: chunk.content.length,
    })),
  );

  console.log("\n========== Embedding 结果概览 ==========");
  console.log(
    chunkEmbeddings.map((item) => ({
      chunkId: item.chunk.id,
      title: item.chunk.title,
      vectorDimension: item.vectorDimension,
      vectorPreview: item.vector.slice(0, 8),
    })),
  );

  console.log("\n========== 第一条 Chunk Embedding 详情 ==========");

  const first = chunkEmbeddings[0];

  if (first) {
    console.log("chunkId:", first.chunk.id);
    console.log("title:", first.chunk.title);
    console.log("source:", first.chunk.source);
    console.log("content:", first.chunk.content);
    console.log("vectorDimension:", first.vectorDimension);
    console.log("vector 前 20 项:", first.vector.slice(0, 20));
  }

  console.log("\n========== 统计信息 ==========");
  console.log("文档数量：", documents.length);
  console.log("Chunk 数量：", chunks.length);
  console.log("Embedding 数量：", chunkEmbeddings.length);
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 十六、理解 index.ts

入口文件做了五件事。

第一步，定位 documents 目录：

```ts
const docsDir = path.resolve(
  process.cwd(),
  "src/lessons/lesson16-embedding-introduction/documents",
);
```

第二步，加载 Markdown 文档：

```ts
const documents = await loadMarkdownDocuments({
  docsDir,
});
```

第三步，切分 chunk：

```ts
const chunks = splitDocumentsIntoChunks(documents, {
  maxChunkChars: 220,
  overlapChars: 40,
});
```

第四步，创建 Embedding 模型：

```ts
const embeddings = createEmbeddingModel();
```

第五步，把 chunk 转成向量：

```ts
const chunkEmbeddings = await embedChunks({
  chunks,
  embeddings,
});
```

最终输出：

```text
文档加载结果
Chunk 切分结果
Embedding 结果概览
第一条 Chunk Embedding 详情
统计信息
```

---

## 十七、运行第 16 课

执行：

```bash
pnpm lesson:16
```

你会看到类似输出：

```text
========== Embedding 结果概览 ==========
[
  {
    chunkId: 'knowledge-base-guide-chunk-1',
    title: '企业知识库支持的数据源',
    vectorDimension: 1024,
    vectorPreview: [
      0.0123,
      -0.0456,
      0.0789,
      ...
    ]
  }
]
```

其中：

```text
vectorDimension
```

表示向量维度。

```text
vectorPreview
```

只打印向量前几项，避免完整向量太长导致控制台刷屏。

最终统计信息类似：

```text
文档数量： 3
Chunk 数量： 若干
Embedding 数量： 若干
```

正常情况下：

```text
Chunk 数量 和 Embedding 数量应该一致。
```

因为每个 chunk 都应该生成一个向量。

---

## 十八、如果运行失败怎么办？

### 1. 缺少环境变量

如果报错：

```text
缺少环境变量：DASHSCOPE_API_KEY
```

检查 `.env` 是否有：

```env
DASHSCOPE_API_KEY=xxx
```

如果报错：

```text
缺少环境变量：DASHSCOPE_BASE_URL
```

检查 `.env` 是否有：

```env
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

---

### 2. 模型名写错

Embedding 模型应该是：

```text
text-embedding-v4
```

聊天模型是：

```text
qwen3.6-flash
```

不要把聊天模型名写到 Embedding 里。

---

### 3. batchSize 过大

如果报错和批量输入数量有关，可以把：

```ts
batchSize: 10
```

改小一点：

```ts
batchSize: 4
```

本节文档数量不多，batchSize 小一点也可以正常学习。

---

### 4. API Key 和 baseURL 区域不一致

如果出现认证或请求地址错误，需要检查：

```text
API Key 所属区域
DASHSCOPE_BASE_URL 所属区域
```

二者需要匹配。

---

## 十九、第 16 课和第 15 课的区别

第 15 课输出的是：

```ts
DocumentChunk[]
```

第 16 课输出的是：

```ts
ChunkEmbedding[]
```

可以这样理解：

```text
第 15 课：把文档切成片段
第 16 课：把片段转成向量
```

第 15 课解决：

```text
原始文档如何进入知识库？
```

第 16 课解决：

```text
文档片段如何变成可以做语义检索的向量？
```

---

## 二十、Embedding 后能做什么？

有了向量以后，就可以做相似度计算。

例如：

```text
用户问题：知识库召回不准怎么优化？
```

系统会先把用户问题也转成向量。

然后和所有 chunk 向量做相似度计算：

```text
queryVector vs chunkVector1
queryVector vs chunkVector2
queryVector vs chunkVector3
...
```

相似度最高的 chunk，就是最可能相关的资料。

第 17 课会实现：

```text
1. 余弦相似度 cosine similarity
2. 内存版 Vector Store
3. similaritySearch
4. 返回最相似的 chunk
```

---

## 二十一、Java 后端视角理解

可以把第 16 课理解成：

```text
给每条知识库记录生成一个语义索引。
```

如果用 Java 类比，大概是：

```java
public class EmbeddingService {

    public List<ChunkEmbedding> embed(List<DocumentChunk> chunks) {
        List<String> texts = chunks.stream()
            .map(DocumentChunk::getContent)
            .toList();

        List<List<Double>> vectors = embeddingClient.embedDocuments(texts);

        return combine(chunks, vectors);
    }
}
```

对应到本节代码：

```text
DocumentChunk：待处理的知识片段
EmbeddingModel：向量生成服务
ChunkEmbedding：带向量的知识片段
```

第 17 课会继续把这些 `ChunkEmbedding` 放进内存版 Vector Store：

```text
ChunkEmbedding[]
  ↓
VectorStore
  ↓
similaritySearch(query)
```

---

## 二十二、企业级 RAG 中 Embedding 的注意点

真实项目中，Embedding 会影响 RAG 检索质量。

需要关注几个问题。

### 1. 模型选择

不同 Embedding 模型的效果不同。

需要考虑：

```text
中文效果
英文效果
代码文本效果
业务领域效果
成本
速度
向量维度
上下文长度
```

---

### 2. 向量维度

向量维度越高，不一定效果越好。

维度会影响：

```text
存储成本
计算成本
检索速度
索引大小
```

所以真实项目中要结合效果和成本做取舍。

---

### 3. 文档质量

Embedding 不是万能的。

如果 chunk 本身质量差，向量效果也会差。

例如：

```text
chunk 太长
chunk 太短
chunk 有大量噪音
chunk 缺少标题和上下文
```

都会影响检索效果。

---

### 4. 批量处理

真实知识库可能有大量文档。

Embedding 通常需要批量处理，并考虑：

```text
限流
重试
失败恢复
增量更新
缓存
成本控制
```

本节只是最小版本，所以先不展开这些工程细节。

---

## 二十三、TypeScript Tips

### 1. 数字数组类型

```ts
vector: number[];
```

表示这是一个数字数组。

Embedding 向量本质上就是很多浮点数组成的数组。

---

### 2. EmbeddingsInterface

```ts
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
```

这里依赖的是抽象接口，而不是具体实现类。

好处是：

```text
以后替换其他 Embedding 模型时，embedChunks 不需要修改。
```

这和 Java 里依赖接口而不是实现类是一个思想。

---

### 3. vector.slice

```ts
vectorPreview: item.vector.slice(0, 8)
```

向量通常很长，直接打印完整数组会刷屏。

所以这里只打印前 8 项预览。

---

### 4. if (first)

```ts
const first = chunkEmbeddings[0];

if (first) {
  console.log("chunkId:", first.chunk.id);
}
```

这是为了避免数组为空时报错。

如果 `chunkEmbeddings[0]` 不存在，直接访问 `first.chunk.id` 会出错。

---

### 5. map 对齐

```ts
return params.chunks.map((chunk, index) => {
  const vector = vectors[index];
  // ...
});
```

这里依赖一个前提：

```text
embedDocuments(texts) 返回的 vectors 顺序和 texts 顺序一致。
```

所以可以用同一个 `index` 把 chunk 和 vector 对齐。

---

## 二十四、本节总结

第 16 课完成了 Embedding 入门。

核心收获：

```text
1. Embedding 是把文本转换成数字向量
2. RAG 需要 Embedding 来做语义检索
3. Chat Model 和 Embedding Model 不是一回事
4. 第 15 课的 DocumentChunk 是 Embedding 的输入
5. 第 16 课的 ChunkEmbedding 是后续 Vector Store 的基础
6. embedDocuments 用于批量生成文档向量
7. 后续 embedQuery 会用于生成用户问题向量
8. 向量维度可以通过 vector.length 查看
9. Chunk 数量和 Embedding 数量应该保持一致
```

本节最重要的一句话：

> Embedding 让文本从“字符串匹配”进入“语义相似度计算”。

---

## 二十五、下一课预告

下一课进入：

# 第 17 课：内存版 Vector Store，实现最小语义检索

第 17 课会继续使用本节的 `ChunkEmbedding`，实现：

```text
1. 余弦相似度 cosine similarity
2. 内存版 Vector Store
3. embedQuery 生成查询向量
4. similaritySearch 返回最相似的 chunk
5. 对比关键词检索和语义检索
```

第 16 课解决的是：

```text
文档 chunk 如何变成向量？
```

第 17 课要解决的是：

```text
有了向量以后，如何找到和用户问题最相似的文档片段？
```
