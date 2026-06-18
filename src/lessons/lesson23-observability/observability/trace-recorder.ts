import { randomUUID } from "node:crypto";

import type {
  ActiveTraceSpan,
  EndTraceSpanParams,
  StartTraceSpanParams,
  TraceEvent,
} from "./trace-types.js";

export class TraceRecorder {
  private readonly events: TraceEvent[] = [];

  startSpan(params: StartTraceSpanParams): ActiveTraceSpan {
    const traceId = params.traceId ?? createId("trace");
    const spanId = createId("span");
    const startedAt = Date.now();

    this.events.push({
      id: createId("event"),
      traceId,
      spanId,
      type: params.type,
      name: params.name,
      status: "started",
      timestamp: new Date(startedAt).toISOString(),
      input: params.input,
      metadata: params.metadata,
    });

    return {
      traceId,
      spanId,
      end: (endParams?: EndTraceSpanParams) => {
        const endedAt = Date.now();

        this.events.push({
          id: createId("event"),
          traceId,
          spanId,
          type: params.type,
          name: params.name,
          status: "completed",
          timestamp: new Date(endedAt).toISOString(),
          durationMs: endedAt - startedAt,
          input: params.input,
          output: endParams?.output,
          metadata: {
            ...params.metadata,
            ...endParams?.metadata,
          },
        });
      },
      fail: (error: unknown, metadata?: Record<string, unknown>) => {
        const endedAt = Date.now();

        this.events.push({
          id: createId("event"),
          traceId,
          spanId,
          type: params.type,
          name: params.name,
          status: "failed",
          timestamp: new Date(endedAt).toISOString(),
          durationMs: endedAt - startedAt,
          input: params.input,
          metadata: {
            ...params.metadata,
            ...metadata,
          },
          error: normalizeError(error),
        });
      },
    };
  }

  getEvents(): TraceEvent[] {
    return [...this.events];
  }

  clear() {
    this.events.length = 0;
  }
}

function createId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}