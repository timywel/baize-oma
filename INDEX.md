# baize-oma 子项目 — INDEX

> 检索入口。所有 baize-oma 相关文档、计划、源码都在此索引。

## 项目结构

- [CLAUDE.md](CLAUDE.md) — 项目总览 + 集成方式
- [README.html](README.html) — 人类版仓说明
- [README.md](README.md) — AI 版仓说明 (3.9KB, 已存在)

## 源码结构

- [src/server.ts](src/server.ts) — Express 入口
- [src/oma-adapter.ts](src/oma-adapter.ts) — OMA 适配器
- [src/oma-client.ts](src/oma-client.ts) — OMA 单例引擎
- [src/routes/](src/routes/) — 5 routes
  - `loop-execute.ts` + `decompose.ts` + `team-schedule.ts` + `manifest.ts` + `health.ts`
- [src/decomposer/](src/decomposer/) — 任务分解器
  - `decomposer.ts` + `types.ts`
- [src/__tests__/](src/__tests__/) — Vitest 单测
  - `routes.test.ts` + `decomposer.test.ts`
- [vendor/open-multi-agent/](vendor/open-multi-agent/) — OMA 1.8.0 vendored
- [patches/](patches/) — patch-package patches

## 计划文档

| 阶段 | 文档 |
|------|------|
| 本仓审计 + 实施总计划 | [plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md](plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md) |
| DAG 集成方案 (专题) | [plan/白泽baize-oma-DAG集成方案-20260623.html](plan/白泽baize-oma-DAG集成方案-20260623.html) / [.md](plan/白泽baize-oma-DAG集成方案-20260623.md) |
| 旧 plan (ARCHIVED) | [plan/已完成/PLAN-MIGRATION-20260622-ARCHIVED.md](plan/已完成/PLAN-MIGRATION-20260622-ARCHIVED.md) |
| 旧 plan (ARCHIVED) | [plan/已完成/PLAN-UPGRADE-20260622-ARCHIVED.md](plan/已完成/PLAN-UPGRADE-20260622-ARCHIVED.md) |

## 测试

- [src/__tests__/](src/__tests__/) — Vitest 单测 (仓内)
- ⚠️ 缺 tests/integration/ (跟 baize-switch 联调)

## 与 baize-loop 集成

| 方向 | 路径 |
|------|------|
| baize-loop 调用 baize-oma | 通过 HttpSlotAdapter 拉 `http://127.0.0.1:20060/health` + `/manifest` |
| baize-chat 触发 chat.agent.schedule | 调 task.decompose + chat.agent.team.schedule |
| baize-oma LLM 请求 | 经 baize-switch-core 20030 |

## 端口

| 端口 | 用途 |
|------|------|
| 20060 | baize-oma HTTP server |

## 版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 0.2.0 | 2026-06-22 | Q5 capability 重命名, 加 DAG 拆解能力 |
| 0.2.1 | 2026-06-23 | Phase 1: 仓根文档补齐 + ARCHIVED 旧 plan |