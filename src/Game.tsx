import { useCallback, useEffect, useMemo, useState } from 'react';
import BoardCanvas from './BoardCanvas';
import { BOARD_SIZES } from './lib/board';
import { type Palette, colorsFor } from './lib/colors';
import { termsFor } from './lib/skin';
import { EMOJI_FONTS, skinFor } from './emoji';
import { type ArmedPowerUp, POWER_UPS } from './lib/powerups';
import { parsePrefs, parseRuleOptions, type Prefs } from './lib/prefs';
import {
  EMPTY, WILD, type Drawn, type RuleOptions, type Shape, type WildChoice, highestTile, shapeToPlace, wildPickValues,
} from './lib/rules';
import { PREFS_STORAGE_KEY, PREVIEW, PREVIEW_URL, RULES_STORAGE_KEY, load, save } from './storage';
import { statusLine } from './lib/status';
import { useGame } from './useGame';
import HowToPlay from './HowToPlay';
import Preferences from './Preferences';
import Scoreboard from './Scoreboard';

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
// `name` is what it is called (for a screen reader) and `title` its tooltip
// ("🦈 shark, 11 of 26"); with `pictures`, the label is an emoji.
const NextChip = ({ drawn, label, name, title, shape, dealKey, palette, pictures, role = 'Next' }: {
  drawn: Drawn; label: string; name: string; title: string; shape: Shape | null; dealKey: string;
  palette: Palette; pictures: boolean; role?: string;
}) => {
  const { fill, text } = colorsFor(drawn, palette);
  return (
    <span className="inline-flex" title={title} style={{ filter: shape ? chipOutline(palette.tileEdge) : undefined }}>
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
          fontFamily: pictures && drawn !== WILD ? EMOJI_FONTS : undefined,
        }}
      >
        {label}
      </b>
    </span>
  );
};

// Q17 'tile': the wildcard's picker, over the board at the tile tapped. A
// chip for each value the ★ could play as there, in its tile colors, with
// what it would do; the best is marked. Pointing at a chip previews it on
// the board; tapping one places the ★ as that value.
const WildPicker = ({ choices, palette, label, onHover, onPick, onClose }: {
  choices: WildChoice[]; palette: Palette; label: (value: number) => string;
  onHover: (value: number | null) => void; onPick: (value: number) => void; onClose: () => void;
}) => (
  <div role="dialog" aria-label="Play the wildcard as" className="rounded-lg border border-slate-300 bg-white p-2 shadow-lg">
    <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
      <span className="mr-auto">Play ★ as</span>
      <button onClick={onClose} aria-label="Cancel" className="px-1 text-base leading-none hover:text-slate-900">×</button>
    </div>
    <div className="flex gap-1">
      {choices.map(c => {
        const { fill, text } = colorsFor(c.value, palette);
        const note = c.merges ? `makes ${label(c.result)}, clears ${c.cleared}` : 'no merge';
        return (
          <button key={c.value} onClick={() => onPick(c.value)}
            onPointerEnter={() => onHover(c.value)} onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(c.value)} onBlur={() => onHover(null)}
            aria-label={`${label(c.value)}: ${note}${c.best ? ', best' : ''}`}
            className={`flex w-16 flex-col items-center rounded-md border px-1 py-1 hover:bg-slate-50 ${
              c.best ? 'border-indigo-600 ring-2 ring-indigo-600/40' : 'border-slate-300'
            }`}>
            <b className="flex h-8 w-8 items-center justify-center rounded text-lg" style={{ background: fill, color: text }}>
              {label(c.value)}
            </b>
            <span className="mt-0.5 text-center text-[10px] leading-tight text-slate-600">
              {c.merges ? <>makes {label(c.result)}<br />clears {c.cleared}</> : 'no merge'}
            </span>
            {c.best && <span className="text-[10px] font-semibold text-indigo-700">best</span>}
          </button>
        );
      })}
    </div>
  </div>
);

// Q17 'before': the menu from the ★ Next chip: Best (the wildcard chooses
// where it lands), or a value to play it as (see wildPickValues).
const WildMenu = ({ values, chosen, palette, label, onChoose }: {
  values: number[]; chosen: number | null; palette: Palette; label: (value: number) => string; onChoose: (value: number | null) => void;
}) => (
  <div role="menu" aria-label="Play the wildcard as"
    className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg landscape:top-full portrait:bottom-full portrait:mb-1">
    <p className="mb-1 text-xs text-slate-500">Play ★ as</p>
    <button role="menuitemradio" aria-checked={chosen === null} onClick={() => onChoose(null)}
      className={`mb-1 w-full rounded border px-2 py-1 text-left text-sm ${chosen === null ? 'border-indigo-600 font-semibold' : 'border-slate-300'}`}>
      Best (it chooses where it lands)
    </button>
    <div className="flex flex-wrap gap-1">
      {values.map(v => {
        const { fill, text } = colorsFor(v, palette);
        return (
          <button key={v} role="menuitemradio" aria-checked={chosen === v} aria-label={label(v)} onClick={() => onChoose(v)}
            className={`h-8 w-8 rounded text-base font-bold ${chosen === v ? 'ring-2 ring-indigo-600' : ''}`}
            style={{ background: fill, color: text }}>
            {label(v)}
          </button>
        );
      })}
    </div>
  </div>
);

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
  // The skin: the ladder the values are drawn as (with any emoji this
  // device lacks swapped for older ones), its words and its palette
  const skin = useMemo(() => skinFor(prefs.skin), [prefs.skin]);
  const terms = useMemo(() => termsFor(skin), [skin]);
  const { palette, pictures } = skin;
  const label = terms.label;
  const chip = (value: Drawn) => ({ label: label(value), name: terms.name(value), title: terms.title(value) });
  const [hovered, setHovered] = useState(-1);
  // The rule options for the open questions (Q17), tried from How to play
  const [rules, setRules] = useState(() => load(RULES_STORAGE_KEY, parseRuleOptions));
  // Q17: the choice under the pointer in the wildcard's picker, and
  // whether the Next chip's menu is open
  const [wildHover, setWildHover] = useState<number | null>(null);
  const [showWildMenu, setShowWildMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const [showScores, setShowScores] = useState(false);
  // The top 10 opens by itself when a game ends
  const game = useGame(hovered, wildHover, useCallback(() => setShowScores(true), []), terms);
  const { board, state, cells, result, armed, armedPowerUp, tapUse, picked, latest } = game;
  const { moves, score, next: drawn } = state;

  // The browser's theme color follows the skin's page
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', skin.page);
  }, [skin.page]);

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
  // A changed rule option applies at once, and the game carries on. A
  // wildcard's picker or pick from the old option is dropped.
  const setRule = <K extends keyof RuleOptions>(key: K, value: RuleOptions[K]) => {
    const updated = { ...rules, [key]: value };
    setRules(updated);
    save(RULES_STORAGE_KEY, JSON.stringify(updated));
    game.closeWild();
    game.chooseWild(null);
  };
  // The picker closed or moved: nothing under the pointer in it; a new
  // deal: the Next chip's menu closed
  useEffect(() => setWildHover(null), [game.choosing]);
  useEffect(() => setShowWildMenu(false), [moves, drawn]);
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
    hint: game.choosing >= 0
      ? 'Wild: tap what the ★ plays as here; the best is marked (tap ×, another tile, or press Escape, to cancel).'
      : armedPowerUp?.hint?.(picked, cells, terms, board.tiles, game.freed) ?? null,
    result,
    score,
    latest,
  }, terms);

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
          picked={tapUse?.canPick ? picked : -1} crosshair={!!tapUse} label={label} pictures={pictures} palette={palette}
          onHover={setHovered} onTap={(id, pointerType) => game.tapBoard(id, pointerType, prefs.tap, rules.wild)}
          overlay={game.choosing >= 0 ? {
            id: game.choosing,
            content: <WildPicker choices={game.wildOptions} palette={palette} label={label}
              onHover={setWildHover} onPick={game.placeWild} onClose={game.closeWild} />,
          } : undefined}
        />
      </main>

      <aside className="flex-1 min-w-0 min-h-0 overflow-y-auto flex flex-col gap-3 p-4 bg-white border-slate-200 portrait:border-t landscape:border-l">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="portrait:text-xl landscape:text-2xl font-bold text-indigo-700 mr-auto">
            Penrosum
            {PREVIEW && (
              // A pull request's preview build: says so, and links to the PR
              <a href={PREVIEW_URL} target="_blank" rel="noreferrer" title="A preview of a change, before it is merged; its scores and settings are its own"
                className="ml-2 align-middle rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 hover:bg-amber-200">
                Preview #{PREVIEW}
              </a>
            )}
          </h1>
          <span className="text-sm text-slate-600">Next</span>
          {rules.wild === 'before' && drawn === WILD && !result.over ? (
            // Q17 'before': the ★ chip opens a menu to pick what it plays as
            <div className="relative">
              <button onClick={() => setShowWildMenu(s => !s)} aria-haspopup="menu" aria-expanded={showWildMenu}
                title="Choose what the wildcard plays as" className="rounded-md hover:bg-slate-100">
                <NextChip palette={palette} pictures={pictures} drawn={drawn} {...chip(drawn)}
                  label={game.wildAs === null ? label(drawn) : `${label(drawn)}${label(game.wildAs)}`}
                  shape={state.nextShape} dealKey={`${moves}:${drawn}:${state.nextShape}`} />
              </button>
              {showWildMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowWildMenu(false)} />
                  <WildMenu values={wildPickValues(highestTile(cells))} chosen={game.wildAs} palette={palette} label={label}
                    onChoose={v => { game.chooseWild(v); setShowWildMenu(false); }} />
                </>
              )}
            </div>
          ) : (
            <NextChip palette={palette} pictures={pictures} drawn={drawn} {...chip(drawn)} shape={state.nextShape}
              dealKey={`${moves}:${drawn}:${state.nextShape}`} />
          )}
          <button onClick={game.swap} disabled={result.over}
            title={state.spare ? 'Swap the next value with the spare' : 'Keep the next value as the spare'}
            className="flex items-center gap-2 rounded-lg px-1.5 py-0.5 hover:bg-slate-100 disabled:opacity-40">
            <span className="text-sm text-slate-600">Spare ⇄</span>
            {state.spare ? (
              <NextChip palette={palette} pictures={pictures} role="Spare" drawn={state.spare.value} {...chip(state.spare.value)}
                shape={state.spare.shape}
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
            // Armed, or armed along with Swap (Any shape, to swap across shapes)
            const isArmed = armed === p.id || (game.free && tapUse?.freedBy === p.id);
            // A power-up that acts at once: Undo, the only one
            return p.kind === 'now' ? (
              <PowerUpTile key={p.id} symbol={p.symbol(terms)} name={p.short} count={count} title={p.title(terms)}
                onClick={game.undoMove} disabled={!game.canUndo} />
            ) : (
              <PowerUpTile key={p.id} symbol={p.symbol(terms)} name={p.short} count={count} title={p.title(terms)}
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

      {showHelp && <HowToPlay skin={skin} rules={rules} setRule={setRule} onClose={closeHelp} />}
      {showPrefs && <Preferences prefs={prefs} setPref={setPref} onClose={closePrefs} />}
      {showScores && <Scoreboard scores={game.scores} size={board.size} latest={latest} onClose={closeScores} />}
    </div>
  );
};

export default Game;
