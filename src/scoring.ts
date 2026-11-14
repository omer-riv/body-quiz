// The speed bonus: extra points for answering fast. Kept free of DOM code, for
// the tests and for the Worker, which checks scores against the most a round
// can reach.

/** The most a fast answer adds to a question's points. */
export const MAX_SPEED_BONUS = 50;

/**
 * Seconds after which a right answer gets no bonus. Before that the bonus
 * shrinks steadily from the moment the question appears, a point every few
 * tenths of a second, so two rounds rarely tie. Finding a structure can mean
 * turning the body and taking layers off, which takes longer than reading
 * four names, and working out which structure a function belongs to takes
 * longer again.
 */
const SPEED_WINDOWS = { find: 20, name: 10, function: 25 };

/** The bonus for a right answer given `ms` after the question appeared. */
export function speedBonus(mode: keyof typeof SPEED_WINDOWS, ms: number): number {
  const seconds = Math.max(0, ms) / 1000;
  return Math.max(0, Math.round(MAX_SPEED_BONUS * (1 - seconds / SPEED_WINDOWS[mode])));
}
