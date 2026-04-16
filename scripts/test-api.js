// API 키·크레딧 상태 최소 테스트. web_search 없는 한 호출만.
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY 없음. $env:ANTHROPIC_API_KEY 설정 확인.');
  process.exit(1);
}

const body = JSON.stringify({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 10,
  messages: [{ role: 'user', content: 'hi' }],
});

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body,
});

console.log('status:', res.status);
console.log('x-ratelimit-input-tokens-remaining:', res.headers.get('anthropic-ratelimit-input-tokens-remaining'));
console.log('retry-after:', res.headers.get('retry-after'));
console.log('---');
console.log(await res.text());
