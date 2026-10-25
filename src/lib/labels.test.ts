import { describe, expect, it } from 'vitest';
import { LETTERS, TOP_LABEL, valueLabel } from './labels';
import { TOP_VALUE, WILD } from './rules';

describe('value labels', () => {
  it('# for 0, then A for 1, B for 3, C for 9 ...', () => {
    expect([0, 1, 3, 9, 27, 81, 243].map(valueLabel)).toEqual(['#', 'A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('runs up to Z at 3 to the 25th', () => {
    expect(LETTERS).toHaveLength(26);
    expect(valueLabel(3 ** 24)).toBe('Y');
    expect(valueLabel(TOP_VALUE)).toBe('Z');
    expect(TOP_LABEL).toBe('Z');
    expect(TOP_VALUE).toBe(3 ** 25);
  });

  it('a number that is not a power of 3 would stay a number', () => {
    expect(valueLabel(2)).toBe('2');
  });

  it('the wildcard is a star', () => {
    expect(valueLabel(WILD)).toBe('★');
  });
});
