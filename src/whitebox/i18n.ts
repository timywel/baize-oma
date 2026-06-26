// baize-oma/src/whitebox/i18n.ts
//
// Phase 11 白盒 i18n key 映射. 按白盒 spec A10 + CLAUDE.md §i18n 强制:
// 所有错误信息走 i18n key, 不硬编码中文/英文字符串.
//
// 命名: errors.oma.<CODE>

const KEY_PREFIX = "errors.oma";

/** 错误码 → i18n key. */
export function i18nErrorKey(code: string): string {
  return `${KEY_PREFIX}.${code}`;
}

/** 已知错误码清单 (供类型检查). */
export const KNOWN_ERROR_CODES = [
  "INVALID_REQUEST",
  "DECOMPOSE_FAILED",
  "TEAM_SCHEDULE_FAILED",
  "LOOP_EXECUTE_FAILED",
  "DAG_EXECUTE_FAILED",
  "DAG_INVALID",
  "CYCLE_DETECTED",
  "MISSING_DEPENDENCY",
  "ENGINE_NOT_READY",
  "VISUALIZE_FAILED",
  "UNKNOWN",
] as const;

export type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number];

/** 校验错误码是否已知. */
export function isKnownErrorCode(code: string): code is KnownErrorCode {
  return (KNOWN_ERROR_CODES as readonly string[]).includes(code);
}
