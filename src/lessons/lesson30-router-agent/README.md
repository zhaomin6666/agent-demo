---
title: "第30课：多 Agent 的本质与 Router Agent"
slug: "ai-agent-lesson-30-router-agent"
summary: "进入多 Agent 阶段，先实现一个最小 Router Agent，根据用户问题选择技术解释、代码助手、学习规划或通用兜底 Agent。"
date: "2026-06-28"
updatedAt: "2026-06-28"
tags: ["AI Agent", "Multi-Agent", "Router Agent", "LangChain.js", "TypeScript"]
series: "Ts AI Agent 学习课程"
seriesSlug: "ts-ai-agent-learning"
seriesOrder: 30
status: "published"
lang: "zh"
cover: ""
seoTitle: "第30课：多 Agent 的本质与 Router Agent"
seoDescription: "记录 AI Agent 学习路线第 30 课：理解多 Agent 的本质，并使用 TypeScript 和 LangChain.js 实现最小 Router Agent。"
---

# 第30课：多 Agent 的本质与 Router Agent

第 24～29 课完成了一个小型 Agent Demo MVP。

它已经具备：

```text
1. HTTP API
2. SSE 流式输出
3. Chat UI
4. 逐字输出
5. 停止生成
6. Trace 面板
7. Sources 面板
8. 本地会话历史

从第 30 课开始，学习路线进入第三阶段：多 Agent Demo。

这一阶段的核心问题是：

什么时候一个 Agent 不够用？
什么时候需要多个 Agent？
多个 Agent 应该如何协作？

第 30 课先从最小模式开始：Router Agent。

1. 什么是多 Agent

很多人一听到多 Agent，就会以为是：

多写几个 prompt
多创建几个模型调用

但这只是表面。

更准确地说，多 Agent 是：

把一个复杂任务拆成多个职责明确的处理单元，
再通过路由、调度、共享状态或协作机制，
让不同处理单元完成不同部分。

从 Java 后端角度理解，它很像：

Controller
  -> Dispatcher
      -> UserService
      -> OrderService
      -> ReportService
      -> KnowledgeBaseService

在 Agent 系统中则是：

用户问题
  -> Router Agent
      -> 技术解释 Agent
      -> 代码助手 Agent
      -> 学习规划 Agent
      -> 通用兜底 Agent

多 Agent 的重点不是数量，而是职责边界和调度机制。

2. 为什么需要 Router Agent

如果只有一个 Agent，它需要同时负责：

1. 技术解释
2. 代码编写
3. 学习规划
4. 问题排查
5. 通用问答

这个 Agent 的 System Prompt 会越来越长，职责会越来越混乱。

而 Router Agent 的作用是先做分流：

用户问题
  -> 先判断问题类型
  -> 再交给合适的专家 Agent

比如：

请解释 SSE 是什么
  -> tech_explainer

帮我写一个 TypeScript fetch SSE 示例
  -> code_helper

帮我规划 LangGraph 学习路线
  -> study_planner

今天状态不好怎么办
  -> general_fallback

这样每个专家 Agent 都可以有更明确的职责和提示词。

3. 本课目标

第 30 课先做命令行 Demo，不接入第 29 课 UI。

目标是运行：

pnpm lesson:30

看到类似结果：

User:
请用 Java 后端工程师能理解的方式解释 SSE 流式输出

Router Decision:
- targetAgent: tech_explainer
- confidence: 0.92
- reason: 用户在询问技术概念解释

Agent Answer:
SSE 可以类比为 Spring MVC 中持续写入 Response 的方式...

本课先把多 Agent 的分工模型跑通。

下一课再把 Router Agent 接回 Chat UI 和 Trace 面板。

4. 本课目录

第 30 课目录：

src/lessons/lesson30-router-agent
  ├── index.ts
  ├── model.ts
  ├── types.ts
  ├── router.ts
  └── agents.ts

运行脚本：

{
  "scripts": {
    "lesson:30": "tsx src/lessons/lesson30-router-agent/index.ts"
  }
}

支持两种运行方式。

直接运行内置示例：

pnpm lesson:30

传入自定义问题：

pnpm lesson:30 "帮我写一个 TypeScript fetch 读取 SSE 的示例"
5. 定义 Agent 类型

在 types.ts 中，先定义目标 Agent：

export type TargetAgent =
  | "tech_explainer"
  | "code_helper"
  | "study_planner"
  | "general_fallback";

本课先设计 4 个专家：

tech_explainer
  技术解释 Agent，负责解释概念、架构、原理、区别。

code_helper
  代码助手 Agent，负责编写代码、排查报错、给出示例。

study_planner
  学习规划 Agent，负责学习路线、课程安排、复习计划。

general_fallback
  通用兜底 Agent，负责无法明确分类的问题。

再定义 Router 的输出：

export type RouterDecision = {
  targetAgent: TargetAgent;
  confidence: number;
  reason: string;
};

这三个字段很重要：

targetAgent  -> 选择哪个 Agent
confidence   -> 有多确定
reason       -> 为什么这么选
6. 复用模型创建方法

在 model.ts 中继续复用前面课程的模型配置：

import { ChatOpenAI } from "@langchain/openai";

export function createChatModel() {
  return new ChatOpenAI({
    model: "qwen3.6-flash",
    temperature: 0.2,
    apiKey: process.env.DASHSCOPE_API_KEY,
    configuration: {
      baseURL: process.env.DASHSCOPE_BASE_URL,
    },
  });
}

这一课的多个 Agent 先使用同一个模型。

不同 Agent 的区别主要来自：

1. 不同 system prompt
2. 不同职责定位
3. 不同输出风格

后面真实项目中，也可以让不同 Agent 使用不同模型、工具或知识库。

7. 实现 Router Agent

router.ts 是本课核心。

Router Agent 的任务是根据用户问题输出 JSON：

{
  "targetAgent": "tech_explainer",
  "confidence": 0.92,
  "reason": "用户在询问技术概念解释"
}

System Prompt 中明确告诉模型：

你是一个 Router Agent，负责判断用户问题应该交给哪个专家 Agent。

可选专家 Agent：
1. tech_explainer：适合解释技术概念、架构、原理、区别。
2. code_helper：适合编写代码、修改代码、排查报错、给出示例。
3. study_planner：适合学习路线、课程安排、复习计划、面试准备。
4. general_fallback：适合无法明确分类的问题。

你必须只返回 JSON，不要返回 Markdown，不要使用代码块。

然后用 Zod 校验输出：

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

这一步非常重要。

因为模型输出不能完全信任，必须校验。

8. JSON 解析和兜底路由

模型有时可能会返回多余文本。

所以本课写了一个简单方法提取 JSON 对象：

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`模型没有返回合法 JSON：${text}`);
  }

  return text.slice(start, end + 1);
}

如果 JSON 解析或 Zod 校验失败，就走规则兜底：

function keywordFallbackRoute(message: string): RouterDecision {
  const normalized = message.toLowerCase();

  const codeKeywords = [
    "code",
    "代码",
    "示例",
    "demo",
    "typescript",
    "javascript",
    "函数",
    "报错",
    "bug",
    "实现",
  ];

  if (codeKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      targetAgent: "code_helper",
      confidence: 0.65,
      reason: "规则兜底：问题包含代码或实现相关关键词。",
    };
  }

  return {
    targetAgent: "general_fallback",
    confidence: 0.5,
    reason: "规则兜底：没有匹配到明确专家，交给通用 Agent。",
  };
}

这体现了一个重要工程思想：

LLM 判断 + 程序兜底

不能把系统稳定性完全交给模型。

9. 实现专家 Agent

在 agents.ts 中，每个专家 Agent 都是同一个模型加不同 System Prompt。

例如技术解释 Agent：

export async function runTechExplainerAgent(
  input: AgentInput,
): Promise<AgentOutput> {
  return runSpecializedAgent(
    "tech_explainer",
    [
      "你是技术解释 Agent。",
      "你的任务是解释技术概念、架构、原理和区别。",
      "回答时优先使用 Java 后端工程师容易理解的类比。",
      "结构建议：先给一句话结论，再解释原理，最后给工程落地理解。",
    ].join("\n"),
    input,
  );
}

代码助手 Agent：

export async function runCodeHelperAgent(
  input: AgentInput,
): Promise<AgentOutput> {
  return runSpecializedAgent(
    "code_helper",
    [
      "你是代码助手 Agent。",
      "你的任务是给出可运行、可理解的代码示例，并解释关键点。",
      "优先使用 TypeScript。",
      "如果用户在问报错，请先定位可能原因，再给出修改方案。",
      "不要只讲概念，要给出代码或伪代码。",
    ].join("\n"),
    input,
  );
}

学习规划 Agent：

export async function runStudyPlannerAgent(
  input: AgentInput,
): Promise<AgentOutput> {
  return runSpecializedAgent(
    "study_planner",
    [
      "你是学习规划 Agent。",
      "你的任务是把学习目标拆成阶段、课程、练习和验收标准。",
      "用户是 Java 后端出身，正在学习 TypeScript、LangChain.js、LangGraph.js 和 AI Agent。",
      "回答要有节奏感，不要一次塞太多任务。",
    ].join("\n"),
    input,
  );
}

每个 Agent 的能力边界更清晰。

10. 根据路由结果调用 Agent

最终通过 runAgentByRoute 分发：

export async function runAgentByRoute(
  input: AgentInput,
): Promise<AgentOutput> {
  switch (input.routerDecision.targetAgent) {
    case "tech_explainer":
      return runTechExplainerAgent(input);

    case "code_helper":
      return runCodeHelperAgent(input);

    case "study_planner":
      return runStudyPlannerAgent(input);

    case "general_fallback":
      return runGeneralFallbackAgent(input);

    default:
      return runGeneralFallbackAgent(input);
  }
}

从 Java 后端角度看，这就像：

switch (targetService) {
    case "order":
        return orderService.handle(request);
    case "user":
        return userService.handle(request);
    default:
        return fallbackService.handle(request);
}

这就是 Router Agent 模式的最小实现。

11. 命令行入口

index.ts 中串起完整流程：

async function runRouterAgentDemo(message: string): Promise<AgentRunResult> {
  const routerDecision = await routeMessage(message);

  const output = await runAgentByRoute({
    message,
    routerDecision,
  });

  return {
    userMessage: message,
    routerDecision,
    output,
  };
}

完整链路是：

用户问题
  -> routeMessage
  -> RouterDecision
  -> runAgentByRoute
  -> 专家 Agent
  -> 输出结果

运行内置示例：

pnpm lesson:30

也可以传自定义问题：

pnpm lesson:30 "请解释 LangGraph 和 LangChain 的区别"
12. Router Agent 和意图识别的区别

前面课程已经做过意图识别。

意图识别关注的是：

用户想干什么

例如：

query_order
create_ticket
ask_knowledge_base
unknown

Router Agent 关注的是：

应该交给哪个执行单元处理

例如：

tech_explainer
code_helper
study_planner
general_fallback

两者很像，但关注点不同：

意图识别：识别用户目的
Router Agent：选择处理者

从 Java 后端角度理解：

意图识别像解析 request type
Router Agent 像 Dispatcher 决定调用哪个 Service
13. 为什么要有 confidence

RouterDecision 中有一个字段：

confidence: number;

它表示 Router 对自己判断的信心。

如果是：

{
  "targetAgent": "code_helper",
  "confidence": 0.95,
  "reason": "用户明确要求编写 TypeScript 示例"
}

说明路由比较确定。

如果是：

{
  "targetAgent": "general_fallback",
  "confidence": 0.42,
  "reason": "用户问题比较模糊，无法判断具体任务类型"
}

后续就可以触发其他策略：

1. 追问用户
2. 进入 fallback
3. 同时调用多个 Agent
4. 让 Supervisor 再判断

第 30 课暂时只是打印 confidence。

后面多 Agent 阶段会继续使用它。

14. 本课完成效果

运行：

pnpm lesson:30

可以看到每个问题都会输出：

User:
...

Router Decision:
- targetAgent: ...
- confidence: ...
- reason: ...

Agent Answer:
...

例如：

请用 Java 后端工程师能理解的方式解释 SSE 流式输出

通常会路由到：

tech_explainer

而：

帮我写一个 TypeScript fetch 读取 SSE 的最小示例

通常会路由到：

code_helper

这说明最小 Router Agent 已经跑通。

15. 本课总结

第 30 课正式进入多 Agent 阶段。

这一课完成的是多 Agent 最基础的模式：Router 模式。

核心收获：

1. 理解多 Agent 不是简单堆 prompt，而是职责拆分和调度机制
2. 定义 TargetAgent 类型
3. 实现 RouterDecision
4. 使用 LLM 判断目标 Agent
5. 使用 Zod 校验模型输出
6. 增加关键词规则兜底
7. 实现多个专家 Agent
8. 根据 Router 结果调用不同 Agent

现在系统已经从：

用户问题 -> 单个 Agent -> 回答

升级成：

用户问题 -> Router Agent -> 专家 Agent -> 回答

下一课可以继续升级：把 Router Agent 接入第 29 课的 Chat UI 和 Trace 面板，让页面展示 Router 决策过程。