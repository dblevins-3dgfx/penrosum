import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { boardBounds, boardFor, findRosettes, type BoardSize, type BoardTile, type Rosette } from './lib/board';
import { TOP_VALUE, valueLabel } from './lib/labels';
import {
  type ArmedPowerUp, type Charges, newlyCompleted, powerUp, startCharges, toggleArmed, undosAfterUndo,
} from './lib/powerups';
import { parseBoardSize } from './lib/prefs';
import {
  WILD, type Cell, type Deal, type Shape, type TapRule,
  canPlace, canPlaceDealt, dealShape, drawValue, highestTile, outcome, place, previewAt, seedBoard, swapSpare,
  tapAction, valueToPlace,
} from './lib/rules';
import { addScore, parseScores } from './lib/scores';
import { settle } from './lib/settle';
import { SCORES_STORAGE_KEY, SIZE_STORAGE_KEY, load, save } from './storage';

export interface Board {
  size: BoardSize;
  tiles: BoardTile[];
  bounds: ReturnType<typeof boardBounds>;
  rosettes: Rosette[]; // its suns and stars
}

// A position in the game: what Undo goes back to.
export interface Snapshot {
  cells: Cell[];
  next: number;
  moves: number;
  score: number; // points from merges so far
  lastMove: number | null;
  nextShape: Shape; // the shape dealt with the next value
  spare: Deal | null; // the hot spare, if one is held
  charges: Charges; // the power-up charges held
  completed: number[]; // the suns and stars (indices into board.rosettes) completed this game
  message: string;
}

// The value for the next move, drawn in advance so it can be shown
const nextValue = () => drawValue();

// How values are written: as letters
const label = valueLabel;

// The game: the board, the position and its Undo history, the deal and the
// spare, the power-ups, and the top 10 a finished game is recorded on.
// `hovered` is the tile under the pointer (for the preview); `onGameEnd`
// is called once when a game ends, after it is recorded.
export const useGame = (hovered: number, onGameEnd: () => void) => {
  const [size, setSize] = useState(() => load(SIZE_STORAGE_KEY, parseBoardSize));
  // Made on mount, and by New Game
  const [board, setBoard] = useState<Board | null>(null);
  const [state, setState] = useState<Snapshot | null>(null);
  const [undo, setUndo] = useState<Snapshot[]>([]);
  // The tile a first tap selected, with Tap to preview on
  const [selected, setSelected] = useState(-1);
  // The power-up armed, if any: Clear, Upgrade, Sweep and Swap wait for a
  // tap on the board, and Any shape lets the next value go on either shape
  const [armed, setArmed] = useState<ArmedPowerUp | null>(null);
  // For a power-up that takes two taps (Swap), the tile the first one
  // picked (-1 for none yet)
  const [picked, setPicked] = useState(-1);
  const [scores, setScores] = useState(() => load(SCORES_STORAGE_KEY, parseScores));
  // Each game is recorded on the scoreboard once, the first time it ends
  // (Undo can reopen a finished game, but finishing it again doesn't count)
  const [gameId, setGameId] = useState(0);
  const recorded = useRef(-1);
  // This game's place on the scoreboard, once it has ended and made it
  const [latest, setLatest] = useState<{ size: BoardSize; rank: number } | null>(null);
  const onGameEndRef = useRef(onGameEnd);
  onGameEndRef.current = onGameEnd;

  const anyShape = armed === 'anyShape';
  // The armed power-up's entry, and how it is used if by tapping the board
  const armedPowerUp = armed ? powerUp(armed) : null;
  const tapUse = armedPowerUp?.tap;

  const disarm = () => {
    setArmed(null);
    setPicked(-1);
  };
  // Arms one power-up (or disarms it if armed), disarming the others
  const toggle = (which: ArmedPowerUp) => {
    setArmed(a => toggleArmed(a, which));
    setPicked(-1);
  };

  // Starts a new game on a board of `newSize`
  const newGame = useCallback((newSize: BoardSize) => {
    const tiles = boardFor(newSize);
    const rosettes = findRosettes(tiles);
    setBoard({ size: newSize, tiles, bounds: boardBounds(tiles), rosettes });
    const cells = seedBoard(tiles);
    setState({
      cells, next: nextValue(), moves: 0, score: 0, lastMove: null,
      nextShape: dealShape(tiles, cells), spare: null, charges: startCharges(),
      // a sun or star the seeding happens to fill earns nothing
      completed: newlyCompleted(rosettes, cells, []), message: '',
    });
    setUndo([]);
    setSelected(-1);
    setArmed(null);
    setPicked(-1);
    setGameId(g => g + 1);
    setLatest(null);
    setSize(newSize);
    save(SIZE_STORAGE_KEY, newSize);
  }, []);

  useEffect(() => {
    if (!board) newGame(size);
  }, [board, size, newGame]);

  // Escape cancels an armed power-up
  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setArmed(null);
      setPicked(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armed]);

  const tiles = board?.tiles ?? [];
  const rosettes = board?.rosettes ?? [];
  const cells = state?.cells ?? [];
  const result = outcome(cells);
  const drawn = state?.next ?? 1;

  // Whether the next value can go on tile `id`: on its dealt shape, or with
  // Any shape armed, on any empty tile
  const fits = (id: number) =>
    !!state && id >= 0 && (anyShape ? canPlace(cells, id) : canPlaceDealt(tiles, cells, id, state.nextShape));

  // Undo is a power-up: it needs a charge
  const canUndo = !!state && undo.length > 0 && state.charges.undo > 0;

  // Steps back one move, spending a charge and taking back any the undone
  // move earned.
  const undoMove = () => {
    if (!state || !canUndo) return;
    const restored = undo[undo.length - 1];
    const undos = undosAfterUndo(state.charges.undo, restored.charges.undo);
    setState({
      ...restored,
      charges: { ...restored.charges, undo: undos },
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
    const settled = settle(tiles, rosettes, state, id, placed, merges, drawn === WILD ? `Wild played as ${label(value)}.` : '', anyShape ? 'anyShape' : undefined);
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

  // A tap on the board with a power-up armed that is used there (Clear,
  // Upgrade, Sweep, Swap): uses it on the tile and spends a charge, and its
  // merges settle like a move's (points, rubble and power-ups earned). Not
  // a move: the deal and the move count stay, but Undo can take it back. A
  // tap where it can't be used disarms it, except that a power-up taking
  // two taps picks (or unpicks) its first tile.
  const useOnBoard = (id: number) => {
    if (!state || !armed || !tapUse || result.over || state.charges[armed] <= 0) {
      disarm();
      return;
    }
    if (tapUse.canPick && !tapUse.canUse(tiles, cells, id, picked)) {
      if (tapUse.canPick(cells, id)) setPicked(id === picked ? -1 : id);
      else disarm();
      return;
    }
    if (!tapUse.canUse(tiles, cells, id, picked)) {
      disarm();
      return;
    }
    const { cells: placed, merges } = tapUse.apply(tiles, cells, id, picked);
    const lead = tapUse.lead(tiles, cells, id, picked, state.charges[armed], label);
    disarm();
    setUndo([...undo, state]);
    setState({ ...state, ...settle(tiles, rosettes, state, id, placed, merges, lead, armed) });
    setSelected(-1);
  };

  // A press on tile `id` (-1 off the board). With a power-up armed that is
  // used on the board, it uses it. Otherwise a mouse always places with one
  // click, and a touch follows `tapRule`, the Tap to preview preference
  // (tapAction): place at once, or preview on the first tap and place on a
  // second tap on the same tile.
  const tapBoard = (id: number, pointerType: string, tapRule: TapRule) => {
    if (tapUse) {
      useOnBoard(id);
      return;
    }
    if (pointerType === 'mouse') {
      setSelected(-1);
      play(id);
      return;
    }
    const placeable = !result.over && fits(id);
    const action = tapAction(tapRule, selected, id, placeable);
    setSelected(action.select);
    if (action.place) play(id);
  };

  // The tile being previewed: the one under the mouse, or a tapped one;
  // with a power-up armed that is used on the board, the tile under the
  // pointer if it previews there (none for Clear and Sweep)
  const previewed = tapUse
    ? (tapUse.preview && tapUse.canUse(tiles, cells, hovered, picked) ? hovered : -1)
    : hovered >= 0 ? hovered : selected;

  // What the previewed tile would do
  const preview = useMemo(() => {
    if (previewed < 0 || result.over) return null;
    if (tapUse?.preview) return tapUse.preview(tiles, cells, previewed, picked);
    if (!fits(previewed)) return null;
    return previewAt(tiles, cells, previewed, drawn);
  }, [previewed, cells, drawn, result.over, tiles, state?.nextShape, anyShape, tapUse, picked]);

  // What the armed power-up would empty at the tile under the pointer
  const doomed = useMemo(() => tapUse?.doomed?.(tiles, cells, hovered) ?? [], [tapUse, tiles, cells, hovered]);

  // When the game ends, record it on its board size's scoreboard, then
  // tell the caller
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
    onGameEndRef.current();
  }, [over, state, board, gameId, scores]);

  return {
    size, board, state, tiles, rosettes, cells, result, drawn,
    armed, armedPowerUp, tapUse, anyShape, picked,
    canUndo, previewed, preview, doomed,
    scores, latest,
    newGame, undoMove, swap, toggle, tapBoard,
    // Drops a tile selected by a first tap (when the tap rule changes)
    clearSelection: () => setSelected(-1),
  };
};
