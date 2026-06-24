# baize-oma

Baize slot adapter for [`@open-multi-agent/core`](https://www.npmjs.com/package/@open-multi-agent/core) — wraps the OpenMultiAgent framework as a [BaizeSlot](https://github.com/timywel/baize-loop/blob/main/meta/slot-api/types.ts) HTTP service.

**2026-06-23 更新**: 本仓集成 DAG 任务拆解能力 (方案 C 拍板), 取代主控进程内 `OMADecomposer` 类. 详见 `plan/refactor/slots-and-libs/chat/白泽baize-oma-DAG集成方案-20260623.html`.

## 角色 (Role)

`type: "http"` slot — runs as a standalone HTTP server on port `20060` (default, override via `BAIZE_OMA_PORT`).

baize-loop 主控通过 [HttpSlotAdapter](https://github.com/timywel/baize-loop/blob/main/meta/core/http-adapter.ts) 跨进程 HTTP 调用本服务，**不传染协议**。

## Capabilities

| Capability | HTTP Route | 对应 OMA API | 状态 |
|---|---|---|---|
| `chat.agent.team.schedule` | `POST /chat.agent.team.schedule` | `OpenMultiAgent.runTeam()` | ✅ 已实现 |
| `chat.loop.execute` | `POST /chat.loop.execute` | `OpenMultiAgent.runAgent()` (loop wrapper) | ✅ 已实现 |
| `task.decompose` 🆕 | `POST /oma.team.create` | `OpenMultiAgent.createTeam()` + LLM 拆解 | 🆕 2026-06-23 拍板, M3 阶段 1 周 |

健康检查 + manifest:
- `GET /health` → `{status, last_check_at, latency_ms, oma_version}`
- `GET /manifest` → `slot.json` 内容

## 架构

```
┌─────────────────────┐         HTTP (port 20060)         ┌──────────────────────────────────┐
│ baize-loop (主控)   │ ────────────────────────────────> │ baize-oma (本仓, HTTP server)    │
│ HttpSlotAdapter     │   POST /chat.agent.*              │   src/server.ts (Express)        │
│                     │   GET  /health /manifest          │   src/routes/* (5 routers)       │
└─────────────────────┘                                    │   src/oma-client.ts (单例引擎)   │
                                                            │   src/decomposer/ (decompose)    │
                                                            │   src/dag/ (executor + visualizer)│
                                                            │   src/llm/client.ts (→ 20030)    │
                                                            │   vendor/open-multi-agent/      │
                                                            │   (vendored OMA 1.8.0)          │
                                                            └──────────────────────────────────┘
```

## vendored OMA + patch-package 工作流

OMA 源码 vendored 在 `vendor/open-multi-agent/`。修改 OMA 内部逻辑的标准流程:

```bash
# 1. 修改 vendor/open-multi-agent/dist/... 里某个文件
# 2. 生成 patch
npx patch-package @open-multi-agent/core
# → 生成 patches/@open-multi-agent+core+1.8.0.patch

# 3. 上游升级
npm install @open-multi-agent/core@1.9.0
# → postinstall 自动重打 patch (如果冲突会报错, 手动 rebase)
```

**为什么不直接 fork OMA？** 因为:
- 保留升级路径 (上游发版后 `npm update` 一行升级)
- patch 文件是 diff，可读可审计
- 协议上仍只附 OMA 的 MIT LICENSE (vendored + patch 不构成衍生作品)

## 安装 / 启动

```bash
# 安装依赖 (会触发 patch-package 自动 apply 已有 patch)
npm install

# 开发模式 (热重启)
npm run dev

# 生产模式
npm run build
npm start
```

环境变量:
- `BAIZE_OMA_PORT` — 端口 (默认 20060)
- `OMA_DEFAULT_MODEL` — 默认 LLM 模型 (默认 `claude-opus-4-6`)
- `OMA_MAX_CONCURRENCY` — OMA agent pool 并发 (默认 5)
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — LLM provider key (由 OMA 自己用)

## 协议 (License)

MIT — 详见 [LICENSE](./LICENSE)。Vendored `@open-multi-agent/core` 同样 MIT (上游)，详见 LICENSE 内 NOTICE 段。

## 上游

- baize-loop: https://github.com/timywel/baize-loop
- @open-multi-agent/core: https://github.com/open-multi-agent/open-multi-agent