import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import { runAgentApiDemo } from "./agentService.js";

const server = Fastify({
  logger: true,
});

await server.register(cors, {
  origin: true,
});

server.get("/health", async () => {
  return {
    status: "ok",
    lesson: "lesson24-agent-api-service",
    timestamp: new Date().toISOString(),
  };
});

server.post<{
  Body: {
    message?: string;
  };
}>("/api/agent-demo", async (request, reply) => {
  const requestId = randomUUID();
  const start = Date.now();

  try {
    const message = request.body.message?.trim();

    if (!message) {
      return reply.code(400).send({
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "message 不能为空",
          requestId,
        },
      });
    }

    const result = await runAgentApiDemo({
      message,
    });

    return {
      success: true,
      data: {
        answer: result.answer,
        requestId,
        durationMs: Date.now() - start,
      },
    };
  } catch (error) {
    request.log.error(error);

    return reply.code(500).send({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Agent API 调用失败",
        requestId,
      },
    });
  }
});

const port = Number(process.env.AGENT_API_PORT ?? 3001);

await server.listen({
  port,
  host: "0.0.0.0",
});

console.log(`Lesson 24 API is running at http://localhost:${port}`);