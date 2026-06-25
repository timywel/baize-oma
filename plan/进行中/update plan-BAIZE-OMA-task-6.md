# update plan-BAIZE-OMA-task-6 — baize-oma Phase 6 仓内继续优化（覆盖率 + CI build）

> **PLAN**: [/home/timywel/AI_Product/baize-slot/baize-oma/plan/待完成/PLAN-BAIZE-OMA-PHASE5-20260625-004200.md](../../待完成/PLAN-BAIZE-OMA-PHASE5-20260625-004200.md) (v1.0, Phase 5 收口, P6 延伸)
> **Task 配对 JSON**: [update plan-BAIZE-OMA-task-6.json](./update plan-BAIZE-OMA-task-6.json)
> **上一轮**: [task-5.md](./update plan-BAIZE-OMA-task-5.md) (Phase 5 completed, tag v0.3.0)
> **作者**: BaiZe 架构
> **创建**: 2026-06-25T01:05:00+08:00
> **本轮 scope**: `/home/timywel/AI_Product/baize-slot/baize-oma/` (子项目仓内)
> **会话归属**: 本计划在 baize-oma 子项目仓内推进

---

## 0. 上下文

Phase 5 已收口 (tag baize-oma-v0.3.0, 5 commits, 80.24% coverage).

本轮按用户指令"逐步推进 baize-oma 仓内优化", 从 6 个候选方向里选 2 个:
- **#1 覆盖率 80% → 85%** — 补 src/llm/client.ts 单测 (mock fetch)
- **#2 CI 加 pnpm build 步骤** — 关闭 GAP-6 (dist/ 提交但 CI 未验证)

不涉及跨仓 (baize-chat / baize-switch 联调仍延后).

---

## 1. 任务清单 (T6.1~T6.4)

- [ ] **T6.1** 新建 `src/__tests__/llm-client.test.ts` (~150 行, ~5 case)
- [ ] **T6.2** 修改 `vitest.config.ts` 加入 `src/llm/client.ts` 到 include 列表
- [ ] **T6.3** 修改 `.github/workflows/ci.yml` 加 `pnpm build` 步骤
- [ ] **T6.4** git commit + tag baize-oma-v0.3.1

**估计**: ~230 行, 1 session (~15 min)

---

## 2. 关键技术点

### 2.1 llm-client 测试设计

`src/llm/client.ts` 暴露两个函数:
- `chatCompletion(req: ChatRequest): Promise<ChatResponse>` — POST `/v1/messages`, 指数退避重试 (1s/2s/4s, 最多 3 次), 4xx 不重试, 30s 超时
- `embedding(req: EmbeddingRequest): Promise<EmbeddingResponse>` — POST `/v1/embeddings`, 1~96 输入

测试 case 规划 (5):
1. **chat 成功路径**: mock fetch 返 200 + 合法 body → 返 ChatResponse
2. **chat 校验失败**: 缺 model → 抛 LlmClientError 400 (无 fetch)
3. **chat 重试 + 4xx 不重试**: mock fetch 返 400 → 立即抛 LlmClientError, 不重试
4. **chat 网络错误重试**: mock fetch 抛 Error → 3 次重试后抛 LlmClientError
5. **embedding 成功**: mock fetch 返 200 → 返 EmbeddingResponse

**Mock 方案**: `vi.stubGlobal('fetch', vi.fn(...))`, 全局 mock fetch, 避免污染网络.

### 2.2 CI build 步骤

`.github/workflows/ci.yml` 当前 3 步 (lint / test:coverage / smoke). 加 build:

```yaml
      - name: Build (tsc)
        run: pnpm build
```

放在 lint 后, test 前 (build 失败说明类型错误, 先暴露).

---

## 3. 估计

| Task | 行数 | 耗时 |
|------|------|------|
| T6.1 llm-client 单测 | ~150 | 5 min |
| T6.2 vitest config | ~5 | 1 min |
| T6.3 CI build | ~5 | 1 min |
| T6.4 commit + tag | - | 2 min |
| **总计** | **~160** | **~10 min** |

---

## 4. 风险

| 风险 | 等级 | 说明 |
|------|------|------|
| LLM client mock 不稳定 | 中 | fetch 是全局, 测试间可能状态泄漏, 需 vi.unstubAllMocks() |
| vitest 8 覆盖率配置改动 | 低 | 仅 include/exclude 调整 |
| CI build 失败 | 低 | dist/ 已有产物, build 应通过 |

---

## 5. 完成定义

- [ ] pnpm test:coverage ≥ 85% 全局
- [ ] llm-client.test.ts 5 case 全过
- [ ] vitest.config.ts 把 src/llm/client.ts 加进 include
- [ ] ci.yml 加 pnpm build 步骤
- [ ] pnpm lint + pnpm test + pnpm test:smoke 全过
- [ ] git tag baize-oma-v0.3.1

---

## 6. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-25T01:05:00+08:00 | 初版。覆盖率 + CI build 2 个方向 |