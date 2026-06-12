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
    minScore: 0.5,
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