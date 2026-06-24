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
 * baize-oma/src/__tests__/routes.test.ts
 *
 * Phase 2 路由单测 (5 routes × 3+ case). 走 mock OMA engine + LLM client,
 * 覆盖成功路径 / 400 校验失败 / 500 内部错误.
 *
 * 不引入 supertest, 改用 router.handle + mock req/res, 避免加 dep.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction, Router } from "express";
import decomposeRouter from "../routes/decompose.js";
import teamScheduleRouter from "../routes/team-schedule.js";
import loopExecuteRouter from "../routes/loop-execute.js";
import * as omaClient from "../oma-client.js";
import * as llmClient from "../llm/client.js";
import type { OpenMultiAgent, TeamRunResult, TaskExecutionRecord } from "@open-multi-agent/core";

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

/** 把 router 当作单一 handler 调用. router.stack[0].route.stack[0].handle. */
function invokeRouter(router: Router, body: unknown) {
  const { req, res, getJson, getStatus } = makeReqRes(body);
  // 取 router 里第一个 route 的第一个 handler
  const layer = router.stack[0];
  if (!layer || !layer.route) throw new Error("router 没有任何 route");
  const route = layer.route;
  const stack = route.stack;
  if (stack.length === 0) throw new Error("route 没有任何 handler");
  const handler = stack[0]?.handle;
  if (!handler) throw new Error("handler 不存在");
  const next = (() => undefined) as NextFunction;
  // handler 可能是 sync 或 async; 统一用 Promise.resolve 兜底
  const result = handler(req, res, next);
  return Promise.resolve(result).then(() => ({
    json: getJson(),
    status: getStatus(),
  }));
}

/** OMA mock helper. */
function mockOmaEngine(tasks: TaskExecutionRecord[]) {
  const result: TeamRunResult = {
    success: true,
    goal: "fake",
    tasks,
    agentResults: new Map([["coordinator", {
      success: true,
      output: "fake coordinator output",
      messages: [],
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
      toolCalls: [],
    }]]),
    totalTokenUsage: { input_tokens: 100, output_tokens: 50 },
  };
  const engine = {
    createTeam: vi.fn().mockReturnValue({ name: "team-fake" }),
    runTeam: vi.fn().mockResolvedValue(result),
  } as unknown as OpenMultiAgent;
  vi.spyOn(omaClient, "getOmaEngine").mockReturnValue(engine);
  vi.spyOn(omaClient, "isOmaReady").mockReturnValue(true);
  return engine;
}

function mockLlmReflect(done: boolean) {
  vi.spyOn(llmClient, "chatCompletionText").mockResolvedValue({
    text: JSON.stringify({ done, nextTask: done ? undefined : "继续" }),
    usage: { input_tokens: 10, output_tokens: 5 },
    model: "claude-opus-4-6",
  });
}

describe("routes/decompose (POST /oma.team.create)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("case 1: 缺 input 时返 400 + INVALID_REQUEST", async () => {
    const { status, json } = await invokeRouter(decomposeRouter, {
      name: "n",
      agents: [{ name: "a" }],
    });
    expect(status).toBe(400);
    expect((json as { error: { code: string } }).error.code).toBe("INVALID_REQUEST");
  });

  it("case 2: agents 为空数组时返 400", async () => {
    const { status, json } = await invokeRouter(decomposeRouter, {
      input: "x",
      agents: [],
    });
    expect(status).toBe(400);
    expect((json as { error: { code: string } }).error.code).toBe("INVALID_REQUEST");
  });

  it("case 3: agents 缺 name 时返 400", async () => {
    const { status, json } = await invokeRouter(decomposeRouter, {
      input: "x",
      agents: [{ model: "claude-opus-4-6" }],
    });
    expect(status).toBe(400);
    expect((json as { error: { code: string } }).error.code).toBe("INVALID_REQUEST");
  });

  it("case 4: 正常请求 → 200, 含 taskDag.nodes + meta", async () => {
    mockOmaEngine([{ id: "t1", title: "调研", description: "d", dependsOn: [], status: "pending" }]);
    const { status, json } = await invokeRouter(decomposeRouter, {
      name: "n",
      input: "x",
      agents: [{ name: "researcher" }],
    });
    expect(status).toBe(200);
    const body = (json as { body: { taskDag: { nodes: unknown[] }; meta: { teamId: string } } }).body;
    expect(body.taskDag.nodes.length).toBe(1);
    expect(body.meta.teamId).toMatch(/^decomposer-/);
  });

  it("case 5: OMA 抛错时返 500 + DECOMPOSE_FAILED", async () => {
    const engine = {
      createTeam: vi.fn().mockReturnValue({ name: "t" }),
      runTeam: vi.fn().mockRejectedValue(new Error("boom")),
    } as unknown as OpenMultiAgent;
    vi.spyOn(omaClient, "getOmaEngine").mockReturnValue(engine);
    const { status, json } = await invokeRouter(decomposeRouter, {
      input: "x",
      agents: [{ name: "a" }],
    });
    expect(status).toBe(500);
    expect((json as { error: { code: string } }).error.code).toBe("DECOMPOSE_FAILED");
  });
});

describe("routes/team-schedule (POST /chat.agent.team.schedule)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("case 1: 缺 team.name 返 400", async () => {
    const { status, json } = await invokeRouter(teamScheduleRouter, {
      team: { agents: [{ name: "a" }] },
      goal: "g",
    });
    expect(status).toBe(400);
    expect((json as { error: { code: string } }).error.code).toBe("INVALID_REQUEST");
  });

  it("case 2: 缺 goal 返 400", async () => {
    const { status, json } = await invokeRouter(teamScheduleRouter, {
      team: { name: "t", agents: [{ name: "a" }] },
    });
    expect(status).toBe(400);
  });

  it("case 3: team.agents 为空 返 400", async () => {
    const { status, json } = await invokeRouter(teamScheduleRouter, {
      team: { name: "t", agents: [] },
      goal: "g",
    });
    expect(status).toBe(400);
  });

  it("case 4: 正常请求 → 200, 含 success / output / tokens", async () => {
    const engine = mockOmaEngine([]);
    const { status, json } = await invokeRouter(teamScheduleRouter, {
      team: { name: "t1", agents: [{ name: "researcher" }] },
      goal: "调研",
    });
    expect(status).toBe(200);
    const body = (json as { body: { success: boolean; tokens: { input_tokens: number; output_tokens: number }; agentResults: Record<string, { output: string }> } }).body;
    expect(body.success).toBe(true);
    expect(body.tokens.input_tokens).toBe(100);
    expect(body.agentResults.coordinator?.output).toBe("fake coordinator output");
    expect(engine.createTeam).toHaveBeenCalledTimes(1);
  });

  it("case 5: OMA 未初始化 返 503 + ENGINE_NOT_READY", async () => {
    vi.spyOn(omaClient, "isOmaReady").mockReturnValue(false);
    const { status, json } = await invokeRouter(teamScheduleRouter, {
      team: { name: "t", agents: [{ name: "a" }] },
      goal: "g",
    });
    expect(status).toBe(503);
    expect((json as { error: { code: string } }).error.code).toBe("ENGINE_NOT_READY");
  });
});

describe("routes/loop-execute (POST /chat.loop.execute)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("case 1: 缺 agent.name 返 400", async () => {
    const { status, json } = await invokeRouter(loopExecuteRouter, {
      prompt: "x",
    });
    expect(status).toBe(400);
    expect((json as { error: { code: string } }).error.code).toBe("INVALID_REQUEST");
  });

  it("case 2: 缺 prompt 返 400", async () => {
    const { status, json } = await invokeRouter(loopExecuteRouter, {
      agent: { name: "a" },
    });
    expect(status).toBe(400);
  });

  it("case 3: OMA 未初始化 返 503", async () => {
    vi.spyOn(omaClient, "isOmaReady").mockReturnValue(false);
    const { status, json } = await invokeRouter(loopExecuteRouter, {
      agent: { name: "a" },
      prompt: "x",
    });
    expect(status).toBe(503);
  });

  it("case 4: 正常完成, 反思 done=true 时 1 次迭代即停", async () => {
    mockOmaEngine([{ id: "t1", title: "a", description: "d", dependsOn: [], status: "pending" }]);
    mockLlmReflect(true);
    const { status, json } = await invokeRouter(loopExecuteRouter, {
      agent: { name: "researcher" },
      prompt: "调研 X",
      loop: { maxIterations: 3 },
    });
    expect(status).toBe(200);
    const body = (json as { body: { iterations: unknown[]; finalOutput: string; totalTokens: { input: number; output: number } } }).body;
    expect(body.iterations.length).toBe(1);
    expect(body.finalOutput).toBe("fake coordinator output");
    expect(body.totalTokens.input).toBeGreaterThan(0);
  });

  it("case 5: 反思 done=false 跑满 maxIterations", async () => {
    mockOmaEngine([{ id: "t1", title: "a", description: "d", dependsOn: [], status: "pending" }]);
    mockLlmReflect(false);
    const { status, json } = await invokeRouter(loopExecuteRouter, {
      agent: { name: "researcher" },
      prompt: "p",
      loop: { maxIterations: 2, stopOnSuccess: false },
    });
    expect(status).toBe(200);
    const body = (json as { body: { iterations: unknown[] } }).body;
    expect(body.iterations.length).toBe(2);
  });
});
