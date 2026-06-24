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
 * baize-oma/src/dag/types.ts
 *
 * Phase 3: DAG 任务图核心类型.
 *
 * 兼容策略:
 * - OMANode 子集 (id/title/description/agentRole/dependsOn) + 4 个执行期字段
 *   (retries / timeoutMs / status / attempts) + 可选 (task / agent / result)
 * - DAG = nodes + edges; edges 由 nodes.dependsOn 派生, 也可显式传入 (用于可视化)
 * - DAGExecutionOptions / DAGExecutionResult 由 dagExecutor 消费 / 产出
 *
 * 涉及规范:
 * - plan/白泽baize-oma-DAG集成方案-20260623.md §3.2
 * - update plan-BAIZE-OMA-task-3.md §2.1
 */

import type { OMANode, OMAEdge } from "../decomposer/types.js";

/** DAG 节点状态机: pending → in_progress → completed / failed / skipped. */
export type DAGNodeStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

/** 执行器上下文: 节点的 LLM 调用入参 (input + 依赖节点的 output). */
export interface DAGNodeInput {
  /** 当前节点的 task 描述 (来自 OMA 拆解). */
  task: string;
  /** agent 角色, 用于路由. */
  agentRole: OMANode["agentRole"];
  /** 依赖节点 ID → 它们完成的 output 文本. */
  upstreamOutputs: Record<string, string>;
}

/** 执行器上下文: 节点的 LLM 调用出参. */
export interface DAGNodeOutput {
  output: string;
  tokens: { input: number; output: number };
  /** 节点级元数据, 例如 retry 次数 / 错误信息. */
  meta?: { attempts?: number; errorMessage?: string };
}

/** 节点执行回调: 执行器每跑一个节点前调用. 用于 /dag.execute 返回进度. */
export type DAGNodeExecutor = (input: DAGNodeInput) => Promise<DAGNodeOutput>;

/** DAG 节点 (执行器内部态). */
export interface DAGNode {
  id: string;
  task: string;
  agent?: string;
  agentRole: OMANode["agentRole"];
  dependsOn: string[];
  retries: number;
  timeoutMs: number;
  status: DAGNodeStatus;
  result?: string;
  attempts: number;
}

/** DAG 任务图. */
export interface DAG {
  nodes: DAGNode[];
  edges: OMAEdge[];
}

/** DAG 执行选项. */
export interface DAGExecutionOptions {
  maxConcurrency?: number;
  failFast?: boolean;
  defaultRetries?: number;
  defaultTimeoutMs?: number;
  /** 节点执行回调, 不传则走 OMA runAgent 默认行为. */
  executor?: DAGNodeExecutor;
}

/** 单节点执行结果. */
export interface DAGNodeResult {
  output: string;
  tokens: { input: number; output: number };
}

/** DAG 总体执行结果. */
export interface DAGExecutionResult {
  dag: DAG;
  status: "success" | "partial" | "failed";
  nodeResults: Record<string, DAGNodeResult>;
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
}

/** DAG 校验错误 (供 executor / route 抛错). */
export class DAGValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "DAGValidationError";
  }
}
