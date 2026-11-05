// The skins on offer. Each skin is a file of its own in this folder that
// default-exports a Skin (see src/lib/skin.ts), and is found here by
// itself: adding a skin is adding its file (and its tests), with no change
// to the game. A skin's id is its file's name. The shared tests in
// skins.test.ts check every skin found.

import { type Skin, type Terms, termsFor } from '../skin';

const files = import.meta.glob<{ default: Skin }>(['./*.ts', '!./index.ts', '!./*.test.ts'], { eager: true });

// The skin the game starts in, and falls back to
export const DEFAULT_SKIN = 'alphabet';

const found = Object.entries(files).map(([path, m]) => {
  const id = path.slice(2, -3);
  if (m.default.id !== id) throw new Error(`Skin ${path} has id '${m.default.id}', not '${id}'`);
  return m.default;
});

// Every skin, the default first and the rest by name, as the Preferences
// dialog lists them
export const SKINS: readonly Skin[] = [
  ...found.filter(s => s.id === DEFAULT_SKIN),
  ...found.filter(s => s.id !== DEFAULT_SKIN).sort((a, b) => a.name.localeCompare(b.name)),
];

export type SkinId = string;

export const SKIN_IDS: readonly SkinId[] = SKINS.map(s => s.id);

// Skin `id`, or the default for one that doesn't exist
export const skinById = (id: SkinId): Skin => SKINS.find(s => s.id === id) ?? SKINS[0];

// The default skin's words: letters and #
export const DEFAULT_TERMS: Terms = termsFor(skinById(DEFAULT_SKIN));
