// The power-ups (issue #33): first their rules (what earns each and what
// each does), then one table describing them: what each is called,
// how many a game starts with and holds, what earns it, and, for those used
// by tapping the board, what a tap does, what it previews and what it
// outlines. The game loops over the table, so adding a power-up is adding
// an entry here.

import {
  EMPTY, TOP_VALUE, type Cell, type Merge, type PlaceResult, type Tile,
  place, previewAt, previewOf, rungOf,
} from './rules';

// Undo is a power-up: each Undo spends a charge (see undosEarned,
// undosAfterUndo). How many a game starts with, and the most held.
export const UNDO_START = 3;
export const UNDO_MAX = 5;

// The Undo charges a move earns: one for each rung its merges take the
// highest tile up, so making a letter for the first time in a game (D, E,
// F ...) earns one, and a merge that skips a rung (C to E) earns two.
// `highestBefore` is the highest tile before the move (it never goes down:
// a tile only leaves the board by merging into one at least as high). A
// value placed without a merge earns nothing.
export const undosEarned = (highestBefore: number, merges: Merge[]) => {
  const made = merges.reduce((m, { sum }) => Math.max(m, sum), 0);
  return Math.max(0, rungOf(made) - rungOf(highestBefore));
};

// The charges held after an Undo. `held` is the count now; `restored`
// is the count saved with the position Undo goes back to, from before the
// undone move. The lower of the two, less the one spent: so whatever the
// undone move earned is taken back, and spending is never refunded.
export const undosAfterUndo = (held: number, restored: number) => Math.max(0, Math.min(held, restored) - 1);

// The Clear power-up (issue #33): spending a charge empties one filled
// tile, a letter or a #. The most charges held.
export const CLEAR_MAX = 3;

// The Clear charges a move earns: one for a chain reaction, a move whose
// placed tile merges two or more times. Rubble merges don't count.
export const clearsEarned = (merges: Merge[]) => (merges.length >= 2 ? 1 : 0);

// Whether Clear can be used on tile `id`: it holds a letter or a #.
export const canClear = (cells: Cell[], id: number) => id >= 0 && id < cells.length && cells[id] !== EMPTY;

// The board after clearing tile `id` (see canClear). The input is unchanged.
export const clearTile = (cells: Cell[], id: number): Cell[] => {
  const next = cells.slice();
  next[id] = EMPTY;
  return next;
};

// The Any shape power-up (issue #33): spending a charge lets the next value
// go on an empty tile of either shape, ignoring the shape it was dealt. The
// most charges held.
export const ANY_SHAPE_MAX = 3;

// A sun (five kites) or a star (five darts) meeting at a point; see
// findRosettes in board.ts.
export interface RosetteTiles {
  kind: 'sun' | 'star';
  tiles: number[];
}

// What completing one earns: a star, the rarer, earns two.
export const ROSETTE_REWARD = { sun: 1, star: 2 } as const;

// The suns and stars (indices into `rosettes`) that `cells` completes for
// the first time: all five tiles filled (letters or #), and not already
// completed this game (`done`). Each counts once a game, so emptying one
// and filling it again earns nothing.
export const newlyCompleted = (rosettes: RosetteTiles[], cells: Cell[], done: readonly number[]) =>
  rosettes.flatMap((r, i) => (!done.includes(i) && r.tiles.every(t => cells[t] !== EMPTY) ? [i] : []));

// The Any shape charges earned by completing suns and stars of `kinds`.
export const anyShapesEarned = (kinds: RosetteTiles['kind'][]) =>
  kinds.reduce((sum, kind) => sum + ROSETTE_REWARD[kind], 0);

// The Upgrade power-up (issue #33): spending a charge raises one letter a
// rung (x3), and the tile then merges like a placed one. The most held.
export const UPGRADE_MAX = 3;

// The group size that counts as a big merge, which earns an Upgrade.
export const BIG_MERGE = 5;

// The Upgrade charges a move earns: one for each merge of letters with at
// least BIG_MERGE tiles (chain reactions included). Merges of #s and rubble
// merges don't count.
export const upgradesEarned = (merges: Merge[]) =>
  merges.filter(m => m.sum > 0 && m.from.length + 1 >= BIG_MERGE).length;

// Whether tile `id` can be upgraded: it holds a letter below Z (not a #,
// which would stay a #, and not empty).
export const canUpgrade = (cells: Cell[], id: number) => {
  const v = id >= 0 && id < cells.length ? cells[id] : EMPTY;
  return v !== EMPTY && v > 0 && v < TOP_VALUE;
};

// Upgrades tile `id` (see canUpgrade): it takes the next letter up and then
// merges, with chain reactions, as if that letter had just been placed
// there. The input is unchanged.
export const upgradeAt = (tiles: Tile[], cells: Cell[], id: number): PlaceResult => {
  const emptied = cells.slice();
  const value = (cells[id] as number) * 3;
  emptied[id] = EMPTY;
  return place(tiles, emptied, id, value);
};

// What upgrading `id` would do, for the preview: as previewAt.
export const previewUpgradeAt = (tiles: Tile[], cells: Cell[], id: number) =>
  previewOf(tiles, id, upgradeAt(tiles, cells, id));

// The Sweep power-up (issue #33): spending a charge clears every # on a
// tile and the tiles touching it. The most held.
export const SWEEP_MAX = 3;

// The Sweep charges a move earns: one for each rubble merge (rubble that
// lands and merges #s).
export const sweepsEarned = (rubbleMerges: Merge[]) => rubbleMerges.length;

// The #s a Sweep on tile `id` clears: on it and on the tiles touching it.
// Empty when there are none (the Sweep then does nothing).
export const sweepTargets = (tiles: Tile[], cells: Cell[], id: number) =>
  id < 0 || id >= tiles.length ? [] : [id, ...tiles[id].neighbors].filter(t => cells[t] === 0);

// The board after a Sweep on tile `id` (see sweepTargets). The input is
// unchanged.
export const sweepAt = (tiles: Tile[], cells: Cell[], id: number): Cell[] => {
  const next = cells.slice();
  for (const t of sweepTargets(tiles, cells, id)) next[t] = EMPTY;
  return next;
};

// The Swap power-up (issue #33): spending a charge exchanges what two tiles
// hold, and each then merges if it matches. The most held.
export const SWAP_MAX = 3;

// Points per Swap charge earned.
export const SWAP_SCORE_STEP = 500;

// The Swap charges a move earns: one for each multiple of SWAP_SCORE_STEP
// the score passes (from `before` to `after`).
export const swapsEarned = (before: number, after: number) =>
  Math.max(0, Math.floor(after / SWAP_SCORE_STEP) - Math.floor(before / SWAP_SCORE_STEP));

// Whether tiles `a` and `b` can be swapped: two different tiles, both
// filled (letters or #s), holding different values, and of the same shape
// (kite with kite, dart with dart) unless `anyShape` (Any shape armed
// too) lifts that.
export const canSwap = (tiles: Tile[], cells: Cell[], a: number, b: number, anyShape = false) =>
  a !== b && a >= 0 && b >= 0 && a < cells.length && b < cells.length &&
  cells[a] !== EMPTY && cells[b] !== EMPTY && cells[a] !== cells[b] &&
  (anyShape || tiles[a].type === tiles[b].type);

// Whether swapping `a` and `b` crosses shapes (a kite with a dart), which
// takes Any shape.
export const crossesShapes = (tiles: Tile[], a: number, b: number) => tiles[a].type !== tiles[b].type;

// Swaps tiles `a` and `b` (see canSwap): each takes the other's value, then
// merges, with chain reactions, as if just placed there: first `a`, then
// `b` (unless a's merge emptied it). The merges come back in that order.
// The input is unchanged.
export const swapAt = (tiles: Tile[], cells: Cell[], a: number, b: number): PlaceResult => {
  const swapped = cells.slice();
  swapped[a] = cells[b];
  swapped[b] = cells[a];
  const settleAt = (board: Cell[], id: number): PlaceResult => {
    const value = board[id];
    if (value === EMPTY) return { cells: board, merges: [] };
    const emptied = board.slice();
    emptied[id] = EMPTY;
    return place(tiles, emptied, id, value);
  };
  const first = settleAt(swapped, a);
  const second = settleAt(first.cells, b);
  return { cells: second.cells, merges: [...first.merges, ...second.merges] };
};

// What swapping `a` and `b` would do, for the preview of tile `b`: as
// previewAt. (Whether they can be swapped is canSwap.)
export const previewSwapAt = (tiles: Tile[], cells: Cell[], a: number, b: number) =>
  previewOf(tiles, b, swapAt(tiles, cells, a, b));


export type PowerUpId = 'undo' | 'clear' | 'anyShape' | 'upgrade' | 'sweep' | 'swap';

// The charges held of each power-up.
export type Charges = Record<PowerUpId, number>;

// The power-ups that are armed before use (all but Undo, which acts at
// once). At most one is armed at a time, so the armed one is a single
// value: one of these, or null for none.
export type ArmedPowerUp = Exclude<PowerUpId, 'undo'>;

// What a move's merges did, for working out what they earn.
export interface EarnContext {
  merges: Merge[]; // the move's merges, chain reactions included
  rubbleMerges: Merge[];
  highestBefore: number; // the highest tile before the move
  highestAfter: number; // and after its merges
  scoreBefore: number;
  scoreAfter: number;
  completed: ('sun' | 'star')[]; // the suns and stars it completed
}

// What the merge preview shows: see previewAt.
export type Preview = ReturnType<typeof previewAt>;

// A power-up used by tapping the board once armed. `first` is the tile
// picked by an earlier tap, for one that takes two (Swap), else -1.
export interface TapUse {
  // Swap: the first tap picks a tile (`canPick`), outlined in the
  // palette's picked color, and the second tap uses it. Tapping the picked tile again unpicks it,
  // and a tap on another tile it can't be used with picks that one instead.
  canPick?: (cells: Cell[], id: number) => boolean;
  // Swap: the placement power-up that can be armed along with it (Any
  // shape), lifting its shape limit; `free` below says whether it is. A
  // use that needs it (`usesFree`) spends its charge too.
  freedBy?: PowerUpId;
  usesFree?: (tiles: Tile[], id: number, first: number) => boolean;
  // Whether a tap on `id` uses it; any other tap disarms it.
  canUse: (tiles: Tile[], cells: Cell[], id: number, first: number, free: boolean) => boolean;
  // The board after using it on `id`, with any merges it made (which then
  // settle like a move's: rubble, points and power-ups earned).
  apply: (tiles: Tile[], cells: Cell[], id: number, first: number) => PlaceResult;
  // The status line's opening once used. `held` is the charges held before.
  lead: (tiles: Tile[], cells: Cell[], id: number, first: number, held: number, label: (v: number) => string) => string;
  // The merge preview while hovering a tile it can be used on.
  preview?: (tiles: Tile[], cells: Cell[], id: number, first: number, free: boolean) => Preview;
  // The tiles it would empty, outlined in red while hovering `id`.
  doomed?: (tiles: Tile[], cells: Cell[], id: number) => number[];
}

// How a power-up is used:
//   now:       it acts when its tray tile is tapped (Undo)
//   placement: armed, it changes where the next value can go, and the
//              next move spends it (Any shape)
//   board:     armed, the next tap on the board uses it there (Clear,
//              Upgrade, Sweep, Swap); see TapUse
export type PowerUpKind = 'now' | 'placement' | 'board';

export interface PowerUp {
  id: PowerUpId;
  kind: PowerUpKind;
  symbol: string; // on its tile in the tray
  short: string; // its name on the tile
  name: string; // its name in the status line ("+1 Any shape")
  start: number; // charges a game starts with
  max: number; // the most held
  title: string; // the tile's tooltip: what it does and what earns it
  armedClass?: string; // the tile's colors while armed (Tailwind classes)
  // The charges a move earns, before the cap, and the reason given for them
  earned: (ctx: EarnContext) => number;
  reason: (ctx: EarnContext, label: (v: number) => string) => string;
  // The status line while armed. `first` is as in TapUse.
  // `free` is as in TapUse.
  hint?: (first: number, cells: Cell[], label: (v: number) => string, tiles: Tile[], free: boolean) => string;
  tap?: TapUse;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const POWER_UPS: PowerUp[] = [
  {
    id: 'undo', kind: 'now', symbol: '↶', short: 'Undo', name: 'Undo', start: UNDO_START, max: UNDO_MAX,
    title: 'Undo: step back one move (earned by making a new highest letter)',
    earned: ctx => undosEarned(ctx.highestBefore, ctx.merges),
    reason: (ctx, label) => `New letter ${label(ctx.highestAfter)}!`,
  },
  {
    id: 'clear', kind: 'board', symbol: '✕', short: 'Clear', name: 'Clear', start: 0, max: CLEAR_MAX,
    title: 'Clear: empty one tile of your choice (earned by chain reactions)',
    armedClass: 'bg-red-600 border-red-700',
    earned: ctx => clearsEarned(ctx.merges),
    reason: () => 'Chain!',
    hint: () => 'Clear: tap a letter or # to empty it (tap Clear again, or press Escape, to keep it).',
    tap: {
      canUse: (_tiles, cells, id) => canClear(cells, id),
      apply: (_tiles, cells, id) => ({ cells: clearTile(cells, id), merges: [] }),
      lead: (_tiles, cells, id, _first, held, label) => `Cleared ${label(cells[id] as number)}. ${plural(held - 1, 'Clear')} left.`,
      doomed: (_tiles, cells, id) => (canClear(cells, id) ? [id] : []),
    },
  },
  {
    id: 'anyShape', kind: 'placement', symbol: '◇', short: 'Shape', name: 'Any shape', start: 0, max: ANY_SHAPE_MAX,
    title: 'Any shape: place the next value on a kite or a dart (earned by completing suns and stars)',
    armedClass: 'bg-amber-500 border-amber-600',
    earned: ctx => anyShapesEarned(ctx.completed),
    reason: ctx => ctx.completed.map(kind => (kind === 'sun' ? 'Sun!' : 'Star!')).join(' '),
    hint: () => 'Any shape: place the Next letter on any empty tile, kite or dart (tap Shape again, or press Escape, to keep it).',
  },
  {
    id: 'upgrade', kind: 'board', symbol: '⇧', short: 'Upgrade', name: 'Upgrade', start: 0, max: UPGRADE_MAX,
    title: 'Upgrade: raise one letter a rung (earned by merges of 5 or more tiles)',
    armedClass: 'bg-emerald-600 border-emerald-700',
    earned: ctx => upgradesEarned(ctx.merges),
    reason: () => 'Big merge!',
    hint: () => 'Upgrade: tap a letter to raise it a rung; it merges if it then matches (tap Upgrade again, or press Escape, to keep it).',
    tap: {
      canUse: (_tiles, cells, id) => canUpgrade(cells, id),
      apply: (tiles, cells, id) => upgradeAt(tiles, cells, id),
      lead: (_tiles, cells, id, _first, _held, label) => `Upgraded ${label(cells[id] as number)} to ${label((cells[id] as number) * 3)}.`,
      preview: (tiles, cells, id) => previewUpgradeAt(tiles, cells, id),
    },
  },
  {
    id: 'sweep', kind: 'board', symbol: '#', short: 'Sweep', name: 'Sweep', start: 0, max: SWEEP_MAX,
    title: 'Sweep: clear every # on a tile and the tiles touching it (earned by rubble merges)',
    armedClass: 'bg-slate-600 border-slate-700',
    earned: ctx => sweepsEarned(ctx.rubbleMerges),
    reason: () => 'Rubble merge!',
    hint: () => 'Sweep: tap a tile to clear every # on it and the tiles touching it (tap Sweep again, or press Escape, to keep it).',
    tap: {
      canUse: (tiles, cells, id) => sweepTargets(tiles, cells, id).length > 0,
      apply: (tiles, cells, id) => ({ cells: sweepAt(tiles, cells, id), merges: [] }),
      lead: (tiles, cells, id, _first, held) => `Swept ${plural(sweepTargets(tiles, cells, id).length, '#')}. ${plural(held - 1, 'Sweep')} left.`,
      doomed: (tiles, cells, id) => sweepTargets(tiles, cells, id),
    },
  },
  {
    id: 'swap', kind: 'board', symbol: '⇆', short: 'Swap', name: 'Swap', start: 0, max: SWAP_MAX,
    title: 'Swap: exchange two tiles (earned every 500 points)',
    armedClass: 'bg-teal-600 border-teal-700',
    earned: ctx => swapsEarned(ctx.scoreBefore, ctx.scoreAfter),
    reason: ctx => `${Math.floor(ctx.scoreAfter / SWAP_SCORE_STEP) * SWAP_SCORE_STEP} points!`,
    hint: (first, cells, label, tiles, free) => {
      if (first < 0) {
        return free
          ? 'Swap with Any shape: tap the first tile to swap, a letter or #; it can go with a tile of either shape (tap Swap again, or press Escape, to keep them).'
          : 'Swap: tap the first tile to swap, a letter or #; a kite swaps with a kite, a dart with a dart (tap Shape too to swap across shapes; tap Swap again, or press Escape, to keep it).';
      }
      const shape = free ? 'tile' : tiles[first].type ?? 'tile';
      return `Swap: now tap a ${shape} holding something other than ${label(cells[first] as number)} to swap it with.`;
    },
    tap: {
      canPick: (cells, id) => id >= 0 && cells[id] !== EMPTY,
      freedBy: 'anyShape',
      usesFree: (tiles, id, first) => crossesShapes(tiles, first, id),
      canUse: (tiles, cells, id, first, free) => canSwap(tiles, cells, first, id, free),
      apply: (tiles, cells, id, first) => swapAt(tiles, cells, first, id),
      lead: (tiles, cells, id, first, _held, label) =>
        `Swapped ${label(cells[first] as number)} and ${label(cells[id] as number)}${crossesShapes(tiles, first, id) ? ', across shapes with Any shape' : ''}.`,
      preview: (tiles, cells, id, first) => previewSwapAt(tiles, cells, first, id),
    },
  },
];

// A power-up's entry in the table.
export const powerUp = (id: PowerUpId) => POWER_UPS.find(p => p.id === id)!;

// The charges a game starts with.
export const startCharges = (): Charges =>
  Object.fromEntries(POWER_UPS.map(p => [p.id, p.start])) as Charges;

// The charges after a move: those `spent` taken off, then what
// the move earned added, each up to its power-up's cap. With a message for
// each power-up earned: "Chain! +1 Clear.", or at the cap "Chain! Clears
// full (3).".
export const earnCharges = (
  held: Charges, spent: PowerUpId[], ctx: EarnContext, label: (v: number) => string,
) => {
  const charges = { ...held };
  for (const id of spent) charges[id] -= 1;
  const messages: string[] = [];
  for (const p of POWER_UPS) {
    const earned = p.earned(ctx);
    if (!earned) continue;
    const before = charges[p.id];
    charges[p.id] = Math.min(p.max, before + earned);
    const got = charges[p.id] - before;
    messages.push(`${p.reason(ctx, label)} ${got ? `+${got} ${p.name}` : `${p.name}s full (${charges[p.id]})`}.`);
  }
  return { charges, messages };
};

// The power-up armed after tapping `tapped` in the tray: tapping the armed
// one disarms it, and tapping another arms that one instead (disarming the
// one that was armed).
export const toggleArmed = (armed: ArmedPowerUp | null, tapped: ArmedPowerUp): ArmedPowerUp | null =>
  armed === tapped ? null : tapped;
