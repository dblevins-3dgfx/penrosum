// Skins: the progression the game is drawn as. A skin gives each rung of
// the ladder (1 = A ... 26 = Z) a piece to draw, gives rubble (0) a themed
// icon, and brings a palette. The rules never change with the skin, only
// how values are drawn and named. Alphabet is the game's own look.

import { DEFAULT_PALETTE, EVOLUTION_PALETTE, type Palette } from './colors';
import { LETTERS } from './labels';
import { WILD, rungOf, type Drawn } from './rules';

// One step of a skin's ladder: what is drawn, its name (for labels and
// tooltips), and for an emoji a device may lack, an older one to draw
// instead (see resolvePieces).
export interface Piece {
  glyph: string;
  name: string;
  fallback?: string;
}

export interface Skin {
  name: string;
  description: string;
  pieces: Piece[]; // 26, rung 1 to 26
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

const letters: Piece[] = [...LETTERS].map(l => ({ glyph: l, name: l }));

export const SKINS = {
  alphabet: {
    name: 'Alphabet',
    description: 'Letters, A to Z.',
    pieces: letters,
    rubble: { glyph: '#', name: '#' },
    piece: 'letter',
    ladder: 'the alphabet',
    pictures: false,
    palette: DEFAULT_PALETTE,
    page: '#f1f5f9',
  },
  evolution: {
    name: 'Evolution',
    description: 'From a microbe in the sea to a human. Rubble is fossil bones.',
    pieces: [
      { glyph: '🦠', name: 'microbe', fallback: '🔬' },
      { glyph: '🧽', name: 'sponge', fallback: '🐚' },
      { glyph: '🪸', name: 'coral', fallback: '🌊' },
      { glyph: '🪼', name: 'jellyfish', fallback: '🎐' },
      { glyph: '🪱', name: 'worm', fallback: '🐛' },
      { glyph: '🐌', name: 'snail' },
      { glyph: '🦑', name: 'squid', fallback: '🐙' },
      { glyph: '🦀', name: 'crab' },
      { glyph: '🦂', name: 'scorpion' },
      { glyph: '🐟', name: 'fish' },
      { glyph: '🦈', name: 'shark', fallback: '🐬' },
      { glyph: '🐸', name: 'frog' },
      { glyph: '🦎', name: 'lizard', fallback: '🐍' },
      { glyph: '🐢', name: 'turtle' },
      { glyph: '🐊', name: 'crocodile' },
      { glyph: '🦕', name: 'sauropod', fallback: '🐉' },
      { glyph: '🦖', name: 'T. rex', fallback: '🐲' },
      { glyph: '🐦', name: 'bird' },
      { glyph: '🐁', name: 'shrew' },
      { glyph: '🦔', name: 'hedgehog', fallback: '🐀' },
      { glyph: '🐿️', name: 'squirrel' },
      { glyph: '🐒', name: 'monkey' },
      { glyph: '🦧', name: 'orangutan', fallback: '🐵' },
      { glyph: '🦍', name: 'gorilla', fallback: '🙈' },
      { glyph: '🚶', name: 'early human' },
      { glyph: '🧑', name: 'human', fallback: '👤' },
    ],
    rubble: { glyph: '🦴', name: 'bone', fallback: '💀' },
    piece: 'creature',
    ladder: 'evolution',
    pictures: true,
    palette: EVOLUTION_PALETTE,
    page: '#f1f5f9',
  },
} satisfies Record<string, Skin>;

export type SkinId = keyof typeof SKINS;

export const SKIN_IDS = Object.keys(SKINS) as SkinId[];

export const DEFAULT_SKIN: SkinId = 'alphabet';

// The skin with each emoji the device can't draw (`canDraw` false)
// replaced by its fallback. The input is unchanged.
export const resolvePieces = (skin: Skin, canDraw: (glyph: string) => boolean): Skin => {
  const pick = (p: Piece): Piece => (p.fallback && !canDraw(p.glyph) ? { ...p, glyph: p.fallback } : p);
  return { ...skin, pieces: skin.pieces.map(pick), rubble: pick(skin.rubble) };
};

// The words a skin's messages use: how a value is drawn (`label`), what
// a piece is called, and a count of rubble ("a #", "3 #s"; for a picture,
// "a 🦴", "3 🦴").
export interface Terms {
  label: (value: Drawn) => string;
  name: (value: Drawn) => string;
  piece: string;
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
  return {
    label: value => (value === WILD ? '★' : value === 0 ? r : pieceAt(value).glyph),
    name: value => (value === WILD ? 'wildcard' : value === 0 ? skin.rubble.name : pieceAt(value).name),
    piece: skin.piece,
    ladder: skin.ladder,
    rubble: n => (n === 1 ? `a ${r}` : `${n} ${r}${skin.pictures ? '' : 's'}`),
    title: value => {
      if (value === WILD) return 'wildcard';
      const piece = value === 0 ? skin.rubble : pieceAt(value);
      const named = piece.name === piece.glyph ? piece.glyph : `${piece.glyph} ${piece.name}`;
      return value === 0 ? `${named}, rubble` : `${named}, ${Math.min(rungOf(value), skin.pieces.length)} of ${skin.pieces.length}`;
    },
    rubbleCount: n => `${n} ${r}${n === 1 || skin.pictures ? '' : 's'}`,
  };
};

// The game's own words: letters and #
export const ALPHABET_TERMS = termsFor(SKINS.alphabet);
