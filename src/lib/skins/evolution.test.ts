import { describe, expect, it } from 'vitest';
import { termsFor } from '../skin';
import evolution from './evolution';

describe('Evolution', () => {
  const terms = termsFor(evolution);

  it('climbs from a microbe to a human, with fossil bones for rubble', () => {
    expect(evolution.pieces[0]).toMatchObject({ glyph: '🦠', name: 'microbe' });
    expect(evolution.pieces).toHaveLength(18);
    expect(evolution.pieces[6]).toMatchObject({ glyph: '🦈', name: 'shark' });
    expect(evolution.pieces[17]).toMatchObject({ glyph: '🧑', name: 'human' });
    expect(evolution.rubble).toMatchObject({ glyph: '🦴', name: 'bone' });
    expect(evolution.pictures).toBe(true);
  });

  it('runs its fills from the sea to a gold human', () => {
    expect(evolution.palette.rungFills[0]).toBe('#d8f3ef');
    expect(evolution.palette.rungFills[17]).toBe('#eab308');
  });

  it('speaks of creatures and evolution', () => {
    expect(terms.piece).toBe('creature');
    expect(terms.ladder).toBe('evolution');
    expect(terms.title(3 ** 6)).toBe('🦈 shark, 7 of 18');
    expect(terms.title(0)).toBe('🦴 bone, rubble');
  });
});
