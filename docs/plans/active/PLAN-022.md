# PLAN-022: responseParser 헤드 파서 공통 추출 — 305 → ~270줄

> **상태**: active
> **생성일**: 2026-04-21
> **브랜치**: `feature/PLAN-022-response-parser-slim`
> **트랙**: G.3 (리팩토링, dev-guide-v3 §2)

---

## 1. 목표 (What)

`src/services/responseParser.js` (305줄 warning) 의 5개 parse 함수 (`parseUpdateResponse` / `parseLastEditionResponse` / `parseVerifyResponse` / `parseDiscoveryExpandResponse` / `parseDiscoverySearchResponse`) 모두 같은 "empty → no_json → object 검사" 헤드를 반복. 이걸 `extractObjectPayload(text)` 1개로 통합. 동시에 dead code (`invalid_json` 분기) 제거. 공개 API 불변.

## 2. 배경·동기 (Why)

- `bash scripts/refactor-check.sh`: 305줄 warning (300 임계 초과)
- 중복 라인 상위: `return { ok: false, reason: 'schema_mismatch', ... }` 6회 / `if (typeof data !== 'object' || Array.isArray(data))` 5회 / `if (data === null) return { ok: false, reason: 'no_json', ... }` 5회 / `if (!text || !text.trim()) return { ok: false, reason: 'empty', ... }` 5회
- `parseUpdateResponse` 외부 try/catch 는 `extractJson` 이 내부에서 이미 catch 하므로 절대 발화 불가 (`invalid_json` reason 은 테스트 0건)
- 공개 API (에러 reason 문자열 · 성공 shape) 는 모두 테스트됨 → 변경 금지

## 3. 범위

### 포함
- `extractObjectPayload(text) → { ok: true, data } | { ok: false, reason, raw, parsed? }` 내부 helper 신설
- 5개 parser 재작성 (헤드 3줄 → helper 호출 1줄)
- `parseUpdateResponse` 의 unreachable `invalid_json` 분기 및 JSDoc 에서 제거
- JSDoc reason 목록 갱신

### 제외
- 공개 API 시그니처·export 구성 변경
- BANNED_LINK_DOMAINS·normalizeUpdateData 로직 수정
- 테스트 변경 (expect(reason).toBe(...) 항목 불변)
- 각 parser 의 본문 (키 필터링·dedup·candidate 변환) 로직

## 4. 설계 결정

### 4.1 `extractObjectPayload` 시그니처
```js
function extractObjectPayload(text) {
  if (!text || !text.trim()) return { ok: false, reason: 'empty', raw: text || '' };
  const data = extractJson(text);
  if (data === null) return { ok: false, reason: 'no_json', raw: text };
  if (typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: 'schema_mismatch', raw: text, parsed: data };
  }
  return { ok: true, data };
}
```

### 4.2 Parser 호출 패턴
```js
export function parseDiscoveryExpandResponse(text) {
  const pre = extractObjectPayload(text);
  if (!pre.ok) return pre;
  const { data } = pre;
  // … 고유 로직만 유지
}
```

### 4.3 Dead code 제거
- `parseUpdateResponse` 의 `try/catch extractJson` 제거 — extractJson 은 catch 내부에서 null 리턴하며 throw 하지 않음
- JSDoc `reason: 'empty' | 'no_json' | 'invalid_json' | 'schema_mismatch'` → `invalid_json` 삭제

## 5. 단계

- [x] Step 1 — 브랜치 + PLAN 문서
- [x] Step 2 — `extractObjectPayload` 추가 + 5 parser 재작성
- [x] Step 3 — `bash scripts/verify-task.sh` 5/5 통과
- [ ] Step 4 — commit + push + PR

## 6. 검증

- [x] `responseParser.js` 줄 수 < 300 → 293줄 (warning 해소)
- [x] `responseParser.test.js` 전 케이스 통과 (에러 reason 문자열 불변 확인)
- [x] `bash scripts/verify-task.sh` 5/5 → 364 tests
- [x] consumer (`useConferences.js`, `useUpdateQueue.js`, `DiscoveryPanel.jsx`) 수정 없이 빌드 성공

## 7. 리스크·롤백

**리스크**:
- helper 이름 충돌 (`extractObjectPayload`) → 파일 내부 scope only, 문제 없음
- `normalizeUpdateData` 호출 위치 유지 필요 (parseUpdateResponse 본문 마지막) — 실수 시 link 백필 로직 사라짐
- `parseLastEditionResponse` 는 `normalizeUpdateData` 호출 **안 함** (JSDoc 명시) — 유지

**롤백**: 브랜치 폐기 또는 `git checkout main -- src/services/responseParser.js`

## 8. 후속

- G.4 PLAN-023 DiscoveryPanel 상태 분해 (14 useState → ~5)
- G.1 PLAN-020 useUpdateQueue (278줄, 현재 300 미만이라 후순위)

## 9. 작업 로그

- 2026-04-21: 착수. PLAN-021 merge 직후 곁가지 정리 이어감.
- 2026-04-21: Step 2~3 완료. `extractObjectPayload` helper 신설로 5개 parser 헤드 통일. `parseUpdateResponse` 의 unreachable `invalid_json` 분기 제거. responseParser.js 305 → 293줄, warning 해소. 364 tests 전 통과.
