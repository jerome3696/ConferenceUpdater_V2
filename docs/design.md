# DESIGN

디자인 결정과 변경 이력. 로그 중심.
패턴이 쌓이면 §3 청사진으로 추출.

---

## 1. 목적 / 범위

- UI 디자인 관련 결정을 시간순으로 기록.
- 청사진(원하는 방향)은 초기엔 공란. 반복 패턴이 관찰되면 §3에 추출.
- 코드 수정 디테일은 CHANGELOG.md(MVP 후 생성)에 기록. 이 문서는 "결정과 이유"에 집중.

---

## 2. 변경 로그

### 2026-04-16 — 초기 baseline 기록

Step 4.2 착수 시점의 현재 상태 스냅샷.

**색상 역할**

| 역할 | 색 | 예시 |
|---|---|---|
| 주요 액션 | `blue-600` / hover `blue-700` | 학회 추가, 전체 업데이트, 저장, API 키 저장 |
| 수용 | `emerald-600` / hover `emerald-700` | UpdateCard / VerificationCard 수용 버튼 |
| 진행 상태 | `blue-500` | 프로그레스 바 |
| 상태 인디케이터 | `green-500` / `slate-400` | Header 연결 상태 |
| 예외 (정리 대상) | `indigo-600` | MainTable "전체 검증" 버튼 — 유일 예외 |

**버튼 공통 스타일**
- 기본: `px-3 py-1.5 text-sm text-white rounded`
- 수용 버튼: `px-4 py-1.5` (약간 큼)

**모달 크기 계층**

| 크기 | 용도 | max-w |
|---|---|---|
| sm | 간단 입력 (API 키) | `max-w-md` |
| md | 중간 (GitHub 토큰) | `max-w-lg` |
| lg | 폼 (학회 추가/편집) | `max-w-2xl` |

**공통 모달 스타일**
- 컨테이너: `bg-white rounded-lg shadow-xl w-full max-w-* p-6`
- 오버레이: `fixed inset-0 bg-black/40 flex items-center justify-center z-50`

**카드 스타일**
- UpdateCard, VerificationCard: `bg-white border border-slate-300 rounded-lg shadow-sm`
- 모달 = `shadow-xl`, 카드 = `shadow-sm` — 의도적 역할 분리

**확인 대화상자**
- 별도 `ConfirmDialog` 컴포넌트 없음. 네이티브 `window.confirm()` 사용.
- 사용처: 삭제(`App.jsx`, `ConferenceFormModal.jsx`), 큐 중단(`UpdatePanel.jsx`), API 키 형식 경고·삭제(`ApiKeyModal.jsx`).
- 사유: MVP 단순화. 네이티브의 검증된 접근성·키보드 지원 우선. 커스텀 디자인 일관성은 후순위.
- 여지: 디자인 통일 필요성이 커지면 컴포넌트화 (MVP 후 과제).

### 2026-04-18 — PLAN-010 캘린더 scope UX 3-option + ICS 내보내기

- **scope 선택 방식**: Header 체크박스 ("테이블 필터와 동기화") → **3단 세그먼트 토글 (전체 / 즐겨찾기 / 테이블필터)**
  - 왜: 초기 2옵션(starred 기본 + 필터 동기화 체크박스)은 "전체"를 볼 길이 없었음. 사용자가 "그냥 전부 깔아서 보고싶을 때도 있다"는 자연스러운 니즈 → scope를 평평한 3옵션으로 펼침.
  - 영향: `src/components/common/Header.jsx` `ScopeToggle`, `src/App.jsx:33` 주석 (`'all' | 'starred' | 'filter'`), `src/components/Calendar/CalendarView.jsx` sourceRows

- **"캘린더로 내보내기 (.ics)" 버튼**: 캘린더 뷰 우상단, scope+subView 토글 옆 배치
  - 왜: 구글·애플·아웃룩 어느 플랫폼 사용자든 자신의 개인 캘린더에 학회 일정을 병합해서 보고싶음. OAuth 통합 없이도 **ICS 가져오기**가 모든 플랫폼에서 네이티브 지원됨. 현재 정적 호스팅 아키텍처와 정합(서버 불요).
  - 스타일: outline 톤 (`border-slate-300`), disabled 시 opacity-50 — 주요 액션(`blue-600`) 대비 낮은 강도. "주요 동작"이 아니라 "편의 기능"임을 시각적으로 표현.
  - 영향: `src/components/Calendar/CalendarView.jsx`, `src/utils/icsExport.js` (신규)

- **ICS 생성 순수함수 분리**: 브라우저 다운로드 로직(`downloadIcs`)은 얇은 DOM wrapper, 핵심 생성(`buildIcs`)은 입출력 모두 문자열
  - 왜: 상업화 방향(blueprint §3.4 외부 캘린더 통합 전략)에서 **서버측 구독 URL 엔드포인트가 핵심**이 될 것. 그때 Cloudflare Worker에서 같은 `buildIcs(rows, opts)`를 import해 `GET /u/{token}/calendar.ics` 응답으로 그대로 재사용 가능하도록 지금부터 분리.
  - 영향: `src/utils/icsExport.js` — `buildIcs` / `toIcsFilename` / `downloadIcs` 분리

### 2026-04-18 — PLAN-009 캘린더 뷰 UI 결정

- **뷰 전환 방식**: 별도 페이지(라우터) 대신 **Header 우측 세그먼트 토글** ("테이블 / 캘린더")
  - 왜: 라우터 미도입 상태 유지. Option 2/4 서버화 단계에서 일괄 도입이 정합. 지금 라우터만 넣는 건 비용 대비 얻는 게 없음
  - 영향: `src/components/common/Header.jsx` `ViewToggle`, `src/App.jsx`

- **캘린더 표시 대상**: 기본 `starred`, 옵션으로 "테이블 필터와 동기화" 체크박스
  - 왜: 전부 표시는 정보 과잉. 한편 `starred` 는 지금까지 데이터에만 있고 쓸 자리가 없었음 — 캘린더가 "★ 의미 부여" 역할을 겸함. 필터 동기화는 탐색 목적 사용자에게 열어둠
  - 영향: `CalendarView.jsx` scope prop, Header 체크박스

- **뷰 단위 — 연간 + 월간 듀얼**: 학회 도메인 특성상 연 단위 조망이 월간 달력보다 정보 밀도 높음. 동시에 임박 월 상세도 필요 → 내부 서브 토글로 둘 다 제공
  - 왜: 월간만 두면 여러 달 학회 패턴을 놓침. 연간만 두면 "이번 달 뭐 있지?" 체감 약함
  - 영향: `CalendarView.jsx` subView toggle, `YearTimeline.jsx` / `MonthGrid.jsx`

- **캘린더 색상**: 막대·칩은 `blue-500/100/700` 계열 통일. 강조 색상 역할을 §2 baseline "주요 액션" 색과 정합
- **월간 셀 "+N"**: 3개 초과 시 축약. 학회 이름은 `abbreviation` 우선, 없으면 `full_name`. 제목 속성에 전체 이름 + 장소 툴팁

### 2026-04-16 — Step 4.2 결정

- **전체 검증 버튼 `indigo-600` → `blue-600` 통일**
  - 왜: 주요 액션 색상 단일화. indigo는 baseline에서 유일하게 튀는 예외였음.
  - 영향: `MainTable.jsx:166`

- **ConferenceFormModal에 `mx-4` 추가**
  - 왜: 좁은 화면(뷰포트 < `max-w-2xl`)에서 모달이 edge-to-edge로 붙는 문제. PC 중심 프로젝트지만 기본 반응형 대응.
  - 영향: `ConferenceFormModal.jsx:219`

- **MainTable 컨테이너에 `max-h-[calc(100vh-220px)]` 추가**
  - 왜: 가로 스크롤바가 테이블 바닥에 달려 있어, 창을 좁혀 가로 스크롤이 필요할 때 세로 스크롤을 내려야만 사용할 수 있었음. 테이블을 뷰포트 안에 가두면 가로 스크롤바가 항상 보임 (Excel-like 관례).
  - 영향: `MainTable.jsx:198`
  - **magic number 주의**: `220px`는 Header(~60px) + 툴바(~45px) + FilterBar(~55px) + padding·margin(~60px)의 근사치. 상단 영역 높이가 바뀌면 이 값 조정 필요. MVP 후 Flex 레이아웃으로 리팩토링하여 마법의 숫자 제거 예정.

---

## 3. 청사진 (추후 확장)

패턴이 안정화되고 "원하는 방향"을 명시할 필요가 생기면 이 섹션으로 이동.

예시 (가안 — 미결정):
- 박스 줄바꿈 정책 (예: "박람회"처럼 한 단어는 쪼개지 않음 — `break-keep` 적용)
- 반응형 breakpoint 정책 (PC 중심, 어디까지 대응할지)
- 키보드 포커스 규약

현재는 공란.
