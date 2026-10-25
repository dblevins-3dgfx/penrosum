// Penrosum rules, as plain functions over the tile graph.
//
// The board is a list of tiles with neighbor lists (see penrose-board.ts).
// The game state is one number per tile. Several rules are still open
// questions (SPEC.md, "Open questions"); each is an option here so they can
// be tried side by side.

// Which tiles count as "adjacent" when deciding whether a placement merges.
//   connected: every numbered tile connected to the placed one through
//              other numbered tiles
//   neighbors: the placed tile and its numbered direct neighbors only
export type GroupRule = 'connected' | 'neighbors';

// What a merged-away tile becomes.
//   empty: un-numbered; it can be played again and never counts toward a group
//   zero:  holds a 0; it counts toward groups (adding nothing to the sum)
//          and can't be played on, so the board slowly fills up
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
}

export const DEFAULT_OPTIONS: Options = {
  group: 'connected',
  clear: 'empty',
  values: 'ones',
  goal: 'highest',
  target: 50,
};

export const TARGET_OPTIONS = [20, 50, 100, 200];
export const CHOOSABLE_VALUES = [1, 2, 3];

// A merge needs this many tiles, counting the one just placed.
export const MIN_GROUP = 3;

// No number on the tile. A cleared tile under the 'zero' rule holds 0
// instead, which is "numbered".
export const EMPTY = null;

export type Cell = number | null;

export interface Tile {
  neighbors: number[];
}

export const isNumbered = (cell: Cell) => cell !== EMPTY;

// A move is legal on an un-numbered tile.
export const canPlace = (cells: Cell[], id: number) => cells[id] === EMPTY;

// The tiles that would merge if `id` were numbered: the placed tile first,
// then the others in the group. Fewer than MIN_GROUP tiles means no merge.
export const groupAt = (tiles: Tile[], cells: Cell[], id: number, rule: GroupRule): number[] => {
  if (rule === 'neighbors') {
    return [id, ...tiles[id].neighbors.filter(n => isNumbered(cells[n]))];
  }
  const group = [id];
  const seen = new Set(group);
  for (let i = 0; i < group.length; i++) {
    for (const n of tiles[group[i]].neighbors) {
      if (!seen.has(n) && isNumbered(cells[n])) {
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
  merge: Merge | null;
}

// Places `value` on tile `id` and applies a merge if one forms. Assumes the
// move is legal (see canPlace). Returns new cells; the input is unchanged.
export const place = (tiles: Tile[], cells: Cell[], id: number, value: number, options: Options): PlaceResult => {
  const next = cells.slice();
  next[id] = value;
  const group = groupAt(tiles, next, id, options.group);
  if (group.length < MIN_GROUP) return { cells: next, merge: null };

  const sum = group.reduce((s, t) => s + next[t], 0);
  const from = group.slice(1);
  for (const t of from) next[t] = options.clear === 'zero' ? 0 : EMPTY;
  next[id] = sum;
  return { cells: next, merge: { into: id, from, sum } };
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
