import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoardSize } from './lib/board';
import {
  type Game, type GameAction, canUndo, doomedAt, gameReducer, previewFor, previewedTile, tapUseOf,
} from './lib/game';
import { TOP_VALUE } from './lib/labels';
import { type ArmedPowerUp, powerUp } from './lib/powerups';
import { parseBoardSize } from './lib/prefs';
import { type TapRule, highestTile, outcome } from './lib/rules';
import { addScore, parseScores } from './lib/scores';
import { SCORES_STORAGE_KEY, SIZE_STORAGE_KEY, load, save } from './storage';

export type { Board, Snapshot } from './lib/game';

// The game, held for the screen: the game itself is gameReducer in
// src/lib/game.ts; this keeps it, dispatches actions to it, and does what
// isn't pure: remembering the board size, Escape to disarm, and recording a
// finished game on the top 10. `hovered` is the tile under the pointer
// (for the preview); `onGameEnd` is called once when a game ends, after it
// is recorded.
export const useGame = (hovered: number, onGameEnd: () => void) => {
  const [size, setSize] = useState(() => load(SIZE_STORAGE_KEY, parseBoardSize));
  const [game, setGame] = useState<Game | null>(null);
  const dispatch = (action: GameAction) => setGame(g => gameReducer(g, action));
  const [scores, setScores] = useState(() => load(SCORES_STORAGE_KEY, parseScores));
  // Each game is recorded on the scoreboard once, the first time it ends
  // (Undo can reopen a finished game, but finishing it again doesn't count)
  const recorded = useRef(-1);
  // This game's place on the scoreboard, once it has ended and made it
  const [latest, setLatest] = useState<{ size: BoardSize; rank: number } | null>(null);
  const onGameEndRef = useRef(onGameEnd);
  onGameEndRef.current = onGameEnd;

  // Starts a new game on a board of `newSize`, and remembers the size
  const newGame = (newSize: BoardSize) => {
    setSize(newSize);
    save(SIZE_STORAGE_KEY, newSize);
    setLatest(null);
    dispatch({ type: 'newGame', size: newSize });
  };

  useEffect(() => {
    if (!game) setGame(g => g ?? gameReducer(null, { type: 'newGame', size }));
  }, [game, size]);

  // Escape cancels an armed power-up
  const armed = game?.armed ?? null;
  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setGame(g => gameReducer(g, { type: 'disarm' }));
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armed]);

  const state = game?.position ?? null;
  const cells = state?.cells ?? [];
  const result = outcome(cells);

  // When the game ends, record it on its board size's scoreboard, then
  // tell the caller
  const over = result.over;
  useEffect(() => {
    if (!over || !game || recorded.current === game.id) return;
    recorded.current = game.id;
    const { position, board } = game;
    const entry = {
      score: position.score, highest: highestTile(position.cells), moves: position.moves,
      date: new Date().toISOString(), won: highestTile(position.cells) >= TOP_VALUE,
    };
    const { list, rank } = addScore(scores[board.size], entry);
    if (rank) {
      const updated = { ...scores, [board.size]: list };
      setScores(updated);
      save(SCORES_STORAGE_KEY, JSON.stringify(updated));
      setLatest({ size: board.size, rank });
    }
    onGameEndRef.current();
  }, [over, game, scores]);

  const preview = useMemo(() => (game ? previewFor(game, hovered) : null), [game, hovered]);
  const doomed = useMemo(() => (game ? doomedAt(game, hovered) : []), [game, hovered]);

  return {
    size,
    board: game?.board ?? null,
    state,
    tiles: game?.board.tiles ?? [],
    cells,
    result,
    drawn: state?.next ?? 1,
    armed,
    armedPowerUp: armed ? powerUp(armed) : null,
    tapUse: game ? tapUseOf(game) : undefined,
    anyShape: armed === 'anyShape',
    picked: game?.picked ?? -1,
    canUndo: !!game && canUndo(game),
    previewed: game ? previewedTile(game, hovered) : -1,
    preview,
    doomed,
    scores,
    latest,
    newGame,
    undoMove: () => dispatch({ type: 'undo' }),
    swap: () => dispatch({ type: 'swapSpare' }),
    toggle: (which: ArmedPowerUp) => dispatch({ type: 'toggle', which }),
    tapBoard: (id: number, pointerType: string, tapRule: TapRule) => dispatch({ type: 'tap', id, pointerType, tapRule }),
    clearSelection: () => dispatch({ type: 'clearSelection' }),
  };
};
