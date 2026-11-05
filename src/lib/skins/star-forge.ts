// Star forge: the first 34 chemical elements, hydrogen to selenium, in
// order of atomic number. An ordinary star builds elements by fusion up to
// iron (Fe, 26); the ones after it are forged in a supernova, so making
// selenium means a star has exploded. Rubble is antimatter, a
// positron (e⁺): it can't sit with matter, so it's in the way until
// cleared. A text skin: the pieces, and the rubble, are symbols drawn in
// the palette's text colors.

import { DEFAULT_PALETTE, type Palette } from '../colors';
import type { Skin } from '../skin';

const DARK = '#1e293b';
const WHITE = '#ffffff';

// Each element with its tile colors. The fills follow the element
// families, as periodic tables color them, each family stepping darker as
// the atomic number rises: reactive non-metals green, noble gases violet,
// alkali metals red, alkaline earths orange, metalloids teal, halogens
// yellow, aluminium and gallium (post-transition metals) sky blue, the
// transition metals steel blue deepening to navy, except iron, where an
// ordinary star's fusion stops, in ember.
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
  ['Ti', 'titanium', '#bfdbfe', DARK],
  ['V', 'vanadium', '#93c5fd', DARK],
  ['Cr', 'chromium', '#60a5fa', DARK],
  ['Mn', 'manganese', '#2563eb', WHITE],
  ['Fe', 'iron', '#7c2d12', WHITE],
  ['Co', 'cobalt', '#1d4ed8', WHITE],
  ['Ni', 'nickel', '#1e40af', WHITE],
  ['Cu', 'copper', '#1e3a8a', WHITE],
  ['Zn', 'zinc', '#172554', WHITE],
  ['Ga', 'gallium', '#38bdf8', DARK],
  ['Ge', 'germanium', '#0f766e', WHITE],
  ['As', 'arsenic', '#134e4a', WHITE],
  ['Se', 'selenium', '#14532d', WHITE],
];

const palette: Palette = {
  ...DEFAULT_PALETTE,
  rungFills: ELEMENTS.map(e => e[2]),
  rungTexts: ELEMENTS.map(e => e[3]),
  // Antimatter: pink on deep indigo
  zeroFill: '#1e1b4b',
  zeroText: '#f0abfc',
  wild: {
    fill: 'linear-gradient(135deg, #9333ea, #60a5fa, #22c55e, #facc15, #dc2626)',
    text: WHITE,
  },
};

export default {
  id: 'star-forge',
  name: 'Star forge',
  description: 'The elements stars forge, hydrogen to selenium. Rubble is antimatter.',
  pieces: ELEMENTS.map(([glyph, name]) => ({ glyph, name })),
  rubble: { glyph: 'e⁺', name: 'positron' },
  piece: 'element',
  ladder: "a star's forge",
  pictures: false,
  palette,
  page: '#f1f5f9',
} satisfies Skin;
