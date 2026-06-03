# 第 5 课：Tool Calling 入门，让 Agent 真正开始调用工具

## 前言

前面几节课已经完成了 AI Agent 项目的基础能力。

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
增加 success / rawOutput / errorMessage
为后续工具调用做准备
```

从第 5 课开始，我们正式进入 Agent 的核心能力之一：

> Tool Calling。

前几课主要解决的是：

```text
如何让模型理解用户输入？
如何让模型输出结构化结果？
如何把意图识别封装成可复用模块？
```

这一课开始解决一个更关键的问题：

> 如何让模型根据用户问题选择工具，并由程序执行工具？

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解 Tool Calling 在 Agent 中的作用
2. 理解 bindTools 后工具信息是如何传给模型的
3. 定义两个模拟工具：知识库查询工具、工单创建工具
4. 让模型根据用户输入自动选择工具
5. 执行模型返回的 tool_calls
6. 将工具执行结果重新交给模型总结
7. 打印真实请求内容，观察 tools 是如何被发送给模型的
8. 为后续封装 Tool Executor 做准备
```

本节依然先不接真实数据库和真实业务系统，而是用内存数据模拟企业知识库和工单系统。

这样可以把注意力集中在 Tool Calling 的核心流程上。

---

## 二、为什么需要 Tool Calling？

普通大模型本身只能生成文本。

它可以回答问题、解释概念、总结内容、生成代码，但它不能直接完成这些业务动作：

```text
查询企业知识库
创建技术支持工单
查询订单状态
调用内部业务接口
写入数据库
检索内部文档
调用第三方 API
```

但企业级 AI Agent 往往不能只停留在“聊天”。

真实业务场景中，用户可能会问：

```text
我们的企业知识库支持哪些数据源接入？
```

也可能会说：

```text
知识库搜索 PDF 内容经常搜不到，帮我创建一个高优先级工单。
```

这时 Agent 不能只靠模型自由发挥，而应该根据用户需求调用对应工具。

例如：

```text
用户询问知识库能力
  ↓
调用 search_knowledge_base 工具

用户要求反馈问题
  ↓
调用 create_ticket 工具
```

所以 Tool Calling 的作用就是：

> 让大模型从“只能回答”升级为“可以调度外部工具完成任务”。

---

## 三、Tool Calling 不是模型直接执行函数

刚开始学习 Tool Calling 时，很容易产生一个误解：

> 是不是 bindTools 之后，大模型就可以直接执行我的 TypeScript 函数了？

答案是否定的。

大模型并不会真正执行函数。

Tool Calling 的本质是：

> 模型根据工具描述，返回一个结构化的工具调用请求。

例如用户输入：

```text
我们的企业知识库支持哪些数据源接入？
```

模型可能返回：

```json
{
  "name": "search_knowledge_base",
  "args": {
    "query": "企业知识库支持的数据源"
  }
}
```

这个结果的意思是：

```text
模型认为应该调用 search_knowledge_base 工具
并且参数是 query = 企业知识库支持的数据源
```

但是，真正执行工具的不是模型，而是我们的 Node.js 程序。

完整流程是：

```text
用户输入
  ↓
模型读取 messages + tools
  ↓
模型返回 tool_calls
  ↓
程序根据 tool_calls 找到对应工具
  ↓
程序执行工具
  ↓
程序把工具结果放回 messages
  ↓
再次调用模型
  ↓
模型根据工具结果生成最终回答
```

所以本节最重要的认知是：

> Tool Calling 不是模型执行函数，而是模型生成调用计划，程序负责真正执行。

---

## 四、本节目录结构

本节新建第 5 课目录：

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
```

代码文件：

```text
src/lessons/lesson05-tool-calling/index.ts
```

---

## 五、配置 package.json

在 `package.json` 中增加第 5 课脚本：

```json
{
  "scripts": {
    "lesson:01": "tsx src/lessons/lesson01-first-llm-call/index.ts",
    "lesson:02": "tsx src/lessons/lesson02-prompt-messages/index.ts",
    "lesson:03": "tsx src/lessons/lesson03-structured-output/index.ts",
    "lesson:04": "tsx src/lessons/lesson04-intent-classifier/index.ts",
    "lesson:05": "tsx src/lessons/lesson05-tool-calling/index.ts"
  }
}
```

运行第 5 课：

```bash
pnpm lesson:05
```

如果想打印真实请求内容，可以加上环境变量：

```bash
DEBUG_LLM_REQUEST=true pnpm lesson:05
```

Windows PowerShell 可以使用：

```powershell
$env:DEBUG_LLM_REQUEST="true"; pnpm lesson:05
```

---

## 六、本节整体流程设计

第 4 课的流程是：

```text
用户输入
  ↓
IntentClassifier.classify(input)
  ↓
模型输出结构化意图
  ↓
程序根据 intent 决定后续流程
```

第 5 课开始尝试让模型直接选择工具：

```text
用户输入
  ↓
模型读取可用工具列表
  ↓
模型判断是否需要调用工具
  ↓
模型返回 tool_calls
  ↓
程序执行工具
  ↓
程序把工具结果交回模型
  ↓
模型生成最终回答
```

可以看到，第 5 课比第 4 课更进一步。

第 4 课只做到了：

```text
判断用户想做什么
```

第 5 课开始做到：

```text
判断用户想做什么，并选择合适工具执行
```

---

## 七、准备模拟知识库数据

本节先用内存数组模拟企业知识库。

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

这部分可以理解成一个非常简单的知识库表。

在真实项目中，它可能来自：

```text
向量数据库
全文检索引擎
数据库表
文档系统
企业内部 FAQ
工单知识沉淀
```

本节先不引入 RAG 检索，重点是理解工具调用流程。

---

## 八、定义知识库查询工具

第一个工具是：

```text
search_knowledge_base
```

作用是查询企业知识库。

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

这个工具包含三部分：

```text
1. 工具执行函数
2. 工具名称 name
3. 工具描述 description
4. 工具入参 schema
```

其中 description 非常重要。

因为模型并不会阅读函数内部实现，它主要通过工具名称、工具描述、参数 schema 来判断什么时候该调用这个工具。

所以工具描述不能随便写。

比如下面这种描述就太模糊：

```text
查询信息
```

更好的描述是：

```text
查询企业 AI 知识库中的内部资料。当用户询问知识库、RAG、文档接入、检索优化、Agent 工具规范时使用。
```

这段描述明确告诉模型：

```text
这个工具查什么
什么情况下应该使用
适合哪些业务场景
```

---

## 九、定义工单创建工具

第二个工具是：

```text
create_ticket
```

作用是模拟创建技术支持工单。

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

这个工具模拟的是企业系统里的一个业务动作。

在真实项目中，它可能会调用：

```text
工单系统 API
客服系统 API
数据库新增接口
流程引擎接口
消息通知接口
```

需要注意，创建工单已经属于“写操作”。

虽然本节只是 Demo，但在真实企业项目中，写操作工具通常需要更严格的控制。

例如：

```text
权限校验
参数校验
操作日志
失败重试
二次确认
风控限制
```

尤其是删除数据、修改权限、提交审批、付款这类高风险工具，不能让模型直接无确认执行。

---

## 十、统一管理工具列表

定义完工具后，需要把工具统一放到数组中。

```ts
const tools: StructuredToolInterface[] = [
  searchKnowledgeBaseTool,
  createTicketTool,
];

const toolMap = new Map<string, StructuredToolInterface>(
  tools.map((item) => [item.name, item]),
);
```

这里做了两件事：

```text
1. tools 用于绑定到模型
2. toolMap 用于根据模型返回的 toolCall.name 找到真实工具
```

例如模型返回：

```json
{
  "name": "search_knowledge_base",
  "args": {
    "query": "RAG"
  }
}
```

程序就可以通过：

```ts
const selectedTool = toolMap.get(toolCall.name);
```

找到真正的工具并执行。

---

## 十一、bindTools 做了什么？

本节通过下面这行代码把工具绑定到模型上：

```ts
const modelWithTools = model.bindTools(tools);
```

这里要重点理解：

> bindTools 不是让模型直接拥有执行函数的能力，而是把工具信息转换成模型可以理解的 tools schema。

之后调用：

```ts
await modelWithTools.invoke(messages);
```

请求大模型时，LangChain 会把 messages 和 tools 一起发送给模型。

简化后的请求结构类似：

```json
{
  "model": "qwen3.6-flash",
  "messages": [
    {
      "role": "system",
      "content": "你是一个企业 AI 知识库 / Agent Demo 助手..."
    },
    {
      "role": "user",
      "content": "我们的企业知识库支持哪些数据源接入？"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "search_knowledge_base",
        "description": "查询企业 AI 知识库中的内部资料...",
        "parameters": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "用于检索知识库的关键词，例如：RAG、数据源、工具调用规范"
            }
          },
          "required": ["query"]
        }
      }
    }
  ]
}
```

也就是说：

```text
messages：当前对话内容
tools：模型可以选择调用的工具列表
```

模型会根据这两部分信息判断下一步是直接回答，还是返回工具调用请求。

---

## 十二、第一次调用模型：获取 tool_calls

本节封装了一个函数：

```ts
async function runToolCalling(userInput: string) {
  // ...
}
```

核心流程如下：

```ts
const aiMessage = await modelWithTools.invoke(messages);
```

第一次调用模型后，我们重点观察：

```ts
console.log("content:", aiMessage.content);
console.log("tool_calls:", JSON.stringify(aiMessage.tool_calls, null, 2));
```

如果模型认为需要调用工具，返回结果中会包含：

```json
[
  {
    "name": "search_knowledge_base",
    "args": {
      "query": "企业知识库支持的数据源"
    },
    "id": "call_xxx"
  }
]
```

这一步可以理解成：

```text
模型没有直接回答用户
而是告诉程序：我需要调用这个工具
```

这也是 Tool Calling 和普通 LLM 调用最大的区别之一。

---

## 十三、执行工具并回传结果

拿到 `tool_calls` 后，程序需要逐个执行工具：

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

这里的执行过程是：

```text
读取 toolCall.name
  ↓
从 toolMap 中找到对应工具
  ↓
把 toolCall 传给工具
  ↓
工具执行完成后返回 ToolMessage
  ↓
把 ToolMessage 放回 messages
```

工具执行结果不是直接返回给用户，而是先放回对话上下文。

这样模型才能在第二次调用时看到工具执行结果，并用自然语言总结给用户。

---

## 十四、第二次调用模型：生成最终回答

工具执行完后，再次调用模型：

```ts
const finalMessage = await modelWithTools.invoke(messages);
```

这次 messages 中已经包含了：

```text
SystemMessage
HumanMessage
AIMessage，也就是模型第一次返回的 tool_calls
ToolMessage，也就是工具执行结果
```

模型根据这些信息生成最终回答。

完整流程可以理解成：

```text
第一次模型调用：
用户问题 + 工具定义
  ↓
模型返回 tool_calls

程序执行工具：
tool_calls
  ↓
工具结果

第二次模型调用：
用户问题 + tool_calls + 工具结果
  ↓
模型生成最终回答
```

这就是一个最小版 Agent 工具调用闭环。

---

## 十五、打印真实请求内容

为了更好理解 `bindTools()` 到底做了什么，本节增加了一个调试能力：

```ts
const debugFetch: typeof globalThis.fetch = async (input, init) => {
  // 打印请求内容
  return globalThis.fetch(input, init);
};
```

然后在创建模型时传入：

```ts
configuration: {
  baseURL,
  fetch: debugFetch,
}
```

这样每次请求模型前，就能看到真实的 HTTP 请求内容。

重点观察 Body 里的：

```json
{
  "messages": [],
  "tools": []
}
```

这能帮助我们确认：

```text
SystemMessage 是否变成 role: system
HumanMessage 是否变成 role: user
Tool 是否变成 function schema
bindTools 后工具信息是否真的发送给了模型
```

这一点对学习 Agent 很重要。

因为 Agent 表面看起来很抽象，但底层仍然是一次次模型请求和工具执行。

只要能看清请求和响应，Agent 的工作机制就会清楚很多。

---

## 十六、本节完整代码

文件路径：

```text
src/lessons/lesson05-tool-calling/index.ts
```

完整代码如下：

```ts
import "dotenv/config";

import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
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

const toolMap = new Map<string, StructuredToolInterface>(
  tools.map((item) => [item.name, item]),
);

function createDebugFetch(): typeof globalThis.fetch {
  const enableRequestDebug = process.env.DEBUG_LLM_REQUEST === "true";

  return async (input, init) => {
    if (!enableRequestDebug) {
      return globalThis.fetch(input, init);
    }

    console.log("\n========== 实际请求大模型的 HTTP 内容 ==========");

    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    console.log("URL:");
    console.log(url);

    console.log("\nMethod:");
    console.log(init?.method);

    console.log("\nHeaders:");
    const headers = new Headers(init?.headers);
    const safeHeaders = Object.fromEntries(
      [...headers.entries()].map(([key, value]) => {
        if (key.toLowerCase() === "authorization") {
          return [key, "Bearer ***"];
        }

        return [key, value];
      }),
    );
    console.log(JSON.stringify(safeHeaders, null, 2));

    console.log("\nBody:");
    if (typeof init?.body === "string") {
      try {
        const body = JSON.parse(init.body);
        console.log(JSON.stringify(body, null, 2));
      } catch {
        console.log(init.body);
      }
    } else {
      console.log(init?.body);
    }

    console.log("============================================\n");

    return globalThis.fetch(input, init);
  };
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
      fetch: createDebugFetch(),
    },
    streamUsage: false,
  });
}

const model = createModel();

const modelWithTools = model.bindTools(tools);

async function runToolCalling(userInput: string) {
  const messages: BaseMessage[] = [
    new SystemMessage(`
你是一个企业 AI 知识库 / Agent Demo 助手。

规则：
1. 如果用户问的是企业知识库、RAG、文档接入、检索优化、Agent 工具规范，优先调用 search_knowledge_base。
2. 如果用户要求创建工单、反馈问题、提交故障，调用 create_ticket。
3. 不要编造内部系统信息，能查工具就查工具。
4. 工具执行后，请用自然语言总结工具返回结果。
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

  for (const toolCall of toolCalls) {
    const selectedTool = toolMap.get(toolCall.name);

    if (!selectedTool) {
      throw new Error(`未找到工具：${toolCall.name}`);
    }

    console.log(`\n准备执行工具：${toolCall.name}`);
    console.log("工具参数：", JSON.stringify(toolCall.args, null, 2));

    const toolMessage = await selectedTool.invoke(toolCall);

    console.log("\n工具执行结果：");
    console.log(toolMessage.content);

    messages.push(toolMessage);
  }

  const finalMessage = await modelWithTools.invoke(messages);

  console.log("\n最终回答：");
  console.log(finalMessage.content);
}

async function main() {
  await runToolCalling("我们的企业知识库支持哪些数据源接入？");

  await runToolCalling(
    "知识库搜索 PDF 内容经常搜不到，帮我创建一个高优先级工单。",
  );
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 十七、运行代码

执行：

```bash
pnpm lesson:05
```

如果想观察真实请求内容，执行：

```bash
DEBUG_LLM_REQUEST=true pnpm lesson:05
```

Windows PowerShell：

```powershell
$env:DEBUG_LLM_REQUEST="true"; pnpm lesson:05
```

运行后会看到类似输出：

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

准备执行工具：search_knowledge_base
工具参数： {
  "query": "企业知识库支持的数据源"
}

工具执行结果：
{
  "query": "企业知识库支持的数据源",
  "count": 1,
  "results": [
    {
      "id": "doc-001",
      "title": "企业知识库支持的数据源",
      "content": "企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源。后续会扩展数据库表和工单系统数据。",
      "tags": ["knowledge_base", "datasource", "rag"]
    }
  ]
}

最终回答：
企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源。后续还会扩展数据库表和工单系统数据。
```

第二个输入可能会触发：

```text
create_ticket
```

输出类似：

```text
准备执行工具：create_ticket
工具参数： {
  "title": "知识库搜索 PDF 内容异常",
  "description": "用户反馈知识库搜索 PDF 内容经常搜不到，需要技术支持跟进。",
  "priority": "high"
}

工具执行结果：
{
  "ticketNo": "TICKET-...",
  "status": "created",
  "message": "工单已创建，后续将由技术支持人员跟进。"
}

最终回答：
已为你创建高优先级技术支持工单，问题是知识库搜索 PDF 内容经常搜不到，后续将由技术支持人员跟进。
```

实际输出可能会因模型生成结果略有差异，但整体流程应该一致。

---

## 十八、这节课和 Agent 的关系

第 5 课是从普通 LLM 应用走向 Agent 应用的关键一步。

普通 LLM 应用通常是：

```text
用户输入
  ↓
模型回答
```

而 Agent 应用更像是：

```text
用户输入
  ↓
模型判断任务
  ↓
模型选择工具
  ↓
程序执行工具
  ↓
模型根据工具结果继续回答
```

本节实现的是最小版本的 Agent 工具调用闭环：

```text
用户输入
  ↓
Tool Calling
  ↓
工具执行
  ↓
最终回答
```

这和第 4 课的 Intent Classifier 是连续的。

第 4 课：

```text
用户输入
  ↓
识别意图
```

第 5 课：

```text
用户输入
  ↓
模型选择工具
  ↓
程序执行工具
```

后续可以把两者结合起来：

```text
用户输入
  ↓
Intent Classifier
  ↓
判断业务场景
  ↓
选择 Agent 流程
  ↓
Tool Calling
  ↓
执行工具
  ↓
生成最终回答
```

这种方式比单纯把所有工具都交给模型更加可控。

尤其在企业级场景中，很多操作需要权限、审计、确认和兜底，不能完全依赖模型自由选择。

---

## 十九、企业级 Tool Calling 的工程注意点

本节只是入门 Demo，但已经可以引出一些企业级工程实践问题。

### 1. 工具名称要稳定

工具名建议使用英文 snake_case：

```text
search_knowledge_base
create_ticket
query_order_status
```

不要频繁修改工具名。

因为工具名会出现在：

```text
Prompt
日志
测试用例
执行轨迹
监控记录
错误排查信息
```

工具名稳定，后续问题排查会更容易。

---

### 2. 工具描述要写给模型看

工具 description 不是普通代码注释。

它是模型判断是否调用工具的重要依据。

好的工具描述应该说明：

```text
这个工具做什么
什么情况下使用
适合哪些业务场景
不适合哪些业务场景
```

如果多个工具描述过于相似，模型就容易选错工具。

---

### 3. 工具入参必须校验

模型生成的参数不能直接进入业务系统。

例如工单优先级只能是：

```text
low
medium
high
```

如果模型返回了其他值，程序应该拦截。

所以本节继续使用 zod schema 来约束工具入参。

这也是前面第 3 课结构化校验能力的延续。

---

### 4. 工具执行失败必须兜底

真实业务工具可能会失败。

例如：

```text
知识库服务超时
工单系统不可用
数据库连接失败
用户没有权限
接口返回异常
```

如果没有统一异常处理，Agent 很容易在工具执行阶段中断。

所以后续需要封装 Tool Executor。

Tool Executor 应该负责：

```text
查找工具
执行工具
捕获异常
记录日志
返回统一错误结构
```

---

### 5. 高风险工具需要二次确认

不是所有工具都适合让模型直接调用。

例如：

```text
删除数据
修改订单
提交审批
发送通知
修改权限
执行付款
```

这些都属于高风险操作。

真实项目中通常需要设计成：

```text
模型生成操作计划
  ↓
展示给用户确认
  ↓
用户确认后程序执行
```

这也是企业级 Agent 和普通 Demo 的重要区别。

---

## 二十、Tips：本节涉及的 TypeScript 写法

本节重点仍然是 Agent 的 Tool Calling，TypeScript 内容只做简要记录。

### 1. 使用 Map 管理工具

```ts
const toolMap = new Map<string, StructuredToolInterface>(
  tools.map((item) => [item.name, item]),
);
```

可以类比 Java：

```java
Map<String, Tool> toolMap = new HashMap<>();
```

作用是根据工具名快速找到工具对象。

---

### 2. 使用公共接口管理多个工具

```ts
const tools: StructuredToolInterface[] = [
  searchKnowledgeBaseTool,
  createTicketTool,
];
```

因为每个工具的 schema 不一样，如果让 TypeScript 自动推断，可能会出现联合类型问题。

统一声明成 `StructuredToolInterface[]`，可以理解成 Java 中的面向接口编程：

```java
List<Tool> tools = List.of(toolA, toolB);
```

业务层不关心具体工具类型，只关心它们都能被执行。

---

### 3. 空值合并运算符

```ts
const toolCalls = aiMessage.tool_calls ?? [];
```

意思是：

```text
如果 tool_calls 有值，就使用 tool_calls
如果 tool_calls 是 null 或 undefined，就使用空数组
```

类似 Java 中的空值兜底处理。

---

### 4. zod schema

```ts
schema: z.object({
  query: z.string(),
})
```

可以类比 Java 中的：

```text
DTO + Validation 注解
```

它既能告诉模型需要哪些参数，也能帮助程序校验参数结构。

---

## 二十一、本节总结

本节完成了 Tool Calling 的最小闭环。

核心收获：

```text
1. Tool Calling 是 Agent 调用外部能力的关键机制
2. 模型不会真正执行函数，只会返回 tool_calls
3. 程序需要根据 tool_calls 找到工具并执行
4. 工具执行结果需要重新放回 messages
5. 第二次调用模型后，模型才能基于工具结果生成最终回答
6. bindTools 会把工具信息作为 tools schema 发送给模型
7. 打印真实请求内容可以帮助理解 Agent 底层机制
8. 工具名称、工具描述、参数 schema 都会影响模型调用效果
```

本节最重要的一句话：

> Tool Calling 的核心不是让模型执行代码，而是让模型生成结构化调用请求，再由程序执行真实业务能力。

---

## 二十二、下一课预告

下一课进入：

# 第 6 课：封装 Tool Executor

第 6 课会学习：

```text
1. 为什么需要 Tool Executor
2. 如何把工具注册和工具查找封装起来
3. 如何统一执行 tool_calls
4. 如何处理工具不存在的情况
5. 如何处理工具执行异常
6. 如何记录工具执行日志
7. 如何为后续 LangGraph 状态流转做准备
```

这一课之后，Tool Calling 就不只是一个 Demo 流程，而会逐步变成可以复用的 Agent 工程模块。
