// PLAN-029: Anthropic API 직접 호출 폐기 — 모든 호출은 Supabase Edge Function 경유.
// 본 파일은 export 호환 유지를 위한 re-export 래퍼다. 실제 구현은 claudeApiServer.js 참조.
export {
  callClaude,
  extractText,
  ClaudeApiError,
  subscribeQuota,
  getLastQuota,
} from './claudeApiServer';
