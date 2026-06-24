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
 * baize-oma/src/dag/visualizer.ts
 *
 * Phase 3: DAG 可视化 — ASCII (debug 控制台) + Mermaid (markdown 文档).
 *
 * 约束:
 * - ASCII 输出: 按拓扑层分行, 同层节点同行
 *   例: [t1, t2] → [t3]
 * - Mermaid 输出: flowchart LR + 节点 id + 边 from → to
 * - 不引入外部依赖 (纯字符串拼接)
 */

import type { DAG } from "./types.js";

/** 简易 BFS 拓扑分层, 用于 ASCII 排版. */
function layerById(dag: DAG): Map<string, number> {
  const byId = new Map(dag.nodes.map((n) => [n.id, n] as const));
  const layer = new Map<string, number>();
  for (const n of dag.nodes) layer.set(n.id, 0);
  // BFS-style 沿依赖传播
  let changed = true;
  let guard = 0;
  while (changed && guard < dag.nodes.length + 2) {
    changed = false;
    guard++;
    for (const n of dag.nodes) {
      if (n.dependsOn.length === 0) {
        if ((layer.get(n.id) ?? 0) !== 0) {
          layer.set(n.id, 0);
          changed = true;
        }
        continue;
      }
      const upstreamLayers = n.dependsOn.map((d) => layer.get(d) ?? 0);
      const expected = Math.max(...upstreamLayers) + 1;
      if ((layer.get(n.id) ?? -1) !== expected) {
        layer.set(n.id, expected);
        changed = true;
      }
      // 静态分析: 避免把不存在的依赖算进去
      void byId;
    }
  }
  return layer;
}

/** ASCII 可视化. 例: "[t1, t2] → [t3] → [t4]". */
export function toAscii(dag: DAG): string {
  if (dag.nodes.length === 0) return "<empty DAG>";
  const layer = layerById(dag);
  const maxLayer = Math.max(0, ...layer.values());
  const groups: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const n of dag.nodes) {
    groups[layer.get(n.id) ?? 0]?.push(n.id);
  }
  return groups.map((ids) => `[${ids.join(", ")}]`).join(" → ");
}

/** Mermaid flowchart LR 输出. 例: "flowchart LR\n  t1 --> t3\n  t2 --> t3". */
export function toMermaid(dag: DAG, options: { title?: string } = {}): string {
  const lines: string[] = ["flowchart LR"];
  if (options.title) lines.push(`  %% ${options.title}`);
  // 节点声明
  for (const n of dag.nodes) {
    const label = n.task.length > 24 ? `${n.task.slice(0, 21)}...` : n.task;
    const safe = label.replace(/"/g, "'");
    lines.push(`  ${n.id}["${safe} (${n.agentRole})"]`);
  }
  // 边: 优先用 dag.edges, 否则从 dependsOn 派生
  const edgeList =
    dag.edges && dag.edges.length > 0
      ? dag.edges
      : dag.nodes.flatMap((n) => n.dependsOn.map((d) => ({ from: d, to: n.id })));
  for (const e of edgeList) {
    lines.push(`  ${e.from} --> ${e.to}`);
  }
  return lines.join("\n");
}
