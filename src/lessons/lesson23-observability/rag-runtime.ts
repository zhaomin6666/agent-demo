import path from "node:path";

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
import { TraceRecorder } from "./observability/trace-recorder.js";

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
    "src/lessons/lesson22-rag-evaluation/documents",
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
      minScore: 0.5,
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
