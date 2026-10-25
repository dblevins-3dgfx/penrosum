// Penrosum rules, as plain functions over the tile graph.
//
// The board is a list of tiles with neighbor lists (see penrose-board.ts).
// The game state is one number per tile. Several rules are still open
// questions (SPEC.md, "Open questions"); each is an option here so they can
// be tried side by side.

// What the player is aiming for.
//   highest: no target; play until the board is full, aiming for the
//            highest tile
//   target:  win by making a tile of at least `target`
export type GoalRule = 'highest' | 'target';

// Whether a tile's shape matters for matching.
//   any:  any tiles with the same number match
//   same: they must also be the same shape, kite with kite, dart with dart
export type ShapeRule = 'any' | 'same';

// Whether a wildcard can come up as the value to place.
//   none: never
//   deck: a drawn value is WILD WILD_CHANCE of the time; when placed it
//         becomes the number that does best there (see resolveWild)
export type WildRule = 'none' | 'deck';

export interface Options {
  goal: GoalRule;
  target: number;
  shape: ShapeRule;
  wild: WildRule;
}

export const DEFAULT_OPTIONS: Options = {
  goal: 'highest',
  target: 50,
  shape: 'any',
  wild: 'none',
};

export const TARGET_OPTIONS = [20, 50, 100, 200];

// A merge needs this many matching tiles, counting the one just placed.
export const MIN_GROUP = 3;

// No number on the tile. A tile holding 0 is numbered: it can't be played
// on, and matches only a placed 0.
export const EMPTY = null;

export type Cell = number | null;

export interface Tile {
  neighbors: number[];
  type?: 'kite' | 'dart'; // needed by the 'same' shape rule
}

// A move is legal on an un-numbered tile.
export const canPlace = (cells: Cell[], id: number) => cells[id] === EMPTY;

// The group for numbered tile `id`: it first, then every matching tile (the
// same number, and under the 'same' shape rule the same shape) connected to
// it through other matching tiles. Fewer than MIN_GROUP tiles means no
// merge.
export const groupAt = (tiles: Tile[], cells: Cell[], id: number, shape: ShapeRule = 'any'): number[] => {
  const matches = (n: number) =>
    cells[n] === cells[id] && (shape === 'any' || tiles[n].type === tiles[id].type);
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

// Places `value` on tile `id` and applies a merge if one forms: the tile
// takes the group's sum and the rest of the group is emptied. Then it merges
// again while its new number makes a group (a chain reaction). Every merge
// empties at least two numbered tiles and numbers none, so chains end.
// Assumes the move is legal (see canPlace). Returns new cells; the input is
// unchanged.
export const place = (tiles: Tile[], cells: Cell[], id: number, value: number, options: Options): PlaceResult => {
  const next = cells.slice();
  next[id] = value;
  const merges: Merge[] = [];
  for (;;) {
    const group = groupAt(tiles, next, id, options.shape);
    if (group.length < MIN_GROUP) break;
    const sum = group.reduce((s, t) => s + next[t], 0);
    const from = group.slice(1);
    for (const t of from) next[t] = EMPTY;
    next[id] = sum;
    merges.push({ into: id, from, sum });
  }
  return { cells: next, merges };
};

// What placing the drawn value on `id` would do, for the hover preview: the
// number the tile would end up with, and every tile its merges would clear.
export const previewAt = (tiles: Tile[], cells: Cell[], id: number, drawn: number, options: Options) => {
  const value = valueToPlace(tiles, cells, id, drawn, options);
  const { cells: after, merges } = place(tiles, cells, id, value, options);
  return { value: after[id], merging: merges.flatMap(m => m.from) };
};

export type Deck = [number, number][]; // [value, chance], chances adding to 1

// The value for each move is drawn at random from DECK and shown in
// advance: 0 a tenth of the time, then 1, 2 and 3 at 7 : 2 : 1.
export const DECK: Deck = [[0, 0.1], [1, 0.63], [2, 0.18], [3, 0.09]];

// The wildcard, as a drawn value. It never sits on the board: placing it
// places the number resolveWild picks.
export const WILD = -1;

// With the wildcard in the deck, how often a drawn value is WILD.
export const WILD_CHANCE = 0.05;

// The deck in play. With the wildcard, it takes WILD_CHANCE and the numbers
// share what is left in the same proportions as without.
export const deckFor = (options: Options): Deck =>
  options.wild === 'deck'
    ? [[WILD, WILD_CHANCE], ...DECK.map(([v, w]) => [v, w * (1 - WILD_CHANCE)] as [number, number])]
    : DECK;

// What a wildcard placed on `id` becomes: the number that does best there.
// It tries each number held by a neighbor and keeps the one whose move
// (chain reactions included) merges rather than not, then leaves the
// biggest number, then clears the most tiles; on a tie, the smaller
// number. If none of them merges, it is a 1.
export const resolveWild = (tiles: Tile[], cells: Cell[], id: number, options: Options) => {
  const tried = [...new Set(tiles[id].neighbors.map(n => cells[n]).filter(c => c !== EMPTY))].sort((a, b) => a - b);
  let best = { value: 1, result: -1, cleared: 0 };
  for (const value of tried) {
    const { cells: after, merges } = place(tiles, cells, id, value, options);
    if (!merges.length) continue;
    const result = after[id];
    const cleared = merges.reduce((s, m) => s + m.from.length, 0);
    if (result > best.result || (result === best.result && cleared > best.cleared)) {
      best = { value, result, cleared };
    }
  }
  return best.value;
};

// The number a drawn value places on `id`: itself, or for a wildcard the
// number it resolves to.
export const valueToPlace = (tiles: Tile[], cells: Cell[], id: number, drawn: number, options: Options) =>
  drawn === WILD ? resolveWild(tiles, cells, id, options) : drawn;

// Draws a value from `deck`. `rand` returns a number in [0, 1).
export const drawValue = (rand: () => number = Math.random, deck: Deck = DECK) => {
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
