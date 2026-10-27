// The game as plain data and a reducer: a game, plus an action (a tap on
// the board, Undo, the spare, arming a power-up, a new game), makes the
// next game. Randomness comes in as `rand`, so tests can fix it. The React
// hook (src/useGame.ts) only holds the game, dispatches actions, and does
// what isn't pure: storage, keys, and recording a finished game.

import { boardBounds, boardFor, findRosettes, type BoardSize, type BoardTile, type Rosette } from './board';
import { valueLabel } from './labels';
import {
  type ArmedPowerUp, type Charges, newlyCompleted, powerUp, startCharges, toggleArmed, undosAfterUndo,
} from './powerups';
import {
  WILD, type Cell, type Deal, type Drawn, type Shape, type TapRule,
  canPlace, canPlaceDealt, dealShape, drawValue, outcome, place, previewAt, seedBoard, swapSpare,
  tapAction, valueToPlace,
} from './rules';
import { settle } from './settle';

export interface Board {
  size: BoardSize;
  tiles: BoardTile[];
  bounds: ReturnType<typeof boardBounds>;
  rosettes: Rosette[]; // its suns and stars
}

// A position in the game: what Undo goes back to.
export interface Snapshot {
  cells: Cell[];
  next: Drawn; // the value dealt for the next move, a number or the wildcard
  moves: number;
  score: number; // points from merges so far
  lastMove: number | null;
  nextShape: Shape; // the shape dealt with the next value
  spare: Deal | null; // the hot spare, if one is held
  charges: Charges; // the power-up charges held
  completed: number[]; // the suns and stars (indices into board.rosettes) completed this game
  message: string;
}

export interface Game {
  id: number; // counts games, so each is recorded on the top 10 once
  board: Board;
  position: Snapshot;
  history: Snapshot[]; // the positions Undo goes back to, oldest first
  armed: ArmedPowerUp | null; // the power-up armed, if any
  picked: number; // for a power-up taking two taps (Swap), the first tile, or -1
  selected: number; // the tile a first tap selected, with Tap to preview on, or -1
}

export type GameAction =
  | { type: 'newGame'; size: BoardSize }
  // A press on tile `id` (-1 off the board) by a mouse, a finger or a pen
  | { type: 'tap'; id: number; pointerType: string; tapRule: TapRule }
  | { type: 'undo' }
  | { type: 'swapSpare' }
  | { type: 'toggle'; which: ArmedPowerUp }
  | { type: 'disarm' }
  | { type: 'clearSelection' };

// How values are written in the status line: as letters
const label = valueLabel;

// Starts a new game on a board of `size`: a new random board, seeded, with
// the first value dealt and the starting charges.
export const newGame = (size: BoardSize, id: number, rand: () => number): Game => {
  const tiles = boardFor(size, rand);
  const rosettes = findRosettes(tiles);
  const cells = seedBoard(tiles, rand);
  return {
    id,
    board: { size, tiles, bounds: boardBounds(tiles), rosettes },
    position: {
      cells, next: drawValue(rand), moves: 0, score: 0, lastMove: null,
      nextShape: dealShape(tiles, cells, rand), spare: null, charges: startCharges(),
      // a sun or star the seeding happens to fill earns nothing
      completed: newlyCompleted(rosettes, cells, []), message: '',
    },
    history: [],
    armed: null,
    picked: -1,
    selected: -1,
  };
};

// Whether the game has ended (board full, or a Z made).
export const isOver = (game: Game) => outcome(game.position.cells).over;

// Whether a power-up that changes placement (Any shape) is armed.
export const placementArmed = (game: Game) => !!game.armed && powerUp(game.armed).kind === 'placement';

// Whether the next value can go on tile `id`: on its dealt shape, or with
// a placement power-up (Any shape) armed, on any empty tile.
export const fits = (game: Game, id: number) => {
  const { cells, nextShape } = game.position;
  return id >= 0 && (placementArmed(game)
    ? canPlace(cells, id)
    : canPlaceDealt(game.board.tiles, cells, id, nextShape));
};

// Undo is a power-up: it needs a position to go back to and a charge.
export const canUndo = (game: Game) => game.history.length > 0 && game.position.charges.undo > 0;

// How the armed power-up is used by tapping the board, if it is.
export const tapUseOf = (game: Game) => (game.armed ? powerUp(game.armed).tap : undefined);

// The tile the preview is for, with `hovered` under the pointer (-1 for
// none): the hovered tile, or else the one a first tap selected; with a
// power-up armed that is used on the board, the hovered tile if it
// previews there (none for Clear and Sweep).
export const previewedTile = (game: Game, hovered: number) => {
  const use = tapUseOf(game);
  if (use) return use.preview && use.canUse(game.board.tiles, game.position.cells, hovered, game.picked) ? hovered : -1;
  return hovered >= 0 ? hovered : game.selected;
};

// What the previewed tile would do (see previewedTile), or null.
export const previewFor = (game: Game, hovered: number) => {
  const id = previewedTile(game, hovered);
  if (id < 0 || isOver(game)) return null;
  const { tiles } = game.board;
  const { cells, next } = game.position;
  const use = tapUseOf(game);
  if (use?.preview) return use.preview(tiles, cells, id, game.picked);
  if (!fits(game, id)) return null;
  return previewAt(tiles, cells, id, next);
};

// The tiles the armed power-up would empty with `hovered` under the
// pointer (Clear: the tile; Sweep: its #s and its neighbors').
export const doomedAt = (game: Game, hovered: number) =>
  tapUseOf(game)?.doomed?.(game.board.tiles, game.position.cells, hovered) ?? [];

const disarmed = (game: Game): Game => ({ ...game, armed: null, picked: -1 });

// Places the next value on tile `id`, if it fits: its merges settle, the
// position is kept for Undo, and the next value is dealt. Any shape, if
// armed, is spent.
const play = (game: Game, id: number, rand: () => number): Game => {
  if (isOver(game) || !fits(game, id)) return game;
  const { tiles, rosettes } = game.board;
  const position = game.position;
  const value = valueToPlace(tiles, position.cells, id, position.next);
  const { cells: placed, merges } = place(tiles, position.cells, id, value);
  const settled = settle(
    tiles, rosettes, position, id, placed, merges,
    position.next === WILD ? `Wild played as ${label(value)}.` : '',
    placementArmed(game) && game.armed ? game.armed : undefined,
  );
  return {
    ...game,
    armed: null,
    history: [...game.history, position],
    position: {
      ...settled,
      next: drawValue(rand),
      moves: position.moves + 1,
      nextShape: dealShape(tiles, settled.cells, rand),
      spare: position.spare,
    },
  };
};

// A tap on the board with a power-up armed that is used there (Clear,
// Upgrade, Sweep, Swap): uses it on the tile and spends a charge, and its
// merges settle like a move's (points, rubble and power-ups earned). Not a
// move: the deal and the move count stay, but Undo can take it back. A tap
// where it can't be used disarms it, except that a power-up taking two
// taps picks (or unpicks) its first tile.
const useOnBoard = (game: Game, id: number): Game => {
  const { armed, picked, position } = game;
  const use = tapUseOf(game);
  if (!armed || !use || isOver(game) || position.charges[armed] <= 0) return disarmed(game);
  const { tiles, rosettes } = game.board;
  const { cells } = position;
  if (use.canPick && !use.canUse(tiles, cells, id, picked)) {
    return use.canPick(cells, id) ? { ...game, picked: id === picked ? -1 : id } : disarmed(game);
  }
  if (!use.canUse(tiles, cells, id, picked)) return disarmed(game);
  const { cells: placed, merges } = use.apply(tiles, cells, id, picked);
  const lead = use.lead(tiles, cells, id, picked, position.charges[armed], label);
  return {
    ...disarmed(game),
    selected: -1,
    history: [...game.history, position],
    position: { ...position, ...settle(tiles, rosettes, position, id, placed, merges, lead, armed) },
  };
};

// A press on tile `id`. With a power-up armed that is used on the board,
// it uses it. Otherwise a mouse always places with one click, and a touch
// follows `tapRule`, the Tap to preview preference (tapAction): place at
// once, or preview on the first tap and place on a second tap on the same
// tile.
const tap = (game: Game, id: number, pointerType: string, tapRule: TapRule, rand: () => number): Game => {
  if (tapUseOf(game)) return useOnBoard(game, id);
  if (pointerType === 'mouse') return play({ ...game, selected: -1 }, id, rand);
  const action = tapAction(tapRule, game.selected, id, !isOver(game) && fits(game, id));
  const selected = { ...game, selected: action.select };
  return action.place ? play(selected, id, rand) : selected;
};

// Steps back one move, spending an Undo charge and taking back any the
// undone move earned.
const undo = (game: Game): Game => {
  if (!canUndo(game)) return game;
  const restored = game.history[game.history.length - 1];
  const undos = undosAfterUndo(game.position.charges.undo, restored.charges.undo);
  return {
    ...disarmed(game),
    selected: -1,
    history: game.history.slice(0, -1),
    position: {
      ...restored,
      charges: { ...restored.charges, undo: undos },
      message: `Move undone. ${undos} Undo${undos === 1 ? '' : 's'} left.`,
    },
  };
};

// Swaps the next value with the hot spare, or keeps it as the spare when
// none is held. Not a move: it changes only the deal.
const swapWithSpare = (game: Game, rand: () => number): Game => {
  if (isOver(game)) return game;
  const { tiles } = game.board;
  const position = game.position;
  const { cells } = position;
  const { current, spare } = swapSpare(
    tiles, cells, { value: position.next, shape: position.nextShape }, position.spare,
    () => ({ value: drawValue(rand), shape: dealShape(tiles, cells, rand) }),
  );
  return {
    ...game,
    position: {
      ...position, next: current.value, nextShape: current.shape, spare,
      message: position.spare
        ? `Swapped: ${label(current.value)} is next, ${label(spare.value)} is the spare.`
        : `${label(spare.value)} kept as the spare.`,
    },
  };
};

// The game after `action`. The first game is made by newGame; a new game
// after it counts up. The input is unchanged.
export const gameReducer = (game: Game, action: GameAction, rand: () => number = Math.random): Game => {
  switch (action.type) {
    case 'newGame': return newGame(action.size, game.id + 1, rand);
    case 'tap': return tap(game, action.id, action.pointerType, action.tapRule, rand);
    case 'undo': return undo(game);
    case 'swapSpare': return swapWithSpare(game, rand);
    // Arms one power-up (or disarms it if armed), disarming the others
    case 'toggle': return { ...game, armed: toggleArmed(game.armed, action.which), picked: -1 };
    case 'disarm': return disarmed(game);
    // Drops a tile selected by a first tap (when the tap rule changes)
    case 'clearSelection': return { ...game, selected: -1 };
  }
};
