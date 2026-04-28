import { describe, expect, it } from 'vitest';
import { combine, once, reorder } from '../src';

describe('utilities', () => {
  it('runs combined cleanups once', () => {
    const calls: string[] = [];
    const cleanup = combine(
      () => calls.push('first'),
      () => calls.push('second'),
    );

    cleanup();
    cleanup();

    expect(calls).toEqual(['first', 'second']);
  });

  it('memoizes a function with once', () => {
    let count = 0;
    const fn = once((value: string) => {
      count++;
      return value.toUpperCase();
    });

    expect(fn('a')).toBe('A');
    expect(fn('b')).toBe('A');
    expect(count).toBe(1);
  });

  it('reorders without mutating the original list', () => {
    const list = ['a', 'b', 'c'];

    expect(reorder({ list, startIndex: 0, finishIndex: 2 })).toEqual(['b', 'c', 'a']);
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('rejects invalid reorder indexes', () => {
    expect(() => reorder({ list: ['a'], startIndex: -1, finishIndex: 0 })).toThrow(RangeError);
    expect(() => reorder({ list: ['a'], startIndex: 0, finishIndex: 1 })).toThrow(RangeError);
  });
});
