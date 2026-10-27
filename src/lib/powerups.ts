// The power-ups (issue #33), described in one table: what each is called,
// how many a game starts with and holds, what earns it, and, for those used
// by tapping the board, what a tap does, what it previews and what it
// outlines. The game loops over the table, so adding a power-up is adding
// an entry here.

import {
  EMPTY, type Cell, type Merge, type PlaceResult, type Tile,
  ANY_SHAPE_MAX, CLEAR_MAX, SWAP_MAX, SWAP_SCORE_STEP, SWEEP_MAX, UNDO_MAX, UNDO_START, UPGRADE_MAX,
  anyShapesEarned, canClear, canSwap, canUpgrade, clearTile, clearsEarned, previewAt, previewSwapAt, previewUpgradeAt,
  swapAt, swapsEarned, sweepAt, sweepTargets, sweepsEarned, undosEarned, upgradeAt, upgradesEarned,
} from './rules';

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
  // Swap: the first tap picks a tile (`canPick`), outlined in `pickColor`,
  // and the second tap uses it. Tapping the picked tile again unpicks it,
  // and a tap on another tile it can't be used with picks that one instead.
  canPick?: (cells: Cell[], id: number) => boolean;
  pickColor?: string;
  // Whether a tap on `id` uses it; any other tap disarms it.
  canUse: (tiles: Tile[], cells: Cell[], id: number, first: number) => boolean;
  // The board after using it on `id`, with any merges it made (which then
  // settle like a move's: rubble, points and power-ups earned).
  apply: (tiles: Tile[], cells: Cell[], id: number, first: number) => PlaceResult;
  // The status line's opening once used. `held` is the charges held before.
  lead: (tiles: Tile[], cells: Cell[], id: number, first: number, held: number, label: (v: number) => string) => string;
  // The merge preview while hovering a tile it can be used on.
  preview?: (tiles: Tile[], cells: Cell[], id: number, first: number) => Preview;
  // The tiles it would empty, outlined in red while hovering `id`.
  doomed?: (tiles: Tile[], cells: Cell[], id: number) => number[];
}

export interface PowerUp {
  id: PowerUpId;
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
  hint?: (first: number, cells: Cell[], label: (v: number) => string) => string;
  tap?: TapUse;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const POWER_UPS: PowerUp[] = [
  {
    id: 'undo', symbol: '↶', short: 'Undo', name: 'Undo', start: UNDO_START, max: UNDO_MAX,
    title: 'Undo: step back one move (earned by making a new highest letter)',
    earned: ctx => undosEarned(ctx.highestBefore, ctx.merges),
    reason: (ctx, label) => `New letter ${label(ctx.highestAfter)}!`,
  },
  {
    id: 'clear', symbol: '✕', short: 'Clear', name: 'Clear', start: 0, max: CLEAR_MAX,
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
    id: 'anyShape', symbol: '◇', short: 'Shape', name: 'Any shape', start: 0, max: ANY_SHAPE_MAX,
    title: 'Any shape: place the next value on a kite or a dart (earned by completing suns and stars)',
    armedClass: 'bg-amber-500 border-amber-600',
    earned: ctx => anyShapesEarned(ctx.completed),
    reason: ctx => ctx.completed.map(kind => (kind === 'sun' ? 'Sun!' : 'Star!')).join(' '),
    hint: () => 'Any shape: place the Next letter on any empty tile, kite or dart (tap Shape again, or press Escape, to keep it).',
  },
  {
    id: 'upgrade', symbol: '⇧', short: 'Upgrade', name: 'Upgrade', start: 0, max: UPGRADE_MAX,
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
    id: 'sweep', symbol: '#', short: 'Sweep', name: 'Sweep', start: 0, max: SWEEP_MAX,
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
    id: 'swap', symbol: '⇆', short: 'Swap', name: 'Swap', start: 0, max: SWAP_MAX,
    title: 'Swap: exchange two tiles (earned every 500 points)',
    armedClass: 'bg-teal-600 border-teal-700',
    earned: ctx => swapsEarned(ctx.scoreBefore, ctx.scoreAfter),
    reason: ctx => `${Math.floor(ctx.scoreAfter / SWAP_SCORE_STEP) * SWAP_SCORE_STEP} points!`,
    hint: (first, cells, label) => (first < 0
      ? 'Swap: tap the first tile to swap (a letter or #; tap Swap again, or press Escape, to keep it).'
      : `Swap: now tap a tile holding something other than ${label(cells[first] as number)} to swap it with.`),
    tap: {
      canPick: (cells, id) => id >= 0 && cells[id] !== EMPTY,
      pickColor: '#0d9488',
      canUse: (_tiles, cells, id, first) => canSwap(cells, first, id),
      apply: (tiles, cells, id, first) => swapAt(tiles, cells, first, id),
      lead: (_tiles, cells, id, first, _held, label) => `Swapped ${label(cells[first] as number)} and ${label(cells[id] as number)}.`,
      preview: (tiles, cells, id, first) => previewSwapAt(tiles, cells, first, id),
    },
  },
];

// A power-up's entry in the table.
export const powerUp = (id: PowerUpId) => POWER_UPS.find(p => p.id === id)!;

// The charges a game starts with.
export const startCharges = (): Charges =>
  Object.fromEntries(POWER_UPS.map(p => [p.id, p.start])) as Charges;

// The charges after a move: the one `spent` (if any) taken off, then what
// the move earned added, each up to its power-up's cap. With a message for
// each power-up earned: "Chain! +1 Clear.", or at the cap "Chain! Clears
// full (3).".
export const earnCharges = (
  held: Charges, spent: PowerUpId | undefined, ctx: EarnContext, label: (v: number) => string,
) => {
  const charges = { ...held };
  if (spent) charges[spent] -= 1;
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
