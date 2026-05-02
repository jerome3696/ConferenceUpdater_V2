import { fetchFile, commitFile, ConflictError } from './githubStorage';
import { supabase, supabaseConfigured } from './supabaseClient';
import { mergeAll } from '../utils/mergeConference';

const STORAGE_KEY = 'conferenceFinder.data';
const SHA_KEY = 'conferenceFinder.githubSha';

export { ConflictError };

async function loadFromSupabase() {
  const [confRes, edRes, userRes] = await Promise.all([
    supabase.from('conferences_upstream').select('*'),
    supabase.from('editions_upstream').select('*'),
    supabase.from('user_conferences').select('*'),
  ]);
  if (confRes.error) throw confRes.error;
  if (edRes.error) throw edRes.error;
  // user_conferences 가 비어있어도 정상 — 첫 로그인 사용자는 row 가 없다.
  const userRows = userRes.error ? [] : (userRes.data || []);
  const merged = mergeAll(confRes.data || [], edRes.data || [], userRows);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return { data: merged, sha: null };
}

export async function loadConferences({ token } = {}) {
  // PLAN-029: Supabase 가 설정된 환경이면 server 우선.
  if (supabaseConfigured) {
    try {
      return await loadFromSupabase();
    } catch (e) {
      console.warn('Supabase 로드 실패, 로컬/JSON 폴백:', e);
      // 폴백 흐름으로 진행
    }
  }

  // 관리자(token 있음): GitHub API에서 직접 최신본 가져오기 (legacy)
  if (token) {
    try {
      const { content, sha } = await fetchFile(token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
      localStorage.setItem(SHA_KEY, sha);
      return { data: content, sha };
    } catch (e) {
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

// PLAN-038: user_conferences 부분 갱신 (starred, personal_note, overrides).
// supabaseConfigured 가 false 면 noop — legacy localStorage 경로가 담당.
// 실패 시 에러 throw (호출 측에서 console.warn 후 UX 계속 진행).
export async function upsertUserConference(userId, conferenceId, patch) {
  if (!supabaseConfigured) return;
  const row = {
    user_id: userId,
    conference_id: conferenceId,
    updated_at: new Date().toISOString(),
    ...patch,
  };
  const { error } = await supabase
    .from('user_conferences')
    .upsert(row, { onConflict: 'user_id,conference_id' });
  if (error) throw error;
}

// PLAN-038: user_conferences 행 삭제.
// supabaseConfigured 가 false 면 noop.
export async function deleteUserConference(userId, conferenceId) {
  if (!supabaseConfigured) return;
  const { error } = await supabase
    .from('user_conferences')
    .delete()
    .eq('user_id', userId)
    .eq('conference_id', conferenceId);
  if (error) throw error;
}
