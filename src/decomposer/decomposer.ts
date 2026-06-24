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
 * baize-oma/src/decomposer/decomposer.ts
 *
 * 真接 OMA 引擎 (`vendor/open-multi-agent/`) 的任务拆解器.
 * Phase 2 落地: 去掉 mock, 通过 `OpenMultiAgent.runTeam({ planOnly: true })`
 * 走 coordinator LLM 拆解, 拿到 Task[] 后转成本仓 OMADag.
 *
 * 数据流:
 *   input string + agents[] + options
 *     → OpenMultiAgent.runTeam(team, input, { planOnly: true })
 *       → coordinator LLM 调 baize-switch 拆解
 *     → TeamRunResult.tasks: TaskExecutionRecord[]
 *       → 映射成 OMADag { nodes, edges }
 *
 * 注: 不直接动 vendor 内部, 走 patch-package 流程 (CLAUDE.md §Never).
 */

import { randomUUID } from "node:crypto";
import { getOmaEngine } from "../oma-client.js";
import type { AgentConfig, TaskExecutionRecord, TeamConfig } from "@open-multi-agent/core";
import type { OMADag, OMANode, OMAEdge, DecomposeMeta, DecomposeOptions } from "./types.js";

/** agent.role → OMANode.agentRole 的合法映射. */
const ROLE_MAP: Record<string, OMANode["agentRole"]> = {
  researcher: "researcher",
  architect: "architect",
  coder: "coder",
  reviewer: "reviewer",
  coordinator: "architect",
  writer: "generic",
  generic: "generic",
};

/** 从 OMA 的 agentConfig 里抽取 role, 找不到就降级 generic. */
function resolveAgentRole(agent: AgentConfig | undefined, index: number): OMANode["agentRole"] {
  const name = (agent?.name ?? "").toLowerCase();
  for (const key of Object.keys(ROLE_MAP)) {
    if (name.includes(key)) return ROLE_MAP[key] ?? "generic";
  }
  // 兜底: 顺序轮转 5 种 role, 避免全部扎堆 generic
  const fallback: OMANode["agentRole"][] = ["researcher", "architect", "coder", "reviewer", "generic"];
  return fallback[index % fallback.length] ?? "generic";
}

/** 单条 OMA TaskExecutionRecord → OMANode. */
function toOMANode(record: TaskExecutionRecord, agents: AgentConfig[], nodeIndex: number): OMANode {
  // assignee 命中 agents[] 时用真实 name, 否则回退到 agentConfig
  const assignee = record.assignee
    ? agents.find((a) => a.name === record.assignee) ?? agents[0]
    : agents[nodeIndex % agents.length];
  return {
    id: record.id,
    title: record.title,
    description: record.description ?? "",
    agentRole: resolveAgentRole(assignee, nodeIndex),
    dependsOn: [...(record.dependsOn ?? [])],
  };
}

/** OMA Task[] → OMADag (含 nodes + edges). */
function toOMADag(tasks: readonly TaskExecutionRecord[], agents: AgentConfig[]): OMADag {
  const nodes: OMANode[] = tasks.map((t, i) => toOMANode(t, agents, i));
  const edges: OMAEdge[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      // 只保留两端都存在的边, 避免悬挂
      if (!nodes.some((n) => n.id === dep)) continue;
      const key = `${dep}->${node.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: dep, to: node.id });
    }
  }
  return { nodes, edges };
}

/**
 * 业务拆解器 — 暴露给 route 层.
 * 内部走 OMA runTeam(planOnly=true) 真调 LLM, 拆出 DAG.
 */
export class Decomposer {
  /**
   * 把一个高层目标拆解为 DAG.
   *
   * @param input   自然语言任务描述 (例: "写个科幻剧本大纲").
   * @param agents  候选 agent 列表, 至少 1 个; 空时降级使用单个 generic agent.
   * @param options 拆解控制 (depth / minNodes / maxNodes).
   * @returns       { taskDag, meta }  taskDag 含 nodes + edges.
   */
  async decompose(
    input: string,
    agents: readonly AgentConfig[] = [],
    options: DecomposeOptions = {},
  ): Promise<{ taskDag: OMADag; meta: DecomposeMeta }> {
    const trimmed = input?.trim();
    if (!trimmed) {
      throw new Error("decompose: input 不能为空");
    }

    // 候选 agent 兜底: 给 1 个 generic agent 让 OMA 不会因为空 roster 报错
    const effectiveAgents: AgentConfig[] =
      agents.length > 0
        ? [...agents]
        : [
            {
              name: "generic-worker",
              model: process.env.OMA_DEFAULT_MODEL ?? "claude-opus-4-6",
              systemPrompt: "You are a generic worker that can handle any task.",
            },
          ];

    const teamName = `decomposer-${randomUUID().slice(0, 8)}`;
    const teamConfig: TeamConfig = {
      name: teamName,
      agents: effectiveAgents,
      sharedMemory: true,
    };

    const engine = getOmaEngine();
    const team = engine.createTeam(teamName, teamConfig);
    const startedAt = Date.now();

    // planOnly=true: coordinator 拆解后不再调 worker, 节省 LLM 费用
    const result = await engine.runTeam(team, trimmed, { planOnly: true });

    const tasks = result.tasks ?? [];
    if (tasks.length === 0) {
      throw new Error("decompose: OMA coordinator 未返回任何 task");
    }

    // 应用 options 约束 (depth / maxNodes)
    const filtered = applyOptions(tasks, options);

    const taskDag = toOMADag(filtered, effectiveAgents);
    const meta: DecomposeMeta = {
      teamId: teamName,
      decomposedAt: new Date().toISOString(),
      decomposerModel: process.env.OMA_DEFAULT_MODEL ?? "claude-opus-4-6",
      durationMs: Date.now() - startedAt,
    };
    return { taskDag, meta };
  }
}

/** 按 options 过滤 OMA 拆解结果 (在 OMA 拆解之后本地修剪). */
function applyOptions(
  tasks: readonly TaskExecutionRecord[],
  options: DecomposeOptions,
): TaskExecutionRecord[] {
  let list = [...tasks];

  // maxNodes 截断
  if (typeof options.maxNodes === "number" && options.maxNodes > 0) {
    list = list.slice(0, options.maxNodes);
  }
  // minNodes 兜底: 不足就保留全部
  // depth 这里不做计算 (OMA 拆出来的 dependsOn 已经是图结构, 拓扑深度需在执行器里算)
  return list;
}
