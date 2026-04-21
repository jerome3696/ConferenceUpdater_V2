# Ultra-Plan: ConferenceFinder 로드맵

> **문서 위치**: 상위 — 없음 (북극성)
> **하위 문서**: `docs/dev-guide-v3.md` (현재 sprint), `docs/plans/active/PLAN-xxx.md` (과제)
> **최종 수정일**: 2026-04-21
> **현재 Phase**: **A 준비기** — Phase 0 (서버 전환 설계 중, 스택=Supabase 권고 대기)

---

## 1. Context

ConferenceFinder V2는 1인 SPA로 시작했으나, **명확한 상업화 로드맵**이 확정되었다:

- 1-6개월: 30명 평가 사용자 (열유체·공조 중심)
- 6-12개월: 100명 확대 (분야 다양화)
- 12개월~: 랜덤 배포 + 요금 청구 구조

이 전환은 단순 SPA 최적화가 아니라 **서버 도입·멀티테넌트·쿼터·비용 관리**를 수반한다. 본 문서는 전환의 단일 출처(single source of truth)이며, 개별 PLAN은 여기를 상향 참조한다.

**개발 모델**: 혼자 + Claude 협업 (설계·구현·리뷰·QA 전반).

---

## 2. 3-Phase 개요

| Phase | 기간 | 사용자 | 쿼터 (사용자/월) | 비용 모델 | 핵심 달성물 |
|---|---|---|---|---|---|
| **A** (P1) | 1-6개월 | 30명 | 업데이트 10 + 발굴 3 | 내 부담 (~$30/월) | 서버 MVP + Auth + 쿼터 + Prompt Caching |
| **B** (P2) | 6-12개월 | 100명 | 동일 | 내 부담 (~$100/월) | 분야 파라미터화 + 공용 캐시 |
| **C** (P3) | 12개월~ | n명 (랜덤) | 재설계 | 요금 청구 | 결제 + 티어 + SLA |

### 비용 실측 기준 (2026-04 기준)
- 호출당: update $0.0564, discovery(Stage1+2 평균) ~$0.15
- 사용자당 쿼터 100% 소진 시 $1.02/월, 평균 50% 시 $0.51/월
- Prompt Caching 도입 시 -15~20% 추가 절감 기대

---

## 3. Phase A — 30명 파일럿 (1-6개월)

### A.0 준비기 (현재 위치)
- **A.0.1** 서버 스택 결정 → `PLAN-026` (Supabase 권고, 승인 대기)
- **A.0.2** 멀티테넌트 스키마 설계 → `PLAN-P0-multitenant-schema`
- **A.0.3** 쿼터 정책 상세 → `PLAN-P0-quota-policy`
- **A.0.4** 인증 플로우 + Resend SMTP → `PLAN-P0-auth-flow`

### A.1 서버 MVP
- Supabase 프로젝트 + Auth + DB 스키마 적용
- Anthropic API 프록시 Edge Function (키 서버 보관)
- **Prompt Caching 활성화** (`cache_control` 블록, 25% 절감)
- 쿼터 카운터 (원자적 UPDATE)
- → `PLAN-028-api-proxy-mvp`

### A.2 클라이언트 이관
- `src/services/claudeApi.js` → 서버 엔드포인트 호출로 전환
- 브라우저 API 키 입력 UI 제거
- 로그인·쿼터 표시 UI 추가
- → `PLAN-029-client-migration`

### A.3 30명 파일럿 + 비용 모니터링
- 30명 계정 발급·배포
- 비용 대시보드 (사용자별 소진율)
- 월 $50 하드 상한 경보

---

## 4. Phase B — 100명 + 분야 확장 (6-12개월)

### B.1 분야별 프롬프트 파라미터화 v2.0
- v1_x 는 열유체·공조 도메인 특화 (cryocooler.org·iifiir 예시 등 하드코딩)
- v2.0 은 뼈대 공통 + `field_specific_examples`·`domain_hints` 파라미터
- 분야별 mini-goldenset 3개 (재료·화학·의학 등)

### B.2 공용 캐시 `conferences_upstream` (30× 절감)
- 학회 공식 정보는 모든 사용자 공통 사실
- `conferences_upstream` 공용 테이블 TTL 기반 (주기 진행률 동적)
- `user_conferences` 는 개인 편집·메타만
- 100명 × 같은 33학회 = 3,300 호출 → 33 호출

### B.3 어뷰즈 감지
- 이상 사용 패턴 감지 (시간당 호출 수, 반복 동일 학회 등)
- 쿼터 소모 전 선제 차단

---

## 5. Phase C — 요금 청구 (12개월~)

### C.1 결제 연동 (Stripe 등)
### C.2 티어 (무료 / 유료 / BYOK)
### C.3 SLA · 운영 자동화
- 키 회전·예비 키 준비
- 예산 상한 자동 차단
- 장애 대응 플레이북

---

## 6. 횡단 설계 축

### 6.1 FinOps · 쿼터 정책
- **리셋 주기**: 월초 일괄 vs 가입일 기준 rolling (후자 공정, 구현 복잡)
- **초과 UX**: 하드 차단 vs 경고+다음 달 대기 vs 긴급 추가 (유료)
- **카운터 원자성**: 쿼터 체크·차감·API 호출이 한 트랜잭션
- **투명성**: "이번 달 남은 쿼터 X/10" UI 필수
- **예산 상한**: 전체 월 $50 도달 시 하드 중단 또는 선착순
- → 상세: `PLAN-P0-quota-policy`

### 6.2 분야 일반화 (프롬프트 아키텍처 v2.0)
- 현재 v1_1 의 하드코딩 예시 제거 → 파라미터화
- 분야별 dedicated series domain 힌트만 주입
- 골든셋 v5 + 분야별 mini-goldenset

### 6.3 멀티테넌트 데이터 구조
- `conferences_upstream` (공용 ground truth) ⊥ `user_conferences` (개인 편집)
- 공용 값 사용자 override 시 personal override 레이어
- `api_usage_log`·`quotas` 사용자별 스케일
- → 상세: `PLAN-P0-multitenant-schema`

---

## 7. API 비용 절감 — 판정표

외부 제안·자체 리서치 총 12개 수단 중 4개 채택, 8개 기각·보류. 각 판정 근거:

| 수단 | 판정 | 적용 Phase | 근거 |
|---|:-:|---|---|
| **Prompt Caching** | ✅ 채택 | A.1 | 25% 입력 토큰 절감. 서버 이전 직후 즉시 활성화. |
| **Batch API** (평가 루프) | ✅ 채택 | A-B | 50% 할인. 평가 골든셋 재측정·크론 기반 증분 업데이트에 적합 (async 24h OK). |
| **공용 결과 캐시** (`conferences_upstream`) | ✅ 채택 | B.2 | 30명×같은 학회 = 30× 낭비 → 공용 캐시로 30× 절감. 멀티테넌트 전제. |
| **MCP 서버** (Claude Agent SDK) | ✅ 후순위 | C+ | Phase 3 이후 재검토. 서버 전환 전 SPA 구현은 폐기됨. |
| 학술 API (OpenAlex·Crossref) | ❌ 기각 | - | **논문 DB이지 이벤트 DB 아님**. 도메인 부적합. |
| WikiCFP 통합 | ❌ 기각 | - | `responseParser.js` BANNED_LINK_DOMAINS 에 포함 (스팸·저품질 이력). |
| 로컬 LLM (Ollama) | ❌ 기각 | - | $15-100/월 규모에 오버킬. 품질·인프라·운영 비용이 절감분 초과. |
| 모델 티어링 (Haiku 폴백) | ⚠️ 보류 | B | 쉬운 케이스 Haiku, 어려운 케이스 Sonnet. 품질 손실 실측 필요. |
| 벡터 DB | ❌ 기각 | - | 33개 학회 DB 에 과잉. RAG 불필요. |
| 결과 캐싱 DB (파일 기반) | ❌ 기각 | - | 서버 이전 시 폐기됨. 서버 DB(`conferences_upstream`) 가 정석. |
| 크론 증분 업데이트 | ⏳ Phase B+ | B | 서버 전제. Batch API 와 결합. |
| 요청당 웹 검색 `max_uses` 하향 | ⚠️ 실측 후 | A | 현재 기본값. Pass rate 영향 측정 후 하향 검토. |

---

## 8. PLAN 매핑 (Phase ↔ PLAN-xxx)

| Phase | PLAN | 상태 | 브랜치 |
|---|---|---|---|
| A.0.1 | `PLAN-026` 서버 스택 비교 | active | `feature/PLAN-026-server-stack-comparison` |
| A.0 | `PLAN-027` ultra-plan roadmap | active | `feature/PLAN-027-ultra-plan-roadmap` |
| A.0.2 | `PLAN-P0-multitenant-schema` | 예정 | - |
| A.0.3 | `PLAN-P0-quota-policy` | 예정 | - |
| A.0.4 | `PLAN-P0-auth-flow` | 예정 | - |
| A.1 | `PLAN-028-api-proxy-mvp` | 예정 | - |
| A.2 | `PLAN-029-client-migration` | 예정 | - |
| B.1 | `PLAN-030-prompt-v2.0-parametric` | 예정 | - |
| B.2 | `PLAN-031-upstream-cache` | 예정 | - |

Phase B·C 세부 PLAN은 Phase A 완료 시 구체화.

---

## 9. 스택 결정 참조

→ `docs/plans/active/PLAN-026.md` §4.4 — **Supabase 선택 근거 (PostgreSQL + 네이티브 RLS + 혼자 개발 친화)**

**대안 재검토 트리거**:
- Supabase 가격 인상 50%+ / Free 티어 축소
- Compute add-on 비용 $100+/월 돌입
- Anthropic SDK Deno 호환 깨짐

---

## 10. 전략 리스크

| 리스크 | 영향 | 완화 |
|---|---|---|
| API 키 단일 공유 | Anthropic 어뷰즈 탐지 시 전체 중단 | 키 회전 주기, 예비 키 준비, 어뷰즈 감지(B.3) |
| 월 예산 초과 ($50+) | 내 부담 초과, Phase B 전에 Phase C 강제 전환 | Anthropic API 측 월 한도, 하드 상한 경보 |
| 쿼터 공정성 | 한 사용자가 타 사용자 쿼터 잠식 | 원자적 카운터, 사용자별 독립 |
| 공용 캐시 vs 개인 데이터 경계 | 사용자가 공용값 수정 시 동기화 모순 | 개인 override 레이어, 명시적 분리 스키마 |
| 정책 번복 | 30명에게 공개한 쿼터·UX 변경 시 신뢰 하락 | P1 시작 전 상세 스펙 굳히기 (PLAN-P0-*) |
| Supabase 락인 | 가격·기능 종속 | Self-hosted 탈옥 경로 확보 (공식 지원) |

---

## 11. 문서 업데이트 규칙

- **Phase 전환 시**: 상단 "현재 Phase" 배지 갱신 + §2 개요 테이블 상태 갱신
- **판정표 수단 추가·번복 시**: §7 에 **근거 명시 필수** (단순 추가·삭제 금지)
- **PLAN 매핑은 즉시 반영**: 새 PLAN 착수·완료·기각 시 §8 갱신
- **분업**: 기능 설계 변경은 `blueprint.md`, 로드맵 영향만 본 문서
- **300줄 이내 유지**: 초과 시 상세는 후속 PLAN 으로 이관
