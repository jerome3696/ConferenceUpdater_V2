import { useCallback, useEffect, useRef, useState } from 'react';
import { callClaude, extractText, ClaudeApiError } from '../services/claudeApi';
import { buildUpdatePrompt, buildVerifyPrompt } from '../utils/promptBuilder';
import { parseUpdateResponse, parseVerifyResponse } from '../services/responseParser';
import { MODELS } from '../config/models';

// 세션 내 메모리로만 유지. 새로고침하면 리셋됨.
//
// 상태 흐름:
//   queue    → 아직 API 호출 전인 대기열
//   searching → 현재 호출 중인 1건 (로딩 UI용)
//   pending  → 검색 완료되어 사용자 승인 대기 중인 카드들 (배열)
//   log      → 최종 처리 완료 (accepted/rejected/error)
//
// 각 item 에는 kind ('update' | 'verify') 가 있으며, 루프가 kind 별로
// 프롬프트/파서/모델/적용 함수를 분기한다.
//
// 검색은 큐가 빌 때까지 계속 진행된다.
// 사용자는 pending에 쌓인 카드를 언제든 자유롭게 accept/reject 할 수 있다.

let seq = 0;
const nextId = () => `q_${Date.now().toString(36)}_${++seq}`;

// kind별 호출/파싱 설정. 새로운 kind 추가 시 여기만 확장.
function getHandlers(kind) {
  if (kind === 'verify') {
    return {
      buildPrompt: (row) => buildVerifyPrompt(row),
      parse: parseVerifyResponse,
      model: MODELS.verify,
    };
  }
  return {
    buildPrompt: (row) => buildUpdatePrompt(row, row.last || null),
    parse: parseUpdateResponse,
    model: MODELS.update,
  };
}

export function useUpdateQueue({ apiKey, applyAiUpdate, applyVerifyUpdate }) {
  const [queue, setQueue] = useState([]);
  const [searching, setSearching] = useState(null);
  const [pending, setPending] = useState([]);
  const [log, setLog] = useState([]);
  const [rateLimitUntil, setRateLimitUntil] = useState(null); // epoch ms

  const busyRef = useRef(false);
  const abortRef = useRef(null);
  const rateLimitTimerRef = useRef(null);

  const enqueue = useCallback((rows, kind = 'update') => {
    const items = rows.map((r) => ({ id: nextId(), kind, conferenceId: r.id, row: r }));
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
        const { buildPrompt, parse, model } = getHandlers(item.kind);
        const { system, user } = buildPrompt(item.row);
        const res = await callClaude({
          apiKey,
          prompt: user,
          system,
          model,
          webSearch: true,
          maxTokens: item.kind === 'verify' ? 1536 : 1024,
          signal: controller.signal,
        });
        let text = extractText(res);
        let parsed = parse(text);
        let retry = null;

        // PLAN-005: update에서 start_date 미추출이면 Sonnet 4.6 + web_fetch로 1회 재시도.
        // Haiku web_search가 홈페이지 평문 날짜를 놓치는 케이스(ICCFD 등) 대응.
        if (
          item.kind === 'update' &&
          parsed.ok &&
          !parsed.data?.start_date &&
          MODELS.updateFallback
        ) {
          try {
            const res2 = await callClaude({
              apiKey,
              prompt: user,
              system,
              model: MODELS.updateFallback,
              webSearch: true,
              webFetch: true,
              maxTokens: 2048,
              signal: controller.signal,
            });
            const text2 = extractText(res2);
            const parsed2 = parse(text2);
            if (parsed2.ok) {
              text = text2;
              parsed = parsed2;
              retry = 'sonnet';
            } else {
              retry = 'sonnet_parse_fail';
            }
          } catch (retryErr) {
            if (retryErr?.name === 'AbortError') throw retryErr;
            // 재시도 실패는 치명적이지 않음 — 1차 결과 유지
            retry = `sonnet_error:${retryErr?.kind || 'unknown'}`;
          }
        }

        if (!parsed.ok) {
          card = { ...item, status: 'error', error: `응답 파싱 실패 (${parsed.reason})`, raw: parsed.raw, retry };
        } else {
          card = { ...item, status: 'ready', result: parsed.data, raw: text, retry };
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

  // PLAN-013-A: opts.anchor=true 면 수용 후 anchor 마크 (update kind 만 의미 있음).
  const accept = useCallback((cardId, { anchor = false } = {}) => {
    const card = pending.find((c) => c.id === cardId);
    if (!card || card.status !== 'ready') return;
    if (card.kind === 'verify') {
      applyVerifyUpdate?.(card.conferenceId, card.result);
    } else {
      applyAiUpdate(card.conferenceId, card.result, { anchor });
    }
    pushLog({
      id: card.id,
      kind: card.kind,
      conferenceId: card.conferenceId,
      abbrev: card.row.abbreviation,
      fullName: card.row.full_name,
      action: anchor ? 'accepted_anchored' : 'accepted',
      result: card.result,
    });
    setPending((p) => p.filter((c) => c.id !== cardId));
  }, [pending, applyAiUpdate, applyVerifyUpdate, pushLog]);

  const reject = useCallback((cardId) => {
    const card = pending.find((c) => c.id === cardId);
    if (!card) return;
    pushLog({
      id: card.id,
      kind: card.kind,
      conferenceId: card.conferenceId,
      abbrev: card.row.abbreviation,
      fullName: card.row.full_name,
      action: card.status === 'error' ? 'error' : 'rejected',
      result: card.result,
      error: card.error,
    });
    setPending((p) => p.filter((c) => c.id !== cardId));
  }, [pending, pushLog]);

  // 승인 대기 카드 일괄 수용. status='ready' + result 있는 카드만 적용.
  // error 카드는 건너뛰고 그대로 둠 (사용자가 개별 닫기).
  const acceptAll = useCallback(() => {
    setPending((p) => {
      const remain = [];
      for (const card of p) {
        if (card.status !== 'ready' || !card.result) {
          remain.push(card);
          continue;
        }
        if (card.kind === 'verify') {
          applyVerifyUpdate?.(card.conferenceId, card.result);
        } else {
          applyAiUpdate(card.conferenceId, card.result);
        }
        pushLog({
          id: card.id,
          kind: card.kind,
          conferenceId: card.conferenceId,
          abbrev: card.row.abbreviation,
          fullName: card.row.full_name,
          action: 'accepted',
          result: card.result,
        });
      }
      return remain;
    });
  }, [applyAiUpdate, applyVerifyUpdate, pushLog]);

  // 승인 대기 카드 일괄 거절. ready·error 모두 정리.
  const rejectAll = useCallback(() => {
    setPending((p) => {
      for (const card of p) {
        pushLog({
          id: card.id,
          kind: card.kind,
          conferenceId: card.conferenceId,
          abbrev: card.row.abbreviation,
          fullName: card.row.full_name,
          action: card.status === 'error' ? 'error' : 'rejected',
          result: card.result,
          error: card.error,
        });
      }
      return [];
    });
  }, [pushLog]);

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
    acceptAll,
    rejectAll,
    stopAll,
  };
}
