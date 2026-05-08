import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCandidateReview } from './useDiscoveryState';

// PLAN-039: useCandidateReview.handleAbsorb 동작 검증.
// candidate._match 가 있을 때 absorb 흐름 + onAbsorb prop 호출 + acceptedIds 마킹.

const PLAIN = { full_name: 'Plain Conference', predatory_score: 'low' };
const MATCHED = {
  full_name: 'Matched Conference',
  predatory_score: 'low',
  _match: { id: 'conf_existing_42', full_name: 'Existing Matched Conference', abbreviation: 'EMC' },
};

describe('useCandidateReview.handleAccept (회귀)', () => {
  it('onAccept 호출 후 acceptedIds 에 추가', () => {
    const onAccept = vi.fn().mockReturnValue('disc_new_001');
    const onAbsorb = vi.fn();
    const { result } = renderHook(() =>
      useCandidateReview({ candidates: [PLAIN, MATCHED], onAccept, onAbsorb })
    );
    act(() => result.current.handleAccept(0));
    expect(onAccept).toHaveBeenCalledWith(PLAIN);
    expect(onAbsorb).not.toHaveBeenCalled();
    expect(result.current.acceptedIds.has(0)).toBe(true);
  });

  it('onAccept 가 falsy 반환하면 acceptedIds 에 추가하지 않음', () => {
    const onAccept = vi.fn().mockReturnValue(null);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() =>
      useCandidateReview({ candidates: [PLAIN], onAccept })
    );
    act(() => result.current.handleAccept(0));
    expect(result.current.acceptedIds.has(0)).toBe(false);
    alertSpy.mockRestore();
  });
});

describe('useCandidateReview.handleAbsorb (PLAN-039)', () => {
  it('_match 있는 후보에서 onAbsorb(matchedId) 호출 + acceptedIds 마킹', () => {
    const onAccept = vi.fn();
    const onAbsorb = vi.fn();
    const { result } = renderHook(() =>
      useCandidateReview({ candidates: [PLAIN, MATCHED], onAccept, onAbsorb })
    );
    act(() => result.current.handleAbsorb(1));
    expect(onAbsorb).toHaveBeenCalledWith('conf_existing_42');
    expect(onAccept).not.toHaveBeenCalled();
    expect(result.current.acceptedIds.has(1)).toBe(true);
  });

  it('_match 없는 후보에서 handleAbsorb 호출은 noop (onAbsorb 미호출)', () => {
    const onAccept = vi.fn();
    const onAbsorb = vi.fn();
    const { result } = renderHook(() =>
      useCandidateReview({ candidates: [PLAIN], onAccept, onAbsorb })
    );
    act(() => result.current.handleAbsorb(0));
    expect(onAbsorb).not.toHaveBeenCalled();
    expect(result.current.acceptedIds.has(0)).toBe(false);
  });

  it('onAbsorb prop 미연결 시 silent warn (acceptedIds 변경 없음)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() =>
      useCandidateReview({ candidates: [MATCHED], onAccept: vi.fn() })
    );
    act(() => result.current.handleAbsorb(0));
    expect(result.current.acceptedIds.has(0)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('reset 호출 후 acceptedIds 비워짐', () => {
    const onAccept = vi.fn();
    const onAbsorb = vi.fn();
    const { result } = renderHook(() =>
      useCandidateReview({ candidates: [MATCHED], onAccept, onAbsorb })
    );
    act(() => result.current.handleAbsorb(0));
    expect(result.current.acceptedIds.size).toBe(1);
    act(() => result.current.reset());
    expect(result.current.acceptedIds.size).toBe(0);
  });
});
