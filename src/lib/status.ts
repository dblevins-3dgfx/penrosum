// The status line under the panel's buttons: what just happened, or what
// to do next. A plain function, so the screen only shows what it returns.

import { BOARD_SIZES, type BoardSize } from './board';
import { MIN_GROUP, type Outcome, type Shape, type TapRule } from './rules';
import type { Terms } from './skin';
import { DEFAULT_TERMS } from './skins';

export interface StatusInput {
  message: string; // what the last action said ('' for none)
  moves: number;
  dealtShape: Shape | null; // the shape the next value must go on (null: any)
  tapRule: TapRule; // the Tap to preview preference
  hint: string | null; // the armed power-up's hint, if one is armed
  result: Outcome;
  score: number;
  latest: { size: BoardSize; rank: number } | null; // this game's place on the top 10
}

// The status line. In order of precedence:
//   the result, once the game is over (with its top-10 place, if any);
//   the armed power-up's hint;
//   what the last action said;
//   before the first move, a hint on how to play.
export const statusLine = (
  { message, moves, dealtShape, tapRule, hint, result, score, latest }: StatusInput,
  terms: Terms = DEFAULT_TERMS,
): string => {
  if (result.over) {
    const end = result.won
      ? `You made ${terms.label(result.highest)}, the top of ${terms.ladder}, in ${moves} moves. You win! Score: ${score}.`
      : `Board full. Score: ${score} (highest tile ${terms.label(result.highest)}, ${moves} moves).`;
    const size = latest && BOARD_SIZES.find(s => s.id === latest.size);
    return latest && size ? `${end} #${latest.rank} on the ${size.name.toLowerCase()} board!` : end;
  }
  if (hint) return hint;
  if (message) return message;
  if (moves > 0) return '';
  return `Place the Next ${terms.piece} on an empty ${dealtShape ?? 'tile'}${
    tapRule === 'preview' ? ' (on a touch screen, tap once to preview and again to place)' : ''
  }. ${MIN_GROUP} or more matching tiles merge into the one you placed, a rung higher.`;
};
