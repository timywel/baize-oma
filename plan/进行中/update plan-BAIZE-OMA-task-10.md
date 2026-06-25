# update plan-BAIZE-OMA-task-10 — baize-oma Phase 10 跨仓联调（部分成功）

> **PLAN**: [plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md](../../待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md) §Phase 4 T4.1-T4.4 (跨仓联调, 原计划延后)
> **Task 配对 JSON**: [update plan-BAIZE-OMA-task-10.json](./update plan-BAIZE-OMA-task-10.json)
> **上一轮**: [task-9.md](./update plan-BAIZE-OMA-task-9.md) (P9 vendor 裁剪, tag v0.3.4)
> **作者**: BaiZe 架构
> **创建**: 2026-06-25T14:35:00+08:00
> **本轮 scope**: `/home/timywel/AI_Product/baize-slot/baize-oma/` (baize-oma 这端联调, baize-chat 端不涉及)

---

## 0. 上下文

baize-chat 重构未完, 但 baize-switch (Rust `cc-switch-core`) 已可用.
本轮按用户指令 "联调吧", 在 baize-oma 这端启动跨仓联调.

**实际可联调**:
- T4.1 oma-decompose 集成测试 — baize-oma → baize-switch (✅ 真链路)
- T4.2 oma-loop-execute 集成测试 — baize-oma → baize-switch (✅ 真链路)
- T4.4 baize-chat → oma → switch — 仍延后 (baize-chat 重构中)

**关键观察**: 端口 20030 被 baize-loop 主仓 `api-router` 占用, baize-switch-core 用 alt 端口 20130.

---

## 1. 任务清单 (T10.1~T10.5)

- [x] **T10.1** 启动 baize-switch-core alt 端口 (20130/20131), 验证 /health
- [x] **T10.2** curl 直测 switch `/v1/messages`, 确认 minimax provider 通 (✅ 真实 LLM 响应)
- [x] **T10.3** baize-oma → switch 真链路:
  - POST /oma.team.create → 200, 2.3s, 拿到 DAG 拆解
  - POST /dag.execute → 200, 4.1s, 拿到 "Hello there friend" 真响应
  - POST /chat.loop.execute → 200, ~5s, 一次迭代 done=true
- [x] **T10.4** 写跨仓联调报告 `temp/integration/cross-stack-link-20260625.md`
- [ ] **T10.5** git commit + tag baize-oma-v0.3.5

**估计**: ~150 行, 1 session (~30 min)

---

## 2. 关键技术点

### 2.1 端口冲突解决

```
端口 20030 被占用:
- baize-loop 主仓 api-router (python3, 端口 20030)
- baize-switch-core 启动失败 (Address already in use)

解决方案:
BAIZE_PORT=20130 BAIZE_API_PORT=20131 ./target/release/baize-switch-core
→ switch 监听 20130 (主) + 20131 (API)

OMA 配置:
BAIZE_SWITCH_URL=http://127.0.0.1:20130 pnpm dev
→ OMA 走 20130 而非默认 20030
```

### 2.2 LLM provider 路由

baize-switch 自动把 model 名字映射到 minimax provider:
- 请求: `model: "minimax"` (用户友好别名)
- 上游: `model: "MiniMax-M3"` (实际 minimax 模型)
- 响应: minimax 格式 → 转换回 Anthropic Messages 格式

### 2.3 真实链路验证

| 端点 | 状态 | 真实响应 |
|------|------|----------|
| `GET http://127.0.0.1:20130/health` | ✅ | `{"status":"healthy"}` |
| `POST /v1/messages` (直测 switch) | ✅ | minimax 真实响应 (id+content+tokens) |
| `POST http://127.0.0.1:20060/oma.team.create` | ✅ | DAG 拆解成功 |
| `POST http://127.0.0.1:20060/dag.execute` | ✅ | "Hello there friend" 真 LLM 输出 |
| `POST http://127.0.0.1:20060/chat.loop.execute` | ✅ | iterate + reflect + done |

---

## 3. 实际产出

| 指标 | 值 |
|------|---|
| 总耗时 | ~5 min |
| 联调端点数 | 5 (3 oma + 2 switch) |
| 真实 LLM 调用次数 | 3 (decompose + dag.execute + loop reflect) |
| tokens 总消耗 | ~250 (input) + ~100 (output) |
| 失败次数 | 0 |

---

## 4. 后续 (T4.4 仍延后)

baize-chat 端重构未完, T4.4 baize-chat → oma → switch 端到端仍延后.

**需要等**:
- baize-chat 重构 PR 合并
- baize-chat 写 baize-oma HTTP 客户端 (HttpSlotAdapter)
- 联调三仓

---

## 5. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-25T14:35:00+08:00 | 初版。跨仓联调 T4.1-T4.3 部分成功, T4.4 仍延后 |
