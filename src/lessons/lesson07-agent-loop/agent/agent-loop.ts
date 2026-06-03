import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import {
  ToolExecutor,
  type ToolExecutionRecord,
} from "../executor/tool-executor.js";

export type ToolCallingModel = {
  invoke(messages: BaseMessage[]): Promise<AIMessage>;
};

export type AgentLoopOptions = {
  maxIterations: number;
};

export type AgentLoopStopReason = "final_answer" | "max_iterations";

export type AgentLoopResult = {
  finalMessage: AIMessage;
  messages: BaseMessage[];
  iterations: number;
  stopReason: AgentLoopStopReason;
  toolExecutionRecords: ToolExecutionRecord[];
};

export class AgentLoop {
  constructor(
    private readonly modelWithTools: ToolCallingModel,
    private readonly toolExecutor: ToolExecutor,
    private readonly options: AgentLoopOptions,
  ) {}

  async run(userInput: string): Promise<AgentLoopResult> {
    const messages: BaseMessage[] = [
      new SystemMessage(`
你是一个企业 AI 知识库 / Agent Demo 助手。

规则：
1. 如果用户问的是企业知识库、RAG、文档接入、检索优化、Agent 工具规范，优先调用 search_knowledge_base。
2. 如果用户要求创建工单、反馈问题、提交故障，调用 create_ticket。
3. 如果用户同时要求“先查询知识库，再创建工单”，必须先调用 search_knowledge_base，拿到结果后再决定是否调用 create_ticket。
4. 工具结果足够回答用户时，请停止调用工具，直接输出最终答案。
5. 不要重复使用相同参数调用同一个工具。
6. 不要编造内部系统信息，能查工具就查工具。
7. 如果工具执行失败，请基于工具错误信息给用户一个友好的解释。
`),
      new HumanMessage(userInput),
    ];

    const toolExecutionRecords: ToolExecutionRecord[] = [];

    for (let iteration = 1; iteration <= this.options.maxIterations; iteration++) {
      console.log(`\n========== Agent Loop 第 ${iteration} 轮 ==========`);

      const aiMessage = await this.modelWithTools.invoke(messages);

      console.log("\n模型返回 content:");
      console.log(aiMessage.content);

      console.log("\n模型返回 tool_calls:");
      console.log(JSON.stringify(aiMessage.tool_calls ?? [], null, 2));

      messages.push(aiMessage);

      const toolCalls = aiMessage.tool_calls ?? [];

      if (toolCalls.length === 0) {
        return {
          finalMessage: aiMessage,
          messages,
          iterations: iteration,
          stopReason: "final_answer",
          toolExecutionRecords,
        };
      }

      const executionResult = await this.toolExecutor.execute(toolCalls);

      console.log("\n工具执行日志:");
      console.log(JSON.stringify(executionResult.records, null, 2));

      toolExecutionRecords.push(...executionResult.records);

      messages.push(...executionResult.messages);
    }

    const finalMessage = new AIMessage({
      content:
        "已达到最大工具调用轮次。为避免 Agent 陷入循环，本次流程已停止。请简化问题或稍后重试。",
    });

    messages.push(finalMessage);

    return {
      finalMessage,
      messages,
      iterations: this.options.maxIterations,
      stopReason: "max_iterations",
      toolExecutionRecords,
    };
  }
}