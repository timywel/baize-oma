// baize-oma/src/whitebox/snapshot.ts
//
// Phase 11 白盒快照聚合. 按白盒 spec A4:
// build() 聚合 trace buffer + inFlight + upstream + lastError → WhiteboxSnapshot.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  WhiteboxSnapshot,
  WhiteboxState,
  LastError,
} from "./types.js";
import { globalTraceBuffer } from "./trace-buffer.js";
import { globalInFlightTracker } from "./inflight-tracker.js";
import { detectUpstream, detectLlmProvider } from "./upstream.js";

const PACKAGE_VERSION = readPackageVersion();
const START_TIME = Date.now();

/** 仓内单例 lastError (按白盒 spec: 整个仓一个 lastError, 不按 capability). */
let lastError: LastError | undefined;

/** 设置 lastError (路由层 catch 时调用). */
export function setLastError(err: LastError): void {
  lastError = err;
}

/** 清空 lastError (测试用). */
export function clearLastError(): void {
  lastError = undefined;
}

/** 构造完整 WhiteboxSnapshot. */
export function buildSnapshot(): WhiteboxSnapshot {
  const inFlight = globalInFlightTracker.snapshot();
  const trace = globalTraceBuffer.snapshot();
  const upstream = detectUpstream();
  const llm = detectLlmProvider();

  // 状态判定:
  // - 有 inFlight → active
  // - 有 lastError 且 30s 内 → degraded
  // - 上游不健康 → degraded
  // - 否则 → idle
  const state = computeState(inFlight.length, lastError, upstream.healthy);

  return {
    slotId: "baize-oma",
    slotVersion: PACKAGE_VERSION,
    capturedAt: new Date().toISOString(),
    state,
    inFlight: inFlight as WhiteboxSnapshot["inFlight"],
    lastError,
    trace: trace as WhiteboxSnapshot["trace"],
    upstream,
    internals: {
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      totalRequests: 0, // P12 阶段接入 logger 后会真实统计
      avgLatencyMs: 0, // P12 阶段接入 logger 后会真实统计
      routes: [
        "GET /health",
        "GET /manifest",
        "POST /oma.team.create",
        "POST /chat.agent.team.schedule",
        "POST /chat.loop.execute",
        "POST /dag.execute",
        "POST /dag.visualize",
        "GET /whitebox",
        "GET /whitebox/upstream",
        "GET /whitebox/trace",
      ],
      packageVersion: PACKAGE_VERSION,
    },
  };
}

function computeState(
  inFlightCount: number,
  lastError: LastError | undefined,
  upstreamHealthy: boolean,
): WhiteboxState {
  if (inFlightCount > 0) return "active";
  if (lastError) {
    const occurred = new Date(lastError.occurredAt).getTime();
    if (Date.now() - occurred < 30_000) return "degraded";
  }
  if (!upstreamHealthy) return "degraded";
  return "idle";
}

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf-8"),
    ) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** 推 lastError 同步到 trace buffer (一个错误 2 个消费者). */
export function pushErrorToTrace(err: LastError): void {
  globalTraceBuffer.push({
    ts: err.occurredAt,
    level: "error",
    msg: err.code,
    trace_id: err.trace_id,
    extra: { detail: err.detail },
  });
}
