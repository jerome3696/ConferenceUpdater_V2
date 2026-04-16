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
