// Penrosum rules, as plain functions over the tile graph.
//
// The board is a list of tiles with neighbor lists (see penrose-board.ts).
// The game state is one number per tile. Several rules are still open
// questions (SPEC.md, "Open questions"); each is an option here so they can
// be tried side by side.

// Which tiles count as "adjacent" when deciding whether a placement merges.
// Only tiles holding the same number as the placed tile ever count.
//   connected: every matching tile connected to the placed one through
//              other matching tiles
//   neighbors: the placed tile and its matching direct neighbors only
export type GroupRule = 'connected' | 'neighbors';

// What a merged-away tile becomes.
//   empty: un-numbered; it can be played again and never counts toward a group
//   zero:  holds a 0, which can't be played on and matches only a placed
//          0, so it blocks groups and the board slowly fills up
export type ClearRule = 'empty' | 'zero';

// Where the value to place comes from.
//   ones:   always 1
//   random: drawn at random (mostly 1, sometimes 2 or 3) and shown in advance
//   choose: the player picks 1, 2 or 3 each move
export type ValueRule = 'ones' | 'random' | 'choose';

// What the player is aiming for.
//   highest: no target; play until the board is full, aiming for the
//            highest tile
//   target:  win by making a tile of at least `target`
export type GoalRule = 'highest' | 'target';

// Whether a tile's shape matters for matching.
//   any:  any tiles with the same number match
//   same: they must also be the same shape, kite with kite, dart with dart
export type ShapeRule = 'any' | 'same';

// Whether 0 can come up as the value to place.
//   none: never; zeros on the board are fixed obstacles
//   deck: a drawn value is 0 ZERO_CHANCE of the time, and the player can
//         pick 0; placing a 0 next to zeros merges them into one
export type ZeroRule = 'none' | 'deck';

export interface Options {
  group: GroupRule;
  clear: ClearRule;
  values: ValueRule;
  goal: GoalRule;
  target: number;
  shape: ShapeRule;
  zeros: ZeroRule;
}

export const DEFAULT_OPTIONS: Options = {
  group: 'connected',
  clear: 'empty',
  values: 'ones',
  goal: 'highest',
  target: 50,
  shape: 'any',
  zeros: 'none',
};

export const TARGET_OPTIONS = [20, 50, 100, 200];

// The values the player can pick under the 'choose' rule.
export const choosableValues = (options: Options) =>
  options.zeros === 'deck' ? [0, 1, 2, 3] : [1, 2, 3];

// A merge needs this many matching tiles, counting the one just placed.
export const MIN_GROUP = 3;

// No number on the tile. A cleared tile under the 'zero' rule holds 0
// instead, which is "numbered".
export const EMPTY = null;

export type Cell = number | null;

export interface Tile {
  neighbors: number[];
  type?: 'kite' | 'dart'; // needed by the 'same' shape rule
}

// A move is legal on an un-numbered tile.
export const canPlace = (cells: Cell[], id: number) => cells[id] === EMPTY;

// The group for numbered tile `id`: it first, then the matching tiles (the
// same number, and under the 'same' shape rule the same shape) that count
// as adjacent to it. Fewer than MIN_GROUP tiles means no merge.
export const groupAt = (tiles: Tile[], cells: Cell[], id: number, rule: GroupRule, shape: ShapeRule = 'any'): number[] => {
  const matches = (n: number) =>
    cells[n] === cells[id] && (shape === 'any' || tiles[n].type === tiles[id].type);
  if (rule === 'neighbors') {
    return [id, ...tiles[id].neighbors.filter(matches)];
  }
  const group = [id];
  const seen = new Set(group);
  for (let i = 0; i < group.length; i++) {
    for (const n of tiles[group[i]].neighbors) {
      if (!seen.has(n) && matches(n)) {
        seen.add(n);
        group.push(n);
      }
    }
  }
  return group;
};

export interface Merge {
  into: number; // the placed tile, which takes the sum
  from: number[]; // the other tiles, now cleared
  sum: number;
}

export interface PlaceResult {
  cells: Cell[];
  merges: Merge[]; // in order; more than one when a chain reaction follows
}

// Places `value` on tile `id` and applies a merge if one forms, then merges
// again while the tile's new number makes a group and is bigger than before
// (a chain reaction). A merge of 1s or more at least triples the number, so
// chains end; a merge of zeros leaves 0, which ends the chain at once
// (otherwise, with cleared tiles becoming zeros, it would repeat forever).
// Assumes the move is legal (see canPlace). Returns new cells; the input is
// unchanged.
export const place = (tiles: Tile[], cells: Cell[], id: number, value: number, options: Options): PlaceResult => {
  const next = cells.slice();
  next[id] = value;
  const merges: Merge[] = [];
  for (;;) {
    const group = groupAt(tiles, next, id, options.group, options.shape);
    if (group.length < MIN_GROUP) break;
    const before = next[id];
    const sum = group.reduce((s, t) => s + next[t], 0);
    const from = group.slice(1);
    for (const t of from) next[t] = options.clear === 'zero' ? 0 : EMPTY;
    next[id] = sum;
    merges.push({ into: id, from, sum });
    if (sum <= before) break;
  }
  return { cells: next, merges };
};

// What placing on `id` would do, for the hover preview: the number the tile
// would end up with, and every tile its merges would clear.
export const previewAt = (tiles: Tile[], cells: Cell[], id: number, value: number, options: Options) => {
  const { cells: after, merges } = place(tiles, cells, id, value, options);
  return { value: after[id], merging: merges.flatMap(m => m.from) };
};

// Chance of each value under the 'random' rule.
export const RANDOM_WEIGHTS: [number, number][] = [[1, 0.7], [2, 0.2], [3, 0.1]];

// With zeros in the deck, how often a drawn value is 0.
export const ZERO_CHANCE = 0.1;

export type Deck = [number, number][]; // [value, chance], chances adding to 1

// The values a move can draw, and their chances. Empty under 'choose',
// where the player picks. With zeros in the deck, 0 takes ZERO_CHANCE and
// the rest share what is left in the same proportions as without.
export const deckFor = (options: Options): Deck => {
  if (options.values === 'choose') return [];
  const base: Deck = options.values === 'random' ? RANDOM_WEIGHTS : [[1, 1]];
  if (options.zeros === 'none') return base;
  return [[0, ZERO_CHANCE], ...base.map(([v, w]) => [v, w * (1 - ZERO_CHANCE)] as [number, number])];
};

// Draws a value from `deck` (by default the 'random' rule's). `rand`
// returns a number in [0, 1).
export const drawValue = (rand: () => number = Math.random, deck: Deck = RANDOM_WEIGHTS) => {
  let r = rand();
  for (const [value, weight] of deck) {
    if (r < weight) return value;
    r -= weight;
  }
  return deck[deck.length - 1][0];
};

// The starting board: `fraction` of the tiles (SEED_FRACTION in play),
// picked at random, hold a random number from SEED_VALUES. Neighboring
// seeds never hold the same number, so no group exists before the first
// move under any option.
// A tile whose neighbors already hold every value stays empty.
export const SEED_FRACTION = 0.1;
export const SEED_VALUES = [0, 1, 2, 3];

export const seedBoard = (tiles: Tile[], rand: () => number = Math.random, fraction = SEED_FRACTION): Cell[] => {
  const cells: Cell[] = tiles.map(() => EMPTY);
  // Visit the tiles in random order (Fisher-Yates)
  const order = tiles.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let left = Math.round(tiles.length * fraction);
  for (const id of order) {
    if (left === 0) break;
    const allowed = SEED_VALUES.filter(v => !tiles[id].neighbors.some(n => cells[n] === v));
    if (!allowed.length) continue;
    cells[id] = allowed[Math.floor(rand() * allowed.length)];
    left--;
  }
  return cells;
};

export const highestTile = (cells: Cell[]) =>
  cells.reduce<number>((m, c) => (c !== EMPTY && c > m ? c : m), 0);

export const boardFull = (cells: Cell[]) => !cells.some(c => c === EMPTY);

// The game ends with a win when the target is reached (goal 'target'), or
// when no un-numbered tile is left.
export type Outcome = { over: false } | { over: true; won: boolean; highest: number };

export const outcome = (cells: Cell[], options: Options): Outcome => {
  const highest = highestTile(cells);
  if (options.goal === 'target' && highest >= options.target) return { over: true, won: true, highest };
  if (boardFull(cells)) return { over: true, won: options.goal === 'highest', highest };
  return { over: false };
};
