import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { streamAgentAnswer } from "./streamingAgentService.js";
import { writeSseEvent } from "./sse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = Fastify({
  logger: true,
});

await server.register(cors, {
  origin: true,
});

await server.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

server.get("/health", async () => {
  return {
    status: "ok",
    lesson: "lesson27-token-by-token-output",
    timestamp: new Date().toISOString(),
  };
});

server.post<{
  Body: {
    message?: string;
  };
}>("/api/agent-demo/stream", async (request, reply) => {
  const requestId = randomUUID();
  const start = Date.now();

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

  reply.hijack();

  const raw = reply.raw;

  raw.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  raw.flushHeaders();

  let closed = false;

  raw.on("close", () => {
    closed = true;
  });

  try {
    writeSseEvent(raw, "start", {
      type: "start",
      requestId,
    });

    for await (const content of streamAgentAnswer({ message })) {
      if (closed) {
        break;
      }

      writeSseEvent(raw, "delta", {
        type: "delta",
        content,
      });
    }

    if (!closed) {
      writeSseEvent(raw, "done", {
        type: "done",
        requestId,
        durationMs: Date.now() - start,
      });

      raw.end();
    }
  } catch (error) {
    request.log.error(error);

    if (!closed) {
      writeSseEvent(raw, "error", {
        type: "error",
        requestId,
        message: "Agent 流式调用失败",
      });

      raw.end();
    }
  }
});

const port = Number(process.env.AGENT_API_PORT ?? 3001);

await server.listen({
  port,
  host: "0.0.0.0",
});

console.log(`Lesson 27 Token Output UI is running at http://localhost:${port}`);