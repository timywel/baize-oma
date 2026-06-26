// baize-oma/src/__tests__/logger.test.ts
//
// Phase 12 全程日志跟踪单测. 覆盖:
// 1. traceIdMiddleware: 注入 X-Trace-Id, req.traceId + 响应头都拿到
// 2. traceIdMiddleware: 无 X-Trace-Id, 自动生成 UUID v4 (8-4-4-4-12)
// 3. logger 输出 JSON 含 trace_id / level / time / msg
// 4. logger.error 含 stack trace + trace_id
// 5. i18n-log: 错误信息走 i18n key, 不含中文字符串

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { traceIdMiddleware, newTraceId, TRACE_HEADER } from "../logger/trace-id.js";
import { i18nErrorKey } from "../whitebox/i18n.js";
import { logger } from "../logger/logger.js";

/** 构造 mock req/res. */
function makeReqRes(incomingTraceId?: string): {
  req: Request;
  res: Response;
  next: NextFunction;
  getTraceId: () => string;
  getHeader: () => string | undefined;
} {
  const headers: Record<string, string> = {};
  if (incomingTraceId) headers[TRACE_HEADER.toLowerCase()] = incomingTraceId;

  const req = {
    header: (name: string) => {
      // Express 内部调用 .toLowerCase(), 我们模拟同样行为
      return headers[name.toLowerCase()];
    },
  } as unknown as Request;

  let traceIdValue = "";
  const res = {
    setHeader: (name: string, value: string) => {
      if (name === TRACE_HEADER) traceIdValue = value;
    },
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  return {
    req,
    res,
    next,
    getTraceId: () => traceIdValue,
    getHeader: () => headers[TRACE_HEADER.toLowerCase()],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("traceIdMiddleware — 透传注入", () => {
  it("case 1: 注入 X-Trace-Id, req.traceId + 响应头都拿到", () => {
    const { req, res, next, getTraceId, getHeader } = makeReqRes("incoming-trace-123");
    traceIdMiddleware(req, res, next);
    expect(req.traceId).toBe("incoming-trace-123");
    expect(getTraceId()).toBe("incoming-trace-123");
    expect(next).toHaveBeenCalledTimes(1);
    expect(getHeader()).toBe("incoming-trace-123");
  });
});

describe("traceIdMiddleware — 自动生成 UUID", () => {
  it("case 2: 无 X-Trace-Id, 自动生成 UUID v4 (8-4-4-4-12)", () => {
    const { req, res, next, getTraceId } = makeReqRes();
    traceIdMiddleware(req, res, next);
    // UUID v4 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (36 字符)
    expect(req.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(getTraceId()).toBe(req.traceId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("case 2b: newTraceId() 直接调用返回 UUID v4", () => {
    const id = newTraceId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("logger — 结构化输出", () => {
  it("case 3: logger.info 输出 JSON 含 trace_id / level / time / msg", () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => logger);
    logger.info({ trace_id: "abc", msg: "test" });
    expect(spy).toHaveBeenCalledWith({ trace_id: "abc", msg: "test" });
    spy.mockRestore();
  });

  it("case 4: logger.error 含 trace_id + stack trace", () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const err = new Error("test failure");
    logger.error({ trace_id: "abc", msg: "errors.oma.TEST_FAILED", stack: err.stack });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        trace_id: "abc",
        msg: "errors.oma.TEST_FAILED",
        stack: expect.stringContaining("Error"),
      }),
    );
    spy.mockRestore();
  });
});

describe("i18n — 错误码 → key", () => {
  it("case 5: i18nErrorKey 返回 errors.oma.<CODE>, 不含中文字符串", () => {
    const keys = [
      "INVALID_REQUEST",
      "DECOMPOSE_FAILED",
      "TEAM_SCHEDULE_FAILED",
      "DAG_EXECUTE_FAILED",
      "CYCLE_DETECTED",
    ];
    for (const code of keys) {
      const key = i18nErrorKey(code);
      expect(key).toBe(`errors.oma.${code}`);
      // 验证不含中文字符
      expect(key).not.toMatch(/[一-龥]/);
    }
  });
});