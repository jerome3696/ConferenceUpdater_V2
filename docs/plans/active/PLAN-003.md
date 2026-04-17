# PLAN-003: QA 백로그 14건 일괄 처리 (Batch 1)

> **상태**: active
> **생성일**: 2026-04-17
> **브랜치**: `feature/PLAN-003-qa-batch1`
> **트랙**: QA(qa-backlog 일괄)

---

## 1. 목표 (What)

`docs/qa-backlog.md` Active 14건을 단일 브랜치에서 논리 그룹별 commit으로 처리하고 1개 PR로 merge.
완료 기준: `bash scripts/verify-task.sh` 통과, 14건 항목 `[x]` 체크 + Completed 섹션 이동, 브라우저 수동 확인 시나리오 통과.

## 2. 배경·동기 (Why)

사용자가 일상 사용 중 누적한 UI/UX 개선 14건이 백로그에 쌓임. 5~10건 처리 임계 도달.
PLAN-002 (Prompt v4 — B.2)는 `src/utils/promptBuilder.js` + `docs/prompteng.md`에 한정되어 QA 14건과 파일 충돌 없음 → 병행 처리 가능.

## 3. 범위 (Scope)

### 포함

`docs/qa-backlog.md` Active 14건 전부:

1. UpdateCard 신뢰도 badge + source_url 링크 (부분 정보 학회 케이스)
2. React 19 advisory 룰 cleanup + 등급 error 복귀
3. UpdatePanel 전체 승인/전체 거절 일괄 버튼
4. 변경없음 UpdateCard → 한 줄 배너
5. 변경있음 UpdateCard 폰트·패딩 축소
6. 액션 버튼 컬럼을 첫 열로 이동 (★ 앞)
7. LAST·참고/메모 컬럼 접기/펼치기
8. 한글 word-break (`word-break: keep-all`)
9. 학회명·메모 5줄 truncation + ellipsis
10. 장소 포맷 통일 (US: City, State, USA / 그 외: City, Country)
11. 개별 업데이트 즉시 이동 안 함 (Option B: UpdatePanel overlay화)
12. 지역 워딩 '세계' → '전세계' + '아시아' word-break
13. 편집 시 source 갱신 조건 (Upcoming 필드 편집 시에만)
14. AI 출처 신뢰도 inline ("AI검색 (고/중/저)")

### 제외 (Non-goals)

- PLAN-002 (B.2 Prompt v4) — 별도 PR
- ConferenceFormModal/FilterBar 컴포넌트 테스트 확장 (B.1 후속 follow-up)
- E2E 테스트

## 4. 설계 결정

### Item 11 — Option B (UpdatePanel overlay화)

- **Option A**: MainTable에 다중 선택(체크박스) → "선택 항목 업데이트"
- **Option B**: 개별 업데이트 클릭 시 큐에만 추가, UpdatePanel을 overlay로 변경 → 메인 화면 유지
- **Option B 채택 이유**: (1) MainTable 구조 무변동 → B.1 테스트와 충돌 최소, (2) 기존 큐 로직 그대로 활용, (3) "여러 학회 연속 클릭 → 큐에 쌓이고 → 한 번에 패널에서 처리"가 자연스러움.

### Item 12 — REGION 워딩 데이터 마이그레이션

- 기존 `data/conferences.json`/사용자 localStorage에 `region: '세계'` 행 가능성.
- Step 1 진입 시 `data/conferences.json` 검사 → 일치 행 있으면 마이그레이션 1회 수행.
- localStorage는 다음 편집/업데이트 시 자연 갱신.

### Item 2 — ESLint cleanup 위치

Group 1 마지막에 배치. 다른 Group의 새 코드도 강화된 룰로 일관 검사받게 함. 룰별로 commit 분리.

### Item 6, 7 — 테스트 동시 갱신

B.1로 추가된 `MainTable.test.jsx`의 정렬·헤더 가정(line 169-202, 184-185)이 깨짐. **같은 commit에 코드+테스트 함께 수정**.

## 5. 단계 (Steps)

각 Group 후 `npm test` 통과 확인, `git commit`.

- [x] Step 0 — 브랜치 생성 (`feature/PLAN-003-qa-batch1`, base: main) + 본 PLAN-003.md 작성
- [ ] Step 1 — Group 1: Item 12-워딩 (REGION_OPTIONS 변경 + 데이터 마이그레이션 결정/실행)
- [ ] Step 2 — Group 1: Item 2 (ESLint advisory 룰 3건 cleanup + warn → error 복귀)
- [ ] Step 3 — Group 2: Items 4, 5 (UpdateCard 변경없음 배너 + 변경있음 폰트/패딩)
- [ ] Step 4 — Group 2: Items 1, 3 (UpdateCard confidence badge + source_url, UpdatePanel 전체 승인/거절)
- [ ] Step 5 — Group 3: Item 11 (App.jsx에서 setView 제거, UpdatePanel overlay화)
- [ ] Step 6 — Group 4: Item 13 (useConferences upsertEdition source 조건 + 테스트)
- [ ] Step 7 — Group 5: Item 10 (locationFormatter 신규 + 테스트)
- [ ] Step 8 — Group 6: Items 8, 9, 12-css (CSS — word-break, line-clamp)
- [ ] Step 9 — Group 6: Item 14 (출처 셀 신뢰도 inline)
- [ ] Step 10 — Group 6: Items 6, 7 (액션 버튼 첫 열 + LAST/메모 접기) + MainTable.test.jsx 갱신
- [ ] Step 11 — `bash scripts/verify-task.sh` 통과
- [ ] Step 12 — qa-backlog.md 14건 [x] 체크 + Completed 섹션 이동
- [ ] Step 13 — PR 생성 (PLAN-002 PR과 독립)

## 6. 검증 (Verification)

- [ ] `bash scripts/verify-task.sh` 통과
- [ ] `npm test` 73건(B.1) + 신규(item 10, 13) 전건 통과
- [ ] `npm run lint` zero errors (item 2 후)
- [ ] 브라우저 수동 확인 (`npm run dev`):
  - 변경없음 카드 한 줄 배너 + 변경있음 카드 폰트/패딩 축소
  - confidence badge·source_url 클릭 가능
  - "전체 승인"/"전체 거절" 동작
  - 개별 업데이트 클릭 → 메인 유지, UpdatePanel overlay
  - 메인 테이블: 액션 버튼 ★ 앞, LAST·메모 기본 접힘 + 토글
  - 한글 word-break ('박람/회'·'아시/아' 분리 안 됨)
  - 학회명/메모 5줄 초과 시 ellipsis
  - 장소 포맷 US "City, State, USA" / 그 외 "City, Country"
  - 출처 셀 AI일 때 "AI검색 (고/중/저)"
  - region 옵션 '전세계, 미주, 유럽, 아시아'
  - 편집 모달: Last/기본정보만 수정 → source 'AI검색' 유지
  - 편집 모달: Upcoming 수정 → source 'user_input'로 변경

## 7. 리스크·롤백

- **Item 11 (Option B 모달화)**: view 분기 흐름 변경. 우려 시 Step 5를 마지막으로 미룸.
- **Item 2 (ESLint)**: 24건 코드 수정 회귀 위험. 룰별로 commit 분리. 문제 시 해당 룰만 `warn`으로 복귀.
- **Item 6, 7**: B.1 테스트 갱신 누락 시 CI 실패. 같은 commit에 테스트 수정 포함.
- **Item 12 마이그레이션**: 기존 `'세계'` 행 누락 시 사용자 데이터 손실. Step 1 진입 시 데이터 검사 필수.
- **Item 13**: 기존 사용자 데이터의 source 값은 즉시 안 바뀜(다음 편집부터 적용). 회귀 위험 낮음.
- **PLAN-002 (B.2)와의 의미적 상호작용**: B.2가 confidence 산출 변경하면 item 1·14의 표시 값 영향. 코드 충돌 아님. PR merge 후 시각 재확인.

## 8. 후속 (Follow-ups)

- 해당사항 없음 (14건 본 plan으로 완전 처리)

## 9. 작업 로그

- 2026-04-17: 플랜 작성. B.1 merge 직후, B.2(PLAN-002 Prompt v4)와 병행 진행.
