# update plan-BAIZE-OMA-task-1 — baize-oma Phase 1 仓根脚手架 + 文档补齐

> **PLAN**: [/home/timywel/AI_Product/baize-slot/baize-oma/plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md](../../待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md) (v1.0)
> **Task 配对 JSON**: [update plan-BAIZE-OMA-task-1.json](./update plan-BAIZE-OMA-task-1.json)
> **作者**: BaiZe 架构
> **时间**: 2026-06-24T00:30:00+08:00
> **本轮 scope**: `/home/timywel/AI_Product/baize-slot/baize-oma/` (子项目仓内)
> **会话归属**: 本计划在 baize-oma 子项目仓内推进

---

## 0. 上下文

本计划是 baize-oma 仓首个六段式骨架 (CLAUDE.md §9.1) 的滚动迭代配对文件。Phase 1 (仓根脚手架 + 文档补齐) 已全部完成, 启动 Phase 2 滚动迭代。

**注**: baize-switch 和 baize-chat 正在其他 session 重构, 本计划专注 baize-oma 自身。

---

## 1. 本轮完成 (T1.1~T1.8)

### 1.1 仓根文档补齐
- ✅ T1.1: 新建 `README.html` (人类版仓说明, 2.3KB)
- ✅ T1.2: 新建 `INDEX.md` (仓索引, 2.3KB)
- ✅ T1.3: 新建 `CLAUDE.md` (项目总览, 4.6KB)

### 1.2 ARCHIVED 旧 plan
- ✅ T1.4: `plan/PLAN-MIGRATION-20260622.md` → `plan/已完成/PLAN-MIGRATION-20260622-ARCHIVED.md` + ARCHIVED 头
- ✅ T1.5: `plan/PLAN-UPGRADE-20260622.md` → `plan/已完成/PLAN-UPGRADE-20260622-ARCHIVED.md` + ARCHIVED 头

### 1.3 滚动迭代配对
- ✅ T1.6: 新建 `plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md` (六段式骨架 + 4 阶段 5 周)
- ✅ T1.7: 新建 `plan/进行中/update plan-BAIZE-OMA-task-1.json` (本轮状态追踪)
- ✅ T1.8: 新建 `plan/进行中/update plan-BAIZE-OMA-task-1.md` (本轮总览, 本文件)

---

## 2. 下一轮指引 (Phase 2)

**Phase 2 目标**: 业务逻辑真接 OMA (去 mock)

**核心任务** (从 PLAN §7 Phase 2 拆分):
- T2.1: `src/decomposer/` 真接 `vendor/open-multi-agent/` (去掉 mock)
- T2.2: 新建 `src/llm/client.ts` (调 baize-switch 20030)
- T2.3: `src/routes/decompose.ts` 真调 decomposer
- T2.4: `src/routes/team-schedule.ts` 真调 team-schedule
- T2.5: `src/routes/loop-execute.ts` 真跑循环 (decompose → execute → reflect)
- T2.6: `src/__tests__/decomposer.test.ts` 加真实用例
- T2.7: `src/__tests__/routes.test.ts` 补覆盖率

**估计**: ~1500 行 src + 500 行 test, 2 周

**阻塞**: 无 (仓内独立)

---

## 3. 风险汇总

| 任务 | 风险 | 说明 |
|------|------|------|
| T2.1 | 中 | vendor/open-multi-agent/ 接口可能复杂, 需 audit |
| T2.2 | 低 | 调 baize-switch 20030, 经 baize-loop router |
| T2.3-T2.5 | 低 | 业务代码, 标准 refactor |
| T2.6-T2.7 | 中 | 覆盖率提升, 需真业务用例 |

---

## 4. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-24T00:30:00+08:00 | 初版。Phase 1 全部 completed, 启动 Phase 2 滚动迭代 |