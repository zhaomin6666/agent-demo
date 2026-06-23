export type AgentStreamRequest = {
  message: string;
};

export type AgentStreamEvent =
  | {
      type: "start";
      requestId: string;
    }
  | {
      type: "delta";
      content: string;
    }
  | {
      type: "done";
      requestId: string;
      durationMs: number;
    }
  | {
      type: "error";
      requestId: string;
      message: string;
    };