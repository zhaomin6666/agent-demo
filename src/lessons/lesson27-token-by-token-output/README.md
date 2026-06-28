---

title: "第27课：实现逐字输出与中断生成"
slug: "ai-agent-lesson-27-token-output-and-stop-generation"
summary: "在前端 Chat UI 中实现逐字输出效果，并使用 AbortController 支持停止生成，让 Agent Demo 更接近真实 AI Chat 产品体验。"
date: "2026-06-27"
updatedAt: "2026-06-27"
tags: ["AI Agent", "Chat UI", "Streaming", "AbortController", "TypeScript"]
series: "Ts AI Agent 学习课程"
seriesSlug: "ts-ai-agent-learning"
seriesOrder: 27
status: "published"
lang: "zh"
cover: ""
seoTitle: "第27课：实现逐字输出与中断生成"
seoDescription: "记录 AI Agent 学习路线第 27 课：基于 SSE Chat UI 实现逐字输出、停止生成和前端流式状态控制。"
-----------------------------------------------------------------------------

# 第27课：实现逐字输出与中断生成

第 26 课已经完成了一个最小 Chat UI。

它可以调用后端 SSE 接口，并把模型返回的 `delta.content` 拼接显示到页面上。

但是它还有两个问题：

```text
1. 模型返回一段，页面就直接显示一段，体验不够像真实 ChatGPT
2. 用户点击发送后，只能等它生成结束，不能主动停止
```

所以第 27 课的目标是：**实现逐字输出效果，并增加停止生成能力。**

---

## 1. 本课目标

第 27 课要完成：

```text
1. 把后端返回的 delta 放入前端缓冲区
2. 使用定时器逐字输出
3. 增加闪烁光标
4. 增加 Stop 按钮
5. 使用 AbortController 中断 fetch 请求
6. 后端通过 close 事件感知连接关闭
```

最终效果是：

```text
用户提问
  -> AI 开始生成
  -> 前端逐字显示
  -> Stop 按钮可点击
  -> 点击 Stop 后停止接收和输出
```

这比第 26 课更接近真实 AI Chat 产品。

---

## 2. 本课目录

第 27 课继续一课一个目录：

```text
src/lessons/lesson27-token-by-token-output
  ├── index.ts
  ├── streamingAgentService.ts
  ├── sse.ts
  ├── types.ts
  └── public
      ├── index.html
      ├── app.js
      └── style.css
```

可以直接复制第 26 课：

```bash
cp -r src/lessons/lesson26-chat-ui/* \
  src/lessons/lesson27-token-by-token-output/
```

然后重点修改前端代码。

---

## 3. 增加 Stop 按钮

第 27 课在页面中增加了一个停止按钮：

```html
<div class="actions">
  <button type="submit" id="sendButton">发送</button>
  <button type="button" id="stopButton" class="secondary" disabled>
    停止
  </button>
</div>
```

默认情况下，Stop 按钮是禁用的。

当 AI 正在生成时：

```js
sendButton.disabled = true;
stopButton.disabled = false;
input.disabled = true;
```

生成结束后恢复：

```js
sendButton.disabled = false;
stopButton.disabled = true;
input.disabled = false;
```

这个状态控制让用户能明确知道当前是否正在生成。

---

## 4. 从“直接显示”改成“逐字输出”

第 26 课的显示逻辑是：

```js
fullAnswer += payload.content;
assistantContent.textContent = fullAnswer;
```

也就是收到一段，就显示一段。

第 27 课改成：

```text
收到 delta -> 放入 pendingText
定时器 -> 每次取 1 个字符显示
```

核心状态变量如下：

```js
let typingTimer = null;
let pendingText = "";
let displayedText = "";
let currentAssistantContent = null;
```

其中：

```text
pendingText      还没显示出来的内容
displayedText    已经显示出来的内容
typingTimer      定时器
```

收到模型输出时，不直接显示，而是入队：

```js
function enqueueTypingText(text) {
  pendingText += text;
}
```

然后通过定时器逐字输出：

```js
function startTypewriter() {
  typingTimer = setInterval(() => {
    if (!currentAssistantContent) {
      return;
    }

    if (pendingText.length === 0) {
      return;
    }

    const nextChar = pendingText.slice(0, 1);
    pendingText = pendingText.slice(1);

    displayedText += nextChar;
    currentAssistantContent.textContent = displayedText;

    scrollToBottom();
  }, 24);
}
```

这样就实现了打字机效果。

从 Java 后端角度类比，可以理解为：

```text
模型返回内容 -> 放入队列
定时任务 -> 每次从队列取一小段 -> 更新 UI
```

---

## 5. 闪烁光标效果

为了让输出更像 AI Chat，本课增加了一个 CSS 光标：

```css
.cursor::after {
  content: "▋";
  display: inline-block;
  margin-left: 2px;
  animation: blink 1s infinite;
  opacity: 0.8;
}

@keyframes blink {
  0%,
  45% {
    opacity: 0.8;
  }

  46%,
  100% {
    opacity: 0;
  }
}
```

生成开始时添加：

```js
currentAssistantContent.classList.add("cursor");
```

生成结束时移除：

```js
currentAssistantContent.classList.remove("cursor");
```

这个细节虽然简单，但对体验提升很明显。

---

## 6. 使用 AbortController 中断请求

第 27 课另一个重点是停止生成。

浏览器中断 fetch 请求的标准方式是使用 `AbortController`：

```js
currentAbortController = new AbortController();
```

请求时传入：

```js
const response = await fetch("/api/agent-demo/stream", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message,
  }),
  signal: currentAbortController.signal,
});
```

点击停止时：

```js
function stopGenerating() {
  if (!isGenerating) {
    return;
  }

  if (currentAbortController) {
    currentAbortController.abort();
  }

  setStatus("Stopped");
  setGeneratingState(false);
  stopTypewriter({
    flush: false,
  });
}
```

这会让浏览器主动中断当前请求。

---

## 7. 后端如何感知中断

前端调用 `abort()` 后，HTTP 连接会关闭。

后端在前面课程里已经有这段代码：

```ts
let closed = false;

raw.on("close", () => {
  closed = true;
});
```

在写入模型输出时判断：

```ts
if (closed) {
  break;
}
```

所以前端停止后，后端会停止继续向这个响应写入内容。

不过需要注意：模型服务可能已经提前生成了一些内容，Node.js 也可能已经读取了一部分，所以点击停止后，服务端日志里可能还会短暂出现少量输出。

这是正常现象。

本课的目标是实现：

```text
前端停止接收
+
后端停止继续写入
```

不是完全取消远端模型内部已经开始的生成任务。

---

## 8. flush 的取舍

停止打字机时，本课设计了一个参数：

```js
function stopTypewriter({ flush = false } = {}) {
  if (flush && currentAssistantContent && pendingText.length > 0) {
    displayedText += pendingText;
    pendingText = "";
    currentAssistantContent.textContent = displayedText;
  }

  clearInterval(typingTimer);
}
```

这里的 `flush` 表示：是否把已经收到但还没逐字显示出来的内容一次性补全。

两种体验不同：

```text
flush: true
  -> 已经收到的内容会立即显示出来

flush: false
  -> pendingText 中还没显示的内容会被丢弃
```

更接近 ChatGPT 的 Stop 行为，通常是 `flush: false`。

但如果想保留浏览器已经收到的数据，也可以用 `flush: true`。

本课在正常完成时使用：

```js
stopTypewriter({
  flush: true,
});
```

在用户主动停止时使用：

```js
stopTypewriter({
  flush: false,
});
```

这样比较符合直觉。

---

## 9. 状态控制

第 27 课增加了一个统一状态方法：

```js
function setGeneratingState(generating) {
  isGenerating = generating;

  sendButton.disabled = generating;
  stopButton.disabled = !generating;
  input.disabled = generating;
}
```

这样发送、停止、异常、完成时，都能统一更新 UI 状态。

这类状态管理在真实项目里非常重要。

如果没有统一状态，很容易出现：

```text
1. 请求结束了但按钮还禁用
2. 请求中途失败但输入框不能恢复
3. 用户重复点击导致多个请求同时输出
4. Stop 按钮状态和实际请求状态不一致
```

第 27 课虽然还是原生 JS，但已经开始体现前端状态管理思维。

---

## 10. 启动和测试

启动第 27 课：

```bash
pnpm lesson:27
```

浏览器打开：

```text
http://localhost:3001
```

测试问题：

```text
Explain SSE streaming in a simple way
```

预期效果：

```text
1. AI 回答逐字显示
2. 输出时有闪烁光标
3. 发送按钮禁用
4. 停止按钮启用
5. 点击停止后，输出停止
6. 请求完成后，按钮状态恢复
```

---

## 11. 本课完成效果

第 27 课完成后，Agent Demo 的体验又前进了一步。

第 26 课是：

```text
收到 delta -> 直接显示
```

第 27 课是：

```text
收到 delta -> 进入 pendingText
定时器 -> 逐字输出
Stop 按钮 -> AbortController 中断请求
```

这已经非常接近真实 AI Chat 产品的基础交互。

---

## 12. 本课总结

第 27 课的核心收获：

```text
1. 理解逐字输出不是后端必须逐字返回，而是前端可以做显示节奏控制
2. 使用 pendingText 缓冲模型输出
3. 使用 setInterval 实现打字机效果
4. 使用 CSS 增加闪烁光标
5. 使用 AbortController 中断 fetch 请求
6. 使用 close 事件让后端感知连接关闭
7. 通过统一状态方法管理发送、停止、完成、异常状态
```

到这里，Agent Demo 已经具备了一个 AI Chat 产品最基本的交互体验。

下一课会继续升级：**在页面中展示 Trace 和 Sources，让 Agent 不只是回答，还能展示回答过程和参考来源。**
