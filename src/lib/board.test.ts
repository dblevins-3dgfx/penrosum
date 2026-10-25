import { describe, expect, it } from 'vitest';
import { BOARD_H, BOARD_W, centroid, makeBoard, tileAtPoint } from './board';

describe('makeBoard', () => {
  const tiles = makeBoard();

  it('fills the playfield with kites and darts', () => {
    expect(tiles.length).toBeGreaterThan(150);
    expect(tiles.some(t => t.type === 'kite')).toBe(true);
    expect(tiles.some(t => t.type === 'dart')).toBe(true);
    for (const t of tiles) {
      for (const v of t.verts) {
        expect(v.x).toBeGreaterThan(-1);
        expect(v.x).toBeLessThan(BOARD_W + 1);
        expect(v.y).toBeGreaterThan(-1);
        expect(v.y).toBeLessThan(BOARD_H + 1);
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
