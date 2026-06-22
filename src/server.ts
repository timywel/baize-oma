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
 * baize-oma/src/server.ts
 *
 * HTTP server 入口 — baize-loop 主控通过 HttpSlotAdapter 调.
 * 默认端口 20060 (避开 dspy 20025 / oh-backend 20032 / dspy-slot 20040 / harness-slot 20050).
 *
 * 路由:
 *   GET  /health                  → 健康检查
 *   GET  /manifest                → slot.json 内容 (主控可拉取验证)
 *   POST /chat.agent.schedule     → 单 agent 调度
 *   POST /chat.agent.team         → 多 agent team 协作
 *   POST /chat.loop.execute       → 通用 loop 执行
 */

import express, { type Request, type Response, type NextFunction } from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initOmaEngine, isOmaReady } from "./oma-client.js";
import { handleSchedule, handleTeam, handleLoop } from "./oma-adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SLOT_JSON_PATH = join(__dirname, "..", "slot.json");
const PORT = Number(process.env.BAIZE_OMA_PORT ?? 20060);

function loadManifest() {
  try {
    return JSON.parse(readFileSync(SLOT_JSON_PATH, "utf-8"));
  } catch {
    return { id: "baize-oma", error: "manifest not loadable" };
  }
}

const app = express();
app.use(express.json({ limit: "4mb" }));

/** 健康检查 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: isOmaReady() ? "healthy" : "degraded",
    last_check_at: new Date().toISOString(),
    latency_ms: 0,
    oma_version: "1.8.0",
  });
});

/** slot.json 透出 */
app.get("/manifest", (_req: Request, res: Response) => {
  res.json(loadManifest());
});

/** 能力路由 */
app.post("/chat.agent.schedule", handleSchedule);
app.post("/chat.agent.team", handleTeam);
app.post("/chat.loop.execute", handleLoop);

/** 404 兜底 */
app.use((req: Request, res: Response) => {
  res.status(404).json({ status: 404, error: { code: "INVALID_REQUEST", message: `未知路由: ${req.path}` } });
});

/** 错误兜底 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ status: 500, error: { code: "UNKNOWN", message: err.message } });
});

/** 启动 */
initOmaEngine();
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[baize-oma] listening on http://127.0.0.1:${PORT} (capabilities: chat.agent.schedule / chat.agent.team / chat.loop.execute)`);
});
