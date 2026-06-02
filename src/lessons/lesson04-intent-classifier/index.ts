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

type IntentClassifierResult = IntentResult & {
  rawOutput: string;
  success: boolean;
  errorMessage?: string;
};

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

function fallbackIntentResult(params: {
  rawOutput: string;
  errorMessage: string;
}): IntentClassifierResult {
  return {
    intent: "unknown",
    confidence: 0,
    reason: "意图识别失败，已返回兜底结果。",
    rawOutput: params.rawOutput,
    success: false,
    errorMessage: params.errorMessage,
  };
}

class IntentClassifier {
  private readonly model = createModel();

  private readonly prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `
你是一个用户意图识别助手。

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
}}
`,
    ],
    ["human", "用户输入：{input}"],
  ]);

  async classify(input: string): Promise<IntentClassifierResult> {
    let rawOutput = "";

    try {
      const messages = await this.prompt.formatMessages({
        input,
      });

      const response = await this.model.invoke(messages);

      rawOutput = response.content.toString();

      const jsonText = extractJson(rawOutput);
      const parsed = JSON.parse(jsonText);
      const result = IntentSchema.parse(parsed);

      return {
        ...result,
        rawOutput,
        success: true,
      };
    } catch (error) {
      return fallbackIntentResult({
        rawOutput,
        errorMessage:
          error instanceof Error ? error.message : "未知意图识别错误",
      });
    }
  }
}

async function main() {
  const classifier = new IntentClassifier();

  const inputs = [
    "帮我查一下订单尾号为123的订单",
    "系统登录一直失败，帮我提交一个问题",
    "RAG和GREP有什么区别？",
    "我今天有点累",
  ];

  for (const input of inputs) {
    const result = await classifier.classify(input);

    console.log("\n==============================");
    console.log("用户输入：", input);
    console.log("识别结果：", result.intent);
    console.log("置信度：", result.confidence);
    console.log("原因：", result.reason);
    console.log("是否成功：", result.success);

    if (!result.success) {
      console.log("错误信息：", result.errorMessage);
      console.log("模型原始输出：", result.rawOutput);
    }
  }
}

main().catch((error) => {
  console.error("运行失败：", error);
});