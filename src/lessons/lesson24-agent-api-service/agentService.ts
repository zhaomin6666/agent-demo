import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createModel } from "./model/create-model.js";
import { AgentApiRequest, AgentApiResponse } from "./types.js";

export type AgentRequest = {
  message: string;
};

export type AgentResponse = {
  answer: string;
};

export async function runAgentApiDemo(
  input: AgentApiRequest,
): Promise<AgentApiResponse> {
  const model = createModel();

  const result = await model.invoke([
    new SystemMessage(
      [
        "你是一个企业级 AI Agent Demo 助手。",
        "你的回答要清晰、结构化。",
        "请尽量使用 Java 后端工程师容易理解的类比。",
      ].join("\n"),
    ),
    new HumanMessage(input.message),
  ]);

  return {
    answer: String(result.content),
  };
}
