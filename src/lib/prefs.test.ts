import { describe, expect, it } from 'vitest';
import { parseBoardSize, parseOptions } from './prefs';
import { DEFAULT_OPTIONS } from './rules';

describe('parseOptions', () => {
  it('uses the defaults when nothing is saved', () => {
    expect(parseOptions(null)).toEqual(DEFAULT_OPTIONS);
  });

  it('keeps saved values that are allowed', () => {
    const saved = { goal: 'target', target: 100, wild: 'deck', pressure: 'spawn', shapes: 'dealt', merge: 'step' };
    expect(parseOptions(JSON.stringify(saved))).toEqual(saved);
  });

  it('fills in options saved before they existed', () => {
    expect(parseOptions(JSON.stringify({ wild: 'deck' }))).toEqual({ ...DEFAULT_OPTIONS, wild: 'deck' });
  });

  it('drops unknown keys and values that are not allowed', () => {
    const saved = { group: 'neighbors', values: 'choose', zeros: 'none', target: 37, cascade: true, shape: 'same', wild: 'deck' };
    expect(parseOptions(JSON.stringify(saved))).toEqual({ ...DEFAULT_OPTIONS, wild: 'deck' });
  });

  it('survives damaged storage', () => {
    expect(parseOptions('{not json')).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions('null')).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions('42')).toEqual(DEFAULT_OPTIONS);
  });
});

describe('parseBoardSize', () => {
  it('reads a saved size, or falls back to medium', () => {
    expect(parseBoardSize('large')).toBe('large');
    expect(parseBoardSize(null)).toBe('medium');
    expect(parseBoardSize('huge')).toBe('medium');
  });
});
