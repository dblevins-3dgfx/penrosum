import { describe, expect, it } from 'vitest';
import { fitView, toBoard } from './view';

describe('fitView', () => {
  const bounds = { x: 10, y: 20, width: 400, height: 300 };

  it('scales to the limiting side and centers the other', () => {
    // A wide space: height limits, 600 / 300 = 2
    const v = fitView(bounds, 1000, 600);
    expect(v.scale).toBe(2);
    // The board spans 800 px across, centered in 1000
    expect(10 * v.scale + v.offsetX).toBe(100);
    expect(20 * v.scale + v.offsetY).toBe(0);
  });

  it('a tall space: width limits', () => {
    const v = fitView(bounds, 400, 900);
    expect(v.scale).toBe(1);
    expect(20 + v.offsetY).toBe((900 - 300) / 2);
  });

  it('leaves the margin on the limiting side', () => {
    const v = fitView(bounds, 1000, 600, 20);
    expect(v.scale).toBeCloseTo((600 - 40) / 300, 9);
    expect(20 * v.scale + v.offsetY).toBeCloseTo(20, 9);
  });
});

describe('toBoard', () => {
  it('undoes the view', () => {
    const v = fitView({ x: 10, y: 20, width: 400, height: 300 }, 1000, 600, 12);
    const p = { x: 123, y: 45 };
    const screen = { x: p.x * v.scale + v.offsetX, y: p.y * v.scale + v.offsetY };
    const back = toBoard(v, screen.x, screen.y);
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
  });
});
