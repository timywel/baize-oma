---
planId: PLAN-BAIZE-OMA-DAG-INTEGRATION-20260623
status: ARCHIVED
version: 1.0
author: BaiZe 架构 (基于 1 轮架构讨论 + 调研)
createdAt: 2026-06-23T20:30:00+08:00
updatedAt: 2026-06-25T00:00:00+08:00
archivedAt: 2026-06-25T00:00:00+08:00
parent: plan/refactor/slots-and-libs/chat/baize-chat-architecture-20260623.md
scope: slots-and-libs
relatedSlot: baize-oma
relatedChatSlot: baize-chat
replacedBy: plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md §Phase 3
---

# [ARCHIVED 2026-06-25] baize-oma 仓 DAG 任务拆解集成方案 (2026-06-23)

> **⚠️ 状态**: ARCHIVED (2026-06-25)
>
> **作废理由**: DAG 集成方案已被 baize-oma 仓 SELF-AUDIT 主计划 Phase 3 吸收并完成 (5 commits, 1101 行, 33 tests pass, 2026-06-24).
>
> **替代方案**: [plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md](../../待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md) §Phase 3
>
> **实施 commit** (baize-oma 仓):
> - 866ca00 T3.2 src/dag/types.ts
> - f3004d9 T3.3 src/dag/executor.ts
> - f23ce70 T3.4 src/dag/visualizer.ts
> - a6626e7 T3.5 decomposer 改造输出 DAG
> - 56bd561 T3.6 src/routes/dag-execute.ts
> - 3865330 T3.7 src/__tests__/dag.test.ts 11 case

---

# baize-oma 仓 DAG 任务拆解集成方案 (2026-06-23) — 原始内容

> **本专题文档** — 互补 baize-oma 仓现有 PLAN-UPGRADE-20260622.md, 不重写。
> 承载: baize-oma 仓 DAG 任务拆解能力整合方案 (替代进程内 OMADecomposer) + HTTP 接口设计 + 实施路径。
>
> **上游文档**:
> - `baize-slot/baize-oma/plan/PLAN-UPGRADE-20260622.md` (本仓升级计划)
> - `baize-slot/baize-oma/README.md` (本仓说明)
> - `baize-slot/baize-oma/slot.json` (本仓 slot 清单)
>
> **关联文档**:
> - `plan/refactor/slots-and-libs/chat/baize-chat-architecture-20260623.md` (baize-chat 仓架构专题, §4.7 同步)

---

## ASSUMPTIONS

- **A1**: baize-oma 仓 (`/home/timywel/AI_Product/baize-slot/baize-oma/`) 是 http slot, 端口 20060, 类型 `process` (vendor open-multi-agent 1.8.0 库)
- **A2**: 进程内 `OMADecomposer` (`baize-loop/src/loop/oma-client.ts:26`) 在 Phase 3 (2026-06-22) 后**被弃用**, 新代码走 HTTP 委派给 baize-oma
- **A3**: 拆解能力集成到 baize-oma 是**已发生的事实** (推测, 因为主控 `decomposeViaOma` 已切到 HTTP 调 baize-oma), 本专题文档是**显式记录 + 完善方案**
- **A4**: baize-oma 内部用 OpenMultiAgent 包装库 + HTTP 调 baize-switch:20030 拿 LLM, 不直连 LLM provider
- **A5**: baize-chat 仓写真业务时通过 HTTP 调 baize-oma:20060 拿 DAG, 不写真进程内拆解

---

## 1. baize-oma 仓当前能力 (2026-06-23)

### 1.1 仓位置与状态

| 项 | 值 |
|----|----|
| 仓位置 | `/home/timywel/AI_Product/baize-slot/baize-oma/` |
| slot.json type | `http` |
| 端口 | 20060 (BAIZE_OMA_PORT 可覆盖) |
| Capabilities | `chat.agent.team.schedule` + `chat.loop.execute` (2 个) |
| vendor 库 | open-multi-agent 1.8.0 (patch-package 工作流) |
| 现有 HTTP 端点 | `POST /chat.agent.team.schedule` / `POST /chat.loop.execute` / `GET /health` / `GET /manifest` |

### 1.2 现有职责边界

| 职责 | 状态 |
|------|------|
| 多 Agent 拓扑调度 (runTasks / runTeam) | ✅ 已实现 |
| 单 agent 循环 (runAgent) | ✅ 已实现 |
| 共享记忆 (sharedMemory) | ✅ 已实现 |
| coordinator 综合输出 | ✅ 已实现 |
| **DAG 任务拆解 (decompose)** | ⚠️ **推测已实现 (主控 `decomposeViaOma` 已切到 baize-oma HTTP), 待 baize-oma 仓显式确认** |
| LLM 流式输出 | ⚠️ 推测依赖 baize-switch 网关 (类似 chat 仓设计) |
| 前端 widget 渲染 | ❌ 不做 (baize-chat 仓职责) |

### 1.3 与 baize-chat 仓的关系

| 维度 | baize-oma | baize-chat |
|------|-----------|-----------|
| **类型** | http slot (独立进程) | process slot (主控进程内) |
| **角色** | 调度者 (跑多 agent) | 编排者 (拼 prompt + 委派 + 推前端) |
| **职责** | 实际跑多 agent 调度算法 | 接收用户消息, 委派给 oma, 推 LLMEvent 流 |
| **HTTP** | 暴露端口 20060 | 通过 slot-bridge 调 oma |
| **LLM** | 内部 HTTP 调 baize-switch:20030 | **不直连 LLM** (违反 chat 仓架构原则) |

---

## 2. DAG 任务拆解能力整合 (本期重点)

### 2.1 进程内 OMADecomposer 弃用原因 (Phase 3 2026-06-22)

**位置**: `baize-loop/src/loop/oma-client.ts` (397 行)

**当前状态**: 类仍存在, 但**被新代码弃用**

**弃用原因**:
1. **进程内拆解需要本地 LLM API key** (`process.env.MINIMAX_API_KEY`), 跟"chat 仓不直连 LLM"原则冲突
2. **进程内拆解无法跨进程复用**, 性能差
3. **HTTP 委派给 baize-oma 后**, LLM 配置统一在 baize-switch 网关, 符合"中转站"原则
4. **主控仓代码注释明确**: "OMADecomposer 改为 HTTP 调 baize-oma" (loop.ts:251, oh-chat.ts:12, oh-chat.ts:25)

**保留原因** (暂时不删):
- 主控仓测试 (`meta/__tests__/oma-engine-extract-reasoning.test.ts`) 仍依赖
- 历史兼容 (baize-loop 老 chat 流程可能用)
- 一次性删除风险大 (12-rollout "不删老 baize-loop" 约束)

### 2.2 baize-oma 仓内 DAG 拆解的职责 (拍板)

**职责定义**:

| 职责 | 属于 baize-oma | 属于 baize-chat | 属于 baize-switch |
|------|---------------|----------------|-----------------|
| 收用户输入 + 拆解成 DAG | ✅ 是 | ❌ | ❌ |
| 调 LLM 拆解 (HTTP 调 switch) | ✅ 是 | ❌ | ❌ |
| 归一化 OMADag (nodes + edges + agentRole) | ✅ 是 | ❌ | ❌ |
| 暴露 HTTP 端点 `/oma.team.create` | ✅ 是 | ❌ | ❌ |
| 跑拓扑调度 (runTasks) | ✅ 是 | ❌ | ❌ |
| coordinator 综合 | ✅ 是 | ❌ | ❌ |
| LLM 流式输出 | ✅ 是 | ❌ | ✅ (基础) |
| 转 omaTasks + 委派给 oma | ❌ | ✅ 是 | ❌ |
| 推前端 (WS 帧) | ❌ | ✅ 是 | ❌ |
| 渲染 widget | ❌ | ✅ 是 | ❌ |

**结论**: **DAG 拆解完全在 baize-oma 仓职责内**, baize-chat 仓只写真业务 (接收用户消息 → 委派给 oma → 推前端)。

### 2.3 4 个候选方案评估 (与 baize-chat 架构专题 §4.7.3 一致)

| 方案 | 描述 | 拍板 |
|------|------|------|
| **A: 独立 baize-decomposer 仓** | 新建独立仓, 端口 20070, 独立 HTTP 进程 | ❌ 拒绝 (与 oma 职责重叠) |
| **B: 集成 baize-chat 仓** | DAG 拆解放 baize-chat/src/backend/decomposer/ | ❌ 拒绝 (违反 chat 不直连 LLM 原则) |
| **C: 集成 baize-oma 仓** | 拆解在 oma 内, 与 oma 调度天然一体 | ✅ **拍板** |
| **D: 集成 baize-switch 网关** | 拆解放 switch 仓 (LLM 基础设施层) | ❌ 拒绝 (switch 职责错位) |

**拍板理由** (5 个):
1. 当前现状已倾向 C (主控 `decomposeViaOma` 已切到 HTTP 调 baize-oma)
2. 集成 chat 违反 chat 仓架构原则 (chat 不直连 LLM)
3. 独立仓多此一举 (oma 已能拆解)
4. 集成 oma 最自然 (拆解+调度天然一体, 共用 LLM 配置)
5. 集成 switch 错位 (switch 是 LLM 基础设施, 拆解是 chat 业务)

---

## 3. HTTP 接口设计 (baize-oma 仓内)

### 3.1 新增 HTTP 端点

| 端点 | 方法 | Capability | 说明 |
|------|------|------------|------|
| `POST /oma.team.create` | POST | (扩展现有 `chat.agent.team.schedule`) | 创建 agent team + 拆解, 返回 DAG |
| `POST /chat.agent.team.schedule` | POST | `chat.agent.team.schedule` | 跑拓扑调度 (现有, 不变) |
| `POST /chat.loop.execute` | POST | `chat.loop.execute` | 单 agent 循环 (现有, 不变) |
| `GET /health` | GET | - | 健康检查 (现有) |
| `GET /manifest` | GET | - | slot.json 内容 (现有) |

### 3.2 `/oma.team.create` 请求 / 响应规范

**请求** (baize-chat → baize-oma):

```json
POST baize-oma:20060/oma.team.create
Content-Type: application/json
{
  "name": "skill-loop-decomposer",
  "agents": [{
    "name": "decomposer",
    "model": "MiniMax-M2.7",
    "systemPrompt": "把用户输入拆成 DAG 子任务 (JSON 数组)."
  }],
  "input": "分析 Python 和 Rust 性能差异",
  "options": {
    "depth": 0,
    "maxDepth": 3,
    "minNodes": 3,
    "maxNodes": 6
  }
}
```

**请求字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | Team 标识 (用于日志) |
| `agents` | array | ✅ | Agent 配置, 至少 1 个 (decomposer) |
| `agents[].name` | string | ✅ | Agent 名称 (decomposer / coordinator) |
| `agents[].model` | string | ✅ | LLM 模型名 (MiniMax-M2.7 / claude-sonnet-4-6 / gpt-4o) |
| `agents[].systemPrompt` | string | ✅ | Agent 系统提示词 (decomposer 的拆解 prompt) |
| `input` | string | ✅ | 用户输入 (待拆解的目标) |
| `options.depth` | number | ❌ | 递归深度 (默认 0) |
| `options.maxDepth` | number | ❌ | 最大递归深度 (默认 3) |
| `options.minNodes` | number | ❌ | 最少节点数 (默认 3) |
| `options.maxNodes` | number | ❌ | 最多节点数 (默认 6) |

**响应** (baize-oma → baize-chat):

```json
HTTP 200 OK
Content-Type: application/json
{
  "taskDag": {
    "nodes": [
      {
        "id": "task-1",
        "title": "调研 Python 性能",
        "description": "研究 Python 在计算密集和 IO 场景下的性能表现",
        "agentRole": "researcher",
        "dependsOn": []
      },
      {
        "id": "task-2",
        "title": "调研 Rust 性能",
        "description": "研究 Rust 在系统编程、内存安全和并发场景下的性能优势",
        "agentRole": "researcher",
        "dependsOn": []
      },
      {
        "id": "task-3",
        "title": "对比分析",
        "description": "综合两者数据, 分析适用场景差异, 给出学习路径建议",
        "agentRole": "reviewer",
        "dependsOn": ["task-1", "task-2"]
      }
    ],
    "edges": [
      { "from": "task-1", "to": "task-3" },
      { "from": "task-2", "to": "task-3" }
    ]
  },
  "meta": {
    "teamId": "team-uuid-12345",
    "decomposedAt": "2026-06-23T10:30:45.123Z",
    "decomposerModel": "MiniMax-M2.7",
    "durationMs": 450
  }
}
```

**响应字段**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `taskDag.nodes` | array | 拆解后的任务节点 (3-6 个) |
| `taskDag.nodes[].id` | string | 节点 ID (task-1, task-2, ...) |
| `taskDag.nodes[].title` | string | 任务标题 (≤ 20 字) |
| `taskDag.nodes[].description` | string | 任务详细描述 |
| `taskDag.nodes[].agentRole` | string | 角色 (researcher/architect/coder/reviewer/generic) |
| `taskDag.nodes[].dependsOn` | array | 依赖的其他节点 ID 数组 |
| `taskDag.edges` | array | 节点依赖关系 (显式 edges, 用于渲染图) |
| `meta.teamId` | string | Team UUID (后续 schedule 用) |
| `meta.decomposedAt` | string | 拆解时间 (ISO 8601) |
| `meta.decomposerModel` | string | 实际使用的 LLM 模型 |
| `meta.durationMs` | number | 拆解耗时 (ms) |

**错误响应**:

```json
HTTP 400 Bad Request
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "agents 不能为空",
    "i18nKey": "errors.baize-oma.invalid_request"
  }
}

HTTP 500 Internal Server Error
{
  "error": {
    "code": "UPSTREAM_DOWN",
    "message": "baize-switch 网关不可达, LLM 拆解失败",
    "i18nKey": "errors.baize-oma.upstream_down",
    "detail": { "upstream": "baize-switch:20030", "status": 503 }
  }
}

HTTP 504 Gateway Timeout
{
  "error": {
    "code": "TIMEOUT",
    "message": "LLM 拆解超时 (60s)",
    "i18nKey": "errors.baize-oma.timeout",
    "detail": { "elapsedMs": 60000 }
  }
}
```

### 3.3 内部实现 (baize-oma 仓内)

**新文件**: `baize-oma/src/decomposer.ts` (~150 行)

```typescript
// baize-oma/src/decomposer.ts (伪代码, 实际写真时写真)
import { OpenMultiAgent } from '../vendor/open-multi-agent/src/dist/index.js';
import { slotBridge } from '../../../baize-loop/meta/core/slot-bridge';

export class Decomposer {
  private oma: OpenMultiAgent;

  constructor() {
    this.oma = new OpenMultiAgent({ /* 配置 */ });
  }

  /**
   * 调 LLM 拆解输入成 DAG
   * @param input 用户输入
   * @param agents agent 配置 (含 systemPrompt)
   * @param options 拆解选项 (depth, maxDepth 等)
   * @returns OMADag
   */
  async decompose(
    input: string,
    agents: AgentConfig[],
    options: DecomposeOptions
  ): Promise<{ taskDag: OMADag; meta: DecomposeMeta }> {
    const startTime = Date.now();
    const teamId = uuid();

    // 1. 调 OpenMultiAgent 库, 跑 createTeam
    const team = await this.oma.createTeam({
      name: `decomposer-${teamId}`,
      agents,
    });

    // 2. 库内部 HTTP 调 baize-switch:20030 拿 LLM
    //    (vendor open-multi-agent 自带 SSE 流式客户端, 已配 baize-switch 网关)
    const rawDag = await team.runAgent({
      agentName: 'decomposer',
      input,
      outputFormat: 'json',
    });

    // 3. 归一化: JSON 数组 → OMADag (nodes + edges)
    const taskDag = this.normalizeToOMADag(rawDag);

    // 4. 递归深拆 (可选, 复杂 leaf 自动二次拆解)
    if (options.depth < options.maxDepth) {
      for (const node of taskDag.nodes) {
        if (this.isComplexLeaf(node)) {
          const subDag = await this.decompose(node.description, agents, {
            ...options,
            depth: options.depth + 1,
          });
          // parent-id.N 命名空间合并
          this.mergeSubDag(taskDag, subDag, node.id);
        }
      }
    }

    return {
      taskDag,
      meta: {
        teamId,
        decomposedAt: new Date().toISOString(),
        decomposerModel: agents[0].model,
        durationMs: Date.now() - startTime,
      },
    };
  }

  /**
   * 归一化 LLM 输出的 JSON 数组 → OMADag
   */
  private normalizeToOMADag(raw: any): OMADag {
    // 验证 LLM 输出 schema (5 角色枚举)
    // 提取 nodes (id, title, description, agentRole, dependsOn)
    // 提取 edges (from, to)
    // 返回标准 OMADag
  }

  /**
   * 判断是否是复杂 leaf (description.length > 80 触发递归)
   */
  private isComplexLeaf(node: OMANode): boolean {
    return node.description.length > 80;
  }

  /**
   * 合并子 DAG 到父 DAG (parent-id.N 命名空间)
   */
  private mergeSubDag(parent: OMADag, sub: OMADag, parentId: string): void {
    // sub.nodes 加 parentId.N 前缀
    // sub.edges 重写
    // parent.nodes 移除被拆的 leaf
    // parent.edges 重新指向拆解后的子节点
  }
}
```

**新文件**: `baize-oma/src/routes/decompose.ts` (~50 行)

```typescript
// baize-oma/src/routes/decompose.ts
import { Router } from 'express';
import { Decomposer } from '../decomposer.js';

const router = Router();
const decomposer = new Decomposer();

router.post('/oma.team.create', async (req, res) => {
  try {
    const { name, agents, input, options } = req.body;
    const result = await decomposer.decompose(input, agents, options || {});
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      error: {
        code: err.code || 'UNKNOWN',
        message: err.message,
        i18nKey: err.i18nKey,
        detail: err.detail,
      },
    });
  }
});

export default router;
```

**修改文件**: `baize-oma/src/server.ts` (注册新路由)

```typescript
// baize-oma/src/server.ts (追加)
import decomposeRouter from './routes/decompose.js';

app.use('/', decomposeRouter);  // 挂载 /oma.team.create
```

### 3.4 slot.json 能力扩展

```json
// baize-oma/slot.json (扩展)
{
  "id": "baize-oma",
  "version": "0.2.0",  // bump version (新增 capability)
  "type": "http",
  "entry": {
    "http": {
      "baseUrl": "http://127.0.0.1:20060",
      "healthPath": "/health"
    }
  },
  "capabilities": [
    "task.decompose",   // 🆕 新增
    "chat.agent.team.schedule",
    "chat.loop.execute"
  ],
  "healthDegradedMs": 30000,
  "healthUnhealthyMs": 60000,
  "allowBreakingVersion": false
}
```

**注意**: 当前方案把 `/oma.team.create` 视为**现有 `chat.agent.team.schedule` capability 的扩展**, 而不是新 capability `task.decompose`。**2026-12 后评估**是否拆成独立 capability `task.decompose` 更清晰。

### 3.5 进程内 OMADecomposer 类的处理

**当前状态**: `baize-loop/src/loop/oma-client.ts:26` 进程内类仍存在

**最终处置** (2026-12 后评估):
- ✅ **保留**: baize-oma decompose 稳定 6 个月 + 主控仓测试全部迁到 baize-oma HTTP 路径 → 删 `src/loop/oma-client.ts` 的 OMADecomposer 类
- ❌ **不满足**: 保留类, 但加 `@deprecated` 注释 (建议改用 baize-oma HTTP 拆解)

**本期范围**: 不删进程内类, 但 baize-oma 仓提供 HTTP 拆解能力作为**主路径**。

---

## 4. 端到端集成 (baize-chat ↔ baize-oma ↔ baize-switch)

### 4.1 完整流程图

```
用户输入 "分析 Python 和 Rust 性能差异"
    ↓
baize-chat 仓 (process slot, 主控进程内)
    ├─ 接收 SlotRequest { route: "chat.message.send", body: { text: "..." } }
    ├─ 查 profile (chat.profile.match)
    ├─ 拼 prompt (注入 memory + graph 召回)
    └─ 决定 source: "oma"
        ↓
baize-chat.oma-adapter.decomposeGoal(text)
    ↓ HTTP POST baize-oma:20060/oma.team.create
baize-oma 仓 (HTTP server, port 20060)
    ├─ 收 HTTP 请求
    ├─ 委派给 Decomposer 类
    │   ├─ OpenMultiAgent.createTeam({ name, agents: [decomposer] })
    │   ├─ HTTP 调 baize-switch:20030/v1/messages (LLM API)
    │   ├─ 收 LLM 拆解结果 (JSON 数组)
    │   ├─ 归一化为 OMADag (nodes + edges)
    │   └─ 递归深拆 (maxDepth=3, 复杂 leaf 自动二次拆解)
    └─ HTTP 200 返回 { taskDag, meta }
        ↓
baize-chat 仓 (继续)
    ├─ 收 taskDag
    ├─ 转 omaTasks (遍历 nodes + edges, 按 dependsOn 排序)
    └─ baize-chat.oma-adapter.scheduleTeam(omaTasks)
        ↓ HTTP POST baize-oma:20060/chat.agent.team.schedule
baize-oma 仓 (再调一次)
    ├─ 收 omaTasks
    ├─ runTasks(team, omaTasks, options) (OMA 库拓扑调度)
    ├─ 每个 task 调 LLM (经 baize-switch)
    │   └─ 流式 LLMEvent 回 baize-chat 适配层
    └─ coordinator 综合
        ↓
baize-chat 仓 (收综合结果)
    ├─ 归一化为 LLMEvent 流 (text_delta / agent_status / done)
    └─ 推前端 (WS 帧, 事件名 chat.message.*)
```

### 4.2 总 HTTP 调用次数

| 阶段 | HTTP 调用 | 网络延迟 |
|------|----------|----------|
| 用户发消息 → chat 处理 | 0 (process 内) | < 5ms |
| chat.oma-adapter.decomposeGoal | 1 (chat → oma) | ~500ms |
| oma.decompose (内部) | 1 (oma → switch) | ~1500ms (LLM 拆解) |
| chat.oma-adapter.scheduleTeam | 1 (chat → oma) | ~200ms |
| oma.runTasks (内部 N 次) | N (oma → switch) | ~3-10s (LLM 调度) |
| oma.coordinator 综合 | 1 (oma → switch) | ~800ms |
| chat 推前端 | 0 (process 内) | < 5ms |
| **总计** | **3 + N** | **~6-12s** |

### 4.3 失败回退策略

| 失败环节 | 回退策略 |
|----------|----------|
| oma.decompose 失败 (LLM 拆解超时) | chat 跳过 DAG 拆解, 直接走 quick 模式 (单 LLM 调用) |
| oma.scheduleTeam 失败 (拓扑调度失败) | chat 返回错误给用户, 提示重试 |
| oma.runTasks 部分 task 失败 | chat 继续收其他 task 结果, 失败 task 标 failed 状态 |
| oma.coordinator 综合失败 | chat 返回部分结果 + 失败提示 |

---

## 5. 实施路径 (baize-oma 仓内)

### 5.1 阶段 1: 显式记录 (本期范围, 1-2 天)

**任务**:
1. 写真本专题文档 (md + html, 已在产出)
2. 同步 PLAN-UPGRADE-20260622.md, 加 §DAG 拆解整合章节
3. 同步 README.md, 更新 capability 表
4. 同步 slot.json 注释 (说明 `chat.agent.team.schedule` 扩展为包含 decompose)

**commit**: `docs(oma): 整合 DAG 任务拆解能力 (方案 C 拍板)`

### 5.2 阶段 2: 写真 decomposer.ts (1 周)

**任务**:
1. 新建 `baize-oma/src/decomposer.ts` (~150 行, 见 §3.3)
2. 新建 `baize-oma/src/routes/decompose.ts` (~50 行)
3. 修改 `baize-oma/src/server.ts` (注册新路由)
4. 新增 `baize-oma/src/__tests__/decomposer.test.ts` (单测)
5. 新增 `baize-oma/tests/integration/oma-decompose.test.mjs` (集成测试, 写真 baize-switch mock)

**commit**: `feat(oma): 写真 /oma.team.create HTTP 端点 (DAG 拆解)`

### 5.3 阶段 3: 写真业务 (与 baize-chat 仓同步, M3 阶段)

**任务** (本仓职责):
1. 写真 `baize-oma/src/scheduler.ts` 增强 (从 taskDag 自动转 omaTasks, 跑 runTasks)
2. 写真 `baize-oma/src/emitter.ts` 增强 (LLMEvent 流推 baize-chat)
3. 写真 baize-chat 仓的 `oma-adapter.ts` (调本仓 decompose + schedule)
4. 写真 baize-chat 仓的 `baize-switch-adapter.ts` (LLM 网关)
5. e2e: baize-chat → baize-oma decompose → baize-oma schedule → baize-switch LLM → 推前端

**commit**: `feat(oma + chat): 端到端 DAG 拆解 + 拓扑调度 + LLM 流式推送`

### 5.4 阶段 4: 优化 + 弃用进程内 OMADecomposer (2026-12 后)

**任务**:
1. OMA 稳定 6 个月 + 主控仓测试全部迁到 baize-oma HTTP 路径
2. 删 `baize-loop/src/loop/oma-client.ts` 的 OMADecomposer 类
3. 主控仓加 @deprecated 注释, 建议改用 baize-oma HTTP

**commit**: `refactor(loop): 删进程内 OMADecomposer, 改 HTTP 调 baize-oma decompose`

---

## 6. 风险与边界

### 6.1 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| oma.decompose 失败率高 (LLM 拆解不准) | 用户体验差, 任务分配乱 | 加 fallback: 拆解失败时直接走 quick 模式 |
| 进程内 OMADecomposer 与 baize-oma decompose 不一致 | 测试混乱 | 写真 /oma.team.create 后, 给进程内类加 @deprecated |
| 递归深拆爆炸 (maxDepth=3 拆出上千节点) | 性能问题 | 加 hard limit (maxNodes=6, maxDepth=3) |
| baize-switch 网关挂掉 | oma.decompose 全部失败 | 加熔断 + 重试 + 报错降级 |

### 6.2 边界

| 属于 baize-oma | 不属于 baize-oma |
|----------------|-----------------|
| 收用户输入拆解成 DAG | 拼 prompt (baize-chat 仓) |
| 调 LLM 拆解 | 渲染 widget (baize-chat 仓) |
| 归一化 OMADag | 推前端 (baize-chat 仓) |
| 跑拓扑调度 (runTasks) | Profile 匹配 (baize-chat 仓) |
| coordinator 综合 | 长期持久化 (主控 transcript-store) |
| LLM 流式输出 (基础) | chat-message-* 事件命名 (baize-chat 仓主控) |

### 6.3 不写真的范围 (本期)

- ❌ 进程内 OMADecomposer 类删除 (2026-12 后)
- ❌ baize-loop 主控仓 HTTP 端点修改 (`/api/v1/loop/decompose` 保留)
- ❌ baize-chat 仓前端组件写真 (CH-29~CH-31, 4 白盒 widget 真实实现, 后续 phase)
- ❌ baize-switch 网关修改 (LLM 拆解透明)

---

## 7. 决策记录

| 日期 | 决策 | 来源 |
|------|------|------|
| 2026-06-13 | 进程内 OMADecomposer 类创建 (Phase 2.1) | `commit 697e80b1` + 后续 |
| 2026-06-13 | OMADecomposer 完善 (Phase 2.2-Hybrid, 加 agentRole + 递归深拆) | `src/loop/oma-client.ts:60-200` |
| 2026-06-22 | OMADecomposer 改为 HTTP 调 baize-oma (Phase 3) | `loop.ts:251` + `oh-chat.ts:12,25` |
| 2026-06-23 | **DAG 拆解集成方案 C (baize-oma) 拍板** | 本专题文档 + baize-chat 架构专题 §4.7 |
| 2026-06-23 | **不写真独立 baize-decomposer 仓** | 本专题文档 §2.3 |
| 2026-06-23 | **不集成 baize-chat 仓拆解** | 本专题文档 §2.3 |
| 2026-06-23 | **进程内 OMADecomposer 类不删, 加 @deprecated** | 本专题文档 §3.5 |

---

## 8. 关联文档

### 上游 (本专题文档引用)

- `baize-slot/baize-oma/plan/PLAN-UPGRADE-20260622.md` (本仓升级计划, 待修订加 §DAG 拆解整合章节)
- `baize-slot/baize-oma/README.md` (本仓说明, 待更新 capability 表)
- `baize-slot/baize-oma/slot.json` (本仓 slot 清单, 待加注释)

### 关联 (跨仓)

- `plan/refactor/slots-and-libs/chat/baize-chat-architecture-20260623.md` (baize-chat 架构专题, §4.7 DAG 拆解集成方案)
- `baize-loop/src/loop/oma-client.ts` (进程内 OMADecomposer 类, 397 行, 当前被弃用)
- `baize-loop/meta/services/api/intent-router.ts:75-103` (decomposeViaOma HTTP 委派函数)
- `baize-loop/meta/services/api/loop.ts:178-200` (/api/v1/loop/decompose HTTP 端点)

### 测试与验证

- `baize-loop/meta/__tests__/oma-engine-extract-reasoning.test.ts` (进程内 OMADecomposer 测试, 待迁移)
- `baize-loop/src/loop/oma-client.test.ts` (decompose 单元测试)

---

**最后更新**: 2026-06-23 20:30 UTC+8
**维护者**: BaiZe 架构
**状态**: pending approval (待 baize-oma 仓实际确认 decompose 能力是否已在仓内实现)
