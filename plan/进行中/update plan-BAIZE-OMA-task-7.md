# update plan-BAIZE-OMA-task-7 — baize-oma Phase 7 性能基准（独立子项目）

> **PLAN**: [plan/待完成/PLAN-BAIZE-OMA-PHASE5-20260625-004200.md](../../待完成/PLAN-BAIZE-OMA-PHASE5-20260625-004200.md) §Phase 5+ 后续方向
> **Task 配对 JSON**: [update plan-BAIZE-OMA-task-7.json](./update plan-BAIZE-OMA-task-7.json)
> **上一轮**: [task-6.md](./update plan-BAIZE-OMA-task-6.md) (P6 覆盖率 80%→81% + CI build, tag v0.3.1)
> **作者**: BaiZe 架构
> **创建**: 2026-06-25T01:10:00+08:00
> **本轮 scope**: `/home/timywel/AI_Product/baize-slot/baize-oma/` (子项目仓内)
> **会话归属**: 本计划在 baize-oma 子项目仓内推进, 独立子项目 (Phase 5+ #6 性能优化前置)

---

## 0. 上下文

P6 收口后 (tag v0.3.1, 81.05% coverage), 启动 Phase 5+ 候选 #6 性能优化的**前置**: 性能基准 (benchmark).

**目标**: 建立 DAG executor 性能基线, 后续优化 (P8+) 有数据支撑.

**不涉及跨仓** (baize-chat / baize-switch 联调仍延后).

---

## 1. 任务清单 (T7.1~T7.4)

- [ ] **T7.1** 新建 `src/__bench__/dag-executor.bench.ts` (~200 行)
- [ ] **T7.2** `package.json` scripts 加 `bench` 命令
- [ ] **T7.3** 跑 benchmark, 写结果到 `temp/bench/dag-executor-20260625.md`
- [ ] **T7.4** git commit + tag v0.3.2

**估计**: ~250 行, 1 session (~15 min)

---

## 2. 关键技术点

### 2.1 工具选择

考虑方案:
- **vitest bench** — vitest 内置 `describe.bench`, 简单, 但 vitest 2.1.9 还在 beta 实验
- **mitata** — 轻量, ~1KB, 极简 API
- **tinybench** — 类似 bench.js, 简单
- **手写** — 用 `performance.now()` 即可, 0 依赖

**选手写**: 0 依赖, 复用现有 dev 依赖 (vitest 已有 performance). 最简方案.

### 2.2 基准场景

DAG executor 性能主要受 3 个因素影响:
1. **节点数 N** — 10 / 50 / 100 / 500
2. **并发度 M** — 1 / 5 / 20 (maxConcurrency)
3. **节点耗时 T** — 1ms / 10ms / 100ms (mock executor 延迟)

跑 12 个场景 (4 × 3), 输出:
- 总耗时 (ms)
- 吞吐 (nodes/sec)
- 内存峰值 (MB, 用 process.memoryUsage())

### 2.3 mock executor

```typescript
const mockExecutor: DAGNodeExecutor = async (input) => {
  // 模拟 10ms LLM 调用
  await new Promise((r) => setTimeout(r, 10));
  return {
    output: `done: ${input.task}`,
    tokens: { input: input.task.length, output: 10 },
  };
};
```

### 2.4 输出格式

`temp/bench/dag-executor-20260625.md` (符合 CLAUDE.md 输出路径严格分流):
- 表格: 场景 | 节点数 | 并发 | 节点耗时 | 总耗时 | 吞吐 | 内存
- 总结: 关键发现 + 优化建议 (P8+ 候选)

---

## 3. 估计

| Task | 行数 | 耗时 |
|------|------|------|
| T7.1 benchmark 脚本 | ~200 | 8 min |
| T7.2 bench script | ~3 | 1 min |
| T7.3 跑 + 写结果 | - | 5 min |
| T7.4 commit + tag | - | 1 min |
| **总计** | **~210** | **~15 min** |

---

## 4. 风险

| 风险 | 等级 | 说明 |
|------|------|------|
| 内存测量波动大 | 中 | 多次跑取平均, 排除 GC 影响 |
| mock executor 性能不代表真实 | 中 | 真实场景含 LLM 网络延迟, 100ms+, 需在 benchmark 注明 |
| vitest 2.1.9 跑 .bench.ts 可能污染单测 | 低 | 放 src/__bench__/ (不入 vitest include) |

---

## 5. 完成定义

- [ ] src/__bench__/dag-executor.bench.ts 跑通
- [ ] 12 场景数据齐全
- [ ] temp/bench/dag-executor-20260625.md 写出
- [ ] package.json bench 命令可用
- [ ] git tag baize-oma-v0.3.2

---

## 6. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-25T01:10:00+08:00 | 初版。性能基准, 独立子项目 |