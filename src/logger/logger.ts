// baize-oma/src/logger/logger.ts
//
// Phase 12 全程日志跟踪. pino 结构化 logger.
//
// 配置:
// - level: process.env.LOG_LEVEL ?? "info"
// - base: { slot: "baize-oma", version: <package.json> }
// - timestamp: ISO 8601 (UTC)
//
// 用法:
// import { logger } from "./logger/logger.js";
// logger.info({ trace_id: "abc", msg: "received POST /dag.execute" });
// logger.error({ trace_id: "abc", msg: "errors.oma.DECOMPOSE_FAILED", error: err.message });

import pino, { type Logger } from "pino";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_VERSION = readPackageVersion();

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf-8"),
    ) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { slot: "baize-oma", version: PACKAGE_VERSION },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
});