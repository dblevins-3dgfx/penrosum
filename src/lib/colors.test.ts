import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILL, OFF_SHAPE_FILL, RUNG_FILLS, WILD_COLORS, ZERO_FILL, colorsFor, fillFor, textFor,
} from './colors';
import { EMPTY, TOP_VALUE, WILD } from './rules';

// The WCAG contrast ratio between two #rrggbb colors
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Every rung's value: A (1), B (3) ... Z (3 to the 25th)
const rungs = Array.from({ length: 26 }, (_, i) => 3 ** i);

describe('tile colors', () => {
  it('gives every letter, A to Z, its own fill', () => {
    expect(RUNG_FILLS).toHaveLength(26);
    expect(new Set(rungs.map(fillFor)).size).toBe(26);
    expect(rungs[25]).toBe(TOP_VALUE);
  });

  it('starts A to E as before: pale yellow, yellow, then on through the wheel', () => {
    expect([1, 3, 9].map(fillFor)).toEqual(['#fef3c7', '#fcd34d', '#fb923c']);
  });

  it('makes Z gold', () => {
    expect(fillFor(TOP_VALUE)).toBe('#eab308');
  });

  it('gives # its own slate, darker than the empty tiles of the other shape', () => {
    expect(fillFor(0)).toBe(ZERO_FILL);
    expect(rungs.map(fillFor)).not.toContain(ZERO_FILL);
    expect(luminance(ZERO_FILL)).toBeLessThan(luminance(OFF_SHAPE_FILL) - 0.2);
  });

  it('writes #, A to J and Z in near-black, K to Y in white', () => {
    const dark = textFor(1);
    for (let i = 0; i < 26; i++) {
      expect(textFor(rungs[i])).toBe(i >= 10 && i < 25 ? '#ffffff' : dark);
    }
    expect(textFor(0)).toBe(dark);
  });

  it('keeps every letter readable: contrast of at least 4.5 to 1 on its tile', () => {
    for (const v of [0, ...rungs]) expect(contrast(fillFor(v), textFor(v))).toBeGreaterThanOrEqual(4.5);
  });

  it('a value that is not a power of 3 takes its rung\'s color', () => {
    expect(fillFor(4)).toBe(fillFor(3));
    expect(fillFor(26)).toBe(fillFor(9));
  });

  it('a drawn value looks the same as that letter on the board', () => {
    for (const v of [0, 1, 3, 9, 27]) expect(colorsFor(v)).toEqual({ fill: fillFor(v), text: textFor(v) });
  });

  it('the wildcard has a look of its own, unlike any letter', () => {
    expect(colorsFor(WILD)).toEqual(WILD_COLORS);
    expect(WILD_COLORS.fill).toMatch(/gradient/);
  });

  it('an empty tile is white', () => {
    expect(colorsFor(EMPTY).fill).toBe(EMPTY_FILL);
  });
});
