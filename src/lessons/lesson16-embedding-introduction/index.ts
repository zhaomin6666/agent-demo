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