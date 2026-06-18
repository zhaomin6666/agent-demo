import type { TraceEvent } from "./trace-types.js";
import type { TraceRecorder } from "./trace-recorder.js";

export function printTraceReport(traceRecorder: TraceRecorder) {
  const events = traceRecorder.getEvents();

  printTraceSummary(events);
  printTraceDetails(events);
}

function printTraceSummary(events: TraceEvent[]) {
  const completedEvents = events.filter(
    (event) => event.status === "completed",
  );

  const failedEvents = events.filter((event) => event.status === "failed");

  const groupedByType = groupBy(events, (event) => event.type);

  console.log("\n========== Trace Summary ==========");
  console.log("事件总数：", events.length);
  console.log("完成事件数：", completedEvents.length);
  console.log("失败事件数：", failedEvents.length);
  console.log("Trace 数量：", new Set(events.map((event) => event.traceId)).size);

  console.log("\n按类型统计：");
  for (const [type, typeEvents] of Object.entries(groupedByType)) {
    const completedCount = typeEvents.filter(
      (event) => event.status === "completed",
    ).length;

    const failedCount = typeEvents.filter(
      (event) => event.status === "failed",
    ).length;

    console.log(
      `- ${type}: total=${typeEvents.length}, completed=${completedCount}, failed=${failedCount}`,
    );
  }
}

function printTraceDetails(events: TraceEvent[]) {
  const displayEvents = events.filter((event) => event.status !== "started");

  console.log("\n========== Trace Details ==========");

  for (const event of displayEvents) {
    console.log("\n----------------------------------------");
    console.log("traceId:", event.traceId);
    console.log("spanId:", event.spanId);
    console.log("type:", event.type);
    console.log("name:", event.name);
    console.log("status:", event.status);
    console.log("durationMs:", event.durationMs ?? "无");

    if (event.error) {
      console.log("error:", event.error);
    }

    if (event.metadata) {
      console.log("metadata:", JSON.stringify(event.metadata, null, 2));
    }

    if (event.output) {
      console.log("output:", JSON.stringify(event.output, null, 2));
    }
  }
}

function groupBy<T>(
  values: T[],
  getKey: (value: T) => string,
): Record<string, T[]> {
  return values.reduce<Record<string, T[]>>((record, value) => {
    const key = getKey(value);

    record[key] ??= [];
    record[key].push(value);

    return record;
  }, {});
}