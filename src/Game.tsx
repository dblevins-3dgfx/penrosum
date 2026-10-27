import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BOARD_SIZES, boardBounds, boardFor, centroid, findRosettes, tileAtPoint,
  type BoardSize, type BoardTile, type Rosette,
} from './lib/board';
import { parseBoardSize, parsePrefs, type Prefs } from './lib/prefs';
import { addScore, parseScores } from './lib/scores';
import { type ArmedPowerUp, toggleArmed } from './lib/powerups';
import { settle } from './lib/settle';
import {
  EMPTY, MIN_GROUP, WILD,
  type Cell, type Deal, type Shape,
  canPlaceDealt, dealShape, shapeToPlace, drawValue, highestTile, outcome, place, previewAt, seedBoard, swapSpare, tapAction,
  UNDO_START, undosAfterUndo,
  canClear, clearTile,
  canPlace, newlyCompleted,
  canUpgrade, previewUpgradeAt, upgradeAt,
  sweepAt, sweepTargets,
  canSwap, previewSwapAt, swapAt,
  valueToPlace,
} from './lib/rules';
import { fitView, toBoard } from './lib/view';
import { TOP_LABEL, TOP_VALUE, valueLabel } from './lib/labels';
import { EMPTY_FILL, OFF_SHAPE_FILL, TILE_EDGE, colorsFor, fillFor, textFor } from './lib/colors';
import HowToPlay from './HowToPlay';
import Preferences from './Preferences';
import Scoreboard from './Scoreboard';

// The preferences, the board size and the scoreboards are remembered in
// this browser (localStorage). The preferences keep the key the rule options
// had, so the Q15 choice carries over as Tap to preview.
const PREFS_STORAGE_KEY = 'penrosum.options';
const SIZE_STORAGE_KEY = 'penrosum.boardSize';
const SCORES_STORAGE_KEY = 'penrosum.topTen';
// Stored data no longer used: the top 10 from the fixed boards (scored on
// different tilings, so cleared when boards became random). Removed at
// load. (Options of decided questions are simply ignored by parsePrefs.)
const RETIRED_STORAGE_KEYS = ['penrosum.scores'];
try {
  for (const key of RETIRED_STORAGE_KEYS) localStorage.removeItem(key);
} catch {
  // Storage unavailable: nothing to clear
}

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
const nextValue = () => drawValue();

// The chip's outline for the shape the next value was dealt: a kite,
// or a dart with its notch at the bottom
const CHIP_CLIP: Record<Shape, string> = {
  kite: 'polygon(50% 0, 100% 40%, 50% 100%, 0 40%)',
  dart: 'polygon(50% 0, 100% 100%, 50% 72%, 0 100%)',
};

// A one-pixel outline in the board's edge color, traced around whatever
// the wrapped element draws, so it follows a chip's kite or dart cut
const CHIP_OUTLINE = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  .map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${TILE_EDGE})`).join(' ');

// A deal as a chip in the tile's own colors (the wildcard in its rainbow),
// cut as a kite or dart and outlined like a board tile. `dealKey` changes with each new deal, so it pops
// in. Used for the next value and the hot spare (`role`).
const NextChip = ({ drawn, label, shape, dealKey, role = 'Next' }: {
  drawn: number; label: string; shape: Shape | null; dealKey: string; role?: string;
}) => {
  const { fill, text } = colorsFor(drawn);
  const name = drawn === WILD ? 'wildcard' : label;
  return (
    <span className="inline-flex" style={{ filter: shape ? CHIP_OUTLINE : undefined }}>
      <b
        key={dealKey}
        aria-label={`${role}: ${name}${shape ? ` on a ${shape}` : ''}`}
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
    </span>
  );
};

// A power-up in the tray: a small tile with its symbol, its name and how
// many charges are held. Armed (waiting for a tap on the board), it fills
// with its own color; tapping it again cancels.
const PowerUp = ({ symbol, name, count, title, onClick, disabled, armed = false, armedClass = '' }: {
  symbol: string; name: string; count: number; title: string;
  onClick: () => void; disabled: boolean; armed?: boolean; armedClass?: string;
}) => (
  <button onClick={onClick} disabled={disabled} aria-pressed={armed} title={armed ? `Cancel ${name}` : title}
    aria-label={`${name} (${count})${armed ? ', armed' : ''}`}
    className={`relative flex flex-col items-center justify-center h-12 rounded-md border text-slate-800 disabled:opacity-35 ${
      armed ? `${armedClass} text-white` : 'bg-white border-slate-300 hover:bg-slate-50'
    }`}>
    <span className="text-lg leading-none font-bold">{symbol}</span>
    <span className="text-[10px] leading-tight mt-0.5">{name}</span>
    <span className={`absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full text-[11px] font-bold leading-5 text-center ${
      count ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
    }`}>{count}</span>
  </button>
);

interface Board {
  size: BoardSize;
  tiles: BoardTile[];
  bounds: ReturnType<typeof boardBounds>;
  rosettes: Rosette[]; // its suns and stars
}

interface Snapshot {
  cells: Cell[];
  next: number;
  moves: number;
  score: number; // points from merges so far
  lastMove: number | null;
  nextShape: Shape; // the shape dealt with the next value
  spare: Deal | null; // the hot spare, if one is held
  undos: number; // Undo charges held
  clears: number; // Clear charges held (issue #33)
  anyShapes: number; // Any shape charges held (issue #33)
  upgrades: number; // Upgrade charges held (issue #33)
  sweeps: number; // Sweep charges held (issue #33)
  swaps: number; // Swap charges held (issue #33)
  completed: number[]; // the suns and stars (indices into board.rosettes) completed this game
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
  const [prefs, setPrefs] = useState(() => load(PREFS_STORAGE_KEY, parsePrefs));
  const [size, setSize] = useState(() => load(SIZE_STORAGE_KEY, parseBoardSize));
  // The space for the board, in CSS pixels; measured before the first paint
  const [space, setSpace] = useState({ width: 0, height: 0 });
  // Made on mount, and by New Game
  const [board, setBoard] = useState<Board | null>(null);
  const [state, setState] = useState<Snapshot | null>(null);
  const [undo, setUndo] = useState<Snapshot[]>([]);
  const [hovered, setHovered] = useState(-1);
  // The tile a first tap selected, with Tap to preview on
  const [selected, setSelected] = useState(-1);
  // The power-up armed, if any: Clear, Upgrade, Sweep and Swap wait for a
  // tap on the board, and Any shape lets the next value go on either shape
  const [armed, setArmed] = useState<ArmedPowerUp | null>(null);
  const clearing = armed === 'clear';
  const anyShape = armed === 'anyShape';
  const upgrading = armed === 'upgrade';
  const sweeping = armed === 'sweep';
  const swapping = armed === 'swap';
  // With Swap armed, the first tile picked (-1 for none yet): the next tap
  // on another tile swaps the two
  const [swapFirst, setSwapFirst] = useState(-1);
  const disarm = () => {
    setArmed(null);
    setSwapFirst(-1);
  };
  // Arms one power-up (or disarms it if armed), disarming the others
  const toggle = (which: ArmedPowerUp) => {
    setArmed(a => toggleArmed(a, which));
    setSwapFirst(-1);
  };
  const [showHelp, setShowHelp] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [scores, setScores] = useState(() => load(SCORES_STORAGE_KEY, parseScores));
  // Each game is recorded on the scoreboard once, the first time it ends
  // (Undo can reopen a finished game, but finishing it again doesn't count)
  const [gameId, setGameId] = useState(0);
  const recorded = useRef(-1);
  // This game's place on the scoreboard, once it has ended and made it
  const [latest, setLatest] = useState<{ size: BoardSize; rank: number } | null>(null);

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
    const rosettes = findRosettes(tiles);
    setBoard({ size: newSize, tiles, bounds: boardBounds(tiles), rosettes });
    const cells = seedBoard(tiles);
    setState({
      cells, next: nextValue(), moves: 0, score: 0, lastMove: null,
      nextShape: dealShape(tiles, cells), spare: null, undos: UNDO_START, clears: 0,
      // a sun or star the seeding happens to fill earns nothing
      anyShapes: 0, upgrades: 0, sweeps: 0, swaps: 0, completed: newlyCompleted(rosettes, cells, []), message: '',
    });
    setUndo([]);
    setHovered(-1);
    setSelected(-1);
    disarm();
    setGameId(g => g + 1);
    setLatest(null);
    setSize(newSize);
    save(SIZE_STORAGE_KEY, newSize);
  }, []);

  useEffect(() => {
    if (!board) newGame(size);
  }, [board, size, newGame]);

  // A changed preference applies at once, and the game carries on.
  const setPref = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    save(PREFS_STORAGE_KEY, JSON.stringify(updated));
    // A preview selected by a first tap belongs to the old tap rule
    if (key === 'tap') setSelected(-1);
  };
  const closeHelp = useCallback(() => setShowHelp(false), []);
  const closePrefs = useCallback(() => setShowPrefs(false), []);
  const closeScores = useCallback(() => setShowScores(false), []);

  // Escape cancels an armed power-up
  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setArmed(null);
      setSwapFirst(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armed]);

  // Escape closes the board-size menu
  useEffect(() => {
    if (!showSizes) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowSizes(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSizes]);

  const tiles = board?.tiles ?? [];
  const rosettes = board?.rosettes ?? [];
  const cells = state?.cells ?? [];
  const result = outcome(cells);
  // How values are written: as letters
  const label = valueLabel;
  const drawn = state?.next ?? 1;

  // Whether the next value can go on tile `id`: on its dealt shape, or with
  // Any shape armed, on any empty tile
  const fits = (id: number) =>
    !!state && id >= 0 && (anyShape ? canPlace(cells, id) : canPlaceDealt(tiles, cells, id, state.nextShape));

  // Undo is a power-up: it needs a charge
  const canUndo = !!state && undo.length > 0 && state.undos > 0;

  // Steps back one move, spending a charge and taking back any the undone
  // move earned.
  const undoMove = () => {
    if (!state || !canUndo) return;
    const restored = undo[undo.length - 1];
    const undos = undosAfterUndo(state.undos, restored.undos);
    setState({
      ...restored,
      undos,
      message: `Move undone. ${undos} Undo${undos === 1 ? '' : 's'} left.`,
    });
    setUndo(undo.slice(0, -1));
    setSelected(-1);
    disarm();
  };

  const play = (id: number) => {
    if (!state || result.over || !fits(id)) return;
    const value = valueToPlace(tiles, cells, id, drawn);
    const { cells: placed, merges } = place(tiles, cells, id, value);
    const settled = settle(tiles, rosettes, state, id, placed, merges, drawn === WILD ? `Wild played as ${label(value)}.` : '', { anyShape });
    setArmed(null);
    setUndo([...undo, state]);
    setState({
      ...settled,
      next: nextValue(),
      moves: state.moves + 1,
      nextShape: dealShape(tiles, settled.cells),
      spare: state.spare,
    });
  };

  // Uses an armed Upgrade on tile `id`: raises its letter a rung, which
  // then merges like a placed one (points, rubble and power-ups included).
  // Not a move: the deal and the move count stay, but Undo can take it back.
  // A tap where there is nothing to upgrade just disarms it.
  const upgradeTile = (id: number) => {
    setArmed(null);
    if (!state || result.over || state.upgrades <= 0 || !canUpgrade(cells, id)) return;
    const from = cells[id] as number;
    const { cells: placed, merges } = upgradeAt(tiles, cells, id);
    setUndo([...undo, state]);
    setState({ ...state, ...settle(tiles, rosettes, state, id, placed, merges, `Upgraded ${label(from)} to ${label(from * 3)}.`, { upgrade: true }) });
    setSelected(-1);
  };

  // Swaps the next value with the hot spare, or reserves it when no
  // spare is held. Not a move: it changes only the deal.
  const swap = () => {
    if (!state || result.over) return;
    const { current, spare } = swapSpare(
      tiles, cells, { value: state.next, shape: state.nextShape }, state.spare,
      () => ({ value: nextValue(), shape: dealShape(tiles, cells) }),
    );
    setState({
      ...state, next: current.value, nextShape: current.shape, spare,
      message: state.spare
        ? `Swapped: ${label(current.value)} is next, ${label(spare.value)} is the spare.`
        : `${label(spare.value)} kept as the spare.`,
    });
  };

  // Uses an armed Clear on tile `id`: empties it and spends a charge. Not
  // a move (the deal, moves and score stay), but Undo can take it back. A
  // tap where there is nothing to clear just disarms it.
  const clearAt = (id: number) => {
    setArmed(null);
    if (!state || result.over || state.clears <= 0 || !canClear(cells, id)) return;
    setUndo([...undo, state]);
    setState({
      ...state,
      cells: clearTile(cells, id),
      clears: state.clears - 1,
      lastMove: id,
      message: `Cleared ${label(cells[id] as number)}. ${state.clears - 1} Clear${state.clears - 1 === 1 ? '' : 's'} left.`,
    });
    setSelected(-1);
  };

  // Uses an armed Sweep on tile `id`: clears every # on it and the tiles
  // touching it, and spends a charge. Not a move; Undo can take it back. A
  // tap with no # there just disarms it.
  const sweepTile = (id: number) => {
    setArmed(null);
    const targets = sweepTargets(tiles, cells, id);
    if (!state || result.over || state.sweeps <= 0 || !targets.length) return;
    setUndo([...undo, state]);
    setState({
      ...state,
      cells: sweepAt(tiles, cells, id),
      sweeps: state.sweeps - 1,
      lastMove: id,
      message: `Swept ${targets.length} #${targets.length === 1 ? '' : 's'}. ${state.sweeps - 1} Sweep${state.sweeps - 1 === 1 ? '' : 's'} left.`,
    });
    setSelected(-1);
  };

  // A tap with Swap armed: the first picks a filled tile, the second picks
  // the tile to swap it with, and the two swap and then merge where they
  // match (points, rubble and power-ups included). Not a move; Undo can
  // take it back. Tapping the first tile again unpicks it; tapping another
  // tile holding the same value picks that one instead; a tap on an empty
  // tile disarms Swap.
  const swapTap = (id: number) => {
    if (!state || result.over || state.swaps <= 0 || id < 0 || cells[id] === EMPTY) {
      disarm();
      return;
    }
    if (swapFirst < 0 || !canSwap(cells, swapFirst, id)) {
      setSwapFirst(id === swapFirst ? -1 : id);
      return;
    }
    const a = cells[swapFirst] as number;
    const b = cells[id] as number;
    const { cells: placed, merges } = swapAt(tiles, cells, swapFirst, id);
    disarm();
    setUndo([...undo, state]);
    setState({ ...state, ...settle(tiles, rosettes, state, id, placed, merges, `Swapped ${label(a)} and ${label(b)}.`, { swap: true }) });
    setSelected(-1);
  };

  // A tap or click on the board. A mouse always places with one click; a
  // touch follows the Tap to preview preference (tapAction): place at once,
  // or preview on the first tap and place on a second tap on the same tile.
  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const id = tileFromEvent(e);
    if (clearing) {
      clearAt(id);
      return;
    }
    if (upgrading) {
      upgradeTile(id);
      return;
    }
    if (sweeping) {
      sweepTile(id);
      return;
    }
    if (swapping) {
      swapTap(id);
      return;
    }
    if (e.pointerType === 'mouse') {
      setSelected(-1);
      play(id);
      return;
    }
    const placeable = !result.over && fits(id);
    const action = tapAction(prefs.tap, selected, id, placeable);
    setSelected(action.select);
    if (action.place) play(id);
  };

  // The tile being previewed: the one under the mouse, or a tapped one
  // (none while Clear is armed)
  // (with Upgrade armed, the letter under the pointer)
  const previewed = clearing || sweeping ? -1 :
    swapping ? (swapFirst >= 0 && canSwap(cells, swapFirst, hovered) ? hovered : -1) : upgrading ? (canUpgrade(cells, hovered) ? hovered : -1) : hovered >= 0 ? hovered : selected;

  // What the previewed tile would do
  const preview = useMemo(() => {
    if (previewed < 0 || result.over) return null;
    if (upgrading) return previewUpgradeAt(tiles, cells, previewed);
    if (swapping) return previewSwapAt(tiles, cells, swapFirst, previewed);
    if (!fits(previewed)) return null;
    return previewAt(tiles, cells, previewed, drawn);
  }, [previewed, cells, drawn, result.over, tiles, state?.nextShape, anyShape, upgrading, swapping, swapFirst]);

  // When the game ends, record it on its board size's scoreboard and show
  // the scoreboard
  const over = result.over;
  useEffect(() => {
    if (!over || !state || !board || recorded.current === gameId) return;
    recorded.current = gameId;
    const entry = {
      score: state.score, highest: highestTile(state.cells), moves: state.moves,
      date: new Date().toISOString(), won: highestTile(state.cells) >= TOP_VALUE,
    };
    const { list, rank } = addScore(scores[board.size], entry);
    if (rank) {
      const updated = { ...scores, [board.size]: list };
      setScores(updated);
      save(SCORES_STORAGE_KEY, JSON.stringify(updated));
      setLatest({ size: board.size, rank });
    }
    setShowScores(true);
  }, [over, state, board, gameId, scores]);

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
    // Empty tiles of the shape not dealt are shaded (none with Any shape armed)
    const mustBe = anyShape ? null : shapeToPlace(tiles, cells, state.nextShape);
    for (const t of tiles) {
      const v = cells[t.id];
      tracePath(ctx, t);
      ctx.fillStyle = v !== EMPTY ? fillFor(v) : mustBe && t.type !== mustBe ? OFF_SHAPE_FILL : EMPTY_FILL;
      ctx.fill();
      ctx.strokeStyle = TILE_EDGE;
      ctx.lineWidth = px;
      ctx.stroke();
      if (v !== EMPTY) drawNumber(ctx, t, label(v), textFor(v));
    }

    // Where each sun and star's five tips meet: a small ring, filled gold
    // once completed
    rosettes.forEach((r, i) => {
      ctx.beginPath();
      ctx.arc(r.center.x, r.center.y, 4.5, 0, 2 * Math.PI);
      const done = state.completed.includes(i);
      ctx.fillStyle = done ? '#eab308' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = done ? '#a16207' : TILE_EDGE;
      ctx.lineWidth = done ? 1.5 : 1.2;
      ctx.stroke();
    });

    // Tiles the hovered move would merge
    for (const id of inGroup) {
      tracePath(ctx, tiles[id]);
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // With Clear armed, the tile under the pointer that it would clear;
    // with Sweep armed, the #s it would clear there
    const doomed = clearing && canClear(cells, hovered) ? [hovered] : sweeping ? sweepTargets(tiles, cells, hovered) : [];
    for (const id of doomed) {
      tracePath(ctx, tiles[id]);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // With Swap armed, the first tile picked
    if (swapping && swapFirst >= 0) {
      tracePath(ctx, tiles[swapFirst]);
      ctx.strokeStyle = '#0d9488';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    if (state.lastMove !== null) {
      tracePath(ctx, tiles[state.lastMove]);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (preview) {
      const t = tiles[previewed];
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
      ctx.fillStyle = fillFor(0);
      ctx.fill();
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 3;
      ctx.stroke();
      drawNumber(ctx, t, label(0), textFor(0));
    }
  }, [tiles, cells, state, previewed, preview, view, space, label, clearing, sweeping, swapping, swapFirst, hovered, anyShape, rosettes]);

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
    ? `Place the Next letter on an empty ${shapeToPlace(tiles, cells, state?.nextShape ?? null) ?? 'tile'}${
      prefs.tap === 'preview' ? ' (on a touch screen, tap once to preview and again to place)' : ''
    }. ${MIN_GROUP} or more matching tiles merge into the one you placed, a rung higher.`
    : '');
  if (clearing) status = 'Clear: tap a letter or # to empty it (tap Clear again, or press Escape, to keep it).';
  if (swapping) status = swapFirst < 0
    ? 'Swap: tap the first tile to swap (a letter or #; tap Swap again, or press Escape, to keep it).'
    : `Swap: now tap a tile holding something other than ${label(cells[swapFirst] as number)} to swap it with.`;
  if (sweeping) status = 'Sweep: tap a tile to clear every # on it and the tiles touching it (tap Sweep again, or press Escape, to keep it).';
  if (upgrading) status = 'Upgrade: tap a letter to raise it a rung; it merges if it then matches (tap Upgrade again, or press Escape, to keep it).';
  if (anyShape) status = 'Any shape: place the Next letter on any empty tile, kite or dart (tap Shape again, or press Escape, to keep it).';
  if (state && result.over) {
    status = result.won
      ? `You made ${TOP_LABEL}, the top of the alphabet, in ${moves} moves. You win! Score: ${score}.`
      : `Board full. Score: ${score} (highest tile ${label(result.highest)}, ${moves} moves).`;
    if (latest) status += ` #${latest.rank} on the ${BOARD_SIZES.find(s => s.id === latest.size)?.name.toLowerCase()} board!`;
  }

  const button = 'px-3 py-1.5 rounded text-sm border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40';
  const stats: [string, string | number][] = [
    ['Score', score],
    ['Moves', moves],
    ['Highest', label(highestTile(cells))],
    ['Free', free],
  ];

  // The board takes a square at the start of the screen (left on a wide
  // screen, top on a tall one) and the panel takes the space left over
  return (
    <div className="safe-area h-dvh flex flex-col landscape:flex-row overflow-hidden bg-slate-100 text-slate-900">
      <main
        ref={containerRef}
        className="relative shrink-0 portrait:w-full portrait:aspect-square portrait:max-h-[calc(100dvh-20rem)] landscape:h-full landscape:aspect-square landscape:max-w-[calc(100vw-16rem)]"
      >
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full touch-none ${clearing || upgrading || sweeping || swapping ? 'cursor-crosshair' : 'cursor-pointer'}`}
          onPointerMove={e => setHovered(tileFromEvent(e))}
          onPointerLeave={() => setHovered(-1)}
          onPointerDown={tap}
        />
      </main>

      <aside className="flex-1 min-w-0 min-h-0 overflow-y-auto flex flex-col gap-3 p-4 bg-white border-slate-200 portrait:border-t landscape:border-l">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="portrait:text-xl landscape:text-2xl font-bold text-indigo-700 mr-auto">Penrosum</h1>
          <span className="text-sm text-slate-600">Next</span>
          <NextChip drawn={drawn} label={label(drawn)} shape={state?.nextShape ?? null}
            dealKey={`${moves}:${drawn}:${state?.nextShape}`} />
          <button onClick={swap} disabled={!state || result.over}
            title={state?.spare ? 'Swap the next value with the spare' : 'Keep the next value as the spare'}
            className="flex items-center gap-2 rounded-lg px-1.5 py-0.5 hover:bg-slate-100 disabled:opacity-40">
            <span className="text-sm text-slate-600">Spare ⇄</span>
            {state?.spare ? (
              <NextChip role="Spare" drawn={state.spare.value} label={label(state.spare.value)} shape={state.spare.shape}
                dealKey={`${moves}:${state.spare.value}:${state.spare.shape}`} />
            ) : (
              <b aria-label="Spare: empty" className="inline-flex w-11 h-11 rounded-lg border-2 border-dashed border-slate-300" />
            )}
          </button>
        </div>

        <dl className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))]">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-md bg-slate-100 px-2 py-1.5 text-center">
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="text-lg font-bold leading-tight">{value}</dd>
            </div>
          ))}
        </dl>

        {/* The power-ups, as a compact tray: one tile each, with its count */}
        <div role="group" aria-label="Power-ups" className="grid grid-cols-6 gap-1">
          <PowerUp symbol="↶" name="Undo" count={state?.undos ?? 0} onClick={undoMove} disabled={!canUndo}
            title="Undo: step back one move (earned by making a new highest letter)" />
          <PowerUp symbol="✕" name="Clear" count={state?.clears ?? 0} armed={clearing} armedClass="bg-red-600 border-red-700"
            onClick={() => toggle('clear')} disabled={!clearing && (!state || over || (state?.clears ?? 0) <= 0)}
            title="Clear: empty one tile of your choice (earned by chain reactions)" />
          <PowerUp symbol="◇" name="Shape" count={state?.anyShapes ?? 0} armed={anyShape} armedClass="bg-amber-500 border-amber-600"
            onClick={() => toggle('anyShape')} disabled={!anyShape && (!state || over || (state?.anyShapes ?? 0) <= 0)}
            title="Any shape: place the next value on a kite or a dart (earned by completing suns and stars)" />
          <PowerUp symbol="⇧" name="Upgrade" count={state?.upgrades ?? 0} armed={upgrading} armedClass="bg-emerald-600 border-emerald-700"
            onClick={() => toggle('upgrade')} disabled={!upgrading && (!state || over || (state?.upgrades ?? 0) <= 0)}
            title="Upgrade: raise one letter a rung (earned by merges of 5 or more tiles)" />
          <PowerUp symbol="#" name="Sweep" count={state?.sweeps ?? 0} armed={sweeping} armedClass="bg-slate-600 border-slate-700"
            onClick={() => toggle('sweep')} disabled={!sweeping && (!state || over || (state?.sweeps ?? 0) <= 0)}
            title="Sweep: clear every # on a tile and the tiles touching it (earned by rubble merges)" />
          <PowerUp symbol="⇆" name="Swap" count={state?.swaps ?? 0} armed={swapping} armedClass="bg-teal-600 border-teal-700"
            onClick={() => toggle('swap')} disabled={!swapping && (!state || over || (state?.swaps ?? 0) <= 0)}
            title="Swap: exchange two tiles (earned every 500 points)" />
        </div>

        <div className="flex flex-wrap gap-2">
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
          <button onClick={() => setShowScores(true)} className={button}>Top 10</button>
          <button onClick={() => setShowHelp(true)} className={button}>How to play</button>
          <button onClick={() => setShowPrefs(true)} className={button} aria-label="Preferences" title="Preferences">⚙</button>
        </div>

        <p className="text-sm font-medium min-h-10" aria-live="polite">{status}</p>
      </aside>

      {showHelp && <HowToPlay onClose={closeHelp} />}
      {showPrefs && <Preferences prefs={prefs} setPref={setPref} onClose={closePrefs} />}
      {showScores && <Scoreboard scores={scores} size={board?.size ?? size} latest={latest} onClose={closeScores} />}
    </div>
  );
};

export default Game;
