import type { ServerResponse } from "node:http";

export function writeSseEvent(
  raw: ServerResponse,
  event: string,
  data: unknown,
): void {
  raw.write(`event: ${event}\n`);
  raw.write(`data: ${JSON.stringify(data)}\n\n`);
}