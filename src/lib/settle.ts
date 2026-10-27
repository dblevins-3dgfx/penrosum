// Settling a move: what follows once a placed value (or a power-up used on
// the board) has made its merges. Rubble drops, the points are added, the
// power-ups earned are added up to their caps, and the status line is
// written. A plain function, so the component only calls it.

import { valueLabel } from './labels';
import { type Charges, type PowerUpId, type RosetteTiles, earnCharges, newlyCompleted } from './powerups';
import {
  type Cell, type Merge, type Tile,
  dropRubble, highestTile, scoreMerges, scoreRubble,
} from './rules';

// What a game holds between moves that settling changes: the board, the
// score, the power-up charges and the suns and stars completed.
export interface Holdings {
  cells: Cell[];
  score: number;
  charges: Charges;
  completed: number[]; // indices into the rosettes
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
// "Upgraded B to C." ...). `spent` lists the power-ups the action used
// (a swap across shapes uses Swap and Any shape): their charges are taken
// off before the earnings are added, so one at its cap can earn back the
// one spent. The input is unchanged.
export const settle = (
  tiles: Tile[], rosettes: RosetteTiles[], base: Holdings, id: number,
  placed: Cell[], merges: Merge[], lead = '', spent: PowerUpId[] = [],
  label: (v: number) => string = valueLabel,
): Settled => {
  const { cells: after, zeros, rubbleMerges } = dropRubble(tiles, placed, merges);
  const gained = scoreMerges(merges);
  const rubbleGained = scoreRubble(rubbleMerges);
  const score = base.score + gained + rubbleGained;
  const completedNow = newlyCompleted(rosettes, after, base.completed);
  const { charges, messages } = earnCharges(base.charges, spent, {
    merges,
    rubbleMerges,
    highestBefore: highestTile(base.cells),
    highestAfter: highestTile(placed),
    scoreBefore: base.score,
    scoreAfter: score,
    completed: completedNow.map(i => rosettes[i].kind),
  }, label);
  return {
    cells: after,
    score,
    lastMove: id,
    charges,
    completed: [...base.completed, ...completedNow],
    message: [
      lead,
      describeMerges(merges, label) + (gained ? ` (+${gained}).` : ''),
      zeros.length === 1 ? 'Rubble dropped a #.' : zeros.length ? `Rubble dropped ${zeros.length} #s.` : '',
      ...rubbleMerges.map(m => `Rubble merged ${m.from.length + 1} #s into one (+${scoreRubble([m])}).`),
      ...messages,
    ].filter(Boolean).join(' '),
  };
};
