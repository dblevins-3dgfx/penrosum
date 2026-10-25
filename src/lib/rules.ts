// Penrosum rules, as plain functions over the tile graph.
//
// The board is a list of tiles with neighbor lists (see penrose-board.ts).
// The game state is one number per tile. No rules are open questions
// right now (SPEC.md, "Open questions"); when one is, it gets an option
// here so its choices can be tried side by side.

export type Shape = 'kite' | 'dart';

// A merge needs this many matching tiles, counting the one just placed.
export const MIN_GROUP = 3;

// No number on the tile. A tile holding 0 is numbered: it can't be played
// on, and matches only a placed 0.
export const EMPTY = null;

export type Cell = number | null;

export interface Tile {
  neighbors: number[];
  type?: Shape; // needed for the dealt shape
}

// A move is legal on an un-numbered tile.
export const canPlace = (cells: Cell[], id: number) => cells[id] === EMPTY;

// The shape the next value must go on: the shape dealt with it, or null
// when any empty tile will do (no shape is given, or, as a safeguard, no
// empty tile of that shape is left; dealShape never deals one like that).
export const shapeToPlace = (tiles: Tile[], cells: Cell[], dealt: Shape | null): Shape | null =>
  dealt && tiles.some((t, i) => t.type === dealt && cells[i] === EMPTY) ? dealt : null;

// Whether the next value, dealt with `dealt` (or null), can go on `id`.
export const canPlaceDealt = (tiles: Tile[], cells: Cell[], id: number, dealt: Shape | null) => {
  if (!canPlace(cells, id)) return false;
  const shape = shapeToPlace(tiles, cells, dealt);
  return shape === null || tiles[id].type === shape;
};

// How often the dealt shape is a kite. Roughly the board's own share of
// kites (60 of 103 on the medium board).
export const KITE_CHANCE = 0.6;

// The shape dealt with the next value, on `cells`, the board it will be
// played on: only a shape that still has an empty tile, so once one shape's
// empty tiles are all filled, every value comes with the other. While both
// have one, a kite KITE_CHANCE of the time. `rand` returns a number in [0, 1).
export const dealShape = (tiles: Tile[], cells: Cell[], rand: () => number = Math.random): Shape => {
  const free = (shape: Shape) => tiles.some((t, i) => t.type === shape && cells[i] === EMPTY);
  if (!free('dart')) return 'kite';
  if (!free('kite')) return 'dart';
  return rand() < KITE_CHANCE ? 'kite' : 'dart';
};

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
}

export interface PlaceResult {
  cells: Cell[];
  merges: Merge[]; // in order; more than one when a chain reaction follows
}

// Places `value` on tile `id` and applies a merge if one forms: the tile
// takes what the group makes (see mergeResult) and the rest of the group
// is emptied. Then it merges
// again while its new number makes a group (a chain reaction). Every merge
// empties at least two numbered tiles and numbers none, so chains end.
// Assumes the move is legal (see canPlace). Returns new cells; the input is
// unchanged.
export const place = (tiles: Tile[], cells: Cell[], id: number, value: number): PlaceResult => {
  const next = cells.slice();
  next[id] = value;
  const merges: Merge[] = [];
  for (;;) {
    const group = groupAt(tiles, next, id);
    if (group.length < MIN_GROUP) break;
    const values = group.map(t => next[t]);
    const sum = mergeResult(values);
    const from = group.slice(1);
    for (const t of from) next[t] = EMPTY;
    next[id] = sum;
    merges.push({ into: id, from, sum });
  }
  return { cells: next, merges };
};

// What placing the drawn value on `id` would do, for the hover preview: the
// number the tile would end up with, every tile its merges would clear,
// where its rubble would land (`rubble`) and the 0s that rubble would merge
// away (in `merging` too).
export const previewAt = (tiles: Tile[], cells: Cell[], id: number, drawn: number) => {
  const value = valueToPlace(tiles, cells, id, drawn);
  const { cells: after, merges } = place(tiles, cells, id, value);
  const merging = merges.flatMap(m => m.from);
  const { zeros, rubbleMerges } = dropRubble(tiles, after, merges);
  return { value: after[id], merging: [...merging, ...rubbleMerges.flatMap(m => m.from)], rubble: zeros };
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
// 1, 3, 9, 27 ...
export const mergeResult = (values: number[]) => floorPow3(values.reduce((s, v) => s + v, 0));

// A value's rung: 1 for A (1), 2 for B (3), 3 for C (9) ... 26 for Z;
// 0 for #.
export const rungOf = (value: number) => {
  if (value < 1) return 0;
  let rung = 1;
  for (let p = 3; p <= value; p *= 3) rung++;
  return rung;
};

// What one merge scores: the rung it makes times the tiles merged. Rungs
// climb in even steps, so scores grow steadily, not threefold like the
// values. A merge of 0s (rung 0) scores 1 per tile instead, so clearing
// obstacles is worth something.
export const mergePoints = (merge: Merge) => {
  const tiles = merge.from.length + 1;
  const rung = rungOf(merge.sum);
  return rung === 0 ? tiles : rung * tiles;
};

// What a move's merges score, in order: each merge's points, times its
// place in the chain reaction (the chain bonus: x1, x2, x3 ...).
export const scoreMerges = (merges: Merge[]) =>
  merges.reduce((total, m, i) => total + mergePoints(m) * (i + 1), 0);

// What rubble merges score: 1 per tile, like any merge of 0s. They
// come after the chain, so they get no chain bonus.
export const scoreRubble = (rubbleMerges: Merge[]) =>
  rubbleMerges.reduce((total, m) => total + mergePoints(m), 0);

export type Deck = [number, number][]; // [value, chance], chances adding to 1

// The numbers the deck deals, and how they share the draws that aren't
// wildcards: 0 (#) a tenth, then 1, 3 and 9 (A, B, C) at 7 : 2 : 1.
export const NUMBERS: Deck = [[0, 0.1], [1, 0.63], [3, 0.18], [9, 0.09]];

// The wildcard, as a drawn value. It never sits on the board: placing it
// places the number resolveWild picks.
export const WILD = -1;

// How often a drawn value is WILD.
export const WILD_CHANCE = 0.05;

// The value for each move is drawn at random from DECK and shown in
// advance: WILD WILD_CHANCE of the time, otherwise a number from NUMBERS
// in its proportions.
export const DECK: Deck = [[WILD, WILD_CHANCE], ...NUMBERS.map(([v, w]) => [v, w * (1 - WILD_CHANCE)] as [number, number])];

// What a wildcard placed on `id` becomes: the number that does best there.
// It tries each number held by a neighbor and keeps the one whose move
// (chain reactions included) merges rather than not, then leaves the
// biggest number, then clears the most tiles; on a tie, the smaller
// number. If none of them merges, it is a 1.
export const resolveWild = (tiles: Tile[], cells: Cell[], id: number) => {
  const tried = [...new Set(tiles[id].neighbors.map(n => cells[n]).filter(c => c !== EMPTY))].sort((a, b) => a - b);
  let best = { value: 1, result: -1, cleared: 0 };
  for (const value of tried) {
    const { cells: after, merges } = place(tiles, cells, id, value);
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
export const valueToPlace = (tiles: Tile[], cells: Cell[], id: number, drawn: number) =>
  drawn === WILD ? resolveWild(tiles, cells, id) : drawn;

export interface RubbleResult {
  cells: Cell[];
  zeros: number[]; // the tiles that just got rubble
  rubbleMerges: Merge[]; // merges of 0s made by rubble landing, in order
}

// Rubble, the game's pressure: on `cells`, the board just after a move that
// made `merges`, each merge of exactly MIN_GROUP tiles leaves a 0 on its
// cleared tile farthest from the placed one. Rubble comes from the
// player's move, so it then merges like a placed 0: touching two or more
// connected 0s, it takes them into one 0 on its own tile. Merges of 0s
// (sum 0) leave no rubble.
export const dropRubble = (tiles: Tile[], cells: Cell[], merges: Merge[]): RubbleResult => {
  const next = cells.slice();
  const zeros: number[] = [];
  const rubbleMerges: Merge[] = [];
  for (const m of merges) {
    if (m.sum === 0 || m.from.length + 1 !== MIN_GROUP) continue;
    // A group lists its tiles outward from the placed one, so the last
    // cleared tile is the farthest
    const at = m.from[m.from.length - 1];
    if (next[at] !== EMPTY) continue;
    next[at] = 0;
    zeros.push(at);
    const group = groupAt(tiles, next, at);
    if (group.length < MIN_GROUP) continue;
    const from = group.slice(1);
    for (const t of from) next[t] = EMPTY;
    rubbleMerges.push({ into: at, from, sum: 0 });
  }
  return { cells: next, zeros, rubbleMerges };
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
export const SEED_VALUES = NUMBERS.map(([v]) => v);

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

// The top of the ladder: Z, 3 to the 25th. Making it wins the game at once.
export const TOP_VALUE = 3 ** 25;

export type Outcome = { over: false } | { over: true; won: boolean; highest: number };

// The goal is to use up the board: the game ends when no empty tile is
// left, and the result is the score. Making a Z ends it early, as a win.
export const outcome = (cells: Cell[]): Outcome => {
  const highest = highestTile(cells);
  if (highest >= TOP_VALUE) return { over: true, won: true, highest };
  if (boardFull(cells)) return { over: true, won: false, highest };
  return { over: false };
};
