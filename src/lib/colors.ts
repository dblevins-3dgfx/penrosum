// Tile colors, shared by the board and the "Next" chip in the header so a
// number looks the same in both places.

import { EMPTY, WILD, rungOf, type Cell } from './rules';

export interface TileColors {
  fill: string; // a CSS color, or for the wildcard a CSS gradient
  text: string;
}

export const EMPTY_FILL = '#ffffff';

// An empty tile that the next value can't go on: not the shape it was dealt
export const OFF_SHAPE_FILL = '#e2e8f0';

// The # tile: a darker slate than OFF_SHAPE_FILL, so obstacles stand
// apart from empty tiles of the shape not dealt.
export const ZERO_FILL = '#94a3b8';
export const ZERO_TEXT = '#1e293b';

// One fill per rung, A to Z (see rungOf), each different. A to J go
// through the light shades of the color wheel (warm to cool); K to Y
// through deep shades, with white letters; Z, the winning tile, is gold.
export const RUNG_FILLS = [
  '#fef3c7', // A pale yellow
  '#fcd34d', // B yellow
  '#fb923c', // C orange
  '#f87171', // D red
  '#f472b6', // E pink
  '#c084fc', // F purple
  '#818cf8', // G indigo
  '#38bdf8', // H blue
  '#2dd4bf', // I teal
  '#4ade80', // J green
  '#c2410c', // K deep orange
  '#b91c1c', // L deep red
  '#be185d', // M deep pink
  '#7e22ce', // N deep purple
  '#4338ca', // O deep indigo
  '#0369a1', // P deep blue
  '#0f766e', // Q deep teal
  '#15803d', // R deep green
  '#92400e', // S brown
  '#881337', // T wine
  '#581c87', // U plum
  '#312e81', // V navy
  '#164e63', // W deep cyan
  '#14532d', // X forest
  '#1e293b', // Y slate
  '#eab308', // Z gold
];

// The first rung written in white: from K, the deep shades.
const FIRST_WHITE_RUNG = 11;

const DARK_TEXT = '#1e293b';
const WHITE_TEXT = '#ffffff';

// The fill for a value: its rung's, or the # fill for 0.
export const fillFor = (value: number) => {
  const rung = rungOf(value);
  return rung === 0 ? ZERO_FILL : RUNG_FILLS[Math.min(rung, RUNG_FILLS.length) - 1];
};

// The letter color for a value: near-black on a # and on the light shades
// and gold Z, white on the deep shades K to Y.
export const textFor = (value: number) => {
  const rung = rungOf(value);
  if (rung === 0) return ZERO_TEXT;
  return rung >= FIRST_WHITE_RUNG && rung < RUNG_FILLS.length ? WHITE_TEXT : DARK_TEXT;
};

// The wildcard never sits on the board, so it gets a look no number has.
export const WILD_COLORS: TileColors = {
  fill: 'linear-gradient(135deg, #f472b6, #fcd34d, #34d399, #38bdf8, #c084fc)',
  text: '#ffffff',
};

// How a board cell or a drawn value looks.
export const colorsFor = (value: Cell): TileColors => {
  if (value === EMPTY) return { fill: EMPTY_FILL, text: textFor(1) };
  if (value === WILD) return WILD_COLORS;
  return { fill: fillFor(value), text: textFor(value) };
};
