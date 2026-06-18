import type { EvaluationResult } from "./rag-evaluator.js";

export type EvaluationSummary = {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  evidenceCases: number;
  evidencePassed: number;
  noEvidenceCases: number;
  noEvidencePassed: number;
};

export function summarizeEvaluation(
  results: EvaluationResult[],
): EvaluationSummary {
  const total = results.length;

  const passed = results.filter((result) => result.passed).length;

  const evidenceCases = results.filter(
    (result) => result.shouldHaveEvidence,
  );

  const noEvidenceCases = results.filter(
    (result) => !result.shouldHaveEvidence,
  );

  const evidencePassed = evidenceCases.filter(
    (result) => result.passed,
  ).length;

  const noEvidencePassed = noEvidenceCases.filter(
    (result) => result.passed,
  ).length;

  return {
    total,
    passed,
    failed: total - passed,
    passRate: total === 0 ? 0 : passed / total,
    evidenceCases: evidenceCases.length,
    evidencePassed,
    noEvidenceCases: noEvidenceCases.length,
    noEvidencePassed,
  };
}

export function printEvaluationReport(results: EvaluationResult[]) {
  const summary = summarizeEvaluation(results);

  console.log("\n========== RAG Evaluation Summary ==========");
  console.log("总用例数：", summary.total);
  console.log("通过数量：", summary.passed);
  console.log("失败数量：", summary.failed);
  console.log("通过率：", `${(summary.passRate * 100).toFixed(2)}%`);
  console.log(
    "有依据问题通过：",
    `${summary.evidencePassed}/${summary.evidenceCases}`,
  );
  console.log(
    "无依据问题通过：",
    `${summary.noEvidencePassed}/${summary.noEvidenceCases}`,
  );

  console.log("\n========== RAG Evaluation Details ==========");

  for (const result of results) {
    console.log("\n----------------------------------------");
    console.log("用例：", result.caseId);
    console.log("结果：", result.passed ? "PASS" : "FAIL");
    console.log("问题：", result.question);
    console.log("说明：", result.note);

    console.log("预期来源：", formatList(result.expectedSources));
    console.log("实际来源：", formatList(result.actualSources));
    console.log("是否应该有依据：", result.shouldHaveEvidence);
    console.log("实际是否有依据：", result.hasEvidence);

    if (!result.passed) {
      console.log("失败原因：", result.failureReason);
    }

    console.log("\n检索结果：");
    for (const [index, searchResult] of result.searchResults.entries()) {
      console.log(`Top ${index + 1}`);
      console.log("chunkId:", searchResult.chunkId);
      console.log("title:", searchResult.title);
      console.log("source:", searchResult.source);
      console.log("score:", searchResult.score.toFixed(4));
      console.log(
        "originalScore:",
        searchResult.originalScore?.toFixed(4) ?? "无",
      );
      console.log(
        "rerankScore:",
        searchResult.rerankScore?.toFixed(4) ?? "无",
      );
      console.log("retrievalSources:", searchResult.retrievalSources.join(", "));
      console.log("matchedKeywords:", searchResult.matchedKeywords.join(", "));
      console.log("rerankReasons:", searchResult.rerankReasons.join("；"));
    }

    console.log("\n答案预览：");
    console.log(result.answerPreview || "无");
  }
}

function formatList(values: string[]): string {
  return values.length === 0 ? "无" : values.join(", ");
}