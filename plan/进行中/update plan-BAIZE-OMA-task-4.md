# update plan-BAIZE-OMA-task-4 — baize-oma Phase 4 联调 + 端到端

> **PLAN**: [/home/timywel/AI_Product/baize-slot/baize-oma/plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md](../../待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md) (v1.0)
> **Task 配对 JSON**: [update plan-BAIZE-OMA-task-4.json](./update plan-BAIZE-OMA-task-4.json)
> **上一轮**: [task-3.md](./update plan-BAIZE-OMA-task-3.json) (Phase 3 DAG 集成)
> **作者**: BaiZe 架构
> **时间**: 2026-06-24T00:30:00+08:00
> **本轮 scope**: `/home/timywel/AI_Product/baize-slot/baize-oma/` (子项目仓内, 跨仓联调)
> **会话归属**: 本计划在 baize-oma 子项目仓内推进, 联调可能需切换到 baize-loop 主会话

---

## 0. 上下文

Phase 3 DAG 集成完成后 (decomposer 输出 DAG, executor 支持并行 + 重试), Phase 4 跟 baize-switch (20030) + baize-chat (跨仓) 联调, 验证完整业务链路。

**关键链路**:
- baize-chat → 触发 `chat.agent.schedule` → baize-oma
- baize-oma → LLM 请求 → baize-switch (20030)
- baize-switch → 转发 → 上游 LLM provider

---

## 1. 任务清单 (T4.1~T4.6)

- [ ] **T4.1** 集成测试 `tests/integration/oma-decompose.test.mjs` (~100 行)
- [ ] **T4.2** 集成测试 `tests/integration/oma-loop-execute.test.mjs` (~150 行)
- [ ] **T4.3** curl 烟测 7 routes (~50 行 shell)
- [ ] **T4.4** baize-chat → oma → switch 端到端 (~150 行)
- [ ] **T4.5** README.html 写联调说明 (~50 行)
- [ ] **T4.6** git commit + tag v0.2.0

---

## 2. 跨仓协调

### 2.1 baize-switch 状态
- 端口 20030, http slot
- 当前状态: 4/9 capability 路由 OK (/health /manifest /v1/embeddings /api/v1/* CRUD)
- ⚠️ /v1/messages 阻塞 (192 errors + tauri 强耦合, 需 Phase 1 修复)
- **Phase 4 联调前**: 需确认 baize-switch Phase 1 已完成, /v1/messages 可用

### 2.2 baize-chat 状态
- 正在其他 session 重构
- 联调可能需切换到 baize-loop 主会话协调

### 2.3 联调协议
1. 启动 baize-switch-core (20030)
2. 启动 baize-oma (20060)
3. baize-chat 通过主控 HttpSlotAdapter 调 oma
4. oma 调 switch-core
5. 端到端验证

---

## 3. 估计

| 任务 | 估计行数 | 估计耗时 |
|------|----------|----------|
| T4.1 集成测试 decompose | ~100 行 | 0.3 周 |
| T4.2 集成测试 loop | ~150 行 | 0.3 周 |
| T4.3 curl 烟测 | ~50 行 | 0.1 周 |
| T4.4 端到端 | ~150 行 | 0.3 周 |
| T4.5 README | ~50 行 | 0.1 周 |
| T4.6 git tag | 0 | 0.1 周 |
| **总计** | **~500 行** | **1.2 周** |

---

## 4. 风险汇总

| 任务 | 风险 | 说明 |
|------|------|------|
| T4.1 | 中 | 跨仓联调, 需 baize-switch Phase 1 完成 |
| T4.2 | 中 | 同 T4.1 |
| T4.3 | 低 | curl 烟测标准化 |
| T4.4 | 高 | 跨 3 仓, 协调复杂, 可能需切 session |
| T4.5 | 低 | 仅写文档 |
| T4.6 | 低 | git 命令 |

---

## 5. 完成定义 (Definition of Done)

- [ ] 所有 T4.1-T4.5 任务 completed
- [ ] `git log --oneline -10` 显示所有 Phase commit
- [ ] `git tag` 显示 `baize-oma-v0.2.0`
- [ ] `pnpm test:coverage` ≥ 80%
- [ ] `pnpm test:integration` 全过
- [ ] baize-chat → oma → switch 端到端跑通

---

## 6. 下一轮 (Phase 5+)

本计划是 PLAN-BAIZE-OMA-SELF-AUDIT 的 Phase 4 (收尾)。Phase 5+ 视后续需要:
- 文档双版本 (HTML + PDF 转换)
- CI/CD (.github/workflows)
- 性能优化
- 跟 baize-loop 主仓 OMA 集成

**按 CLAUDE.md 滚动迭代模式**, Phase 4 完成后开新 plan, 不在本 plan 范围。

---

## 7. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-24T00:30:00+08:00 | 初版。Phase 4 联调 + 端到端 ~500 行 1.2 周 |