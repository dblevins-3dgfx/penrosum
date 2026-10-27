// The power-ups that wait for a tap (or, for Any shape, the next
// placement) once armed. At most one is armed at a time, so the armed one
// is a single value: one of these, or null for none.
export type ArmedPowerUp = 'clear' | 'anyShape' | 'upgrade' | 'sweep' | 'swap';

// The power-up armed after tapping `tapped` in the tray: tapping the armed
// one disarms it, and tapping another arms that one instead (disarming the
// one that was armed).
export const toggleArmed = (armed: ArmedPowerUp | null, tapped: ArmedPowerUp): ArmedPowerUp | null =>
  armed === tapped ? null : tapped;
