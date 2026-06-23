export type AgentStreamRequest = {
  message: string;
  sessionId?: string;
};

export type TraceStatus = "running" | "completed" | "failed";

export type TraceStep = {
  id: string;
  title: string;
  status: TraceStatus;
  detail?: string;
  timestamp: string;
  durationMs?: number;
};

export type SourceItem = {
  id: string;
  title: string;
  type: "lesson" | "doc" | "memory" | "tool";
  url?: string;
  snippet: string;
};

export type AgentStreamChunk =
  | {
      type: "trace";
      step: TraceStep;
    }
  | {
      type: "source";
      source: SourceItem;
    }
  | {
      type: "delta";
      content: string;
    };

export type AgentStreamEvent =
  | {
      type: "start";
      requestId: string;
      sessionId: string;
    }
  | {
      type: "trace";
      step: TraceStep;
    }
  | {
      type: "source";
      source: SourceItem;
    }
  | {
      type: "delta";
      content: string;
    }
  | {
      type: "done";
      requestId: string;
      sessionId: string;
      durationMs: number;
    }
  | {
      type: "error";
      requestId: string;
      sessionId?: string;
      message: string;
    };