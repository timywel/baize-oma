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
 * baize-oma/src/decomposer/types.ts
 *
 * OMA 任务拆解层共享类型. 被 decompose.ts / dag-execute.ts / dag/types.ts 共同引用.
 *
 * 历史: 早期是占位骨架 (M3 阶段), Phase 2 落地 decomposer.ts 后被实际使用, 此文件不再是占位.
 *
 * 涉及规范:
 * - plan/白泽baize-oma-DAG集成方案-20260623.md §3.2
 */

/** OMA 拆解后的单个任务节点. */
export interface OMANode {
  id: string;
  title: string;
  description: string;
  agentRole: "researcher" | "architect" | "coder" | "reviewer" | "generic";
  dependsOn: string[];
}

/** OMA 拆解后的边 (from → to). */
export interface OMAEdge {
  from: string;
  to: string;
}

/** OMA 拆解后的 DAG = nodes + edges. */
export interface OMADag {
  nodes: OMANode[];
  edges: OMAEdge[];
}

/** 拆解元数据: teamId + 时间戳 + 模型 + 耗时. */
export interface DecomposeMeta {
  teamId: string;
  decomposedAt: string;
  decomposerModel: string;
  durationMs: number;
}

/** 拆解选项: 控制深度/节点数上下限. */
export interface DecomposeOptions {
  depth?: number;
  maxDepth?: number;
  minNodes?: number;
  maxNodes?: number;
}
