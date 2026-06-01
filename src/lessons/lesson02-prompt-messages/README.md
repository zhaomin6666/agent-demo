# 第 2 课：LangChain.js 消息模型与 Prompt 基础

## 前言

上一课已经完成了项目的基础环境搭建，并通过 LangChain.js 成功调用了阿里云百炼 / 通义千问的 OpenAI 兼容接口。

第一课的重点是：

```text
TypeScript 项目能不能跑起来？
环境变量能不能读取？
模型接口能不能正常返回？
```

这一课开始进入 LangChain.js 的基础能力：**消息模型与 Prompt**。

在普通开发中，我们可能习惯把提示词写成一段字符串，然后直接发给大模型。但在真实 AI 应用中，Prompt 往往会变得越来越复杂，例如：

```text
角色设定
用户问题
历史对话
检索资料
输出格式
安全规则
引用要求
```

如果一直靠字符串拼接，代码很快会变得难以维护。

所以这一课主要学习：

> 如何用 LangChain.js 的消息模型和 Prompt 模板，让模型调用更结构化、更清晰、更适合工程化开发。

---

## 一、本节目标

本节主要完成以下内容：

```text
1. 给第二课创建独立目录
2. 理解 SystemMessage、HumanMessage、AIMessage
3. 理解多轮对话为什么需要传入历史消息
4. 学会使用 ChatPromptTemplate
5. 编写可复用 Prompt
6. 完成多个 Prompt 示例
```

本节依然不涉及前端页面，只编写 TypeScript 脚本。

---

## 二、本节目录结构

从第二课开始，每一节课都单独建立一个文件夹，方便后续长期维护、写博客和沉淀项目。

当前目录结构如下：

```text
agent-demo/
  src/
    lessons/
      lesson01-first-llm-call/
        index.ts

      lesson02-prompt-messages/
        index.ts
```

第二课代码放在：

```text
src/lessons/lesson02-prompt-messages/index.ts
```

这样做的好处是：

```text
1. 每节课代码相互独立
2. 后续每课可以增加 README.md
3. RAG、LangGraph 等复杂课程可以拆分多个文件
4. 方便个人网站或博客按课程整理
```

---

## 三、配置 package.json

为了方便运行每一节课，在 `package.json` 中配置脚本：

```json
{
  "type": "module",
  "scripts": {
    "lesson:01": "tsx src/lessons/lesson01-first-llm-call/index.ts",
    "lesson:02": "tsx src/lessons/lesson02-prompt-messages/index.ts"
  }
}
```

运行第二课：

```bash
pnpm lesson:02
```

---

## 四、什么是消息模型？

上一课已经写过类似代码：

```ts
await model.invoke([
  new SystemMessage("你是一位擅长讲解 AI 工程实践的技术导师。"),
  new HumanMessage("请用 100 字以内解释什么是 RAG。"),
]);
```

这里传给模型的不是一个普通字符串，而是一个**消息列表**。

在 LangChain.js 中，常见的消息类型有：

```text
SystemMessage：系统消息
HumanMessage：用户消息
AIMessage：AI 回复消息
```

可以简单理解成：

```text
SystemMessage = 给 AI 定规则
HumanMessage  = 用户说的话
AIMessage     = AI 说过的话
```

---

## 五、SystemMessage

`SystemMessage` 用于设定模型的角色、语气、规则和边界。

示例：

```ts
new SystemMessage("你是一位擅长讲解 AI 工程实践的技术导师。")
```

它不是用户真正的问题，而是告诉模型：

```text
你是谁？
你应该用什么风格回答？
回答时需要遵守什么规则？
```

例如：

```text
你是一位资深 Java 后端架构师。
请用适合初学者的方式回答。
不要编造不存在的信息。
回答要简洁清晰。
```

在企业级 AI 应用中，`SystemMessage` 很重要，因为它决定了模型整体的行为风格。

---

## 六、HumanMessage

`HumanMessage` 表示用户输入。

示例：

```ts
new HumanMessage("请用 100 字以内解释 LangChain 是什么。")
```

它就是这一次真正要问模型的问题。

如果类比普通聊天：

```text
SystemMessage：系统设定
HumanMessage：用户发言
AIMessage：AI 回复
```

---

## 七、AIMessage

`AIMessage` 表示 AI 曾经回复过的内容。

它在多轮对话中非常重要。

例如：

```ts
new HumanMessage("我叫小明，我正在学习 AI Agent。"),
new AIMessage("好的，小明，我知道你正在学习 AI Agent。"),
new HumanMessage("我叫什么？我正在学习什么？")
```

这段消息相当于告诉模型：

```text
用户之前说：我叫小明，我正在学习 AI Agent。
AI 曾经回复：好的，我知道了。
用户现在问：我叫什么？我正在学习什么？
```

模型之所以能回答，是因为历史消息被再次传给了模型。

这说明一个非常重要的事实：

> 大模型接口本身通常是无状态的。所谓多轮对话，本质上是程序把历史消息再次传给模型。

后面学习 LangGraph Memory / Checkpoint 时，这个概念会继续用到。

---

## 八、基础消息调用示例

第二课第一个示例是直接使用消息列表调用模型。

```ts
async function demoBasicMessages() {
  const model = createModel();

  const response = await model.invoke([
    new SystemMessage("你是一位擅长讲解 AI 工程实践的技术导师。"),
    new HumanMessage("请用 100 字以内解释 LangChain 是什么。"),
  ]);

  console.log("=== Demo 1：基础消息调用 ===");
  console.log(response.content);
}
```

这段代码的流程是：

```text
创建模型对象
  ↓
传入 SystemMessage 和 HumanMessage
  ↓
调用 model.invoke
  ↓
输出模型回答
```

运行后模型会输出对 LangChain 的解释。

这里的模型输出内容，我后续可以根据实际运行结果补充。

```text
=== Demo 1：基础消息调用 ===
【这里填写实际模型输出】
```

---

## 九、模拟多轮对话

第二个示例用于理解历史消息。

```ts
async function demoConversationMessages() {
  const model = createModel();

  const response = await model.invoke([
    new SystemMessage("你是一位友好的学习助手。"),
    new HumanMessage("我叫小明，我正在学习 AI Agent。"),
    new AIMessage("好的，小明，我知道你正在学习 AI Agent。"),
    new HumanMessage("我叫什么？我正在学习什么？"),
  ]);

  console.log("\n=== Demo 2：模拟多轮对话 ===");
  console.log(response.content);
}
```

这段代码模拟了一段对话历史：

```text
System：你是一位友好的学习助手。
Human：我叫小明，我正在学习 AI Agent。
AI：好的，小明，我知道你正在学习 AI Agent。
Human：我叫什么？我正在学习什么？
```

模型能回答出“小明”和“AI Agent”，不是因为它真的记住了之前的调用，而是因为我们把历史消息一起传给了它。

运行结果可以记录为：

```text
=== Demo 2：模拟多轮对话 ===
【这里填写实际模型输出】
```

这一点对后续做多轮对话非常关键。

---

## 十、为什么不能一直拼字符串？

其实不用消息模型，也可以这样写：

```ts
const prompt = `
你是一位技术导师。
用户问题：请解释 LangChain 是什么。
`;
```

这种方式在简单 Demo 中可以使用，但在真实项目中会有问题。

因为后续 Prompt 会越来越复杂：

```text
系统角色
用户问题
历史对话
知识库资料
输出格式
权限说明
来源引用要求
错误处理规则
```

如果都靠字符串拼接，代码会变得难以维护。

例如：

```ts
const prompt = `
你是${role}
用户问题：${question}
资料：${context}
输出格式：${format}
`;
```

当变量越来越多时，就很容易出现：

```text
变量漏传
格式混乱
角色边界不清晰
不方便复用
不好测试
```

所以 LangChain.js 提供了 `ChatPromptTemplate`。

---

## 十一、ChatPromptTemplate 是什么？

`ChatPromptTemplate` 是 LangChain.js 中用于构建聊天 Prompt 的模板工具。

它可以把：

```text
system 消息
human 消息
变量
```

组合成可复用模板。

例如：

```text
system: 你是一位 {role}
human: 请解释 {topic}
```

传入参数：

```text
role = AI 工程导师
topic = RAG
```

最终生成：

```text
system: 你是一位 AI 工程导师
human: 请解释 RAG
```

它比普通字符串拼接更适合工程化，因为它保留了聊天模型的消息结构。

---

## 十二、ChatPromptTemplate 示例

示例代码：

```ts
async function demoPromptTemplate() {
  const model = createModel();

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "你是一位{role}。请用适合 Java 后端开发者的方式解释技术概念。",
    ],
    [
      "human",
      "请解释：{topic}。要求：控制在 {wordCount} 字以内。",
    ],
  ]);

  const messages = await prompt.formatMessages({
    role: "AI 工程导师",
    topic: "RAG",
    wordCount: 120,
  });

  const response = await model.invoke(messages);

  console.log("\n=== Demo 3：ChatPromptTemplate 调用 ===");
  console.log(response.content);
}
```

这里定义了三个变量：

```text
role
topic
wordCount
```

然后通过：

```ts
const messages = await prompt.formatMessages({
  role: "AI 工程导师",
  topic: "RAG",
  wordCount: 120,
});
```

把变量填入模板中。

可以理解为：

```text
模板 + 参数 = 最终消息列表
```

运行结果可以记录为：

```text
=== Demo 3：ChatPromptTemplate 调用 ===
【这里填写实际模型输出】
```

---

## 十三、业务化 Prompt 示例：代码审查助手

Prompt 不只是用来解释概念，也可以用于更具体的业务场景。

下面这个示例让模型扮演一位 Java 后端代码审查专家：

```ts
async function demoCodeReviewPrompt() {
  const model = createModel();

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `
你是一位资深 Java 后端开发专家。
你擅长 Spring Boot、数据库、接口设计和代码可维护性分析。
请用清晰、直接、可落地的方式回答。
`,
    ],
    [
      "human",
      `
请帮我审查下面这段代码，指出可能的问题和改进建议。

代码：
{code}
`,
    ],
  ]);

  const messages = await prompt.formatMessages({
    code: `
public String getUserName(User user) {
    return user.getName().trim();
}
`,
  });

  const response = await model.invoke(messages);

  console.log("\n=== Demo 4：业务化 Prompt 示例 ===");
  console.log(response.content);
}
```

这段 Java 代码存在明显的空指针风险：

```java
public String getUserName(User user) {
    return user.getName().trim();
}
```

可能的问题包括：

```text
user 可能为 null
user.getName() 可能为 null
trim() 可能触发 NullPointerException
```

运行结果可以记录为：

```text
=== Demo 4：业务化 Prompt 示例 ===
【这里填写实际模型输出】
```

这个例子说明 Prompt 可以根据不同业务角色进行设计。

---

## 十四、练习：AI Agent 面试官 Prompt

为了进一步练习 PromptTemplate，可以再写一个面试官 Prompt。

```ts
async function demoInterviewPrompt() {
  const model = createModel();

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "你是一位 AI Agent 方向的技术面试官，擅长考察 RAG、Agent、LangGraph。",
    ],
    [
      "human",
      "请围绕 {topic} 提出 {count} 个面试题，并给出参考答案。",
    ],
  ]);

  const messages = await prompt.formatMessages({
    topic: "RAG",
    count: 3,
  });

  const response = await model.invoke(messages);

  console.log("\n=== 练习：面试官 Prompt ===");
  console.log(response.content);
}
```

运行结果可以记录为：

```text
=== 练习：面试官 Prompt ===
【这里填写实际模型输出】
```

这个练习也和我后续准备 AI Agent 面试有关，可以顺便积累面试题素材。

---

## 十五、本节完整代码

文件路径：

```text
src/lessons/lesson02-prompt-messages/index.ts
```

完整代码如下：

```ts
import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";

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
    model: "qwen-plus",
    temperature: 0,
    apiKey,
    configuration: {
      baseURL,
    },
  });
}

async function demoBasicMessages() {
  const model = createModel();

  const response = await model.invoke([
    new SystemMessage("你是一位擅长讲解 AI 工程实践的技术导师。"),
    new HumanMessage("请用 100 字以内解释 LangChain 是什么。"),
  ]);

  console.log("=== Demo 1：基础消息调用 ===");
  console.log(response.content);
}

async function demoConversationMessages() {
  const model = createModel();

  const response = await model.invoke([
    new SystemMessage("你是一位友好的学习助手。"),
    new HumanMessage("我叫小明，我正在学习 AI Agent。"),
    new AIMessage("好的，小明，我知道你正在学习 AI Agent。"),
    new HumanMessage("我叫什么？我正在学习什么？"),
  ]);

  console.log("\n=== Demo 2：模拟多轮对话 ===");
  console.log(response.content);
}

async function demoPromptTemplate() {
  const model = createModel();

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "你是一位{role}。请用适合 Java 后端开发者的方式解释技术概念。",
    ],
    [
      "human",
      "请解释：{topic}。要求：控制在 {wordCount} 字以内。",
    ],
  ]);

  const messages = await prompt.formatMessages({
    role: "AI 工程导师",
    topic: "RAG",
    wordCount: 120,
  });

  const response = await model.invoke(messages);

  console.log("\n=== Demo 3：ChatPromptTemplate 调用 ===");
  console.log(response.content);
}

async function demoCodeReviewPrompt() {
  const model = createModel();

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `
你是一位资深 Java 后端开发专家。
你擅长 Spring Boot、数据库、接口设计和代码可维护性分析。
请用清晰、直接、可落地的方式回答。
`,
    ],
    [
      "human",
      `
请帮我审查下面这段代码，指出可能的问题和改进建议。

代码：
{code}
`,
    ],
  ]);

  const messages = await prompt.formatMessages({
    code: `
public String getUserName(User user) {
    return user.getName().trim();
}
`,
  });

  const response = await model.invoke(messages);

  console.log("\n=== Demo 4：业务化 Prompt 示例 ===");
  console.log(response.content);
}

async function demoInterviewPrompt() {
  const model = createModel();

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "你是一位 AI Agent 方向的技术面试官，擅长考察 RAG、Agent、LangGraph。",
    ],
    [
      "human",
      "请围绕 {topic} 提出 {count} 个面试题，并给出参考答案。",
    ],
  ]);

  const messages = await prompt.formatMessages({
    topic: "RAG",
    count: 3,
  });

  const response = await model.invoke(messages);

  console.log("\n=== 练习：面试官 Prompt ===");
  console.log(response.content);
}

async function main() {
  await demoBasicMessages();
  await demoConversationMessages();
  await demoPromptTemplate();
  await demoCodeReviewPrompt();
  await demoInterviewPrompt();
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

---

## 十六、运行代码

执行：

```bash
pnpm lesson:02
```

输出结构大致如下：

```text
=== Demo 1：基础消息调用 ===
【这里填写实际模型输出】

=== Demo 2：模拟多轮对话 ===
【这里填写实际模型输出】

=== Demo 3：ChatPromptTemplate 调用 ===
【这里填写实际模型输出】

=== Demo 4：业务化 Prompt 示例 ===
【这里填写实际模型输出】

=== 练习：面试官 Prompt ===
【这里填写实际模型输出】
```

实际模型输出内容后续可以根据运行结果补充。

---

## 十七、本节总结

本节主要学习了 LangChain.js 中的消息模型和 Prompt 模板。

核心收获：

```text
1. Chat Model 接收的是消息列表，而不是简单字符串
2. SystemMessage 用于设定模型角色和规则
3. HumanMessage 表示用户输入
4. AIMessage 表示历史 AI 回复
5. 多轮对话本质是把历史消息一起传给模型
6. ChatPromptTemplate 可以让 Prompt 更加可复用、可维护
7. Prompt 可以根据不同业务角色进行设计
```

这一节最重要的一句话是：

> Prompt 工程不是简单写一句提示词，而是用结构化消息和模板，把模型调用变成可维护的工程代码。

---

## 十八、下一课预告

下一课进入：

# 第 3 课：结构化输出 Output Parser

下一课会学习：

```text
为什么不能只让模型输出自然语言
如何让模型输出 JSON
如何用 zod 定义结构
如何解析模型返回结果
如何处理 JSON 解析失败
```

结构化输出是后续 Tool Calling、Agent、RAG 评估的重要基础。
