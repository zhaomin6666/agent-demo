import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";

import {
  createAgentGraph,
  type ToolCallingModel,
} from "./graph/create-agent-graph.js";
import { ToolExecutor } from "./executor/tool-executor.js";
import { createModel } from "./model/create-model.js";
import { tools } from "./tools/index.js";

const systemPrompt = `
你是一个企业 AI 知识库 / Agent Demo 助手。

规则：
1. 如果用户问的是企业知识库、RAG、文档接入、检索优化、Agent 工具规范，优先调用 search_knowledge_base。
2. 如果用户要求创建工单、反馈问题、提交故障，调用 create_ticket。
3. 如果用户同时要求“先查询知识库，再创建工单”，必须先调用 search_knowledge_base，拿到结果后再决定是否调用 create_ticket。
4. 工具结果足够回答用户时，请停止调用工具，直接输出最终答案。
5. 不要重复使用相同参数调用同一个工具。
6. 不要编造内部系统信息，能查工具就查工具。
7. 如果工具执行失败，请基于工具错误信息给用户一个友好的解释。
`;

type ThreadConfig = {
  configurable: {
    thread_id: string;
  };
};

type AgentGraph = ReturnType<typeof createAgentGraph>;

function createThreadConfig(threadId: string): ThreadConfig {
  return {
    configurable: {
      thread_id: threadId,
    },
  };
}

function createFirstTurnInput(userInput: string) {
  return {
    messages: [new SystemMessage(systemPrompt), new HumanMessage(userInput)],
    loopCount: 0,
    currentNode: "start",
    stopReason: "running" as const,
    lastToolResult: null,
    maxIterationsReached: false,
  };
}

function createNextTurnInput(userInput: string) {
  return {
    messages: [new HumanMessage(userInput)],
    loopCount: 0,
    currentNode: "start",
    stopReason: "running" as const,
    lastToolResult: null,
    maxIterationsReached: false,
  };
}

async function runTurn(params: {
  graph: AgentGraph;
  threadId: string;
  userInput: string;
  isFirstTurn: boolean;
}) {
  const config = createThreadConfig(params.threadId);

  console.log("\n\n========================================");
  console.log("thread_id：", params.threadId);
  console.log("用户输入：", params.userInput);

  const input = params.isFirstTurn
    ? createFirstTurnInput(params.userInput)
    : createNextTurnInput(params.userInput);

  const result = await params.graph.invoke(input, config);

  const finalMessage = result.messages.at(-1);

  console.log("\n========== LangGraph 最终结果 ==========");
  console.log("当前节点：", result.currentNode);
  console.log("停止原因：", result.stopReason);
  console.log("本轮循环轮次：", result.loopCount);
  console.log("是否达到最大轮次：", result.maxIterationsReached);

  console.log("\n最终回答：");
  console.log(finalMessage?.content);

  console.log("\n当前线程累计消息数量：", result.messages.length);
  console.log("当前线程累计执行轨迹数量：", result.traceSteps.length);
  console.log("当前线程累计工具执行记录数量：", result.toolExecutionRecords.length);

  const latestState = await params.graph.getState(config);

  console.log("\n========== Checkpoint 最新状态 ==========");
  console.log("checkpoint_id：", latestState.config.configurable?.checkpoint_id);
  console.log("next：", latestState.next);
  console.log("createdAt：", latestState.createdAt);
  console.log("metadata.step：", latestState.metadata?.step);
  console.log("state.messages.length：", latestState.values.messages.length);
  console.log("state.stopReason：", latestState.values.stopReason);
}

async function printStateHistory(params: {
  graph: AgentGraph;
  threadId: string;
  limit: number;
}) {
  const config = createThreadConfig(params.threadId);

  console.log("\n========== Checkpoint 历史记录 ==========");
  console.log("thread_id：", params.threadId);

  let count = 0;

  for await (const snapshot of params.graph.getStateHistory(config)) {
    count++;

    console.log(`\n--- checkpoint ${count} ---`);
    console.log("checkpoint_id：", snapshot.config.configurable?.checkpoint_id);
    console.log("next：", snapshot.next);
    console.log("createdAt：", snapshot.createdAt);
    console.log("metadata.step：", snapshot.metadata?.step);
    console.log("messages.length：", snapshot.values.messages.length);
    console.log("stopReason：", snapshot.values.stopReason);

    if (count >= params.limit) {
      break;
    }
  }
}

async function main() {
  const model = createModel();

  const modelWithTools = model.bindTools(tools) as ToolCallingModel;

  const toolExecutor = new ToolExecutor(tools);

  const checkpointer = new MemorySaver();

  const graph = createAgentGraph(modelWithTools, toolExecutor, {
    maxIterations: 5,
    checkpointer,
  });

  const threadA = "lesson10-thread-a";
  const threadB = "lesson10-thread-b";

  await runTurn({
    graph,
    threadId: threadA,
    userInput: "我们的企业知识库支持哪些数据源接入？",
    isFirstTurn: true,
  });

  await runTurn({
    graph,
    threadId: threadA,
    userInput: "那如果检索效果不好，一般可以怎么优化？",
    isFirstTurn: false,
  });

  await runTurn({
    graph,
    threadId: threadB,
    userInput: "知识库搜索 PDF 内容经常搜不到，帮我创建一个高优先级工单。",
    isFirstTurn: true,
  });

  await printStateHistory({
    graph,
    threadId: threadA,
    limit: 5,
  });
}

main().catch((error) => {
  console.error("运行失败：", error);
});