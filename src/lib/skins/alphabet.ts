// Alphabet: the game's own look. Letters A to Z, # for rubble, and the
// default palette. The default skin.

import { DEFAULT_PALETTE } from '../colors';
import { LETTERS } from '../labels';
import type { Skin } from '../skin';

export default {
  id: 'alphabet',
  name: 'Alphabet',
  description: 'Letters, A to Z.',
  pieces: [...LETTERS].map(l => ({ glyph: l, name: l })),
  rubble: { glyph: '#', name: '#' },
  piece: 'letter',
  ladder: 'the alphabet',
  pictures: false,
  palette: DEFAULT_PALETTE,
  page: '#f1f5f9',
} satisfies Skin;
