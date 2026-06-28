---
title: "第24课：把 Agent Demo 服务化成 HTTP API"
slug: "ai-agent-lesson-24-agent-api-service"
summary: "把前面课程中的 Agent Demo 从本地脚本升级为 HTTP API 服务，让前端、网页或其他系统可以通过接口调用 Agent 能力。"
date: "2026-06-27"
updatedAt: "2026-06-27"
tags: ["AI Agent", "API", "Fastify", "LangChain.js", "TypeScript"]
series: "Ts AI Agent 学习课程"
seriesSlug: "ts-ai-agent-learning"
seriesOrder: 24
status: "published"
lang: "zh"
cover: ""
seoTitle: "第24课：把 Agent Demo 服务化成 HTTP API"
seoDescription: "记录 AI Agent 学习路线第 24 课：使用 Fastify 将 Agent Demo 封装为 HTTP API 服务。"
---

# 第24课：把 Agent Demo 服务化成 HTTP API

前面 1～23 课主要是在命令行中学习 AI Agent 的核心能力，比如 LLM 调用、Prompt、结构化输出、工具调用、LangGraph 状态流转和可观测性。

这些课程已经能让 Agent Demo 在本地跑起来。

但如果只停留在脚本阶段，它还不是一个真正可以被前端或其他系统使用的服务。

所以第 24 课开始进入第二阶段：**把 Agent Demo 服务化。**

这一课的目标是：**把原本只能在本地脚本中调用的 Agent，封装成一个 HTTP API。**

---

## 1. 为什么要服务化

之前的运行方式大概是：

```text
pnpm lesson:xx
```

然后在终端里看到模型输出。

这种方式适合学习，但不适合产品化。

真实项目里，Agent 通常需要被这些地方调用：

```text
1. 前端 Chat UI
2. 管理后台
3. 第三方系统
4. 工作流平台
5. 企业内部业务系统
6. 其他 Agent 或工具
```

所以需要把 Agent 能力封装成 API。

从 Java 后端角度理解，就是从：

```text
main 方法里直接调用 Service
```

升级成：

```text
Controller -> Service -> Agent Core -> LLM
```

这一课就是完成这个转变。

## 2. 本课目录

这一课仍然保持课程目录风格：

```text
src/lessons/lesson24-agent-api-service
  ├── index.ts
  ├── agentService.ts
  └── types.ts
```

对应脚本：

```json
{
  "scripts": {
    "lesson:24": "tsx src/lessons/lesson24-agent-api-service/index.ts"
  }
}
```

运行方式：

```bash
pnpm lesson:24
```

这里没有把代码直接放到 src/server，是因为当前仍然处于课程学习阶段。

每一课都保留独立目录，方便以后回顾、对比和写博客。

## 3. 安装 Fastify

这一课使用 Fastify 作为 HTTP 服务框架。

安装依赖：

```bash
pnpm add fastify @fastify/cors
```

如果项目里还没有 tsx，也需要安装：

```bash
pnpm add -D tsx
```

Fastify 在这里相当于 Java 里的轻量 Web 框架，负责：

```text
1. 启动 HTTP 服务
2. 注册路由
3. 解析请求体
4. 返回 JSON
5. 处理错误
4. 定义请求和响应类型
```

在 types.ts 中定义：

```typescript
export type AgentApiRequest = {
  message: string;
};

export type AgentApiResponse = {
  answer: string;
};
```

这两个类型对应 Java 里的 DTO：

```java
class AgentApiRequest {
    private String message;
}

class AgentApiResponse {
    private String answer;
}
```

虽然 TypeScript 不一定要求每个请求都单独定义类型，但在课程项目中这样做有两个好处：

```text
1. 让接口结构更清晰
2. 后面改造时更容易复用
```
## 5. 封装 Agent Service

第 24 课新增了 agentService.ts：

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { AgentApiRequest, AgentApiResponse } from "./types.js";

function createModel() {
  return new ChatOpenAI({
    model: "qwen3.6-flash",
    temperature: 0.2,
    apiKey: process.env.DASHSCOPE_API_KEY,
    configuration: {
      baseURL: process.env.DASHSCOPE_BASE_URL,
    },
  });
}

export async function runAgentApiDemo(
  input: AgentApiRequest,
): Promise<AgentApiResponse> {
  const model = createModel();

  const result = await model.invoke([
    new SystemMessage(
      [
        "你是一个企业级 AI Agent Demo 助手。",
        "你的回答要清晰、结构化。",
        "请尽量使用 Java 后端工程师容易理解的类比。",
      ].join("\n"),
    ),
    new HumanMessage(input.message),
  ]);

  return {
    answer: String(result.content),
  };
}
```

这里重点是把模型调用封装到：

```typescript
runAgentApiDemo()
```

这样后面的 HTTP 层不需要知道模型如何创建，也不需要关心 Prompt 如何组织。

这和 Java 项目里的分层很像：

Controller 不直接写业务逻辑
Controller 调用 Service
Service 负责业务处理
6. 创建 HTTP Server

第 24 课的入口是 `index.ts`。

核心逻辑是启动 Fastify 服务：

```typescript
import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import { runAgentApiDemo } from "./agentService.js";

const server = Fastify({
  logger: true,
});

await server.register(cors, {
  origin: true,
});
```

这里使用了：

```typescript
import "dotenv/config";
```

用于加载 `.env` 中的环境变量。

比如：
```env
DASHSCOPE_API_KEY=你的百炼API_KEY
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AGENT_API_PORT=3001
```

## 7. 健康检查接口

第一个接口是：

```typescript
server.get("/health", async () => {
  return {
    status: "ok",
    lesson: "lesson24-agent-api-service",
    timestamp: new Date().toISOString(),
  };
});
```

测试：
```bash
curl http://localhost:3001/health
```
如果返回：
```json
{
  "status": "ok",
  "lesson": "lesson24-agent-api-service",
  "timestamp": "..."
}
```
说明服务启动正常。

健康检查接口看起来简单，但在真实项目中很重要。

它可以用于：
```text
1. 本地测试服务是否启动
2. Docker 容器健康检查
3. Nginx 或负载均衡探活
4. 运维监控
8. Agent API 接口
```
本课核心接口是：
```
POST /api/agent-demo
```
请求体：
```json
{
  "message": "请用 Java 后端工程师能理解的方式解释什么是 AI Agent"
}
```
核心代码：
```typescript
server.post<{
  Body: {
    message?: string;
  };
}>("/api/agent-demo", async (request, reply) => {
  const requestId = randomUUID();
  const start = Date.now();

  try {
    const message = request.body.message?.trim();

    if (!message) {
      return reply.code(400).send({
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "message 不能为空",
          requestId,
        },
      });
    }

    const result = await runAgentApiDemo({
      message,
    });

    return {
      success: true,
      data: {
        answer: result.answer,
        requestId,
        durationMs: Date.now() - start,
      },
    };
  } catch (error) {
    request.log.error(error);

    return reply.code(500).send({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Agent API 调用失败",
        requestId,
      },
    });
  }
});
```
这里已经具备一个基础 API 应该有的几个要素：
```text
1. 参数校验
2. requestId
3. 调用耗时 durationMs
4. 成功响应结构
5. 错误响应结构
6. 日志记录
9. 统一响应结构
```
本课返回成功时：
```json
{
  "success": true,
  "data": {
    "answer": "...",
    "requestId": "...",
    "durationMs": 1234
  }
}
```
参数错误时：
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "message 不能为空",
    "requestId": "..."
  }
}
```
这其实是后面产品化的基础。

真实项目中，统一响应结构可以让前端更容易处理：
```text
1. 成功结果
2. 业务错误
3. 系统错误
4. 请求追踪
10. 启动服务
```
启动第 24 课：
```bash
pnpm lesson:24
```
服务默认监听：
```
http://localhost:3001
```
测试健康检查：
```bash
curl http://localhost:3001/health
```
测试 Agent API：
```bash
curl -X POST http://localhost:3001/api/agent-demo \
  -H "Content-Type: application/json" \
  -d '{"message":"请用 Java 后端工程师能理解的方式解释什么是 AI Agent"}'
```
如果能返回模型回答，说明第 24 课完成。

## 11. 本课的关键转变

第 24 课最重要的不是 Fastify 语法，而是架构转变。

之前是：
```
lesson 脚本
  -> 直接调用模型
```
现在是：
```
HTTP 请求
  -> Fastify Route
  -> Agent Service
  -> LangChain Model
  -> JSON 响应
```
这意味着 Agent Demo 从学习脚本升级成了可被外部调用的服务。

这是从 Demo 走向产品的第一步。

## 12. 本课总结

第 24 课完成了 Agent Demo 的 API 服务化。

核心收获：
```
1. 使用 Fastify 启动 HTTP 服务
2. 使用 @fastify/cors 支持跨域
3. 把模型调用封装为 Agent Service
4. 增加 /health 健康检查
5. 增加 /api/agent-demo 接口
6. 增加 requestId 和 durationMs
7. 统一成功和失败响应结构
```
到这里，Agent Demo 已经不再只是命令行练习，而是一个可以被前端调用的后端服务。

下一课会继续升级：给 Agent API 增加 SSE 流式输出，让它像 ChatGPT 一样边生成边返回。