import { describe, expect, it } from 'vitest';
import { type StatusInput, statusLine } from './status';

// The game going on, before the first move, with nothing to report
const input = (more: Partial<StatusInput> = {}): StatusInput => ({
  message: '', moves: 0, dealtShape: 'kite', tapRule: 'place', hint: null,
  result: { over: false }, score: 0, latest: null, ...more,
});

describe('the status line', () => {
  it('before the first move, says how to play, naming the dealt shape', () => {
    expect(statusLine(input())).toBe(
      'Place the Next letter on an empty kite. 3 or more matching tiles merge into the one you placed, a rung higher.',
    );
    expect(statusLine(input({ dealtShape: null }))).toContain('on an empty tile.');
  });

  it('with Tap to preview on, says to tap twice', () => {
    expect(statusLine(input({ tapRule: 'preview' }))).toContain(
      'on an empty kite (on a touch screen, tap once to preview and again to place).',
    );
  });

  it('then says what the last action did, or nothing', () => {
    expect(statusLine(input({ moves: 3, message: 'Merged 3 tiles into B (+6).' }))).toBe('Merged 3 tiles into B (+6).');
    expect(statusLine(input({ moves: 3 }))).toBe('');
    // An action before the first move (keeping the spare) replaces the hint
    expect(statusLine(input({ message: 'A kept as the spare.' }))).toBe('A kept as the spare.');
  });

  it('with a power-up armed, gives its hint instead', () => {
    expect(statusLine(input({ moves: 3, message: 'Merged.', hint: 'Clear: tap a letter.' }))).toBe('Clear: tap a letter.');
  });

  it('at the end, gives the result, over anything else, with the top-10 place', () => {
    const over = input({ moves: 89, score: 229, hint: 'Clear: tap a letter.', message: 'Merged.', result: { over: true, won: false, highest: 27 } });
    expect(statusLine(over)).toBe('Board full. Score: 229 (highest tile D, 89 moves).');
    expect(statusLine({ ...over, latest: { size: 'medium', rank: 3 } }))
      .toBe('Board full. Score: 229 (highest tile D, 89 moves). #3 on the medium board!');
  });

  it('a win says so', () => {
    expect(statusLine(input({ moves: 40, score: 900, result: { over: true, won: true, highest: 3 ** 25 } })))
      .toBe('You made Z, the top of the alphabet, in 40 moves. You win! Score: 900.');
  });
});
