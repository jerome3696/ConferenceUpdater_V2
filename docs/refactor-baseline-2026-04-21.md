# Refactor-check 기준선 — 2026-04-21

> `bash scripts/refactor-check.sh` 스냅샷. 이후 리팩토링(Track G.1~G.4)의 비교 기준선.
> 실행 시점: PLAN-013/014~019 머지 직후, 정리 브랜치(`chore/cleanup-plan-files-and-guide-sync`) 기준.

---

## 1. 파일 줄 수 (테스트 제외)

| 심각도 | 줄 수 | 파일 | 임계 |
|--------|------|------|------|
| ❌ Critical | 684 | `src/utils/promptBuilder.js` | > 500, 분리 강권장 |
| ⚠️ Warning | 391 | `src/hooks/useConferences.js` | > 300, 검토 권장 |
| ⚠️ Warning | 373 | `src/components/MainTable/ConferenceFormModal.jsx` | > 300 |
| ⚠️ Warning | 367 | `src/components/Discovery/DiscoveryPanel.jsx` | > 300 |
| ⚠️ Warning | 344 | `src/components/MainTable/MainTable.jsx` | > 300 |
| ⚠️ Warning | 305 | `src/services/responseParser.js` | > 300 |

**요약**: critical 1, warning 5.

## 2. useState 밀도 (.jsx)

| 심각도 | 개수 | 파일 | 임계 |
|--------|------|------|------|
| ❌ Critical | 14 | `src/components/Discovery/DiscoveryPanel.jsx` | > 10, 상태 분리 필요 |
| ⚠️ Warning | 9 | `src/App.jsx` | > 5, 분리 검토 |
| ⚠️ Warning | 6 | `src/components/MainTable/ConferenceFormModal.jsx` | > 5 |

## 3. 중복 라인 (30자+, 3회+ 등장, 상위 10)

| 빈도 | 패턴 | 위치 후보 |
|------|------|----------|
| 6회 | `return { ok: false, reason: 'schema_mismatch', raw: text, parsed: data };` | `responseParser.js` (G.3로 통합) |
| 6회 | `className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"` | 공통 Button 추출 후보 |
| 5회 | `onClick={(e) => e.stopPropagation()}` | 인라인 그대로 두는 게 자연스러움 |
| 5회 | `if (typeof data !== 'object' \|\| Array.isArray(data)) {` | `responseParser.js` (G.3) |
| 5회 | `if (data === null) return { ok: false, reason: 'no_json', raw: text };` | `responseParser.js` (G.3) |
| 5회 | `if (!text \|\| !text.trim()) return { ok: false, reason: 'empty', raw: text \|\| '' };` | `responseParser.js` (G.3) |
| 5회 | `className="text-blue-600 hover:underline break-all"` | 공통 링크 스타일 (저위험) |
| 4회 | `주기: ${cycle_years ? \`${cycle_years}년\` : '미상'}` | `promptBuilder.js` (G.2 외부화로 자연 해소) |
| 4회 | `약칭: ${abbreviation \|\| '없음'}` | `promptBuilder.js` (G.2) |
| 4회 | `공식사이트: ${official_url \|\| '없음'}` | `promptBuilder.js` (G.2) |

---

## 4. 후속 플랜 매핑

| Track G | 플랜 | 대상 | 예상 효과 | 공수 | 위험 |
|---------|------|------|----------|------|------|
| G.1 | PLAN-020 | `useUpdateQueue.js` last-edition 추출 | 278 → ~250 | S | 저 |
| G.2 | PLAN-021 | `promptBuilder.js` 외부화 (MD 템플릿 로드) | 684 → ~450 | M | 저 |
| G.3 | PLAN-022 | `responseParser.js` BaseParser 통합 | 305 → ~250, 중복 6·5·5·5회 해소 | M | 중 |
| G.4 | PLAN-023 | `DiscoveryPanel.jsx` 3개 훅 분리 | 367 → ~120 ×3 | L | 고 |

---

## 5. 참고

- **판단 노트**: `DATE_RE` 는 `responseParser.js` 내부 단일 정의·5회 재사용으로 중복 아님 (모듈 내 재사용은 정상).
- **공통 Button 추출**: 10개 파일 영향·스타일 미세 차이 → 디자인 회귀 점검 필요. Track G에 포함하지 않고 별도 검토.
- **리팩토링 우선순위**: G.2 > G.1 > G.3 > G.4. G.2 는 v1_2 프롬프트 튜닝 **전에** 완료하면 튜닝 과정이 깔끔.
- **promptBuilder 현재 구조 (2026-04-21 확인)**: v1_0 + v1_1 두 버전이 4 kind(update/verify/discovery/lastEdition) × system/user 조합으로 내장. 외부화하더라도 분기 로직·4 kind × 2 버전 공통 헬퍼는 남아 ~450줄 선이 현실적 바닥 (초기 목표 ~280 은 비현실적, architect/code-reviewer 2026-04-21 리뷰).
