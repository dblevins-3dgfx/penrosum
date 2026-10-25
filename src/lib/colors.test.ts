import { describe, expect, it } from 'vitest';
import { EMPTY_FILL, WILD_COLORS, colorsFor, fillFor, textFor } from './colors';
import { EMPTY, WILD } from './rules';

describe('tile colors', () => {
  it('gives each dealt number its own fill', () => {
    const fills = [0, 1, 2, 3].map(fillFor);
    expect(new Set(fills).size).toBe(4);
  });

  it('steps through the bands as numbers grow', () => {
    expect(fillFor(4)).toBe(fillFor(3));
    expect(fillFor(5)).not.toBe(fillFor(4));
    expect(fillFor(9)).toBe(fillFor(12));
    expect(fillFor(100)).not.toBe(fillFor(101));
    expect(fillFor(729)).toBe(fillFor(101));
  });

  it('writes a 0 in gray and other numbers in near-black', () => {
    expect(textFor(0)).not.toBe(textFor(1));
    expect(textFor(1)).toBe(textFor(27));
  });

  it('a drawn value looks the same as that number on the board', () => {
    for (const v of [0, 1, 2, 3]) expect(colorsFor(v)).toEqual({ fill: fillFor(v), text: textFor(v) });
  });

  it('the wildcard has a look of its own, unlike any number', () => {
    expect(colorsFor(WILD)).toEqual(WILD_COLORS);
    expect(WILD_COLORS.fill).toMatch(/gradient/);
  });

  it('an empty tile is white', () => {
    expect(colorsFor(EMPTY).fill).toBe(EMPTY_FILL);
  });
});
