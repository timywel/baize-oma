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
 * baize-oma/src/__tests__/dag-routes.test.ts
 *
 * Phase 5 P5.3 路由层单测 (5 case). 覆盖 src/routes/dag-execute.ts.
 *
 * 不引入 supertest, 沿用 routes.test.ts 的 router.handle + mock req/res 模式.
 * Executor 走真实现, 传最小 DAG, 测路由层 (校验 / 错误码 / 响应结构).
 */

import { describe, it, expect } from "vitest";
import type { Request, Response, Router } from "express";
import dagExecuteRouter from "../routes/dag-execute.js";

/** 构造 mock req / res, 让 router.handle 调到我们提供的 handler. */
function makeReqRes(body: unknown) {
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
  return { req, res, getJson: () => jsonBody, getStatus: () => statusCode };
}

type LayerWithRoute = { route: { stack: Array<{ handle: (req: Request, res: Response, next: () => void) => unknown | Promise<unknown> }> } };

/** 把 router 当作单一 handler 调用. */
async function invokeRouter(router: Router, body: unknown) {
  const { req, res, getJson, getStatus } = makeReqRes(body);
  // dag-execute 路由有 2 个 POST (/dag.execute + /dag.visualize), 按调用顺序取
  const layer = (router as unknown as { stack: LayerWithRoute[] }).stack[0]!;
  const handler = layer.route.stack[0]!.handle;
  await handler(req, res, () => {});
  return { json: getJson(), status: getStatus() };
}

/** 调用 router 里第 N 个 POST handler (async). */
async function invokeRouterAt(router: Router, index: number, body: unknown) {
  const { req, res, getJson, getStatus } = makeReqRes(body);
  const layer = (router as unknown as { stack: LayerWithRoute[] }).stack[index]!;
  const handler = layer.route.stack[0]!.handle;
  await handler(req, res, () => {});
  return { json: getJson(), status: getStatus() };
}

/** 构造最小有效 DAG 节点. */
function makeDagNode(id: string, task: string, dependsOn: string[] = []) {
  return {
    id,
    task,
    agentRole: "generic",
    dependsOn,
    retries: 0,
    timeoutMs: 5000,
    status: "pending",
    attempts: 0,
  };
}

// =============================================================================
// POST /dag.execute
// =============================================================================

describe("DAG routes — POST /dag.execute", () => {
  it("case 1: 缺 input 和 dag → 400 INVALID_REQUEST", async () => {
    const { json, status } = await invokeRouterAt(dagExecuteRouter, 0, {});
    expect(status).toBe(400);
    expect(json).toMatchObject({ status: 400, error: { code: "INVALID_REQUEST" } });
  });

  it("case 2: 循环依赖 → 400 CYCLE_DETECTED", async () => {
    const dag = {
      nodes: [
        makeDagNode("a", "task A", ["b"]),
        makeDagNode("b", "task B", ["a"]),
      ],
      edges: [],
    };
    const { json, status } = await invokeRouterAt(dagExecuteRouter, 0, { dag });
    expect(status).toBe(400);
    expect(json).toMatchObject({ status: 400, error: { code: "CYCLE_DETECTED" } });
  });

  it("case 3: 缺失依赖 (dependsOn 引用不存在的节点) → 400 MISSING_DEPENDENCY", async () => {
    const dag = {
      nodes: [
        makeDagNode("a", "task A", ["nonexistent"]),
      ],
      edges: [],
    };
    const { json, status } = await invokeRouterAt(dagExecuteRouter, 0, { dag });
    expect(status).toBe(400);
    expect(json).toMatchObject({ status: 400, error: { code: "MISSING_DEPENDENCY" } });
  });

  it("case 4: 正常 DAG 执行 → 200 含 ascii + mermaid + result", async () => {
    const dag = {
      nodes: [
        makeDagNode("a", "task A"),
        makeDagNode("b", "task B", ["a"]),
      ],
      edges: [{ from: "a", to: "b" }],
    };
    const { json, status } = await invokeRouterAt(dagExecuteRouter, 0, { dag });
    expect(status).toBe(200);
    const body = (json as { body: { ascii: string; mermaid: string; result: { status: string } } }).body;
    expect(body.ascii).toBeDefined();
    expect(body.mermaid).toContain("flowchart");
    expect(["success", "partial", "failed"]).toContain(body.result.status);
  });
});

// =============================================================================
// POST /dag.visualize
// =============================================================================

describe("DAG routes — POST /dag.visualize", () => {
  it("case 5: 缺 dag → 400 INVALID_REQUEST", async () => {
    const { json, status } = await invokeRouterAt(dagExecuteRouter, 1, {});
    expect(status).toBe(400);
    expect(json).toMatchObject({ status: 400, error: { code: "INVALID_REQUEST" } });
  });

  it("case 6: 正常 DAG → 200 含 ascii + mermaid", async () => {
    const dag = {
      nodes: [
        makeDagNode("a", "task A"),
        makeDagNode("b", "task B", ["a"]),
      ],
      edges: [],
    };
    const { json, status } = await invokeRouterAt(dagExecuteRouter, 1, { dag });
    expect(status).toBe(200);
    const body = (json as { body: { ascii: string; mermaid: string } }).body;
    expect(body.ascii).toBeDefined();
    expect(body.mermaid).toContain("flowchart");
  });

  it("case 7: 循环依赖 → 400 CYCLE_DETECTED", async () => {
    const dag = {
      nodes: [
        makeDagNode("a", "task A", ["b"]),
        makeDagNode("b", "task B", ["a"]),
      ],
      edges: [],
    };
    const { json, status } = await invokeRouterAt(dagExecuteRouter, 1, { dag });
    expect(status).toBe(400);
    expect(json).toMatchObject({ status: 400, error: { code: "CYCLE_DETECTED" } });
  });
});
