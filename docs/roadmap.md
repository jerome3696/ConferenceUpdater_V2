# ConferenceFinder 로드맵 — 비전·블루프린트 체인

> **역할**: 최상위 비전 문서. "몇 년에 걸쳐 어디로 가나" + 블루프린트 체인(v1→v2→v3→…)의 색인.
> **버전 없음** — 이 문서가 모든 체인 버전을 엮는 색인이기 때문.
> **문서 관계**: **이 문서(비전·체인)** → `status.md`(지금 어디) → `blueprint.md`(무엇) → `dev-guide.md`(어떻게) → `plans/PLAN-xxx`(실행).
> **갱신**: 드물게 — 체인 전환·상업화 Phase 전환·비용 판정 변경 시에만.

---

## 1. 블루프린트 체인 (SSOT)

각 체인은 `blueprint vN` = `dev-guide vN` 한 쌍으로 구현된다. **현재 활성 버전 = 이 테이블의 🔵 행.**

| 체인 | blueprint = dev-guide | 목표 | 상태 |
|---|---|---|---|
| v1 | v1 | MVP — 정적 GitHub Pages·단일 사용자·JSON/localStorage | ✅ 완료 |
| v2 | v2 | post-MVP — 리팩토링·테스트·프롬프트 평가체계·발굴/업데이트 개선 | ✅ 완료 |
| **v3** | **v3** | **멀티테넌트 + 라이브러리 + 서버 도입** (상업화 Phase A, 30명 파일럿) | 🔵 현재 |
| v4 | v4 | (미정 — 상업화 Phase B 진입 시 작성) | 예정 |

> **체인 번호 주석**: 구 `blueprint-v1.2` 는 v1·v2 체인을 함께 다뤘다(당시 체인 분리 개념 없음). 구 `dev-guide` v1/v2/v3 의 독립 번호를 통합 체인 번호로 재정렬했다. 과거 본문은 `docs/legacy/` 보존.

체인 완료 시: `blueprint.md`/`dev-guide.md` → `docs/legacy/` 로 버전명 붙여 이관, 새 v(N+1) 본을 top-level 에 생성. 활성본은 항상 top-level 의 `blueprint.md`/`dev-guide.md`.

---

## 2. 상업화 비전 — 3-Phase

ConferenceFinder V2는 1인 SPA로 시작했으나 명확한 상업화 경로가 확정되었다. 체인 v3 = Phase A 에 대응.

| Phase | 기간 | 사용자 | 쿼터 (사용자/월) | 비용 모델 | 핵심 달성물 | 대응 체인 |
|---|---|---|---|---|---|---|
| **A** | 1-6개월 | 30명 | 업데이트 10 + 발굴 3 | 내 부담 (~$30/월) | 서버 MVP + Auth + 쿼터 + 라이브러리 | v3 |
| **B** | 6-12개월 | 100명 | 동일 | 내 부담 (~$100/월) | 분야 파라미터화 + 공용 캐시 고도화 | v4 (예상) |
| **C** | 12개월~ | n명 (랜덤) | 재설계 | 요금 청구 | 결제 + 티어 + SLA | v5+ (예상) |

**비용 실측 기준 (2026-04)**: 호출당 update $0.0564 / discovery ~$0.15. 사용자당 쿼터 100% 소진 시 $1.02/월. Prompt Caching -15~20%.

---

## 3. 횡단 설계 축 (상시 유효)

### 3.1 FinOps·쿼터
리셋 주기(월초 일괄 vs rolling), 초과 UX(하드 차단 vs 경고), 카운터 원자성(체크·차감·호출 1트랜잭션), 투명성("남은 쿼터 X/10" UI), 예산 상한(월 $50 하드 중단). 상세: `docs/plans/completed/PLAN-P0-quota-policy.md`.

### 3.2 분야 일반화 (프롬프트 아키텍처 v2.0 — Phase B)
현재 v1_x 는 열유체·공조 도메인 특화(하드코딩 예시). v2.0 은 뼈대 공통 + `field_specific_examples`·`domain_hints` 파라미터화. 분야별 mini-goldenset. → 축② 작업, `docs/prompteng.md` 참조.

### 3.3 멀티테넌트 데이터 구조 (3채널 기여 모델)
① 운영자 큐레이션 시드 ② AI 자동 검색(공용 DB 선참조 후 stale 시만 호출) ③ 사용자 수동 입력(공용 반영 + 감사 로그). `conferences_upstream`(공용 ground truth) ⊥ `user_conferences`(즐겨찾기·메모·override). role 2단계: `user` + `admin`. 신뢰 모델: Phase A trust-all+감사로그 → B flag → C 평판. 상세 설계: `docs/blueprint.md`.

---

## 4. API 비용 절감 — 판정표

외부 제안·자체 리서치 12개 수단 중 채택/기각. **수단 추가·번복 시 근거 명시 필수.**

| 수단 | 판정 | 적용 | 근거 |
|---|:-:|---|---|
| Prompt Caching | ✅ 채택 | A | 25% 입력 토큰 절감. 서버 이전 직후 활성화. |
| Batch API (평가 루프) | ✅ 채택 | A-B | 50% 할인. 평가·증분 업데이트에 적합(async 24h OK). |
| 공용 결과 캐시 (`conferences_upstream`) | ✅ 채택 | B | 30명×같은 학회 = 30× 낭비 → 공용 캐시로 30× 절감. |
| MCP 서버 (Agent SDK) | ✅ 후순위 | C+ | Phase 3 이후 재검토. |
| 학술 API (OpenAlex·Crossref) | ❌ 기각 | - | 논문 DB이지 이벤트 DB 아님. 도메인 부적합. |
| WikiCFP 통합 | ❌ 기각 | - | `responseParser.js` BANNED_LINK_DOMAINS 포함(스팸 이력). |
| 로컬 LLM (Ollama) | ❌ 기각 | - | $15-100/월 규모에 오버킬. |
| 모델 티어링 (Haiku 폴백) | ⚠️ 보류 | B | 품질 손실 실측 필요. |
| 벡터 DB | ❌ 기각 | - | 33개 학회에 과잉. RAG 불필요. |
| 크론 증분 업데이트 | ⏳ B+ | B | 서버 전제. Batch API 결합. |
| 웹 검색 `max_uses` 하향 | ⚠️ 실측 후 | A | Pass rate 영향 측정 후. |

---

## 5. 스택 결정

**Supabase 확정** (PostgreSQL + 네이티브 RLS + 혼자 개발 친화). 근거: `docs/plans/completed/PLAN-026.md` §4.4.

재검토 트리거: Supabase 가격 50%+ 인상 / Free 티어 축소 / Compute 비용 $100+/월 / Anthropic SDK Deno 호환 깨짐.

---

## 6. 전략 리스크

| 리스크 | 영향 | 완화 |
|---|---|---|
| API 키 단일 공유 | 어뷰즈 탐지 시 전체 중단 | 키 회전, 예비 키, 어뷰즈 감지(Phase B) |
| 월 예산 초과 ($50+) | 내 부담 초과 | Anthropic 측 월 한도, 하드 상한 경보 |
| 쿼터 공정성 | 한 사용자가 타인 쿼터 잠식 | 원자적 카운터, 사용자별 독립 |
| 공용 캐시 vs 개인 데이터 경계 | 동기화 모순 | 개인 override 레이어, 명시적 분리 스키마 |
| 사용자 기여 품질 | 공용 DB 부정확·악의 편집 | trust-all+감사로그 → flag → 평판. 초대 기반 1차 방어 |
| 정책 번복 | 공개한 쿼터·UX 변경 시 신뢰 하락 | Phase 시작 전 스펙 굳히기 |
| Supabase 락인 | 가격·기능 종속 | Self-hosted 탈옥 경로 확보 |

---

## 7. 문서 업데이트 규칙

- **체인 전환 시**: §1 테이블 상태 갱신 + 활성본 `docs/legacy/` 이관.
- **상업화 Phase 전환 시**: §2 테이블 갱신.
- **판정표 변경 시**: §4 에 근거 명시 (단순 추가·삭제 금지).
- **분업**: 기능 설계는 `blueprint.md`, 구현 순서·진행은 `dev-guide.md`, 현재 상태는 `status.md`. 이 문서는 비전·체인·전략만.
- **200줄 이내 유지**.
