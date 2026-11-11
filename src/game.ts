// A round: its questions and its score. Nothing here touches the screen.
import { shuffle, type Rng } from './rng';
import type { Entry } from './structures';

export type ModeId = 'explore' | 'find' | 'name';
export const MODE_NAMES: Record<ModeId, string> = { explore: 'Explore', find: 'Find It', name: 'Name It' };

export const ROUND_LENGTH = 10;
export const OPTIONS = 4;
/** Find It: the points for getting it on the first, second and third tap. */
export const FIND_POINTS = [100, 60, 30];
export const NAME_POINTS = 100;

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

export interface Result {
  target: Entry;
  points: number;
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
    return this.questions.length * (this.mode === 'find' ? FIND_POINTS[0] : NAME_POINTS);
  }
  /** Whether the current question has been answered and waits for next(). */
  get resolved(): boolean {
    return this.results.length > this.index;
  }

  /** An answer by name. 'out' is a wrong answer that ends the question. */
  answer(name: string | null): Outcome {
    const question = this.question;
    if (!question || this.resolved) return 'out';
    if (name === question.target.name) {
      const points = this.mode === 'find' ? (FIND_POINTS[this.misses] ?? 0) : NAME_POINTS;
      this.resolve(points);
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

  private resolve(points: number): void {
    this.score += points;
    this.results.push({ target: this.question!.target, points, misses: this.misses });
  }

  next(): void {
    if (!this.resolved) return;
    this.index++;
    this.misses = 0;
  }
}
