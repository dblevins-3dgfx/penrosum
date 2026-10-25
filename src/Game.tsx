import { useEffect, useMemo, useRef, useState } from 'react';
import { BOARD_H, BOARD_W, centroid, makeBoard, tileAtPoint, type BoardTile } from './lib/board';
import {
  CHOOSABLE_VALUES, DEFAULT_OPTIONS, EMPTY, MIN_GROUP, TARGET_OPTIONS,
  type Cell, type Options,
  canPlace, drawValue, groupAt, highestTile, outcome, place,
} from './lib/rules';

// The chosen rule options are remembered in this browser (localStorage).
const OPTIONS_STORAGE_KEY = 'penrosum.options';

const loadOptions = (): Options => {
  try {
    const saved = JSON.parse(localStorage.getItem(OPTIONS_STORAGE_KEY) || '{}');
    return { ...DEFAULT_OPTIONS, ...saved };
  } catch {
    return DEFAULT_OPTIONS;
  }
};

const saveOptions = (options: Options) => {
  try {
    localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Storage unavailable (e.g. private mode): the choice lasts this visit
  }
};

// The value for the next move under the 'random' rule; under the others it
// is decided at the move (always 1, or the player's pick).
const nextValueFor = (options: Options) => (options.values === 'random' ? drawValue() : 1);

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

interface ChoiceProps<T extends string | number> {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}

const Choice = <T extends string | number>({ label, value, options, onChange }: ChoiceProps<T>) => (
  <fieldset className="mb-3">
    <legend className="text-sm font-semibold text-slate-700 mb-1">{label}</legend>
    <div className="flex flex-wrap gap-1">
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`px-2 py-1 rounded text-sm border ${
            v === value
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  </fieldset>
);

const Game = () => {
  const tiles = useMemo(makeBoard, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [options, setOptions] = useState(loadOptions);
  const [state, setState] = useState<Snapshot>(() => ({
    cells: tiles.map(() => EMPTY),
    next: nextValueFor(options),
    moves: 0,
    lastMove: null,
    message: '',
  }));
  const [undo, setUndo] = useState<Snapshot[]>([]);
  const [chosen, setChosen] = useState(1); // the player's pick under 'choose'
  const [hovered, setHovered] = useState(-1);

  const { cells, next, moves, lastMove, message } = state;
  const result = outcome(cells, options);
  const moveValue = options.values === 'choose' ? chosen : options.values === 'ones' ? 1 : next;

  const setOption = <K extends keyof Options>(key: K, value: Options[K]) => {
    const updated = { ...options, [key]: value };
    setOptions(updated);
    saveOptions(updated);
    if (key === 'values') setState(s => ({ ...s, next: nextValueFor(updated) }));
  };

  const newGame = () => {
    setUndo([]);
    setState({ cells: tiles.map(() => EMPTY), next: nextValueFor(options), moves: 0, lastMove: null, message: '' });
  };

  const undoMove = () => {
    if (!undo.length) return;
    setState(undo[undo.length - 1]);
    setUndo(undo.slice(0, -1));
  };

  const play = (id: number) => {
    if (result.over || id < 0 || !canPlace(cells, id)) return;
    const { cells: after, merge } = place(tiles, cells, id, moveValue, options);
    setUndo([...undo, state]);
    setState({
      cells: after,
      next: nextValueFor(options),
      moves: moves + 1,
      lastMove: id,
      message: merge ? `Merged ${merge.from.length + 1} tiles into ${merge.sum}` : '',
    });
  };

  // The merge the hovered tile would make, for the preview
  const preview = useMemo(() => {
    if (hovered < 0 || result.over || !canPlace(cells, hovered)) return null;
    const trial = cells.slice();
    trial[hovered] = moveValue;
    const group = groupAt(tiles, trial, hovered, options.group);
    if (group.length < MIN_GROUP) return { group: [], sum: moveValue };
    return { group, sum: group.reduce((s, t) => s + trial[t], 0) };
  }, [hovered, cells, moveValue, options.group, result.over, tiles]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    const inGroup = new Set(preview?.group);
    for (const t of tiles) {
      const v = cells[t.id];
      tracePath(ctx, t);
      ctx.fillStyle = v === EMPTY ? '#f1f5f9' : fillFor(v);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (v !== EMPTY) drawNumber(ctx, t, String(v), v === 0 ? '#64748b' : '#1e293b');
    }

    // Tiles the hovered move would merge
    for (const id of inGroup) {
      if (id === hovered) continue;
      tracePath(ctx, tiles[id]);
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (lastMove !== null) {
      tracePath(ctx, tiles[lastMove]);
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
      drawNumber(ctx, t, inGroup.size ? String(preview.sum) : String(moveValue), '#3730a3');
    }
  }, [tiles, cells, lastMove, hovered, preview, moveValue]);

  const tileFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * BOARD_W;
    const y = ((e.clientY - rect.top) / rect.height) * BOARD_H;
    return tileAtPoint(tiles, x, y);
  };

  const free = cells.filter(c => c === EMPTY).length;
  let status = message;
  if (result.over) {
    status = result.won
      ? options.goal === 'target'
        ? `You made ${result.highest} in ${moves} moves!`
        : `Board full. Highest tile: ${result.highest} after ${moves} moves.`
      : `Board full before reaching ${options.target}. Highest tile: ${result.highest}.`;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-wrap items-center gap-3 mb-3">
          <h1 className="text-2xl font-bold text-indigo-700 mr-auto">Penrosum</h1>
          <button onClick={undoMove} disabled={!undo.length}
            className="px-3 py-1 rounded bg-white border border-slate-300 text-sm disabled:opacity-40">
            Undo
          </button>
          <button onClick={newGame} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">
            New Game
          </button>
        </header>

        <div className="flex flex-col lg:flex-row gap-4">
          <main className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-2">
              <span>Moves: <b>{moves}</b></span>
              <span>Highest: <b>{highestTile(cells)}</b></span>
              <span>Free tiles: <b>{free}</b></span>
              {options.goal === 'target' && <span>Target: <b>{options.target}</b></span>}
              {options.values === 'random' && <span>Next: <b>{next}</b></span>}
            </div>
            {options.values === 'choose' && (
              <div className="flex items-center gap-2 text-sm mb-2">
                Place:
                {CHOOSABLE_VALUES.map(v => (
                  <button key={v} onClick={() => setChosen(v)}
                    className={`w-8 h-8 rounded font-bold border ${
                      v === chosen ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-300'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
            )}
            <canvas
              ref={canvasRef}
              width={BOARD_W}
              height={BOARD_H}
              className="w-full h-auto rounded shadow bg-white touch-none cursor-pointer"
              onPointerMove={e => setHovered(tileFromEvent(e))}
              onPointerLeave={() => setHovered(-1)}
              onPointerDown={e => play(tileFromEvent(e))}
            />
            <p className="min-h-6 mt-2 text-sm font-medium" aria-live="polite">{status}</p>
          </main>

          <aside className="lg:w-80 bg-white rounded shadow p-4">
            <h2 className="font-bold mb-1">Rules to try</h2>
            <p className="text-xs text-slate-500 mb-3">
              These are the open questions in the spec. Changes apply from the next move.
            </p>
            <Choice
              label="1. Which tiles count as adjacent?"
              value={options.group}
              options={[['connected', 'Whole connected group'], ['neighbors', 'Direct neighbors only']]}
              onChange={v => setOption('group', v)}
            />
            <Choice
              label="2. Merged-away tiles become"
              value={options.clear}
              options={[['empty', 'Empty'], ['zero', 'Zero (stays on the board)']]}
              onChange={v => setOption('clear', v)}
            />
            <Choice
              label="3. The value you place"
              value={options.values}
              options={[['ones', 'Always 1'], ['random', 'Random 1–3'], ['choose', 'You pick 1–3']]}
              onChange={v => setOption('values', v)}
            />
            <Choice
              label="4. Goal"
              value={options.goal}
              options={[['highest', 'Highest tile'], ['target', 'Reach a target']]}
              onChange={v => setOption('goal', v)}
            />
            {options.goal === 'target' && (
              <Choice
                label="Target"
                value={options.target}
                options={TARGET_OPTIONS.map(t => [t, String(t)] as [number, string])}
                onChange={v => setOption('target', v)}
              />
            )}
            <p className="text-xs text-slate-500 mt-2">
              Place a number on any empty tile. When it makes a group of {MIN_GROUP} or more numbered
              tiles, the tile you placed takes their sum and the others are cleared. Hover a tile to
              see what would merge.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Game;
