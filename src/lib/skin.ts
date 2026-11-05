// What a skin is: the progression the game is drawn as. A skin gives each
// rung of the ladder (1 = A ... 26 = Z) a piece to draw, gives rubble (0)
// a themed icon, and brings a palette. The rules never change with the
// skin, only how values are drawn and named. This file knows no skin in
// particular: each skin is a file of its own in src/lib/skins/, found
// there by the registry (src/lib/skins/index.ts).

import type { Palette } from './colors';
import { LETTERS } from './labels';
import { EMPTY, WILD, rungOf, type Cell, type Drawn } from './rules';

// One step of a skin's ladder: what is drawn, its name (for labels and
// tooltips), and for an emoji a device may lack, an older one to draw
// instead (see resolvePieces).
export interface Piece {
  glyph: string;
  name: string;
  fallback?: string;
}

// How long a skin's ladder may be. The top is 3 to the (length - 1), and
// values stay exact as plain numbers up to 3 to the 33rd, so 34 rungs.
export const MIN_RUNGS = 10;
export const MAX_RUNGS = 34;

export interface Skin {
  id: string; // what the preference saves; the file's name
  name: string;
  description: string;
  // The ladder, bottom rung up: MIN_RUNGS to MAX_RUNGS pieces. The last is
  // the top, which wins the game.
  pieces: Piece[];
  rubble: Piece; // what a 0 (rubble, a seeded or dealt obstacle) is drawn as
  // What a piece is called in the status line and hints ("tap a letter")
  piece: string;
  // What the whole ladder is called ("You made Z, the top of the alphabet")
  ladder: string;
  // Whether the pieces are pictures (emoji), drawn in their own colors,
  // rather than text drawn in the palette's letter colors
  pictures: boolean;
  palette: Palette;
  page: string; // the page's background, also the browser's theme color
}

// The skin with each emoji the device can't draw (`canDraw` false)
// replaced by its fallback. The input is unchanged.
export const resolvePieces = (skin: Skin, canDraw: (glyph: string) => boolean): Skin => {
  const pick = (p: Piece): Piece => (p.fallback && !canDraw(p.glyph) ? { ...p, glyph: p.fallback } : p);
  return { ...skin, pieces: skin.pieces.map(pick), rubble: pick(skin.rubble) };
};

// The words a skin's messages use: how a value is drawn (`label`), what
// a piece is called, and a count of rubble ("a #", "3 #s"; for an icon,
// "a 🦴", "3 🦴").
//
// A rubble icon written in plain keyboard characters (#) takes an s for
// more than one; a picture or symbol (🦴, e⁺) doesn't. A single one is
// "a #", or "an e⁺" for one that sounds like a vowel.
export const rubblePlural = (glyph: string) => (/^[\x21-\x7e]+$/.test(glyph) ? 's' : '');

// Whether a skin's pieces are the letters A to Z themselves (and its
// rubble #), so the rules, told in letters, need no key to read it
export const isAlphabet = (skin: Skin) =>
  skin.rubble.glyph === '#' && skin.pieces.length === LETTERS.length && skin.pieces.every((p, i) => p.glyph === LETTERS[i]);

// "a letter", "an element"
export const withArticle = (word: string) => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;

export interface Terms {
  label: (value: Drawn) => string;
  name: (value: Drawn) => string;
  piece: string;
  aPiece: string; // with its article: "a letter", "an element"
  ladder: string;
  rubble: (n: number) => string;
  // A piece's tooltip: its picture and name, and its rung ("🦈 shark, 11
  // of 26"; a letter is its own name: "K, 11 of 26")
  title: (value: Drawn) => string;
  // A count of rubble with its number ("1 #", "3 #s"; "1 🦴", "3 🦴")
  rubbleCount: (n: number) => string;
}

export const termsFor = (skin: Skin): Terms => {
  const pieceAt = (value: number) => skin.pieces[Math.min(rungOf(value), skin.pieces.length) - 1];
  const r = skin.rubble.glyph;
  const s = rubblePlural(r);
  return {
    label: value => (value === WILD ? '★' : value === 0 ? r : pieceAt(value).glyph),
    name: value => (value === WILD ? 'wildcard' : value === 0 ? skin.rubble.name : pieceAt(value).name),
    piece: skin.piece,
    aPiece: withArticle(skin.piece),
    ladder: skin.ladder,
    rubble: n => (n === 1 ? withArticle(r) : `${n} ${r}${s}`),
    title: value => {
      if (value === WILD) return 'wildcard';
      const piece = value === 0 ? skin.rubble : pieceAt(value);
      const named = piece.name === piece.glyph ? piece.glyph : `${piece.glyph} ${piece.name}`;
      return value === 0 ? `${named}, rubble` : `${named}, ${Math.min(rungOf(value), skin.pieces.length)} of ${skin.pieces.length}`;
    },
    rubbleCount: n => `${n} ${r}${n === 1 ? '' : s}`,
  };
};

// The tooltip for a board tile holding `value`: its piece's name and rung
// ("🦈 shark, 11 of 26"; "e⁺ positron, rubble"), as the Next and Spare
// chips show. None for an empty tile, nor in a skin of plain letters,
// where the letter says it all.
export const tileTip = (skin: Skin, terms: Terms, value: Cell): string | null =>
  value === EMPTY || isAlphabet(skin) ? null : terms.title(value);

// The value at the top of a skin's ladder (3 to the length - 1): making it
// wins. Z, 3 to the 25th, for Alphabet's 26.
export const topValue = (skin: Skin) => 3 ** (skin.pieces.length - 1);

// Whether a game can switch to `skin` now, with `highest` its highest tile:
// only when the skin's top is above it, so a switch never hands over a win
// or leaves tiles past the top. A skin it has outgrown waits for the next
// game.
export const skinAllowed = (skin: Skin, highest: number) => topValue(skin) > highest;

// A value as a piece and its name: "🦍 gorilla", "He helium", or for a
// letter, the letter: "K"
export const pieceName = (terms: Terms, value: Drawn) => {
  const glyph = terms.label(value);
  const name = terms.name(value);
  return name === glyph ? glyph : `${glyph} ${name}`;
};

