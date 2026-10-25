// Tile colors, shared by the board and the "Next" chip in the header so a
// number looks the same in both places.

import { EMPTY, WILD, type Cell } from './rules';

export interface TileColors {
  fill: string; // a CSS color, or for the wildcard a CSS gradient
  text: string;
}

export const EMPTY_FILL = '#ffffff';

// Numbers warm up and then cool down as they grow.
export const fillFor = (value: number) => {
  if (value === 0) return '#cbd5e1';
  if (value === 1) return '#fef3c7';
  if (value === 2) return '#fde68a';
  if (value <= 4) return '#fcd34d';
  if (value <= 7) return '#fb923c';
  if (value <= 12) return '#f87171';
  if (value <= 20) return '#f472b6';
  if (value <= 35) return '#c084fc';
  if (value <= 60) return '#818cf8';
  if (value <= 100) return '#38bdf8';
  return '#34d399';
};

// The text color of a number: gray on a 0, near-black on the rest.
export const textFor = (value: number) => (value === 0 ? '#64748b' : '#1e293b');

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
