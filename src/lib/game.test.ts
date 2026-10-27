import { describe, expect, it } from 'vitest';
import type { BoardTile } from './board';
import { type Game, type GameAction, type Snapshot, canUndo, doomedAt, gameReducer, placementArmed, previewFor } from './game';
import { type Charges, startCharges } from './powerups';
import { EMPTY, type Cell } from './rules';

// A line of five tiles: three kites, then two darts
//
//   0 - 1 - 2 - 3 - 4
//   k   k   k   d   d
const tiles: BoardTile[] = [0, 1, 2, 3, 4].map(id => ({
  id, type: id < 3 ? 'kite' : 'dart', verts: [], neighbors: [id - 1, id + 1].filter(n => n >= 0 && n < 5),
}));

// Random draws of 0.5: the deck deals an A, on the shape with more empty tiles
const rand = () => 0.5;

// A game on the line, with A dealt on a kite, unless `position` or `charges`
// say otherwise
const gameOf = (cells: Cell[] = [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], position: Partial<Snapshot> = {}, charges: Partial<Charges> = {}): Game => ({
  id: 1,
  board: { size: 'small', tiles, bounds: { x: 0, y: 0, width: 1, height: 1 }, rosettes: [] },
  position: {
    cells, next: 1, moves: 0, score: 0, lastMove: null, nextShape: 'kite', spare: null,
    charges: { ...startCharges(), ...charges }, completed: [], message: '', ...position,
  },
  history: [],
  armed: null,
  picked: -1,
  selected: -1,
});

// Runs `actions` in turn
const run = (game: Game, ...actions: GameAction[]) =>
  actions.reduce<Game>((g, a) => gameReducer(g, a, rand) as Game, game);

const click = (id: number): GameAction => ({ type: 'tap', id, pointerType: 'mouse', tapRule: 'place' });
const touch = (id: number, tapRule: 'place' | 'preview' = 'preview'): GameAction => ({ type: 'tap', id, pointerType: 'touch', tapRule });

describe('a new game', () => {
  it('deals a board of the size picked, seeded, with nothing played and the starting charges', () => {
    let seed = 7;
    const r = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
    const game = gameReducer(null, { type: 'newGame', size: 'small' }, r)!;
    expect(game.id).toBe(1);
    expect(game.board.tiles).toHaveLength(50);
    expect(game.position).toMatchObject({ moves: 0, score: 0, lastMove: null, spare: null, message: '' });
    expect(game.position.charges).toEqual(startCharges());
    expect(game.position.cells.filter(c => c !== EMPTY)).toHaveLength(5); // 10% seeded
    expect(game.history).toEqual([]);
    expect(game.armed).toBeNull();
    // Each new game counts up, so each is recorded on the top 10 once
    expect(gameReducer(game, { type: 'newGame', size: 'medium' }, r)!.id).toBe(2);
  });

  it('does nothing else until there is a game', () => {
    expect(gameReducer(null, { type: 'undo' }, rand)).toBeNull();
  });
});

describe('placing', () => {
  it('a click places the next value on a tile of its shape, keeps the position for Undo, and deals again', () => {
    const before = gameOf();
    const g = run(before, click(0));
    expect(g.position.cells).toEqual([1, EMPTY, EMPTY, EMPTY, EMPTY]);
    expect(g.position.moves).toBe(1);
    expect(g.position.lastMove).toBe(0);
    expect(g.history).toEqual([before.position]);
    expect(g.position.next).toBe(1);
  });

  it('ignores a tile of the other shape, a filled tile and a press off the board', () => {
    const g = gameOf([EMPTY, 3, EMPTY, EMPTY, EMPTY]);
    for (const id of [3, 1, -1]) expect(run(g, click(id)).position).toBe(g.position);
  });

  it('merges and scores like a move', () => {
    const g = run(gameOf([EMPTY, 1, 1, EMPTY, EMPTY]), click(0));
    expect(g.position.cells).toEqual([3, EMPTY, 0, EMPTY, EMPTY]);
    expect(g.position.score).toBe(6);
    expect(g.position.message).toContain('Merged 3 tiles into B (+6).');
  });

  it('leaves the input unchanged', () => {
    const g = gameOf([EMPTY, 1, 1, EMPTY, EMPTY]);
    const copy = structuredClone(g);
    run(g, click(0), { type: 'swapSpare' }, { type: 'toggle', which: 'clear' });
    expect(g).toEqual(copy);
  });
});

describe('Tap to preview', () => {
  it('on, a first touch selects a tile and a second places there', () => {
    const one = run(gameOf(), touch(0));
    expect(one.selected).toBe(0);
    expect(one.position.moves).toBe(0);
    expect(previewFor(one, -1)?.value).toBe(1);
    const two = run(one, touch(0));
    expect(two.position.moves).toBe(1);
    expect(two.selected).toBe(-1);
  });

  it('a touch on another tile moves the selection; one where nothing fits clears it', () => {
    expect(run(gameOf(), touch(0), touch(1)).selected).toBe(1);
    expect(run(gameOf(), touch(0), touch(3)).selected).toBe(-1);
  });

  it('off, a touch places at once; a mouse always does', () => {
    expect(run(gameOf(), touch(0, 'place')).position.moves).toBe(1);
    expect(run(gameOf(), click(0)).position.moves).toBe(1);
  });

  it('Undo drops the selection; a swap with the spare keeps it, and the preview follows the new deal', () => {
    expect(run(gameOf(), click(0), touch(1), { type: 'undo' }).selected).toBe(-1);
    const kept = run(gameOf(undefined, { spare: { value: 3, shape: 'kite' } }), touch(0), { type: 'swapSpare' });
    expect(kept.selected).toBe(0);
    expect(previewFor(kept, -1)?.value).toBe(3);
  });

  it('switching the preference drops the selection', () => {
    expect(run(gameOf(), touch(0), { type: 'clearSelection' }).selected).toBe(-1);
  });
});

describe('Undo', () => {
  it('goes back a move, spending a charge', () => {
    const start = gameOf();
    const g = run(start, click(0), { type: 'undo' });
    expect(g.position.cells).toEqual(start.position.cells);
    expect(g.position.moves).toBe(0);
    expect(g.history).toEqual([]);
    expect(g.position.charges.undo).toBe(2);
    expect(g.position.message).toBe('Move undone. 2 Undos left.');
  });

  it('does nothing with no move to undo, or no charge', () => {
    const g = gameOf();
    expect(canUndo(g)).toBe(false);
    expect(run(g, { type: 'undo' })).toBe(g);
    const spent = run(gameOf(undefined, {}, { undo: 0 }), click(0));
    expect(canUndo(spent)).toBe(false);
    expect(run(spent, { type: 'undo' }).position.moves).toBe(1);
  });

  it('works after the game ends', () => {
    // One empty tile left: filling it ends the game
    const g = run(gameOf([EMPTY, 3, 9, 0, 3]), click(0));
    expect(g.position.cells.includes(EMPTY)).toBe(false);
    expect(run(g, { type: 'undo' }).position.cells[0]).toBe(EMPTY);
  });
});

describe('the hot spare', () => {
  it('keeps the next value, then swaps with it; it lasts through moves, and Undo restores it', () => {
    const kept = run(gameOf(undefined, { next: 3 }), { type: 'swapSpare' });
    expect(kept.position.spare).toEqual({ value: 3, shape: 'kite' });
    expect(kept.position.next).toBe(1);
    expect(kept.position.message).toBe('B kept as the spare.');
    const moved = run(kept, click(0));
    expect(moved.position.spare).toEqual({ value: 3, shape: 'kite' });
    const swapped = run(moved, { type: 'swapSpare' });
    expect(swapped.position.next).toBe(3);
    expect(swapped.position.spare?.value).toBe(1);
    expect(swapped.history).toEqual(moved.history); // not a move
    expect(run(swapped, { type: 'undo' }).position.spare).toEqual({ value: 3, shape: 'kite' });
  });
});

describe('arming power-ups', () => {
  it('arms one at a time; tapping the armed one, or disarm, cancels it', () => {
    const g = gameOf();
    expect(run(g, { type: 'toggle', which: 'clear' }).armed).toBe('clear');
    expect(run(g, { type: 'toggle', which: 'clear' }, { type: 'toggle', which: 'clear' }).armed).toBeNull();
    expect(run(g, { type: 'toggle', which: 'clear' }, { type: 'toggle', which: 'swap' }).armed).toBe('swap');
    expect(run(g, { type: 'toggle', which: 'sweep' }, { type: 'disarm' }).armed).toBeNull();
  });
});

describe('using a power-up on the board', () => {
  it('Clear empties the tile tapped, spends a charge and can be undone; it is not a move', () => {
    const g = run(gameOf([3, EMPTY, EMPTY, EMPTY, EMPTY], {}, { clear: 1 }), { type: 'toggle', which: 'clear' }, click(0));
    expect(g.position.cells[0]).toBe(EMPTY);
    expect(g.position.charges.clear).toBe(0);
    expect(g.position.moves).toBe(0);
    expect(g.position.lastMove).toBe(0);
    expect(g.position.message).toBe('Cleared B. 0 Clears left.');
    expect(g.armed).toBeNull();
    expect(run(g, { type: 'undo' }).position.cells[0]).toBe(3);
  });

  it('a tap where it can\'t be used disarms it without spending', () => {
    const g = run(gameOf(undefined, {}, { clear: 1 }), { type: 'toggle', which: 'clear' }, click(0));
    expect(g.armed).toBeNull();
    expect(g.position.charges.clear).toBe(1);
    expect(g.history).toEqual([]);
  });

  it('Swap picks a tile, unpicks it, picks another with the same value instead, then swaps', () => {
    const start = run(gameOf([1, 3, 1, EMPTY, EMPTY], {}, { swap: 1 }), { type: 'toggle', which: 'swap' });
    expect(run(start, click(0)).picked).toBe(0);
    expect(run(start, click(0), click(0)).picked).toBe(-1);
    expect(run(start, click(0), click(2)).picked).toBe(2);
    expect(run(start, click(3)).armed).toBeNull(); // an empty tile disarms
    const g = run(start, click(2), click(1));
    expect(g.position.cells).toEqual([1, 1, 3, EMPTY, EMPTY]);
    expect(g.position.charges.swap).toBe(0);
    expect(g.position.message).toBe('Swapped A and B.');
    expect(g.armed).toBeNull();
  });

  it('Sweep outlines the #s it would clear, then clears them', () => {
    const armed = run(gameOf([0, 1, 0, EMPTY, EMPTY], {}, { sweep: 1 }), { type: 'toggle', which: 'sweep' });
    expect(doomedAt(armed, 1)).toEqual([0, 2]);
    expect(run(armed, click(1)).position.cells).toEqual([EMPTY, 1, EMPTY, EMPTY, EMPTY]);
  });

  it('Upgrade previews the tile under the pointer, then raises it', () => {
    const armed = run(gameOf([1, EMPTY, EMPTY, EMPTY, EMPTY], {}, { upgrade: 1 }), { type: 'toggle', which: 'upgrade' });
    expect(previewFor(armed, 0)?.value).toBe(3);
    expect(previewFor(armed, 1)).toBeNull();
    expect(run(armed, click(0)).position.cells[0]).toBe(3);
  });
});

describe('Any shape', () => {
  it('lets the next value go on the other shape, and is spent by the move', () => {
    const g = gameOf(undefined, {}, { anyShape: 1 });
    expect(run(g, click(3)).position.moves).toBe(0);
    const placed = run(g, { type: 'toggle', which: 'anyShape' }, click(3));
    expect(placed.position.cells[3]).toBe(1);
    expect(placed.position.charges.anyShape).toBe(0);
    expect(placed.armed).toBeNull();
  });

  it('is the placement power-up: arming it, and only it, frees the shape', () => {
    const g = gameOf(undefined, {}, { anyShape: 1, clear: 1 });
    expect(placementArmed(run(g, { type: 'toggle', which: 'anyShape' }))).toBe(true);
    expect(placementArmed(run(g, { type: 'toggle', which: 'clear' }))).toBe(false);
    expect(placementArmed(g)).toBe(false);
  });
});

describe('the end of the game', () => {
  it('takes no more moves, spare swaps or power-ups', () => {
    const full = gameOf([1, 3, 9, 0, 3], {}, { clear: 1 });
    expect(run(full, click(0)).position).toBe(full.position);
    expect(run(full, { type: 'swapSpare' }).position).toBe(full.position);
    expect(run(full, { type: 'toggle', which: 'clear' }, click(0)).position).toBe(full.position);
  });
});
