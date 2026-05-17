# 학회 DB 관리 웹앱 — 블루프린트 v3 (멀티테넌트 + 라이브러리)

> **체인 버전**: v3 — 현재 활성 blueprint. (v1 MVP·v2 post-MVP 는 완료 — `docs/roadmap.md` 체인 테이블 참조)
> **대응 dev-guide**: `docs/dev-guide.md` — 반드시 같은 v3 (blueprint=dev-guide 버전 일치 규칙)
> **최종 수정일**: 2026-05-17 (내용 2026-05-03 /grill-me 인터뷰, v3 체인 번호로 정합)
> **목적**: 멀티테넌트 + 라이브러리 모델 종합 spec ("무엇을 만드나").
> **문서 관계**: `roadmap.md`(비전·체인) → **이 문서 = 무엇** → `dev-guide.md`(어떻게) → `plans/PLAN-xxx`(실행). 현재 진행 상황은 `docs/status.md`.

---

## 0. 구현 상태 표기

각 항목에 다음 뱃지 중 하나:

- **[구현 완료]** — main 머지된 기능 (PLAN-001~029)
- **[Phase A.3]** — 30명 파일럿 진입 전 추가 필요
- **[Phase B]** — 100명 단계 추가
- **[Phase C]** — 결제 도입 단계
- **[보류]** — 우선순위 낮음 또는 상위 결정 대기

---

## 1. 핵심 모델 — 라이브러리 + 개인 fork + 공용 DB

세 계층으로 분리된다:

```
┌─ 공용 DB (conferences_upstream + editions_upstream) ──────────────┐
│  모든 사용자가 AI/Discovery 로 가져온 학회 raw 풀                       │
│  AI 갱신 / dedup / cache hit 의 단일 진실 공급원                       │
└──────────────────────────────────────────────────────────────────┘
              ↑ 쓰기: AI Edge Function (read-write), admin (read-write)
              ↑ 쓰기 안 됨: 사용자 수동 편집
              │
┌─ 라이브러리 (관리자 큐레이팅) ─────────────────────────────────────┐
│  공용 DB 의 부분집합을 의미있게 묶음                                  │
│  예: master / 공조 / 디지털트윈 / 신재생                            │
│  관리자 admin 만 생성·태깅                                          │
└──────────────────────────────────────────────────────────────────┘
              ↓ 사용자가 1+개 구독
              │
┌─ 개인 라이브러리 (user_conferences) ───────────────────────────────┐
│  사용자 가입 시 구독한 라이브러리들의 학회를 본인 소유로 fork           │
│  starred / personal_note / overrides / deleted_by_user 보유          │
│  + "내 학회" 가상 라이브러리 (Discovery·D3 수동입력 적재용)            │
└──────────────────────────────────────────────────────────────────┘
```

**핵심 약속**:
- **AI 결과**는 개인 + 공용 DB 양쪽 기록 (다른 사용자 cache hit 으로 비용 절감)
- **수동 편집**은 개인 메타데이터(별표·메모·태그)만 — 사실 필드 개인 override 금지 (§1.5.1). 공용 DB 는 AI·admin 만 변경
- **Discovery 결과**는 공용 DB INSERT + 본인 "내 학회" 라이브러리에 import
- **라이브러리 자체**는 admin 전용 자산. 사용자는 구독·import 만

---

## 1.5 라이브러리 동기화·생애주기 모델 (2026-05-17 grill-me 재설계)

> 이 절은 §2.1·§2.4 의 동기화 관련 서술을 **갱신·우선**한다. 대원칙: 비용 통제 + **"한번 구축된 라이브러리는 admin 관여 최소로 알아서 굴러간다."**

### 1.5.1 참조 모델 (복사 아님)

학회 데이터(날짜·장소·URL·상태)는 `conferences_upstream` 에 **학회당 전역 1행**. `user_conferences` 는 그 행을 참조하는 얇은 레이어 — `starred / personal_note / 개인태그 / deleted_by_user` 같은 **개인 메타데이터만** 보유.

- 사용자가 보는 학회 = 공용 행 + 개인 메타데이터.
- 중앙/AI 갱신 → 공용 행 1개 갱신 → 그 학회를 보는 전원에게 자동 반영. 별도 sync 없음.
- "구독 시 snapshot" = **멤버십 스냅샷**(어떤 학회가 내 라이브러리에 드는가)이지 데이터 스냅샷이 아님.
- **사실 필드 개인 override 금지.** 틀린 데이터는 공유 진실을 고친다(신고 §1.5.4). 개인 레이어는 메타데이터 전용.
- 근거: 사용자가 원하는 게 "최신화" / 비용 경제학(공용 캐시 30× 절감, roadmap §4)이 이 모델을 강제 / 복사 모델은 N×M 행 동기화 지옥.

### 1.5.2 전역 정체성 ID + 매칭

학회당 **라이브러리-무관 연번 ID 1개** (`conferences_upstream` PK). 라이브러리는 그 위에 붙는 태그(`library_conferences`). 1 학회 → N 라이브러리 동시 소속 가능. ID 는 매칭 개선 시 사후 재지정 가능(임시 ID → 정규 ID).

**매칭 분기** (§2.3 보강):
- **채택**: URL 완전일치 → 자동병합 / 이름만 fuzzy → 경로(AI·D3) 무관 항상 confirm 모달 / 후보없음 → 신규 ID.
- **기각 대안**: AI 발굴 경로는 fuzzy 도 자동병합 + 사후 "분리" 버튼.
- **기각 근거**: AI 자동병합은 오병합을 사용자가 모름 → 무결성 리스크 > 클릭 1회 절감.
- **재검토 트리거**: confirm 모달이 발굴 1회당 3개+ 로 잦으면 Phase B AI judge 도입 후 고신뢰 자동병합 재고.

### 1.5.3 라이브러리 생애주기

라이브러리는 **구축기 → 운영기** 생애주기를 가진다 (전역 Phase 아님 — 라이브러리마다 독립).

| 단계 | admin 관여 | 갱신 | 품질 게이트 |
|---|---|---|---|
| 구축기 | 집중 (1회성) | admin 수동 일괄 | admin 전건 검토 |
| 운영기 | ≈ 주 10분 | 자동 cron (Batch API 50%, TTL) | §1.5.4 |

- **전환 = admin 수동 플립 = 자동 cron 스위치 ON**, 라이브러리 단위, 1회성. 가역적(주간 큐 폭증 시 구축기 복귀).
- "minimize admin" 은 *지속적* 관여 최소화 — 1회성 셋업·전환은 허용.
- 기각 대안: 자동 전환(eval 점수·N회 갱신 기준) — 라이브러리별 eval 인프라 부담 + "믿을 만한가"는 사람 판단.

### 1.5.4 운영기 품질 게이트

운영기엔 admin 전건 리뷰가 없다. 대신 4중:

1. **신뢰도 게이팅** — AI 변경 중 *고신뢰* 만 자동 commit. *저신뢰* 는 commit 보류 + "확인 필요" 표시.
   - 신뢰도 = **출처 기반**: 공식 학회 사이트 출처 ∨ 독립 평판 출처 2개+ 일치, **그리고** 비파괴적 변경 = 고신뢰. 출처 빈약·불일치·파괴적/대규모 = 저신뢰.
   - 원료: `v1_2` source_url + `responseParser.js` `classifyUrlTrust`·`BANNED_LINK_DOMAINS`.
   - 기각 대안: AI 자기보고 확신도 — LLM 과신 경향으로 신뢰성 낮음.
2. **크라우드 패시브 리뷰** — 구독자가 자기 관심 학회를 쓰다가 오류 발견. admin 집중 리뷰 노동 → 구독자 분산 수동 주의.
3. **신고 → 자동 AI 재검** — 신고 시 그 학회만 AI 즉시 재검 → 재검이 신고에 동의하면 자동 수정. 모호하면 admin 큐.
4. **admin 주간 검토 큐** — 저신뢰 건 + 재검 실패 신고 건만. ~주 10분. admin = 예외 처리기.
   - 재검토 트리거: 주간 큐가 10분 초과로 커지면 신뢰도 임계 상향 또는 Phase B AI judge 자동화.
   - 기각 대안: (a) 완전 무인 — 잔여오류 무한 누적. (b) 전건 admin 리뷰 — 자가운영 원칙 위배.
- **트레이드오프(명시)**: admin 최소화 ⟺ 잔여오류 완만 누적(크라우드로 bounded). 구독자 多 라이브러리일수록 자가운영 우수, 니치 라이브러리는 admin 추가 관여 필요.

### 1.5.5 비용 귀속

- 운영기 라이브러리 cron 갱신 = 중앙 고정비 (Batch API 50% — 예측 가능, roadmap §2 Phase A 예산 내).
- 개인 추가분("내 학회"·D3) 갱신, 라이브러리 학회 즉시갱신 = 사용자 쿼터.
- TTL 안에 이미 갱신됐으면 cache hit → 호출 skip·쿼터 0 (§2.2).

### 1.5.6 구현 범위 메모

`PLAN-030`(라이브러리 스키마)은 이 §1.5 재설계에 맞춰 **재검토 필요** — 특히 참조 모델 스키마(개인 override 필드 없음), 라이브러리 생애주기 상태 컬럼. 운영기 자동화(cron·신뢰도 게이팅·주간 큐·신고 자동재검)는 PLAN-030 이후 별도 PLAN.

### 1.5.7 Discovery — 신규 학회 발굴·편입

- **개인 발굴(D1)·수동입력(D3)** → 공용 DB 에 **"미승인(pending)" 상태**로 적재. 발굴 본인의 "내 학회"엔 즉시 노출, 중앙 라이브러리엔 미편입. 비용 = 발굴자 쿼터.
- **admin 일괄 승인** → ⓐ 진위(가짜 학회) 확인 ⓑ 카테고리/라이브러리 배정. 승인 시 라이브러리 편입 → 그때부터 운영기 cron·옵트인 알림 대상.
  - cadence: §1.5.4 admin 주간 세션이 [저신뢰 갱신 큐] + [신규 승인 큐] 를 함께 처리 (1세션 2큐, ~주 10~15분).
- **자율성 경계**: 기존 학회 *갱신* 은 운영기 완전 자율 / *성장*(신규 편입)·*교정* 은 admin 주간 batch 게이트 유지 — 카테고리 모호성(열유체/건물공조)·진위 판별은 현재 사람만 신뢰 가능.
- **자동화 연기 (기각 아님)**: AI scope-judge 자동 태그는 유저 규모 확대 시(Phase B+) AI judge + 크라우드 투표(roadmap §B.3 flag·평판)로 자동화.

---

## 2. 데이터 처리 정책

### 2.1 사용자 학회 편집 권한 (§1.5.1 참조 모델 — 사실 필드 개인 override 금지)

| 행위자 | 공용 DB | 개인 fork |
|---|---|---|
| AI Edge Function (claude-proxy) | 쓰기 (cache fill) | 호출 사용자에 한해 쓰기 |
| Discovery (claude-proxy) | 쓰기 (신규 학회 INSERT) | 발굴 사용자 "내 학회" 에 자동 import |
| 사용자 수동 편집 | 쓰기 안 됨 | 개인 메타데이터(별표·메모·태그)만 — 사실 필드 X |
| admin 수동 편집 | 쓰기 가능 | 개인 메타데이터만 |

### 2.2 공용 DB 쓰기 흐름 (Q2)

사용자 A 가 학회 X 에 대해 update/verify/discovery 호출 시:

1. Edge Function 이 공용 DB 의 X cache 확인 (TTL 기반)
2. cache hit → A 의 개인 row 갱신, 공용 DB 유지, A 쿼터 차감 안 함
3. cache miss → Anthropic 호출, 결과를 **공용 DB + A 개인 row 동시 기록**, A 쿼터 1 차감

### 2.3 학회 정체성 매칭 (Q9)

- **1차**: `official_url` 정규화 매치 (host lower, trailing slash 제거, query 제거)
- **2차**: 정식명칭 fuzzy 매치 (`nameMatch.js` 기존 로직 재사용)
- **3차 (Phase B)**: AI judge — LLM 이 "동일 학회 여부" 판정 (1회 추가 호출)

매칭 시점:
- **자동**: AI/Discovery 흐름의 INSERT 직전 (공용 DB 에 같은 학회 있나 검사)
- **수동 confirm**: 사용자가 D3 (빈 카드 직접 입력) 했을 때, 입력 종료 시점에 매칭 후보 발견되면 모달로 "공용 DB 의 X 와 같은 학회인가요?" 묻기

매칭 발견 시 (Q9-c):
- 자동 병합 안 함. 사용자에게 confirm.
- 사용자 [예] → 본인 라이브러리에서 그 학회의 conference_id 를 공용 row 의 id 로 변경, 본인 override 만 보존.
- 사용자 [아니오] → 본인 row 는 별도 conference_id 로 영원히 유지 (dedup 미적용).

→ **매칭 분기 신뢰도 기준·기각 대안 기록: §1.5.2.**

### 2.4 라이브러리 모델 (Q3, Q4)

#### 구독 정책
- **가입 시 복수 라이브러리 선택** 가능
- **이후 언제든 라이브러리 추가/제거** (사용자 설정 페이지)
- **다중 구독 OK** — 한 사용자가 master + 공조 + 디지털트윈 동시 가능
- **구독 = 가입 시점 멤버십 snapshot** (어떤 학회가 내 라이브러리에 드는가 — 학회 *데이터* 는 §1.5.1 참조 모델로 항상 공용 실시간 참조) + 이후 라이브러리에 새 학회 추가 시 옵트인 알림 ("master 에 학회 5건 추가됐습니다 [수락]")
- 사용자가 본인 라이브러리에서 학회 *삭제* 했을 경우: 라이브러리가 같은 학회를 다시 추가해도 부활 안 됨 (`deleted_by_user` 플래그)

#### 라이브러리 ↔ 학회 ↔ 사용자 다중성
- **1 학회 → N 라이브러리 가능** (다대다, 예: IHTC = master ∧ 공조)
- **1 사용자 → N 라이브러리 구독**
- **사용자 화면**: 통합 테이블 1개 + **라이브러리 필터 체크박스** + 학회 행에 **라이브러리 뱃지** (`[master] [공조]`)
- 동일 학회를 두 라이브러리에서 받았을 때: 1행 + 뱃지 묶음 (중복 행 방지)

#### "내 학회" 가상 라이브러리
- 사용자별 1개 자동 생성
- Discovery 발굴 결과·D2 공용 DB import·D3 수동입력 모두 여기 적재
- admin 이 후에 "이 학회는 master 에 흡수" 결정 가능 (큐레이션 환원)

#### 학회 추가 경로
- **D1 Discovery**: PLAN-011 발굴 흐름. AI 가 키워드 → 후보 → 사용자 수용 시 공용 DB INSERT + 본인 라이브러리 import.
- **D2 공용 DB import**: `/db` 페이지에서 검색 → "내 라이브러리에 추가" 버튼.
- **D3 수동 빈 카드**: 본인 라이브러리에만 적재. 공용 DB 흘러가지 않음. 추후 매칭 발견 시 confirm 모달 (Q9).

### 2.5 데이터 저장 방식 (현재·목표)

| 저장소 | 용도 | 현재 상태 |
|---|---|---|
| Supabase `conferences_upstream` + `editions_upstream` | 공용 DB | [구현 완료] |
| Supabase `user_conferences` | 개인 fork (starred·overrides·personal_note) | [구현 완료] (스키마만, 쓰기 미연결) |
| Supabase `libraries` + `library_conferences` | 라이브러리 큐레이팅 | [Phase A.3] 신설 필요 |
| Supabase `user_libraries` | 사용자별 구독 | [Phase A.3] 신설 필요 |
| Supabase `audit_log` | 수동 편집 영구 기록 | [Phase A.3] 신설 필요 |
| 브라우저 localStorage | UI 즉시 갱신 캐시 + 미저장 버퍼 | [구현 완료] |
| GitHub Pages 정적 JSON | **레거시** — Phase A.1 후 read-only fallback 만 사용 | [구현 완료] |

### 2.6 conferences_upstream 메타 확장 [Phase A.3]

```sql
ALTER TABLE public.conferences_upstream
  ADD COLUMN last_editor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN edited_count   int  NOT NULL DEFAULT 0,
  ADD COLUMN last_edited_at timestamptz;
```

(이미 `last_editor_id` 는 v1 스키마에 있음. `edited_count` / `last_edited_at` 만 추가.)

---

## 3. 인증·접근 정책 (Q5)

### 3.1 가입 게이트 (Q5-a)

| 단계 | 정책 | 구현 |
|---|---|---|
| Phase A.3 ~ B 후반 | **A2 초대 코드** 필수 | admin 페이지에 코드 발급 UI. 코드 입력 시만 가입 진행 |
| Phase C (결제) | A1 자유 가입 + 결제 가드 | Stripe 등 연동 |

→ `Y 옵션 (A1 + admin 승인 후 한도 풀림)` 은 채택 안 함. Phase C 결제 모델의 *수동 버전* 이라 중간 단계로 들 가치 적음.

### 3.2 익명(비로그인) 접근 (Q5-b)

- **B1 완전 차단** — 로그인 안 하면 LoginScreen 만 노출.
- 추후 마케팅 / 잠재 사용자 유인 필요 시 재검토 (예: master 라이브러리 일부만 노출).

### 3.3 인증 수단 (Q5-c)

| 단계 | 인증 |
|---|---|
| Phase A | 매직링크 only (현재) |
| Phase A.3 후 | + **이메일+비밀번호** + **구글 OAuth** |
| 메인 URL | 곧바로 LoginScreen — 이메일+비번 또는 구글 클릭 1회로 로그인 |

매직링크는 비밀번호 미설정 사용자 폴백으로 유지.

### 3.4 계정 라이프사이클 (Q5-d)

| 단계 | 정책 |
|---|---|
| 현재 | **D3 비활성화** — admin 만 hard-delete 가능 |
| Phase B | + **D1 셀프 삭제** UI — 본인 데이터 익명화 후 hard-delete (GDPR) |

본인이 공용 DB 에 기여한 학회 데이터: user_id 익명화 (`anonymized_user`) 후 잔류. 학회 자체 보존, 누가 만들었는지만 가림.

---

## 4. 기능 카탈로그 (Q6)

### 4.1 [구현 완료] 정합성 검증·업데이트·발굴·캘린더

- 기존 PLAN-001~011 + PLAN-009 (캘린더) + PLAN-010 (ICS 다운로드) + PLAN-029 (서버 이관)

### 4.2 [Phase A.3] ICS 구독 URL

- Edge Function 추가: `GET /functions/v1/calendar-feed?token={user_calendar_token}` → text/calendar
- 사용자별 token 발급 (sha256, sessions 와 분리)
- 사용자 설정 페이지에 "내 캘린더 구독 URL" 표시 + 복사 버튼
- 구글캘린더 / 애플캘린더 / 아웃룩 자동 동기화 → 사용자 락인의 핵심 후크

### 4.3 [Phase A.3] admin 대시보드

- 페이지: `/admin`
- 위젯:
  - 사용자별 사용량 (current month update_used / discovery_used / 누적 cost_usd)
  - 월 비용 추세 (sparkline)
  - 라이브러리별 학회 수 / 구독자 수
  - 최근 30일 N회 이상 편집된 학회 TOP10 (Q7-c2)
  - 어뷰즈 신호 (시간당 호출 5회 이상 사용자, status=error 비율 등)
  - 라이브러리 큐레이팅 UI (학회를 라이브러리에 태깅·해제)
  - 초대 코드 발급 버튼 (Q5-a A2)

### 4.4 [Phase B] 알림 센터

- 즐겨찾기 학회의 시작일 D-30 / D-7 / D-1 이메일 알림 (Resend 활용)
- 사이트 헤더 벨 아이콘 → 알림 센터 (라이브러리 옵트인 동기화 알림 포함)

### 4.5 [Phase B] 검색/필터 저장

- 자주 쓰는 필터 조합 ("열전달 + 미주 + upcoming 6개월 내") 이름 붙여 저장
- 사용자 1인 다중 분야 구독 시 가치 ↑

### 4.6 [Phase C] 보류

- 공개 댓글 / 공유 노트 (모더레이션 부담 ≫ 가치)
- 학회 비교 (두 학회 나란히 비교 모달)
- 학회 사진/로고 (favicon 자동 표시는 [Phase B] 검토)

### 4.7 [현재대로] 데이터 내보내기

- xlsx (사람용 스냅샷) + JSON (재난 복구) — 그대로 유지. PDF·통계 보고서는 yagni.

---

## 5. AI 검증 + 편집 추적 (Q7)

### 5.1 [Phase A.3] AI 결과 출처 URL 노출 (Q7-a A2)

#### 프롬프트·파서 변경
- `promptBuilder.js` v1_2: "각 필드별 source_url 1~2개 필수 반환" 시스템 프롬프트 보강
- `responseParser.js` schema 확장: 각 필드에 `source_urls: string[]` optional
- 양쪽 동기 테스트 (`promptBuilder.sync.test.js`) 갱신
- `docs/prompts/v1_2.md` 신설 — v1_1 측정 후 개선판

#### UI
- UpdateCard / VerificationCard 의 각 필드 옆에 작은 `[근거]` 링크 (있을 때만)
- 클릭 → 새 탭 열림 → 사용자 자체 검증 가능

→ **A3 신뢰도 점수, A4 다른 사용자 결과 비교는 Phase B** (데이터 부족).

### 5.2 [Phase A.3] 편집 audit (Q7-b B1+B2)

#### 메타 (B1)
- `conferences_upstream` 에 `edited_count` / `last_edited_at` / `last_editor_id` (§2.6)

#### 풀 audit (B2)
```sql
CREATE TABLE public.audit_log (
  id            bigserial   PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  conference_id text        NOT NULL REFERENCES public.conferences_upstream(id) ON DELETE CASCADE,
  field         text        NOT NULL,
  old_value     text,
  new_value     text,
  ts            timestamptz NOT NULL DEFAULT now(),
  source        text        NOT NULL CHECK (source IN ('manual','ai_search','admin')),
  endpoint      text                                -- AI 인 경우만
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY al_self_read  ON public.audit_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY al_admin_read ON public.audit_log FOR SELECT USING (public.is_admin(auth.uid()));
-- INSERT 는 service_role 만 (Edge Function · admin 백엔드)
```

#### 추적 범위
- **공용 DB** 변경만 audit
- 개인 fork (`user_conferences`) 변경은 본인 일이라 추적 안 함 — 단, 사용자가 본인의 *공용 DB 흡수 가능 학회* 를 편집했다면 그건 AI 흐름 거쳐야 공용에 반영되니, 모순 없음.

### 5.3 [Phase A.3] 자주 편집된 학회 신호 (Q7-c C2)

- admin 대시보드 위젯: "지난 30일 N회 이상 편집된 학회 TOP10"
- → 데이터 품질 의심 신호. 운영자가 보고 verify 트리거 / 라이브러리에서 제외 결정.

→ **C3 프롬프트 보강은 Phase B**, **C4 자동 verify 는 Phase C**.

---

## 6. 페이지·라우팅 (Q8)

### 6.1 라우팅 도입 [Phase A.3]

- `react-router-dom` 도입
- URL 구조:

| URL | 페이지 | 권한 |
|---|---|---|
| `/` | 메인 (테이블/캘린더 토글) | 로그인 |
| `/libraries` | 라이브러리 관리 (구독·해제·옵트인 동기화) | 로그인 |
| `/db` | 공용 DB 검색·import | 로그인 |
| `/discovery` | 발굴 (현재 모달 → 페이지 분리) | 로그인 |
| `/settings` | 사용자 설정 (비번·OAuth·계정 비활성화) | 로그인 |
| `/admin` | admin 대시보드 | role=admin |
| `/login` | LoginScreen | 비로그인 |

### 6.2 헤더 사용자 메뉴

- 드롭다운 (현재 평면 → 클릭 시 펼침)
- 항목: [내 라이브러리] / [공용 DB 검색] / [발굴] / [설정] / [로그아웃] / (admin 만) [admin 대시보드]

### 6.3 도입 우선순위 (Phase A.3 내)

| 순위 | 페이지 | 트리거 |
|---|---|---|
| 1 | `/admin` | 30명 운영 시작 = 비용/사용량 모니터링 필수 |
| 2 | `/libraries` | 다중 구독·옵트인 알림 UI 필요 |
| 3 | `/settings` | 비밀번호/OAuth 추가 시 |
| 4 | `/db` | D2 import 경로 — 라이브러리 외 학회 import 수요 발생 시 |
| 5 | `/discovery` | 현재 모달도 충분, 사용 빈도 보고 결정 |

---

## 7. 후속 PLAN 매핑

블루프린트 v2.0 의 Phase A.3 항목들을 PLAN 으로 분해:

| PLAN | 범위 | 의존 |
|---|---|---|
| **PLAN-030** library + user_libraries 스키마 + 옵트인 동기화 | §2.4 라이브러리 모델 + §2.5 신규 테이블 | - |
| **PLAN-031** audit_log + 메타 컬럼 + 자주 편집 학회 위젯 | §2.6 + §5.2 + §5.3 | PLAN-030 |
| **PLAN-032** AI 응답 source_url 확장 (promptBuilder v1_2 + responseParser + UI) | §5.1 | - |
| **PLAN-033** react-router 도입 + 페이지 5개 분리 | §6 | - |
| **PLAN-034** ICS 구독 URL Edge Function | §4.2 | - |
| **PLAN-035** admin 대시보드 (사용량·비용·라이브러리 큐레이팅·초대 코드) | §4.3 | PLAN-030, PLAN-031 |
| **PLAN-036** 학회 정체성 매칭 + D3 confirm 모달 | §2.3 | PLAN-030 |
| **PLAN-037** 비밀번호 + 구글 OAuth 추가 | §3.3 Phase A.3 후반 | PLAN-033 |
| **PLAN-038** user_conferences write 경로 (starred·overrides 실제 Supabase 저장) | §2.1 (현재 localStorage 잔존) | - |

→ 작성 순서 권고: **PLAN-038 → PLAN-030 → PLAN-031 → PLAN-032 → PLAN-033 → PLAN-035 → PLAN-034 → PLAN-036 → PLAN-037**.

근거:
- PLAN-038 이 가장 시급 — 현재 starred 토글 등이 localStorage 에만 저장돼 멀티 디바이스 동기화 미작동. 이거 없이는 멀티테넌트 진정한 의미 없음.
- 라이브러리 모델 (PLAN-030) 은 이후 모든 작업의 데이터 기반.
- 라우터 (PLAN-033) 는 페이지 분리의 전제.
- admin 대시보드 (PLAN-035) 가 30명 운영 안전망이라 그 다음.

Phase B 추가 PLAN: 알림 센터 (PLAN-040), 필터 저장 (PLAN-041), AI judge 매칭 (PLAN-042), 셀프 계정 삭제 (PLAN-043).

Phase C 추가 PLAN: 결제 (PLAN-050), 티어 (PLAN-051), 공개 댓글 (PLAN-052).

---

## 7.5 운영 견고성 — 보안 + 배포 파이프라인 (2026-05-17 추가)

> 30명 실사용 런치 전 갖춰야 할 시스템 속성. **요구사항·게이트 설계는 여기, 실행은 후속 PLAN.**

### 7.5.1 보안 모델

**현 상태**:
- Anthropic API 키는 Edge Function 서버 보관 — 브라우저 노출 없음.
- 모든 테이블 RLS 활성. 공용 DB 쓰기는 service_role(Edge Function) 독점.
- service_role 키는 Edge Function 환경변수만 — 프론트 절대 금지.

**점검·강화 대상** (후속 PLAN 에서 audit):
- 전 테이블 RLS 정책 정합성 전수 검사 (신규 `libraries`/`library_conferences`/`user_libraries` 포함).
- `claude-proxy` Edge Function 의 호출자 JWT 검증 — 인증 사용자만 쿼터·API 소비.
- 초대코드 게이트·어뷰즈 신호 (roadmap §B.3 연결).
- AI 응답 파싱 try-catch, 입력 검증, 의존성 취약점.

### 7.5.2 배포 파이프라인 — 목표

**현 상태**: `main` push → 프론트 자동 배포(`.github/workflows/deploy.yml`). 마이그레이션 적용·Edge Function 배포는 **수동**.

**목표**: **CI green + 사람 승인 게이트 후 자동 적용.**
- GitHub Actions 워크플로에 마이그레이션 적용·Edge Function 배포 단계 추가.
- 게이트: 테스트 통과 필수 + GitHub Environments 보호 규칙(필수 승인자)으로 **사람 1-click 승인 후** prod 반영.
- **무인 자동 적용 금지** — 잘못된 마이그레이션의 prod 직행 차단.

### 7.5.3 트레이드오프 (명시)

자동화 ↑ = Supabase 액세스 토큰 등 크리덴셜이 CI secret 에 상주 = 사고 시 폭발 반경 ↑. 완화: 최소 권한 토큰, 승인 게이트, secret 주기 회전.

### 7.5.4 실행 = 후속 PLAN

- 보안 audit·강화 → 별도 PLAN (`/security-review` 스킬 활용 가능).
- 배포 파이프라인 자동화 → 별도 PLAN.
- PLAN-030 완료 후 착수. blueprint 는 요구사항·게이트 설계만 보유.

---

## 8. 미해결 / 후속 검토

- **Discovery 페이지 vs 모달**: 현재 모달로 충분, 페이지 분리(PLAN-033 내) 는 사용 빈도 보고 결정. 빈도 낮으면 모달 유지.
- **라이브러리 lifecycle**: 관리자가 라이브러리 폐기 시 기존 구독자 영향 — 본인 라이브러리에 이미 들어온 학회는 본인 자산 (영향 없음). 미래 구독 차단만.
- **라이브러리 별 권한 위임**: 현재 admin 만 라이브러리 편집. 미래에 "공조 라이브러리 도메인 전문가" 같은 역할 분담 필요시 별도 PLAN.
- **익명 공개 모드 재검토**: B1 차단을 마케팅 단계에서 풀지 여부 — Phase B 진입 시점 결정.
- **Phase C 가격/티어 모델**: 결제 전 별도 PLAN-050 에서 확정.
- **Resend 도메인 인증**: 30명 초대 전 본인 도메인 verify 필수 (`onboarding@resend.dev` 는 본인 1명만 수신 가능). 운영 작업 — PLAN 불요.

---

## 9. 변경 이력

- **2026-05-17**: §7.5 운영 견고성 추가 — 보안 모델·강화 대상 + 배포 파이프라인 목표(CI green + 사람 승인 게이트). 실행은 후속 PLAN.
- **2026-05-17 (grill-me 재설계)**: §1.5 신설 — 참조 모델 확정(사실 필드 개인 override 금지), 전역 정체성 ID, 라이브러리 생애주기(구축기→운영기, admin 수동 플립), 운영기 출처기반 신뢰도 게이팅 + admin 주간 큐(~10분). Discovery 발굴·편입 모델 — 개인 발굴 pending → admin 일괄 승인(§1.5.7). §1·§2.1·§2.3·§2.4 정합 갱신.
- **2026-05-17**: 5층 문서 모델 개혁 — 구 `blueprint-v2.md` 를 활성 `blueprint.md` 로 승격, 체인 번호 v3 로 정합 (구 독립번호 v2.0 → 통합 체인 v3).
- **2026-05-03 (구 v2.0)**: /grill-me 인터뷰 후 멀티테넌트 모델 종합 (Q1~Q9). 라이브러리·개인 fork·공용 DB 3계층 확정. PLAN-030~038 도출.
- **이전 체인**: v1(MVP) · v2(post-MVP) → `docs/roadmap.md` 체인 테이블. 구 blueprint-v1.2 본문은 `docs/legacy/blueprint-v1.2.md`.
