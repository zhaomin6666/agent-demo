# 第 6 课：封装 Tool Executor，让工具调用流程更工程化

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

第 6 课继续在第 5 课基础上做工程化封装。

第 5 课虽然已经跑通了 Tool Calling，但工具查找、工具执行、异常处理、日志记录都写在主流程里。

随着工具数量增加，这种写法会越来越难维护。

所以这一课要完成一个关键封装：

> 把工具注册、工具查找、工具执行、异常处理统一封装成 ToolExecutor。

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解为什么需要 Tool Executor
2. 把工具注册和工具查找封装起来
3. 把 tool_calls 执行逻辑封装起来
4. 统一处理工具不存在的问题
5. 统一处理工具执行异常
6. 记录每次工具执行日志
7. 让 Agent 主流程变得更清晰
8. 为后续 LangGraph 节点化做准备
```

本节依然不引入 LangGraph。

原因是当前阶段重点不是学习更多框架 API，而是先把 Agent 的工具调用流程理解清楚。

后续进入 LangGraph 时，`ToolExecutor` 就可以很自然地变成一个图节点。

---

## 二、为什么需要 Tool Executor？

第 5 课中，我们已经实现了 Tool Calling 的最小闭环：

```text
用户输入
  ↓
模型返回 tool_calls
  ↓
程序查找工具
  ↓
程序执行工具
  ↓
工具结果放回 messages
  ↓
再次调用模型
  ↓
模型生成最终回答
```

当时工具执行代码直接写在主流程中：

```ts
for (const toolCall of toolCalls) {
  const selectedTool = toolMap.get(toolCall.name);

  if (!selectedTool) {
    throw new Error(`未找到工具：${toolCall.name}`);
  }

  const toolMessage = await selectedTool.invoke(toolCall);

  messages.push(toolMessage);
}
```

这段代码在 Demo 里可以接受。

但如果后续工具越来越多，问题就会变得明显。

例如后续可能会有这些工具：

```text
search_knowledge_base：查询知识库
create_ticket：创建工单
query_order_status：查询订单状态
query_supplier_info：查询供应商信息
get_user_permission：查询用户权限
send_notification：发送通知
submit_approval：提交审批
```

这时如果仍然把工具查找、执行和异常处理写在主流程中，代码会越来越乱。

真实企业 Agent 项目中，工具执行还需要考虑更多问题：

```text
工具是否存在？
工具参数是否合法？
工具执行是否超时？
工具调用是否失败？
用户是否有权限调用这个工具？
工具执行结果怎么记录？
高风险工具是否需要二次确认？
```

所以需要一个统一的工具执行层。

这个执行层就是：

```text
ToolExecutor
```

它的职责是：

```text
接收模型返回的 tool_calls
  ↓
根据 toolName 查找工具
  ↓
执行工具
  ↓
捕获异常
  ↓
生成 ToolMessage
  ↓
记录执行日志
  ↓
返回统一执行结果
```

一句话总结：

> ToolExecutor 是 Agent 工具调用层的统一调度器。

---

## 三、本节目录结构

本节新建第 6 课目录：

```text
agent-demo/
  src/
    lessons/
      lesson01-first-llm-call/
        index.ts

      lesson02-prompt-messages/
        index.ts

      lesson03-structured-output/
        index.ts

      lesson04-intent-classifier/
        index.ts

      lesson05-tool-calling/
        index.ts

      lesson06-tool-executor/
        index.ts
```

代码文件：

```text
src/lessons/lesson06-tool-executor/index.ts
```

---

## 四、配置 package.json

在 `package.json` 中增加第 6 课脚本：

```json
{
  "scripts": {
    "lesson:01": "tsx src/lessons/lesson01-first-llm-call/index.ts",
    "lesson:02": "tsx src/lessons/lesson02-prompt-messages/index.ts",
    "lesson:03": "tsx src/lessons/lesson03-structured-output/index.ts",
    "lesson:04": "tsx src/lessons/lesson04-intent-classifier/index.ts",
    "lesson:05": "tsx src/lessons/lesson05-tool-calling/index.ts",
    "lesson:06": "tsx src/lessons/lesson06-tool-executor/index.ts"
  }
}
```

运行第 6 课：

```bash
pnpm lesson:06
```

---

## 五、本节整体流程设计

第 5 课的主流程是：

```text
用户输入
  ↓
调用模型
  ↓
读取 tool_calls
  ↓
手动查找工具
  ↓
手动执行工具
  ↓
手动 push ToolMessage
  ↓
再次调用模型
  ↓
最终回答
```

第 6 课将工具执行部分抽出来：

```text
用户输入
  ↓
调用模型
  ↓
读取 tool_calls
  ↓
ToolExecutor.execute(toolCalls)
  ↓
返回 ToolMessage[] 和执行日志
  ↓
将 ToolMessage[] 放回 messages
  ↓
再次调用模型
  ↓
最终回答
```

封装后，主流程会变得更清晰：

```ts
const executionResult = await toolExecutor.execute(toolCalls);

messages.push(...executionResult.messages);
```

也就是说，主流程不再关心：

```text
工具怎么查找
工具怎么执行
工具不存在怎么办
工具异常怎么办
执行日志怎么记录
```

这些都交给 `ToolExecutor` 负责。

---

## 六、继续准备模拟知识库数据

本节继续沿用第 5 课的模拟知识库数据。

```ts
type KnowledgeDoc = {
  id: string;
  title: string;
  content: string;
  tags: string[];
};

const knowledgeDocs: KnowledgeDoc[] = [
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

当前数据仍然只是内存数组。

后续进入 RAG 阶段时，这里可以替换成：

```text
向量数据库
全文检索引擎
文档解析结果
企业知识库 API
数据库查询接口
```

---

## 七、定义两个工具

本节继续使用第 5 课的两个工具。

第一个工具：

```text
search_knowledge_base
```

用于模拟查询企业知识库。

```ts
const searchKnowledgeBaseTool = tool(
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

第二个工具：

```text
create_ticket
```

用于模拟创建技术支持工单。

```ts
const createTicketTool = tool(
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
      "创建技术支持工单。当用户明确要求反馈问题、创建工单、提交故障、联系技术支持时使用。",
    schema: z.object({
      title: z.string().describe("工单标题，简短概括用户遇到的问题"),
      description: z.string().describe("工单详细描述"),
      priority: z.enum(["low", "medium", "high"]).describe("工单优先级"),
    }),
  },
);
```

这两个工具分别代表两类常见 Agent 能力：

```text
search_knowledge_base：查询型工具
create_ticket：操作型工具
```

查询型工具一般风险较低。

操作型工具则要更加谨慎，因为它可能会修改系统状态。

在真实项目中，创建工单、发送通知、提交审批、修改订单等操作，都应该考虑权限校验、审计日志和二次确认。

---

## 八、定义工具执行结果结构

为了让工具执行更加工程化，本节定义了几个类型。

首先是模型返回的单个工具调用类型：

```ts
type ToolCall = NonNullable<AIMessage["tool_calls"]>[number];
```

然后定义工具执行状态：

```ts
type ToolExecutionStatus = "success" | "tool_not_found" | "error";
```

它表示一次工具执行可能有三种结果：

```text
success：执行成功
tool_not_found：模型请求了一个不存在的工具
error：工具执行过程中出现异常
```

接着定义单条工具执行记录：

```ts
type ToolExecutionRecord = {
  toolName: string;
  toolCallId?: string;
  args: unknown;
  status: ToolExecutionStatus;
  content: string;
  errorMessage?: string;
  durationMs: number;
};
```

这个结构用于记录每次工具执行的详细信息。

字段含义如下：

| 字段             | 含义           |
| -------------- | ------------ |
| `toolName`     | 工具名称         |
| `toolCallId`   | 模型返回的工具调用 ID |
| `args`         | 工具入参         |
| `status`       | 执行状态         |
| `content`      | 工具返回内容       |
| `errorMessage` | 错误信息         |
| `durationMs`   | 工具执行耗时       |

最后定义整体执行结果：

```ts
type ToolExecutionResult = {
  messages: ToolMessage[];
  records: ToolExecutionRecord[];
  hasError: boolean;
};
```

其中：

```text
messages：要放回 messages 的 ToolMessage 数组
records：工具执行日志
hasError：本次工具执行过程中是否出现错误
```

这样设计后，ToolExecutor 不只是执行工具，还能给主流程返回完整的执行信息。

---

## 九、封装 ToolExecutor

本节核心是 `ToolExecutor` 类。

```ts
class ToolExecutor {
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
    // 单个工具调用执行逻辑
  }
}
```

可以看到，`ToolExecutor` 主要做两件事：

```text
1. constructor 中注册工具
2. execute 中统一执行 tool_calls
```

它内部维护了一个 `toolMap`：

```ts
private readonly toolMap: Map<string, StructuredToolInterface>;
```

这个结构类似 Java 里的：

```java
private final Map<String, Tool> toolMap;
```

作用是根据工具名快速找到工具对象。

---

## 十、处理工具不存在的情况

模型返回的 tool call 不一定永远正确。

虽然工具列表中只有：

```text
search_knowledge_base
create_ticket
```

但模型仍然可能生成一个不存在的工具名。

例如：

```json
{
  "name": "query_pdf_content",
  "args": {
    "query": "PDF 搜索问题"
  }
}
```

如果程序直接执行，就会报错。

所以 ToolExecutor 需要处理工具不存在的情况：

```ts
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
```

这里没有直接抛异常，而是构造了一个 `ToolMessage`。

这样做的好处是：

```text
即使工具不存在，Agent 流程也不会直接中断
模型仍然可以根据错误信息给用户一个友好的解释
```

这就是 Agent 工程中的兜底思想：

> 工具可以失败，但流程不能失控。

---

## 十一、处理工具执行异常

即使工具存在，也可能执行失败。

例如：

```text
知识库服务超时
工单系统接口异常
数据库连接失败
参数不符合业务规则
外部 API 返回错误
```

所以需要用 `try...catch` 包裹工具执行：

```ts
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
```

这里依然没有让异常直接向外抛出。

而是把异常包装成：

```text
ToolMessage
ToolExecutionRecord
```

这样主流程可以继续运行。

模型也可以看到工具执行失败的原因，并生成自然语言回复。

---

## 十二、主流程变得更清晰

有了 ToolExecutor 后，Agent 主流程明显变简单。

```ts
const executionResult = await toolExecutor.execute(toolCalls);

console.log("\n工具执行日志：");
console.log(JSON.stringify(executionResult.records, null, 2));

messages.push(...executionResult.messages);

const finalMessage = await modelWithTools.invoke(messages);
```

主流程现在只关心：

```text
执行 tool_calls
拿到 ToolMessage[]
放回 messages
再次调用模型
```

至于工具内部怎么查找、怎么执行、怎么处理异常，主流程不需要关心。

这就是工程封装的意义。

---

## 十三、本节完整代码

文件路径：

```text
src/lessons/lesson06-tool-executor/index.ts
```

完整代码如下：

```ts
import "dotenv/config";

import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type AIMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import * as z from "zod";

type KnowledgeDoc = {
  id: string;
  title: string;
  content: string;
  tags: string[];
};

const knowledgeDocs: KnowledgeDoc[] = [
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

const searchKnowledgeBaseTool = tool(
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

const createTicketTool = tool(
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
      "创建技术支持工单。当用户明确要求反馈问题、创建工单、提交故障、联系技术支持时使用。",
    schema: z.object({
      title: z.string().describe("工单标题，简短概括用户遇到的问题"),
      description: z.string().describe("工单详细描述"),
      priority: z.enum(["low", "medium", "high"]).describe("工单优先级"),
    }),
  },
);

const tools: StructuredToolInterface[] = [
  searchKnowledgeBaseTool,
  createTicketTool,
];

type ToolCall = NonNullable<AIMessage["tool_calls"]>[number];

type ToolExecutionStatus = "success" | "tool_not_found" | "error";

type ToolExecutionRecord = {
  toolName: string;
  toolCallId?: string;
  args: unknown;
  status: ToolExecutionStatus;
  content: string;
  errorMessage?: string;
  durationMs: number;
};

type ToolExecutionResult = {
  messages: ToolMessage[];
  records: ToolExecutionRecord[];
  hasError: boolean;
};

class ToolExecutor {
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

function createModel() {
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

const model = createModel();
const modelWithTools = model.bindTools(tools);
const toolExecutor = new ToolExecutor(tools);

async function runAgent(userInput: string) {
  const messages: BaseMessage[] = [
    new SystemMessage(`
你是一个企业 AI 知识库 / Agent Demo 助手。

规则：
1. 如果用户问的是企业知识库、RAG、文档接入、检索优化、Agent 工具规范，优先调用 search_knowledge_base。
2. 如果用户要求创建工单、反馈问题、提交故障，调用 create_ticket。
3. 不要编造内部系统信息，能查工具就查工具。
4. 工具执行后，请用自然语言总结工具返回结果。
5. 如果工具执行失败，请基于工具错误信息给用户一个友好的解释。
`),
    new HumanMessage(userInput),
  ];

  console.log("\n==============================");
  console.log("用户输入：", userInput);

  const aiMessage = await modelWithTools.invoke(messages);

  console.log("\n第一次模型返回：");
  console.log("content:", aiMessage.content);
  console.log("tool_calls:", JSON.stringify(aiMessage.tool_calls, null, 2));

  messages.push(aiMessage);

  const toolCalls = aiMessage.tool_calls ?? [];

  if (toolCalls.length === 0) {
    console.log("\n模型没有选择调用工具，直接回复：");
    console.log(aiMessage.content);
    return;
  }

  const executionResult = await toolExecutor.execute(toolCalls);

  console.log("\n工具执行日志：");
  console.log(JSON.stringify(executionResult.records, null, 2));

  messages.push(...executionResult.messages);

  const finalMessage = await modelWithTools.invoke(messages);

  console.log("\n最终回答：");
  console.log(finalMessage.content);
}

async function main() {
  await runAgent("我们的企业知识库支持哪些数据源接入？");

  await runAgent("RAG 检索效果不好，一般可以从哪些方面优化？");

  await runAgent("知识库搜索 PDF 内容经常搜不到，帮我创建一个高优先级工单。");
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 十四、运行代码

执行：

```bash
pnpm lesson:06
```

运行后可以重点观察工具执行日志。

示例输出：

```text
==============================
用户输入： 我们的企业知识库支持哪些数据源接入？

第一次模型返回：
content:
tool_calls: [
  {
    "name": "search_knowledge_base",
    "args": {
      "query": "企业知识库支持的数据源"
    },
    "id": "call_xxx"
  }
]

工具执行日志：
[
  {
    "toolName": "search_knowledge_base",
    "toolCallId": "call_xxx",
    "args": {
      "query": "企业知识库支持的数据源"
    },
    "status": "success",
    "content": "{...}",
    "durationMs": 1
  }
]

最终回答：
企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源。后续会扩展数据库表和工单系统数据。
```

如果模型调用的是创建工单工具，则会看到：

```text
工具执行日志：
[
  {
    "toolName": "create_ticket",
    "toolCallId": "call_xxx",
    "args": {
      "title": "知识库搜索 PDF 内容异常",
      "description": "用户反馈知识库搜索 PDF 内容经常搜不到，需要技术支持跟进。",
      "priority": "high"
    },
    "status": "success",
    "content": "{...}",
    "durationMs": 1
  }
]
```

通过这个日志可以清楚看到：

```text
模型选择了哪个工具
模型生成了什么参数
工具是否执行成功
工具返回了什么内容
工具执行耗时多少
```

这些信息对后续调试 Agent 非常重要。

---

## 十五、这节课和 Agent 的关系

第 6 课看起来只是做了一层封装，但它其实是 Agent 工程化里非常关键的一步。

第 5 课实现的是：

```text
能调用工具
```

第 6 课实现的是：

```text
可管理地调用工具
```

这两者差别很大。

一个企业级 Agent 不可能只有一个工具，也不可能只处理成功情况。

真实 Agent 必须面对：

```text
模型选错工具
工具不存在
工具参数错误
工具执行超时
外部系统异常
多个工具连续调用
工具返回结果不符合预期
```

如果没有统一执行层，这些问题都会散落在主流程中。

有了 ToolExecutor 后，Agent 主流程可以保持清晰：

```text
准备 messages
  ↓
调用模型
  ↓
拿到 tool_calls
  ↓
交给 ToolExecutor
  ↓
拿到 ToolMessage
  ↓
继续调用模型
```

而工具执行相关问题统一收口到 ToolExecutor。

这也是后续接入 LangGraph 的基础。

因为 LangGraph 本质上是把流程拆成节点。

未来可以这样设计：

```text
LLM 节点
  ↓
ToolExecutor 节点
  ↓
条件判断节点
  ↓
最终回答节点
```

所以本节的 ToolExecutor，后面可以直接演进成 LangGraph 中的一个工具执行节点。

---

## 十六、Java 后端视角理解 ToolExecutor

作为 Java 后端开发者，可以把 `ToolExecutor` 理解成一个服务调度器。

它类似下面这种结构：

```java
public class ToolExecutor {

    private final Map<String, Tool> toolMap;

    public ToolExecutor(List<Tool> tools) {
        this.toolMap = tools.stream()
            .collect(Collectors.toMap(Tool::getName, Function.identity()));
    }

    public ToolExecutionResult execute(List<ToolCall> toolCalls) {
        // 1. 根据 toolName 找工具
        // 2. 执行工具
        // 3. 捕获异常
        // 4. 记录日志
        // 5. 返回执行结果
    }
}
```

而 Agent 主流程类似：

```java
public class AgentService {

    private final ChatModel model;
    private final ToolExecutor toolExecutor;

    public AgentResponse run(String userInput) {
        AIMessage aiMessage = model.invoke(messages);

        ToolExecutionResult executionResult =
            toolExecutor.execute(aiMessage.getToolCalls());

        messages.addAll(executionResult.getMessages());

        return model.invoke(messages);
    }
}
```

这样分层以后，职责会更清楚：

```text
AgentService：负责 Agent 主流程
ToolExecutor：负责工具执行
Tool：负责具体业务能力
Model：负责理解和生成
```

这和 Java 后端中常见的 Service 分层思想是一致的。

---

## 十七、企业级 ToolExecutor 后续可以扩展什么？

这一课的 ToolExecutor 还比较简单，但已经具备了扩展基础。

后续可以继续加入：

```text
工具权限校验
工具调用白名单
工具执行超时控制
工具失败重试
工具执行审计日志
高风险工具二次确认
工具入参脱敏
工具结果脱敏
工具调用成本统计
工具调用链路追踪
```

例如，后续可以在执行工具前增加权限判断：

```text
当前用户是否允许调用 create_ticket？
当前用户是否允许查询订单？
当前用户是否允许提交审批？
```

也可以在执行高风险工具前增加确认流程：

```text
模型提出操作计划
  ↓
用户确认
  ↓
ToolExecutor 真正执行工具
```

这就是从 Demo 走向企业级 Agent 时必须考虑的问题。

---

## 十八、Tips：本节涉及的 TypeScript 写法

本节重点仍然是 Agent 工程化，TypeScript 只记录几个关键点。

### 1. `NonNullable`

```ts
type ToolCall = NonNullable<AIMessage["tool_calls"]>[number];
```

这句的意思是：

```text
从 AIMessage 的 tool_calls 字段中，推导出单个 toolCall 的类型。
```

拆开看：

```ts
AIMessage["tool_calls"]
```

表示取出 `AIMessage` 里的 `tool_calls` 字段类型。

它可能是：

```text
ToolCall[] | undefined
```

所以用：

```ts
NonNullable<...>
```

去掉 `null` 和 `undefined`。

最后的：

```ts
[number]
```

表示取数组中的单个元素类型。

---

### 2. `private readonly`

```ts
private readonly toolMap: Map<string, StructuredToolInterface>;
```

可以类比 Java：

```java
private final Map<String, Tool> toolMap;
```

含义是：

```text
private：只能在类内部访问
readonly：初始化后不能重新赋值
```

---

### 3. `records.some(...)`

```ts
hasError: records.some((record) => record.status !== "success"),
```

意思是：

```text
只要有一个工具执行记录不是 success，就认为本次工具执行存在错误。
```

Java 类比：

```java
boolean hasError = records.stream()
    .anyMatch(record -> !"success".equals(record.getStatus()));
```

---

### 4. 展开数组

```ts
messages.push(...executionResult.messages);
```

`...` 是展开语法。

如果 `executionResult.messages` 是：

```ts
[toolMessage1, toolMessage2]
```

那么：

```ts
messages.push(...executionResult.messages);
```

等价于：

```ts
messages.push(toolMessage1, toolMessage2);
```

---

### 5. `unknown`

```ts
args: unknown;
```

`unknown` 表示当前还不知道具体类型。

它比 `any` 更安全。

`any` 的意思是：

```text
我不检查类型，你随便用。
```

`unknown` 的意思是：

```text
我暂时不知道类型，使用前需要判断或转换。
```

在工具执行日志里，`args` 来自模型返回结果，不同工具参数结构不同，所以用 `unknown` 比较合适。

---

## 十九、本节总结

本节完成了一个关键工程化动作：封装 `ToolExecutor`。

核心收获：

```text
1. 第 5 课只是跑通 Tool Calling，第 6 课开始做工程化封装
2. 工具查找、工具执行、异常处理不应该散落在主流程里
3. ToolExecutor 负责统一执行模型返回的 tool_calls
4. 工具不存在时不应该直接让流程崩溃，而应该返回 ToolMessage
5. 工具执行异常也应该包装成 ToolMessage，让模型可以继续处理
6. ToolExecutionRecord 可以记录工具名称、参数、状态、耗时和错误信息
7. Agent 主流程应该只关心 messages、tool_calls 和最终回答
8. ToolExecutor 后续可以扩展权限、审计、重试、超时和二次确认
```

本节最重要的一句话：

> ToolExecutor 是 Agent 工具调用层的工程化封装，它让工具调用从“能跑”变成“可管理、可扩展、可排查”。

---

## 二十、下一课预告

下一课进入：

# 第 7 课：Agent Loop 入门

第 7 课会学习：

```text
1. 为什么一次 Tool Calling 不够
2. 什么是 Agent Loop
3. 如何让模型多轮调用工具
4. 如何设置最大循环次数
5. 如何避免 Agent 死循环
6. 如何判断流程什么时候结束
7. 如何为后续 LangGraph 状态机做准备
```

第 6 课完成了工具执行层封装。

第 7 课会继续往 Agent 核心流程推进，让 Agent 不只是调用一次工具，而是具备多轮思考和多轮工具调用的能力。
