// PLAN-028 §4.5 비용 계산 공식 (Anthropic pricing 2026-04)
// Sonnet 4: input $3/M, output $15/M, cache-read ~10% of input
// web_search: $0.01/call (approx)

export const PRICING = {
  INPUT_PER_M: 3.0,
  OUTPUT_PER_M: 15.0,
  CACHE_READ_RATIO: 0.1, // 10% of input price
  WEB_SEARCH_PER_CALL: 0.01,
};

export interface UsageBreakdown {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  web_searches: number;
}

export function computeCostUsd(u: UsageBreakdown): number {
  const billable_input = Math.max(u.input_tokens - u.cache_read_input_tokens, 0);
  const input_usd = (billable_input * PRICING.INPUT_PER_M) / 1_000_000;
  const cache_usd = (u.cache_read_input_tokens * PRICING.INPUT_PER_M * PRICING.CACHE_READ_RATIO) / 1_000_000;
  const output_usd = (u.output_tokens * PRICING.OUTPUT_PER_M) / 1_000_000;
  const search_usd = u.web_searches * PRICING.WEB_SEARCH_PER_CALL;
  return round6(input_usd + cache_usd + output_usd + search_usd);
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
