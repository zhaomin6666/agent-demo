import { HumanMessage, SystemMessage } from "@langchain/core/messages";

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

async function main() {
  const model = createModel();

  const modelWithTools = model.bindTools(tools) as ToolCallingModel;

  const toolExecutor = new ToolExecutor(tools);

  const graph = createAgentGraph(modelWithTools, toolExecutor, {
    maxIterations: 5,
  });

  const inputs = [
    "我们的企业知识库支持哪些数据源接入？",
    "先查一下 RAG 检索效果不好怎么办，然后基于查询结果帮我创建一个中优先级工单。",
    "知识库搜索 PDF 内容经常搜不到，帮我创建一个高优先级工单。",
  ];

  for (const input of inputs) {
    console.log("\n\n========================================");
    console.log("用户输入：", input);

    const result = await graph.invoke({
      messages: [new SystemMessage(systemPrompt), new HumanMessage(input)],
    });

    const finalMessage = result.messages.at(-1);

    console.log("\n========== LangGraph 最终结果 ==========");
    console.log("当前节点：", result.currentNode);
    console.log("停止原因：", result.stopReason);
    console.log("循环轮次：", result.loopCount);
    console.log("是否达到最大轮次：", result.maxIterationsReached);

    console.log("\n最终回答：");
    console.log(finalMessage?.content);

    console.log("\n最后一次工具结果：");
    console.log(JSON.stringify(result.lastToolResult, null, 2));

    console.log("\n执行轨迹：");
    console.log(JSON.stringify(result.traceSteps, null, 2));

    console.log("\n工具执行总记录：");
    console.log(JSON.stringify(result.toolExecutionRecords, null, 2));
  }
}

main().catch((error) => {
  console.error("运行失败：", error);
});