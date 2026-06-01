import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

async function main() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseURL = process.env.DASHSCOPE_BASE_URL;

  if (!apiKey) {
    throw new Error("缺少环境变量 DASHSCOPE_API_KEY");
  }

  if (!baseURL) {
    throw new Error("缺少环境变量 DASHSCOPE_BASE_URL");
  }

  const model = new ChatOpenAI({
    model: "qwen3.6-flash",
    temperature: 0,
    apiKey,
    configuration: {
      baseURL,
    },
  });

  const response = await model.invoke([
    new SystemMessage("你是一位擅长讲解 AI 工程实践的技术导师。"),
    new HumanMessage("请用 100 字以内解释什么是 RAG。"),
  ]);

  console.log("模型回答：");
  console.log(response.content);
}

main().catch((error) => {
  console.error("运行失败：", error);
});