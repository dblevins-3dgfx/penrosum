// The tests every skin must pass. They run over every skin the registry
// finds, so a new skin's file is checked here with nothing to add.

import { describe, expect, it } from 'vitest';
import { contrast, fillFor, textFor } from '../colors';
import { MAX_RUNGS, MIN_RUNGS, termsFor, topValue } from '../skin';
import { DEFAULT_SKIN, SKINS, SKIN_IDS, skinById } from '.';

// Every rung's value on a ladder of `n`: 1, 3, 9 ... 3 to the (n - 1)
const rungsOf = (n: number) => Array.from({ length: n }, (_, i) => 3 ** i);

describe('the skins on offer', () => {
  it('finds each skin\'s file, with Alphabet, the default, first', () => {
    expect(SKIN_IDS).toContain('alphabet');
    expect(SKIN_IDS).toContain('evolution');
    expect(SKIN_IDS[0]).toBe(DEFAULT_SKIN);
    expect(DEFAULT_SKIN).toBe('alphabet');
    expect(new Set(SKIN_IDS).size).toBe(SKIN_IDS.length);
    expect(new Set(SKINS.map(s => s.name)).size).toBe(SKINS.length);
  });

  it('lists the rest by name', () => {
    const names = SKINS.slice(1).map(s => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('finds a skin by its id, or gives the default for one that doesn\'t exist', () => {
    expect(skinById('evolution').id).toBe('evolution');
    expect(skinById('night').id).toBe(DEFAULT_SKIN);
  });
});

for (const skin of SKINS) {
  const { name, palette, pictures } = skin;
  const n = skin.pieces.length;
  const rungs = rungsOf(n);

  describe(`${name} (every skin)`, () => {
    it(`has a name, a description, its words, and ${MIN_RUNGS} to ${MAX_RUNGS} distinct named pieces`, () => {
      expect(name).not.toBe('');
      expect(skin.description).not.toBe('');
      expect(skin.piece).not.toBe('');
      expect(skin.ladder).not.toBe('');
      expect(n).toBeGreaterThanOrEqual(MIN_RUNGS);
      expect(n).toBeLessThanOrEqual(MAX_RUNGS);
      expect(new Set(skin.pieces.map(p => p.glyph)).size).toBe(n);
      expect(new Set(skin.pieces.map(p => p.name)).size).toBe(n);
      for (const p of skin.pieces) expect(p.name).not.toBe('');
    });

    it('has a rubble icon unlike any piece, and fallbacks unlike any other piece', () => {
      const glyphs = skin.pieces.map(p => p.glyph);
      expect(skin.rubble.glyph).not.toBe('');
      expect(skin.rubble.name).not.toBe('');
      expect(glyphs).not.toContain(skin.rubble.glyph);
      const fallbacks = [...skin.pieces, skin.rubble].flatMap(p => (p.fallback ? [p.fallback] : []));
      expect(new Set(fallbacks).size).toBe(fallbacks.length);
      for (const f of fallbacks) expect([...glyphs, skin.rubble.glyph]).not.toContain(f);
    });

    it('names its top piece in the win message', () => {
      expect(termsFor(skin).label(topValue(skin))).toBe(skin.pieces[n - 1].glyph);
      // and its value stays exact
      expect(Number.isSafeInteger(topValue(skin))).toBe(true);
    });

    it('gives every rung its own fill, and # one of its own', () => {
      expect(palette.rungFills).toHaveLength(n);
      expect(palette.rungTexts).toHaveLength(n);
      const fills = rungs.map(v => fillFor(v, palette));
      expect(new Set(fills).size).toBe(n);
      for (const other of [palette.zeroFill, palette.emptyFill, palette.offShapeFill]) expect(fills).not.toContain(other);
      expect(new Set([palette.zeroFill, palette.emptyFill, palette.offShapeFill]).size).toBe(3);
    });

    // Pictures draw in their own colors, so only a text skin's letters
    // need contrast with their tiles; the preview's text is always drawn
    // in the palette
    it(`keeps ${pictures ? 'the preview' : 'every letter, #, and the preview'} readable: contrast of at least 4.5 to 1`, () => {
      if (!pictures) {
        for (const v of [0, ...rungs]) expect(contrast(fillFor(v, palette), textFor(v, palette))).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(palette.previewText, palette.previewTint)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette.previewText, palette.previewTintMerging)).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps the four outlines on the board apart', () => {
      const { previewOutline, doomedOutline, pickedOutline, lastMoveOutline } = palette;
      expect(new Set([previewOutline, doomedOutline, pickedOutline, lastMoveOutline]).size).toBe(4);
    });
  });
}
