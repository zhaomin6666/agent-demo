---

title: "第25课：给 Agent API 增加 SSE 流式输出"
slug: "ai-agent-lesson-25-sse-streaming-api"
summary: "把 Agent API 从一次性 JSON 返回升级为 SSE 流式输出，让后端可以像 ChatGPT 一样边生成边返回内容。"
date: "2026-06-27"
updatedAt: "2026-06-27"
tags: ["AI Agent", "SSE", "LangChain.js", "TypeScript"]
series: "Ts AI Agent 学习课程"
seriesSlug: "ts-ai-agent-learning"
seriesOrder: 25
status: "published"
lang: "zh"
cover: ""
seoTitle: "第25课：给 Agent API 增加 SSE 流式输出"
seoDescription: "记录 AI Agent 学习路线第 25 课：使用 Fastify 和 LangChain.js 给 Agent API 增加 SSE 流式输出能力。"
---------------------------------------------------------------------------------------------

# 第25课：给 Agent API 增加 SSE 流式输出

在第 24 课中，我已经把 Agent Demo 从本地脚本封装成了一个 HTTP API。它可以接收用户输入，调用大模型，然后返回完整 JSON 结果。

但是这种方式有一个明显问题：**用户必须等模型完整生成结束后，才能看到回答。**

真实的 ChatGPT、Claude 这类产品并不是这样。它们通常是一边生成，一边把内容推送到前端，用户可以马上看到回答开始出现。

所以第 25 课的目标是：**给 Agent API 增加 SSE 流式输出能力。**

---

## 1. 为什么需要流式输出

普通 HTTP API 的调用方式大概是：

```text
用户发送请求
  -> 后端调用模型
  -> 等模型完整返回
  -> 后端一次性返回 JSON
```

这种方式实现简单，但体验不够好。

如果模型回答需要 10 秒，用户就要面对 10 秒空白页面。

而流式输出的方式是：

```text
用户发送请求
  -> 后端调用模型
  -> 模型生成一段
  -> 后端发送一段
  -> 模型再生成一段
  -> 后端再发送一段
  -> 最后发送 done 事件
```

这样用户可以马上看到内容开始出现。

从 Java 后端角度理解，普通接口像是：

```java
return response;
```

而 SSE 流式接口更像是：

```java
response.write(chunk1);
response.write(chunk2);
response.write(chunk3);
response.end();
```

不是等所有内容准备好再返回，而是边生成边写入响应流。

---

## 2. 本课目录

这一课仍然保持之前课程的目录风格：

```text
src/lessons/lesson25-sse-streaming
  ├── index.ts
  ├── streamingAgentService.ts
  ├── sse.ts
  └── types.ts
```

并在 `package.json` 中增加脚本：

```json
{
  "scripts": {
    "lesson:25": "tsx src/lessons/lesson25-sse-streaming/index.ts"
  }
}
```

运行方式保持一致：

```bash
pnpm lesson:25
```

---

## 3. SSE 的基本格式

SSE，全称是 Server-Sent Events。

它的响应类型是：

```text
text/event-stream
```

服务端发送的数据格式类似：

```text
event: start
data: {"type":"start","requestId":"xxx"}

event: delta
data: {"type":"delta","content":"你好"}

event: delta
data: {"type":"delta","content":"，这是后续内容"}

event: done
data: {"type":"done","durationMs":1234}
```

每一个事件之间通过空行分隔，也就是 `\n\n`。

所以我在本课中封装了一个简单的 `writeSseEvent` 方法：

```ts
import type { ServerResponse } from "node:http";

export function writeSseEvent(
  raw: ServerResponse,
  event: string,
  data: unknown,
): void {
  raw.write(`event: ${event}\n`);
  raw.write(`data: ${JSON.stringify(data)}\n\n`);
}
```

这个方法的作用是把一个普通对象转换成 SSE 事件格式，并写入 HTTP 响应流。

---

## 4. 定义流式事件类型

在 `types.ts` 中，我定义了本课需要用到的事件类型：

```ts
export type AgentStreamRequest = {
  message: string;
};

export type AgentStreamEvent =
  | {
      type: "start";
      requestId: string;
    }
  | {
      type: "delta";
      content: string;
    }
  | {
      type: "done";
      requestId: string;
      durationMs: number;
    }
  | {
      type: "error";
      requestId: string;
      message: string;
    };
```

这里先设计了四类事件：

```text
start  -> 请求开始
delta  -> 模型生成的一段内容
done   -> 请求完成
error  -> 请求失败
```

这个设计后面还会继续扩展。比如第 28 课会增加 `trace` 和 `source` 事件。

---

## 5. 使用 model.stream 获取模型分段输出

第 24 课中使用的是：

```ts
model.invoke(...)
```

它会等模型完整回答结束后再返回。

第 25 课改成：

```ts
model.stream(...)
```

核心代码如下：

```ts
export async function* streamAgentAnswer(
  input: AgentStreamRequest,
): AsyncGenerator<string> {
  const model = createModel();

  const stream = await model.stream([
    new SystemMessage(
      [
        "你是一个企业级 AI Agent Demo 助手。",
        "你的回答要清晰、结构化。",
        "请尽量使用 Java 后端工程师容易理解的类比。",
        "回答时可以分段，但不要过度冗长。",
      ].join("\n"),
    ),
    new HumanMessage(input.message),
  ]);

  for await (const chunk of stream) {
    const text = contentToText(chunk.content);

    if (text) {
      yield text;
    }
  }
}
```

这里用了 TypeScript 的 `async function*`。

它可以理解为一个异步生成器：

```text
模型生成一段 -> yield 一段
模型再生成一段 -> yield 一段
```

从 Java 角度类比，有点像：

```java
Iterator<String>
```

只不过它是异步的，每次产生结果都需要等待模型生成。

---

## 6. Fastify 中手动写入 SSE 响应

本课的核心接口是：

```text
POST /api/agent-demo/stream
```

在 Fastify 中，为了持续写入响应流，需要使用：

```ts
reply.hijack();
const raw = reply.raw;
```

关键代码如下：

```ts
reply.hijack();

const raw = reply.raw;

raw.writeHead(200, {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
});

raw.flushHeaders();
```

然后先发送 `start` 事件：

```ts
writeSseEvent(raw, "start", {
  type: "start",
  requestId,
});
```

接着循环读取模型输出：

```ts
for await (const content of streamAgentAnswer({ message })) {
  if (closed) {
    break;
  }

  writeSseEvent(raw, "delta", {
    type: "delta",
    content,
  });
}
```

最后发送 `done` 事件：

```ts
writeSseEvent(raw, "done", {
  type: "done",
  requestId,
  durationMs: Date.now() - start,
});

raw.end();
```

这样，后端就不再是一次性返回 JSON，而是持续不断地向客户端写入事件。

---

## 7. 处理客户端断开连接

流式接口还有一个细节：客户端可能会中途断开连接。

比如用户关闭页面，或者后面前端点击了“停止生成”。

所以本课增加了：

```ts
let closed = false;

raw.on("close", () => {
  closed = true;
});
```

在循环写入时判断：

```ts
if (closed) {
  break;
}
```

这样可以避免客户端已经断开后，服务端还一直尝试写入响应。

这也是后面实现 Stop 按钮的基础。

---

## 8. Windows 下 curl 测试问题

本课测试时我遇到了一个 Windows 环境相关的问题。

在 PowerShell 中直接使用：

```powershell
curl -N -X POST ...
```

可能并不是真正的 curl，而是 PowerShell 的 `Invoke-WebRequest` 别名。

所以 PowerShell 中应该明确使用：

```powershell
curl.exe
```

另外，在 Git Bash 或 PowerShell 中直接传中文 JSON，有时会遇到：

```text
FST_ERR_CTP_INVALID_CONTENT_LENGTH
Request body size did not match Content-Length
```

这通常是命令行编码导致请求体字节数和 `Content-Length` 不一致。

最终我使用英文内容测试成功：

```bash
curl.exe -N -X POST "http://localhost:3001/api/agent-demo/stream" \
  -H "Content-Type: application/json" \
  -d '{"message":"Explain SSE streaming in a simple way"}'
```

返回结果可以看到分段输出：

```text
event: start
data: ...

event: delta
data: ...

event: done
data: ...
```

这说明后端 SSE 流式接口已经跑通。

---

## 9. 本课完成效果

第 25 课完成后，Agent API 已经从：

```text
等待完整模型结果 -> 一次性返回 JSON
```

升级成：

```text
模型生成一段 -> 后端发送一段 -> 客户端接收一段
```

也就是具备了 ChatGPT 类产品最基础的流式输出能力。

---

## 10. 本课总结

这一课的重点不是 UI，而是后端流式响应机制。

核心收获：

```text
1. 理解了 SSE 的事件格式
2. 使用 text/event-stream 返回流式响应
3. 使用 model.stream 获取模型分段输出
4. 使用 AsyncGenerator 封装模型流
5. 使用 reply.raw 手动写入响应
6. 处理客户端连接关闭
7. 使用 curl.exe -N 测试流式输出
```

到这里，Agent Demo 已经有了一个真正接近 AI 产品体验的后端基础。

下一课会继续往前走：**做一个前端 Chat UI，使用浏览器读取 SSE 流，并把 delta 内容拼接显示出来。**
