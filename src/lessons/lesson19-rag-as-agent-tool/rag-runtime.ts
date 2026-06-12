import path from "node:path";

import type { RagChatModel } from "./rag/rag-qa-chain.js";
import { createEmbeddingModel } from "./embedding/create-embedding-model.js";
import { embedChunks } from "./embedding/chunk-embedding.js";
import { loadMarkdownDocuments } from "./loader/markdown-loader.js";
import { splitDocumentsIntoChunks } from "./loader/text-splitter.js";
import { RagQaChain } from "./rag/rag-qa-chain.js";
import { MemoryVectorStore } from "./vector-store/memory-vector-store.js";

export type RagRuntime = {
  ragQaChain: RagQaChain;
  documentCount: number;
  chunkCount: number;
  embeddingCount: number;
};

export async function createRagRuntime(params: {
  model: RagChatModel;
}): Promise<RagRuntime> {
  const docsDir = path.resolve(
    process.cwd(),
    "src/lessons/lesson19-rag-as-agent-tool/documents",
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

  const ragQaChain = new RagQaChain(params.model, vectorStore, {
    topK: 3,
    minScore: 0.3,
  });

  return {
    ragQaChain,
    documentCount: documents.length,
    chunkCount: chunks.length,
    embeddingCount: chunkEmbeddings.length,
  };
}