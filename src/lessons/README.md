# TypeScript + LangChain.js + LangGraph.js AI Agent 实战课程

这个目录用于记录一套 AI Agent 实战课程的代码与课程规划。

课程从最小的 LLM 调用开始，逐步扩展到 Tool Calling、LangGraph 状态图、RAG 知识库、API 服务化、前端流式交互、多 Agent、Memory 和企业级 Agent 架构。整体目标不是做一组零散 demo，而是把一个 Agent 项目从脚本形态推进到更接近真实工程的形态。

## 项目定位

这套课程主要面向有后端开发经验、正在学习 AI Agent 或 TypeScript 全栈开发的人。

如果你已经理解接口、状态、权限、日志和数据结构，再学习 Agent 时会更容易抓住重点。很多时候，真正麻烦的地方不是模型调用本身，而是模型如何和工具、知识库、用户会话、权限系统以及前端页面连接起来。

## 技术栈

```text
TypeScript
LangChain.js
LangGraph.js
zod
Fastify
Server-Sent Events
RAG
Tool Calling
Memory
Trace / Evaluation
阿里云百炼 / 通义千问
```

## 目录说明

```text
src/lessons/
  lesson01-first-llm-call/
  lesson02-prompt-messages/
  lesson03-structured-output/
  ...
  lesson23-observability/
  README.md
```

每个 `lessonXX-*` 目录对应一节课程的代码。课程会尽量保持小步推进：每一课只解决一个相对明确的问题，避免把太多概念塞在一起。

## 运行方式

先安装依赖：

```bash
pnpm install
```

准备环境变量：

```bash
cp .env.example .env
```

然后在 `.env` 中填写模型服务所需配置。

运行某一节课：

```bash
pnpm lesson:01
pnpm lesson:02
pnpm lesson:23
```

当前 `package.json` 已经为第 1 到第 23 课配置了运行脚本。后续课程会继续按这个命名方式补充。

## 课程路线

### 阶段 A：LLM 基础与结构化输出

- 第 1 课：搭建 TypeScript AI 项目，接入模型并完成第一次 LLM 调用。
- 第 2 课：理解 LangChain.js 的消息模型，学习 SystemMessage、HumanMessage、AIMessage 和 Prompt 模板。
- 第 3 课：让模型输出 JSON，并用 zod 做结构化校验和异常处理。
- 第 4 课：封装 Intent Classifier，把意图识别做成可复用组件。

### 阶段 B：Tool Calling 与 Agent Loop

- 第 5 课：理解 Tool Calling，让模型返回工具调用指令。
- 第 6 课：封装 Tool Executor，统一管理工具注册、查找、执行和错误处理。
- 第 7 课：实现基础 Agent Loop，让模型调用工具并接收工具结果。

### 阶段 C：LangGraph 状态图

- 第 8 课：引入 LangGraph，用 StateGraph 改造手写 Agent Loop。
- 第 9 课：扩展 AgentState，记录节点、停止原因、工具结果和执行轨迹。
- 第 10 课：使用 Checkpoint 保存 Agent 状态，为会话恢复打基础。
- 第 11 课：实现多轮对话记忆，基于 threadId 管理会话上下文。
- 第 12 课：加入 Human-in-the-loop，在高风险工具执行前进行人工确认。
- 第 13 课：增加工具权限控制，根据 userContext 和角色拦截未授权调用。

### 阶段 D：RAG 知识库核心能力

- 第 14 课：理解 RAG 问答流程，跑通加载、切分、检索、生成的基础链路。
- 第 15 课：实现 Markdown 文档加载和 chunk 切分。
- 第 16 课：调用 Embedding 模型，将文档片段转换成向量。
- 第 17 课：实现内存版 Vector Store，用 cosine similarity 做向量检索。
- 第 18 课：实现 RAG 问答闭环，返回回答和 sources。
- 第 19 课：把 RAG 封装成 Agent Tool，让 Agent 自动调用知识库。

### 阶段 E：RAG 优化、评估与可观测性

- 第 20 课：加入关键词召回，实现 Hybrid Retrieval。
- 第 21 课：实现基础 Rerank，对召回结果进行二次排序。
- 第 22 课：构建最小 RAG 评测集，输出评估报告。
- 第 23 课：增加结构化 Trace，记录 RAG、Evaluation 和 Tool Call 的执行过程。

### 阶段 F：API 服务化与前端流式交互

- 第 24 课：用 Fastify 封装 `/health` 和 `/api/rag/ask`。
- 第 25 课：封装 `/api/chat`，接入 Agent Graph 和 threadId。
- 第 26 课：实现 `/api/chat/stream`，支持 SSE 流式输出。
- 第 27 课：创建最小 Chat UI，让页面可以调用后端 API。
- 第 28 课：前端接入流式接口，实现逐字输出体验。
- 第 29 课：在前端展示 sources、toolCalls 和 traceEvents。

### 阶段 G：多 Agent 的本质和 Demo

- 第 30 课：理解多 Agent 的工程本质，区分 Router、Supervisor、Worker 等模式。
- 第 31 课：实现最小 Router Agent，根据任务分发给不同子 Agent。
- 第 32 课：实现 Supervisor + Worker Demo，完成多步任务调度。
- 第 33 课：设计多 Agent 共享状态与消息协议。
- 第 34 课：扩展 Multi-Agent Trace，观察每个 Agent 的输入、输出和交接过程。

### 阶段 H：Memory 的记录、检索和治理

- 第 35 课：梳理 Memory 分类，包括短期记忆、长期记忆、用户偏好和任务记忆。
- 第 36 课：从对话中抽取 Memory，设计 memory extraction。
- 第 37 课：设计 Memory 写入策略，判断何时记录、忽略或更新。
- 第 38 课：实现 Memory 检索与注入，把相关记忆放回 Agent 上下文。
- 第 39 课：增加 Memory 安全与遗忘机制，支持 delete、update 和 sensitive filter。

### 阶段 I：企业级 Agent 的 7 层架构理解

- 第 40 课：总览企业级 Agent 的 7 层架构。
- 第 41 课：理解交互层，包括 Web UI、API、SSE 和多端入口。
- 第 42 课：理解编排层，包括 LangGraph、Router、Supervisor 和状态机。
- 第 43 课：理解记忆层，包括短期记忆、长期记忆、用户画像和任务状态。
- 第 44 课：理解工具层，包括 Tool Registry、权限、审批和失败重试。
- 第 45 课：理解知识层，包括 RAG、向量库、混合检索、rerank 和 evaluation。
- 第 46 课：理解安全与治理层，包括权限、审计、敏感信息和人工确认。
- 第 47 课：理解观测与评估层，包括 Trace、日志、指标、评测集和质量回归。

## 博客文章

课程说明和后续课程文章会整理到：

```text
src/blog/
```

这个目录更偏个人博客写作，会保留 frontmatter、标题、摘要、标签等信息。`src/lessons` 则主要保留仓库说明和课程代码。

