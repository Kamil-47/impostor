import { describe, it, expect } from 'vitest';
import { shuffle } from './shuffle.js';

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffle(arr)).toHaveLength(5);
  });

  it('contains the same elements', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffle(arr).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3, 4, 5];
    shuffle(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles empty array', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('handles single element', () => {
    expect(shuffle([42])).toEqual([42]);
  });

  it('produces different orderings (statistical)', () => {
    const arr = [0, 1, 2, 3, 4];
    const positionCounts: number[][] = arr.map(() => arr.map(() => 0));

    const runs = 1000;
    for (let i = 0; i < runs; i++) {
      const result = shuffle(arr);
      for (let pos = 0; pos < result.length; pos++) {
        positionCounts[result[pos]][pos]++;
      }
    }

    const expected = runs / arr.length;
    for (let val = 0; val < arr.length; val++) {
      for (let pos = 0; pos < arr.length; pos++) {
        expect(positionCounts[val][pos]).toBeGreaterThan(expected * 0.5);
        expect(positionCounts[val][pos]).toBeLessThan(expected * 1.5);
      }
    }
  });
});
