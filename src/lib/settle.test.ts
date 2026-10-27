import { describe, expect, it } from 'vitest';
import {
  EMPTY, type Cell, type RosetteTiles, type Tile,
  CLEAR_MAX, UPGRADE_MAX, place,
} from './rules';
import { type Holdings, describeMerges, settle } from './settle';

// The game before a move, with nothing earned yet
const holdings = (cells: Cell[], more: Partial<Holdings> = {}): Holdings => ({
  cells, score: 0, undos: 3, clears: 0, anyShapes: 0, upgrades: 0, sweeps: 0, swaps: 0, completed: [], ...more,
});

// Places `value` on `id` and settles the move
const play = (tiles: Tile[], base: Holdings, id: number, value: number, rosettes: RosetteTiles[] = [], lead = '') => {
  const { cells: placed, merges } = place(tiles, base.cells, id, value);
  return settle(tiles, rosettes, base, id, placed, merges, lead);
};

// A line: 0 - 1 - 2
const line: Tile[] = [{ neighbors: [1] }, { neighbors: [0, 2] }, { neighbors: [1] }];

// A hub: 0 touching 1 to 4
const hub: Tile[] = [
  { neighbors: [1, 2, 3, 4] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] }, { neighbors: [0] },
];

describe('describeMerges', () => {
  it('lists each merge of a move in order, with values as letters', () => {
    expect(describeMerges([])).toBe('');
    expect(describeMerges([{ into: 0, from: [1, 2], sum: 3 }, { into: 0, from: [3, 4], sum: 9 }]))
      .toBe('Merged 3 tiles into B, then 3 tiles into C');
  });
});

describe('settle', () => {
  it('drops rubble, adds the points and marks the last move', () => {
    const base = holdings([EMPTY, 1, 1], { score: 10 });
    const s = play(line, base, 0, 1);
    // Three As make a B on 0; the farthest cleared tile, 2, gets rubble
    expect(s.cells).toEqual([3, EMPTY, 0]);
    expect(s.score).toBe(16);
    expect(s.lastMove).toBe(0);
    expect(s.message).toBe('Merged 3 tiles into B (+6). Rubble dropped a #. New letter B! +1 Undo.');
  });

  it('leaves the input unchanged', () => {
    const base = holdings([EMPTY, 1, 1]);
    const copy = structuredClone(base);
    play(line, base, 0, 1);
    expect(base).toEqual(copy);
  });

  it('starts the status line with the lead, and says nothing more for a move without merges', () => {
    const s = play(line, holdings([EMPTY, EMPTY, 3]), 0, 1, [], 'Wild played as A.');
    expect(s.message).toBe('Wild played as A.');
    expect(s.score).toBe(0);
    expect(s.undos).toBe(3);
  });

  it('gives a chain its bonus, and earns a Clear and an Undo for each new rung', () => {
    // Three As make a B, which merges with the two Bs into a C
    const s = play(hub, holdings([EMPTY, 1, 1, 3, 3]), 0, 1);
    expect(s.score).toBe(6 + 9 * 2);
    expect(s.clears).toBe(1);
    expect(s.undos).toBe(4); // B was the highest; C is one rung up
    expect(s.message).toBe(
      'Merged 3 tiles into B, then 3 tiles into C (+24). Rubble dropped 2 #s. New letter C! +1 Undo. Chain! +1 Clear.',
    );
  });

  it('holds charges at their caps, and says so', () => {
    const s = play(hub, holdings([EMPTY, 1, 1, 3, 3], { clears: CLEAR_MAX, undos: 5 }), 0, 1);
    expect(s.clears).toBe(CLEAR_MAX);
    expect(s.undos).toBe(5);
    expect(s.message).toContain('Undos full (5).');
    expect(s.message).toContain('Clears full (3).');
  });

  it('earns an Upgrade for a big merge, with no rubble', () => {
    const s = play(hub, holdings([EMPTY, 1, 1, 1, 1]), 0, 1);
    expect(s.cells).toEqual([3, EMPTY, EMPTY, EMPTY, EMPTY]);
    expect(s.upgrades).toBe(1);
    expect(s.message).toBe('Merged 5 tiles into B (+10). New letter B! +1 Undo. Big merge! +1 Upgrade.');
  });

  it('takes off the charge spent before adding what was earned', () => {
    // An Upgrade spent at the cap, and a big merge earning one back
    const { cells: placed, merges } = place(hub, [EMPTY, 3, 3, 3, 3], 0, 3);
    const s = settle(hub, [], holdings([EMPTY, 3, 3, 3, 3], { upgrades: UPGRADE_MAX }), 0, placed, merges, '', { upgrade: true });
    expect(s.upgrades).toBe(UPGRADE_MAX);
    expect(s.message).toContain('+1 Upgrade.');
    // Spent with nothing earned
    const none = place(line, [EMPTY, EMPTY, EMPTY], 0, 1);
    expect(settle(line, [], holdings([EMPTY, EMPTY, EMPTY], { upgrades: 2, swaps: 2, anyShapes: 2 }), 0, none.cells, none.merges, '',
      { upgrade: true, swap: true, anyShape: true })).toMatchObject({ upgrades: 1, swaps: 1, anyShapes: 1 });
  });

  it('earns a Sweep for each rubble merge, which scores 1 per tile', () => {
    // 0 - 1 - 2, and 2 touching two #s (3 and 4). Rubble lands on 2 and
    // merges them
    const tiles: Tile[] = [
      { neighbors: [1] }, { neighbors: [0, 2] }, { neighbors: [1, 3, 4] }, { neighbors: [2] }, { neighbors: [2] },
    ];
    const s = play(tiles, holdings([EMPTY, 1, 1, 0, 0]), 0, 1);
    expect(s.cells).toEqual([3, EMPTY, 0, EMPTY, EMPTY]);
    expect(s.score).toBe(6 + 3);
    expect(s.sweeps).toBe(1);
    expect(s.message).toBe(
      'Merged 3 tiles into B (+6). Rubble dropped a #. Rubble merged 3 #s into one (+3). New letter B! +1 Undo. Rubble merge! +1 Sweep.',
    );
  });

  it('earns a Swap each time the score passes a multiple of 500', () => {
    const s = play(line, holdings([EMPTY, 1, 1], { score: 497 }), 0, 1);
    expect(s.score).toBe(503);
    expect(s.swaps).toBe(1);
    expect(s.message).toContain('500 points! +1 Swap.');
    expect(play(line, holdings([EMPTY, 1, 1], { score: 400 }), 0, 1).swaps).toBe(0);
  });

  it('earns Any shape for suns and stars the move completes, once a game each', () => {
    // A "sun" of tiles 0 and 2 and a "star" of tiles 0 and 1, both completed
    // by filling 0
    const rosettes: RosetteTiles[] = [{ kind: 'sun', tiles: [0, 2] }, { kind: 'star', tiles: [0, 1] }];
    const s = play(line, holdings([EMPTY, 9, 3]), 0, 1, rosettes);
    expect(s.anyShapes).toBe(3);
    expect(s.completed).toEqual([0, 1]);
    expect(s.message).toBe('Sun! +1 Any shape. Star! +2 Any shape.');
    // Already completed: nothing more
    const again = play(line, holdings([EMPTY, 9, 3], { completed: [0, 1] }), 0, 1, rosettes);
    expect(again.anyShapes).toBe(0);
    expect(again.message).toBe('');
  });

  it('says when Any shape is full', () => {
    const rosettes: RosetteTiles[] = [{ kind: 'star', tiles: [0, 1] }];
    const s = play(line, holdings([EMPTY, 9, 3], { anyShapes: 2 }), 0, 1, rosettes);
    expect(s.anyShapes).toBe(3);
    expect(s.message).toBe('Star! +2 Any shape. Any shapes full (3).');
  });
});
