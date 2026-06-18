import { evaluationDataset,EvaluationCase } from "./evaluation/evaluation-dataset.js";
import { printEvaluationReport } from "./evaluation/evaluation-report.js";
import { RagEvaluator } from "./evaluation/rag-evaluator.js";
import { createModel } from "./model/create-model.js";
import { printTraceReport } from "./observability/trace-report.js";
import { TraceRecorder } from "./observability/trace-recorder.js";
import { createRagRuntime } from "./rag-runtime.js";
import { createTools } from "./tools/index.js";

async function main() {
  const traceRecorder = new TraceRecorder();

  const model = createModel();

  const ragRuntime = await createRagRuntime({
    model,
    traceRecorder,
  });

  console.log("\n========== Observability Demo 初始化完成 ==========");
  console.log("检索模式：", ragRuntime.retrievalMode);
  console.log("文档数量：", ragRuntime.documentCount);
  console.log("Chunk 数量：", ragRuntime.chunkCount);
  console.log("Embedding 数量：", ragRuntime.embeddingCount);
  console.log("评测用例数量：", evaluationDataset.length);

  const evaluator = new RagEvaluator(
    ragRuntime.ragQaChain,
    traceRecorder,
  );

  // const results = await evaluator.evaluateAll(evaluationDataset);
  // printEvaluationReport(results);

  const singleCase = evaluationDataset[0];
  console.log("\n========== 当前运行评测用例 ==========");
  console.log("caseId：", singleCase.id);
  console.log("question：", singleCase.question);
  const result = await evaluator.evaluateCase(singleCase);
  printEvaluationReport([result]);

  const tools = createTools({
    ragQaChain: ragRuntime.ragQaChain,
    traceRecorder,
  });

  const searchKnowledgeBaseTool = tools.find(
    (item) => item.name === "search_knowledge_base",
  );

  if (!searchKnowledgeBaseTool) {
    throw new Error("未找到 search_knowledge_base 工具");
  }

  //console.log("\n========== Tool Call Observability Demo ==========");

  //const toolResult = await searchKnowledgeBaseTool.invoke({
  //  query: "agent-tool-policy.md 里关于工具调用安全是怎么说的？",
  //});

  //console.log(toolResult);

  printTraceReport(traceRecorder);
}

main().catch((error) => {
  console.error("运行失败：", error);
});