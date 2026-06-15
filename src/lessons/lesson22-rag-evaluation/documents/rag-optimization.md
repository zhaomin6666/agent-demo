---
title: RAG 检索效果不好怎么办
source: rag-optimization.md
tags: rag,retrieval,optimization
---

# RAG 检索效果不好怎么办

如果 RAG 检索效果不好，可以从文档切分、Embedding 模型、召回数量、关键词补充、重排序、Prompt 约束等方面优化。

文档切分会直接影响检索质量。chunk 太大，可能包含过多无关内容；chunk 太小，可能丢失上下文。

Embedding 模型会影响语义匹配能力。不同语言、不同业务领域，适合的 Embedding 模型可能不同。

召回数量 topK 也需要调优。topK 太小可能漏掉相关资料，topK 太大可能引入噪音。

在企业知识库中，还可以结合关键词检索和向量检索，形成混合检索策略。