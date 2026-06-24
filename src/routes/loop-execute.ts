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
 * baize-oma/src/routes/loop-execute.ts
 *
 * POST /chat.loop.execute — 通用循环执行路由.
 * Phase 2 落地: 拆出原 oma-adapter.handleLoop, 走真 OMA 循环 (decompose → execute → reflect).
 *
 * 协议:
 *   request:  {
 *     agent: { name, model?, systemPrompt? },
 *     prompt: string,
 *     loop?: {
 *       maxIterations?: number,   // 默认 3
 *       reflectModel?: string,     // 反思用模型, 默认与 agent 相同
 *       stopOnSuccess?: boolean,   // 默认 true
 *     }
 *   }
 *   response: {
 *     status,
 *     body: {
 *       iterations: Array<{ taskDag, output, reflection, done }>,
 *       finalOutput: string,
 *       totalTokens: { input, output },
 *     }
 *   }
 *
 * 循环逻辑 (decompose → execute → reflect):
 *   1. 用 Decomposer 把 prompt 拆成 DAG
 *   2. 走 OMA runTeam 实际执行
 *   3. 调 LLM 反思结果 (chatCompletionText 走 baize-switch 20030)
 *   4. 若反思 = done 或达到 maxIterations, 结束
 */

import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import { Decomposer } from "../decomposer/decomposer.js";
import { getOmaEngine, isOmaReady } from "../oma-client.js";
import { chatCompletionText } from "../llm/client.js";
import type { AgentConfig, TeamConfig } from "@open-multi-agent/core";

const router: ExpressRouter = Router();
const decomposer = new Decomposer();

/** 统一错误响应. */
function errorResp(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ status, error: { code, message } });
}

interface LoopRequest {
  agent?: { name?: string; model?: string; systemPrompt?: string };
  prompt?: string;
  loop?: { maxIterations?: number; reflectModel?: string; stopOnSuccess?: boolean };
}

interface IterationRecord {
  index: number;
  taskDag: { nodes: Array<{ id: string; title: string }>; edges: Array<{ from: string; to: string }> };
  output: string;
  reflection: string;
  done: boolean;
  tokens: { input: number; output: number };
}

router.post("/chat.loop.execute", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as LoopRequest;

  if (!body.agent?.name) {
    return errorResp(res, 400, "INVALID_REQUEST", "agent.name 必填");
  }
  if (!body.prompt?.trim()) {
    return errorResp(res, 400, "INVALID_REQUEST", "prompt 必填且非空");
  }
  if (!isOmaReady()) {
    return errorResp(res, 503, "ENGINE_NOT_READY", "OMA 引擎未初始化");
  }

  const defaultModel = process.env.OMA_DEFAULT_MODEL ?? "claude-opus-4-6";
  const maxIterations = Math.max(1, Math.min(body.loop?.maxIterations ?? 3, 10));
  const reflectModel = body.loop?.reflectModel ?? body.agent.model ?? defaultModel;
  const stopOnSuccess = body.loop?.stopOnSuccess ?? true;

  const agentConfig: AgentConfig = {
    name: body.agent.name,
    model: body.agent.model ?? defaultModel,
    systemPrompt: body.agent.systemPrompt,
  };

  const iterations: IterationRecord[] = [];
  let totalInput = 0;
  let totalOutput = 0;
  let currentPrompt = body.prompt;
  let finalOutput = "";

  try {
    for (let i = 0; i < maxIterations; i++) {
      // 1. decompose
      const { taskDag, meta } = await decomposer.decompose(currentPrompt, [agentConfig]);
      // 2. execute (走 OMA runTeam 真跑)
      const engine = getOmaEngine();
      const teamName = `loop-${body.agent.name}-${i}-${Date.now()}`;
      const teamConfig: TeamConfig = {
        name: teamName,
        agents: [agentConfig],
        sharedMemory: true,
      };
      const team = engine.createTeam(teamName, teamConfig);
      const teamResult = await engine.runTeam(team, currentPrompt);

      const output = teamResult.agentResults.get("coordinator")?.output ?? "";
      totalInput += teamResult.totalTokenUsage.input_tokens;
      totalOutput += teamResult.totalTokenUsage.output_tokens;

      // 3. reflect (调 LLM 走 baize-switch 20030)
      const reflectResp = await chatCompletionText({
        model: reflectModel,
        systemPrompt:
          "你是一个结果评估器. 评估 agent 输出是否解决了用户任务. " +
          "返回严格 JSON: { done: boolean, reason: string, nextTask?: string }",
        messages: [
          {
            role: "user",
            content: `用户任务: ${body.prompt}\n本轮 prompt: ${currentPrompt}\nagent 输出: ${output}\nDAG 节点数: ${taskDag.nodes.length}`,
          },
        ],
        temperature: 0.2,
        maxTokens: 512,
      });
      totalInput += reflectResp.usage.input_tokens;
      totalOutput += reflectResp.usage.output_tokens;

      // 解析 reflection JSON (失败兜底 done=false)
      let done = false;
      let nextTask: string | undefined;
      try {
        const jsonMatch = reflectResp.text.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as { done?: boolean; nextTask?: string }) : {};
        done = Boolean(parsed.done);
        nextTask = parsed.nextTask;
      } catch {
        done = false;
      }

      iterations.push({
        index: i,
        taskDag: {
          nodes: taskDag.nodes.map((n) => ({ id: n.id, title: n.title })),
          edges: taskDag.edges,
        },
        output,
        reflection: reflectResp.text,
        done,
        tokens: { input: 0, output: 0 }, // 已累加到 totalTokens, 此处不再重复
      });

      // 收尾条件
      if (done && stopOnSuccess) {
        finalOutput = output;
        break;
      }
      if (i === maxIterations - 1) {
        finalOutput = output;
        break;
      }
      // 下一轮的 prompt
      currentPrompt = nextTask?.trim() || `${currentPrompt}\n\n(上轮未完成, 请继续)`;
      // meta 在循环里没用到, 标注一下免得 lint 报
      void meta;
    }

    res.json({
      status: 200,
      body: {
        iterations,
        finalOutput,
        totalTokens: { input: totalInput, output: totalOutput },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResp(res, 500, "LOOP_FAILED", msg);
  }
});

export default router;
