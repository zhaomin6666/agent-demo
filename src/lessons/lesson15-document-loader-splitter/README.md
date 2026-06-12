# 第 15 课：文档加载与切分，构建知识库原始数据处理流程

## 前言

第 14 课我们正式进入了 RAG 阶段。

在第 14 课中，我们用一个内存数组模拟企业知识库：

```ts
export const enterpriseDocs = [
  {
    title: "企业知识库支持的数据源",
    content: "...",
  },
];
```

这种方式适合理解 RAG 的整体流程，但它不够真实。

真实企业知识库中的资料通常不会直接写在代码里，而是来自各种文件和系统，例如：

```text
Markdown 文档
PDF 文档
Word 文档
网页 URL
接口文档
需求文档
运维手册
工单系统
代码仓库说明
```

所以从第 15 课开始，我们要把 RAG 的数据来源从“代码里的数组”升级成“真实文档”。

本节课的重点是：

> 把本地 Markdown 文档加载进来，并切分成后续可以 Embedding 和检索的 chunk。

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 准备本地 Markdown 文档
2. 读取 documents 目录下的 .md 文件
3. 解析 Markdown frontmatter
4. 得到标准 LoadedDocument 对象
5. 按段落切分文档内容
6. 生成 DocumentChunk 列表
7. 为第 16 课 Embedding 做准备
```

第 14 课解决的是：

```text
RAG 的整体流程是什么？
```

第 15 课解决的是：

```text
企业原始文档如何进入知识库？
```

这一课不需要调用大模型，也不需要调用 Embedding 模型。

它更像是 RAG 系统中的“数据预处理”阶段。

---

## 二、为什么需要文档加载与切分？

企业知识库不能直接把整篇文档塞给模型。

原因很简单：

```text
1. 文档可能很长，超过模型上下文限制
2. 整篇文档信息太杂，检索粒度太粗
3. Embedding 整篇长文时，语义会被稀释
4. 用户问题通常只对应文档中的某一小段
5. 后续检索需要以 chunk 为基本单位
```

所以真实 RAG 通常会先做这件事：

```text
原始文档
  ↓
加载文档
  ↓
解析元数据
  ↓
清洗正文
  ↓
切分 chunk
  ↓
后续 Embedding / 入库 / 检索
```

第 15 课做的就是这条链路的前半部分。

---

## 三、本节整体流程

本节流程如下：

```text
本地 Markdown 文件
  ↓
markdown-loader.ts 读取文件
  ↓
解析 frontmatter
  ↓
生成 LoadedDocument
  ↓
text-splitter.ts 按段落切分
  ↓
生成 DocumentChunk
  ↓
打印文档和 chunk 信息
```

对应代码模块：

```text
documents/：存放 Markdown 原始文档
markdown-loader.ts：负责加载 Markdown 文档
text-splitter.ts：负责把文档切成 chunk
index.ts：运行加载与切分流程
```

---

## 四、本节目录结构

新建第 15 课目录：

```bash
mkdir -p src/lessons/lesson15-document-loader-splitter/{documents,loader}
```

最终目录结构：

```text
src/lessons/lesson15-document-loader-splitter/
  documents/
    knowledge-base-guide.md
    rag-optimization.md
    agent-tool-policy.md

  loader/
    markdown-loader.ts
    text-splitter.ts

  index.ts
```

这一课不需要复制第 14 课的：

```text
model/create-model.ts
```

因为本节只处理文档加载和切分，不调用大模型。

---

## 五、配置 package.json

在 `package.json` 中新增第 15 课脚本：

```json
{
  "scripts": {
    "lesson:15": "tsx src/lessons/lesson15-document-loader-splitter/index.ts"
  }
}
```

运行：

```bash
pnpm lesson:15
```

---

## 六、准备 Markdown 文档

本节准备三份 Markdown 文档，用来模拟企业知识库中的原始资料。

---

## 七、documents/knowledge-base-guide.md

文件路径：

```text
src/lessons/lesson15-document-loader-splitter/documents/knowledge-base-guide.md
```

内容如下：

```md
---
title: 企业知识库支持的数据源
source: knowledge-base-guide.md
tags: knowledge_base,datasource,rag
---

# 企业知识库支持的数据源

企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源。

Markdown 文档适合沉淀结构化技术文档，例如系统说明、接口说明、部署说明和排障手册。

PDF 和 Word 文档常见于企业制度、项目方案、验收材料和用户手册。

网页 URL 可以用于接入在线帮助文档、产品说明页面和内部知识门户。

后续计划扩展数据库表、工单系统数据和接口文档，让知识库覆盖更多企业内部资料。
```

这份文档说明企业知识库支持的数据源。

---

## 八、documents/rag-optimization.md

文件路径：

```text
src/lessons/lesson15-document-loader-splitter/documents/rag-optimization.md
```

内容如下：

```md
---
title: RAG 检索效果不好怎么办
source: rag-optimization.md
tags: rag,retrieval,optimization
---

# RAG 检索效果不好怎么办

如果 RAG 检索效果不好，可以从文档切分、Embedding 模型、召回数量、关键词补充、重排序、Prompt 约束等方面优化。

文档切分会直接影响检索质量。chunk 太大，可能包含过多无关内容；chunk 太小，可能丢失上下文。

Embedding 模型会影响语义匹配能力。不同语言、不同业务领域，适合的 Embedding 模型可能不同。

召回数量 topK 也需要调优。topK 太小可能漏掉相关资料，topK 太大可能引入噪音。

在企业知识库中，还可以结合关键词检索和向量检索，形成混合检索策略。
```

这份文档说明 RAG 检索效果不好时的优化方向。

---

## 九、documents/agent-tool-policy.md

文件路径：

```text
src/lessons/lesson15-document-loader-splitter/documents/agent-tool-policy.md
```

内容如下：

```md
---
title: Agent 工具调用规范
source: agent-tool-policy.md
tags: agent,tool_calling,security
---

# Agent 工具调用规范

Agent 调用工具前应先判断用户意图，不能因为用户输入中出现某个关键词就直接调用工具。

工具入参必须通过 schema 校验，避免模型生成不完整或错误的参数。

工具执行失败时需要有兜底响应，不能把底层异常直接暴露给用户。

操作型工具应结合权限控制和人工确认。

例如创建工单、提交审批、发送通知、删除数据等工具，都应该先检查用户权限，再根据风险等级决定是否需要人工确认。
```

这份文档和前面第 5 到第 13 课的 Agent 工具调用、安全控制内容对应。

---

## 十、Markdown frontmatter 的作用

每份文档顶部都有一段：

```md
---
title: RAG 检索效果不好怎么办
source: rag-optimization.md
tags: rag,retrieval,optimization
---
```

这部分叫 frontmatter。

它用来保存文档元信息。

在本节中，我们使用：

```text
title：文档标题
source：资料来源
tags：文档标签
```

后续做检索时，这些元信息很有用。

例如：

```text
展示答案来源
按标签过滤文档
记录 chunk 来自哪篇文档
调试检索结果
```

企业级 RAG 中，metadata 非常重要。

如果没有 metadata，就很难知道答案依据来自哪里。

---

## 十一、新增 markdown-loader.ts

文件路径：

```text
src/lessons/lesson15-document-loader-splitter/loader/markdown-loader.ts
```

代码如下：

```ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type DocumentMetadata = Record<string, string | string[]>;

export type LoadedDocument = {
  id: string;
  title: string;
  source: string;
  filePath: string;
  content: string;
  metadata: DocumentMetadata;
};

export async function loadMarkdownDocuments(params: {
  docsDir: string;
}): Promise<LoadedDocument[]> {
  const fileNames = await readdir(params.docsDir);

  const markdownFileNames = fileNames.filter((fileName) =>
    fileName.endsWith(".md"),
  );

  const documents = await Promise.all(
    markdownFileNames.map(async (fileName) => {
      const filePath = path.join(params.docsDir, fileName);

      const rawContent = await readFile(filePath, "utf-8");

      const { metadata, content } = parseMarkdownWithFrontmatter(rawContent);

      const title = getStringMetadata(
        metadata,
        "title",
        removeMarkdownExtension(fileName),
      );

      const source = getStringMetadata(metadata, "source", fileName);

      return {
        id: removeMarkdownExtension(fileName),
        title,
        source,
        filePath,
        content,
        metadata,
      };
    }),
  );

  return documents;
}

function parseMarkdownWithFrontmatter(rawContent: string): {
  metadata: DocumentMetadata;
  content: string;
} {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

  const match = rawContent.match(frontmatterRegex);

  if (!match) {
    return {
      metadata: {},
      content: rawContent.trim(),
    };
  }

  const metadataText = match[1] ?? "";
  const content = match[2] ?? "";

  return {
    metadata: parseSimpleYaml(metadataText),
    content: content.trim(),
  };
}

function parseSimpleYaml(metadataText: string): DocumentMetadata {
  const metadata: DocumentMetadata = {};

  const lines = metadataText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    metadata[key] = parseMetadataValue(rawValue);
  }

  return metadata;
}

function parseMetadataValue(rawValue: string): string | string[] {
  const value = rawValue.replace(/^["']|["']$/g, "");

  if (value.includes(",")) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return value;
}

function getStringMetadata(
  metadata: DocumentMetadata,
  key: string,
  fallback: string,
): string {
  const value = metadata[key];

  if (typeof value === "string") {
    return value;
  }

  return fallback;
}

function removeMarkdownExtension(fileName: string): string {
  return fileName.replace(/\.md$/i, "");
}
```

---

## 十二、理解 LoadedDocument

```ts
export type LoadedDocument = {
  id: string;
  title: string;
  source: string;
  filePath: string;
  content: string;
  metadata: DocumentMetadata;
};
```

`LoadedDocument` 表示一篇已经加载完成的文档。

字段含义：

```text
id：文档 ID，默认使用文件名去掉 .md 后缀
title：文档标题，优先来自 frontmatter
source：文档来源，优先来自 frontmatter
filePath：本地文件路径
content：去掉 frontmatter 后的正文
metadata：完整元信息
```

例如 `rag-optimization.md` 加载后大概是：

```json
{
  "id": "rag-optimization",
  "title": "RAG 检索效果不好怎么办",
  "source": "rag-optimization.md",
  "filePath": ".../rag-optimization.md",
  "content": "# RAG 检索效果不好怎么办\n\n如果 RAG 检索效果不好...",
  "metadata": {
    "title": "RAG 检索效果不好怎么办",
    "source": "rag-optimization.md",
    "tags": ["rag", "retrieval", "optimization"]
  }
}
```

---

## 十三、理解 loadMarkdownDocuments

核心函数是：

```ts
export async function loadMarkdownDocuments(params: {
  docsDir: string;
}): Promise<LoadedDocument[]> {
  const fileNames = await readdir(params.docsDir);

  const markdownFileNames = fileNames.filter((fileName) =>
    fileName.endsWith(".md"),
  );

  const documents = await Promise.all(
    markdownFileNames.map(async (fileName) => {
      const filePath = path.join(params.docsDir, fileName);

      const rawContent = await readFile(filePath, "utf-8");

      const { metadata, content } = parseMarkdownWithFrontmatter(rawContent);

      const title = getStringMetadata(
        metadata,
        "title",
        removeMarkdownExtension(fileName),
      );

      const source = getStringMetadata(metadata, "source", fileName);

      return {
        id: removeMarkdownExtension(fileName),
        title,
        source,
        filePath,
        content,
        metadata,
      };
    }),
  );

  return documents;
}
```

它做了几件事：

```text
1. 读取 documents 目录
2. 找到所有 .md 文件
3. 读取每个 Markdown 文件内容
4. 解析 frontmatter
5. 提取 title 和 source
6. 生成 LoadedDocument[]
```

这一课没有引入第三方 Markdown 工具。

原因是本节的重点不是 YAML 解析，而是理解 RAG 文档处理流程。

真实项目中可以换成：

```text
gray-matter
yaml
自定义 CMS 元数据
数据库字段
```

---

## 十四、理解 frontmatter 解析

核心代码：

```ts
const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
```

它的作用是识别：

```md
---
title: xxx
source: xxx
tags: xxx
---

正文内容
```

匹配后会拆成两部分：

```text
metadataText：frontmatter 中的元信息
content：Markdown 正文
```

如果没有 frontmatter，就直接把整篇内容作为正文：

```ts
if (!match) {
  return {
    metadata: {},
    content: rawContent.trim(),
  };
}
```

这样即使某些文档没有元信息，也不会加载失败。

---

## 十五、新增 text-splitter.ts

文件路径：

```text
src/lessons/lesson15-document-loader-splitter/loader/text-splitter.ts
```

代码如下：

```ts
import type { LoadedDocument } from "./markdown-loader.js";

export type DocumentChunk = {
  id: string;
  documentId: string;
  chunkIndex: number;
  title: string;
  source: string;
  content: string;
  metadata: LoadedDocument["metadata"];
};

export type TextSplitterOptions = {
  maxChunkChars: number;
  overlapChars: number;
};

export function splitDocumentsIntoChunks(
  documents: LoadedDocument[],
  options: TextSplitterOptions,
): DocumentChunk[] {
  return documents.flatMap((document) =>
    splitDocumentIntoChunks(document, options),
  );
}

function splitDocumentIntoChunks(
  document: LoadedDocument,
  options: TextSplitterOptions,
): DocumentChunk[] {
  const rawChunks = splitTextByParagraphs(
    document.content,
    options.maxChunkChars,
  );

  return rawChunks.map((chunkContent, index) => {
    const previousChunk = rawChunks[index - 1];

    const overlapText =
      previousChunk && options.overlapChars > 0
        ? previousChunk.slice(-options.overlapChars)
        : "";

    const content = overlapText
      ? `${overlapText}\n\n${chunkContent}`
      : chunkContent;

    return {
      id: `${document.id}-chunk-${index + 1}`,
      documentId: document.id,
      chunkIndex: index,
      title: document.title,
      source: document.source,
      content,
      metadata: document.metadata,
    };
  });
}

function splitTextByParagraphs(
  content: string,
  maxChunkChars: number,
): string[] {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let currentParts: string[] = [];
  let currentLength = 0;

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChunkChars) {
      flushCurrentChunk();

      const longParagraphChunks = splitLongText(paragraph, maxChunkChars);
      chunks.push(...longParagraphChunks);
      continue;
    }

    const nextLength =
      currentLength + paragraph.length + (currentParts.length > 0 ? 2 : 0);

    if (nextLength > maxChunkChars) {
      flushCurrentChunk();
    }

    currentParts.push(paragraph);
    currentLength += paragraph.length + (currentParts.length > 1 ? 2 : 0);
  }

  flushCurrentChunk();

  return chunks;

  function flushCurrentChunk() {
    if (currentParts.length === 0) {
      return;
    }

    chunks.push(currentParts.join("\n\n"));
    currentParts = [];
    currentLength = 0;
  }
}

function splitLongText(text: string, maxChunkChars: number): string[] {
  const chunks: string[] = [];

  for (let start = 0; start < text.length; start += maxChunkChars) {
    chunks.push(text.slice(start, start + maxChunkChars));
  }

  return chunks;
}
```

---

## 十六、理解 DocumentChunk

```ts
export type DocumentChunk = {
  id: string;
  documentId: string;
  chunkIndex: number;
  title: string;
  source: string;
  content: string;
  metadata: LoadedDocument["metadata"];
};
```

`DocumentChunk` 表示切分后的文档片段。

字段含义：

```text
id：chunk 唯一 ID
documentId：来源文档 ID
chunkIndex：在原文档中的片段序号
title：来源文档标题
source：来源文件
content：chunk 正文
metadata：继承自原文档的元信息
```

后续第 16 课做 Embedding 时，基本单位就会从 `LoadedDocument` 变成 `DocumentChunk`。

也就是说：

```text
不是整篇文档生成一个向量
而是每个 chunk 生成一个向量
```

---

## 十七、为什么要切成 chunk？

RAG 的效果很大程度取决于 chunk 质量。

如果 chunk 太大：

```text
1. 一个 chunk 里混入太多无关信息
2. Embedding 表达会变得模糊
3. 检索出来的内容不够精准
4. 模型拿到的上下文噪音太多
```

如果 chunk 太小：

```text
1. 语义不完整
2. 上下文断裂
3. 答案缺少背景
4. 检索结果可能只命中局部片段
```

所以 chunk 切分不是简单技术细节，而是 RAG 效果的核心影响因素之一。

---

## 十八、本节切分策略

本节使用一个简单的段落切分策略：

```text
1. 按空行拆分段落
2. 多个段落累积成一个 chunk
3. 如果超过 maxChunkChars，就生成一个新 chunk
4. 如果某个段落特别长，就按字符长度硬切
5. 相邻 chunk 之间保留少量 overlap
```

配置示例：

```ts
{
  maxChunkChars: 220,
  overlapChars: 40,
}
```

含义是：

```text
每个 chunk 尽量控制在 220 个字符左右
相邻 chunk 之间保留 40 个字符重叠
```

---

## 十九、为什么需要 overlap？

如果完全硬切，可能导致上下文断裂。

例如上一段说：

```text
操作型工具应结合权限控制和人工确认。
```

下一段说：

```text
例如创建工单、提交审批、发送通知、删除数据等工具，都应该先检查用户权限。
```

如果这两段被切到不同 chunk 中，检索时可能只召回后一段，丢失“操作型工具”的背景。

所以相邻 chunk 之间保留少量重叠内容，可以让上下文更连续。

不过 overlap 也不能太大。

如果太大，会导致：

```text
1. 重复内容太多
2. 存储成本变高
3. 检索结果重复
4. 上下文浪费
```

所以 chunk size 和 overlap 都需要根据实际文档调试。

---

## 二十、编写 index.ts

文件路径：

```text
src/lessons/lesson15-document-loader-splitter/index.ts
```

代码如下：

```ts
import path from "node:path";

import { loadMarkdownDocuments } from "./loader/markdown-loader.js";
import { splitDocumentsIntoChunks } from "./loader/text-splitter.js";

async function main() {
  const docsDir = path.resolve(
    process.cwd(),
    "src/lessons/lesson15-document-loader-splitter/documents",
  );

  const documents = await loadMarkdownDocuments({
    docsDir,
  });

  const chunks = splitDocumentsIntoChunks(documents, {
    maxChunkChars: 220,
    overlapChars: 40,
  });

  console.log("\n========== 加载到的文档 ==========");
  console.log(
    documents.map((document) => ({
      id: document.id,
      title: document.title,
      source: document.source,
      metadata: document.metadata,
      contentLength: document.content.length,
    })),
  );

  console.log("\n========== 生成的 Chunk 概览 ==========");
  console.log(
    chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      title: chunk.title,
      source: chunk.source,
      contentLength: chunk.content.length,
    })),
  );

  console.log("\n========== Chunk 内容预览 ==========");

  for (const chunk of chunks) {
    console.log("\n----------------------------------------");
    console.log(`chunkId: ${chunk.id}`);
    console.log(`title: ${chunk.title}`);
    console.log(`source: ${chunk.source}`);
    console.log(`content:\n${chunk.content}`);
  }

  console.log("\n========== 统计信息 ==========");
  console.log("文档数量：", documents.length);
  console.log("Chunk 数量：", chunks.length);
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 二十一、理解 index.ts

入口文件做了四件事。

第一步，定位 documents 目录：

```ts
const docsDir = path.resolve(
  process.cwd(),
  "src/lessons/lesson15-document-loader-splitter/documents",
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

第四步，打印结果：

```ts
console.log("文档数量：", documents.length);
console.log("Chunk 数量：", chunks.length);
```

这一课的目标不是生成答案，而是确认文档处理结果是否符合预期。

---

## 二十二、运行第 15 课

执行：

```bash
pnpm lesson:15
```

你会看到三类输出。

第一类是加载到的文档：

```text
========== 加载到的文档 ==========
[
  {
    id: 'knowledge-base-guide',
    title: '企业知识库支持的数据源',
    source: 'knowledge-base-guide.md',
    metadata: {
      title: '企业知识库支持的数据源',
      source: 'knowledge-base-guide.md',
      tags: [ 'knowledge_base', 'datasource', 'rag' ]
    },
    contentLength: 200
  }
]
```

第二类是生成的 chunk 概览：

```text
========== 生成的 Chunk 概览 ==========
[
  {
    id: 'knowledge-base-guide-chunk-1',
    documentId: 'knowledge-base-guide',
    chunkIndex: 0,
    title: '企业知识库支持的数据源',
    source: 'knowledge-base-guide.md',
    contentLength: 180
  }
]
```

第三类是 chunk 内容预览：

```text
========== Chunk 内容预览 ==========
chunkId: knowledge-base-guide-chunk-1
title: 企业知识库支持的数据源
source: knowledge-base-guide.md
content:
# 企业知识库支持的数据源

企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源。
```

最后会输出统计信息：

```text
文档数量： 3
Chunk 数量： 若干
```

具体 chunk 数量取决于文档内容和 `maxChunkChars` 配置。

---

## 二十三、第 15 课和第 14 课的区别

第 14 课的数据是代码里的数组：

```ts
export const enterpriseDocs = [
  {
    title: "...",
    content: "...",
  },
];
```

第 15 课的数据来源变成了真实文件：

```text
documents/*.md
```

第 14 课关注的是：

```text
RAG 流程整体怎么跑通？
```

第 15 课关注的是：

```text
原始文档怎么变成可以检索和向量化的 chunk？
```

所以第 15 课更接近真实 RAG 系统的数据接入流程。

---

## 二十四、Java 后端视角理解

可以把第 15 课理解成知识库的数据入库前处理流程。

类似后端 ETL：

```text
原始文件
  ↓
读取文件
  ↓
解析元数据
  ↓
清洗正文
  ↓
切分片段
  ↓
生成待入库记录
```

如果用 Java 类比，可能会设计成：

```java
public class DocumentIngestionService {

    public List<DocumentChunk> ingest(Path docsDir) {
        List<LoadedDocument> documents = documentLoader.load(docsDir);

        return textSplitter.split(documents);
    }
}
```

也可以拆成两个服务：

```java
public interface DocumentLoader {
    List<LoadedDocument> load(Path docsDir);
}

public interface TextSplitter {
    List<DocumentChunk> split(List<LoadedDocument> documents);
}
```

对应到本节代码：

```text
markdown-loader.ts 类似 DocumentLoader
text-splitter.ts 类似 TextSplitter
DocumentChunk 类似后续要入库的数据对象
```

第 16 课之后，每个 chunk 会继续变成：

```text
DocumentChunk + Embedding Vector
```

---

## 二十五、企业级 RAG 中的文档处理难点

本节只是最小版本。

真实企业项目中的文档处理会复杂很多。

### 1. 多格式文档

真实企业资料可能有：

```text
Markdown
TXT
PDF
Word
Excel
HTML
接口文档
数据库记录
代码注释
```

每种格式都需要不同 loader。

---

### 2. 文档清洗

原始文档可能有很多噪音：

```text
页眉页脚
目录
水印
重复标题
乱码
无意义空行
表格格式丢失
```

这些都会影响后续检索效果。

---

### 3. 元数据管理

企业 RAG 中，metadata 不只是 title 和 tags。

还可能包括：

```text
部门
项目
系统
权限范围
文档版本
创建时间
更新时间
数据来源
保密等级
```

这些信息会影响检索和权限控制。

---

### 4. chunk 策略调优

不同文档适合不同切分方式。

例如：

```text
接口文档适合按接口切
FAQ 适合按问答对切
Markdown 适合按标题层级切
长篇制度适合按段落和章节切
代码文档适合按函数或类切
```

所以 chunk 策略通常需要结合业务文档类型设计。

---

## 二十六、TypeScript Tips

### 1. Node.js 内置模块导入

```ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
```

这里使用的是 Node.js 内置模块。

```text
node:fs/promises 用于异步读取文件
node:path 用于处理路径
```

如果 VSCode 里 `node:fs/promises` 或 `process` 标红，通常需要安装 Node 类型：

```bash
pnpm add -D @types/node
```

---

### 2. Promise.all

```ts
const documents = await Promise.all(
  markdownFileNames.map(async (fileName) => {
    // ...
  }),
);
```

`Promise.all` 用来并行读取多个 Markdown 文件。

可以类比 Java 中并发执行多个任务后统一等待结果。

---

### 3. Record

```ts
export type DocumentMetadata = Record<string, string | string[]>;
```

意思是：

```text
metadata 是一个对象
key 是 string
value 可以是 string 或 string[]
```

类似 Java 中：

```java
Map<String, Object>
```

但 TypeScript 这里限制得更具体。

---

### 4. flatMap

```ts
return documents.flatMap((document) =>
  splitDocumentIntoChunks(document, options),
);
```

`flatMap` 的作用是：

```text
先 map，再 flatten
```

也就是：

```text
每篇文档生成多个 chunk
最后合并成一个 chunk 数组
```

如果用 Java Stream 类比：

```java
documents.stream()
    .flatMap(document -> split(document).stream())
    .toList();
```

---

### 5. 正则切分段落

```ts
.split(/\n\s*\n/)
```

意思是按空行切分段落。

它可以匹配：

```text
一个换行
中间可能有空格
再一个换行
```

适合处理 Markdown 段落。

---

### 6. 内部函数

```ts
function flushCurrentChunk() {
  if (currentParts.length === 0) {
    return;
  }

  chunks.push(currentParts.join("\n\n"));
  currentParts = [];
  currentLength = 0;
}
```

`flushCurrentChunk` 是定义在 `splitTextByParagraphs` 内部的函数。

它只能在外层函数内部使用。

这样可以把“提交当前 chunk”的逻辑封装起来，同时避免暴露到外部模块。

---

## 二十七、本节总结

第 15 课完成了文档加载与切分。

核心收获：

```text
1. RAG 不能只依赖内存数组，真实项目需要加载原始文档
2. Markdown 文档可以作为知识库的第一种数据源
3. frontmatter 可以保存 title、source、tags 等元信息
4. LoadedDocument 表示加载后的完整文档
5. DocumentChunk 表示切分后的文档片段
6. chunk 是后续 Embedding 和检索的基本单位
7. chunk 大小和 overlap 会影响 RAG 检索效果
8. 第 15 课为第 16 课 Embedding 做准备
```

本节最重要的一句话：

> 企业知识库不是直接把整篇文档塞给模型，而是先把文档处理成可检索、可向量化的 chunk。

---

## 二十八、下一课预告

下一课进入：

# 第 16 课：Embedding 入门，把文本转换成向量

第 16 课会开始处理：

```text
1. 什么是 Embedding
2. 为什么 chunk 需要转成向量
3. 如何调用 Embedding 模型
4. 如何把 DocumentChunk 转成 ChunkEmbedding
5. 为第 17 课内存版 Vector Store 做准备
```

第 15 课解决的是：

```text
企业原始文档如何进入知识库？
```

第 16 课要解决的是：

```text
文档 chunk 如何变成可以做语义检索的向量？
```
