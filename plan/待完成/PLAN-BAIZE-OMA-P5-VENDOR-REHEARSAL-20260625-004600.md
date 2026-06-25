# PLAN-BAIZE-OMA-P5-VENDOR-REHEARSAL-20260625-004600 — vendor 升级演练记录

> **父计划**: [PLAN-BAIZE-OMA-PHASE5-20260625-004200.md](../../待完成/PLAN-BAIZE-OMA-PHASE5-20260625-004200.md) §P5.4
> **作者**: BaiZe 架构
> **演练日期**: 2026-06-25T00:46:00+08:00
> **结论**: ✅ 通过

---

## 演练目标

验证 baize-oma vendor 工作流：OMA 1.8.0 重装 + patch-package 自动 apply + 测试/类型检查全过。

由于 OMA 上游 `@open-multi-agent/core` 最高版本为 1.8.0（npm registry 2026-06-25 查询），1.9.0 暂未发布。演练改为"重装当前版本"，验证 patch 流程而非真正升级。

---

## 演练步骤

### Step 1: 重装 OMA 1.8.0（force 重装以触发 postinstall）

```bash
rm -rf node_modules/@open-multi-agent
npm install @open-multi-agent/core@1.8.0 --force --silent
```

**结果**:
- ✅ `node_modules/@open-multi-agent/core/` 重建
- ✅ vendor version 校验: `1.8.0` (`node_modules/@open-multi-agent/core/package.json`)
- ⚠️ **副作用**: npm 把 `"1.8.0"` 改成 `"^1.8.0"` 在 `package.json`. 已 `git checkout package.json` 还原
- ⚠️ `package-lock.json` 和 `pnpm-lock.yaml` 也有 diff, 已 `git checkout` 还原

### Step 2: pnpm install 触发 patch-package postinstall

```bash
pnpm install
```

**结果**:
```
patch-package 8.0.1
Applying patches...
No patch files found
Done in 1s using pnpm v10.29.0
```

- ✅ postinstall 钩子触发
- ✅ "No patch files found" — 因为 `patches/` 目录为空（OMA 1.8.0 当前未做任何本地修改）
- ✅ 0 conflict

### Step 3: 验证 vendor 修改被覆盖（如有）

理论上: 如果 `patches/@open-multi-agent+core+1.8.0.patch` 存在, patch-package 会自动 apply 到 `node_modules/`, 让 vendor 修改生效.

**当前状态**: 0 patch, 0 修改, 验证流程跑通即可.

### Step 4: 测试 + 类型检查全跑

```bash
pnpm lint        # tsc --noEmit
pnpm test        # vitest run
```

**结果**:
- ✅ lint: 0 error (strict mode)
- ✅ test: 42/42 pass (6 test files)
- ✅ Duration: 1.63s

---

## 未来 OMA 升级路径 (1.8.0 → 1.9.0)

等 OMA 1.9.0 发布后, 标准流程:

```bash
# 1. 改 vendor/open-multi-agent/ 内某个文件 (本地 dev)
# 2. 生成 patch
npx patch-package @open-multi-agent/core
# → 生成 patches/@open-multi-agent+core+1.9.0.patch (假设已升级)

# 3. 上游升级
npm install @open-multi-agent/core@1.9.0
# → postinstall 自动 apply patch
# → 若 conflict (patch 块上游已改), patch-package 报错, 手动 rebase

# 4. 验证
pnpm lint           # 0 error
pnpm test           # 全过
pnpm test:smoke     # 16/16
```

### 风险点

- **API 破坏**: OMA 1.9.0 可能改 `OpenMultiAgent` 接口, 需 audit `vendor/open-multi-agent/dist/`
- **patch 冲突**: 上游改了我们 patch 的同一块代码, patch apply 失败 → 需手动 rebase patch
- **vendor 体积大**: 升级前先 `du -sh vendor/open-multi-agent/` 看大小变化

---

## 后续动作

- [x] 演练完成, patch 流程验证通过
- [ ] 后续 OMA 上游发版时, 按上述标准流程升级
- [ ] 加 `.github/workflows/vendor-upgrade.yml` (可选, 自动检测上游发版)
- [ ] 写 `plan/vendor-upgrade-template.md` 给后续升级复用

---

## 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-25T00:46:00+08:00 | 初版。vendor 1.8.0 重装演练通过记录 |