# update plan-BAIZE-OMA-task-3 — baize-oma Phase 3 DAG 集成方案吸收

> **PLAN**: [/home/timywel/AI_Product/baize-slot/baize-oma/plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md](../../待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md) (v1.0)
> **Task 配对 JSON**: [update plan-BAIZE-OMA-task-3.json](./update plan-BAIZE-OMA-task-3.json)
> **上一轮**: [task-2.md](./update plan-BAIZE-OMA-task-2.md) (Phase 2 业务真接 OMA 全部 completed)
> **下一轮**: [task-4.md](./update plan-BAIZE-OMA-task-4.md) (Phase 4 联调 + 端到端)
> **作者**: BaiZe 架构
> **时间**: 2026-06-24T08:59:30+08:00
> **完成**: 2026-06-24T09:16:00+08:00
> **状态**: ✅ completed (5 commit, 33/33 test pass, 0 typecheck error, ~1100 行)
> **本轮 scope**: `/home/timywel/AI_Product/baize-slot/baize-oma/` (子项目仓内)
> **会话归属**: 本计划在 baize-oma 子项目仓内推进, 避免 baize-loop 主会话污染

---

## 0. 上下文

Phase 2 业务真接 OMA 全部完成 (7 commit, 22 test pass, 0 typecheck error), 启动 Phase 3: **DAG 集成方案吸收**。

**输入文档**:
- `plan/白泽baize-oma-DAG集成方案-20260623.md` (23.6KB, 详细方案)
- `plan/白泽baize-oma-DAG集成方案-20260623.html` (34.4KB, 人类版)

**核心问题**:
- Phase 2 decomposer 输出的 `OMADag` 只含 nodes + dependsOn, 缺统一执行器;
- 现有 `src/routes/team-schedule.ts` 直接调 OMA runTeam, 不暴露 DAG 形态给业务方;
- 节点失败重试 / 并行调度 / 拓扑排序 都需要新建一个 `src/dag/` 执行层。

---

## 1. 任务清单 (T3.1~T3.7) — 全部 completed

### 1.1 DAG 子目录新建 (T3.1~T3.2)
- [x] **T3.1** 读 `plan/白泽baize-oma-DAG集成方案-20260623.md` 整理实施步骤
- [x] **T3.2** 新建 `src/dag/types.ts` (DAGNode / DAG / DAGExecutionResult 等, 115 行) — 866ca00

### 1.2 执行器 + 可视化 (T3.3~T3.4)
- [x] **T3.3** 新建 `src/dag/executor.ts` (拓扑排序 + 并行 + 重试, 354 行) — f3004d9
- [x] **T3.4** 新建 `src/dag/visualizer.ts` (ASCII / Mermaid 输出, 98 行) — f23ce70

### 1.3 decomposer 改造 (T3.5)
- [x] **T3.5** 改造 `src/decomposer/` 输出 DAG 而非 flat list (45 行 delta, 接口扩展不破坏) — a6626e7

### 1.4 路由 + 集成测试 (T3.6~T3.7)
- [x] **T3.6** 新建 `src/routes/dag-execute.ts` (215 行, 走 dagExecutor 真执行) — 56bd561
- [x] **T3.7** 集成测试 `src/__tests__/dag.test.ts` (277 行, 11 case) — 3865330

---

## 2. 关键技术点

### 2.1 DAG 类型设计 (src/dag/types.ts, 115 行)

```typescript
export interface DAGNode {
  id: string;
  task: string;
  agent?: string;
  agentRole: OMANode['agentRole'];
  dependsOn: string[];
  retries: number;
  timeoutMs: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  result?: string;
  attempts: number;
}
export interface DAG { nodes: DAGNode[]; edges: OMAEdge[]; }
export interface DAGExecutionOptions { maxConcurrency?: number; failFast?: boolean; defaultRetries?: number; defaultTimeoutMs?: number; executor?: DAGNodeExecutor; }
export interface DAGExecutionResult { dag: DAG; status: 'success' | 'partial' | 'failed'; nodeResults: Record<string, DAGNodeResult>; startedAt: string; finishedAt: string; totalDurationMs: number; }
export class DAGValidationError extends Error { constructor(message, public readonly code); }
```

### 2.2 执行器核心 (src/dag/executor.ts, 354 行)

- **拓扑排序**: Kahn's algorithm — 节点入度减到 0 时进入下一层; 排序后 `visited.size !== nodes.length` → 抛 `CYCLE_DETECTED`
- **按层并行**: 每层用 `Promise.allSettled` 并行跑节点, Semaphore 限流 `maxConcurrency`
- **节点重试**: `retries=0` → 1 次; `retries=N` → N+1 次; 指数退避 `200ms * 2^(attempt-1)`
- **超时保护**: 每个节点用 `Promise.race` 套 `setTimeout(timeoutMs)` 主动切断
- **失败语义**:
  - `failFast=true`: 任一节点 failed → break 整个执行 + 下游标 skipped
  - `failFast=false`: 继续执行其他旁支; 下游节点若 dep 失败 → 仍 skipped (语义修正, 见 §4 经验)
- **节点执行**: 默认走 OMA `runAgent` (单 agent), prompt 含 upstream outputs
- **结果聚合**: status = `success` (无失败) / `partial` (有失败有成功) / `failed` (全部失败)

### 2.3 可视化 (src/dag/visualizer.ts, 98 行)

- `toAscii(dag)`: 按拓扑层分行, 同一层节点同行
  - 例: `[a, b] → [c]`
- `toMermaid(dag)`: 输出 Mermaid `flowchart LR` 语法
  - 例: `flowchart LR\n  a["a (generic)"]\n  b["b (generic)"]\n  a --> c\n  b --> c`
- 标签超长自动截断到 24 字符 (避免 Mermaid 渲染崩)

### 2.4 路由 (src/routes/dag-execute.ts, 215 行)

```typescript
POST /dag.execute
  body: { input?, agents?, options?, dag?, defaults?: { retries?, timeoutMs?, maxConcurrency?, failFast? } }
  resp: { status, body: { taskDag, result: DAGExecutionResult, ascii, mermaid } }
  errors: 400 INVALID_REQUEST / 400 CYCLE_DETECTED / 500 DAG_EXECUTE_FAILED

POST /dag.visualize  (debug 用, 不执行)
  body: { dag }
  resp: { status, body: { ascii, mermaid } }
```

server.ts 接入新路由:
```typescript
app.use(dagExecuteRouter);
```

---

## 3. 实际产出 vs 估计

| 指标 | 估计 | 实际 | 说明 |
|------|------|------|------|
| 代码行数 | ~1000 | **1101** | 略高 (executor 实际 354 行, 比估计 200 多) |
| 测试用例 | 6+ | **11** | 含 3 个 case 5-7 (并发/失败语义覆盖) |
| typecheck | 0 error | 0 error | strict mode |
| commit | 7 (每 task) | **5** | T3.5 + T3.6 合并提交, T3.7 含 bug fix 合并 |
| 测试耗时 | - | 33/33 (22 旧 + 11 新) | 0.84s dag tests |

### 3.1 新增/修改文件清单

- ✅ 新建 `src/dag/types.ts` (115 行)
- ✅ 新建 `src/dag/executor.ts` (354 行)
- ✅ 新建 `src/dag/visualizer.ts` (98 行)
- ✅ 修改 `src/decomposer/decomposer.ts` (+45 行, 新增 `decomposeIntoDag`)
- ✅ 新建 `src/routes/dag-execute.ts` (215 行)
- ✅ 修改 `src/server.ts` (+4 行, 注册新路由)
- ✅ 新建 `src/__tests__/dag.test.ts` (277 行, 11 case)

### 3.2 测试覆盖矩阵

| 维度 | case | 备注 |
|------|------|------|
| 基础执行 | 1, 2 | 顺序 / 并行时序 |
| 错误处理 | 3, 4, 5 | 重试 / 循环依赖 / 缺失依赖 |
| 并发控制 | 6 | maxConcurrency 限流 |
| 失败语义 | 7, 8 | failFast true / false |
| 可视化 | 9, 10, 11 | ASCII / Mermaid / 空 DAG 兜底 |

---

## 4. 经验记录 (Plan-driven execution 沉淀)

### 4.1 failFast 语义边界 (case 8 暴露的 bug)

**原实现**: `if (!failFast || failedAncestors.size === 0) return true;` — failFast=false 时无条件执行节点。

**Bug 表现**: 节点 A 失败, 节点 C 依赖 A, failFast=false → C 仍执行, 但 upstream 拿不到 A 的 output → C 用了空 upstream, 结果 status 错标 completed。

**修正**: 失败的祖先对下游的 skip 行为与 failFast 无关 — failFast 只控制"是否提前 break 整个执行", 失败祖先的下游必须 skip (没上游结果)。

**Why**: 这是测试驱动才发现的, plan 阶段没考虑到。Lesson: failFast 命名误导, 应该叫 `breakOnFirstFailure` 更准确, 或在 docstring 显式声明双语义。

### 4.2 cycle detection 双路径

**问题**: 循环依赖检测原本只在 `topologicalLayers` 内部 (visited.size check), 但 `validateDag` 是路由层的"早失败"入口, 调用方可能只 validate 不 execute。

**修正**: `validateDag` 调 `topologicalLayers` 复用同一逻辑, 让 route 在 execute 前就抛 400 CYCLE_DETECTED。

### 4.3 兼容性破坏 vs 扩展

**T3.5 设计选择**: decomposer/decomposer.ts 既保留原 `decompose()` (返 OMADag, 给 /oma.team.create), 又加 `decomposeIntoDag()` (返 DAG, 给 /dag.execute)。

**Why**: Phase 2 已有 22 测试覆盖原 decompose 路径, 改返回值会爆量测试改动; 加方法是"扩展不破坏"的标准做法, 零回归。

---

## 5. 下一轮指引 (Phase 4)

**Phase 4 目标**: 联调 + 端到端 (跨 baize-switch + baize-chat)

**核心任务** (从 PLAN §7 Phase 4):
- T4.1: `tests/integration/oma-decompose.test.mjs` 跟 baize-switch 联调
- T4.2: `tests/integration/oma-loop-execute.test.mjs` 完整循环
- T4.3: `tests/integration/oma-dag-execute.test.mjs` (新增 Phase 3 DAG 联调)
- T4.4: curl 烟测 7 routes (5 旧 + 2 新)
- T4.5: baize-chat → oma → switch 端到端
- T4.6: README.html 写联调说明
- T4.7: git commit + tag v0.2.0

**估计**: ~400 行 test + 100 行 doc, 1 周

---

## 6. Noticed but not touching (Scope Discipline)

- `src/oma-adapter.ts` 仍是 dead code (Phase 2 §7.2 标记), 留待后续清理
- `src/decomposer/types.ts` 仍是 TODO 注释 + 占位, 没补详细注释 (Phase 4 范围)
- `vitest.config.ts` 仍未加 coverage 门禁 (Phase 1 T1.7 范围)
- 集成测试 `tests/integration/oma-decompose.test.mjs` 仍缺失 (Phase 4 范围)

---

## 7. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-24T08:59:30+08:00 | 初版。Phase 3 DAG 集成 ~1000 行 1.5 周 |
| 1.1 | 2026-06-24T09:16:00+08:00 | 全部 completed (5 commit, 33/33 test pass, 0 typecheck error, 1101 行)。启动 Phase 4 |
