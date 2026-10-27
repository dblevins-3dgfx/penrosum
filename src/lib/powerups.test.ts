import { describe, expect, it } from 'vitest';
import { toggleArmed } from './powerups';

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
