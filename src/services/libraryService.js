// PLAN-030: 라이브러리 데이터 접근 계층 (Supabase).
// 온보딩(S4)·/libraries 페이지(S5)·동기화 알림(S7) 이 공유한다.
import { supabase } from './supabaseClient';

/**
 * 가입 시 선택 가능한 라이브러리 = 비가상 라이브러리 (admin 큐레이팅).
 * 가상 "내 학회" 는 가입 시 자동 생성되므로 선택 대상이 아니다.
 * @returns {Promise<Array<{id:string,name:string,description:string|null}>>}
 */
export async function fetchSelectableLibraries() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('libraries')
    .select('id, name, description')
    .eq('is_virtual', false)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * 본인이 구독한 library_id 목록.
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export async function fetchUserLibraryIds(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('user_libraries')
    .select('library_id')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.library_id);
}

/**
 * 선택한 라이브러리들에 구독 INSERT. 이미 구독 중인 항목은 무시.
 * @param {string} userId
 * @param {string[]} libraryIds
 */
export async function subscribeUserToLibraries(userId, libraryIds) {
  if (!supabase || !userId || !libraryIds?.length) return;
  const rows = libraryIds.map((library_id) => ({ user_id: userId, library_id }));
  const { error } = await supabase
    .from('user_libraries')
    .upsert(rows, { onConflict: 'user_id,library_id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

/**
 * 본인이 구독한 라이브러리 + 라이브러리 메타 (/libraries 페이지·동기화 알림용).
 * 가상 "내 학회" 는 user_libraries 에 들어가지 않으므로 결과에 포함되지 않는다.
 * @param {string} userId
 * @returns {Promise<Array<{id,name,description,is_virtual,lifecycle,last_seen_at,subscribed_at}>>}
 */
export async function fetchUserLibraries(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('user_libraries')
    .select('library_id, last_seen_at, subscribed_at, libraries(id, name, description, is_virtual, lifecycle)')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((r) => r.libraries) // 라이브러리가 삭제된 고아 행 방어
    .map((r) => ({
      ...r.libraries,
      last_seen_at: r.last_seen_at,
      subscribed_at: r.subscribed_at,
    }));
}

/**
 * 라이브러리 ↔ 학회 태그 전체 (added_at 포함). 동기화 알림이 last_seen_at 과 비교.
 * @returns {Promise<Array<{library_id:string,conference_id:string,added_at:string}>>}
 */
export async function fetchLibraryConferences() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('library_conferences')
    .select('library_id, conference_id, added_at');
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * 라이브러리 구독 해제.
 * @param {string} userId
 * @param {string} libraryId
 */
export async function unsubscribeFromLibrary(userId, libraryId) {
  if (!supabase || !userId || !libraryId) return;
  const { error } = await supabase
    .from('user_libraries')
    .delete()
    .eq('user_id', userId)
    .eq('library_id', libraryId);
  if (error) throw new Error(error.message);
}

/**
 * 옵트인 동기화 알림 확인 — last_seen_at 을 now() 로 갱신해 알림을 dismiss.
 * @param {string} userId
 * @param {string} libraryId
 */
export async function markLibrarySeen(userId, libraryId) {
  if (!supabase || !userId || !libraryId) return;
  const { error } = await supabase
    .from('user_libraries')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('library_id', libraryId);
  if (error) throw new Error(error.message);
}
