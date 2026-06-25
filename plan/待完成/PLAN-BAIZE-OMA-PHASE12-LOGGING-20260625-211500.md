# PLAN-BAIZE-OMA-PHASE12-LOGGING-20260625-211500 — baize-oma 全程日志跟踪 (P12)

> **作者**: BaiZe 架构
> **创建**: 2026-06-25T21:15:00+08:00
> **状态**: pending approval
> **父规范**:
> - baize-loop `plan/refactor/slots-and-libs/8-slot-whitebox-observability-spec.md` (A5 trace ring buffer, A1 跨 slot 日志 grep)
> - baize-oma `plan/refactor/集成报告/baize-oma-v0.3.5-集成报告-20260625.md` §8.3
> - baize-oma `plan/待完成/PLAN-BAIZE-OMA-PHASE11-WHITEBOX-20260625-205500.md` (P11 白盒前置, P12 日志联动)
>
> **滚动迭代**: 承接 P11 (白盒显现), 启动新滚动序列 task-12.{md,json}

---

## ASSUMPTIONS（强制, 用户确认前先核对）

- **A1**: baize-oma 当前**没有 logger 系统**, 只有 1 个 `console.log` 启动信息 (server.ts:73), 路由层只返 `errorResp` 不记日志
- **A2**: 跨请求追踪需要 trace_id middleware, 每次请求生成 UUID v4, 写入 response header (X-Trace-Id) + log + whitebox trace ring buffer
- **A3**: 日志格式统一 JSON 结构化 (pino 推荐, 0 依赖高性能), baize-loop 主控日志聚合可 grep
- **A4**: trace_id 必须能从响应头 `X-Trace-Id` 拿到, 便于跨 slot 日志 grep 5s 定位 (按白盒 spec A1)
- **A5**: i18n 错误信息 (lastError.message) 走 i18n key, 不硬编码中文/英文 (按白盒 spec A10)
- **A6**: 日志级别: debug (开发) / info (常规) / warn (异常但可恢复) / error (失败)
- **A7**: 日志不持久化 (白盒 spec A6: "不写入 `~/.baize/`"), 只走 stdout/stderr 让主控聚合
- **A8**: P11 白盒的 trace ring buffer 复用 P12 的 logger, 一个 push 同步写两个消费者 (ring buffer + 结构化日志)

---

## 1. Objective (做什么 + 为什么)

### 1.1 用户痛点

按 baize-oma 当前状态:

| 当前黑盒 | 想要的能力 |
|---------|-----------|
| 请求失败只能从路由 errorResp 看错误码 | 想知道失败时**完整请求上下文**: 输入参数 / trace_id / 耗时 / upstream 状态 |
| 多个请求并发, 调试时无法关联 | 想用 trace_id grep 所有日志 |
| `pnpm dev` 看不到结构化日志 | 想要 JSON 结构化输出 (baize-loop 主控可聚合) |
| 5 widget 显示 trace 流无数据 | 想要 ring buffer + 流式推送 |

### 1.2 成功长什么样 (用户视角)

```bash
# 请求自动带 trace_id (响应头 + 日志 + 白盒)
$ curl -i -X POST http://127.0.0.1:20060/dag.execute \
    -H "content-type: application/json" \
    -d '{"input":"say hi"}'
HTTP/1.1 200 OK
X-Trace-Id: 7f3a9b2c-e4d5-4a1b-9c3d-8e7f6a5b4c3d
Content-Type: application/json

{ "status": 200, ... }
```

```json
// stdout 结构化日志 (pino 默认 JSON)
{"level":"info","time":1719320400000,"trace_id":"7f3a9b2c-...","msg":"received POST /dag.execute","capability":"task.dag.execute","input_size":42}
{"level":"info","time":1719320401000,"trace_id":"7f3a9b2c-...","msg":"decompose → 1 node","duration_ms":1100}
{"level":"info","time":1719320402000,"trace_id":"7f3a9b2c-...","msg":"execute node 1 done","output":"Hello there friend","tokens":{...}}
```

```bash
# 跨 slot 日志 grep 5s 定位
$ grep "7f3a9b2c" /var/log/baize/{oma,switch,chat}/*.log
oma.log:    {"trace_id":"7f3a9b2c",...}
switch.log: {"trace_id":"7f3a9b2c",...}  # baize-switch 也支持 X-Trace-Id 透传
chat.log:   {"trace_id":"7f3a9b2c",...}
```

### 1.3 关键链路

```
HTTP 请求
  ↓
[trace_id middleware] 生成 UUID + 写入 req.traceId
  ↓
[logger] 结构化输出 (含 trace_id, capability, 耗时)
  ↓
[route handler] 处理业务
  ├─ 成功 → [whitebox ring buffer] push (info 级)
  └─ 失败 → [whitebox ring buffer] push (error 级) + [lastError] 更新
  ↓
[response] 返 JSON + 响应头 X-Trace-Id
```

---

## 2. Commands (可执行命令)

```bash
# 仓根
cd /home/timywel/AI_Product/baize-slot/baize-oma/

# 开发
pnpm dev
# 日志自动 JSON 输出到 stdout

# 单元测试
pnpm test                                    # 现有 + 新 logger 测试
pnpm test:coverage                           # 验证 ≥ 82%

# 烟测 (含 X-Trace-Id 检查)
pnpm dev & sleep 5 && pnpm test:smoke

# 性能
pnpm bench

# 调试: 单次请求 + 看 trace_id
TRACE_ID=$(curl -s -i -X POST http://127.0.0.1:20060/dag.execute \
  -H "content-type: application/json" \
  -d '{"input":"test"}' | grep -i "X-Trace-Id" | awk '{print $2}' | tr -d '\r')
echo "Trace: $TRACE_ID"
grep "$TRACE_ID" /tmp/oma.log
```

---

## 3. Project Structure (本计划改/新增的路径)

### 3.1 baize-oma 仓内

| 路径 | 操作 | 说明 |
|------|------|------|
| `src/logger/logger.ts` | **新建** | pino 实例 + 配置 (~50 行) |
| `src/logger/trace-id.ts` | **新建** | UUID v4 生成 + 中间件 (~40 行) |
| `src/logger/i18n-log.ts` | **新建** | i18n 错误日志 helper (~30 行) |
| `src/server.ts` | **修改** | 注册 trace_id middleware (~5 行) |
| `src/routes/decompose.ts` | **修改** | 接入 logger + trace_id (~10 行) |
| `src/routes/team-schedule.ts` | **修改** | 同上 |
| `src/routes/loop-execute.ts` | **修改** | 同上 |
| `src/routes/dag-execute.ts` | **修改** | 同上 |
| `src/__tests__/logger.test.ts` | **新建** | logger + trace_id 单测 (~150 行, 5 case) |
| `src/whitebox/trace-buffer.ts` | **修改** | P11 已建, 接入 logger (~5 行) |
| `tests/smoke/curl-test.sh` | **修改** | 加 X-Trace-Id 烟测 (~10 行) |
| `package.json` | **修改** | 加 pino 依赖 (~3 行) |
| `vitest.config.ts` | **修改** | 加 src/logger/ 到 coverage (~3 行) |

### 3.2 跨仓依赖 (不动)

- baize-switch X-Trace-Id 透传 — P12 范围内不动 baize-switch 仓
- baize-loop 主控日志聚合 — 未来 P13+

### 3.3 计划文档

| 路径 | 操作 |
|------|------|
| `plan/待完成/PLAN-BAIZE-OMA-PHASE12-LOGGING-20260625-211500.md` | **新建** (本文件) |
| `plan/进行中/update plan-BAIZE-OMA-task-12.{md,json}` | **新建** (滚动迭代配对) |

---

## 4. Code Style (沿用 baize-oma 仓既有风格)

```typescript
// src/logger/logger.ts 风格
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: { slot: "baize-oma", version: "0.3.5" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// src/logger/trace-id.ts 风格
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

declare module "express-serve-static-core" {
  interface Request {
    traceId: string;
  }
}

export function traceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.traceId = req.header("X-Trace-Id") ?? randomUUID();
  res.setHeader("X-Trace-Id", req.traceId);
  next();
}
```

**命名/格式** (沿用):
- TypeScript 5.x + strict
- pino (结构化 JSON logger, 0 依赖, 高性能)
- trace_id 格式: UUID v4 (8-4-4-4-12 hex)
- 响应头: `X-Trace-Id` (大写, 含连字符)
- 日志字段: 必填 `trace_id` / `level` / `time` / `msg`, 可选 `capability` / `duration_ms` / `input_size`

---

## 5. Testing Strategy

### 5.1 测试层级

| 层级 | 框架 | 位置 | 覆盖目标 |
|------|------|------|----------|
| 单元 | Vitest | `src/__tests__/logger.test.ts` | logger + trace_id ≥ 85% |
| 烟测 | bash + curl | `tests/smoke/curl-test.sh` | X-Trace-Id 响应头 + 格式校验 |

### 5.2 关键测试 (5 case)

```typescript
// src/__tests__/logger.test.ts 计划覆盖:
// 1. traceIdMiddleware: 注入 X-Trace-Id, req.traceId + 响应头都拿到
// 2. traceIdMiddleware: 无 X-Trace-Id, 自动生成 UUID v4 (8-4-4-4-12)
// 3. logger.info() 输出 JSON 含 trace_id / level / time / msg
// 4. logger.error() 含 stack trace + trace_id
// 5. i18n-log: 错误信息走 i18n key, 不含中文字符串
```

### 5.3 覆盖率目标

| 模块 | 当前 | 目标 |
|------|------|------|
| `src/logger/` | 0% (新建) | ≥ 85% |
| 全局 | 81.05% (P11 估 ~82%) | ≥ 83% |

---

## 6. Boundaries (三段式)

### Always (必须遵守)
- ✅ TypeScript strict + noUnusedLocals + noUnusedParameters
- ✅ i18n 走 zh-CN 默认 (CLAUDE.md §i18n + 白盒 spec A10)
- ✅ 每次 task 完成按 CLAUDE.md §9.3 滚动迭代 (task-12 → task-13)
- ✅ 不动 vendor/open-multi-agent/
- ✅ 任何代码改动先 plan → 用户审批 → 才动手
- ✅ 日志格式 JSON 结构化 (pino 默认), 便于 baize-loop 主控聚合
- ✅ trace_id UUID v4, 响应头 X-Trace-Id 透传
- ✅ 日志不持久化 (按 A7), 走 stdout/stderr

### Ask first
- ⚠️ 日志级别默认 info, 是否 dev 模式自动 debug
- ⚠️ 是否加 PII 过滤 (按白盒 spec InFlightCapability.context "不含 PII" 规定)
- ⚠️ pino vs winston 选择 (pino 推荐, 性能更好)

### Never
- ❌ 不动 vendor
- ❌ 不写明文 console.log (除 bench)
- ❌ 不在日志里写 PII
- ❌ 不写中英文硬编码错误信息 (走 i18n)
- ❌ 不跳 plan 文档 task 列表

---

## 7. 实施清单 (按 4 task 拆, ~300 行)

### P12.1 logger 基础 (~120 行, 0.2 周)
- [ ] **T12.1.1** 新建 `src/logger/logger.ts` (~50 行)
  - pino 实例, level = process.env.LOG_LEVEL, base = {slot, version}
- [ ] **T12.1.2** 新建 `src/logger/trace-id.ts` (~40 行)
  - UUID v4 生成 + Express Request 类型扩展 + middleware
- [ ] **T12.1.3** 新建 `src/logger/i18n-log.ts` (~30 行)
  - 错误码 → i18n key + error logger
- [ ] **T12.1.4** 修改 `package.json` 加 pino 依赖
- [ ] **T12.1.5** git commit

### P12.2 集成 (~80 行, 0.3 周)
- [ ] **T12.2.1** 修改 `src/server.ts` 注册 trace_id middleware (~5 行)
- [ ] **T12.2.2** 修改 `src/routes/decompose.ts` (~15 行, 接入 logger)
- [ ] **T12.2.3** 修改 `src/routes/team-schedule.ts` (~15 行)
- [ ] **T12.2.4** 修改 `src/routes/loop-execute.ts` (~20 行, 循环多次)
- [ ] **T12.2.5** 修改 `src/routes/dag-execute.ts` (~20 行, DAG 多次)
- [ ] **T12.2.6** 修改 `src/whitebox/trace-buffer.ts` 接入 logger (~5 行)
- [ ] **T12.2.7** git commit

### P12.3 测试 (~150 行, 0.3 周)
- [ ] **T12.3.1** 新建 `src/__tests__/logger.test.ts` (~150 行, 5 case)
- [ ] **T12.3.2** 修改 `tests/smoke/curl-test.sh` 加 X-Trace-Id 烟测 (~10 行)
- [ ] **T12.3.3** 修改 `vitest.config.ts` 加 src/logger/ (~3 行)
- [ ] **T12.3.4** git commit

### P12.4 收口
- [ ] **T12.4.1** 跑 pnpm lint + pnpm test + pnpm test:smoke + pnpm test:coverage 验证
- [ ] **T12.4.2** git commit + tag baize-oma-v0.4.1 (P12 紧跟 P11 v0.4.0)

### 总计

| Task | 估计代码 | 估计时间 |
|------|----------|----------|
| P12.1 logger 基础 | ~120 行 | 0.2 周 |
| P12.2 集成 | ~80 行 | 0.3 周 |
| P12.3 测试 | ~150 行 + 配置 | 0.3 周 |
| P12.4 收口 | - | 0.1 周 |
| **总计** | **~350 行** | **0.9 周** |

---

## 8. Success Criteria

| # | 条件 | 验证 |
|---|------|------|
| SC-1 | trace_id middleware: 响应头 X-Trace-Id 必返, 格式 UUID v4 | curl -i |
| SC-2 | 无 X-Trace-Id 请求 → 自动生成 UUID | curl -i (无 header) |
| SC-3 | stdout 输出 JSON 结构化日志, 含 trace_id / level / time / msg | node -e '...' |
| SC-4 | 错误日志含 stack trace + i18n key | 触发错误后 grep log |
| SC-5 | 5 routes 都接入 logger, 关键路径 (请求/响应/错误) 有日志 | 单测 + grep |
| SC-6 | P11 whitebox ring buffer 同步接到 logger (一个 push 双写) | 单测 |
| SC-7 | 性能: 日志开销 < 5% P95 latency | bench (P7 基线对比) |
| SC-8 | pnpm lint 0 error | lint |
| SC-9 | pnpm test 49+6+5 全过 | test |
| SC-10 | pnpm test:smoke 16+1+1 全过 | smoke |
| SC-11 | pnpm test:coverage ≥ 83% | coverage |
| SC-12 | vendor 1.9M 不变 | du -sh |
| SC-13 | git tag baize-oma-v0.4.1 | git tag |

---

## 9. 缺口更新 (P12 关闭)

### 关闭的缺口

| 缺口 | 关闭 T12.x |
|------|------------|
| GAP-B 全程日志跟踪 | T12.1-T12.4 全部 |

### 联动 P11

- P11 trace ring buffer 复用 P12 logger (一个 push 双写)
- P11 whitebox inFlight 接入 P12 logger
- P11 lastError 通过 P12 logger 记录

---

## 10. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-25T21:15:00+08:00 | 初版。4 task P12.1-P12.4, ~350 行 0.9 周 |