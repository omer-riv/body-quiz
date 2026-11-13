// A round: its questions and its score. Nothing here touches the screen.
import { shuffle, type Rng } from './rng';
import { MAX_SPEED_BONUS, speedBonus } from './scoring';
import type { Entry } from './structures';

export type ModeId = 'explore' | 'find' | 'name';
export const MODE_NAMES: Record<ModeId, string> = { explore: 'Explore', find: 'Find It', name: 'Name It' };

export const ROUND_LENGTH = 10;
export const OPTIONS = 4;
/** Find It: the points for getting it on the first, second and third tap. */
export const FIND_POINTS = [100, 60, 30];
export const NAME_POINTS = 100;
/** The most one question can be worth: right the first time, in no time at all. */
export const maxPoints = (mode: ModeId) => (mode === 'find' ? FIND_POINTS[0] : NAME_POINTS) + MAX_SPEED_BONUS;

export interface Question {
  target: Entry;
  /** Name It: the names to choose from, the target's among them. */
  options: Entry[];
}

/** Decoys from the target's own system where there are enough, so "Femur" isn't offered next to "Liver". */
export function pickOptions(target: Entry, pool: readonly Entry[], rng: Rng, count = OPTIONS): Entry[] {
  const others = pool.filter((e) => e.name !== target.name);
  const near = shuffle(others.filter((e) => e.system === target.system), rng);
  const far = shuffle(others.filter((e) => e.system !== target.system), rng);
  return shuffle([target, ...[...near, ...far].slice(0, count - 1)], rng);
}

export function pickQuestions(pool: readonly Entry[], rng: Rng, length = ROUND_LENGTH): Question[] {
  return shuffle(pool, rng)
    .slice(0, length)
    .map((target) => ({ target, options: pickOptions(target, pool, rng) }));
}

/** A battle's questions: the round's own, and the sudden-death ones for a tie. */
export interface BattlePlan {
  main: Question[];
  tiebreak: Question[];
}

/**
 * The questions of a battle, the same for every player with the same seed.
 * The tiebreak questions are ones the round didn't ask, while the pool has
 * them; a small pool (Brain at Easy has 6 structures) starts over.
 */
export function battlePlan(pool: readonly Entry[], rng: Rng, tiebreaks: number, length = ROUND_LENGTH): BattlePlan {
  const main = shuffle(pool, rng).slice(0, length);
  const spare = shuffle(pool.filter((e) => !main.includes(e)), rng);
  const again = shuffle(main, rng);
  const ask = (target: Entry): Question => ({ target, options: pickOptions(target, pool, rng) });
  return { main: main.map(ask), tiebreak: [...spare, ...again].slice(0, tiebreaks).map(ask) };
}

export interface Result {
  target: Entry;
  /** What the question scored, speed bonus included. */
  points: number;
  /** The part of the points that was for speed. */
  bonus: number;
  /** How many wrong answers came first. */
  misses: number;
}

export type Outcome = 'correct' | 'wrong' | 'out';

export class Round {
  index = 0;
  score = 0;
  misses = 0;
  results: Result[] = [];

  constructor(readonly mode: ModeId, readonly questions: Question[]) {}

  get question(): Question | undefined {
    return this.questions[this.index];
  }
  get done(): boolean {
    return this.index >= this.questions.length;
  }
  get maxScore(): number {
    return this.questions.length * maxPoints(this.mode);
  }
  /** Every question right the first time, however long it took. */
  get flawless(): boolean {
    return this.done && this.results.every((r) => r.points > 0 && r.misses === 0);
  }
  /** Whether the current question has been answered and waits for next(). */
  get resolved(): boolean {
    return this.results.length > this.index;
  }

  /**
   * An answer by name, `ms` after the question appeared; without a time there
   * is no speed bonus. 'out' is a wrong answer that ends the question.
   */
  answer(name: string | null, ms = Infinity): Outcome {
    const question = this.question;
    if (!question || this.resolved || this.mode === 'explore') return 'out';
    if (name === question.target.name) {
      const points = this.mode === 'find' ? (FIND_POINTS[this.misses] ?? 0) : NAME_POINTS;
      this.resolve(points, points ? speedBonus(this.mode, ms) : 0);
      return 'correct';
    }
    this.misses++;
    const tries = this.mode === 'find' ? FIND_POINTS.length : 1;
    if (this.misses < tries) return 'wrong';
    this.resolve(0);
    return 'out';
  }

  /** Give up on the question. */
  skip(): void {
    if (this.question && !this.resolved) this.resolve(0);
  }

  private resolve(points: number, bonus = 0): void {
    this.score += points + bonus;
    this.results.push({ target: this.question!.target, points: points + bonus, bonus, misses: this.misses });
  }

  next(): void {
    if (!this.resolved) return;
    this.index++;
    this.misses = 0;
  }
}
