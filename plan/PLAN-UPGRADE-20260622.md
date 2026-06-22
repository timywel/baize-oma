# PLAN-BAIZE-OMA-UPGRADE — baize-oma 升级计划

> **作者**: BaiZe 架构 · **创建**: 2026-06-22 · **状态**: pending approval

---

## 1. 目标

open-multi-agent 包装为 baize-oma slot，adapter 做协议转换，不修改 OMA 源码。

## 2. Task 清单

### 2.1 adapter 开发 (Phase 3)

- [ ] 创建 `src/adapter.ts` — 实现 BaizeSlot 接口，转发给 OMA
- [ ] 创建 `package.json` — 依赖 `open-multi-agent`
- [ ] 单测: adapter 协议转换正确

### 2.2 前后端测试

- [ ] Playwright: Agent Team 调度端到端（通过 chat 调 OMA）
- [ ] 集成: OMA 多 Agent 协作结果正确回流

## 3. 验收

- [ ] adapter 单测通过
- [ ] OMA 源码未被修改
- [ ] 前端无回归
