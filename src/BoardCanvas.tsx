import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { centroid, tileAtPoint, type BoardTile, type Rosette, boardBounds } from './lib/board';
import { type Palette, fillFor, textFor, tileFill } from './lib/colors';
import type { Preview } from './lib/powerups';
import { EMPTY, type Cell, type Shape } from './lib/rules';
import { fitView, toBoard } from './lib/view';

// Space kept clear around the board, in screen pixels.
const BOARD_MARGIN = 8;

const tracePath = (ctx: CanvasRenderingContext2D, t: BoardTile) => {
  ctx.beginPath();
  t.verts.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)));
  ctx.closePath();
};

// Where a tile's number goes: the centroid for a kite; for a dart, a point
// on its axis toward the tip, clear of the notch.
const labelPoint = (t: BoardTile) => {
  if (t.type === 'kite') return centroid(t.verts);
  const [m, , a] = t.verts;
  return { x: m.x + (a.x - m.x) * 0.45, y: m.y + (a.y - m.y) * 0.45 };
};

const drawNumber = (ctx: CanvasRenderingContext2D, t: BoardTile, text: string, color: string) => {
  const c = labelPoint(t);
  const size = text.length >= 3 ? 13 : 16;
  ctx.fillStyle = color;
  ctx.font = `bold ${t.type === 'dart' ? size - 2 : size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.x, c.y);
};

// Outlines tile `t` in `color`, `width` board units wide.
const outline = (ctx: CanvasRenderingContext2D, t: BoardTile, color: string, width: number) => {
  tracePath(ctx, t);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
};

// Every tile: its fill (see tileFill), a one-screen-pixel edge (`px` board
// units), and its letter.
const drawTiles = (
  ctx: CanvasRenderingContext2D, tiles: BoardTile[], cells: Cell[], mustBe: Shape | null,
  palette: Palette, label: (v: number) => string, px: number,
) => {
  for (const t of tiles) {
    const v = cells[t.id];
    tracePath(ctx, t);
    ctx.fillStyle = tileFill(v, t.type, mustBe, palette);
    ctx.fill();
    ctx.strokeStyle = palette.tileEdge;
    ctx.lineWidth = px;
    ctx.stroke();
    if (v !== EMPTY) drawNumber(ctx, t, label(v), textFor(v, palette));
  }
};

// Where each sun and star's five tips meet: a small ring, filled gold once
// completed.
const drawRings = (ctx: CanvasRenderingContext2D, rosettes: Rosette[], completed: number[], palette: Palette) => {
  rosettes.forEach((r, i) => {
    const done = completed.includes(i);
    ctx.beginPath();
    ctx.arc(r.center.x, r.center.y, 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = done ? palette.ringDoneFill : palette.ringFill;
    ctx.fill();
    ctx.strokeStyle = done ? palette.ringDoneEdge : palette.ringEdge;
    ctx.lineWidth = done ? 1.5 : 1.2;
    ctx.stroke();
  });
};

// Where the move's rubble would land: a # with the preview's outline.
const drawRubble = (ctx: CanvasRenderingContext2D, t: BoardTile, palette: Palette, label: (v: number) => string) => {
  tracePath(ctx, t);
  ctx.fillStyle = fillFor(0, palette);
  ctx.fill();
  outline(ctx, t, palette.previewOutline, 3);
  drawNumber(ctx, t, label(0), textFor(0, palette));
};

// The outlines over the tiles, in order: the tiles the previewed move
// would merge, what an armed power-up would empty (Clear: a tile; Sweep:
// #s), Swap's first tile picked, and the last move.
const drawOutlines = (
  ctx: CanvasRenderingContext2D, tiles: BoardTile[], merging: number[], doomed: number[], picked: number,
  lastMove: number | null, palette: Palette,
) => {
  for (const id of new Set(merging)) outline(ctx, tiles[id], palette.previewOutline, 3);
  for (const id of doomed) outline(ctx, tiles[id], palette.doomedOutline, 4);
  if (picked >= 0) outline(ctx, tiles[picked], palette.pickedOutline, 4);
  if (lastMove !== null) outline(ctx, tiles[lastMove], palette.lastMoveOutline, 3);
};

// The previewed tile: tinted (more strongly when it would merge),
// outlined, with the letter it would end up with; then where its rubble
// would land.
const drawPreview = (
  ctx: CanvasRenderingContext2D, tiles: BoardTile[], previewed: number, preview: Preview, palette: Palette,
  label: (v: number) => string,
) => {
  const t = tiles[previewed];
  tracePath(ctx, t);
  ctx.fillStyle = preview.merging.length ? palette.previewTintMerging : palette.previewTint;
  ctx.fill();
  outline(ctx, t, palette.previewOutline, 3);
  drawNumber(ctx, t, label(preview.value), palette.previewText);
  for (const id of preview.rubble) drawRubble(ctx, tiles[id], palette, label);
};


export interface BoardCanvasProps {
  tiles: BoardTile[];
  bounds: ReturnType<typeof boardBounds>;
  rosettes: Rosette[]; // its suns and stars
  completed: number[]; // the suns and stars completed (gold rings)
  cells: Cell[];
  lastMove: number | null; // outlined in amber
  mustBe: Shape | null; // empty tiles of the other shape are shaded
  previewed: number; // the tile the preview is for, or -1
  preview: Preview | null;
  doomed: number[]; // tiles an armed power-up would empty, outlined in red
  picked: number; // a tile an armed power-up has picked (Swap's first), or -1
  crosshair: boolean; // the cursor while a power-up waits for a tap
  label: (v: number) => string;
  palette: Palette; // every color it draws in
  onHover: (id: number) => void; // the tile under the pointer, or -1
  onTap: (id: number, pointerType: string) => void; // a press on tile `id` (-1 off the board)
}

// The board: fitted to the space it is given, drawn on a canvas at the
// screen's pixel density, and reporting which tile the pointer is over and
// which is pressed. It draws what it is told; the game decides what.
const BoardCanvas = ({
  tiles, bounds, rosettes, completed, cells, lastMove, mustBe, previewed, preview, doomed, picked,
  crosshair, label, palette, onHover, onTap,
}: BoardCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The space for the board, in CSS pixels; measured before the first paint
  const [space, setSpace] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSpace({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const view = useMemo(() => fitView(bounds, space.width, space.height, BOARD_MARGIN), [bounds, space]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    // Sharp on high-density screens: the canvas has a pixel per device pixel
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(space.width * dpr);
    canvas.height = Math.round(space.height * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw in board units from here on
    ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.offsetX, dpr * view.offsetY);
    const px = 1 / view.scale; // one screen pixel, in board units

    drawTiles(ctx, tiles, cells, mustBe, palette, label, px);
    drawRings(ctx, rosettes, completed, palette);
    drawOutlines(ctx, tiles, preview?.merging ?? [], doomed, picked, lastMove, palette);
    if (preview) drawPreview(ctx, tiles, previewed, preview, palette, label);
  }, [tiles, rosettes, completed, cells, lastMove, mustBe, previewed, preview, doomed, picked, view, space, label, palette]);

  const tileFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = toBoard(view, e.clientX - rect.left, e.clientY - rect.top);
    return tileAtPoint(tiles, p.x, p.y);
  };

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full touch-none ${crosshair ? 'cursor-crosshair' : 'cursor-pointer'}`}
        onPointerMove={e => onHover(tileFromEvent(e))}
        onPointerLeave={() => onHover(-1)}
        onPointerDown={e => onTap(tileFromEvent(e), e.pointerType)}
      />
    </div>
  );
};

export default BoardCanvas;
