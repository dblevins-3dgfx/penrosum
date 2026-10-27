import { describe, expect, it } from 'vitest';
import { valueLabel } from './labels';
import {
  type EarnContext, POWER_UPS, earnCharges, powerUp, startCharges, toggleArmed,
  UNDO_MAX, UNDO_START, undosAfterUndo, undosEarned,
  CLEAR_MAX, canClear, clearTile, clearsEarned,
  ANY_SHAPE_MAX, type RosetteTiles, anyShapesEarned, newlyCompleted,
  BIG_MERGE, UPGRADE_MAX, canUpgrade, previewUpgradeAt, upgradeAt, upgradesEarned,
  SWEEP_MAX, sweepAt, sweepTargets, sweepsEarned,
  SWAP_MAX, SWAP_SCORE_STEP, canSwap, previewSwapAt, swapAt, swapsEarned,
} from './powerups';
import { EMPTY, TOP_VALUE, type Cell, type Merge, type Tile, place } from './rules';

// A small graph to test on:
//
//   0 - 1 - 2 - 3
//       |
//       4 - 5
//
const tiles: Tile[] = [
  { neighbors: [1] },
  { neighbors: [0, 2, 4] },
  { neighbors: [1, 3] },
  { neighbors: [2] },
  { neighbors: [1, 5] },
  { neighbors: [4] },
];

const empty = (): Cell[] => tiles.map(() => EMPTY);
const cellsOf = (values: Record<number, number>): Cell[] => {
  const c = empty();
  for (const [id, v] of Object.entries(values)) c[Number(id)] = v;
  return c;
};

// Nothing earned
const quiet: EarnContext = {
  merges: [], rubbleMerges: [], highestBefore: 3, highestAfter: 3, scoreBefore: 0, scoreAfter: 0, completed: [],
};

// A line: 0 - 1 - 2
const line: Tile[] = [{ neighbors: [1] }, { neighbors: [0, 2] }, { neighbors: [1] }];

describe('the power-up table', () => {
  it('lists Undo, Clear, Any shape, Upgrade, Sweep and Swap, in tray order', () => {
    expect(POWER_UPS.map(p => p.short)).toEqual(['Undo', 'Clear', 'Shape', 'Upgrade', 'Sweep', 'Swap']);
  });

  it('starts a game with 3 Undos and none of the others', () => {
    expect(startCharges()).toEqual({ undo: UNDO_START, clear: 0, anyShape: 0, upgrade: 0, sweep: 0, swap: 0 });
  });

  it('gives every power-up that is armed a hint and a color, and Undo neither', () => {
    for (const p of POWER_UPS) {
      expect(!!p.hint).toBe(p.id !== 'undo');
      expect(!!p.armedClass).toBe(p.id !== 'undo');
      expect(p.start).toBeLessThanOrEqual(p.max);
    }
  });

  it('has Clear, Upgrade, Sweep and Swap used by tapping the board', () => {
    expect(POWER_UPS.filter(p => p.tap).map(p => p.id)).toEqual(['clear', 'upgrade', 'sweep', 'swap']);
  });

  it('says how each is used: Undo at once, Any shape on placement, the rest on the board', () => {
    expect(Object.fromEntries(POWER_UPS.map(p => [p.id, p.kind]))).toEqual({
      undo: 'now', clear: 'board', anyShape: 'placement', upgrade: 'board', sweep: 'board', swap: 'board',
    });
    // A power-up is used on the board exactly when it says how a tap uses it
    for (const p of POWER_UPS) expect(!!p.tap).toBe(p.kind === 'board');
  });
});

describe('earnCharges', () => {
  const held = startCharges();

  it('adds what a move earns, with a message for each', () => {
    const { charges, messages } = earnCharges(held, undefined, {
      ...quiet,
      merges: [{ into: 0, from: [1, 2], sum: 9 }, { into: 0, from: [3, 4], sum: 27 }],
      highestAfter: 27,
    }, valueLabel);
    expect(charges).toMatchObject({ undo: 5, clear: 1 });
    expect(messages).toEqual(['New letter D! +2 Undo.', 'Chain! +1 Clear.']);
  });

  it('holds each at its cap, saying so when nothing was gained', () => {
    const ctx = { ...quiet, scoreBefore: 490, scoreAfter: 510 };
    expect(earnCharges({ ...held, swap: 3 }, undefined, ctx, valueLabel)).toEqual({
      charges: { ...held, swap: 3 }, messages: ['500 points! Swaps full (3).'],
    });
    expect(earnCharges({ ...held, swap: 2 }, undefined, ctx, valueLabel).messages).toEqual(['500 points! +1 Swap.']);
  });

  it('takes off the charge spent first, and leaves the input unchanged', () => {
    const before = { ...held, sweep: 2 };
    expect(earnCharges(before, 'sweep', quiet, valueLabel)).toEqual({ charges: { ...held, sweep: 1 }, messages: [] });
    expect(before.sweep).toBe(2);
  });

  it('earns Any shape for suns and stars, naming each', () => {
    expect(earnCharges(held, undefined, { ...quiet, completed: ['star'] }, valueLabel).messages).toEqual(['Star! +2 Any shape.']);
  });
});

describe('power-ups used on the board', () => {
  const use = (id: 'clear' | 'upgrade' | 'sweep' | 'swap') => powerUp(id).tap!;

  it('Clear empties a letter or #, outlining it first', () => {
    const cells: Cell[] = [3, EMPTY, 0];
    expect(use('clear').canUse(line, cells, 1, -1)).toBe(false);
    expect(use('clear').doomed!(line, cells, 0)).toEqual([0]);
    expect(use('clear').apply(line, cells, 2, -1)).toEqual({ cells: [3, EMPTY, EMPTY], merges: [] });
    expect(use('clear').lead(line, cells, 2, -1, 1, valueLabel)).toBe('Cleared #. 0 Clears left.');
  });

  it('Sweep clears the #s on and beside a tile, counting them', () => {
    const cells: Cell[] = [0, 3, 0];
    expect(use('sweep').doomed!(line, cells, 1)).toEqual([0, 2]);
    expect(use('sweep').apply(line, cells, 1, -1).cells).toEqual([EMPTY, 3, EMPTY]);
    expect(use('sweep').lead(line, cells, 1, -1, 3, valueLabel)).toBe('Swept 2 #s. 2 Sweeps left.');
    expect(use('sweep').lead(line, cells, 0, -1, 2, valueLabel)).toBe('Swept 1 #. 1 Sweep left.');
  });

  it('Upgrade raises a letter and previews it', () => {
    const cells: Cell[] = [1, EMPTY, 0];
    expect(use('upgrade').canUse(line, cells, 2, -1)).toBe(false);
    expect(use('upgrade').apply(line, cells, 0, -1).cells[0]).toBe(3);
    expect(use('upgrade').lead(line, cells, 0, -1, 1, valueLabel)).toBe('Upgraded A to B.');
    expect(use('upgrade').preview!(line, cells, 0, -1).value).toBe(3);
  });

  it('Swap picks a filled tile first, then swaps it with one holding something else', () => {
    const cells: Cell[] = [1, 3, EMPTY];
    expect(use('swap').canPick!(cells, 0)).toBe(true);
    expect(use('swap').canPick!(cells, 2)).toBe(false);
    expect(use('swap').canUse(line, cells, 1, -1)).toBe(false);
    expect(use('swap').canUse(line, cells, 1, 0)).toBe(true);
    expect(use('swap').apply(line, cells, 1, 0).cells).toEqual([3, 1, EMPTY]);
    expect(use('swap').lead(line, cells, 1, 0, 1, valueLabel)).toBe('Swapped A and B.');
    expect(powerUp('swap').hint!(0, cells, valueLabel)).toBe('Swap: now tap a tile holding something other than A to swap it with.');
  });
});

describe('arming power-ups', () => {
  it('arms a power-up when none is armed', () => {
    expect(toggleArmed(null, 'clear')).toBe('clear');
  });

  it('disarms the armed power-up when it is tapped again', () => {
    expect(toggleArmed('swap', 'swap')).toBeNull();
  });

  it('arming one disarms the other, so at most one is armed', () => {
    expect(toggleArmed('upgrade', 'sweep')).toBe('sweep');
    expect(toggleArmed('anyShape', 'clear')).toBe('clear');
  });
});

describe('Undo as a power-up', () => {
  const merge = (sum: number): Merge => ({ into: 0, from: [1, 2], sum });

  it('a game starts with 3 charges and holds at most 5', () => {
    expect(UNDO_START).toBe(3);
    expect(UNDO_MAX).toBe(5);
  });

  it('making a letter for the first time in the game earns a charge', () => {
    expect(undosEarned(9, [merge(27)])).toBe(1); // first D
    expect(undosEarned(27, [merge(81)])).toBe(1); // first E
  });

  it('making a letter already on the board earns nothing', () => {
    expect(undosEarned(27, [merge(27)])).toBe(0);
    expect(undosEarned(27, [merge(3)])).toBe(0);
    expect(undosEarned(9, [])).toBe(0);
  });

  it('one charge for each rung the highest tile climbs, in a chain or by skipping a rung', () => {
    expect(undosEarned(9, [merge(27), merge(81)])).toBe(2); // D then E in one chain
    expect(undosEarned(9, [merge(81)])).toBe(2); // C straight to E
  });

  it('a merge of #s earns nothing', () => {
    expect(undosEarned(0, [merge(0)])).toBe(0);
  });

  it('an Undo spends a charge and takes back what the undone move earned', () => {
    // 3 held; a move earns one (4); Undo goes back to the 3 from before it
    expect(undosAfterUndo(4, 3)).toBe(2);
    // a second Undo, to a position saved with 3, from the 2 now held
    expect(undosAfterUndo(2, 3)).toBe(1);
    // never below zero
    expect(undosAfterUndo(0, 3)).toBe(0);
  });
});

describe('the Clear power-up', () => {
  const merge = (sum: number): Merge => ({ into: 0, from: [1, 2], sum });

  it('a chain reaction (two or more merges in a move) earns one charge', () => {
    expect(clearsEarned([merge(3), merge(9)])).toBe(1);
    expect(clearsEarned([merge(3), merge(9), merge(27)])).toBe(1);
  });

  it('a single merge, or none, earns nothing', () => {
    expect(clearsEarned([merge(3)])).toBe(0);
    expect(clearsEarned([])).toBe(0);
  });

  it('earns from a real chain reaction', () => {
    const star: Tile[] = [{ neighbors: [1, 2, 3, 4] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }];
    expect(clearsEarned(place(star, [EMPTY, 1, 1, 3, 3], 0, 1).merges)).toBe(1);
    expect(clearsEarned(place(star, [EMPTY, 1, 1, 3, 9], 0, 1).merges)).toBe(0);
  });

  it('holds at most 3', () => {
    expect(CLEAR_MAX).toBe(3);
  });

  it('empties a tile holding a letter or a #, and nothing else', () => {
    const c = cellsOf({ 0: 9, 1: 0 });
    expect(canClear(c, 0)).toBe(true);
    expect(canClear(c, 1)).toBe(true);
    expect(canClear(c, 2)).toBe(false); // empty
    expect(canClear(c, -1)).toBe(false); // off the board
    expect(clearTile(c, 0)).toEqual(cellsOf({ 1: 0 }));
    expect(clearTile(c, 1)).toEqual(cellsOf({ 0: 9 }));
    expect(c).toEqual(cellsOf({ 0: 9, 1: 0 })); // input unchanged
  });
});

describe('suns, stars and the Any shape power-up', () => {
  // A sun on tiles 0-4 and a star on tiles 5-9
  const rosettes: RosetteTiles[] = [
    { kind: 'sun', tiles: [0, 1, 2, 3, 4] },
    { kind: 'star', tiles: [5, 6, 7, 8, 9] },
  ];
  const board = (filled: number[]): Cell[] => Array.from({ length: 12 }, (_, i) => (filled.includes(i) ? 1 : EMPTY));

  it('a sun or star is completed when all five of its tiles are filled', () => {
    expect(newlyCompleted(rosettes, board([0, 1, 2, 3]), [])).toEqual([]);
    expect(newlyCompleted(rosettes, board([0, 1, 2, 3, 4]), [])).toEqual([0]);
    expect(newlyCompleted(rosettes, board([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), [])).toEqual([0, 1]);
  });

  it('# tiles count as filled', () => {
    const c = board([0, 1, 2, 3]);
    c[4] = 0;
    expect(newlyCompleted(rosettes, c, [])).toEqual([0]);
  });

  it('each counts once a game', () => {
    expect(newlyCompleted(rosettes, board([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), [0])).toEqual([1]);
    expect(newlyCompleted(rosettes, board([0, 1, 2, 3, 4]), [0])).toEqual([]);
  });

  it('a sun earns one Any shape, a star two', () => {
    expect(anyShapesEarned(['sun'])).toBe(1);
    expect(anyShapesEarned(['star'])).toBe(2);
    expect(anyShapesEarned(['sun', 'star'])).toBe(3);
    expect(anyShapesEarned([])).toBe(0);
  });

  it('holds at most 3', () => {
    expect(ANY_SHAPE_MAX).toBe(3);
  });
});

describe('the Upgrade power-up', () => {
  const merge = (tiles: number, sum: number): Merge => ({ into: 0, from: Array.from({ length: tiles - 1 }, (_, i) => i + 1), sum });
  // A star: 0 in the middle, touching 1 to 4
  const star: Tile[] = [{ neighbors: [1, 2, 3, 4] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }];

  it('a merge of 5 or more letters earns one, each in a chain counting', () => {
    expect(BIG_MERGE).toBe(5);
    expect(upgradesEarned([merge(5, 3)])).toBe(1);
    expect(upgradesEarned([merge(7, 9)])).toBe(1);
    expect(upgradesEarned([merge(5, 3), merge(5, 9)])).toBe(2);
  });

  it('smaller merges, and merges of #s, earn nothing', () => {
    expect(upgradesEarned([merge(4, 3), merge(3, 9)])).toBe(0);
    expect(upgradesEarned([merge(6, 0)])).toBe(0);
  });

  it('holds at most 3', () => {
    expect(UPGRADE_MAX).toBe(3);
  });

  it('upgrades a letter below Z, not a #, an empty tile or a Z', () => {
    const c: Cell[] = [9, 0, EMPTY, TOP_VALUE, 1];
    expect([0, 1, 2, 3, 4, -1].map(id => canUpgrade(c, id))).toEqual([true, false, false, false, true, false]);
  });

  it('raises the letter a rung', () => {
    const { cells, merges } = upgradeAt(star, [9, EMPTY, EMPTY, 3, EMPTY], 0);
    expect(cells[0]).toBe(27);
    expect(merges).toEqual([]);
  });

  it('then merges as if just placed, chain reactions included', () => {
    // A B in the middle with two Cs and two Ds around: B becomes C, merges
    // with the Cs into D, which merges with the Ds into E
    const before: Cell[] = [3, 9, 9, 27, 27];
    const { cells, merges } = upgradeAt(star, before, 0);
    expect(merges.map(m => m.sum)).toEqual([27, 81]);
    expect(cells).toEqual([81, EMPTY, EMPTY, EMPTY, EMPTY]);
    expect(before).toEqual([3, 9, 9, 27, 27]); // input unchanged
  });

  it('the preview shows what an upgrade would do', () => {
    expect(previewUpgradeAt(star, [3, 9, 9, EMPTY, EMPTY], 0)).toEqual({ value: 27, merging: [1, 2], rubble: [2] });
  });
});

describe('the Sweep power-up', () => {
  // A star: 0 in the middle, touching 1 to 4; 5 touches only 4
  const star: Tile[] = [
    { neighbors: [1, 2, 3, 4] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0, 5] }, { neighbors: [4] },
  ];
  const rubble = (n: number): Merge[] => Array.from({ length: n }, () => ({ into: 0, from: [1, 2], sum: 0 }));

  it('each rubble merge earns one', () => {
    expect(sweepsEarned(rubble(1))).toBe(1);
    expect(sweepsEarned(rubble(2))).toBe(2);
    expect(sweepsEarned([])).toBe(0);
  });

  it('holds at most 3', () => {
    expect(SWEEP_MAX).toBe(3);
  });

  it('clears every # on the tile and the tiles touching it, and nothing else', () => {
    const c: Cell[] = [EMPTY, 0, 3, 0, 0, 0];
    expect(sweepTargets(star, c, 0)).toEqual([1, 3, 4]);
    expect(sweepAt(star, c, 0)).toEqual([EMPTY, EMPTY, 3, EMPTY, EMPTY, 0]);
    expect(c).toEqual([EMPTY, 0, 3, 0, 0, 0]); // input unchanged
  });

  it('includes the tile itself when it is a #', () => {
    expect(sweepTargets(star, [EMPTY, 0, 3, 0, 0, 0], 4)).toEqual([4, 5]);
  });

  it('finds nothing where no # is near, or off the board', () => {
    expect(sweepTargets(star, [EMPTY, 1, 3, EMPTY, EMPTY, 0], 0)).toEqual([]);
    expect(sweepTargets(star, [EMPTY, 0, 0, 0, 0, 0], -1)).toEqual([]);
  });
});

describe('the Swap power-up', () => {
  it('earns one for each 500 points the score passes', () => {
    expect(SWAP_SCORE_STEP).toBe(500);
    expect(swapsEarned(480, 520)).toBe(1);
    expect(swapsEarned(400, 499)).toBe(0);
    expect(swapsEarned(499, 1001)).toBe(2);
    expect(swapsEarned(500, 500)).toBe(0);
  });

  it('holds at most 3', () => {
    expect(SWAP_MAX).toBe(3);
  });

  it('swaps two different filled tiles with different values', () => {
    const c: Cell[] = [1, 3, 3, EMPTY, 0];
    expect(canSwap(c, 0, 1)).toBe(true);
    expect(canSwap(c, 0, 4)).toBe(true); // a letter and a #
    expect(canSwap(c, 1, 2)).toBe(false); // the same letter
    expect(canSwap(c, 0, 0)).toBe(false); // one tile
    expect(canSwap(c, 0, 3)).toBe(false); // an empty tile
    expect(canSwap(c, -1, 0)).toBe(false);
  });

  it('exchanges the values', () => {
    // the line 0-1-2-3, 4-5: nothing matches after
    const { cells, merges } = swapAt(tiles, [1, 3, EMPTY, EMPTY, 9, EMPTY], 0, 4);
    expect(cells).toEqual([9, 3, EMPTY, EMPTY, 1, EMPTY]);
    expect(merges).toEqual([]);
  });

  it('then each swapped tile merges if it matches, chain reactions included', () => {
    // A star: 0 in the middle, touching 1 to 4; 5 touches 4 only.
    // Swapping the C at 5 with the A at 0 puts C beside two Cs: they merge
    // into D at 0.
    const star: Tile[] = [
      { neighbors: [1, 2, 3, 4] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0, 5] }, { neighbors: [4] },
    ];
    const before: Cell[] = [1, 9, 9, EMPTY, 3, 9];
    const { cells, merges } = swapAt(star, before, 0, 5);
    expect(merges).toEqual([{ into: 0, from: [1, 2], sum: 27 }]);
    expect(cells).toEqual([27, EMPTY, EMPTY, EMPTY, 3, 1]);
    expect(before).toEqual([1, 9, 9, EMPTY, 3, 9]); // input unchanged
    expect(previewSwapAt(star, before, 0, 5).merging).toEqual([1, 2]);
  });
});
