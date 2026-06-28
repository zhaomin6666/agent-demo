---
title: "第29课：Agent Demo 小型产品化"
slug: "ai-agent-lesson-29-agent-demo-productization"
summary: "对第24～28课进行阶段性收口，将流式 Agent Demo 升级为带会话列表、本地历史记录、Trace 和 Sources 面板的小型产品原型。"
date: "2026-06-27"
updatedAt: "2026-06-27"
tags: ["AI Agent", "Productization", "Chat UI", "Session", "LocalStorage"]
series: "Ts AI Agent 学习课程"
seriesSlug: "ts-ai-agent-learning"
seriesOrder: 29
status: "published"
lang: "zh"
cover: ""
seoTitle: "第29课：Agent Demo 小型产品化"
seoDescription: "记录 AI Agent 学习路线第 29 课：将流式 Agent Demo 小型产品化，增加会话列表、本地历史记录、错误提示和三栏布局。"
---

# 第29课：Agent Demo 小型产品化

第 24～28 课已经完成了一条完整的 Web Agent Demo 链路：

```text
第24课：HTTP API 服务化
第25课：SSE 流式输出
第26课：前端 Chat UI
第27课：逐字输出 + 停止生成
第28课：Trace + Sources 可观测面板

到这里，Demo 已经能跑，也有不错的交互效果。

但它还更像“功能验证”，不太像一个可以展示给别人看的产品原型。

所以第 29 课的目标是：把前面几课做一个阶段性收口，将 Agent Demo 小型产品化。

1. 本课目标

第 29 课主要增加：

1. 左侧会话列表
2. 新建会话
3. 当前会话标题
4. localStorage 保存聊天记录
5. sessionId
6. requestId
7. duration
8. Trace 和 Sources 持久展示
9. 错误提示区域
10. 三栏产品化布局

最终页面从第 28 课的两栏结构：

Chat 区 + Inspector 区

升级成：

左侧：会话列表
中间：Chat 主区域
右侧：Trace / Sources 可观测面板

这已经更像一个完整的 Agent Demo MVP。

2. 本课目录

第 29 课复制第 28 课：

src/lessons/lesson29-agent-demo-productization
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
    "lesson:29": "tsx src/lessons/lesson29-agent-demo-productization/index.ts"
  }
}

启动：

pnpm lesson:29
3. 增加 sessionId

第 28 课中，每次请求都有 requestId。

但如果要做会话，就还需要 sessionId。

在 types.ts 中，请求类型升级为：

export type AgentStreamRequest = {
  message: string;
  sessionId?: string;
};

事件类型中的 start 和 done 也增加 sessionId：

export type AgentStreamEvent =
  | {
      type: "start";
      requestId: string;
      sessionId: string;
    }
  | {
      type: "done";
      requestId: string;
      sessionId: string;
      durationMs: number;
    };

从 Java 后端角度理解：

class AgentRequest {
    private String message;
    private String sessionId;
}

requestId 用来追踪单次请求。

sessionId 用来追踪一个会话。

4. 后端生成或复用 sessionId

第 29 课的后端接口支持前端传入 sessionId：

const sessionId = request.body.sessionId?.trim() || randomUUID();

如果前端传了，就复用前端会话 ID。

如果没传，就后端生成一个新的。

然后在 start 事件中返回：

writeSseEvent(raw, "start", {
  type: "start",
  requestId,
  sessionId,
});

在 done 事件中也返回：

writeSseEvent(raw, "done", {
  type: "done",
  requestId,
  sessionId,
  durationMs: Date.now() - start,
});

这样前端就可以把一次请求结果关联到当前会话上。

5. 页面升级成三栏布局

第 29 课的 HTML 结构变成：

<main class="app-shell">
  <aside class="sidebar">
    ...
  </aside>

  <section class="chat-shell">
    ...
  </section>

  <aside class="inspector">
    ...
  </aside>
</main>

三栏分别是：

sidebar     会话列表
chat-shell  聊天主区域
inspector   Trace / Sources 面板

这是一个更接近产品的布局。

左侧会话列表中有：

1. 产品标题
2. 新会话按钮
3. 历史会话列表

中间 Chat 区有：

1. 当前会话标题
2. 状态标签
3. 错误提示区域
4. 消息列表
5. 输入框
6. 发送 / 停止按钮

右侧 Inspector 有：

1. sessionId
2. requestId
3. duration
4. Trace
5. Sources
6. 前端会话模型

第 29 课在前端定义了会话结构。

虽然没有显式 TypeScript 类型，但实际数据结构类似：

type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  traces: TraceStep[];
  sources: SourceItem[];
  requestId: string;
  duration: string;
  createdAt: string;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

从 Java 后端角度理解，就是：

class ChatSession {
    String id;
    String title;
    List<ChatMessage> messages;
    List<TraceStep> traces;
    List<SourceItem> sources;
    String requestId;
    String duration;
}

第 29 课先把这个数据保存在浏览器端。

后面真正产品化时，可以迁移到数据库。

7. 使用 localStorage 保存会话

本课使用：

const STORAGE_KEY = "lesson29.agentDemo.sessions.v1";

加载会话：

function loadSessions() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

保存会话：

function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

这样刷新浏览器后，左侧历史会话仍然存在。

这一步虽然很简单，但对 Demo 展示很重要。

因为一个 Chat 产品如果刷新页面就丢失记录，会显得很不完整。

8. 新建会话

点击“新会话”时：

newChatButton.addEventListener("click", () => {
  if (isGenerating) {
    return;
  }

  const session = createSession();
  sessions.unshift(session);
  activeSessionId = session.id;
  saveSessions();
  renderApp();
});

这里有一个小细节：

if (isGenerating) {
  return;
}

如果当前正在生成，不允许切换或新建会话。

这是为了避免当前流式输出还在写入，但用户已经切到另一个会话，导致消息写错位置。

真实产品中也要考虑类似问题。

9. 根据首条消息生成会话标题

新会话默认标题是：

新会话

用户第一次发送消息后，用消息内容生成标题：

function updateSessionTitleFromMessage(message) {
  const session = getActiveSession();

  if (!session || session.title !== "新会话") {
    return;
  }

  session.title = message.length > 24 ? `${message.slice(0, 24)}...` : message;
  activeSessionTitle.textContent = session.title;
}

这和很多 Chat 产品类似。

第一条消息通常就是会话标题的来源。

10. 消息保存和逐字输出结合

第 27 课的逐字输出只更新 DOM。

第 29 课需要同时更新当前会话中的消息记录：

if (currentAssistantMessage) {
  currentAssistantMessage.content = displayedText;
}

这样 AI 回答在逐字显示的同时，也被保存到了 sessions 中。

正常完成时：

stopTypewriter({
  flush: true,
});

会把剩余 pendingText 一次性补齐，并保存到 localStorage。

这一步是产品化中非常关键的细节。

否则用户刷新页面后，只能看到空的 assistant 消息。

11. 错误提示区域

第 29 课增加了错误提示：

<div class="error-box hidden" id="errorBox"></div>

对应方法：

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

请求失败时：

showError(messageText);
setStatus("Error");

这比第 26～28 课只在 assistant 消息里显示错误更清晰。

真实产品里，错误提示通常需要区分：

1. 网络错误
2. 模型调用失败
3. 参数错误
4. 权限错误
5. 超时错误

第 29 课先做一个简单版本。

12. 本课完成效果

启动：

pnpm lesson:29

浏览器打开：

http://localhost:3001

测试：

Explain SSE streaming in a simple way

再点击新会话，输入：

请用 Java 后端工程师能理解的方式解释 Agent 可观测性

刷新页面后，左侧历史会话仍然存在，说明 localStorage 保存成功。

最终效果：

1. 左侧有会话列表
2. 可以新建会话
3. 中间正常流式逐字输出
4. 可以停止生成
5. 右侧显示 sessionId / requestId / duration
6. 右侧显示 Trace 和 Sources
7. 刷新后会话历史仍然存在
13. 第 29 课的意义

第 29 课不是新增某一个 Agent 能力，而是做阶段性整合。

它把第 24～28 课串成一个完整的产品雏形：

HTTP API
  -> SSE 流式输出
  -> Chat UI
  -> 逐字输出
  -> 停止生成
  -> Trace / Sources
  -> 会话历史

这已经可以作为一个简历项目或个人网站项目的基础版本。

如果放到个人网站中，可以描述为：

一个基于 TypeScript、Fastify、LangChain.js 和 OpenAI 兼容模型的 AI Agent Demo，支持流式输出、停止生成、Trace 可观测面板、Sources 展示和本地会话记录。
14. 后续可以如何升级

第 29 课仍然是教学版。

后续可以继续升级：

1. 使用 React / Next.js 重写前端
2. 使用数据库保存会话
3. 增加用户登录
4. 增加真实 RAG Sources
5. 增加工具调用 Trace
6. 接入 LangGraph 持久化状态
7. 增加多 Agent 路由
8. 增加部署脚本
9. 放入个人网站作为项目展示

第 30 课开始，课程会进入多 Agent 阶段。

15. 本课总结

第 29 课完成了第二阶段的小型产品化收口。

核心收获：

1. 增加 sessionId
2. 前端实现会话模型
3. 使用 localStorage 保存会话历史
4. 增加左侧会话列表
5. 增加新会话能力
6. 将逐字输出和消息保存结合
7. 增加错误提示区域
8. 完成三栏 Agent Demo MVP 布局

到这里，第二阶段已经形成一个完整的 AI Agent Web Demo。

下一课进入第三阶段：多 Agent 的本质与 Router Agent。