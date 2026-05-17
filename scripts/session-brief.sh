#!/usr/bin/env bash
# SessionStart 훅 — docs/status.md 의 현황 브리핑(§1~§3)을 세션 컨텍스트에 주입.

if [ ! -f docs/status.md ]; then
  echo "[session-brief] docs/status.md 없음 — 문서 개혁 미적용 상태일 수 있음."
  exit 0
fi

echo "=== ConferenceFinder 현황 브리핑 (docs/status.md) ==="
echo ""
# §1(지금 어디) ~ §3(검증 대기) 까지만 출력, §4 직전에서 멈춤
sed -n '/^## 1\./,/^## 4\./p' docs/status.md | sed '$d'
echo ""
echo "(전체: docs/status.md · 진본: roadmap.md / blueprint.md / dev-guide.md)"
