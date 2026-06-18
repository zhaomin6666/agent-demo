import type { TraceRecorder } from "../observability/trace-recorder.js";
import type { RagQaChain, RagQaAnswer } from "../rag/rag-qa-chain.js";
import type { EvaluationCase } from "./evaluation-dataset.js";

export type EvaluationResult = {
  caseId: string;
  question: string;
  note: string;

  expectedSources: string[];
  actualSources: string[];

  shouldHaveEvidence: boolean;
  hasEvidence: boolean;

  hitExpectedSource: boolean;
  hitCount: number;
  missedSources: string[];
  unexpectedSources: string[];

  passed: boolean;
  failureReason: string;

  answerPreview: string;
  searchResults: RagQaAnswer["searchResults"];
};

export class RagEvaluator {
  constructor(
    private readonly ragQaChain: RagQaChain,
    private readonly traceRecorder?: TraceRecorder,
  ) {}

  async evaluateCase(
    testCase: EvaluationCase,
    traceId?: string,
  ): Promise<EvaluationResult> {
    const caseSpan = this.traceRecorder?.startSpan({
      traceId,
      type: "evaluation.case",
      name: testCase.id,
      input: {
        question: testCase.question,
      },
      metadata: {
        expectedSources: testCase.expectedSources,
        shouldHaveEvidence: testCase.shouldHaveEvidence,
        note: testCase.note,
      },
    });

    try {
      const answer = await this.ragQaChain.invoke(testCase.question, {
        traceId: caseSpan?.traceId,
      });

      const actualSources = unique(
        answer.searchResults.map((result) => result.source),
      );

      const missedSources = testCase.expectedSources.filter(
        (source) => !actualSources.includes(source),
      );

      const unexpectedSources = actualSources.filter(
        (source) => !testCase.expectedSources.includes(source),
      );

      const hitCount = testCase.expectedSources.length - missedSources.length;

      const hasEvidence = answer.searchResults.length > 0;

      const hitExpectedSource =
        testCase.expectedSources.length === 0 ? !hasEvidence : hitCount > 0;

      const passed = calculatePassed({
        shouldHaveEvidence: testCase.shouldHaveEvidence,
        hasEvidence,
        hitExpectedSource,
      });

      const result = {
        caseId: testCase.id,
        question: testCase.question,
        note: testCase.note,

        expectedSources: testCase.expectedSources,
        actualSources,

        shouldHaveEvidence: testCase.shouldHaveEvidence,
        hasEvidence,

        hitExpectedSource,
        hitCount,
        missedSources,
        unexpectedSources,

        passed,
        failureReason: passed
          ? ""
          : buildFailureReason({
              shouldHaveEvidence: testCase.shouldHaveEvidence,
              hasEvidence,
              missedSources,
              actualSources,
            }),

        answerPreview: answer.answer.slice(0, 160),
        searchResults: answer.searchResults,
      };

      caseSpan?.end({
        output: {
          passed: result.passed,
          expectedSources: result.expectedSources,
          actualSources: result.actualSources,
          hasEvidence: result.hasEvidence,
          failureReason: result.failureReason || undefined,
        },
      });

      return result;
    } catch (error) {
      caseSpan?.fail(error);
      throw error;
    }
  }

  async evaluateAll(testCases: EvaluationCase[]): Promise<EvaluationResult[]> {
    const runSpan = this.traceRecorder?.startSpan({
      type: "evaluation.run",
      name: "RagEvaluator.evaluateAll",
      input: {
        caseCount: testCases.length,
      },
    });

    const results: EvaluationResult[] = [];

    for (const testCase of testCases) {
      const result = await this.evaluateCase(testCase, runSpan?.traceId);
      results.push(result);
    }
    runSpan?.end({
      output: {
        total: results.length,
        passed: results.filter((result) => result.passed).length,
        failed: results.filter((result) => !result.passed).length,
      },
    });
    return results;
  }
}

function calculatePassed(params: {
  shouldHaveEvidence: boolean;
  hasEvidence: boolean;
  hitExpectedSource: boolean;
}): boolean {
  if (!params.shouldHaveEvidence) {
    return !params.hasEvidence;
  }

  return params.hasEvidence && params.hitExpectedSource;
}

function buildFailureReason(params: {
  shouldHaveEvidence: boolean;
  hasEvidence: boolean;
  missedSources: string[];
  actualSources: string[];
}): string {
  if (!params.shouldHaveEvidence && params.hasEvidence) {
    return `预期无依据，但实际检索到了来源：${params.actualSources.join(", ")}`;
  }

  if (params.shouldHaveEvidence && !params.hasEvidence) {
    return "预期应该有依据，但实际没有检索到资料。";
  }

  if (params.missedSources.length > 0) {
    return `未命中预期来源：${params.missedSources.join(", ")}`;
  }

  return "未知失败原因。";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
