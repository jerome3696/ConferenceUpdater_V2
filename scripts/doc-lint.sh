#!/usr/bin/env bash
# 문서 규율 점검 (진단용, 게이트 아님 — refactor-check.sh 와 동일 양식):
#   1. blueprint.md = dev-guide.md = roadmap.md(현재행) 체인 버전 일치
#   2. top-level docs/ 청결 (버전 박힌 파일명·session-report·overnight-report 없음)
#   3. status.md 존재 + 신선도

set +e

echo ""
echo "=== doc-lint ==="
echo ""

WARN=0

# 1. 체인 버전 정합
echo "[1/3] 체인 버전 정합 (blueprint = dev-guide = roadmap)"
BP_VER=$(grep -m1 "체인 버전" docs/blueprint.md 2>/dev/null | grep -oE 'v[0-9]+' | head -1)
DG_VER=$(grep -m1 "체인 버전" docs/dev-guide.md 2>/dev/null | grep -oE 'v[0-9]+' | head -1)
RM_VER=$(grep -m1 -E '^\|.*🔵' docs/roadmap.md 2>/dev/null | grep -oE 'v[0-9]+' | head -1)
echo "  blueprint=$BP_VER  dev-guide=$DG_VER  roadmap(현재행)=$RM_VER"
if [ -n "$BP_VER" ] && [ "$BP_VER" = "$DG_VER" ] && [ "$BP_VER" = "$RM_VER" ]; then
  echo "  ✅ 세 문서 버전 일치 ($BP_VER)"
else
  echo "  ⚠️  버전 불일치 — blueprint/dev-guide 헤더와 roadmap 체인 테이블 🔵 행을 맞출 것"
  WARN=$((WARN+1))
fi

# 2. top-level docs/ 청결
echo ""
echo "[2/3] top-level docs/ 청결"
STRAY=$(ls docs/*.md 2>/dev/null | grep -E '(-v[0-9]|session-report|overnight-report)' || true)
if [ -z "$STRAY" ]; then
  echo "  ✅ 버전 박힌 파일명·리포트 잔존 없음"
else
  echo "  ⚠️  top-level 에 보관소(docs/legacy/) 로 갈 파일:"
  echo "$STRAY" | sed 's/^/    /'
  WARN=$((WARN+1))
fi

# 3. status.md 존재·신선도
echo ""
echo "[3/3] status.md"
if [ ! -f docs/status.md ]; then
  echo "  ⚠️  docs/status.md 없음 — 현황 진입점 필수"
  WARN=$((WARN+1))
else
  SDATE=$(grep -m1 "최종 수정일" docs/status.md | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
  if [ -z "$SDATE" ]; then
    echo "  ⚠️  status.md 에 '최종 수정일' 줄 없음"
    WARN=$((WARN+1))
  else
    EPOCH=$(date -d "$SDATE" +%s 2>/dev/null)
    if [ -z "$EPOCH" ]; then
      echo "  ✅ status.md 최종 수정일 $SDATE (신선도 계산 skip)"
    else
      AGE=$(( ( $(date +%s) - EPOCH ) / 86400 ))
      if [ "$AGE" -gt 30 ]; then
        echo "  ⚠️  status.md 최종 수정 $SDATE ($AGE일 전) — 갱신 검토"
        WARN=$((WARN+1))
      else
        echo "  ✅ status.md 최신 ($SDATE, $AGE일 전)"
      fi
    fi
  fi
fi

echo ""
if [ "$WARN" -eq 0 ]; then
  echo "=== doc-lint: 경고 없음 ==="
else
  echo "=== doc-lint: ⚠️  경고 ${WARN}건 (게이트 아님) ==="
fi
echo ""
