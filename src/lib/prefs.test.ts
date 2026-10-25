import { describe, expect, it } from 'vitest';
import { parseBoardSize, parseOptions } from './prefs';
import { DEFAULT_OPTIONS } from './rules';

describe('parseBoardSize', () => {
  it('reads a saved size, or falls back to medium', () => {
    expect(parseBoardSize('large')).toBe('large');
    expect(parseBoardSize(null)).toBe('medium');
    expect(parseBoardSize('huge')).toBe('medium');
  });
});

describe('parseOptions', () => {
  it('uses the defaults when nothing is saved', () => {
    expect(parseOptions(null)).toEqual(DEFAULT_OPTIONS);
  });

  it('keeps saved values that are allowed', () => {
    expect(parseOptions(JSON.stringify({ deal: 'free' }))).toEqual({ deal: 'free' });
    expect(parseOptions(JSON.stringify({ deal: 'blend' }))).toEqual({ deal: 'blend' });
  });

  it('drops unknown keys and values that are not allowed, such as options of decided questions', () => {
    const saved = { goal: 'target', target: 243, wild: 'deck', pressure: 'spawn', shapes: 'dealt', score: 'tiles', chain: 'off', deal: 'sometimes' };
    expect(parseOptions(JSON.stringify(saved))).toEqual(DEFAULT_OPTIONS);
  });

  it('survives damaged storage', () => {
    expect(parseOptions('{not json')).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions('null')).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions('42')).toEqual(DEFAULT_OPTIONS);
  });
});
