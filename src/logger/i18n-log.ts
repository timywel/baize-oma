// baize-oma/src/logger/i18n-log.ts
//
// Phase 12 i18n 错误日志 helper. 按白盒 spec A10 + CLAUDE.md §i18n:
// 所有错误信息走 i18n key (errors.oma.<CODE>), 不硬编码中文/英文.
//
// 与 src/whitebox/i18n.ts 互补: 那个是白盒内部用, 这个是 logger 用.
// 两者映射规则一致 (errors.oma.<CODE>), 共享 KNOWN_ERROR_CODES.

import type { Request } from "express";
import { logger } from "./logger.js";
import { i18nErrorKey } from "../whitebox/i18n.js";
import { setLastError, pushErrorToTrace } from "../whitebox/snapshot.js";
import type { LastError } from "../whitebox/types.js";

/** 路由层 catch 时调用: 写结构化错误日志 + 更新 lastError + 推 trace. */
export function logError(
  req: Request,
  err: unknown,
  context: { code: string; capability: string; detail?: string },
): void {
  const e = err as Error;
  const occurredAt = new Date().toISOString();
  const i18nKey = i18nErrorKey(context.code);

  // 1. 写 pino 日志
  logger.error({
    trace_id: req.traceId,
    msg: i18nKey,
    capability: context.capability,
    error: e.message,
    stack: e.stack,
    detail: context.detail,
  });

  // 2. 更新 lastError (白盒)
  const lastError: LastError = {
    code: context.code,
    message: i18nKey,
    detail: context.detail ?? e.message,
    occurredAt,
    trace_id: req.traceId,
  };
  setLastError(lastError);
  pushErrorToTrace(lastError);
}

/** 路由层入口时调用: 写 info 日志. */
export function logRequest(req: Request, context: { capability: string; input_size?: number }): void {
  logger.info({
    trace_id: req.traceId,
    msg: "received POST",
    capability: context.capability,
    input_size: context.input_size,
    method: req.method,
    path: req.path,
  });
}

/** 路由层出口时调用: 写 info 日志. */
export function logResponse(
  req: Request,
  context: { capability: string; status: number; duration_ms: number; extra?: Record<string, unknown> },
): void {
  logger.info({
    trace_id: req.traceId,
    msg: "response sent",
    capability: context.capability,
    status: context.status,
    duration_ms: context.duration_ms,
    ...context.extra,
  });
}