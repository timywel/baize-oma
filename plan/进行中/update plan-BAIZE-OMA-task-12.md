# update plan-BAIZE-OMA-task-12 — baize-oma Phase 12 全程日志跟踪 (P12)

> **PLAN**: [plan/待完成/PLAN-BAIZE-OMA-PHASE12-LOGGING-20260625-211500.md](../../待完成/PLAN-BAIZE-OMA-PHASE12-LOGGING-20260625-211500.md) (v1.0, pending approval)
> **Task 配对 JSON**: [update plan-BAIZE-OMA-task-12.json](./update plan-BAIZE-OMA-task-12.json)
> **上一轮**: [task-11.md](./update plan-BAIZE-OMA-task-11.md) (P11 白盒显现, pending approval)
> **作者**: BaiZe 架构
> **创建**: 2026-06-25T21:15:00+08:00
> **本轮 scope**: `/home/timywel/AI_Product/baize-slot/baize-oma/` (子项目仓内)

---

## 0. 上下文

P11 (白盒显现) 是 P12 (全程日志) 的前置: 白盒 ring buffer 需要 logger 同步写. P12 启动后, baize-oma 跨请求追踪能力完整.

**目标**: 实现 pino 结构化 logger + trace_id middleware + 5 routes 接入, 让 baize-loop 主控日志聚合可 grep.

**不涉及跨仓** (baize-chat / baize-switch 联调仍延后). 不动 vendor.

---

## 1. 任务清单 (P12.1~P12.4)

### P12.1 logger 基础
- [ ] **T12.1.1** 新建 `src/logger/logger.ts` (~50 行, pino 实例)
- [ ] **T12.1.2** 新建 `src/logger/trace-id.ts` (~40 行, UUID v4 + middleware)
- [ ] **T12.1.3** 新建 `src/logger/i18n-log.ts` (~30 行, 错误码 i18n key)
- [ ] **T12.1.4** 修改 `package.json` 加 pino 依赖
- [ ] **T12.1.5** git commit

### P12.2 集成
- [ ] **T12.2.1** 修改 `src/server.ts` 注册 trace_id middleware (~5 行)
- [ ] **T12.2.2** 修改 `src/routes/decompose.ts` (~15 行, 接入 logger)
- [ ] **T12.2.3** 修改 `src/routes/team-schedule.ts` (~15 行)
- [ ] **T12.2.4** 修改 `src/routes/loop-execute.ts` (~20 行, 循环多次)
- [ ] **T12.2.5** 修改 `src/routes/dag-execute.ts` (~20 行, DAG 多次)
- [ ] **T12.2.6** 修改 `src/whitebox/trace-buffer.ts` 接入 logger (~5 行)
- [ ] **T12.2.7** git commit

### P12.3 测试
- [ ] **T12.3.1** 新建 `src/__tests__/logger.test.ts` (~150 行, 5 case)
- [ ] **T12.3.2** 修改 `tests/smoke/curl-test.sh` 加 X-Trace-Id 烟测 (~10 行)
- [ ] **T12.3.3** 修改 `vitest.config.ts` 加 src/logger/ (~3 行)
- [ ] **T12.3.4** git commit

### P12.4 收口
- [ ] **T12.4.1** 跑 pnpm lint + pnpm test + pnpm test:smoke + pnpm test:coverage 验证
- [ ] **T12.4.2** git commit + tag baize-oma-v0.4.1

**估计**: ~350 行, 1 session (~25 min 实际 / 0.9 周估计)

---

## 2. 关键技术点 (从 PLAN §2-§6 引用)

### 2.1 pino logger 配置

```typescript
// src/logger/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { slot: "baize-oma", version: "0.4.1" },
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

### 2.2 trace_id middleware

```typescript
// src/logger/trace-id.ts
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

declare module "express-serve-static-core" {
  interface Request { traceId: string; }
}

export function traceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.traceId = req.header("X-Trace-Id") ?? randomUUID();
  res.setHeader("X-Trace-Id", req.traceId);
  next();
}
```

### 2.3 i18n-log helper

```typescript
// src/logger/i18n-log.ts
export function i18nError(code: string): string {
  return `errors.oma.${code}`;  // i18n key
}

export function logError(req: Request, err: unknown, context: object): void {
  logger.error({
    trace_id: req.traceId,
    msg: i18nError(err.code ?? "UNKNOWN"),
    error: err.message,
    stack: err.stack,
    ...context,
  });
}
```

### 2.4 5 routes 接入 (每 route 模板)

```typescript
router.post("/oma.team.create", async (req, res) => {
  const start = Date.now();
  logger.info({ trace_id: req.traceId, msg: "received POST /oma.team.create", input_size: req.body?.input?.length });
  try {
    // ... 业务 ...
    const result = await decomposer.decompose(...);
    logger.info({ trace_id: req.traceId, msg: "decompose done", duration_ms: Date.now() - start, node_count: result.nodes.length });
    res.json({ status: 200, body: result });
  } catch (err) {
    logError(req, err, { capability: "task.decompose" });
    res.status(500).json({ status: 500, error: { code: "DECOMPOSE_FAILED", message: i18nError("DECOMPOSE_FAILED") } });
  }
});
```

---

## 3. 风险

| 风险 | 等级 | 说明 |
|------|------|------|
| pino 性能 | 低 | 0 依赖, 高性能, 0.5ms/op |
| trace_id 透传 | 中 | 上下游 slot 都需支持 X-Trace-Id 透传, baize-switch 暂未实现 (等后续) |
| 日志量 | 中 | 高并发时 stdout 写入可能成瓶颈, 但 baize-oma 20060 不是热路径 |
| i18n 完整性 | 中 | i18n key 跟 baize-loop 主仓对齐, 需后续 P13 验证 |

---

## 4. 完成定义

- [ ] trace_id middleware: 响应头 X-Trace-Id 必返
- [ ] 无 X-Trace-Id 请求 → 自动生成 UUID v4
- [ ] stdout 输出 JSON 结构化日志
- [ ] 5 routes 都接入 logger
- [ ] P11 whitebox ring buffer 同步接到 logger
- [ ] 错误信息走 i18n key
- [ ] pnpm lint 0 error
- [ ] pnpm test 49+6+5 全过
- [ ] pnpm test:smoke 16+1+1 全过
- [ ] pnpm test:coverage ≥ 83%
- [ ] vendor 1.9M 不变
- [ ] git tag baize-oma-v0.4.1

---

## 5. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-25T21:15:00+08:00 | 初版。4 task P12.1-P12.4, ~350 行 0.9 周 |