# PLAN-025: conferences.json cycle_years 감사

> **상태**: active
> **생성일**: 2026-04-21
> **완료일**: —
> **브랜치**: `feature/PLAN-025-cycle-audit`
> **연관 PR**: TBD
> **트랙**: F (운영 품질 / 데이터 정합)

---

## 1. 목표 (What)

`public/data/conferences.json` 의 모든 학회(n=33)에 대해 `cycle_years` 필드가 실제 edition 이력과 일치하는지 전수 검증. 명확한 오류는 교정하고, 모호한 케이스는 증거와 함께 문서화.

측정 기준: 이 플랜 머지 후 각 conference 의 `cycle_years` 는 (a) 최근 2건 이상 edition 의 연도 간격, (b) 시리즈 역사적 주기 중 하나와 일치하거나, 일치하지 않는 이유가 `note` 에 기록되어 있어야 함.

## 2. 배경·동기 (Why)

2026-04-21 critic 에이전트 리뷰에서 "conf_007, conf_017 등 cycle_years 오류 의심" 지적. promptBuilder 가 `주기: N년` 을 LLM 컨텍스트에 주입하므로, 이 값이 틀리면 prompt eval 이 **프롬프트 성능이 아닌 데이터 버그를 측정**하게 됨.

특히 PLAN-019 의 v1_1 → v1_2 튜닝이 "4년 주기 케이스"를 타겟으로 하는데, 데이터가 잘못되면 튜닝 방향 자체가 오염됨.

## 3. 범위 (Scope)

### 포함
- 모든 conference (33건) 의 `cycle_years` 를 edition 이력 + 시리즈 역사와 대조
- 발견된 오류·모호한 케이스를 표로 정리 (이 문서 §5)
- 명확한 오류 수정 (`cycle_years` 값 변경 + `note` 필드에 근거 기록)
- 모호한 케이스는 `note` 에 히스토리 주석만 추가 (값은 유지)

### 제외 (Non-goals)
- 누락된 `duration_days`, `region`, `official_url` 검증 (별도)
- `abbreviation` 정규화 (별도)
- 실제 edition 데이터(날짜·장소) 검증 (별도, PLAN-013 Phase 1 에서 1차 완료됨)

## 4. 설계 결정

**출처 우선순위**:
1. `editions` 테이블의 실제 last + upcoming 날짜 간격
2. `notes` 필드에 기록된 시리즈 회차 정보
3. (필요 시) web 검색으로 시리즈 히스토리 확인 — 이 감사에서는 **기존 notes + 날짜만** 사용 (추가 WebSearch 호출 없음)

**수정 vs 문서화 기준**:
- 시리즈 히스토리 + 실제 날짜 둘 다 declared 값과 어긋남 → **값 수정**
- 한쪽만 어긋남 (예: 팬데믹으로 인한 일회성 지연) → **값 유지 + note 에 사유 기록**

## 5. 감사 결과 (2026-04-21)

n=33 (conf × 21 + user × 3 + disc × 9)

### 5.1 ✓ 정합 (22건)

실제 last→upcoming 간격이 declared cycle_years 와 일치.

conf_001(1), conf_003(2), conf_004(2), conf_005(1), conf_006(2), conf_008(1), conf_009(2), conf_010(4), conf_011(1), conf_012(1), conf_013(3), conf_014(3), conf_015(2), conf_018(4), conf_019(2), user_mo04ezfq(2), user_mo347qjj(2), disc_mo51rke0v1(2), disc_mo520jhk7o(2), disc_mo5215jjv5(1), disc_mo5d5wybn7(1), disc_mo5d6axpa3(1)

### 5.2 ⚠ 수정 필요 (1건)

| id | 학회 | declared | 실제 간격 | 근거 | 조치 |
|----|------|----------|----------|------|------|
| **conf_020** | ACRA (Asian Conf on Refrigeration and Air-conditioning) | **3** | 2024-04-21 → 2026-05-17 = **2y** | 시리즈 회차: 11th(2024) → 12th(2026). ACRA 는 창립 이래 biennial. | **`cycle_years: 3 → 2`** + note 보강 |

### 5.3 ⚠ 값 유지 + 주석 보강 (3건)

팬데믹·재조정 등 일회성 이슈로 최근 간격이 declared 값과 다르지만, 시리즈 본래 주기는 declared 가 맞음.

| id | 학회 | declared | 실제 간격 | 사유 |
|----|------|----------|----------|------|
| conf_007 | ICMF | 3 | — | ed_last_007 의 note 에 "Biennial" 로 잘못 기록. 실제는 3y (2019 Rio→2022/2023 Kobe). **note 수정 필요** |
| conf_016 | IHTC | 4 | 2023-08 → 2026-08 = 3y | IHTC-17 팬데믹으로 2022→2023 지연, IHTC-18 조정. 시리즈 본래 4y (2002, 2006, 2010, 2014, 2018, 2022원계획). note 에 "팬데믹 조정" 기록. |
| conf_017 | PRTEC | 3 | 2024-12 → 2027-03 = 2.3y | PRTEC 2016, 2019, 2024(팬데믹으로 2023 skip), 2027. 본래 3y, ed_last_017 note 에 "Series skipped 2023 due to pandemic" 이미 기록됨 → 추가 조치 불요 |

### 5.4 ⚠ 특수 케이스 (1건)

| id | 학회 | declared | 비고 |
|----|------|----------|------|
| conf_002 | ASEAN HVAC EXPO | 0 | `cycle_years: 0` 은 "미상/불규칙" 의미. promptBuilder 의 `주기: ${cycle_years ? ... : '미상'}` 분기가 0도 falsy 처리 → '미상' 으로 표시됨. 의도된 동작. **조치 없음** |

### 5.5 ⚠ 증거 부족 (6건 — 이 감사 범위 밖)

past edition 이 없거나 upcoming 만 있어 실제 간격 확인 불가. declared 값이 시리즈 히스토리와 일치하는지 웹 확인 필요하지만 이 플랜 범위 밖.

conf_021, user_mo342nwc, disc_mo8592i0e0, disc_mo8593oimc, disc_mo859c2sp1, disc_mo859hc6bf

## 6. 단계 (Steps)

- [ ] Step 1 — `public/data/conferences.json` 에서 `conf_020.cycle_years: 3 → 2` 수정 + `note: "ACRA series biennial"` 추가 (한 커밋)
- [ ] Step 2 — `editions[ed_last_007].notes` 의 "Biennial" 오타를 "3-year cycle (ICMF-2013, 2016, 2019, 2022/2023)" 으로 수정 (동일 커밋)
- [ ] Step 3 — `editions[ed_last_016].notes` 에 "IHTC-17 팬데믹으로 2022→2023 지연, 본래 cycle 4y" 추가 (동일 커밋)
- [ ] Step 4 — `bash scripts/verify-task.sh` 통과 확인

## 7. 검증 (Verification)

- [ ] `bash scripts/verify-task.sh` 통과
- [ ] 수정 후 `conf_020.cycle_years === 2` 재확인
- [ ] promptBuilder 에 conf_020 입력 시 "주기: 2년" 출력 확인 (기존 수동 테스트)

## 8. 리스크·롤백

- 리스크: ACRA 13th 발표가 2027이 아닌 2028이면 (3y로 회귀) declared 3 이 다시 맞아질 수 있음. 하지만 현재 관찰된 과거 4회차는 전부 2y 간격 → 2 가 더 타당.
- 롤백: 커밋 revert 로 원복.

## 9. 후속 (Follow-ups)

- §5.5 증거 부족 6건 → 다음 WebSearch 기반 감사 사이클에서 처리
- `cycle_years: 0` 을 "irregular" vs "unknown" 으로 구분하는 데이터 모델 확장 (별도, 필요성 낮음)

## 10. 작업 로그

- 2026-04-21: 감사 작성. 기준선: `public/data/conferences.json` 33건. 수정 1건, 주석 보강 2건, 유지 30건.
