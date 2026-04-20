---
name: prompt-designer
description: 프롬프트 개선 루프의 분석-설계 의례. 최근 run 결과를 §6 패턴·§4 레버에 연결하고 다음 버전 초안을 제시. 본문만 출력, 파일 쓰지 말 것.
---

# prompt-designer

ConferenceFinder 프롬프트 개선 루프의 **분석-설계 단계 체크리스트**. 메인 에이전트가 이 Skill 을 호출하면 아래 6섹션 포맷으로 본문만 출력한다.

## 인자

- `<version>` — 단일 버전 분석. 예: `v7`
- `<version_from> vs <version_to>` — 비교 분석. 예: `v6 vs v7`

## 입력 (암묵 참조)

- `docs/prompts/<version>.md` — System/General/Precise 원본
- `docs/eval/runs/*/run.json` — 최근 3개 (`ls -t | head -3`)
- `docs/eval/results/*.json` — 최근 5개 (참고용, runs/ 가 없을 때 fallback)
- `docs/prompteng.md` §4 (레버 카탈로그 A-J) · §6 (패턴 카탈로그 P1-P10)
- `public/data/conferences.json` — `cycle_years` 조인 (golden-set 에 이미 스냅샷 되어있음)

## 출력 규약 — **본문만, 파일 쓰지 말 것**

실제 `v{N+1}.md` 생성은 사용자가 "OK, 생성해"라고 명시 승인한 뒤 **다음 턴에서만** 수행. 이 Skill 호출 턴에서는 분석 결과만 화면 출력.

### 섹션 포맷 (고정 순서, 각 섹션 ~200자 지향)

```markdown
## 1. 최근 run 요약

- run_id · version · stopped_by · iterations
- pass / partial / fail_or_error (총 N)
- persistent_failures: [conf_xxx, ...] — 모든 iteration 에서 한 번도 pass 하지 못한 id

## 2. 실패 패턴 매핑

각 persistent_failure 를 `docs/prompteng.md` §6 의 `P1~P10` 코드와 연결. 없으면 **신규 패턴 후보** 이름 부여 (예: `P11. ...`).

- conf_xxx → P{N} (한 줄 증거)
- conf_yyy → 신규 P11 후보 · 이유

## 3. cycle_years 편향 분석

`run.json.by_cycle_years_total` 에서 버킷별 pass rate 계산. 편향 있으면 가설 제시.

- 1y: M/N (xx%)
- 2y: M/N
- 4y: M/N
- 관찰: "4y 버킷이 유난히 낮다 → past 회차 오염 가능성" 등

## 4. 제안 레버

`docs/prompteng.md` §4 레버 카탈로그에서 1~2개 선정. 신규 레버면 **알파벳 다음 글자** (현재 J 까지 → K·L…) 부여하고 §4 에 추가 제안.

- **레버 X** (이름) — 어떤 패턴을 겨냥하는지 · 예상 효과 · 부작용
- 선택 이유: 현 persistent_failures 중 N건을 커버

## 5. v{N+1} 초안

`v{N}` 대비 **diff 형태**. System·General·Precise 각각.

### System (변경 있는 블록만)
```diff
- <기존 줄>
+ <신규 줄>
```

### User — General
```diff
- <기존>
+ <신규>
```

### User — Precise
- 현재 `precise_diverged: false` 면 유지 사유 1줄
- `true` 로 전환 시: 분기 근거 + General 대비 구체 차이

## 6. 위험·열린 질문

- 회귀 위험: 어떤 pass 케이스가 다시 실패할 수 있는지
- 토큰 영향: +N% / -N% 예상
- 열린 질문: 데이터 부족으로 결정 보류한 항목 (예: "precise 분기를 여기서 시작할지 v9 로 미룰지")
```

## 실행 체크리스트 (호출 시 메인 에이전트 내부 루틴)

1. `ls -t docs/eval/runs/ | head -3` → 최근 run 경로 확보
2. 최신 `run.json` 읽어 iterations · persistent_failures · by_cycle_years_total 확인
3. `docs/prompts/<version>.md` 읽어 현재 프롬프트 파악
4. `docs/prompteng.md` §6 grep 으로 P1-P10 요약 리스트 확보
5. persistent_failures 각각의 `results` 엔트리 (aiData / rawText) 열어 증거 확보
6. 6섹션 포맷대로 본문 생성. **Write/Edit 금지** — 화면 출력만.

## 금지 사항

- **파일 생성·수정 금지**. 분석 출력은 메시지 본문으로만.
- **골든셋 `verified_at` 갱신 금지** — 사용자가 XLSX 에서 직접 편집.
- **`docs/prompts/*.md` 신규 작성 금지** — 사용자 승인 후 다음 턴에서 별도 수행.

## 승인 후 후속 턴

사용자가 "OK, v{N+1} 생성해" 라고 명시하면 다음 턴에서:
1. `src/utils/promptBuilder.js` 에 `v{N+1}` 버전 추가 (이전 버전 불변)
2. `docs/prompts/v{N+1}.md` 생성 (동기화 테스트 대상)
3. `docs/prompteng.md` §3 버전 인덱스 · §5 실행 로그 · §4 레버 "실측" 갱신
4. `bash scripts/verify-task.sh` 통과 확인
