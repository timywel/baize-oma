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
 * baize-oma/src/routes/decompose.ts
 *
 * POST /oma.team.create — 任务拆解路由 (capability: task.decompose).
 * Phase 2 落地: 走真 Decomposer (已接通 vendor/open-multi-agent), 不再 mock.
 *
 * 协议:
 *   request:  { name, agents: AgentConfig[], input: string, options?: DecomposeOptions }
 *   response: { status, body: { taskDag, meta } }
 *   error:    { status, error: { code, message } }
 */

import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import { Decomposer } from "../decomposer/decomposer.js";
import type { AgentConfig } from "@open-multi-agent/core";
import type { DecomposeOptions } from "../decomposer/types.js";
import { logRequest, logResponse, logError } from "../logger/i18n-log.js";
import { globalInFlightTracker } from "../whitebox/inflight-tracker.js";
import { i18nErrorKey } from "../whitebox/i18n.js";

const router: ExpressRouter = Router();
const decomposer = new Decomposer();

/** 统一错误响应. */
function errorResp(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ status, error: { code, message } });
}

router.post("/oma.team.create", async (req: Request, res: Response) => {
  const start = Date.now();
  const body = (req.body ?? {}) as {
    name?: string;
    agents?: Array<{ name: string; model?: string; systemPrompt?: string }>;
    input?: string;
    options?: DecomposeOptions;
  };

  if (!body.input?.trim()) {
    return errorResp(res, 400, "INVALID_REQUEST", i18nErrorKey("INVALID_REQUEST"));
  }
  if (!body.agents?.length) {
    return errorResp(res, 400, "INVALID_REQUEST", i18nErrorKey("INVALID_REQUEST"));
  }
  for (const a of body.agents) {
    if (!a.name) {
      return errorResp(res, 400, "INVALID_REQUEST", i18nErrorKey("INVALID_REQUEST"));
    }
  }

  logRequest(req, { capability: "task.decompose", input_size: body.input.length });
  globalInFlightTracker.start("task.decompose", { name: body.name });

  // 路由层 → AgentConfig[] (用 defaultModel 兜底, 跟 oma-adapter 保持一致)
  const agents: AgentConfig[] = body.agents.map((a) => ({
    name: a.name,
    model: a.model ?? process.env.OMA_DEFAULT_MODEL ?? "claude-opus-4-6",
    systemPrompt: a.systemPrompt,
  }));

  try {
    const result = await decomposer.decompose(body.input, agents, body.options ?? {});
    const duration = Date.now() - start;
    logResponse(req, { capability: "task.decompose", status: 200, duration_ms: duration, extra: { node_count: result.taskDag.nodes.length } });
    globalInFlightTracker.end("task.decompose");
    res.json({ status: 200, body: { name: body.name, ...result } });
  } catch (err) {
    globalInFlightTracker.end("task.decompose");
    logError(req, err, { code: "DECOMPOSE_FAILED", capability: "task.decompose" });
    return errorResp(res, 500, "DECOMPOSE_FAILED", i18nErrorKey("DECOMPOSE_FAILED"));
  }
});

export default router;
