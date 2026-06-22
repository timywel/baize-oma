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
 * baize-oma/src/oma-adapter.ts
 *
 * 把 OMA 能力包装成 HTTP handler — baize-loop 主控通过 HttpSlotAdapter 调.
 * 每个 capability 对应一个 route:
 *   POST /chat.agent.team.schedule → runTeam
 *   POST /chat.loop.execute       → executeLoop
 *
 * 协议遵循 baize-loop/meta/slot-api/types.ts SlotRequest/SlotResponse.
 */

import type { Request, Response } from "express";
import * as oma from "./oma-client.js";

/** 统一错误响应 (符合 SlotResponse.error 格式) */
function errorResp(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({
    status,
    error: { code, message },
  });
}

/** POST /chat.agent.team.schedule */
export async function handleTeam(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as {
    team?: { name?: string; agents?: Array<{ name: string; model?: string; systemPrompt?: string }> };
    goal?: string;
  };
  if (!body.team?.name || !body.goal || !body.team.agents?.length) {
    return errorResp(res, 400, "INVALID_REQUEST", "team.name / team.agents / goal 必填");
  }
  try {
    const result = await oma.runTeam(
      {
        name: body.team.name,
        agents: body.team.agents.map((a) => ({
          name: a.name,
          model: a.model ?? process.env.OMA_DEFAULT_MODEL ?? "claude-opus-4-6",
          systemPrompt: a.systemPrompt,
        })),
        sharedMemory: true,
      },
      body.goal,
    );
    res.json({ status: 200, body: result });
  } catch (err) {
    return errorResp(res, 500, "UNKNOWN", String(err));
  }
}

/** POST /chat.loop.execute */
export async function handleLoop(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as {
    agent?: { name?: string; model?: string; systemPrompt?: string };
    prompt?: string;
  };
  if (!body.agent?.name || !body.prompt) {
    return errorResp(res, 400, "INVALID_REQUEST", "agent.name 和 prompt 必填");
  }
  try {
    const result = await oma.executeLoop(
      {
        name: body.agent.name,
        model: body.agent.model ?? process.env.OMA_DEFAULT_MODEL ?? "claude-opus-4-6",
        systemPrompt: body.agent.systemPrompt,
      },
      body.prompt,
    );
    res.json({ status: 200, body: result });
  } catch (err) {
    return errorResp(res, 500, "UNKNOWN", String(err));
  }
}
