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
 * baize-oma/src/__tests__/manifest-routes.test.ts
 *
 * Phase 5 P5.3 单测 (1 case). 覆盖 src/routes/manifest.ts.
 *
 * /manifest 返回 slot.json 内容 (id / version / type / capabilities).
 */

import { describe, it, expect } from "vitest";
import type { Request, Response } from "express";
import manifestRouter from "../routes/manifest.js";

type LayerWithRoute = { route: { stack: Array<{ handle: (req: Request, res: Response, next: () => void) => void }> } };

function invokeManifest() {
  const req = {} as Request;
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
  const layer = (manifestRouter as unknown as { stack: LayerWithRoute[] }).stack[0]!;
  const handler = layer.route.stack[0]!.handle;
  handler(req, res, () => {});
  return { json: jsonBody, status: statusCode };
}

describe("Manifest route — GET /manifest", () => {
  it("case 1: 200 含 slot.json 内容 (id=baize-oma, capabilities 数组)", () => {
    const { json, status } = invokeManifest();
    expect(status).toBe(200);
    const body = json as { id: string; version: string; type: string; capabilities: string[] };
    expect(body.id).toBe("baize-oma");
    expect(body.type).toBe("http");
    expect(Array.isArray(body.capabilities)).toBe(true);
    expect(body.capabilities).toContain("task.decompose");
    expect(body.capabilities).toContain("chat.agent.team.schedule");
    expect(body.capabilities).toContain("chat.loop.execute");
  });
});