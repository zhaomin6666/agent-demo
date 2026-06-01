# 第 1 课：用 pnpm 搭建 TypeScript AI 项目，并完成第一次 LLM 调用
## 前言

AI Agent是当前火热的开发方向，虽然调侃说“AI时代，只要你学得够慢，你就不用学了”或“每当开发者开发出一个Agent，一个月后模型就会把这个Agent给合并”，但是如果仅仅只去做一个使用者，对于爱探索的开发者来说手痒痒的，这里就从头开始，从一个Java后端开发的角度，开始探索全栈开发AI Agent的路线。

这一系列的目标是逐步完成一个可以展示的项目：

> **企业级 AI 知识库助手**

后续这个项目会逐步加入：

```text
文档加载
文档切分
向量检索
RAG 问答
来源引用
多轮对话
LangGraph 工作流
权限控制
错误处理
产品化架构
```

本篇是第一课，目标很简单：**先把 TypeScript 项目环境搭建起来，并完成第一次大模型调用。**

---

## 一、本节目标

本节主要完成以下几件事：

```text
1. 使用 pnpm 初始化 TypeScript 项目
2. 配置 tsconfig.json
3. 安装 LangChain.js 相关依赖
4. 使用 dotenv 管理环境变量
5. 通过阿里云百炼 / 通义千问的 OpenAI 兼容接口调用模型
6. 跑通第一次 LLM 调用
```

这一节不涉及前端页面，也不涉及复杂的 RAG 流程。

可以把它理解成 Java 项目里的第一个 `main()` 方法：  
先确认项目能启动，模型能正常返回结果。

---

## 二、为什么使用 pnpm？

本项目使用 `pnpm` 作为包管理工具。

和 `npm`、`yarn` 类似，`pnpm` 也是 Node.js 生态中的包管理工具。它的特点是安装速度快、磁盘占用更少，比较适合现代 TypeScript 项目。

本项目后续会涉及比较多的依赖，例如：

```text
LangChain.js
LangGraph.js
Qdrant
dotenv
TypeScript
tsx
```

所以从一开始就使用 pnpm 管理依赖。

---

## 三、创建项目

首先创建项目目录：

```bash
mkdir agent-demo
cd agent-demo
pnpm init
```

执行完成后，项目根目录下会生成：

```text
package.json
```

可以简单理解为：

```text
package.json ≈ Java 项目里的 pom.xml / build.gradle
```

它负责管理项目依赖、脚本命令和项目信息。

---

## 四、安装 TypeScript 环境

安装 TypeScript 相关依赖：

```bash
pnpm add -D typescript tsx @types/node
```

这里几个依赖的作用分别是：

```text
typescript：TypeScript 编译器
tsx：直接运行 .ts 文件的工具
@types/node：Node.js 的类型声明
```

---

## 五、生成并配置 tsconfig.json

执行：

```bash
pnpm exec tsc --init
```

生成：

```text
tsconfig.json
```

然后将 `tsconfig.json` 配置为：

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
target：指定编译后的 JavaScript 版本
module：使用 NodeNext，适配现代 Node.js ESM 模块
moduleResolution：模块解析方式
strict：开启严格模式
types: ["node"]：让 TypeScript 识别 Node.js 类型，比如 process
rootDir：源码目录
outDir：编译输出目录
```

---

## 六、修改 package.json

为了使用 ESM 模块，并方便运行代码，需要修改 `package.json`。

示例：

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

这里重点是两个地方：

```json
"type": "module"
```

表示项目使用 ESM 模块语法。

```json
"dev": "tsx src/lessons/lesson01-first-llm-call.ts"
```

表示执行：

```bash
pnpm dev
```

时，会运行第一课的 TypeScript 文件。

---

## 七、安装 LangChain.js 和 dotenv

接下来安装调用大模型需要的依赖：

```bash
pnpm add @langchain/core @langchain/openai dotenv
```

依赖说明：

```text
@langchain/core：LangChain.js 核心能力
@langchain/openai：OpenAI 兼容模型调用包
dotenv：读取 .env 环境变量
```

虽然这里使用的是阿里云百炼 / 通义千问模型，但因为它提供了 OpenAI 兼容接口，所以可以继续使用 LangChain.js 的 `ChatOpenAI`。

也就是说：

```text
代码层使用 ChatOpenAI
实际请求发给阿里云百炼兼容接口
```

---

## 八、创建项目目录

创建源码目录：

```bash
mkdir -p src/lessons
```

如果是 Windows PowerShell，也可以使用：

```powershell
mkdir src
mkdir src\lessons
```

当前项目结构大致如下：

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

---

## 九、配置环境变量

在项目根目录创建 `.env` 文件：

```env
DASHSCOPE_API_KEY=你的阿里云百炼_API_KEY
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1（如果用别的api，api提供厂商的使用说明中都会提供baseURL地址）
```

这里使用的是阿里云百炼的 OpenAI 兼容接口。

如果后续使用国际站，`baseURL` 可能会不同，需要根据实际控制台文档调整。

为了避免敏感信息提交到 Git，还需要创建 `.gitignore`：

```gitignore
node_modules
.env
dist
```

注意：

> `.env` 文件中包含 API Key，不能提交到 GitHub。

---

## 十、编写第一次 LLM 调用代码

创建文件：

```text
src/lessons/lesson01-first-llm-call.ts
```

代码如下：

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

---

## 十一、代码解释

### 1. 读取环境变量

```ts
import "dotenv/config";
```

这行代码会自动读取项目根目录下的 `.env` 文件。

然后可以通过：

```ts
process.env.DASHSCOPE_API_KEY
process.env.DASHSCOPE_BASE_URL
```

获取配置。

这里的 `process.env` 是 Node.js 中读取环境变量的方式。

---

### 2. 创建模型对象

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

这里使用的是 LangChain.js 的 `ChatOpenAI`。

虽然名字叫 `ChatOpenAI`，但这里实际调用的是阿里云百炼的 OpenAI 兼容接口。

关键配置是：

```ts
apiKey
```

和：

```ts
configuration: {
  baseURL,
}
```

也就是说：

```text
apiKey 决定身份认证
baseURL 决定请求发到哪里
model 决定使用哪个模型
```

---

### 3. SystemMessage

```ts
new SystemMessage("你是一位擅长讲解 AI 工程实践的技术导师。")
```

`SystemMessage` 可以理解为给模型的角色设定。

它告诉模型：

```text
你是谁
你应该用什么风格回答
你应该遵守什么规则
```

在这个例子里，我们让模型扮演一位技术导师。

---

### 4. HumanMessage

```ts
new HumanMessage("请用 100 字以内解释什么是 RAG。")
```

`HumanMessage` 表示用户输入的问题。

也就是这一次真正想问模型的内容。

---

### 5. invoke 调用模型

```ts
const response = await model.invoke([
  new SystemMessage("你是一位擅长讲解 AI 工程实践的技术导师。"),
  new HumanMessage("请用 100 字以内解释什么是 RAG。"),
]);
```

`invoke` 表示调用一次模型。

可以简单理解为：

```text
把消息发送给模型
等待模型返回结果
拿到 response
```

最后输出：

```ts
console.log(response.content);
```

---

## 十二、运行项目

执行：

```bash
pnpm dev
```

实际运行结果：

```text
> tsx src/lessons/lesson01-first-llm-call.ts

模型回答：
RAG（检索增强生成）通过“检索 + 生成”模式工作：先查外部知识库获取依据，再交由大模型作答。此法显著降低幻觉，支持实时/私有数据，无需微调即可提升模型准确性，是当前 AI 工程化落地的主流架构。
```

看到这个输出，说明整个链路已经跑通：

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

## 十三、本节遇到的问题

### 1. process 标红

在 VS Code 中，`process` 一开始出现标红。

原因是 TypeScript 没有识别当前项目的 Node.js 类型。

解决方式：

```bash
pnpm add -D @types/node
```

并在 `tsconfig.json` 中加入：

```json
"types": ["node"]
```

---

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

这样可以让 TypeScript 明确知道源码目录和输出目录。

---

## 十四、本节总结

本节完成了企业级 AI 知识库助手项目的第一步。

虽然还没有进入 RAG、向量数据库、LangGraph 工作流，但已经完成了最基础、最关键的一件事：

> **用 TypeScript 成功调用大模型。**

本节完成内容：

```text
1. 使用 pnpm 初始化项目
2. 安装 TypeScript、tsx、@types/node
3. 配置 tsconfig.json
4. 安装 LangChain.js 相关依赖
5. 使用 dotenv 管理环境变量
6. 通过阿里云百炼 OpenAI 兼容接口调用 qwen-plus
7. 成功运行第一次 LLM 调用
```

核心收获：

```text
LangChain.js 可以通过 ChatOpenAI 调用 OpenAI 兼容接口。
只要配置好 apiKey、baseURL 和 model，就可以切换不同模型服务。
```

---

## 十五、下一课预告

下一课准备学习：

# 第 2 课：LangChain.js 消息模型与 Prompt 基础

主要内容包括：

```text
SystemMessage 是什么
HumanMessage 是什么
AIMessage 是什么
为什么不能只拼字符串
如何写一个可复用 Prompt
如何让模型按照指定角色回答
```

从下一课开始，会正式进入 LangChain.js 的基础能力，为后续 RAG 和 LangGraph 打基础。