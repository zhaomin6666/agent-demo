import { MemorySaver } from "@langchain/langgraph";

import {
  createAgentGraph,
  type ToolCallingModel,
} from "./graph/create-agent-graph.js";
import { ToolExecutor } from "./executor/tool-executor.js";
import {
  createConversationInput,
  hasConversationHistory,
} from "./memory/conversation-input.js";
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

async function runConversationTurn(params: {
  graph: AgentGraph;
  threadId: string;
  userInput: string;
}) {
  const config = createThreadConfig(params.threadId);

  const latestStateBeforeInvoke = await params.graph.getState(config);

  const hasHistory = hasConversationHistory(latestStateBeforeInvoke.values);

  const input = createConversationInput({
    userInput: params.userInput,
    systemPrompt,
    hasHistory,
  });

  console.log("\n\n========================================");
  console.log("thread_id：", params.threadId);
  console.log("是否已有历史：", hasHistory);
  console.log("用户输入：", params.userInput);

  const result = await params.graph.invoke(input, config);

  const finalMessage = result.messages.at(-1);

  console.log("\n========== 多轮对话结果 ==========");
  console.log("当前节点：", result.currentNode);
  console.log("停止原因：", result.stopReason);
  console.log("本轮循环轮次：", result.loopCount);

  console.log("\n最终回答：");
  console.log(finalMessage?.content);

  console.log("\nCheckpoint 中累计 messages 数量：", result.messages.length);
  console.log("累计 traceSteps 数量：", result.traceSteps.length);
  console.log("累计工具执行记录数量：", result.toolExecutionRecords.length);

  const latestStateAfterInvoke = await params.graph.getState(config);

  console.log("\n========== 最新 Checkpoint 简要信息 ==========");
  console.log(
    "checkpoint_id：",
    latestStateAfterInvoke.config.configurable?.checkpoint_id,
  );
  console.log("messages.length：", latestStateAfterInvoke.values.messages.length);
  console.log("stopReason：", latestStateAfterInvoke.values.stopReason);
}

async function main() {
  const model = createModel();

  const modelWithTools = model.bindTools(tools) as ToolCallingModel;

  const toolExecutor = new ToolExecutor(tools);

  const checkpointer = new MemorySaver();

  const graph = createAgentGraph(modelWithTools, toolExecutor, {
    maxIterations: 5,
    checkpointer,
    memory: {
      maxRecentMessages: 8,
    },
  });

  const threadId = "lesson11-conversation-a";

  await runConversationTurn({
    graph,
    threadId,
    userInput: "我们的企业知识库支持哪些数据源接入？",
  });

  await runConversationTurn({
    graph,
    threadId,
    userInput: "那如果检索效果不好，一般可以怎么优化？",
  });

  await runConversationTurn({
    graph,
    threadId,
    userInput: "基于刚才的优化建议，帮我创建一个中优先级工单。",
  });

  await runConversationTurn({
    graph,
    threadId,
    userInput: "你还记得我刚才问的是哪类系统问题吗？",
  });
}

main().catch((error) => {
  console.error("运行失败：", error);
});