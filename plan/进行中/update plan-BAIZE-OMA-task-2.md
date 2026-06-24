# update plan-BAIZE-OMA-task-2 — baize-oma Phase 2 业务逻辑真接 OMA

> **PLAN**: [/home/timywel/AI_Product/baize-slot/baize-oma/plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md](../../待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md) (v1.0)
> **Task 配对 JSON**: [update plan-BAIZE-OMA-task-2.json](./update plan-BAIZE-OMA-task-2.json)
> **上一轮**: [task-1.md](./update plan-BAIZE-OMA-task-1.json) (Phase 1 全部 completed)
> **下一轮**: [task-3.md](./update plan-BAIZE-OMA-task-3.md) (Phase 3 DAG 集成方案吸收)
> **作者**: BaiZe 架构
> **创建**: 2026-06-24T00:30:00+08:00
> **完成**: 2026-06-24T08:59:30+08:00
> **状态**: ✅ completed (7 commit, 22/22 test pass, 0 typecheck error)
> **本轮 scope**: `/home/timywel/AI_Product/baize-slot/baize-oma/` (子项目仓内)
> **会话归属**: 本计划在 baize-oma 子项目仓内推进, 避免 baize-loop 主会话污染

---

## 0. 上下文

Phase 1 仓根脚手架已完成 (CLAUDE.md / INDEX.md / README.html + 2 ARCHIVED 旧 plan)。本轮启动 Phase 2: **业务逻辑真接 OMA** (从 mock 切换到真实 vendor/open-multi-agent/ 调用)。

**核心问题**: Phase 1 之前的代码 `src/decomposer/decomposer.ts` 可能用 mock, 没有真接 OMA 引擎。Phase 2 把 mock 全部替换为真实调用, 并新建 `src/llm/client.ts` 调 baize-switch 20030。

---

## 1. 任务清单 (T2.1~T2.7)

### 1.1 业务真接 (T2.1~T2.5)
- [x] **T2.1** `src/decomposer/` 真接 vendor/open-multi-agent/ (~200 行) — ff14704
- [x] **T2.2** 新建 `src/llm/client.ts` 调 baize-switch 20030 (~150 行) — 0c0f4f1
- [x] **T2.3** `src/routes/decompose.ts` 真调 decomposer (~100 行) — f59e370
- [x] **T2.4** `src/routes/team-schedule.ts` 真调 team-schedule (~150 行) — 2106d5c
- [x] **T2.5** `src/routes/loop-execute.ts` 真跑循环 (~200 行) — fb826d2
- [x] **T2.5-fix** typecheck 修复: 显式标注 ExpressRouter — 8101dfb

### 1.2 测试补覆盖率 (T2.6~T2.7)
- [x] **T2.6** `src/__tests__/decomposer.test.ts` 加真实用例 (~200 行, 7 case) — b8f3ffc
- [x] **T2.7** `src/__tests__/routes.test.ts` 补覆盖率 (~300 行, 3 routes × 5 case = 15 case) — 10eb99d

### 1.3 滚动迭代
- [x] **T2.8** `update plan-BAIZE-OMA-task-2.json` 全部 completed + 加 metrics — 本 commit
- [x] **T2.9** `update plan-BAIZE-OMA-task-3.{md,json}` 启动 Phase 3 — 本 commit

---

## 2. 关键技术点

### 2.1 vendor/open-multi-agent/ 接口 audit

**位置**: `/home/timywel/AI_Product/baize-slot/baize-oma/vendor/open-multi-agent/`

**操作**:
1. Read vendor 入口 (一般是 `src/index.ts` 或 `src/lib.rs`)
2. 列出对外 API (decompose / team-schedule / loop-execute)
3. 跟 `src/decomposer/decomposer.ts` 当前接口对比
4. 编写 adapter (1:1 映射 vendor API → baize-oma routes)

### 2.2 LLM client 设计

**新建** `src/llm/client.ts`:
```typescript
// 跟 baize-switch-core 20030 通信
const BASE_URL = process.env.BAIZE_SWITCH_URL || "http://127.0.0.1:20030";

export async function chatCompletion(req: ChatRequest): Promise<ChatResponse> {
  const resp = await fetch(`${BASE_URL}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": req.apiKey },
    body: JSON.stringify(req),
  });
  return resp.json();
}

export async function embedding(req: EmbeddingRequest): Promise<EmbeddingResponse> {
  const resp = await fetch(`${BASE_URL}/v1/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  return resp.json();
}
```

### 2.3 循环执行 (decompose → execute → reflect)

`src/routes/loop-execute.ts`:
```typescript
async function loop(task: string, maxIter: number = 5) {
  for (let i = 0; i < maxIter; i++) {
    // 1. 分解任务
    const dag = await decomposer.decompose(task);
    // 2. 执行 DAG 节点
    const results = await dagExecutor.execute(dag);
    // 3. 反思 (调 LLM 评估)
    const reflection = await chatCompletion({
      messages: [{ role: "user", content: `评估: ${JSON.stringify(results)}` }],
    });
    if (reflection.done) return results;
    task = reflection.nextTask;
  }
}
```

---

## 3. 估计

| 任务 | 估计行数 | 估计耗时 |
|------|----------|----------|
| T2.1 业务真接 | ~200 行 | 0.5 周 |
| T2.2 LLM client | ~150 行 | 0.3 周 |
| T2.3-T2.5 routes | ~450 行 | 1 周 |
| T2.6-T2.7 tests | ~500 行 | 0.5 周 |
| **总计** | **~1300 行** | **2.3 周** |

---

## 4. 风险汇总

| 任务 | 风险 | 说明 |
|------|------|------|
| T2.1 | 中 | vendor/open-multi-agent/ 接口可能复杂, 需 audit (1-2 天) |
| T2.2 | 低 | fetch + 错误处理, 标准化 |
| T2.3 | 低 | 业务代码替换, 路径明确 |
| T2.4 | 低 | 同 T2.3 |
| T2.5 | 中 | 循环执行涉及状态管理, 需小心 |
| T2.6 | 中 | 真业务用例需调 OMA, mock 策略要更新 |
| T2.7 | 低 | 标准单测 |

---

## 5. 下一轮指引 (Phase 3)

**Phase 3 目标**: DAG 集成方案吸收

**核心任务** (从 PLAN §7 Phase 3):
- T3.1: 按 `白泽baize-oma-DAG集成方案-20260623.md` 实施 DAG
- T3.2: `src/dag/` 子目录新建 (types.ts + executor.ts + visualizer.ts)
- T3.3: `src/decomposer/` 改造为输出 DAG 而非 flat task list
- T3.4: `src/routes/dag-execute.ts` 新建
- T3.5: 集成测试 (DAG 节点失败重试)

**估计**: ~800 行 src + 200 行 test, 1 周

---

## 6. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-24T00:30:00+08:00 | 初版。Phase 2 业务真接 OMA 任务清单, ~1300 行 2.3 周 |
| 1.1 | 2026-06-24T08:59:30+08:00 | 全部 completed (7 commit, 22/22 test pass, 0 typecheck error)。启动 Phase 3 |

---

## 7. Phase 2 实际产出

| 指标 | 估计 | 实际 | 说明 |
|------|------|------|------|
| 代码行数 | ~1300 | ~1271 | 7 个新/改文件, 略低于估计 |
| 测试用例 | - | 22 (7 decomposer + 15 routes) | 全过 |
| typecheck | - | 0 error | strict mode |
| commit | - | 7 (每 task 一 commit) | 含 1 typecheck 修复 commit |
| 端到端联调 | - | 未做 (Phase 4 范围) | 单测 mock OMA engine |

### 7.1 新增/修改文件清单

- ✅ 新建 `src/decomposer/decomposer.ts` (187 行, 真接 OMA runTeam planOnly)
- ✅ 新建 `src/llm/client.ts` (200 行, baize-switch 20030 client + 重试)
- ✅ 新建 `src/routes/decompose.ts` (82 行, 真调 decomposer)
- ✅ 新建 `src/routes/team-schedule.ts` (121 行, 真调 OMA runTeam)
- ✅ 新建 `src/routes/loop-execute.ts` (215 行, decompose → execute → reflect)
- ✅ 修改 `src/oma-client.ts` (新增 getOmaEngine getter)
- ✅ 修改 `src/server.ts` (改用 3 个 router, 不再 inline)
- ✅ 新建 `src/__tests__/decomposer.test.ts` (187 行, 7 case)
- ✅ 新建 `src/__tests__/routes.test.ts` (279 行, 15 case)

### 7.2 Noticed but not touching (Scope Discipline)

- `src/oma-adapter.ts` 现已是 dead code (inline handler 拆出后不再用), 留待后续清理
- `vendor/open-multi-agent/dist/` 体积大, 未审计 (Phase 1 范围)
- 集成测试 `tests/integration/oma-decompose.test.mjs` 缺失 (Phase 4 范围)
- `vitest.config.ts` coverage 门禁缺失 (Phase 1 T1.7 范围, 走 plan 文档)