import { describe, expect, it } from 'vitest';
import { LETTERS } from './labels';
import { EMPTY, WILD } from './rules';
import { type Skin, isAlphabet, resolvePieces, rubblePlural, termsFor, tileTip, withArticle } from './skin';
import { DEFAULT_PALETTE } from './colors';

// Two skins made up for the tests: one of text, one of pictures
const letters: Skin = {
  id: 'letters', name: 'Letters', description: 'Test letters.',
  pieces: [...LETTERS].map(l => ({ glyph: l, name: l })), rubble: { glyph: '#', name: '#' },
  piece: 'letter', ladder: 'the alphabet', pictures: false, palette: DEFAULT_PALETTE, page: '#ffffff',
};
const pictures: Skin = {
  ...letters, id: 'pictures', name: 'Pictures', pictures: true, piece: 'thing', ladder: 'things',
  pieces: [...LETTERS].map((l, i) => ({ glyph: `<${l}>`, name: `thing ${i + 1}`, fallback: i === 3 ? `[${l}]` : undefined })),
  rubble: { glyph: '🦴', name: 'bone', fallback: '💀' },
};

// Every rung's value: A (1), B (3) ... Z (3 to the 25th)
const rungs = Array.from({ length: 26 }, (_, i) => 3 ** i);

describe('resolvePieces', () => {
  it('swaps each emoji the device can\'t draw for its fallback, and keeps the rest', () => {
    const missing = new Set(['<D>', '🦴']);
    const skin = resolvePieces(pictures, g => !missing.has(g));
    expect(skin.pieces[3]).toMatchObject({ glyph: '[D]', name: 'thing 4' });
    expect(skin.rubble).toMatchObject({ glyph: '💀', name: 'bone' });
    expect(skin.pieces[0].glyph).toBe('<A>');
    // The skin itself is unchanged
    expect(pictures.pieces[3].glyph).toBe('<D>');
  });

  it('keeps a missing emoji that has no fallback', () => {
    expect(resolvePieces(pictures, () => false).pieces[5].glyph).toBe('<F>');
  });
});

describe('termsFor', () => {
  const text = termsFor(letters);
  const pics = termsFor(pictures);

  it('draws each value as its rung\'s piece, rubble as its icon, and the wildcard as ★', () => {
    expect(rungs.map(v => text.label(v)).join('')).toBe(LETTERS);
    expect(text.label(0)).toBe('#');
    expect(text.label(WILD)).toBe('★');
    expect(pics.label(1)).toBe('<A>');
    expect(pics.label(0)).toBe('🦴');
    expect(pics.name(3 ** 2)).toBe('thing 3');
    expect(pics.name(WILD)).toBe('wildcard');
  });

  it('a value that isn\'t a power of 3 takes its rung\'s piece', () => {
    expect(text.label(4)).toBe('B');
    expect(pics.label(4)).toBe('<B>');
  });

  it('names a piece and its rung for a tooltip; a letter is its own name', () => {
    expect(pics.title(3 ** 10)).toBe('<K> thing 11, 11 of 26');
    expect(text.title(3 ** 10)).toBe('K, 11 of 26');
    expect(pics.title(0)).toBe('🦴 bone, rubble');
    expect(text.title(0)).toBe('#, rubble');
    expect(pics.title(WILD)).toBe('wildcard');
  });

  it('counts rubble: "a #", "3 #s"; a picture takes no s', () => {
    expect(text.rubble(1)).toBe('a #');
    expect(text.rubble(3)).toBe('3 #s');
    expect(text.rubbleCount(1)).toBe('1 #');
    expect(text.rubbleCount(2)).toBe('2 #s');
    expect(pics.rubble(1)).toBe('a 🦴');
    expect(pics.rubble(3)).toBe('3 🦴');
    expect(pics.rubbleCount(2)).toBe('2 🦴');
  });

  it('a symbol for rubble takes no s, even in a text skin, and "an" when it sounds like one', () => {
    expect(termsFor({ ...letters, rubble: { glyph: 'e⁺', name: 'positron' } }).rubble(1)).toBe('an e⁺');
    expect(termsFor({ ...letters, rubble: { glyph: 'e⁺', name: 'positron' } }).rubble(2)).toBe('2 e⁺');
    const symbols = termsFor({ ...letters, rubble: { glyph: '☄️', name: 'comet' } });
    expect(symbols.rubble(3)).toBe('3 ☄️');
    expect(symbols.rubbleCount(2)).toBe('2 ☄️');
  });

  it('passes on what a piece and the ladder are called, with its article', () => {
    expect(text.aPiece).toBe('a letter');
    expect(termsFor({ ...letters, piece: 'element' }).aPiece).toBe('an element');
    expect(pics.piece).toBe('thing');
    expect(pics.ladder).toBe('things');
  });
});

describe('rubblePlural and withArticle', () => {
  it('gives a keyboard rubble icon an s, and a picture or symbol none', () => {
    expect(rubblePlural('#')).toBe('s');
    expect(rubblePlural('🦴')).toBe('');
    expect(rubblePlural('☄️')).toBe('');
  });

  it('puts "a" or "an" before a word', () => {
    expect(withArticle('letter')).toBe('a letter');
    expect(withArticle('element')).toBe('an element');
    expect(withArticle('creature')).toBe('a creature');
  });
});

describe('isAlphabet', () => {
  it('is true only for pieces that are the letters themselves, with # rubble', () => {
    expect(isAlphabet(letters)).toBe(true);
    expect(isAlphabet(pictures)).toBe(false);
    expect(isAlphabet({ ...letters, rubble: { glyph: '☄️', name: 'comet' } })).toBe(false);
  });
});

describe('tileTip', () => {
  it('names a board tile\'s piece and rung, or its rubble, in a skin that isn\'t plain letters', () => {
    const terms = termsFor(pictures);
    expect(tileTip(pictures, terms, 3 ** 10)).toBe('<K> thing 11, 11 of 26');
    expect(tileTip(pictures, terms, 0)).toBe('🦴 bone, rubble');
  });

  it('gives none for an empty tile, nor in a skin of plain letters', () => {
    expect(tileTip(pictures, termsFor(pictures), EMPTY)).toBeNull();
    expect(tileTip(letters, termsFor(letters), 3 ** 10)).toBeNull();
    expect(tileTip(letters, termsFor(letters), 0)).toBeNull();
  });
});

