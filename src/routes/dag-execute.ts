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
 * baize-oma/src/routes/dag-execute.ts
 *
 * Phase 3: DAG 执行路由.
 *
 * 端点:
 *   POST /dag.execute
 *     body:
 *       input?:     string                (高层目标; 与 dag 二选一)
 *       agents?:    AgentConfig[]        (decompose 用)
 *       options?:   DecomposeOptions     (depth / maxNodes 等)
 *       dag?:       DAG                  (直接传入执行, 跳过拆解)
 *       defaults?:  { retries?, timeoutMs?, maxConcurrency?, failFast? }
 *
 *     response (200):
 *       { status, body: { taskDag, result: DAGExecutionResult, ascii, mermaid? } }
 *
 * 错误码:
 *   400 INVALID_REQUEST — 缺 input/dag, 或 dag 缺节点
 *   400 CYCLE_DETECTED  — 循环依赖
 *   503 ENGINE_NOT_READY — OMA 未初始化 (走 OMA executor)
 *   500 DAG_EXECUTE_FAILED — 内部执行失败
 */

import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import { Decomposer } from "../decomposer/decomposer.js";
import { executeDag, DAGValidationError, validateDag } from "../dag/executor.js";
import { toAscii, toMermaid } from "../dag/visualizer.js";
import type { AgentConfig } from "@open-multi-agent/core";
import type { DecomposeOptions } from "../decomposer/types.js";
import type { DAG, DAGExecutionOptions, DAGNode } from "../dag/types.js";
import { logRequest, logResponse, logError } from "../logger/i18n-log.js";
import { globalInFlightTracker } from "../whitebox/inflight-tracker.js";
import { i18nErrorKey } from "../whitebox/i18n.js";

const router: ExpressRouter = Router();
const decomposer = new Decomposer();

/** 统一错误响应. */
function errorResp(
  res: Response,
  status: number,
  code: string,
  message: string,
  detail?: unknown,
): void {
  res.status(status).json({ status, error: { code, message, ...(detail ? { detail } : {}) } });
}

/** 把外部传入的 dag 节点格式 (可能只含 OMADag 字段) 补齐为完整 DAGNode. */
function normalizeDag(dag: { nodes: Array<Record<string, unknown>>; edges?: Array<{ from: string; to: string }> }): DAG {
  const nodes: DAGNode[] = dag.nodes.map((raw) => {
    const id = String(raw["id"] ?? "");
    const title = String(raw["title"] ?? "");
    const description = String(raw["description"] ?? "");
    const task = String(raw["task"] ?? description ?? title ?? "");
    const agentRole = String(raw["agentRole"] ?? "generic") as DAGNode["agentRole"];
    const dependsOn = Array.isArray(raw["dependsOn"]) ? (raw["dependsOn"] as string[]).map(String) : [];
    return {
      id,
      task,
      agent: typeof raw["agent"] === "string" ? (raw["agent"] as string) : undefined,
      agentRole,
      dependsOn,
      retries: typeof raw["retries"] === "number" ? (raw["retries"] as number) : 1,
      timeoutMs: typeof raw["timeoutMs"] === "number" ? (raw["timeoutMs"] as number) : 30_000,
      status: (raw["status"] as DAGNode["status"]) ?? "pending",
      result: typeof raw["result"] === "string" ? (raw["result"] as string) : undefined,
      attempts: typeof raw["attempts"] === "number" ? (raw["attempts"] as number) : 0,
    };
  });
  return { nodes, edges: dag.edges ?? [] };
}

router.post("/dag.execute", async (req: Request, res: Response) => {
  const start = Date.now();
  const body = (req.body ?? {}) as {
    input?: string;
    agents?: Array<{ name: string; model?: string; systemPrompt?: string }>;
    options?: DecomposeOptions;
    dag?: { nodes: Array<Record<string, unknown>>; edges?: Array<{ from: string; to: string }> };
    defaults?: { retries?: number; timeoutMs?: number; maxConcurrency?: number; failFast?: boolean };
  };

  // 入参校验: input 或 dag 二选一
  if (!body.input?.trim() && !body.dag) {
    return errorResp(res, 400, "INVALID_REQUEST", i18nErrorKey("INVALID_REQUEST"));
  }

  logRequest(req, { capability: "task.dag.execute", input_size: body.input?.length });
  globalInFlightTracker.start("task.dag.execute", { has_dag: !!body.dag });

  // 1) 拿到 DAG
  let dag: DAG;
  let taskDagSummary: unknown = undefined;
  try {
    if (body.dag) {
      dag = normalizeDag(body.dag);
    } else {
      // 走 decomposer 真拆
      const defaultModel = process.env.OMA_DEFAULT_MODEL ?? "claude-opus-4-6";
      const agents: AgentConfig[] = (body.agents ?? [{ name: "generic-worker", model: defaultModel }]).map(
        (a) => ({
          name: a.name,
          model: a.model ?? defaultModel,
          systemPrompt: a.systemPrompt,
        }),
      );
      const { dag: built } = await decomposer.decomposeIntoDag(
        body.input!,
        agents,
        body.options ?? {},
        { retries: body.defaults?.retries, timeoutMs: body.defaults?.timeoutMs },
      );
      dag = built;
      taskDagSummary = {
        nodes: built.nodes.map((n) => ({ id: n.id, task: n.task, agentRole: n.agentRole, dependsOn: n.dependsOn })),
        edges: built.edges,
      };
    }

    // 提前校验: 循环依赖 / 缺节点
    try {
      validateDag(dag);
    } catch (err) {
      if (err instanceof DAGValidationError) {
        globalInFlightTracker.end("task.dag.execute");
        logError(req, err, { code: err.code, capability: "task.dag.execute" });
        return errorResp(res, 400, err.code, i18nErrorKey(err.code));
      }
      throw err;
    }
  } catch (err) {
    globalInFlightTracker.end("task.dag.execute");
    logError(req, err, { code: "DAG_INVALID", capability: "task.dag.execute" });
    const msg = err instanceof Error ? err.message : String(err);
    return errorResp(res, 400, "DAG_INVALID", i18nErrorKey("DAG_INVALID"));
  }

  // 2) 走 executor
  const execOptions: DAGExecutionOptions = {
    maxConcurrency: body.defaults?.maxConcurrency,
    failFast: body.defaults?.failFast,
    defaultRetries: body.defaults?.retries,
    defaultTimeoutMs: body.defaults?.timeoutMs,
  };

  try {
    const result = await executeDag(dag, execOptions);
    const duration = Date.now() - start;
    logResponse(req, {
      capability: "task.dag.execute",
      status: 200,
      duration_ms: duration,
      extra: { dag_status: result.status, node_count: dag.nodes.length },
    });
    globalInFlightTracker.end("task.dag.execute");
    res.json({
      status: 200,
      body: {
        taskDag: taskDagSummary ?? {
          nodes: result.dag.nodes.map((n) => ({
            id: n.id,
            task: n.task,
            agentRole: n.agentRole,
            dependsOn: n.dependsOn,
            status: n.status,
            attempts: n.attempts,
          })),
          edges: result.dag.edges,
        },
        result,
        ascii: toAscii(result.dag),
        mermaid: toMermaid(result.dag, { title: "DAG execution result" }),
      },
    });
  } catch (err) {
    globalInFlightTracker.end("task.dag.execute");
    if (err instanceof DAGValidationError) {
      logError(req, err, { code: err.code, capability: "task.dag.execute" });
      return errorResp(res, 400, err.code, i18nErrorKey(err.code));
    }
    logError(req, err, { code: "DAG_EXECUTE_FAILED", capability: "task.dag.execute" });
    return errorResp(res, 500, "DAG_EXECUTE_FAILED", i18nErrorKey("DAG_EXECUTE_FAILED"));
  }
});

/** POST /dag.visualize — 纯可视化 (debug 用). */
router.post("/dag.visualize", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    dag?: { nodes: Array<Record<string, unknown>>; edges?: Array<{ from: string; to: string }> };
  };
  if (!body.dag) {
    return errorResp(res, 400, "INVALID_REQUEST", i18nErrorKey("INVALID_REQUEST"));
  }
  try {
    const dag = normalizeDag(body.dag);
    validateDag(dag);
    res.json({
      status: 200,
      body: {
        ascii: toAscii(dag),
        mermaid: toMermaid(dag, { title: "DAG structure" }),
      },
    });
  } catch (err) {
    if (err instanceof DAGValidationError) {
      return errorResp(res, 400, err.code, i18nErrorKey(err.code));
    }
    return errorResp(res, 500, "VISUALIZE_FAILED", i18nErrorKey("VISUALIZE_FAILED"));
  }
});

export default router;
