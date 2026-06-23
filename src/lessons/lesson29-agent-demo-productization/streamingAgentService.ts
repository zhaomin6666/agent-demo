import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type {
  AgentStreamChunk,
  AgentStreamRequest,
  SourceItem,
  TraceStep,
} from "./types.js";

type SourceCandidate = SourceItem & {
  keywords: string[];
};

const SOURCE_LIBRARY: SourceCandidate[] = [
  {
    id: "lesson25-sse",
    title: "Lesson 25：SSE 流式输出",
    type: "lesson",
    snippet:
      "后端通过 text/event-stream 持续写入 start、delta、done、error 事件，让客户端可以边接收边展示。",
    keywords: ["sse", "stream", "streaming", "流式", "分段", "event-stream"],
  },
  {
    id: "lesson26-chat-ui",
    title: "Lesson 26：前端 Chat UI",
    type: "lesson",
    snippet:
      "前端使用 fetch 发送 POST 请求，并通过 response.body.getReader() 一块一块读取 SSE 文本流。",
    keywords: ["chat", "ui", "fetch", "前端", "页面", "getReader"],
  },
  {
    id: "lesson27-token-output",
    title: "Lesson 27：逐字输出与停止生成",
    type: "lesson",
    snippet:
      "前端把模型返回的 delta 放入 pendingText 队列，再用定时器逐字输出，同时使用 AbortController 支持停止生成。",
    keywords: ["逐字", "停止", "abort", "AbortController", "token"],
  },
  {
    id: "agent-observability",
    title: "Agent 可观测性",
    type: "doc",
    snippet:
      "企业级 Agent Demo 不应该只展示最终答案，还应该展示 requestId、耗时、步骤状态、工具调用和参考来源。",
    keywords: ["trace", "sources", "observability", "可观测", "来源", "步骤"],
  },
];

function createModel() {
  return new ChatOpenAI({
    model: "qwen3.6-flash",
    temperature: 0.2,
    apiKey: process.env.DASHSCOPE_API_KEY,
    configuration: {
      baseURL: process.env.DASHSCOPE_BASE_URL,
    },
  });
}

function createTraceStep(input: Omit<TraceStep, "timestamp">): TraceStep {
  return {
    ...input,
    timestamp: new Date().toISOString(),
  };
}

function contentToText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (
          item &&
          typeof item === "object" &&
          "text" in item &&
          typeof item.text === "string"
        ) {
          return item.text;
        }

        return "";
      })
      .join("");
  }

  return "";
}

function selectSources(message: string): SourceItem[] {
  const normalizedMessage = message.toLowerCase();

  const matched = SOURCE_LIBRARY.filter((source) =>
    source.keywords.some((keyword) =>
      normalizedMessage.includes(keyword.toLowerCase()),
    ),
  );

  const selected = matched.length > 0 ? matched : SOURCE_LIBRARY.slice(0, 3);

  return selected.slice(0, 3).map((source) => ({
    id: source.id,
    title: source.title,
    type: source.type,
    url: source.url,
    snippet: source.snippet,
  }));
}

export async function* streamAgentAnswer(
  input: AgentStreamRequest,
): AsyncGenerator<AgentStreamChunk> {
  const prepareStart = Date.now();

  yield {
    type: "trace",
    step: createTraceStep({
      id: "prepare_context",
      title: "准备上下文",
      status: "running",
      detail: "根据用户问题选择可展示的 Sources，并组织系统提示词。",
    }),
  };

  const sources = selectSources(input.message);

  const sourceContext = sources
    .map((source, index) => {
      return [
        `资料 ${index + 1}: ${source.title}`,
        `类型: ${source.type}`,
        `摘要: ${source.snippet}`,
      ].join("\n");
    })
    .join("\n\n");

  yield {
    type: "trace",
    step: createTraceStep({
      id: "prepare_context",
      title: "准备上下文",
      status: "completed",
      detail: `已选择 ${sources.length} 条 Sources。`,
      durationMs: Date.now() - prepareStart,
    }),
  };

  yield {
    type: "trace",
    step: createTraceStep({
      id: "emit_sources",
      title: "输出 Sources",
      status: "running",
      detail: "把本次回答使用到的来源信息发送给前端展示。",
    }),
  };

  for (const source of sources) {
    yield {
      type: "source",
      source,
    };
  }

  yield {
    type: "trace",
    step: createTraceStep({
      id: "emit_sources",
      title: "输出 Sources",
      status: "completed",
      detail: "Sources 已发送给前端。",
      durationMs: 1,
    }),
  };

  const modelStart = Date.now();

  yield {
    type: "trace",
    step: createTraceStep({
      id: "call_model",
      title: "调用大模型",
      status: "running",
      detail: "开始调用 qwen3.6-flash，并以流式方式读取模型输出。",
    }),
  };

  const model = createModel();

  const stream = await model.stream([
    new SystemMessage(
      [
        "你是一个企业级 AI Agent Demo 助手。",
        "你的回答要清晰、结构化。",
        "请尽量使用 Java 后端工程师容易理解的类比。",
        "回答时可以参考下面的 Sources 摘要，但不要编造不存在的引用。",
        "",
        "可参考 Sources：",
        sourceContext,
      ].join("\n"),
    ),
    new HumanMessage(input.message),
  ]);

  for await (const chunk of stream) {
    const text = contentToText(chunk.content);

    if (text) {
      yield {
        type: "delta",
        content: text,
      };
    }
  }

  yield {
    type: "trace",
    step: createTraceStep({
      id: "call_model",
      title: "调用大模型",
      status: "completed",
      detail: "模型流式输出完成。",
      durationMs: Date.now() - modelStart,
    }),
  };
}