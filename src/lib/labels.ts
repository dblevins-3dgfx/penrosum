// How values are written: each rung of the ladder of powers of 3 is a
// letter, 1 = A, 3 = B, 9 = C ... 3^25 = Z, and 0 is #. A number that isn't
// a power of 3 (none arises in play) would be written as a number.

import { TOP_VALUE, WILD, type Drawn } from './rules';

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const ZERO_LABEL = '#';

// The exponent of `n` if it is a power of 3 (1 -> 0, 3 -> 1, 9 -> 2), else -1.
const log3 = (n: number) => {
  let e = 0;
  for (let p = 1; p <= n; p *= 3, e++) if (p === n) return e;
  return -1;
};

// How a value (or the wildcard) is written.
export const valueLabel = (value: Drawn) => {
  if (value === WILD) return '★';
  if (value === 0) return ZERO_LABEL;
  const e = log3(value);
  return e >= 0 && e < LETTERS.length ? LETTERS[e] : String(value);
};

// The letter that wins the game
export const TOP_LABEL = LETTERS[LETTERS.length - 1];
export { TOP_VALUE };
