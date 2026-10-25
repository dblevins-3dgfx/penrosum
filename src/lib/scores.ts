// The top 10 scoreboard: the best finished games on each board size,
// remembered in this browser. Plain functions over plain data, so the
// component only loads, saves and shows them.

import { BOARD_SIZES, type BoardSize } from './board';

// How many games each board size keeps.
export const TOP_SCORES = 10;

export interface ScoreEntry {
  score: number;
  highest: number; // the highest tile's value
  moves: number;
  date: string; // when the game ended, as an ISO date and time
  won: boolean; // ended by making Z
}

export type Scoreboards = Record<BoardSize, ScoreEntry[]>;

export const emptyScoreboards = (): Scoreboards =>
  Object.fromEntries(BOARD_SIZES.map(s => [s.id, []])) as unknown as Scoreboards;

// Adds `entry` to `list` (best first) if it makes the top TOP_SCORES. A
// higher score ranks higher; on a tie the game that ended first stays ahead.
// Returns the new list and the entry's place, 1 to TOP_SCORES, or null when
// it didn't make the list (which is then unchanged).
export const addScore = (list: ScoreEntry[], entry: ScoreEntry) => {
  const at = list.findIndex(e => entry.score > e.score);
  const place = at < 0 ? list.length : at;
  if (place >= TOP_SCORES) return { list, rank: null };
  const next = [...list.slice(0, place), entry, ...list.slice(place)].slice(0, TOP_SCORES);
  return { list: next, rank: place + 1 };
};

const isEntry = (e: unknown): e is ScoreEntry => {
  if (!e || typeof e !== 'object') return false;
  const { score, highest, moves, date, won } = e as Record<string, unknown>;
  return [score, highest, moves].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)
    && typeof date === 'string' && typeof won === 'boolean';
};

// The scoreboards from their saved JSON (or null when nothing is saved).
// Entries that don't make sense are dropped, and each list is put back in
// order and cut to TOP_SCORES, so damaged storage never breaks the game.
export const parseScores = (raw: string | null): Scoreboards => {
  const boards = emptyScoreboards();
  let saved: unknown;
  try {
    saved = JSON.parse(raw ?? '{}');
  } catch {
    return boards;
  }
  if (!saved || typeof saved !== 'object') return boards;
  for (const { id } of BOARD_SIZES) {
    const list = (saved as Record<string, unknown>)[id];
    if (!Array.isArray(list)) continue;
    for (const e of list.filter(isEntry)) boards[id] = addScore(boards[id], e).list;
  }
  return boards;
};
