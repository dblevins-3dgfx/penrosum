import { describe, expect, it } from 'vitest';
import { valueLabel } from './labels';
import { type EarnContext, POWER_UPS, earnCharges, powerUp, startCharges, toggleArmed } from './powerups';
import { EMPTY, type Cell, type Tile, UNDO_START } from './rules';

// Nothing earned
const quiet: EarnContext = {
  merges: [], rubbleMerges: [], highestBefore: 3, highestAfter: 3, scoreBefore: 0, scoreAfter: 0, completed: [],
};

// A line: 0 - 1 - 2
const line: Tile[] = [{ neighbors: [1] }, { neighbors: [0, 2] }, { neighbors: [1] }];

describe('the power-up table', () => {
  it('lists Undo, Clear, Any shape, Upgrade, Sweep and Swap, in tray order', () => {
    expect(POWER_UPS.map(p => p.short)).toEqual(['Undo', 'Clear', 'Shape', 'Upgrade', 'Sweep', 'Swap']);
  });

  it('starts a game with 3 Undos and none of the others', () => {
    expect(startCharges()).toEqual({ undo: UNDO_START, clear: 0, anyShape: 0, upgrade: 0, sweep: 0, swap: 0 });
  });

  it('gives every power-up that is armed a hint and a color, and Undo neither', () => {
    for (const p of POWER_UPS) {
      expect(!!p.hint).toBe(p.id !== 'undo');
      expect(!!p.armedClass).toBe(p.id !== 'undo');
      expect(p.start).toBeLessThanOrEqual(p.max);
    }
  });

  it('has Clear, Upgrade, Sweep and Swap used by tapping the board', () => {
    expect(POWER_UPS.filter(p => p.tap).map(p => p.id)).toEqual(['clear', 'upgrade', 'sweep', 'swap']);
  });
});

describe('earnCharges', () => {
  const held = startCharges();

  it('adds what a move earns, with a message for each', () => {
    const { charges, messages } = earnCharges(held, undefined, {
      ...quiet,
      merges: [{ into: 0, from: [1, 2], sum: 9 }, { into: 0, from: [3, 4], sum: 27 }],
      highestAfter: 27,
    }, valueLabel);
    expect(charges).toMatchObject({ undo: 5, clear: 1 });
    expect(messages).toEqual(['New letter D! +2 Undo.', 'Chain! +1 Clear.']);
  });

  it('holds each at its cap, saying so when nothing was gained', () => {
    const ctx = { ...quiet, scoreBefore: 490, scoreAfter: 510 };
    expect(earnCharges({ ...held, swap: 3 }, undefined, ctx, valueLabel)).toEqual({
      charges: { ...held, swap: 3 }, messages: ['500 points! Swaps full (3).'],
    });
    expect(earnCharges({ ...held, swap: 2 }, undefined, ctx, valueLabel).messages).toEqual(['500 points! +1 Swap.']);
  });

  it('takes off the charge spent first, and leaves the input unchanged', () => {
    const before = { ...held, sweep: 2 };
    expect(earnCharges(before, 'sweep', quiet, valueLabel)).toEqual({ charges: { ...held, sweep: 1 }, messages: [] });
    expect(before.sweep).toBe(2);
  });

  it('earns Any shape for suns and stars, naming each', () => {
    expect(earnCharges(held, undefined, { ...quiet, completed: ['star'] }, valueLabel).messages).toEqual(['Star! +2 Any shape.']);
  });
});

describe('power-ups used on the board', () => {
  const use = (id: 'clear' | 'upgrade' | 'sweep' | 'swap') => powerUp(id).tap!;

  it('Clear empties a letter or #, outlining it first', () => {
    const cells: Cell[] = [3, EMPTY, 0];
    expect(use('clear').canUse(line, cells, 1, -1)).toBe(false);
    expect(use('clear').doomed!(line, cells, 0)).toEqual([0]);
    expect(use('clear').apply(line, cells, 2, -1)).toEqual({ cells: [3, EMPTY, EMPTY], merges: [] });
    expect(use('clear').lead(line, cells, 2, -1, 1, valueLabel)).toBe('Cleared #. 0 Clears left.');
  });

  it('Sweep clears the #s on and beside a tile, counting them', () => {
    const cells: Cell[] = [0, 3, 0];
    expect(use('sweep').doomed!(line, cells, 1)).toEqual([0, 2]);
    expect(use('sweep').apply(line, cells, 1, -1).cells).toEqual([EMPTY, 3, EMPTY]);
    expect(use('sweep').lead(line, cells, 1, -1, 3, valueLabel)).toBe('Swept 2 #s. 2 Sweeps left.');
    expect(use('sweep').lead(line, cells, 0, -1, 2, valueLabel)).toBe('Swept 1 #. 1 Sweep left.');
  });

  it('Upgrade raises a letter and previews it', () => {
    const cells: Cell[] = [1, EMPTY, 0];
    expect(use('upgrade').canUse(line, cells, 2, -1)).toBe(false);
    expect(use('upgrade').apply(line, cells, 0, -1).cells[0]).toBe(3);
    expect(use('upgrade').lead(line, cells, 0, -1, 1, valueLabel)).toBe('Upgraded A to B.');
    expect(use('upgrade').preview!(line, cells, 0, -1).value).toBe(3);
  });

  it('Swap picks a filled tile first, then swaps it with one holding something else', () => {
    const cells: Cell[] = [1, 3, EMPTY];
    expect(use('swap').canPick!(cells, 0)).toBe(true);
    expect(use('swap').canPick!(cells, 2)).toBe(false);
    expect(use('swap').canUse(line, cells, 1, -1)).toBe(false);
    expect(use('swap').canUse(line, cells, 1, 0)).toBe(true);
    expect(use('swap').apply(line, cells, 1, 0).cells).toEqual([3, 1, EMPTY]);
    expect(use('swap').lead(line, cells, 1, 0, 1, valueLabel)).toBe('Swapped A and B.');
    expect(powerUp('swap').hint!(0, cells, valueLabel)).toBe('Swap: now tap a tile holding something other than A to swap it with.');
  });
});

describe('arming power-ups', () => {
  it('arms a power-up when none is armed', () => {
    expect(toggleArmed(null, 'clear')).toBe('clear');
  });

  it('disarms the armed power-up when it is tapped again', () => {
    expect(toggleArmed('swap', 'swap')).toBeNull();
  });

  it('arming one disarms the other, so at most one is armed', () => {
    expect(toggleArmed('upgrade', 'sweep')).toBe('sweep');
    expect(toggleArmed('anyShape', 'clear')).toBe('clear');
  });
});
