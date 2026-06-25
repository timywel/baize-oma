// baize-oma/vitest.config.ts
//
// Phase 4 落地: 加 coverage v8 门禁.
// Phase 6 落地 (2026-06-25): 把 src/llm/client.ts 加进 include (mock fetch 测试).
// 阈值 80% (与 PLAN §Phase 1 T1.7 一致, 暂不做强制阈值阻断, 仅报告).

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
        "src/llm/client.ts",
      ],
      exclude: [
        "src/__tests__/**",
        "src/**/*.d.ts",
      ],
    },
  },
});
