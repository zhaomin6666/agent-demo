import { AgentLoop, type ToolCallingModel } from "./agent/agent-loop.js";
import { ToolExecutor } from "./executor/tool-executor.js";
import { createModel } from "./model/create-model.js";
import { tools } from "./tools/index.js";

async function main() {
  const model = createModel();

  const modelWithTools = model.bindTools(tools) as ToolCallingModel;

  const toolExecutor = new ToolExecutor(tools);

  const agentLoop = new AgentLoop(modelWithTools, toolExecutor, {
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

    const result = await agentLoop.run(input);

    console.log("\n========== Agent 最终结果 ==========");
    console.log("停止原因：", result.stopReason);
    console.log("循环轮次：", result.iterations);
    console.log("最终回答：");
    console.log(result.finalMessage.content);

    console.log("\n工具执行总记录：");
    console.log(JSON.stringify(result.toolExecutionRecords, null, 2));
  }
}

main().catch((error) => {
  console.error("运行失败：", error);
});