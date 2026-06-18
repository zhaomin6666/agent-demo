import "dotenv/config";

import { OpenAIEmbeddings } from "@langchain/openai";

export function createEmbeddingModel() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseURL = process.env.DASHSCOPE_BASE_URL;

  if (!apiKey) {
    throw new Error("缺少环境变量：DASHSCOPE_API_KEY");
  }

  if (!baseURL) {
    throw new Error("缺少环境变量：DASHSCOPE_BASE_URL");
  }

  return new OpenAIEmbeddings({
    model: "text-embedding-v4",
    apiKey,
    batchSize: 10,
    configuration: {
      baseURL,
    },
  });
}