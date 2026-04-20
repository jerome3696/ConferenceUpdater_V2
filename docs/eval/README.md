# 프롬프트 평가 가이드

이 폴더는 Claude API 프롬프트 품질을 **회귀 테스트**로 관리하기 위한 자리입니다.
정답지(golden set)를 고정해두고, 프롬프트를 바꿀 때마다 같은 케이스를 돌려 성공/실패 추이를 봅니다.

**PR-2 (PLAN-015) 이후 XLSX 기반으로 전환 중**. eval-prompt.js 의 XLSX 입력 전환은 PR-3.

## 파일 구조

- **`golden-set.xlsx`** — 편집 대상. MainTable 과 동일한 24컬럼 스키마. `_meta` 시트에 `snapshot_date, active_version` 기록.
- `golden-set.meta.json` — snapshot 메타 (xlsx 와 쌍).
- `golden-set.parsed.json` — 자동 생성 (xlsx import 결과). gitignore. 편집 금지.
- `snapshots/<date>.xlsx` — conferences.json 에서 뽑은 전체 스냅샷 (편집 전 원본). 대용량이라 git 제외.
- `results/<timestamp>-<version>.json` — 평가 러너 실행 결과 로그.
- `runs/<run-id>/run.json` — 재시도 루프 집계 (PR-4).
- `legacy/` — 기존 CSV/JSON 동결. 참조용.

## XLSX 스키마 (24컬럼)

| 그룹 | 컬럼 |
|---|---|
| 식별 (3) | `id`, `abbreviation`, `full_name` |
| 마스터 (8) | `starred`, `category`, `field`, `cycle_years`, `duration_days`, `region`, `official_url`, `note` |
| Upcoming (6) | `upcoming_start`, `upcoming_end`, `upcoming_venue`, `upcoming_link`, `upcoming_confidence`, `upcoming_anchored` |
| Last (4) | `last_start`, `last_end`, `last_venue`, `last_link` |
| 검증 메타 (3) | `verified_at`, `source_url`, `notes` |

`_meta` 시트: `snapshot_date, active_version, row_count, generator_version` 4행 key/value.

## 관리 명령

```bash
npm run golden:export              # conferences.json → docs/eval/snapshots/<today>.xlsx
npm run golden:export -- --snapshot-date 2026-04-20   # 명시 날짜
npm run golden:import              # golden-set.xlsx → golden-set.parsed.json + 검증
npm run eval                       # API 평가 실행 (legacy CSV 기반, PR-3 에서 XLSX 전환)
```

### Export/Import 워크플로

1. **스냅샷 뽑기**: `npm run golden:export -- --snapshot-date YYYY-MM-DD` → `snapshots/YYYY-MM-DD.xlsx` 생성.
2. **행 선별**: 엑셀에서 열어 원하는 케이스만 남기고 저장 → `golden-set.xlsx` 에 덮어쓰기.
3. **검증 메타 채우기**: `verified_at, source_url, notes` 3컬럼 수작업 입력.
4. **Import**: `npm run golden:import` → `golden-set.parsed.json` 생성 + id/날짜/URL 검증.

## 정답지 작성 규칙

1. **5~20건**이면 충분. 다양성 우선:
   - 주기 1년·2년·4년 분산
   - 지역 유럽·미주·아시아 분산
   - 공식사이트 활발 vs 비활발
2. **공식사이트에서 직접 확인**한 값만. AI 결과 복사 금지.
3. 확인 불가 필드는 빈 문자열.
4. `source_url` 에 근거 공식사이트 링크 기록 → 재검증 가능.
5. `_meta` 시트의 `snapshot_date` 가 정답지 시점. 프롬프트 개선 시 같은 시점 재사용.

## 합격 기준 (MVP)

- **pass**: 4개 필드(start_date, end_date, venue, link) 전부 일치
- **partial**: 1~3개 일치
- **fail**: 0개 일치 또는 파싱 실패

정답지 중 **5건 이상 pass** 면 MVP 합격선.

## 실패 원인 분류

- `api_error` — CORS/인증/네트워크/rate limit
- `parse_fail: no_json` — 응답에 JSON 블록 없음 → 시스템 프롬프트의 "반드시 JSON" 강화
- `parse_fail: invalid_json` — 문법 오류 → max_tokens 증가 또는 템플릿 단순화
- `parse_fail: schema_mismatch` — 필드명 다름 → 예시 JSON 을 프롬프트에 명확히
- `partial/fail (값 불일치)` — 검색 품질 문제 → source filtering 강화, 공식사이트 힌트 강조

## legacy CSV/JSON (동결)

PR-2 이전 스키마: `id, link, source_url, verified_at, notes` (5컬럼 link-only).
`docs/eval/legacy/golden-set.csv` 에 동결 보존. 현재는 미사용. `scripts/legacy/{csv-to-golden,refresh-golden}.js` 로 재생성 가능하지만 새 워크플로와 혼용 금지.
