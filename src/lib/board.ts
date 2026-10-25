import { generatePatch } from '../../penrose-board';

export const PHI = (1 + Math.sqrt(5)) / 2;

// The kite's long edge, in board units.
export const TILE_SIZE = 60;

// Board sizes. Every board is a square playfield, `side` board units
// across, so it fits the screen the same way whichever way the screen is
// turned, and holds exactly `tiles` tiles (see boardFor). The sides are
// the ones whose random boards hold that many tiles on average.
export type BoardSize = 'small' | 'medium' | 'large';
export const BOARD_SIZES: { id: BoardSize; name: string; side: number; tiles: number }[] = [
  { id: 'small', name: 'Small', side: 360, tiles: 50 },
  { id: 'medium', name: 'Medium', side: 485, tiles: 100 },
  { id: 'large', name: 'Large', side: 660, tiles: 200 },
];
export const DEFAULT_BOARD_SIZE: BoardSize = 'medium';

// How far from the patch's center a board's center may be, in board units.
// The patch covers a disc of about TILE_SIZE * PHI ** 7 (some 1,740 units),
// and the large board reaches about 470 units from its center, so every
// board stays fully covered.
export const MAX_OFFSET = 1100;

// How many random placements boardFor tries before settling for the best.
export const MAX_TRIES = 500;

// A random board for a size: a randomly placed and turned square cut from
// the Penrose patch, redrawn until it holds exactly the size's tile count
// and is all one piece (every tile reachable from every other through
// neighbors, so no tile is stranded). If no placement in MAX_TRIES does
// both, the one-piece board closest to the count is used. `rand` returns a
// number in [0, 1).
export const boardFor = (size: BoardSize, rand: () => number = Math.random) => {
  const { side, tiles: target } = BOARD_SIZES.find(s => s.id === size)!;
  let best: BoardTile[] | null = null;
  for (let i = 0; i < MAX_TRIES; i++) {
    const r = MAX_OFFSET * Math.sqrt(rand());
    const a = 2 * Math.PI * rand();
    const tiles = makeBoard(side, side, { x: r * Math.cos(a), y: r * Math.sin(a), angle: 360 * rand() });
    if (!isConnected(tiles)) continue;
    if (tiles.length === target) return tiles;
    if (!best || Math.abs(tiles.length - target) < Math.abs(best.length - target)) best = tiles;
  }
  return best ?? makeBoard(side, side);
};

// Whether every tile can be reached from every other through neighbors.
export const isConnected = (tiles: BoardTile[]) => {
  if (!tiles.length) return true;
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    for (const n of tiles[queue.pop()!].neighbors) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen.size === tiles.length;
};

export interface Point { x: number; y: number }
export interface BoardTile {
  id: number;
  type: 'kite' | 'dart';
  verts: Point[];
  neighbors: number[];
}

// The Penrose patch every board is cut from: about 4,900 tiles around the
// origin, built once.
type PatchTile = { type: 'kite' | 'dart'; verts: [number, number][] };
let patch: PatchTile[] | null = null;
const getPatch = () => (patch ??= generatePatch(TILE_SIZE, 7) as PatchTile[]);

// An edge of the patch, the same for both tiles along it: its ends to the
// nearest unit (as in Penrogo), in either order.
export const edgeKey = ([ax, ay]: [number, number], [bx, by]: [number, number]) => {
  const a = `${Math.round(ax)},${Math.round(ay)}`, b = `${Math.round(bx)},${Math.round(by)}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
};

// Every tile of the patch (for tests).
export const patchTiles = (): readonly PatchTile[] => getPatch();

// Where a board sits on the patch: the patch point at the board's center,
// and how far the patch is turned, in degrees.
export interface Placement { x: number; y: number; angle: number }

// A width x height board cut from the patch at `placement`: the tiles lying
// fully inside it, with neighbor lists (tiles sharing a full edge). The
// default puts the patch's center (the middle of its sun) at the board's
// center, unturned.
export const makeBoard = (
  width: number, height: number, placement: Placement = { x: 0, y: 0, angle: 0 },
): BoardTile[] => {
  const t = placement.angle * Math.PI / 180;
  const cos = Math.cos(t), sin = Math.sin(t);
  const place = ([x, y]: [number, number]): Point => {
    const dx = x - placement.x, dy = y - placement.y;
    return { x: dx * cos - dy * sin + width / 2, y: dx * sin + dy * cos + height / 2 };
  };
  const EDGE_TOL = 0.5;
  const inside = (v: Point) => v.x >= -EDGE_TOL && v.x <= width + EDGE_TOL && v.y >= -EDGE_TOL && v.y <= height + EDGE_TOL;

  const tiles: BoardTile[] = [];
  const cut: PatchTile[] = []; // the patch tile each board tile came from
  for (const p of getPatch()) {
    const verts = p.verts.map(place);
    if (verts.every(inside)) {
      tiles.push({ id: tiles.length, type: p.type, verts, neighbors: [] });
      cut.push(p);
    }
  }

  // Neighbors: tiles that share a full edge, matched by edgeKey on the
  // patch's own coordinates, so the matching doesn't depend on placement
  const byEdge = new Map<string, number[]>();
  cut.forEach((p, id) => {
    for (let e = 0; e < 4; e++) {
      const k = edgeKey(p.verts[e], p.verts[(e + 1) % 4]);
      byEdge.set(k, [...(byEdge.get(k) ?? []), id]);
    }
  });
  for (const ids of byEdge.values()) {
    if (ids.length !== 2) continue;
    const [a, b] = ids;
    tiles[a].neighbors.push(b);
    tiles[b].neighbors.push(a);
  }
  return tiles;
};

// The smallest rectangle around all the tiles.
export const boardBounds = (tiles: BoardTile[]) => {
  const xs = tiles.flatMap(t => t.verts.map(v => v.x));
  const ys = tiles.flatMap(t => t.verts.map(v => v.y));
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
};

export const centroid = (verts: Point[]): Point => ({
  x: verts.reduce((s, v) => s + v.x, 0) / verts.length,
  y: verts.reduce((s, v) => s + v.y, 0) / verts.length,
});

// Both tiles split into two triangles along the vertex 0 to 2 diagonal
// (the axis), which also handles the dart's concave notch.
const toTriangles = (v: Point[]) => [[v[0], v[1], v[2]], [v[0], v[2], v[3]]];

const pointInTriangle = (px: number, py: number, [a, b, c]: Point[]) => {
  const d1 = (px - b.x) * (a.y - b.y) - (a.x - b.x) * (py - b.y);
  const d2 = (px - c.x) * (b.y - c.y) - (b.x - c.x) * (py - c.y);
  const d3 = (px - a.x) * (c.y - a.y) - (c.x - a.x) * (py - a.y);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
};

// Index of the board tile containing (x, y), or -1.
export const tileAtPoint = (tiles: BoardTile[], x: number, y: number) =>
  tiles.findIndex(t => toTriangles(t.verts).some(tri => pointInTriangle(x, y, tri)));
