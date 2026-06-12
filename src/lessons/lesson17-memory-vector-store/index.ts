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