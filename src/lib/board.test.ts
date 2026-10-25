import { describe, expect, it } from 'vitest';
import { BOARD_SIZES, boardBounds, centroid, makeBoard, playfieldFor, tileAtPoint } from './board';

describe('playfieldFor', () => {
  it('keeps each size\'s area and takes the shape asked for', () => {
    for (const size of BOARD_SIZES) {
      for (const aspect of [0.75, 1, 4 / 3, 1.8]) {
        const { width, height } = playfieldFor(size.id, aspect);
        expect(width * height).toBeCloseTo(size.area, 3);
        expect(width / height).toBeCloseTo(aspect, 6);
      }
    }
  });

  it('medium at 4:3 is the original 800 x 600 board', () => {
    const { width, height } = playfieldFor('medium', 4 / 3);
    expect(width).toBeCloseTo(800, 6);
    expect(height).toBeCloseTo(600, 6);
  });

  it('keeps the shape between 1:2 and 2:1', () => {
    const tall = playfieldFor('small', 0.2);
    expect(tall.width / tall.height).toBeCloseTo(0.5, 6);
    const wide = playfieldFor('small', 5);
    expect(wide.width / wide.height).toBeCloseTo(2, 6);
  });
});

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

  it('gives each size roughly its advertised number of tiles, in either orientation', () => {
    for (const size of BOARD_SIZES) {
      for (const aspect of [4 / 3, 3 / 4]) {
        const { width, height } = playfieldFor(size.id, aspect);
        const n = makeBoard(width, height).length;
        expect(n).toBeGreaterThan(size.tiles * 0.8);
        expect(n).toBeLessThan(size.tiles * 1.2);
      }
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
