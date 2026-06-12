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
  return documents.flatMap((document) => splitDocumentIntoChunks(document, options));
}

function splitDocumentIntoChunks(
  document: LoadedDocument,
  options: TextSplitterOptions,
): DocumentChunk[] {
  const rawChunks = splitTextByParagraphs(document.content, options.maxChunkChars);

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