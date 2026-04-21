---
version: vN
status: dormant
parent: v{N-1}
default_mode: general
precise_diverged: false
today_reference: YYYY-MM-DD
---

## 1. 정밀/일반 구분 기준

<언제 precise·언제 general 로 분기하는지 한 단락. 현재는 updateLogic.shouldSearch 요약.>

## 2. System Prompt (공통)

````text
<UPDATE_SYSTEM_VN 원문>
````

## 3. User Prompt — General

````text
<buildUpdateUserVN 템플릿 렌더 결과>
````

## 4. User Prompt — Precise

<precise_diverged: false 이면 "General 과 동일, 차별화 보류" 한 줄.
 precise_diverged: true 이면 General 대비 diff.>
