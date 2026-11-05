// Pull-request previews (see the Previews section of the README): each
// open pull request is built and published next to the live game, at
// /penrosum/pr-preview/pr-<number>/. Every preview shares the live game's
// browser storage (one site, one origin), so a preview keeps its data under
// keys of its own, and never writes the live game's. The first time a
// preview opens it copies the live game's data, so it is tried out with
// the player's real top 10 and preferences.

// The preview a build is for: its pull request's number, or null for the
// live game. Only digits count, so a stray value can't reach the keys.
export const previewNumber = (raw: string | undefined | null): string | null =>
  raw && /^\d+$/.test(raw) ? raw : null;

// Where `key` ('penrosum.topTen') is kept in preview `pr`
// ('penrosum.pr82.topTen'), or the key itself in the live game.
export const storageKey = (key: string, pr: string | null) =>
  pr ? key.replace(/^penrosum\./, `penrosum.pr${pr}.`) : key;

// The part of localStorage the copy needs
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// Copies the live game's data under `keys` to preview `pr`'s keys, once:
// a marker records that it was done, so later changes in either stay
// apart. A key with nothing saved is skipped, and a preview key already
// holding data is kept.
export const seedPreview = (store: KeyValueStore, keys: string[], pr: string) => {
  const marker = `penrosum.pr${pr}.seeded`;
  if (store.getItem(marker) !== null) return;
  for (const key of keys) {
    const value = store.getItem(key);
    const own = storageKey(key, pr);
    if (value !== null && store.getItem(own) === null) store.setItem(own, value);
  }
  store.setItem(marker, '1');
};
