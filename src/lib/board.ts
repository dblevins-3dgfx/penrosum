import { buildBoard } from '../../penrose-board';

export const PHI = (1 + Math.sqrt(5)) / 2;

// Playfield size (matches the canvas) and the kite's long edge.
export const BOARD_W = 800;
export const BOARD_H = 600;
export const TILE_SIZE = 60;

export interface Point { x: number; y: number }
export interface BoardTile {
  id: number;
  type: 'kite' | 'dart';
  verts: Point[];
  neighbors: number[];
}

// Kite: vertices O(72°) -> B(72°) -> C(144°) -> D(72°), edges long, short,
// short, long. Axis of symmetry through O and C. Centered on the centroid.
// (The same geometry as Penrogo's opening tile.)
export const kiteVertices = (x: number, y: number, rotation: number): Point[] => {
  const r = rotation * Math.PI / 180;
  const long = TILE_SIZE;
  const deg36 = 36 * Math.PI / 180;

  const local = [
    { x: 0, y: 0 },
    { x: long * Math.cos(r + deg36), y: long * Math.sin(r + deg36) },
    { x: long * Math.cos(r), y: long * Math.sin(r) },
    { x: long * Math.cos(r - deg36), y: long * Math.sin(r - deg36) },
  ];

  const cx = local.reduce((s, v) => s + v.x, 0) / local.length;
  const cy = local.reduce((s, v) => s + v.y, 0) / local.length;

  return local.map(v => ({ x: x + v.x - cx, y: y + v.y - cy }));
};

// The board: a Penrose tiling around a kite at the center of the playfield,
// pointing up, clipped to the playfield.
export const makeBoard = (): BoardTile[] =>
  buildBoard('kite', kiteVertices(BOARD_W / 2, BOARD_H / 2, -90), BOARD_W, BOARD_H, TILE_SIZE).tiles;

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
