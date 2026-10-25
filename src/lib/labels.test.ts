import { describe, expect, it } from 'vitest';
import { LETTERS, TOP_LABEL, ceilPow3, targetLabel, usesLetters, valueLabel } from './labels';
import { DEFAULT_OPTIONS, TOP_VALUE, WILD, type Options } from './rules';

const opts = (o: Partial<Options> = {}): Options => ({ ...DEFAULT_OPTIONS, ...o });
const cap = opts({ merge: 'cap' });
const step = opts({ merge: 'step' });

describe('value labels', () => {
  it('sum: plain numbers', () => {
    expect(usesLetters(opts())).toBe(false);
    expect([0, 1, 2, 3, 4, 27].map(v => valueLabel(v, opts()))).toEqual(['0', '1', '2', '3', '4', '27']);
  });

  it('power-of-3 rules: # for 0, then A for 1, B for 3, C for 9 ...', () => {
    for (const rule of [cap, step]) {
      expect(usesLetters(rule)).toBe(true);
      expect([0, 1, 3, 9, 27, 81, 243].map(v => valueLabel(v, rule))).toEqual(['#', 'A', 'B', 'C', 'D', 'E', 'F']);
    }
  });

  it('runs up to Z at 3 to the 25th', () => {
    expect(LETTERS).toHaveLength(26);
    expect(valueLabel(3 ** 24, step)).toBe('Y');
    expect(valueLabel(TOP_VALUE, step)).toBe('Z');
    expect(TOP_LABEL).toBe('Z');
    expect(TOP_VALUE).toBe(3 ** 25);
  });

  it('a number that is not a power of 3 stays a number', () => {
    expect(valueLabel(2, step)).toBe('2');
    expect(valueLabel(6, cap)).toBe('6');
  });

  it('the wildcard is a star under every rule', () => {
    expect(valueLabel(WILD, opts())).toBe('★');
    expect(valueLabel(WILD, step)).toBe('★');
  });

  it('a target is written as the first rung that reaches it', () => {
    expect([1, 2, 3, 20, 50, 100, 200].map(ceilPow3)).toEqual([1, 3, 3, 27, 81, 243, 243]);
    expect(targetLabel(20, step)).toBe('D');
    expect(targetLabel(50, cap)).toBe('E');
    expect(targetLabel(20, opts())).toBe('20');
  });
});
