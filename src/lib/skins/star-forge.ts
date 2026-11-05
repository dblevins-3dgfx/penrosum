// Star forge: the first 26 chemical elements, hydrogen to iron, in order
// of atomic number. An ordinary star builds elements by fusion up to iron,
// so making Fe means you've forged a star's core. Rubble is a comet (☄️):
// debris. A text skin: the pieces are element symbols, drawn in the
// palette's text colors.

import { DEFAULT_PALETTE, type Palette } from '../colors';
import type { Skin } from '../skin';

const DARK = '#1e293b';
const WHITE = '#ffffff';

// Each element with its tile colors. The fills follow the element
// families, as periodic tables color them, each family stepping darker as
// the atomic number rises: reactive non-metals green, noble gases violet,
// alkali metals red, alkaline earths orange, metalloids teal, halogens
// yellow, aluminium (a post-transition metal) sky blue, the transition
// metals steel blue, and iron, the top, ember.
const ELEMENTS: [symbol: string, name: string, fill: string, text: string][] = [
  ['H', 'hydrogen', '#dcfce7', DARK],
  ['He', 'helium', '#f3e8ff', DARK],
  ['Li', 'lithium', '#fee2e2', DARK],
  ['Be', 'beryllium', '#ffedd5', DARK],
  ['B', 'boron', '#ccfbf1', DARK],
  ['C', 'carbon', '#bbf7d0', DARK],
  ['N', 'nitrogen', '#86efac', DARK],
  ['O', 'oxygen', '#4ade80', DARK],
  ['F', 'fluorine', '#fef9c3', DARK],
  ['Ne', 'neon', '#d8b4fe', DARK],
  ['Na', 'sodium', '#fca5a5', DARK],
  ['Mg', 'magnesium', '#fdba74', DARK],
  ['Al', 'aluminium', '#bae6fd', DARK],
  ['Si', 'silicon', '#2dd4bf', DARK],
  ['P', 'phosphorus', '#22c55e', DARK],
  ['S', 'sulfur', '#15803d', WHITE],
  ['Cl', 'chlorine', '#facc15', DARK],
  ['Ar', 'argon', '#9333ea', WHITE],
  ['K', 'potassium', '#dc2626', WHITE],
  ['Ca', 'calcium', '#c2410c', WHITE],
  ['Sc', 'scandium', '#dbeafe', DARK],
  ['Ti', 'titanium', '#93c5fd', DARK],
  ['V', 'vanadium', '#60a5fa', DARK],
  ['Cr', 'chromium', '#1d4ed8', WHITE],
  ['Mn', 'manganese', '#1e3a8a', WHITE],
  ['Fe', 'iron', '#7c2d12', WHITE],
];

const palette: Palette = {
  ...DEFAULT_PALETTE,
  rungFills: ELEMENTS.map(e => e[2]),
  rungTexts: ELEMENTS.map(e => e[3]),
  // Comets on cinder
  zeroFill: '#475569',
  zeroText: WHITE,
  wild: {
    fill: 'linear-gradient(135deg, #9333ea, #60a5fa, #22c55e, #facc15, #dc2626)',
    text: WHITE,
  },
};

export default {
  id: 'star-forge',
  name: 'Star forge',
  description: 'The elements a star forges, hydrogen to iron. Rubble is comets.',
  pieces: ELEMENTS.map(([glyph, name]) => ({ glyph, name })),
  rubble: { glyph: '☄️', name: 'comet' },
  piece: 'element',
  ladder: "a star's forge",
  pictures: false,
  palette,
  page: '#f1f5f9',
} satisfies Skin;
