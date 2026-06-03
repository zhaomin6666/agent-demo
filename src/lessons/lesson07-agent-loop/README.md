# 第 7 课：Agent Loop 入门，并开始工程化拆分目录结构

## 前言

前面几节课已经完成了 AI Agent Demo 的基础能力。

第 1 课完成了：

```text
TypeScript 项目初始化
pnpm 包管理
LangChain.js 调用大模型
阿里云百炼 / 通义千问 OpenAI 兼容接口接入
```

第 2 课学习了：

```text
SystemMessage
HumanMessage
AIMessage
ChatPromptTemplate
Prompt 模板
```

第 3 课学习了：

```text
让大模型输出 JSON
使用 zod 校验结构化结果
处理模型输出不稳定的问题
```

第 4 课完成了：

```text
封装 Intent Classifier
将意图识别逻辑封装成 class
增加 fallback 兜底
为后续 Agent 工具调用做准备
```

第 5 课开始进入 Tool Calling：

```text
定义 Tool
bindTools 绑定工具
模型返回 tool_calls
程序执行工具
工具结果回传给模型
模型生成最终回答
```

第 6 课完成了 ToolExecutor 封装：

```text
统一管理工具
统一查找工具
统一执行 tool_calls
统一处理工具不存在和工具异常
记录工具执行日志
```

第 7 课继续往真正的 Agent 形态推进。

这一课会做两个关键升级：

```text
1. 从单次 Tool Calling 升级为 Agent Loop
2. 从单文件 Demo 升级为模块化目录结构
```

前几课为了方便学习，所有代码都写在一个 `index.ts` 中。

但是实际工程中不会这样写。

真实项目中，通常会把：

```text
tool
executor
model
agent
data
```

拆成不同模块，方便维护、复用和多人协作。

所以第 7 课除了学习 Agent Loop，也会开始让项目结构更接近真实工程。

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解为什么一次 Tool Calling 不够
2. 理解 Agent Loop 的基本流程
3. 让模型可以多轮调用工具
4. 增加最大循环次数，避免 Agent 死循环
5. 将 tools、executor、model、agent 拆分到不同文件
6. 解决 NodeNext 模式下相对导入必须加 .js 后缀的问题
7. 为后续 LangGraph 状态图做准备
```

本节重点不是增加新工具，而是升级 Agent 的执行方式和项目代码结构。

---

## 二、为什么需要 Agent Loop？

第 5 课和第 6 课中，我们的工具调用流程基本是：

```text
用户输入
  ↓
模型调用一次
  ↓
模型返回 tool_calls
  ↓
程序执行工具
  ↓
再次调用模型
  ↓
模型生成最终回答
```

这个流程适合简单任务。

例如：

```text
用户：我们的企业知识库支持哪些数据源接入？
```

模型只需要调用一次：

```text
search_knowledge_base
```

然后就可以回答用户。

但是有些任务不是一次工具调用能完成的。

例如：

```text
先查一下 RAG 检索效果不好怎么办，然后基于查询结果帮我创建一个中优先级工单。
```

这个任务明显包含两个步骤：

```text
第一步：查询知识库，获取 RAG 检索优化方案
第二步：根据查询结果创建工单
```

这时理想流程应该是：

```text
用户输入
  ↓
第 1 轮模型调用
  ↓
模型调用 search_knowledge_base
  ↓
程序执行知识库查询
  ↓
第 2 轮模型调用
  ↓
模型看到知识库结果后，调用 create_ticket
  ↓
程序创建工单
  ↓
第 3 轮模型调用
  ↓
模型总结最终结果
```

这就是 Agent Loop。

一句话总结：

> Agent Loop 就是让模型、工具、工具结果形成多轮循环，直到任务完成。

---

## 三、为什么要拆分目录结构？

前 6 课中，代码基本都放在一个 `index.ts` 文件里。

这样适合入门学习，因为所有逻辑都在一个文件中，方便观察完整流程。

但是随着课程推进，代码会越来越多。

如果继续写在一个文件里，会出现这些问题：

```text
1. 文件越来越长，不好阅读
2. 工具、模型、执行器、Agent 主流程混在一起
3. 后续新增工具容易影响主流程
4. 不方便复用 ToolExecutor
5. 不方便多人协作
6. 不方便单独测试某个模块
```

从 Java 后端开发视角看，这就像把：

```text
Controller
Service
Repository
DTO
配置类
工具类
```

全部写进一个 Java 文件里。

Demo 阶段可以，但真实项目中不适合。

所以从第 7 课开始，我们开始按职责拆分代码。

---

## 四、本节目录结构

本节新建第 7 课目录：

```text
src/lessons/lesson07-agent-loop/
  data/
    knowledge-docs.ts

  tools/
    search-knowledge-base.tool.ts
    create-ticket.tool.ts
    index.ts

  executor/
    tool-executor.ts

  model/
    create-model.ts

  agent/
    agent-loop.ts

  index.ts
```

对应职责如下：

| 目录 / 文件                     | 职责             |
| --------------------------- | -------------- |
| `data/knowledge-docs.ts`    | 模拟知识库数据        |
| `tools/*.tool.ts`           | 定义具体工具         |
| `tools/index.ts`            | 统一导出工具列表       |
| `executor/tool-executor.ts` | 统一执行工具调用       |
| `model/create-model.ts`     | 创建大模型实例        |
| `agent/agent-loop.ts`       | Agent Loop 主流程 |
| `index.ts`                  | 第 7 课入口文件      |

这种结构比单文件更接近真实工程。

后续如果新增一个工具，只需要在 `tools/` 目录下增加文件，然后在 `tools/index.ts` 中注册。

---

## 五、配置 package.json

在 `package.json` 中增加第 7 课脚本：

```json
{
  "scripts": {
    "lesson:01": "tsx src/lessons/lesson01-first-llm-call/index.ts",
    "lesson:02": "tsx src/lessons/lesson02-prompt-messages/index.ts",
    "lesson:03": "tsx src/lessons/lesson03-structured-output/index.ts",
    "lesson:04": "tsx src/lessons/lesson04-intent-classifier/index.ts",
    "lesson:05": "tsx src/lessons/lesson05-tool-calling/index.ts",
    "lesson:06": "tsx src/lessons/lesson06-tool-executor/index.ts",
    "lesson:07": "tsx src/lessons/lesson07-agent-loop/index.ts"
  }
}
```

运行第 7 课：

```bash
pnpm lesson:07
```

---

## 六、准备模拟知识库数据

文件路径：

```text
src/lessons/lesson07-agent-loop/data/knowledge-docs.ts
```

代码如下：

```ts
export type KnowledgeDoc = {
  id: string;
  title: string;
  content: string;
  tags: string[];
};

export const knowledgeDocs: KnowledgeDoc[] = [
  {
    id: "doc-001",
    title: "企业知识库支持的数据源",
    content:
      "企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源。后续会扩展数据库表和工单系统数据。",
    tags: ["knowledge_base", "datasource", "rag"],
  },
  {
    id: "doc-002",
    title: "RAG 检索效果不好怎么办",
    content:
      "如果 RAG 检索效果不好，可以从文档切分、Embedding 模型、召回数量、关键词补充、重排序、Prompt 约束等方面优化。",
    tags: ["knowledge_base", "rag", "retrieval"],
  },
  {
    id: "doc-003",
    title: "Agent 工具调用规范",
    content:
      "Agent 调用工具前应先判断意图，工具入参必须通过 schema 校验，工具执行失败时需要有兜底响应。",
    tags: ["agent", "tool_calling"],
  },
];
```

这里仍然使用内存数组模拟知识库。

后续进入 RAG 阶段时，这里可以替换成：

```text
向量数据库
全文检索引擎
文档解析结果
企业知识库 API
数据库查询接口
```

---

## 七、定义知识库查询工具

文件路径：

```text
src/lessons/lesson07-agent-loop/tools/search-knowledge-base.tool.ts
```

代码如下：

```ts
import { tool } from "@langchain/core/tools";
import * as z from "zod";

import { knowledgeDocs } from "../data/knowledge-docs.js";

export const searchKnowledgeBaseTool = tool(
  async ({ query }) => {
    const lowerQuery = query.toLowerCase();

    const results = knowledgeDocs.filter((doc) => {
      return (
        doc.title.toLowerCase().includes(lowerQuery) ||
        doc.content.toLowerCase().includes(lowerQuery) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    });

    return JSON.stringify(
      {
        query,
        count: results.length,
        results,
      },
      null,
      2,
    );
  },
  {
    name: "search_knowledge_base",
    description:
      "查询企业 AI 知识库中的内部资料。当用户询问知识库、RAG、文档接入、检索优化、Agent 工具规范时使用。",
    schema: z.object({
      query: z
        .string()
        .describe("用于检索知识库的关键词，例如：RAG、数据源、工具调用规范"),
    }),
  },
);
```

注意这里的导入路径：

```ts
import { knowledgeDocs } from "../data/knowledge-docs.js";
```

虽然源文件是：

```text
knowledge-docs.ts
```

但在 NodeNext / Node16 模式下，相对导入路径需要写成：

```text
.js
```

这是因为 TypeScript 最终会被编译成 JavaScript，Node.js 运行时寻找的是 `.js` 文件。

后续课程中，本地相对导入统一使用 `.js` 后缀。

---

## 八、定义工单创建工具

文件路径：

```text
src/lessons/lesson07-agent-loop/tools/create-ticket.tool.ts
```

代码如下：

```ts
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
```

这里和第 6 课相比，工具描述中额外增加了一句：

```text
如果用户要求先查询知识库再创建工单，应先等待知识库查询结果，再调用本工具。
```

这样做是为了引导模型进行多步任务。

例如用户要求：

```text
先查一下 RAG 检索效果不好怎么办，然后基于查询结果帮我创建一个中优先级工单。
```

模型应该先调用知识库查询工具，再根据结果调用创建工单工具。

这正好可以观察 Agent Loop 的多轮执行效果。

---

## 九、统一导出工具列表

文件路径：

```text
src/lessons/lesson07-agent-loop/tools/index.ts
```

代码如下：

```ts
import type { StructuredToolInterface } from "@langchain/core/tools";

import { createTicketTool } from "./create-ticket.tool.js";
import { searchKnowledgeBaseTool } from "./search-knowledge-base.tool.js";

export const tools: StructuredToolInterface[] = [
  searchKnowledgeBaseTool,
  createTicketTool,
];
```

这个文件的作用是统一管理工具列表。

后续新增工具时，只需要：

```text
1. 在 tools 目录下新增 xxx.tool.ts
2. 在 tools/index.ts 中引入
3. 加入 tools 数组
```

可以把它理解成 Java 项目中的工具注册配置。

---

## 十、封装 ToolExecutor

文件路径：

```text
src/lessons/lesson07-agent-loop/executor/tool-executor.ts
```

代码如下：

```ts
import { ToolMessage, type AIMessage } from "@langchain/core/messages";
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
```

这部分基本沿用第 6 课的 ToolExecutor，只是移动到了独立文件。

这样做以后，Agent 主流程可以只调用：

```ts
const executionResult = await toolExecutor.execute(toolCalls);
```

不用关心工具内部如何查找、如何执行、如何处理异常。

---

## 十一、封装模型创建函数

文件路径：

```text
src/lessons/lesson07-agent-loop/model/create-model.ts
```

代码如下：

```ts
import "dotenv/config";

import { ChatOpenAI } from "@langchain/openai";

export function createModel() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseURL = process.env.DASHSCOPE_BASE_URL;

  if (!apiKey) {
    throw new Error("缺少环境变量 DASHSCOPE_API_KEY");
  }

  if (!baseURL) {
    throw new Error("缺少环境变量 DASHSCOPE_BASE_URL");
  }

  return new ChatOpenAI({
    model: "qwen3.6-flash",
    temperature: 0,
    apiKey,
    configuration: {
      baseURL,
    },
    streamUsage: false,
  });
}
```

模型创建单独放在 `model/create-model.ts` 中。

后续如果需要：

```text
切换模型
增加 debug fetch
修改 temperature
增加超时配置
统一管理 baseURL
```

只需要修改这个文件。

---

## 十二、封装 AgentLoop

文件路径：

```text
src/lessons/lesson07-agent-loop/agent/agent-loop.ts
```

代码如下：

```ts
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

    for (
      let iteration = 1;
      iteration <= this.options.maxIterations;
      iteration++
    ) {
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
```

这里就是本节核心：Agent Loop。

核心逻辑可以简化理解为：

```text
for 循环开始
  ↓
调用模型
  ↓
判断模型是否返回 tool_calls
  ↓
如果没有 tool_calls，说明模型已经给出最终回答，流程结束
  ↓
如果有 tool_calls，则执行工具
  ↓
工具结果放回 messages
  ↓
进入下一轮循环
```

---

## 十三、为什么需要 maxIterations？

Agent Loop 必须有最大循环次数。

因为模型有可能重复调用同一个工具。

例如：

```text
第 1 轮：调用 search_knowledge_base
第 2 轮：又调用 search_knowledge_base
第 3 轮：继续调用 search_knowledge_base
```

如果没有限制，就可能陷入死循环。

所以本节设置：

```ts
maxIterations: 5
```

当超过最大轮次后，流程会停止，并返回兜底结果：

```ts
const finalMessage = new AIMessage({
  content:
    "已达到最大工具调用轮次。为避免 Agent 陷入循环，本次流程已停止。请简化问题或稍后重试。",
});
```

这和 Java 后端中做重试机制很像。

比如调用第三方接口时，也不能无限重试，必须设置最大重试次数。

一句话总结：

> 只要是循环，就必须有退出条件；只要是 Agent Loop，就必须有最大轮次保护。

---

## 十四、编写入口文件

文件路径：

```text
src/lessons/lesson07-agent-loop/index.ts
```

代码如下：

```ts
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
```

入口文件现在非常清晰，只负责组装模块：

```text
创建模型
  ↓
绑定工具
  ↓
创建 ToolExecutor
  ↓
创建 AgentLoop
  ↓
执行测试输入
```

这比前几课所有代码都写在一个 `index.ts` 中更工程化。

---

## 十五、NodeNext 模式下 import 要加 .js 后缀

本节拆分多个文件后，VSCode 可能会提示：

```text
Relative import paths need explicit file extensions in ECMAScript imports when '--moduleResolution' is 'node16' or 'nodenext'. Consider adding an extension to the import path.
```

这是因为 `tsconfig.json` 中使用了类似配置：

```json
{
  "module": "NodeNext",
  "moduleResolution": "NodeNext"
}
```

在这种模式下，TypeScript 会按照 Node.js ESM 规则检查模块导入。

所以本地相对路径不能写：

```ts
import { createModel } from "./model/create-model";
```

而应该写：

```ts
import { createModel } from "./model/create-model.js";
```

注意，这里虽然源文件是：

```text
create-model.ts
```

但是导入路径要写：

```text
create-model.js
```

因为 TypeScript 最终会编译成 JavaScript，Node.js 运行时找的是 `.js` 文件。

后续课程中统一规则：

```text
本地相对路径：加 .js
npm 包路径：不加 .js
```

例如：

```ts
import { createModel } from "./model/create-model.js";
import { ChatOpenAI } from "@langchain/openai";
```

---

## 十六、运行代码

执行：

```bash
pnpm lesson:07
```

运行后重点观察：

```text
========== Agent Loop 第 1 轮 ==========
```

如果模型调用了工具，会看到：

```text
模型返回 tool_calls:
[
  {
    "name": "search_knowledge_base",
    "args": {
      "query": "企业知识库支持的数据源"
    }
  }
]
```

然后会看到工具执行日志：

```text
工具执行日志:
[
  {
    "toolName": "search_knowledge_base",
    "status": "success",
    "durationMs": 1
  }
]
```

如果模型认为工具结果已经足够回答用户，就会在下一轮不再返回 `tool_calls`。

此时停止原因是：

```text
final_answer
```

如果达到最大循环次数仍然没有结束，停止原因是：

```text
max_iterations
```

---

## 十七、测试多步任务

本节最值得观察的是这个输入：

```text
先查一下 RAG 检索效果不好怎么办，然后基于查询结果帮我创建一个中优先级工单。
```

理想情况下，Agent Loop 会执行类似流程：

```text
第 1 轮：
模型调用 search_knowledge_base
  ↓
程序查询知识库，返回 RAG 优化建议

第 2 轮：
模型基于知识库结果调用 create_ticket
  ↓
程序创建工单

第 3 轮：
模型不再调用工具，输出最终回答
```

这说明 Agent 已经从单次工具调用，升级成多轮任务编排。

当然，实际模型表现可能会有差异。

有时模型可能在第一轮同时返回多个 tool_calls。

有时模型可能只创建工单，不先查询知识库。

这也是 Agent 工程中很真实的问题：

```text
工具描述
System Prompt
用户输入
模型能力
上下文内容
```

都会影响模型的工具调用行为。

所以后续需要继续优化 Prompt、工具描述和流程控制。

---

## 十八、第 7 课和第 6 课的区别

第 6 课是：

```text
模型调用一次
  ↓
执行一次 tool_calls
  ↓
再调用模型生成最终回答
```

第 7 课是：

```text
循环调用模型
  ↓
只要模型继续返回 tool_calls，就继续执行工具
  ↓
直到模型不再调用工具，或者达到最大轮次
```

第 6 课解决的是：

```text
如何统一执行工具？
```

第 7 课解决的是：

```text
如何让 Agent 多轮调用工具完成任务？
```

所以第 7 课更接近真正的 Agent。

---

## 十九、这节课和 Agent 的关系

Agent 和普通 LLM 应用最大的区别，不是它会不会聊天，而是它能不能围绕任务进行多步执行。

普通 LLM 应用通常是：

```text
用户输入
  ↓
模型回答
```

单次 Tool Calling 是：

```text
用户输入
  ↓
模型调用工具
  ↓
工具结果
  ↓
模型回答
```

Agent Loop 则是：

```text
用户输入
  ↓
模型判断下一步
  ↓
调用工具
  ↓
工具结果回传模型
  ↓
模型继续判断下一步
  ↓
继续调用工具或输出最终回答
```

也就是说：

> Agent Loop 让模型具备了多步任务编排能力。

在企业场景中，这非常重要。

因为很多任务天然就是多步的。

例如：

```text
先查询订单状态
如果订单异常，再创建工单
如果工单创建成功，再通知用户
```

或者：

```text
先检索知识库
如果知识库没有结果，再创建问题反馈
如果有结果，则整理答案给用户
```

这些都不是一次模型调用能稳定完成的。

---

## 二十、这节课和 LangGraph 的关系

本节虽然还没有正式使用 LangGraph，但其实已经在手写 LangGraph 的核心思想。

现在我们手写的流程是：

```text
LLM 调用
  ↓
判断是否有 tool_calls
  ↓
执行工具
  ↓
继续 LLM 调用
```

未来使用 LangGraph 后，可以把它拆成图节点：

```text
llm_node
  ↓
should_continue 条件判断
  ↓
tool_node
  ↓
llm_node
```

也就是：

```text
模型节点
工具节点
条件边
状态流转
```

所以第 7 课的意义是：

> 先手写 Agent Loop，理解底层流程；后面再用 LangGraph 把它状态图化。

这样学习 LangGraph 时，就不会只是记 API，而是知道它到底在帮我们封装什么。

---

## 二十一、Java 后端视角理解本节结构

从 Java 后端视角看，本节结构可以类比成：

```text
index.ts
  ↓
AgentLoop
  ↓
ToolExecutor
  ↓
Tools
  ↓
Data / External API
```

类似 Java 项目中的：

```text
Controller
  ↓
AgentService
  ↓
ToolExecutorService
  ↓
ToolService
  ↓
Repository / Third-party API
```

`AgentLoop` 类似业务编排服务：

```java
public class AgentLoopService {

    public AgentLoopResult run(String userInput) {
        while (iteration <= maxIterations) {
            AIMessage aiMessage = model.invoke(messages);

            if (aiMessage.getToolCalls().isEmpty()) {
                return finalAnswer;
            }

            ToolExecutionResult executionResult =
                toolExecutor.execute(aiMessage.getToolCalls());

            messages.addAll(executionResult.getMessages());
        }

        return maxIterationFallback;
    }
}
```

`ToolExecutor` 类似统一工具调度器：

```java
public class ToolExecutor {

    private final Map<String, Tool> toolMap;

    public ToolExecutionResult execute(List<ToolCall> toolCalls) {
        // 查找工具
        // 执行工具
        // 捕获异常
        // 记录日志
    }
}
```

这样的分层会比单文件清晰很多。

---

## 二十二、企业级 Agent Loop 还需要考虑什么？

本节只是 Agent Loop 入门。

真实企业项目中，还需要考虑更多问题。

### 1. 最大轮次限制

本节已经增加了：

```ts
maxIterations: 5
```

这是防止 Agent 死循环的基本保护。

---

### 2. 重复工具调用检测

如果模型连续多次用相同参数调用同一个工具，就可能是循环异常。

后续可以增加检测：

```text
同一个 toolName + args 是否重复出现？
如果重复超过次数，强制停止。
```

---

### 3. 高风险工具确认

例如：

```text
删除数据
修改订单
提交审批
发送通知
执行付款
```

这些工具不应该在 Agent Loop 中被模型直接执行。

需要增加：

```text
模型提出操作计划
  ↓
用户确认
  ↓
程序执行工具
```

---

### 4. 执行日志和链路追踪

本节已经记录了：

```text
toolName
toolCallId
args
status
content
durationMs
```

后续可以继续扩展：

```text
用户 ID
会话 ID
请求 ID
模型名称
token 消耗
工具调用耗时
错误堆栈
```

这对生产环境排查问题非常重要。

---

### 5. 状态管理

目前 messages 是内存中的数组。

后续如果做真实系统，需要考虑：

```text
对话历史如何存储？
Agent 中间状态如何恢复？
工具执行记录如何保存？
流程中断后能否继续？
```

这也是后续 LangGraph 会重点解决的问题。

---

## 二十三、Tips：本节涉及的 TypeScript 写法

本节重点仍然是 Agent 工程化，TypeScript 内容只做简要记录。

### 1. 模块导出 export

```ts
export const tools = [...]
```

表示这个变量可以被其他文件导入使用。

类似 Java 中的 `public`。

---

### 2. 类型导入 type

```ts
import { AgentLoop, type ToolCallingModel } from "./agent/agent-loop.js";
```

`type ToolCallingModel` 表示只导入类型，不导入运行时代码。

这样更清晰，也可以减少编译后的运行时代码。

---

### 3. 类型断言 as

```ts
const modelWithTools = model.bindTools(tools) as ToolCallingModel;
```

这表示告诉 TypeScript：

```text
我确认 bindTools 后的对象符合 ToolCallingModel 结构。
```

可以类比 Java 中的强制类型转换。

---

### 4. constructor 参数属性

```ts
constructor(
  private readonly modelWithTools: ToolCallingModel,
  private readonly toolExecutor: ToolExecutor,
  private readonly options: AgentLoopOptions,
) {}
```

这是 TypeScript 的简写。

它等价于：

```ts
private readonly modelWithTools: ToolCallingModel;
private readonly toolExecutor: ToolExecutor;
private readonly options: AgentLoopOptions;

constructor(
  modelWithTools: ToolCallingModel,
  toolExecutor: ToolExecutor,
  options: AgentLoopOptions,
) {
  this.modelWithTools = modelWithTools;
  this.toolExecutor = toolExecutor;
  this.options = options;
}
```

可以类比 Java 中构造函数注入依赖。

---

### 5. 本地相对导入加 .js

在 NodeNext / Node16 模式下：

```ts
import { createModel } from "./model/create-model.js";
```

不要写成：

```ts
import { createModel } from "./model/create-model";
```

后续课程中统一遵守：

```text
本地相对路径：加 .js
第三方包：不加 .js
```

---

## 二十四、本节总结

第 7 课完成了两个关键升级：

```text
1. 从单次 Tool Calling 升级为 Agent Loop
2. 从单文件 Demo 升级为模块化目录结构
```

核心收获：

```text
1. 一次 Tool Calling 只能处理简单任务
2. 多步任务需要 Agent Loop
3. Agent Loop 的核心是：模型调用工具，工具结果回传模型，然后继续判断下一步
4. 模型不再返回 tool_calls 时，流程结束
5. 必须设置 maxIterations，避免 Agent 死循环
6. tools、executor、model、agent 应该拆分到不同文件
7. 模块化结构更接近真实工程，方便维护、测试和协作
8. 当前手写的 Agent Loop 后续可以自然迁移到 LangGraph
```

本节最重要的一句话：

> Agent Loop 让工具调用从“一次执行”升级为“多轮任务编排”，而模块化拆分让 Demo 开始接近真实工程。

---

## 二十五、下一课预告

下一课进入：

# 第 8 课：引入 LangGraph，把 Agent Loop 改造成状态图

第 8 课会学习：

```text
1. 为什么需要 LangGraph
2. 什么是 StateGraph
3. 如何定义 AgentState
4. 如何把 LLM 调用封装成节点
5. 如何把 ToolExecutor 封装成工具节点
6. 如何使用条件边判断是否继续执行
7. 如何把手写 Agent Loop 改造成图结构
```

第 7 课中，我们手写了：

```text
for 循环版 Agent Loop
```

第 8 课会把它升级为：

```text
LangGraph 状态图版 Agent
```

这样 Agent 的流程会从代码循环，逐步演进为更清晰的节点、边和状态流转。
