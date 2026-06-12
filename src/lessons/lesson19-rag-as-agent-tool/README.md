# 第 19 课：把 RAG 封装成 Tool，接入现有 Agent

## 前言

第 18 课我们完成了一个独立的 RAG QA Chain。

它的流程是：

```text
用户问题
  ↓
Vector Store 检索
  ↓
构造 context
  ↓
Chat Model
  ↓
RAG 最终答案
```

也就是说，第 18 课解决的是：

```text
如何基于知识库资料生成答案？
```

但是在真实 Agent 系统中，用户的问题不一定都要走 RAG。

比如：

```text
你好
帮我创建一个工单
知识库支持哪些数据源？
先查一下知识库，再帮我提交反馈
```

这些问题的处理方式是不一样的。

有些问题需要查知识库，有些问题需要创建工单，有些问题只是普通对话。

所以第 19 课要做的是：

> 把 RAG QA Chain 封装成一个 Agent Tool，让 Agent 自己决定什么时候调用知识库。

这一步完成后，我们就从“独立 RAG”进入了“Agentic RAG”。

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 复用第 13 课的 Agent 权限控制框架
2. 复用第 18 课的 RAG QA Chain
3. 把 RAG QA Chain 封装成 search_knowledge_base 工具
4. 让 Agent 自己决定是否调用知识库工具
5. 保留 create_ticket 工具
6. 保留工具权限控制
7. 保留 create_ticket 的人工确认
8. 完成 Agent + RAG 的第一次整合
```

第 18 课解决的是：

```text
用户问题 → RagQaChain → 知识库答案
```

第 19 课解决的是：

```text
用户问题 → Agent → 工具选择 → RAG Tool → Agent 最终回答
```

这一课的核心是：

> RAG 不再是固定链路，而是 Agent 可以按需调用的知识工具。

---

## 二、什么是 Agentic RAG？

前面第 18 课的 RAG 是固定流程：

```text
只要用户提问，就直接进入 RagQaChain
```

这种方式适合做一个普通知识库问答系统。

但是 Agentic RAG 不一样。

Agentic RAG 的流程更像是：

```text
用户输入
  ↓
Agent 判断用户意图
  ↓
需要查知识库时，调用 RAG Tool
  ↓
不需要查知识库时，可以调用其他工具或直接回答
```

也就是说：

```text
RAG 从一个固定流程，变成了 Agent 的一个工具能力。
```

这带来的好处是：

```text
1. Agent 可以根据问题决定是否查知识库
2. RAG 可以和其他工具组合使用
3. 可以先查知识库，再创建工单
4. 可以保留权限控制和人工确认
5. 后续可以加入更多工具形成复杂工作流
```

---

## 三、本节最终流程

第 19 课完成后的整体流程是：

```text
用户问题
  ↓
Agent LLM 判断是否需要工具
  ↓
如果需要查知识库，调用 search_knowledge_base
  ↓
search_knowledge_base 内部执行 RagQaChain
  ↓
RagQaChain 检索资料并生成知识库答案
  ↓
工具结果返回给 Agent
  ↓
Agent 基于工具结果输出最终回答
```

可以拆成三层理解：

```text
Agent：负责判断要不要调用工具
RAG Tool：负责把知识库查询暴露成工具
RagQaChain：负责检索资料并生成知识库答案
```

也就是：

```text
Agent 负责决策
Tool 负责能力封装
RAG Chain 负责知识库问答
```

---

## 四、为什么第 19 课要基于第 13 课？

第 19 课不是直接基于第 18 课复制，而是建议基于第 13 课复制。

原因是第 13 课已经有完整的 Agent 工程能力：

```text
LangGraph Agent
ToolExecutor
权限控制
Human-in-the-loop
create_ticket 工具
多用户角色测试
```

第 18 课虽然有 RAG QA Chain，但它不是 Agent。

所以第 19 课的做法是：

```text
以第 13 课的 Agent 框架为主体
再把第 18 课的 RAG 能力复制进来
最后把 RAG 包装成 search_knowledge_base 工具
```

这样可以保留之前已经完成的：

```text
工具调用
权限控制
人工确认
多轮状态
Checkpoint
```

同时让 `search_knowledge_base` 从模拟工具升级成真正的 RAG 工具。

---

## 五、本节目录结构

先复制第 13 课：

```bash
cp -r src/lessons/lesson13-tool-permission src/lessons/lesson19-rag-as-agent-tool
```

Windows PowerShell：

```powershell
Copy-Item -Recurse src/lessons/lesson13-tool-permission src/lessons/lesson19-rag-as-agent-tool
```

然后从第 18 课复制 RAG 相关目录：

```bash
cp -r src/lessons/lesson18-rag-qa-chain/documents src/lessons/lesson19-rag-as-agent-tool/documents
cp -r src/lessons/lesson18-rag-qa-chain/loader src/lessons/lesson19-rag-as-agent-tool/loader
cp -r src/lessons/lesson18-rag-qa-chain/embedding src/lessons/lesson19-rag-as-agent-tool/embedding
cp -r src/lessons/lesson18-rag-qa-chain/vector-store src/lessons/lesson19-rag-as-agent-tool/vector-store
cp -r src/lessons/lesson18-rag-qa-chain/rag src/lessons/lesson19-rag-as-agent-tool/rag
```

Windows PowerShell：

```powershell
Copy-Item -Recurse src/lessons/lesson18-rag-qa-chain/documents src/lessons/lesson19-rag-as-agent-tool/documents
Copy-Item -Recurse src/lessons/lesson18-rag-qa-chain/loader src/lessons/lesson19-rag-as-agent-tool/loader
Copy-Item -Recurse src/lessons/lesson18-rag-qa-chain/embedding src/lessons/lesson19-rag-as-agent-tool/embedding
Copy-Item -Recurse src/lessons/lesson18-rag-qa-chain/vector-store src/lessons/lesson19-rag-as-agent-tool/vector-store
Copy-Item -Recurse src/lessons/lesson18-rag-qa-chain/rag src/lessons/lesson19-rag-as-agent-tool/rag
```

最终目录结构：

```text
src/lessons/lesson19-rag-as-agent-tool/
  documents/
  loader/
  embedding/
  vector-store/
  rag/

  tools/
    search-knowledge-base.tool.ts
    create-ticket.tool.ts
    index.ts

  executor/
    tool-executor.ts

  model/
    create-model.ts

  memory/
    conversation-input.ts
    message-window.ts

  approval/
    tool-risk-policy.ts

  security/
    tool-permission-policy.ts

  graph/
    agent-state.ts
    create-agent-graph.ts

  rag-runtime.ts
  index.ts
```

这些文件直接从第 13 课或第 18 课复制即可，本节不需要修改：

```text
documents/*
loader/*
embedding/*
vector-store/*
rag/rag-context-builder.ts
rag/rag-qa-chain.ts
model/create-model.ts
executor/tool-executor.ts
memory/conversation-input.ts
memory/message-window.ts
approval/tool-risk-policy.ts
security/tool-permission-policy.ts
graph/agent-state.ts
graph/create-agent-graph.ts
tools/create-ticket.tool.ts
```

本节重点新增或修改：

```text
rag-runtime.ts
tools/search-knowledge-base.tool.ts
tools/index.ts
index.ts
package.json
```

---

## 六、配置 package.json

在 `package.json` 中新增第 19 课脚本：

```json
{
  "scripts": {
    "lesson:19": "tsx src/lessons/lesson19-rag-as-agent-tool/index.ts"
  }
}
```

运行第 19 课：

```bash
pnpm lesson:19
```

---

## 七、新增 rag-runtime.ts

文件路径：

```text
src/lessons/lesson19-rag-as-agent-tool/rag-runtime.ts
```

这个文件负责初始化第 18 课的 RAG QA Chain。

代码如下：

```ts
import path from "node:path";

import type { RagChatModel } from "./rag/rag-qa-chain.js";
import { createEmbeddingModel } from "./embedding/create-embedding-model.js";
import { embedChunks } from "./embedding/chunk-embedding.js";
import { loadMarkdownDocuments } from "./loader/markdown-loader.js";
import { splitDocumentsIntoChunks } from "./loader/text-splitter.js";
import { RagQaChain } from "./rag/rag-qa-chain.js";
import { MemoryVectorStore } from "./vector-store/memory-vector-store.js";

export type RagRuntime = {
  ragQaChain: RagQaChain;
  documentCount: number;
  chunkCount: number;
  embeddingCount: number;
};

export async function createRagRuntime(params: {
  model: RagChatModel;
}): Promise<RagRuntime> {
  const docsDir = path.resolve(
    process.cwd(),
    "src/lessons/lesson19-rag-as-agent-tool/documents",
  );

  const documents = await loadMarkdownDocuments({
    docsDir,
  });

  const chunks = splitDocumentsIntoChunks(documents, {
    maxChunkChars: 220,
    overlapChars: 40,
  });

  const embeddings = createEmbeddingModel();

  const chunkEmbeddings = await embedChunks({
    chunks,
    embeddings,
  });

  const vectorStore = new MemoryVectorStore(embeddings, chunkEmbeddings);

  const ragQaChain = new RagQaChain(params.model, vectorStore, {
    topK: 3,
    minScore: 0.3,
  });

  return {
    ragQaChain,
    documentCount: documents.length,
    chunkCount: chunks.length,
    embeddingCount: chunkEmbeddings.length,
  };
}
```

---

## 八、理解 rag-runtime.ts

第 18 课的 `index.ts` 中有一大段初始化逻辑：

```text
加载文档
切分 chunk
创建 Embedding 模型
生成 chunk embeddings
创建 Vector Store
创建 RagQaChain
```

如果直接把这些逻辑全部写进第 19 课的 `index.ts`，入口文件会变得很乱。

所以第 19 课把这段逻辑封装成：

```ts
createRagRuntime()
```

这样主入口只需要：

```ts
const ragRuntime = await createRagRuntime({
  model,
});
```

可以理解为：

```text
rag-runtime.ts = RAG 系统启动器
```

它负责把 RAG 所需的组件全部初始化好，并返回：

```text
ragQaChain
documentCount
chunkCount
embeddingCount
```

这样后面创建工具时，就可以直接使用：

```ts
ragRuntime.ragQaChain
```

---

## 九、为什么 createRagRuntime 需要传入 model？

`createRagRuntime` 的参数是：

```ts
export async function createRagRuntime(params: {
  model: RagChatModel;
}): Promise<RagRuntime>
```

原因是第 18 课的 `RagQaChain` 需要 Chat Model 来生成最终答案。

而第 19 课中，Agent 自己也需要同一个 Chat Model。

所以这里选择复用同一个 `model`：

```ts
const model = createModel();

const ragRuntime = await createRagRuntime({
  model,
});
```

这样做的好处是：

```text
1. 不需要重复创建聊天模型
2. RAG Tool 和 Agent 使用同一套模型配置
3. 后续替换模型时更方便
```

---

## 十、改造 search-knowledge-base.tool.ts

文件路径：

```text
src/lessons/lesson19-rag-as-agent-tool/tools/search-knowledge-base.tool.ts
```

第 13 课里的 `search_knowledge_base` 只是模拟数据。

第 19 课要把它改造成真正调用 `RagQaChain` 的工具。

代码如下：

```ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { RagQaChain } from "../rag/rag-qa-chain.js";

export function createSearchKnowledgeBaseTool(ragQaChain: RagQaChain) {
  return tool(
    async ({ query }) => {
      const answer = await ragQaChain.invoke(query);

      return JSON.stringify(
        {
          status: answer.searchResults.length > 0 ? "success" : "no_evidence",
          query: answer.question,
          answer: answer.answer,
          sources: answer.searchResults.map((result) => ({
            title: result.title,
            source: result.source,
            score: Number(result.score.toFixed(4)),
            contentPreview: result.contentPreview,
          })),
        },
        null,
        2,
      );
    },
    {
      name: "search_knowledge_base",
      description:
        "查询企业知识库。适用于回答企业知识库、RAG、文档接入、检索优化、Agent 工具规范、权限控制、人工确认等内部资料相关问题。",
      schema: z.object({
        query: z
          .string()
          .min(1)
          .describe("用户想要查询的知识库问题，应该保留用户原始语义。"),
      }),
    },
  );
}
```

---

## 十一、这个工具做了什么？

这个工具的核心逻辑是：

```ts
const answer = await ragQaChain.invoke(query);
```

也就是说：

```text
Agent 调用 search_knowledge_base
  ↓
search_knowledge_base 调用 RagQaChain
  ↓
RagQaChain 完成检索、构造 context、生成答案
  ↓
search_knowledge_base 把结果作为工具结果返回给 Agent
```

所以 `search_knowledge_base` 已经不再是模拟工具。

它现在是一个真正的 RAG Tool。

---

## 十二、为什么工具返回 JSON 字符串？

工具最后返回的是：

```ts
return JSON.stringify(
  {
    status: answer.searchResults.length > 0 ? "success" : "no_evidence",
    query: answer.question,
    answer: answer.answer,
    sources: answer.searchResults.map((result) => ({
      title: result.title,
      source: result.source,
      score: Number(result.score.toFixed(4)),
      contentPreview: result.contentPreview,
    })),
  },
  null,
  2,
);
```

也就是返回结构化 JSON 字符串。

原因是：

```text
工具结果越结构化，Agent 越容易理解。
```

这里包含四类信息：

```text
status：success 或 no_evidence
query：原始查询问题
answer：RAG QA Chain 生成的答案
sources：参考来源
```

如果状态是：

```text
success
```

说明知识库找到了相关资料。

如果状态是：

```text
no_evidence
```

说明当前知识库没有找到可靠依据。

Agent 拿到这个结果后，可以生成更自然的最终回答。

---

## 十三、为什么 search_knowledge_base 要用工厂函数？

第 13 课中，工具通常可以直接导出：

```ts
export const searchKnowledgeBaseTool = tool(...);
```

但第 19 课不能这样写。

因为现在的 `search_knowledge_base` 依赖：

```text
ragQaChain
```

而 `ragQaChain` 是运行时初始化出来的。

它依赖：

```text
documents
embeddings
vectorStore
chatModel
```

所以必须等 RAG 初始化完成后，才能创建工具。

因此这里改成：

```ts
export function createSearchKnowledgeBaseTool(ragQaChain: RagQaChain) {
  return tool(...);
}
```

这就是典型的工厂函数模式。

---

## 十四、改造 tools/index.ts

文件路径：

```text
src/lessons/lesson19-rag-as-agent-tool/tools/index.ts
```

第 13 课中，工具可能是静态数组：

```ts
import { createTicketTool } from "./create-ticket.tool.js";
import { searchKnowledgeBaseTool } from "./search-knowledge-base.tool.js";

export const tools = [searchKnowledgeBaseTool, createTicketTool];
```

第 19 课需要改成工厂函数：

```ts
import type { StructuredToolInterface } from "@langchain/core/tools";

import type { RagQaChain } from "../rag/rag-qa-chain.js";
import { createTicketTool } from "./create-ticket.tool.js";
import { createSearchKnowledgeBaseTool } from "./search-knowledge-base.tool.js";

export function createTools(params: {
  ragQaChain: RagQaChain;
}): StructuredToolInterface[] {
  return [
    createSearchKnowledgeBaseTool(params.ragQaChain),
    createTicketTool,
  ];
}
```

---

## 十五、为什么 tools 要从数组改成 createTools？

因为第 19 课的工具分成两类。

第一类是静态工具：

```text
create_ticket
```

它不依赖运行时初始化对象。

第二类是动态工具：

```text
search_knowledge_base
```

它依赖 `ragQaChain`。

所以不能再写成：

```ts
export const tools = [...]
```

而是要写成：

```ts
export function createTools(params: {
  ragQaChain: RagQaChain;
}) {
  return [...];
}
```

这样在 `index.ts` 中就可以：

```ts
const tools = createTools({
  ragQaChain: ragRuntime.ragQaChain,
});
```

这和 Java 后端中把 Service 注入到 Controller 或 Handler 里很像。

---

## 十六、修改 index.ts

文件路径：

```text
src/lessons/lesson19-rag-as-agent-tool/index.ts
```

这是第 19 课的入口文件。

代码如下：

```ts
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
import { createRagRuntime } from "./rag-runtime.js";
import { createTools } from "./tools/index.js";
import type {
  HumanApprovalResult,
  UserContext,
} from "./graph/agent-state.js";

const systemPrompt = `
你是一个企业 AI 知识库 / Agent Demo 助手。

规则：
1. 如果用户问的是企业知识库、RAG、文档接入、检索优化、Agent 工具规范、权限控制、人工确认等内部资料问题，优先调用 search_knowledge_base。
2. 如果用户要求创建工单、反馈问题、提交故障，调用 create_ticket。
3. 如果用户同时要求“先查询知识库，再创建工单”，必须先调用 search_knowledge_base，拿到结果后再决定是否调用 create_ticket。
4. 工具结果足够回答用户时，请停止调用工具，直接输出最终答案。
5. 不要重复使用相同参数调用同一个工具。
6. 不要编造内部系统信息，能查工具就查工具。
7. 如果工具执行失败，请基于工具错误信息给用户一个友好的解释。
8. create_ticket 属于需要人工确认的操作型工具，确认通过后才能执行。
9. 如果用户没有工具权限，请不要尝试绕过权限限制。
10. search_knowledge_base 的工具结果中如果 status 是 no_evidence，请明确说明当前知识库没有找到可靠依据。
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

const viewerUser: UserContext = {
  userId: "user-viewer-001",
  username: "viewer-user",
  roles: ["viewer"],
  department: "业务部门",
};

const supportUser: UserContext = {
  userId: "user-support-001",
  username: "support-user",
  roles: ["support"],
  department: "客服部门",
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
  userContext: UserContext;
  approval?: HumanApprovalResult;
}) {
  const config = createThreadConfig(params.threadId);

  const latestStateBeforeInvoke = await params.graph.getState(config);

  const hasHistory = hasConversationHistory(latestStateBeforeInvoke.values);

  const input = createConversationInput({
    userInput: params.userInput,
    systemPrompt,
    hasHistory,
    userContext: params.userContext,
  });

  console.log("\n\n========================================");
  console.log("thread_id：", params.threadId);
  console.log("当前用户：", params.userContext.username);
  console.log("用户角色：", params.userContext.roles.join(", "));
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

  console.log("\n========== Agent + RAG Tool 最终结果 ==========");
  console.log("当前节点：", result.currentNode);
  console.log("停止原因：", result.stopReason);
  console.log("本轮循环轮次：", result.loopCount);

  console.log("\n最终回答：");
  console.log(finalMessage?.content);

  console.log("\n权限判断结果：");
  console.log(JSON.stringify(result.permissionDecision, null, 2));

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

  const ragRuntime = await createRagRuntime({
    model,
  });

  console.log("\n========== RAG Runtime 初始化完成 ==========");
  console.log("文档数量：", ragRuntime.documentCount);
  console.log("Chunk 数量：", ragRuntime.chunkCount);
  console.log("Embedding 数量：", ragRuntime.embeddingCount);

  const tools = createTools({
    ragQaChain: ragRuntime.ragQaChain,
  });

  const modelWithTools = model.bindTools(tools) as ToolCallingModel;

  const toolExecutor = new ToolExecutor(tools);

  const checkpointer = new MemorySaver();

  const graph = createAgentGraph(modelWithTools, toolExecutor, {
    maxIterations: 6,
    checkpointer,
    memory: {
      maxRecentMessages: 10,
    },
  });

  await runConversationTurn({
    graph,
    threadId: "lesson19-viewer-rag-query",
    userContext: viewerUser,
    userInput: "知识库可以接入哪些类型的资料？",
  });

  await runConversationTurn({
    graph,
    threadId: "lesson19-viewer-rag-no-evidence",
    userContext: viewerUser,
    userInput: "接口响应很慢应该怎么排查？",
  });

  await runConversationTurn({
    graph,
    threadId: "lesson19-support-query-then-ticket",
    userContext: supportUser,
    userInput:
      "先查询知识库，看看知识库召回不准应该怎么优化，然后帮我创建一个中优先级工单。",
    approval: {
      approved: true,
      comment: "客服确认基于知识库检索结果创建工单。",
      reviewer: "support-user",
      reviewedAt: new Date().toISOString(),
    },
  });

  await runConversationTurn({
    graph,
    threadId: "lesson19-viewer-create-ticket-denied",
    userContext: viewerUser,
    userInput: "帮我创建一个高优先级工单，反馈知识库 PDF 搜不到。",
    approval: {
      approved: true,
      comment: "即使 viewer 同意，也应该因为权限不足被拦截。",
      reviewer: "viewer-user",
      reviewedAt: new Date().toISOString(),
    },
  });
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 十七、理解 index.ts 的初始化流程

第 19 课入口文件的初始化流程是：

```ts
const model = createModel();

const ragRuntime = await createRagRuntime({
  model,
});

const tools = createTools({
  ragQaChain: ragRuntime.ragQaChain,
});

const modelWithTools = model.bindTools(tools) as ToolCallingModel;

const toolExecutor = new ToolExecutor(tools);

const checkpointer = new MemorySaver();

const graph = createAgentGraph(modelWithTools, toolExecutor, {
  maxIterations: 6,
  checkpointer,
  memory: {
    maxRecentMessages: 10,
  },
});
```

可以拆成几步：

```text
1. 创建 Chat Model
2. 初始化 RAG Runtime
3. 使用 RagQaChain 创建工具列表
4. 把工具绑定到模型
5. 创建 ToolExecutor
6. 创建 LangGraph Agent
```

这一步完成后，Agent 就拥有了两个工具：

```text
search_knowledge_base
create_ticket
```

其中：

```text
search_knowledge_base：内部是真实 RAG QA Chain
create_ticket：仍然是操作型工具，需要权限和人工确认
```

---

## 十八、systemPrompt 的变化

第 19 课的系统提示词重点增加了和 RAG Tool 相关的规则：

```text
如果用户问的是企业知识库、RAG、文档接入、检索优化、Agent 工具规范、权限控制、人工确认等内部资料问题，优先调用 search_knowledge_base。
```

这条规则告诉 Agent：

```text
遇到知识库相关问题时，不要直接凭空回答，而是先调用 search_knowledge_base。
```

还增加了：

```text
search_knowledge_base 的工具结果中如果 status 是 no_evidence，请明确说明当前知识库没有找到可靠依据。
```

这条规则用于处理 RAG Tool 的拒答结果。

也就是说：

```text
RagQaChain 发现没有依据
  ↓
Tool 返回 no_evidence
  ↓
Agent 最终回答中也要说明没有可靠依据
```

---

## 十九、运行第 19 课

执行：

```bash
pnpm lesson:19
```

你会先看到：

```text
========== RAG Runtime 初始化完成 ==========
文档数量： 3
Chunk 数量： 若干
Embedding 数量： 若干
```

然后会测试 4 个场景：

```text
1. viewer 查询知识库
2. viewer 查询知识库但无资料
3. support 先查询知识库，再创建工单
4. viewer 创建工单被拒绝
```

---

## 二十、场景 1：viewer 查询知识库

输入：

```text
知识库可以接入哪些类型的资料？
```

预期流程：

```text
Agent 判断需要查知识库
  ↓
调用 search_knowledge_base
  ↓
工具内部执行 RagQaChain
  ↓
RagQaChain 检索“企业知识库支持的数据源”
  ↓
生成知识库答案和参考来源
  ↓
Agent 输出最终回答
```

viewer 用户拥有 `search_knowledge_base` 权限，所以应该正常执行。

这个场景验证的是：

```text
Agent 能否把知识库问题路由到 RAG Tool。
```

---

## 二十一、场景 2：viewer 查询知识库但无资料

输入：

```text
接口响应很慢应该怎么排查？
```

当前文档中没有接口性能排查资料。

预期流程：

```text
Agent 调用 search_knowledge_base
  ↓
RagQaChain 检索不到可靠资料
  ↓
工具返回 status: no_evidence
  ↓
Agent 告诉用户当前知识库没有找到可靠依据
```

这个场景验证的是：

```text
RAG Tool 的拒答结果能否被 Agent 正确处理。
```

企业知识库问答中，这一点很重要。

因为 Agent 不能因为用户问了问题，就一定要编造一个答案。

---

## 二十二、场景 3：support 先查询知识库，再创建工单

输入：

```text
先查询知识库，看看知识库召回不准应该怎么优化，然后帮我创建一个中优先级工单。
```

预期流程：

```text
Agent 先调用 search_knowledge_base
  ↓
RAG Tool 返回检索优化建议
  ↓
Agent 再调用 create_ticket
  ↓
create_ticket 需要人工确认
  ↓
确认通过后执行
  ↓
Agent 输出最终结果
```

这个场景把前面几课串起来了：

```text
第 12 课：人工确认
第 13 课：工具权限
第 18 课：RAG QA Chain
第 19 课：RAG 作为 Agent Tool
```

support 用户拥有创建工单权限，所以权限检查应该通过。

但 `create_ticket` 是操作型工具，所以仍然需要人工确认。

这说明：

```text
权限控制和人工确认仍然有效。
```

---

## 二十三、场景 4：viewer 创建工单被拒绝

输入：

```text
帮我创建一个高优先级工单，反馈知识库 PDF 搜不到。
```

预期流程：

```text
Agent 想调用 create_ticket
  ↓
权限检查发现 viewer 无权创建工单
  ↓
进入 permission_denied
  ↓
不会进入 human_approval
  ↓
不会执行 create_ticket
```

这个场景验证第 13 课的权限控制仍然有效。

也说明：

```text
把 RAG 接入 Agent 后，并没有破坏原来的安全机制。
```

---

## 二十四、第 19 课和第 18 课的区别

第 18 课：

```text
用户问题直接进入 RagQaChain
```

第 19 课：

```text
用户问题先进入 Agent
由 Agent 决定是否调用 RAG Tool
```

第 18 课流程：

```text
question → RagQaChain → answer
```

第 19 课流程：

```text
question → Agent → search_knowledge_base tool → RagQaChain → Agent final answer
```

所以可以这样理解：

```text
第 18 课是独立 RAG
第 19 课是 Agentic RAG
```

也就是：

```text
RAG 从一个问答链路，升级成了 Agent 的工具能力。
```

---

## 二十五、为什么要把 RAG 做成 Tool？

因为真实 Agent 不应该所有问题都先走 RAG。

例如：

```text
用户说“你好”
用户说“帮我创建工单”
用户说“总结刚才的对话”
用户说“知识库支持哪些数据源”
```

这些问题需要不同处理方式。

如果把 RAG 封装成 Tool，Agent 就可以自己判断：

```text
需要知识库资料 → 调用 search_knowledge_base
需要创建工单 → 调用 create_ticket
只是普通对话 → 不调用工具
```

这样 Agent 的能力就变得更加灵活。

RAG 不再是固定流程，而是变成了一个可组合能力。

---

## 二十六、第 19 课为什么重要？

第 19 课是前 20 课中的一个重要阶段点。

因为它第一次把两条主线合到一起：

```text
Agent 主线
RAG 主线
```

前面第 5 到第 13 课，我们主要在做 Agent：

```text
Tool Calling
ToolExecutor
Agent Loop
LangGraph
Checkpoint
Memory
Human-in-the-loop
Permission
```

第 14 到第 18 课，我们主要在做 RAG：

```text
RAG 入门
文档加载
文档切分
Embedding
Vector Store
RAG QA Chain
```

第 19 课把它们合并成：

```text
Agent + RAG = Agentic RAG
```

这也是企业 AI Agent 项目里非常常见的形态。

---

## 二十七、Java 后端视角理解

第 18 课像是一个独立服务：

```java
RagQaService.answer(question)
```

第 19 课像是把这个服务注册到工具平台：

```java
ToolRegistry.register("search_knowledge_base", ragQaService::answer)
```

然后 Agent 相当于调度层：

```java
public class AgentService {

    public String handle(String userInput) {
        ToolCall toolCall = llm.decideTool(userInput);

        ToolResult result = toolExecutor.execute(toolCall);

        return llm.generateFinalAnswer(result);
    }
}
```

所以第 19 课本质是：

```text
把知识库问答服务接入 Agent 工具体系。
```

如果用后端分层类比：

```text
RagQaChain        → KnowledgeBaseService
searchTool       → Tool Adapter
ToolExecutor     → Tool Dispatcher
createAgentGraph → Agent Orchestrator
index.ts         → Demo Application
```

---

## 二十八、企业级 Agentic RAG 的注意点

本节只是最小整合版本。

真实企业项目中，还要考虑很多问题。

### 1. RAG 初始化不能每次请求都重新执行

第 19 课中，RAG Runtime 在程序启动时初始化一次。

真实项目中也应该避免每个用户请求都重新：

```text
加载文档
切分 chunk
生成 embedding
创建 vector store
```

这些通常应该在系统启动、定时任务或文档更新时执行。

---

### 2. RAG Tool 要有权限控制

本节复用了第 13 课的权限策略。

当前策略是：

```text
viewer、support、admin 都可以使用 search_knowledge_base
support、admin 可以使用 create_ticket
```

真实企业中，知识库查询也可能需要权限。

例如：

```text
不同部门只能查自己的资料
不同项目只能查自己的文档
不同密级文档需要不同权限
```

所以 RAG Tool 后续也可以扩展数据权限过滤。

---

### 3. Tool 返回结果要结构化

第 19 课中，`search_knowledge_base` 返回 JSON 字符串。

真实项目中，工具结果最好保持结构清晰。

例如：

```json
{
  "status": "success",
  "answer": "...",
  "sources": [
    {
      "title": "...",
      "source": "...",
      "score": 0.8123
    }
  ]
}
```

这样 Agent 更容易基于工具结果继续推理。

---

### 4. Agent 可能会不按预期调用工具

虽然系统提示词写了规则，但模型仍然可能出现：

```text
该查知识库时没查
不该查时查了
重复调用同一个工具
调用工具参数不合理
```

所以真实项目中，需要结合：

```text
更清晰的工具描述
更严格的系统提示词
工具调用日志
测试用例
评估集
必要时使用规则兜底
```

---

### 5. 多工具协同会越来越复杂

第 19 课已经出现了组合场景：

```text
先查询知识库
再创建工单
```

后续工具更多时，可能会出现：

```text
先查知识库
再查用户权限
再查工单状态
再创建工单
再通知相关人员
```

这时 LangGraph 的状态管理和流程控制会变得更重要。

---

## 二十九、TypeScript Tips

### 1. 工厂函数

```ts
export function createSearchKnowledgeBaseTool(ragQaChain: RagQaChain) {
  return tool(...);
}
```

这里使用工厂函数，是因为工具需要依赖运行时对象 `ragQaChain`。

如果工具不依赖外部对象，可以直接导出常量。

如果工具依赖运行时对象，就适合使用工厂函数。

---

### 2. 依赖注入

```ts
const tools = createTools({
  ragQaChain: ragRuntime.ragQaChain,
});
```

这里相当于把 `ragQaChain` 注入到工具中。

这和 Java 中的依赖注入思想类似。

例如：

```java
public SearchKnowledgeBaseTool(RagQaService ragQaService) {
    this.ragQaService = ragQaService;
}
```

---

### 3. 结构化 JSON 返回

```ts
return JSON.stringify(
  {
    status,
    query,
    answer,
    sources,
  },
  null,
  2,
);
```

`JSON.stringify` 的第三个参数 `2` 表示格式化缩进。

这样打印出来更容易阅读。

工具结果越清晰，Agent 越容易理解。

---

### 4. 复用已有图

第 19 课没有重新写 LangGraph。

而是复用了第 13 课的：

```text
AgentState
createAgentGraph
ToolExecutor
权限控制
人工确认
```

这说明前面模块化设计是有价值的。

如果第 13 课写得很乱，第 19 课接入 RAG 会非常痛苦。

---

### 5. 动态工具列表

第 13 课中：

```ts
export const tools = [...]
```

第 19 课中：

```ts
export function createTools(params: {
  ragQaChain: RagQaChain;
}): StructuredToolInterface[] {
  return [
    createSearchKnowledgeBaseTool(params.ragQaChain),
    createTicketTool,
  ];
}
```

这是从静态工具列表升级到动态工具列表。

当工具需要依赖运行时资源时，这种写法更合适。

---

## 三十、本节总结

第 19 课完成了 Agent + RAG 的第一次整合。

核心收获：

```text
1. RAG QA Chain 可以封装成 Agent Tool
2. search_knowledge_base 不再是模拟工具，而是真正执行 RAG
3. Agent 负责判断是否调用知识库工具
4. RAG Tool 负责基于企业知识库生成答案
5. create_ticket 工具仍然保留权限控制和人工确认
6. 工具权限控制仍然适用于 RAG Tool
7. 第 19 课形成了最小 Agentic RAG
8. Agentic RAG 让 RAG 从固定链路变成 Agent 可按需调用的知识工具
```

本节最重要的一句话：

> Agentic RAG 的核心是：RAG 不再是固定链路，而是 Agent 可以按需调用的知识工具。

---

## 三十一、下一课预告

下一课进入：

# 第 20 课：混合检索，把关键词检索和向量检索结合起来

第 19 课完成的是：

```text
Agent + RAG Tool
```

第 20 课会继续增强 RAG 的检索能力。

因为单纯向量检索并不适合所有问题。

有些场景中，关键词检索反而更稳定，例如：

```text
接口编号
文件名
系统名称
错误码
订单号
专业术语
```

所以第 20 课会实现：

```text
1. 关键词检索器
2. 复用向量检索器
3. 合并两路检索结果
4. 对结果做去重
5. 做简单分数融合
6. 为后续 rerank 做准备
```

第 19 课解决的是：

```text
如何让 Agent 把 RAG 当成工具来使用？
```

第 20 课要解决的是：

```text
如何让 RAG 检索结果更稳定、更全面？
```
