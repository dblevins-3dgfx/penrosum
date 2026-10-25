// Reading the choices remembered in this browser. Anything missing or not
// one of the allowed values falls back to the default, so an old or damaged
// saved value never breaks the game.

import { BOARD_SIZES, DEFAULT_BOARD_SIZE, type BoardSize } from './board';

// The board size from its saved value.
export const parseBoardSize = (raw: string | null): BoardSize =>
  BOARD_SIZES.find(s => s.id === raw)?.id ?? DEFAULT_BOARD_SIZE;
