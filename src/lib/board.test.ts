import { describe, expect, it } from 'vitest';
import { BOARD_SIZES, boardBounds, boardFor, centroid, makeBoard, tileAtPoint } from './board';

describe('makeBoard', () => {
  const tiles = makeBoard(800, 600);

  it('fills the playfield with kites and darts', () => {
    expect(tiles.length).toBeGreaterThan(150);
    expect(tiles.some(t => t.type === 'kite')).toBe(true);
    expect(tiles.some(t => t.type === 'dart')).toBe(true);
    for (const t of tiles) {
      for (const v of t.verts) {
        expect(v.x).toBeGreaterThan(-1);
        expect(v.x).toBeLessThan(800 + 1);
        expect(v.y).toBeGreaterThan(-1);
        expect(v.y).toBeLessThan(600 + 1);
      }
    }
  });

  it('gives every tile at most four neighbors, listed both ways', () => {
    for (const t of tiles) {
      expect(t.neighbors.length).toBeLessThanOrEqual(4);
      for (const n of t.neighbors) expect(tiles[n].neighbors).toContain(t.id);
    }
    expect(tiles.filter(t => t.neighbors.length === 4).length).toBeGreaterThan(tiles.length / 2);
  });

  it('finds each tile at its centroid', () => {
    for (const t of tiles) {
      const c = centroid(t.verts);
      expect(tileAtPoint(tiles, c.x, c.y)).toBe(t.id);
    }
  });

});

describe('boardFor', () => {
  it('gives each size a square board with its listed number of tiles: about 50, 100 and 200', () => {
    expect(BOARD_SIZES.map(s => boardFor(s.id).length)).toEqual(BOARD_SIZES.map(s => s.tiles));
    expect(BOARD_SIZES.map(s => s.tiles)).toEqual([47, 103, 196]);
    for (const size of BOARD_SIZES) {
      const b = boardBounds(boardFor(size.id));
      expect(b.width / b.height).toBeGreaterThan(0.9);
      expect(b.width / b.height).toBeLessThan(1.1);
    }
  });
});

describe('boardBounds', () => {
  it('is the box around every vertex', () => {
    const tiles = makeBoard(800, 600);
    const b = boardBounds(tiles);
    const all = tiles.flatMap(t => t.verts);
    expect(Math.min(...all.map(v => v.x))).toBe(b.x);
    expect(Math.max(...all.map(v => v.y))).toBeCloseTo(b.y + b.height, 9);
    expect(b.width).toBeLessThanOrEqual(801);
    expect(b.height).toBeLessThanOrEqual(601);
  });
});
