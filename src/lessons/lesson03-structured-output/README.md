# 第 3 课：让大模型输出 JSON，并用 zod 做结构化校验

## 前言

前两课已经完成了 AI 项目的基础准备。

第 1 课完成了：

```text
pnpm 初始化项目
TypeScript 环境配置
通过 LangChain.js 调用阿里云百炼 / 通义千问模型
```

第 2 课学习了：

```text
SystemMessage
HumanMessage
AIMessage
ChatPromptTemplate
Prompt 模板
```

这一课继续往工程化方向推进，学习一个非常重要的能力：

> 让大模型输出结构化数据。

为什么这件事很重要？

因为真实业务系统里，模型输出不能只给人看，还要给程序继续处理。

例如，用户输入：

```text
帮我查一下订单 20240518001 的处理进度
```

如果模型只是回答：

```text
用户想查询订单。
```

这对人类来说可以理解，但对程序来说不够好。

业务系统更希望拿到这种结果：

```json
{
  "intent": "query_order",
  "confidence": 0.95,
  "reason": "用户明确提到查询订单处理进度，并提供了订单号。"
}
```

这样程序就可以继续判断：

```ts
if (result.intent === "query_order") {
  // 调用订单查询工具
}
```

这就是本节课的核心：**让模型输出 JSON，并用 zod 做结构化校验。**

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 理解为什么需要结构化输出
2. 让大模型严格返回 JSON
3. 使用 TypeScript 解析 JSON
4. 使用 zod 定义输出结构
5. 使用 zod 校验模型返回结果
6. 实现一个用户意图识别案例
7. 处理 Prompt 中 JSON 大括号被误识别的问题
```

本节依然只写 TypeScript 脚本，不涉及前端页面。

---

## 二、本节目录结构

本节代码放在一个新的 lesson 目录中：

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
```

第三课代码文件：

```text
src/lessons/lesson03-structured-output/index.ts
```

这种每节课独立目录的方式，后续会继续保持。

好处是：

```text
1. 每节课代码相互独立
2. 方便回顾每一课的学习内容
3. 后续可以为每课单独写 README
4. 适合整理成博客系列
```

---

## 三、安装 zod

本节需要安装一个新的依赖：`zod`。

执行：

```bash
pnpm add zod
```

`zod` 是 TypeScript 中常用的数据结构校验库。

可以简单理解成 Java 里的：

```text
DTO + 参数校验注解
```

类似 Java 中的：

```java
@NotNull
@Size
@Pattern
```

在本节中，zod 的作用是：

> 校验模型返回的 JSON 是否符合我们预期的结构。

---

## 四、配置 package.json

在 `package.json` 中增加第三课脚本：

```json
{
  "scripts": {
    "lesson:01": "tsx src/lessons/lesson01-first-llm-call/index.ts",
    "lesson:02": "tsx src/lessons/lesson02-prompt-messages/index.ts",
    "lesson:03": "tsx src/lessons/lesson03-structured-output/index.ts"
  }
}
```

运行第三课：

```bash
pnpm lesson:03
```

---

## 五、为什么需要结构化输出？

前两课中，模型输出的都是自然语言。

例如：

```text
RAG 是检索增强生成技术，它先从知识库中检索相关资料，再让大模型基于这些资料生成回答。
```

这种输出适合直接展示给用户。

但如果我们要做 Agent 或业务系统，就不能只依赖自然语言。

例如用户输入：

```text
帮我查一下订单 20240518001 的处理进度
```

程序需要判断：

```text
用户是不是要查订单？
订单号是多少？
置信度高不高？
下一步应该调用哪个工具？
```

如果模型只返回一段文字，程序很难稳定处理。

所以我们希望模型返回结构化 JSON：

```json
{
  "intent": "query_order",
  "confidence": 0.95,
  "reason": "用户明确提到查询订单处理进度，并提供了订单号。"
}
```

这样后续代码可以直接使用字段：

```ts
console.log(result.intent);
console.log(result.confidence);
console.log(result.reason);
```

一句话总结：

> 自然语言适合给人看，结构化输出适合给程序用。

---

## 六、本节案例：用户意图识别

本节实现一个简单的用户意图识别器。

它会判断用户输入属于哪一种意图：

```text
query_order：查询订单
create_ticket：创建工单
ask_knowledge_base：询问知识库问题
unknown：无法判断
```

例如：

```text
帮我查一下订单 20240518001 的处理进度
```

期望结果：

```json
{
  "intent": "query_order",
  "confidence": 0.95,
  "reason": "用户明确提到查询订单处理进度，并提供了订单号。"
}
```

这个例子虽然简单，但它是后续 Tool Calling 和 Agent 的基础。

因为 Agent 经常需要先判断：

```text
用户想做什么？
应该调用哪个工具？
参数是什么？
```

---

## 七、创建模型函数

第三课继续使用阿里云百炼 / 通义千问的 OpenAI 兼容接口。

本节按照计划，把模型名改成：

```ts
qwen3.6-flash
```

模型创建函数如下：

```ts
import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

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
```

这里有几个关键配置：

```text
model：使用的模型名称
temperature：输出随机性，设为 0 更稳定
apiKey：阿里云百炼 API Key
baseURL：OpenAI 兼容接口地址
```

`temperature: 0` 的作用是让输出更稳定，适合结构化输出场景。

---

## 八、定义 zod Schema

接下来定义模型输出结构。

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

这段代码规定了模型输出必须满足以下结构：

```json
{
  "intent": "query_order",
  "confidence": 0.95,
  "reason": "判断原因"
}
```

字段说明：

| 字段           | 类型     | 说明               |
| ------------ | ------ | ---------------- |
| `intent`     | 枚举     | 用户意图             |
| `confidence` | number | 置信度，必须在 0 到 1 之间 |
| `reason`     | string | 判断原因             |

其中：

```ts
z.enum([
  "query_order",
  "create_ticket",
  "ask_knowledge_base",
  "unknown",
])
```

表示 `intent` 只能是这四个值之一。

如果模型返回：

```json
{
  "intent": "delete_database",
  "confidence": 0.9,
  "reason": "用户想删除数据库"
}
```

zod 会校验失败。

如果模型返回：

```json
{
  "intent": "query_order",
  "confidence": 1.5,
  "reason": "用户想查订单"
}
```

zod 也会校验失败，因为 `confidence` 必须在 0 到 1 之间。

这一步非常重要：

> 模型输出不能直接信任，必须校验后才能进入业务逻辑。

---

## 九、处理模型可能返回 Markdown JSON

即使我们在 Prompt 中要求模型只返回 JSON，有时模型仍然可能返回：

````text
```json
{
  "intent": "query_order",
  "confidence": 0.95,
  "reason": "用户想查询订单"
}
````

````

这种格式人能看懂，但 `JSON.parse()` 不能直接解析。

所以我们写一个工具函数，专门提取 JSON：

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

这个函数主要处理三种情况：

````text
1. 模型直接返回 JSON
2. 模型返回 ```json 包裹的 JSON
3. 模型返回普通 ``` 包裹的 JSON
````

这是一种工程上的防御式写法。

---

## 十、编写 Prompt

本节使用 `ChatPromptTemplate` 编写 Prompt。

代码如下：

```ts
import { ChatPromptTemplate } from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromMessages([
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
```

这里需要特别注意：

```text
JSON 示例里的大括号必须写成 {{ 和 }}
```

原因是 `ChatPromptTemplate` 会把 `{xxx}` 识别为变量占位符。

例如：

```ts
["human", "用户输入：{input}"]
```

这里的 `{input}` 是真正的变量。

后面会传入：

```ts
const messages = await prompt.formatMessages({
  input: "帮我查一下订单 20240518001 的处理进度",
});
```

但 JSON 示例中的 `{}` 只是普通文本，不是变量。

所以必须写成：

```text
{{ 和 }}
```

否则会报错。

---

## 十一、遇到的问题：JSON 大括号被识别成变量

本节运行时遇到了一个问题。

最开始在 Prompt 中直接写了 JSON 示例：

```json
{
  "intent": "query_order | create_ticket | ask_knowledge_base | unknown",
  "confidence": 0到1之间的数字,
  "reason": "判断原因"
}
```

运行时报错：

```text
Error: Missing value for input variable `
  "intent": "query_order | create_ticket | ask_knowledge_base | unknown",
  "confidence": 0到1之间的数字,
  "reason": "判断原因"
`
```

原因是：

> `ChatPromptTemplate` 会把 `{}` 识别成模板变量。

所以它误以为整个 JSON 内容是一个变量，但是我们在 `formatMessages()` 中没有给这个变量赋值，于是报错。

解决方式是将普通 JSON 大括号转义为双大括号：

```text
{{ 和 }}
```

修正后：

```text
JSON 格式如下：
{{
  "intent": "query_order | create_ticket | ask_knowledge_base | unknown",
  "confidence": 0到1之间的数字,
  "reason": "判断原因"
}}
```

这也是本节一个非常重要的坑。

后面写 RAG Prompt、引用格式、JSON 输出格式时，也经常会遇到类似问题。

---

## 十二、完整意图识别流程

完整流程如下：

```text
用户输入
  ↓
ChatPromptTemplate 生成消息
  ↓
调用 qwen3.6-flash
  ↓
模型返回 JSON 文本
  ↓
extractJson 清理输出
  ↓
JSON.parse 解析
  ↓
zod 校验
  ↓
得到结构化对象
```

代码逻辑如下：

```ts
const messages = await prompt.formatMessages({
  input: "帮我查一下订单 20240518001 的处理进度",
});

const response = await model.invoke(messages);

const jsonText = extractJson(response.content.toString());

const parsed = JSON.parse(jsonText);

const result: IntentResult = IntentSchema.parse(parsed);
```

最终得到的 `result` 就是业务系统可以直接使用的对象。

---

## 十三、本节完整代码

文件路径：

```text
src/lessons/lesson03-structured-output/index.ts
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

async function demoJsonOutput() {
  const model = createModel();

  const prompt = ChatPromptTemplate.fromMessages([
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

  const messages = await prompt.formatMessages({
    input: "帮我查一下订单 20240518001 的处理进度",
  });

  const response = await model.invoke(messages);

  console.log("=== 模型原始输出 ===");
  console.log(response.content);

  const jsonText = extractJson(response.content.toString());

  console.log("\n=== 提取后的 JSON 字符串 ===");
  console.log(jsonText);

  const parsed = JSON.parse(jsonText);

  const result: IntentResult = IntentSchema.parse(parsed);

  console.log("\n=== zod 校验后的结构化对象 ===");
  console.log(result);

  console.log("\n=== 业务系统可以直接使用的字段 ===");
  console.log("intent:", result.intent);
  console.log("confidence:", result.confidence);
  console.log("reason:", result.reason);
}

async function main() {
  await demoJsonOutput();
}

main().catch((error) => {
  console.error("运行失败：", error);
});
````

---

## 十四、运行代码

执行：

```bash
pnpm lesson:03
```

运行结果结构大致如下：

```text
=== 模型原始输出 ===
【这里填写实际模型输出】

=== 提取后的 JSON 字符串 ===
【这里填写提取后的 JSON】

=== zod 校验后的结构化对象 ===
【这里填写 zod 校验后的对象】

=== 业务系统可以直接使用的字段 ===
intent: 【这里填写 intent】
confidence: 【这里填写 confidence】
reason: 【这里填写 reason】
```

示例输出可能类似：

```text
=== 模型原始输出 ===
{
  "intent": "query_order",
  "confidence": 0.95,
  "reason": "用户明确提到查询订单处理进度，并提供了订单号。"
}

=== 提取后的 JSON 字符串 ===
{
  "intent": "query_order",
  "confidence": 0.95,
  "reason": "用户明确提到查询订单处理进度，并提供了订单号。"
}

=== zod 校验后的结构化对象 ===
{
  intent: "query_order",
  confidence: 0.95,
  reason: "用户明确提到查询订单处理进度，并提供了订单号。"
}

=== 业务系统可以直接使用的字段 ===
intent: query_order
confidence: 0.95
reason: 用户明确提到查询订单处理进度，并提供了订单号。
```

实际输出内容可以根据运行结果再补充。

---

## 十五、测试不同输入

可以把输入改成不同内容，观察模型返回的意图。

### 1. 查询订单

```ts
input: "帮我查一下订单 20240518001 的处理进度"
```

预期：

```text
query_order
```

---

### 2. 创建工单

```ts
input: "系统登录一直失败，帮我提交一个问题"
```

预期：

```text
create_ticket
```

---

### 3. 知识库问答

```ts
input: "RAG 和微调有什么区别？"
```

预期：

```text
ask_knowledge_base
```

---

### 4. 无法判断

```ts
input: "我今天有点累"
```

预期：

```text
unknown
```

通过这些测试可以观察模型是否能稳定输出符合 Schema 的 JSON。

---

## 十六、为什么 zod 校验很重要？

模型虽然很强，但输出并不总是稳定。

它可能会出现：

```text
字段缺失
字段类型错误
枚举值不合法
confidence 超出范围
返回了 Markdown
返回了解释文字
```

如果不做校验，错误数据可能直接进入业务系统。

例如，后续 Agent 可能会根据 `intent` 调用不同工具：

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
```

如果模型返回了一个未定义的 intent，比如：

```json
{
  "intent": "delete_order",
  "confidence": 0.9,
  "reason": "用户想删除订单"
}
```

没有校验的话，系统可能会进入不可控状态。

所以结构化输出的关键不是“让模型返回 JSON”这么简单，而是：

```text
让模型返回 JSON
  ↓
解析 JSON
  ↓
校验 JSON
  ↓
只把合法结果交给业务系统
```

---

## 十七、本节和 Agent 的关系

这一课虽然只是做了意图识别，但它已经和 Agent 有直接关系。

Agent 的一个核心能力是：

```text
理解用户要做什么
  ↓
选择合适的工具
  ↓
提取工具参数
  ↓
调用工具
  ↓
根据结果继续回答
```

其中第一步就是意图识别。

例如：

```json
{
  "intent": "query_order",
  "confidence": 0.95,
  "reason": "用户想查询订单处理进度"
}
```

后续可以接：

```ts
if (result.intent === "query_order") {
  // 调用 queryOrderTool
}
```

所以这一课是后续 Tool Calling 和 Agent 的基础。

---

## 十八、本节总结

本节学习了如何让大模型输出结构化 JSON，并使用 zod 进行校验。

核心收获：

```text
1. 自然语言适合给人看，结构化 JSON 适合给程序用
2. Prompt 中需要明确要求模型只返回 JSON
3. ChatPromptTemplate 中普通 JSON 大括号要写成 {{ 和 }}
4. 模型输出可能被 Markdown 包裹，需要做 extractJson 处理
5. JSON.parse 只能解析语法，不能校验业务结构
6. zod 可以校验字段类型、枚举值和数值范围
7. 模型输出不可信，必须校验后才能进入业务系统
8. 意图识别是 Agent 选择工具的重要前置步骤
```

本节最重要的一句话：

> 结构化输出的核心不是让模型“看起来返回了 JSON”，而是让程序能安全、稳定地使用模型输出。

---

## 十九、下一课预告

下一课可以继续基于本节内容做升级：

# 第 4 课：封装可复用的 Intent Classifier

下一课会学习：

```text
如何把意图识别逻辑封装成函数
如何处理 JSON.parse 失败
如何处理 zod 校验失败
如何返回 fallback 结果
如何为后续 Tool Calling 做准备
```

这一课之后，意图识别就不只是一个 Demo，而会变成后续 Agent 项目中可以复用的模块。
