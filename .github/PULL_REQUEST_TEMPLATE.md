<!--
baize-oma 仓 PR 模板 (2026-06-25 建立).
中文优先, 跟 baize-loop 主仓 PR 模板对齐风格.
-->

## 变更类型 (勾选)

- [ ] 🐛 Bug 修复 (`fix`)
- [ ] ✨ 新功能 (`feat`)
- [ ] 📝 文档 (`docs`)
- [ ] ♻️ 重构 (`refactor`)
- [ ] ⚡ 性能优化 (`perf`)
- [ ] ✅ 测试 (`test`)
- [ ] 🔧 工具/构建 (`chore`)
- [ ] ⬆️ 依赖升级 (`deps`)

## 变更说明 (必填)

### 改了什么

<!-- 简述本 PR 改动的核心内容 -->

### 为什么改

<!-- 解决的问题 / 引入的原因 -->

### 是否破坏性变更

- [ ] 否 (向后兼容)
- [ ] 是 (需说明 + 更新 slot.json `allowBreakingVersion`)

## 关联文档 (必填)

<!-- 至少勾选一项 -->

- [ ] 主计划: `plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md`
- [ ] 主计划: `plan/待完成/PLAN-BAIZE-OMA-PHASE5-20260625-004200.md`
- [ ] 滚动迭代: `plan/进行中/update plan-BAIZE-OMA-task-N.md`
- [ ] 架构文档: `docs/...` (路径: ___________)
- [ ] 无 (纯代码改动)

## 验证步骤 (必填, 全部勾选)

### 本地验证

- [ ] `pnpm install` 无 error
- [ ] `pnpm lint` 0 error
- [ ] `pnpm test` 全过 (33/33 pass 基线)
- [ ] `pnpm test:coverage` 覆盖率 ≥ 75% 全局
- [ ] `pnpm dev & sleep 5 && pnpm test:smoke` 全过 (16/16 pass 基线)

### 新功能验证 (如适用)

- [ ] 新增路由的 curl 示例已写入 README.html §5 烟测示例
- [ ] 新增 capability 已同步到 slot.json `capabilities` 数组
- [ ] 新增 env 变量已写入 README.html §4 环境变量表
- [ ] 新增测试 case (描述): ___________

### 跨仓影响 (如适用)

- [ ] 影响 baize-switch (LLM 路由) — 已联调验证
- [ ] 影响 baize-chat (业务触发) — 已联调验证
- [ ] 影响 baize-loop 主仓 (HttpSlotAdapter) — 协议层兼容
- [ ] 无跨仓影响

## Commit 列表 (必填)

<!-- 本 PR 涉及的 git commit, 单条一行 -->

```
<hash>  <type>(<scope>): <subject>
```

例:
```
81b0e1b  feat(oma): 接入占位 stub - /health 改用 router + /manifest 路由补齐
39fbc32  test(oma): T4.4 curl 烟测脚本 - 覆盖 7 routes + 404 兜底
```

## Checklist (提交前自检, 全部勾选)

- [ ] 本 PR 改动 < 1000 行 (超出需拆分, 见 CLAUDE.md §9.3)
- [ ] 没有引入未使用的 import / 变量
- [ ] 没有改动 `vendor/open-multi-agent/` 内部源码 (走 patch-package)
- [ ] 没有删除或注释掉测试 (`__tests__/`)
- [ ] 没有提交密钥 / API key / 个人 token
- [ ] 已跟 main 分支 rebase (无 merge commit)
- [ ] 已跑过 `pnpm test:smoke` (本地启 server 验证 7 routes)

## 备注 (可选)

<!-- 任何 reviewer 需要知道的背景信息 -->
