import { describe, expect, it } from 'vitest';
import { parseBoardSize } from './prefs';

describe('parseBoardSize', () => {
  it('reads a saved size, or falls back to medium', () => {
    expect(parseBoardSize('large')).toBe('large');
    expect(parseBoardSize(null)).toBe('medium');
    expect(parseBoardSize('huge')).toBe('medium');
  });
});
