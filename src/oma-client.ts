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
 * baize-oma/src/oma-client.ts
 *
 * 单例 OMA 引擎 — 包装 @open-multi-agent/core 的 OpenMultiAgent 调度入口.
 * server.ts 启动时调 init(),所有 HTTP endpoint 通过这个 client 调 OMA.
 *
 * 关联:
 * - vendor/open-multi-agent/dist/index.js (OpenMultiAgent / Agent / Team)
 * - plan/baize-chat/05-oma-adapter.md (LLMEvent 联合类型)
 * - plan/baize-chat/sessions/G-phase3-slots.md §4.1
 */

import { OpenMultiAgent, type AgentConfig, type TeamConfig } from "@open-multi-agent/core";

let _engine: OpenMultiAgent | null = null;

/** 初始化 OMA 引擎 (server 启动时调一次) */
export function initOmaEngine(): void {
  if (_engine) return;
  _engine = new OpenMultiAgent({
    defaultModel: process.env.OMA_DEFAULT_MODEL ?? "claude-opus-4-6",
    defaultProvider: "anthropic",
    maxConcurrency: Number(process.env.OMA_MAX_CONCURRENCY ?? 5),
  });
}

/** 健康检查: 引擎是否已初始化 */
export function isOmaReady(): boolean {
  return _engine !== null;
}

/**
 * 调度单个 agent 跑一个 prompt.
 * 对应 capability: chat.agent.schedule
 */
export async function scheduleAgent(
  agentConfig: AgentConfig,
  prompt: string,
): Promise<{ output: string; tokens: { input: number; output: number }; toolCalls: number }> {
  if (!_engine) throw new Error("OMA engine not initialized");
  const result = await _engine.runAgent(agentConfig, prompt);
  return {
    output: result.output,
    tokens: {
      input: result.tokenUsage.input_tokens,
      output: result.tokenUsage.output_tokens,
    },
    toolCalls: result.toolCalls.length,
  };
}

/**
 * 多 agent 团队协作.
 * 对应 capability: chat.agent.team
 */
export async function runTeam(
  teamConfig: TeamConfig,
  goal: string,
): Promise<{
  success: boolean;
  output: string;
  tasks: number;
  tokens: { input: number; output: number };
}> {
  if (!_engine) throw new Error("OMA engine not initialized");
  const team = _engine.createTeam(teamConfig.name, teamConfig);
  const result = await _engine.runTeam(team, goal);
  const coordinator = result.agentResults.get("coordinator");
  return {
    success: result.success,
    output: coordinator?.output ?? "",
    tasks: result.tasks?.length ?? 0,
    tokens: {
      input: result.totalTokenUsage.input_tokens,
      output: result.totalTokenUsage.output_tokens,
    },
  };
}

/**
 * 通用 loop 执行入口.
 * 对应 capability: chat.loop.execute
 *
 * Phase 1 占位: 转发到 scheduleAgent.
 * Phase 3 完整: 支持自定义 loop 策略 (sliding-window / summarize / compact).
 */
export async function executeLoop(
  agentConfig: AgentConfig,
  prompt: string,
): Promise<{ output: string; tokens: { input: number; output: number } }> {
  if (!_engine) throw new Error("OMA engine not initialized");
  const result = await _engine.runAgent(agentConfig, prompt);
  return {
    output: result.output,
    tokens: {
      input: result.tokenUsage.input_tokens,
      output: result.tokenUsage.output_tokens,
    },
  };
}
