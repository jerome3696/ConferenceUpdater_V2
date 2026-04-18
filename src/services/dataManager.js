import { fetchFile, commitFile, ConflictError } from './githubStorage';

const STORAGE_KEY = 'conferenceFinder.data';
const SHA_KEY = 'conferenceFinder.githubSha';

export { ConflictError };

export async function loadConferences({ token } = {}) {
  // 관리자(token 있음): GitHub API에서 직접 최신본 가져오기
  if (token) {
    try {
      const { content, sha } = await fetchFile(token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
      localStorage.setItem(SHA_KEY, sha);
      return { data: content, sha };
    } catch (e) {
      // GitHub 실패 시 localStorage fallback
      console.warn('GitHub fetch 실패, 로컬 캐시로 대체:', e);
    }
  }

  // 열람자 또는 fallback: localStorage 또는 공개 JSON
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      return { data: JSON.parse(cached), sha: localStorage.getItem(SHA_KEY) };
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  const url = `${import.meta.env.BASE_URL}data/conferences.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
  return { data: json, sha: null };
}

export function saveConferencesLocal(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function commitToGitHub(token, data, sha) {
  const count = data.conferences?.length ?? 0;
  const message = `Update conferences.json via webapp (${count} conferences)`;
  const newSha = await commitFile(token, data, sha, message);
  if (newSha) localStorage.setItem(SHA_KEY, newSha);
  return newSha;
}

export function getCachedSha() {
  return localStorage.getItem(SHA_KEY);
}

export function resetToSeed() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SHA_KEY);
}

export function generateConferenceId() {
  return `user_${Date.now().toString(36)}`;
}

// PLAN-011-C: discovery 출신 학회는 별도 prefix 로 구분 (감사·디버그용).
// 동시 호출 충돌 회피용 작은 random suffix 추가.
export function generateDiscoveryConferenceId() {
  const rand = Math.floor(Math.random() * 1296).toString(36).padStart(2, '0');
  return `disc_${Date.now().toString(36)}${rand}`;
}
