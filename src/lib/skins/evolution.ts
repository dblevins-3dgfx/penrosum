// Evolution: from a microbe in the sea to a human, with fossil bones for
// rubble. A picture skin: its pieces are emoji, each newer one with an
// older one to fall back to.

import { DEFAULT_PALETTE, type Palette } from '../colors';
import type { Skin } from '../skin';

// The palette. The pieces are pictures, so the fills are their
// backgrounds, running from the sea (pale aqua to ocean blue) through the
// shore and the swamp (teals and greens) and the age of reptiles (earth
// tones) to warm fur, with gold for the human.
const RUNG_FILLS = [
  '#d8f3ef', // microbe
  '#c2ece6', // sponge
  '#a9e1e4', // coral
  '#93d3e6', // jellyfish
  '#7fc4e2', // worm
  '#6fb3dc', // snail
  '#5ea2d3', // squid
  '#4f93c9', // crab
  '#5aa3a0', // scorpion
  '#4f9e8c', // fish
  '#458f7c', // shark
  '#8fca7a', // frog
  '#a5cf6f', // lizard
  '#b8c96a', // turtle
  '#9fae5d', // crocodile
  '#c6b86b', // sauropod
  '#c9a25d', // T. rex
  '#d9b77d', // bird
  '#e2c3a0', // shrew
  '#d7b08f', // hedgehog
  '#d39a6a', // squirrel
  '#c98a5f', // monkey
  '#c47a52', // orangutan
  '#a98a7a', // gorilla
  '#e8c7ad', // early human
  '#eab308', // human
];

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
  palette,
  page: '#f1f5f9',
} satisfies Skin;
