import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE } from '../colors';
import { LETTERS } from '../labels';
import { termsFor } from '../skin';
import alphabet from './alphabet';

describe('Alphabet', () => {
  const terms = termsFor(alphabet);

  it('is the game\'s own look: letters A to Z, # rubble and the default palette', () => {
    expect(alphabet.pieces.map(p => p.glyph).join('')).toBe(LETTERS);
    expect(alphabet.rubble.glyph).toBe('#');
    expect(alphabet.palette).toBe(DEFAULT_PALETTE);
    expect(alphabet.pictures).toBe(false);
  });

  it('speaks of letters and the alphabet', () => {
    expect(terms.piece).toBe('letter');
    expect(terms.ladder).toBe('the alphabet');
    expect(terms.title(3 ** 10)).toBe('K, 11 of 26');
  });
});
