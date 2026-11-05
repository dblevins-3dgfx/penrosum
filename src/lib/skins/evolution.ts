// Evolution: from a microbe in the sea to a human, with fossil bones for
// rubble. A picture skin: its pieces are emoji, each newer one with an
// older one to fall back to.

import { DEFAULT_PALETTE, type Palette } from '../colors';
import type { Skin } from '../skin';

// The ladder, 18 rungs from a microbe in the sea to a human: one or two
// steps for each great leap (into shells, onto land, the reptiles and
// dinosaurs, flight, mammals, apes, us). Each piece with the fill behind
// it: the pieces are pictures, so the fills are their backgrounds, running
// from the sea (pale aqua to ocean blue) through the shore and the swamp
// (teals and greens) and the age of reptiles (earth tones) to warm fur,
// with gold for the human.
const LADDER: [glyph: string, name: string, fill: string, fallback?: string][] = [
  ['🦠', 'microbe', '#d8f3ef', '🔬'],
  ['🪼', 'jellyfish', '#a9e1e4', '🎐'],
  ['🪱', 'worm', '#7fc4e2', '🐛'],
  ['🦑', 'squid', '#5ea2d3', '🐙'],
  ['🦀', 'crab', '#4f93c9'],
  ['🐟', 'fish', '#4f9e8c'],
  ['🦈', 'shark', '#458f7c', '🐬'],
  ['🐸', 'frog', '#8fca7a'],
  ['🦎', 'lizard', '#a5cf6f', '🐍'],
  ['🐊', 'crocodile', '#9fae5d'],
  ['🦕', 'sauropod', '#c6b86b', '🐉'],
  ['🦖', 'T. rex', '#c9a25d', '🐲'],
  ['🐦', 'bird', '#d9b77d'],
  ['🐁', 'shrew', '#e2c3a0'],
  ['🐒', 'monkey', '#c98a5f'],
  ['🦍', 'gorilla', '#a98a7a', '🙈'],
  ['🚶', 'early human', '#e8c7ad'],
  ['🧑', 'human', '#eab308', '👤'],
];
const RUNG_FILLS = LADDER.map(r => r[2]);

const palette: Palette = {
  ...DEFAULT_PALETTE,
  rungFills: RUNG_FILLS,
  rungTexts: RUNG_FILLS.map(() => '#1e293b'),
  // Bones lie on warm stone
  zeroFill: '#b3a896',
  wild: {
    fill: 'linear-gradient(135deg, #7fc4e2, #4f9e8c, #a5cf6f, #c9a25d, #d39a6a)',
    text: '#ffffff',
  },
};

export default {
  id: 'evolution',
  name: 'Evolution',
  description: 'From a microbe in the sea to a human. Rubble is fossil bones.',
  pieces: LADDER.map(([glyph, name, , fallback]) => (fallback ? { glyph, name, fallback } : { glyph, name })),
  rubble: { glyph: '🦴', name: 'bone', fallback: '💀' },
  piece: 'creature',
  ladder: 'evolution',
  pictures: true,
  palette,
  page: '#f1f5f9',
} satisfies Skin;
