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