import { describe, expect, it } from 'vitest';
import { parseBoardSize, parseOptions } from './prefs';
import { DEFAULT_OPTIONS } from './rules';

describe('parseOptions', () => {
  it('uses the defaults when nothing is saved', () => {
    expect(parseOptions(null)).toEqual(DEFAULT_OPTIONS);
  });

  it('keeps saved values that are allowed', () => {
    const saved = { group: 'neighbors', clear: 'zero', values: 'random', goal: 'target', target: 100, shape: 'same', zeros: 'deck' };
    expect(parseOptions(JSON.stringify(saved))).toEqual(saved);
  });

  it('fills in options saved before they existed', () => {
    expect(parseOptions(JSON.stringify({ group: 'neighbors' }))).toEqual({ ...DEFAULT_OPTIONS, group: 'neighbors' });
  });

  it('drops unknown keys and values that are not allowed', () => {
    const saved = { group: 'diagonal', target: 37, cascade: true, shape: 'same' };
    expect(parseOptions(JSON.stringify(saved))).toEqual({ ...DEFAULT_OPTIONS, shape: 'same' });
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
