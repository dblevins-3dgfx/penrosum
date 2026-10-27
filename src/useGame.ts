import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoardSize } from './lib/board';
import {
  type GameAction, canUndo, doomedAt, gameReducer, newGame, placementArmed, previewFor, previewedTile, tapUseOf,
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
// finished game on the top 10. The first game starts at once, on the board
// size remembered, so there is always a game. `hovered` is the tile under
// the pointer (for the preview); `onGameEnd` is called once when a game
// ends, after it is recorded.
export const useGame = (hovered: number, onGameEnd: () => void) => {
  const [game, setGame] = useState(() => newGame(load(SIZE_STORAGE_KEY, parseBoardSize), 1, Math.random));
  const dispatch = (action: GameAction) => setGame(g => gameReducer(g, action));
  const [scores, setScores] = useState(() => load(SCORES_STORAGE_KEY, parseScores));
  // Each game is recorded on the scoreboard once, the first time it ends
  // (Undo can reopen a finished game, but finishing it again doesn't count)
  const recorded = useRef(-1);
  // This game's place on the scoreboard, once it has ended and made it
  const [latest, setLatest] = useState<{ size: BoardSize; rank: number } | null>(null);
  const onGameEndRef = useRef(onGameEnd);
  onGameEndRef.current = onGameEnd;

  // Starts a new game on a board of `size`, and remembers the size
  const startGame = (size: BoardSize) => {
    save(SIZE_STORAGE_KEY, size);
    setLatest(null);
    dispatch({ type: 'newGame', size });
  };

  // Escape cancels an armed power-up
  const { armed } = game;
  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setGame(g => gameReducer(g, { type: 'disarm' }));
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armed]);

  const result = outcome(game.position.cells);

  // When the game ends, record it on its board size's scoreboard, then
  // tell the caller
  useEffect(() => {
    if (!result.over || recorded.current === game.id) return;
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
  }, [result.over, game, scores]);

  const preview = useMemo(() => previewFor(game, hovered), [game, hovered]);
  const doomed = useMemo(() => doomedAt(game, hovered), [game, hovered]);

  return {
    board: game.board,
    state: game.position,
    cells: game.position.cells,
    result,
    armed,
    armedPowerUp: armed ? powerUp(armed) : null,
    tapUse: tapUseOf(game),
    // A placement power-up (Any shape) is armed: the next value may go on either shape
    placementArmed: placementArmed(game),
    picked: game.picked,
    canUndo: canUndo(game),
    previewed: previewedTile(game, hovered),
    preview,
    doomed,
    scores,
    latest,
    newGame: startGame,
    undoMove: () => dispatch({ type: 'undo' }),
    swap: () => dispatch({ type: 'swapSpare' }),
    toggle: (which: ArmedPowerUp) => dispatch({ type: 'toggle', which }),
    tapBoard: (id: number, pointerType: string, tapRule: TapRule) => dispatch({ type: 'tap', id, pointerType, tapRule }),
    clearSelection: () => dispatch({ type: 'clearSelection' }),
  };
};
