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
 * baize-oma/src/routes/team-schedule.ts
 *
 * POST /chat.agent.team.schedule — 多 agent 团队协作路由.
 * Phase 2 落地: 拆出原 oma-adapter.handleTeam, 走真 OMA runTeam().
 *
 * 协议:
 *   request:  { team: { name, agents[] }, goal: string, options?: { maxConcurrency?, sharedMemory? } }
 *   response: { status, body: { success, output, tasks, tokens, agentResults? } }
 */

import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import { getOmaEngine, isOmaReady } from "../oma-client.js";
import type { AgentConfig, TeamConfig } from "@open-multi-agent/core";

const router: ExpressRouter = Router();

/** 统一错误响应. */
function errorResp(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ status, error: { code, message } });
}

/** request body 类型. */
interface TeamScheduleRequest {
  team?: {
    name?: string;
    agents?: Array<{ name: string; model?: string; systemPrompt?: string }>;
  };
  goal?: string;
  options?: { maxConcurrency?: number; sharedMemory?: boolean };
}

router.post("/chat.agent.team.schedule", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as TeamScheduleRequest;

  if (!body.team?.name?.trim()) {
    return errorResp(res, 400, "INVALID_REQUEST", "team.name 必填");
  }
  if (!body.goal?.trim()) {
    return errorResp(res, 400, "INVALID_REQUEST", "goal 必填且非空");
  }
  if (!body.team.agents?.length) {
    return errorResp(res, 400, "INVALID_REQUEST", "team.agents 至少 1 个");
  }
  for (const a of body.team.agents) {
    if (!a.name) {
      return errorResp(res, 400, "INVALID_REQUEST", "team.agents[].name 必填");
    }
  }

  if (!isOmaReady()) {
    return errorResp(res, 503, "ENGINE_NOT_READY", "OMA 引擎未初始化");
  }

  // request agents[] → AgentConfig[]
  const defaultModel = process.env.OMA_DEFAULT_MODEL ?? "claude-opus-4-6";
  const agents: AgentConfig[] = body.team.agents.map((a) => ({
    name: a.name,
    model: a.model ?? defaultModel,
    systemPrompt: a.systemPrompt,
  }));

  const teamConfig: TeamConfig = {
    name: body.team.name,
    agents,
    sharedMemory: body.options?.sharedMemory ?? true,
    maxConcurrency: body.options?.maxConcurrency,
  };

  try {
    const engine = getOmaEngine();
    const team = engine.createTeam(teamConfig.name, teamConfig);
    const result = await engine.runTeam(team, body.goal);

    // 把 agentResults (Map) 序列化为对象, 方便 JSON 传输
    const agentResultsObj: Record<string, { output: string; success: boolean; tokens: { input: number; output: number } }> = {};
    for (const [name, r] of result.agentResults.entries()) {
      agentResultsObj[name] = {
        output: r.output,
        success: r.success,
        tokens: { input: r.tokenUsage.input_tokens, output: r.tokenUsage.output_tokens },
      };
    }

    res.json({
      status: 200,
      body: {
        success: result.success,
        output: agentResultsObj.coordinator?.output ?? "",
        tasks: result.tasks?.length ?? 0,
        tokens: result.totalTokenUsage,
        agentResults: agentResultsObj,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResp(res, 500, "TEAM_FAILED", msg);
  }
});

export default router;
