// eval-loop.js — decideStop · mergeFailIds · parseLoopArgs 단위 테스트.

import { describe, it, expect } from 'vitest';
import { decideStop, mergeFailIds, parseLoopArgs } from './eval-loop.js';

describe('decideStop', () => {
  it('success: pass 비율 달성 + partial+fail ≤ 1', () => {
    const r = decideStop({
      previous: null,
      current: { pass: 9, partial: 0, fail_or_error: 1, total: 10, fail_ids: ['x'] },
      threshold: 0.9,
      maxIter: 3,
      iter: 1,
      minIter: 2,
    });
    expect(r).toBe('success');
  });

  it('success: partial+fail 2 이상이면 아직 success 아님', () => {
    const r = decideStop({
      previous: null,
      current: { pass: 8, partial: 1, fail_or_error: 1, total: 10, fail_ids: ['a', 'b'] },
      threshold: 0.8,
      maxIter: 3,
      iter: 1,
      minIter: 2,
    });
    expect(r).toBeNull();
  });

  it('plateau: 직전과 pass 수 동일 + fail_ids 집합 동일', () => {
    const prev = { pass: 7, partial: 2, fail_or_error: 1, total: 10, fail_ids: ['a', 'b', 'c'] };
    const cur = { pass: 7, partial: 2, fail_or_error: 1, total: 10, fail_ids: ['c', 'b', 'a'] };
    const r = decideStop({
      previous: prev, current: cur, threshold: 0.9, maxIter: 3, iter: 2, minIter: 2,
    });
    expect(r).toBe('plateau');
  });

  it('plateau: 직전과 fail_ids 다르면 plateau 아님', () => {
    const prev = { pass: 7, partial: 2, fail_or_error: 1, total: 10, fail_ids: ['a', 'b', 'c'] };
    const cur = { pass: 7, partial: 2, fail_or_error: 1, total: 10, fail_ids: ['a', 'b', 'd'] };
    const r = decideStop({
      previous: prev, current: cur, threshold: 0.9, maxIter: 3, iter: 2, minIter: 2,
    });
    expect(r).toBeNull();
  });

  it('plateau: minIter 미만 iteration 에서는 체크 안함', () => {
    const prev = { pass: 7, partial: 2, fail_or_error: 1, total: 10, fail_ids: ['a'] };
    const cur = { pass: 7, partial: 2, fail_or_error: 1, total: 10, fail_ids: ['a'] };
    const r = decideStop({
      previous: prev, current: cur, threshold: 0.9, maxIter: 5, iter: 1, minIter: 2,
    });
    expect(r).toBeNull();
  });

  it('max_iter: 도달 시 반환', () => {
    const r = decideStop({
      previous: null,
      current: { pass: 5, partial: 3, fail_or_error: 2, total: 10, fail_ids: ['a', 'b', 'c', 'd', 'e'] },
      threshold: 0.9,
      maxIter: 3,
      iter: 3,
      minIter: 2,
    });
    expect(r).toBe('max_iter');
  });

  it('null: 아무 조건도 안 맞으면 계속', () => {
    const r = decideStop({
      previous: { pass: 5, fail_ids: ['a'] },
      current: { pass: 6, partial: 2, fail_or_error: 2, total: 10, fail_ids: ['b', 'c', 'd', 'e'] },
      threshold: 0.9,
      maxIter: 3,
      iter: 2,
      minIter: 2,
    });
    expect(r).toBeNull();
  });
});

describe('mergeFailIds', () => {
  it('한 번이라도 pass 한 id 는 제외', () => {
    const iters = [
      { pass_ids: ['a'], fail_ids: ['b', 'c'] },
      { pass_ids: ['b'], fail_ids: ['a', 'c'] },
    ];
    expect(mergeFailIds(iters)).toEqual(['c']);
  });

  it('모든 iter 에서 fail 인 id 만 남김', () => {
    const iters = [
      { pass_ids: ['a', 'b'], fail_ids: ['c', 'd'] },
      { pass_ids: ['a'], fail_ids: ['b', 'c', 'd'] },
      { pass_ids: ['a', 'b', 'c'], fail_ids: ['d'] },
    ];
    expect(mergeFailIds(iters)).toEqual(['d']);
  });

  it('iter 0 이면 빈 배열', () => {
    expect(mergeFailIds([])).toEqual([]);
  });

  it('fail_ids 없는 iter 도 안전', () => {
    const iters = [{ pass_ids: ['a'] }];
    expect(mergeFailIds(iters)).toEqual([]);
  });
});

describe('parseLoopArgs', () => {
  it('기본값', () => {
    const a = parseLoopArgs(['node', 'script']);
    expect(a.version).toBe('v7');
    expect(a.maxIter).toBe(3);
    expect(a.threshold).toBe(0.9);
    expect(a.minIter).toBe(2);
  });

  it('플래그 파싱', () => {
    const a = parseLoopArgs(['node', 'script', '--version', 'v8', '--max-iter', '5', '--threshold', '0.8', '--case', 'conf_007', '--weights', 'link=0.5']);
    expect(a.version).toBe('v8');
    expect(a.maxIter).toBe(5);
    expect(a.threshold).toBe(0.8);
    expect(a.case).toBe('conf_007');
    expect(a.weights).toBe('link=0.5');
  });
});
