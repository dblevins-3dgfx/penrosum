import { describe, expect, it } from 'vitest';
import { termsFor } from '../skin';
import starForge from './star-forge';

describe('Star forge', () => {
  const terms = termsFor(starForge);

  it('climbs the first 34 elements in order of atomic number, hydrogen to selenium', () => {
    expect(starForge.pieces.map(p => p.glyph).join(' ')).toBe(
      'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se',
    );
    expect(starForge.pieces[0].name).toBe('hydrogen');
    expect(starForge.pieces[25].name).toBe('iron');
    expect(starForge.pieces[33].name).toBe('selenium');
    expect(starForge.rubble).toMatchObject({ glyph: 'e⁺', name: 'positron' });
    expect(starForge.pictures).toBe(false);
  });

  it('colors each family alike: the noble gases, the alkali metals and the halogens', () => {
    const fill = (symbol: string) => starForge.palette.rungFills[starForge.pieces.findIndex(p => p.glyph === symbol)];
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
      return r > g && r > b ? 'red' : g >= r && g >= b ? 'green' : 'blue';
    };
    // Violet (more blue than green), red, and yellow (red and green) families
    for (const s of ['He', 'Ne', 'Ar']) expect(hue(fill(s))).not.toBe('green');
    for (const s of ['Li', 'Na', 'K']) expect(hue(fill(s))).toBe('red');
    for (const s of ['F', 'Cl']) expect(fill(s).slice(1, 3)).toMatch(/^f/);
  });

  it('marks iron, where an ordinary star\'s fusion stops, apart from the other transition metals', () => {
    const fills = starForge.palette.rungFills;
    expect(fills[25]).toBe('#7c2d12');
    for (const i of [20, 21, 22, 23, 24, 26, 27, 28, 29]) expect(fills[i]).not.toBe(fills[25]);
  });

  it('speaks of elements and antimatter, with "an", and of a star\'s forge', () => {
    expect(terms.aPiece).toBe('an element');
    expect(terms.title(3)).toBe('He helium, 2 of 34');
    expect(terms.ladder).toBe("a star's forge");
    expect(terms.rubble(1)).toBe('an e⁺');
    expect(terms.rubble(3)).toBe('3 e⁺');
    expect(terms.rubbleCount(2)).toBe('2 e⁺');
    expect(terms.title(0)).toBe('e⁺ positron, rubble');
  });
});
