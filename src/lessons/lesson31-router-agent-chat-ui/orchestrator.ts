import { streamSpecializedAgentAnswer } from "./agents.js";
import { routeMessage } from "./router.js";
import type {
  AgentStreamChunk,
  AgentStreamRequest,
  RouterDecision,
  SourceItem,
  TraceStep,
} from "./types.js";

function createTraceStep(input: Omit<TraceStep, "timestamp">): TraceStep {
  return {
    ...input,
    timestamp: new Date().toISOString(),
  };
}

function getAgentDisplayName(targetAgent: RouterDecision["targetAgent"]): string {
  switch (targetAgent) {
    case "tech_explainer":
      return "技术解释 Agent";

    case "code_helper":
      return "代码助手 Agent";

    case "study_planner":
      return "学习规划 Agent";

    case "general_fallback":
      return "通用兜底 Agent";

    default:
      return "未知 Agent";
  }
}

function createRouterSource(decision: RouterDecision): SourceItem {
  return {
    id: `router-${decision.targetAgent}`,
    title: `Router 选择：${getAgentDisplayName(decision.targetAgent)}`,
    type: "tool",
    snippet: `confidence=${decision.confidence}。原因：${decision.reason}`,
  };
}

function createAgentSource(decision: RouterDecision): SourceItem {
  const displayName = getAgentDisplayName(decision.targetAgent);

  return {
    id: `agent-${decision.targetAgent}`,
    title: displayName,
    type: "memory",
    snippet: `本次回答由 ${displayName} 生成。该 Agent 的职责由 Router Agent 根据用户问题动态选择。`,
  };
}

export async function* runRouterAgentStream(
  input: AgentStreamRequest,
): AsyncGenerator<AgentStreamChunk> {
  const routeStart = Date.now();

  yield {
    type: "trace",
    step: createTraceStep({
      id: "router_decision",
      title: "Router Agent 判断",
      status: "running",
      detail: "正在判断用户问题应该交给哪个专家 Agent。",
    }),
  };

  const decision = await routeMessage(input.message);

  yield {
    type: "router",
    decision,
  };

  yield {
    type: "trace",
    step: createTraceStep({
      id: "router_decision",
      title: "Router Agent 判断",
      status: "completed",
      detail: `选择 ${getAgentDisplayName(decision.targetAgent)}，confidence=${decision.confidence}。原因：${decision.reason}`,
      durationMs: Date.now() - routeStart,
    }),
  };

  yield {
    type: "source",
    source: createRouterSource(decision),
  };

  yield {
    type: "source",
    source: createAgentSource(decision),
  };

  const agentStart = Date.now();

  yield {
    type: "trace",
    step: createTraceStep({
      id: "specialized_agent",
      title: `${getAgentDisplayName(decision.targetAgent)} 回答`,
      status: "running",
      detail: "专家 Agent 已开始流式生成回答。",
    }),
  };

  for await (const content of streamSpecializedAgentAnswer({
    message: input.message,
    routerDecision: decision,
  })) {
    yield {
      type: "delta",
      content,
    };
  }

  yield {
    type: "trace",
    step: createTraceStep({
      id: "specialized_agent",
      title: `${getAgentDisplayName(decision.targetAgent)} 回答`,
      status: "completed",
      detail: "专家 Agent 流式回答完成。",
      durationMs: Date.now() - agentStart,
    }),
  };
}