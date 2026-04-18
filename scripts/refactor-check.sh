#!/usr/bin/env bash
# 리팩토링 대상 자동 감지 (진단용, pass/fail 아님):
#   1. 파일 줄 수 (> 500 critical, > 300 warning)
#   2. 컴포넌트당 useState 개수 (> 10 critical, > 5 warning)
#   3. 중복 라인 (30자 이상 라인이 3회 이상 등장, 상위 10)

set +e

echo ""
echo "=== refactor-check ==="
echo ""

SRC_FILES=$(find src/ \( -name "*.js" -o -name "*.jsx" \) | grep -v "\.test\.")

# 1. 파일 줄 수
echo "[1/3] 파일 줄 수 (테스트 제외)"
echo "$SRC_FILES" | xargs wc -l 2>/dev/null | awk '
  $2 != "total" && $1 > 500 {
    printf "  ❌ %4d  %s  (> 500, 분리 강권장)\n", $1, $2
    crit++
  }
  $2 != "total" && $1 > 300 && $1 <= 500 {
    printf "  ⚠️  %4d  %s  (> 300, 검토 권장)\n", $1, $2
    warn++
  }
  END {
    if (crit+0 == 0 && warn+0 == 0) {
      print "  ✅ 300줄 초과 파일 없음"
    } else {
      printf "  요약: critical %d, warning %d\n", crit+0, warn+0
    }
  }
'

# 2. useState 밀도
echo ""
echo "[2/3] useState 밀도 (.jsx 파일)"
HAS_HIT=0
for f in $(echo "$SRC_FILES" | grep "\.jsx$"); do
  count=$(grep -c "useState" "$f" 2>/dev/null)
  count=${count:-0}
  if [ "$count" -gt 10 ]; then
    printf "  ❌ %3d  %s  (> 10, 상태 분리 필요)\n" "$count" "$f"
    HAS_HIT=1
  elif [ "$count" -gt 5 ]; then
    printf "  ⚠️  %3d  %s  (> 5, 분리 검토)\n" "$count" "$f"
    HAS_HIT=1
  fi
done
[ "$HAS_HIT" = 0 ] && echo "  ✅ useState 5개 초과 컴포넌트 없음"

# 3. 중복 라인
echo ""
echo "[3/3] 중복 라인 (30자+ 3회+ 등장, 상위 10)"
DUPES=$(cat $SRC_FILES 2>/dev/null \
  | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' \
  | grep -vE '^(//|/\*|\*|\*/|$|import |export |const [a-zA-Z_]+ = require|\} from)' \
  | awk 'length($0) >= 30' \
  | sort | uniq -c \
  | awk '$1 >= 3' \
  | sort -rn | head -10)
if [ -z "$DUPES" ]; then
  echo "  ✅ 유의미한 중복 없음"
else
  echo "$DUPES" | awk '{
    n = $1
    $1 = ""
    sub(/^ /, "")
    printf "  %d회  %s\n", n, $0
  }'
fi

echo ""
echo "=== 완료 (진단용, 게이트 아님) ==="
echo ""
