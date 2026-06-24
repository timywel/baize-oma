# CLAUDE.md — baize-oma 开发参与指南

> Auto-loaded by Claude Code on every session. 仓根配置.

---

## 项目定位

**baize-oma** 是 baize-loop 的 **OMA Agent 调度子系统** (http slot, 端口 20060), 提供任务分解 / Agent Team 调度 / 循环执行 3 个 capability, 配合 baize-switch 完成 LLM 调用, 配合 baize-chat 触发业务。

---

## 目录结构

```
/baize-slot/baize-oma/
├── CLAUDE.md                              # 本文件
├── INDEX.md                               # 仓索引
├── README.html                            # 人类版仓说明
├── README.md                              # AI 版仓说明 (3.9KB, 已存在)
├── slot.json                              # http slot manifest (port 20060)
├── package.json                           # baize-oma 0.1.0
├── tsconfig.json
├── LICENSE                                # MIT
├── .gitignore
│
├── src/
│   ├── server.ts                          # Express 入口
│   ├── oma-client.ts                      # OMA 单例引擎
│   ├── routes/
│   │   ├── loop-execute.ts
│   │   ├── decompose.ts
│   │   ├── team-schedule.ts
│   │   ├── manifest.ts
│   │   └── health.ts
│   ├── decomposer/
│   │   ├── decomposer.ts
│   │   └── types.ts
│   └── __tests__/
│       ├── routes.test.ts
│       └── decomposer.test.ts
│
├── vendor/open-multi-agent/               # OMA 1.8.0 vendored (patch-package)
├── patches/                               # patch-package patches
│
├── plan/
│   ├── 待完成/
│   │   └── PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md  # 本轮
│   ├── 白泽baize-oma-DAG集成方案-20260623.{md,html}       # DAG 集成专题
│   ├── 已完成/
│   │   ├── PLAN-MIGRATION-20260622-ARCHIVED.md
│   │   └── PLAN-UPGRADE-20260622-ARCHIVED.md
│   ├── PLAN-MIGRATION-20260622.md         # 旧, 待 ARCHIVED
│   └── PLAN-UPGRADE-20260622.md           # 旧, 待 ARCHIVED
│
└── package-lock.json
```

---

## 用户核心规则

**未经用户明确批准，禁止修改任何代码文件和非计划类文档。**
- 仅允许直接改写：**计划类文档**
- 代码修改：必须使用 `/commit` 或获得用户逐条确认

---

## slot.json 概览

```json
{
  "id": "baize-oma",
  "version": "0.2.0",
  "type": "http",
  "entry": {
    "http": {
      "baseUrl": "http://127.0.0.1:20060",
      "healthPath": "/health"
    }
  },
  "capabilities": [
    "task.decompose",
    "chat.agent.team.schedule",
    "chat.loop.execute"
  ],
  "healthDegradedMs": 30000,
  "healthUnhealthyMs": 60000,
  "allowBreakingVersion": false
}
```

---

## 实施度

### ✅ 已完成
- HTTP 服务骨架 (server.ts + routes × 5)
- OMA vendored + patch-package 流程
- 3 capability routes 入口
- DAG 集成方案 (HTML 34KB)

### ⚠️ 部分
- 业务委派未真接 OMA (decomposer.ts 可能 mock)
- vendor/open-multi-agent/ 体积大未审计

### ❌ 未实现
- 缺仓根 README.html / CLAUDE.md / INDEX.md (本文件为新建)
- vendor 升级演练缺失
- 与 baize-switch / baize-chat 真实联调未做
- 集成测试 tests/integration/ 缺失
- 无 .github/workflows CI

---

## 关键缺口（5 致命 + 5 重要）

详见 [plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md §9](plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md)

### 🔴 致命（5 项）
- GAP-1: vendor/open-multi-agent/ 升级演练缺失
- GAP-2: 覆盖率未量化, 无 coverage 脚本
- GAP-3: 缺独立运行验证脚本
- GAP-4: 与 baize-switch 真实联调未做
- GAP-5: 缺仓根 README.html / CLAUDE.md / INDEX.md

### 🟡 重要（5 项）
- GAP-6: dist/ 提交但 CI 未验证
- GAP-7: 业务 handle 委派未真接 OMA
- GAP-8: 无 .github/workflows CI
- GAP-9: 无 PR 模板 + CONTRIBUTING.md
- GAP-10: 既有 plan (3 份) 未归档

---

## 工作习惯

### 计划驱动执行模式
按文档中每个 task 逐一完成。

### 滚动迭代计划模式
完成当轮计划后, 提炼为 `update plan-(N+1).md`。

### 文件整理原则
- 临时文件 → `temp/` (本仓无, 待 Phase 1 评估)
- 计划文件 → `plan/{待完成|进行中|已完成}/`

---

## 文档版本

| 版本 | 时间 | 变更 |
|------|------|------|
| 1.0 | 2026-06-23 | 初版。Phase 1 仓根文档补齐 + ARCHIVED 旧 plan |