# [ARCHIVED 2026-06-23] PLAN-BAIZE-OMA-UPGRADE — baize-oma 升级计划

> **⚠️ 状态**: ARCHIVED (2026-06-23)
>
> **作废理由**: 升级已完成, 本计划已实施完毕
>
> **替代方案**: [plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md](../../待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md) §Phase 2-4 (业务真接 OMA + DAG 集成 + 联调)

---

# PLAN-BAIZE-OMA-UPGRADE — baize-oma 升级计划

> **作者**: BaiZe 架构 · **创建**: 2026-06-22 · **更新**: 2026-06-23 (加 DAG 拆解能力集成)
> **状态**: pending approval
> **关联专题**: `plan/refactor/slots-and-libs/chat/白泽baize-oma-DAG集成方案-20260623.html`

---

## 1. 目标

open-multi-agent 包装为 baize-oma slot，adapter 做协议转换，不修改 OMA 源码。
**+ 2026-06-23 新增**: baize-oma 仓内集成 DAG 任务拆解能力 (方案 C 拍板), 取代进程内 `OMADecomposer` 类。

## 2. Task 清单

### 2.1 adapter 开发 (Phase 3)

- [ ] 创建 `src/adapter.ts` — 实现 BaizeSlot 接口，转发给 OMA
- [ ] 创建 `package.json` — 依赖 `open-multi-agent`
- [ ] 单测: adapter 协议转换正确

### 2.2 前后端测试

- [ ] Playwright: Agent Team 调度端到端（通过 chat 调 OMA）
- [ ] 集成: OMA 多 Agent 协作结果正确回流

### 2.3 DAG 任务拆解能力集成 (2026-06-23 新增)

> **关联专题**: `白泽baize-oma-DAG集成方案-20260623.html §3` HTTP 接口设计 + §5 实施路径

- [ ] 创建 `src/decomposer.ts` — Decomposer 类 (~150 行), 调 OpenMultiAgent 跑拆解
- [ ] 创建 `src/routes/decompose.ts` — `/oma.team.create` 路由 (~50 行)
- [ ] 修改 `src/server.ts` — 注册新路由 (挂载 `/oma.team.create`)
- [ ] 修改 `slot.json` — `version: "0.2.0"`, capabilities 加 `task.decompose`
- [ ] 新增 `src/__tests__/decomposer.test.ts` — Decomposer 单测
- [ ] 新增 `tests/integration/oma-decompose.test.mjs` — 集成测试 (mock baize-switch)

**HTTP 接口规范** (新增):
```
POST baize-oma:20060/oma.team.create
请求: { name, agents[{name, model, systemPrompt}], input, options{depth, maxDepth} }
响应: { taskDag{ nodes[{id,title,description,agentRole,dependsOn}], edges }, meta{teamId, decomposedAt, decomposerModel, durationMs} }
```

## 3. 验收

- [ ] adapter 单测通过
- [ ] OMA 源码未被修改
- [ ] 前端无回归

## 4. 2026-06-23 拍板的 3 项关键决策

### 决策 1: 新增 capability `task.decompose` (扩展现有 `chat.agent.team.schedule`)

**当前 slot.json**:
```json
{
  "id": "baize-oma",
  "version": "0.1.0",
  "type": "http",
  "entry": { "http": { "baseUrl": "http://127.0.0.1:20060", "healthPath": "/health" } },
  "capabilities": [
    "chat.agent.team.schedule",
    "chat.loop.execute"
  ]
}
```

**新增 capability 后**:
```json
{
  "id": "baize-oma",
  "version": "0.2.0",  // bump version
  "capabilities": [
    "task.decompose",  // 🆕 新增 (DAG 任务拆解)
    "chat.agent.team.schedule",
    "chat.loop.execute"
  ]
}
```

### 决策 2: 进程内 `OMADecomposer` 类不删, 加 @deprecated

**位置**: `baize-loop/src/loop/oma-client.ts:26` (397 行)

**保留原因**:
- 主控仓测试 (`oma-engine-extract-reasoning.test.ts`) 仍依赖
- 历史兼容 (baize-loop 老 chat 流程可能用)
- 一次性删除风险大 (12-rollout "不删老 baize-loop" 约束)

**最终处置** (2026-12 后评估):
- 满足条件 → 删 `src/loop/oma-client.ts` 的 OMADecomposer 类
- 不满足 → 保留, 但加 `@deprecated` 注释 (建议改用 baize-oma HTTP 拆解)

### 决策 3: 本仓职责边界 (跟 baize-chat 仓的协议)

| 职责 | 属于 baize-oma | 属于 baize-chat | 属于 baize-switch |
|------|---------------|----------------|-----------------|
| 收用户输入 + 拆解成 DAG | ✅ | ❌ | ❌ |
| 调 LLM 拆解 | ✅ | ❌ | ❌ |
| 暴露 `/oma.team.create` HTTP 端点 | ✅ | ❌ | ❌ |
| 跑拓扑调度 (runTasks) | ✅ | ❌ | ❌ |
| coordinator 综合 | ✅ | ❌ | ❌ |
| LLM 流式输出 (基础) | ✅ | ❌ | ✅ (基础设施) |
| 转 omaTasks + 委派给 oma | ❌ | ✅ | ❌ |
| 推前端 (WS 帧) | ❌ | ✅ | ❌ |
| 渲染 widget | ❌ | ✅ | ❌ |

**关键约束**: **baize-chat 仓不写真 DAG 拆解**, 通过 HTTP 调本仓 `/oma.team.create` 拿 DAG。

## 5. 实施时间表 (与 baize-chat 仓同步)

| 阶段 | 时间 | 任务 | 仓 |
|------|------|------|-----|
| 阶段 1 (本期范围, 1-2 天) | 2026-06-23 | 文档同步 (本文件 + README + slot.json 加注释) | baize-oma |
| 阶段 2 (1 周) | M3 | 写真 `src/decomposer.ts` + `src/routes/decompose.ts` + 单测 | baize-oma |
| 阶段 3 (M3 同步) | M3 | 写真业务 (本仓 scheduler.ts + emitter.ts 增强) + baize-chat 写真 oma-adapter | baize-oma + baize-chat |
| 阶段 4 (2026-12 后) | 评估后 | 删进程内 `OMADecomposer` 类 (主控仓) | baize-loop |

## 6. 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| oma.decompose 失败率高 (LLM 拆解不准) | 用户体验差, 任务分配乱 | 加 fallback: 拆解失败时直接走 quick 模式 |
| 进程内 OMADecomposer 与 baize-oma decompose 不一致 | 测试混乱 | 写真 /oma.team.create 后, 给进程内类加 @deprecated |
| 递归深拆爆炸 (maxDepth=3 拆出上千节点) | 性能问题 | 加 hard limit (maxNodes=6, maxDepth=3) |
| baize-switch 网关挂掉 | oma.decompose 全部失败 | 加熔断 + 重试 + 报错降级 |

---

**最后更新**: 2026-06-23 22:10 UTC+8
**维护者**: BaiZe 架构