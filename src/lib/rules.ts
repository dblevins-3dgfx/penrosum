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
//   zero:  holds a 0, which can't be played on and matches nothing that is
//          placed, so it blocks groups and the board slowly fills up
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

export interface Options {
  group: GroupRule;
  clear: ClearRule;
  values: ValueRule;
  goal: GoalRule;
  target: number;
  // Chain reactions: after a merge, the placed tile's new number may match
  // the tiles around it; when true, it merges again, as often as it can
  cascade: boolean;
}

export const DEFAULT_OPTIONS: Options = {
  group: 'connected',
  clear: 'empty',
  values: 'ones',
  goal: 'highest',
  target: 50,
  cascade: false,
};

export const TARGET_OPTIONS = [20, 50, 100, 200];
export const CHOOSABLE_VALUES = [1, 2, 3];

// A merge needs this many matching tiles, counting the one just placed.
export const MIN_GROUP = 3;

// No number on the tile. A cleared tile under the 'zero' rule holds 0
// instead, which is "numbered".
export const EMPTY = null;

export type Cell = number | null;

export interface Tile {
  neighbors: number[];
}

// A move is legal on an un-numbered tile.
export const canPlace = (cells: Cell[], id: number) => cells[id] === EMPTY;

// The group for numbered tile `id`: it first, then the tiles holding the
// same number that count as adjacent to it. Fewer than MIN_GROUP tiles
// means no merge.
export const groupAt = (tiles: Tile[], cells: Cell[], id: number, rule: GroupRule): number[] => {
  const matches = (n: number) => cells[n] === cells[id];
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
  merges: Merge[]; // in order; more than one only with chain reactions
}

// Places `value` on tile `id` and applies a merge if one forms, then, with
// chain reactions on, merges again while the new number makes a group.
// Each merge at least triples the placed tile's number, so chains end.
// Assumes the move is legal (see canPlace). Returns new cells; the input is
// unchanged.
export const place = (tiles: Tile[], cells: Cell[], id: number, value: number, options: Options): PlaceResult => {
  const next = cells.slice();
  next[id] = value;
  const merges: Merge[] = [];
  for (;;) {
    const group = groupAt(tiles, next, id, options.group);
    if (group.length < MIN_GROUP) break;
    const sum = group.reduce((s, t) => s + next[t], 0);
    const from = group.slice(1);
    for (const t of from) next[t] = options.clear === 'zero' ? 0 : EMPTY;
    next[id] = sum;
    merges.push({ into: id, from, sum });
    if (!options.cascade) break;
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

// Draws a value under the 'random' rule. `rand` returns a number in [0, 1).
export const drawValue = (rand: () => number = Math.random) => {
  let r = rand();
  for (const [value, weight] of RANDOM_WEIGHTS) {
    if (r < weight) return value;
    r -= weight;
  }
  return RANDOM_WEIGHTS[RANDOM_WEIGHTS.length - 1][0];
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
