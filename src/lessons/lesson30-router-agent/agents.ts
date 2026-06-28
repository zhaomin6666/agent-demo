import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createModel } from "./model/create-model.js";
import type { AgentInput, AgentOutput, TargetAgent } from "./types.js";

async function runSpecializedAgent(
  agentName: TargetAgent,
  systemPrompt: string,
  input: AgentInput,
): Promise<AgentOutput> {
  const model = createModel();

  const result = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(input.message),
  ]);

  return {
    agentName,
    answer: String(result.content),
  };
}

export async function runTechExplainerAgent(
  input: AgentInput,
): Promise<AgentOutput> {
  return runSpecializedAgent(
    "tech_explainer",
    [
      "你是技术解释 Agent。",
      "你的任务是解释技术概念、架构、原理和区别。",
      "回答时优先使用 Java 后端工程师容易理解的类比。",
      "结构建议：先给一句话结论，再解释原理，最后给工程落地理解。",
    ].join("\n"),
    input,
  );
}

export async function runCodeHelperAgent(
  input: AgentInput,
): Promise<AgentOutput> {
  return runSpecializedAgent(
    "code_helper",
    [
      "你是代码助手 Agent。",
      "你的任务是给出可运行、可理解的代码示例，并解释关键点。",
      "优先使用 TypeScript。",
      "如果用户在问报错，请先定位可能原因，再给出修改方案。",
      "不要只讲概念，要给出代码或伪代码。",
    ].join("\n"),
    input,
  );
}

export async function runStudyPlannerAgent(
  input: AgentInput,
): Promise<AgentOutput> {
  return runSpecializedAgent(
    "study_planner",
    [
      "你是学习规划 Agent。",
      "你的任务是把学习目标拆成阶段、课程、练习和验收标准。",
      "用户是 Java 后端出身，正在学习 TypeScript、LangChain.js、LangGraph.js 和 AI Agent。",
      "回答要有节奏感，不要一次塞太多任务。",
    ].join("\n"),
    input,
  );
}

export async function runGeneralFallbackAgent(
  input: AgentInput,
): Promise<AgentOutput> {
  return runSpecializedAgent(
    "general_fallback",
    [
      "你是通用兜底 Agent。",
      "当问题不适合明确专家时，你负责给出清晰、稳妥、简洁的回答。",
      "如果问题信息不足，可以说明你的假设，并给出可继续推进的建议。",
    ].join("\n"),
    input,
  );
}

export async function runAgentByRoute(
  input: AgentInput,
): Promise<AgentOutput> {
  switch (input.routerDecision.targetAgent) {
    case "tech_explainer":
      return runTechExplainerAgent(input);

    case "code_helper":
      return runCodeHelperAgent(input);

    case "study_planner":
      return runStudyPlannerAgent(input);

    case "general_fallback":
      return runGeneralFallbackAgent(input);

    default:
      return runGeneralFallbackAgent(input);
  }
}