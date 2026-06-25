# PLAN-BAIZE-OMA-PHASE5-20260625-004200 — baize-oma Phase 5 仓内质量提升

> **作者**: BaiZe 架构
> **创建**: 2026-06-25T00:42:00+08:00
> **状态**: pending approval
> **父规范**: [plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md](../../待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md) (v1.1, Phase 1-4 仓内 completed-partial)
>
> **滚动迭代**: 承接 PLAN-BAIZE-OMA-SELF-AUDIT §Phase 5+, 启动新滚动序列 task-5.{md,json}

---

## ASSUMPTIONS（强制, 用户确认前先核对）

- **A1**: Phase 4 仓内部分已 100% 完成 (13 commits + tag baize-oma-v0.2.0), Phase 4 跨仓联调 (T4.1/T4.2/T4.4) 等 baize-chat 重构就绪后启动 (延后, 不在本计划范围)
- **A2**: 当前代码覆盖率 64.15% 全局, dag executor 88%, decomposer 77%, loop-execute 95%. 主要低覆盖区在 `src/routes/dag-execute.ts` (0%, 已有 11 个 dag executor 测试, 但路由层未测)
- **A3**: OMA 上游 `@open-multi-agent/core` 最高版本为 1.8.0 (npm registry, 2026-06-25 查询), 无 1.9.0. vendor 升级演练改为 "1.8.0 重装 + patch reapply" 流程验证
- **A4**: CI 跑三个命令: `pnpm lint` (0 error) + `pnpm test:coverage` (≥ 64%) + `pnpm test:smoke` (≥ 16/16, 需先启 server). 现有命令均已可用
- **A5**: PR 模板 + CONTRIBUTING 跟 baize-loop 主仓风格对齐 (中文优先 + checklist + 验证步骤)
- **A6**: 性能优化 (#6) 独立子项目, 不在本计划范围, 后续开 PLAN-BAIZE-OMA-PERF-*

---

## 1. Objective（做什么 + 为什么）

### 1.1 用户痛点

| 现状 | 问题 |
|------|------|
| 64.15% 覆盖率, 距 80% 阈值差 ~16% | `src/routes/dag-execute.ts` 路由层 0% 覆盖, Phase 4 烟测发现 /manifest 漏洞说明路由层漏测有真实风险 |
| 无 CI, 推 PR 无法自动验证 | lint/test/coverage/smoke 全靠人工跑, 易漏 |
| 无 PR 模板 + CONTRIBUTING | 贡献者不清楚如何描述变更 + 跑哪些验证 |
| vendor 升级路径未演练 | OMA 上游发版时 patch 冲突风险未知 |

### 1.2 成功长什么样（用户视角）

- ✅ `pnpm test:coverage` ≥ 80% 全局
- ✅ `.github/workflows/ci.yml` 跑 lint + test:coverage + test:smoke 三步
- ✅ `.github/PULL_REQUEST_TEMPLATE.md` + `CONTRIBUTING.md` 跟 baize-loop 主仓对齐
- ✅ vendor 重装流程验证: patch 自动 reapply 无误
- ✅ 仓根 npm scripts 加 `test:integration` 占位 (跨仓延后)
- ✅ git tag `baize-oma-v0.3.0`

### 1.3 关键链路

P5 不涉及跨仓链路修改, 全部仓内:
- 仓内单测 → coverage 报告 → CI 跑
- vendor/ → patch-package → 重装验证
- GitHub PR 流程 → 模板 + CI 自动检查

---

## 2. Commands（可执行命令, 不是工具名）

```bash
# 进入 baize-oma 仓根
cd /home/timywel/AI_Product/baize-slot/baize-oma/

# 安装依赖
pnpm install

# 类型检查
pnpm lint

# 单元测试 + coverage
pnpm test
pnpm test:coverage

# 烟测 (需先启 server)
pnpm dev &
sleep 5
pnpm test:smoke

# Vendor 升级演练
npm install @open-multi-agent/core@1.8.0 --force
# → postinstall 自动重打 patch (如冲突会报错)
git status patches/
git diff vendor/  # 应为空 (patch 已覆盖 vendor 修改)

# CI 本地模拟
pnpm lint && pnpm test:coverage && pnpm dev & sleep 5 && pnpm test:smoke
```

---

## 3. Project Structure（本计划改/新增的路径）

### 3.1 baize-oma 仓内

| 路径 | 操作 | 说明 |
|------|------|------|
| `src/__tests__/dag-routes.test.ts` | **新建** | 补 /dag.execute + /dag.visualize 路由层单测 (5 case) |
| `.github/workflows/ci.yml` | **新建** | GitHub Actions: lint + test:coverage + test:smoke |
| `.github/PULL_REQUEST_TEMPLATE.md` | **新建** | PR 模板 (中文 + checklist) |
| `CONTRIBUTING.md` | **新建** | 贡献指南 (验证步骤 + commit 规范) |
| `package.json` | **更新** | scripts 加 `test:integration` 占位 (跨仓延后) |
| `vendor/open-multi-agent/` | **演练重装** | 1.8.0 重装 + patch reapply 验证 |
| `plan/待完成/PLAN-BAIZE-OMA-PHASE5-20260625-004200.md` | **新建** (本文件) |
| `plan/进行中/update plan-BAIZE-OMA-task-5.{md,json}` | **新建** (滚动迭代配对) |

### 3.2 跨仓依赖（不动）

- baize-loop 主仓: 风格对齐参考 (CLAUDE.md / CONTRIBUTING.md / workflows)
- baize-switch / baize-chat: 不涉及

---

## 4. Code Style（沿用 baize-oma 仓既有风格）

```typescript
// src/__tests__/dag-routes.test.ts 风格 (沿用 dag.test.ts + routes.test.ts)
import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import dagExecuteRouter from "../routes/dag-execute.js";

describe("DAG routes — 路由层", () => {
  let app: express.Express;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(dagExecuteRouter);
  });

  it("POST /dag.execute 校验缺 dag → 400 INVALID_REQUEST", async () => {
    const resp = await fetch("http://localhost/_test/dag.execute", {
      method: "POST",  // ...
    });
    expect(resp.status).toBe(400);
  });
});
```

**命名/格式约定** (沿用既有):
- TypeScript 5.x + strict
- `camelCase` 变量/函数, `PascalCase` 类型, `kebab-case` 文件名
- 测试文件 `*.test.ts` 放 `src/__tests__/`
- describe/it 中文描述
- commit message: `<type>(<scope>): <subject>`, 中文可选

---

## 5. Testing Strategy

### 5.1 测试层级

| 层级 | 框架 | 位置 | 覆盖目标 |
|------|------|------|----------|
| 单元 | Vitest | `src/__tests__/` | routes + decomposer + dag ≥ 80% |
| 烟测 | bash + curl | `tests/smoke/` | 7 routes + 校验用例 |
| CI | GitHub Actions | `.github/workflows/` | lint + test + smoke 三步 |

### 5.2 关键测试

```typescript
// src/__tests__/dag-routes.test.ts 计划覆盖 (5 case):
// 1. POST /dag.execute 校验缺 dag → 400 INVALID_REQUEST
// 2. POST /dag.execute 循环依赖 → 400 CYCLE_DETECTED (已有, 移过来)
// 3. POST /dag.execute 正常执行 → 200 (mock executor)
// 4. POST /dag.visualize 校验缺 dag → 400
// 5. POST /dag.visualize 正常 → 200 (返 ascii + mermaid)
```

### 5.3 覆盖率目标

| 模块 | 当前 | 目标 | 增量 |
|------|------|------|------|
| `src/routes/dag-execute.ts` | 0% | ≥ 90% | +90% (新 5 case) |
| `src/routes/health.ts` | 0% | ≥ 80% | +80% (新 1 case) |
| `src/routes/manifest.ts` | 0% | ≥ 80% | +80% (新 1 case) |
| 全局 | 64.15% | ≥ 75% | +11% (路由层 0% → 90%) |

注: src/llm/client.ts (网络) 和 src/server.ts (启动) 仍 exclude, 不计入覆盖率目标.

---

## 6. Boundaries（三段式）

### Always（必须遵守）
- ✅ TypeScript strict + noUnusedLocals + noUnusedParameters
- ✅ i18n 走 zh-CN 默认 (CLAUDE.md §i18n)
- ✅ 每次 task 完成按 CLAUDE.md §9.3 滚动迭代 (task-5 → task-6)
- ✅ vendor 通过 patch-package 升级, 不直接改 vendor
- ✅ 任何代码改动先 plan → 用户审批 → 才动手
- ✅ CI workflow 不依赖外部服务 (baize-switch / baize-chat), 仓内自洽
- ✅ PR 模板 + CONTRIBUTING 跟 baize-loop 主仓风格对齐

### Ask first
- ⚠️ CI 是否启用 cache (pnpm-store)
- ⚠️ CI 是否跑 matrix (Node 18 vs 22)
- ⚠️ CONTRIBUTING 是否包含 Code of Conduct 段
- ⚠️ vendor 升级演练是否真删 vendor/ 重装 (破坏性, 演练完需还原)

### Never
- ❌ 不直接改 vendor/open-multi-agent/ 内部源码 (走 patch-package)
- ❌ 不跳过 plan 文档 task 列表
- ❌ 不直接修改代码文件, 必须先 plan 文档更新
- ❌ CI 不跑跨仓联调 (test:integration 占位但 skip)
- ❌ vendor 升级演练不提交演练 commit (验证后还原 working tree)

---

## 7. 实施清单（按 5 个 task 拆, ~600 行）

### P5.1: 仓根文档 + 治理（~150 行, 0.2 周）
- [ ] **T5.1.1** 新建 `.github/PULL_REQUEST_TEMPLATE.md` (~40 行, 中文 checklist)
- [ ] **T5.1.2** 新建 `CONTRIBUTING.md` (~80 行, 验证步骤 + commit 规范 + Code of Conduct 引用)
- [ ] **T5.1.3** git commit (P5.1 文档)

### P5.2: CI workflow（~80 行, 0.2 周）
- [ ] **T5.2.1** 新建 `.github/workflows/ci.yml` (~60 行, lint + test:coverage + test:smoke)
- [ ] **T5.2.2** `package.json` scripts 加 `test:integration` 占位 (跨仓延后, skip)
- [ ] **T5.2.3** git commit (P5.2 CI)

### P5.3: 覆盖率提升（~250 行, 0.5 周）
- [ ] **T5.3.1** 新建 `src/__tests__/dag-routes.test.ts` 路由层单测 (5 case, ~200 行)
- [ ] **T5.3.2** 新建 `src/__tests__/health-routes.test.ts` (1 case, ~30 行)
- [ ] **T5.3.3** 新建 `src/__tests__/manifest-routes.test.ts` (1 case, ~30 行)
- [ ] **T5.3.4** 跑 `pnpm test:coverage` 验证 ≥ 75% 全局
- [ ] **T5.3.5** git commit (P5.3 覆盖率)

### P5.4: vendor 升级演练（~50 行 plan 文档, 0.1 周）
- [ ] **T5.4.1** 演练 `npm install @open-multi-agent/core@1.8.0 --force` (重装)
- [ ] **T5.4.2** 验证 patch 自动 reapply 无冲突
- [ ] **T5.4.3** 验证 `pnpm test` + `pnpm lint` 全过 (vendor 修改被 patch 覆盖)
- [ ] **T5.4.4** git checkout vendor/ (演练不提交, 还原 working tree)
- [ ] **T5.4.5** plan 文档记录演练结果

### P5.5: 收口（0.1 周）
- [ ] **T5.5.1** git tag `baize-oma-v0.3.0`
- [ ] **T5.5.2** update plan-BAIZE-OMA-task-5.{md,json} status → completed
- [ ] **T5.5.3** 主计划 v1.2 更新 P5 收口

### 总计

| Task | 估计代码 | 估计时间 |
|------|----------|----------|
| P5.1 文档 + 治理 | ~150 行 | 0.2 周 |
| P5.2 CI | ~80 行 | 0.2 周 |
| P5.3 覆盖率 | ~250 行 | 0.5 周 |
| P5.4 vendor 演练 | ~50 行 plan | 0.1 周 |
| P5.5 收口 | - | 0.1 周 |
| **总计** | **~530 行** | **1.1 周** |

---

## 8. Success Criteria

| # | 条件 | 验证 |
|---|------|------|
| SC-1 | `pnpm test:coverage` ≥ 75% 全局 | coverage 输出 ≥ 75% |
| SC-2 | `.github/workflows/ci.yml` 跑 lint + test:coverage + test:smoke | workflow YAML 语法 + act 本地模拟 |
| SC-3 | PR 模板 + CONTRIBUTING 创建, 风格对齐 baize-loop | grep 风格一致性 |
| SC-4 | vendor 重装流程验证无冲突 | `npm install --force` 0 error + patch reapply OK |
| SC-5 | git tag `baize-oma-v0.3.0` | git tag -l |
| SC-6 | 主计划 v1.2 更新 P5 收口 | plan 文档勾选 |

---

## 9. 缺口清单（更新后）

### 🔴 致命（剩余 3 项）

- GAP-1: `vendor/open-multi-agent/` 升级演练 — ⚠️ P5.4 演练, 但 OMA 1.9.0 未发布, 仅做"重装 1.8.0"流程
- GAP-3: 缺独立运行验证脚本 — ⚠️ 烟测已写 (P4 T4.3), 但未集成 CI, P5.2 修复
- GAP-4: 与 baize-switch 真实联调未做 — ⏸️ 跨仓延后

### 🟡 重要（剩余 3 项）

- GAP-6: `dist/` 提交但 CI 未验证 — P5.2 加 CI 后验证
- GAP-8: 无 .github/workflows CI — ✅ P5.2 修复
- GAP-9: 无 PR 模板 + CONTRIBUTING.md — ✅ P5.1 修复

---

## 10. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-25T00:42:00+08:00 | 初版。5 个 task, ~530 行 1.1 周 |
