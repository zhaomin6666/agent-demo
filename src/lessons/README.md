---
title: "TypeScript + LangChain.js + LangGraph.js AI Agent 实战学习路线"
slug: "ts-langchain-langgraph-ai-agent-course-roadmap"
summary: "一套面向 Java 后端开发者和全栈学习者的 AI Agent 实战课程，从 LLM 调用、Tool Calling、LangGraph、RAG、API 服务化、前端流式交互、多 Agent、Memory，到企业级 Agent 7 层架构。"
date: "2026-06-18"
updatedAt: "2026-06-18"
tags: ["AI Agent", "LangChain.js", "LangGraph", "RAG", "Memory", "Multi-Agent", "TypeScript", "学习路线"]
series: "TypeScript + LangChain.js + LangGraph.js AI Agent 实战"
seriesSlug: "ts-langchain-langgraph-agent"
seriesOrder: 0
status: "published"
lang: "zh"
cover: ""
seoTitle: "TypeScript + LangChain.js + LangGraph.js AI Agent 实战学习路线"
seoDescription: "一套完整的 AI Agent 实战课程说明，覆盖 TypeScript 工程化、LangChain.js、LangGraph.js、Tool Calling、RAG、API 服务化、SSE 流式输出、多 Agent、Memory 和企业级 Agent 架构。"
---

# TypeScript + LangChain.js + LangGraph.js AI Agent 实战学习路线

## 前言

这套课程想解决一个很具体的问题：**如果一个 Java 后端开发者想认真学习 AI Agent 开发，应该按什么顺序学，最后能做出什么东西？**

我不太想把它做成一组零散的框架示例。只会调用一次大模型、只会写一个 Prompt、只会跑一个 RAG demo，其实都很难真正说明自己理解了 Agent 工程。

所以这套路线会围绕一个完整项目展开：从一个空的 TypeScript 项目开始，一步步做出一个企业级 AI 知识库 Agent Demo。

这个 Demo 不只是聊天页面。它会逐步具备这些能力：

```text
1. 调用大模型并管理 Prompt
2. 让模型输出结构化数据
3. 支持 Tool Calling 和工具执行
4. 使用 LangGraph 管理 Agent 状态
5. 支持多轮对话、人工确认和权限控制
6. 接入 RAG 知识库问答
7. 支持混合检索、重排序和评估
8. 提供 HTTP API 和 SSE 流式输出
9. 提供前端 Chat UI 和 Trace 展示
10. 理解多 Agent、Memory 和企业级 Agent 分层架构
```

我更愿意把这套课程理解成一条工程化路线，而不是单纯的技术清单。

它的重点不是“用上某个框架”，而是把一个 Agent 系统从最小模型调用，逐步推进到可以被页面调用、可以追踪执行过程、可以解释知识来源、可以拆分架构边界的状态。

---

## 课程适合谁

这套课程主要适合几类人：

```text
1. 有 Java 后端经验，想转向 AI Agent / 全栈方向的人
2. 已经会一点 TypeScript，但想通过真实项目提高工程能力的人
3. 学过 LangChain 或 RAG，但不知道怎么把它们串成完整项目的人
4. 想做一个能展示、能讲清楚、有工程含量的 AI Agent Demo 的人
5. 希望从后端系统设计角度理解 Agent，而不是只停留在 Prompt 层面的人
```

如果你完全没有编程基础，这套路线可能会有点快。

但如果你已经写过后端服务，理解接口、状态、权限、日志、数据结构这些概念，那么学习 Agent 时反而会有一些优势。因为真正麻烦的部分，往往不只是模型，而是模型和真实系统之间的连接方式。

---

## 最终项目形态

课程最终会围绕一个企业级 AI 知识库 Agent Demo 展开。

它的大致形态是：

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

这个项目会尽量覆盖企业级 Agent 中比较核心的工程问题：

```text
1. 用户如何和 Agent 交互
2. Agent 如何决定下一步执行什么
3. 工具调用如何注册、执行和兜底
4. 高风险操作如何人工确认
5. 不同用户角色如何做权限控制
6. 知识库如何加载、切分、检索和回答
7. RAG 效果如何评估和优化
8. 多 Agent 如何分工、协作和传递状态
9. Memory 如何抽取、写入、检索、注入和遗忘
10. 系统如何通过 Trace、日志和评测集持续优化
```

这些内容看起来多，但它们不是孤立的。前面的课程会不断为后面的能力打基础，后面的课程也会反过来解释前面为什么要那样设计。

---

## 技术栈

这套课程主要使用：

```text
TypeScript
LangChain.js
LangGraph.js
zod
Fastify
Server-Sent Events
前端 Chat UI
阿里云百炼 / 通义千问
RAG
Tool Calling
Memory
Trace / Evaluation
```

选择 TypeScript，是因为它适合把前后端、模型调用、工具定义和结构化数据放在同一个学习路径里。

选择 LangChain.js 和 LangGraph.js，是因为它们能比较自然地覆盖模型调用、工具绑定、状态图、Checkpoint、多轮对话这些 Agent 开发中的关键概念。

zod 会贯穿很多课程。原因也很简单：大模型输出不是天然可靠的，越往工程化走，越需要运行时校验。

---

# 一、课程路线总览

整套课程分成九个阶段，共 47 课。

```text
阶段 A：LLM 基础与结构化输出
阶段 B：Tool Calling 与 Agent Loop
阶段 C：LangGraph 状态图
阶段 D：RAG 知识库核心能力
阶段 E：RAG 优化、评估与可观测性
阶段 F：API 服务化与前端流式交互
阶段 G：多 Agent 的本质和 Demo
阶段 H：Memory 的记录、检索和治理
阶段 I：企业级 Agent 的 7 层架构理解
```

如果把它压缩成一句话，就是：

```text
先让模型稳定工作，再让模型调用工具；
先做出单 Agent，再接入知识库；
先提供 API 和页面，再理解多 Agent、Memory 和企业级架构。
```

---

# 二、阶段 A：LLM 基础与结构化输出

这个阶段先解决最基础的问题：如何在 TypeScript 项目里调用大模型，并让模型输出程序可以处理的数据。

这里不会急着做 Agent。因为 Agent 后面所有能力，都建立在稳定的模型调用、Prompt 管理和结构化输出之上。

## 第 1 课：搭建 TypeScript AI 项目，完成第一次 LLM 调用

目标：

```text
从零搭建 TypeScript 项目，接入阿里云百炼 OpenAI 兼容接口，完成第一次 ChatOpenAI 调用。
```

主要内容：

```text
1. 使用 pnpm 初始化项目
2. 配置 TypeScript 开发环境
3. 配置环境变量
4. 创建模型实例
5. 完成第一次 LLM 调用
```

产出：

```text
lesson01-first-llm-call
```

## 第 2 课：LangChain.js 消息模型与 Prompt 基础

目标：

```text
理解 SystemMessage、HumanMessage、AIMessage，学习 Prompt 模板和消息组装。
```

主要内容：

```text
1. 理解消息角色
2. 区分系统指令和用户输入
3. 使用 ChatPromptTemplate
4. 通过变量组装 Prompt
5. 用后端参数传递的思路理解 Prompt
```

产出：

```text
lesson02-prompt-messages
```

## 第 3 课：让大模型输出 JSON，并用 zod 做结构化校验

目标：

```text
让模型返回结构化 JSON，并用 zod 做运行时校验。
```

主要内容：

```text
1. 设计 JSON 输出格式
2. 处理 Markdown 代码块包裹
3. 使用 zod 校验模型输出
4. 区分模型文本和程序数据
5. 增加异常处理
```

产出：

```text
lesson03-structured-output
```

## 第 4 课：封装可复用的 Intent Classifier

目标：

```text
把意图识别封装成可复用组件。
```

主要内容：

```text
1. 封装 IntentClassifier
2. 增加 success / error / rawOutput
3. 增加 fallback 逻辑
4. 批量测试多组输入
5. 为 Tool Calling 做准备
```

产出：

```text
lesson04-intent-classifier
```

---

# 三、阶段 B：Tool Calling 与 Agent Loop

这个阶段开始进入 Agent 的核心：让模型不只是回答问题，还能决定是否调用工具。

这里最重要的理解是：模型并不会真的执行函数。它只是返回一个结构化的工具调用意图，真正执行工具的是我们的程序。

## 第 5 课：Tool Calling 入门

目标：

```text
理解 Tool Calling 的基本原理，让模型返回工具调用指令。
```

主要内容：

```text
1. 定义 search_knowledge_base 工具
2. 定义 create_ticket 工具
3. 使用 bindTools 绑定工具
4. 观察模型返回的 tool_calls
5. 执行模型请求的工具调用
```

产出：

```text
lesson05-tool-calling
```

## 第 6 课：封装 Tool Executor

目标：

```text
统一管理工具注册、查找、执行和异常处理。
```

主要内容：

```text
1. 设计 ToolExecutor
2. 注册多个工具
3. 查找工具定义
4. 执行工具调用
5. 记录工具执行结果和错误
```

产出：

```text
lesson06-tool-executor
```

## 第 7 课：Agent Loop 入门，开始工程化拆分

目标：

```text
实现模型调用、工具执行、结果回传、循环调用的基本 Agent Loop。
```

主要内容：

```text
1. 理解 Agent Loop
2. 调用模型并检查 tool_calls
3. 执行工具并把结果回传模型
4. 使用 maxIterations 防止死循环
5. 拆分 data / tools / executor / model / agent 目录
```

产出：

```text
lesson07-agent-loop
```

---

# 四、阶段 C：LangGraph 状态图

手写 Agent Loop 适合理解原理，但继续往下做多轮对话、人工确认、权限控制时，单纯的循环会变得很难维护。

这个阶段引入 LangGraph，把 Agent 流程改造成状态图。

## 第 8 课：引入 LangGraph，把 Agent Loop 改造成状态图

目标：

```text
用 LangGraph StateGraph 替代手写 Agent Loop。
```

主要内容：

```text
1. 安装 @langchain/langgraph
2. 理解 StateGraph
3. 定义 AgentState
4. 创建 LLM 节点和 Tool 节点
5. 使用条件边控制流程
```

产出：

```text
lesson08-langgraph-agent
```

## 第 9 课：LangGraph 状态增强，记录执行轨迹

目标：

```text
扩展 AgentState，记录 Agent 执行过程。
```

主要内容：

```text
1. 增加 currentNode
2. 增加 stopReason
3. 增加 traceSteps
4. 增加 lastToolResult
5. 记录每一轮执行过程
```

产出：

```text
lesson09-langgraph-state
```

## 第 10 课：LangGraph 持久化，使用 Checkpoint 保存 Agent 状态

目标：

```text
使用 Checkpoint 保存会话状态。
```

主要内容：

```text
1. 理解 thread_id
2. 使用 MemorySaver
3. 保存 Agent 状态
4. 查询历史状态
5. 为多轮对话和人工介入打基础
```

产出：

```text
lesson10-langgraph-checkpoint
```

## 第 11 课：多轮对话记忆

目标：

```text
基于 thread_id 实现多轮上下文记忆。
```

主要内容：

```text
1. 保存多轮 messages
2. 使用 thread_id 区分会话
3. 控制上下文长度
4. 裁剪历史消息
5. 区分短期记忆和长期记忆
```

产出：

```text
lesson11-conversation-memory
```

## 第 12 课：Human-in-the-loop，高风险工具调用前人工确认

目标：

```text
为 create_ticket 这类操作型工具增加人工确认。
```

主要内容：

```text
1. 区分查询型工具和操作型工具
2. 设计 pendingAction
3. 暂停 Agent 执行
4. 接收用户确认
5. 确认后继续执行工具
```

产出：

```text
lesson12-human-approval
```

## 第 13 课：工具权限控制

目标：

```text
为工具调用增加角色权限校验。
```

主要内容：

```text
1. 设计 userContext
2. 定义 roles
3. 为工具配置权限要求
4. 在执行前拦截未授权调用
5. 将权限判断写入 Agent 状态
```

产出：

```text
lesson13-tool-permission
```

---

# 五、阶段 D：RAG 知识库核心能力

Agent 如果只依赖模型自己的通用知识，很难用于企业内部场景。

这个阶段开始接入 RAG，让 Agent 能基于项目文档、业务资料和知识库内容回答问题。

## 第 14 课：RAG 入门，理解企业知识库问答流程

目标：

```text
理解 RAG 的完整流程。
```

主要内容：

```text
1. 理解 Retrieval-Augmented Generation
2. 设计加载、切分、向量化、检索、生成流程
3. 使用内存数据模拟知识库
4. 构造基础问答链路
5. 理解 RAG 和普通聊天的区别
```

产出：

```text
lesson14-rag-introduction
```

## 第 15 课：文档加载与切分

目标：

```text
实现 Markdown 文档加载和 chunk 切分。
```

主要内容：

```text
1. 加载 Markdown / TXT 文档
2. 设计 Document 结构
3. 实现文本切分
4. 理解 chunkSize
5. 理解 overlap 对上下文的影响
```

产出：

```text
lesson15-document-loader-splitter
```

## 第 16 课：Embedding 入门

目标：

```text
调用 Embedding 模型，把 chunk 转成向量。
```

主要内容：

```text
1. 理解 Embedding
2. 调用阿里云百炼 Embedding 接口
3. 将文本片段转成向量
4. 保存 chunk + embedding
5. 理解向量维度和相似度
```

产出：

```text
lesson16-embedding
```

## 第 17 课：向量检索，实现内存版 Vector Store

目标：

```text
实现 cosine similarity 和内存版向量检索。
```

主要内容：

```text
1. 实现 cosine similarity
2. 构建 MemoryVectorStore
3. 实现 similaritySearch
4. 返回 TopK 结果
5. 输出相似度分数
```

产出：

```text
lesson17-memory-vector-store
```

## 第 18 课：RAG 问答闭环

目标：

```text
实现用户问题 → 检索 → 构造 context → 模型回答的闭环。
```

主要内容：

```text
1. 实现 RagQaChain
2. 将问题转成 embedding
3. 检索相关文档片段
4. 构造 RAG Prompt
5. 返回 answer 和 sources
```

产出：

```text
lesson18-rag-qa-chain
```

## 第 19 课：把 RAG 封装成 Tool，接入 Agent

目标：

```text
把 RAG 问答封装成 search_knowledge_base 工具。
```

主要内容：

```text
1. 封装 RAG Tool
2. 替换模拟知识库工具
3. 让 Agent 自动调用 RAG
4. 将 RAG 结果回传模型
5. 跑通 RAG Agent
```

产出：

```text
lesson19-rag-as-agent-tool
```

---

# 六、阶段 E：RAG 优化、评估与可观测性

RAG 跑通之后，下一个问题是效果。

检索是否命中了正确资料，回答是否引用了可靠来源，优化是否真的带来提升，都需要被记录和评估。

## 第 20 课：混合检索，加入关键词召回

目标：

```text
在向量检索之外增加关键词检索。
```

主要内容：

```text
1. 理解纯向量检索的局限
2. 实现 KeywordRetriever
3. 实现 HybridRetriever
4. 设置 vectorWeight 和 keywordWeight
5. 合并多路召回结果
```

产出：

```text
lesson20-hybrid-retrieval
```

## 第 21 课：Rerank 入门，对混合检索结果进行二次排序

目标：

```text
对初筛候选结果进行二次排序。
```

主要内容：

```text
1. 区分 Retrieval 和 Rerank
2. 实现 SimpleRuleBasedReranker
3. 实现 RerankedRetriever
4. 输出 originalScore
5. 输出 rerankScore 和 rerankReasons
```

产出：

```text
lesson21-rerank-introduction
```

## 第 22 课：RAG Evaluation 入门，构建最小评测集

目标：

```text
为 RAG 构建最小评测集。
```

主要内容：

```text
1. 设计 EvaluationCase
2. 定义 expectedSources
3. 处理 shouldHaveEvidence
4. 实现 RagEvaluator
5. 输出 EvaluationReport
```

产出：

```text
lesson22-rag-evaluation
```

## 第 23 课：Observability 入门，为 RAG 和 Agent 增加运行观测日志

目标：

```text
为 RAG、Evaluation、Tool Call 增加结构化 trace。
```

主要内容：

```text
1. 设计 TraceEvent
2. 生成 traceId 和 spanId
3. 实现 TraceRecorder
4. 记录 rag.retrieve / rag.context / rag.generate
5. 记录 evaluation.case 和 tool.call
```

产出：

```text
lesson23-observability
```

---

# 七、阶段 F：API 服务化与前端流式交互

命令行脚本能验证能力，但真正的 Agent 应用需要服务入口和用户界面。

这个阶段会把 RAG 和 Agent 封装成 HTTP API，再通过前端页面完成真实交互。

## 第 24 课：Fastify API Server 入门，封装 /health 和 /api/rag/ask

目标：

```text
把 RagQaChain 封装成 HTTP API。
```

主要内容：

```text
1. 安装 Fastify
2. 新增 server 目录
3. 创建 API Server
4. 新增 GET /health
5. 新增 POST /api/rag/ask
6. 返回 answer、sources、traceId
```

产出：

```text
lesson24-api-server-rag
```

## 第 25 课：封装 /api/chat，接入 Agent Graph 和 threadId

目标：

```text
把 LangGraph Agent 封装成聊天接口。
```

主要内容：

```text
1. 新增 POST /api/chat
2. 接收 userInput、threadId、userContext
3. 接入 createAgentGraph
4. 支持多轮会话
5. 返回 finalAnswer、toolExecutionRecords、permissionDecision
```

产出：

```text
lesson25-agent-chat-api
```

## 第 26 课：实现 SSE 流式输出接口 /api/chat/stream

目标：

```text
实现 Server-Sent Events，让后端可以流式返回内容。
```

主要内容：

```text
1. 理解普通 HTTP 响应和 SSE 的区别
2. 新增 POST /api/chat/stream
3. 设置 text/event-stream 响应头
4. 设计 stream event 类型
5. 支持 answer_delta、tool_call、trace_event、done、error
```

产出：

```text
lesson26-sse-chat-stream
```

## 第 27 课：前端 Chat UI 入门，页面调用后端 API

目标：

```text
创建一个最小可用的聊天页面。
```

主要内容：

```text
1. 创建前端页面
2. 设计 ChatMessage 类型
3. 实现输入框和发送按钮
4. 调用 /api/chat
5. 展示用户消息、助手回答、loading 和错误状态
```

产出：

```text
lesson27-chat-ui
```

## 第 28 课：前端逐字输出，实现类 ChatGPT 的 streaming 体验

目标：

```text
前端接入 /api/chat/stream，实现逐字输出。
```

主要内容：

```text
1. 前端调用 SSE 接口
2. 解析 event-stream
3. 处理 answer_delta
4. 将 delta 追加到当前助手消息
5. 处理 done、error 和中断状态
```

产出：

```text
lesson28-streaming-chat-ui
```

## 第 29 课：前端展示 sources、toolCalls、traceEvents

目标：

```text
让前端不仅展示答案，还展示 Agent 的执行过程。
```

主要内容：

```text
1. 展示 RAG sources
2. 展示 toolCalls
3. 展示 toolExecutionRecords
4. 展示 traceEvents
5. 区分普通回答和工具调用过程
```

产出：

```text
lesson29-agent-trace-ui
```

---

# 八、阶段 G：多 Agent 的本质和 Demo

多 Agent 不是简单写几个角色 Prompt。

真正需要理解的是任务如何拆分、谁负责调度、状态如何传递、结果如何合并，以及什么时候根本不需要多 Agent。

## 第 30 课：多 Agent 的本质，Router / Supervisor / Worker 模式

目标：

```text
从概念和工程角度理解多 Agent。
```

主要内容：

```text
1. 什么是多 Agent
2. 多 Agent 和多个工具的区别
3. Router 模式
4. Supervisor / Worker 模式
5. Reviewer 和 Debate 模式
6. 多 Agent 的适用场景和滥用风险
```

产出：

```text
lesson30-multi-agent-concepts
```

## 第 31 课：实现最小 Router Agent，根据任务分发给不同子 Agent

目标：

```text
实现一个 Router Agent，把任务分发给不同子 Agent。
```

主要内容：

```text
1. 定义 AgentRole
2. 定义 SubAgent 接口
3. 实现 KnowledgeAgent
4. 实现 TicketAgent
5. 实现 RouterAgent
6. 根据用户意图选择子 Agent
```

产出：

```text
lesson31-router-agent
```

## 第 32 课：实现 Supervisor + Worker Demo

目标：

```text
实现一个 Supervisor 调度多个 Worker 的 Demo。
```

主要内容：

```text
1. SupervisorAgent 负责规划
2. WorkerAgent 负责执行
3. KnowledgeWorker 查询知识库
4. TicketWorker 创建工单
5. ReviewWorker 检查答案
6. Supervisor 汇总最终结果
```

产出：

```text
lesson32-supervisor-worker-agent
```

## 第 33 课：多 Agent 共享状态与消息协议

目标：

```text
设计多 Agent 之间共享状态和消息传递协议。
```

主要内容：

```text
1. MultiAgentState
2. AgentMessage
3. TaskMessage
4. AgentResult
5. sharedContext
6. agentOutputs
7. handoffReason
```

产出：

```text
lesson33-multi-agent-state-protocol
```

## 第 34 课：多 Agent Trace，观察每个 Agent 的输入、输出和交接过程

目标：

```text
把 Observability 扩展到多 Agent。
```

主要内容：

```text
1. 新增 agent.route
2. 新增 agent.invoke
3. 新增 agent.handoff
4. 记录 Router 决策
5. 记录 Supervisor 计划
6. 输出 Multi-Agent Trace Report
```

产出：

```text
lesson34-multi-agent-trace
```

---

# 九、阶段 H：Memory 的记录、检索和治理

很多 Agent Demo 会把 Memory 简化成聊天记录，但真实系统里的 Memory 要复杂得多。

这个阶段会把 Memory 拆成分类、抽取、写入、检索、注入、安全和遗忘几个问题。

## 第 35 课：Memory 分类，短期记忆、长期记忆、用户偏好、任务记忆

目标：

```text
系统理解 Agent Memory 的不同类型。
```

主要内容：

```text
1. Short-term Memory
2. Long-term Memory
3. Semantic Memory
4. Episodic Memory
5. Procedural Memory
6. User Preference Memory
7. Task Memory
8. Working Memory
```

产出：

```text
lesson35-memory-taxonomy
```

## 第 36 课：从对话中抽取 Memory，设计 memory extraction

目标：

```text
从用户对话中识别哪些信息值得记忆。
```

主要内容：

```text
1. MemoryExtractionInput
2. MemoryCandidate
3. MemoryType
4. importance
5. confidence
6. expiresAt
7. sensitive flag
8. 使用 LLM 抽取候选记忆
9. 使用 zod 校验
```

产出：

```text
lesson36-memory-extraction
```

## 第 37 课：Memory 写入策略，何时记录、何时忽略、何时更新

目标：

```text
设计 Memory 写入规则。
```

主要内容：

```text
1. MemoryWritePolicy
2. shouldWrite
3. shouldUpdate
4. shouldIgnore
5. duplicate detection
6. memory merge
7. sensitive memory handling
8. 用户确认机制
```

产出：

```text
lesson37-memory-write-policy
```

## 第 38 课：Memory 检索与注入，把长期记忆放回 Agent 上下文

目标：

```text
让 Agent 在回答前检索相关 Memory，并注入上下文。
```

主要内容：

```text
1. MemoryStore
2. MemoryRetriever
3. memory similarity search
4. 构造 memory context
5. 注入 System / Human Message
6. 控制注入数量
7. 防止 Memory 干扰当前任务
```

产出：

```text
lesson38-memory-retrieval-injection
```

## 第 39 课：Memory 安全与遗忘机制，支持 delete / update / sensitive filter

目标：

```text
为 Memory 增加安全、更新和遗忘能力。
```

主要内容：

```text
1. memory delete
2. memory update
3. memory disable
4. sensitive filter
5. user requested forgetting
6. audit log
7. memory visibility
8. memory explainability
```

产出：

```text
lesson39-memory-safety-forgetting
```

---

# 十、阶段 I：企业级 Agent 的 7 层架构理解

最后这个阶段会把前面做过的能力重新放回系统架构里。

一个企业级 Agent 不只是 LangChain 调用，也不只是 RAG 问答。它更像一个由交互、编排、记忆、工具、知识、安全和观测共同组成的系统。

## 第 40 课：企业级 Agent 7 层架构总览

目标：

```text
建立企业级 Agent 的整体架构认知。
```

主要内容：

```text
1. 为什么需要分层架构
2. 7 层分别是什么
3. 每一层解决什么问题
4. 每一层对应前面哪些课程
5. 单 Agent、多 Agent、RAG、Memory、Tool 如何放入架构
```

产出：

```text
lesson40-agent-architecture-overview
```

## 第 41 课：交互层，Web UI / API / SSE / 多端入口

目标：

```text
理解 Agent 的交互入口设计。
```

主要内容：

```text
1. Web Chat UI
2. HTTP API
3. SSE Streaming
4. 多端入口
5. threadId
6. userContext
7. 用户体验和系统能力的关系
```

产出：

```text
lesson41-interaction-layer
```

## 第 42 课：编排层，LangGraph / Router / Supervisor / 状态机

目标：

```text
理解 Agent 编排层的作用。
```

主要内容：

```text
1. Agent Loop
2. LangGraph StateGraph
3. Node / Edge / Conditional Edge
4. Router
5. Supervisor
6. Worker
7. 状态机和多 Agent 编排
```

产出：

```text
lesson42-orchestration-layer
```

## 第 43 课：记忆层，短期记忆、长期记忆、用户画像、任务状态

目标：

```text
从架构层面理解 Memory。
```

主要内容：

```text
1. conversation memory
2. working memory
3. long-term memory
4. user profile
5. task memory
6. memory extraction
7. memory retrieval
8. memory governance
```

产出：

```text
lesson43-memory-layer
```

## 第 44 课：工具层，Tool Registry、权限、审批、失败重试

目标：

```text
理解企业 Agent 的工具层设计。
```

主要内容：

```text
1. Tool Registry
2. Tool Schema
3. Tool Executor
4. Tool Permission
5. Human Approval
6. Retry
7. Timeout
8. Error Handling
9. Tool Audit
```

产出：

```text
lesson44-tool-layer
```

## 第 45 课：知识层，RAG、向量库、混合检索、rerank、evaluation

目标：

```text
理解企业 Agent 的知识层设计。
```

主要内容：

```text
1. Document Loader
2. Text Splitter
3. Embedding
4. Vector Store
5. Hybrid Retrieval
6. Rerank
7. RAG QA Chain
8. Evaluation Dataset
9. No Evidence 策略
```

产出：

```text
lesson45-knowledge-layer
```

## 第 46 课：安全与治理层，权限、审计、敏感信息、人工确认

目标：

```text
理解企业级 Agent 的安全和治理。
```

主要内容：

```text
1. 用户身份
2. 角色权限
3. 工具权限
4. 高风险操作确认
5. 数据访问边界
6. 敏感信息处理
7. Memory 安全
8. 审计日志
9. 合规与责任边界
```

产出：

```text
lesson46-security-governance-layer
```

## 第 47 课：观测与评估层，Trace、日志、指标、评测集、质量回归

目标：

```text
理解企业级 Agent 如何持续调试、评估和优化。
```

主要内容：

```text
1. Trace
2. Span
3. Structured Logs
4. Metrics
5. Evaluation Dataset
6. Regression Test
7. RAG Quality Report
8. Agent Execution Report
9. 线上问题排查流程
```

产出：

```text
lesson47-observability-evaluation-layer
```

---

# 十一、学完整套课程后应该具备的能力

学完整套课程后，我希望能真正讲清楚的不只是“我用过 LangChain”。

更重要的是能讲清楚：

```text
1. 一个 Agent 系统从模型调用到工具执行的完整链路
2. Tool Calling 和普通函数调用的区别
3. LangGraph 状态图为什么适合管理 Agent 流程
4. RAG 从文档加载到问答生成的完整过程
5. 为什么 RAG 需要评估、Trace 和可观测性
6. Agent 如何通过 API 和前端页面变成真实应用
7. SSE 流式输出如何改善交互体验
8. 多 Agent 什么时候有必要，什么时候只是过度设计
9. Memory 为什么不是简单保存聊天记录
10. 企业级 Agent 为什么需要分层架构
```

对我来说，这套课程的价值不只是做出一个 Demo。

它更像是把 AI Agent 拆成一组可以被后端开发者理解和实现的工程问题：接口、状态、工具、权限、知识、记忆、日志、评估、架构。

这些问题弄清楚之后，再去看新的框架、新的模型、新的 Agent 产品，心里会稳很多。

---

# 十二、课程使用建议

如果是第一次学习，可以按课程顺序推进。

前面几课可能看起来比较基础，但不要跳得太快。结构化输出、zod 校验、ToolExecutor、状态追踪这些能力，后面会反复用到。

如果已经有一定基础，也可以按模块学习：

```text
想学 Agent 基础：第 1 ~ 13 课
想学 RAG：第 14 ~ 23 课
想学服务化和前端交互：第 24 ~ 29 课
想学多 Agent：第 30 ~ 34 课
想学 Memory：第 35 ~ 39 课
想建立架构视角：第 40 ~ 47 课
```

我的建议是，每节课不要只看代码能不能跑。

更重要的是在写完后问自己几个问题：

```text
1. 这一课解决的真实工程问题是什么？
2. 这个能力在整个 Agent 系统里处在哪一层？
3. 如果放到真实业务里，哪里会变复杂？
4. 这个实现后面有没有可能被替换、扩展或抽象？
```

Agent 开发很容易被新概念带着跑。保持工程问题意识，会让这条学习路线更扎实一点。
