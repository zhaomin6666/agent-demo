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
    lesson: "lesson29-agent-demo-productization",
    timestamp: new Date().toISOString(),
  };
});

server.post<{
  Body: {
    message?: string;
    sessionId?: string;
  };
}>("/api/agent-demo/stream", async (request, reply) => {
  const requestId = randomUUID();
  const sessionId = request.body.sessionId?.trim() || randomUUID();
  const start = Date.now();

  const message = request.body.message?.trim();

  if (!message) {
    return reply.code(400).send({
      success: false,
      error: {
        code: "BAD_REQUEST",
        message: "message 不能为空",
        requestId,
        sessionId,
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
      sessionId,
    });

    writeSseEvent(raw, "trace", {
      type: "trace",
      step: {
        id: "request_received",
        title: "接收请求",
        status: "completed",
        detail: "Fastify 已接收到用户问题，并创建 requestId / sessionId。",
        timestamp: new Date().toISOString(),
        durationMs: 0,
      },
    });

    for await (const chunk of streamAgentAnswer({ message, sessionId })) {
      if (closed) {
        break;
      }

      if (chunk.type === "trace") {
        writeSseEvent(raw, "trace", {
          type: "trace",
          step: chunk.step,
        });
      }

      if (chunk.type === "source") {
        writeSseEvent(raw, "source", {
          type: "source",
          source: chunk.source,
        });
      }

      if (chunk.type === "delta") {
        writeSseEvent(raw, "delta", {
          type: "delta",
          content: chunk.content,
        });
      }
    }

    if (!closed) {
      writeSseEvent(raw, "done", {
        type: "done",
        requestId,
        sessionId,
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
        sessionId,
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

console.log(`Lesson 29 Agent Demo MVP is running at http://localhost:${port}`);