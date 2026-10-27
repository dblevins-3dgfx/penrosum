import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { centroid, tileAtPoint, type BoardTile, type Rosette, boardBounds } from './lib/board';
import { type Palette, fillFor, textFor } from './lib/colors';
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

    const inGroup = new Set(preview?.merging);
    for (const t of tiles) {
      const v = cells[t.id];
      tracePath(ctx, t);
      ctx.fillStyle = v !== EMPTY ? fillFor(v, palette) : mustBe && t.type !== mustBe ? palette.offShapeFill : palette.emptyFill;
      ctx.fill();
      ctx.strokeStyle = palette.tileEdge;
      ctx.lineWidth = px;
      ctx.stroke();
      if (v !== EMPTY) drawNumber(ctx, t, label(v), textFor(v, palette));
    }

    // Where each sun and star's five tips meet: a small ring, filled gold
    // once completed
    rosettes.forEach((r, i) => {
      ctx.beginPath();
      ctx.arc(r.center.x, r.center.y, 4.5, 0, 2 * Math.PI);
      const done = completed.includes(i);
      ctx.fillStyle = done ? palette.ringDoneFill : palette.ringFill;
      ctx.fill();
      ctx.strokeStyle = done ? palette.ringDoneEdge : palette.ringEdge;
      ctx.lineWidth = done ? 1.5 : 1.2;
      ctx.stroke();
    });

    // Tiles the previewed move would merge
    for (const id of inGroup) {
      tracePath(ctx, tiles[id]);
      ctx.strokeStyle = palette.previewOutline;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // What the armed power-up would empty at the tile under the pointer
    // (Clear: the tile; Sweep: its #s and its neighbors')
    for (const id of doomed) {
      tracePath(ctx, tiles[id]);
      ctx.strokeStyle = palette.doomedOutline;
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // With Swap armed, the first tile picked
    if (picked >= 0) {
      tracePath(ctx, tiles[picked]);
      ctx.strokeStyle = palette.pickedOutline;
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    if (lastMove !== null) {
      tracePath(ctx, tiles[lastMove]);
      ctx.strokeStyle = palette.lastMoveOutline;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (preview) {
      const t = tiles[previewed];
      tracePath(ctx, t);
      ctx.fillStyle = inGroup.size ? palette.previewTintMerging : palette.previewTint;
      ctx.fill();
      ctx.strokeStyle = palette.previewOutline;
      ctx.lineWidth = 3;
      ctx.stroke();
      drawNumber(ctx, t, label(preview.value), palette.previewText);
    }

    // Where the move's rubble would land: a gray # with the
    // merge outline
    for (const id of preview?.rubble ?? []) {
      const t = tiles[id];
      tracePath(ctx, t);
      ctx.fillStyle = fillFor(0, palette);
      ctx.fill();
      ctx.strokeStyle = palette.previewOutline;
      ctx.lineWidth = 3;
      ctx.stroke();
      drawNumber(ctx, t, label(0), textFor(0, palette));
    }
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
