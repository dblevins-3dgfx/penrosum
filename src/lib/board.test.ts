import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZES, MAX_TRIES, boardBounds, boardFor, centroid, edgeKey, isConnected, makeBoard, patchTiles, tileAtPoint,
  type BoardTile,
} from './board';

// A repeatable random source (a small linear congruential generator)
const lcg = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;

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

describe('edgeKey', () => {
  // Every edge of the patch, with its tile
  const edges = patchTiles().flatMap((t, id) =>
    t.verts.map((p, e) => ({ id, p, q: t.verts[(e + 1) % 4], key: edgeKey(p, t.verts[(e + 1) % 4]) })));
  const same = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01;
  const sameEdge = (a: typeof edges[0], b: typeof edges[0]) =>
    (same(a.p, b.p) && same(a.q, b.q)) || (same(a.p, b.q) && same(a.q, b.p));

  it('gives two edges the same key only when they are the same edge', () => {
    const byKey = new Map<string, typeof edges>();
    for (const e of edges) byKey.set(e.key, [...(byKey.get(e.key) ?? []), e]);
    for (const group of byKey.values()) {
      expect(group.length).toBeLessThanOrEqual(2);
      if (group.length === 2) expect(sameEdge(group[0], group[1])).toBe(true);
    }
  });

  it('gives an edge shared by two tiles the same key in both, across the whole patch', () => {
    // Bucket edges by midpoint so only nearby edges are compared
    const cell = (e: typeof edges[0]) => `${Math.floor((e.p[0] + e.q[0]) / 20)},${Math.floor((e.p[1] + e.q[1]) / 20)}`;
    const buckets = new Map<string, typeof edges>();
    for (const e of edges) buckets.set(cell(e), [...(buckets.get(cell(e)) ?? []), e]);
    let shared = 0;
    for (const e of edges) {
      const [cx, cy] = cell(e).split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const f of buckets.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (f.id === e.id || !sameEdge(e, f)) continue;
          shared++;
          expect(f.key).toBe(e.key);
        }
      }
    }
    expect(shared).toBeGreaterThan(edges.length / 2);
  });
});

describe('isConnected', () => {
  const tile = (id: number, neighbors: number[]): BoardTile => ({ id, type: 'kite', verts: [], neighbors });
  it('is true when every tile can be reached from every other', () => {
    expect(isConnected([tile(0, [1]), tile(1, [0, 2]), tile(2, [1])])).toBe(true);
    expect(isConnected([])).toBe(true);
  });
  it('is false with a stranded tile or a separate piece', () => {
    expect(isConnected([tile(0, [1]), tile(1, [0]), tile(2, [])])).toBe(false);
    expect(isConnected([tile(0, [1]), tile(1, [0]), tile(2, [3]), tile(3, [2])])).toBe(false);
  });
});

describe('boardFor', () => {
  it('lists the sizes as 50, 100 and 200 tiles', () => {
    expect(BOARD_SIZES.map(s => s.tiles)).toEqual([50, 100, 200]);
  });

  it('deals a square board in one piece with exactly the size\'s tile count', () => {
    const rand = lcg(11);
    for (let k = 0; k < 5; k++) {
      for (const size of BOARD_SIZES) {
        const tiles = boardFor(size.id, rand);
        expect(tiles).toHaveLength(size.tiles);
        expect(isConnected(tiles)).toBe(true);
        const b = boardBounds(tiles);
        expect(b.width / b.height).toBeGreaterThan(0.85);
        expect(b.width / b.height).toBeLessThan(1.15);
        expect(b.width).toBeLessThanOrEqual(size.side + 1);
        for (const t of tiles) {
          expect(t.neighbors.length).toBeGreaterThan(0);
          expect(t.neighbors.length).toBeLessThanOrEqual(4);
          for (const n of t.neighbors) expect(tiles[n].neighbors).toContain(t.id);
        }
      }
    }
  });

  it('deals a different board each time, and the same one for the same random draws', () => {
    const shape = (tiles: BoardTile[]) => tiles.map(t => `${t.type}:${t.verts.map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(';')}`).join('|');
    const rand = lcg(5);
    const first = shape(boardFor('medium', rand));
    const second = shape(boardFor('medium', rand));
    expect(second).not.toBe(first);
    expect(shape(boardFor('medium', lcg(5)))).toBe(first);
  });

  it(`after ${MAX_TRIES} tries without an exact count, uses the closest board in one piece`, () => {
    // Always the same placement: the patch's center, unturned, which holds
    // 49 tiles on the small board
    const tiles = boardFor('small', () => 0);
    expect(tiles).toHaveLength(makeBoard(360, 360).length);
    expect(tiles).toHaveLength(49);
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
