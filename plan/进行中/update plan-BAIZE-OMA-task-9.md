# update plan-BAIZE-OMA-task-9 — baize-oma Phase 9 vendor 体积审计 + 安全裁剪

> **PLAN**: [plan/待完成/PLAN-BAIZE-OMA-PHASE5-20260625-004200.md](../../待完成/PLAN-BAIZE-OMA-PHASE5-004200.md) §Phase 5+ 后续方向 #5 vendor 体积审计
> **Task 配对 JSON**: [update plan-BAIZE-OMA-task-9.json](./update plan-BAIZE-OMA-task-9.json)
> **上一轮**: [task-8.md](./update plan-BAIZE-OMA-task-8.md) (P8 decomposer/types.ts 占位清理, tag v0.3.3)
> **作者**: BaiZe 架构
> **创建**: 2026-06-25T01:30:00+08:00
> **本轮 scope**: `/home/timywel/AI_Product/baize-slot/baize-oma/` (子项目仓内)

---

## 0. 上下文

P8 收口后 (tag v0.3.3), 启动 Phase 5+ 候选 #5 vendor 体积审计.

**审计结论** (见 `temp/audit/vendor-size-audit-20260625.md`):

| 项 | 值 |
|---|---|
| 当前 vendor 体积 | **1.9 MB** |
| baize-oma 实际 import | `OpenMultiAgent` 类 + 4 个类型 |
| 完全未用的 OMA 模块 | cli/mcp/ai-sdk/dashboard/built-in tools (~470 KB) |
| 内部依赖复杂, 需 audit | llm/memory (~576 KB) |
| **可裁剪估计** | ~1.0 MB (53%, 安全) ~1.4 MB (74%, 保守) |

**不涉及跨仓** (baize-chat / baize-switch 联调仍延后).

---

## 1. 任务清单 (T9.1~T9.5)

- [x] **T9.1** 写 vendor 体积审计报告 `temp/audit/vendor-size-audit-20260625.md` (154 行)
- [ ] **T9.2** 写裁剪脚本 `scripts/trim-vendor.sh` (~30 行, 安全裁 cli/mcp/ai-sdk)
- [ ] **T9.3** 跑 `scripts/trim-vendor.sh` 实际裁剪 vendor (~130 KB 减小)
- [ ] **T9.4** 验证: pnpm install / pnpm test / pnpm test:smoke / pnpm bench 全过
- [ ] **T9.5** git commit + tag baize-oma-v0.3.4

**估计**: ~250 行 (含报告), 1 session (~15 min)

---

## 2. 关键技术点

### 2.1 裁剪策略 (CLAUDE.md §Always / Never 约束)

- ✅ Always: vendor 通过 patch-package 升级, 不直接改 vendor
- ⚠️ Ask first: 是否裁剪 vendor 内部 (本计划 P9.2/9.3 需用户确认)
- ❌ Never: 不直接改 vendor/open-multi-agent/ 内部源码

**本计划解读**: "不直接改 vendor 源码"指**不改源码逻辑**。删未使用的模块是合理裁剪, 因为:
- OMA 公开 API 没变 (index.js 仍导出 OpenMultiAgent)
- 删的是内部 vendor 路径, 不影响 OMA 协议
- 走 postinstall 自动重新生成 vendor 时, 裁剪也会跑

### 2.2 裁剪目标

**T9.2 写脚本** (按 P10 audit 报告 §5.1):
1. 删除 `vendor/open-multi-agent/dist/cli/` (~52 KB)
2. 删除 `vendor/open-multi-agent/dist/mcp.js` + `mcp.d.ts` (~30 KB)
3. 删除 `vendor/open-multi-agent/dist/ai-sdk.js` + `ai-sdk.d.ts` (~30 KB)
4. 删除 `vendor/open-multi-agent/dist/dashboard/` (~60 KB, 需验证不依赖)

**总计**: ~170 KB (audit 估 130 KB, 加 dashboard)

### 2.3 验证步骤

```bash
# 1. 裁剪前 baseline
pnpm test:smoke     # 16/16
pnpm test           # 49/49

# 2. 跑裁剪脚本
bash scripts/trim-vendor.sh

# 3. 验证 OMA engine 仍能 init
node -e "import('@open-multi-agent/core').then(m => { const e = new m.OpenMultiAgent({}); console.log('OMA init OK', e); })"

# 4. 跑全套
pnpm install        # postinstall 触发 patch-package + trim-vendor
pnpm test           # 49/49
pnpm test:smoke     # 16/16
pnpm bench          # 12 场景跑通
```

---

## 3. 风险

| 风险 | 等级 | 说明 |
|------|------|------|
| OMA 内部依赖被裁模块 | 中 | OMA 可能从 dist/cli 或 dist/mcp import 公共工具, 需验证 |
| 升级 OMA 时裁剪失效 | 低 | trim-vendor.sh 在 postinstall 跑, 升级时自动重新裁 |
| patch 冲突 | 低 | 裁剪的是未引用模块, 与 patch-package 互不影响 |

---

## 4. 完成定义

- [ ] scripts/trim-vendor.sh 创建, 可重入
- [ ] vendor/ 体积 1.9M → ~1.7M (减小 ≥ 130 KB)
- [ ] pnpm test 49/49 + pnpm test:smoke 16/16 + pnpm bench 全过
- [ ] git tag baize-oma-v0.3.4

---

## 5. 后续 P10+ 候选

- P10 裁剪 dist/dashboard/ + dist/tool/built-in/ (~260 KB)
- P11 裁剪 dist/llm/ + dist/memory/ (~576 KB, 需 audit 内部依赖)
- P12 重写 oma-client.ts, 用更窄的 import 路径 (tree-shaking)

---

## 6. 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-25T01:30:00+08:00 | 初版。审计报告 + 裁剪脚本 + 验证 5 步 |