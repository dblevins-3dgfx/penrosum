// Reading the choices remembered in this browser. Anything missing or not
// one of the allowed values falls back to the default, so an old or damaged
// saved value never breaks the game.

import { BOARD_SIZES, DEFAULT_BOARD_SIZE, type BoardSize } from './board';
import type { TapRule } from './rules';

// The player's preferences, set in the Preferences dialog.
export interface Prefs {
  // Tap to preview: on a touch screen, a first tap previews the move and a
  // second places it ('preview'), or a tap places at once ('place')
  tap: TapRule;
}

export const DEFAULT_PREFS: Prefs = {
  tap: 'place',
};

const ALLOWED: { [K in keyof Prefs]: readonly Prefs[K][] } = {
  tap: ['place', 'preview'],
};

// The preferences from their saved JSON (or null when nothing is saved).
export const parsePrefs = (raw: string | null): Prefs => {
  let saved: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw ?? '{}');
    if (parsed && typeof parsed === 'object') saved = parsed;
  } catch {
    // Not JSON: use the defaults
  }
  const prefs = { ...DEFAULT_PREFS };
  for (const key of Object.keys(ALLOWED) as (keyof Prefs)[]) {
    if ((ALLOWED[key] as readonly unknown[]).includes(saved[key])) {
      (prefs as Record<keyof Prefs, unknown>)[key] = saved[key];
    }
  }
  return prefs;
};

// The board size from its saved value.
export const parseBoardSize = (raw: string | null): BoardSize =>
  BOARD_SIZES.find(s => s.id === raw)?.id ?? DEFAULT_BOARD_SIZE;
