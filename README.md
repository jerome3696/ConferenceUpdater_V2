# ConferenceFinder

열유체·건물공조 분야 국제 학회 DB 관리 웹앱.
Claude API 웹 검색으로 학회 정보(upcoming 회차)를 자동 업데이트·검증하는 React SPA.

- **배포 URL**: https://jerome3696.github.io/ConferenceUpdater_V2/
- **구조**: 서버 없이 GitHub Pages + localStorage + (선택) GitHub PAT 기반 자동 동기화.

---

## 핵심 기능

- 학회 21건 기본 DB (열전달, 열물성, 연소, 건물공조 등)
- 이중 헤더 테이블 (마스터 / Upcoming / Last / 참고) + 필터·정렬
- 종료일 지난 upcoming의 past 자동 전환
- **AI 업데이트**: Claude API + web_search로 upcoming 정보 자동 수집 → 수용/리젝
- **정합성 검증**: 학회 기본 정보(주기, 지역 등)의 사실 부합 여부 AI 확인
- 학회 추가/편집/삭제, JSON·xlsx 내보내기
- GitHub PAT 기반 `conferences.json` 자동 커밋 (디바운스 10초)

---

## 사용법

### 열람자 모드 (API 키 없이)

1. 배포 URL 접속
2. 테이블 조회, 필터링, 정렬, 내보내기 가능

### 관리자 모드

1. Header의 [API 키] 버튼 → Anthropic API 키 입력 (형식: `sk-ant-...`)
2. (선택) [GitHub 토큰] 버튼 → PAT 입력 → 편집 내용이 GitHub에 자동 커밋됨
3. 각 행의 [편집] / [업데이트] / [검증] 버튼 또는 툴바의 [전체 업데이트] / [전체 검증] 사용

> API 키와 PAT는 브라우저 localStorage에만 저장됩니다. 서버로 전송되지 않습니다.

### API 비용

- Claude API (사용량 기반) — `claude-sonnet-4-20250514` / `claude-haiku-4-5` 모델 사용
- 웹 검색 도구 사용량 포함. Tier 1 한도 주의 — 학회 22건 순차 실행 시 수 분 소요될 수 있음
- 중단 버튼으로 언제든 큐 정지 가능

---

## API 키 발급

### Anthropic API 키

1. https://console.anthropic.com/ 가입
2. Settings → API Keys → Create Key
3. `sk-ant-api03-...` 형태의 키를 복사해 앱에 입력

### GitHub Personal Access Token (선택)

편집 내용을 GitHub 저장소 `public/data/conferences.json`에 자동 커밋하고 싶을 때 사용.

1. https://github.com/settings/tokens → Generate new token (fine-grained 권장)
2. 저장소 접근 권한: `jerome3696/ConferenceUpdater_V2`
3. Contents: Read/Write
4. 생성된 `ghp_...` 토큰을 앱에 입력

---

## 로컬 개발

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # dist/ 생성
npm run preview   # 빌드 결과 로컬 확인
```

### 프롬프트 평가

```bash
npm run eval              # 골든셋 17건으로 프롬프트 평가
npm run eval:sync         # docs/eval/golden-set.csv → json
npm run eval:refresh      # 원본에서 CSV 재생성
```

---

## 기술 스택

- **프레임워크**: React 19 + Vite + Tailwind CSS 3
- **AI**: Claude API (Messages API + web_search 도구)
- **저장**: JSON (GitHub 저장소) + localStorage (세션)
- **배포**: GitHub Pages (자동 배포 via `.github/workflows/deploy.yml`)
- **Excel 내보내기**: xlsx

---

## 문서

| 파일 | 용도 |
|---|---|
| `docs/blueprint.md` | 프로그램 설계 (What) |
| `docs/dev-guide.md` | 개발 순서 (How) — MVP까지 |
| `docs/STRUCTURE.md` | 코드 구조 맵 (파일-역할 매핑) |
| `docs/DESIGN.md` | UI 디자인 결정 로그 |
| `docs/PROMPT_LOG.md` / `PROMPT_STRATEGY.md` | 프롬프트 실행 이력 / 개선 전략 |
| `docs/RATE_LIMIT_STRATEGY.md` | API rate limit 대응 로드맵 |
| `docs/CHANGELOG.md` | 변경 이력 (v1.0 MVP 이후) |
| `CLAUDE.md` | Claude Code 작업 지침 |

---

## 알려진 제약

- **비공식 도메인 선호**: 일부 학회(ICCFD 등)에서 공식 사이트 대신 easychair.org 같은 리스팅 사이트를 반환 — v2 프롬프트 과제 (`docs/PROMPT_STRATEGY.md §1`).
- **Tier 1 rate limit**: 한 호출당 평균 34k input token. 다수 호출 시 일시 대기 발생 가능. 대응은 `docs/RATE_LIMIT_STRATEGY.md` 참조.
