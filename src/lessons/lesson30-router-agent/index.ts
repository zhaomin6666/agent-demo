import "dotenv/config";
import { routeMessage } from "./router.js";
import { runAgentByRoute } from "./agents.js";
import type { AgentRunResult } from "./types.js";

async function runRouterAgentDemo(message: string): Promise<AgentRunResult> {
  const routerDecision = await routeMessage(message);

  const output = await runAgentByRoute({
    message,
    routerDecision,
  });

  return {
    userMessage: message,
    routerDecision,
    output,
  };
}

function printResult(result: AgentRunResult): void {
  console.log("\n========================================");
  console.log("User:");
  console.log(result.userMessage);

  console.log("\nRouter Decision:");
  console.log(`- targetAgent: ${result.routerDecision.targetAgent}`);
  console.log(`- confidence: ${result.routerDecision.confidence}`);
  console.log(`- reason: ${result.routerDecision.reason}`);

  console.log("\nAgent Answer:");
  console.log(result.output.answer);
  console.log("========================================\n");
}

const inputFromArgs = process.argv.slice(2).join(" ").trim();

const examples =
  inputFromArgs.length > 0
    ? [inputFromArgs]
    : [
        "请用 Java 后端工程师能理解的方式解释 SSE 流式输出",
        "帮我写一个 TypeScript fetch 读取 SSE 的最小示例",
        "帮我规划一下接下来学习 LangGraph 多 Agent 的路线",
        "今天状态不太好，应该怎么调整学习节奏？",
      ];

for (const message of examples) {
  const result = await runRouterAgentDemo(message);
  printResult(result);
}