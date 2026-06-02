# 第 4 课：封装可复用的 Intent Classifier，为 Agent 工具调用做准备

## 前言

前面几节课已经完成了 AI Agent 项目的基础能力。

第 1 课完成了：

```text
TypeScript 项目初始化
pnpm 包管理
LangChain.js 调用大模型
阿里云百炼 / 通义千问 OpenAI 兼容接口接入
```

第 2 课学习了：

```text
SystemMessage
HumanMessage
AIMessage
ChatPromptTemplate
Prompt 模板
```

第 3 课学习了：

```text
让大模型输出 JSON
使用 zod 校验结构化结果
处理模型输出不稳定的问题
```

第 4 课开始，我们不再只写一个 Demo，而是把上一课的意图识别能力封装成一个可复用模块：

```ts
const classifier = new IntentClassifier();

const result = await classifier.classify(
  "帮我查一下订单 20240518001 的处理进度"
);
```

这一课的目标是让意图识别从“能跑”变成“后续 Agent 流程可以复用”。

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解 Intent Classifier 在 Agent 中的作用
2. 将第 3 课的结构化输出逻辑封装成 class
3. 增加 success / rawOutput / errorMessage 字段
4. 增加 fallback 兜底结果
5. 支持多个用户输入批量测试
6. 为后续 Tool Calling 做准备
```

这一课依然不引入复杂工具调用，重点是完成 Agent 的前置判断模块。

---

## 二、为什么需要 Intent Classifier？

在普通聊天应用中，用户说什么，模型直接回答即可。

但在 Agent 应用中，用户输入后，系统通常需要先判断：

```text
用户到底想做什么？
是否需要调用工具？
应该调用哪个工具？
是否需要进入知识库检索？
是否无法判断，需要兜底处理？
```

比如用户输入：

```text
帮我查一下订单 20240518001 的处理进度
```

系统不应该直接让大模型自由回答，而应该先识别出：

```json
{
  "intent": "query_order",
  "confidence": 0.95,
  "reason": "用户明确表达了查询订单处理进度的需求。"
}
```

然后后续流程可以根据 `intent` 决定下一步：

```ts
if (result.intent === "query_order") {
  // 调用订单查询工具
}

if (result.intent === "create_ticket") {
  // 调用工单创建工具
}

if (result.intent === "ask_knowledge_base") {
  // 进入 RAG 知识库检索
}

if (result.intent === "unknown") {
  // 兜底回复或让用户补充信息
}
```

所以，Intent Classifier 的作用就是：

> 帮 Agent 判断用户意图，为后续工具调用和流程编排做准备。

---

## 三、本节目录结构

本节新建第 4 课目录：

```text
agent-demo/
  src/
    lessons/
      lesson01-first-llm-call/
        index.ts

      lesson02-prompt-messages/
        index.ts

      lesson03-structured-output/
        index.ts

      lesson04-intent-classifier/
        index.ts
```

代码文件：

```text
src/lessons/lesson04-intent-classifier/index.ts
```

---

## 四、配置 package.json

在 `package.json` 中增加第 4 课脚本：

```json
{
  "scripts": {
    "lesson:01": "tsx src/lessons/lesson01-first-llm-call/index.ts",
    "lesson:02": "tsx src/lessons/lesson02-prompt-messages/index.ts",
    "lesson:03": "tsx src/lessons/lesson03-structured-output/index.ts",
    "lesson:04": "tsx src/lessons/lesson04-intent-classifier/index.ts"
  }
}
```

运行第 4 课：

```bash
pnpm lesson:04
```

---

## 五、整体流程设计

第 3 课的流程是：

```text
用户输入
  ↓
Prompt
  ↓
模型输出 JSON
  ↓
extractJson
  ↓
JSON.parse
  ↓
zod 校验
  ↓
输出结构化结果
```

第 4 课在这个基础上做封装，变成：

```text
用户输入
  ↓
IntentClassifier.classify(input)
  ↓
内部调用模型
  ↓
解析和校验 JSON
  ↓
成功：返回结构化意图
  ↓
失败：返回 fallback 兜底结果
```

也就是把原来的 Demo 函数升级成一个可复用模块：

```ts
class IntentClassifier {
  async classify(input: string): Promise<IntentClassifierResult> {
    // ...
  }
}
```

---

## 六、定义意图结构

本节继续使用 zod 定义意图识别结果。

```ts
import { z } from "zod";

const IntentSchema = z.object({
  intent: z.enum([
    "query_order",
    "create_ticket",
    "ask_knowledge_base",
    "unknown",
  ]),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

type IntentResult = z.infer<typeof IntentSchema>;
```

这个结构表示模型必须返回：

```json
{
  "intent": "query_order",
  "confidence": 0.95,
  "reason": "判断原因"
}
```

字段含义如下：

| 字段           | 含义       |
| ------------ | -------- |
| `intent`     | 用户意图     |
| `confidence` | 模型判断的置信度 |
| `reason`     | 判断原因     |

其中 `intent` 只能是以下几种：

```text
query_order：查询订单
create_ticket：创建工单
ask_knowledge_base：询问知识库
unknown：无法判断
```

---

## 七、扩展返回结果

如果只返回 `intent`、`confidence`、`reason`，对 Demo 来说够用，但对工程项目还不够。

真实 Agent 项目中，我们还需要知道：

```text
这次识别是否成功？
模型原始输出是什么？
如果失败，失败原因是什么？
```

所以我们定义一个扩展类型：

```ts
type IntentClassifierResult = IntentResult & {
  rawOutput: string;
  success: boolean;
  errorMessage?: string;
};
```

它最终包含这些字段：

```ts
type IntentClassifierResult = {
  intent: "query_order" | "create_ticket" | "ask_knowledge_base" | "unknown";
  confidence: number;
  reason: string;
  rawOutput: string;
  success: boolean;
  errorMessage?: string;
};
```

成功时：

```json
{
  "intent": "query_order",
  "confidence": 0.95,
  "reason": "用户想查询订单处理进度。",
  "rawOutput": "{...}",
  "success": true
}
```

失败时：

```json
{
  "intent": "unknown",
  "confidence": 0,
  "reason": "意图识别失败，已返回兜底结果。",
  "rawOutput": "模型原始输出",
  "success": false,
  "errorMessage": "JSON.parse failed"
}
```

---

## 八、fallback 兜底设计

AI 应用不能假设模型永远稳定。

模型可能出现这些问题：

```text
1. 没有返回 JSON
2. 返回了 Markdown 包裹的 JSON
3. 返回了错误字段
4. confidence 超出范围
5. API 调用失败
6. 网络异常
```

所以必须设计 fallback。

```ts
function fallbackIntentResult(params: {
  rawOutput: string;
  errorMessage: string;
}): IntentClassifierResult {
  return {
    intent: "unknown",
    confidence: 0,
    reason: "意图识别失败，已返回兜底结果。",
    rawOutput: params.rawOutput,
    success: false,
    errorMessage: params.errorMessage,
  };
}
```

这样即使识别失败，程序也不会直接崩溃。

后续 Agent 可以根据 `success` 做判断：

```ts
if (!result.success) {
  // 走兜底回复
  // 或提示用户重新描述问题
}
```

这就是工程化 Agent 的基本思路：

> 模型可以失败，但系统不能失控。

---

## 九、处理模型输出中的 JSON

上一课已经遇到过一个问题：模型有时会返回 Markdown 代码块。

例如：

````text
```json
{
  "intent": "query_order",
  "confidence": 0.95,
  "reason": "用户想查询订单。"
}
````

````

所以保留 `extractJson` 函数：

```ts
function extractJson(text: string): string {
  const cleaned = text.trim();

  if (cleaned.startsWith("```json")) {
    return cleaned
      .replace(/^```json\s*/, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  if (cleaned.startsWith("```")) {
    return cleaned
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  return cleaned;
}
````

它的作用是：

```text
模型原始输出
  ↓
去掉 Markdown 代码块
  ↓
得到可被 JSON.parse 处理的字符串
```

---

## 十、封装 IntentClassifier

核心代码如下：

```ts
class IntentClassifier {
  private readonly model = createModel();

  private readonly prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `
你是一个用户意图识别助手。

你需要判断用户输入属于哪一种意图：

1. query_order：查询订单
2. create_ticket：创建工单
3. ask_knowledge_base：询问知识库问题
4. unknown：无法判断

请严格返回 JSON，不要返回 Markdown，不要返回解释文字。

JSON 格式如下：
{{
  "intent": "query_order | create_ticket | ask_knowledge_base | unknown",
  "confidence": 0到1之间的数字,
  "reason": "判断原因"
}}
`,
    ],
    ["human", "用户输入：{input}"],
  ]);

  async classify(input: string): Promise<IntentClassifierResult> {
    let rawOutput = "";

    try {
      const messages = await this.prompt.formatMessages({
        input,
      });

      const response = await this.model.invoke(messages);

      rawOutput = response.content.toString();

      const jsonText = extractJson(rawOutput);
      const parsed = JSON.parse(jsonText);
      const result = IntentSchema.parse(parsed);

      return {
        ...result,
        rawOutput,
        success: true,
      };
    } catch (error) {
      return fallbackIntentResult({
        rawOutput,
        errorMessage:
          error instanceof Error ? error.message : "未知意图识别错误",
      });
    }
  }
}
```

这里做了几件事：

```text
1. model 封装在类内部
2. prompt 封装在类内部
3. classify 对外提供统一入口
4. 内部完成模型调用、JSON 提取、解析、zod 校验
5. 失败时返回 fallback
```

调用方不需要关心内部细节，只需要使用：

```ts
const result = await classifier.classify(input);
```

---

## 十一、完整代码

文件路径：

```text
src/lessons/lesson04-intent-classifier/index.ts
```

完整代码如下：

````ts
import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

function createModel() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseURL = process.env.DASHSCOPE_BASE_URL;

  if (!apiKey) {
    throw new Error("缺少环境变量 DASHSCOPE_API_KEY");
  }

  if (!baseURL) {
    throw new Error("缺少环境变量 DASHSCOPE_BASE_URL");
  }

  return new ChatOpenAI({
    model: "qwen3.6-flash",
    temperature: 0,
    apiKey,
    configuration: {
      baseURL,
    },
  });
}

const IntentSchema = z.object({
  intent: z.enum([
    "query_order",
    "create_ticket",
    "ask_knowledge_base",
    "unknown",
  ]),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

type IntentResult = z.infer<typeof IntentSchema>;

type IntentClassifierResult = IntentResult & {
  rawOutput: string;
  success: boolean;
  errorMessage?: string;
};

function extractJson(text: string): string {
  const cleaned = text.trim();

  if (cleaned.startsWith("```json")) {
    return cleaned
      .replace(/^```json\s*/, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  if (cleaned.startsWith("```")) {
    return cleaned
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  return cleaned;
}

function fallbackIntentResult(params: {
  rawOutput: string;
  errorMessage: string;
}): IntentClassifierResult {
  return {
    intent: "unknown",
    confidence: 0,
    reason: "意图识别失败，已返回兜底结果。",
    rawOutput: params.rawOutput,
    success: false,
    errorMessage: params.errorMessage,
  };
}

class IntentClassifier {
  private readonly model = createModel();

  private readonly prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `
你是一个用户意图识别助手。

你需要判断用户输入属于哪一种意图：

1. query_order：查询订单
2. create_ticket：创建工单
3. ask_knowledge_base：询问知识库问题
4. unknown：无法判断

请严格返回 JSON，不要返回 Markdown，不要返回解释文字。

JSON 格式如下：
{{
  "intent": "query_order | create_ticket | ask_knowledge_base | unknown",
  "confidence": 0到1之间的数字,
  "reason": "判断原因"
}}
`,
    ],
    ["human", "用户输入：{input}"],
  ]);

  async classify(input: string): Promise<IntentClassifierResult> {
    let rawOutput = "";

    try {
      const messages = await this.prompt.formatMessages({
        input,
      });

      const response = await this.model.invoke(messages);

      rawOutput = response.content.toString();

      const jsonText = extractJson(rawOutput);
      const parsed = JSON.parse(jsonText);
      const result = IntentSchema.parse(parsed);

      return {
        ...result,
        rawOutput,
        success: true,
      };
    } catch (error) {
      return fallbackIntentResult({
        rawOutput,
        errorMessage:
          error instanceof Error ? error.message : "未知意图识别错误",
      });
    }
  }
}

async function main() {
  const classifier = new IntentClassifier();

  const inputs = [
    "帮我查一下订单尾号为123的订单",
    "系统登录一直失败，帮我提交一个问题",
    "RAG 和微调有什么区别？",
    "我今天有点累",
  ];

  for (const input of inputs) {
    const result = await classifier.classify(input);

    console.log("\n==============================");
    console.log("用户输入：", input);
    console.log("识别结果：", result.intent);
    console.log("置信度：", result.confidence);
    console.log("原因：", result.reason);
    console.log("是否成功：", result.success);

    if (!result.success) {
      console.log("错误信息：", result.errorMessage);
      console.log("模型原始输出：", result.rawOutput);
    }
  }
}

main().catch((error) => {
  console.error("运行失败：", error);
});
````

---

## 十二、运行代码

执行：

```bash
pnpm lesson:04
```

输出结构大致如下：

```text
==============================
用户输入： 帮我查一下订单尾号为123的订单
识别结果： query_order
置信度： 0.95
原因： 用户明确表达了查询订单的需求，并提供了具体的订单标识（尾号123），完全符合查询订单的意图。
是否成功： true

==============================
用户输入： 系统登录一直失败，帮我提交一个问题
识别结果： create_ticket
置信度： 0.95
原因： 用户明确表达了“帮我提交一个问题”的诉求，并描述了具体问题（系统登录失败），符合创建工单的意图。
是否成功： true

==============================
用户输入： RAG和GREP有什么区别？
识别结果： ask_knowledge_base
置信度： 0.95
原因： 用户询问两个技术概念（RAG和GREP）的区别，属于典型的技术知识问答，符合查询知识库的意图。
是否成功： true

==============================
用户输入： 我今天有点累
识别结果： unknown
置信度： 0.95
原因： 用户输入为个人状态/情绪表达，未包含任何与查询订单、创建工单或询问知识库相关的业务关键词或上下文，无法匹配预设意图。
是否成功： true
```

---

## 十三、这节课和 Agent 的关系

第 4 课看起来只是封装了一个分类器，但它其实已经进入 Agent 的核心流程了。

一个简单 Agent 可以这样理解：

```text
用户输入
  ↓
识别意图
  ↓
选择工具
  ↓
调用工具
  ↓
整理工具结果
  ↓
回复用户
```

本节完成的是第一步：

```text
用户输入
  ↓
识别意图
```

后续第 5 课会继续往下走：

```text
识别意图
  ↓
调用工具
```

例如：

```text
用户：帮我查一下订单 20240518001 的处理进度
  ↓
IntentClassifier：query_order
  ↓
调用 queryOrder 工具
  ↓
返回订单状态
  ↓
模型组织自然语言回复
```

所以本节代码是后面 Tool Calling 的前置模块。

---

## 十四、Tips：本节涉及的 TypeScript 写法

这一节主要目标仍然是 Agent 逻辑，但代码里有几个 TypeScript 写法需要理解。

### 1. `private readonly`

```ts
private readonly model = createModel();
```

可以类比 Java：

```java
private final ChatModel model = createModel();
```

含义：

```text
private：外部不能访问
readonly：初始化后不能重新赋值
```

所以：

```ts
private readonly model
```

可以理解成：

```text
这是类内部使用的固定依赖
```

---

### 2. `z.infer`

```ts
type IntentResult = z.infer<typeof IntentSchema>;
```

意思是：

> 从 zod Schema 自动推导 TypeScript 类型。

这样就不需要手写一遍类型，避免 Schema 和 Type 不一致。

---

### 3. 交叉类型 `&`

```ts
type IntentClassifierResult = IntentResult & {
  rawOutput: string;
  success: boolean;
  errorMessage?: string;
};
```

意思是：

```text
IntentClassifierResult = IntentResult 的字段 + 额外字段
```

也就是在原来的 `intent`、`confidence`、`reason` 基础上，增加：

```text
rawOutput
success
errorMessage
```

---

### 4. `errorMessage?: string`

```ts
errorMessage?: string;
```

表示 `errorMessage` 是可选字段。

成功时可以没有，失败时再返回。

---

### 5. `async classify(...): Promise<...>`

```ts
async classify(input: string): Promise<IntentClassifierResult>
```

表示：

```text
这是一个异步方法
参数 input 是 string
最终返回 IntentClassifierResult
```

因为调用模型是网络请求，所以返回的是 `Promise`。

---

## 十五、本节总结

本节完成了一个可复用的意图识别模块 `IntentClassifier`。

核心收获：

```text
1. Agent 需要先理解用户意图，再决定下一步动作
2. 意图识别结果应该是结构化 JSON，而不是自然语言
3. zod 可以校验模型输出是否符合预期结构
4. 模型输出不稳定，所以需要 fallback 兜底
5. 封装成 class 后，后续 Agent 流程可以直接复用
6. success / rawOutput / errorMessage 能提升调试和稳定性
```

本节最重要的一句话：

> Intent Classifier 是 Agent 的前置判断模块，它负责把用户自然语言转成程序可处理的决策信号。

---

## 十六、下一课预告

下一课进入：

# 第 5 课：Tool Calling 入门

第 5 课会学习：

```text
1. 什么是 Tool
2. 为什么 Agent 需要 Tool
3. 如何定义一个 queryOrder 工具
4. 如何让模型根据用户问题调用工具
5. 如何把工具返回结果交给模型整理成自然语言
```

下一课开始，Agent 就不只是“识别用户想做什么”，而是会真正执行一个动作。
