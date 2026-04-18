# PLAN-010: 캘린더 scope UX 3-option + ICS 외부 내보내기

> **상태**: active
> **생성일**: 2026-04-18
> **완료일**: —
> **브랜치**: `feature/PLAN-009-calendar-view` (PLAN-009 이어서 진행 — 단독 브랜치 분리하지 않음)
> **연관 PR**: TBD
> **트랙**: C (제품화 확장, C.1.5)

---

## 1. 목표 (What)

PLAN-009 후속 UX 개선 + 외부 캘린더 내보내기 기능 추가.

1. **Scope 선택 UX**: 체크박스 1개(`starred + 필터 동기화`)에서 **3단 세그먼트 토글**(`전체 / 즐겨찾기 / 테이블필터`)로 교체. 사용자가 "전체도 보고싶다"는 니즈를 평평한 3옵션으로 충족.
2. **ICS 외부 내보내기**: 캘린더 뷰 우상단 "캘린더로 내보내기 (.ics)" 버튼. RFC 5545 포맷으로 현재 범위의 학회 일정을 `.ics` 파일로 다운로드 → 사용자가 구글/애플/아웃룩에 import.

## 2. 배경·동기 (Why)

- PLAN-009 배포 후 실사용 피드백:
  - scope 2옵션 체제는 "전체"를 볼 수 없음 — 체크박스 on/off로 표현되는 이진 상태가 실제론 3개 모드여야 자연스러움.
  - "구글 캘린더로 내보내기" 니즈가 명확히 제기됨.
- 상업화 방향 탐색에서 **구독 URL(2번) 방식을 핵심 전략**으로 확정 (blueprint §3.4). 그 전단계로 **정적 호스팅에서도 가능한 ICS 다운로드(1번)**를 먼저 도입. ICS 생성 로직을 **플랫폼 독립 순수 함수**로 분리해, 나중에 Cloudflare Worker에서 `/u/{token}/calendar.ics` 엔드포인트로 그대로 재사용.

## 3. 범위 (Scope)

### 포함
- `src/components/common/Header.jsx` — 체크박스 제거, `ScopeToggle` 3단 세그먼트 컴포넌트 신규
- `src/App.jsx` — `calendarScope` 주석 타입 확장 (`'all' | 'starred' | 'filter'`)
- `src/components/Calendar/CalendarView.jsx` — `sourceRows`에 `'all'` 분기, "캘린더로 내보내기 (.ics)" 버튼
- `src/utils/icsExport.js` (신규) — `buildIcs(rows, opts)` / `toIcsFilename(scope)` / `downloadIcs(ics, filename)`
- 테스트: `src/utils/icsExport.test.js` (10건), `CalendarView.test.jsx` (+2건)
- 문서: `blueprint.md` §3.4·§7.2, `design.md`, `dev-guide-v2.md` C.1.5, `changelog.md`, `CLAUDE.md` 현재 상태

### 제외 (Non-goals)
- ICS 구독 URL 서버 엔드포인트 — 서버 도입(Option 2/4) 이후 Step C.2.5로 예약
- Google Calendar API OAuth 통합 — pre-filled URL 방식은 추후 단건 "이 학회 추가" UX에서 고려 (현재는 범위 밖)
- 알림/리마인더 — 학회 성격상 불필요

## 4. 설계 결정

- **3옵션 배치**: 기본값은 `'starred'` 유지 (초기 기본 UX와 연속성). Header 우측 `ViewToggle` 옆에 `ScopeToggle` 배치, 캘린더 모드일 때만 노출.
- **ICS 순수 함수 분리**: `buildIcs`는 문자열 입출력 — 브라우저/Node/Worker 모두에서 동일 동작. DOM 의존 동작은 `downloadIcs`에만 격리.
- **UID 전략**: `${row.id}@conferencefinder` — 글로벌 유니크 + 재다운로드 시 구글이 기존 이벤트를 업데이트(덮어쓰기)하도록. 사용자가 이미 지운 이벤트가 재import에서 부활할 수 있다는 ICS의 근본 한계는 UX 경고문(버튼 title)으로만 환기.
- **All-day DTEND 배타적**: RFC 5545 규약 — 마지막 날 + 1일을 `DTEND;VALUE=DATE`로 기재해야 모든 클라이언트에서 기간이 정확히 표시됨.
- **텍스트 이스케이프**: `\ ; ,` + 개행 모두 RFC §3.3.11 규약대로. 75옥텟 folding도 적용(라인 길이 초과는 Outlook 등에서 드물게 파싱 실패).

## 5. 단계

- [x] Step 1 — Header `ScopeToggle` 컴포넌트, 체크박스 제거
- [x] Step 2 — App.jsx 주석 타입 확장, CalendarView `sourceRows` `'all'` 분기
- [x] Step 3 — `src/utils/icsExport.js` (`buildIcs`·`toIcsFilename`·`downloadIcs`) 신규
- [x] Step 4 — CalendarView 다운로드 버튼 + `handleExportIcs`
- [x] Step 5 — `icsExport.test.js` 10건, `CalendarView.test.jsx` +2건
- [ ] Step 6 — `verify-task.sh` 5/0
- [ ] Step 7 — 브라우저 수동 확인 (scope 3 모드 전환, 다운로드 → 구글 캘린더 import)
- [x] Step 8 — 문서 반영 (blueprint·design·guide·changelog·CLAUDE.md 현재 상태)

## 6. 검증

- `npm run test` — icsExport 10건 / CalendarView 6건 전부 통과
- `npm run dev` — 브라우저에서:
  - 캘린더 모드 진입 시 3옵션 세그먼트 토글 표시, 전환에 따라 `{건수}` 즉시 변경
  - `.ics` 버튼 클릭 → 파일 다운로드 → 메모장/텍스트 에디터에서 `BEGIN:VCALENDAR` / `BEGIN:VEVENT` 확인
  - 다운받은 `.ics`를 구글 캘린더 "가져오기"에 업로드 → 이벤트가 개인 캘린더에 생성되는지
- `bash scripts/verify-task.sh` — 5/0

## 7. 리스크

- **저**: ICS 파싱 호환성 — Apple Calendar / Outlook / Google 전부 RFC 5545를 공식 지원. folding·이스케이프 누락 시만 문제인데 테스트에서 검증됨.
- **저**: 한국어 파일명 — `toIcsFilename`에서 한글을 유지. 일부 OS에서 다운로드명 인코딩 이슈 가능성은 있으나 파일 내부 내용엔 영향 없음.
- **중**: "재import 시 삭제된 이벤트 부활" UX 한계 — 구독 URL(향후) 도입 시 해소. 현재는 title 툴팁 + docs로 공지.
