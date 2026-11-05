import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoardSize } from './lib/board';
import {
  type GameAction, canUndo, doomedAt, gameOutcome, gameReducer, isFreed, newGame, placementArmed, previewFor, previewedTile,
  tapUseOf,
} from './lib/game';
import { type ArmedPowerUp, powerUp } from './lib/powerups';
import { parseBoardSize } from './lib/prefs';
import { type TapRule, type WildRule, highestTile, wildChoices } from './lib/rules';
import { parseScores, recordScore } from './lib/scores';
import type { Terms } from './lib/skin';
import { SCORES_STORAGE_KEY, SIZE_STORAGE_KEY, load, save } from './storage';

export type { Board, Snapshot } from './lib/game';

// The game, held for the screen: the game itself is gameReducer in
// src/lib/game.ts; this keeps it, dispatches actions to it, and does what
// isn't pure: remembering the board size, Escape to disarm, and recording a
// finished game on the top 10. The first game starts at once, on the board
// size remembered, so there is always a game. `hovered` is the tile under
// the pointer (for the preview), and `wildHover` the choice under the
// pointer in a wildcard's picker (Q17); `onGameEnd` is called once when a
// game ends, after it is recorded. `terms` are the skin's words for the
// status line; `skin` is its id, for the top 10, and `top` its ladder's top,
// the goal of a new game (setTop moves a game in progress to a new skin's).
export const useGame = (
  hovered: number, wildHover: number | null, onGameEnd: () => void, terms: Terms, skin: string, top: number,
) => {
  const [game, setGame] = useState(() => newGame(load(SIZE_STORAGE_KEY, parseBoardSize), 1, Math.random, top));
  const termsRef = useRef(terms);
  termsRef.current = terms;
  const dispatch = (action: GameAction) => setGame(g => gameReducer(g, action, Math.random, termsRef.current));
  const [scores, setScores] = useState(() => load(SCORES_STORAGE_KEY, parseScores));
  // Each game is recorded on the scoreboard once, the first time it ends
  // (Undo can reopen a finished game, but finishing it again doesn't count)
  const recorded = useRef(-1);
  // This game's place on the scoreboard, once it has ended and made it
  const [latest, setLatest] = useState<{ size: BoardSize; skin: string; rank: number } | null>(null);
  const topRef = useRef(top);
  topRef.current = top;
  const onGameEndRef = useRef(onGameEnd);
  onGameEndRef.current = onGameEnd;

  // Starts a new game on a board of `size`, and remembers the size
  const startGame = (size: BoardSize) => {
    save(SIZE_STORAGE_KEY, size);
    setLatest(null);
    dispatch({ type: 'newGame', size, top: topRef.current });
  };

  // Escape cancels an armed power-up, or closes a wildcard's picker
  const { armed, choosing } = game;
  const escapable = !!armed || choosing >= 0;
  useEffect(() => {
    if (!escapable) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setGame(g => gameReducer(g, { type: 'disarm' }));
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [escapable]);

  const result = useMemo(() => gameOutcome(game), [game]);

  // When the game ends, record it on its board size's scoreboard for the
  // skin it ended in, then tell the caller
  useEffect(() => {
    if (!result.over || recorded.current === game.id) return;
    recorded.current = game.id;
    const { position, board } = game;
    const entry = {
      score: position.score, highest: highestTile(position.cells), moves: position.moves,
      date: new Date().toISOString(), won: result.over && result.won,
    };
    const { boards, rank } = recordScore(scores, board.size, skin, entry);
    if (rank) {
      setScores(boards);
      save(SCORES_STORAGE_KEY, JSON.stringify(boards));
      setLatest({ size: board.size, skin, rank });
    }
    onGameEndRef.current();
  }, [result, game, scores, skin]);

  const preview = useMemo(() => previewFor(game, hovered, wildHover), [game, hovered, wildHover]);
  // Q17 'tile': what the ★ could play as on the tile whose picker is open
  const wildOptions = useMemo(
    () => (choosing >= 0 ? wildChoices(game.board.tiles, game.position.cells, choosing) : []),
    [game.board.tiles, game.position.cells, choosing],
  );
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
    // With Swap armed, whether Any shape is armed with it (to swap across shapes)
    free: game.free,
    // ... and has a charge, so a swap across shapes can be made
    freed: isFreed(game),
    canUndo: canUndo(game),
    previewed: previewedTile(game, hovered),
    preview,
    doomed,
    scores,
    latest,
    newGame: startGame,
    undoMove: () => dispatch({ type: 'undo' }),
    swap: () => dispatch({ type: 'swapSpare' }),
    // The skin changed: the goal moves to its ladder's top (see canSetTop)
    setTop: (newTop: number) => dispatch({ type: 'setTop', top: newTop }),
    toggle: (which: ArmedPowerUp) => dispatch({ type: 'toggle', which }),
    tapBoard: (id: number, pointerType: string, tapRule: TapRule, wildRule: WildRule) =>
      dispatch({ type: 'tap', id, pointerType, tapRule, wildRule }),
    // Q17: the tile whose wildcard picker is open (-1 for none) and its
    // choices; the value picked ahead for the ★ (null for Best)
    choosing,
    wildOptions,
    wildAs: game.wildAs,
    placeWild: (value: number) => dispatch({ type: 'placeWild', value }),
    closeWild: () => dispatch({ type: 'closeWild' }),
    chooseWild: (value: number | null) => dispatch({ type: 'chooseWild', value }),
    clearSelection: () => dispatch({ type: 'clearSelection' }),
  };
};
