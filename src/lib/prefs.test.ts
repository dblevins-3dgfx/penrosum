import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, parseBoardSize, parsePrefs } from './prefs';

describe('parseBoardSize', () => {
  it('reads a saved size, or falls back to medium', () => {
    expect(parseBoardSize('large')).toBe('large');
    expect(parseBoardSize(null)).toBe('medium');
    expect(parseBoardSize('huge')).toBe('medium');
  });
});

describe('parsePrefs', () => {
  it('uses the defaults when nothing is saved', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS).toEqual({ tap: 'place' });
  });

  it('keeps saved values that are allowed, so a Q15 choice carries over as Tap to preview', () => {
    expect(parsePrefs(JSON.stringify({ tap: 'preview' }))).toEqual({ ...DEFAULT_PREFS, tap: 'preview' });
  });

  it('drops unknown keys and values that are not allowed, such as options of decided questions', () => {
    const saved = { goal: 'target', wild: 'deck', pressure: 'spawn', shapes: 'dealt', score: 'tiles', deal: 'free', spare: 'on', undo: 'charges', tap: 'twice' };
    expect(parsePrefs(JSON.stringify(saved))).toEqual(DEFAULT_PREFS);
  });

  it('survives damaged storage', () => {
    expect(parsePrefs('{not json')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('null')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('42')).toEqual(DEFAULT_PREFS);
  });
});
