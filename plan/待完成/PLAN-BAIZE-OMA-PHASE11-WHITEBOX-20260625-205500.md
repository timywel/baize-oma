# PLAN-BAIZE-OMA-PHASE11-WHITEBOX-20260625-205500 — baize-oma 白盒显现 (P11)

> **作者**: BaiZe 架构
> **创建**: 2026-06-25T20:55:00+08:00
> **状态**: pending approval
> **父规范**: 
> - baize-loop `plan/refactor/slots-and-libs/8-slot-whitebox-observability-spec.md` (主参考, 10 条 ASSUMPTIONS)
> - baize-loop `plan/refactor/slots-and-libs/slot-integration-unified-spec.md` §2.2 (slot 模式选择)
> - baize-oma `plan/refactor/集成报告/baize-oma-v0.3.5-集成报告-20260625.md` §8.2 (后续方向)
>
> **滚动迭代**: 承接 baize-oma v0.3.5 (P10 收口), 启动新滚动序列 task-11.{md,json}

---

## ASSUMPTIONS（强制, 用户确认前先核对）

- **A1**: baize-oma 是 **外部 http slot** (Express, port 20060), 按 8-slot-whitebox-observability-spec.md A2 规定必须实现 `GET /whitebox` 端点
- **A2**: baize-oma 包装 **vendored OMA 1.8.0** (1.9M), 按 A3 "不改 vendored 源码" 规定, 白盒端点是 baize-oma 自己的包装层, 不侵入 vendor
- **A3**: baize-loop 主仓 `meta/slot-api/whitebox-types.ts` 当前**不存在** (按白盒 spec §2.1.2 是 "新建"), baize-oma 需要自己定义 WhiteboxSnapshot schema, 跟 spec 对齐
- **A4**: trace ring buffer N=20, 每条 ~1KB (按 A5), 内存占用 20KB/slot, 可接受
- **A5**: 性能约束 GET /whitebox < 100ms P95 (按 A9), 不阻塞主流程 (按 A8)
- **A6**: 错误信息 i18n 走 key (按 A10), 不硬编码中文/英文 (CLAUDE.md i18n 强制)
- **A7**: baize-loop 主控 slot-registry 单点访问, baize-oma 白盒端点**不暴露**给浏览器 (按 A7), 仅 localhost 限制或主控鉴权
- **A8**: baize-chat 5 widget (AgentTeamStatus / LiveToolCall / ThinkStream / TokenCost / MultiSlotPanel) **需要订阅**多 slot 流, baize-oma 白盒是其中之一 (按白盒 spec §1.1 §1.2)

---

## 1. Objective (做什么 + 为什么)

### 1.1 用户痛点

按白盒规范, baize-oma 应该让主控 + 用户**一眼看清**:

| 当前黑盒 | 想要的可见性 |
|---------|-------------|
| "Hello there friend" 是怎么算出来的? | 看 trace 流: decompose → OMA.runTeam → switch /v1/messages → minimax → response |
| 哪个 sub-agent 在跑 / 跑什么? | inFlight: [{capability: "chat.agent.team.schedule", progress: 0.5, ...}] |
| 失败时为什么失败? | lastError: {code: "DECOMPOSE_FAILED", message: "...", trace_id: "abc123"} |
| OMA 上游 vendor 健康? | upstream: {vendor: "open-multi-agent", version: "1.8.0", endpoint: "vendor/open-multi-agent", healthy: true} |
| baize-switch 上游健康? | upstream.healthy: false (A8 失败降级) |

**当前 baize-oma 完全没有这些** → 调试只能 pnpm dev 看 console.log, 不能跨 slot 追踪.

### 1.2 成功长什么样 (用户视角)

```
$ curl http://127.0.0.1:20060/whitebox | jq
{
  "slotId": "baize-oma",
  "slotVersion": "0.3.5",
  "capturedAt": "2026-06-25T20:30:00+08:00",
  "state": "active",
  "inFlight": [
    {
      "capability": "chat.loop.execute",
      "startedAt": "2026-06-25T20:29:55.000Z",
      "progress": 0.67,
      "context": {"iterations": 2, "currentTask": "decompose"}
    }
  ],
  "lastError": null,
  "trace": [
    {"ts": "...", "level": "info", "msg": "received POST /chat.loop.execute", "trace_id": "abc123"},
    {"ts": "...", "level": "info", "msg": "decompose → 1 node", "trace_id": "abc123"},
    ...
  ],
  "upstream": {
    "vendor": "open-multi-agent",
    "version": "1.8.0",
    "endpoint": "vendor/open-multi-agent",
    "healthy": true
  },
  "internals": {
    "uptime": 3600,
    "totalRequests": 1234,
    "avgLatencyMs": 2450
  }
}
```

### 1.3 关键链路

```
baize-loop 主控 slot-registry ──HTTP──> baize-oma /whitebox (20060)
                                          │
                                          ├─ trace ring buffer (最近 20 条)
                                          ├─ inFlight tracker (正在执行的 capability)
                                          ├─ lastError 单例
                                          └─ upstream vendor 状态 (OMA 1.8.0)

baize-chat 5 widget (AgentTeamStatus / LiveToolCall / ThinkStream / TokenCost / MultiSlotPanel)
  ↑
  └─ 订阅主控聚合的 8 slot WhiteboxSnapshot 流
```

---

## 2. Commands (可执行命令, 不是工具名)

```bash
# 仓根
cd /home/timywel/AI_Product/baize-slot/baize-oma/

# 开发 (现有 P11 之前已 OK)
pnpm dev

# 新增白盒验证
curl http://127.0.0.1:20060/whitebox | jq
curl http://127.0.0.1:20060/whitebox/upstream | jq  # 仅 vendor 状态
curl http://127.0.0.1:20060/whitebox/trace | jq    # 仅 trace 流

# 单元测试
pnpm test                                    # 现有 + 新白盒测试
pnpm test:coverage                           # 验证覆盖率 ≥ 80%

# 烟测 (新加白盒检查项)
pnpm dev & sleep 5 && pnpm test:smoke        # 现有 16 + 新 1-2 检查

# 类型检查 + 构建
pnpm lint
pnpm build
```

---

## 3. Project Structure (本计划改/新增的路径)

### 3.1 baize-oma 仓内

| 路径 | 操作 | 说明 |
|------|------|------|
| `src/whitebox/types.ts` | **新建** | WhiteboxSnapshot / InFlightCapability / LastError / TraceEvent / WhiteboxUpstream 类型定义 (~120 行) |
| `src/whitebox/snapshot.ts` | **新建** | WhiteboxSnapshotBuilder 类, 聚合各状态 (~80 行) |
| `src/whitebox/trace-buffer.ts` | **新建** | TraceRingBuffer 类 (N=20, FIFO) (~60 行) |
| `src/whitebox/inflight-tracker.ts` | **新建** | InFlightTracker 类 (按 capability 跟踪) (~80 行) |
| `src/whitebox/upstream.ts` | **新建** | 上游 vendor 状态检测 (~50 行) |
| `src/routes/whitebox.ts` | **新建** | GET /whitebox + GET /whitebox/upstream + GET /whitebox/trace 路由 (~80 行) |
| `src/server.ts` | **修改** | 注册 whiteboxRouter (~3 行) |
| `src/routes/decompose.ts` | **修改** | 集成 inFlight + trace (~10 行) |
| `src/routes/team-schedule.ts` | **修改** | 同上 |
| `src/routes/loop-execute.ts` | **修改** | 同上 |
| `src/routes/dag-execute.ts` | **修改** | 同上 |
| `src/__tests__/whitebox.test.ts` | **新建** | 白盒端点 + TraceRingBuffer + InFlightTracker 单测 (~200 行, ~6 case) |
| `tests/smoke/curl-test.sh` | **修改** | 加 /whitebox 烟测 (~10 行) |
| `src/whitebox/i18n.ts` | **新建** | 错误码 → i18n key 映射 (~30 行, 跟 P5 i18n 对齐) |

### 3.2 跨仓依赖 (不动)

- baize-loop 主仓 `meta/slot-api/whitebox-types.ts` 仍待建 (白盒 spec §2.1.2 标注 "新建")
- baize-oma 自己定义 schema, 跟 spec 对齐, 后续主仓建好后同步

### 3.3 计划文档

| 路径 | 操作 |
|------|------|
| `plan/待完成/PLAN-BAIZE-OMA-PHASE11-WHITEBOX-20260625-205500.md` | **新建** (本文件) |
| `plan/进行中/update plan-BAIZE-OMA-task-11.{md,json}` | **新建** (滚动迭代配对) |

---

## 4. Code Style (沿用 baize-oma 仓既有风格)

```typescript
// src/whitebox/trace-buffer.ts 风格
export class TraceRingBuffer {
  private buffer: TraceEvent[] = [];
  private readonly maxSize = 20; // A5

  push(event: TraceEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  snapshot(): readonly TraceEvent[] {
    return [...this.buffer];
  }
}

// src/routes/whitebox.ts 风格
import { Router, type Router as ExpressRouter } from "express";
import { whiteboxSnapshot } from "../whitebox/snapshot.js";

const router: ExpressRouter = Router();

router.get("/whitebox", (_req, res) => {
  res.json(whiteboxSnapshot.build());
});

export default router;
```

**命名/格式约定** (沿用既有):
- TypeScript 5.x + strict
- `camelCase` 变量/函数, `PascalCase` 类型, `kebab-case` 文件名
- 错误处理 `try/catch` + 标准 HTTP code, 不 panic
- 所有路由返回 `{ status, body: {...} }` 或 `{ status, error: {...} }` 格式

---

## 5. Testing Strategy

### 5.1 测试层级

| 层级 | 框架 | 位置 | 覆盖目标 |
|------|------|------|----------|
| 单元 | Vitest | `src/__tests__/whitebox.test.ts` | 白盒所有组件 ≥ 85% |
| 烟测 | bash + curl | `tests/smoke/curl-test.sh` | /whitebox 200 + 字段校验 |

### 5.2 关键测试 (6 case)

```typescript
// src/__tests__/whitebox.test.ts 计划覆盖:
// 1. GET /whitebox → 200, 字段齐全 (slotId/version/state/inFlight/lastError/trace/upstream/internals)
// 2. GET /whitebox/upstream → 200, vendor 字段 (vendor/version/endpoint/healthy)
// 3. TraceRingBuffer: push 25 条, snapshot 只返最近 20 条 (FIFO)
// 4. InFlightTracker: start(taskA) → inFlight 含 taskA → end(taskA) → inFlight 空
// 5. lastError: 触发 1 次错误 → snapshot.lastError 非空, 含 code/message/trace_id
// 6. i18n: errorResp 的 message 走 i18n key, 不含中文字符串
```

### 5.3 覆盖率目标

| 模块 | 当前 | 目标 |
|------|------|------|
| `src/whitebox/` | 0% (新建) | ≥ 85% |
| `src/routes/whitebox.ts` | 0% (新建) | ≥ 90% |
| 全局 | 81.05% | ≥ 82% (白盒新增 ~700 行, 比例稍降) |

---

## 6. Boundaries (三段式)

### Always (必须遵守)
- ✅ TypeScript strict + noUnusedLocals + noUnusedParameters
- ✅ i18n 走 zh-CN 默认 (CLAUDE.md §i18n + 白盒 spec A10)
- ✅ 每次 task 完成按 CLAUDE.md §9.3 滚动迭代 (task-11 → task-12)
- ✅ 不动 vendor/open-multi-agent/ (走 patch-package)
- ✅ 任何代码改动先 plan → 用户审批 → 才动手
- ✅ 白盒端点**不暴露**给浏览器 (仅 localhost 限制, 配 CORS, 按白盒 spec A7)
- ✅ WhiteboxSnapshot 必须填 slotId/slotVersion/capturedAt/state (A4 必填)
- ✅ trace ring buffer N=20, 每条 ~1KB (A5)
- ✅ 性能 GET /whitebox < 100ms P95 (A9)

### Ask first
- ⚠️ 白盒 schema 是 baize-oma 自己定义还是等 baize-loop 主仓先建 (推荐先自己定义 + 后续对齐)
- ⚠️ /whitebox 端点是否仅暴露 localhost, 还是需要鉴权 token
- ⚠️ trace_event 是否持久化到文件 (白盒 spec A6 说"不持久化", 但调试可能需要)

### Never
- ❌ 不动 vendor 内部源码
- ❌ 不暴露浏览器 (CORS 严格)
- ❌ 不写中英文硬编码错误信息 (走 i18n)
- ❌ 不跳 plan 文档 task 列表
- ❌ 不直接修改代码文件 (必须先 plan 文档更新)

---

## 7. 实施清单 (按 5 task 拆, ~700 行)

### P11.1 类型 + TraceRingBuffer (基础组件, ~250 行, 0.3 周)
- [ ] **T11.1.1** 新建 `src/whitebox/types.ts` (~120 行)
  - WhiteboxSnapshot, InFlightCapability, LastError, TraceEvent, WhiteboxUpstream
  - BaizeWhiteboxSnapshot (扩展, 加 internals 字段)
- [ ] **T11.1.2** 新建 `src/whitebox/trace-buffer.ts` (~60 行)
  - TraceRingBuffer 类, N=20, push/snapshot/clear
- [ ] **T11.1.3** 新建 `src/whitebox/i18n.ts` (~30 行)
  - 错误码 → i18n key 映射, 跟 P5 i18n 对齐
- [ ] **T11.1.4** git commit (类型 + 基础组件)

### P11.2 跟踪器 (InFlight + LastError + Upstream, ~210 行, 0.3 周)
- [ ] **T11.2.1** 新建 `src/whitebox/inflight-tracker.ts` (~80 行)
  - InFlightTracker 类, start(capability, context) / end(capability)
  - 支持并发 (Map<capability, InFlightCapability>)
- [ ] **T11.2.2** 新建 `src/whitebox/upstream.ts` (~50 行)
  - UpstreamStatus 类, 检测 vendor (filesystem 探测 vendor/open-multi-agent/package.json)
- [ ] **T11.2.3** 新建 `src/whitebox/snapshot.ts` (~80 行)
  - WhiteboxSnapshotBuilder.build() 聚合所有组件
- [ ] **T11.2.4** git commit (跟踪器)

### P11.3 路由层 (3 端点, ~80 行, 0.2 周)
- [ ] **T11.3.1** 新建 `src/routes/whitebox.ts` (~80 行)
  - GET /whitebox → full snapshot
  - GET /whitebox/upstream → 仅 upstream
  - GET /whitebox/trace → 仅 trace (N=20)
- [ ] **T11.3.2** 修改 `src/server.ts` 注册 whiteboxRouter (~3 行)
- [ ] **T11.3.3** git commit (路由)

### P11.4 路由层集成 (5 routes 接入 trace, ~50 行, 0.3 周)
- [ ] **T11.4.1** 修改 `src/routes/decompose.ts` (~10 行)
  - 添加 trace.push + inFlight.start/end 调用
- [ ] **T11.4.2** 修改 `src/routes/team-schedule.ts` (~10 行)
- [ ] **T11.4.3** 修改 `src/routes/loop-execute.ts` (~15 行, 循环多次)
- [ ] **T11.4.4** 修改 `src/routes/dag-execute.ts` (~15 行, DAG 多次)
- [ ] **T11.4.5** git commit (路由集成)

### P11.5 测试 + 烟测 + 收口 (~150 行 + 文档, 0.4 周)
- [ ] **T11.5.1** 新建 `src/__tests__/whitebox.test.ts` (~200 行, 6 case)
- [ ] **T11.5.2** 修改 `tests/smoke/curl-test.sh` 加 /whitebox 烟测 (~10 行)
- [ ] **T11.5.3** 跑 `pnpm lint` + `pnpm test` + `pnpm test:smoke` + `pnpm test:coverage` 验证
- [ ] **T11.5.4** git commit + tag baize-oma-v0.4.0

### 总计

| Task | 估计代码 | 估计时间 |
|------|----------|----------|
| P11.1 类型 + 基础组件 | ~250 行 | 0.3 周 |
| P11.2 跟踪器 | ~210 行 | 0.3 周 |
| P11.3 路由层 | ~80 行 | 0.2 周 |
| P11.4 路由集成 | ~50 行 | 0.3 周 |
| P11.5 测试 + 收口 | ~150 行 + 文档 | 0.4 周 |
| **总计** | **~740 行** | **1.5 周** |

---

## 8. Success Criteria

| # | 条件 | 验证 |
|---|------|------|
| SC-1 | GET /whitebox 200, schema 含 8 必填字段 (slotId/version/capturedAt/state/inFlight/lastError/trace/upstream/internals) | curl + jq |
| SC-2 | trace ring buffer N=20 (push 25 条, snapshot 只返 20 条) | 单测 |
| SC-3 | inFlight 跟踪: start/end 后 inFlight 数组同步 | 单测 |
| SC-4 | lastError 单例: 触发错误后 next snapshot 含 lastError, 含 trace_id | 单测 |
| SC-5 | i18n: 所有 errorResp message 走 i18n key, 不含中文硬编码 | grep |
| SC-6 | 性能 GET /whitebox < 100ms P95 | bench |
| SC-7 | 烟测 16+ 全过 (含 /whitebox 检查) | pnpm test:smoke |
| SC-8 | 单测 49+6 全过, coverage ≥ 82% | pnpm test:coverage |
| SC-9 | vendor 不变 (1.9M 完整) | du -sh |
| SC-10 | git tag baize-oma-v0.4.0 | git tag -l |

---

## 9. 缺口更新 (P11 关闭)

### 关闭的缺口

| 缺口 | 关闭 T11.x |
|------|------------|
| GAP-A 白盒显现 (8 slot 统一规范) | T11.1-T11.5 全部 |

### 新增的缺口

| 缺口 | 说明 |
|------|------|
| GAP-B 全程日志跟踪 (P12 范围) | trace_id / logger / 跨 slot 追踪 |

---

## 10. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-25T20:55:00+08:00 | 初版。5 task P11.1-P11.5, ~740 行 1.5 周 |