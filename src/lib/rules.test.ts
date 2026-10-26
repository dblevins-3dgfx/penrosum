import { describe, expect, it } from 'vitest';
import { makeBoard } from './board';
import {
  EMPTY, type Cell, type Tile,
  DECK, NUMBERS, SEED_FRACTION, SEED_VALUES, WILD, WILD_CHANCE,
  boardFull, canPlace, drawValue, groupAt, highestTile, outcome, place, previewAt, resolveWild, seedBoard, valueToPlace,
  dropRubble,
  canPlaceDealt, dealShape, kiteChance, shapeToPlace,
  type Deal, shapeInPlay, swapSpare, tapAction,
  UNDO_MAX, UNDO_START, addUndos, undosAfterUndo, undosEarned,
  CLEAR_MAX, addClears, canClear, clearTile, clearsEarned,
  ANY_SHAPE_MAX, type RosetteTiles, addAnyShapes, anyShapesEarned, newlyCompleted,
  BIG_MERGE, UPGRADE_MAX, addUpgrades, canUpgrade, previewUpgradeAt, upgradeAt, upgradesEarned,
  SWEEP_MAX, addSweeps, sweepAt, sweepTargets, sweepsEarned,
  SWAP_MAX, SWAP_SCORE_STEP, addSwaps, canSwap, previewSwapAt, swapAt, swapsEarned,
  TOP_VALUE, floorPow3, mergeResult,
  type Merge, mergePoints, rungOf, scoreMerges, scoreRubble,
} from './rules';

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

describe('canPlace', () => {
  it('allows only un-numbered tiles', () => {
    const c = cellsOf({ 0: 1, 1: 0 });
    expect(canPlace(c, 0)).toBe(false);
    expect(canPlace(c, 1)).toBe(false); // a zero is numbered
    expect(canPlace(c, 2)).toBe(true);
  });
});

// Kite 0 touches kite 1, dart 2 and kite 3; kite 1 also touches dart 4.
//
//   4 - 1 - 0 - 3
//           |
//           2
//
const shaped: Tile[] = [
  { neighbors: [1, 2, 3], type: 'kite' },
  { neighbors: [0, 4], type: 'kite' },
  { neighbors: [0], type: 'dart' },
  { neighbors: [0], type: 'kite' },
  { neighbors: [1], type: 'dart' },
];

describe('groupAt', () => {
  it('follows matching tiles beyond the direct neighbors', () => {
    const c = cellsOf({ 0: 1, 1: 1, 2: 1, 3: 1 });
    expect(groupAt(tiles, c, 3).sort()).toEqual([0, 1, 2, 3]);
  });

  it('does not pass through a tile with a different number', () => {
    const c = cellsOf({ 0: 1, 1: 2, 2: 1, 3: 1 });
    expect(groupAt(tiles, c, 3).sort()).toEqual([2, 3]);
  });

  it('leaves out neighbors with a different number', () => {
    const c = cellsOf({ 0: 1, 1: 1, 2: 2, 4: 1 });
    expect(groupAt(tiles, c, 1).sort()).toEqual([0, 1, 4]);
  });

  it('matches across shapes: kites and darts with the same number group together', () => {
    const c: Cell[] = [1, 1, 1, 1, 1];
    expect(groupAt(shaped, c, 0).sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('lists the placed tile first', () => {
    const c = cellsOf({ 0: 1, 1: 1, 2: 1 });
    expect(groupAt(tiles, c, 2)[0]).toBe(2);
  });
});

describe('place', () => {
  it('does not merge fewer than three tiles', () => {
    const { cells, merges } = place(tiles, cellsOf({ 0: 1 }), 1, 1);
    expect(merges).toEqual([]);
    expect(cells).toEqual(cellsOf({ 0: 1, 1: 1 }));
  });

  it('merges three tiles into the one just placed', () => {
    const { cells, merges } = place(tiles, cellsOf({ 0: 1, 2: 1 }), 1, 1);
    expect(merges).toEqual([{ into: 1, from: [0, 2], sum: 3 }]);
    expect(cells).toEqual(cellsOf({ 1: 3 }));
  });

  it('three Bs (3s) make a C (9)', () => {
    const { cells } = place(tiles, cellsOf({ 0: 3, 2: 3 }), 1, 3);
    expect(cells).toEqual(cellsOf({ 1: 9 }));
  });

  it('does not merge tiles with different numbers', () => {
    const { cells, merges } = place(tiles, cellsOf({ 0: 1, 2: 2 }), 1, 1);
    expect(merges).toEqual([]);
    expect(cells).toEqual(cellsOf({ 0: 1, 1: 1, 2: 2 }));
  });

  it('merges only the matching tiles in a mixed cluster', () => {
    const { cells } = place(tiles, cellsOf({ 0: 1, 2: 1, 4: 3 }), 1, 1);
    expect(cells).toEqual(cellsOf({ 1: 3, 4: 3 }));
  });

  it('a chain collapses into the placed tile, even from its end', () => {
    // Four As: 4, rounded down to B (3)
    const { cells } = place(tiles, cellsOf({ 0: 1, 1: 1, 2: 1 }), 3, 1);
    expect(cells).toEqual(cellsOf({ 3: 3 }));
  });

  it('merged-away tiles become empty, and can be played again', () => {
    const { cells } = place(tiles, cellsOf({ 0: 1, 2: 1 }), 1, 1);
    expect(cells[0]).toBe(EMPTY);
    expect(cells[2]).toBe(EMPTY);
    expect(canPlace(cells, 0)).toBe(true);
  });

  it('zeros never match a placed 1, so a 1 between two zeros does not merge', () => {
    expect(place(tiles, cellsOf({ 0: 0, 2: 0 }), 1, 1).merges).toEqual([]);
  });

  it('does not change the input', () => {
    const before = cellsOf({ 0: 1, 2: 1 });
    place(tiles, before, 1, 1);
    expect(before).toEqual(cellsOf({ 0: 1, 2: 1 }));
  });
});

describe('chain reactions', () => {
  // A star: 0 in the middle, touching 1 to 4
  const star: Tile[] = [
    { neighbors: [1, 2, 3, 4] },
    { neighbors: [0] },
    { neighbors: [0] },
    { neighbors: [0] },
    { neighbors: [0] },
  ];
  // Two 1s and two 3s around the middle; placing a 1 there makes a 3
  const start: Cell[] = [EMPTY, 1, 1, 3, 3];

  it('the new number merges again with matching tiles', () => {
    const { cells, merges } = place(star, start, 0, 1);
    expect(merges).toEqual([
      { into: 0, from: [1, 2], sum: 3 },
      { into: 0, from: [3, 4], sum: 9 },
    ]);
    expect(cells).toEqual([9, EMPTY, EMPTY, EMPTY, EMPTY]);
  });

  it('stops when the new number makes no group', () => {
    const { merges } = place(star, [EMPTY, 1, 1, 3, 4], 0, 1);
    expect(merges).toHaveLength(1);
  });
});

describe('previewAt', () => {
  it('shows the placed value when nothing would merge', () => {
    expect(previewAt(tiles, cellsOf({ 0: 1 }), 1, 1)).toEqual({ value: 1, merging: [], rubble: [] });
  });

  it('shows the final number and every tile that would be cleared', () => {
    const star: Tile[] = [{ neighbors: [1, 2, 3, 4] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }];
    expect(previewAt(star, [EMPTY, 1, 1, 3, 3], 0, 1))
      .toEqual({ value: 9, merging: [1, 2, 3, 4], rubble: [2, 4] });
  });
});

describe('placing zeros', () => {
  // A star: 0 in the middle, touching 1 to 4
  const star: Tile[] = [
    { neighbors: [1, 2, 3, 4] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] },
  ];

  it('a placed 0 merges neighboring zeros into one, where it was placed', () => {
    const { cells, merges } = place(star, [EMPTY, 0, 0, 0, 1], 0, 0);
    expect(merges).toEqual([{ into: 0, from: [1, 2, 3], sum: 0 }]);
    expect(cells).toEqual([0, EMPTY, EMPTY, EMPTY, 1]);
  });

  it('a placed 0 follows connected zeros like any other number', () => {
    const { cells } = place(tiles, cellsOf({ 0: 0, 1: 0, 2: 0 }), 3, 0);
    expect(cells).toEqual(cellsOf({ 3: 0 }));
  });

  it('a placed 0 does not match other numbers, and zeros still do not match placed 1s', () => {
    expect(place(star, [EMPTY, 1, 1, 0, EMPTY], 0, 0).merges).toEqual([]);
    expect(place(star, [EMPTY, 0, 0, 1, EMPTY], 0, 1).merges).toEqual([]);
  });

  it('a merge of zeros leaves a 0 that stays put', () => {
    // The zeros merge into the middle; the 0 left there touches only 1s
    const { cells, merges } = place(star, [EMPTY, 0, 0, 1, 1], 0, 0);
    expect(merges).toHaveLength(1);
    expect(cells).toEqual([0, EMPTY, EMPTY, 1, 1]);
  });

  it('the preview shows a placed 0 and the zeros it would clear', () => {
    expect(previewAt(star, [EMPTY, 0, 0, 1, EMPTY], 0, 0)).toEqual({ value: 0, merging: [1, 2], rubble: [] });
  });
});

describe('the deck', () => {
  it('a draw is wild WILD_CHANCE of the time', () => {
    expect(DECK[0]).toEqual([WILD, WILD_CHANCE]);
    expect(DECK.reduce((t, [, w]) => t + w, 0)).toBeCloseTo(1, 12);
    expect(drawValue(() => 0)).toBe(WILD);
    expect(drawValue(() => WILD_CHANCE - 0.001)).toBe(WILD);
    expect(drawValue(() => WILD_CHANCE)).toBe(0);
  });

  it('otherwise # (0) a tenth of the time, then A, B and C (1, 3, 9) at 7 : 2 : 1', () => {
    expect(NUMBERS.reduce((t, [, w]) => t + w, 0)).toBeCloseTo(1, 12);
    expect(DECK.slice(1).map(([v]) => v)).toEqual([0, 1, 3, 9]);
    const share = (v: number) => DECK.find(([d]) => d === v)![1] / (1 - WILD_CHANCE);
    expect(share(0)).toBeCloseTo(0.1, 12);
    expect(share(1)).toBeCloseTo(0.63, 12);
    expect(share(3)).toBeCloseTo(0.18, 12);
    expect(share(9)).toBeCloseTo(0.09, 12);
    expect(drawValue(() => 0.999)).toBe(9);
  });

  it('draws from another deck when given one', () => {
    expect(drawValue(() => 0, NUMBERS)).toBe(0);
    expect(drawValue(() => 0.1, NUMBERS)).toBe(1);
    expect(drawValue(() => 0.73, NUMBERS)).toBe(3);
    expect(drawValue(() => 0.91, NUMBERS)).toBe(9);
  });
});

describe('wildcards', () => {
  // A star: 0 in the middle, touching 1 to 4
  const star: Tile[] = [
    { neighbors: [1, 2, 3, 4] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] },
  ];

  it('becomes the number that merges', () => {
    expect(resolveWild(star, [EMPTY, 2, 2, 1, EMPTY], 0)).toBe(2);
  });

  it('prefers the merge that leaves the biggest number', () => {
    // As A (1) it makes B (3); as C (9) it makes D (27)
    expect(resolveWild(star, [EMPTY, 1, 1, 9, 9], 0)).toBe(9);
  });

  it('counts chain reactions when judging a merge', () => {
    // As 1: 1+1+1 = 3, which then merges with the two 3s into 9.
    // As 2: no merge (one 2). So 1 wins, through its chain.
    const cells: Cell[] = [EMPTY, 1, 1, 3, 3];
    const chain: Tile[] = [
      { neighbors: [1, 2, 3, 4, 5] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] },
    ];
    expect(resolveWild(chain, [...cells, 2], 0)).toBe(1);
    expect(place(chain, [...cells, 2], 0, 1).cells[0]).toBe(9);
  });

  it('prefers any merge to none, even a merge of zeros', () => {
    // As 0 it merges two zeros (leaving 0); as 1 nothing merges
    expect(resolveWild(star, [EMPTY, 0, 0, 1, EMPTY], 0)).toBe(0);
  });

  it('when two merges leave the same number, prefers the one clearing more tiles', () => {
    // A hub touching five 1s and two 2s: as 1 it makes 6 clearing five
    // tiles; as 2 it also makes 6 but clears two
    const hub: Tile[] = [{ neighbors: [1, 2, 3, 4, 5, 6, 7] }, ...Array.from({ length: 7 }, () => ({ neighbors: [0] }))];
    expect(resolveWild(hub, [EMPTY, 1, 1, 1, 1, 1, 2, 2], 0)).toBe(1);
  });

  it('is a 1 when no number would merge', () => {
    expect(resolveWild(star, [EMPTY, 2, 3, 0, EMPTY], 0)).toBe(1);
    expect(resolveWild(star, [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], 0)).toBe(1);
  });

  it('can join numbers bigger than the deck holds', () => {
    expect(resolveWild(star, [EMPTY, 27, 27, EMPTY, EMPTY], 0)).toBe(27);
  });

  it('only a drawn wildcard is resolved; numbers place as themselves', () => {
    expect(valueToPlace(star, [EMPTY, 2, 2, EMPTY, EMPTY], 0, WILD)).toBe(2);
    expect(valueToPlace(star, [EMPTY, 2, 2, EMPTY, EMPTY], 0, 1)).toBe(1);
  });

  it('the preview shows what the wildcard would make', () => {
    expect(previewAt(star, [EMPTY, 3, 3, EMPTY, EMPTY], 0, WILD)).toEqual({ value: 9, merging: [1, 2], rubble: [2] });
  });
});

describe('highestTile and boardFull', () => {
  it('reads the board', () => {
    expect(highestTile(empty())).toBe(0);
    expect(highestTile(cellsOf({ 2: 7, 4: 3 }))).toBe(7);
    expect(boardFull(cellsOf({ 0: 1, 1: 0, 2: 1, 3: 1, 4: 1 }))).toBe(false);
    expect(boardFull(cellsOf({ 0: 1, 1: 0, 2: 1, 3: 1, 4: 1, 5: 2 }))).toBe(true);
  });
});

describe('outcome', () => {
  it('goes on while a tile is free', () => {
    expect(outcome(cellsOf({ 0: 81 }))).toEqual({ over: false });
  });

  it('ends when the board is full, with the highest tile', () => {
    const full = cellsOf({ 0: 9, 1: 1, 2: 0, 3: 1, 4: 1, 5: 1 });
    expect(outcome(full)).toEqual({ over: true, won: false, highest: 9 });
  });
});

describe('seedBoard', () => {
  // A repeatable random source (a small linear congruential generator)
  const rng = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
  const board = makeBoard(800, 600);

  it('numbers about a tenth of the tiles, with 0 to 3', () => {
    const cells = seedBoard(board, rng(1));
    const seeded = cells.filter(c => c !== EMPTY);
    expect(seeded).toHaveLength(Math.round(board.length * SEED_FRACTION));
    for (const v of seeded) expect(SEED_VALUES).toContain(v);
  });

  it('uses every seed value', () => {
    const cells = seedBoard(board, rng(2));
    for (const v of SEED_VALUES) expect(cells).toContain(v);
  });

  it('never gives neighboring seeds the same number, so nothing can merge yet', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const cells = seedBoard(board, rng(seed));
      for (const t of board) {
        if (cells[t.id] === EMPTY) continue;
        for (const n of t.neighbors) expect(cells[n]).not.toBe(cells[t.id]);
        expect(groupAt(board, cells, t.id)).toEqual([t.id]);
      }
    }
  });

  it('is random: different games start differently', () => {
    expect(seedBoard(board, rng(1))).toEqual(seedBoard(board, rng(1)));
    expect(seedBoard(board, rng(1))).not.toEqual(seedBoard(board, rng(2)));
  });

  it('leaves a tile empty when its neighbors already hold every value', () => {
    // A star: the middle (0) touches tiles 1 to 4
    const star: Tile[] = [
      { neighbors: [1, 2, 3, 4] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] },
    ];
    // The shuffle's draws visit the middle last (order 4, 1, 2, 3, 0); the
    // value draws then give the leaves 0, 1, 3 and 9
    const draws = [0, 0.999, 0.999, 0.999, 0, 0.25, 0.5, 0.75];
    let i = 0;
    const cells = seedBoard(star, () => draws[i++], 1);
    expect(cells).toEqual([EMPTY, 1, 3, 9, 0]);
  });
});

describe('rubble', () => {
  // A merge of three 1s into tile 1 of the line graph, clearing 0 and 2
  const merged = () => place(tiles, cellsOf({ 0: 1, 2: 1 }), 1, 1);

  it('a move without a merge drops nothing', () => {
    const { cells, merges } = place(tiles, cellsOf({ 0: 1 }), 1, 1);
    expect(dropRubble(tiles, cells, merges)).toEqual({ cells, zeros: [], rubbleMerges: [] });
  });

  it('a merge of zeros never leaves rubble', () => {
    const { cells, merges } = place(tiles, cellsOf({ 0: 0, 2: 0 }), 1, 0);
    expect(merges).toHaveLength(1);
    expect(dropRubble(tiles, cells, merges).zeros).toEqual([]);
  });

  it('a 3-tile merge leaves a 0 on its cleared tile farthest from the placed one', () => {
    // Placing at 2 merges the chain 2-1-0; tile 0 is the farthest
    const { cells, merges } = place(tiles, cellsOf({ 0: 1, 1: 1 }), 2, 1);
    expect(merges[0].from).toEqual([1, 0]);
    const r = dropRubble(tiles, cells, merges);
    expect(r.zeros).toEqual([0]);
    expect(r.cells).toEqual(cellsOf({ 0: 0, 2: 3 }));
  });

  it('bigger merges leave none', () => {
    const { cells, merges } = place(tiles, cellsOf({ 0: 1, 1: 1, 2: 1 }), 3, 1);
    expect(merges[0].from).toHaveLength(3);
    expect(dropRubble(tiles, cells, merges).zeros).toEqual([]);
  });

  it('each 3-tile merge in a chain leaves its own', () => {
    // A star: 1s at 1 and 2, 3s at 3 and 4; both merges are 3 tiles
    const star: Tile[] = [
      { neighbors: [1, 2, 3, 4] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] },
    ];
    const { cells, merges } = place(star, [EMPTY, 1, 1, 3, 3], 0, 1);
    expect(dropRubble(star, cells, merges).cells).toEqual([9, EMPTY, 0, EMPTY, 0]);
  });

  // 1s at 0 and 1, 0s at 5 and 6, both touching 0 (3 and 4 unused):
  //   5, 6 - 0 - 1 - 2
  // Placing a 1 at 2 merges 2-1-0, and the rubble lands on 0
  const g: Tile[] = [
    { neighbors: [1, 5, 6] }, { neighbors: [0, 2] }, { neighbors: [1] },
    { neighbors: [] }, { neighbors: [] }, { neighbors: [0] }, { neighbors: [0] },
  ];

  it('lands touching two 0s and merges them into one on its tile', () => {
    const { cells, merges } = place(g, [1, 1, EMPTY, EMPTY, EMPTY, 0, 0], 2, 1);
    expect(merges[0].from).toEqual([1, 0]);
    const r = dropRubble(g, cells, merges);
    expect(r.zeros).toEqual([0]);
    expect(r.rubbleMerges).toEqual([{ into: 0, from: [5, 6], sum: 0 }]);
    expect(r.cells).toEqual([0, EMPTY, 3, EMPTY, EMPTY, EMPTY, EMPTY]);
  });

  it('touching only one 0 just lands', () => {
    const { cells, merges } = place(g, [1, 1, EMPTY, EMPTY, EMPTY, 0, EMPTY], 2, 1);
    const r = dropRubble(g, cells, merges);
    expect(r.rubbleMerges).toEqual([]);
    expect(r.cells).toEqual([0, EMPTY, 3, EMPTY, EMPTY, 0, EMPTY]);
  });

  it('rubble merges score 1 per tile, with no chain bonus', () => {
    const rubble = [{ into: 0, from: [5, 6], sum: 0 }, { into: 1, from: [2, 3, 4], sum: 0 }];
    expect(scoreRubble(rubble)).toBe(3 + 4);
  });

  it('previewAt shows where rubble lands and the 0s it would merge', () => {
    expect(previewAt(g, [1, 1, EMPTY, EMPTY, EMPTY, 0, 0], 2, 1)).toEqual({ value: 3, merging: [1, 0, 5, 6], rubble: [0] });
  });

  it('does not change the input', () => {
    const { cells, merges } = merged();
    const copy = cells.slice();
    dropRubble(tiles, cells, merges);
    expect(cells).toEqual(copy);
  });
});

describe('shapes: the next value comes with a shape', () => {
  // A kite in the middle touching kites 1 and 2 and darts 3 and 4
  const hub: Tile[] = [
    { neighbors: [1, 2, 3, 4], type: 'kite' },
    { neighbors: [0], type: 'kite' },
    { neighbors: [0], type: 'kite' },
    { neighbors: [0], type: 'dart' },
    { neighbors: [0], type: 'dart' },
  ];

  // Empty: kites 0 and 1, darts 3 and 4 (2 is taken), so kites hold half
  // the empty tiles
  const half: Cell[] = [EMPTY, EMPTY, 1, EMPTY, EMPTY];
  // Empty: kites 0, 1 and 2 and dart 3, so kites hold three quarters
  const kiteHeavy: Cell[] = [EMPTY, EMPTY, EMPTY, EMPTY, 9];

  it('the chance of a kite is the kites\' share of the empty tiles', () => {
    expect(kiteChance(hub, half)).toBe(0.5);
    expect(kiteChance(hub, kiteHeavy)).toBe(0.75);
    expect(kiteChance(hub, [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY])).toBe(0.6);
  });

  it('dealShape draws against the chance', () => {
    expect(dealShape(hub, kiteHeavy, () => 0)).toBe('kite');
    expect(dealShape(hub, kiteHeavy, () => 0.74)).toBe('kite');
    expect(dealShape(hub, kiteHeavy, () => 0.75)).toBe('dart');
  });

  it('never deals a shape with no empty tile left', () => {
    // Both darts (3, 4) taken: always a kite, whatever the draw
    expect(kiteChance(hub, [EMPTY, EMPTY, 1, 1, 3])).toBe(1);
    expect(dealShape(hub, [EMPTY, EMPTY, 1, 1, 3], () => 0.99)).toBe('kite');
    // All three kites (0, 1, 2) taken: always a dart
    expect(kiteChance(hub, [1, 3, 9, EMPTY, EMPTY])).toBe(0);
    expect(dealShape(hub, [1, 3, 9, EMPTY, EMPTY], () => 0)).toBe('dart');
  });

  it('the value must go on an empty tile of the dealt shape', () => {
    const c: Cell[] = [EMPTY, EMPTY, 1, EMPTY, EMPTY];
    expect(shapeToPlace(hub, c, 'dart')).toBe('dart');
    expect(canPlaceDealt(hub, c, 3, 'dart')).toBe(true);
    expect(canPlaceDealt(hub, c, 0, 'dart')).toBe(false);
    expect(canPlaceDealt(hub, c, 1, 'kite')).toBe(true);
    expect(canPlaceDealt(hub, c, 2, 'kite')).toBe(false); // taken
  });

  it('with no empty tile of the dealt shape left, any empty tile will do', () => {
    const c: Cell[] = [EMPTY, EMPTY, 1, 2, 3]; // both darts are taken
    expect(shapeToPlace(hub, c, 'dart')).toBeNull();
    expect(canPlaceDealt(hub, c, 0, 'dart')).toBe(true);
  });

  it('shape never changes what a merge makes', () => {
    const dartHub: Tile[] = [{ ...hub[0], type: 'dart' }, ...hub.slice(1)];
    expect(place(dartHub, [EMPTY, 1, 1, EMPTY, EMPTY], 0, 1).merges).toEqual([{ into: 0, from: [1, 2], sum: 3 }]);
    expect(place(hub, [EMPTY, 1, 1, EMPTY, EMPTY], 0, 1).merges).toEqual([{ into: 0, from: [1, 2], sum: 3 }]);
  });
});

describe('what a merge makes: the sum, rounded down to a power of 3', () => {
  // A hub touching four others
  const hub: Tile[] = [
    { neighbors: [1, 2, 3, 4], type: 'kite' },
    { neighbors: [0], type: 'kite' },
    { neighbors: [0], type: 'kite' },
    { neighbors: [0], type: 'dart' },
    { neighbors: [0], type: 'dart' },
  ];

  it('floorPow3 rounds down to a power of 3', () => {
    expect([0, 1, 2, 3, 4, 8, 9, 15, 26, 27, 80, 81].map(floorPow3)).toEqual([0, 1, 1, 3, 3, 3, 9, 9, 9, 27, 27, 81]);
  });

  it('three or four As make a B; nine make a C; five Bs make a C', () => {
    expect(mergeResult([1, 1, 1])).toBe(3);
    expect(mergeResult([1, 1, 1, 1])).toBe(3);
    expect(mergeResult(Array(9).fill(1))).toBe(9);
    expect(mergeResult([3, 3, 3, 3, 3])).toBe(9);
    expect(mergeResult([9, 9, 9])).toBe(27);
    expect(mergeResult([0, 0, 0])).toBe(0);
  });

  it('every result is a power of 3 (or 0)', () => {
    for (const v of [0, 1, 3, 9, 27]) {
      for (let n = 3; n <= 12; n++) {
        const r = mergeResult(Array(n).fill(v));
        expect(r === 0 || floorPow3(r) === r).toBe(true);
      }
    }
  });

  it('place uses it, chains included', () => {
    expect(place(hub, [EMPTY, 1, 1, 1, EMPTY], 0, 1).cells[0]).toBe(3);
    // Three As make a B, which joins two Bs: a C
    expect(place(hub, [EMPTY, 1, 1, 3, 3], 0, 1).cells).toEqual([9, EMPTY, EMPTY, EMPTY, EMPTY]);
  });

  it('deals and seeds 0, 1, 3 and 9 (and deals wildcards)', () => {
    expect(NUMBERS.map(([v]) => v)).toEqual([0, 1, 3, 9]);
    expect(DECK.map(([v]) => v)).toEqual([WILD, 0, 1, 3, 9]);
    expect(SEED_VALUES).toEqual([0, 1, 3, 9]);
    const board = makeBoard(800, 600);
    let seed = 7;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
    const cells = seedBoard(board, rand);
    for (const c of cells) if (c !== EMPTY) expect([0, 1, 3, 9]).toContain(c);
    expect(cells).toContain(9);
  });
});

describe('making Z', () => {
  it('wins the game at once, with free tiles left', () => {
    expect(outcome(cellsOf({ 0: TOP_VALUE }))).toEqual({ over: true, won: true, highest: TOP_VALUE });
  });

  it('one rung short does not', () => {
    expect(outcome(cellsOf({ 0: TOP_VALUE / 3 }))).toEqual({ over: false });
  });

});

describe('scoring', () => {
  // A merge of `tiles` tiles making `sum`
  const merge = (tiles: number, sum: number): Merge => ({ into: 0, from: Array.from({ length: tiles - 1 }, (_, i) => i + 1), sum });

  it('a rung is a letter\'s place in the alphabet, 0 for #', () => {
    expect([0, 1, 3, 9, 27, TOP_VALUE].map(rungOf)).toEqual([0, 1, 2, 3, 4, 26]);
  });

  it('a merge scores the rung made times the tiles merged', () => {
    expect(mergePoints(merge(3, 3))).toBe(6); // three As make a B
    expect(mergePoints(merge(4, 3))).toBe(8); // four As make a B
    expect(mergePoints(merge(5, 27))).toBe(20); // five Cs make a D
  });

  it('a merge of #s scores 1 per tile', () => {
    expect(mergePoints(merge(3, 0))).toBe(3);
    expect(mergePoints(merge(4, 0))).toBe(4);
  });

  it('each merge of a chain scores times its place in it', () => {
    const chain = [merge(3, 3), merge(3, 9), merge(3, 27)]; // 6, 9, 12 points
    expect(scoreMerges(chain)).toBe(6 + 9 * 2 + 12 * 3);
  });

  it('a move without merges scores nothing', () => {
    expect(scoreMerges([])).toBe(0);
  });

  it('scores a real chain reaction from place', () => {
    const star: Tile[] = [{ neighbors: [1, 2, 3, 4] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }];
    const { merges } = place(star, [EMPTY, 1, 1, 3, 3], 0, 1);
    expect(scoreMerges(merges)).toBe(2 * 3 + 3 * 3 * 2); // a B, then a C at x2
  });
});

describe('hot spare', () => {
  // Kites 0 and 1, darts 2 and 3
  const quad: Tile[] = [
    { neighbors: [1], type: 'kite' }, { neighbors: [0], type: 'kite' },
    { neighbors: [3], type: 'dart' }, { neighbors: [2], type: 'dart' },
  ];
  const open: Cell[] = [EMPTY, EMPTY, EMPTY, EMPTY];
  const a: Deal = { value: 1, shape: 'kite' };
  const b: Deal = { value: 9, shape: 'dart' };
  const fresh: Deal = { value: 3, shape: 'kite' };
  let draws = 0;
  const draw = () => { draws++; return fresh; };

  it('with an empty spare, reserves the current deal and deals a fresh one', () => {
    draws = 0;
    expect(swapSpare(quad, open, a, null, draw)).toEqual({ current: fresh, spare: a });
    expect(draws).toBe(1);
  });

  it('otherwise trades the current deal and the spare, without dealing', () => {
    draws = 0;
    expect(swapSpare(quad, open, a, b, draw)).toEqual({ current: b, spare: a });
    // and back again
    expect(swapSpare(quad, open, b, a, draw)).toEqual({ current: a, spare: b });
    expect(draws).toBe(0);
  });

  it('keeps a wildcard as it is', () => {
    const wild: Deal = { value: WILD, shape: 'dart' };
    expect(swapSpare(quad, open, wild, null, draw).spare).toEqual(wild);
    expect(swapSpare(quad, open, a, wild, draw).current).toEqual(wild);
  });

  it('a spare coming into play takes the other shape when none of its own is empty', () => {
    const noDarts: Cell[] = [EMPTY, EMPTY, 1, 3]; // both darts taken
    expect(shapeInPlay(quad, noDarts, 'dart')).toBe('kite');
    expect(shapeInPlay(quad, noDarts, 'kite')).toBe('kite');
    expect(shapeInPlay(quad, open, 'dart')).toBe('dart');
    expect(swapSpare(quad, noDarts, a, b, draw)).toEqual({ current: { value: 9, shape: 'kite' }, spare: a });
  });
});

describe('tapping the board (Tap to preview)', () => {
  it('place: one tap places', () => {
    expect(tapAction('place', -1, 5, true)).toEqual({ place: true, select: -1 });
    expect(tapAction('place', 3, 5, true)).toEqual({ place: true, select: -1 });
  });

  it('preview: the first tap on a tile selects it, a second tap there places', () => {
    expect(tapAction('preview', -1, 5, true)).toEqual({ place: false, select: 5 });
    expect(tapAction('preview', 5, 5, true)).toEqual({ place: true, select: -1 });
  });

  it('preview: a tap on another tile moves the selection there', () => {
    expect(tapAction('preview', 5, 7, true)).toEqual({ place: false, select: 7 });
  });

  it('a tap where nothing can be placed, or off the board, only clears the selection', () => {
    for (const rule of ['place', 'preview'] as const) {
      expect(tapAction(rule, 5, 7, false)).toEqual({ place: false, select: -1 });
      expect(tapAction(rule, 5, 5, false)).toEqual({ place: false, select: -1 });
      expect(tapAction(rule, 5, -1, false)).toEqual({ place: false, select: -1 });
    }
  });
});

describe('Undo as a power-up', () => {
  const merge = (sum: number): Merge => ({ into: 0, from: [1, 2], sum });

  it('a game starts with 3 charges and holds at most 5', () => {
    expect(UNDO_START).toBe(3);
    expect(UNDO_MAX).toBe(5);
    expect(addUndos(3, 1)).toBe(4);
    expect(addUndos(4, 3)).toBe(5);
    expect(addUndos(5, 1)).toBe(5);
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
    expect(addClears(0, 1)).toBe(1);
    expect(addClears(3, 1)).toBe(3);
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
    expect(anyShapesEarned(rosettes, [0])).toBe(1);
    expect(anyShapesEarned(rosettes, [1])).toBe(2);
    expect(anyShapesEarned(rosettes, [0, 1])).toBe(3);
    expect(anyShapesEarned(rosettes, [])).toBe(0);
  });

  it('holds at most 3', () => {
    expect(ANY_SHAPE_MAX).toBe(3);
    expect(addAnyShapes(2, 2)).toBe(3);
    expect(addAnyShapes(0, 1)).toBe(1);
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
    expect(addUpgrades(2, 2)).toBe(3);
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
    expect(addSweeps(2, 2)).toBe(3);
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
    expect(addSwaps(2, 2)).toBe(3);
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
