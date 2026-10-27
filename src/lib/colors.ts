// Colors, as a palette: every color the board and the Next and Spare chips
// are drawn in. The drawing takes a palette rather than choosing its own
// colors, so a skin (issue #42) is just another palette. DEFAULT_PALETTE is
// the game's look.

import { EMPTY, WILD, rungOf, type Cell, type Drawn, type Shape } from './rules';

export interface TileColors {
  fill: string; // a CSS color, or for the wildcard a CSS gradient
  text: string;
}

export interface Palette {
  // One fill and one letter color per rung, A to Z (see rungOf)
  rungFills: string[];
  rungTexts: string[];
  // The # tile
  zeroFill: string;
  zeroText: string;
  emptyFill: string;
  // An empty tile that the next value can't go on: not the shape it was dealt
  offShapeFill: string;
  // The tile edges on the board, also drawn around the Next and Spare chips
  tileEdge: string;
  // The wildcard, in the Next and Spare chips only
  wild: TileColors;
  // The merge preview: the previewed tile's tint (stronger when it would
  // merge), the outline of it and of the tiles it would clear, and its letter
  previewTint: string;
  previewTintMerging: string;
  previewOutline: string;
  previewText: string;
  // Outlines: the tiles an armed power-up would empty, the tile a power-up
  // picked (Swap's first), and the last move
  doomedOutline: string;
  pickedOutline: string;
  lastMoveOutline: string;
  // The ring where a sun's or star's tips meet: open, and once completed
  ringFill: string;
  ringEdge: string;
  ringDoneFill: string;
  ringDoneEdge: string;
}

// A to J go through the light shades of the color wheel (warm to cool),
// written in near-black; K to Y through deep shades, written in white; Z,
// the winning tile, is gold.
const DARK_TEXT = '#1e293b';
const WHITE_TEXT = '#ffffff';
const DEFAULT_RUNG_FILLS = [
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

export const DEFAULT_PALETTE: Palette = {
  rungFills: DEFAULT_RUNG_FILLS,
  // White from K (the 11th rung) to Y; near-black on the light shades and Z
  rungTexts: DEFAULT_RUNG_FILLS.map((_, i) => (i >= 10 && i < 25 ? WHITE_TEXT : DARK_TEXT)),
  // A darker slate than the off-shape fill, so obstacles stand apart from
  // empty tiles of the shape not dealt
  zeroFill: '#94a3b8',
  zeroText: DARK_TEXT,
  emptyFill: '#ffffff',
  offShapeFill: '#e2e8f0',
  tileEdge: '#94a3b8',
  wild: {
    fill: 'linear-gradient(135deg, #f472b6, #fcd34d, #34d399, #38bdf8, #c084fc)',
    text: '#ffffff',
  },
  previewTint: '#e0e7ff',
  previewTintMerging: '#c7d2fe',
  previewOutline: '#4f46e5',
  previewText: '#3730a3',
  doomedOutline: '#dc2626',
  pickedOutline: '#0d9488',
  lastMoveOutline: '#d97706',
  ringFill: '#ffffff',
  ringEdge: '#94a3b8',
  ringDoneFill: '#eab308',
  ringDoneEdge: '#a16207',
};

// Night: a calm skin for winding down. The board and the page go dark
// and warm (no bright whites or blues), the letters take muted, earthy
// shades, and the highlights are soft. Every letter still reads at a
// contrast of at least 4.5 to 1 on its tile.
const NIGHT_DARK_TEXT = '#1c1917';
const NIGHT_LIGHT_TEXT = '#f3e9dc';
const NIGHT_RUNG_FILLS = [
  '#d6c7a1', // A sand
  '#c9a86a', // B ochre
  '#c98f62', // C clay
  '#c47a6c', // D dusty red
  '#b98095', // E mauve
  '#a68aa8', // F heather
  '#9393b3', // G dusk
  '#82a0ad', // H slate blue
  '#80a89b', // I sage teal
  '#9bab7f', // J sage
  '#8a4b2a', // K rust
  '#7d3434', // L oxblood
  '#7a3555', // M plum rose
  '#5b3a6b', // N aubergine
  '#3f3d6e', // O deep dusk
  '#2f5266', // P deep slate
  '#2f5a52', // Q deep teal
  '#3d5a32', // R moss
  '#5e4426', // S umber
  '#5a2733', // T wine
  '#47284f', // U dark plum
  '#2c2f52', // V night blue
  '#23434a', // W deep lagoon
  '#29402a', // X forest
  '#3a3330', // Y charcoal
  '#c8a24a', // Z soft gold
];

export const NIGHT_PALETTE: Palette = {
  rungFills: NIGHT_RUNG_FILLS,
  // Light letters on the deep shades, K to Y; dark on the rest and Z
  rungTexts: NIGHT_RUNG_FILLS.map((_, i) => (i >= 10 && i < 25 ? NIGHT_LIGHT_TEXT : NIGHT_DARK_TEXT)),
  // A warm gray, lighter than the empty tiles, so obstacles stand out
  zeroFill: '#5c534c',
  zeroText: NIGHT_LIGHT_TEXT,
  emptyFill: '#2b2622',
  // The shape the next value can't go on recedes, darker still
  offShapeFill: '#1b1714',
  tileEdge: '#4d443d',
  wild: {
    fill: 'linear-gradient(135deg, #b98095, #c9a86a, #9bab7f, #82a0ad, #a68aa8)',
    text: NIGHT_LIGHT_TEXT,
  },
  previewTint: '#3a3448',
  previewTintMerging: '#4a4262',
  previewOutline: '#b4a7d6',
  previewText: '#f1ebff',
  doomedOutline: '#d9826f',
  pickedOutline: '#7fb3a6',
  lastMoveOutline: '#d6a85c',
  ringFill: '#2b2622',
  ringEdge: '#6b6058',
  ringDoneFill: '#c8a24a',
  ringDoneEdge: '#8a6d2a',
};

// The skins a player can pick (a preference): a name and a palette. The
// page around the board follows the skin too (see index.css).
export const SKINS = {
  // `page` is the page's background, also the browser's theme color
  day: { name: 'Day', palette: DEFAULT_PALETTE, page: '#f1f5f9' },
  night: { name: 'Night', palette: NIGHT_PALETTE, page: '#1a1613' },
} as const;

export type SkinId = keyof typeof SKINS;

export const SKIN_IDS = Object.keys(SKINS) as SkinId[];

// The default palette's colors by name, for the tests and the chips
export const RUNG_FILLS = DEFAULT_PALETTE.rungFills;
export const ZERO_FILL = DEFAULT_PALETTE.zeroFill;
export const EMPTY_FILL = DEFAULT_PALETTE.emptyFill;
export const OFF_SHAPE_FILL = DEFAULT_PALETTE.offShapeFill;
export const TILE_EDGE = DEFAULT_PALETTE.tileEdge;
export const WILD_COLORS = DEFAULT_PALETTE.wild;

// The fill for a value: its rung's, or the # fill for 0. A value that
// isn't a power of 3 takes its rung's.
export const fillFor = (value: number, palette: Palette = DEFAULT_PALETTE) => {
  const rung = rungOf(value);
  return rung === 0 ? palette.zeroFill : palette.rungFills[Math.min(rung, palette.rungFills.length) - 1];
};

// The letter color for a value.
export const textFor = (value: number, palette: Palette = DEFAULT_PALETTE) => {
  const rung = rungOf(value);
  return rung === 0 ? palette.zeroText : palette.rungTexts[Math.min(rung, palette.rungTexts.length) - 1];
};

// A board tile's fill: its value's, or for an empty tile, the off-shape
// fill when it isn't the shape the next value must go on (`mustBe`, null
// for either), else the empty fill.
export const tileFill = (value: Cell, shape: Shape, mustBe: Shape | null, palette: Palette = DEFAULT_PALETTE) => {
  if (value !== EMPTY) return fillFor(value, palette);
  return mustBe && shape !== mustBe ? palette.offShapeFill : palette.emptyFill;
};

// How a board cell or a drawn value looks. The wildcard never sits on the
// board, so it gets a look no number has.
export const colorsFor = (value: Cell | Drawn, palette: Palette = DEFAULT_PALETTE): TileColors => {
  if (value === EMPTY) return { fill: palette.emptyFill, text: textFor(1, palette) };
  if (value === WILD) return palette.wild;
  return { fill: fillFor(value, palette), text: textFor(value, palette) };
};
