# legacy — 구버전 골든셋 (동결)

PR-2 (PLAN-015) 이전의 link-only CSV 스키마.

- `golden-set.csv` — 5컬럼 (`id, link, source_url, verified_at, notes`) + 가이드 주석
- `golden-set.json` — `scripts/legacy/csv-to-golden.js` 가 CSV → JSON 변환

## 현재 상태

- **사용 중**: `scripts/eval-prompt.js` 가 여전히 이 경로를 읽음 (PR-3 에서 XLSX 입력으로 교체 예정).
- **편집 금지**: 신규 케이스는 `docs/eval/golden-set.xlsx` 에만.
- **재생성 가능**: `npm run eval:refresh` → 여기 CSV 가 conferences.json 기준으로 재생성.

## 왜 동결했나

- 스키마가 link 만 보유 → upcoming start/end/venue 채점 불가 → cycle_years 버킷 분석 불가.
- MainTable 구조와 이격 → 사용자가 골든셋 편집 시 다시 찾아봐야 하는 비용.

PR-3 완료 후에는 `scripts/eval-prompt.js` 가 이 경로를 참조하지 않게 되고, 그 시점에 완전 제거 가능.
