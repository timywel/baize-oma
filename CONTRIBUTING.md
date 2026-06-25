# Contributing to baize-oma

> **baize-oma** — baize-loop 的 OMA Agent 调度子系统 (http slot, 端口 20060).
> **协议**: MIT (见 [LICENSE](LICENSE)).

感谢你考虑为 baize-oma 贡献! 提交 PR 前请通读本指南.

---

## 1. 快速开始

```bash
# 1. 克隆
git clone <repo-url>
cd baize-oma

# 2. 安装依赖 (含 patch-package 自动 apply 已有 patch)
pnpm install

# 3. 跑测试基线
pnpm test            # 33/33 pass
pnpm test:coverage   # ≥ 64% (P5 目标 75%)
pnpm lint            # 0 error

# 4. 启动 server
pnpm dev             # 监听 http://127.0.0.1:20060

# 5. 跑烟测 (新终端)
pnpm test:smoke      # 16/16 pass
```

---

## 2. 提交规范

### 2.1 Commit message 格式

遵循 [Conventional Commits](https://www.conventionalcommits.org/), 中文可选:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**type 枚举**:

| Type | 用途 | 触发版本 |
|------|------|----------|
| `feat` | 新功能 | MINOR (0.x.0) |
| `fix` | Bug 修复 | PATCH (0.0.x) |
| `docs` | 文档变更 (无代码) | 无 |
| `refactor` | 重构 (无新功能/无 bug 修复) | 无 |
| `perf` | 性能优化 | PATCH |
| `test` | 测试补全/修改 | 无 |
| `chore` | 工具/构建/CI | 无 |
| `deps` | 依赖升级 | PATCH (如有破坏性: MINOR) |
| `revert` | 回滚 commit | 无 |

**scope 枚举** (baize-oma 仓):

| Scope | 模块 |
|-------|------|
| `oma` | 通用 |
| `routes` | `src/routes/*` |
| `decomposer` | `src/decomposer/*` |
| `dag` | `src/dag/*` |
| `llm` | `src/llm/*` |
| `vendor` | `vendor/open-multi-agent/*` (极少) |
| `plan` | `plan/*` |
| `docs` | 文档 |

### 2.2 Commit 粒度

- 单 commit = 单职责
- 单 task ≈ 100 行, 接受 ~300 行, 超出 1000 行必须拆分 (见 CLAUDE.md §9.3)
- 多个 commit 之间系统应可工作

### 2.3 示例

```bash
feat(routes): 加 /dag.execute 路由 (Phase 3)

新增 src/routes/dag-execute.ts (215 行):
- POST /dag.execute 走真 DAG executor
- POST /dag.visualize 纯可视化 (debug)
- 错误码: 400 INVALID_REQUEST / 400 CYCLE_DETECTED / 500 DAG_EXECUTE_FAILED

PLAN: PLAN-BAIZE-OMA-SELF-AUDIT §Phase 3
```

---

## 3. 验证清单 (PR 提交前必跑)

### 3.1 本地验证 (必跑)

```bash
pnpm install        # 无 error
pnpm lint           # 0 error (strict mode)
pnpm test           # 33/33 pass
pnpm test:coverage  # 全局 ≥ 64% (P5 目标 75%)
```

### 3.2 烟测 (涉及路由改动必跑)

```bash
pnpm dev &          # 启动 server
sleep 5             # 等待 ready
pnpm test:smoke     # 16/16 pass
```

### 3.3 跨仓影响 (涉及 LLM/能力改动必填)

- [ ] 已读 `src/llm/client.ts` — 确认走 baize-switch 20030 `/v1/messages`
- [ ] 已读 `slot.json` `capabilities` 数组 — 改动已同步
- [ ] 已读 baize-loop `HttpSlotAdapter` 协议 — 向后兼容

---

## 4. 代码风格

### 4.1 TypeScript

- 严格模式 (`strict: true` in `tsconfig.json`)
- `camelCase` 变量/函数, `PascalCase` 类型, `kebab-case` 文件名
- 异步优先 `async/await`, 不用 callback
- 错误处理 `try/catch` + 标准 HTTP code, 不 panic
- 不使用 `any` (除显式 `as unknown`)

### 4.2 测试

- Vitest 框架 (`src/__tests__/`)
- 中文 describe/it 描述
- 真实业务用例 + 错误路径覆盖
- 覆盖率门禁 ≥ 75% (P5 目标)

### 4.3 文档

- 中文优先 (CLAUDE.md §i18n)
- README.md (AI 版) + README.html (人类版) 同步更新
- 新 capability / env / 路由必加进 README.html
- 计划文档: `plan/{待完成,进行中,已完成}/` 三态维护

---

## 5. 关键文件 (提交前必读)

- [CLAUDE.md](CLAUDE.md) — 项目总览 + 用户核心规则
- [INDEX.md](INDEX.md) — 仓索引 (源码 + 计划 + 测试 + 集成)
- [README.html](README.html) — 人类版仓说明
- [plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md](plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md) — 主计划
- [plan/待完成/PLAN-BAIZE-OMA-PHASE5-20260625-004200.md](plan/待完成/PLAN-BAIZE-OMA-PHASE5-20260625-004200.md) — Phase 5 计划

---

## 6. 常见任务

### 6.1 加新 capability

1. 在 `slot.json` `capabilities` 数组加新条目
2. 在 `src/routes/` 新建 `<capability>.ts` (沿用既有 router 风格)
3. 在 `src/server.ts` `app.use(<capability>Router)` 注册
4. 在 `src/__tests__/` 加路由测试 (≥ 3 case)
5. 在 `README.html` §5 加 curl 示例
6. 跑 `pnpm test:smoke` 验证

### 6.2 升级 vendor/open-multi-agent/

```bash
# 1. 改 vendor 内的源码 (本地 dev)
# 2. 生成 patch
npx patch-package @open-multi-agent/core
# → 生成 patches/@open-multi-agent+core+1.8.0.patch

# 3. 上游升级
npm install @open-multi-agent/core@1.9.0
# → postinstall 自动重打 patch (如冲突会报错, 手动 rebase)

# 4. 验证
pnpm test           # 全过 (vendor 修改被 patch 覆盖)
pnpm lint           # 0 error
```

**注意**: 不要直接 commit `vendor/open-multi-agent/` 内部源码 (走 patch-package).

### 6.3 修 bug

1. 写复现测试 (失败用例) — 走 `pnpm test` 验证失败
2. 改代码 — 走 `pnpm test` 验证通过
3. 跑 `pnpm test:coverage` 确认覆盖率未下降
4. 更新 `plan/进行中/update plan-BAIZE-OMA-task-N.{md,json}` 状态
5. git commit 走 `fix(<scope>): <subject>` 格式

---

## 7. Code of Conduct

本项目遵循 [Contributor Covenant](https://www.contributor-covenant.org/) (中文翻译见 [CONTRIBUTOR_COVENANT_CODE_OF_CONDUCT.md](https://github.com/ContributorCovenant/contributor_covenant/blob/master/code-of-conduct.md)).

---

## 8. 问题反馈

- Bug: GitHub Issues
- 安全漏洞: 邮件 <timywel@163.com> (私密)
- 讨论: 内部 Slack #baize-oma 频道

---

**最后更新**: 2026-06-25 (Phase 5 P5.1 落地)
