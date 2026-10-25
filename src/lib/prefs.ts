// Reading the choices remembered in this browser. Anything missing or not
// one of the allowed values falls back to the default, so an old or damaged
// saved value never breaks the game.

import { BOARD_SIZES, DEFAULT_BOARD_SIZE, type BoardSize } from './board';
import { DEFAULT_OPTIONS, TARGET_OPTIONS, type Options } from './rules';

const ALLOWED: { [K in keyof Options]: readonly Options[K][] } = {
  group: ['connected', 'neighbors'],
  clear: ['empty', 'zero'],
  values: ['ones', 'random', 'choose'],
  goal: ['highest', 'target'],
  target: TARGET_OPTIONS,
  shape: ['any', 'same'],
};

// The rule options from their saved JSON (or null when nothing is saved).
export const parseOptions = (raw: string | null): Options => {
  let saved: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw ?? '{}');
    if (parsed && typeof parsed === 'object') saved = parsed;
  } catch {
    // Not JSON: use the defaults
  }
  const options = { ...DEFAULT_OPTIONS };
  for (const key of Object.keys(ALLOWED) as (keyof Options)[]) {
    if ((ALLOWED[key] as readonly unknown[]).includes(saved[key])) {
      (options as Record<keyof Options, unknown>)[key] = saved[key];
    }
  }
  return options;
};

// The board size from its saved value.
export const parseBoardSize = (raw: string | null): BoardSize =>
  BOARD_SIZES.find(s => s.id === raw)?.id ?? DEFAULT_BOARD_SIZE;
