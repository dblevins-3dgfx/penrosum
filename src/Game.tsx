import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BOARD_SIZES, boardBounds, boardFor, centroid, tileAtPoint,
  type BoardSize, type BoardTile,
} from './lib/board';
import { parseBoardSize, parseOptions } from './lib/prefs';
import {
  EMPTY, MIN_GROUP, WILD,
  type Cell, type Merge, type Options, type Shape,
  canPlaceDealt, dealShape, dropRubble, shapeToPlace, deckFor, drawValue, highestTile, outcome, place, previewAt, scoreMerges, scoreRubble, seedBoard,
  valueToPlace,
} from './lib/rules';
import { fitView, toBoard } from './lib/view';
import { TOP_LABEL, TOP_VALUE, targetLabel, valueLabel } from './lib/labels';
import { EMPTY_FILL, OFF_SHAPE_FILL, colorsFor, fillFor, textFor } from './lib/colors';
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

// "Merged 3 tiles into B, then 3 tiles into C", with values written by
// `label`
const describeMerges = (merges: Merge[], label: (v: number) => string) =>
  merges.length
    ? `Merged ${merges.map(m => `${m.from.length + 1} tiles into ${label(m.sum)}`).join(', then ')}`
    : '';

// The chip's outline for the shape the next value was dealt: a kite,
// or a dart with its notch at the bottom
const CHIP_CLIP: Record<Shape, string> = {
  kite: 'polygon(50% 0, 100% 40%, 50% 100%, 0 40%)',
  dart: 'polygon(50% 0, 100% 100%, 50% 72%, 0 100%)',
};

// The next value as a chip in the tile's own colors (the wildcard in its
// rainbow), shaped like a kite or dart when it was dealt a shape. Keyed by
// the move count, so each new draw pops in.
const NextChip = ({ drawn, label, shape, moves }: { drawn: number; label: string; shape: Shape | null; moves: number }) => {
  const { fill, text } = colorsFor(drawn);
  const name = drawn === WILD ? 'wildcard' : label;
  return (
    <b
      key={moves}
      aria-label={`Next: ${name}${shape ? ` on a ${shape}` : ''}`}
      className={`next-chip inline-flex items-center justify-center text-2xl ${
        shape ? 'w-14 h-14' : 'min-w-11 h-11 px-2 rounded-lg border border-slate-400/60 shadow-sm'
      }`}
      style={{
        background: fill,
        color: text,
        textShadow: drawn === WILD ? '0 1px 2px #0006' : undefined,
        clipPath: shape ? CHIP_CLIP[shape] : undefined,
        paddingBottom: shape === 'dart' ? '0.6rem' : undefined,
      }}
    >
      {label}
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
  score: number; // points from merges so far (Q12)
  lastMove: number | null;
  nextShape: Shape; // the shape dealt with the next value
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
      cells, next: nextValueFor(options), moves: 0, score: 0, lastMove: null,
      nextShape: dealShape(), message: '',
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
  // How values are written: as letters
  const label = valueLabel;
  const drawn = state?.next ?? 1;

  const undoMove = () => {
    if (!undo.length) return;
    setState(undo[undo.length - 1]);
    setUndo(undo.slice(0, -1));
  };

  const play = (id: number) => {
    if (!state || result.over || id < 0 || !canPlaceDealt(tiles, cells, id, state.nextShape)) return;
    const value = valueToPlace(tiles, cells, id, drawn, options);
    const { cells: placed, merges } = place(tiles, cells, id, value, options);
    const { cells: after, zeros, rubbleMerges } = dropRubble(tiles, placed, merges);
    const gained = scoreMerges(merges, options);
    const rubbleGained = scoreRubble(rubbleMerges, options);
    setUndo([...undo, state]);
    setState({
      cells: after,
      next: nextValueFor(options),
      moves: state.moves + 1,
      score: state.score + gained + rubbleGained,
      lastMove: id,
      nextShape: dealShape(),
      message: [
        drawn === WILD ? `Wild played as ${label(value)}.` : '',
        describeMerges(merges, label) + (gained ? ` (+${gained}).` : ''),
        zeros.length === 1 ? 'Rubble dropped a #.' : zeros.length ? `Rubble dropped ${zeros.length} #s.` : '',
        ...rubbleMerges.map(m => `Rubble merged ${m.from.length + 1} #s into one (+${scoreRubble([m], options)}).`),
      ].filter(Boolean).join(' '),
    });
  };

  // What the hovered tile would do, for the preview
  const preview = useMemo(() => {
    if (hovered < 0 || result.over || !canPlaceDealt(tiles, cells, hovered, state?.nextShape ?? null)) return null;
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
    // Empty tiles of the shape not dealt are shaded
    const mustBe = shapeToPlace(tiles, cells, state.nextShape);
    for (const t of tiles) {
      const v = cells[t.id];
      tracePath(ctx, t);
      ctx.fillStyle = v !== EMPTY ? fillFor(v) : mustBe && t.type !== mustBe ? OFF_SHAPE_FILL : EMPTY_FILL;
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = px;
      ctx.stroke();
      if (v !== EMPTY) drawNumber(ctx, t, label(v), textFor(v));
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
      drawNumber(ctx, t, label(preview.value), '#3730a3');
    }

    // Where the move's rubble would land: a gray # with the
    // merge outline
    for (const id of preview?.rubble ?? []) {
      const t = tiles[id];
      tracePath(ctx, t);
      ctx.fillStyle = '#cbd5e1';
      ctx.fill();
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 3;
      ctx.stroke();
      drawNumber(ctx, t, label(0), '#475569');
    }
  }, [tiles, cells, state, hovered, preview, view, space, label]);

  const tileFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!view) return -1;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = toBoard(view, e.clientX - rect.left, e.clientY - rect.top);
    return tileAtPoint(tiles, p.x, p.y);
  };

  const moves = state?.moves ?? 0;
  const score = state?.score ?? 0;
  const free = cells.filter(c => c === EMPTY).length;
  let status = state?.message || (moves === 0
    ? `Place the Next letter on an empty ${shapeToPlace(tiles, cells, state?.nextShape ?? null) ?? 'tile'}. ${MIN_GROUP} or more matching tiles merge into the one you placed, a rung higher.`
    : '');
  if (state && result.over) {
    const best = label(result.highest);
    status = result.highest >= TOP_VALUE
      ? `You made ${TOP_LABEL}, the top of the alphabet, in ${moves} moves. You win!`
      : result.won
        ? options.goal === 'target'
          ? `You made ${best} in ${moves} moves!`
          : `Board full. Highest tile: ${best} after ${moves} moves.`
        : `Board full before reaching ${targetLabel(options.target)}. Highest tile: ${best}.`;
    status += ` Score: ${score}.`;
  }

  const button = 'px-3 py-1.5 rounded text-sm border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40';
  const stats: [string, string | number][] = [
    ['Score', score],
    ['Moves', moves],
    ['Highest', label(highestTile(cells))],
    ['Free', free],
    ...(options.goal === 'target' ? [['Target', targetLabel(options.target)] as [string, string]] : []),
  ];

  // The board takes a square at the start of the screen (left on a wide
  // screen, top on a tall one) and the panel takes the space left over
  return (
    <div className="h-dvh flex flex-col landscape:flex-row overflow-hidden bg-slate-100 text-slate-900">
      <main
        ref={containerRef}
        className="relative shrink-0 portrait:w-full portrait:aspect-square portrait:max-h-[calc(100dvh-12rem)] landscape:h-full landscape:aspect-square landscape:max-w-[calc(100vw-16rem)]"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none cursor-pointer"
          onPointerMove={e => setHovered(tileFromEvent(e))}
          onPointerLeave={() => setHovered(-1)}
          onPointerDown={e => play(tileFromEvent(e))}
        />
      </main>

      <aside className="flex-1 min-w-0 min-h-0 flex flex-col gap-3 p-4 bg-white border-slate-200 portrait:border-t landscape:border-l">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-indigo-700 mr-auto">Penrosum</h1>
          <span className="text-sm text-slate-600">Next</span>
          <NextChip drawn={drawn} label={label(drawn)} shape={state?.nextShape ?? null} moves={moves} />
        </div>

        <dl className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))]">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-md bg-slate-100 px-2 py-1.5 text-center">
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="text-lg font-bold leading-tight">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-2">
          <button onClick={undoMove} disabled={!undo.length} className={button}>Undo</button>
          <div className="relative">
            <button onClick={() => setShowSizes(s => !s)} aria-expanded={showSizes} aria-haspopup="menu"
              className="px-3 py-1.5 rounded text-sm bg-indigo-600 text-white">
              New Game ▾
            </button>
            {showSizes && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowSizes(false)} />
                {/* Opens upward when the panel is at the bottom of the screen */}
                <div role="menu"
                  className="absolute left-0 z-30 w-48 rounded-md bg-white shadow-lg border border-slate-200 py-1 landscape:top-full landscape:mt-1 portrait:bottom-full portrait:mb-1">
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

        <p className="text-sm font-medium min-h-10" aria-live="polite">{status}</p>
      </aside>

      {showPrefs && <Preferences options={options} setOption={setOption} onClose={closePrefs} />}
    </div>
  );
};

export default Game;
