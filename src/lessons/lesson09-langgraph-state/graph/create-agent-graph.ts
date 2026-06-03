import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";

import {
  ToolExecutor,
  type ToolExecutionRecord,
} from "../executor/tool-executor.js";
import {
  AgentStateAnnotation,
  createTraceStep,
  type AgentState,
} from "./agent-state.js";

export type ToolCallingModel = {
  invoke(messages: BaseMessage[]): Promise<AIMessage>;
};

export type AgentGraphOptions = {
  maxIterations: number;
};

export function createAgentGraph(
  modelWithTools: ToolCallingModel,
  toolExecutor: ToolExecutor,
  options: AgentGraphOptions,
) {
  async function llmNode(state: AgentState) {
    const nextLoopCount = state.loopCount + 1;

    console.log(
      `\n========== LangGraph LLM 节点，第 ${nextLoopCount} 轮 ==========`,
    );

    const aiMessage = await modelWithTools.invoke(state.messages);

    console.log("\n模型返回 content:");
    console.log(aiMessage.content);

    console.log("\n模型返回 tool_calls:");
    console.log(JSON.stringify(aiMessage.tool_calls ?? [], null, 2));

    return {
      messages: [aiMessage],
      loopCount: nextLoopCount,
      currentNode: "llm",
      traceSteps: [
        createTraceStep({
          event: "llm_end",
          nodeName: "llm",
          loopCount: nextLoopCount,
          message: `LLM 调用完成，tool_calls 数量：${
            aiMessage.tool_calls?.length ?? 0
          }`,
        }),
      ],
    };
  }

  async function toolNode(state: AgentState) {
    console.log("\n========== LangGraph Tool 节点 ==========");

    const lastMessage = state.messages.at(-1);

    if (!(lastMessage instanceof AIMessage)) {
      return {
        currentNode: "tools",
        stopReason: "non_ai_message" as const,
        traceSteps: [
          createTraceStep({
            event: "tool_end",
            nodeName: "tools",
            loopCount: state.loopCount,
            message: "最后一条消息不是 AIMessage，无法执行工具。",
          }),
        ],
      };
    }

    const toolCalls = lastMessage.tool_calls ?? [];

    const executionResult = await toolExecutor.execute(toolCalls);

    console.log("\n工具执行日志:");
    console.log(JSON.stringify(executionResult.records, null, 2));

    const lastToolResult = getLastRecord(executionResult.records);

    return {
      messages: executionResult.messages,
      currentNode: "tools",
      toolExecutionRecords: executionResult.records,
      lastToolResult,
      traceSteps: [
        createTraceStep({
          event: "tool_end",
          nodeName: "tools",
          loopCount: state.loopCount,
          message: `工具执行完成，执行数量：${executionResult.records.length}，是否存在错误：${executionResult.hasError}`,
        }),
      ],
    };
  }

  function shouldContinue(state: AgentState) {
    const lastMessage = state.messages.at(-1);

    if (!(lastMessage instanceof AIMessage)) {
      return END;
    }

    const toolCalls = lastMessage.tool_calls ?? [];

    if (toolCalls.length === 0) {
      return "final_answer";
    }

    if (state.loopCount >= options.maxIterations) {
      return "max_iteration_fallback";
    }

    return "tools";
  }

  async function finalAnswerNode(state: AgentState) {
    return {
      currentNode: "final_answer",
      stopReason: "final_answer" as const,
      traceSteps: [
        createTraceStep({
          event: "route_to_end",
          nodeName: "final_answer",
          loopCount: state.loopCount,
          message: "模型没有继续返回 tool_calls，流程正常结束。",
        }),
      ],
    };
  }

  async function maxIterationFallbackNode(state: AgentState) {
    const message = new AIMessage({
      content:
        "已达到最大工具调用轮次。为避免 Agent 陷入循环，本次流程已停止。请简化问题或稍后重试。",
    });

    return {
      messages: [message],
      currentNode: "max_iteration_fallback",
      stopReason: "max_iterations" as const,
      maxIterationsReached: true,
      traceSteps: [
        createTraceStep({
          event: "fallback",
          nodeName: "max_iteration_fallback",
          loopCount: state.loopCount,
          message: `达到最大轮次 ${options.maxIterations}，执行兜底结束。`,
        }),
      ],
    };
  }

  return new StateGraph(AgentStateAnnotation)
    .addNode("llm", llmNode)
    .addNode("tools", toolNode)
    .addNode("final_answer", finalAnswerNode)
    .addNode("max_iteration_fallback", maxIterationFallbackNode)
    .addEdge(START, "llm")
    .addConditionalEdges("llm", shouldContinue)
    .addEdge("tools", "llm")
    .addEdge("final_answer", END)
    .addEdge("max_iteration_fallback", END)
    .compile();
}

function getLastRecord(
  records: ToolExecutionRecord[],
): ToolExecutionRecord | null {
  if (records.length === 0) {
    return null;
  }

  return records[records.length - 1] ?? null;
}