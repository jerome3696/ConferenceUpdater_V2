import { useCallback, useEffect, useRef, useState } from 'react';
import { callClaude, extractText, ClaudeApiError } from '../services/claudeApi';
import { buildUpdatePrompt } from '../utils/promptBuilder';
import { parseUpdateResponse } from '../services/responseParser';
import { MODELS } from '../config/models';

// 세션 내 메모리로만 유지. 새로고침하면 리셋됨.
//
// 상태 흐름:
//   queue    → 아직 API 호출 전인 대기열
//   searching → 현재 호출 중인 1건 (로딩 UI용)
//   pending  → 검색 완료되어 사용자 승인 대기 중인 카드들 (배열)
//   log      → 최종 처리 완료 (accepted/rejected/error)
//
// 검색은 큐가 빌 때까지 계속 진행된다.
// 사용자는 pending에 쌓인 카드를 언제든 자유롭게 accept/reject 할 수 있다.

let seq = 0;
const nextId = () => `q_${Date.now().toString(36)}_${++seq}`;

export function useUpdateQueue({ apiKey, applyAiUpdate }) {
  const [queue, setQueue] = useState([]);
  const [searching, setSearching] = useState(null);
  const [pending, setPending] = useState([]);
  const [log, setLog] = useState([]);
  const [rateLimitUntil, setRateLimitUntil] = useState(null); // epoch ms

  const busyRef = useRef(false);
  const abortRef = useRef(null);
  const rateLimitTimerRef = useRef(null);

  const enqueue = useCallback((rows) => {
    const items = rows.map((r) => ({ id: nextId(), conferenceId: r.id, row: r }));
    setQueue((q) => [...q, ...items]);
  }, []);

  const pushLog = useCallback((entry) => {
    setLog((l) => [{ ...entry, at: new Date().toISOString() }, ...l]);
  }, []);

  // 검색 루프: queue가 비어있지 않고 현재 호출 중이 아니면 다음 항목 처리.
  useEffect(() => {
    if (searching || busyRef.current) return;
    if (rateLimitUntil) return; // rate limit 대기 중에는 루프 멈춤
    if (queue.length === 0) return;

    const item = queue[0];
    setQueue((q) => q.slice(1));
    setSearching(item);
    busyRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      let card;
      try {
        if (!apiKey) {
          throw new ClaudeApiError('API 키가 필요합니다. 우상단에서 입력해주세요.', { kind: 'auth' });
        }
        const { system, user } = buildUpdatePrompt(item.row, item.row.last || null);
        const res = await callClaude({
          apiKey,
          prompt: user,
          system,
          model: MODELS.update,
          webSearch: true,
          maxTokens: 2048,
          signal: controller.signal,
        });
        const text = extractText(res);
        const parsed = parseUpdateResponse(text);
        if (!parsed.ok) {
          card = { ...item, status: 'error', error: `응답 파싱 실패 (${parsed.reason})`, raw: parsed.raw };
        } else {
          card = { ...item, status: 'ready', result: parsed.data, raw: text };
        }
      } catch (err) {
        if (err?.name === 'AbortError') {
          // 중단된 항목은 버림 (로그에도 안 남김)
          card = null;
        } else if (err instanceof ClaudeApiError && err.kind === 'rate_limit') {
          // rate limit: 카드 띄우지 않고 항목을 큐 앞에 되돌린 뒤 대기.
          const waitMs = Number.isFinite(err.retryAfterMs) ? err.retryAfterMs : 60000;
          const until = Date.now() + waitMs;
          setQueue((q) => [item, ...q]);
          setRateLimitUntil(until);
          if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
          rateLimitTimerRef.current = setTimeout(() => {
            rateLimitTimerRef.current = null;
            setRateLimitUntil(null);
          }, waitMs);
          card = null;
        } else {
          card = { ...item, status: 'error', error: err.message || String(err) };
        }
      } finally {
        busyRef.current = false;
        abortRef.current = null;
        if (card) setPending((p) => [...p, card]);
        setSearching(null);
      }
    })();
  }, [queue, searching, apiKey, rateLimitUntil]);

  const accept = useCallback((cardId) => {
    const card = pending.find((c) => c.id === cardId);
    if (!card || card.status !== 'ready') return;
    applyAiUpdate(card.conferenceId, card.result);
    pushLog({
      id: card.id,
      conferenceId: card.conferenceId,
      abbrev: card.row.abbreviation,
      fullName: card.row.full_name,
      action: 'accepted',
      result: card.result,
    });
    setPending((p) => p.filter((c) => c.id !== cardId));
  }, [pending, applyAiUpdate, pushLog]);

  const reject = useCallback((cardId) => {
    const card = pending.find((c) => c.id === cardId);
    if (!card) return;
    pushLog({
      id: card.id,
      conferenceId: card.conferenceId,
      abbrev: card.row.abbreviation,
      fullName: card.row.full_name,
      action: card.status === 'error' ? 'error' : 'rejected',
      result: card.result,
      error: card.error,
    });
    setPending((p) => p.filter((c) => c.id !== cardId));
  }, [pending, pushLog]);

  // 검색 전체 중단: 대기 큐 비우기 + 현재 호출 abort.
  // pending(승인 대기)은 유지 — 이미 찾아둔 결과이므로.
  const stopAll = useCallback(() => {
    setQueue([]);
    if (abortRef.current) abortRef.current.abort();
    if (rateLimitTimerRef.current) {
      clearTimeout(rateLimitTimerRef.current);
      rateLimitTimerRef.current = null;
    }
    setRateLimitUntil(null);
  }, []);

  const searchingCount = searching ? 1 : 0;
  return {
    queue,
    searching,
    pending,
    log,
    rateLimitUntil,
    queuedCount: queue.length,
    pendingCount: pending.length,
    searchingCount,
    totalRemaining: queue.length + searchingCount + pending.length,
    enqueue,
    accept,
    reject,
    stopAll,
  };
}
