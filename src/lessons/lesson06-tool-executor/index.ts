import "dotenv/config";

import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type AIMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import * as z from "zod";

type KnowledgeDoc = {
  id: string;
  title: string;
  content: string;
  tags: string[];
};

const knowledgeDocs: KnowledgeDoc[] = [
  {
    id: "doc-001",
    title: "企业知识库支持的数据源",
    content:
      "企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源。后续会扩展数据库表和工单系统数据。",
    tags: ["knowledge_base", "datasource", "rag"],
  },
  {
    id: "doc-002",
    title: "RAG 检索效果不好怎么办",
    content:
      "如果 RAG 检索效果不好，可以从文档切分、Embedding 模型、召回数量、关键词补充、重排序、Prompt 约束等方面优化。",
    tags: ["knowledge_base", "rag", "retrieval"],
  },
  {
    id: "doc-003",
    title: "Agent 工具调用规范",
    content:
      "Agent 调用工具前应先判断意图，工具入参必须通过 schema 校验，工具执行失败时需要有兜底响应。",
    tags: ["agent", "tool_calling"],
  },
];

const searchKnowledgeBaseTool = tool(
  async ({ query }) => {
    const lowerQuery = query.toLowerCase();

    const results = knowledgeDocs.filter((doc) => {
      return (
        doc.title.toLowerCase().includes(lowerQuery) ||
        doc.content.toLowerCase().includes(lowerQuery) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    });

    return JSON.stringify(
      {
        query,
        count: results.length,
        results,
      },
      null,
      2,
    );
  },
  {
    name: "search_knowledge_base",
    description:
      "查询企业 AI 知识库中的内部资料。当用户询问知识库、RAG、文档接入、检索优化、Agent 工具规范时使用。",
    schema: z.object({
      query: z
        .string()
        .describe("用于检索知识库的关键词，例如：RAG、数据源、工具调用规范"),
    }),
  },
);

const createTicketTool = tool(
  async ({ title, description, priority }) => {
    const ticketNo = `TICKET-${Date.now()}`;

    return JSON.stringify(
      {
        ticketNo,
        title,
        description,
        priority,
        status: "created",
        message: "工单已创建，后续将由技术支持人员跟进。",
      },
      null,
      2,
    );
  },
  {
    name: "create_ticket",
    description:
      "创建技术支持工单。当用户明确要求反馈问题、创建工单、提交故障、联系技术支持时使用。",
    schema: z.object({
      title: z.string().describe("工单标题，简短概括用户遇到的问题"),
      description: z.string().describe("工单详细描述"),
      priority: z.enum(["low", "medium", "high"]).describe("工单优先级"),
    }),
  },
);

const tools: StructuredToolInterface[] = [
  searchKnowledgeBaseTool,
  createTicketTool,
];

type ToolCall = NonNullable<AIMessage["tool_calls"]>[number];

type ToolExecutionStatus = "success" | "tool_not_found" | "error";

type ToolExecutionRecord = {
  toolName: string;
  toolCallId?: string;
  args: unknown;
  status: ToolExecutionStatus;
  content: string;
  errorMessage?: string;
  durationMs: number;
};

type ToolExecutionResult = {
  messages: ToolMessage[];
  records: ToolExecutionRecord[];
  hasError: boolean;
};

class ToolExecutor {
  private readonly toolMap: Map<string, StructuredToolInterface>;

  constructor(tools: StructuredToolInterface[]) {
    this.toolMap = new Map(tools.map((item) => [item.name, item]));
  }

  async execute(toolCalls: ToolCall[]): Promise<ToolExecutionResult> {
    const messages: ToolMessage[] = [];
    const records: ToolExecutionRecord[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeOne(toolCall);

      messages.push(result.message);
      records.push(result.record);
    }

    return {
      messages,
      records,
      hasError: records.some((record) => record.status !== "success"),
    };
  }

  private async executeOne(toolCall: ToolCall): Promise<{
    message: ToolMessage;
    record: ToolExecutionRecord;
  }> {
    const startTime = Date.now();
    const selectedTool = this.toolMap.get(toolCall.name);

    if (!selectedTool) {
      const content = JSON.stringify(
        {
          status: "tool_not_found",
          message: `未找到工具：${toolCall.name}`,
        },
        null,
        2,
      );

      const message = new ToolMessage({
        content,
        tool_call_id: toolCall.id ?? `${toolCall.name}-missing-id`,
        name: toolCall.name,
      });

      return {
        message,
        record: {
          toolName: toolCall.name,
          toolCallId: toolCall.id,
          args: toolCall.args,
          status: "tool_not_found",
          content,
          errorMessage: `未找到工具：${toolCall.name}`,
          durationMs: Date.now() - startTime,
        },
      };
    }

    try {
      const message = await selectedTool.invoke(toolCall);

      const content = this.stringifyContent(message.content);

      return {
        message,
        record: {
          toolName: toolCall.name,
          toolCallId: toolCall.id,
          args: toolCall.args,
          status: "success",
          content,
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "未知工具执行错误";

      const content = JSON.stringify(
        {
          status: "error",
          message: `工具 ${toolCall.name} 执行失败`,
          errorMessage,
        },
        null,
        2,
      );

      const message = new ToolMessage({
        content,
        tool_call_id: toolCall.id ?? `${toolCall.name}-error-id`,
        name: toolCall.name,
      });

      return {
        message,
        record: {
          toolName: toolCall.name,
          toolCallId: toolCall.id,
          args: toolCall.args,
          status: "error",
          content,
          errorMessage,
          durationMs: Date.now() - startTime,
        },
      };
    }
  }

  private stringifyContent(content: unknown): string {
    if (typeof content === "string") {
      return content;
    }

    return JSON.stringify(content, null, 2);
  }
}

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
    streamUsage: false,
  });
}

const model = createModel();
const modelWithTools = model.bindTools(tools);
const toolExecutor = new ToolExecutor(tools);

async function runAgent(userInput: string) {
  const messages: BaseMessage[] = [
    new SystemMessage(`
你是一个企业 AI 知识库 / Agent Demo 助手。

规则：
1. 如果用户问的是企业知识库、RAG、文档接入、检索优化、Agent 工具规范，优先调用 search_knowledge_base。
2. 如果用户要求创建工单、反馈问题、提交故障，调用 create_ticket。
3. 不要编造内部系统信息，能查工具就查工具。
4. 工具执行后，请用自然语言总结工具返回结果。
5. 如果工具执行失败，请基于工具错误信息给用户一个友好的解释。
`),
    new HumanMessage(userInput),
  ];

  console.log("\n==============================");
  console.log("用户输入：", userInput);

  const aiMessage = await modelWithTools.invoke(messages);

  console.log("\n第一次模型返回：");
  console.log("content:", aiMessage.content);
  console.log("tool_calls:", JSON.stringify(aiMessage.tool_calls, null, 2));

  messages.push(aiMessage);

  const toolCalls = aiMessage.tool_calls ?? [];

  if (toolCalls.length === 0) {
    console.log("\n模型没有选择调用工具，直接回复：");
    console.log(aiMessage.content);
    return;
  }

  const executionResult = await toolExecutor.execute(toolCalls);

  console.log("\n工具执行日志：");
  console.log(JSON.stringify(executionResult.records, null, 2));

  messages.push(...executionResult.messages);

  const finalMessage = await modelWithTools.invoke(messages);

  console.log("\n最终回答：");
  console.log(finalMessage.content);
}

async function main() {
  await runAgent("我们的企业知识库支持哪些数据源接入？");

  await runAgent("RAG 检索效果不好，一般可以从哪些方面优化？");

  await runAgent("知识库搜索 PDF 内容经常搜不到，帮我创建一个高优先级工单。");
}

main().catch((error) => {
  console.error("运行失败：", error);
});