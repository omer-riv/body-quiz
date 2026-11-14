import { describe, expect, it } from 'vitest';
import { FIND_POINTS, OPTIONS, Round, maxPoints, pickOptions, pickQuestions } from '../src/game';
import { MAX_SPEED_BONUS, speedBonus } from '../src/scoring';
import { makeRng } from '../src/rng';
import type { Entry } from '../src/structures';

const pool: Entry[] = [
  ...['Femur', 'Skull', 'Ribs', 'Spine', 'Tibia', 'Fibula'].map((name) => ({ name, system: 'skeleton' as const, parts: [name] })),
  ...['Heart', 'Liver', 'Lungs', 'Stomach', 'Kidneys', 'Bladder'].map((name) => ({ name, system: 'organs' as const, parts: [name] })),
];

describe('questions', () => {
  it('are the same for the same seed, and differ between seeds', () => {
    const order = (seed: number) => pickQuestions(pool, makeRng(seed)).map((q) => q.target.name + ':' + q.options.map((o) => o.name));
    expect(order(7)).toEqual(order(7));
    expect(order(7)).not.toEqual(order(8));
  });

  it('ask about each structure once', () => {
    const targets = pickQuestions(pool, makeRng(1)).map((q) => q.target.name);
    expect(targets.length).toBe(10);
    expect(new Set(targets).size).toBe(10);
  });

  it('offer the answer among decoys of its own system', () => {
    for (let seed = 0; seed < 20; seed++) {
      const options = pickOptions(pool[0], pool, makeRng(seed));
      expect(options.length).toBe(OPTIONS);
      expect(options).toContain(pool[0]);
      expect(new Set(options.map((o) => o.name)).size).toBe(OPTIONS);
      expect(options.every((o) => o.system === 'skeleton')).toBe(true);
    }
  });

  it('fill up from other systems when a system is small', () => {
    const small = [pool[0], pool[1], ...pool.slice(6)];
    expect(pickOptions(pool[0], small, makeRng(1)).length).toBe(OPTIONS);
  });
});

describe('a Find It round', () => {
  const round = () => new Round('find', pickQuestions(pool, makeRng(3), 3));

  it('pays less for each miss, and nothing after the last try', () => {
    const r = round();
    expect(r.answer(r.question!.target.name)).toBe('correct');
    expect(r.score).toBe(FIND_POINTS[0]);
    r.next();
    expect(r.answer('nope')).toBe('wrong');
    expect(r.answer(r.question!.target.name)).toBe('correct');
    expect(r.score).toBe(FIND_POINTS[0] + FIND_POINTS[1]);
    r.next();
    expect(r.answer('a')).toBe('wrong');
    expect(r.answer(null)).toBe('wrong');
    expect(r.answer('c')).toBe('out');
    expect(r.results[2]).toMatchObject({ points: 0, misses: 3 });
    r.next();
    expect(r.done).toBe(true);
    expect(r.maxScore).toBe(3 * (FIND_POINTS[0] + MAX_SPEED_BONUS));
    expect(r.flawless).toBe(false);
  });

  it('takes one answer per question, and waits for next()', () => {
    const r = round();
    const first = r.question!.target.name;
    r.answer(first);
    expect(r.resolved).toBe(true);
    expect(r.answer(first)).toBe('out');
    expect(r.score).toBe(FIND_POINTS[0]);
    expect(r.index).toBe(0);
  });

  it('can be given up on', () => {
    const r = round();
    r.skip();
    expect(r.resolved).toBe(true);
    expect(r.score).toBe(0);
  });
});

describe('a Name It round', () => {
  it('gives one try', () => {
    const r = new Round('name', pickQuestions(pool, makeRng(3), 2));
    expect(r.answer('nope')).toBe('out');
    r.next();
    expect(r.answer(r.question!.target.name)).toBe('correct');
    expect(r.score).toBe(100);
  });
});

describe('the speed bonus', () => {
  it('shrinks steadily from the whole bonus to nothing', () => {
    expect(speedBonus('find', 0)).toBe(MAX_SPEED_BONUS);
    expect(speedBonus('find', 10_000)).toBe(MAX_SPEED_BONUS / 2);
    expect(speedBonus('find', 20_000)).toBe(0);
    expect(speedBonus('find', 60_000)).toBe(0);
    expect(speedBonus('name', 5_000)).toBe(MAX_SPEED_BONUS / 2);
    expect(speedBonus('name', -50)).toBe(MAX_SPEED_BONUS);
    // Working out which structure a function belongs to gets the longest.
    expect(speedBonus('function', 12_500)).toBe(MAX_SPEED_BONUS / 2);
  });

  it('is added to a right answer, on any try, and never to a wrong one', () => {
    const r = new Round('find', pickQuestions(pool, makeRng(3), 3));
    r.answer(r.question!.target.name, 0);
    expect(r.results[0]).toMatchObject({ points: maxPoints('find'), bonus: MAX_SPEED_BONUS, misses: 0 });
    r.next();
    r.answer('nope', 1000);
    r.answer(r.question!.target.name, 10_000);
    expect(r.results[1]).toMatchObject({ points: FIND_POINTS[1] + 25, bonus: 25 });
    r.next();
    r.skip();
    expect(r.results[2]).toMatchObject({ points: 0, bonus: 0 });
    expect(r.score).toBe(maxPoints('find') + FIND_POINTS[1] + 25);
  });

  it('makes a round flawless by what was known, not by how fast', () => {
    const r = new Round('name', pickQuestions(pool, makeRng(3), 2));
    r.answer(r.question!.target.name, 60_000);
    r.next();
    r.answer(r.question!.target.name, 0);
    r.next();
    expect(r.flawless).toBe(true);
    expect(r.score).toBe(200 + MAX_SPEED_BONUS);
    expect(r.maxScore).toBe(2 * maxPoints('name'));
  });
});

describe('Find by Function', () => {
  it('is scored like Find It: three tries, for less each time', () => {
    const r = new Round('function', pickQuestions(pool, makeRng(5), 2));
    expect(r.answer('nope')).toBe('wrong');
    expect(r.answer('nope')).toBe('wrong');
    expect(r.answer(r.question!.target.name)).toBe('correct');
    expect(r.score).toBe(FIND_POINTS[2]);
    r.next();
    r.answer(r.question!.target.name, 0);
    expect(r.score).toBe(FIND_POINTS[2] + maxPoints('function'));
    expect(maxPoints('function')).toBe(maxPoints('find'));
  });
});
