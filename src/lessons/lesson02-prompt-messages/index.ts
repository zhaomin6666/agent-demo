import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";

function createModel() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseURL = process.env.DASHSCOPE_BASE_URL;

  if (!apiKey) {
    throw new Error("缺少环境变量 DASHSCOPE_API_KEY");
  }

  if (!baseURL) {
    throw new Error("缺少环境变量 DASHSCOPE_BASE_URL");
  }

  return new ChatOpenAI({
    model: "qwen3.6-flash",
    temperature: 0,
    apiKey,
    configuration: {
      baseURL,
    },
  });
}

async function demoBasicMessages() {
  const model = createModel();

  const response = await model.invoke([
    new SystemMessage("你是一位擅长讲解 AI 工程实践的技术导师。"),
    new HumanMessage("请用 100 字以内解释 LangChain 是什么。"),
  ]);

  console.log("=== Demo 1：基础消息调用 ===");
  console.log(response.content);
}

async function demoConversationMessages() {
  const model = createModel();

  const response = await model.invoke([
    new SystemMessage("你是一位友好的学习助手。"),
    new HumanMessage("我叫小明，我正在学习 AI Agent。"),
    new AIMessage("好的，小明，我知道你正在学习 AI Agent。"),
    new HumanMessage("我叫什么？我正在学习什么？"),
  ]);

  console.log("\n=== Demo 2：模拟多轮对话 ===");
  console.log(response.content);
}

async function demoPromptTemplate() {
  const model = createModel();

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "你是一位{role}。请用适合 Java 后端开发者的方式解释技术概念。",
    ],
    [
      "human",
      "请解释：{topic}。要求：控制在 {wordCount} 字以内。",
    ],
  ]);

  const messages = await prompt.formatMessages({
    role: "AI 工程导师",
    topic: "RAG",
    wordCount: 120,
  });

  const response = await model.invoke(messages);

  console.log("\n=== Demo 3：ChatPromptTemplate 调用 ===");
  console.log(response.content);
}

async function demoCodeReviewPrompt() {
  const model = createModel();

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `
你是一位资深 Java 后端开发专家。
你擅长 Spring Boot、数据库、接口设计和代码可维护性分析。
请用清晰、直接、可落地的方式回答。
`,
    ],
    [
      "human",
      `
请帮我审查下面这段代码，指出可能的问题和改进建议。

代码：
{code}
`,
    ],
  ]);

  const messages = await prompt.formatMessages({
    code: `
public String getUserName(User user) {
    return user.getName().trim();
}
`,
  });

  const response = await model.invoke(messages);

  console.log("\n=== Demo 4：业务化 Prompt 示例 ===");
  console.log(response.content);
}

async function practiceDemo() {
    const model = createModel();

    const prompt = ChatPromptTemplate.fromMessages([
        [
            "system",
             `你是一名负责招聘{position}工程师的面试官。`,
        ],[
            "human",
             `请围绕{topic}出{num}个问题，并给出参考答案。`,
        ]
    ]);

    const messages = await prompt.formatMessages({
        position: `AI Agent`,
        topic: `MCP`,
        num: 3
    });

    const response = await model.invoke(messages);

    console.log("\n=== Practise： 课后练习 ===");
    console.log(response.content);
}

async function main() {
  //await demoBasicMessages();
  //await demoConversationMessages();
  //await demoPromptTemplate();
  //demoCodeReviewPrompt();
  practiceDemo();
}

main().catch((error) => {
  console.error("运行失败：", error);
});