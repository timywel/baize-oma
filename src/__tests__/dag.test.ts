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
 * baize-oma/src/__tests__/dag.test.ts
 *
 * Phase 3: DAG 集成测试 (≥6 case).
 *
 * 用例覆盖:
 *  1. 简单 DAG (A → B) — 顺序执行, 输入校验, 状态机迁移
 *  2. 并行 DAG (A, B → C) — 验证 B 启动早于 C 完成 (时序)
 *  3. 失败重试 — executor 抛错, retries=2 后成功
 *  4. 循环依赖检测 — DAG 形态校验抛 CYCLE_DETECTED
 *  5. maxConcurrency 限流 — 5 个独立节点 + maxConcurrency=2, 不超过 2 并发
 *  6. failFast — 中间节点失败时下游节点标 skipped
 *  7. 可视化 — ASCII + Mermaid 输出
 *
 * 注入 DAGNodeExecutor (不走 OMA), 全部离线可跑.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeDag,
  validateDag,
  DAGValidationError,
} from "../dag/executor.js";
import { toAscii, toMermaid } from "../dag/visualizer.js";
import type { DAG, DAGNode, DAGNodeExecutor } from "../dag/types.js";

/** 构造简单 DAG 的 helper. */
function buildDag(
  nodes: Array<{
    id: string;
    task: string;
    dependsOn?: string[];
    role?: DAGNode["agentRole"];
  }>,
): DAG {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      task: n.task,
      agentRole: n.role ?? "generic",
      dependsOn: n.dependsOn ?? [],
      retries: 0,
      timeoutMs: 5_000,
      status: "pending",
      attempts: 0,
    })),
    edges: nodes.flatMap((n) => (n.dependsOn ?? []).map((d) => ({ from: d, to: n.id }))),
  };
}

/** 简单 executor: 返回 task 文本, 记录调用顺序. */
function makeEchoExecutor(
  onCall?: (id: string) => void,
  sleepMs = 0,
): DAGNodeExecutor {
  return async (input) => {
    onCall?.(input.task);
    if (sleepMs > 0) {
      await new Promise((r) => setTimeout(r, sleepMs));
    }
    return {
      output: `done:${input.task}`,
      tokens: { input: 10, output: 5 },
    };
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("DAG executor — 基础 / 状态机", () => {
  it("case 1: 简单 DAG A → B, 顺序执行, 输出含 A 和 B 结果", async () => {
    const dag = buildDag([
      { id: "a", task: "task-A" },
      { id: "b", task: "task-B", dependsOn: ["a"] },
    ]);
    const order: string[] = [];
    const result = await executeDag(dag, {
      executor: makeEchoExecutor((t) => order.push(t)),
    });
    expect(result.status).toBe("success");
    expect(order).toEqual(["task-A", "task-B"]);
    expect(result.nodeResults["a"]?.output).toBe("done:task-A");
    expect(result.nodeResults["b"]?.output).toBe("done:task-B");
    // 状态机
    expect(result.dag.nodes.find((n) => n.id === "a")?.status).toBe("completed");
    expect(result.dag.nodes.find((n) => n.id === "b")?.status).toBe("completed");
  });

  it("case 2: 并行 DAG (A, B → C), 验证 B 启动早于 C 完成 (A/B 同层并行)", async () => {
    const dag = buildDag([
      { id: "a", task: "A" },
      { id: "b", task: "B" },
      { id: "c", task: "C", dependsOn: ["a", "b"] },
    ]);
    const timeline: Array<{ event: string; t: number }> = [];
    const t0 = Date.now();
    const executor: DAGNodeExecutor = async (input) => {
      timeline.push({ event: `start:${input.task}`, t: Date.now() - t0 });
      // 模拟 LLM 耗时
      await new Promise((r) => setTimeout(r, 50));
      timeline.push({ event: `end:${input.task}`, t: Date.now() - t0 });
      return { output: input.task, tokens: { input: 1, output: 1 } };
    };
    const result = await executeDag(dag, { executor });
    expect(result.status).toBe("success");
    // A/B 都 start, 都 end, 然后 C start, 然后 C end
    const cStart = timeline.find((e) => e.event === "start:C")!;
    const aEnd = timeline.find((e) => e.event === "end:A")!;
    const bEnd = timeline.find((e) => e.event === "end:B")!;
    expect(cStart.t).toBeGreaterThanOrEqual(aEnd.t);
    expect(cStart.t).toBeGreaterThanOrEqual(bEnd.t);
  });
});

describe("DAG executor — 错误处理", () => {
  it("case 3: 节点失败 + retries=2, 第 2 次成功 (attempts 累计)", async () => {
    const dag = buildDag([{ id: "a", task: "flaky" }]);
    // 把 retries 改成 2 (buildDag 默认 0)
    dag.nodes[0]!.retries = 2;
    let calls = 0;
    const executor: DAGNodeExecutor = async (input) => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return { output: `ok-${input.task}`, tokens: { input: 1, output: 1 } };
    };
    const result = await executeDag(dag, { executor });
    expect(calls).toBe(3);
    expect(result.status).toBe("success");
    expect(result.dag.nodes[0]?.attempts).toBe(3);
    expect(result.dag.nodes[0]?.status).toBe("completed");
  });

  it("case 4: 循环依赖 (A → B → A) 抛 CYCLE_DETECTED", () => {
    const dag = buildDag([
      { id: "a", task: "A", dependsOn: ["b"] },
      { id: "b", task: "B", dependsOn: ["a"] },
    ]);
    expect(() => validateDag(dag)).toThrow(DAGValidationError);
    try {
      validateDag(dag);
    } catch (err) {
      expect((err as DAGValidationError).code).toBe("CYCLE_DETECTED");
      expect((err as DAGValidationError).message).toMatch(/循环依赖/);
    }
  });

  it("case 5: 缺失依赖校验 (D 引用不存在的 C) 抛 MISSING_DEPENDENCY", () => {
    const dag = buildDag([
      { id: "a", task: "A" },
      { id: "b", task: "B", dependsOn: ["a", "c"] }, // c 不存在
    ]);
    expect(() => validateDag(dag)).toThrow(/c/);
  });
});

describe("DAG executor — 并发 / failFast", () => {
  it("case 6: maxConcurrency=2, 5 个独立节点的并发峰值 ≤ 2", async () => {
    const dag = buildDag(
      Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, task: `task-${i}` })),
    );
    let active = 0;
    let peak = 0;
    const executor: DAGNodeExecutor = async (input) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 30));
      active--;
      return { output: input.task, tokens: { input: 1, output: 1 } };
    };
    const result = await executeDag(dag, { executor, maxConcurrency: 2 });
    expect(result.status).toBe("success");
    expect(peak).toBeLessThanOrEqual(2);
    expect(Object.keys(result.nodeResults).length).toBe(5);
  });

  it("case 7: failFast=true, 中间节点失败, 下游节点标 skipped", async () => {
    const dag = buildDag([
      { id: "a", task: "A" },
      { id: "b", task: "B", dependsOn: ["a"] },
      { id: "c", task: "C", dependsOn: ["a"] },
      { id: "d", task: "D", dependsOn: ["b", "c"] },
    ]);
    const executor: DAGNodeExecutor = async (input) => {
      if (input.task === "A") throw new Error("A always fails");
      return { output: input.task, tokens: { input: 1, output: 1 } };
    };
    const result = await executeDag(dag, { executor, failFast: true });
    expect(result.status).toBe("failed");
    expect(result.dag.nodes.find((n) => n.id === "a")?.status).toBe("failed");
    // B/C/D 应被 skipped (依赖 A 失败)
    expect(result.dag.nodes.find((n) => n.id === "b")?.status).toBe("skipped");
    expect(result.dag.nodes.find((n) => n.id === "c")?.status).toBe("skipped");
    expect(result.dag.nodes.find((n) => n.id === "d")?.status).toBe("skipped");
    // nodeResults 只有 A 失败时为空对象
    expect(Object.keys(result.nodeResults).length).toBe(0);
  });

  it("case 8: failFast=false, 中间节点失败时, 不依赖它的旁支仍可完成 (status=partial)", async () => {
    const dag = buildDag([
      { id: "a", task: "A" },
      { id: "b", task: "B" }, // 不依赖 A
      { id: "c", task: "C", dependsOn: ["a"] }, // 依赖 A, 失败会跳过
    ]);
    const executor: DAGNodeExecutor = async (input) => {
      if (input.task === "A") throw new Error("A fails");
      return { output: input.task, tokens: { input: 1, output: 1 } };
    };
    const result = await executeDag(dag, { executor, failFast: false });
    expect(result.status).toBe("partial");
    expect(result.dag.nodes.find((n) => n.id === "a")?.status).toBe("failed");
    expect(result.dag.nodes.find((n) => n.id === "b")?.status).toBe("completed");
    expect(result.dag.nodes.find((n) => n.id === "c")?.status).toBe("skipped");
  });
});

describe("DAG visualizer", () => {
  it("case 9: ASCII 输出按拓扑层分行, [A, B] → [C]", () => {
    const dag = buildDag([
      { id: "a", task: "A" },
      { id: "b", task: "B" },
      { id: "c", task: "C", dependsOn: ["a", "b"] },
    ]);
    const ascii = toAscii(dag);
    expect(ascii).toMatch(/\[a, b\]/);
    expect(ascii).toMatch(/\[c\]/);
    expect(ascii).toContain("→");
  });

  it("case 10: Mermaid 输出含 flowchart LR + 边", () => {
    const dag = buildDag([
      { id: "a", task: "alpha" },
      { id: "b", task: "beta", dependsOn: ["a"] },
    ]);
    const mermaid = toMermaid(dag);
    expect(mermaid).toContain("flowchart LR");
    expect(mermaid).toMatch(/a --> b/);
    expect(mermaid).toContain("alpha");
    expect(mermaid).toContain("beta");
  });

  it("case 11: 空 DAG 的 ASCII 返回 <empty DAG>", () => {
    const empty: DAG = { nodes: [], edges: [] };
    expect(toAscii(empty)).toBe("<empty DAG>");
  });
});
