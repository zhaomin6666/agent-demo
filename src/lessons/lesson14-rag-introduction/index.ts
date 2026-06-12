import { enterpriseDocs } from "./data/enterprise-docs.js";
import { createModel } from "./model/create-model.js";
import { RagChain } from "./rag/rag-chain.js";
import { SimpleRetriever } from "./rag/simple-retriever.js";

async function main() {
  const model = createModel();

  const retriever = new SimpleRetriever(enterpriseDocs, {
    topK: 3,
  });

  const ragChain = new RagChain(model, retriever);

  const questions = [
    "企业知识库支持哪些数据源？",
    "RAG 检索效果不好应该怎么优化？",
    "viewer 用户可以创建工单吗？",
    "企业知识库支持自动生成财务报表吗？",
  ];

  for (const question of questions) {
    console.log("\n\n========================================");
    console.log("用户问题：", question);

    const result = await ragChain.invoke(question);

    console.log("\n========== 检索到的资料 ==========");
    console.log(JSON.stringify(result.retrievedDocs, null, 2));

    console.log("\n========== 拼接后的上下文 ==========");
    console.log(result.context);

    console.log("\n========== RAG 最终回答 ==========");
    console.log(result.answer);
  }
}

main().catch((error) => {
  console.error("运行失败：", error);
});