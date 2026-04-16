// Claude 모델 설정. 업데이트/검증별로 개별 지정 가능.
// 비용 참고 (입력 1M 토큰 기준, 2025-04):
//   - sonnet-4:  $3  / 출력 $15
//   - haiku-4-5: $1  / 출력 $5
// 2026-04-16부터 eval 러너도 MODELS.update를 import해 앱과 동일 모델로 측정. 모델 바꾸면 재평가 필요.

export const MODELS = {
  update: 'claude-haiku-4-5-20251001',
  verify: 'claude-sonnet-4-20250514',
};
