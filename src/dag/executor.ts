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
 * baize-oma/src/dag/executor.ts
 *
 * Phase 3: DAG 执行器 — 拓扑排序 + 按层并行 + 节点失败重试 + failFast.
 *
 * 核心算法:
 *  1. validate: 用 Kahn's algorithm 检测循环依赖 (出度 0 节点入栈),
 *     若排序后剩余节点 > 0 → 抛 CYCLE_DETECTED.
 *  2. execute: 按拓扑层 (Kahn's algorithm 的入度剥离顺序), 每层内
 *     用 Promise.all 并行执行; 用 Semaphore 限流 maxConcurrency.
 *  3. retry: 单节点失败按 `retries` 字段重试, 指数退避 (200ms * 2^n).
 *  4. failFast: 任一节点 failed 且 failFast=true 时, 其所有未执行下游
 *     节点标 skipped, 提前 break.
 *
 * 节点执行回调默认走 OMA runAgent (经 scheduleAgent 包装),
 * 可由 options.executor 注入测试桩.
 */

import { getOmaEngine, isOmaReady } from "../oma-client.js";
import type { AgentConfig } from "@open-multi-agent/core";
import {
  DAGValidationError,
  type DAG,
  type DAGExecutionOptions,
  type DAGExecutionResult,
  type DAGNode,
  type DAGNodeExecutor,
  type DAGNodeInput,
  type DAGNodeResult,
} from "./types.js";

const DEFAULT_MAX_CONCURRENCY = 5;
const DEFAULT_RETRIES = 1;
const DEFAULT_TIMEOUT_MS = 30_000;
const RETRY_BASE_DELAY_MS = 200;

/** 简易 semaphore: 限制 Promise.all 的并发度. */
class Semaphore {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly permits: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.permits) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

/** sleep helper. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 把 DAG 按 Kahn's algorithm 切成"拓扑层".
 * 同一层内的节点互相独立 (无依赖), 可并行执行.
 * 若排序后仍有节点未处理 → 有环 → 抛 CYCLE_DETECTED.
 */
function topologicalLayers(dag: DAG): DAGNode[][] {
  const byId = new Map(dag.nodes.map((n) => [n.id, n] as const));
  // 入度统计 (只计 in-dag 内的依赖)
  const indeg = new Map<string, number>();
  const reverseAdj = new Map<string, string[]>(); // node.id → [downstream ids]
  for (const node of dag.nodes) {
    indeg.set(node.id, 0);
    reverseAdj.set(node.id, []);
  }
  for (const node of dag.nodes) {
    for (const dep of node.dependsOn) {
      if (!byId.has(dep)) continue; // 忽略悬挂依赖 (toOMADag 已过滤)
      indeg.set(node.id, (indeg.get(node.id) ?? 0) + 1);
      reverseAdj.get(dep)?.push(node.id);
    }
  }

  const layers: DAGNode[][] = [];
  let frontier = dag.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0);
  const visited = new Set<string>();

  while (frontier.length > 0) {
    layers.push(frontier);
    for (const n of frontier) visited.add(n.id);
    const next: DAGNode[] = [];
    for (const n of frontier) {
      for (const down of reverseAdj.get(n.id) ?? []) {
        const newDeg = (indeg.get(down) ?? 0) - 1;
        indeg.set(down, newDeg);
        if (newDeg === 0) {
          const dn = byId.get(down);
          if (dn) next.push(dn);
        }
      }
    }
    frontier = next;
  }

  if (visited.size !== dag.nodes.length) {
    const remaining = dag.nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
    throw new DAGValidationError(
      `DAG 存在循环依赖, 无法拓扑排序: ${remaining.join(", ")}`,
      "CYCLE_DETECTED",
    );
  }
  return layers;
}

/** 校验 DAG 形态: 至少 1 节点 + 所有依赖在 nodes 中. */
export function validateDag(dag: DAG): void {
  if (!dag.nodes || dag.nodes.length === 0) {
    throw new DAGValidationError("DAG 节点数必须 >= 1", "EMPTY_DAG");
  }
  const ids = new Set(dag.nodes.map((n) => n.id));
  for (const node of dag.nodes) {
    if (!node.id) throw new DAGValidationError("节点缺 id", "INVALID_NODE");
    for (const dep of node.dependsOn) {
      if (!ids.has(dep)) {
        throw new DAGValidationError(
          `节点 ${node.id} 依赖不存在的节点 ${dep}`,
          "MISSING_DEPENDENCY",
        );
      }
    }
    if (!node.task) {
      throw new DAGValidationError(`节点 ${node.id} 缺 task`, "INVALID_NODE");
    }
  }
}

/** 默认节点执行器: 走 OMA runAgent (单 agent). */
function makeOmaExecutor(): DAGNodeExecutor {
  return async (input: DAGNodeInput) => {
    if (!isOmaReady()) {
      throw new Error("OMA engine not initialized");
    }
    const engine = getOmaEngine();
    const upstreamText = Object.entries(input.upstreamOutputs)
      .map(([id, out]) => `[${id}]\n${out}`)
      .join("\n\n");
    const prompt = upstreamText
      ? `${input.task}\n\n依赖节点的输出:\n${upstreamText}`
      : input.task;
    const agentConfig: AgentConfig = {
      name: `${input.agentRole}-${Math.random().toString(36).slice(2, 8)}`,
      model: process.env.OMA_DEFAULT_MODEL ?? "claude-opus-4-6",
      systemPrompt: `你是一个 ${input.agentRole} agent, 完成被分配的子任务.`,
    };
    const result = await engine.runAgent(agentConfig, prompt);
    return {
      output: result.output,
      tokens: {
        input: result.tokenUsage.input_tokens,
        output: result.tokenUsage.output_tokens,
      },
    };
  };
}

/** 单节点执行 + 重试 (指数退避). 返回最终结果或抛错. */
async function runNodeWithRetry(
  node: DAGNode,
  executor: DAGNodeExecutor,
  maxRetries: number,
  timeoutMs: number,
  upstreamOutputs: Record<string, string>,
): Promise<DAGNodeResult> {
  let lastErr: unknown = undefined;
  const totalAttempts = Math.max(1, maxRetries + 1);
  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    node.attempts = attempt;
    node.status = "in_progress";
    try {
      const input: DAGNodeInput = {
        task: node.task,
        agentRole: node.agentRole,
        upstreamOutputs,
      };
      // 超时保护
      const output = await Promise.race([
        executor(input),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`节点 ${node.id} 执行超时 (${timeoutMs}ms)`)), timeoutMs),
        ),
      ]);
      node.status = "completed";
      node.result = output.output;
      return { output: output.output, tokens: output.tokens };
    } catch (err) {
      lastErr = err;
      if (attempt >= totalAttempts) {
        node.status = "failed";
        break;
      }
      // 指数退避
      await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
  // 重试耗尽
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`节点 ${node.id} 在 ${totalAttempts} 次尝试后仍失败: ${msg}`);
}

/** 主入口: 同步执行 DAG, 返回最终结果. */
export async function executeDag(
  inputDag: DAG,
  options: DAGExecutionOptions = {},
): Promise<DAGExecutionResult> {
  validateDag(inputDag);

  const maxConcurrency = options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
  const failFast = options.failFast ?? true;
  const defaultRetries = options.defaultRetries ?? DEFAULT_RETRIES;
  const defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const executor: DAGNodeExecutor = options.executor ?? makeOmaExecutor();

  // 拷贝节点避免外部修改
  const dag: DAG = {
    nodes: inputDag.nodes.map((n) => ({
      ...n,
      retries: n.retries ?? defaultRetries,
      timeoutMs: n.timeoutMs ?? defaultTimeoutMs,
      status: n.status ?? "pending",
      attempts: n.attempts ?? 0,
      dependsOn: [...(n.dependsOn ?? [])],
    })),
    edges: inputDag.edges ? [...inputDag.edges] : [],
  };

  // 给每个节点补默认 retries / timeoutMs / status
  for (const n of dag.nodes) {
    n.retries = n.retries ?? defaultRetries;
    n.timeoutMs = n.timeoutMs ?? defaultTimeoutMs;
    n.status = n.status ?? "pending";
    n.attempts = n.attempts ?? 0;
  }

  const layers = topologicalLayers(dag);
  const nodeResults: Record<string, DAGNodeResult> = {};
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  let anyFailed = false;
  let anyCompleted = false;

  // 收集已失败节点, 后续下游标 skipped
  const failedAncestors = new Set<string>();

  const sem = new Semaphore(maxConcurrency);

  for (const layer of layers) {
    // 决定本层要执行的节点 (上游有失败且 failFast=true → 跳过)
    const toRun = layer.filter((n) => {
      if (!failFast || failedAncestors.size === 0) return true;
      // 任何依赖项在 failedAncestors → 跳过
      return !n.dependsOn.some((d) => failedAncestors.has(d));
    });

    // 本层被跳过的节点
    for (const n of layer) {
      if (!toRun.includes(n)) {
        n.status = "skipped";
        failedAncestors.add(n.id);
      }
    }

    if (toRun.length === 0) continue;

    // 并行执行 (semaphore 限流)
    const settled = await Promise.allSettled(
      toRun.map((n) =>
        sem.run(async () => {
          const upstream: Record<string, string> = {};
          for (const dep of n.dependsOn) {
            const depResult = nodeResults[dep];
            if (depResult) upstream[dep] = depResult.output;
          }
          return runNodeWithRetry(n, executor, n.retries ?? defaultRetries, n.timeoutMs ?? defaultTimeoutMs, upstream);
        }),
      ),
    );

    for (let i = 0; i < toRun.length; i++) {
      const node = toRun[i]!;
      const result = settled[i];
      if (!result) continue;
      if (result.status === "fulfilled") {
        nodeResults[node.id] = result.value;
        anyCompleted = true;
      } else {
        node.status = "failed";
        failedAncestors.add(node.id);
        anyFailed = true;
      }
    }

    // failFast 提前退出
    if (failFast && anyFailed) break;
  }

  // 推进整图 status: 已被 topologicalLayers 漏掉的 (有环) 不会被走到
  // 兜底: 把仍是 pending 的标 skipped (例如上游失败的旁支)
  for (const n of dag.nodes) {
    if (n.status === "pending") n.status = "skipped";
  }

  const finishedAt = new Date().toISOString();
  const totalDurationMs = Date.now() - startTime;

  let status: DAGExecutionResult["status"];
  if (!anyFailed && anyCompleted) status = "success";
  else if (anyCompleted && anyFailed) status = "partial";
  else status = "failed";

  return {
    dag,
    status,
    nodeResults,
    startedAt,
    finishedAt,
    totalDurationMs,
  };
}
