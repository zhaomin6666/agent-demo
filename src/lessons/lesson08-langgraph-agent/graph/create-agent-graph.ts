import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";

import { ToolExecutor } from "../executor/tool-executor.js";
import { AgentStateAnnotation, type AgentState } from "./agent-state.js";

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
    console.log(
      `\n========== LangGraph LLM 节点，第 ${state.loopCount + 1} 轮 ==========`,
    );

    const aiMessage = await modelWithTools.invoke(state.messages);

    console.log("\n模型返回 content:");
    console.log(aiMessage.content);

    console.log("\n模型返回 tool_calls:");
    console.log(JSON.stringify(aiMessage.tool_calls ?? [], null, 2));

    return {
      messages: [aiMessage],
      loopCount: state.loopCount + 1,
    };
  }

  async function toolNode(state: AgentState) {
    console.log("\n========== LangGraph Tool 节点 ==========");

    const lastMessage = state.messages.at(-1);

    if (!(lastMessage instanceof AIMessage)) {
      return {
        messages: [],
        toolExecutionRecords: [],
      };
    }

    const toolCalls = lastMessage.tool_calls ?? [];

    const executionResult = await toolExecutor.execute(toolCalls);

    console.log("\n工具执行日志:");
    console.log(JSON.stringify(executionResult.records, null, 2));

    return {
      messages: executionResult.messages,
      toolExecutionRecords: executionResult.records,
    };
  }

  function shouldContinue(state: AgentState) {
    const lastMessage = state.messages.at(-1);

    if (!(lastMessage instanceof AIMessage)) {
      return END;
    }

    const toolCalls = lastMessage.tool_calls ?? [];

    if (toolCalls.length === 0) {
      return END;
    }

    if (state.loopCount >= options.maxIterations) {
      return "max_iteration_fallback";
    }

    return "tools";
  }

  async function maxIterationFallbackNode() {
    const message = new AIMessage({
      content:
        "已达到最大工具调用轮次。为避免 Agent 陷入循环，本次流程已停止。请简化问题或稍后重试。",
    });

    return {
      messages: [message],
    };
  }

  return new StateGraph(AgentStateAnnotation)
    .addNode("llm", llmNode)
    .addNode("tools", toolNode)
    .addNode("max_iteration_fallback", maxIterationFallbackNode)
    .addEdge(START, "llm")
    .addConditionalEdges("llm", shouldContinue)
    .addEdge("tools", "llm")
    .addEdge("max_iteration_fallback", END)
    .compile();
}
