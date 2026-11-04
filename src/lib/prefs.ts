// Reading the choices remembered in this browser. Anything missing or not
// one of the allowed values falls back to the default, so an old or damaged
// saved value never breaks the game.

import { BOARD_SIZES, DEFAULT_BOARD_SIZE, type BoardSize } from './board';
import { SKIN_IDS, type SkinId } from './colors';
import { DEFAULT_RULE_OPTIONS, type RuleOptions, type TapRule } from './rules';

// The player's preferences, set in the Preferences dialog.
export interface Prefs {
  // Tap to preview: on a touch screen, a first tap previews the move and a
  // second places it ('preview'), or a tap places at once ('place')
  tap: TapRule;
  // The skin: the colors of the board and the page (see SKINS)
  skin: SkinId;
}

export const DEFAULT_PREFS: Prefs = {
  tap: 'place',
  skin: 'day',
};

const ALLOWED: { [K in keyof Prefs]: readonly Prefs[K][] } = {
  tap: ['place', 'preview'],
  skin: SKIN_IDS,
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

// The rule options for the open questions (now Q17), from their saved JSON.
const ALLOWED_RULES: { [K in keyof RuleOptions]: readonly RuleOptions[K][] } = {
  wild: ['auto', 'tile', 'before'],
};

export const parseRuleOptions = (raw: string | null): RuleOptions => {
  let saved: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw ?? '{}');
    if (parsed && typeof parsed === 'object') saved = parsed;
  } catch {
    // Not JSON: use the defaults
  }
  const options = { ...DEFAULT_RULE_OPTIONS };
  for (const key of Object.keys(ALLOWED_RULES) as (keyof RuleOptions)[]) {
    if ((ALLOWED_RULES[key] as readonly unknown[]).includes(saved[key])) {
      (options as Record<keyof RuleOptions, unknown>)[key] = saved[key];
    }
  }
  return options;
};

// The board size from its saved value.
export const parseBoardSize = (raw: string | null): BoardSize =>
  BOARD_SIZES.find(s => s.id === raw)?.id ?? DEFAULT_BOARD_SIZE;
