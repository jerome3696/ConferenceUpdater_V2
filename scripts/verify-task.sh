#!/usr/bin/env bash
# 작업 완료 후 수동 실행: lint + test + build + 보안 + 파일 크기 5가지 체크

set -e

PASS=0
FAIL=0

ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠️  $1"; }

echo ""
echo "=== verify-task ==="
echo ""

# 1. lint
echo "[1/5] ESLint"
if npm run lint --silent 2>/dev/null; then
  ok "lint 통과"
else
  fail "lint 실패 — npm run lint 로 확인"
fi

# 2. test
echo "[2/5] Vitest"
if npm run test --silent 2>/dev/null; then
  ok "테스트 통과"
else
  fail "테스트 실패 — npm run test 로 확인"
fi

# 3. build
echo "[3/5] Build"
if npm run build --silent 2>/dev/null; then
  ok "빌드 성공"
else
  fail "빌드 실패 — npm run build 로 확인"
fi

# 4. API 키 패턴 감지 (src/ 전체)
# startsWith/placeholder/주석 라인은 검증 코드이므로 제외
echo "[4/5] 시크릿 스캔"
SECRETS=$(grep -rE "sk-ant-[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{36}" src/ 2>/dev/null \
  | grep -vE "startsWith|placeholder|//|#" \
  || true)
if [ -z "$SECRETS" ]; then
  ok "시크릿 없음"
else
  fail "API 키 패턴 감지됨:"
  echo "$SECRETS" | sed 's/^/    /'
fi

# 5. 파일 크기 경고 (500줄 초과)
echo "[5/5] 파일 크기"
LARGE=$(find src/ -name "*.js" -o -name "*.jsx" | xargs wc -l 2>/dev/null \
  | awk '$1 > 500 && $2 != "total" {print $2 " (" $1 "줄)"}')
if [ -z "$LARGE" ]; then
  ok "500줄 초과 파일 없음"
else
  warn "500줄 초과 파일 (리팩토링 검토 권장):"
  echo "$LARGE" | sed 's/^/    /'
  PASS=$((PASS+1))
fi

# 결과
echo ""
echo "=== 결과: ✅ ${PASS}  ❌ ${FAIL} ==="
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
