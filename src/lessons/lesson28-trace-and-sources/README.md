---
title: "第28课：在 Chat UI 中展示 Trace 和 Sources"
slug: "ai-agent-lesson-28-trace-and-sources"
summary: "在前端 Chat UI 中增加 Trace 和 Sources 面板，让 Agent Demo 不只展示答案，也展示执行过程和参考来源。"
date: "2026-06-27"
updatedAt: "2026-06-27"
tags: ["AI Agent", "Trace", "Sources", "Observability", "Chat UI"]
series: "Ts AI Agent 学习课程"
seriesSlug: "ts-ai-agent-learning"
seriesOrder: 28
status: "published"
lang: "zh"
cover: ""
seoTitle: "第28课：在 Chat UI 中展示 Trace 和 Sources"
seoDescription: "记录 AI Agent 学习路线第 28 课：在 Chat UI 中展示 Trace、Sources、requestId 和 durationMs，增强 Agent Demo 可观测性。"
---

# 第28课：在 Chat UI 中展示 Trace 和 Sources

第 27 课已经实现了比较接近真实 AI Chat 的交互体验：

```text
1. SSE 流式输出
2. 前端逐字显示
3. Stop 按钮
4. AbortController 中断生成

但是一个企业级 Agent Demo 不能只展示最终答案。

如果用户问：

这个答案是怎么来的？
用了哪些资料？
中间经过了哪些步骤？
耗时多少？
有没有 requestId 可以排查问题？

系统也应该能回答。

所以第 28 课的目标是：在 Chat UI 中增加 Trace 和 Sources 面板，让 Agent 不只是回答问题，还能展示回答过程。

1. 为什么需要 Trace 和 Sources

普通 AI Chat 页面通常只展示：

用户问题
AI 回答

但企业级 Agent 系统更关心：

1. 请求有没有进入系统
2. Agent 做了哪些步骤
3. 调用了哪些模型或工具
4. 使用了哪些知识来源
5. 每一步是否成功
6. 总耗时是多少
7. 出问题时怎么排查

这就是 Agent 可观测性的基础。

从 Java 后端角度理解，Trace 类似调用链日志：

Controller 接收请求
  -> Service 参数校验
  -> 查询知识库
  -> 调用大模型
  -> 返回结果

Sources 则类似回答时引用的数据来源，比如：

1. 知识库文档
2. 数据库查询结果
3. 文件片段
4. 工具返回结果
5. 历史记忆
2. 本课目录

第 28 课继续复制第 27 课，并在此基础上增强：

src/lessons/lesson28-trace-and-sources
  ├── index.ts
  ├── streamingAgentService.ts
  ├── sse.ts
  ├── types.ts
  └── public
      ├── index.html
      ├── app.js
      └── style.css

运行脚本：

{
  "scripts": {
    "lesson:28": "tsx src/lessons/lesson28-trace-and-sources/index.ts"
  }
}

启动：

pnpm lesson:28
3. 扩展事件类型

第 27 课的事件主要是：

start
delta
done
error

第 28 课新增：

trace
source

在 types.ts 中定义：

export type TraceStatus = "running" | "completed" | "failed";

export type TraceStep = {
  id: string;
  title: string;
  status: TraceStatus;
  detail?: string;
  timestamp: string;
  durationMs?: number;
};

export type SourceItem = {
  id: string;
  title: string;
  type: "lesson" | "doc" | "memory" | "tool";
  url?: string;
  snippet: string;
};

TraceStep 表示一个执行步骤。

SourceItem 表示一个参考来源。

然后把流式事件扩展为：

export type AgentStreamChunk =
  | {
      type: "trace";
      step: TraceStep;
    }
  | {
      type: "source";
      source: SourceItem;
    }
  | {
      type: "delta";
      content: string;
    };

这意味着后端生成器不再只返回字符串，而是返回结构化事件。

4. 从 string 流升级为事件流

第 27 课中，模型服务返回的是：

AsyncGenerator<string>

第 28 课升级成：

AsyncGenerator<AgentStreamChunk>

也就是说，原来只会产生：

文本片段
文本片段
文本片段

现在可以产生：

trace 事件
source 事件
delta 事件
trace 事件

这一步很关键。

因为真实 Agent 系统里，最终答案只是运行过程中的一种事件。

更完整的 Agent 运行流应该包括：

1. 开始执行
2. 路由判断
3. 准备上下文
4. 检索知识库
5. 调用工具
6. 调用模型
7. 输出答案
8. 完成
9. 异常

第 28 课先做教学版的最小实现。

5. 模拟 Sources 选择

本课还没有真正接入 RAG 或向量数据库，所以先在代码里定义了一个本地 Sources 库：

const SOURCE_LIBRARY: SourceCandidate[] = [
  {
    id: "lesson25-sse",
    title: "Lesson 25：SSE 流式输出",
    type: "lesson",
    snippet:
      "后端通过 text/event-stream 持续写入 start、delta、done、error 事件，让客户端可以边接收边展示。",
    keywords: ["sse", "stream", "streaming", "流式", "分段", "event-stream"],
  },
  {
    id: "lesson26-chat-ui",
    title: "Lesson 26：前端 Chat UI",
    type: "lesson",
    snippet:
      "前端使用 fetch 发送 POST 请求，并通过 response.body.getReader() 一块一块读取 SSE 文本流。",
    keywords: ["chat", "ui", "fetch", "前端", "页面", "getReader"],
  },
  {
    id: "lesson27-token-output",
    title: "Lesson 27：逐字输出与停止生成",
    type: "lesson",
    snippet:
      "前端把模型返回的 delta 放入 pendingText 队列，再用定时器逐字输出，同时使用 AbortController 支持停止生成。",
    keywords: ["逐字", "停止", "abort", "AbortController", "token"],
  },
];

然后根据用户问题做关键词匹配：

function selectSources(message: string): SourceItem[] {
  const normalizedMessage = message.toLowerCase();

  const matched = SOURCE_LIBRARY.filter((source) =>
    source.keywords.some((keyword) =>
      normalizedMessage.includes(keyword.toLowerCase()),
    ),
  );

  const selected = matched.length > 0 ? matched : SOURCE_LIBRARY.slice(0, 3);

  return selected.slice(0, 3).map((source) => ({
    id: source.id,
    title: source.title,
    type: source.type,
    url: source.url,
    snippet: source.snippet,
  }));
}

这不是真正的知识库检索，但它让 UI 先具备 Sources 展示能力。

后面接入真实 RAG 时，只要把 selectSources 替换成向量检索或数据库检索即可。

6. 生成 Trace 事件

本课在 Agent 执行过程中插入了多个 Trace 步骤：

1. 接收请求
2. 准备上下文
3. 输出 Sources
4. 调用大模型

例如：

yield {
  type: "trace",
  step: createTraceStep({
    id: "prepare_context",
    title: "准备上下文",
    status: "running",
    detail: "根据用户问题选择可展示的 Sources，并组织系统提示词。",
  }),
};

完成后再发送：

yield {
  type: "trace",
  step: createTraceStep({
    id: "prepare_context",
    title: "准备上下文",
    status: "completed",
    detail: `已选择 ${sources.length} 条 Sources。`,
    durationMs: Date.now() - prepareStart,
  }),
};

同一个 id 的步骤可以先是 running，后面更新为 completed。

这和真实 Trace 系统很像。

7. 后端 SSE 分发不同事件

第 28 课的 index.ts 中，根据 chunk 类型写入不同 SSE 事件：

for await (const chunk of streamAgentAnswer({ message })) {
  if (closed) {
    break;
  }

  if (chunk.type === "trace") {
    writeSseEvent(raw, "trace", {
      type: "trace",
      step: chunk.step,
    });
  }

  if (chunk.type === "source") {
    writeSseEvent(raw, "source", {
      type: "source",
      source: chunk.source,
    });
  }

  if (chunk.type === "delta") {
    writeSseEvent(raw, "delta", {
      type: "delta",
      content: chunk.content,
    });
  }
}

这说明同一个 SSE 连接中可以传输多种业务事件。

前端只需要根据 payload.type 做不同处理即可。

8. 页面升级为左右布局

第 28 课前端从单一 Chat 页面升级成两栏：

左侧：Chat 对话区
右侧：Trace / Sources 面板

HTML 结构大概是：

<section class="main-grid">
  <section class="chat-shell">
    ...
  </section>

  <aside class="inspector">
    <section class="panel">
      <div class="panel-title">Request</div>
      ...
    </section>

    <section class="panel">
      <div class="panel-title">Trace</div>
      ...
    </section>

    <section class="panel">
      <div class="panel-title">Sources</div>
      ...
    </section>
  </aside>
</section>

右侧面板包含：

1. requestId
2. duration
3. Trace 列表
4. Sources 列表

这让 Agent Demo 看起来更像一个企业级调试页面，而不只是普通聊天框。

9. 前端处理 trace 和 source

前端解析 SSE 后，根据不同事件类型处理：

if (payload.type === "start") {
  requestIdEl.textContent = payload.requestId;
  setStatus("Streaming...");
}

if (payload.type === "trace") {
  upsertTraceStep(payload.step);
}

if (payload.type === "source") {
  appendSource(payload.source);
}

if (payload.type === "delta") {
  enqueueTypingText(payload.content);
}

if (payload.type === "done") {
  durationEl.textContent = `${payload.durationMs}ms`;
  setStatus(`Done · ${payload.durationMs}ms`);
}

其中 upsertTraceStep 表示：

如果这个步骤已经存在，就更新
如果不存在，就新增

这可以支持同一个步骤从 running 变成 completed。

10. 本课完成效果

启动：

pnpm lesson:28

打开：

http://localhost:3001

输入：

Explain SSE streaming in a simple way

页面会出现：

1. 左侧正常逐字输出 AI 回答
2. 右侧显示 requestId
3. Trace 面板显示执行步骤
4. Sources 面板显示参考资料
5. 完成后显示 durationMs

这就是一个最小可观测 Agent Demo。

11. 教学版和真实项目的区别

这一课中的 Sources 是本地模拟的。

真实项目中，Sources 通常来自：

1. 向量数据库检索结果
2. 全文检索结果
3. 企业知识库文档
4. 数据库查询结果
5. 文件解析片段
6. 工具调用返回值

Trace 通常来自：

1. 请求进入
2. 用户身份校验
3. 意图识别
4. 路由判断
5. 工具选择
6. 工具调用
7. 知识库检索
8. 模型调用
9. 重试
10. 最终响应

本课的意义是先把前后端展示协议跑通。

后面只要替换数据来源，就可以升级成真实可观测系统。

12. 本课总结

第 28 课完成后，Agent Demo 不再只是“能回答”，而是开始具备“可解释、可追踪、可调试”的能力。

核心收获：

1. 扩展 SSE 事件类型
2. 把模型输出从 string 流升级为结构化事件流
3. 增加 TraceStep 类型
4. 增加 SourceItem 类型
5. 在后端生成 trace/source/delta 事件
6. 在前端展示 requestId、duration、Trace、Sources
7. 初步理解 Agent 可观测性

这是从 Demo 走向企业级 Agent 产品的重要一步。

下一课会把第 24～28 课做一个阶段性收口：把 Agent Demo 小型产品化，增加会话列表、本地历史记录和更完整的页面布局。

