#!/usr/bin/env bash
#
# baize-oma/tests/smoke/curl-test.sh
#
# Phase 4 烟测 — curl 打 7 routes 验证 HTTP server 正常工作.
#
# 用法:
#   BAIZE_OMA_PORT=20060 ./tests/smoke/curl-test.sh
#   或:
#   bash tests/smoke/curl-test.sh
#
# 前置:
#   - baize-oma server 已启动 (pnpm dev 或 node dist/server.js)
#   - 不依赖 baize-switch (LLM 路由), 仅测 HTTP 协议层
#
# 退出码:
#   0 = 全部通过
#   1 = 至少 1 个失败
#
# PLAN: plan/待完成/PLAN-BAIZE-OMA-SELF-AUDIT-20260623-000000.md §Phase 4 T4.4

set -euo pipefail

PORT="${BAIZE_OMA_PORT:-20060}"
BASE_URL="http://127.0.0.1:${PORT}"
PASS=0
FAIL=0
FAILURES=()

# 颜色 (终端支持时启用)
if [[ -t 1 ]]; then
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  YELLOW='\033[0;33m'
  RESET='\033[0m'
else
  GREEN='' RED='' YELLOW='' RESET=''
fi

log_pass() {
  echo -e "${GREEN}✓${RESET} $1"
  PASS=$((PASS + 1))
}

log_fail() {
  echo -e "${RED}✗${RESET} $1"
  echo -e "  ${YELLOW}${2}${RESET}"
  FAIL=$((FAIL + 1))
  FAILURES+=("$1")
}

log_info() {
  echo -e "${YELLOW}ℹ${RESET} $1"
}

# 检查 server 可达
log_info "烟测 ${BASE_URL} (PID $$)"
if ! curl -sS --max-time 5 "${BASE_URL}/health" >/dev/null 2>&1; then
  log_fail "server 不可达" "确认 baize-oma 已启动: pnpm dev 或 BAIZE_OMA_PORT=${PORT} pnpm start"
  echo ""
  echo "==================="
  echo "失败: 0/${PASS}, 错误: server 不可达"
  exit 1
fi

# HTTP 状态码检查工具
check_status() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  local body="$4"
  if [[ "${actual}" == "${expected}" ]]; then
    log_pass "${name} → HTTP ${actual}"
  else
    log_fail "${name} → HTTP ${actual} (期望 ${expected})" "${body}"
  fi
}

# ----------------------------------------------------------------------------
# 1. GET /health
# ----------------------------------------------------------------------------
log_info "1. GET /health"
RESP=$(curl -sS -w "\n%{http_code}" "${BASE_URL}/health")
BODY=$(echo "${RESP}" | head -n -1)
CODE=$(echo "${RESP}" | tail -n 1)
check_status "GET /health" "200" "${CODE}" "${BODY}"
if echo "${BODY}" | grep -q '"status":"\(healthy\|degraded\)"'; then
  log_pass "/health 返 status 字段"
else
  log_fail "/health 缺 status 字段" "${BODY}"
fi

# ----------------------------------------------------------------------------
# 2. GET /manifest
# ----------------------------------------------------------------------------
log_info "2. GET /manifest"
RESP=$(curl -sS -w "\n%{http_code}" "${BASE_URL}/manifest")
BODY=$(echo "${RESP}" | head -n -1)
CODE=$(echo "${RESP}" | tail -n 1)
check_status "GET /manifest" "200" "${CODE}" "${BODY}"
if echo "${BODY}" | grep -q '"id":"baize-oma"'; then
  log_pass "/manifest 含 id=baize-oma"
else
  log_fail "/manifest 缺 id 字段" "${BODY}"
fi

# ----------------------------------------------------------------------------
# 3. POST /oma.team.create (task.decompose)
# ----------------------------------------------------------------------------
log_info "3. POST /oma.team.create"
RESP=$(curl -sS -w "\n%{http_code}" -X POST "${BASE_URL}/oma.team.create" \
  -H "content-type: application/json" \
  -d '{"name":"smoke-test","agents":[{"name":"a"}],"input":"写个 hello world"}')
BODY=$(echo "${RESP}" | head -n -1)
CODE=$(echo "${RESP}" | tail -n 1)
# 期望 200 (真 OMA 调通) 或 500 (LLM 不可达, 但协议层正常)
if [[ "${CODE}" == "200" || "${CODE}" == "500" ]]; then
  log_pass "POST /oma.team.create → HTTP ${CODE} (协议层正常)"
else
  log_fail "POST /oma.team.create → HTTP ${CODE}" "${BODY}"
fi
# 校验请求: 缺 input → 400
RESP=$(curl -sS -w "\n%{http_code}" -X POST "${BASE_URL}/oma.team.create" \
  -H "content-type: application/json" \
  -d '{"agents":[{"name":"a"}]}')
CODE=$(echo "${RESP}" | tail -n 1)
check_status "POST /oma.team.create 缺 input → 400" "400" "${CODE}" "$(echo "${RESP}" | head -n -1)"

# ----------------------------------------------------------------------------
# 4. POST /chat.agent.team.schedule
# ----------------------------------------------------------------------------
log_info "4. POST /chat.agent.team.schedule"
RESP=$(curl -sS -w "\n%{http_code}" -X POST "${BASE_URL}/chat.agent.team.schedule" \
  -H "content-type: application/json" \
  -d '{"team":{"name":"t","agents":[{"name":"a"}]},"goal":"hello"}')
BODY=$(echo "${RESP}" | head -n -1)
CODE=$(echo "${RESP}" | tail -n 1)
if [[ "${CODE}" == "200" || "${CODE}" == "500" || "${CODE}" == "503" ]]; then
  log_pass "POST /chat.agent.team.schedule → HTTP ${CODE}"
else
  log_fail "POST /chat.agent.team.schedule → HTTP ${CODE}" "${BODY}"
fi
# 校验请求: 缺 team → 400
RESP=$(curl -sS -w "\n%{http_code}" -X POST "${BASE_URL}/chat.agent.team.schedule" \
  -H "content-type: application/json" \
  -d '{"goal":"hi"}')
CODE=$(echo "${RESP}" | tail -n 1)
check_status "POST /chat.agent.team.schedule 缺 team → 400" "400" "${CODE}" "$(echo "${RESP}" | head -n -1)"

# ----------------------------------------------------------------------------
# 5. POST /chat.loop.execute
# ----------------------------------------------------------------------------
log_info "5. POST /chat.loop.execute"
RESP=$(curl -sS -w "\n%{http_code}" -X POST "${BASE_URL}/chat.loop.execute" \
  -H "content-type: application/json" \
  -d '{"agent":{"name":"a"},"prompt":"hello"}')
BODY=$(echo "${RESP}" | head -n -1)
CODE=$(echo "${RESP}" | tail -n 1)
if [[ "${CODE}" == "200" || "${CODE}" == "500" || "${CODE}" == "503" ]]; then
  log_pass "POST /chat.loop.execute → HTTP ${CODE}"
else
  log_fail "POST /chat.loop.execute → HTTP ${CODE}" "${BODY}"
fi
# 校验请求: 缺 prompt → 400
RESP=$(curl -sS -w "\n%{http_code}" -X POST "${BASE_URL}/chat.loop.execute" \
  -H "content-type: application/json" \
  -d '{"agent":{"name":"a"}}')
CODE=$(echo "${RESP}" | tail -n 1)
check_status "POST /chat.loop.execute 缺 prompt → 400" "400" "${CODE}" "$(echo "${RESP}" | head -n -1)"

# ----------------------------------------------------------------------------
# 6. POST /dag.execute
# ----------------------------------------------------------------------------
log_info "6. POST /dag.execute"
RESP=$(curl -sS -w "\n%{http_code}" -X POST "${BASE_URL}/dag.execute" \
  -H "content-type: application/json" \
  -d '{"dag":{"nodes":[{"id":"a","task":"hi","agentRole":"generic","dependsOn":[],"retries":0,"timeoutMs":5000,"status":"pending","attempts":0}],"edges":[]}}')
BODY=$(echo "${RESP}" | head -n -1)
CODE=$(echo "${RESP}" | tail -n 1)
if [[ "${CODE}" == "200" || "${CODE}" == "500" || "${CODE}" == "503" ]]; then
  log_pass "POST /dag.execute → HTTP ${CODE}"
else
  log_fail "POST /dag.execute → HTTP ${CODE}" "${BODY}"
fi
# 校验请求: 循环依赖 → 400 CYCLE_DETECTED
RESP=$(curl -sS -w "\n%{http_code}" -X POST "${BASE_URL}/dag.execute" \
  -H "content-type: application/json" \
  -d '{"dag":{"nodes":[{"id":"a","task":"1","agentRole":"generic","dependsOn":["b"],"retries":0,"timeoutMs":5000,"status":"pending","attempts":0},{"id":"b","task":"2","agentRole":"generic","dependsOn":["a"],"retries":0,"timeoutMs":5000,"status":"pending","attempts":0}],"edges":[]}}')
CODE=$(echo "${RESP}" | tail -n 1)
BODY=$(echo "${RESP}" | head -n -1)
if [[ "${CODE}" == "400" ]] && echo "${BODY}" | grep -q "CYCLE_DETECTED"; then
  log_pass "POST /dag.execute 循环依赖 → 400 CYCLE_DETECTED"
else
  log_fail "POST /dag.execute 循环依赖 → 期望 400 CYCLE_DETECTED, 实际 ${CODE}" "${BODY}"
fi

# ----------------------------------------------------------------------------
# 7. POST /dag.visualize (不执行, 仅可视化)
# ----------------------------------------------------------------------------
log_info "7. POST /dag.visualize"
RESP=$(curl -sS -w "\n%{http_code}" -X POST "${BASE_URL}/dag.visualize" \
  -H "content-type: application/json" \
  -d '{"dag":{"nodes":[{"id":"a","task":"hi","agentRole":"generic","dependsOn":[],"retries":0,"timeoutMs":5000,"status":"pending","attempts":0}],"edges":[]}}')
BODY=$(echo "${RESP}" | head -n -1)
CODE=$(echo "${RESP}" | tail -n 1)
check_status "POST /dag.visualize" "200" "${CODE}" "${BODY}"
if echo "${BODY}" | grep -q '"ascii"'; then
  log_pass "/dag.visualize 返 ascii 字段"
else
  log_fail "/dag.visualize 缺 ascii 字段" "${BODY}"
fi
if echo "${BODY}" | grep -q '"mermaid"'; then
  log_pass "/dag.visualize 返 mermaid 字段"
else
  log_fail "/dag.visualize 缺 mermaid 字段" "${BODY}"
fi

# ----------------------------------------------------------------------------
# 8. 404 兜底
# ----------------------------------------------------------------------------
log_info "8. GET /nonexistent → 404"
RESP=$(curl -sS -w "\n%{http_code}" "${BASE_URL}/nonexistent")
BODY=$(echo "${RESP}" | head -n -1)
CODE=$(echo "${RESP}" | tail -n 1)
check_status "GET /nonexistent" "404" "${CODE}" "${BODY}"

# ----------------------------------------------------------------------------
# 汇总
# ----------------------------------------------------------------------------
echo ""
echo "==========================="
TOTAL=$((PASS + FAIL))
if [[ ${FAIL} -eq 0 ]]; then
  echo -e "${GREEN}✓ 全部通过${RESET}: ${PASS}/${TOTAL}"
  exit 0
else
  echo -e "${RED}✗ 失败${RESET}: ${FAIL}/${TOTAL}"
  echo ""
  echo "失败项:"
  for f in "${FAILURES[@]}"; do
    echo "  - ${f}"
  done
  exit 1
fi
