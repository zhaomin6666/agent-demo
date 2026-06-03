可以，下面整理成一份完整的 **30 节课路线图**。后续我们就按这个版本继续推进。

# TypeScript + LangChain.js + LangGraph.js 企业级 AI 知识库 / Agent Demo 30 节课大纲

## 第一阶段：LLM 基础与结构化输出

### 第 1 课：搭建 TypeScript AI 项目，并完成第一次 LLM 调用

目标：

```text
pnpm 初始化项目
TypeScript 环境配置
dotenv 环境变量
接入阿里云百炼 / 通义千问 OpenAI 兼容接口
完成第一次 ChatOpenAI 调用
```

产出：

```text
lesson01-first-llm-call
```

---

### 第 2 课：LangChain.js 消息模型与 Prompt 基础

目标：

```text
理解 SystemMessage / HumanMessage / AIMessage
理解 ChatPromptTemplate
学习 Prompt 模板变量
从 Java 后端视角理解消息对象和模板渲染
```

产出：

```text
lesson02-prompt-messages
```

---

### 第 3 课：让大模型输出 JSON，并用 zod 做结构化校验

目标：

```text
让模型严格返回 JSON
处理 Markdown JSON 代码块
使用 JSON.parse
使用 zod 校验模型输出
实现简单意图识别
```

产出：

```text
lesson03-structured-output
```

---

### 第 4 课：封装可复用的 Intent Classifier

目标：

```text
将意图识别封装成 class
增加 success / rawOutput / errorMessage
增加 fallback 兜底
批量测试多个输入
为 Tool Calling 做准备
```

产出：

```text
lesson04-intent-classifier
```

---

## 第二阶段：Tool Calling 与 Agent 基础

### 第 5 课：Tool Calling 入门

目标：

```text
理解 Tool Calling 原理
定义 search_knowledge_base 工具
定义 create_ticket 工具
bindTools 绑定工具
执行模型返回的 tool_calls
观察真实请求中的 tools schema
```

产出：

```text
lesson05-tool-calling
```

---

### 第 6 课：封装 Tool Executor

目标：

```text
统一注册工具
统一查找工具
统一执行 tool_calls
处理工具不存在
处理工具执行异常
记录工具执行日志
```

产出：

```text
lesson06-tool-executor
```

---

### 第 7 课：Agent Loop 入门，并开始工程化拆分目录结构

目标：

```text
理解 Agent Loop
让模型多轮调用工具
设置 maxIterations 防止死循环
拆分 data / tools / executor / model / agent
解决 NodeNext 下本地 import 加 .js 后缀问题
```

产出：

```text
lesson07-agent-loop
```

---

## 第三阶段：LangGraph 状态图

### 第 8 课：引入 LangGraph，把 Agent Loop 改造成状态图

目标：

```text
安装 @langchain/langgraph
理解 StateGraph / State / Node / Edge
定义 AgentState
定义 LLM 节点
定义 Tool 节点
定义 shouldContinue 条件边
将 for 循环 Agent Loop 改造成状态图
```

产出：

```text
lesson08-langgraph-agent
```

---

### 第 9 课：LangGraph 状态增强，记录执行轨迹和中间状态

目标：

```text
扩展 AgentState
记录 currentNode
记录 stopReason
记录 traceSteps
记录 lastToolResult
记录 maxIterationsReached
让 Agent 执行过程可复盘
```

产出：

```text
lesson09-langgraph-state
```

---

### 第 10 课：LangGraph 持久化入门，使用 Checkpoint 保存 Agent 状态

目标：

```text
理解 checkpoint
理解 thread_id
保存每轮 State
支持同一会话恢复
为多轮记忆和人工介入做准备
```

产出：

```text
lesson10-langgraph-checkpoint
```

---

### 第 11 课：多轮对话记忆，让 Agent 记住上下文

目标：

```text
理解短期记忆和长期记忆
基于 thread_id 实现多轮对话
让 Agent 记住上一轮问题
控制 messages 长度
设计 Conversation Memory
```

产出：

```text
lesson11-conversation-memory
```

---

### 第 12 课：Human-in-the-loop 入门，高风险工具调用前人工确认

目标：

```text
区分查询型工具和操作型工具
为 create_ticket 增加确认流程
设计 pendingAction 状态
用户确认后再执行工具
避免模型直接执行高风险操作
```

产出：

```text
lesson12-human-approval
```

---

### 第 13 课：工具权限控制，为 Tool Calling 增加用户权限判断

目标：

```text
设计 userContext
为工具配置权限要求
ToolExecutor 执行前检查权限
未授权时返回友好错误
记录权限拦截日志
```

产出：

```text
lesson13-tool-permission
```

---

## 第四阶段：RAG 知识库核心能力

### 第 14 课：RAG 入门，理解企业知识库问答流程

目标：

```text
理解 RAG 是什么
理解企业知识库为什么需要 RAG
设计加载、切分、向量化、检索、生成流程
区分 Tool Calling 和 RAG
用内存数据模拟 RAG 流程
```

产出：

```text
lesson14-rag-introduction
```

---

### 第 15 课：文档加载与切分，构建知识库原始数据处理流程

目标：

```text
准备 Markdown / TXT 文档
实现文档加载器
实现文本切分
理解 chunkSize / overlap
输出切分后的 chunk 列表
```

产出：

```text
lesson15-document-loader-splitter
```

---

### 第 16 课：Embedding 入门，把文本转换成向量

目标：

```text
理解 Embedding
调用阿里云百炼 Embedding 接口
将文档 chunk 转向量
理解向量维度
保存 chunk + embedding 结构
```

产出：

```text
lesson16-embedding
```

---

### 第 17 课：向量检索入门，实现内存版 Vector Store

目标：

```text
理解向量数据库作用
实现 cosine similarity
构建内存版 Vector Store
根据用户问题检索 TopK 文档片段
输出检索结果和相似度
```

产出：

```text
lesson17-memory-vector-store
```

---

### 第 18 课：RAG 问答闭环，把检索结果交给模型生成答案

目标：

```text
用户问题转 embedding
检索相关文档 chunk
构造 RAG Prompt
让模型基于上下文回答
限制模型不要编造知识库外内容
```

产出：

```text
lesson18-rag-qa-chain
```

---

### 第 19 课：把 RAG 封装成 Tool，接入现有 Agent

目标：

```text
将 RAG 问答封装成 search_knowledge_base 工具
替换原来的关键词检索工具
让 Agent 自动调用 RAG 工具
保留 ToolExecutor 日志
在 LangGraph 中运行 RAG Agent
```

产出：

```text
lesson19-rag-as-tool
```

---

## 第五阶段：RAG 优化与评估

### 第 20 课：RAG 检索优化，加入关键词召回和混合检索思想

目标：

```text
理解向量检索局限
增加关键词检索
合并向量召回和关键词召回
去重和排序
对比优化前后的检索效果
```

产出：

```text
lesson20-hybrid-retrieval
```

---

### 第 21 课：RAG 重排序入门，让最相关文档排在前面

目标：

```text
理解 rerank 的作用
设计简单 rerank 规则
根据标题、标签、正文匹配度重排
对比 TopK 结果变化
为后续接真实 rerank 模型做准备
```

产出：

```text
lesson21-rag-rerank
```

---

### 第 22 课：RAG 评估入门，构建测试问题集

目标：

```text
准备测试问题集
定义期望命中文档
记录检索命中率
记录最终回答质量
输出简单评估报告
```

产出：

```text
lesson22-rag-evaluation
```

---

### 第 23 课：Agent 执行日志增强，设计可观测 Trace 输出

目标：

```text
统一记录 LLM 调用日志
统一记录 Tool 调用日志
记录 RAG 检索结果
记录每一步耗时
输出完整 Trace JSON
```

产出：

```text
lesson23-agent-observability
```

---

## 第六阶段：服务化与前后端集成

### 第 24 课：将 Agent 封装成 HTTP API 服务

目标：

```text
引入 Fastify 或 Express
创建 POST /api/chat 接口
接收 userInput 和 threadId
调用 LangGraph Agent
返回最终回答、trace、工具日志
```

产出：

```text
lesson24-agent-api-server
```

---

### 第 25 课：增加会话接口和历史记录查询

目标：

```text
设计 conversation 数据结构
管理 threadId
查询历史消息
查询 Agent 执行记录
为前端页面做准备
```

产出：

```text
lesson25-conversation-api
```

---

### 第 26 课：前端 Chat UI 入门，连接 Agent API

目标：

```text
创建简单聊天页面
输入用户问题
调用 /api/chat
展示模型回答
展示 loading 和错误状态
```

产出：

```text
lesson26-chat-ui
```

---

### 第 27 课：前端展示 Agent Trace，让用户看到执行过程

目标：

```text
展示 Agent 执行步骤
展示调用了哪些工具
展示 RAG 检索到哪些文档
展示耗时和状态
做一个可解释的 Agent Demo 页面
```

产出：

```text
lesson27-agent-trace-ui
```

---

## 第七阶段：部署、项目包装与求职沉淀

### 第 28 课：Docker 部署 Agent 服务

目标：

```text
编写 Dockerfile
配置环境变量
构建镜像
运行 Agent API 服务
为服务器部署做准备
```

产出：

```text
lesson28-docker-deploy
```

---

### 第 29 课：项目总结与作品集包装，沉淀到个人网站

目标：

```text
整理项目 README
整理技术架构图
整理核心亮点
整理个人网站展示内容
整理博客目录和项目入口
```

产出：

```text
lesson29-project-summary-portfolio
```

---

### 第 30 课：面试表达与项目答辩，把 Agent Demo 转成求职竞争力

目标：

```text
整理项目面试讲法
准备 3 分钟项目介绍
准备 10 个高频追问
整理技术难点和解决方案
整理简历项目描述
整理个人网站展示文案
```

产出：

```text
lesson30-interview-project-pitch
```

博客主题：

```text
如何把 AI Agent Demo 讲成一个有工程价值的项目
```

---

# 总体路线图

```text
第 1 ~ 4 课：LLM 基础、Prompt、结构化输出、意图识别
第 5 ~ 7 课：Tool Calling、ToolExecutor、Agent Loop
第 8 ~ 13 课：LangGraph、状态增强、持久化、人工确认、权限控制
第 14 ~ 19 课：RAG 核心链路，从文档到 Agent Tool
第 20 ~ 23 课：RAG 优化、评估、Agent 可观测性
第 24 ~ 27 课：API 服务化、会话接口、前端页面、Trace 展示
第 28 ~ 30 课：Docker 部署、作品集包装、面试答辩
```

# 最终项目能力

完成 30 节课后，这个项目会覆盖：

```text
1. TypeScript 工程化
2. LangChain.js 模型调用
3. Prompt 工程基础
4. zod 结构化校验
5. Intent Classifier
6. Tool Calling
7. ToolExecutor
8. Agent Loop
9. LangGraph StateGraph
10. Agent 状态追踪
11. Checkpoint 持久化
12. 多轮对话记忆
13. Human-in-the-loop
14. 工具权限控制
15. RAG 文档加载
16. 文档切分
17. Embedding
18. 向量检索
19. RAG 问答
20. RAG Tool 接入 Agent
21. 混合检索
22. Rerank
23. RAG 评估
24. Agent Trace
25. HTTP API 服务
26. 会话管理
27. 前端 Chat UI
28. Trace 可视化
29. Docker 部署
30. 简历、博客、个人网站、面试表达
```
