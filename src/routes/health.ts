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
 * baize-oma/src/routes/health.ts
 *
 * GET /health — 健康检查路由 (Phase 4 落地: 拆出 inline handler).
 *
 * 协议:
 *   response (200): { status, last_check_at, latency_ms, oma_version }
 *     - status: 'healthy' (OMA 引擎就绪) | 'degraded' (未就绪但进程存活)
 */

import { Router, type Router as ExpressRouter } from "express";
import { isOmaReady } from "../oma-client.js";

const router: ExpressRouter = Router();

/** 保留旧 export 兼容 (供单元测试或外部直接调用). */
export const healthHandler = () => ({
  status: isOmaReady() ? "healthy" : "degraded",
  last_check_at: new Date().toISOString(),
  latency_ms: 0,
  oma_version: "1.8.0",
});

router.get("/health", (_req, res) => {
  res.json(healthHandler());
});

export default router;
