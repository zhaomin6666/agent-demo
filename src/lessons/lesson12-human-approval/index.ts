import { Command, MemorySaver } from "@langchain/langgraph";

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
import type { HumanApprovalResult } from "./graph/agent-state.js";

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
8. create_ticket 属于需要人工确认的操作型工具，确认通过后才能执行。
`;

type ThreadConfig = {
  configurable: {
    thread_id: string;
  };
};

type AgentGraph = ReturnType<typeof createAgentGraph>;

type InterruptPayload = {
  value?: unknown;
};

function createThreadConfig(threadId: string): ThreadConfig {
  return {
    configurable: {
      thread_id: threadId,
    },
  };
}

function getInterruptPayloads(result: unknown): unknown[] {
  const interrupts = (result as { __interrupt__?: InterruptPayload[] })
    .__interrupt__;

  if (!Array.isArray(interrupts)) {
    return [];
  }

  return interrupts.map((item) => item.value ?? item);
}

async function runConversationTurn(params: {
  graph: AgentGraph;
  threadId: string;
  userInput: string;
  approval?: HumanApprovalResult;
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

  const firstResult = await params.graph.invoke(input, config);

  const interruptPayloads = getInterruptPayloads(firstResult);

  if (interruptPayloads.length > 0) {
    console.log("\n========== 触发人工确认 ==========");
    console.log(JSON.stringify(interruptPayloads, null, 2));

    if (!params.approval) {
      console.log("\n当前流程已暂停，等待人工确认。");
      return;
    }

    console.log("\n========== 模拟人工确认结果 ==========");
    console.log(JSON.stringify(params.approval, null, 2));

    const resumedResult = await params.graph.invoke(
      new Command({
        resume: params.approval,
      }),
      config,
    );

    printFinalResult(resumedResult);
    return;
  }

  printFinalResult(firstResult);
}

function printFinalResult(result: Awaited<ReturnType<AgentGraph["invoke"]>>) {
  const finalMessage = result.messages.at(-1);

  console.log("\n========== Human-in-the-loop 最终结果 ==========");
  console.log("当前节点：", result.currentNode);
  console.log("停止原因：", result.stopReason);
  console.log("本轮循环轮次：", result.loopCount);

  console.log("\n最终回答：");
  console.log(finalMessage?.content);

  console.log("\n人工确认结果：");
  console.log(JSON.stringify(result.humanApprovalResult, null, 2));

  console.log("\n最后一次工具结果：");
  console.log(JSON.stringify(result.lastToolResult, null, 2));

  console.log("\nCheckpoint 中累计 messages 数量：", result.messages.length);
  console.log("累计 traceSteps 数量：", result.traceSteps.length);
  console.log("累计工具执行记录数量：", result.toolExecutionRecords.length);
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

  await runConversationTurn({
    graph,
    threadId: "lesson12-approval-approved",
    userInput: "知识库搜索 PDF 内容经常搜不到，帮我创建一个高优先级工单。",
    approval: {
      approved: true,
      comment: "确认创建高优先级工单。",
      reviewer: "demo-user",
      reviewedAt: new Date().toISOString(),
    },
  });

  await runConversationTurn({
    graph,
    threadId: "lesson12-approval-rejected",
    userInput: "帮我创建一个中优先级工单，反馈 RAG 检索效果不好。",
    approval: {
      approved: false,
      comment: "先不创建工单，等进一步确认问题范围。",
      reviewer: "demo-user",
      reviewedAt: new Date().toISOString(),
    },
  });

  await runConversationTurn({
    graph,
    threadId: "lesson12-safe-query",
    userInput: "我们的企业知识库支持哪些数据源接入？",
  });
}

main().catch((error) => {
  console.error("运行失败：", error);
});