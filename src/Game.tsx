import { useCallback, useEffect, useState } from 'react';
import BoardCanvas from './BoardCanvas';
import { BOARD_SIZES } from './lib/board';
import { type Palette, SKINS, colorsFor } from './lib/colors';
import { valueLabel } from './lib/labels';
import { type ArmedPowerUp, POWER_UPS } from './lib/powerups';
import { parsePrefs, type Prefs } from './lib/prefs';
import { EMPTY, WILD, type Drawn, type Shape, highestTile, shapeToPlace } from './lib/rules';
import { PREFS_STORAGE_KEY, load, save } from './storage';
import { statusLine } from './lib/status';
import { useGame } from './useGame';
import HowToPlay from './HowToPlay';
import Preferences from './Preferences';
import Scoreboard from './Scoreboard';

// How values are written: as letters
const label = valueLabel;


// The chip's outline for the shape the next value was dealt: a kite,
// or a dart with its notch at the bottom
const CHIP_CLIP: Record<Shape, string> = {
  kite: 'polygon(50% 0, 100% 40%, 50% 100%, 0 40%)',
  dart: 'polygon(50% 0, 100% 100%, 50% 72%, 0 100%)',
};

// A one-pixel outline in the board's edge color, traced around whatever
// the wrapped element draws, so it follows a chip's kite or dart cut
const chipOutline = (edge: string) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
  .map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${edge})`).join(' ');

// A deal as a chip in the tile's own colors (the wildcard in its rainbow),
// cut as a kite or dart and outlined like a board tile. `dealKey` changes with each new deal, so it pops
// in. Used for the next value and the hot spare (`role`).
const NextChip = ({ drawn, label, shape, dealKey, palette, role = 'Next' }: {
  drawn: Drawn; label: string; shape: Shape | null; dealKey: string; palette: Palette; role?: string;
}) => {
  const { fill, text } = colorsFor(drawn, palette);
  const name = drawn === WILD ? 'wildcard' : label;
  return (
    <span className="inline-flex" style={{ filter: shape ? chipOutline(palette.tileEdge) : undefined }}>
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
const PowerUpTile = ({ symbol, name, count, title, onClick, disabled, armed = false, armedClass = '' }: {
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

// The screen: the board in a square at the start (left on a wide screen,
// top on a tall one) and the panel in the space left over, with the
// dialogs over them. The game itself is useGame; the board's drawing is
// BoardCanvas.
const Game = () => {
  const [prefs, setPrefs] = useState(() => load(PREFS_STORAGE_KEY, parsePrefs));
  const [hovered, setHovered] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const [showScores, setShowScores] = useState(false);
  // The top 10 opens by itself when a game ends
  const game = useGame(hovered, useCallback(() => setShowScores(true), []));
  const { board, state, cells, result, armed, armedPowerUp, tapUse, picked, latest } = game;
  const { moves, score, next: drawn } = state;

  // The skin: the board and chips draw from its palette, and the page
  // follows it (index.css, keyed by data-skin on <html>)
  const skin = SKINS[prefs.skin];
  const { palette } = skin;
  useEffect(() => {
    document.documentElement.dataset.skin = prefs.skin;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', skin.page);
  }, [prefs.skin, skin.page]);

  // A new board: the pointer is over none of its tiles yet
  useEffect(() => setHovered(-1), [board]);

  // A changed preference applies at once, and the game carries on.
  const setPref = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    save(PREFS_STORAGE_KEY, JSON.stringify(updated));
    // A preview selected by a first tap belongs to the old tap rule
    if (key === 'tap') game.clearSelection();
  };
  const closeHelp = useCallback(() => setShowHelp(false), []);
  const closePrefs = useCallback(() => setShowPrefs(false), []);
  const closeScores = useCallback(() => setShowScores(false), []);

  // Escape closes the board-size menu
  useEffect(() => {
    if (!showSizes) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowSizes(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSizes]);

  const free = cells.filter(c => c === EMPTY).length;
  // The shape the next value must go on (null: any)
  const dealtShape = shapeToPlace(board.tiles, cells, state.nextShape);
  const status = statusLine({
    message: state.message,
    moves,
    dealtShape,
    tapRule: prefs.tap,
    hint: armedPowerUp?.hint?.(picked, cells, label) ?? null,
    result,
    score,
    latest,
  }, label);

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
        className="relative shrink-0 portrait:w-full portrait:aspect-square portrait:max-h-[calc(100dvh-20rem)] landscape:h-full landscape:aspect-square landscape:max-w-[calc(100vw-16rem)]"
      >
        <BoardCanvas
          tiles={board.tiles} bounds={board.bounds} rosettes={board.rosettes} completed={state.completed}
          cells={cells} lastMove={state.lastMove}
          // Empty tiles of the shape not dealt are shaded (none with Any shape armed)
          mustBe={game.placementArmed ? null : dealtShape}
          previewed={game.previewed} preview={game.preview} doomed={game.doomed}
          picked={tapUse?.canPick ? picked : -1} crosshair={!!tapUse} label={label} palette={palette}
          onHover={setHovered} onTap={(id, pointerType) => game.tapBoard(id, pointerType, prefs.tap)}
        />
      </main>

      <aside className="flex-1 min-w-0 min-h-0 overflow-y-auto flex flex-col gap-3 p-4 bg-white border-slate-200 portrait:border-t landscape:border-l">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="portrait:text-xl landscape:text-2xl font-bold text-indigo-700 mr-auto">Penrosum</h1>
          <span className="text-sm text-slate-600">Next</span>
          <NextChip palette={palette} drawn={drawn} label={label(drawn)} shape={state.nextShape}
            dealKey={`${moves}:${drawn}:${state.nextShape}`} />
          <button onClick={game.swap} disabled={result.over}
            title={state.spare ? 'Swap the next value with the spare' : 'Keep the next value as the spare'}
            className="flex items-center gap-2 rounded-lg px-1.5 py-0.5 hover:bg-slate-100 disabled:opacity-40">
            <span className="text-sm text-slate-600">Spare ⇄</span>
            {state.spare ? (
              <NextChip palette={palette} role="Spare" drawn={state.spare.value} label={label(state.spare.value)} shape={state.spare.shape}
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
          {POWER_UPS.map(p => {
            const count = state.charges[p.id];
            const isArmed = armed === p.id;
            // A power-up that acts at once: Undo, the only one
            return p.kind === 'now' ? (
              <PowerUpTile key={p.id} symbol={p.symbol} name={p.short} count={count} title={p.title}
                onClick={game.undoMove} disabled={!game.canUndo} />
            ) : (
              <PowerUpTile key={p.id} symbol={p.symbol} name={p.short} count={count} title={p.title}
                armed={isArmed} armedClass={p.armedClass}
                onClick={() => game.toggle(p.id as ArmedPowerUp)} disabled={!isArmed && (result.over || count <= 0)} />
            );
          })}
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
                      onClick={() => { setShowSizes(false); game.newGame(s.id); }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 flex justify-between">
                      <span className={s.id === board.size ? 'font-semibold text-indigo-700' : ''}>{s.name}</span>
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
      {showScores && <Scoreboard scores={game.scores} size={board.size} latest={latest} onClose={closeScores} />}
    </div>
  );
};

export default Game;
