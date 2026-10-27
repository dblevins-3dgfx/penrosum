// What the game remembers in this browser (localStorage): the preferences,
// the board size and the top 10. Reading and writing never throw: with
// storage unavailable (e.g. private mode), the defaults are used and a
// choice lasts only this visit.

// The preferences keep the key the rule options had, so the Q15 choice
// carries over as Tap to preview.
export const PREFS_STORAGE_KEY = 'penrosum.options';
export const SIZE_STORAGE_KEY = 'penrosum.boardSize';
export const SCORES_STORAGE_KEY = 'penrosum.topTen';

// Stored data no longer used: the top 10 from the fixed boards (scored on
// different tilings, so cleared when boards became random). Removed at
// load. (Options of decided questions are simply ignored by parsePrefs.)
const RETIRED_STORAGE_KEYS = ['penrosum.scores'];
try {
  for (const key of RETIRED_STORAGE_KEYS) localStorage.removeItem(key);
} catch {
  // Storage unavailable: nothing to clear
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
