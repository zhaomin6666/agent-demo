import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

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

function extractJson(text: string): string {
  const cleaned = text.trim();

  if (cleaned.startsWith("```json")) {
    return cleaned
      .replace(/^```json\s*/, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  if (cleaned.startsWith("```")) {
    return cleaned
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  return cleaned;
}

const IntentSchema = z.object({
  intent: z.enum([
    "query_order",
    "create_ticket",
    "ask_knowledge_base",
    "unknown",
  ]),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

type IntentResult = z.infer<typeof IntentSchema>;

async function demoJsonOutput() {
  const model = createModel();

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `你是一个用户意图识别助手。

你需要判断用户输入属于哪一种意图：

1. query_order：查询订单
2. create_ticket：创建工单
3. ask_knowledge_base：询问知识库问题
4. unknown：无法判断

请严格返回 JSON，不要返回 Markdown，不要返回解释文字。

JSON 格式如下：
{{
  "intent": "query_order | create_ticket | ask_knowledge_base | unknown",
  "confidence": 0到1之间的数字,
  "reason": "判断原因"
}}`,
    ],
    ["human", `用户输入：{input}`],
  ]);

  const messages = await prompt.formatMessages({
    input: "帮我查一下订单尾号为123的订单",
  });

  const response = await model.invoke(messages);

  console.log("=== 模型输出 ===");
  console.log(response.content);

  const jsonText = extractJson(response.content.toString());

  console.log("\n=== 提取的json字符串 ===");
  console.log(jsonText);

  const parsed = JSON.parse(jsonText);

  const result: IntentResult = IntentSchema.parse(parsed);

  console.log("\n=== zod 校验后的结构化对象 ===");
  console.log(result);

  console.log("\n=== 业务系统可以直接使用的字段 ===");
  console.log("intent:", result.intent);
  console.log("confidence:", result.confidence);
  console.log("reason:", result.reason);
}

async function main() {
  await demoJsonOutput();
}

main().catch((error) => {
  console.error("运行失败：", error);
});
