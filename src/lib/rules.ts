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

// Whether a wildcard can come up as the value to place.
//   none: never
//   deck: a drawn value is WILD WILD_CHANCE of the time; when placed it
//         becomes the number that does best there (see resolveWild)
export type WildRule = 'none' | 'deck';

// What adds zeros to the board after a move, so it fills up (see
// applyPressure). A merge of zeros never counts as a merge here.
//   none:      nothing
//   mergeZero: after a move that merges, a 0 lands on a random empty tile
//   spawn:     after every move, a 0 appears on a tile announced one move
//              ahead; playing on that tile blocks it for that move
//   rubble:    each 3-tile merge leaves a 0 on its cleared tile farthest
//              from the placed tile
export type PressureRule = 'none' | 'mergeZero' | 'spawn' | 'rubble';

export type Shape = 'kite' | 'dart';

// How the two tile shapes matter in play. Matching never depends on shape.
//   none:       they don't
//   dealt:      each drawn value comes with a shape (kite KITE_CHANCE of the
//               time) and must go on an empty tile of that shape, unless
//               none is left (see shapeToPlace)
//   dartDouble: a merge into a dart is a bonus merge (one rung higher)
//   sameBonus:  a merge whose tiles are all one shape is a bonus merge
export type ShapesRule = 'none' | 'dealt' | 'dartDouble' | 'sameBonus';

export interface Options {
  goal: GoalRule;
  target: number;
  wild: WildRule;
  pressure: PressureRule;
  shapes: ShapesRule;
}

export const DEFAULT_OPTIONS: Options = {
  goal: 'highest',
  target: 81,
  wild: 'none',
  pressure: 'none',
  shapes: 'none',
};

// The targets for the 'target' goal: rungs D, E, F and G
export const TARGET_OPTIONS = [27, 81, 243, 729];

// A merge needs this many matching tiles, counting the one just placed.
export const MIN_GROUP = 3;

// No number on the tile. A tile holding 0 is numbered: it can't be played
// on, and matches only a placed 0.
export const EMPTY = null;

export type Cell = number | null;

export interface Tile {
  neighbors: number[];
  type?: Shape; // needed by the shape rules (Q10)
}

// A move is legal on an un-numbered tile.
export const canPlace = (cells: Cell[], id: number) => cells[id] === EMPTY;

// Under the 'dealt' shape rule: the shape the next value must go on, or
// null when any empty tile will do (no shape was dealt, or no empty tile of
// the dealt shape is left).
export const shapeToPlace = (tiles: Tile[], cells: Cell[], dealt: Shape | null): Shape | null =>
  dealt && tiles.some((t, i) => t.type === dealt && cells[i] === EMPTY) ? dealt : null;

// Whether the next value, dealt with `dealt` (or null), can go on `id`.
export const canPlaceDealt = (tiles: Tile[], cells: Cell[], id: number, dealt: Shape | null) => {
  if (!canPlace(cells, id)) return false;
  const shape = shapeToPlace(tiles, cells, dealt);
  return shape === null || tiles[id].type === shape;
};

// With the 'dealt' rule, how often the dealt shape is a kite. Roughly the
// board's own share of kites (60 of 103 on the medium board).
export const KITE_CHANCE = 0.6;

// The shape dealt with the next value: a random one under the 'dealt'
// rule, null under the others. `rand` returns a number in [0, 1).
export const dealShape = (options: Options, rand: () => number = Math.random): Shape | null =>
  options.shapes === 'dealt' ? (rand() < KITE_CHANCE ? 'kite' : 'dart') : null;

// The group for numbered tile `id`: it first, then every tile with the same
// number connected to it through other such tiles. Fewer than MIN_GROUP
// tiles means no merge.
export const groupAt = (tiles: Tile[], cells: Cell[], id: number): number[] => {
  const matches = (n: number) => cells[n] === cells[id];
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
  doubled?: 'dart' | 'shape'; // why the sum was doubled, under the shape rules
}

export interface PlaceResult {
  cells: Cell[];
  merges: Merge[]; // in order; more than one when a chain reaction follows
}

// Places `value` on tile `id` and applies a merge if one forms: the tile
// takes what the group makes (see mergeResult; one rung more for a bonus
// merge under the 'dartDouble' and 'sameBonus' shape rules) and the rest
// of the group is emptied. Then it merges
// again while its new number makes a group (a chain reaction). Every merge
// empties at least two numbered tiles and numbers none, so chains end.
// Assumes the move is legal (see canPlace). Returns new cells; the input is
// unchanged.
export const place = (tiles: Tile[], cells: Cell[], id: number, value: number, options: Options): PlaceResult => {
  const next = cells.slice();
  next[id] = value;
  const merges: Merge[] = [];
  for (;;) {
    const group = groupAt(tiles, next, id);
    if (group.length < MIN_GROUP) break;
    const values = group.map(t => next[t]);
    const doubled =
      options.shapes === 'dartDouble' && tiles[id].type === 'dart' ? 'dart'
      : options.shapes === 'sameBonus' && group.every(t => tiles[t].type === tiles[id].type) ? 'shape'
      : null;
    const sum = mergeResult(values, !!doubled);
    const from = group.slice(1);
    for (const t of from) next[t] = EMPTY;
    next[id] = sum;
    merges.push(doubled ? { into: id, from, sum, doubled } : { into: id, from, sum });
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

// The largest power of 3 not above `n` (1, 3, 9, 27 ...), or 0 for 0.
export const floorPow3 = (n: number) => {
  if (n < 1) return 0;
  let p = 1;
  while (p * 3 <= n) p *= 3;
  return p;
};

// What a merge of tiles holding `values` (all the same number) makes: their
// sum, rounded down to a power of 3, so every number stays on the ladder
// 1, 3, 9, 27 ... A bonus merge (Q10) goes one rung higher (x3).
export const mergeResult = (values: number[], bonus = false) => {
  const made = floorPow3(values.reduce((s, v) => s + v, 0));
  return bonus ? made * 3 : made;
};

export type Deck = [number, number][]; // [value, chance], chances adding to 1

// The value for each move is drawn at random from DECK and shown in
// advance: 0 (#) a tenth of the time, then 1, 3 and 9 (A, B, C) at 7 : 2 : 1.
export const DECK: Deck = [[0, 0.1], [1, 0.63], [3, 0.18], [9, 0.09]];

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

// A random empty tile, or null when the board is full. `rand` returns a
// number in [0, 1).
export const randomEmpty = (cells: Cell[], rand: () => number = Math.random) => {
  const free = cells.flatMap((c, i) => (c === EMPTY ? [i] : []));
  return free.length ? free[Math.floor(rand() * free.length)] : null;
};

// Where the 'spawn' rule's next 0 will appear (null under the other rules).
export const nextSpawn = (cells: Cell[], options: Options, rand: () => number = Math.random) =>
  options.pressure === 'spawn' ? randomEmpty(cells, rand) : null;

export interface PressureResult {
  cells: Cell[];
  zeros: number[]; // the tiles that just got a 0
  spawnAt: number | null; // where the next 'spawn' 0 will appear
}

// Adds the pressure rule's zeros to `cells`, the board just after a move
// that made `merges`. `spawnAt` is the tile announced for this move's
// spawn. Merges of zeros (sum 0) don't count as merges.
export const applyPressure = (
  cells: Cell[], merges: Merge[], options: Options, spawnAt: number | null,
  rand: () => number = Math.random,
): PressureResult => {
  const next = cells.slice();
  const zeros: number[] = [];
  const drop = (t: number | null) => {
    if (t !== null && next[t] === EMPTY) {
      next[t] = 0;
      zeros.push(t);
    }
  };
  const scoring = merges.filter(m => m.sum > 0);
  if (options.pressure === 'mergeZero' && scoring.length) drop(randomEmpty(next, rand));
  if (options.pressure === 'rubble') {
    // A group lists its tiles outward from the placed one, so the last
    // cleared tile is the farthest
    for (const m of scoring) if (m.from.length + 1 === MIN_GROUP) drop(m.from[m.from.length - 1]);
  }
  if (options.pressure === 'spawn') drop(spawnAt); // a tile played on blocks it
  return { cells: next, zeros, spawnAt: nextSpawn(next, options, rand) };
};

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
// picked at random, hold a random number from `values` (SEED_VALUES, the
// values the deck deals). Neighboring
// seeds never hold the same number, so no group exists before the first
// move under any option.
// A tile whose neighbors already hold every value stays empty.
export const SEED_FRACTION = 0.1;
export const SEED_VALUES = DECK.map(([v]) => v);

export const seedBoard = (
  tiles: Tile[], rand: () => number = Math.random, fraction = SEED_FRACTION, values = SEED_VALUES,
): Cell[] => {
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
    const allowed = values.filter(v => !tiles[id].neighbors.some(n => cells[n] === v));
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
// The top of the ladder: Z, 3 to the 25th. Making it wins the game,
// whatever the goal.
export const TOP_VALUE = 3 ** 25;

export type Outcome = { over: false } | { over: true; won: boolean; highest: number };

export const outcome = (cells: Cell[], options: Options): Outcome => {
  const highest = highestTile(cells);
  if (highest >= TOP_VALUE) return { over: true, won: true, highest };
  if (options.goal === 'target' && highest >= options.target) return { over: true, won: true, highest };
  if (boardFull(cells)) return { over: true, won: options.goal === 'highest', highest };
  return { over: false };
};
