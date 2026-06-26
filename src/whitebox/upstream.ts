// baize-oma/src/whitebox/upstream.ts
//
// Phase 11 白盒 upstream 检测. 按白盒 spec A4 (外部 http slot 必填):
// upstream: { vendor, version, endpoint, healthy }
//
// 检测策略 (不调用 vendor API, 仅 filesystem 探测):
// - vendor: "open-multi-agent"
// - version: 读 vendor/open-multi-agent/package.json
// - endpoint: vendor/open-multi-agent 路径
// - healthy: package.json 存在 → true, 否则 false

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { WhiteboxUpstream } from "./types.js";

const VENDOR_NAME = "open-multi-agent";
const VENDOR_DIR = "vendor/open-multi-agent";
const PACKAGE_JSON = "package.json";

/** 检测 vendor 状态 (同步, 性能优). */
export function detectUpstream(): WhiteboxUpstream {
  const vendorPath = join(process.cwd(), VENDOR_DIR);
  const packageJsonPath = join(vendorPath, PACKAGE_JSON);

  if (!existsSync(packageJsonPath)) {
    return {
      vendor: VENDOR_NAME,
      version: "unknown",
      endpoint: VENDOR_DIR,
      healthy: false,
      detail: `vendor package.json not found: ${packageJsonPath}`,
    };
  }

  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      name?: string;
      version?: string;
    };
    return {
      vendor: pkg.name ?? VENDOR_NAME,
      version: pkg.version ?? "unknown",
      endpoint: VENDOR_DIR,
      healthy: true,
    };
  } catch (err) {
    return {
      vendor: VENDOR_NAME,
      version: "unknown",
      endpoint: VENDOR_DIR,
      healthy: false,
      detail: `failed to parse vendor package.json: ${(err as Error).message}`,
    };
  }
}

/** 获取上游 LLM provider (baize-switch) 状态, 留待 P12 跨仓日志聚合实现. */
export function detectLlmProvider(): { baseUrl: string; healthy: boolean } {
  const baseUrl = process.env.BAIZE_SWITCH_URL?.replace(/\/+$/, "") ?? "http://127.0.0.1:20030";
  // 注: 真实健康检查需要 HTTP 调用, P12 阶段会扩展 (pino logger + baize-switch X-Trace-Id 透传)
  return { baseUrl, healthy: true };
}
