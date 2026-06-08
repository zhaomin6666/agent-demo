import {
  ToolMessage,
  type AIMessage,
} from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";

export type ToolCall = NonNullable<AIMessage["tool_calls"]>[number];

export type ToolExecutionStatus = "success" | "tool_not_found" | "error";

export type ToolExecutionRecord = {
  toolName: string;
  toolCallId?: string;
  args: unknown;
  status: ToolExecutionStatus;
  content: string;
  errorMessage?: string;
  durationMs: number;
};

export type ToolExecutionResult = {
  messages: ToolMessage[];
  records: ToolExecutionRecord[];
  hasError: boolean;
};

export class ToolExecutor {
  private readonly toolMap: Map<string, StructuredToolInterface>;

  constructor(tools: StructuredToolInterface[]) {
    this.toolMap = new Map(tools.map((item) => [item.name, item]));
  }

  async execute(toolCalls: ToolCall[]): Promise<ToolExecutionResult> {
    const messages: ToolMessage[] = [];
    const records: ToolExecutionRecord[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeOne(toolCall);

      messages.push(result.message);
      records.push(result.record);
    }

    return {
      messages,
      records,
      hasError: records.some((record) => record.status !== "success"),
    };
  }

  private async executeOne(toolCall: ToolCall): Promise<{
    message: ToolMessage;
    record: ToolExecutionRecord;
  }> {
    const startTime = Date.now();
    const selectedTool = this.toolMap.get(toolCall.name);

    if (!selectedTool) {
      const content = JSON.stringify(
        {
          status: "tool_not_found",
          message: `未找到工具：${toolCall.name}`,
        },
        null,
        2,
      );

      const message = new ToolMessage({
        content,
        tool_call_id: toolCall.id ?? `${toolCall.name}-missing-id`,
        name: toolCall.name,
      });

      return {
        message,
        record: {
          toolName: toolCall.name,
          toolCallId: toolCall.id,
          args: toolCall.args,
          status: "tool_not_found",
          content,
          errorMessage: `未找到工具：${toolCall.name}`,
          durationMs: Date.now() - startTime,
        },
      };
    }

    try {
      const message = await selectedTool.invoke(toolCall);
      const content = this.stringifyContent(message.content);

      return {
        message,
        record: {
          toolName: toolCall.name,
          toolCallId: toolCall.id,
          args: toolCall.args,
          status: "success",
          content,
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "未知工具执行错误";

      const content = JSON.stringify(
        {
          status: "error",
          message: `工具 ${toolCall.name} 执行失败`,
          errorMessage,
        },
        null,
        2,
      );

      const message = new ToolMessage({
        content,
        tool_call_id: toolCall.id ?? `${toolCall.name}-error-id`,
        name: toolCall.name,
      });

      return {
        message,
        record: {
          toolName: toolCall.name,
          toolCallId: toolCall.id,
          args: toolCall.args,
          status: "error",
          content,
          errorMessage,
          durationMs: Date.now() - startTime,
        },
      };
    }
  }

  private stringifyContent(content: unknown): string {
    if (typeof content === "string") {
      return content;
    }

    return JSON.stringify(content, null, 2);
  }
}