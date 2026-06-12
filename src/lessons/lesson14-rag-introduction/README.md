# 第 14 课：RAG 入门，理解企业知识库问答流程

## 前言

前面几节课，我们已经完成了一个企业级 Agent Demo 的基础能力。

第 5 课学习了 Tool Calling，让模型可以根据用户意图选择工具。

第 6 课封装了 `ToolExecutor`，统一处理工具查找、执行、异常和日志。

第 7 课实现了手写版 `Agent Loop`，让模型可以多轮调用工具完成任务。

第 8 课引入 LangGraph，把手写循环改造成状态图。

第 9 课增强了 `AgentState`，记录执行轨迹、停止原因、当前节点和工具结果。

第 10 课引入 Checkpoint，通过 `MemorySaver + thread_id` 保存和恢复状态。

第 11 课整理了多轮对话记忆，避免重复追加 `SystemMessage`，并控制消息窗口。

第 12 课实现了 Human-in-the-loop，让高风险操作在执行前需要人工确认。

第 13 课实现了工具权限控制，让不同用户角色拥有不同工具执行权限。

从第 14 课开始，我们正式进入新的阶段：

> RAG，也就是企业知识库问答。

前面课程解决的是：

```text
Agent 如何调用工具？
Agent 如何保存状态？
Agent 如何控制权限？
Agent 如何让人参与确认？
```

从这一课开始，要解决的是：

```text
Agent 如何从企业知识库中找到可靠资料，再基于资料回答用户？
```

---

## 一、本节目标

本节是 RAG 入门课，先不接真实向量库，也不接真实 Embedding。

这一课先用一个内存版 Demo 理解 RAG 的完整流程。

本节主要完成：

```text
1. 理解 RAG 是什么
2. 理解企业知识库为什么需要 RAG
3. 理解 RAG 的五个核心步骤
4. 用内存数组模拟企业知识库文档
5. 用关键词打分模拟检索
6. 把检索结果拼接成 context
7. 把 context 交给模型生成答案
8. 区分 Tool Calling 和 RAG
```

本节重点不是检索效果，而是理解流程。

真正的文档加载、切分、Embedding、向量检索，会在后续课程中逐步实现。

---

## 二、什么是 RAG？

RAG 全称是：

```text
Retrieval-Augmented Generation
```

中文一般叫：

```text
检索增强生成
```

可以简单理解为：

> 先检索资料，再让模型基于资料生成答案。

如果不使用 RAG，用户问企业内部问题时，模型只能依赖自己的参数知识。

这会有几个问题：

```text
1. 模型不知道企业内部最新资料
2. 模型可能编造不存在的制度、接口或流程
3. 企业文档经常变化，模型参数不会实时更新
4. 答案缺少依据，不方便追溯来源
5. 不同项目、部门、系统之间存在知识边界
```

RAG 的思路是：

```text
用户问题
  ↓
从企业知识库检索相关资料
  ↓
把资料作为上下文交给模型
  ↓
模型基于上下文回答
```

这样模型回答时，不是凭空发挥，而是先看资料，再组织答案。

---

## 三、RAG 的完整链路

一个典型的 RAG 流程可以分成五步：

```text
Load
  ↓
Split
  ↓
Embed
  ↓
Retrieve
  ↓
Generate
```

对应中文理解是：

```text
1. Load：加载文档
2. Split：切分文档
3. Embed：生成向量
4. Retrieve：检索相关片段
5. Generate：基于上下文生成答案
```

在真实企业知识库中，原始资料可能来自：

```text
Markdown 文档
PDF 文档
Word 文档
网页 URL
内部 FAQ
接口文档
项目需求文档
工单系统
数据库表
代码仓库说明文档
```

这些资料不能直接全部塞给模型。

更合理的方式是：

```text
先处理成文档片段
再建立检索能力
用户提问时只取最相关的片段
最后让模型基于片段回答
```

---

## 四、为什么企业知识库需要 RAG？

企业知识库场景非常适合 RAG。

比如用户问：

```text
我们的知识库支持哪些数据源？
```

或者：

```text
RAG 检索效果不好应该怎么优化？
```

或者：

```text
viewer 用户可以创建工单吗？
```

这些问题都不适合让模型凭空回答。

因为它们依赖企业内部规则。

企业知识库问答需要满足：

```text
1. 回答要基于内部资料
2. 答案要能追溯来源
3. 没有资料时不能编造
4. 支持内部文档更新
5. 支持不同系统、项目、角色的知识边界
```

所以 RAG 的价值就是：

> 把大模型的表达能力，和企业内部资料的准确性结合起来。

---

## 五、本节实现思路

这一课先做一个最小版本 RAG。

暂时不用真实向量检索，而是用关键词匹配模拟检索。

整体流程是：

```text
用户问题
  ↓
SimpleRetriever 检索内存文档
  ↓
ContextBuilder 拼接资料上下文
  ↓
RagChain 调用模型
  ↓
模型基于资料生成答案
```

这一课的几个核心模块是：

```text
enterprise-docs.ts：模拟企业知识库文档
simple-retriever.ts：模拟检索器
context-builder.ts：构造上下文
rag-chain.ts：串联检索和生成
index.ts：运行测试问题
```

---

## 六、本节目录结构

新建第 14 课目录：

```bash
mkdir -p src/lessons/lesson14-rag-introduction/{data,rag,model}
```

最终目录结构：

```text
src/lessons/lesson14-rag-introduction/
  data/
    enterprise-docs.ts

  rag/
    simple-retriever.ts
    context-builder.ts
    rag-chain.ts

  model/
    create-model.ts

  index.ts
```

其中：

```text
model/create-model.ts
```

直接从第 13 课复制即可，不需要重新写。

复制命令：

```bash
cp src/lessons/lesson13-tool-permission/model/create-model.ts src/lessons/lesson14-rag-introduction/model/create-model.ts
```

Windows PowerShell：

```powershell
Copy-Item src/lessons/lesson13-tool-permission/model/create-model.ts src/lessons/lesson14-rag-introduction/model/create-model.ts
```

---

## 七、配置 package.json

在 `package.json` 中新增第 14 课脚本：

```json
{
  "scripts": {
    "lesson:14": "tsx src/lessons/lesson14-rag-introduction/index.ts"
  }
}
```

保留前面已有的 `lesson:01` 到 `lesson:13`，这里只需要新增这一行。

运行第 14 课：

```bash
pnpm lesson:14
```

---

## 八、新增 enterprise-docs.ts

文件路径：

```text
src/lessons/lesson14-rag-introduction/data/enterprise-docs.ts
```

这一课先用内存数组模拟企业知识库。

代码如下：

```ts
export type EnterpriseDoc = {
  id: string;
  title: string;
  content: string;
  source: string;
  tags: string[];
};

export const enterpriseDocs: EnterpriseDoc[] = [
  {
    id: "doc-001",
    title: "企业知识库支持的数据源",
    content:
      "企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源。后续计划扩展数据库表、工单系统数据和接口文档。",
    source: "knowledge-base-guide.md",
    tags: ["knowledge_base", "datasource", "rag"],
  },
  {
    id: "doc-002",
    title: "RAG 检索效果不好怎么办",
    content:
      "如果 RAG 检索效果不好，可以从文档切分、Embedding 模型、召回数量、关键词补充、重排序、Prompt 约束等方面优化。",
    source: "rag-optimization.md",
    tags: ["knowledge_base", "rag", "retrieval"],
  },
  {
    id: "doc-003",
    title: "Agent 工具调用规范",
    content:
      "Agent 调用工具前应先判断用户意图。工具入参必须通过 schema 校验。工具执行失败时需要有兜底响应。操作型工具应结合权限控制和人工确认。",
    source: "agent-tool-policy.md",
    tags: ["agent", "tool_calling", "security"],
  },
  {
    id: "doc-004",
    title: "工单创建权限说明",
    content:
      "viewer 用户只能查询知识库，不能创建工单。support 和 admin 用户可以创建工单，但创建工单前仍然需要经过人工确认。",
    source: "ticket-permission.md",
    tags: ["permission", "ticket", "security"],
  },
  {
    id: "doc-005",
    title: "企业知识库回答规范",
    content:
      "知识库问答必须优先基于检索到的资料回答。如果资料中没有相关内容，应明确说明当前知识库中没有找到可靠依据，不能编造答案。",
    source: "answer-policy.md",
    tags: ["rag", "answer_policy"],
  },
];
```

这个文件相当于一个简化版知识库。

每个文档包含：

```text
id：文档唯一标识
title：文档标题
content：文档内容
source：资料来源
tags：标签
```

后面真实 RAG 会把这些内存数组替换成文档加载、切分、向量存储和检索结果。

---

## 九、新增 simple-retriever.ts

文件路径：

```text
src/lessons/lesson14-rag-introduction/rag/simple-retriever.ts
```

这一课先不用向量检索，而是用关键词打分模拟 Retriever。

代码如下：

```ts
import type { EnterpriseDoc } from "../data/enterprise-docs.js";

export type RetrievedDoc = EnterpriseDoc & {
  score: number;
  matchedKeywords: string[];
};

export type SimpleRetrieverOptions = {
  topK: number;
};

export class SimpleRetriever {
  constructor(
    private readonly docs: EnterpriseDoc[],
    private readonly options: SimpleRetrieverOptions,
  ) {}

  retrieve(query: string): RetrievedDoc[] {
    const keywords = this.extractKeywords(query);

    const scoredDocs = this.docs
      .map((doc) => {
        const matchedKeywords = keywords.filter((keyword) =>
          this.isKeywordMatched(doc, keyword),
        );

        return {
          ...doc,
          score: matchedKeywords.length,
          matchedKeywords,
        };
      })
      .filter((doc) => doc.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, this.options.topK);

    return scoredDocs;
  }

  private extractKeywords(query: string): string[] {
    return query
      .toLowerCase()
      .split(/[\s,，。？?、]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private isKeywordMatched(doc: EnterpriseDoc, keyword: string): boolean {
    const searchableText = [
      doc.title,
      doc.content,
      doc.source,
      ...doc.tags,
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(keyword);
  }
}
```

---

## 十、理解 SimpleRetriever

`SimpleRetriever` 的职责是：

```text
根据用户问题，从文档列表里找出相关文档。
```

它的核心方法是：

```ts
retrieve(query: string): RetrievedDoc[]
```

执行流程是：

```text
1. 提取用户问题中的关键词
2. 遍历所有文档
3. 判断每个关键词是否出现在标题、内容、来源或标签里
4. 统计命中的关键词数量作为 score
5. 过滤掉 score = 0 的文档
6. 按 score 从高到低排序
7. 取前 topK 条结果
```

这不是最终的企业级检索方案。

它只是为了帮助我们理解：

> Retriever 的职责是接收用户问题，返回相关资料。

后续第 16、17 课会把这里升级成 Embedding + Vector Store 的向量检索。

---

## 十一、新增 context-builder.ts

文件路径：

```text
src/lessons/lesson14-rag-introduction/rag/context-builder.ts
```

这个文件负责把检索到的文档拼成模型可以理解的上下文。

代码如下：

```ts
import type { RetrievedDoc } from "./simple-retriever.js";

export function buildRagContext(docs: RetrievedDoc[]): string {
  if (docs.length === 0) {
    return "当前知识库中没有检索到相关资料。";
  }

  return docs
    .map((doc, index) => {
      return [
        `资料 ${index + 1}`,
        `标题：${doc.title}`,
        `来源：${doc.source}`,
        `匹配关键词：${doc.matchedKeywords.join(", ") || "无"}`,
        `内容：${doc.content}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}
```

如果检索到了资料，拼接后的 context 大概是：

```text
资料 1
标题：RAG 检索效果不好怎么办
来源：rag-optimization.md
匹配关键词：rag, 检索
内容：如果 RAG 检索效果不好，可以从文档切分、Embedding 模型、召回数量、关键词补充、重排序、Prompt 约束等方面优化。
```

如果没有检索到资料，则返回：

```text
当前知识库中没有检索到相关资料。
```

这样模型就能知道：

```text
当前没有可用依据，不应该编造答案。
```

---

## 十二、新增 rag-chain.ts

文件路径：

```text
src/lessons/lesson14-rag-introduction/rag/rag-chain.ts
```

这个文件负责完整 RAG 问答流程：

```text
用户问题
  ↓
Retriever 检索资料
  ↓
ContextBuilder 构造上下文
  ↓
模型基于上下文回答
```

代码如下：

```ts
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { buildRagContext } from "./context-builder.js";
import type { SimpleRetriever } from "./simple-retriever.js";

export type RagAnswer = {
  question: string;
  answer: string;
  context: string;
  retrievedDocs: {
    id: string;
    title: string;
    source: string;
    score: number;
    matchedKeywords: string[];
  }[];
};

export type RagModel = {
  invoke(messages: Array<SystemMessage | HumanMessage>): Promise<{
    content: unknown;
  }>;
};

export class RagChain {
  constructor(
    private readonly model: RagModel,
    private readonly retriever: SimpleRetriever,
  ) {}

  async invoke(question: string): Promise<RagAnswer> {
    const retrievedDocs = this.retriever.retrieve(question);

    const context = buildRagContext(retrievedDocs);

    const response = await this.model.invoke([
      new SystemMessage(`
你是一个企业知识库问答助手。

回答规则：
1. 必须优先基于【资料上下文】回答。
2. 如果资料上下文中没有相关信息，请明确说“当前知识库中没有找到可靠依据”。
3. 不要编造企业内部制度、系统能力、接口说明。
4. 回答要简洁、清晰，适合企业内部用户阅读。
5. 如果资料中包含来源，请在回答最后简单列出参考来源。
`),
      new HumanMessage(`
【用户问题】
${question}

【资料上下文】
${context}
`),
    ]);

    return {
      question,
      answer: String(response.content),
      context,
      retrievedDocs: retrievedDocs.map((doc) => ({
        id: doc.id,
        title: doc.title,
        source: doc.source,
        score: doc.score,
        matchedKeywords: doc.matchedKeywords,
      })),
    };
  }
}
```

---

## 十三、理解 RagChain

`RagChain` 把检索和生成串起来。

它的核心流程是：

```ts
const retrievedDocs = this.retriever.retrieve(question);

const context = buildRagContext(retrievedDocs);

const response = await this.model.invoke([...]);
```

对应业务流程：

```text
先查资料
再拼上下文
最后问模型
```

这里最重要的是 Prompt 规则：

```text
如果资料上下文中没有相关信息，请明确说“当前知识库中没有找到可靠依据”。
```

这个约束非常重要。

因为 RAG 的目标不是让模型随便回答，而是：

```text
有依据时回答
没有依据时说明没有找到可靠依据
```

这可以有效减少企业知识库问答中的幻觉问题。

---

## 十四、编写 index.ts

文件路径：

```text
src/lessons/lesson14-rag-introduction/index.ts
```

代码如下：

```ts
import { enterpriseDocs } from "./data/enterprise-docs.js";
import { createModel } from "./model/create-model.js";
import { RagChain } from "./rag/rag-chain.js";
import { SimpleRetriever } from "./rag/simple-retriever.js";

async function main() {
  const model = createModel();

  const retriever = new SimpleRetriever(enterpriseDocs, {
    topK: 3,
  });

  const ragChain = new RagChain(model, retriever);

  const questions = [
    "企业知识库支持哪些数据源？",
    "RAG 检索效果不好应该怎么优化？",
    "viewer 用户可以创建工单吗？",
    "企业知识库支持自动生成财务报表吗？",
  ];

  for (const question of questions) {
    console.log("\n\n========================================");
    console.log("用户问题：", question);

    const result = await ragChain.invoke(question);

    console.log("\n========== 检索到的资料 ==========");
    console.log(JSON.stringify(result.retrievedDocs, null, 2));

    console.log("\n========== 拼接后的上下文 ==========");
    console.log(result.context);

    console.log("\n========== RAG 最终回答 ==========");
    console.log(result.answer);
  }
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 十五、运行第 14 课

执行：

```bash
pnpm lesson:14
```

本节会测试四个问题：

```text
1. 企业知识库支持哪些数据源？
2. RAG 检索效果不好应该怎么优化？
3. viewer 用户可以创建工单吗？
4. 企业知识库支持自动生成财务报表吗？
```

---

## 十六、问题 1：企业知识库支持哪些数据源？

问题：

```text
企业知识库支持哪些数据源？
```

预期命中：

```text
企业知识库支持的数据源
```

资料内容中写了：

```text
企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源。
```

所以模型应该回答类似：

```text
企业知识库当前支持 Markdown、PDF、Word、网页 URL、内部 FAQ 文档等数据源，后续计划扩展数据库表、工单系统数据和接口文档。
```

---

## 十七、问题 2：RAG 检索效果不好应该怎么优化？

问题：

```text
RAG 检索效果不好应该怎么优化？
```

预期命中：

```text
RAG 检索效果不好怎么办
```

资料内容中写了：

```text
可以从文档切分、Embedding 模型、召回数量、关键词补充、重排序、Prompt 约束等方面优化。
```

所以模型应该基于这些资料回答。

---

## 十八、问题 3：viewer 用户可以创建工单吗？

问题：

```text
viewer 用户可以创建工单吗？
```

预期命中：

```text
工单创建权限说明
```

资料内容中写了：

```text
viewer 用户只能查询知识库，不能创建工单。
support 和 admin 用户可以创建工单，但创建工单前仍然需要经过人工确认。
```

所以模型应该回答：

```text
viewer 用户不能创建工单，只能查询知识库。
```

这也和第 13 课的权限控制逻辑对应起来了。

---

## 十九、问题 4：企业知识库支持自动生成财务报表吗？

问题：

```text
企业知识库支持自动生成财务报表吗？
```

当前资料中没有明确说明这个能力。

根据 Prompt 规则，模型应该倾向回答：

```text
当前知识库中没有找到可靠依据。
```

这就是 RAG 的一个重要价值：

```text
知道什么可以回答
不知道什么应该拒答
```

企业知识库问答不能为了显得聪明而编造答案。

---

## 二十、RAG 和 Tool Calling 的区别

你现在已经学过 Tool Calling，也开始学 RAG。

这两个东西经常一起出现，但它们不是一回事。

---

### 1. Tool Calling 关注动作

Tool Calling 关注的是：

```text
模型要不要调用某个工具？
```

例如：

```text
search_knowledge_base
create_ticket
check_permission
send_email
query_order
```

它的重点是：

```text
动作选择
参数提取
工具执行
结果回传
```

第 5 到第 13 课，主要都在围绕 Tool Calling 和 Agent 工具执行能力展开。

---

### 2. RAG 关注知识

RAG 关注的是：

```text
如何从外部知识中找资料，再基于资料回答？
```

它的重点是：

```text
文档处理
检索
上下文构造
基于资料生成答案
```

第 14 课开始，我们进入的就是这个方向。

---

### 3. 二者如何结合？

后续第 19 课会把 RAG 封装成 Tool。

也就是：

```text
search_knowledge_base = RAG Tool
```

到那时，流程会变成：

```text
用户问题
  ↓
Agent 判断是否需要查询知识库
  ↓
通过 Tool Calling 调用 search_knowledge_base
  ↓
search_knowledge_base 内部执行 RAG
  ↓
返回知识库答案
  ↓
Agent 基于工具结果继续回答
```

可以简单理解为：

```text
Tool Calling 是 Agent 的动作系统
RAG 是知识库问答系统
```

二者结合后，Agent 才能既会行动，又能基于企业资料回答问题。

---

## 二十一、本节和后续课程的关系

第 14 课只是 RAG 入门。

本节目前做的是：

```text
内存文档
关键词检索
手动拼 context
模型生成答案
```

后续会逐步升级。

### 第 15 课：文档加载与切分

把 Markdown、TXT 等文档加载进来，再切成 chunk。

### 第 16 课：Embedding 入门

把文本转换成向量。

### 第 17 课：内存版 Vector Store

实现基于向量相似度的检索。

### 第 18 课：RAG 问答闭环

把 Embedding、Vector Store、Retriever、Prompt 串成更完整的 RAG QA Chain。

### 第 19 课：把 RAG 封装成 Tool，接入现有 Agent

让 Agent 真正使用 RAG 知识库。

---

## 二十二、Java 后端视角理解

可以把 RAG 理解成一个后端查询服务。

普通业务查询可能是：

```text
Controller
  ↓
Service
  ↓
Repository
  ↓
Database
  ↓
返回业务数据
```

RAG 查询可以类比成：

```text
User Question
  ↓
Retriever
  ↓
Knowledge Documents
  ↓
Context Builder
  ↓
LLM
  ↓
Answer
```

如果用 Java 类比，大概是：

```java
public class RagService {

    public RagAnswer answer(String question) {
        List<Document> docs = retriever.retrieve(question);

        String context = contextBuilder.build(docs);

        return llm.generate(question, context);
    }
}
```

所以 RAG 不是魔法。

它本质上是：

```text
检索系统 + Prompt 组装 + 大模型生成
```

---

## 二十三、企业级 RAG 的关键点

真实企业项目中，RAG 不只是把文档扔给模型。

它还需要考虑很多工程问题。

### 1. 文档来源

企业资料可能来自：

```text
项目文档
接口文档
需求文档
PDF
Word
Markdown
网页
数据库
工单系统
代码仓库
```

不同来源需要不同加载方式。

---

### 2. 文档切分

文档太长，不能直接整体送给模型。

需要切成 chunk。

切分时要考虑：

```text
按段落切
按标题切
按 token 长度切
保留上下文重叠
保留文档元信息
```

---

### 3. 检索效果

检索效果不好会直接影响最终答案。

常见优化方向包括：

```text
文档切分
Embedding 模型
召回数量
关键词补充
混合检索
重排序
Prompt 约束
```

这些会在后续课程逐步展开。

---

### 4. 答案可信度

企业 RAG 系统必须控制幻觉。

常见要求是：

```text
没有资料就说明没有找到依据
回答中带来源
不要编造内部系统能力
不要越权引用资料
```

---

## 二十四、TypeScript Tips

### 1. 类构造函数参数属性

```ts
constructor(
  private readonly model: RagModel,
  private readonly retriever: SimpleRetriever,
) {}
```

这是 TypeScript 的简写。

等价于：

```ts
private readonly model: RagModel;
private readonly retriever: SimpleRetriever;

constructor(model: RagModel, retriever: SimpleRetriever) {
  this.model = model;
  this.retriever = retriever;
}
```

这个写法在 TS 项目里很常见。

---

### 2. 交叉类型

```ts
export type RetrievedDoc = EnterpriseDoc & {
  score: number;
  matchedKeywords: string[];
};
```

意思是：

```text
RetrievedDoc 拥有 EnterpriseDoc 的所有字段
同时额外增加 score 和 matchedKeywords
```

类似 Java 中对对象做增强包装。

---

### 3. map + filter + sort + slice

```ts
const scoredDocs = this.docs
  .map(...)
  .filter(...)
  .sort(...)
  .slice(0, this.options.topK);
```

这是 TS/JS 中常见的数据处理链。

可以类比 Java Stream：

```java
docs.stream()
    .map(...)
    .filter(...)
    .sorted(...)
    .limit(topK)
    .toList();
```

---

### 4. 正则 split

```ts
.split(/[\s,，。？?、]+/)
```

这里用正则把用户问题按空格、英文逗号、中文逗号、句号、问号、顿号等符号切分。

例如：

```text
RAG 检索效果不好，应该怎么优化？
```

会被切成多个关键词。

这个关键词切分很粗糙，但适合理解流程。

---

### 5. `filter(Boolean)`

```ts
.filter(Boolean)
```

用于过滤掉空字符串。

例如：

```ts
["rag", "", "检索"].filter(Boolean)
```

结果是：

```text
["rag", "检索"]
```

---

## 二十五、本节总结

第 14 课完成了 RAG 入门。

核心收获：

```text
1. RAG 是检索增强生成
2. 企业知识库适合用 RAG 做问答
3. RAG 的核心流程是 Load、Split、Embed、Retrieve、Generate
4. 本节用内存文档模拟企业知识库
5. 本节用关键词打分模拟 Retriever
6. Context Builder 负责把检索结果拼成模型上下文
7. RagChain 负责检索、构造上下文、调用模型生成答案
8. RAG 和 Tool Calling 不是一回事，但后面可以结合
9. 企业 RAG 系统应该基于资料回答，没有资料时说明没有依据
```

本节最重要的一句话：

> RAG 的核心不是让模型背知识，而是让模型先看资料，再基于资料回答。

---

## 二十六、下一课预告

下一课进入：

# 第 15 课：文档加载与切分，构建知识库原始数据处理流程

第 15 课会把本节的“内存文档数组”升级成更真实的文档处理流程。

主要学习：

```text
1. 准备本地 Markdown 文档
2. 读取 docs 目录
3. 解析文档元信息
4. 按段落切分文本
5. 生成 chunk 列表
6. 为后续 Embedding 做准备
```

第 14 课解决的是：

```text
RAG 的整体流程是什么？
```

第 15 课要开始解决：

```text
企业原始文档如何进入知识库？
```
