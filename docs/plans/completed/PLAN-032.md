# PLAN-032: AI 응답 source_url 강제 + UI 출처 링크

> **상태**: active
> **생성일**: 2026-05-03
> **완료일**: (미완)
> **브랜치**: `feature/PLAN-032-ai-source-urls`
> **연관 PR**: #
> **트랙**: B(품질) — Phase **A.3** (`docs/blueprint-v2.md` §5.1)
> **의존**: 없음 (단독 머지 가능)

---

## 1. 목표 (What)

AI 응답이 각 필드별 근거 URL 1~2개를 반환하도록 프롬프트 v1_2 도입. UI 카드에 [근거] 링크 추가. 완료 조건:
1. `promptBuilder.js` v1_2 함수 추가, v1_1 보존 (이전 버전 불변 원칙)
2. `docs/prompts/v1_2.md` raw text 신설 (sync 테스트 통과)
3. `responseParser.js` schema 확장 — 각 필드 `source_urls?: string[]`
4. `UpdateCard.jsx` / `VerificationCard.jsx` 의 각 필드 옆 작은 `[근거]` 링크 (있을 때만)
5. v1_2 활성화 (`MODELS.update` 또는 활성 prompt 키 v1_2 로 전환)

## 2. 배경·동기 (Why)

- /grill-me Q7-a A2: AI 무분별 수용 방지의 가장 가성비 높은 방어
- 사용자가 AI 결과 수용 전 직접 검증 가능
- audit_log (PLAN-031) 와 함께 데이터 품질 신뢰 사슬 완성
- 추가 비용 거의 없음 (출력 토큰만 약간 ↑)

## 3. 범위 (Scope)

### 포함
- `src/utils/promptBuilder.js` — `buildUpdatePromptV2`, `buildVerifyPromptV2`, `buildLastEditionPromptV2`
- `docs/prompts/v1_2.md` — v1_1 기반 + "각 필드별 source_urls 1~2개 필수" 추가
- `src/services/responseParser.js` — schema 확장 (각 필드 `{ value, source_urls? }` 또는 별도 `_sources` 필드)
- `UpdateCard.jsx` / `VerificationCard.jsx` — 각 변경 필드 옆 작은 `[근거]` 텍스트 링크 (target=_blank)
- 활성 prompt 전환 — `promptBuilder.js` 의 active export 를 v1_2 로
- 테스트 추가:
  - `promptBuilder.sync.test.js` — v1_2 동기 검증
  - `promptBuilder.test.js` — v1_2 빌드 결과 검증
  - `responseParser.test.js` — source_urls 파싱 케이스
  - 기존 모든 v1_1 테스트는 보존

### 제외 (Non-goals)
- AI 자체 신뢰도 점수 (A3) — Phase B
- 다른 사용자 결과와 비교 (A4) — Phase B
- 출처 URL 의 실제 검증 (broken link check 등) — Phase C

## 4. 설계 결정

### 4.1 schema 변경 — 별도 `_sources` 객체 vs 필드별 inline

**선택**: 별도 `_sources` 객체. `responseParser` 가 `_sources: { start_date: ['url1', 'url2'], end_date: [...], ... }` 로 매핑.
- 장점: 기존 필드 schema 호환 (값은 그대로 string), 파싱 단순
- 단점: 필드 이름 중복 (단점 작음)

```json
{
  "start_date": "2027-08-15",
  "end_date": "2027-08-20",
  "venue": "Tokyo, Japan",
  "link": "https://ihtc18.org",
  "_sources": {
    "start_date": ["https://ihtc.org/news/2027"],
    "venue": ["https://ihtc.org/news/2027"],
    "link": []
  }
}
```

### 4.2 v1_2 프롬프트 핵심 추가 문구
> 각 필드별로 응답 JSON 의 `_sources` 객체 안에 `<field>: [url1, url2]` 형식으로 1~2개의 출처 URL 을 반드시 포함하세요. 출처는 본인이 web_search 로 실제 확인한 페이지의 URL 이어야 합니다. 추측·생성하지 마세요.

### 4.3 UI 표시
- 각 필드 옆에 `[근거]` 작은 회색 링크 (있을 때만)
- 다중 URL 시 첫 URL 만 클릭 대상, hover 에 tooltip 으로 모든 URL 표시
- responseParser 가 `_sources` 없을 때 (v1_1 응답) 도 깨지지 않게 optional

## 5. 단계 (Steps)

- [ ] **S1** — 브랜치 + `docs/prompts/v1_2.md` 작성
- [ ] **S2** — `promptBuilder.js` v1_2 함수 + sync 테스트 갱신
- [ ] **S3** — `responseParser.js` schema 확장 + 테스트
- [ ] **S4** — `UpdateCard` / `VerificationCard` UI 수정
- [ ] **S5** — 활성 prompt 전환 (v1_1 → v1_2)
- [ ] **S6** — `docs/prompteng.md` §5 로그 + §1 현황판 갱신
- [ ] **S7** — verify-task.sh 통과
- [ ] **S8** — PR

## 6. 검증

- [ ] verify-task.sh 통과
- [ ] sync test pass (양쪽 동기 보존)
- [ ] 기존 v1_1 테스트 모두 그린
- [ ] mock 응답에 `_sources` 있을 때 / 없을 때 모두 파싱 OK
- [ ] UI: 카드에 [근거] 링크 표시, 클릭 새 탭

## 7. 리스크·롤백

- **리스크**: AI 가 `_sources` 형식 안 지키면 파싱 fallback. 파서가 graceful degradation 보장.
- **롤백**: 활성 prompt v1_1 로 회귀 (양 버전 동시 보존이라 1줄 변경)

## 8. 후속

- 신뢰도 점수 (A3), 다른 사용자 결과 비교 (A4) — Phase B
- broken link check — Phase C

## 9. 작업 로그

- **2026-05-03**: blueprint v2 §5.1 기반 스펙 확정.
