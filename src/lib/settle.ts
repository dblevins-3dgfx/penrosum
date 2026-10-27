// Settling a move: what follows once a placed value (or an Upgrade or a
// Swap) has made its merges. Rubble drops, the points are added, the
// power-ups earned are added up to their caps, and the status line is
// written. A plain function, so the component only calls it.

import { valueLabel } from './labels';
import {
  type Cell, type Merge, type RosetteTiles, type Tile,
  ROSETTE_REWARD, SWAP_SCORE_STEP,
  addAnyShapes, addClears, addSweeps, addSwaps, addUndos, addUpgrades,
  anyShapesEarned, clearsEarned, dropRubble, highestTile, newlyCompleted,
  scoreMerges, scoreRubble, sweepsEarned, swapsEarned, undosEarned, upgradesEarned,
} from './rules';

// What a game holds between moves that settling changes: the board, the
// score, the power-up charges and the suns and stars completed.
export interface Holdings {
  cells: Cell[];
  score: number;
  undos: number;
  clears: number;
  anyShapes: number;
  upgrades: number;
  sweeps: number;
  swaps: number;
  completed: number[]; // indices into the rosettes
}

// The charges spent by the action being settled, taken off before the
// earnings are added (so a power-up at its cap can earn back the one spent).
export interface Spent {
  anyShape?: boolean;
  upgrade?: boolean;
  swap?: boolean;
}

export interface Settled extends Holdings {
  lastMove: number;
  message: string;
}

// "Merged 3 tiles into B, then 3 tiles into C"
export const describeMerges = (merges: Merge[], label: (v: number) => string = valueLabel) =>
  merges.length
    ? `Merged ${merges.map(m => `${m.from.length + 1} tiles into ${label(m.sum)}`).join(', then ')}`
    : '';

// Settles the merges an action made on tile `id`. `base` is the game
// before the action; `placed` is the board after its merges, before
// rubble. The status line starts with `lead` ("Wild played as B.",
// "Upgraded B to C." ...). The input is unchanged.
export const settle = (
  tiles: Tile[], rosettes: RosetteTiles[], base: Holdings, id: number,
  placed: Cell[], merges: Merge[], lead = '', spent: Spent = {},
  label: (v: number) => string = valueLabel,
): Settled => {
  const { cells: after, zeros, rubbleMerges } = dropRubble(tiles, placed, merges);
  const gained = scoreMerges(merges);
  const rubbleGained = scoreRubble(rubbleMerges);
  // A new highest letter earns Undo
  const earned = undosEarned(highestTile(base.cells), merges);
  const undos = addUndos(base.undos, earned);
  // Chains earn Clear
  const clearEarned = clearsEarned(merges);
  const clears = addClears(base.clears, clearEarned);
  // Suns and stars completed earn Any shape
  const completedNow = newlyCompleted(rosettes, after, base.completed);
  const shapesEarned = anyShapesEarned(rosettes, completedNow);
  const shapesHeld = base.anyShapes - (spent.anyShape ? 1 : 0);
  const anyShapes = addAnyShapes(shapesHeld, shapesEarned);
  const kinds = completedNow.map(i => rosettes[i].kind);
  // Big merges earn Upgrade
  const upgradeEarned = upgradesEarned(merges);
  const upgradesHeld = base.upgrades - (spent.upgrade ? 1 : 0);
  const upgrades = addUpgrades(upgradesHeld, upgradeEarned);
  // Rubble merges earn Sweep
  const sweepEarned = sweepsEarned(rubbleMerges);
  const sweeps = addSweeps(base.sweeps, sweepEarned);
  // Every 500 points earns a Swap
  const score = base.score + gained + rubbleGained;
  const swapEarned = swapsEarned(base.score, score);
  const swapsHeld = base.swaps - (spent.swap ? 1 : 0);
  const swaps = addSwaps(swapsHeld, swapEarned);
  return {
    cells: after,
    score,
    lastMove: id,
    undos,
    clears,
    anyShapes,
    upgrades,
    sweeps,
    swaps,
    completed: [...base.completed, ...completedNow],
    message: [
      lead,
      describeMerges(merges, label) + (gained ? ` (+${gained}).` : ''),
      zeros.length === 1 ? 'Rubble dropped a #.' : zeros.length ? `Rubble dropped ${zeros.length} #s.` : '',
      ...rubbleMerges.map(m => `Rubble merged ${m.from.length + 1} #s into one (+${scoreRubble([m])}).`),
      earned
        ? `New letter ${label(highestTile(placed))}! ${
          undos > base.undos ? `+${undos - base.undos} Undo` : `Undos full (${undos})`
        }.`
        : '',
      clearEarned ? `Chain! ${clears > base.clears ? '+1 Clear' : `Clears full (${clears})`}.` : '',
      ...kinds.map(k => `${k === 'sun' ? 'Sun' : 'Star'}! +${ROSETTE_REWARD[k]} Any shape.`),
      shapesEarned && anyShapes < shapesHeld + shapesEarned ? `Any shapes full (${anyShapes}).` : '',
      upgradeEarned
        ? `Big merge! ${upgrades > upgradesHeld ? `+${upgrades - upgradesHeld} Upgrade` : `Upgrades full (${upgrades})`}.`
        : '',
      sweepEarned
        ? `Rubble merge! ${sweeps > base.sweeps ? `+${sweeps - base.sweeps} Sweep` : `Sweeps full (${sweeps})`}.`
        : '',
      swapEarned
        ? `${Math.floor(score / SWAP_SCORE_STEP) * SWAP_SCORE_STEP} points! ${swaps > swapsHeld ? `+${swaps - swapsHeld} Swap` : `Swaps full (${swaps})`}.`
        : '',
    ].filter(Boolean).join(' '),
  };
};
