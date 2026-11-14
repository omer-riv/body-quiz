import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MODE_NAMES, Round, pickQuestions, type ModeId } from '../src/game';
import {
  BOARD_SIZE, BOARD_SYSTEMS, LEVELS, RANKED_MODES,
  categoryFor, cleanName, maxScore, nameKey, parseCategory, periodStart, roundLength, scoresViewFor, systemsFor, wouldPlace,
  type Boards, type Entry, type Placement,
} from '../src/leaderboard';
import { makeRng } from '../src/rng';
import { bestKey } from '../src/settings';
import { SYSTEMS, entries, type PartInfo } from '../src/structures';
import worker, { type Env } from '../worker/index';

const parts: PartInfo[] = JSON.parse(readFileSync('public/body/manifest.json', 'utf8')).parts;

describe('categoryFor and parseCategory', () => {
  it('accepts every ranked round the menu can start, and nothing else', () => {
    // The menu offers every mode with every level, on the systems the mode is played on.
    expect(BOARD_SYSTEMS).toEqual(['all', ...SYSTEMS]);
    for (const mode of Object.keys(MODE_NAMES) as ModeId[]) {
      for (const system of BOARD_SYSTEMS) {
        for (const level of LEVELS) {
          const category = categoryFor({ mode, system, level });
          if (mode === 'explore' || !systemsFor(mode).includes(system)) {
            expect(category).toBeNull();
            expect(parseCategory(`${mode}:${system}:${level}`)).toBeNull();
          } else {
            expect(parseCategory(category!), category!).toEqual({ mode, system, level });
            // The personal best in the browser is kept under the same name.
            expect(category).toBe(bestKey({ mode, system, level }));
          }
        }
      }
    }
    expect(RANKED_MODES).toEqual(['find', 'name', 'function']);
  });

  it('plays Find by Function on the brain alone, where every structure has a clue', () => {
    expect(systemsFor('function')).toEqual(['brain']);
    expect(systemsFor('find')).toEqual(BOARD_SYSTEMS);
    expect(parseCategory('function:brain:3')).toEqual({ mode: 'function', system: 'brain', level: 3 });
    expect(parseCategory('function:all:3')).toBeNull();
    // The high scores screen opens on a table the mode has.
    expect(scoresViewFor({ mode: 'function', system: 'organs', level: 2 })).toEqual({ mode: 'function', system: 'brain', level: 2 });
  });

  it('rejects made-up categories', () => {
    for (const bad of ['', 'find', 'find:all', 'explore:all:1', 'find:nerves:1', 'find:all:0', 'find:all:4', 'find:all:1.0', 'find:all:01', 'find:all:', 'constructor:all:1', 'find:all:1:x']) {
      expect(parseCategory(bad), bad).toBeNull();
    }
  });

  it('opens the high scores screen on the round picked, or on Find It from Explore', () => {
    expect(scoresViewFor({ mode: 'name', system: 'brain', level: 2 })).toEqual({ mode: 'name', system: 'brain', level: 2 });
    expect(scoresViewFor({ mode: 'explore', system: 'organs', level: 3 })).toEqual({ mode: 'find', system: 'organs', level: 3 });
  });
});

describe('maxScore', () => {
  it('is what a flawless round scores, for every round the game deals', () => {
    for (const level of LEVELS) {
      const all = entries(parts, level);
      for (const system of BOARD_SYSTEMS) {
        const pool = system === 'all' ? all : all.filter((e) => e.system === system);
        const questions = pickQuestions(pool, makeRng(1));
        expect(roundLength(system, level), `${system} at ${level}`).toBe(questions.length);
        for (const mode of RANKED_MODES) {
          if (!systemsFor(mode).includes(system)) continue;
          expect(maxScore({ mode, system, level })).toBe(new Round(mode, questions).maxScore);
        }
      }
    }
  });

  it('is lower for a round shorter than 10: Brain at Easy has 6 questions', () => {
    expect(maxScore({ mode: 'find', system: 'brain', level: 1 })).toBe(900);
    expect(maxScore({ mode: 'function', system: 'brain', level: 1 })).toBe(900);
    expect(maxScore({ mode: 'name', system: 'all', level: 1 })).toBe(1500);
  });
});

describe('names', () => {
  it('trims, collapses spaces, drops control characters and caps the length', () => {
    expect(cleanName('  Ada \n  Lovelace\u0000 ')).toBe('Ada Lovelace');
    expect(cleanName('x'.repeat(50))).toHaveLength(20);
    expect(cleanName('‏\u0007')).toBe('');
    expect(cleanName('דנה')).toBe('דנה');
  });

  it('treats case and width as the same player', () => {
    expect(nameKey(' ADA ')).toBe(nameKey('ada'));
    expect(nameKey('ＡＤＡ')).toBe(nameKey('ada'));
  });
});

describe('periodStart', () => {
  it('starts weeks on Monday and months on the 1st, at midnight UTC', () => {
    const sat = Date.UTC(2026, 9, 24, 15, 30);
    expect(new Date(periodStart('week', sat)).toISOString()).toBe('2026-10-19T00:00:00.000Z');
    expect(new Date(periodStart('month', sat)).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(periodStart('all', sat)).toBe(0);
    // A Monday is its own week; a Sunday belongs to the week before, even across a month.
    expect(new Date(periodStart('week', Date.UTC(2026, 9, 19))).toISOString()).toBe('2026-10-19T00:00:00.000Z');
    expect(new Date(periodStart('week', Date.UTC(2026, 10, 1, 23))).toISOString()).toBe('2026-10-26T00:00:00.000Z');
  });
});

describe('wouldPlace', () => {
  const scored = (scores: number[]): Entry[] => scores.map((score, i) => ({ id: i, name: `p${i}`, score, at: 0 }));

  it('places anything positive on a table with room', () => {
    expect(wouldPlace([], 1)).toBe(true);
    expect(wouldPlace([], 0)).toBe(false);
  });

  it('needs to beat the last entry on a full table', () => {
    const full = scored(Array.from({ length: BOARD_SIZE }, (_, i) => 1000 - i * 10));
    expect(wouldPlace(full, 910)).toBe(false);
    expect(wouldPlace(full, 911)).toBe(true);
  });
});

/** D1, as far as the Worker uses it, on top of an in-memory SQLite. */
function fakeD1() {
  const db = new DatabaseSync(':memory:');
  const statement = (sql: string, params: unknown[] = []) => ({
    bind: (...values: unknown[]) => statement(sql, values),
    all: async () => ({ results: db.prepare(sql).all(...(params as never[])) }),
    first: async () => db.prepare(sql).get(...(params as never[])) ?? null,
  });
  return {
    db,
    prepare: (sql: string) => statement(sql),
    batch: async (statements: ReturnType<typeof statement>[]) => Promise.all(statements.map((s) => s.all())),
  };
}

describe('the scores Worker', () => {
  const d1 = fakeD1();
  const env = { DB: d1, ASSETS: { fetch: async () => new Response('the game') } } as unknown as Env;
  const category = 'find:skeleton:1';
  const get = async (c = category) => {
    const res = await worker.fetch(new Request(`https://game.test/api/scores?category=${encodeURIComponent(c)}`), env);
    return { status: res.status, body: (await res.json()) as Boards };
  };
  const post = async (body: unknown) => {
    const res = await worker.fetch(new Request('https://game.test/api/scores', { method: 'POST', body: JSON.stringify(body) }), env);
    return { status: res.status, body: (await res.json()) as Placement };
  };

  it('serves the game for everything else', async () => {
    const res = await worker.fetch(new Request('https://game.test/'), env);
    expect(await res.text()).toBe('the game');
  });

  it('starts with empty tables', async () => {
    expect(await get()).toEqual({ status: 200, body: { week: [], month: [], all: [] } });
  });

  it('stores scores and says where they landed', async () => {
    const first = await post({ category, name: ' Ada ', score: 700 });
    expect(first.status).toBe(201);
    expect(first.body.ranks).toEqual({ week: 1, month: 1, all: 1 });
    expect(first.body.boards.week[0]).toMatchObject({ id: first.body.id, name: 'Ada', score: 700 });

    const second = await post({ category, name: 'Grace', score: 860 });
    expect(second.body.ranks).toEqual({ week: 1, month: 1, all: 1 });
    expect(second.body.boards.all.map((e) => e.name)).toEqual(['Grace', 'Ada']);
  });

  it('lets a player hold several places, earliest first on a tie', async () => {
    const lower = await post({ category, name: 'ada', score: 500 });
    expect(lower.body.ranks).toEqual({ week: 3, month: 3, all: 3 });
    const higher = await post({ category, name: 'ADA', score: 1000 });
    expect(higher.body.ranks.all).toBe(1);
    const tie = await post({ category, name: 'Lin', score: 860 });
    expect(tie.body.boards.all.map((e) => [e.name, e.score])).toEqual([['ADA', 1000], ['Grace', 860], ['Lin', 860], ['Ada', 700], ['ada', 500]]);
  });

  it('keeps tables apart and caps them at the board size', async () => {
    const other = 'name:all:3';
    for (let i = 0; i < BOARD_SIZE + 3; i++) await post({ category: other, name: `p${i}`, score: 100 + i });
    const { body } = await get(other);
    expect(body.all).toHaveLength(BOARD_SIZE);
    expect(body.all[0].score).toBe(100 + BOARD_SIZE + 2);
    expect((await get()).body.all).toHaveLength(5);
  });

  it('leaves old scores off this week and this month', async () => {
    const old = 'name:muscles:2';
    await post({ category: old, name: 'Then', score: 900 });
    d1.db.prepare('UPDATE scores SET created_at = ? WHERE category = ?').run(Date.UTC(2020, 0, 1), old);
    const now = await post({ category: old, name: 'Now', score: 400 });
    expect(now.body.ranks).toEqual({ week: 1, month: 1, all: 2 });
    expect(now.body.boards.week.map((e) => e.name)).toEqual(['Now']);
    expect(now.body.boards.all.map((e) => e.name)).toEqual(['Then', 'Now']);
  });

  it('takes a score up to the round’s maximum and no more', async () => {
    // Brain at Easy has 6 questions, so 900 is the most there.
    expect((await post({ category: 'find:brain:1', name: 'x', score: 900 })).status).toBe(201);
    expect((await post({ category: 'find:brain:1', name: 'x', score: 910 })).status).toBe(400);
    expect((await post({ category: 'find:brain:2', name: 'x', score: 1500 })).status).toBe(201);
    expect((await post({ category: 'find:brain:2', name: 'x', score: 1501 })).status).toBe(400);
  });

  it('turns away bad submissions', async () => {
    for (const body of [
      { category: 'explore:all:1', name: 'x', score: 10 },
      { category, name: '   ', score: 10 },
      { category, name: 7, score: 10 },
      { category, name: 'x', score: 0 },
      { category, name: 'x', score: -10 },
      { category, name: 'x', score: 10.5 },
      { category, name: 'x', score: '10' },
      { name: 'x', score: 10 },
      null,
    ]) {
      expect((await post(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await get('nope')).status).toBe(400);
    const res = await worker.fetch(new Request('https://game.test/api/scores', { method: 'POST', body: 'not json' }), env);
    expect(res.status).toBe(400);
    const put = await worker.fetch(new Request('https://game.test/api/scores', { method: 'PUT' }), env);
    expect(put.status).toBe(405);
  });

  it('answers 500, not a crash, when the database fails', async () => {
    const broken = { DB: { prepare: () => ({}), batch: async () => Promise.reject(new Error('down')) }, ASSETS: env.ASSETS } as unknown as Env;
    const res = await worker.fetch(new Request(`https://game.test/api/scores?category=${category}`), broken);
    expect(res.status).toBe(500);
  });
});
