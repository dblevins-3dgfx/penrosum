import { describe, expect, it } from 'vitest';
import { makeBoard } from './board';
import {
  DEFAULT_OPTIONS, EMPTY, type Cell, type Options, type Tile,
  DECK, SEED_FRACTION, SEED_VALUES, WILD, WILD_CHANCE,
  boardFull, canPlace, deckFor, drawValue, groupAt, highestTile, outcome, place, previewAt, resolveWild, seedBoard, valueToPlace,
  applyPressure, nextSpawn, randomEmpty,
  KITE_CHANCE, canPlaceDealt, dealShape, shapeToPlace,
  TOP_VALUE, floorPow3, mergeResult,
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
const opts = (o: Partial<Options> = {}): Options => ({ ...DEFAULT_OPTIONS, ...o });

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
    const { cells, merges } = place(tiles, cellsOf({ 0: 1 }), 1, 1, opts());
    expect(merges).toEqual([]);
    expect(cells).toEqual(cellsOf({ 0: 1, 1: 1 }));
  });

  it('merges three tiles into the one just placed', () => {
    const { cells, merges } = place(tiles, cellsOf({ 0: 1, 2: 1 }), 1, 1, opts());
    expect(merges).toEqual([{ into: 1, from: [0, 2], sum: 3 }]);
    expect(cells).toEqual(cellsOf({ 1: 3 }));
  });

  it('three Bs (3s) make a C (9)', () => {
    const { cells } = place(tiles, cellsOf({ 0: 3, 2: 3 }), 1, 3, opts());
    expect(cells).toEqual(cellsOf({ 1: 9 }));
  });

  it('does not merge tiles with different numbers', () => {
    const { cells, merges } = place(tiles, cellsOf({ 0: 1, 2: 2 }), 1, 1, opts());
    expect(merges).toEqual([]);
    expect(cells).toEqual(cellsOf({ 0: 1, 1: 1, 2: 2 }));
  });

  it('merges only the matching tiles in a mixed cluster', () => {
    const { cells } = place(tiles, cellsOf({ 0: 1, 2: 1, 4: 3 }), 1, 1, opts());
    expect(cells).toEqual(cellsOf({ 1: 3, 4: 3 }));
  });

  it('a chain collapses into the placed tile, even from its end', () => {
    // Four As: 4, rounded down to B (3)
    const { cells } = place(tiles, cellsOf({ 0: 1, 1: 1, 2: 1 }), 3, 1, opts());
    expect(cells).toEqual(cellsOf({ 3: 3 }));
  });

  it('merged-away tiles become empty, and can be played again', () => {
    const { cells } = place(tiles, cellsOf({ 0: 1, 2: 1 }), 1, 1, opts());
    expect(cells[0]).toBe(EMPTY);
    expect(cells[2]).toBe(EMPTY);
    expect(canPlace(cells, 0)).toBe(true);
  });

  it('zeros never match a placed 1, so a 1 between two zeros does not merge', () => {
    expect(place(tiles, cellsOf({ 0: 0, 2: 0 }), 1, 1, opts()).merges).toEqual([]);
  });

  it('does not change the input', () => {
    const before = cellsOf({ 0: 1, 2: 1 });
    place(tiles, before, 1, 1, opts());
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
    const { cells, merges } = place(star, start, 0, 1, opts());
    expect(merges).toEqual([
      { into: 0, from: [1, 2], sum: 3 },
      { into: 0, from: [3, 4], sum: 9 },
    ]);
    expect(cells).toEqual([9, EMPTY, EMPTY, EMPTY, EMPTY]);
  });

  it('stops when the new number makes no group', () => {
    const { merges } = place(star, [EMPTY, 1, 1, 3, 4], 0, 1, opts());
    expect(merges).toHaveLength(1);
  });
});

describe('previewAt', () => {
  it('shows the placed value when nothing would merge', () => {
    expect(previewAt(tiles, cellsOf({ 0: 1 }), 1, 1, opts())).toEqual({ value: 1, merging: [] });
  });

  it('shows the final number and every tile that would be cleared', () => {
    const star: Tile[] = [{ neighbors: [1, 2, 3, 4] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }];
    expect(previewAt(star, [EMPTY, 1, 1, 3, 3], 0, 1, opts()))
      .toEqual({ value: 9, merging: [1, 2, 3, 4] });
  });
});

describe('placing zeros', () => {
  // A star: 0 in the middle, touching 1 to 4
  const star: Tile[] = [
    { neighbors: [1, 2, 3, 4] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] },
  ];

  it('a placed 0 merges neighboring zeros into one, where it was placed', () => {
    const { cells, merges } = place(star, [EMPTY, 0, 0, 0, 1], 0, 0, opts());
    expect(merges).toEqual([{ into: 0, from: [1, 2, 3], sum: 0 }]);
    expect(cells).toEqual([0, EMPTY, EMPTY, EMPTY, 1]);
  });

  it('a placed 0 follows connected zeros like any other number', () => {
    const { cells } = place(tiles, cellsOf({ 0: 0, 1: 0, 2: 0 }), 3, 0, opts());
    expect(cells).toEqual(cellsOf({ 3: 0 }));
  });

  it('a placed 0 does not match other numbers, and zeros still do not match placed 1s', () => {
    expect(place(star, [EMPTY, 1, 1, 0, EMPTY], 0, 0, opts()).merges).toEqual([]);
    expect(place(star, [EMPTY, 0, 0, 1, EMPTY], 0, 1, opts()).merges).toEqual([]);
  });

  it('a merge of zeros leaves a 0 that stays put', () => {
    // The zeros merge into the middle; the 0 left there touches only 1s
    const { cells, merges } = place(star, [EMPTY, 0, 0, 1, 1], 0, 0, opts());
    expect(merges).toHaveLength(1);
    expect(cells).toEqual([0, EMPTY, EMPTY, 1, 1]);
  });

  it('the preview shows a placed 0 and the zeros it would clear', () => {
    expect(previewAt(star, [EMPTY, 0, 0, 1, EMPTY], 0, 0, opts())).toEqual({ value: 0, merging: [1, 2] });
  });
});

describe('the deck', () => {
  it('draws # (0) 10% of the time, then A, B and C (1, 3, 9) as 63%, 18% and 9%', () => {
    expect(DECK.reduce((t, [, w]) => t + w, 0)).toBeCloseTo(1, 12);
    expect(drawValue(() => 0)).toBe(0);
    expect(drawValue(() => 0.099)).toBe(0);
    expect(drawValue(() => 0.1)).toBe(1);
    expect(drawValue(() => 0.729)).toBe(1);
    expect(drawValue(() => 0.73)).toBe(3);
    expect(drawValue(() => 0.909)).toBe(3);
    expect(drawValue(() => 0.91)).toBe(9);
    expect(drawValue(() => 0.999)).toBe(9);
  });

  it('is the same deck in play without wildcards', () => {
    expect(deckFor(opts())).toEqual(DECK);
  });

  it('with wildcards, a draw is wild WILD_CHANCE of the time and the numbers keep their proportions', () => {
    const deck = deckFor(opts({ wild: 'deck' }));
    expect(deck[0]).toEqual([WILD, WILD_CHANCE]);
    expect(deck.reduce((t, [, w]) => t + w, 0)).toBeCloseTo(1, 12);
    expect(deck.slice(1).map(([v]) => v)).toEqual([0, 1, 3, 9]);
    expect(deck[2][1] / deck[1][1]).toBeCloseTo(6.3, 9);
    expect(drawValue(() => 0, deck)).toBe(WILD);
    expect(drawValue(() => WILD_CHANCE, deck)).toBe(0);
  });
});

describe('wildcards', () => {
  // A star: 0 in the middle, touching 1 to 4
  const star: Tile[] = [
    { neighbors: [1, 2, 3, 4] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] },
  ];
  const wild = opts({ wild: 'deck' });

  it('becomes the number that merges', () => {
    expect(resolveWild(star, [EMPTY, 2, 2, 1, EMPTY], 0, wild)).toBe(2);
  });

  it('prefers the merge that leaves the biggest number', () => {
    // As A (1) it makes B (3); as C (9) it makes D (27)
    expect(resolveWild(star, [EMPTY, 1, 1, 9, 9], 0, wild)).toBe(9);
  });

  it('counts chain reactions when judging a merge', () => {
    // As 1: 1+1+1 = 3, which then merges with the two 3s into 9.
    // As 2: no merge (one 2). So 1 wins, through its chain.
    const cells: Cell[] = [EMPTY, 1, 1, 3, 3];
    const chain: Tile[] = [
      { neighbors: [1, 2, 3, 4, 5] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] },
    ];
    expect(resolveWild(chain, [...cells, 2], 0, wild)).toBe(1);
    expect(place(chain, [...cells, 2], 0, 1, wild).cells[0]).toBe(9);
  });

  it('prefers any merge to none, even a merge of zeros', () => {
    // As 0 it merges two zeros (leaving 0); as 1 nothing merges
    expect(resolveWild(star, [EMPTY, 0, 0, 1, EMPTY], 0, wild)).toBe(0);
  });

  it('when two merges leave the same number, prefers the one clearing more tiles', () => {
    // A hub touching five 1s and two 2s: as 1 it makes 6 clearing five
    // tiles; as 2 it also makes 6 but clears two
    const hub: Tile[] = [{ neighbors: [1, 2, 3, 4, 5, 6, 7] }, ...Array.from({ length: 7 }, () => ({ neighbors: [0] }))];
    expect(resolveWild(hub, [EMPTY, 1, 1, 1, 1, 1, 2, 2], 0, wild)).toBe(1);
  });

  it('is a 1 when no number would merge', () => {
    expect(resolveWild(star, [EMPTY, 2, 3, 0, EMPTY], 0, wild)).toBe(1);
    expect(resolveWild(star, [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], 0, wild)).toBe(1);
  });

  it('can join numbers bigger than the deck holds', () => {
    expect(resolveWild(star, [EMPTY, 27, 27, EMPTY, EMPTY], 0, wild)).toBe(27);
  });

  it('only a drawn wildcard is resolved; numbers place as themselves', () => {
    expect(valueToPlace(star, [EMPTY, 2, 2, EMPTY, EMPTY], 0, WILD, wild)).toBe(2);
    expect(valueToPlace(star, [EMPTY, 2, 2, EMPTY, EMPTY], 0, 1, wild)).toBe(1);
  });

  it('the preview shows what the wildcard would make', () => {
    expect(previewAt(star, [EMPTY, 3, 3, EMPTY, EMPTY], 0, WILD, wild)).toEqual({ value: 9, merging: [1, 2] });
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
  it('goes on while a tile is free and the target is not reached', () => {
    expect(outcome(cellsOf({ 0: 10 }), opts({ goal: 'target', target: 20 }))).toEqual({ over: false });
  });

  it('target: reaching it wins, even with free tiles left', () => {
    expect(outcome(cellsOf({ 0: 20 }), opts({ goal: 'target', target: 20 })))
      .toEqual({ over: true, won: true, highest: 20 });
  });

  it('target: filling the board first loses', () => {
    const full = cellsOf({ 0: 1, 1: 1, 2: 0, 3: 1, 4: 1, 5: 1 });
    expect(outcome(full, opts({ goal: 'target', target: 20 })))
      .toEqual({ over: true, won: false, highest: 1 });
  });

  it('highest: the game ends when the board is full, scored by the highest tile', () => {
    const full = cellsOf({ 0: 4, 1: 1, 2: 0, 3: 1, 4: 1, 5: 1 });
    expect(outcome(full, opts({ goal: 'highest' }))).toEqual({ over: true, won: true, highest: 4 });
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

describe('pressure', () => {
  // Fixed draws from a list, for predictable picks
  const draws = (...rs: number[]) => { let i = 0; return () => rs[i++] ?? 0; };
  // A merge of three 1s into tile 1 of the line graph, clearing 0 and 2
  const merged = () => place(tiles, cellsOf({ 0: 1, 2: 1 }), 1, 1, opts());

  it('randomEmpty picks among the empty tiles, or null on a full board', () => {
    const c = cellsOf({ 0: 1, 2: 0 });
    expect(randomEmpty(c, () => 0)).toBe(1);
    expect(randomEmpty(c, () => 0.999)).toBe(5);
    expect(randomEmpty([1, 0, 2], () => 0)).toBeNull();
  });

  it('none: adds nothing', () => {
    const { cells, merges } = merged();
    expect(applyPressure(cells, merges, opts(), null)).toEqual({ cells, zeros: [], spawnAt: null });
  });

  it('mergeZero: a merge drops a 0 on a random empty tile', () => {
    const { cells, merges } = merged();
    // Empty after the merge: 0, 2, 3, 4, 5; the draw picks the first
    const r = applyPressure(cells, merges, opts({ pressure: 'mergeZero' }), null, () => 0);
    expect(r.zeros).toEqual([0]);
    expect(r.cells).toEqual(cellsOf({ 0: 0, 1: 3 }));
  });

  it('mergeZero: a move without a merge drops nothing', () => {
    const { cells, merges } = place(tiles, cellsOf({ 0: 1 }), 1, 1, opts());
    expect(applyPressure(cells, merges, opts({ pressure: 'mergeZero' }), null).zeros).toEqual([]);
  });

  it('a merge of zeros never adds pressure', () => {
    const { cells, merges } = place(tiles, cellsOf({ 0: 0, 2: 0 }), 1, 0, opts());
    expect(merges).toHaveLength(1);
    for (const pressure of ['mergeZero', 'rubble'] as const) {
      expect(applyPressure(cells, merges, opts({ pressure }), null).zeros).toEqual([]);
    }
  });

  it('rubble: a 3-tile merge leaves a 0 on its cleared tile farthest from the placed one', () => {
    // Placing at 2 merges the chain 2-1-0; tile 0 is the farthest
    const { cells, merges } = place(tiles, cellsOf({ 0: 1, 1: 1 }), 2, 1, opts());
    expect(merges[0].from).toEqual([1, 0]);
    const r = applyPressure(cells, merges, opts({ pressure: 'rubble' }), null);
    expect(r.zeros).toEqual([0]);
    expect(r.cells).toEqual(cellsOf({ 0: 0, 2: 3 }));
  });

  it('rubble: bigger merges leave none', () => {
    const { cells, merges } = place(tiles, cellsOf({ 0: 1, 1: 1, 2: 1 }), 3, 1, opts());
    expect(merges[0].from).toHaveLength(3);
    expect(applyPressure(cells, merges, opts({ pressure: 'rubble' }), null).zeros).toEqual([]);
  });

  it('rubble: each 3-tile merge in a chain leaves its own', () => {
    // A star: 1s at 1 and 2, 3s at 3 and 4; both merges are 3 tiles
    const star: Tile[] = [
      { neighbors: [1, 2, 3, 4] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] },
    ];
    const { cells, merges } = place(star, [EMPTY, 1, 1, 3, 3], 0, 1, opts());
    expect(applyPressure(cells, merges, opts({ pressure: 'rubble' }), null).cells).toEqual([9, EMPTY, 0, EMPTY, 0]);
  });

  it('spawn: a 0 appears on the announced tile, and the next one is announced', () => {
    const c = cellsOf({ 0: 1 });
    // Announced: 4. After it fills, empty are 1, 2, 3, 5; the draw picks 3
    const r = applyPressure(c, [], opts({ pressure: 'spawn' }), 4, draws(0.5));
    expect(r.cells).toEqual(cellsOf({ 0: 1, 4: 0 }));
    expect(r.zeros).toEqual([4]);
    expect(r.spawnAt).toBe(3);
  });

  it('spawn: playing on the announced tile blocks that spawn', () => {
    const c = cellsOf({ 0: 1, 4: 2 }); // the player just played on 4
    const r = applyPressure(c, [], opts({ pressure: 'spawn' }), 4, () => 0);
    expect(r.zeros).toEqual([]);
    expect(r.spawnAt).toBe(1);
  });

  it('spawn: nothing is announced on a full board, or under the other rules', () => {
    expect(nextSpawn([1, 0, 2], opts({ pressure: 'spawn' }))).toBeNull();
    expect(nextSpawn(cellsOf({}), opts({ pressure: 'rubble' }))).toBeNull();
    expect(nextSpawn(cellsOf({}), opts({ pressure: 'spawn' }), () => 0)).toBe(0);
  });

  it('does not change the input', () => {
    const { cells, merges } = merged();
    const copy = cells.slice();
    applyPressure(cells, merges, opts({ pressure: 'mergeZero' }), null, () => 0);
    expect(cells).toEqual(copy);
  });
});

describe('shapes (Q10)', () => {
  // A kite in the middle touching kites 1 and 2 and darts 3 and 4
  const hub: Tile[] = [
    { neighbors: [1, 2, 3, 4], type: 'kite' },
    { neighbors: [0], type: 'kite' },
    { neighbors: [0], type: 'kite' },
    { neighbors: [0], type: 'dart' },
    { neighbors: [0], type: 'dart' },
  ];
  // The same, with a dart in the middle
  const dartHub: Tile[] = [{ ...hub[0], type: 'dart' }, ...hub.slice(1)];

  describe('dealt', () => {
    it('deals a kite KITE_CHANCE of the time, and nothing under the other rules', () => {
      const dealt = opts({ shapes: 'dealt' });
      expect(dealShape(dealt, () => 0)).toBe('kite');
      expect(dealShape(dealt, () => KITE_CHANCE - 0.001)).toBe('kite');
      expect(dealShape(dealt, () => KITE_CHANCE)).toBe('dart');
      expect(dealShape(opts(), () => 0)).toBeNull();
      expect(dealShape(opts({ shapes: 'dartDouble' }), () => 0)).toBeNull();
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

    it('without a dealt shape, any empty tile will do', () => {
      expect(canPlaceDealt(hub, [EMPTY, EMPTY, 1, EMPTY, EMPTY], 0, null)).toBe(true);
    });
  });

  describe('dartDouble', () => {
    const rule = opts({ shapes: 'dartDouble' });

    it('a merge into a dart goes one rung higher', () => {
      // Three As make a B, and the bonus makes it a C
      const { cells, merges } = place(dartHub, [EMPTY, 1, 1, EMPTY, EMPTY], 0, 1, rule);
      expect(merges).toEqual([{ into: 0, from: [1, 2], sum: 9, doubled: 'dart' }]);
      expect(cells[0]).toBe(9);
    });

    it('a merge into a kite is not', () => {
      expect(place(hub, [EMPTY, 1, 1, EMPTY, EMPTY], 0, 1, rule).cells[0]).toBe(3);
    });

    it('each merge of a chain into a dart gets the bonus', () => {
      // Three As make B, +1 rung C; then three Cs make D, +1 rung E
      const { cells, merges } = place(dartHub, [EMPTY, 1, 1, 9, 9], 0, 1, rule);
      expect(merges.map(m => m.sum)).toEqual([9, 81]);
      expect(cells).toEqual([81, EMPTY, EMPTY, EMPTY, EMPTY]);
    });
  });

  describe('sameBonus', () => {
    const rule = opts({ shapes: 'sameBonus' });

    it('a merge whose tiles are all one shape goes one rung higher', () => {
      const { merges } = place(hub, [EMPTY, 1, 1, EMPTY, EMPTY], 0, 1, rule);
      expect(merges).toEqual([{ into: 0, from: [1, 2], sum: 9, doubled: 'shape' }]);
    });

    it('a mixed-shape merge is not, but still merges', () => {
      const { merges } = place(hub, [EMPTY, 1, EMPTY, 1, EMPTY], 0, 1, rule);
      expect(merges).toEqual([{ into: 0, from: [1, 3], sum: 3 }]);
    });

    it('all darts counts too', () => {
      expect(place(dartHub, [EMPTY, EMPTY, EMPTY, 3, 3], 0, 3, rule).cells[0]).toBe(27);
    });
  });

  it('Off: no shape changes anything', () => {
    expect(place(dartHub, [EMPTY, 1, 1, EMPTY, EMPTY], 0, 1, opts()).merges).toEqual([{ into: 0, from: [1, 2], sum: 3 }]);
  });

  it('the preview shows a bonus result', () => {
    expect(previewAt(dartHub, [EMPTY, 3, 3, EMPTY, EMPTY], 0, 3, opts({ shapes: 'dartDouble' }))).toEqual({ value: 27, merging: [1, 2] });
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

  it('a bonus merge (Q10) goes one rung higher', () => {
    expect(mergeResult([1, 1, 1, 1], true)).toBe(9);
    expect(mergeResult([3, 3, 3], true)).toBe(27);
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
    expect(place(hub, [EMPTY, 1, 1, 1, EMPTY], 0, 1, opts()).cells[0]).toBe(3);
    // Three As make a B, which joins two Bs: a C
    expect(place(hub, [EMPTY, 1, 1, 3, 3], 0, 1, opts()).cells).toEqual([9, EMPTY, EMPTY, EMPTY, EMPTY]);
  });

  it('deals and seeds 0, 1, 3 and 9', () => {
    expect(DECK.map(([v]) => v)).toEqual([0, 1, 3, 9]);
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
  it('wins the game at once, whatever the goal, with free tiles left', () => {
    const cells = cellsOf({ 0: TOP_VALUE });
    expect(outcome(cells, opts())).toEqual({ over: true, won: true, highest: TOP_VALUE });
    expect(outcome(cells, opts({ goal: 'target', target: 729 }))).toEqual({ over: true, won: true, highest: TOP_VALUE });
  });

  it('one rung short does not', () => {
    expect(outcome(cellsOf({ 0: TOP_VALUE / 3 }), opts())).toEqual({ over: false });
  });

});
