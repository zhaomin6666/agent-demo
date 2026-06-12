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