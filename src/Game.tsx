import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BOARD_SIZES, boardBounds, boardFor, centroid, tileAtPoint,
  type BoardSize, type BoardTile,
} from './lib/board';
import { parseBoardSize, parseOptions } from './lib/prefs';
import {
  EMPTY, MIN_GROUP, WILD,
  type Cell, type Merge, type Options,
  applyPressure, canPlace, deckFor, drawValue, highestTile, nextSpawn, outcome, place, previewAt, seedBoard,
  valueToPlace,
} from './lib/rules';
import { fitView, toBoard } from './lib/view';
import { EMPTY_FILL, colorsFor, fillFor, textFor } from './lib/colors';
import Preferences from './Preferences';

// The rule options and board size are remembered in this browser
// (localStorage).
const OPTIONS_STORAGE_KEY = 'penrosum.options';
const SIZE_STORAGE_KEY = 'penrosum.boardSize';

const load = <T,>(key: string, parse: (raw: string | null) => T): T => {
  try {
    return parse(localStorage.getItem(key));
  } catch {
    return parse(null);
  }
};

const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (e.g. private mode): the choice lasts this visit
  }
};

// Space kept clear around the board, in screen pixels.
const BOARD_MARGIN = 8;

// The value for the next move, drawn in advance so it can be shown
const nextValueFor = (options: Options) => drawValue(Math.random, deckFor(options));

// How a drawn value is shown: the wildcard as a star
const showDrawn = (drawn: number) => (drawn === WILD ? '★' : String(drawn));

// "Merged 3 tiles into 3, then 3 tiles into 9"
const describeMerges = (merges: Merge[]) =>
  merges.length ? `Merged ${merges.map(m => `${m.from.length + 1} tiles into ${m.sum}`).join(', then ')}` : '';

// The next value as a chip in the tile's own colors (the wildcard in its
// rainbow). Keyed by the move count, so each new draw pops in.
const NextChip = ({ drawn, moves }: { drawn: number; moves: number }) => {
  const { fill, text } = colorsFor(drawn);
  return (
    <b
      key={moves}
      aria-label={`Next: ${drawn === WILD ? 'wildcard' : drawn}`}
      className="next-chip inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-md border border-slate-400/60 shadow-sm text-base"
      style={{ background: fill, color: text, textShadow: drawn === WILD ? '0 1px 2px #0006' : undefined }}
    >
      {showDrawn(drawn)}
    </b>
  );
};

interface Board {
  size: BoardSize;
  tiles: BoardTile[];
  bounds: ReturnType<typeof boardBounds>;
}

interface Snapshot {
  cells: Cell[];
  next: number;
  moves: number;
  lastMove: number | null;
  spawnAt: number | null; // where the 'spawn' pressure rule's next 0 appears
  message: string;
}


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

const Game = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [options, setOptions] = useState(() => load(OPTIONS_STORAGE_KEY, parseOptions));
  const [size, setSize] = useState(() => load(SIZE_STORAGE_KEY, parseBoardSize));
  // The space for the board, in CSS pixels; measured before the first paint
  const [space, setSpace] = useState({ width: 0, height: 0 });
  // Made on mount, and by New Game
  const [board, setBoard] = useState<Board | null>(null);
  const [state, setState] = useState<Snapshot | null>(null);
  const [undo, setUndo] = useState<Snapshot[]>([]);
  const [hovered, setHovered] = useState(-1);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showSizes, setShowSizes] = useState(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSpace({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Starts a new game on a board of `newSize`
  const newGame = useCallback((newSize: BoardSize) => {
    const tiles = boardFor(newSize);
    setBoard({ size: newSize, tiles, bounds: boardBounds(tiles) });
    const cells = seedBoard(tiles);
    setState({
      cells, next: nextValueFor(options), moves: 0, lastMove: null, spawnAt: nextSpawn(cells, options), message: '',
    });
    setUndo([]);
    setHovered(-1);
    setSize(newSize);
    save(SIZE_STORAGE_KEY, newSize);
  }, [options]);

  useEffect(() => {
    if (!board) newGame(size);
  }, [board, size, newGame]);

  const setOption = <K extends keyof Options>(key: K, value: Options[K]) => {
    const updated = { ...options, [key]: value };
    setOptions(updated);
    save(OPTIONS_STORAGE_KEY, JSON.stringify(updated));
    if (key === 'wild') setState(s => s && { ...s, next: nextValueFor(updated) });
    if (key === 'pressure') setState(s => s && { ...s, spawnAt: nextSpawn(s.cells, updated) });
  };
  const closePrefs = useCallback(() => setShowPrefs(false), []);

  // Escape closes the board-size menu
  useEffect(() => {
    if (!showSizes) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowSizes(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSizes]);

  const tiles = board?.tiles ?? [];
  const cells = state?.cells ?? [];
  const result = outcome(cells, options);
  const drawn = state?.next ?? 1;

  const undoMove = () => {
    if (!undo.length) return;
    setState(undo[undo.length - 1]);
    setUndo(undo.slice(0, -1));
  };

  const play = (id: number) => {
    if (!state || result.over || id < 0 || !canPlace(cells, id)) return;
    const value = valueToPlace(tiles, cells, id, drawn, options);
    const { cells: placed, merges } = place(tiles, cells, id, value, options);
    const { cells: after, zeros, spawnAt } = applyPressure(placed, merges, options, state.spawnAt);
    setUndo([...undo, state]);
    setState({
      cells: after,
      next: nextValueFor(options),
      moves: state.moves + 1,
      lastMove: id,
      spawnAt,
      message: [
        drawn === WILD ? `Wild played as ${value}.` : '',
        describeMerges(merges),
        zeros.length === 1 ? 'A 0 dropped.' : zeros.length ? `${zeros.length} zeros dropped.` : '',
      ].filter(Boolean).join(' '),
    });
  };

  // What the hovered tile would do, for the preview
  const preview = useMemo(() => {
    if (hovered < 0 || result.over || !canPlace(cells, hovered)) return null;
    return previewAt(tiles, cells, hovered, drawn, options);
  }, [hovered, cells, drawn, options, result.over, tiles]);

  const view = useMemo(
    () => board && fitView(board.bounds, space.width, space.height, BOARD_MARGIN),
    [board, space],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !view || !state) return;
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
      ctx.fillStyle = v === EMPTY ? EMPTY_FILL : fillFor(v);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = px;
      ctx.stroke();
      if (v !== EMPTY) drawNumber(ctx, t, String(v), textFor(v));
    }

    // Tiles the hovered move would merge
    for (const id of inGroup) {
      tracePath(ctx, tiles[id]);
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Where the next 'spawn' 0 will appear: a dashed ring
    if (state.spawnAt !== null && cells[state.spawnAt] === EMPTY) {
      tracePath(ctx, tiles[state.spawnAt]);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (state.lastMove !== null) {
      tracePath(ctx, tiles[state.lastMove]);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (preview) {
      const t = tiles[hovered];
      tracePath(ctx, t);
      ctx.fillStyle = inGroup.size ? '#c7d2fe' : '#e0e7ff';
      ctx.fill();
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 3;
      ctx.stroke();
      drawNumber(ctx, t, String(preview.value), '#3730a3');
    }
  }, [tiles, cells, state, hovered, preview, view, space]);

  const tileFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!view) return -1;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = toBoard(view, e.clientX - rect.left, e.clientY - rect.top);
    return tileAtPoint(tiles, p.x, p.y);
  };

  const moves = state?.moves ?? 0;
  const free = cells.filter(c => c === EMPTY).length;
  let status = state?.message || (moves === 0
    ? `Place the Next number on an empty tile. ${MIN_GROUP} or more matching tiles merge into the one you placed.`
    : '');
  if (state && result.over) {
    status = result.won
      ? options.goal === 'target'
        ? `You made ${result.highest} in ${moves} moves!`
        : `Board full. Highest tile: ${result.highest} after ${moves} moves.`
      : `Board full before reaching ${options.target}. Highest tile: ${result.highest}.`;
  }

  const button = 'px-3 py-1 rounded text-sm border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40';

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-slate-100 text-slate-900">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 bg-white shadow-sm z-10">
        <h1 className="text-xl font-bold text-indigo-700">Penrosum</h1>
        <div className="flex flex-wrap gap-x-4 text-sm">
          <span>Moves <b>{moves}</b></span>
          <span>Highest <b>{highestTile(cells)}</b></span>
          <span>Free <b>{free}</b></span>
          {options.goal === 'target' && <span>Target <b>{options.target}</b></span>}
          <span className="flex items-center gap-1.5">
            Next
            <NextChip drawn={drawn} moves={moves} />
          </span>
        </div>
        <div className="flex gap-2 ml-auto">
          <button onClick={undoMove} disabled={!undo.length} className={button}>Undo</button>
          <div className="relative">
            <button onClick={() => setShowSizes(s => !s)} aria-expanded={showSizes} aria-haspopup="menu"
              className="px-3 py-1 rounded text-sm bg-indigo-600 text-white">
              New Game ▾
            </button>
            {showSizes && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowSizes(false)} />
                <div role="menu" className="absolute right-0 mt-1 z-30 w-48 rounded-md bg-white shadow-lg border border-slate-200 py-1">
                  {BOARD_SIZES.map(s => (
                    <button key={s.id} role="menuitem"
                      onClick={() => { setShowSizes(false); newGame(s.id); }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 flex justify-between">
                      <span className={s.id === board?.size ? 'font-semibold text-indigo-700' : ''}>{s.name}</span>
                      <span className="text-slate-500">{s.tiles} tiles</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={() => setShowPrefs(true)} className={button}>Preferences</button>
        </div>
      </header>

      <main ref={containerRef} className="relative flex-1 min-h-0">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none cursor-pointer"
          onPointerMove={e => setHovered(tileFromEvent(e))}
          onPointerLeave={() => setHovered(-1)}
          onPointerDown={e => play(tileFromEvent(e))}
        />
      </main>

      <p className="px-3 py-1.5 text-sm font-medium bg-white border-t border-slate-200 truncate" aria-live="polite">
        {status || ' '}
      </p>

      {showPrefs && <Preferences options={options} setOption={setOption} onClose={closePrefs} />}
    </div>
  );
};

export default Game;
