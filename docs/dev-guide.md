# 학회 DB 관리 웹앱 — 개발 가이드 (Dev Guide)

> **문서 버전**: v1.1  
> **최종 수정일**: 2026-04-14  
> **목적**: 이 문서는 "어떻게, 어떤 순서로 만드는가(How & When)"를 정의합니다. MVP 완성까지의 가이드이며, MVP 이후에는 QA 기반 운영 체제로 전환합니다.

---

## 1. 조율된 결정사항

> 이 섹션은 기획 논의에서 합의된 핵심 결정들입니다. 새 대화에서 Claude가 같은 질문을 반복하지 않도록 명시합니다.

### 1.1 아키텍처 결정

| 결정 사항 | 결론 | 이유 |
|-----------|------|------|
| 플랫폼 | 서버 없는 정적 웹앱 (SPA) | 초보 개발자 접근성, 무료 호스팅 가능 |
| 프레임워크 | React (JSX) | Claude 아티팩트에서 바로 프리뷰 가능, 생태계 풍부 |
| 유료 서비스 | Claude API만 사용 | 비용 최소화 제약 |
| API 키 관리 | 사용자가 브라우저에서 직접 입력 | 서버 없으므로 클라이언트 사이드 저장 |
| 데이터 저장 | GitHub 저장소 내 JSON + 브라우저 localStorage | 서버 DB 없이 읽기/쓰기 분리 |
| 배포 | GitHub Pages (추천) 또는 Vercel | 무료, Git 통합 |

### 1.2 기능 범위 결정

| 결정 사항 | 결론 | 이유 |
|-----------|------|------|
| 수동 입력 시 AI 자동완성 | 하지 않음 (100% 수동) | 단순성, 사용자 의도 존중 |
| last conference 검색 | AI로 검색하지 않음 | API 비용 절약 — upcoming에서 밀어넣거나 수동 입력 |
| 날짜 지난 upcoming 처리 | 프론트엔드 로직으로 자동 전환 | AI 호출 불필요 (비용 0) |
| 전체/개별 업데이트 | 둘 다 구현 | 사용자 요구사항 |
| 업데이트 결과 처리 | 자동 반영 아님 — 수용/리젝 선택 | 사용자가 AI 결과를 검토 후 판단 |
| 업데이트 이력 저장 | MVP에서는 세션 내에서만 유지 | 영구 저장은 미래 확장 |
| source 필드 | "ai_search" / "user_input" 구분 | 전체 업데이트 시 pass 판단에 활용 |
| 신규 학회 발굴 | MVP에서 미구현 | 복잡도 높음, 미래 확장으로 보류 |
| API 절약 필터 (주기 기반) | MVP에서 미구현 | 기본 동작 검증 후 추가 예정 |
| 관심여부 | "중요도 마킹" (별 0~3)으로 변경 | 향후 개인화 DB에서 의미 확대 |
| 초기 데이터 | 마스터 정보만 탑재, upcoming/past 없이 시작 | 수동 입력 또는 AI 업데이트로 채움 |

### 1.3 UX 결정

| 결정 사항 | 결론 | 이유 |
|-----------|------|------|
| 메인 뷰 형태 | 단일 테이블 뷰 (엑셀 느낌) | 사용자 친숙도, 정보 밀도 |
| 페이지 구성 | 2페이지 (메인 테이블 + 업데이트 현황) | 역할 분리 |
| 분류/분야 체계 | 수동 추가 가능 (고정 목록 아님) | 확장성 |
| 중단 버튼 | 전체 업데이트 시 필수 | API 비용 제어, 사용자 자율성 |

---

## 2. 기술 스택

### 2.1 확정 스택

| 구분 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | React 18+ | 함수형 컴포넌트, Hooks |
| 스타일링 | Tailwind CSS | 유틸리티 클래스 기반 |
| 빌드 도구 | Vite | 빠른 개발 서버, 간단한 설정 |
| 데이터 저장 | JSON 파일 + localStorage | 서버 없는 구조 |
| AI API | Claude API (claude-sonnet-4-20250514) | 웹 검색 도구 포함 |
| 배포 | GitHub Pages | 무료 정적 호스팅 |
| 버전 관리 | Git + GitHub | 코드 및 데이터 관리 |

### 2.2 사용하지 않는 것

- 백엔드 서버 (Express, Django 등 — Node.js는 빌드 도구로만 사용)
- 데이터베이스 서비스 (Firebase, Supabase 등)
- Claude API 외 유료 서비스
- 모바일 앱 프레임워크

---

## 3. 프로젝트 구조

```
ConferenceFinder/
├── CLAUDE.md                      ← Claude Code 프로젝트 지침
├── docs/
│   ├── blueprint.md               ← 프로그램 설계 (What)
│   ├── dev-guide.md               ← 개발 순서 (How) — 이 파일
│   ├── CHANGELOG.md               ← 변경 이력 (MVP 완성 후 생성)
│   ├── PROMPT_LOG.md              ← 프롬프트 최적화 이력 (Phase 3부터 생성)
│   └── STRUCTURE.md               ← 사용자를 위한 코드 구조 맵 (Phase 1 완료 후 생성)
├── public/
│   └── data/
│       └── conferences.json       ← 학회 기본 데이터 (배포용)
├── src/
│   ├── components/
│   │   ├── MainTable/             ← 페이지 1: 메인 테이블
│   │   │   ├── MainTable.jsx
│   │   │   ├── TableRow.jsx
│   │   │   ├── FilterBar.jsx
│   │   │   ├── EditModal.jsx
│   │   │   └── AddConferenceModal.jsx
│   │   ├── UpdatePanel/           ← 페이지 2: 업데이트 현황
│   │   │   ├── UpdatePanel.jsx
│   │   │   ├── ProgressBar.jsx
│   │   │   ├── UpdateCard.jsx
│   │   │   └── VerificationCard.jsx
│   │   ├── common/                ← 공통 컴포넌트
│   │   │   ├── ApiKeyModal.jsx
│   │   │   ├── StarRating.jsx
│   │   │   ├── Header.jsx
│   │   │   └── ConfirmDialog.jsx
│   ├── services/
│   │   ├── claudeApi.js           ← Claude API 호출 로직
│   │   ├── dataManager.js         ← JSON 로드/저장/내보내기
│   │   └── updateLogic.js         ← pass/검색 판단, 날짜 비교 로직
│   ├── hooks/
│   │   ├── useConferences.js      ← 학회 데이터 상태 관리
│   │   └── useApiKey.js           ← API 키 관리
│   ├── utils/
│   │   ├── dateUtils.js           ← 날짜 비교, 포맷 유틸
│   │   └── promptBuilder.js       ← AI 프롬프트 생성
│   ├── App.jsx
│   └── main.jsx
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

---

## 4. 개발 순서 (Step-by-Step)

> **핵심 원칙**: 각 단계가 끝나면 동작하는 상태여야 합니다. 한 단계에서 다 만들고 다음으로.
>
> **진행 추적**: 각 Step의 체크박스를 완료 시 `[x]`로 표시합니다. 중단 후 재개 시 이 문서를 참조하여 미완료 Step부터 진행하세요.

---

### Phase 1: 기반 구축 (데이터 + 읽기 전용 테이블)

**목표**: 학회 데이터를 테이블로 보여주는 것. 배포하면 누구나 볼 수 있는 상태.

#### Step 1.1: 프로젝트 초기화
- [x] 이 폴더(ConferenceFinder) 안에 Vite + React + Tailwind 프로젝트 생성
- [x] 기본 폴더 구조 생성 (src/components, src/services, src/hooks, src/utils)
- [x] Git 초기화 및 GitHub 저장소 연결
- **확인**: `npm run dev` 실행 → 브라우저에서 Vite 기본 페이지가 뜨는가?

#### Step 1.2: 초기 데이터 파일 생성
- [x] blueprint.md 부록 B의 학회 21건을 conferences.json으로 변환 (학회목록_sample.xlsx 기준)
- [x] 마스터 정보 + 사용자 제공 upcoming editions 18건 포함
- [x] public/data/에 배치
- **확인**: `public/data/conferences.json`을 열어서 21건이 모두 들어있는가?

#### Step 1.3: 데이터 로드 및 테이블 표시
- [x] conferences.json을 fetch로 로드
- [x] 메인 테이블 컴포넌트 구현 (읽기 전용, 이중 헤더: 마스터/Upcoming/Last/참고)
- [x] 컬럼 정렬 기능 구현
- [x] upcoming 시작일 기준 기본 정렬 (upcoming이 없는 학회는 하단)
- **확인**: `npm run dev` → 브라우저에서 21개 학회가 테이블로 보이는가? 컬럼 클릭 시 정렬되는가?

#### Step 1.4: 필터 기능
- [x] 분류, 분야, 지역 드롭다운 필터
- [x] 텍스트 검색 (학회명, 약칭)
- **확인**: 필터 드롭다운에서 "열전달" 선택 → 해당 분야 학회만 표시되는가? "IHTC" 검색 → 해당 학회만 나오는가?

#### Step 1.5: 날짜 자동 전환
- [x] 페이지 로드 시 종료일이 지난 upcoming을 past로 전환하는 로직
- [x] 시각적 표시 (경고 아이콘 등)
- **확인**: 테스트로 과거 날짜의 upcoming을 수동으로 JSON에 넣고 → 페이지 로드 시 past로 자동 전환되는가?

#### Step 1.6: 배포
- [x] GitHub Pages 배포 설정 (vite.config.js에 base 경로 설정 포함)
- [ ] 접속 확인 (읽기 전용 동작 검증)
- [x] docs/STRUCTURE.md 최초 작성 (Claude Code에게 요청)
- **확인**: `https://[username].github.io/ConferenceFinder/` 접속 → 테이블이 보이고 필터/정렬 동작하는가?

> ✅ Phase 1 완료 시점: URL로 접속하면 학회 테이블이 보이고, 필터/정렬이 동작함.

---

### Phase 2: 관리 기능 (편집 + 데이터 관리)

**목표**: 관리자가 학회 데이터를 수동으로 편집하고 내보내기/가져오기 할 수 있는 상태.

#### Step 2.1: API 키 관리
- [ ] API 키 입력 모달 구현
- [ ] localStorage에 저장
- [ ] API 키 유무로 관리자/열람자 모드 분기
- **확인**: API 키 입력 → 새로고침 후에도 키가 유지되는가? 키 없이 접속 시 편집 버튼이 숨겨지는가?

#### Step 2.2: 학회 추가
- [ ] 추가 모달 또는 폼 구현
- [ ] 모든 필드 수동 입력
- [ ] 저장 시 localStorage에 반영
- **확인**: 새 학회 추가 → 테이블에 나타나는가? 새로고침 후에도 유지되는가?

#### Step 2.3: 학회 편집
- [ ] 인라인 편집 또는 편집 모달
- [ ] 중요도(별) 마킹 — 클릭으로 토글
- [ ] 메모 편집
- **확인**: 학회명 수정 → 저장 → 테이블에 반영되는가? 별 클릭 → 즉시 반영되는가?

#### Step 2.4: 학회 삭제
- [ ] 확인 대화상자 후 삭제
- [ ] localStorage 반영
- **확인**: 삭제 버튼 → 확인 대화상자 → 삭제 → 테이블에서 사라지는가?

#### Step 2.5: 데이터 내보내기/가져오기
- [ ] JSON 다운로드 (내보내기)
- [ ] JSON 업로드 (가져오기) — 확인 대화상자 필수
- [ ] 가져오기 시 기존 데이터 교체
- **확인**: 데이터 수정 → 내보내기 → 브라우저 데이터 초기화 → 내보낸 JSON 가져오기 → 수정 사항이 복원되는가?

> ✅ Phase 2 완료 시점: 관리자가 학회를 추가/편집/삭제하고, JSON으로 백업/복원 가능.

---

### Phase 3: AI 업데이트 (핵심 기능)

**목표**: AI를 통한 학회 정보 업데이트가 동작하는 상태.

#### Step 3.1: CORS 확인 및 API 연동 기본
- [ ] 브라우저에서 Claude API 직접 호출 테스트 (CORS 가능 여부 확인)
- [ ] CORS 불가 시: Cloudflare Workers 또는 Vercel Serverless Function으로 프록시 구현
- [ ] claudeApi.js 구현: API 호출, 응답 파싱
- [ ] 웹 검색 도구(web_search) 활성화
- [ ] 에러 핸들링 (키 오류, 네트워크 에러, 응답 파싱 실패)
- **확인**: 개발자 도구 콘솔에서 API 호출이 성공하는가? 에러 시 사용자에게 명확한 메시지가 나오는가?

#### Step 3.2: 프롬프트 빌더
- [ ] 업데이트용 프롬프트 생성 함수 (promptBuilder.js)
- [ ] 학회 정보를 프롬프트에 삽입
- [ ] JSON 응답 파싱 로직 (try-catch 필수)
- [ ] 하드코딩된 학회 1건으로 API 호출 테스트
- [ ] docs/PROMPT_LOG.md 최초 작성 (첫 번째 프롬프트 버전 기록)
- **확인**: 테스트 학회(예: IHTC)로 호출 → JSON 응답이 정상 파싱되는가?

#### Step 3.3: 개별 업데이트 구현
- [ ] 각 학회 행의 "업데이트" 버튼
- [ ] 클릭 → 페이지 2(업데이트 현황)로 이동
- [ ] AI 호출 → 결과 표시 → 수용/리젝
- [ ] 수용 시 데이터 반영 (localStorage)
- **확인**: IHTC "업데이트" 클릭 → 페이지 2에서 검색 결과가 표시되는가? 수용 → 메인 테이블에 반영되는가?

#### Step 3.4: 전체 업데이트 구현
- [ ] pass/검색 판단 로직 (updateLogic.js)
- [ ] 대상 학회 목록 생성 및 표시
- [ ] 순차 실행 + 진행률 표시
- [ ] 중단 버튼
- [ ] 각 결과별 수용/리젝
- **확인**: 전체 업데이트 → 진행률이 올라가는가? 중단 버튼이 동작하는가? 각 결과를 수용/리젝할 수 있는가?

#### Step 3.5: 정합성 검증 구현
- [ ] 검증용 프롬프트 생성 함수
- [ ] 개별/전체 검증 버튼
- [ ] 검증 결과 표시 (일치/불일치/확인불가)
- [ ] 수정 제안 수용/리젝
- **확인**: IHTC "검증" 클릭 → 주기(4년), 지역(세계) 등이 일치/불일치로 표시되는가?

#### Step 3.6: 실전 검증 (AI 업데이트 품질 확인)
- [ ] 공식사이트가 이미 열린 학회 3~5건을 선별 (예: IHTC, ECOS, IEEE-Itherm 등)
- [ ] 해당 학회들에 대해 개별 업데이트 실행
- [ ] AI가 찾아온 결과가 공식사이트 정보와 일치하는지 수동 대조
- [ ] 결과를 docs/PROMPT_LOG.md에 기록 (성공/실패/부분성공, 실패 원인)
- [ ] 필요시 프롬프트 수정 → 재테스트 → 기록 (반복)
- [ ] 전체 업데이트도 1회 실행하여 전체 흐름 확인
- **확인**: 3건 이상의 학회에서 정확한 upcoming 정보를 가져오는가? 전체 업데이트가 끝까지 동작하는가?

> ✅ Phase 3 완료 시점: AI 업데이트와 정합성 검증이 동작하고, 실제 학회 데이터로 검증 완료.

---

### Phase 4: 마무리 및 배포

**목표**: 실전 검증 결과를 반영하고 최종 배포.

#### Step 4.1: 실전 검증 결과 반영
- [ ] Step 3.6에서 발견된 UI/UX 문제 수정
- [ ] 에러 메시지 사용자 친화적으로 개선
- [ ] 로딩 상태 표시 개선
- **확인**: Step 3.6에서 기록한 문제들이 모두 해결되었는가?

#### Step 4.2: UI 폴리싱
- [ ] 반응형 레이아웃 점검 (PC 중심이나 기본적인 대응)
- [ ] 전체적인 디자인 일관성 확인
- **확인**: 브라우저 창 크기를 줄여도 테이블이 깨지지 않는가?

#### Step 4.3: 최종 배포
- [ ] conferences.json 최종 확인 (실전 검증에서 수용한 데이터 반영)
- [ ] GitHub Pages 최종 배포
- [ ] README.md 작성 (사용법, API 키 안내)
- [ ] docs/CHANGELOG.md 최초 작성 (v1.0 기록)
- [ ] docs/STRUCTURE.md 최종 업데이트
- **확인**: 배포 URL에서 전체 기능(조회, 편집, 업데이트, 검증, 내보내기/가져오기)이 정상 동작하는가?

> ✅ Phase 4 완료 = MVP 완성. 이후 QA 기반 운영 체제로 전환.

---

## 5. 개발 시 주의사항

### 5.1 흔한 함정들

| 함정 | 대응 |
|------|------|
| "전부 한번에 만들어줘" | 절대 하지 마세요. Phase별, Step별로 나눠서. |
| API 키가 프론트엔드 코드에 하드코딩 | 절대 안 됨. 항상 사용자 입력 + localStorage |
| Claude API CORS 에러 | Step 3.1에서 먼저 확인. 안 되면 프록시 구축. |
| JSON 파싱 에러 | AI 응답이 항상 완벽한 JSON이 아닐 수 있음. try-catch 필수 |
| 대량 업데이트 시 비용 폭주 | 중단 버튼 필수, 진행 상황 표시로 사용자가 판단 가능하게 |
| 스캐폴딩 도구의 파괴적 플래그 | `--overwrite`, `--force` 등은 기존 파일을 삭제함. 절대 승인 없이 사용 금지. |

### 5.2 CORS 이슈 대응

브라우저에서 Claude API를 직접 호출하면 CORS 에러가 발생할 수 있습니다.

**해결 방법 (우선순위 순)**:
1. **Anthropic API가 CORS를 지원하는 경우**: 그대로 사용 (Step 3.1에서 확인)
2. **CORS 미지원 시**: 간단한 프록시를 Cloudflare Workers (무료) 또는 Vercel Serverless Function으로 구현
3. **최후의 방법**: 사용자가 브라우저 확장 프로그램으로 CORS 우회 (비추천)

---

## 6. Claude Code 사용법

> 이 프로젝트는 Claude Code (터미널 CLI)로 개발합니다. CLAUDE.md가 프로젝트 루트에 있으므로 Claude Code가 자동으로 읽습니다.

### 6.1 세션 시작

```bash
# 프로젝트 폴더에서 Claude Code 실행
cd ConferenceFinder
claude
```

Claude Code는 CLAUDE.md를 자동으로 읽으므로, 별도 문서 첨부가 필요 없습니다.

### 6.2 작업 요청 예시

```
Step 1.3 진행해줘.
```

```
dev-guide.md 읽고 미완료 Step부터 진행해줘.
```

```
Step 3.2에서 IHTC로 테스트했는데 JSON 파싱이 실패해. 에러: [에러 메시지 전체 붙여넣기]
```

### 6.3 세션 중단/재개

작업을 중단할 때:
1. Claude Code에게 "현재 Step 진행 상황을 dev-guide.md에 반영해줘" 요청
2. 체크박스가 업데이트된 것 확인 후 종료

다음에 재개할 때:
1. Claude Code 실행
2. "dev-guide.md 읽고 미완료 Step부터 진행해줘" 요청

---

## 7. MVP 이후 운영 체제

MVP 완성 후에는 이 dev-guide의 Step 구조가 더 이상 필요 없습니다. 대신:

1. **QA 사항 수집**: 직접 사용하면서 문제점/개선 사항을 모음
2. **일괄 수정 요청**: 모인 사항을 Claude Code에 전달
3. **기록 업데이트**: 수정 후 docs/CHANGELOG.md에 기록, 기능 변경 시 blueprint.md도 업데이트

---

## 8. 용어 정리

| 용어 | 의미 |
|------|------|
| MVP | Minimum Viable Product — 최소 핵심 기능만 갖춘 첫 번째 완성 버전 |
| SPA | Single Page Application — 페이지 새로고침 없이 동작하는 웹앱 |
| CORS | Cross-Origin Resource Sharing — 브라우저 보안 정책, 다른 도메인 API 호출 시 제한 |
| localStorage | 브라우저 내장 저장소, 해당 브라우저에서만 접근 가능 |
| 정적 호스팅 | 서버 로직 없이 HTML/JS/CSS 파일만 제공하는 호스팅 |
| pass | 전체 업데이트 시 조건을 만족하여 검색을 건너뛰는 것 |
| source | 데이터 출처 구분 — "ai_search" (AI가 찾음) / "user_input" (수동 입력) |
| 정합성 검증 | 학회 기본 정보가 사실과 부합하는지 AI가 확인하는 기능 |
