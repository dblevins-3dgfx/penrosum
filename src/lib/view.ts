// Fitting the board to the space on screen.

export interface Rect { x: number; y: number; width: number; height: number }

// Screen position = board position * scale + offset.
export interface View { scale: number; offsetX: number; offsetY: number }

// The largest scale at which `bounds` (in board units) fits a space of
// `width` x `height` screen pixels, leaving `margin` pixels on every side,
// centered.
export const fitView = (bounds: Rect, width: number, height: number, margin = 0): View => {
  const w = Math.max(1, width - 2 * margin);
  const h = Math.max(1, height - 2 * margin);
  const scale = Math.min(w / bounds.width, h / bounds.height);
  return {
    scale,
    offsetX: (width - bounds.width * scale) / 2 - bounds.x * scale,
    offsetY: (height - bounds.height * scale) / 2 - bounds.y * scale,
  };
};

// The board position under a screen position.
export const toBoard = (view: View, x: number, y: number) => ({
  x: (x - view.offsetX) / view.scale,
  y: (y - view.offsetY) / view.scale,
});
