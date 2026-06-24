// baize-oma/vitest.config.ts
//
// Phase 4 落地: 加 coverage v8 门禁.
// 阈值 80% (与 PLAN §Phase 1 T1.7 一致, 暂不做强制阈值阻断, 仅报告).
//
// 注: vendor/open-multi-agent/ 和 src/llm/client.ts 排除 (网络依赖, 走集成测试).

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: [
        "src/routes/**/*.ts",
        "src/decomposer/**/*.ts",
        "src/dag/**/*.ts",
        "src/server.ts",
        "src/oma-client.ts",
      ],
      exclude: [
        "src/__tests__/**",
        "src/**/*.d.ts",
        "src/llm/client.ts", // 排除: 走集成测试 (tests/integration/)
        "src/oma-adapter.ts", // 排除: dead code (Phase 2 已被 routes 替代)
      ],
    },
  },
});
