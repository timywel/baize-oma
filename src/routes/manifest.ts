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
 * baize-oma/src/routes/manifest.ts
 *
 * GET /manifest — slot.json 内容路由 (Phase 4 落地: 之前声明但未注册).
 *
 * baize-loop 主控 HttpSlotAdapter 拉 /manifest 验证 slot 能力清单.
 *
 * 协议:
 *   response (200): slot.json 内容 (id / version / type / capabilities / ...)
 */

import { Router, type Router as ExpressRouter } from "express";
import slotJson from "../../slot.json" with { type: "json" };

const router: ExpressRouter = Router();

/** 保留旧 export 兼容. */
export const manifestHandler = () => slotJson;

router.get("/manifest", (_req, res) => {
  res.json(manifestHandler());
});

export default router;
