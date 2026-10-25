// How values are written. Under the sum merge rule they are plain
// numbers. Under the power-of-3 rules (Q11) each rung of the ladder gets a
// letter, 1 = A, 3 = B, 9 = C ... 3^25 = Z, and 0 is #. A number that isn't
// a power of 3 (left on the board from before switching rules) stays a
// number.

import { TOP_VALUE, WILD, type Options } from './rules';

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const ZERO_LABEL = '#';

export const usesLetters = (options: Options) => options.merge !== 'sum';

// The exponent of `n` if it is a power of 3 (1 -> 0, 3 -> 1, 9 -> 2), else -1.
const log3 = (n: number) => {
  let e = 0;
  for (let p = 1; p <= n; p *= 3, e++) if (p === n) return e;
  return -1;
};

// The smallest power of 3 not below `n` (1 for n <= 1).
export const ceilPow3 = (n: number) => {
  let p = 1;
  while (p < n) p *= 3;
  return p;
};

// How a value (or the wildcard) is written.
export const valueLabel = (value: number, options: Options) => {
  if (value === WILD) return '★';
  if (!usesLetters(options)) return String(value);
  if (value === 0) return ZERO_LABEL;
  const e = log3(value);
  return e >= 0 && e < LETTERS.length ? LETTERS[e] : String(value);
};

// How the target goal is written: under letters, the first rung that
// reaches it (a target of 20 is reached by D, 27).
export const targetLabel = (target: number, options: Options) =>
  usesLetters(options) ? valueLabel(ceilPow3(target), options) : String(target);

// The letter that wins the game under the power-of-3 rules
export const TOP_LABEL = LETTERS[LETTERS.length - 1];
export { TOP_VALUE };
