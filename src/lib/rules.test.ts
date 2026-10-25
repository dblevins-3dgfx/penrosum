import { describe, expect, it } from 'vitest';
import { makeBoard } from './board';
import {
  DEFAULT_OPTIONS, EMPTY, type Cell, type Options, type Tile,
  SEED_FRACTION, SEED_VALUES,
  boardFull, canPlace, drawValue, groupAt, highestTile, outcome, place, previewAt, seedBoard,
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
  it('connected: follows matching tiles beyond the direct neighbors', () => {
    const c = cellsOf({ 0: 1, 1: 1, 2: 1, 3: 1 });
    expect(groupAt(tiles, c, 3, 'connected').sort()).toEqual([0, 1, 2, 3]);
  });

  it('connected: does not pass through a tile with a different number', () => {
    const c = cellsOf({ 0: 1, 1: 2, 2: 1, 3: 1 });
    expect(groupAt(tiles, c, 3, 'connected').sort()).toEqual([2, 3]);
  });

  it('neighbors: only the placed tile and its matching direct neighbors', () => {
    const c = cellsOf({ 0: 1, 1: 1, 2: 1, 3: 1 });
    expect(groupAt(tiles, c, 3, 'neighbors')).toEqual([3, 2]);
    expect(groupAt(tiles, c, 1, 'neighbors')).toEqual([1, 0, 2]);
  });

  it('neighbors: leaves out neighbors with a different number', () => {
    const c = cellsOf({ 0: 1, 1: 1, 2: 2, 4: 1 });
    expect(groupAt(tiles, c, 1, 'neighbors')).toEqual([1, 0, 4]);
  });

  it('same shape: only kites match kites and darts match darts', () => {
    const c: Cell[] = [1, 1, 1, 1, 1];
    expect(groupAt(shaped, c, 0, 'connected', 'same')).toEqual([0, 1, 3]);
    expect(groupAt(shaped, c, 0, 'neighbors', 'same')).toEqual([0, 1, 3]);
    expect(groupAt(shaped, c, 2, 'connected', 'same')).toEqual([2]);
    // Any shape: everything connected matches
    expect(groupAt(shaped, c, 0, 'connected', 'any').sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('lists the placed tile first', () => {
    const c = cellsOf({ 0: 1, 1: 1, 2: 1 });
    expect(groupAt(tiles, c, 2, 'connected')[0]).toBe(2);
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

  it('merges matching numbers other than 1 into their sum', () => {
    const { cells } = place(tiles, cellsOf({ 0: 2, 2: 2 }), 1, 2, opts());
    expect(cells).toEqual(cellsOf({ 1: 6 }));
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

  it('connected: a chain collapses into the placed tile', () => {
    const { cells } = place(tiles, cellsOf({ 0: 1, 1: 1, 2: 1 }), 3, 1, opts({ group: 'connected' }));
    expect(cells).toEqual(cellsOf({ 3: 4 }));
  });

  it('neighbors: a chain end does not merge with only one neighbor', () => {
    const { cells, merges } = place(tiles, cellsOf({ 0: 1, 1: 1, 2: 1 }), 3, 1, opts({ group: 'neighbors' }));
    expect(merges).toEqual([]);
    expect(cells).toEqual(cellsOf({ 0: 1, 1: 1, 2: 1, 3: 1 }));
  });

  it('neighbors: tiles beyond the direct neighbors are left alone', () => {
    const { cells } = place(tiles, cellsOf({ 0: 1, 2: 1, 3: 1, 5: 1 }), 1, 1, opts({ group: 'neighbors' }));
    expect(cells).toEqual(cellsOf({ 1: 3, 3: 1, 5: 1 }));
  });

  it('clear empty: merged-away tiles become un-numbered', () => {
    const { cells } = place(tiles, cellsOf({ 0: 1, 2: 1 }), 1, 1, opts({ clear: 'empty' }));
    expect(cells[0]).toBe(EMPTY);
    expect(cells[2]).toBe(EMPTY);
  });

  it('clear zero: merged-away tiles hold 0, which blocks groups', () => {
    const first = place(tiles, cellsOf({ 0: 1, 2: 1 }), 1, 1, opts({ clear: 'zero' }));
    expect(first.cells).toEqual(cellsOf({ 0: 0, 1: 3, 2: 0 }));
    expect(canPlace(first.cells, 0)).toBe(false);
    // Zeros never match a placed number, so three tiles next to two zeros don't merge
    const second = place(tiles, cellsOf({ 0: 0, 2: 0 }), 1, 1, opts({ clear: 'zero' }));
    expect(second.merges).toEqual([]);
  });

  it('same shape: a mixed-shape group does not merge', () => {
    const start: Cell[] = [EMPTY, 1, 1, EMPTY, EMPTY];
    expect(place(shaped, start, 0, 1, opts({ shape: 'any' })).cells).toEqual([3, EMPTY, EMPTY, EMPTY, EMPTY]);
    const { cells, merges } = place(shaped, start, 0, 1, opts({ shape: 'same' }));
    expect(merges).toEqual([]);
    expect(cells).toEqual([1, 1, 1, EMPTY, EMPTY]);
  });

  it('same shape: a chain reaction only continues with tiles of the placed shape', () => {
    // A kite in the middle touching kites 1 and 2 (1s) and darts 3 and 4 (3s)
    const star: Tile[] = [
      { neighbors: [1, 2, 3, 4], type: 'kite' },
      { neighbors: [0], type: 'kite' },
      { neighbors: [0], type: 'kite' },
      { neighbors: [0], type: 'dart' },
      { neighbors: [0], type: 'dart' },
    ];
    const start: Cell[] = [EMPTY, 1, 1, 3, 3];
    expect(place(star, start, 0, 1, opts({ shape: 'any' })).cells).toEqual([9, EMPTY, EMPTY, EMPTY, EMPTY]);
    const { cells, merges } = place(star, start, 0, 1, opts({ shape: 'same' }));
    expect(merges).toHaveLength(1);
    expect(cells).toEqual([3, EMPTY, EMPTY, 3, 3]);
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

  it('happens under either adjacency rule', () => {
    expect(place(star, start, 0, 1, opts({ group: 'neighbors' })).cells).toEqual([9, EMPTY, EMPTY, EMPTY, EMPTY]);
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

describe('drawValue', () => {
  it('draws 1 70% of the time, 2 20% and 3 10%', () => {
    expect(drawValue(() => 0)).toBe(1);
    expect(drawValue(() => 0.69)).toBe(1);
    expect(drawValue(() => 0.7)).toBe(2);
    expect(drawValue(() => 0.89)).toBe(2);
    expect(drawValue(() => 0.9)).toBe(3);
    expect(drawValue(() => 0.999)).toBe(3);
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
        expect(groupAt(board, cells, t.id, 'connected')).toEqual([t.id]);
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
    // value draws then give the leaves 0, 1, 2 and 3
    const draws = [0, 0.999, 0.999, 0.999, 0, 0.25, 0.5, 0.75];
    let i = 0;
    const cells = seedBoard(star, () => draws[i++], 1);
    expect(cells).toEqual([EMPTY, 1, 2, 3, 0]);
  });
});
