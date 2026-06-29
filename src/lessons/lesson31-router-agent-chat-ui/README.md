---

title: "第31课：把 Router Agent 接入 Chat UI 和 Trace 面板"
slug: "ai-agent-lesson-31-router-agent-chat-ui"
summary: "将第30课的 Router Agent 接入第29课的产品化 Chat UI，让前端页面可以展示 selectedAgent、confidence、Trace 和专家 Agent 的流式回答过程。"
date: "2026-06-29"
updatedAt: "2026-06-29"
tags: ["AI Agent", "Multi-Agent", "Router Agent", "Chat UI", "Trace"]
series: "Ts AI Agent 学习课程"
seriesSlug: "ts-ai-agent-learning"
seriesOrder: 31
status: "published"
lang: "zh"
cover: ""
seoTitle: "第31课：把 Router Agent 接入 Chat UI 和 Trace 面板"
seoDescription: "记录 AI Agent 学习路线第 31 课：把 Router Agent 接入前端 Chat UI 和 Trace 面板，实现多 Agent 路由过程可视化。"
--------------------------------------------------------------------------------------------------

# 第31课：把 Router Agent 接入 Chat UI 和 Trace 面板

第 30 课已经实现了命令行版 Router Agent。

它的流程是：

```text
用户问题
  -> Router Agent
  -> targetAgent / confidence / reason
  -> 专家 Agent
  -> 输出回答
```

这个版本可以验证多 Agent 路由逻辑，但还停留在命令行中。

第 31 课的目标是：**把 Router Agent 接入第 29 课的产品化 Chat UI，让多 Agent 路由过程在页面中可视化。**

完成后，页面不只是显示 AI 回答，还会在右侧 Trace 面板中展示：

```text
1. 接收请求
2. Router Agent 判断中
3. Router Agent 决策完成
4. 选择了哪个专家 Agent
5. 专家 Agent 开始流式回答
6. 专家 Agent 回答完成
```

这一步非常关键，因为多 Agent 系统如果不可观测，就很难调试。

---

## 1. 本课目标

第 31 课是在第 29 课和第 30 课的基础上做整合。

第 29 课已经有：

```text
1. Chat UI
2. SSE 流式输出
3. 逐字输出
4. Stop 按钮
5. 会话列表
6. localStorage 会话记录
7. Trace 面板
8. Sources 面板
```

第 30 课已经有：

```text
1. Router Agent
2. targetAgent
3. confidence
4. reason
5. tech_explainer 专家 Agent
6. code_helper 专家 Agent
7. study_planner 专家 Agent
8. general_fallback 专家 Agent
```

第 31 课要把两者合起来：

```text
Chat UI
  -> SSE API
  -> Router Agent
  -> Specialized Agent
  -> Streaming Answer
  -> Trace / Sources 展示路由过程
```

最终效果是：用户在页面里提问，系统先路由，再回答，并把路由过程展示出来。

---

## 2. 本课目录

第 31 课目录如下：

```text
src/lessons/lesson31-router-agent-chat-ui
  ├── index.ts
  ├── model.ts
  ├── types.ts
  ├── router.ts
  ├── agents.ts
  ├── orchestrator.ts
  ├── sse.ts
  └── public
      ├── index.html
      ├── app.js
      └── style.css
```

运行脚本：

```json
{
  "scripts": {
    "lesson:31": "tsx src/lessons/lesson31-router-agent-chat-ui/index.ts"
  }
}
```

启动方式：

```bash
pnpm lesson:31
```

浏览器访问：

```text
http://localhost:3001
```

这一课的目录结构比前几课更完整，因为它开始有了明显的分层：

```text
model.ts        模型创建
router.ts       Router Agent
agents.ts       专家 Agent
orchestrator.ts 编排层
index.ts        HTTP + SSE 服务入口
public          前端页面
```

---

## 3. 第31课的整体架构

第 31 课的完整调用链路是：

```text
浏览器 Chat UI
  -> POST /api/agent-demo/stream
  -> Fastify SSE API
  -> runRouterAgentStream
  -> Router Agent 判断问题类型
  -> 发送 router event
  -> 根据 targetAgent 选择专家 Agent
  -> 专家 Agent 流式生成回答
  -> 发送 delta event
  -> 前端逐字输出
  -> Trace / Sources 面板更新
```

从 Java 后端角度理解，可以类比成：

```text
Controller
  -> OrchestratorService
      -> RouterService
      -> SpecializedAgentService
      -> TraceService
      -> SourceService
  -> SSE Response
```

这里最重要的新角色是：

```text
orchestrator.ts
```

它负责把 Router、专家 Agent、Trace、Sources 串起来。

---

## 4. 扩展类型定义

第 31 课的 `types.ts` 同时整合了第 29 课和第 30 课的类型。

首先定义目标 Agent：

```ts
export type TargetAgent =
  | "tech_explainer"
  | "code_helper"
  | "study_planner"
  | "general_fallback";
```

这四个专家分别代表：

```text
tech_explainer
  技术解释 Agent，适合解释技术概念、架构、原理和区别。

code_helper
  代码助手 Agent，适合写代码、改代码、排查报错、给出示例。

study_planner
  学习规划 Agent，适合学习路线、课程安排、复习计划。

general_fallback
  通用兜底 Agent，适合无法明确分类的问题。
```

Router 的输出类型是：

```ts
export type RouterDecision = {
  targetAgent: TargetAgent;
  confidence: number;
  reason: string;
};
```

其中：

```text
targetAgent  表示选择哪个专家 Agent
confidence   表示判断信心
reason       表示为什么这么选择
```

然后继续保留 Trace 和 Sources 类型：

```ts
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
```

最后把 SSE 流式事件扩展为：

```ts
export type AgentStreamChunk =
  | {
      type: "trace";
      step: TraceStep;
    }
  | {
      type: "router";
      decision: RouterDecision;
    }
  | {
      type: "source";
      source: SourceItem;
    }
  | {
      type: "delta";
      content: string;
    };
```

这一课新增的关键事件是：

```text
router
```

它专门用来把 Router Agent 的决策发送给前端。

---

## 5. 复用 Router Agent

第 31 课的 `router.ts` 基本复用第 30 课。

Router Agent 的职责仍然是根据用户问题返回：

```json
{
  "targetAgent": "tech_explainer",
  "confidence": 0.92,
  "reason": "用户在询问技术概念解释"
}
```

为了让结果更稳定，Router 输出仍然使用：

```text
LLM JSON 输出 + Zod 校验 + 规则兜底
```

核心校验逻辑：

```ts
const routerDecisionSchema = z.object({
  targetAgent: z.enum([
    "tech_explainer",
    "code_helper",
    "study_planner",
    "general_fallback",
  ]),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
});
```

如果模型返回不合法，就走关键词规则兜底。

例如问题中包含：

```text
代码、示例、TypeScript、bug、实现
```

就倾向于路由到：

```text
code_helper
```

如果问题中包含：

```text
学习、路线、课程、复习、roadmap
```

就倾向于路由到：

```text
study_planner
```

这体现了一个重要工程思想：

```text
LLM 负责理解语义
程序负责稳定兜底
```

多 Agent 系统不能完全依赖模型自由发挥，否则路由结果会不稳定。

---

## 6. 专家 Agent 改成流式输出

第 30 课中的专家 Agent 是一次性调用：

```text
invoke -> 返回完整 answer
```

但第 31 课要接入 Chat UI，所以专家 Agent 必须支持流式输出。

因此在 `agents.ts` 中实现了：

```ts
export async function* streamSpecializedAgentAnswer(
  input: AgentInput,
): AsyncGenerator<string> {
  const model = createChatModel();
  const agentName = input.routerDecision.targetAgent;
  const systemPrompt = getAgentSystemPrompt(agentName);

  const stream = await model.stream([
    new SystemMessage(
      [
        systemPrompt,
        "",
        "Router Agent 决策信息：",
        `targetAgent: ${input.routerDecision.targetAgent}`,
        `confidence: ${input.routerDecision.confidence}`,
        `reason: ${input.routerDecision.reason}`,
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

这里有几个重点。

第一，专家 Agent 根据 Router 决策选择 Prompt：

```ts
const agentName = input.routerDecision.targetAgent;
const systemPrompt = getAgentSystemPrompt(agentName);
```

第二，专家 Agent 仍然使用流式输出：

```ts
const stream = await model.stream(...);
```

第三，把 Router 决策信息也放入系统提示词：

```text
Router Agent 决策信息：
targetAgent: ...
confidence: ...
reason: ...
```

这样专家 Agent 可以知道自己为什么被调用。

---

## 7. 不同专家 Agent 的职责

第 31 课中的专家 Agent 仍然是基于不同 System Prompt 实现的。

技术解释 Agent：

```text
你是技术解释 Agent。
你的任务是解释技术概念、架构、原理和区别。
回答时优先使用 Java 后端工程师容易理解的类比。
结构建议：先给一句话结论，再解释原理，最后给工程落地理解。
```

代码助手 Agent：

```text
你是代码助手 Agent。
你的任务是给出可运行、可理解的代码示例，并解释关键点。
优先使用 TypeScript。
如果用户在问报错，请先定位可能原因，再给出修改方案。
不要只讲概念，要给出代码或伪代码。
```

学习规划 Agent：

```text
你是学习规划 Agent。
你的任务是把学习目标拆成阶段、课程、练习和验收标准。
用户是 Java 后端出身，正在学习 TypeScript、LangChain.js、LangGraph.js 和 AI Agent。
回答要有节奏感，不要一次塞太多任务。
```

通用兜底 Agent：

```text
你是通用兜底 Agent。
当问题不适合明确专家时，你负责给出清晰、稳妥、简洁的回答。
如果问题信息不足，可以说明你的假设，并给出可继续推进的建议。
```

目前这几个专家 Agent 的区别主要是 Prompt。

后面真实项目中，还可以继续扩展为：

```text
1. 不同专家 Agent 使用不同模型
2. 不同专家 Agent 使用不同工具
3. 不同专家 Agent 访问不同知识库
4. 不同专家 Agent 具备不同权限
5. 不同专家 Agent 输出不同结构
```

---

## 8. 新增 Orchestrator 编排层

第 31 课最关键的新文件是：

```text
orchestrator.ts
```

它负责把 Router 和专家 Agent 串成一个完整流程。

核心方法是：

```ts
export async function* runRouterAgentStream(
  input: AgentStreamRequest,
): AsyncGenerator<AgentStreamChunk> {
  ...
}
```

这个方法本身也是一个异步生成器。

它会不断 yield 不同类型的事件：

```text
trace
router
source
delta
trace
```

完整流程如下：

```text
1. 发送 Router running trace
2. 调用 routeMessage
3. 发送 router decision event
4. 发送 Router completed trace
5. 发送 Router source
6. 发送 Agent source
7. 发送专家 Agent running trace
8. 流式调用专家 Agent
9. 持续发送 delta
10. 发送专家 Agent completed trace
```

这说明第 31 课开始出现了真正的 Agent 编排思想。

---

## 9. Router Trace

在调用 Router 之前，先发送：

```ts
yield {
  type: "trace",
  step: createTraceStep({
    id: "router_decision",
    title: "Router Agent 判断",
    status: "running",
    detail: "正在判断用户问题应该交给哪个专家 Agent。",
  }),
};
```

Router 判断完成后，再发送：

```ts
yield {
  type: "trace",
  step: createTraceStep({
    id: "router_decision",
    title: "Router Agent 判断",
    status: "completed",
    detail: `选择 ${getAgentDisplayName(decision.targetAgent)}，confidence=${decision.confidence}。原因：${decision.reason}`,
    durationMs: Date.now() - routeStart,
  }),
};
```

这样前端 Trace 面板就能看到 Router 的完整生命周期：

```text
Router Agent 判断 running
Router Agent 判断 completed
```

如果路由错误，至少可以看到：

```text
1. Router 选了谁
2. confidence 是多少
3. reason 是什么
```

这对调试多 Agent 非常重要。

---

## 10. 发送 router 事件

第 31 课新增了一个专门的事件：

```ts
yield {
  type: "router",
  decision,
};
```

后端 SSE 层会把它转成：

```ts
writeSseEvent(raw, "router", {
  type: "router",
  decision: chunk.decision,
});
```

前端收到后，可以更新右侧 Request 面板：

```text
selectedAgent
confidence
```

这样 Router 决策就不只是隐藏在后端日志里，而是直接展示在 UI 中。

---

## 11. Router Sources

第 31 课还把 Router 决策也作为一种 Source 展示出来。

例如：

```ts
function createRouterSource(decision: RouterDecision): SourceItem {
  return {
    id: `router-${decision.targetAgent}`,
    title: `Router 选择：${getAgentDisplayName(decision.targetAgent)}`,
    type: "tool",
    snippet: `confidence=${decision.confidence}。原因：${decision.reason}`,
  };
}
```

这意味着 Sources 不一定只是知识库文档，也可以是工具或中间决策结果。

另一个 Source 是专家 Agent 本身：

```ts
function createAgentSource(decision: RouterDecision): SourceItem {
  const displayName = getAgentDisplayName(decision.targetAgent);

  return {
    id: `agent-${decision.targetAgent}`,
    title: displayName,
    type: "memory",
    snippet: `本次回答由 ${displayName} 生成。该 Agent 的职责由 Router Agent 根据用户问题动态选择。`,
  };
}
```

这让右侧 Sources 面板能看到：

```text
1. Router 为什么选择这个 Agent
2. 本次回答由哪个专家 Agent 生成
```

虽然这还不是传统意义上的 RAG Sources，但对多 Agent 可观测性很有帮助。

---

## 12. SSE API 支持 router 事件

第 31 课的 `index.ts` 继续复用第 29 课的 Fastify + SSE 结构。

核心变化是把原来的单 Agent 流：

```ts
streamAgentAnswer(...)
```

替换成：

```ts
runRouterAgentStream(...)
```

在 SSE 循环中增加：

```ts
if (chunk.type === "router") {
  writeSseEvent(raw, "router", {
    type: "router",
    decision: chunk.decision,
  });
}
```

所以现在后端支持的事件包括：

```text
start
trace
router
source
delta
done
error
```

事件协议更完整了。

---

## 13. 前端 Request 面板增加 Router 信息

第 31 课在右侧 Request 面板增加了两个字段：

```html
<div class="meta-row">
  <span>selectedAgent</span>
  <strong id="selectedAgent">-</strong>
</div>
<div class="meta-row">
  <span>confidence</span>
  <strong id="routerConfidence">-</strong>
</div>
```

原本 Request 面板只有：

```text
sessionId
requestId
duration
```

现在变成：

```text
sessionId
requestId
selectedAgent
confidence
duration
```

这让用户可以直观看到本次请求被分配给了哪个专家 Agent。

---

## 14. 前端处理 router 事件

在 `app.js` 中新增 DOM 引用：

```js
const selectedAgentEl = document.querySelector("#selectedAgent");
const routerConfidenceEl = document.querySelector("#routerConfidence");
```

然后增加 Agent 名称格式化方法：

```js
function formatAgentName(agentName) {
  const names = {
    tech_explainer: "技术解释 Agent",
    code_helper: "代码助手 Agent",
    study_planner: "学习规划 Agent",
    general_fallback: "通用兜底 Agent",
  };

  return names[agentName] ?? agentName;
}
```

处理 SSE 事件时新增：

```js
if (payload.type === "router") {
  const agentLabel = formatAgentName(payload.decision.targetAgent);

  session.selectedAgent = agentLabel;
  session.routerConfidence = String(payload.decision.confidence);

  selectedAgentEl.textContent = agentLabel;
  routerConfidenceEl.textContent = String(payload.decision.confidence);

  saveSessions();
}
```

这样每次 Router 决策完成后，前端会同步更新：

```text
1. 当前 session 数据
2. 右侧 Request 面板
3. localStorage 会话记录
```

刷新页面后，历史会话也能保留 selectedAgent 和 confidence。

---

## 15. localStorage 会话结构升级

第 29 课的 session 中保存了：

```text
messages
traces
sources
requestId
duration
```

第 31 课新增：

```js
selectedAgent: "-",
routerConfidence: "-",
```

完整结构类似：

```ts
type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  traces: TraceStep[];
  sources: SourceItem[];
  requestId: string;
  duration: string;
  selectedAgent: string;
  routerConfidence: string;
  createdAt: string;
  updatedAt: string;
};
```

这说明会话历史不只是保存聊天内容，也保存 Agent 运行元信息。

这对后续做 Agent 调试、回放和评估都很重要。

---

## 16. 启动和测试

启动第 31 课：

```bash
pnpm lesson:31
```

浏览器打开：

```text
http://localhost:3001
```

测试技术解释问题：

```text
请用 Java 后端工程师能理解的方式解释 SSE 流式输出
```

预期右侧显示：

```text
selectedAgent: 技术解释 Agent
```

测试代码问题：

```text
帮我写一个 TypeScript fetch 读取 SSE 的最小示例
```

预期右侧显示：

```text
selectedAgent: 代码助手 Agent
```

测试学习规划问题：

```text
帮我规划一下 LangGraph 多 Agent 的学习路线
```

预期右侧显示：

```text
selectedAgent: 学习规划 Agent
```

同时 Trace 面板应该能看到：

```text
1. 接收请求
2. Router Agent 判断
3. 专家 Agent 回答
```

Sources 面板中也会显示 Router 决策和专家 Agent 信息。

---

## 17. 第31课和第30课的区别

第 30 课是命令行版：

```text
用户问题
  -> Router Agent
  -> 专家 Agent
  -> console 输出
```

第 31 课是 Web 版：

```text
用户问题
  -> Chat UI
  -> SSE API
  -> Router Agent
  -> router event
  -> 专家 Agent
  -> delta event
  -> 前端逐字输出
  -> Trace / Sources 面板展示过程
```

第 31 课最重要的变化是：

```text
Router 决策变成了可观测事件。
```

这意味着开发者不需要去后端日志里猜测系统做了什么，而是可以直接从页面看到：

```text
1. Router 是否执行
2. 选择了哪个 Agent
3. confidence 是多少
4. reason 是什么
5. 专家 Agent 是否开始回答
6. 专家 Agent 是否完成
```

这就是多 Agent Demo 从“能跑”到“可调试”的关键一步。

---

## 18. Router 模式的局限

第 31 课实现的是 Router 模式。

Router 模式的特点是：

```text
一次路由
一次执行
一个专家 Agent 负责回答
```

它适合问题边界比较清晰的场景：

```text
1. 技术解释
2. 代码编写
3. 学习规划
4. 通用问答
```

但它也有局限。

如果用户的问题本身需要多个专家协作，比如：

```text
帮我设计一个多 Agent 项目，并给出代码结构和学习计划
```

这个问题可能同时需要：

```text
1. 技术解释 Agent
2. 代码助手 Agent
3. 学习规划 Agent
```

单次 Router 只能选一个专家，就不太够了。

这就是下一阶段要学习 Supervisor / Worker 模式的原因。

---

## 19. Router Agent 接入 Trace 的意义

多 Agent 系统最大的问题之一是：**调试复杂。**

如果没有 Trace，用户只看到一个最终答案。

当答案不好时，很难知道问题出在哪里：

```text
1. 是 Router 选错了 Agent？
2. 是专家 Agent Prompt 不合适？
3. 是模型输出不稳定？
4. 是 Sources 给错了？
5. 是前端解析问题？
```

第 31 课把 Router 过程加入 Trace 后，至少可以定位第一层问题：

```text
Router 是否选对？
confidence 是否过低？
reason 是否合理？
```

这就是 Agent 可观测性的实际价值。

---

## 20. 本课总结

第 31 课完成了多 Agent 阶段的重要一步：**把 Router Agent 接入 Chat UI 和 Trace 面板。**

核心收获：

```text
1. 复用第 29 课产品化 Chat UI
2. 复用第 30 课 Router Agent
3. 新增 router SSE 事件
4. 新增 orchestrator 编排层
5. 专家 Agent 改为流式输出
6. 前端展示 selectedAgent 和 confidence
7. Trace 面板展示 Router 判断过程
8. Sources 面板展示 Router 决策和专家 Agent 信息
9. localStorage 保存多 Agent 运行元信息
```

到这里，系统已经从单 Agent Chat Demo 升级成了最小多 Agent Web Demo。

当前链路是：

```text
Chat UI
  -> Router Agent
  -> Specialized Agent
  -> Streaming Answer
  -> Trace / Sources
```

下一课可以继续进入：

```text
第32课：Supervisor / Worker 多 Agent 模式
```

第 31 课的 Router 模式是“分流”。

第 32 课会进一步学习“协作”：

```text
Supervisor Agent
  -> 分析任务
  -> 决定调用一个或多个 Worker
  -> 汇总结果
```

也就是从“选一个 Agent 回答”升级到“多个 Agent 协作完成任务”。
