#!/usr/bin/env bash
# Staged 파일에서 API 키·토큰 패턴 감지. 발견 시 커밋 차단.
# 자기 자신(.sh)은 패턴 정의를 담아야 하므로 검사 대상에서 제외.

set -e

PATTERNS='sk-ant-|github_pat_|ghp_[A-Za-z0-9]{36}'

# diff --cached: 스테이징된 변경 라인만 검사 (기존 파일 본문은 건드리지 않음)
# --diff-filter=ACMR: Added/Copied/Modified/Renamed
# 제외: 자기 자신(.sh) + 모든 .md 문서 (패턴 예시·검증 기록은 정상 컨텐츠)
MATCHES=$(git diff --cached --diff-filter=ACMR -U0 \
  -- ':(exclude)scripts/check-secrets.sh' ':(exclude)*.md' \
  | grep -E "^\+" \
  | grep -E "$PATTERNS" \
  || true)

if [ -n "$MATCHES" ]; then
  echo ""
  echo "🚫 커밋 차단: API 키·토큰 패턴이 감지되었습니다."
  echo ""
  echo "$MATCHES" | sed 's/^/  /'
  echo ""
  echo "감지 패턴: $PATTERNS"
  echo "환경변수나 .env (gitignore 됨)로 옮긴 후 다시 커밋하세요."
  exit 1
fi
