import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { createModel } from "./model/create-model.js";
import type { RouterDecision, TargetAgent } from "./types.js";

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

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`模型没有返回合法 JSON：${text}`);
  }

  return text.slice(start, end + 1);
}

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

  const studyKeywords = [
    "学习",
    "计划",
    "路线",
    "课程",
    "复习",
    "面试准备",
    "roadmap",
  ];

  const techKeywords = [
    "解释",
    "原理",
    "是什么",
    "区别",
    "架构",
    "sse",
    "agent",
    "langchain",
    "langgraph",
  ];

  if (codeKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      targetAgent: "code_helper",
      confidence: 0.65,
      reason: "规则兜底：问题包含代码或实现相关关键词。",
    };
  }

  if (studyKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      targetAgent: "study_planner",
      confidence: 0.65,
      reason: "规则兜底：问题包含学习规划相关关键词。",
    };
  }

  if (techKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      targetAgent: "tech_explainer",
      confidence: 0.65,
      reason: "规则兜底：问题包含技术解释相关关键词。",
    };
  }

  return {
    targetAgent: "general_fallback",
    confidence: 0.5,
    reason: "规则兜底：没有匹配到明确专家，交给通用 Agent。",
  };
}

export async function routeMessage(message: string): Promise<RouterDecision> {
  const model = createModel();

  const result = await model.invoke([
    new SystemMessage(
      [
        "你是一个 Router Agent，负责判断用户问题应该交给哪个专家 Agent。",
        "",
        "可选专家 Agent：",
        "1. tech_explainer：适合解释技术概念、架构、原理、区别。",
        "2. code_helper：适合编写代码、修改代码、排查报错、给出示例。",
        "3. study_planner：适合学习路线、课程安排、复习计划、面试准备。",
        "4. general_fallback：适合无法明确分类的问题。",
        "",
        "你必须只返回 JSON，不要返回 Markdown，不要使用代码块。",
        "JSON 格式：",
        '{"targetAgent":"tech_explainer | code_helper | study_planner | general_fallback","confidence":0到1之间的数字,"reason":"判断原因"}',
      ].join("\n"),
    ),
    new HumanMessage(message),
  ]);

  try {
    const content = String(result.content);
    const jsonText = extractJsonObject(content);
    const parsed = JSON.parse(jsonText);
    const validated = routerDecisionSchema.parse(parsed);

    return validated satisfies {
      targetAgent: TargetAgent;
      confidence: number;
      reason: string;
    };
  } catch (error) {
    return keywordFallbackRoute(message);
  }
}