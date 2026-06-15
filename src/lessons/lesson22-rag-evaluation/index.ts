import { evaluationDataset } from "./evaluation/evaluation-dataset.js";
import { printEvaluationReport } from "./evaluation/evaluation-report.js";
import { RagEvaluator } from "./evaluation/rag-evaluator.js";
import { createModel } from "./model/create-model.js";
import { createRagRuntime } from "./rag-runtime.js";

async function main() {
  const model = createModel();

  const ragRuntime = await createRagRuntime({
    model,
  });

  console.log("\n========== RAG Evaluation 初始化完成 ==========");
  console.log("检索模式：", ragRuntime.retrievalMode);
  console.log("文档数量：", ragRuntime.documentCount);
  console.log("Chunk 数量：", ragRuntime.chunkCount);
  console.log("Embedding 数量：", ragRuntime.embeddingCount);
  console.log("评测用例数量：", evaluationDataset.length);

  const evaluator = new RagEvaluator(ragRuntime.ragQaChain);

  const results = await evaluator.evaluateAll(evaluationDataset);

  printEvaluationReport(results);
}

main().catch((error) => {
  console.error("运行失败：", error);
});