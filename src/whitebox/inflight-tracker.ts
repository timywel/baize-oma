// baize-oma/src/whitebox/inflight-tracker.ts
//
// Phase 11 白盒 InFlight 跟踪器. 按白盒 spec A4:
// inFlight: 正在执行的能力列表.
//
// 用法:
//   const tracker = new InFlightTracker();
//   tracker.start("task.decompose", { input: "..." });
//   // ... 业务处理 ...
//   tracker.end("task.decompose");

import type { InFlightCapability } from "./types.js";

export class InFlightTracker {
  /** key = capability 名称, value = 当前在跑的 capability. */
  private inFlight = new Map<string, InFlightCapability>();

  /** 开始 1 个 capability. 已存在则更新 context (concurrent). */
  start(capability: string, context?: Record<string, unknown>): void {
    this.inFlight.set(capability, {
      capability,
      startedAt: new Date().toISOString(),
      progress: 0,
      context,
    });
  }

  /** 更新进度 (0-1). */
  update(capability: string, progress: number, context?: Record<string, unknown>): void {
    const existing = this.inFlight.get(capability);
    if (!existing) return;
    this.inFlight.set(capability, {
      ...existing,
      progress: Math.max(0, Math.min(1, progress)),
      context: context ?? existing.context,
    });
  }

  /** 结束 1 个 capability. */
  end(capability: string): void {
    this.inFlight.delete(capability);
  }

  /** 快照: 当前所有在跑的 capability. */
  snapshot(): readonly InFlightCapability[] {
    return Array.from(this.inFlight.values());
  }

  /** 当前数量. */
  size(): number {
    return this.inFlight.size;
  }

  /** 清空 (用于测试). */
  clear(): void {
    this.inFlight.clear();
  }
}

/** 全局单例. */
export const globalInFlightTracker = new InFlightTracker();
