---

title: "第26课：前端 Chat UI 调用 SSE 流式接口"
slug: "ai-agent-lesson-26-chat-ui-with-sse"
summary: "基于第25课的 SSE 流式接口，使用原生 HTML、CSS 和 JavaScript 实现一个最小 Chat UI，并通过 fetch 读取后端流式响应。"
date: "2026-06-27"
updatedAt: "2026-06-27"
tags: ["AI Agent", "Chat UI", "SSE", "TypeScript", "Frontend"]
series: "Ts AI Agent 学习课程"
seriesSlug: "ts-ai-agent-learning"
seriesOrder: 26
status: "published"
lang: "zh"
cover: ""
seoTitle: "第26课：前端 Chat UI 调用 SSE 流式接口"
seoDescription: "记录 AI Agent 学习路线第 26 课：使用前端 Chat UI 调用后端 SSE 接口，实现流式回答展示。"
---------------------------------------------------------------------------

# 第26课：前端 Chat UI 调用 SSE 流式接口

第 25 课已经完成了后端 SSE 流式接口。

通过命令行可以看到类似这样的分段返回：

```text
event: start
data: ...

event: delta
data: ...

event: done
data: ...
```

但是一个 Agent Demo 如果只能用 curl 测试，还不够直观。

所以第 26 课的目标是：**做一个最小前端 Chat UI，通过浏览器调用后端 SSE 接口，并把模型返回的 delta 内容拼接到页面上。**

---

## 1. 本课目标

第 26 课完成后，浏览器打开：

```text
http://localhost:3001
```

可以看到一个简单的聊天页面。

输入问题后，前端会请求：

```text
POST /api/agent-demo/stream
```

然后不断读取后端返回的 SSE 流，把 `delta.content` 拼接成完整回答。

整体流程是：

```text
用户输入问题
  -> fetch POST 请求
  -> 后端 SSE 流式返回
  -> 前端读取 response.body
  -> 解析 SSE event
  -> 拼接 delta
  -> 更新页面
```

从 Java 后端角度理解，前端这里不是等完整 Response 结束，而是像读取 `InputStream` 一样边读边处理。

---

## 2. 本课目录

第 26 课继续保持一课一个目录：

```text
src/lessons/lesson26-chat-ui
  ├── index.ts
  ├── streamingAgentService.ts
  ├── sse.ts
  ├── types.ts
  └── public
      ├── index.html
      ├── app.js
      └── style.css
```

其中后端部分可以从第 25 课复制：

```text
streamingAgentService.ts
sse.ts
types.ts
```

新增的是 `public` 目录，用来放前端页面。

---

## 3. 使用 Fastify 托管静态页面

为了让同一个服务既提供 API，又提供页面，本课安装了：

```bash
pnpm add @fastify/static
```

然后在 `index.ts` 中增加：

```ts
await server.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/",
});
```

这样浏览器访问：

```text
http://localhost:3001
```

就会返回：

```text
public/index.html
```

这和 Spring Boot 里把页面放到 `static` 目录下有点类似。

---

## 4. 后端继续复用 SSE 接口

第 26 课后端基本复用第 25 课代码。

核心接口仍然是：

```text
POST /api/agent-demo/stream
```

它会发送四类事件：

```text
start  -> 请求开始
delta  -> 模型输出片段
done   -> 请求完成
error  -> 请求失败
```

这说明课程开始进入“前后端结合”阶段。

第 24 课是 API 服务化。

第 25 课是后端流式输出。

第 26 课开始把这个能力真正呈现在浏览器页面中。

---

## 5. 页面结构

本课的 `index.html` 很简单：

```html
<main class="page">
  <section class="chat-shell">
    <header class="chat-header">
      <div>
        <p class="eyebrow">Ts AI Agent 学习课程 · 第二阶段</p>
        <h1>Lesson 26 Chat UI</h1>
      </div>
      <span class="status" id="status">Ready</span>
    </header>

    <section class="messages" id="messages">
      <div class="message assistant">
        <div class="role">AI Agent</div>
        <div class="content">
          你好，我是第 26 课的最小 Chat UI。
        </div>
      </div>
    </section>

    <form class="composer" id="chatForm">
      <textarea id="messageInput" rows="3"></textarea>
      <button type="submit" id="sendButton">发送</button>
    </form>
  </section>
</main>
```

页面主要分三块：

```text
chat-header  -> 顶部标题和状态
messages     -> 消息列表
composer     -> 输入框和发送按钮
```

这是一个最小 Chat UI 的基本结构。

---

## 6. 为什么不用 EventSource

浏览器原生支持 `EventSource`，它也可以读取 SSE。

但是本课没有使用它。

原因是：`EventSource` 更适合 GET 请求，而我们现在的接口是：

```text
POST /api/agent-demo/stream
```

并且需要传 JSON 请求体：

```json
{
  "message": "..."
}
```

所以本课选择使用：

```js
fetch("/api/agent-demo/stream", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message,
  }),
});
```

然后通过：

```js
response.body.getReader()
```

手动读取响应流。

这也是很多 AI Chat 产品中更常见的方式：**使用 POST 提交复杂参数，同时读取流式响应体。**

---

## 7. 前端读取流式响应

第 26 课最关键的代码是：

```js
const reader = response.body.getReader();
const decoder = new TextDecoder("utf-8");

let buffer = "";

while (true) {
  const { value, done } = await reader.read();

  if (done) {
    break;
  }

  buffer += decoder.decode(value, {
    stream: true,
  });

  const parsed = parseSseEvents(buffer);
  buffer = parsed.remaining;

  for (const event of parsed.events) {
    const payload = JSON.parse(event.data);

    if (payload.type === "delta") {
      fullAnswer += payload.content;
      assistantContent.textContent = fullAnswer;
      scrollToBottom();
    }
  }
}
```

这段代码可以拆成几个步骤：

```text
1. response.body.getReader() 获取流读取器
2. reader.read() 一块一块读取响应内容
3. TextDecoder 把二进制内容转成字符串
4. parseSseEvents 按 \n\n 拆分 SSE 事件
5. JSON.parse 解析 data
6. 把 delta.content 拼接到页面上
```

这就是浏览器端处理流式 AI 回答的核心逻辑。

---

## 8. 解析 SSE 事件

SSE 返回的是纯文本，不是直接返回 JSON 数组。

所以前端需要自己解析：

```js
function parseSseEvents(buffer) {
  const events = [];
  const parts = buffer.split("\n\n");

  const remaining = parts.pop() ?? "";

  for (const part of parts) {
    const lines = part.split("\n");

    let eventName = "message";
    let data = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trim();
      }

      if (line.startsWith("data:")) {
        data += line.slice("data:".length).trim();
      }
    }

    if (data) {
      events.push({
        eventName,
        data,
      });
    }
  }

  return {
    events,
    remaining,
  };
}
```

这里的 `remaining` 很重要。

因为浏览器每次读取到的数据块不一定刚好是完整 SSE 事件。

可能出现这种情况：

```text
第一次读到：
event: delta
data: {"content":"hel

第二次读到：
lo"}
```

所以不能简单地每次 `read()` 后直接解析全部内容，而是要保留不完整的部分，等下一次读取后再继续拼接。

---

## 9. 页面状态控制

本课还做了基础状态控制：

```js
setStatus("Thinking...");
sendButton.disabled = true;
input.disabled = true;
```

请求完成后恢复：

```js
sendButton.disabled = false;
input.disabled = false;
input.focus();
```

这样可以避免模型生成过程中重复提交。

虽然这只是一个小细节，但它已经开始接近真实产品逻辑。

一个可用的 AI Chat UI 不只是能显示内容，还需要处理：

```text
1. loading 状态
2. 禁用重复提交
3. 错误提示
4. 自动滚动到底部
5. 输入框焦点恢复
```

第 26 课先实现了最基础的一部分。

---

## 10. 启动和测试

启动第 26 课：

```bash
pnpm lesson:26
```

浏览器打开：

```text
http://localhost:3001
```

输入：

```text
Explain SSE streaming in a simple way
```

或者：

```text
请用 Java 后端工程师能理解的方式解释 SSE 流式输出
```

如果页面能逐段显示 AI 回答，就说明本课完成。

---

## 11. 本课完成效果

第 26 课完成后，系统链路变成：

```text
浏览器 Chat UI
  -> fetch POST
  -> Fastify SSE API
  -> LangChain model.stream
  -> SSE delta event
  -> 前端拼接显示
```

这意味着 Agent Demo 已经从命令行工具，正式进入 Web Demo 阶段。

---

## 12. 本课总结

本课重点不是复杂 UI，而是理解前端如何消费后端流式响应。

核心收获：

```text
1. 使用 @fastify/static 托管前端页面
2. 复用第 25 课 SSE 后端接口
3. 使用 fetch POST 调用流式接口
4. 使用 response.body.getReader() 读取响应流
5. 使用 TextDecoder 解码文本
6. 手写 parseSseEvents 解析 SSE 事件
7. 把 delta.content 拼接显示到页面
```

到这里，Agent Demo 已经有了一个最小可用的浏览器 Chat UI。

下一课会继续优化交互体验：**实现逐字输出和停止生成。**
