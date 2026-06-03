import { tool } from "@langchain/core/tools";
import * as z from "zod";

export const createTicketTool = tool(
  async ({ title, description, priority }) => {
    const ticketNo = `TICKET-${Date.now()}`;

    return JSON.stringify(
      {
        ticketNo,
        title,
        description,
        priority,
        status: "created",
        message: "工单已创建，后续将由技术支持人员跟进。",
      },
      null,
      2,
    );
  },
  {
    name: "create_ticket",
    description:
      "创建技术支持工单。当用户明确要求反馈问题、创建工单、提交故障、联系技术支持时使用。如果用户要求先查询知识库再创建工单，应先等待知识库查询结果，再调用本工具。",
    schema: z.object({
      title: z.string().describe("工单标题，简短概括用户遇到的问题"),
      description: z.string().describe("工单详细描述"),
      priority: z.enum(["low", "medium", "high"]).describe("工单优先级"),
    }),
  },
);