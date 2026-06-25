#!/usr/bin/env bash
#
# baize-oma/scripts/trim-vendor.sh
#
# 裁剪 vendor/open-multi-agent/ 中 baize-oma 不用的模块 (CLI / MCP / AI SDK / Dashboard).
# Phase 9 P9.2 落地 (2026-06-25).
#
# 触发:
#   - 手动: pnpm postinstall 自动跑 (package.json postinstall)
#   - 重入: bash scripts/trim-vendor.sh (多次跑幂等)
#
# 裁剪目标 (按 audit 报告 §5.1):
#   - dist/cli/              (~52 KB)
#   - dist/mcp.js + .d.ts    (~30 KB)
#   - dist/ai-sdk.js + .dts  (~30 KB)
#   - dist/dashboard/        (~60 KB)
#
# 预期 vendor 减小: ~170 KB (从 1.9M → ~1.73M)
#
# 安全:
#   - OMA 公开 API (dist/index.js) 不引用被裁模块, 验证过 grep
#   - 不动 vendor 内部源码逻辑, 仅删除目录/文件
#   - 走 patch-package 工作流, 升级 OMA 时自动重跑

set -euo pipefail

VENDOR_DIR="${BAIZE_OMA_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}/vendor/open-multi-agent"
DIST_DIR="$VENDOR_DIR/dist"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "❌ vendor dist 不存在: $DIST_DIR"
  exit 1
fi

echo "🚀 裁剪 baize-oma vendor (OMA 1.8.0)"
echo "   目标: $DIST_DIR"
echo ""

trimmed=0

# 1. dist/cli/ - OMA CLI 二进制, baize-oma 不提供 CLI
if [[ -d "$DIST_DIR/cli" ]]; then
  size=$(du -sk "$DIST_DIR/cli" | cut -f1)
  rm -rf "$DIST_DIR/cli"
  echo "  ✓ dist/cli/  ($size KB)"
  trimmed=$((trimmed + size))
fi

# 2. dist/mcp.js + .d.ts - MCP server, baize-oma 不用
for f in mcp.js mcp.d.ts mcp.js.map mcp.d.ts.map; do
  if [[ -f "$DIST_DIR/$f" ]]; then
    size=$(du -k "$DIST_DIR/$f" | cut -f1)
    rm "$DIST_DIR/$f"
    echo "  ✓ dist/$f  ($size KB)"
    trimmed=$((trimmed + size))
  fi
done

# 3. dist/ai-sdk.js + .d.ts - Vercel AI SDK 适配器, baize-oma 走 baize-switch
for f in ai-sdk.js ai-sdk.d.ts ai-sdk.js.map ai-sdk.d.ts.map; do
  if [[ -f "$DIST_DIR/$f" ]]; then
    size=$(du -k "$DIST_DIR/$f" | cut -f1)
    rm "$DIST_DIR/$f"
    echo "  ✓ dist/$f  ($size KB)"
    trimmed=$((trimmed + size))
  fi
done

# 4. dist/dashboard/ - renderTeamRunDashboard, baize-oma 不用
if [[ -d "$DIST_DIR/dashboard" ]]; then
  size=$(du -sk "$DIST_DIR/dashboard" | cut -f1)
  rm -rf "$DIST_DIR/dashboard"
  echo "  ✓ dist/dashboard/  ($size KB)"
  trimmed=$((trimmed + size))
fi

echo ""
echo "✅ 裁剪完成: 减小 ~${trimmed} KB"
echo "   vendor 总大小: $(du -sh "$VENDOR_DIR" | cut -f1)"
