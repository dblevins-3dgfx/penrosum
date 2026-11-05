// Which emoji this device can draw, so a skin's newer pictures fall back
// to older ones where they're missing (see resolvePieces). Measured once
// per glyph on a small canvas: a drawn emoji has colored pixels; a missing
// one draws as a gray box or nothing.

import { SKINS, resolvePieces, type Skin, type SkinId } from './lib/skins';

// The fonts emoji are drawn in, on the board and in the chips
export const EMOJI_FONTS = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';

const known = new Map<string, boolean>();

export const canDrawEmoji = (glyph: string): boolean => {
  const cached = known.get(glyph);
  if (cached !== undefined) return cached;
  let drawn = true; // Can't tell (no canvas): keep the skin's own picture
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.canvas.width = ctx.canvas.height = 32;
    ctx.font = `24px ${EMOJI_FONTS}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText(glyph, 16, 16);
    const data = ctx.getImageData(0, 0, 32, 32).data;
    drawn = false;
    for (let i = 0; i < data.length && !drawn; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      drawn = a > 0 && (Math.abs(r - g) > 16 || Math.abs(g - b) > 16 || Math.abs(r - b) > 16);
    }
  }
  known.set(glyph, drawn);
  return drawn;
};

const resolved = new Map<SkinId, Skin>();

// Skin `id` as this device draws it: a picture skin with its missing emoji
// replaced by their fallbacks.
export const skinFor = (id: SkinId): Skin => {
  let skin = resolved.get(id);
  if (!skin) {
    const base: Skin = SKINS[id];
    skin = base.pictures ? resolvePieces(base, canDrawEmoji) : base;
    resolved.set(id, skin);
  }
  return skin;
};
