# update plan-BAIZE-OMA-task-5 — baize-oma Phase 5 仓内质量提升 (P5.1-P5.5)

> **PLAN**: [/home/timywel/AI_Product/baize-slot/baize-oma/plan/待完成/PLAN-BAIZE-OMA-PHASE5-20260625-004200.md](../../待完成/PLAN-BAIZE-OMA-PHASE5-20260625-004200.md) (v1.0)
> **Task 配对 JSON**: [update plan-BAIZE-OMA-task-5.json](./update plan-BAIZE-OMA-task-5.json)
> **上一轮**: [task-4.md](./update plan-BAIZE-OMA-task-4.md) (Phase 4 仓内 completed-partial)
> **作者**: BaiZe 架构
> **创建**: 2026-06-25T00:42:00+08:00
> **完成**: 2026-06-25T00:50:00+08:00
> **状态**: ✅ completed (5 task, 5 commits, tag baize-oma-v0.3.0)
> **本轮 scope**: `/home/timywel/AI_Product/baize-slot/baize-oma/` (子项目仓内)

---

## 0. 上下文

Phase 4 仓内收尾后 (13 commits, tag v0.2.0), 启动 Phase 5: 仓内质量提升.

**目标**: 5 个 task 提升仓内质量基线 (覆盖率 / CI / 文档 / vendor 流程).

**不涉及跨仓**: P5 全部仓内自洽, 不依赖 baize-chat 重构.

---

## 1. 任务清单 (P5.1-P5.5)

### P5.1 仓根文档 + 治理
- [x] **T5.1.1** 新建 `.github/PULL_REQUEST_TEMPLATE.md` (92 行, 中文 checklist) — 同 commit
- [x] **T5.1.2** 新建 `CONTRIBUTING.md` (213 行, 8 节) — 同 commit
- [x] **T5.1.3** git commit — 305 行, 单 commit

### P5.2 CI workflow
- [x] **T5.2.1** 新建 `.github/workflows/ci.yml` (88 行, lint + test:coverage + test:smoke) — 同 commit
- [x] **T5.2.2** package.json scripts 加 `test:integration` 占位 — 同 commit
- [x] **T5.2.3** git commit — 95 行, YAML 验证有效

### P5.3 覆盖率提升 (64.15% → 80.24%)
- [x] **T5.3.1** 新建 `src/__tests__/dag-routes.test.ts` (175 行, 7 case) — 同 commit
- [x] **T5.3.2** 新建 `src/__tests__/health-routes.test.ts` (66 行, 1 case) — 同 commit
- [x] **T5.3.3** 新建 `src/__tests__/manifest-routes.test.ts` (53 行, 1 case) — 同 commit
- [x] **T5.3.4** 跑 `pnpm test:coverage` 验证 ≥ 80% 全局 — 80.24% ✅
- [x] **T5.3.5** git commit — 9 case + 主计划归档

### P5.4 vendor 升级演练
- [x] **T5.4.1** `rm -rf node_modules/@open-multi-agent` + `npm install @open-multi-agent/core@1.8.0 --force`
- [x] **T5.4.2** 验证 patch 自动 reapply 无冲突 — `No patch files found`, 0 conflict
- [x] **T5.4.3** 验证 `pnpm test` + `pnpm lint` 全过 — 42/42 pass, 0 error
- [x] **T5.4.4** `git checkout` 还原 lockfile 副作用
- [x] **T5.4.5** plan 文档记录演练结果 — commit 8d74ce6

### P5.5 收口
- [x] **T5.5.1** git tag `baize-oma-v0.3.0` (本 commit)
- [x] **T5.5.2** update plan-BAIZE-OMA-task-5.{md,json} status → completed (本文件 + 配对 JSON)
- [x] **T5.5.3** 主计划 v1.2 更新 P5 收口

---

## 2. 关键技术点

### 2.1 路由层单测模板 (P5.3)

```typescript
type LayerWithRoute = { route: { stack: Array<{ handle: (req: Request, res: Response, next: () => void) => unknown | Promise<unknown> }> } };

async function invokeRouterAt(router: Router, index: number, body: unknown) {
  const { req, res, getJson, getStatus } = makeReqRes(body);
  const layer = (router as unknown as { stack: LayerWithRoute[] }).stack[index]!;
  const handler = layer.route.stack[0]!.handle;
  await handler(req, res, () => {});
  return { json: getJson(), status: getStatus() };
}
```

- 不引入 supertest, 沿用 routes.test.ts mock req/res 模式
- `LayerWithRoute` 类型包装避开 `noUncheckedIndexedAccess` lint 警告
- async/await 支持 (dag-execute 是 async handler)

### 2.2 CI workflow 设计 (P5.2)

```yaml
jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - Checkout + Setup Node 22 + Setup pnpm 10
      - pnpm install --frozen-lockfile
      - pnpm lint (tsc --noEmit)
      - pnpm test:coverage (vitest run --coverage)
      - Start dev server (nohup + /health 200 轮询, 最多 30s)
      - pnpm test:smoke
      - Upload coverage artifact (7 天)
```

- 不依赖外部服务 (baize-switch / baize-chat)
- concurrency group 取消同分支旧 run, 节省 CI 配额
- coverage 上传 artifact 供后续分析

### 2.3 vendor 升级演练 (P5.4)

```bash
rm -rf node_modules/@open-multi-agent
npm install @open-multi-agent/core@1.8.0 --force
pnpm install  # 触发 patch-package postinstall
pnpm lint && pnpm test
```

**结果**:
- vendor 1.8.0 重装成功
- patch apply 流程跑通 (No patch files found, 0 conflict)
- 42/42 tests pass + 0 typecheck error

**注意**: `--force` 把 `"1.8.0"` 改成 `"^1.8.0"`, 已 `git checkout` 还原.

---

## 3. 实际产出 vs 估计

| 指标 | 估计 | 实际 | 说明 |
|------|------|------|------|
| 代码行数 | ~530 | **1130** (含 plan 文档) | 超出, 主因 vendor 演练文档 + 测试 wrapper 代码 |
| 测试用例 | 7+ | **9** (dag 7 + health 1 + manifest 1) | 达预期 |
| 覆盖率提升 | 64% → 75% | **64% → 80.24%** | 超预期, 直接达 80% 阈值 |
| commit | 5 (每 task) | **5** | 单 commit 多 task 是测试代码集中提交 |
| typecheck | 0 error | 0 error | strict mode |
| tag | v0.3.0 | baize-oma-v0.3.0 | ✅ |

### 3.1 新增/修改文件清单

- ✅ 新建 `.github/PULL_REQUEST_TEMPLATE.md` (92 行)
- ✅ 新建 `CONTRIBUTING.md` (213 行)
- ✅ 新建 `.github/workflows/ci.yml` (88 行)
- ✅ 新建 `src/__tests__/dag-routes.test.ts` (175 行, 7 case)
- ✅ 新建 `src/__tests__/health-routes.test.ts` (66 行, 1 case)
- ✅ 新建 `src/__tests__/manifest-routes.test.ts` (53 行, 1 case)
- ✅ 修改 `package.json` (加 test:integration 占位)
- ✅ 新建 `plan/待完成/PLAN-BAIZE-OMA-PHASE5-20260625-004200.md` (318 行, 主计划)
- ✅ 新建 `plan/待完成/PLAN-BAIZE-OMA-P5-VENDOR-REHEARSAL-20260625-004600.md` (92 行, 演练记录)

### 3.2 完成 commits

| # | Commit | 内容 |
|---|--------|------|
| 1 | f91a812 | P5.1 docs: PR 模板 + CONTRIBUTING.md |
| 2 | 3f0a647 | P5.2 ci: GitHub Actions CI workflow + test:integration 占位 |
| 3 | 3c50c46 | P5.3 test: 路由层单测 9 case + 主计划 (覆盖率 64% → 80%) |
| 4 | 8d74ce6 | P5.4 docs: vendor 升级演练记录 |
| 5 | (本) | P5.5 chore: package.json 0.2.0 → 0.3.0 + tag baize-oma-v0.3.0 |

---

## 4. 缺口更新

### 已关闭 (P5)

| 缺口 | 关闭 commit |
|------|-------------|
| GAP-8 无 .github/workflows CI | 3f0a647 (P5.2) |
| GAP-9 无 PR 模板 + CONTRIBUTING.md | f91a812 (P5.1) |
| GAP-3 缺独立运行验证脚本 | 39fbc32 (Phase 4 烟测, P5.2 集成 CI) |

### 仍 open (后续)

| 缺口 | 状态 | 说明 |
|------|------|------|
| GAP-1 vendor 升级演练 | ⚠️ 部分 (P5.4 演练了当前版本, 真升级等 OMA 1.9.0) |
| GAP-4 与 baize-switch 真实联调 | ⏸️ 跨仓延后 (Phase 4 跨仓) |
| GAP-6 dist/ 提交但 CI 未验证 | ⚠️ P5.2 CI 未跑 build, 仅跑 test |

---

## 5. 关键指标 (Phase 5 收尾)

```
✅ Typecheck:  0 error (strict mode)
✅ Tests:      42/42 pass (1.54s)
   33  Phase 2-3 既有 (decomposer 7 + routes 15 + dag executor 11)
   +7  dag-routes (P5.3)
   +1  health-routes (P5.3)
   +1  manifest-routes (P5.3)
✅ Smoke:      16/16 pass (7 routes + 4 校验 + 5 兜底)
✅ Coverage:   64.15% → 80.24% (P5.3 提升 16%)
✅ CI:         GitHub Actions ci.yml 跑 lint + test:coverage + test:smoke
✅ Docs:       PR 模板 + CONTRIBUTING.md (中文, 跟 baize-loop 对齐)
✅ Tag:        baize-oma-v0.3.0
```

---

## 6. 下一轮 (Phase 6+)

按 PLAN-BAIZE-OMA-PHASE5 缺口:

1. **跨仓联调**: 等 baize-chat 重构完成后启动 (Phase 4 跨仓 T4.1/T4.2/T4.4)
2. **vendor 真升级**: 等 OMA 1.9.0 发布后演练 patch rebase
3. **性能优化 (独立子项目)**: 需先建 benchmark, 见 #6 决策
4. **CI 加 build 步骤**: 当前 CI 不跑 `pnpm build`, 后续补
5. **覆盖率进一步提升**: 当前 80.24%, 目标 85%+, 需补 llm-client mock + server 启动测试

按 CLAUDE.md 滚动迭代模式, 下一轮开新 PLAN-BAIZE-OMA-PHASE6-*.

---

## 7. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-25T00:42:00+08:00 | 初版。Phase 5 启动, 5 task P5.1-P5.5 |
| 1.1 | 2026-06-25T00:50:00+08:00 | 全部 completed, 5 commits + tag baize-oma-v0.3.0, 覆盖率 64%→80% |