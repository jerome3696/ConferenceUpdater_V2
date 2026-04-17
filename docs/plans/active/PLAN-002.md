# PLAN-002: Prompt v4 — 부분정보 처리 규칙 3종 보완

> **상태**: active
> **생성일**: 2026-04-17
> **브랜치**: `feature/PLAN-002-prompt-v4`
> **트랙**: B(품질) — B.2 프롬프트 이터레이션

---

## 1. 목표 (What)

v3 실사용 중 발견된 3가지 엣지케이스를 v4로 수정한다.
완료 기준: eval 19/19 유지 + 브라우저에서 ICMF(confidence=low+출처링크), ICCFD(날짜 추출), TPTPR(link=null) 동작 확인.

## 2. 배경·동기 (Why)

v3는 eval 19/19 달성했으나 실사용 중 아래 3케이스에서 품질 이슈 발견:
1. ICMF: 날짜 없는데 confidence=medium, 출처 URL이 link에 미반영
2. ICCFD: 공식사이트 발견 후 하위 페이지 날짜 미추출
3. TPTPR: 금지 도메인 명시에도 시리즈 페이지가 link에 사용됨

## 3. 범위 (Scope)

### 포함
- `src/utils/promptBuilder.js` — UPDATE_SYSTEM_V4 + buildUpdateUserV4 추가
- `docs/prompteng.md` — §5 로그, §1 현황판 갱신
- DEFAULT_UPDATE_VERSION → 'v4' 변경

### 제외 (Non-goals)
- UI 변경 (UpdateCard, responseParser 등)
- golden-set 케이스 추가 (날짜 추출 eval은 수동 확인)
- v1/v2/v3 코드 수정

## 4. 설계 결정

- v3 복사 후 4가지 규칙 추가: confidence 기준(A), link 4순위(B), 날짜 탐색(C), 시리즈 null(D)
- link 4순위(출처 URL)는 금지 도메인 해당 시 사용 불가 조건 명시
- eval pass율은 link URL 매칭 기반이라 날짜 추출 개선은 수동 확인 필수

## 5. 단계 (Steps)

- [ ] Step 1 — UPDATE_SYSTEM_V4 추가 (A confidence 기준 + D 시리즈 null 강화)
- [ ] Step 2 — buildUpdateUserV4 추가 (B link 4순위 + C 날짜 탐색 강화)
- [ ] Step 3 — DEFAULT_UPDATE_VERSION = 'v4' 변경
- [ ] Step 4 — npm run eval -- --version v4 → 19/19 확인
- [ ] Step 5 — prompteng.md §5 로그 + §1 현황판 갱신
- [ ] Step 6 — verify-task.sh 통과

## 6. 검증 (Verification)

- [ ] `bash scripts/verify-task.sh` 통과
- [ ] `npm run eval -- --version v4` → 19/19 이상
- [ ] 브라우저 ICMF: confidence=low, link=출처URL
- [ ] 브라우저 ICCFD: 날짜 추출 확인
- [ ] 브라우저 TPTPR: link=null
- [ ] prompteng.md §5 로그 + §1 갱신

## 7. 리스크·롤백

- v4 규칙 추가로 기존 pass 케이스가 깨질 수 있음 → eval 먼저 확인
- link 4순위(출처 URL) 규칙이 과도하게 적용될 경우 불필요한 링크 생성 가능
- 롤백: DEFAULT_UPDATE_VERSION을 'v3'으로 되돌리면 즉시 복귀

## 8. 후속 (Follow-ups)

- golden-set에 ICMF/TPTPR 유형 케이스 추가 (부분정보 케이스 커버리지 확대)
- confidence 레벨에 따른 UI 배지 스타일 차별화 (qa-backlog 항목)

## 9. 작업 로그

- 2026-04-17: 플랜 작성. v3 실사용 중 3케이스 발견, 분석 완료.
