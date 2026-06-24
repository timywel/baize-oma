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
 * baize-oma/src/__tests__/decomposer.test.ts
 *
 * Phase 2 真实业务单测 (≥5 case). Decomposer 真接 vendor/open-multi-agent,
 * 走 mock OMA engine 验证输入校验 / DAG 转换 / 选项过滤 / 错误路径.
 *
 * 注: 不调真实 LLM, mock 掉 OpenMultiAgent 以便 offline CI.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Decomposer } from "../decomposer/decomposer.js";
import * as omaClient from "../oma-client.js";
import type { OpenMultiAgent, TeamRunResult, TaskExecutionRecord, AgentConfig } from "@open-multi-agent/core";

/** mock helper: 构造一个假 TeamRunResult. */
function fakeTeamResult(tasks: TaskExecutionRecord[]): TeamRunResult {
  return {
    success: true,
    goal: "fake",
    tasks,
    agentResults: new Map(),
    totalTokenUsage: { input_tokens: 100, output_tokens: 50 },
  };
}

function fakeTask(id: string, title: string, dependsOn: string[] = []): TaskExecutionRecord {
  return {
    id,
    title,
    description: `${title} 的描述`,
    dependsOn,
    status: "pending",
  };
}

const sampleAgents: AgentConfig[] = [
  { name: "researcher", model: "claude-opus-4-6" },
  { name: "architect", model: "claude-opus-4-6" },
  { name: "coder", model: "claude-opus-4-6" },
];

describe("Decomposer (Phase 2 real business)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("case 1: input 为空时直接抛错, 不调 OMA", async () => {
    const spy = vi.fn();
    vi.spyOn(omaClient, "getOmaEngine").mockImplementation(spy);
    const decomposer = new Decomposer();
    await expect(decomposer.decompose("", sampleAgents)).rejects.toThrow(/input 不能为空/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("case 2: 正常拆解, 返回的 taskDag 至少含 1 个节点, edges 与 dependsOn 一致", async () => {
    const mockEngine = {
      createTeam: vi.fn().mockReturnValue({ name: "team-fake" }),
      runTeam: vi.fn().mockResolvedValue(
        fakeTeamResult([
          fakeTask("t1", "需求调研"),
          fakeTask("t2", "架构设计", ["t1"]),
          fakeTask("t3", "编码实现", ["t2"]),
        ]),
      ),
    } as unknown as OpenMultiAgent;
    vi.spyOn(omaClient, "getOmaEngine").mockReturnValue(mockEngine);

    const decomposer = new Decomposer();
    const result = await decomposer.decompose("写一个 CLI 工具", sampleAgents);
    expect(result.taskDag.nodes.length).toBe(3);
    expect(result.taskDag.nodes.map((n) => n.id)).toEqual(["t1", "t2", "t3"]);
    expect(result.taskDag.edges).toEqual([
      { from: "t1", to: "t2" },
      { from: "t2", to: "t3" },
    ]);
    expect(result.meta.teamId).toMatch(/^decomposer-/);
    expect(result.meta.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("case 3: agents 列表为空时, decomposer 自动给 1 个 generic-worker, 不报错", async () => {
    const mockEngine = {
      createTeam: vi.fn().mockReturnValue({ name: "team-fake" }),
      runTeam: vi.fn().mockResolvedValue(fakeTeamResult([fakeTask("t1", "fallback")])),
    } as unknown as OpenMultiAgent;
    vi.spyOn(omaClient, "getOmaEngine").mockReturnValue(mockEngine);

    const decomposer = new Decomposer();
    const result = await decomposer.decompose("fallback 任务");
    expect(result.taskDag.nodes.length).toBe(1);
    expect(mockEngine.createTeam).toHaveBeenCalledTimes(1);
    const teamConfig = (mockEngine.createTeam as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
    expect(teamConfig.agents.length).toBe(1);
    expect(teamConfig.agents[0].name).toBe("generic-worker");
  });

  it("case 4: maxNodes 截断后, 后续节点的 dependsOn 会被 toOMADag 过滤掉 (无悬挂边)", async () => {
    const mockEngine = {
      createTeam: vi.fn().mockReturnValue({ name: "team-fake" }),
      runTeam: vi.fn().mockResolvedValue(
        fakeTeamResult([
          fakeTask("t1", "a"),
          fakeTask("t2", "b", ["t1"]),
          fakeTask("t3", "c", ["t2"]),
        ]),
      ),
    } as unknown as OpenMultiAgent;
    vi.spyOn(omaClient, "getOmaEngine").mockReturnValue(mockEngine);

    const decomposer = new Decomposer();
    const result = await decomposer.decompose("x", sampleAgents, { maxNodes: 2 });
    // 截断到 2 个节点, 第 3 个 t3 被去掉, 它的边也应被去掉
    expect(result.taskDag.nodes.map((n) => n.id)).toEqual(["t1", "t2"]);
    expect(result.taskDag.edges).toEqual([{ from: "t1", to: "t2" }]);
  });

  it("case 5: OMA coordinator 未返回 task 时抛错, 错误信息明确", async () => {
    const mockEngine = {
      createTeam: vi.fn().mockReturnValue({ name: "team-fake" }),
      runTeam: vi.fn().mockResolvedValue(fakeTeamResult([])),
    } as unknown as OpenMultiAgent;
    vi.spyOn(omaClient, "getOmaEngine").mockReturnValue(mockEngine);

    const decomposer = new Decomposer();
    await expect(decomposer.decompose("空任务", sampleAgents)).rejects.toThrow(
      /OMA coordinator 未返回任何 task/,
    );
  });

  it("case 6: assignee 命中 agents[] 时, agentRole 按 agent.name 推断 (researcher/architect/coder)", async () => {
    const mockEngine = {
      createTeam: vi.fn().mockReturnValue({ name: "team-fake" }),
      runTeam: vi.fn().mockResolvedValue(
        fakeTeamResult([
          { ...fakeTask("t1", "调研"), assignee: "researcher" },
          { ...fakeTask("t2", "架构"), assignee: "architect" },
          { ...fakeTask("t3", "编码"), assignee: "coder" },
          { ...fakeTask("t4", "其他"), assignee: "unknown-role" },
        ]),
      ),
    } as unknown as OpenMultiAgent;
    vi.spyOn(omaClient, "getOmaEngine").mockReturnValue(mockEngine);

    const decomposer = new Decomposer();
    const result = await decomposer.decompose("任务", sampleAgents);
    expect(result.taskDag.nodes[0]?.agentRole).toBe("researcher");
    expect(result.taskDag.nodes[1]?.agentRole).toBe("architect");
    expect(result.taskDag.nodes[2]?.agentRole).toBe("coder");
    // 未知 assignee 名: 走 fallback 轮转
    expect(result.taskDag.nodes[3]?.agentRole).toMatch(/researcher|architect|coder|reviewer|generic/);
  });

  it("case 7: meta 字段格式 (ISO 8601 + teamId 前缀 + durationMs)", async () => {
    const mockEngine = {
      createTeam: vi.fn().mockReturnValue({ name: "team-fake" }),
      runTeam: vi.fn().mockResolvedValue(fakeTeamResult([fakeTask("t1", "a")])),
    } as unknown as OpenMultiAgent;
    vi.spyOn(omaClient, "getOmaEngine").mockReturnValue(mockEngine);

    const decomposer = new Decomposer();
    const result = await decomposer.decompose("x");
    // ISO 8601 校验
    expect(new Date(result.meta.decomposedAt).toISOString()).toBe(result.meta.decomposedAt);
    expect(result.meta.teamId).toMatch(/^decomposer-[a-z0-9]{8}$/);
    expect(result.meta.decomposerModel).toBeTruthy();
    expect(typeof result.meta.durationMs).toBe("number");
  });
});
