# 프롬프트 평가 가이드

이 폴더는 Claude API 프롬프트 품질을 **회귀 테스트**로 관리하기 위한 자리입니다.
정답지(golden set)를 고정해두고, 프롬프트를 바꿀 때마다 같은 케이스를 돌려 성공/실패 추이를 봅니다.

## 파일 구조

- **`golden-set.csv`** — **편집 대상**. 엑셀/메모장으로 값 채우면 됨.
- `golden-set.json` — **자동 생성물, 직접 편집 금지**. 평가 러너 실행 시 CSV에서 변환됨.
- `results/<timestamp>-<version>.json` — 평가 러너 실행 결과 로그 (자동 생성).
- `../PROMPT_LOG.md` — 프롬프트 버전별 서사 기록 (왜 바꿨나, 무엇이 실패했나).

## CSV 편집 규칙

- 헤더: `id,link,source_url,verified_at,notes` (순서 고정)
- `link`와 `source_url` 둘 다 비어 있으면 자동 스킵
- `#`로 시작하는 행은 주석
- 5~7건만 채우면 충분

## 채점 로직 (URL 기반)

- AI가 반환한 `link` 를 정규화 후 정답지의 `link` 또는 `source_url` 과 비교
- 정규화: 소문자화, `https?://`, `www.`, trailing slash, hash 제거
- 상위·하위 경로 관계면 매칭 인정 (예: `astfe.org` vs `astfe.org/conferences`)
- pass = URL 매칭, fail = 매칭 실패 / 파싱 실패 / API 오류

날짜·장소는 정답지에 저장하지 않음. AI가 올바른 출처를 찾아내면 그 안의 값은 참이라고 전제.

## 관리 명령

```bash
npm run eval:refresh   # conferences.json 기준으로 CSV 재생성 (link 보존, stale 감지)
npm run eval:sync      # CSV → JSON 변환만 (API 호출 없음, 검증용)
npm run eval           # API 평가 실행 (eval:sync 자동 선행)
```

### refresh 상세

- 새 학회 id 추가, 삭제된 id 제거
- `link` 값은 보존 (회차 전용 URL은 안 바뀜)
- stale 감지 시 `source_url` 비우고 notes에 `[재확인 필요]` 추가:
  - `verified_at` 이후 6개월 경과
  - 또는 `conferences.json`에서 해당 학회의 upcoming이 전부 past로 넘어감

## 정답지 작성 규칙

1. **5~7건**이면 충분. 다양성 확보가 수량보다 중요:
   - 공식사이트 활발 vs 비활발
   - 주기 격년/격4년/매년
   - 개최 지역 분산 (유럽/미주/아시아)
   - 약칭 있음/없음
2. **공식사이트에서 직접 확인**한 값만 기록. AI 결과 복사 금지.
3. `snapshot_date`는 정답지 작성일. 이후 프롬프트 개선에서 같은 정답지를 계속 재사용.
4. 확인 불가 필드는 `null` (예: 아직 공지 안 된 venue).
5. 케이스 추가/수정 시 `source_url`에 근거 공식사이트 링크 기록 → 재검증 가능.

## 실행 방법

```bash
# 환경변수 설정 (PowerShell)
$env:ANTHROPIC_API_KEY="sk-ant-..."

# 전체 케이스 실행 (CSV → JSON 자동 동기화 후 API 호출)
npm run eval
# 또는 직접: node scripts/eval-prompt.js

# 특정 케이스만
node scripts/eval-prompt.js --case conf_007

# CSV만 JSON으로 변환 (API 호출 없음, 작성 검증용)
npm run eval:sync
```

결과는 콘솔에 요약 표로 출력되고, `results/` 폴더에 JSON으로 저장됩니다.

## 합격 기준 (MVP)

- **pass**: 4개 필드(start_date, end_date, venue, link) 전부 일치
- **partial**: 1~3개 일치 — 어느 필드가 약한지가 중요한 신호
- **fail**: 0개 일치 또는 파싱 실패

정답지 5~7건에서 **5건 이상 pass**면 MVP 합격선으로 봄. partial이 많다면 해당 필드에 맞춘 프롬프트 조정.

## 정답지 갱신 규칙

- 개최가 끝나 `status: past`로 넘어간 edition은 정답지에서 빼고 다른 학회로 교체.
- 또는 `snapshot_date`를 갱신하고 "이 시점 기준 다음 개최는 ..." 으로 전체 정답지를 새로 씀.
- 2개월 이상 정답지 갱신이 없으면 우선 의심.

## 실패 원인 분류 (스크립트 자동)

- `api_error` — CORS/인증/네트워크/rate limit
- `parse_fail: no_json` — 응답에 JSON 블록이 없음 → 시스템 프롬프트에 "반드시 JSON" 명시 강화
- `parse_fail: invalid_json` — JSON 문법 오류 → 응답이 잘려있거나 주석 포함. max_tokens 증가 또는 템플릿 단순화
- `parse_fail: schema_mismatch` — 필드명/구조 다름 → 예시 JSON을 프롬프트에 더 명확히
- `partial/fail (값 불일치)` — 실제 검색 품질 문제 → source filtering 강화, 공식사이트 힌트 강조
