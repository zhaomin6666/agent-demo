---
title: "从零到一，规划一个 30 节课的 AI Agent 实战学习路线"
slug: "ai-agent-30-lessons-roadmap"
summary: "一个 Java 后端开发者转型 AI Agent 方向的 30 节课学习计划。从第一次 LLM 调用到 RAG 知识库、LangGraph 状态图、前后端集成、部署上线，完整记录一个企业级 AI Agent Demo 的构建过程。"
date: "2026-06-10"
updatedAt: "2026-06-10"
tags: ["AI Agent", "LangChain.js", "LangGraph", "RAG", "TypeScript", "学习计划"]
series: "TypeScript + LangChain.js + LangGraph.js AI Agent 实战"
seriesSlug: "ts-langchain-langgraph-agent"
seriesOrder: 0
status: "published"
lang: "zh"
cover: ""
seoTitle: "从零到一，规划一个 30 节课的 AI Agent 实战学习路线"
seoDescription: "一个 Java 后端开发者转型全栈 AI Agent 方向的 30 节课学习路线图，覆盖 LLM 调用、Tool Calling、LangGraph 状态图、RAG 知识库、API 服务化、前端 UI、Docker 部署和面试包装。"
---

# 从零到一，规划一个 30 节课的 AI Agent 实战学习路线

## 前言

最近 AI Agent 的讨论越来越多了。身边做后端的同事、技术社区里的文章、各种新框架的 release note，都在往这个方向靠。

我花了一段时间思考：**作为一个 Java 后端开发者，我到底要不要认真学 Agent 开发？**

想来想去，答案还是"要"。不是为了追热点，而是我确实看到了一些真实的变化——模型能力在变强、Tool Calling 在被更多框架采纳、RAG 正在成为企业落地 AI 的主流方案。这些不是概念炒作，是实实在在写代码就能感受到的东西。

但学什么、怎么学，一开始我也没太想清楚。

网上有大量碎片教程：LangChain 的官方文档、各种"10 分钟上手 Agent"的视频、GitHub 上的示例项目。问题是它们大多只覆盖了某一个点——要么只讲 LLM 调用，要么只讲 RAG，要么只讲 LangGraph。很少有东西能把整条链路串起来，从一个空项目开始，一步步走到一个可以展示、可以部署、可以在面试里讲清楚的完整项目。

所以我决定自己规划一条路线，**从第一次 LLM 调用开始，用一个 30 节课的系列，逐步完成一个企业级 AI 知识库 Agent Demo**。

这篇文章就是这份路线图的整理。写的时候我还没有开始写后面的课程，所以它更像是一个阶段性的规划——是我对"Agent 开发到底要学哪些东西"这个问题的理解和拆解。后面实际推进的时候，可能会根据情况调整，但大方向应该不会差太多。

---

## 我想要做什么样的项目

先说清楚终点，再说路线。

我想做的项目是一个 **企业级 AI 知识库助手**。它的核心能力是：

1. 接入企业内部文档，用户可以用自然语言提问，系统基于知识库回答
2. Agent 可以调用工具（查知识库、创建工单、查询状态等）
3. 高风险操作需要人工确认
4. 工具调用有权限控制
5. 支持多轮对话，记住上下文
6. 执行过程可追踪、可解释
7. 有 API 接口和前端页面
8. 能用 Docker 部署

技术栈：

- **TypeScript** — 我在转型全栈，TypeScript 是必须拿下的
- **LangChain.js** — LLM 调用、Prompt 管理、结构化输出
- **LangGraph.js** — Agent 状态图、多轮流程控制
- **阿里云百炼 / 通义千问** — 国内模型，接入方便
- **zod** — 结构化校验
- **Fastify** — API 服务
- **Docker** — 部署

---

## 路线图概览

我把 30 节课分成了七个阶段。每个阶段有一个明确的目标，课程之间有依赖关系，但不要求每个阶段内部完全线性推进。

```text
第一阶段（第 1 ~ 4 课）：LLM 基础、Prompt、结构化输出、意图识别
第二阶段（第 5 ~ 7 课）：Tool Calling、ToolExecutor、Agent Loop
第三阶段（第 8 ~ 13 课）：LangGraph、状态增强、持久化、人工确认、权限控制
第四阶段（第 14 ~ 19 课）：RAG 核心链路，从文档到 Agent Tool
第五阶段（第 20 ~ 23 课）：RAG 优化、评估、Agent 可观测性
第六阶段（第 24 ~ 27 课）：API 服务化、会话接口、前端页面、Trace 展示
第七阶段（第 28 ~ 30 课）：Docker 部署、作品集包装、面试答辩
```

下面逐阶段展开。

---

## 第一阶段：LLM 基础与结构化输出

这个阶段的目标很简单：**先跑通，再理解**。

从零搭建项目，完成第一次 LLM 调用，然后逐步学习消息模型、Prompt 模板、结构化输出。到第 4 课结束时，能有一个可用的意图识别器，为后面的 Tool Calling 打基础。

### 第 1 课：搭建 TypeScript AI 项目，完成第一次 LLM 调用

从一个空目录开始。用 pnpm 初始化项目，配置 TypeScript 环境，接入阿里云百炼的 OpenAI 兼容接口，跑通第一次 `ChatOpenAI` 调用。

这是整个系列的起点，不追求复杂，先让模型回复一句话就行。

```text
产出：lesson01-first-llm-call
```

### 第 2 课：LangChain.js 消息模型与 Prompt 基础

理解 `SystemMessage` / `HumanMessage` / `AIMessage` 三种消息角色，学习 `ChatPromptTemplate` 和模板变量。

作为 Java 后端，我会把这些概念和 Controller-Service 的参数传递做一个类比——消息对象就是请求参数，Prompt 模板就是接口的入参模板。

```text
产出：lesson02-prompt-messages
```

### 第 3 课：让大模型输出 JSON，并用 zod 做结构化校验

让模型严格返回 JSON，处理 Markdown 代码块包裹的情况，用 zod 做类型校验，最后实现一个简单的意图识别。

这一课解决的问题是：**模型的输出是自由文本，但程序需要结构化数据**。这是后面所有工程化的基础。

```text
产出：lesson03-structured-output
```

### 第 4 课：封装可复用的 Intent Classifier

把意图识别封装成一个 class，增加 `success` / `rawOutput` / `errorMessage` 状态管理，加 fallback 兜底，批量测试多个输入。

这一课的产出虽然看起来简单，但它引入了一个重要的工程化思路：**把 LLM 调用封装成可测试、可复用的组件**。后面的 Tool、Agent、RAG 都会沿用这个思路。

```text
产出：lesson04-intent-classifier
```

---

## 第二阶段：Tool Calling 与 Agent 基础

第一阶段解决的是"和模型对话"的问题。这一阶段解决的是"让模型调用工具"的问题。

这是 Agent 和普通聊天机器人的核心区别——Agent 不只是回答问题，还能执行操作。

### 第 5 课：Tool Calling 入门

理解 Tool Calling 的原理，定义 `search_knowledge_base` 和 `create_ticket` 两个工具，用 `bindTools` 绑定到模型，执行模型返回的 `tool_calls`。

这一课会有一个比较有意思的观察：去看模型请求里实际发送的 `tools` schema 是什么样的。你会意识到模型并不是"直接调用函数"，而是返回一个结构化的调用指令，由你的代码来执行。

```text
产出：lesson05-tool-calling
```

### 第 6 课：封装 Tool Executor

统一注册、查找、执行工具，处理工具不存在和执行异常的情况，记录执行日志。

这和 Java 后端的 Service 层设计很像——你需要一个统一的入口来管理所有工具的生命周期，而不是每个工具各写各的。

```text
产出：lesson06-tool-executor
```

### 第 7 课：Agent Loop 入门，开始工程化拆分

理解 Agent Loop 的核心逻辑：调用模型 → 检查是否有 tool_calls → 执行工具 → 把结果喂回模型 → 重复。设置 `maxIterations` 防止死循环。

同时开始拆分目录结构：`data` / `tools` / `executor` / `model` / `agent`。这一课还有一个比较头疼的问题：NodeNext 模块下本地 import 要加 `.js` 后缀，这对从 Java 过来的人来说需要适应一下。

```text
产出：lesson07-agent-loop
```

---

## 第三阶段：LangGraph 状态图

前两个阶段用的是手写的 for 循环实现 Agent Loop。这一阶段引入 LangGraph，把循环改造成状态图。

这个转换的意义不只是换了一个框架。状态图让 Agent 的流程变成了声明式的——每个节点做什么、条件边怎么走、状态怎么变化，都是显式定义的。这对后面加人工确认、权限控制、多轮记忆都很关键。

### 第 8 课：引入 LangGraph，把 Agent Loop 改造成状态图

安装 `@langchain/langgraph`，理解 `StateGraph` / `State` / `Node` / `Edge` 的概念，定义 `AgentState`，把 LLM 节点、Tool 节点、条件边组装起来，替换掉原来的 for 循环。

```text
产出：lesson08-langgraph-agent
```

### 第 9 课：LangGraph 状态增强，记录执行轨迹

扩展 `AgentState`，记录 `currentNode`、`stopReason`、`traceSteps`、`lastToolResult`、`maxIterationsReached`。

这一课解决的问题是：**Agent 执行完了，但你说不清楚它到底做了什么**。对调试和对用户展示来说，可追溯的执行过程都很重要。

```text
产出：lesson09-langgraph-state
```

### 第 10 课：LangGraph 持久化，使用 Checkpoint 保存 Agent 状态

理解 Checkpoint 和 `thread_id` 的概念，保存每轮状态，支持同一会话恢复。

这为多轮记忆和人工介入做好了基础——没有持久化，Agent 就是无状态的，每次对话都是全新的。

```text
产出：lesson10-langgraph-checkpoint
```

### 第 11 课：多轮对话记忆

基于 `thread_id` 实现多轮对话，让 Agent 记住上一轮的问题和回答，控制 `messages` 长度防止上下文爆炸。

这一课会区分短期记忆（当前会话）和长期记忆（跨会话），先实现短期记忆，长期记忆留到后面。

```text
产出：lesson11-conversation-memory
```

### 第 12 课：Human-in-the-loop，高风险工具调用前人工确认

区分查询型工具（比如搜索知识库）和操作型工具（比如创建工单），为 `create_ticket` 增加确认流程，设计 `pendingAction` 状态，用户确认后才执行。

这一课要回答的问题很现实：**你敢不敢让 Agent 直接操作生产环境？** 如果不敢，就需要一个确认机制。

```text
产出：lesson12-human-approval
```

### 第 13 课：工具权限控制

设计 `userContext`，为工具配置权限要求，ToolExecutor 执行前检查权限，未授权时返回友好错误，记录权限拦截日志。

和第 12 课的区别是：人工确认是"我同意你执行"，权限控制是"你有没有资格执行"。一个是流程控制，一个是访问控制。

```text
产出：lesson13-tool-permission
```

---

## 第四阶段：RAG 知识库核心能力

前三阶段搭好了 Agent 框架。这一阶段要解决的核心问题是：**Agent 怎么获取企业内部的知识？**

关键词检索太弱了，直接把文档塞给模型上下文窗口又放不下。RAG（Retrieval-Augmented Generation）是目前最主流的方案：先检索相关文档片段，再把片段作为上下文交给模型生成回答。

### 第 14 课：RAG 入门，理解企业知识库问答流程

理解 RAG 是什么，为什么企业知识库需要它，设计"加载 → 切分 → 向量化 → 检索 → 生成"的完整流程，用内存数据模拟跑通一遍。

```text
产出：lesson14-rag-introduction
```

### 第 15 课：文档加载与切分

准备 Markdown / TXT 文档，实现文档加载和文本切分，理解 `chunkSize` 和 `overlap` 参数的影响。

切分看起来简单，但它是 RAG 效果的基础——切得太粗，检索不精准；切得太细，上下文丢失。

```text
产出：lesson15-document-loader-splitter
```

### 第 16 课：Embedding 入门

理解 Embedding 的概念，调用阿里云百炼的 Embedding 接口，把文档 chunk 转成向量，理解向量维度，保存 chunk + embedding 结构。

```text
产出：lesson16-embedding
```

### 第 17 课：向量检索，实现内存版 Vector Store

实现 cosine similarity，构建内存版 Vector Store，根据用户问题检索 TopK 文档片段，输出检索结果和相似度分数。

这一课不引入外部向量数据库，先用内存实现，理解原理比用工具重要。

```text
产出：lesson17-memory-vector-store
```

### 第 18 课：RAG 问答闭环

用户问题转 embedding → 检索相关文档 chunk → 构造 RAG Prompt → 让模型基于上下文回答，同时限制模型不要编造知识库外的内容。

这一课把前面的碎片串起来了。第一次看到模型基于你提供的文档回答问题的时候，还是挺有成就感的。

```text
产出：lesson18-rag-qa-chain
```

### 第 19 课：把 RAG 封装成 Tool，接入 Agent

将 RAG 问答封装成 `search_knowledge_base` 工具，替换之前的模拟实现，让 Agent 在对话中自动调用，在 LangGraph 中运行完整的 RAG Agent。

到这里，Agent + RAG 的基本形态就完成了。

```text
产出：lesson19-rag-as-tool
```

---

## 第五阶段：RAG 优化与评估

第四阶段跑通了 RAG 链路。但"能跑"和"好用"之间还有很大的距离。这一阶段要解决的问题是：**怎么让检索更准、回答更好、效果可衡量？**

### 第 20 课：混合检索，加入关键词召回

理解纯向量检索的局限（语义相似但关键词不匹配的场景），增加关键词检索，合并两种召回结果，去重排序，对比优化前后的效果。

```text
产出：lesson20-hybrid-retrieval
```

### 第 21 课：RAG 重排序入门

理解 Rerank 的作用，设计简单的重排规则（基于标题、标签、正文匹配度），对比 TopK 结果的变化，为后续接入真实 rerank 模型做准备。

```text
产出：lesson21-rag-rerank
```

### 第 22 课：RAG 评估入门

准备测试问题集，定义期望命中文档，记录检索命中率和回答质量，输出评估报告。

没有评估的优化就是瞎调。这一课建立一套基本的评估流程，后面改什么都先跑一遍测试集。

```text
产出：lesson22-rag-evaluation
```

### 第 23 课：Agent 执行日志增强，设计可观测 Trace

统一记录 LLM 调用、Tool 调用、RAG 检索结果和每步耗时，输出完整的 Trace JSON。

这一课是 Agent 从"能用"到"可维护"的关键一步。出了问题能查，优化了能对比，而不是只能靠"感觉好像好了一点"。

```text
产出：lesson23-agent-observability
```

---

## 第六阶段：服务化与前后端集成

前五个阶段跑的都是命令行脚本。这一阶段要把 Agent 变成一个真正的服务：有 API、有前端、有会话管理。

说实话，这是我最熟悉的部分——写 API、做前后端对接，后端开发者的基本盘。但把它和 Agent 结合起来，还是会有一些新的挑战。

### 第 24 课：将 Agent 封装成 HTTP API 服务

引入 Fastify，创建 `POST /api/chat` 接口，接收 `userInput` 和 `threadId`，调用 LangGraph Agent，返回最终回答、Trace 和工具日志。

```text
产出：lesson24-agent-api-server
```

### 第 25 课：增加会话接口和历史记录查询

设计 conversation 数据结构，管理 `threadId`，查询历史消息和 Agent 执行记录，为前端页面做准备。

```text
产出：lesson25-conversation-api
```

### 第 26 课：前端 Chat UI 入门

创建简单聊天页面，输入问题、调用 API、展示回答，处理 loading 和错误状态。

前端不是我的强项，但一个能交互的 Demo 页面，比截图和 curl 输出有说服力得多。

```text
产出：lesson26-chat-ui
```

### 第 27 课：前端展示 Agent Trace

展示 Agent 的执行步骤、调用了哪些工具、RAG 检索到哪些文档、耗时和状态，做一个可解释的 Agent Demo 页面。

这一课的产出会是一个在面试里可以直接演示的东西。

```text
产出：lesson27-agent-trace-ui
```

---

## 第七阶段：部署、项目包装与求职沉淀

技术做完了，但"做完"和"能展示"之间还有距离。

最后三课解决的问题是：**怎么把这个项目变成你的竞争力，而不是 GitHub 上又一个 demo。**

### 第 28 课：Docker 部署 Agent 服务

编写 Dockerfile，配置环境变量，构建镜像，运行 Agent API 服务，为服务器部署做准备。

```text
产出：lesson28-docker-deploy
```

### 第 29 课：项目总结与作品集包装

整理项目 README、技术架构图、核心亮点，规划个人网站展示内容和博客目录。

这件事我以前不太重视，现在觉得挺重要——**你做出来的东西，别人看不到，就不存在。**

```text
产出：lesson29-project-summary-portfolio
```

### 第 30 课：面试表达与项目答辩

整理项目面试讲法，准备 3 分钟项目介绍和 10 个高频追问，整理技术难点和解决方案，写简历项目描述。

最后一课不是技术课，但它可能是整个系列里最重要的一课。**能不能把项目讲清楚，决定了这个项目在你简历上的价值。**

```text
产出：lesson30-interview-project-pitch
```

---

## 写在后面

这份路线图是我对"AI Agent 开发到底要学哪些东西"的一次拆解。

它肯定不完美。有些课可能会在实际推进中调整顺序，有些内容可能会合并或拆分。但我觉得有一个清晰的规划，比没有规划强得多。

我现在的判断是，这 30 节课大概覆盖了一个 Java 后端开发者转型 Agent 方向需要掌握的核心能力：

```text
TypeScript 工程化
LangChain.js 模型调用与 Prompt 工程
zod 结构化校验与意图识别
Tool Calling 与 ToolExecutor
Agent Loop 与 LangGraph StateGraph
Agent 状态追踪与 Checkpoint 持久化
多轮对话记忆
Human-in-the-loop 与工具权限控制
RAG 全链路（文档加载、切分、Embedding、向量检索、问答）
混合检索与 Rerank
RAG 评估
Agent 可观测 Trace
HTTP API 服务与前后端集成
Docker 部署
简历、博客、面试表达
```

接下来就按这个路线一步步推进。

每节课完成后，对应的目录下会有完整的代码和一篇详细的技术博客。如果你也在学类似的东西，可以按顺序跟，也可以直接跳到你感兴趣的阶段。

---

博客主题：**如何把 AI Agent Demo 讲成一个有工程价值的项目**
