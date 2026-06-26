// baize-oma/src/routes/whitebox.ts
//
// Phase 11 白盒路由. 3 端点:
// - GET /whitebox         → 完整 WhiteboxSnapshot
// - GET /whitebox/upstream → 仅 upstream 字段
// - GET /whitebox/trace   → 仅 trace ring buffer
//
// 按白盒 spec A7: 仅 localhost 访问, 不暴露给浏览器.
// 按白盒 spec A9: GET /whitebox < 100ms P95.

import { Router, type Router as ExpressRouter } from "express";
import { buildSnapshot } from "../whitebox/snapshot.js";
import { globalTraceBuffer } from "../whitebox/trace-buffer.js";
import { detectUpstream } from "../whitebox/upstream.js";

const router: ExpressRouter = Router();

/** GET /whitebox — 完整白盒快照. */
router.get("/whitebox", (_req, res) => {
  res.json(buildSnapshot());
});

/** GET /whitebox/upstream — 仅上游 vendor 状态. */
router.get("/whitebox/upstream", (_req, res) => {
  res.json(detectUpstream());
});

/** GET /whitebox/trace — 仅 trace ring buffer (N=20). */
router.get("/whitebox/trace", (_req, res) => {
  res.json({ trace: globalTraceBuffer.snapshot() });
});

export default router;
