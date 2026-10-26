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
    expect(DEFAULT_OPTIONS).toEqual({ spare: 'off' });
  });

  it('keeps saved values that are allowed', () => {
    expect(parseOptions(JSON.stringify({ spare: 'on' }))).toEqual({ spare: 'on' });
  });

  it('drops unknown keys and values that are not allowed, such as options of decided questions', () => {
    const saved = { goal: 'target', wild: 'deck', pressure: 'spawn', shapes: 'dealt', score: 'tiles', deal: 'free', spare: 'maybe' };
    expect(parseOptions(JSON.stringify(saved))).toEqual(DEFAULT_OPTIONS);
  });

  it('survives damaged storage', () => {
    expect(parseOptions('{not json')).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions('null')).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions('42')).toEqual(DEFAULT_OPTIONS);
  });
});
