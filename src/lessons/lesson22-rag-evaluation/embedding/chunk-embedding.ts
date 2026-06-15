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