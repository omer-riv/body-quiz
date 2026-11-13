import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN_MS, DONE_TTL_MS, GRACE_MS, LEAD_MS, LOBBY_TTL_MS, MAX_PLAYERS, MAX_QUESTION_POINTS, MAX_TIEBREAKS, REVEAL_MS,
  advance, answer, battleRound, canBattle, createBattle, defaultTimeout, expired, isBattleCode, join, leave, newBattleCode, nextWake,
  offerRematch, parseBattleSettings, rename, standings, startBattle, timeoutOptions, viewOf,
  type BattleSettings, type BattleState, type ClientMessage, type ServerMessage,
} from '../src/battle';
import { OPTIONS, Round, battlePlan, maxPoints } from '../src/game';
import { BOARD_SYSTEMS, LEVELS, RANKED_MODES, roundLength } from '../src/leaderboard';
import { makeRng } from '../src/rng';
import { entries, type PartInfo } from '../src/structures';
import { BattleRoom, parseCreate, type DurableObjectState } from '../worker/battle';
import worker, { withPreview, type Env } from '../worker/index';

const parts = (JSON.parse(readFileSync('public/body/manifest.json', 'utf8')) as { parts: PartInfo[] }).parts;

const SECRETS = ['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb', 'cccccccccccccccc', 'dddddddddddddddd', 'eeeeeeeeeeeeeeee', 'ffffffffffffffff', 'gggggggggggggggg'];
const [A, B, C] = SECRETS;
const base: BattleSettings = { mode: 'find', system: 'skeleton', level: 1, timeout: 20 };
/** Brain at Easy is the short round: 6 questions. */
const short: BattleSettings = { mode: 'name', system: 'brain', level: 1, timeout: 20 };

/** A battle with players A, B (and C) in the lobby, A hosting, at time 0. */
function lobby(settings: BattleSettings = base, players = 2): BattleState {
  const s = createBattle('ABCDEF', settings, 42, { secret: A, name: 'Dana' }, 0);
  for (let i = 1; i < players; i++) join(s, SECRETS[i], ['Omer', 'Noa', 'Tal', 'Gal', 'Ido', 'Max'][i - 1], 0);
  return s;
}
const ids = (s: BattleState) => new Set(s.players.map((p) => p.id));
const started = (players?: number, settings?: BattleSettings) => {
  const s = lobby(settings, players);
  startBattle(s, A, 0, ids(s));
  return s;
};

/** Plays every main question of a battle, each player scoring the same on every question; returns when the round ended. */
function playRound(s: BattleState, points: number[]): number {
  let now = s.q!.startsAt;
  for (let i = 0; i < s.total; i++) {
    now = s.q!.startsAt + 500;
    s.players.forEach((p, j) => answer(s, p.secret, { index: i, tiebreak: false, points: points[j] }, now));
    advance(s, now, ids(s));
    now = s.q!.revealUntil!;
    advance(s, now, ids(s));
  }
  return now;
}

describe('battle questions', () => {
  const poolFor = (s: Pick<BattleSettings, 'system' | 'level'>) => {
    const all = entries(parts, s.level);
    return s.system === 'all' ? all : all.filter((e) => e.system === s.system);
  };
  const names = (seed: number, s = base) => {
    const plan = battlePlan(poolFor(s), makeRng(seed), MAX_TIEBREAKS);
    return [...plan.main, ...plan.tiebreak].map((q) => `${q.target.name}:${q.options.map((o) => o.name)}`);
  };

  it('are the same for every player with the same seed, and differ between battles', () => {
    expect(names(7)).toEqual(names(7));
    expect(names(7)).not.toEqual(names(8));
  });

  it('are as many as the server counts, with tiebreak questions to spare, for every round that can be a battle', () => {
    for (const level of LEVELS) {
      for (const system of BOARD_SYSTEMS) {
        const plan = battlePlan(poolFor({ system, level }), makeRng(1), MAX_TIEBREAKS);
        expect(plan.main.length, `${system} at ${level}`).toBe(roundLength(system, level));
        expect(plan.tiebreak.length).toBe(MAX_TIEBREAKS);
        for (const q of [...plan.main, ...plan.tiebreak]) {
          expect(q.options).toContain(q.target);
          expect(q.options.length).toBe(OPTIONS);
        }
      }
    }
  });

  it('keep the tiebreak apart from the round where the pool has room, and start over where it has none', () => {
    const roomy = battlePlan(poolFor(base), makeRng(3), MAX_TIEBREAKS);
    const asked = new Set(roomy.main.map((q) => q.target.name));
    expect(roomy.tiebreak.some((q) => asked.has(q.target.name))).toBe(false);
    const tight = battlePlan(poolFor(short), makeRng(3), MAX_TIEBREAKS);
    expect(tight.main).toHaveLength(6);
    expect(new Set(tight.tiebreak.map((q) => q.target.name)).size).toBe(MAX_TIEBREAKS);
  });

  it('are never worth more than the server takes', () => {
    for (const mode of RANKED_MODES) {
      const r = new Round(mode, battlePlan(poolFor(base), makeRng(1), 0, 1).main);
      r.answer(r.question!.target.name, 0);
      expect(r.score).toBe(maxPoints(mode));
      expect(r.score).toBeLessThanOrEqual(MAX_QUESTION_POINTS);
    }
  });
});

describe('battle settings', () => {
  it('accept every round with a score, with a timeout from its mode’s list', () => {
    for (const mode of RANKED_MODES) {
      for (const system of BOARD_SYSTEMS) {
        for (const level of LEVELS) {
          const s = { mode, system, level, timeout: defaultTimeout(mode) };
          expect(canBattle(s)).toBe(true);
          expect(parseBattleSettings({ ...s, extra: 1 })).toEqual(s);
          expect(timeoutOptions(mode)).toContain(s.timeout);
        }
      }
    }
  });

  it('turn away Explore, rounds the game doesn’t have, and other timeouts', () => {
    expect(canBattle({ mode: 'explore', system: 'all', level: 1 })).toBe(false);
    expect(parseBattleSettings({ ...base, mode: 'explore' })).toBeNull();
    expect(parseBattleSettings({ ...base, system: 'nerves' })).toBeNull();
    expect(parseBattleSettings({ ...base, level: 4 })).toBeNull();
    expect(parseBattleSettings({ ...base, level: '1' })).toBeNull();
    expect(parseBattleSettings({ ...base, timeout: 7 })).toBeNull();
    expect(parseBattleSettings(null)).toBeNull();
  });

  it('are named in one line', () => {
    expect(battleRound(base)).toBe('Find It · Skeleton · Easy · 10 questions · 20 sec each');
    expect(battleRound({ ...short, timeout: 45 })).toBe('Name It · Brain · Easy · 6 questions · 45 sec each');
    expect(battleRound({ ...base, system: 'all', timeout: 60 })).toBe('Find It · Everything · Easy · 10 questions · 1 min each');
  });
});

describe('battle codes', () => {
  it('are six letters and digits that are hard to mix up', () => {
    const code = newBattleCode(makeRng(1));
    expect(isBattleCode(code)).toBe(true);
    expect(isBattleCode('ABC10O')).toBe(false);
    expect(isBattleCode('abcdef')).toBe(false);
  });
});

describe('the lobby', () => {
  it('makes the creator the host, and counts the round’s questions itself', () => {
    const s = lobby(base, 1);
    expect(s.players.map((p) => p.name)).toEqual(['Dana']);
    expect(s.host).toBe(s.players[0].id);
    expect(s.total).toBe(10);
    expect(lobby(short, 1).total).toBe(6);
  });

  it('takes up to six players, and knows a player who comes back', () => {
    const s = lobby(base, MAX_PLAYERS);
    expect(s.players).toHaveLength(MAX_PLAYERS);
    expect(join(s, SECRETS[6], 'Late', 0)).toEqual({ ok: false, error: 'full' });
    expect(join(s, B, 'Whatever', 0)).toEqual({ ok: true, id: s.players[1].id });
  });

  it('tells a second Dana apart', () => {
    const s = lobby(base, 1);
    join(s, B, 'dana', 0);
    expect(s.players[1].name).toBe('dana 2');
    rename(s, B, 'Omer', 0);
    expect(s.players[1].name).toBe('Omer');
  });

  it('needs a name', () => {
    expect(join(lobby(base, 1), B, '   ', 0)).toEqual({ ok: false, error: 'name' });
  });

  it('passes the host role on when the host leaves', () => {
    const s = lobby(base, 3);
    leave(s, A, 0);
    expect(s.players.map((p) => p.name)).toEqual(['Omer', 'Noa']);
    expect(s.host).toBe(s.players[0].id);
  });

  it('can only be started by the host, whenever they like', () => {
    const s = lobby(base, 1);
    expect(startBattle(s, B, 0, ids(s))).toBe(false);
    expect(startBattle(s, A, 0, ids(s))).toBe(true);
    expect(s.phase).toBe('playing');
    expect(s.q).toMatchObject({ index: 0, startsAt: COUNTDOWN_MS, endsAt: COUNTDOWN_MS + 20_000 });
  });

  it('drops players who left before the start, and lets no one in after', () => {
    const s = lobby(base, 3);
    startBattle(s, A, 0, new Set([s.players[0].id, s.players[1].id]));
    expect(s.players.map((p) => p.name)).toEqual(['Dana', 'Omer']);
    expect(join(s, C, 'Noa', 0)).toEqual({ ok: false, error: 'started' });
  });
});

describe('a battle in progress', () => {
  const t0 = COUNTDOWN_MS;

  it('counts each answer once, only for the question on screen, and only what a question can score', () => {
    const s = started();
    expect(answer(s, A, { index: 0, tiebreak: false, points: 150 }, t0 + 1000)).toBe(true);
    expect(answer(s, A, { index: 0, tiebreak: false, points: 150 }, t0 + 1100)).toBe(false);
    expect(answer(s, B, { index: 1, tiebreak: false, points: 100 }, t0 + 1100)).toBe(false);
    expect(answer(s, B, { index: 0, tiebreak: false, points: MAX_QUESTION_POINTS + 1 }, t0 + 1100)).toBe(false);
    expect(answer(s, B, { index: 0, tiebreak: false, points: 12.5 }, t0 + 1100)).toBe(false);
    expect(answer(s, B, { index: 0, tiebreak: false, points: 25 }, t0 + 30_000)).toBe(false);
    expect(s.players.map((p) => p.score)).toEqual([150, 0]);
  });

  it('moves on as soon as everyone connected has answered', () => {
    const s = started();
    answer(s, A, { index: 0, tiebreak: false, points: 100 }, t0 + 1000);
    expect(advance(s, t0 + 1000, ids(s))).toBe(false);
    answer(s, B, { index: 0, tiebreak: false, points: 0 }, t0 + 2000);
    advance(s, t0 + 2000, ids(s));
    expect(s.q?.revealUntil).toBe(t0 + 2000 + REVEAL_MS);
    advance(s, t0 + 2000 + REVEAL_MS, ids(s));
    expect(s.q).toMatchObject({ index: 1, revealUntil: null, startsAt: t0 + 2000 + REVEAL_MS + LEAD_MS });
  });

  it('does not wait for a player who dropped out', () => {
    const s = started();
    answer(s, A, { index: 0, tiebreak: false, points: 100 }, t0 + 1000);
    advance(s, t0 + 1000, new Set([s.players[0].id]));
    expect(s.q?.revealUntil).not.toBeNull();
  });

  it('moves on when the time is up, answered or not', () => {
    const s = started();
    expect(nextWake(s)).toBe(t0 + 20_000 + GRACE_MS);
    advance(s, t0 + 20_000, ids(s));
    expect(s.q?.revealUntil).toBeNull();
    advance(s, t0 + 20_000 + GRACE_MS, ids(s));
    expect(s.q?.revealUntil).not.toBeNull();
  });

  it('picks up with the next question after a long sleep, rather than skipping through the rest', () => {
    const s = started();
    answer(s, B, { index: 0, tiebreak: false, points: 120 }, t0 + 1000);
    const late = t0 + 10 * 60_000;
    advance(s, late, new Set());
    expect(s.q).toMatchObject({ index: 0, revealUntil: late + REVEAL_MS });
    advance(s, late + REVEAL_MS, new Set());
    expect(s.q).toMatchObject({ index: 1, startsAt: late + REVEAL_MS + LEAD_MS });
  });

  it('shows everyone the same scoreboard, without the secrets', () => {
    const s = started();
    answer(s, A, { index: 0, tiebreak: false, points: 100 }, t0 + 1000);
    const view = viewOf(s, t0 + 1000, new Set([s.players[0].id]));
    expect(view.players.map((p) => [p.name, p.score, p.answered, p.connected])).toEqual([
      ['Dana', 100, true, true],
      ['Omer', 0, false, false],
    ]);
    expect(JSON.stringify(view)).not.toContain(A);
  });
});

describe('the end of a battle', () => {
  it('has one winner with the most points, after the round’s last question', () => {
    const s = started(3, short);
    playRound(s, [100, 75, 25]);
    expect(s.phase).toBe('done');
    expect(standings(s).map((x) => [x.name, x.score, x.place, x.winner])).toEqual([
      ['Dana', 600, 1, true],
      ['Omer', 450, 2, false],
      ['Noa', 150, 3, false],
    ]);
  });

  it('lets players lower down share a place', () => {
    const s = started(3);
    playRound(s, [150, 50, 50]);
    expect(standings(s).map((x) => x.place)).toEqual([1, 2, 2]);
  });

  it('breaks a tie for first with sudden-death questions, for the tied players only', () => {
    const s = started(3);
    const now = playRound(s, [100, 100, 50]);
    expect(s.phase).toBe('tiebreak');
    expect(s.contenders).toEqual([s.players[0].id, s.players[1].id]);
    expect(s.q).toMatchObject({ index: 0, tiebreak: true, startsAt: now + COUNTDOWN_MS });
    const at = s.q!.startsAt + 1000;
    // Noa isn't in it.
    expect(answer(s, C, { index: 0, tiebreak: true, points: 150 }, at)).toBe(false);
    answer(s, A, { index: 0, tiebreak: true, points: 130 }, at);
    answer(s, B, { index: 0, tiebreak: true, points: 140 }, at);
    advance(s, at, ids(s));
    advance(s, s.q!.revealUntil!, ids(s));
    expect(s.phase).toBe('done');
    expect(s.winners).toEqual([s.players[1].id]);
    // The tiebreak doesn't change the scores, only the order.
    expect(standings(s).map((x) => [x.name, x.score, x.place])).toEqual([
      ['Omer', 1000, 1],
      ['Dana', 1000, 2],
      ['Noa', 500, 3],
    ]);
  });

  it('goes again on a tied tiebreak, and shares the win after the last one', () => {
    const s = started(2);
    playRound(s, [100, 100]);
    for (let i = 0; i < MAX_TIEBREAKS; i++) {
      expect(s.q).toMatchObject({ index: i, tiebreak: true });
      const at = s.q!.startsAt + 1000;
      answer(s, A, { index: i, tiebreak: true, points: 100 }, at);
      answer(s, B, { index: i, tiebreak: true, points: 100 }, at);
      advance(s, at, ids(s));
      advance(s, s.q!.revealUntil!, ids(s));
    }
    expect(s.phase).toBe('done');
    expect(s.winners).toHaveLength(2);
    expect(standings(s).map((x) => x.place)).toEqual([1, 1]);
  });

  it('can be followed by a rematch, offered once', () => {
    const s = started(2);
    playRound(s, [100, 50]);
    expect(offerRematch(s, B, 'GHJKLM', 0)).toBe(true);
    expect(offerRematch(s, A, 'NPQRST', 0)).toBe(false);
    expect(s.rematch).toBe('GHJKLM');
  });
});

describe('battles left alone', () => {
  it('are cleared: a lobby after a day, results after a week', () => {
    const s = lobby();
    expect(expired(s, LOBBY_TTL_MS - 1)).toBe(false);
    expect(expired(s, LOBBY_TTL_MS)).toBe(true);
    const done = started(2);
    const end = playRound(done, [100, 50]);
    expect(expired(done, end + DONE_TTL_MS - 1)).toBe(false);
    expect(expired(done, end + DONE_TTL_MS)).toBe(true);
  });
});

describe('the battle API', () => {
  const env = { DB: null, BATTLES: null, ASSETS: { fetch: async () => new Response('<html><head></head></html>') } } as unknown as Env;
  const call = (path: string, init?: RequestInit) => worker.fetch(new Request(`https://game.test${path}`, init), env);

  it('checks a new battle before making it', () => {
    const ok = { settings: base, seed: 1, secret: A, name: 'Dana' };
    expect(parseCreate(ok)).toEqual(ok);
    expect(parseCreate({ ...ok, secret: 'short' })).toBeNull();
    expect(parseCreate({ ...ok, seed: -1 })).toBeNull();
    expect(parseCreate({ ...ok, name: 7 })).toBeNull();
    expect(parseCreate({ ...ok, settings: { ...base, mode: 'explore' } })).toBeNull();
  });

  it('turns away bad requests before reaching a battle', async () => {
    expect((await call('/api/battles', { method: 'POST', body: '{' })).status).toBe(400);
    expect((await call('/api/battles', { method: 'POST', body: JSON.stringify({ settings: base }) })).status).toBe(400);
    expect((await call('/api/battles')).status).toBe(405);
    expect((await call('/api/battles/NOPE')).status).toBe(404);
    expect((await call('/api/battles/ABCDEF/ws')).status).toBe(426);
  });

  it('serves the game for a battle link, with or without a real code', async () => {
    expect(await (await call('/battle?b=nope')).text()).toContain('<head>');
    // No battle to look up here (BATTLES is null): the page still comes, without a preview.
    expect(await (await call('/battle?b=ABCDEF')).text()).toBe('<html><head></head></html>');
  });

  it('writes a link preview that can’t break out of its tags', () => {
    const html = withPreview('<html><head></head></html>', '"><script>x</script> invites you', 'A & B', 'https://game.test/battle?b=ABCDEF');
    expect(html).toContain('<meta property="og:title" content="&quot;&gt;&lt;script&gt;x&lt;/script&gt; invites you" />');
    expect(html).toContain('content="A &amp; B"');
    expect(html).not.toContain('<script>');
  });
});

describe('a battle’s Durable Object', () => {
  /** One player's connection, as the room sees it, keeping what the room sent. */
  class Socket {
    sent: ServerMessage[] = [];
    private attachment: unknown = null;
    send(raw: string): void {
      this.sent.push(JSON.parse(raw) as ServerMessage);
    }
    close(): void {}
    serializeAttachment(value: unknown): void {
      this.attachment = value;
    }
    deserializeAttachment(): unknown {
      return this.attachment;
    }
    get view() {
      return this.sent.filter((m) => m.t === 'state').at(-1)!.view;
    }
  }

  /** Runs something with the server's clock at a given time. */
  async function at(time: number, run: () => Promise<unknown>): Promise<void> {
    const realNow = Date.now;
    Date.now = () => time;
    try {
      await run();
    } finally {
      Date.now = realNow;
    }
  }

  function room() {
    const stored = new Map<string, unknown>();
    const sockets: Socket[] = [];
    let alarm: number | null = null;
    const ctx = {
      storage: {
        get: async (key: string) => structuredClone(stored.get(key)),
        put: async (key: string, value: unknown) => void stored.set(key, structuredClone(value)),
        deleteAll: async () => stored.clear(),
        setAlarm: async (time: number) => void (alarm = time),
        deleteAlarm: async () => void (alarm = null),
      },
      acceptWebSocket: () => {},
      getWebSockets: () => sockets,
    } as unknown as DurableObjectState;
    const make = () => new BattleRoom(ctx, null);
    let object = make();
    return {
      stored,
      alarm: () => alarm,
      fetch: (path: string, init?: RequestInit) => object.fetch(new Request(`https://battle${path}`, init)),
      connect: () => {
        const ws = new Socket();
        sockets.push(ws);
        return ws;
      },
      say: (ws: Socket, msg: ClientMessage) => object.webSocketMessage(ws as never, JSON.stringify(msg)),
      /** The object leaves memory between messages; its state must come back from storage. */
      hibernate: () => (object = make()),
      wake: () => object.alarm(),
    };
  }

  it('runs a battle from the lobby to the first answer, through a sleep', async () => {
    const r = room();
    expect((await r.fetch('/view')).status).toBe(404);
    const made = await r.fetch('/create', { method: 'POST', body: JSON.stringify({ code: 'ABCDEF', settings: base, seed: 9, secret: A, name: 'Dana' }) });
    expect(made.status).toBe(201);
    expect((await r.fetch('/create', { method: 'POST', body: JSON.stringify({ code: 'ABCDEF', settings: base, seed: 9, secret: B, name: 'Omer' }) })).status).toBe(409);

    const dana = r.connect();
    await r.say(dana, { t: 'hello', secret: A, name: 'Dana' });
    expect(dana.sent[0]).toEqual({ t: 'welcome', you: 'p1' });
    const omer = r.connect();
    await r.say(omer, { t: 'hello', secret: B, name: 'Omer' });
    expect(dana.view.players.map((p) => [p.name, p.connected])).toEqual([['Dana', true], ['Omer', true]]);
    expect(dana.view).toMatchObject({ phase: 'lobby', total: 10, seed: 9, host: 'p1' });

    // Only the host starts it.
    await r.say(omer, { t: 'start' });
    expect(omer.view.phase).toBe('lobby');
    r.hibernate();
    await r.say(dana, { t: 'start' });
    expect(omer.view.phase).toBe('playing');
    expect(r.alarm()).toBe(omer.view.q!.endsAt + GRACE_MS);

    // An answer during the countdown is too early; once the question is on, it counts.
    await r.say(omer, { t: 'answer', index: 0, tiebreak: false, points: 130 });
    expect(dana.view.players[1].answered).toBe(false);
    r.hibernate();
    await at(omer.view.q!.startsAt + 500, () => r.say(omer, { t: 'answer', index: 0, tiebreak: false, points: 130 }));
    expect(dana.view.players.map((p) => [p.score, p.answered])).toEqual([[0, false], [130, true]]);
    expect(JSON.stringify(dana.sent)).not.toContain(B);

    // Looking at it from outside says who is asking, if they are in it.
    const peek = (await (await r.fetch('/view', { headers: { 'x-battle-secret': B } })).json()) as { you: string | null };
    expect(peek.you).toBe('p2');
  });

  it('is deleted once its lobby has been left alone for a day', async () => {
    const r = room();
    await r.fetch('/create', { method: 'POST', body: JSON.stringify({ code: 'ABCDEF', settings: base, seed: 9, secret: A, name: 'Dana' }) });
    await at(Date.now() + LOBBY_TTL_MS + 1, () => r.wake());
    expect(r.stored.size).toBe(0);
    expect((await r.fetch('/view')).status).toBe(404);
  });
});
