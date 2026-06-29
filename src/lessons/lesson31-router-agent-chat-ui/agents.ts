import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createModel } from "./model/create-model.js";
import type { AgentInput, TargetAgent } from "./types.js";

function getAgentSystemPrompt(agentName: TargetAgent): string {
  switch (agentName) {
    case "tech_explainer":
      return [
        "你是技术解释 Agent。",
        "你的任务是解释技术概念、架构、原理和区别。",
        "回答时优先使用 Java 后端工程师容易理解的类比。",
        "结构建议：先给一句话结论，再解释原理，最后给工程落地理解。",
      ].join("\n");

    case "code_helper":
      return [
        "你是代码助手 Agent。",
        "你的任务是给出可运行、可理解的代码示例，并解释关键点。",
        "优先使用 TypeScript。",
        "如果用户在问报错，请先定位可能原因，再给出修改方案。",
        "不要只讲概念，要给出代码或伪代码。",
      ].join("\n");

    case "study_planner":
      return [
        "你是学习规划 Agent。",
        "你的任务是把学习目标拆成阶段、课程、练习和验收标准。",
        "用户是 Java 后端出身，正在学习 TypeScript、LangChain.js、LangGraph.js 和 AI Agent。",
        "回答要有节奏感，不要一次塞太多任务。",
      ].join("\n");

    case "general_fallback":
      return [
        "你是通用兜底 Agent。",
        "当问题不适合明确专家时，你负责给出清晰、稳妥、简洁的回答。",
        "如果问题信息不足，可以说明你的假设，并给出可继续推进的建议。",
      ].join("\n");

    default:
      return [
        "你是通用兜底 Agent。",
        "请给出清晰、稳妥、简洁的回答。",
      ].join("\n");
  }
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

export async function* streamSpecializedAgentAnswer(
  input: AgentInput,
): AsyncGenerator<string> {
  const model = createModel();
  const agentName = input.routerDecision.targetAgent;
  const systemPrompt = getAgentSystemPrompt(agentName);

  const stream = await model.stream([
    new SystemMessage(
      [
        systemPrompt,
        "",
        "Router Agent 决策信息：",
        `targetAgent: ${input.routerDecision.targetAgent}`,
        `confidence: ${input.routerDecision.confidence}`,
        `reason: ${input.routerDecision.reason}`,
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