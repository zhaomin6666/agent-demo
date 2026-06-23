import { HumanMessage, SystemMessage } from "langchain";
import { createModel } from "./model/create-model.js";
import { AgentStreamRequest } from "./types.js";

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

export async function* streamAgentAnswer(
  input: AgentStreamRequest,
): AsyncGenerator<string> {
  const model = createModel();

  const stream = await model.stream([
    new SystemMessage(
      [
        "你是一个企业级 AI Agent Demo 助手。",
        "你的回答要清晰、结构化。",
        "请尽量使用 Java 后端工程师容易理解的类比。",
        "回答时可以分段，但不要过度冗长。",
      ].join("\n"),
    ),
    new HumanMessage(input.message),
  ]);

  for await (const chunk of stream) {
    const text = contentToText(chunk.content);

    if (text) {
      yield text;
    }
  }
}
