import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BOARD_SIZES, boardBounds, centroid, makeBoard, playfieldFor, tileAtPoint,
  type BoardSize, type BoardTile,
} from './lib/board';
import { parseBoardSize, parseOptions } from './lib/prefs';
import {
  EMPTY, MIN_GROUP,
  type Cell, type Merge, type Options,
  canPlace, choosableValues, deckFor, drawValue, highestTile, outcome, place, previewAt, seedBoard,
} from './lib/rules';
import { fitView, toBoard } from './lib/view';
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

// The value for the next move under the 'random' rule; under the others it
// is decided at the move (always 1, or the player's pick).
const nextValueFor = (options: Options) => {
  const deck = deckFor(options);
  return deck.length ? drawValue(Math.random, deck) : 1;
};

// "Merged 3 tiles into 3, then 3 tiles into 9"
const describeMerges = (merges: Merge[]) =>
  merges.length ? `Merged ${merges.map(m => `${m.from.length + 1} tiles into ${m.sum}`).join(', then ')}` : '';

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
  message: string;
}

// Tile fill by value: warmer and then cooler as numbers grow.
const fillFor = (value: number) => {
  if (value === 0) return '#cbd5e1';
  if (value === 1) return '#fef3c7';
  if (value === 2) return '#fde68a';
  if (value <= 4) return '#fcd34d';
  if (value <= 7) return '#fb923c';
  if (value <= 12) return '#f87171';
  if (value <= 20) return '#f472b6';
  if (value <= 35) return '#c084fc';
  if (value <= 60) return '#818cf8';
  if (value <= 100) return '#38bdf8';
  return '#34d399';
};

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
  // Made once the space is known, since its shape follows the space
  const [board, setBoard] = useState<Board | null>(null);
  const [state, setState] = useState<Snapshot | null>(null);
  const [undo, setUndo] = useState<Snapshot[]>([]);
  const [chosen, setChosen] = useState(1); // the player's pick under 'choose'
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

  // Starts a new game on a board of `newSize`, shaped to the space now
  const newGame = useCallback((newSize: BoardSize) => {
    if (!space.width || !space.height) return;
    const { width, height } = playfieldFor(newSize, space.width / space.height);
    const tiles = makeBoard(width, height);
    setBoard({ size: newSize, tiles, bounds: boardBounds(tiles) });
    setState({ cells: seedBoard(tiles), next: nextValueFor(options), moves: 0, lastMove: null, message: '' });
    setUndo([]);
    setHovered(-1);
    setSize(newSize);
    save(SIZE_STORAGE_KEY, newSize);
  }, [space, options]);

  useEffect(() => {
    if (!board && space.width && space.height) newGame(size);
  }, [board, space, size, newGame]);

  const setOption = <K extends keyof Options>(key: K, value: Options[K]) => {
    const updated = { ...options, [key]: value };
    setOptions(updated);
    save(OPTIONS_STORAGE_KEY, JSON.stringify(updated));
    if (key === 'values' || key === 'zeros') setState(s => s && { ...s, next: nextValueFor(updated) });
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
  const pickable = choosableValues(options);
  const moveValue = options.values === 'choose'
    ? (pickable.includes(chosen) ? chosen : 1) // a picked 0 lapses when zeros leave the deck
    : (state?.next ?? 1);

  const undoMove = () => {
    if (!undo.length) return;
    setState(undo[undo.length - 1]);
    setUndo(undo.slice(0, -1));
  };

  const play = (id: number) => {
    if (!state || result.over || id < 0 || !canPlace(cells, id)) return;
    const { cells: after, merges } = place(tiles, cells, id, moveValue, options);
    setUndo([...undo, state]);
    setState({
      cells: after,
      next: nextValueFor(options),
      moves: state.moves + 1,
      lastMove: id,
      message: describeMerges(merges),
    });
  };

  // What the hovered tile would do, for the preview
  const preview = useMemo(() => {
    if (hovered < 0 || result.over || !canPlace(cells, hovered)) return null;
    return previewAt(tiles, cells, hovered, moveValue, options);
  }, [hovered, cells, moveValue, options, result.over, tiles]);

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
      ctx.fillStyle = v === EMPTY ? '#ffffff' : fillFor(v);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = px;
      ctx.stroke();
      if (v !== EMPTY) drawNumber(ctx, t, String(v), v === 0 ? '#64748b' : '#1e293b');
    }

    // Tiles the hovered move would merge
    for (const id of inGroup) {
      tracePath(ctx, tiles[id]);
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 3;
      ctx.stroke();
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
    ? `Place a number on an empty tile. ${MIN_GROUP} or more matching tiles merge into the one you placed.`
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
          {deckFor(options).length > 1 && <span>Next <b>{state?.next}</b></span>}
        </div>
        {options.values === 'choose' && (
          <div className="flex items-center gap-1 text-sm" role="group" aria-label="Value to place">
            Place
            {pickable.map(v => (
              <button key={v} onClick={() => setChosen(v)} aria-pressed={v === moveValue}
                className={`w-7 h-7 rounded font-bold border ${
                  v === moveValue ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-300'
                }`}>
                {v}
              </button>
            ))}
          </div>
        )}
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
                      <span className="text-slate-500">~{s.tiles} tiles</span>
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
