---
title: "第 1 课：用 pnpm 搭建 TypeScript AI 项目，完成第一次 LLM 调用"
slug: "lesson01-first-llm-call"
summary: "从一个 Java 后端开发者的视角出发，用 pnpm 搭建 TypeScript 项目环境，通过 LangChain.js 调用阿里云百炼的 OpenAI 兼容接口，跑通第一次大模型调用。"
date: "2026-06-10"
updatedAt: "2026-06-10"
tags: ["AI Agent", "TypeScript", "LangChain.js", "LLM", "全栈"]
series: "TypeScript + LangChain.js + LangGraph.js AI Agent 实战"
seriesSlug: "ts-langchain-langgraph-agent"
seriesOrder: 1
status: "published"
lang: "zh"
cover: ""
seoTitle: "第 1 课：用 pnpm 搭建 TypeScript AI 项目，完成第一次 LLM 调用"
seoDescription: "从 Java 后端视角出发，记录用 pnpm 搭建 TypeScript AI 项目、配置 LangChain.js 并完成第一次大模型调用的完整过程。"
---

# 第 1 课：用 pnpm 搭建 TypeScript AI 项目，完成第一次 LLM 调用

## 前言

本篇是整个系列的第一课，目标很简单：**先把 TypeScript 项目环境搭建起来，完成第一次大模型调用。**

---

## 本节要解决什么问题

这一节主要完成以下几件事：

```text
1. 使用 pnpm 初始化 TypeScript 项目
2. 配置 tsconfig.json
3. 安装 LangChain.js 相关依赖
4. 使用 dotenv 管理环境变量
5. 通过阿里云百炼 / 通义千问的 OpenAI 兼容接口调用模型
6. 跑通第一次 LLM 调用
```

这一节不涉及前端页面，也不涉及复杂的 RAG 流程。

可以把它理解成 Java 项目里的第一个 `main()` 方法——先确认项目能启动，模型能正常返回结果。后面的所有功能，都是建立在这条链路跑通的基础上。

---

## 为什么选择 pnpm

本项目使用 `pnpm` 作为包管理工具。

和 `npm`、`yarn` 类似，`pnpm` 也是 Node.js 生态里的包管理工具。它的特点是安装速度快、磁盘占用少，在依赖比较多的时候优势比较明显。

后续这个项目会引入不少依赖：

```text
LangChain.js
LangGraph.js
Qdrant
dotenv
TypeScript
tsx
```

所以从一开始就用 pnpm 管理依赖，避免后面再迁移。

---

## 本节整体设计

整个搭建过程可以分成几个阶段：

1. **项目初始化**：创建项目、安装 TypeScript 环境
2. **项目配置**：配置 tsconfig.json 和 package.json
3. **依赖安装**：安装 LangChain.js 和环境变量管理工具
4. **代码编写**：编写第一次 LLM 调用代码
5. **验证运行**：跑通整个链路

下面一步步来。

---

## 创建项目

首先创建项目目录：

```bash
mkdir agent-demo
cd agent-demo
pnpm init
```

执行完成后，项目根目录下会生成 `package.json`。

如果你是从 Java 过来的，可以把它理解成 `pom.xml` 或 `build.gradle`——它负责管理项目依赖、脚本命令和项目信息。

---

## 安装 TypeScript 环境

安装 TypeScript 相关依赖：

```bash
pnpm add -D typescript tsx @types/node
```

几个依赖各自的作用：

```text
typescript：TypeScript 编译器
tsx：直接运行 .ts 文件的工具（类似 Java 里的热运行，不需要先编译再执行）
@types/node：Node.js 的类型声明（让 TypeScript 能识别 process.env 这些 Node.js API）
```

---

## 目录结构

在写代码之前，先看一下最终的项目结构：

```text
agent-demo/
  src/
    lessons/
      lesson01-first-llm-call.ts
  package.json
  tsconfig.json
  .env
  .gitignore
```

创建源码目录：

```bash
mkdir -p src/lessons
```

如果是 Windows PowerShell：

```powershell
mkdir src
mkdir src\lessons
```

---

## 核心实现

### 生成并配置 tsconfig.json

执行：

```bash
pnpm exec tsc --init
```

这会生成一个默认的 `tsconfig.json`，然后根据项目需要调整配置：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts"]
}
```

几个关键配置说明：

```text
target：编译后的 JavaScript 版本，ES2022 已经足够现代
module：使用 NodeNext，适配 Node.js 的 ESM 模块系统
moduleResolution：模块解析方式，和 module 配合使用
strict：开启严格模式，帮你提前发现类型问题
types: ["node"]：让 TypeScript 识别 process.env 等 Node.js 全局变量
rootDir / outDir：源码目录和编译输出目录
```

### 修改 package.json

为了使用 ESM 模块，并方便运行代码，需要修改 `package.json`：

```json
{
  "name": "agent-kb-demo",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/lessons/lesson01-first-llm-call.ts"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

重点是两处：

```json
"type": "module"
```

表示项目使用 ESM 模块语法（`import/export`），而不是 CommonJS（`require/module.exports`）。

```json
"dev": "tsx src/lessons/lesson01-first-llm-call.ts"
```

这样执行 `pnpm dev` 就会直接运行第一课的 TypeScript 文件。

### 安装 LangChain.js 和 dotenv

接下来安装调用大模型需要的依赖：

```bash
pnpm add @langchain/core @langchain/openai dotenv
```

```text
@langchain/core：LangChain.js 核心能力
@langchain/openai：OpenAI 兼容模型调用包
dotenv：读取 .env 环境变量
```

这里有一个点值得说一下：虽然我用的是阿里云百炼 / 通义千问的模型，但因为阿里云提供了 OpenAI 兼容接口，所以可以继续用 LangChain.js 的 `ChatOpenAI`。

也就是说：

```text
代码层使用 ChatOpenAI
实际请求发给阿里云百炼的兼容接口
```

这样做的好处是，后续如果需要切换到 OpenAI 或者其他兼容接口的模型服务，只需要改 `baseURL` 和 `apiKey`，代码基本不用动。

### 配置环境变量

在项目根目录创建 `.env` 文件：

```env
DASHSCOPE_API_KEY=你的阿里云百炼_API_KEY
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

> 如果用别的模型服务，厂商的文档里一般都会提供 baseURL 地址。

为了避免敏感信息提交到 Git，还需要创建 `.gitignore`：

```gitignore
node_modules
.env
dist
```

> **`.env` 文件包含 API Key，绝对不能提交到 GitHub。** 这一点和 Java 项目里不能把数据库密码提交到仓库是一样的道理。

---

## 关键代码解释

创建文件 `src/lessons/lesson01-first-llm-call.ts`，完整代码如下：

```ts
import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

async function main() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseURL = process.env.DASHSCOPE_BASE_URL;

  if (!apiKey) {
    throw new Error("缺少环境变量 DASHSCOPE_API_KEY");
  }

  if (!baseURL) {
    throw new Error("缺少环境变量 DASHSCOPE_BASE_URL");
  }

  const model = new ChatOpenAI({
    model: "qwen3.5-flash",
    temperature: 0,
    apiKey,
    configuration: {
      baseURL,
    },
  });

  const response = await model.invoke([
    new SystemMessage("你是一位擅长讲解 AI 工程实践的技术导师。"),
    new HumanMessage("请用 100 字以内解释什么是 RAG。"),
  ]);

  console.log("模型回答：");
  console.log(response.content);
}

main().catch((error) => {
  console.error("运行失败：", error);
});
```

下面逐块拆解一下。

### 读取环境变量

```ts
import "dotenv/config";
```

这行代码会自动读取项目根目录下的 `.env` 文件，把里面的配置注入到 `process.env` 里。

之后就可以通过 `process.env.DASHSCOPE_API_KEY` 和 `process.env.DASHSCOPE_BASE_URL` 获取配置。

如果类比 Java 的话，`process.env` 类似于 `System.getenv()`，都是从运行环境中读取配置。

### 创建模型对象

```ts
const model = new ChatOpenAI({
  model: "qwen3.5-flash",
  temperature: 0,
  apiKey,
  configuration: {
    baseURL,
  },
});
```

这里用的是 LangChain.js 的 `ChatOpenAI`。虽然名字里带 OpenAI，但通过配置 `baseURL`，实际请求会发到阿里云百炼。

三个关键配置：

```text
apiKey：身份认证
baseURL：请求发到哪里
model：使用哪个模型
```

`temperature: 0` 表示让模型尽量给出确定性的回答，减少随机性。在需要稳定输出的场景下，这个设置比较常用。

### SystemMessage 和 HumanMessage

```ts
new SystemMessage("你是一位擅长讲解 AI 工程实践的技术导师。")
```

`SystemMessage` 是给模型的角色设定——告诉模型"你是谁"、"用什么风格回答"。

```ts
new HumanMessage("请用 100 字以内解释什么是 RAG。")
```

`HumanMessage` 是用户的实际问题。

你可能好奇为什么不直接拼一个字符串发给模型。原因是：大模型的消息是分角色的，`SystemMessage`、`HumanMessage`、`AIMessage` 各有各的含义。后续做多轮对话的时候，这种区分会变得很重要。下一课会详细讲这个。

### invoke 调用模型

```ts
const response = await model.invoke([...]);
console.log(response.content);
```

`invoke` 是 LangChain.js 里调用模型的方法。它会：

1. 把消息列表发给模型
2. 等待模型返回结果
3. 拿到 `response`

最后通过 `response.content` 输出模型的回答。

---

## 运行结果

执行：

```bash
pnpm dev
```

实际运行结果：

```text
> tsx src/lessons/lesson01-first-llm-call.ts

模型回答：
RAG（检索增强生成）通过"检索 + 生成"模式工作：先查外部知识库获取依据，再交由大模型作答。此法显著降低幻觉，支持实时/私有数据，无需微调即可提升模型准确性，是当前 AI 工程化落地的主流架构。
```

看到这个输出，说明整条链路已经跑通了：

```text
TypeScript 代码
  ↓
dotenv 读取环境变量
  ↓
LangChain.js ChatOpenAI
  ↓
阿里云百炼 / 通义千问兼容接口
  ↓
模型返回结果
```

---

## 遇到的问题

搭建过程中遇到了两个小问题，记录一下。

### 1. process 标红

在 VS Code 里，`process` 一开始出现红色下划线。

原因是 TypeScript 没有识别当前项目的 Node.js 类型。解决方式：

```bash
pnpm add -D @types/node
```

并在 `tsconfig.json` 中加入：

```json
"types": ["node"]
```

这个问题的本质和 Java 里没引入某个依赖导致 import 报错类似——TypeScript 需要通过 `@types/node` 包来认识 Node.js 的 API。

### 2. tsconfig.json 提示 rootDir 问题

VS Code 提示：

```text
The common source directory of 'tsconfig.json' is './src/lessons'.
The 'rootDir' setting must be explicitly set...
```

解决方式是在 `tsconfig.json` 中明确配置：

```json
"rootDir": "./src",
"outDir": "./dist"
```

这样 TypeScript 就知道源码目录和输出目录分别在哪了。

---

## 和项目整体的关系

这一节做的事情看起来很简单——就是搭了个项目，调了一次模型。

但它的重要性在于：**这是后面所有功能的地基。**

后续不管是 RAG 检索、向量数据库、LangGraph 工作流，还是权限控制、错误处理，都是建立在这条"代码 → 模型 → 返回结果"的链路上。

先把这个跑通，后面每加一个能力都能很快验证。

---

## Java 后端视角理解

如果你也是从 Java 后端过来的，这里做一个简单的类比：

```text
pnpm init          → mvn archetype:generate / gradle init
package.json       → pom.xml / build.gradle
tsconfig.json      → 基本等于 compiler plugin 的配置
pnpm add           → 在 pom.xml 里加 dependency
tsx                → 类似 spring-boot-devtools 的热运行
process.env        → System.getenv()
.env               → application.yml 里的本地配置
pnpm dev           → mvn spring-boot:run
```

核心思路是一样的：初始化项目 → 配置环境 → 引入依赖 → 写代码 → 跑起来验证。

只是工具链从 Java/Maven/Spring 换成了 TypeScript/pnpm/LangChain.js。

---

## TypeScript Tips

如果你之前主要写 Java，刚开始接触 TypeScript 时，有几个地方可能会不太习惯：

- **`import "dotenv/config"`**：这种没有接收变量的 import，相当于执行一个副作用模块。Java 里没有直接对应的概念，可以理解成 static initializer block。
- **`async/await`**：TypeScript 的异步写法比 Java 的 `CompletableFuture` 简洁很多。`async` 标记函数为异步，`await` 等待 Promise 完成。
- **`temperature: 0`**：这个参数控制模型输出的随机性。0 表示尽量确定性输出，数值越大越随机。目前先记住这个就行，后面会多次用到。

---

## 本节总结

本节完成了企业级 AI 知识库助手项目的第一步。

虽然还没有进入 RAG、向量数据库、LangGraph 工作流，但已经完成了最基础、最关键的一件事：

> **用 TypeScript 成功调用大模型。**

具体完成了：

```text
1. 使用 pnpm 初始化项目
2. 安装 TypeScript、tsx、@types/node
3. 配置 tsconfig.json
4. 安装 LangChain.js 相关依赖
5. 使用 dotenv 管理环境变量
6. 通过阿里云百炼 OpenAI 兼容接口调用模型
7. 成功运行第一次 LLM 调用
```

核心收获：

```text
LangChain.js 可以通过 ChatOpenAI 调用任何 OpenAI 兼容接口。
只要配置好 apiKey、baseURL 和 model，就能切换不同模型服务。
```

---

## 下一课预告

下一课会正式进入 LangChain.js 的基础能力：

**第 2 课：LangChain.js 消息模型与 Prompt 基础**

主要内容包括：

```text
SystemMessage 是什么
HumanMessage 是什么
AIMessage 是什么
为什么不能只拼字符串
如何写一个可复用 Prompt
如何让模型按照指定角色回答
```

从下一课开始，会逐渐深入 LangChain.js 的核心概念，为后续 RAG 和 LangGraph 打基础。
