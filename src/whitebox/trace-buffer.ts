// baize-oma/src/whitebox/trace-buffer.ts
//
// Phase 11 白盒 trace ring buffer. 按白盒 spec A5: N=20, 每条 ~1KB.
// FIFO 行为: push 时若超 20, shift 掉最老的.

import type { TraceEvent } from "./types.js";

const MAX_SIZE = 20;

export class TraceRingBuffer {
  private buffer: TraceEvent[] = [];

  /** Push 1 条事件. 超 N 时 shift 掉最老. */
  push(event: TraceEvent): void {
    this.buffer.push(event);
    while (this.buffer.length > MAX_SIZE) {
      this.buffer.shift();
    }
  }

  /** 快照: 返回不可变副本. */
  snapshot(): readonly TraceEvent[] {
    return [...this.buffer];
  }

  /** 当前长度 (用于测试). */
  size(): number {
    return this.buffer.length;
  }

  /** 清空 (用于测试). */
  clear(): void {
    this.buffer = [];
  }
}

/** 全局单例 (P12 logger 也会 push 到这里). */
export const globalTraceBuffer = new TraceRingBuffer();
