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
