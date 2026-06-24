# PLAN-BAIZE-OMA-SELF-AUDIT — baize-oma 仓自身审计 + 实施总计划

> **作者**: BaiZe 架构
> **创建**: 2026-06-23
> **状态**: pending approval
> **父规范**:
> - `baize-loop/plan/refactor/slots-and-libs/G-phase3-oma-dspy-harness.md` (Phase 3 oma-dspy 集成)
> - `baize-loop/plan/baize-chat/17-full-specification.md` (顶层规范)
>
> **设计参考**:
> - `baize-slot/baize-chat/` 仓结构 (仓根 npm 包 + 子目录按职责领域)
> - `baize-slot/baize-switch/plan/待完成/PLAN-BAIZE-SWITCH-SELF-AUDIT-20260623-000000.md` (审计模板)
>
> **滚动迭代**: 本计划是 baize-oma 仓首个六段式骨架, 启动新滚动序列

---

## ASSUMPTIONS（强制, 用户确认前先核对）

- **A1**: baize-oma 是 **http slot** (Express 进程, 端口待定, 走 baize-loop 主控)
- **A2**: 现有仓根 = npm 包 `baize-oma` (0.1.0), slot.json 0.2.0, 仓结构已成型
- **A3**: OMA 引擎 `vendor/open-multi-agent/` 是 vendored 副本 (OMA 1.8.0), 通过 patch-package 流程同步上游
- **A4**: 5 routes 已实现入口 (loop-execute / decompose / team-schedule / manifest / health), 部分业务是 stub
- **A5**: 现有 `plan/PLAN-MIGRATION-20260622.md` 已过期 (迁移已完成), **不再引用**
- **A6**: 与 baize-switch (LLM 路由) 真实联调未做 (chat → oma → switch 链路未跑通)
- **A7**: 与 baize-loop 主仓通过 HttpSlotAdapter 接入, 集成方式待 baize-loop 侧确认

---

## 0. 与既有计划的差异

| 既有计划 | 状态 | 本计划处理 |
|---------|------|-----------|
| `plan/PLAN-MIGRATION-20260622.md` | 已过期 | 归档到 `plan/已完成/`, 加 ARCHIVED 头 |
| `plan/PLAN-UPGRADE-20260622.md` | pending approval | **吸收**为本计划 §3 Phase 2 |
| `plan/白泽baize-oma-DAG集成方案-20260623.md` + `.html` | 专题方案 | **吸收**为本计划 §3 Phase 3 (DAG 集成) |
| `plan/PATCH-1.md` (如有) | pending | 整合到 Phase 1 |

---

## 1. Objective（做什么 + 为什么）

### 1.1 用户痛点

| 现状 | 问题 |
|------|------|
| 5 routes 已实现入口, 但**业务逻辑未真接 OMA** (decomposer.ts 测试可能 mock) | 真实 LLM 调用未验证 |
| `vendor/open-multi-agent/` 体积大, 升级演练缺失 | OMA 上游版本同步风险 |
| `__tests__/` 单测覆盖率未量化 | 无 coverage 门禁 |
| 与 baize-switch (LLM 路由) 未联调 | chat → oma → switch 链路不通 |
| `dist/` 未提交 | build 流程未在 CI 验证 |
| **缺仓根 README.html + INDEX.md** | 与 baize-chat / baize-switch 仓结构不对称 |

### 1.2 成功长什么样 (用户视角)

- ✅ `curl http://127.0.0.1:20040/health` 返 `{"status":"healthy"}` (端口待与 baize-loop 侧确认)
- ✅ `POST /decompose` 真分解任务到 DAG (经 baize-switch 调 LLM)
- ✅ `POST /team-schedule` 真调度 Agent Team (3 sub-agent: 剧情/对白/场景)
- ✅ `POST /loop-execute` 真跑循环 (decompose → execute → reflect)
- ✅ 与 baize-switch-core (20030) 联调通: OMA 走 LLM 请求
- ✅ 与 baize-chat 联调通: chat 触发 oma, oma 返回流式响应
- ✅ 仓根 README.html + INDEX.md + 计划文档完整

### 1.3 关键链路 (3 链路数据流)

1. **baize-chat → baize-oma**: chat 触发 `chat.agent.schedule` capability → oma 接收 → 调度 Agent Team
2. **baize-oma → baize-switch**: oma LLM 请求 → switch (20030) → Anthropic API
3. **baize-oma → baize-loop**: 主控 HttpSlotAdapter 拉 `/health` + `/manifest`

---

## 2. Commands（可执行命令, 不是工具名）

```bash
# 进入 baize-oma 仓根
cd /home/timywel/AI_Product/baize-slot/baize-oma/

# 安装依赖 (含 patch-package)
pnpm install

# 测试
pnpm test
pnpm test:coverage

# 类型检查
pnpm typecheck

# 构建
pnpm build

# 运行
pnpm start
# 或
node dist/server.js

# 烟测
curl -s http://localhost:20040/health
curl -s http://localhost:20040/manifest
curl -s -X POST http://localhost:20040/decompose \
  -H "content-type: application/json" \
  -d '{"task":"写个科幻剧本大纲"}'
```

---

## 3. Project Structure（本计划改/新增的路径）

### 3.1 baize-oma 仓内（核心改造）

| 路径 | 操作 | 说明 |
|------|------|------|
| `plan/PLAN-MIGRATION-20260622.md` | **移到已完成 + ARCHIVED 头** | 迁移已完成 |
| `plan/PLAN-UPGRADE-20260622.md` | **移到已完成 + ARCHIVED 头** | 已升级到本计划 |
| `plan/白泽baize-oma-DAG集成方案-20260623.md` + `.html` | **移到已完成 + ARCHIVED 头** | 已合并到本计划 Phase 3 |
| `README.html` | **新建** | 跟 baize-chat / baize-switch 仓对称 |
| `INDEX.md` | **新建** | 仓索引 |
| `CLAUDE.md` | **新建** | 仓总览 |
| `src/__tests__/routes.test.ts` | **更新** | 补覆盖率 + 真实 LLM mock |
| `src/__tests__/decomposer.test.ts` | **更新** | 补真实业务用例 |
| `tests/integration/oma-decompose.test.mjs` | **新建** | 集成测试 (跟 baize-switch 联调) |
| `src/decomposer/` | **更新** | 真实 OMA 接入 (非 mock) |
| `src/llm/` (新建) | **新建** | LLM client 调 baize-switch (20030) |
| `vitest.config.ts` | **更新** | 加 coverage 门禁 |

### 3.2 跨仓依赖（不动 baize-oma 仓内）

- baize-switch-core: 已实现 `/v1/messages` HTTP API (Phase 1 完成后)
- baize-loop: HttpSlotAdapter 拉 `/health` + `/manifest` (待 baize-loop 侧确认)

### 3.3 计划文档

| 路径 | 操作 |
|------|------|
| `plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md` | **新建** (本文件) |
| `plan/已完成/PLAN-MIGRATION-20260622-ARCHIVED.md` | 新建 (移动 + 改名) |
| `plan/已完成/PLAN-UPGRADE-20260622-ARCHIVED.md` | 新建 (移动 + 改名) |
| `plan/已完成/白泽baize-oma-DAG集成方案-20260623-ARCHIVED.md` + `.html` | 新建 |

---

## 4. Code Style（沿用 baize-oma 仓既有风格）

```typescript
// src/routes/loop-execute.ts 风格
import { Router } from "express";
import { logger } from "../util/logger.js";

export const loopExecuteRouter = Router();

loopExecuteRouter.post("/", async (req, res) => {
  try {
    const result = await loopExecute(req.body);
    res.json({ result });
  } catch (err) {
    logger.error("loop-execute failed", { err });
    res.status(500).json({ error: "internal_error" });
  }
});
```

**命名/格式约定**:
- TypeScript 5.x + strict
- `camelCase` 变量/函数, `PascalCase` 类型, `kebab-case` 文件名
- 错误处理 `try/catch` + 标准 HTTP code, 不 panic
- 异步优先 `async/await`, 不用 callback

---

## 5. Testing Strategy

### 5.1 测试层级

| 层级 | 框架 | 位置 | 覆盖目标 |
|------|------|------|----------|
| 单元 | Vitest | `src/__tests__/` | routes + decomposer ≥ 80% |
| 集成 | Vitest | `tests/integration/` | OMA ↔ baize-switch 联调 ≥ 60% |
| 端到端 | curl + bash | 临时 | 5 routes 烟测 |

### 5.2 关键测试

```typescript
// tests/integration/oma-decompose.test.mjs
import { describe, it, expect } from "vitest";

describe("OMA decompose", () => {
  it("decomposes task to DAG", async () => {
    const resp = await fetch("http://localhost:20040/decompose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task: "写个科幻剧本大纲" }),
    });
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.dag).toBeDefined();
    expect(body.dag.nodes.length).toBeGreaterThan(0);
  });
});
```

### 5.3 覆盖率目标

| 模块 | 目标 |
|------|------|
| `src/routes/*.ts` | ≥ 90% |
| `src/decomposer/` | ≥ 80% |
| `src/llm/` (新建) | ≥ 70% |

---

## 6. Boundaries（三段式）

### Always（必须遵守）
- ✅ 仓根 = npm 包, 不引入 monorepo
- ✅ TypeScript strict + noUnusedLocals + noUnusedParameters
- ✅ i18n 走 zh-CN 默认 (CLAUDE.md §i18n)
- ✅ 每次 task 完成按 CLAUDE.md §9.3 滚动迭代
- ✅ vendor/open-multi-agent/ 通过 patch-package 升级, 不直接改 vendor
- ✅ 任何代码改动先 plan → 用户审批 → 才动手

### Ask first
- ⚠️ 端口号 (20040 vs 其他)
- ⚠️ 是否引入 Vitest coverage v8
- ⚠️ LLM 调 baize-switch 是否经 baize-loop router
- ⚠️ 是否启用 Claude Code hooks (本仓无 settings.json)

### Never
- ❌ 不直接改 vendor/open-multi-agent/ 内部源码 (走 patch-package)
- ❌ 不跳过 plan 文档 task 列表
- ❌ 不直接修改代码文件, 必须先 plan 文档更新
- ❌ 不在仓根新增散落文档 (除 README.html / INDEX.md / CLAUDE.md)

---

## 7. 实施清单（按 4 阶段拆）

### Phase 1: 仓根完善 + 文档补齐（1 周）

- [ ] **T1.1** 新建 `README.html` (跟 baize-chat 对称)
- [ ] **T1.2** 新建 `INDEX.md` (仓索引)
- [ ] **T1.3** 新建 `CLAUDE.md` (仓总览)
- [ ] **T1.4** `plan/PLAN-MIGRATION-20260622.md` → ARCHIVED
- [ ] **T1.5** `plan/PLAN-UPGRADE-20260622.md` → ARCHIVED
- [ ] **T1.6** `plan/白泽baize-oma-DAG集成方案-20260623.md` + `.html` → ARCHIVED
- [ ] **T1.7** `vitest.config.ts` 加 coverage v8 + 门禁
- [ ] **T1.8** git commit (仓根文档 + ARCHIVED)

**估计**: ~500 行 doc + config, 1 周

### Phase 2: 业务逻辑真接 OMA（2 周）

- [ ] **T2.1** `src/decomposer/` 真接 vendor/open-multi-agent/ (去掉 mock)
- [ ] **T2.2** 新建 `src/llm/client.ts` (调 baize-switch 20030)
- [ ] **T2.3** `src/routes/decompose.ts` 真调 decomposer
- [ ] **T2.4** `src/routes/team-schedule.ts` 真调 team-schedule
- [ ] **T2.5** `src/routes/loop-execute.ts` 真跑循环 (decompose → execute → reflect)
- [ ] **T2.6** `src/__tests__/decomposer.test.ts` 加真实用例
- [ ] **T2.7** `src/__tests__/routes.test.ts` 补覆盖率
- [ ] **T2.8** git commit (业务真接)

**估计**: ~1000 行 src + 500 行 test, 2 周

### Phase 3: DAG 集成方案吸收（1 周）

- [ ] **T3.1** 按 `白泽baize-oma-DAG集成方案-20260623.md` 实施 DAG
- [ ] **T3.2** `src/dag/` 子目录新建 (types.ts + executor.ts + visualizer.ts)
- [ ] **T3.3** `src/decomposer/` 改造为输出 DAG 而非 flat task list
- [ ] **T3.4** `src/routes/dag-execute.ts` 新建
- [ ] **T3.5** 集成测试 (DAG 节点失败重试)
- [ ] **T3.6** git commit (DAG 集成)

**估计**: ~600 行 src + 200 行 test, 1 周

### Phase 4: 联调 + 端到端（1 周）

- [ ] **T4.1** `tests/integration/oma-decompose.test.mjs` 跟 baize-switch 联调
- [ ] **T4.2** `tests/integration/oma-loop-execute.test.mjs` 完整循环
- [ ] **T4.3** curl 烟测 5 routes
- [ ] **T4.4** baize-chat → oma → switch 端到端
- [ ] **T4.5** README.html 写联调说明
- [ ] **T4.6** git commit + tag `v0.2.0`

**估计**: ~300 行 test + 100 行 doc, 1 周

### 总计

| Phase | 估计代码 | 估计时间 |
|-------|----------|----------|
| Phase 1 | ~500 行 | 1 周 |
| Phase 2 | ~1500 行 | 2 周 |
| Phase 3 | ~800 行 | 1 周 |
| Phase 4 | ~400 行 | 1 周 |
| **总计** | **~3200 行** | **5 周** |

---

## 8. Success Criteria

| # | 条件 | 验证 |
|---|------|------|
| SC-1 | 仓根 README.html + INDEX.md + CLAUDE.md 完整 | 浏览器打开 README.html |
| SC-2 | `pnpm test:coverage` ≥ 80% | 输出 ≥ 80% |
| SC-3 | `curl /health` 200 | 浏览器/curl 验证 |
| SC-4 | `curl /decompose` 真分解任务到 DAG | 真实 LLM 调用 |
| SC-5 | 与 baize-switch 联调通 | integration test |
| SC-6 | 与 baize-chat 联调通 (chat → oma → switch) | e2e |
| SC-7 | 既有 plan (3 份) 全部 ARCHIVED | plan/已完成/ 目录 |
| SC-8 | git 历史干净, 4 Phase 各 commit | git log |

---

## 9. 缺口清单（5 项致命 + 5 项重要）

### 🔴 致命（5 项）
- GAP-1: `vendor/open-multi-agent/` 升级演练缺失
- GAP-2: `__tests__/` 覆盖率未量化, 无 coverage 脚本
- GAP-3: 缺独立运行验证脚本
- GAP-4: 与 baize-switch 真实联调未做
- GAP-5: 仓根 README.html / INDEX.md / CLAUDE.md 缺失

### 🟡 重要（5 项）
- GAP-6: `dist/` 提交但 CI 未验证
- GAP-7: 业务 handle 委派未真接 OMA
- GAP-8: 无 .github/workflows CI
- GAP-9: 无 PR 模板 + CONTRIBUTING.md
- GAP-10: 现有 plan (3 份) 未归档

---

## 10. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-23 | 初版。4 阶段 5 周实施清单 |