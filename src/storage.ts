// What the game remembers in this browser (localStorage): the preferences,
// the board size and the top 10. Reading and writing never throw: with
// storage unavailable (e.g. private mode), the defaults are used and a
// choice lasts only this visit.

import { previewNumber, seedPreview, storageKey } from './lib/preview';

// The pull request this build previews (set by the Pages workflow), or
// null for the live game. A preview keeps its data under keys of its own,
// seeded once from the live game's (src/lib/preview.ts).
export const PREVIEW = previewNumber(import.meta.env.VITE_PREVIEW);
// The pull request's page, for the preview badge
export const PREVIEW_URL: string | undefined = import.meta.env.VITE_PREVIEW_URL;

// The preferences keep the key the rule options had, so the Q15 choice
// carries over as Tap to preview.
const LIVE_KEYS = {
  prefs: 'penrosum.options',
  size: 'penrosum.boardSize',
  scores: 'penrosum.topTen',
  // The rule options for the open questions (Q17), tried from How to play
  rules: 'penrosum.rules',
};
export const PREFS_STORAGE_KEY = storageKey(LIVE_KEYS.prefs, PREVIEW);
export const SIZE_STORAGE_KEY = storageKey(LIVE_KEYS.size, PREVIEW);
export const SCORES_STORAGE_KEY = storageKey(LIVE_KEYS.scores, PREVIEW);
export const RULES_STORAGE_KEY = storageKey(LIVE_KEYS.rules, PREVIEW);

// Stored data no longer used: the top 10 from the fixed boards (scored on
// different tilings, so cleared when boards became random). Removed at
// load. (Options of decided questions are simply ignored by parsePrefs.)
// A preview leaves them to the live game.
const RETIRED_STORAGE_KEYS = ['penrosum.scores'];
try {
  if (PREVIEW) seedPreview(localStorage, Object.values(LIVE_KEYS), PREVIEW);
  else for (const key of RETIRED_STORAGE_KEYS) localStorage.removeItem(key);
} catch {
  // Storage unavailable: nothing to clear or copy
}

// The value saved under `key`, made sense of by `parse` (which gets null
// when nothing is saved or storage is unavailable).
export const load = <T,>(key: string, parse: (raw: string | null) => T): T => {
  try {
    return parse(localStorage.getItem(key));
  } catch {
    return parse(null);
  }
};

export const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (e.g. private mode): the choice lasts this visit
  }
};
