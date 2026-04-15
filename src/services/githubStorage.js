import { REPO } from '../config/repoConfig';

const API_BASE = 'https://api.github.com';

export class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
  }
}

// UTF-8 문자열을 base64로 안전하게 변환
function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

function endpoint() {
  return `${API_BASE}/repos/${REPO.owner}/${REPO.repo}/contents/${REPO.path}`;
}

function authHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export async function fetchFile(token) {
  const url = `${endpoint()}?ref=${encodeURIComponent(REPO.branch)}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    throw new Error(`GitHub fetch 실패 (${res.status}): ${await res.text()}`);
  }
  const body = await res.json();
  // content는 base64 + 줄바꿈 포함
  const raw = base64ToUtf8((body.content || '').replace(/\n/g, ''));
  const parsed = JSON.parse(raw);
  return { content: parsed, sha: body.sha };
}

export async function commitFile(token, data, sha, message) {
  const json = JSON.stringify(data, null, 2);
  const payload = {
    message,
    content: utf8ToBase64(json),
    branch: REPO.branch,
  };
  if (sha) payload.sha = sha;

  const res = await fetch(endpoint(), {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 409 || res.status === 422) {
    throw new ConflictError(`sha 불일치 (${res.status}) — 서버에 더 최신 버전이 있습니다.`);
  }
  if (!res.ok) {
    throw new Error(`GitHub commit 실패 (${res.status}): ${await res.text()}`);
  }
  const body = await res.json();
  return body.content?.sha || null;
}
