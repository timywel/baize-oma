// baize-oma/src/whitebox/types.ts
//
// Phase 11 白盒显现类型定义. 对齐 baize-loop 主仓
// plan/refactor/slots-and-libs/8-slot-whitebox-observability-spec.md §2.1.2.
//
// baize-oma 是外部 http slot, 必填字段:
// - slotId / slotVersion / capturedAt / state
// - inFlight (正在执行的能力列表)
// - lastError (最近一次错误, 可选)
// - trace (最近 20 条事件)
// - upstream (vendor/version/endpoint/healthy, 外部 slot 替换 internals)
// - internals (baize-oma 自定字段)

/** 白盒状态. */
export type WhiteboxState =
  | "idle"        // 无任务
  | "loading"     // 启动中
  | "active"      // 正在处理请求
  | "degraded"    // 部分能力降级
  | "unhealthy"   // 不健康
  | "stopped";    // 已停止

/** 正在执行的能力. */
export interface InFlightCapability {
  /** capability 名称, e.g. "task.decompose". */
  capability: string;
  /** 启动时间 ISO 8601. */
  startedAt: string;
  /** 进度 0-1, 可选. */
  progress?: number;
  /** 调试上下文, 不含 PII. */
  context?: Record<string, unknown>;
}

/** 最近一次错误. */
export interface LastError {
  /** 错误码, e.g. "DECOMPOSE_FAILED". */
  code: string;
  /** 错误信息 (i18n key, e.g. "errors.oma.DECOMPOSE_FAILED"). */
  message: string;
  /** 错误对象 message (技术细节, 非 PII). */
  detail?: string;
  /** 触发时间 ISO 8601. */
  occurredAt: string;
  /** 关联 trace_id. */
  trace_id?: string;
}

/** 追踪事件. */
export interface TraceEvent {
  /** ISO 8601. */
  ts: string;
  /** 日志级别. */
  level: "debug" | "info" | "warn" | "error";
  /** 事件消息 (i18n key 或简短英文, 不含中文字符串). */
  msg: string;
  /** 关联 trace_id. */
  trace_id?: string;
  /** 额外字段. */
  extra?: Record<string, unknown>;
}

/** 上游 vendor 状态 (外部 http slot 必填). */
export interface WhiteboxUpstream {
  /** vendor 名称, e.g. "open-multi-agent". */
  vendor: string;
  /** vendor 版本, e.g. "1.8.0". */
  version: string;
  /** 入口路径, e.g. "vendor/open-multi-agent" 或 "http://127.0.0.1:20130". */
  endpoint: string;
  /** 健康状态. */
  healthy: boolean;
  /** 健康详情 (e.g. 错误信息, 可选). */
  detail?: string;
}

/** baize-oma 自定 internals. */
export interface BaizeWhiteboxInternals {
  /** 启动后秒数. */
  uptime: number;
  /** 累计请求数. */
  totalRequests: number;
  /** 平均延迟 ms. */
  avgLatencyMs: number;
  /** 当前 capability 路由表 (id → endpoint). */
  routes: string[];
  /** 仓版本 (冗余 slotVersion, 便于不读根). */
  packageVersion: string;
}

/** 完整白盒快照. */
export interface WhiteboxSnapshot {
  slotId: string;
  slotVersion: string;
  capturedAt: string;
  state: WhiteboxState;
  inFlight: InFlightCapability[];
  lastError?: LastError;
  trace: TraceEvent[];
  upstream: WhiteboxUpstream;
  internals: BaizeWhiteboxInternals;
}
