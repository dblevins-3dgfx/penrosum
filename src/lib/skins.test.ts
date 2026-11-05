import { describe, expect, it } from 'vitest';
import { LETTERS } from './labels';
import { WILD } from './rules';
import { ALPHABET_TERMS, DEFAULT_SKIN, SKINS, SKIN_IDS, type Skin, resolvePieces, termsFor } from './skins';
import { DEFAULT_PALETTE } from './colors';

// Every rung's value: A (1), B (3) ... Z (3 to the 25th)
const rungs = Array.from({ length: 26 }, (_, i) => 3 ** i);

describe('skins', () => {
  it('offers Alphabet, the default, and Evolution', () => {
    expect(SKIN_IDS).toEqual(['alphabet', 'evolution']);
    expect(DEFAULT_SKIN).toBe('alphabet');
  });

  it('Alphabet is the game\'s own look: letters A to Z, # rubble and the default palette', () => {
    const { pieces, rubble, palette, pictures } = SKINS.alphabet;
    expect(pieces.map(p => p.glyph).join('')).toBe(LETTERS);
    expect(rubble.glyph).toBe('#');
    expect(palette).toBe(DEFAULT_PALETTE);
    expect(pictures).toBe(false);
  });

  it('Evolution climbs from a microbe to a human, with fossil bones for rubble', () => {
    const { pieces, rubble, pictures } = SKINS.evolution;
    expect(pieces[0]).toMatchObject({ glyph: '🦠', name: 'microbe' });
    expect(pieces[10]).toMatchObject({ glyph: '🦈', name: 'shark' });
    expect(pieces[25]).toMatchObject({ glyph: '🧑', name: 'human' });
    expect(rubble).toMatchObject({ glyph: '🦴', name: 'bone' });
    expect(pictures).toBe(true);
  });

  for (const id of SKIN_IDS) {
    const skin: Skin = SKINS[id];
    it(`${skin.name}: has a name, a description, and 26 distinct named pieces`, () => {
      expect(skin.name).not.toBe('');
      expect(skin.description).not.toBe('');
      expect(skin.piece).not.toBe('');
      expect(skin.ladder).not.toBe('');
      expect(skin.pieces).toHaveLength(26);
      expect(new Set(skin.pieces.map(p => p.glyph)).size).toBe(26);
      expect(new Set(skin.pieces.map(p => p.name)).size).toBe(26);
      for (const p of skin.pieces) expect(p.name).not.toBe('');
    });

    it(`${skin.name}: has a rubble icon unlike any piece, and fallbacks unlike any other piece`, () => {
      const glyphs = skin.pieces.map(p => p.glyph);
      expect(skin.rubble.glyph).not.toBe('');
      expect(glyphs).not.toContain(skin.rubble.glyph);
      const fallbacks = [...skin.pieces, skin.rubble].flatMap(p => (p.fallback ? [p.fallback] : []));
      expect(new Set(fallbacks).size).toBe(fallbacks.length);
      for (const f of fallbacks) expect([...glyphs, skin.rubble.glyph]).not.toContain(f);
    });
  }
});

describe('resolvePieces', () => {
  it('swaps each emoji the device can\'t draw for its fallback, and keeps the rest', () => {
    const missing = new Set(['🪼', '🦴']);
    const skin = resolvePieces(SKINS.evolution, g => !missing.has(g));
    expect(skin.pieces[3]).toMatchObject({ glyph: '🎐', name: 'jellyfish' });
    expect(skin.rubble).toMatchObject({ glyph: '💀', name: 'bone' });
    expect(skin.pieces[0].glyph).toBe('🦠');
    // The skin itself is unchanged
    expect(SKINS.evolution.pieces[3].glyph).toBe('🪼');
  });

  it('keeps a missing emoji that has no fallback', () => {
    const skin = resolvePieces(SKINS.evolution, () => false);
    expect(skin.pieces[5].glyph).toBe('🐌');
  });
});

describe('termsFor', () => {
  const evo = termsFor(SKINS.evolution);

  it('Alphabet: values as letters, # rubble, the ★, and "letter"', () => {
    expect(rungs.map(v => ALPHABET_TERMS.label(v)).join('')).toBe(LETTERS);
    expect(ALPHABET_TERMS.label(0)).toBe('#');
    expect(ALPHABET_TERMS.label(WILD)).toBe('★');
    expect(ALPHABET_TERMS.piece).toBe('letter');
    expect(ALPHABET_TERMS.ladder).toBe('the alphabet');
  });

  it('a value that isn\'t a power of 3 takes its rung\'s piece', () => {
    expect(ALPHABET_TERMS.label(4)).toBe('B');
    expect(evo.label(4)).toBe('🧽');
  });

  it('Evolution: values as its pictures, 🦴 rubble, and "creature"', () => {
    expect(evo.label(1)).toBe('🦠');
    expect(evo.label(3 ** 25)).toBe('🧑');
    expect(evo.label(0)).toBe('🦴');
    expect(evo.name(3 ** 10)).toBe('shark');
    expect(evo.piece).toBe('creature');
  });

  it('names a piece and its rung for a tooltip', () => {
    expect(evo.title(3 ** 10)).toBe('🦈 shark, 11 of 26');
    expect(ALPHABET_TERMS.title(3 ** 10)).toBe('K, 11 of 26');
    expect(evo.title(0)).toBe('🦴 bone, rubble');
    expect(ALPHABET_TERMS.title(0)).toBe('#, rubble');
    expect(evo.title(WILD)).toBe('wildcard');
  });

  it('counts rubble: "a #", "3 #s"; a picture takes no s', () => {
    expect(ALPHABET_TERMS.rubble(1)).toBe('a #');
    expect(ALPHABET_TERMS.rubble(3)).toBe('3 #s');
    expect(ALPHABET_TERMS.rubbleCount(1)).toBe('1 #');
    expect(ALPHABET_TERMS.rubbleCount(2)).toBe('2 #s');
    expect(evo.rubble(1)).toBe('a 🦴');
    expect(evo.rubble(3)).toBe('3 🦴');
    expect(evo.rubbleCount(2)).toBe('2 🦴');
  });
});
