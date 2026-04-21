#!/usr/bin/env bash
# feature/PLAN-xxx 브랜치 커밋 시 docs/plans/active/PLAN-xxx.md 존재 확인

BRANCH=$(git rev-parse --abbrev-ref HEAD)

# fix/, docs/, chore/, main, master, develop 건너뜀
if [[ "$BRANCH" =~ ^(fix|docs|chore)/ ]] || [[ "$BRANCH" =~ ^(main|master|develop)$ ]]; then
  exit 0
fi

# feature/PLAN-NNN-... 또는 feature/PLAN-P0-<slug>-... 패턴
# - PLAN-026까지는 순수 숫자 ID.
# - Phase A.0 준비기 skeleton 은 `PLAN-P0-<slug>.md` 로 관리 (multitenant-schema·quota-policy·auth-flow).
PLAN_ID=""
if [[ "$BRANCH" =~ ^feature/(PLAN-P0-[a-z][a-z0-9-]*)-v[0-9]+$ ]]; then
  PLAN_ID="${BASH_REMATCH[1]}"
elif [[ "$BRANCH" =~ ^feature/(PLAN-P0-[a-z][a-z0-9-]*)$ ]]; then
  PLAN_ID="${BASH_REMATCH[1]}"
elif [[ "$BRANCH" =~ ^feature/PLAN-([0-9]+) ]]; then
  PLAN_ID="PLAN-${BASH_REMATCH[1]}"
fi

if [[ -n "$PLAN_ID" ]]; then
  PLAN_FILE="docs/plans/active/${PLAN_ID}.md"
  if [[ ! -f "$PLAN_FILE" ]]; then
    echo ""
    echo "❌ 플랜 문서 없음: $PLAN_FILE"
    echo "   feature 브랜치 커밋 전 플랜 문서를 작성하세요."
    echo "   참고: docs/plans/TEMPLATE.md"
    echo ""
    exit 1
  fi
  echo "✅ 플랜 확인: $PLAN_FILE"
  exit 0
fi

# feature/ 이지만 PLAN ID 없음
if [[ "$BRANCH" =~ ^feature/ ]]; then
  echo ""
  echo "❌ feature 브랜치명에 PLAN ID 없음: $BRANCH"
  echo "   올바른 형식: feature/PLAN-NNN-설명 또는 feature/PLAN-P0-<slug>[-vN]"
  echo ""
  exit 1
fi

exit 0
