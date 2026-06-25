# update plan-BAIZE-OMA-task-11 — baize-oma Phase 11 白盒显现 (P11)

> **PLAN**: [plan/待完成/PLAN-BAIZE-OMA-PHASE11-WHITEBOX-20260625-205500.md](../../待完成/PLAN-BAIZE-OMA-PHASE11-WHITEBOX-20260625-205500.md) (v1.0, pending approval)
> **Task 配对 JSON**: [update plan-BAIZE-OMA-task-11.json](./update plan-BAIZE-OMA-task-11.json)
> **上一轮**: [task-10.md](./update plan-BAIZE-OMA-task-10.md) (P10 跨仓联调, tag v0.3.5)
> **作者**: BaiZe 架构
> **创建**: 2026-06-25T20:55:00+08:00
> **本轮 scope**: `/home/timywel/AI_Product/baize-slot/baize-oma/` (子项目仓内)

---

## 0. 上下文

P10 收口 (tag v0.3.5) + P9 revert 完整. 启动 P11: 白盒显现 (按 baize-loop 主仓白盒规范).

**目标**: 实现 `GET /whitebox` 端点 + WhiteboxSnapshot schema, 让 baize-loop 主控 slot-registry 拉取, baize-chat 5 widget 订阅多 slot 流.

**不涉及跨仓** (baize-chat / baize-switch 联调仍延后). 不动 vendor.

---

## 1. 任务清单 (P11.1~P11.5)

### P11.1 类型 + TraceRingBuffer
- [ ] **T11.1.1** 新建 `src/whitebox/types.ts` (~120 行)
- [ ] **T11.1.2** 新建 `src/whitebox/trace-buffer.ts` (~60 行)
- [ ] **T11.1.3** 新建 `src/whitebox/i18n.ts` (~30 行)
- [ ] **T11.1.4** git commit

### P11.2 跟踪器
- [ ] **T11.2.1** 新建 `src/whitebox/inflight-tracker.ts` (~80 行)
- [ ] **T11.2.2** 新建 `src/whitebox/upstream.ts` (~50 行)
- [ ] **T11.2.3** 新建 `src/whitebox/snapshot.ts` (~80 行)
- [ ] **T11.2.4** git commit

### P11.3 路由层
- [ ] **T11.3.1** 新建 `src/routes/whitebox.ts` (~80 行)
- [ ] **T11.3.2** 修改 `src/server.ts` 注册 whiteboxRouter (~3 行)
- [ ] **T11.3.3** git commit

### P11.4 路由层集成
- [ ] **T11.4.1** 修改 `src/routes/decompose.ts` (~10 行)
- [ ] **T11.4.2** 修改 `src/routes/team-schedule.ts` (~10 行)
- [ ] **T11.4.3** 修改 `src/routes/loop-execute.ts` (~15 行)
- [ ] **T11.4.4** 修改 `src/routes/dag-execute.ts` (~15 行)
- [ ] **T11.4.5** git commit

### P11.5 测试 + 收口
- [ ] **T11.5.1** 新建 `src/__tests__/whitebox.test.ts` (~200 行, 6 case)
- [ ] **T11.5.2** 修改 `tests/smoke/curl-test.sh` (~10 行)
- [ ] **T11.5.3** 跑 `pnpm lint` + `pnpm test` + `pnpm test:smoke` + `pnpm test:coverage` 验证
- [ ] **T11.5.4** git commit + tag baize-oma-v0.4.0

**估计**: ~740 行, 1 session (~30 min 实际 / 1.5 周估计)

---

## 2. 关键技术点 (从 PLAN §2-§6 引用)

### 2.1 WhiteboxSnapshot schema (5 类字段)

```typescript
// src/whitebox/types.ts
export interface WhiteboxSnapshot {
  slotId: string;          // "baize-oma"
  slotVersion: string;     // "0.3.5"
  capturedAt: string;      // ISO 8601
  state: "idle" | "loading" | "active" | "degraded" | "unhealthy" | "stopped";
  inFlight: InFlightCapability[];   // 正在执行
  lastError?: LastError;             // 最近一次错误
  trace: TraceEvent[];               // 最近 20 条
  upstream: WhiteboxUpstream;        // vendor 状态
  internals: BaizeWhiteboxInternals; // 仓自定
}
```

### 2.2 TraceRingBuffer (A5: N=20, FIFO)

```typescript
export class TraceRingBuffer {
  private buffer: TraceEvent[] = [];
  push(event: TraceEvent): void { /* push + shift if > 20 */ }
  snapshot(): readonly TraceEvent[] { return [...this.buffer]; }
}
```

### 2.3 InFlightTracker

```typescript
export class InFlightTracker {
  private inFlight = new Map<string, InFlightCapability>();
  start(capability: string, context?: Record<string, unknown>): void;
  end(capability: string): void;
  snapshot(): readonly InFlightCapability[];
}
```

### 2.4 i18n 错误码

```typescript
// src/whitebox/i18n.ts
export function i18nError(code: string): string {
  return `errors.oma.${code}`;  // i18n key, 不含中文字符串
}
```

---

## 3. 风险

| 风险 | 等级 | 说明 |
|------|------|------|
| i18n 键不统一 | 中 | baize-loop 主仓还没建 whitebox-types, baize-oma 自己定义 key 后续可能冲突 |
| 性能 | 低 | GET /whitebox < 100ms P95 容易达成 (snapshot 是内存聚合) |
| vendor 干扰 | 低 | upstream 字段从 filesystem 探测 vendor/package.json, 不调用 vendor API |
| /whitebox 暴露 | 中 | 配 CORS 仅 localhost, 加注释说明不暴露给浏览器 |

---

## 4. 完成定义

- [ ] GET /whitebox 200 + schema 完整
- [ ] TraceRingBuffer N=20 FIFO 验证
- [ ] InFlightTracker start/end 同步
- [ ] lastError 单例 + trace_id
- [ ] i18n key 全部走 zh-CN
- [ ] pnpm lint 0 error
- [ ] pnpm test 49+6 全过
- [ ] pnpm test:smoke 16+1 全过
- [ ] pnpm test:coverage ≥ 82%
- [ ] vendor 1.9M 不变
- [ ] git tag baize-oma-v0.4.0

---

## 5. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-25T20:55:00+08:00 | 初版。5 task P11.1-P11.5, ~740 行 1.5 周 |