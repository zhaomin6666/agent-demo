---
title: "我想怎样系统学习 AI Agent 开发"
slug: "ts-langchain-langgraph-ai-agent-course-roadmap"
summary: "这篇文章整理了一套 TypeScript + LangChain.js + LangGraph.js 的 AI Agent 实战课程路线，从 LLM 调用、Tool Calling、RAG、API 服务化、多 Agent、Memory 到企业级 Agent 架构。"
date: "2026-06-18"
updatedAt: "2026-06-18"
tags: ["AI Agent", "LangChain.js", "LangGraph", "RAG", "TypeScript", "学习路线"]
series: "TypeScript + LangChain.js + LangGraph.js AI Agent 实战"
seriesSlug: "ts-langchain-langgraph-agent"
seriesOrder: 0
status: "published"
lang: "zh"
cover: ""
seoTitle: "我想怎样系统学习 AI Agent 开发"
seoDescription: "一篇面向 AI Agent 学习路线的课程说明，记录如何从 TypeScript、LangChain.js、LangGraph.js、Tool Calling、RAG、API 服务化、多 Agent 和 Memory 建立完整的 Agent 工程化理解。"
---

# 我想怎样系统学习 AI Agent 开发

最近我一直在想一个问题：如果一个 Java 后端开发者想认真学习 AI Agent 开发，到底应该从哪里开始？

不是看几个框架示例，也不是只跑通一次大模型调用。那些东西当然有用，但很容易停在“我知道这个概念”的层面。真正写项目时，问题会很快变成另一种样子：模型输出不稳定怎么办，工具调用失败怎么办，知识库检索不到资料怎么办，多轮会话状态放在哪里，前端怎么展示 Agent 的执行过程。

所以我更想把这套课程设计成一条工程路线。

它从一个空的 TypeScript 项目开始，慢慢扩展到 Tool Calling、LangGraph、RAG、API 服务化、前端流式交互、多 Agent、Memory，最后再回到企业级 Agent 的整体架构。

这篇文章就是这条路线的整理。

## 为什么不是只做一个简单 Demo

很多 Agent 教程会从一个很短的例子开始：定义一个工具，让模型调用它，然后输出结果。

这种例子适合入门，但问题也很明显。它往往不会处理真实项目里更麻烦的部分。

比如：

```text
模型返回的 JSON 不合法怎么办？
工具不存在或者执行失败怎么办？
用户没有权限调用某个工具怎么办？
RAG 检索结果不准，应该怎么评估？
Agent 执行了很多步，怎么知道它哪里出错？
前端只看到最终答案，怎么展示 sources 和 trace？
Memory 该记什么，不该记什么？
多 Agent 是真的有必要，还是只是把系统搞复杂了？
```

这些问题看起来没有“模型能力”那么显眼，但真正做工程时，它们会很快冒出来。

我想做的不是一个只在命令行里跑通的 demo，而是一个能逐步解释这些问题的项目。它可以先很小，但每一步都要能说清楚：这一课解决了什么工程问题，为什么需要这个能力，后面会怎样继续扩展。

## 这套课程适合谁

这套路线更适合已经有一些开发经验的人。

尤其是写过后端服务的人，会更容易理解这里面的很多设计：接口、状态、权限、日志、异常处理、数据结构、服务封装。这些经验放到 Agent 开发里并不会过时，反而会变得更重要。

如果你正在从 Java 后端转向 AI Agent 或全栈方向，这条路线应该会比较顺手。TypeScript 会承担前后端和 Agent 工程之间的连接角色，LangChain.js 和 LangGraph.js 则用来处理模型调用、工具绑定、状态图和会话流程。

如果你已经学过一点 LangChain 或 RAG，但不知道怎么把它们串成一个完整项目，也可以顺着这套课程重新梳理一遍。

## 最终想做成什么样

课程会围绕一个企业级 AI 知识库 Agent Demo 展开。

大致形态是：

```text
用户
  ↓
前端 Chat 页面
  ↓
HTTP / SSE API
  ↓
Agent Graph / Multi-Agent Orchestration
  ↓
Tool Executor / RAG / Memory
  ↓
Trace / Evaluation / Governance
```

这个项目不只是一个聊天页面。它会逐步具备这些能力：

```text
调用大模型并管理 Prompt
让模型输出结构化数据
支持 Tool Calling 和工具执行
使用 LangGraph 管理 Agent 状态
支持多轮对话、人工确认和权限控制
接入 RAG 知识库问答
支持混合检索、重排序和评估
提供 HTTP API 和 SSE 流式输出
提供前端 Chat UI 和 Trace 展示
理解多 Agent、Memory 和企业级 Agent 分层架构
```

我希望它最后能成为一个比较完整的学习样本：既能看到代码怎么写，也能看到每个能力为什么要这样拆。

## 课程路线

整套课程分成九个阶段，共 47 课。为了方便阅读，这里用一行一课的方式列出来。

### 阶段 A：LLM 基础与结构化输出

- 第 1 课：搭建 TypeScript AI 项目，接入模型并完成第一次 LLM 调用。
- 第 2 课：理解 LangChain.js 的消息模型，学习 SystemMessage、HumanMessage、AIMessage 和 Prompt 模板。
- 第 3 课：让模型输出 JSON，并用 zod 做结构化校验和异常处理。
- 第 4 课：封装 Intent Classifier，把意图识别做成可复用组件。

这个阶段先不急着做 Agent。模型调用、Prompt 组装、结构化输出和 zod 校验，是后面所有课程的基础。

### 阶段 B：Tool Calling 与 Agent Loop

- 第 5 课：理解 Tool Calling，让模型返回工具调用指令。
- 第 6 课：封装 Tool Executor，统一管理工具注册、查找、执行和错误处理。
- 第 7 课：实现基础 Agent Loop，让模型调用工具并接收工具结果。

这里开始进入 Agent 的核心。模型并不会真的执行函数，它只是返回一个工具调用意图，真正执行工具的是我们的程序。

### 阶段 C：LangGraph 状态图

- 第 8 课：引入 LangGraph，用 StateGraph 改造手写 Agent Loop。
- 第 9 课：扩展 AgentState，记录节点、停止原因、工具结果和执行轨迹。
- 第 10 课：使用 Checkpoint 保存 Agent 状态，为会话恢复打基础。
- 第 11 课：实现多轮对话记忆，基于 threadId 管理会话上下文。
- 第 12 课：加入 Human-in-the-loop，在高风险工具执行前进行人工确认。
- 第 13 课：增加工具权限控制，根据 userContext 和角色拦截未授权调用。

手写循环适合理解原理，但状态、权限、人工确认、多轮对话这些能力一加进来，流程会很快变复杂。LangGraph 的价值就在这里：把 Agent 的执行过程显式拆成状态、节点和边。

### 阶段 D：RAG 知识库核心能力

- 第 14 课：理解 RAG 问答流程，跑通加载、切分、检索、生成的基础链路。
- 第 15 课：实现 Markdown 文档加载和 chunk 切分。
- 第 16 课：调用 Embedding 模型，将文档片段转换成向量。
- 第 17 课：实现内存版 Vector Store，用 cosine similarity 做向量检索。
- 第 18 课：实现 RAG 问答闭环，返回回答和 sources。
- 第 19 课：把 RAG 封装成 Agent Tool，让 Agent 自动调用知识库。

Agent 如果只依赖模型自己的通用知识，很难用于企业内部场景。RAG 让它可以围绕项目文档、业务资料和知识库回答问题。

### 阶段 E：RAG 优化、评估与可观测性

- 第 20 课：加入关键词召回，实现 Hybrid Retrieval。
- 第 21 课：实现基础 Rerank，对召回结果进行二次排序。
- 第 22 课：构建最小 RAG 评测集，输出评估报告。
- 第 23 课：增加结构化 Trace，记录 RAG、Evaluation 和 Tool Call 的执行过程。

RAG 跑通只是第一步。检索是否命中正确资料、回答是否引用可靠来源、优化是否真的有效，都需要通过评估和 Trace 来验证。

### 阶段 F：API 服务化与前端流式交互

- 第 24 课：用 Fastify 封装 `/health` 和 `/api/rag/ask`。
- 第 25 课：封装 `/api/chat`，接入 Agent Graph 和 threadId。
- 第 26 课：实现 `/api/chat/stream`，支持 SSE 流式输出。
- 第 27 课：创建最小 Chat UI，让页面可以调用后端 API。
- 第 28 课：前端接入流式接口，实现逐字输出体验。
- 第 29 课：在前端展示 sources、toolCalls 和 traceEvents。

命令行脚本能验证能力，但真实应用需要服务入口和用户界面。这个阶段会把 Agent 从脚本推进到可交互页面。

### 阶段 G：多 Agent 的本质和 Demo

- 第 30 课：理解多 Agent 的工程本质，区分 Router、Supervisor、Worker 等模式。
- 第 31 课：实现最小 Router Agent，根据任务分发给不同子 Agent。
- 第 32 课：实现 Supervisor + Worker Demo，完成多步任务调度。
- 第 33 课：设计多 Agent 共享状态与消息协议。
- 第 34 课：扩展 Multi-Agent Trace，观察每个 Agent 的输入、输出和交接过程。

多 Agent 不是简单写几个角色 Prompt。真正要弄清楚的是任务怎么拆、谁来调度、状态怎么传、结果怎么合并。

### 阶段 H：Memory 的记录、检索和治理

- 第 35 课：梳理 Memory 分类，包括短期记忆、长期记忆、用户偏好和任务记忆。
- 第 36 课：从对话中抽取 Memory，设计 memory extraction。
- 第 37 课：设计 Memory 写入策略，判断何时记录、忽略或更新。
- 第 38 课：实现 Memory 检索与注入，把相关记忆放回 Agent 上下文。
- 第 39 课：增加 Memory 安全与遗忘机制，支持 delete、update 和 sensitive filter。

Memory 也不只是保存聊天记录。真实系统里，记什么、不记什么、什么时候注入、用户如何删除，都需要单独设计。

### 阶段 I：企业级 Agent 的 7 层架构理解

- 第 40 课：总览企业级 Agent 的 7 层架构。
- 第 41 课：理解交互层，包括 Web UI、API、SSE 和多端入口。
- 第 42 课：理解编排层，包括 LangGraph、Router、Supervisor 和状态机。
- 第 43 课：理解记忆层，包括短期记忆、长期记忆、用户画像和任务状态。
- 第 44 课：理解工具层，包括 Tool Registry、权限、审批和失败重试。
- 第 45 课：理解知识层，包括 RAG、向量库、混合检索、rerank 和 evaluation。
- 第 46 课：理解安全与治理层，包括权限、审计、敏感信息和人工确认。
- 第 47 课：理解观测与评估层，包括 Trace、日志、指标、评测集和质量回归。

最后这个阶段会把前面做过的能力重新放回架构里。一个企业级 Agent 不只是 LangChain 调用，也不只是 RAG 问答，更像是由交互、编排、记忆、工具、知识、安全和观测共同组成的系统。

## 我希望学完后能讲清楚什么

学完整套课程后，我希望自己能讲清楚的不只是“我用过 LangChain”。

更重要的是这些问题：

```text
一个 Agent 系统从模型调用到工具执行的链路是什么？
Tool Calling 和普通函数调用有什么区别？
LangGraph 为什么适合管理 Agent 流程？
RAG 从文档加载到问答生成，中间有哪些关键环节？
为什么 RAG 需要评估、Trace 和可观测性？
Agent 如何通过 API 和前端页面变成真实应用？
多 Agent 什么时候有必要，什么时候只是过度设计？
Memory 为什么不是简单保存聊天记录？
企业级 Agent 为什么需要分层架构？
```

这些问题弄清楚之后，再看新的框架、新的模型、新的 Agent 产品，心里会稳很多。

对我来说，这套课程的价值也在这里。它不是为了追一个新概念，而是把 AI Agent 拆成一组后端开发者能理解、能实现、能继续扩展的工程问题。

