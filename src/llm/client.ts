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
 * baize-oma/src/llm/client.ts
 *
 * baize-oma → baize-switch-core (20030) 的 LLM 客户端.
 * Phase 2 落地: 暴露 chatCompletion / embedding 两个端点, 供 decomposer / loop 调用.
 *
 * 注意:
 * - baize-oma 不直接持 API key, 走 baize-switch 统一鉴权;
 * - 失败重试用指数退避 (1s/2s/4s), 最多 3 次;
 * - 超时默认 30s, 走 AbortController 主动切断.
 */

const DEFAULT_BASE_URL = "http://127.0.0.1:20030";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

/** 单轮 LLM 消息 (Anthropic 兼容). */
export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

/** chat completion 请求体. */
export interface ChatRequest {
  model: string;
  messages: LLMMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

/** chat completion 响应 (Anthropic Messages 兼容). */
export interface ChatResponse {
  id: string;
  model: string;
  content: Array<{ type: "text"; text: string }>;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

/** embedding 请求体. */
export interface EmbeddingRequest {
  model: string;
  input: string | string[];
}

/** embedding 响应. */
export interface EmbeddingResponse {
  model: string;
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

export class LlmClientError extends Error {
  constructor(message: string, public readonly status: number, public readonly cause?: unknown) {
    super(message);
    this.name = "LlmClientError";
  }
}

/** 内部: 拿 baseUrl, 允许通过 env 覆盖. */
function getBaseUrl(): string {
  return process.env.BAIZE_SWITCH_URL?.replace(/\/+$/, "") || DEFAULT_BASE_URL;
}

/** 内部: 拿超时 ms. */
function getTimeoutMs(): number {
  const raw = process.env.BAIZE_SWITCH_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

/** 内部: fetch with timeout. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 内部: 指数退避 sleep. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 内部: 重试包装 (网络错误 / 5xx 才重试, 4xx 直接抛). */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLast = attempt === MAX_RETRIES - 1;
      if (isLast) break;
      // 仅网络错误 / 5xx 重试, 4xx 不重试
      const status = (err as LlmClientError)?.status;
      if (status && status >= 400 && status < 500) break;
      const delay = 1000 * 2 ** attempt;
      await sleep(delay);
    }
  }
  throw new LlmClientError(`${label} failed after ${MAX_RETRIES} retries`, 0, lastErr);
}

/**
 * 单轮 chat completion — POST /v1/messages.
 * 走 baize-switch 转发到上游 LLM provider.
 */
export async function chatCompletion(req: ChatRequest): Promise<ChatResponse> {
  if (!req.model) throw new LlmClientError("model 必填", 400);
  if (!Array.isArray(req.messages) || req.messages.length === 0) {
    throw new LlmClientError("messages 至少 1 条", 400);
  }
  return withRetry(async () => {
    const baseUrl = getBaseUrl();
    const resp = await fetchWithTimeout(
      `${baseUrl}/v1/messages`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: req.model,
          max_tokens: req.maxTokens ?? 1024,
          temperature: req.temperature ?? 0.7,
          system: req.systemPrompt,
          messages: req.messages,
        }),
      },
      getTimeoutMs(),
    );
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new LlmClientError(`chatCompletion ${resp.status}: ${text}`, resp.status);
    }
    return (await resp.json()) as ChatResponse;
  }, "chatCompletion");
}

/**
 * Embedding — POST /v1/embeddings.
 * 走 baize-switch 转发, 单次最多 96 个字符串 (OpenAI 限制).
 */
export async function embedding(req: EmbeddingRequest): Promise<EmbeddingResponse> {
  if (!req.model) throw new LlmClientError("model 必填", 400);
  const inputs = Array.isArray(req.input) ? req.input : [req.input];
  if (inputs.length === 0 || inputs.length > 96) {
    throw new LlmClientError("input 长度必须在 1~96 之间", 400);
  }
  return withRetry(async () => {
    const baseUrl = getBaseUrl();
    const resp = await fetchWithTimeout(
      `${baseUrl}/v1/embeddings`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: req.model, input: inputs }),
      },
      getTimeoutMs(),
    );
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new LlmClientError(`embedding ${resp.status}: ${text}`, resp.status);
    }
    return (await resp.json()) as EmbeddingResponse;
  }, "embedding");
}

/** 内部工具: chatCompletion 拿首段 text 出来. 失败返回空串. */
export async function chatCompletionText(
  req: ChatRequest,
): Promise<{ text: string; usage: ChatResponse["usage"]; model: string }> {
  const resp = await chatCompletion(req);
  const firstText = resp.content.find((c) => c.type === "text");
  return { text: firstText?.text ?? "", usage: resp.usage, model: resp.model };
}
