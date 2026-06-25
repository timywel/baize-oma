// Copyright (c) 2026 Tim Ywel
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

/**
 * baize-oma/src/__tests__/health-routes.test.ts
 *
 * Phase 5 P5.3 单测 (1 case). 覆盖 src/routes/health.ts.
 *
 * 走真 OMA 引擎初始化 (initOmaEngine 是异步, 但测试场景下 OMA 内部 mock 即可),
 * 验证 /health 返回 200 + status 字段.
 */

import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import healthRouter from "../routes/health.js";

// mock oma-client, 让 isOmaReady() 返回 true (避免真实 OMA 引擎初始化)
vi.mock("../oma-client.js", () => ({
  isOmaReady: () => true,
}));

type LayerWithRoute = { route: { stack: Array<{ handle: (req: Request, res: Response, next: () => void) => void }> } };

function invokeHealth(body: unknown = {}) {
  const req = { body } as Request;
  let jsonBody: unknown = undefined;
  let statusCode = 200;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      jsonBody = payload;
      return this;
    },
  } as unknown as Response;
  // router.stack[0] 是 Route 层 (有 route.stack), 强转一下避开 noUncheckedIndexedAccess
  const layer = (healthRouter as unknown as { stack: LayerWithRoute[] }).stack[0]!;
  const handler = layer.route.stack[0]!.handle;
  handler(req, res, () => {});
  return { json: jsonBody, status: statusCode };
}

describe("Health route — GET /health", () => {
  it("case 1: 200 + status 字段 (healthy/degraded)", () => {
    const { json, status } = invokeHealth();
    expect(status).toBe(200);
    const body = json as { status: string; last_check_at: string; latency_ms: number; oma_version: string };
    expect(["healthy", "degraded"]).toContain(body.status);
    expect(body.last_check_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.oma_version).toBe("1.8.0");
  });
});