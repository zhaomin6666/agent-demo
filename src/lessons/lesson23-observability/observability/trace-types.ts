export type TraceEventStatus = "started" | "completed" | "failed";

export type TraceEventType =
  | "evaluation.run"
  | "evaluation.case"
  | "rag.invoke"
  | "rag.retrieve"
  | "rag.context"
  | "rag.generate"
  | "tool.call";

export type TraceEvent = {
  id: string;
  traceId: string;
  spanId: string;
  type: TraceEventType;
  name: string;
  status: TraceEventStatus;
  timestamp: string;
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  error?: string;
};

export type StartTraceSpanParams = {
  traceId?: string;
  type: TraceEventType;
  name: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
};

export type EndTraceSpanParams = {
  output?: unknown;
  metadata?: Record<string, unknown>;
};

export type ActiveTraceSpan = {
  traceId: string;
  spanId: string;
  end(params?: EndTraceSpanParams): void;
  fail(error: unknown, metadata?: Record<string, unknown>): void;
};
