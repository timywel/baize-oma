# [ARCHIVED 2026-06-23] PLAN-BAIZE-OMA-MIGRATION — baize-oma 迁移 plan

> **⚠️ 状态**: ARCHIVED (2026-06-23)
>
> **作废理由**: 迁移已完成 (仓从 `baize-loop/packages/` 迁出独立), 本计划已实施完毕
>
> **替代方案**: [plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md](../../待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md) §Phase 1-4 (4 阶段 5 周)

---

# PLAN-BAIZE-OMA-MIGRATION — baize-oma 迁移 plan

> **父规范**: `baize-loop/plan/baize-chat/17-full-specification.md` §11  
> **作者**: BaiZe 架构  
> **创建时间**: 2026-06-22  
> **状态**: pending approval

---

## ASSUMPTIONS

- A1: OMA 是外部库 (`open-multi-agent`), 源码不修改, 只包装 adapter
- A2: Adapter 只做协议转换: SlotRequest → OMA 入参, OMA 出参 → SlotResponse

---

## 1. Objective

将 OMA 从 `baize-loop/packages/open-multi-agent/` 包装为 baize-oma slot,
不修改 OMA 源码, 通过 adapter 挂载到 baize-loop。

---

## 2. 迁移清单

| 来源 | 目标 | 改造量 |
|------|------|--------|
| `baize-loop/packages/open-multi-agent/` | `baize-slot/baize-oma/` (作为 npm 依赖) | slot.json + adapter.ts ~50 行 |

---

## 3. Task 清单

### Task 1: 包装 slot
- [x] T1.1 `slot.json` 已创建 (type: process)
- [ ] T1.2 创建 `src/adapter.ts` — 实现 BaizeSlot 接口, 转发给 OMA
- [ ] T1.3 创建 `package.json` — 依赖 `open-multi-agent`
- [ ] T1.4 写 adapter 单测

### Task 2: 集成验证
- [ ] T2.1 baize-chat 通过 slot API 调 baize-oma
- [ ] T2.2 OMA 的 Agent Team 调度结果正确回流到 chat

---

## 4. Adapter 骨架

```typescript
import { BaizeSlot, SlotContext, SlotRequest, SlotResponse } from "baize-loop/meta/slot-api";
import { OMAMultiAgent } from "open-multi-agent";

export class BaizeOMASlot implements BaizeSlot {
  readonly id = "baize-oma";
  readonly version = "0.1.0";
  readonly capabilities = ["chat.agent.schedule"] as const;
  private engine: typeof OMAMultiAgent | null = null;

  async load(ctx: SlotContext) { /* 验证 OMA 包可用 */ }
  async init() { this.engine = new OMAMultiAgent(); }
  async handle(req: SlotRequest): Promise<SlotResponse> { /* 转发 */ }
  async unload() { this.engine = null; }
  async health() { return this.engine ? "healthy" : "unhealthy"; }
}
```

---

## 5. 验证标准

- [ ] adapter 单测通过
- [ ] OMA 多 Agent 调度端到端可用
- [ ] OMA 源码未被修改

---

## 6. 排期

**Phase 3 (Iteration 5)** — 与 baize-switch 接入同轮推进
