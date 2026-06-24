# update plan-BAIZE-OMA-task-3 — baize-oma Phase 3 DAG 集成方案吸收

> **PLAN**: [/home/timywel/AI_Product/baize-slot/baize-oma/plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md](../../待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md) (v1.0)
> **Task 配对 JSON**: [update plan-BAIZE-OMA-task-3.json](./update plan-BAIZE-OMA-task-3.json)
> **上一轮**: [task-2.md](./update plan-BAIZE-OMA-task-2.md) (Phase 2 业务真接 OMA 全部 completed)
> **作者**: BaiZe 架构
> **时间**: 2026-06-24T08:59:30+08:00
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

## 1. 任务清单 (T3.1~T3.6)

### 1.1 DAG 子目录新建 (T3.1~T3.2)
- [ ] **T3.1** 读 `plan/白泽baize-oma-DAG集成方案-20260623.md` 整理实施步骤
- [ ] **T3.2** 新建 `src/dag/types.ts` (DAGNode / DAG / DAGExecutionResult 等, ~100 行)

### 1.2 执行器 + 可视化 (T3.3~T3.4)
- [ ] **T3.3** 新建 `src/dag/executor.ts` (拓扑排序 + 并行 + 重试, ~200 行)
- [ ] **T3.4** 新建 `src/dag/visualizer.ts` (ASCII / Mermaid 输出, ~100 行)

### 1.3 decomposer 改造 (T3.5)
- [ ] **T3.5** 改造 `src/decomposer/` 输出 DAG 而非 flat list (~150 行, 接口变更要兼容)

### 1.4 路由 + 集成测试 (T3.6~T3.7)
- [ ] **T3.6** 新建 `src/routes/dag-execute.ts` (~200 行, 走 dagExecutor 真执行)
- [ ] **T3.7** 集成测试 `src/__tests__/dag.test.ts` (~250 行, 6+ case: 简单 DAG / 并行 / 失败重试 / 循环依赖检测 / maxConcurrency / 可视化)

---

## 2. 关键技术点

### 2.1 DAG 类型设计 (src/dag/types.ts)

```typescript
export interface DAGNode {
  id: string;
  task: string;
  agent?: string;        // 调用的 agent 名
  agentRole: OMANode['agentRole'];
  dependsOn: string[];   // 依赖的节点 ID
  retries: number;       // 失败重试次数
  timeoutMs: number;     // 节点超时
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  result?: string;
  attempts: number;
}

export interface DAG {
  nodes: DAGNode[];
  edges: { from: string; to: string }[];
}

export interface DAGExecutionOptions {
  maxConcurrency?: number;     // 默认 5
  failFast?: boolean;          // 默认 true, 任一节点 failed 立即中止下游
  defaultRetries?: number;     // 默认 1
  defaultTimeoutMs?: number;   // 默认 30000
}

export interface DAGExecutionResult {
  dag: DAG;
  status: 'success' | 'partial' | 'failed';
  nodeResults: Record<string, { output: string; tokens: { input: number; output: number } }>;
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
}
```

### 2.2 执行器核心 (src/dag/executor.ts)

- 拓扑排序检测循环依赖 (Kahn's algorithm)
- 按层并行执行 (Promise.all per layer)
- 单节点失败: 重试 (按 `retries` 字段 + 指数退避)
- failFast=true: 下游节点标 `skipped`
- 收集每节点 token 用量

### 2.3 路由 (src/routes/dag-execute.ts)

```typescript
router.post("/dag.execute", async (req, res) => {
  const { dag, options } = req.body;
  // 1. 校验 DAG 形态 (无循环依赖)
  // 2. 走 dagExecutor.execute(dag, options)
  // 3. 返回 DAGExecutionResult
});
```

---

## 3. 估计

| 任务 | 估计行数 | 估计耗时 |
|------|----------|----------|
| T3.1 读方案 | 0 行 | 0.5 天 |
| T3.2 DAG types | ~100 行 | 1 天 |
| T3.3 executor | ~200 行 | 3 天 |
| T3.4 visualizer | ~100 行 | 1 天 |
| T3.5 decomposer 改造 | ~150 行 | 2 天 |
| T3.6 route | ~200 行 | 1 天 |
| T3.7 tests | ~250 行 | 1 天 |
| **总计** | **~1000 行** | **~1.5 周** |

---

## 4. 风险汇总

| 任务 | 风险 | 说明 |
|------|------|------|
| T3.3 | 高 | 并发执行 + 失败重试涉及状态机, 需仔细 |
| T3.5 | 中 | decomposer 接口从 OMADag → DAG 可能 break 现有 T2.3 路由, 需保持向后兼容 |
| T3.6 | 中 | 暴露新能力需 baize-loop 主控侧更新 adapter |
| T3.7 | 低 | 纯测试 |

---

## 5. 下一轮指引 (Phase 4)

**Phase 4 目标**: 联调 + 端到端 (跨 baize-switch + baize-chat)

**核心任务** (从 PLAN §7 Phase 4):
- T4.1: `tests/integration/oma-decompose.test.mjs` 跟 baize-switch 联调
- T4.2: `tests/integration/oma-loop-execute.test.mjs` 完整循环
- T4.3: curl 烟测 5 routes
- T4.4: baize-chat → oma → switch 端到端
- T4.5: README.html 写联调说明
- T4.6: git commit + tag v0.2.0

**估计**: ~400 行 test + 100 行 doc, 1 周

---

## 6. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-24T08:59:30+08:00 | 初版。Phase 3 DAG 集成 ~1000 行 1.5 周 |
