// baize-oma/src/logger/trace-id.ts
//
// Phase 12 trace_id middleware + Express Request 类型扩展.
//
// 用法:
// app.use(traceIdMiddleware);
//
// 行为:
// 1. 从请求头 X-Trace-Id 读取, 缺失则生成 UUID v4
// 2. 写入 req.traceId (Express Request 类型扩展)
// 3. 写入响应头 X-Trace-Id (透传, 便于跨 slot 日志 grep)

import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

declare module "express-serve-static-core" {
  interface Request {
    traceId: string;
  }
}

const HEADER = "X-Trace-Id";
const HEADER_LOWER = HEADER.toLowerCase();

/** Express middleware. */
export function traceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER);
  req.traceId = incoming && incoming.length > 0 ? incoming : randomUUID();
  res.setHeader(HEADER, req.traceId);
  next();
}

/** Helper: 生成新 UUID (用于业务代码主动生成, e.g. decompose 子任务). */
export function newTraceId(): string {
  return randomUUID();
}

/** Helper: 从对象读取 traceId (兼容 logger 调用). */
export function getTraceId(req: Request): string {
  return req.traceId ?? randomUUID();
}

/** Export header 名供测试. */
export const TRACE_HEADER = HEADER;
export const TRACE_HEADER_LOWER = HEADER_LOWER;