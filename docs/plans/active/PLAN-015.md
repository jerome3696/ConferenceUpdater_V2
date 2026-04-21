# PLAN-015: 골든셋 XLSX 일원화 + CSV 마이그레이션 (PR-2)

> **상태**: active
> **생성일**: 2026-04-20
> **브랜치**: `feature/PLAN-015-golden-xlsx`
> **연관 PR**: TBD (PR-1 `feature/PLAN-014-prompt-md-sync` 위에 스택)
> **트랙**: F (운영 품질) — F.2 프롬프트 평가 체계화 · PR-2

---

## 1. 목표 (What)

현재 `docs/eval/golden-set.csv` (5컬럼 link-only) 를 폐기하고 **MainTable 과 동일한 스키마의 XLSX** 로 전환.

완료 시:
- `src/services/goldenSheet.js` — 브라우저·Node 공유 순수 함수 (20+컬럼 매핑 + workbook 빌드).
- `docs/eval/golden-set.xlsx` — 기존 19건 이식 완료 (검증 메타 보존).
- `docs/eval/golden-set.meta.json` — snapshot_date, 활성 버전, 행 수.
- `scripts/export-golden-xlsx.js` — conferences.json → `docs/eval/snapshots/<date>.xlsx`.
- `scripts/import-golden-xlsx.js` — xlsx → `docs/eval/golden-set.parsed.json` (eval-prompt.js 입력 용).
- `scripts/migrate-csv-to-xlsx.js` — 1회성 이식기 (PR 승인 후 재실행 불필요).
- `docs/eval/legacy/` — 기존 CSV/JSON 동결 보존.
- `scripts/legacy/` — `csv-to-golden.js`·`refresh-golden.js` 이동.
- 신규 테스트: `goldenSheet.test.js` (매핑), `import-golden-xlsx.test.js` (검증).

## 2. 배경·동기 (Why)

상위 플랜 `C:\Users\jerom\.claude\plans\prompt-v6-breezy-lollipop.md` §핵심 구현 3 의 Stage 1.

현재 문제:
- golden-set.csv 는 link·source_url·verified_at 만 있어 **upcoming start/end/venue 는 채점 불가**.
- 사용자가 "주기 1년 vs 4년 학회 느낌 다르다"고 해도 cycle_years 가 CSV 에 없어 버킷 분석 불가.
- snapshot_date 가 JSON 에만 있고 CSV 엔 없어 시점 추적 분산.
- MainTable 에서 한 번에 보는 데이터를 에디터에서 다시 찾는 non-DRY.

## 3. 범위 (Scope)

### 포함
- 신규: `src/services/goldenSheet.js`, `scripts/{export,import,migrate-csv-to}-golden-xlsx.js`, `docs/eval/golden-set.xlsx`, `docs/eval/golden-set.meta.json`, 테스트 2종.
- 수정: `src/services/exportService.js` — 20컬럼 매핑을 `goldenSheet.js` 로 위임 (기존 `.xlsx` 버튼 동작 유지).
- 이동: `docs/eval/{golden-set.csv,golden-set.json}` → `docs/eval/legacy/`. `scripts/{csv-to-golden,refresh-golden}.js` → `scripts/legacy/`.
- `.gitignore`: `docs/eval/snapshots/*.xlsx` 추가 (스냅샷은 크기 때문에 git 제외, `golden-set.xlsx` 루트 + `*.meta.json` 은 추적).

### 제외 (Non-goals)
- `scripts/eval-prompt.js` 의 채점 로직 개편 — PR-3.
- eval-loop — PR-4.
- Skill·문서 — PR-5.

## 4. 설계 결정

- **goldenSheet.js 는 순수 함수만**: `buildRows(conferences, editions)` · `toSheetData(rows, metaOverlay)` · `createWorkbook({rows, snapshotDate, activeVersion, metaOverlay})`. DOM·filesystem 접근 없음 → 브라우저(exportService)·Node(scripts) 모두 동일 호출.
- **컬럼 그룹 순서**: 식별(3) → 마스터(8) → Upcoming(6) → Last(4) → 검증 메타(3) = 24컬럼. 한 눈에 마스터→upcoming→last 흐름.
- **영문 컬럼명**: MainTable 수출은 `즐겨찾기/분류/분야/...` 한글이었지만, 골든셋은 eval 파이프라인 입력 용도라 **영문 snake_case 로 통일** (`id, abbreviation, full_name, starred, category, field, ...`). 파이프라인 안정성 우선.
- **`_meta` 시트**: `snapshot_date, active_version, row_count, generator_version` 4행. 파일명에도 snapshot_date 박아 중복 보호.
- **검증 메타 보존**: 기존 CSV 의 `verified_at/source_url/notes` 3컬럼을 새 XLSX 에 그대로. link 는 **upcoming_link 와 중복**이지만 정답지로서 별도 유지 (AI 가 맞춰야 할 값). 마이그레이션 시 CSV 의 `link` → XLSX 의 `upcoming_link` 에 덮어쓰고 (conferences.json 의 최신 upcoming link 우선), CSV 의 `source_url/verified_at/notes` 는 검증 메타에 그대로.
- **Import 검증**: id 가 conferences.json 에 존재 · 날짜가 `YYYY-MM-DD` · `upcoming_link` 스킴이 http(s) — 실패 시 스크립트 exit(1).
- **migrate 는 1회성**: 실행 결과 (`golden-set.xlsx`) 를 git 에 커밋하면 재실행 불필요. 스크립트 자체는 리포에 남겨 archaeology 용.

## 5. 단계

- [ ] Step 1 — `src/services/goldenSheet.js` 작성 (순수 함수)
- [ ] Step 2 — `scripts/export-golden-xlsx.js` 작성 + 스냅샷 1회 생성
- [ ] Step 3 — `scripts/migrate-csv-to-xlsx.js` 작성 + 실행 → `docs/eval/golden-set.xlsx` 생성
- [ ] Step 4 — `scripts/import-golden-xlsx.js` 작성 + 실행 → `docs/eval/golden-set.parsed.json` 생성
- [ ] Step 5 — legacy 폴더로 이동 + `exportService.js` 리팩터 + 테스트 2종 + `bash scripts/verify-task.sh`
- [ ] Step 6 — 커밋 + PR (PR-1 위 스택)

## 6. 검증

- [ ] `bash scripts/verify-task.sh` 전항목 통과
- [ ] `goldenSheet.test.js` — buildRows·toSheetData 라운드트립
- [ ] `import-golden-xlsx.test.js` — 유효/무효 입력 분기
- [ ] `node scripts/export-golden-xlsx.js --snapshot-date 2026-04-20` → `docs/eval/snapshots/2026-04-20.xlsx` 존재
- [ ] `node scripts/import-golden-xlsx.js` → parsed.json 19건·에러 0
- [ ] 브라우저 MainTable 의 `.xlsx` 수출 버튼이 여전히 작동 (한글 컬럼 유지)

## 7. 리스크·롤백

- **저**: goldenSheet.js 추출 과정에서 브라우저 xlsx 수출이 깨짐. 완화: 기존 `exportAsXlsx` 는 **한글 컬럼** 유지, goldenSheet.js 는 **영문 컬럼**. 두 경로가 다른 함수를 호출하도록 분리.
- **저**: migrate 스크립트가 CSV 주석행(`# ...`) 을 데이터로 오해. 완화: `id` 가 `conf_` 로 시작하는 행만 처리.
- **중**: 기존 CSV 경로에 의존하던 곳이 있으면 깨짐. 완화: `grep -r golden-set.csv` 로 참조 전수 조사 후 처리.
- 롤백: 파일 이동 + 신규 파일만. PR revert 1회.

## 8. 후속 (Follow-ups)

- PR-3: eval-prompt.js XLSX 입력 + 필드별 채점
- PR-4: eval-loop.js

## 9. 작업 로그

- 2026-04-20: PR-1 (PLAN-014) 로컬 완료 (커밋 1a774d9) · PR-2 착수
