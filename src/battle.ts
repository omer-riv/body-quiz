// Battles: up to six players on the same questions at the same moment, with a
// live scoreboard and a winner at the end. This is the battle's rule book, used
// by the Durable Object that runs each battle (worker/battle.ts) and by the game,
// which shows it, so it has no DOM or Workers code.
//
// The server keeps the clock: it says when each question starts and ends, and
// moves everyone on together once all have answered or the time is up. Each
// player's game works out its own points, the same way as in a round played
// alone, and sends them in. Everyone gets the same questions because they all
// come from the battle's seed (battlePlan in src/game.ts).
import { maxPoints } from './game';
import { RANKED_MODES, MAX_NAME_LENGTH, categoryOf, cleanName, nameKey, parseCategory, roundLength, roundName, type Category } from './leaderboard';

/** The page a battle link opens, next to the game's index.html: battle?b=CODE */
export const BATTLE_PATH = 'battle';
export const MAX_PLAYERS = 6;
/** Sudden-death questions to break a tie for first place, before the win is shared. */
export const MAX_TIEBREAKS = 3;
/** The 3-2-1 before the first question and before a tiebreaker. */
export const COUNTDOWN_MS = 4000;
/** Between one question's answer and the next question, so everyone sees where the structure is. */
export const REVEAL_MS = 3500;
/** How far ahead a question is announced, so it appears on every screen at the same moment. */
export const LEAD_MS = 800;
/** Answers still on their way when the time runs out still count. */
export const GRACE_MS = 750;
/** The most any one question can be worth, speed bonus included. */
export const MAX_QUESTION_POINTS = Math.max(...RANKED_MODES.map(maxPoints));
/** A lobby nobody starts is cleared after a day; a finished battle's results stay for a week. */
export const LOBBY_TTL_MS = 24 * 60 * 60 * 1000;
export const DONE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const isBattleCode = (code: string) => new RegExp(`^[${CODE_CHARS}]{${CODE_LENGTH}}$`).test(code);

/** A new battle code, without the easily confused letters and digits (0/O, 1/I). */
export function newBattleCode(random: () => number = Math.random): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]).join('');
}

/** Each player's own secret, which stays on their device and is never shown to the others. */
export const isSecret = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(s);

/** The round a battle plays: as in the menu, plus how long each question lasts. */
export type BattleSettings = Category & {
  /** Seconds per question. */
  timeout: number;
};

/** The question timeouts the battle setup offers, in seconds. Finding a structure under others takes longer than picking a name. */
export function timeoutOptions(mode: Category['mode']): number[] {
  return mode === 'find' ? [15, 20, 30, 45, 60] : [10, 15, 20, 30, 45];
}

export const defaultTimeout = (mode: Category['mode']) => (mode === 'find' ? 30 : 20);

/** Rounds a battle can be: the ones with a score, which are the ones on the high-score tables. Explore has none. */
export const canBattle = (c: Category) => !!parseCategory(categoryOf(c.mode, c.system, c.level));

/** Checks battle settings from a request; null unless they describe a round the game can play. */
export function parseBattleSettings(raw: unknown): BattleSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.mode !== 'string' || typeof r.system !== 'string' || typeof r.level !== 'number' || typeof r.timeout !== 'number') return null;
  const category = parseCategory(`${r.mode}:${r.system}:${r.level}`);
  if (!category || !timeoutOptions(category.mode).includes(r.timeout)) return null;
  return { ...category, timeout: r.timeout };
}

// ---- Wording shared by the game and the link preview -------------------------

/** A question timeout: "20 sec", "1 min". */
export const duration = (n: number) => (n < 60 ? `${n} sec` : n % 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')} min` : `${n / 60} min`);

/** The round, as one line: "Find It · Skeleton · Easy · 10 questions · 30 sec each". */
export const battleRound = (s: BattleSettings) => `${roundName(s)} · ${roundLength(s.system, s.level)} questions · ${duration(s.timeout)} each`;

export const inviteTitle = (host: string) => `${host} invites you to a battle`;
export const inviteMessage = (s: BattleSettings) =>
  `Join my Body Quiz battle: ${battleRound(s)}. Same questions, same moment. Let’s see who wins!`;

// ---- State ------------------------------------------------------------------

export interface Player {
  id: string;
  secret: string;
  name: string;
  score: number;
  /** Points per question, by question number. */
  answers: Record<number, number>;
  /** Points per tiebreak question. */
  tiebreak: Record<number, number>;
}

export interface BattleQuestion {
  /** Which question: main questions count from 0, and so do tiebreak questions. */
  index: number;
  tiebreak: boolean;
  /** Server times, in ms since the epoch. */
  startsAt: number;
  endsAt: number;
  /** Set once the question is over: when the next one comes. */
  revealUntil: number | null;
}

export type BattlePhase = 'lobby' | 'playing' | 'tiebreak' | 'done';

export interface BattleState {
  code: string;
  settings: BattleSettings;
  /** Main questions in the round: what a round on its system at its level has. */
  total: number;
  seed: number;
  host: string;
  phase: BattlePhase;
  players: Player[];
  nextId: number;
  q: BattleQuestion | null;
  /** In a tiebreak: the players still tied for first. */
  contenders: string[];
  tiebreaks: number;
  /** Set when the battle is over: one player, or several when the tiebreak couldn't split them. */
  winners: string[];
  /** The next battle with the same settings, once someone asks for a rematch. */
  rematch: string | null;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
}

export function createBattle(
  code: string,
  settings: BattleSettings,
  seed: number,
  host: { secret: string; name: string },
  now: number,
): BattleState {
  const s: BattleState = {
    code,
    settings,
    total: roundLength(settings.system, settings.level),
    seed: seed >>> 0,
    host: '',
    phase: 'lobby',
    players: [],
    nextId: 1,
    q: null,
    contenders: [],
    tiebreaks: 0,
    winners: [],
    rematch: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
  };
  const joined = join(s, host.secret, host.name, now);
  if (joined.ok) s.host = joined.id;
  return s;
}

export const validSeed = (seed: unknown): seed is number => typeof seed === 'number' && Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;

const playerBySecret = (s: BattleState, secret: string) => s.players.find((p) => p.secret === secret);

/** A name no one else in the battle has: a second Dana becomes "Dana 2". */
function uniqueName(s: BattleState, name: string, self?: Player): string {
  const taken = new Set(s.players.filter((p) => p !== self).map((p) => nameKey(p.name)));
  if (!taken.has(nameKey(name))) return name;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const candidate = cleanName(name).slice(0, MAX_NAME_LENGTH - suffix.length).trim() + suffix;
    if (!taken.has(nameKey(candidate))) return candidate;
  }
}

export type JoinResult = { ok: true; id: string } | { ok: false; error: 'full' | 'started' | 'name' };

/** A player joins the lobby, or comes back with the secret they joined with. */
export function join(s: BattleState, secret: string, rawName: string, now: number): JoinResult {
  const existing = playerBySecret(s, secret);
  if (existing) return { ok: true, id: existing.id };
  if (s.phase !== 'lobby') return { ok: false, error: 'started' };
  if (s.players.length >= MAX_PLAYERS) return { ok: false, error: 'full' };
  const name = cleanName(rawName);
  if (!name) return { ok: false, error: 'name' };
  const player: Player = { id: `p${s.nextId++}`, secret, name: uniqueName(s, name), score: 0, answers: {}, tiebreak: {} };
  s.players.push(player);
  s.updatedAt = now;
  return { ok: true, id: player.id };
}

/** A player changes their name, before the battle starts. */
export function rename(s: BattleState, secret: string, rawName: string, now: number): boolean {
  const p = playerBySecret(s, secret);
  const name = cleanName(rawName);
  if (!p || !name || s.phase !== 'lobby') return false;
  p.name = uniqueName(s, name, p);
  s.updatedAt = now;
  return true;
}

/** Leaving the lobby frees the place; the host's role passes to the next player. Once it has started, a player keeps their score. */
export function leave(s: BattleState, secret: string, now: number): boolean {
  const p = playerBySecret(s, secret);
  if (!p || s.phase !== 'lobby') return false;
  s.players = s.players.filter((x) => x !== p);
  if (s.host === p.id) s.host = s.players[0]?.id ?? '';
  s.updatedAt = now;
  return true;
}

function question(s: BattleState, index: number, tiebreak: boolean, startsAt: number): BattleQuestion {
  return { index, tiebreak, startsAt, endsAt: startsAt + s.settings.timeout * 1000, revealUntil: null };
}

/**
 * The host starts the battle, whenever they like. Players who have left by
 * then (no connection) are dropped, since they wouldn't be there to play.
 */
export function startBattle(s: BattleState, secret: string, now: number, connected: ReadonlySet<string>): boolean {
  const p = playerBySecret(s, secret);
  if (!p || p.id !== s.host || s.phase !== 'lobby') return false;
  s.players = s.players.filter((x) => x === p || connected.has(x.id));
  s.phase = 'playing';
  s.q = question(s, 0, false, now + COUNTDOWN_MS);
  s.updatedAt = now;
  return true;
}

/** The players answering the question on screen: everyone, or in a tiebreak, those still tied. */
export const activeIds = (s: BattleState): string[] => (s.phase === 'tiebreak' ? s.contenders : s.players.map((p) => p.id));

export function hasAnswered(p: Player, q: BattleQuestion): boolean {
  return (q.tiebreak ? p.tiebreak : p.answers)[q.index] !== undefined;
}

export interface AnswerMessage {
  index: number;
  tiebreak: boolean;
  points: number;
}

/** A player's answer to the question on screen, with the points their game worked out. */
export function answer(s: BattleState, secret: string, a: AnswerMessage, now: number): boolean {
  const p = playerBySecret(s, secret);
  const q = s.q;
  if (!p || !q || q.revealUntil !== null) return false;
  if (q.index !== a.index || q.tiebreak !== a.tiebreak) return false;
  // A little early is clock drift; past the end (and the grace) is too late.
  if (now < q.startsAt - 1000 || now > q.endsAt + GRACE_MS) return false;
  if (!activeIds(s).includes(p.id) || hasAnswered(p, q)) return false;
  if (!Number.isInteger(a.points) || a.points < 0 || a.points > MAX_QUESTION_POINTS) return false;
  if (q.tiebreak) {
    p.tiebreak[q.index] = a.points;
  } else {
    p.answers[q.index] = a.points;
    p.score += a.points;
  }
  s.updatedAt = now;
  return true;
}

/**
 * A player has made a rematch battle (the game makes it, as it makes any battle) and offers it to the others. The first one offered is the one
 * everybody joins.
 */
export function offerRematch(s: BattleState, secret: string, code: string, now: number): boolean {
  if (s.phase !== 'done' || s.rematch || !playerBySecret(s, secret) || !isBattleCode(code) || code === s.code) return false;
  s.rematch = code;
  s.updatedAt = now;
  return true;
}

function finish(s: BattleState, winners: string[], now: number): void {
  s.phase = 'done';
  s.q = null;
  s.contenders = [];
  s.winners = winners;
  s.finishedAt = now;
  s.updatedAt = now;
}

/** The main round is over: a clear winner, or a tiebreak between those tied for first. */
function concludeMain(s: BattleState, now: number): void {
  const top = Math.max(...s.players.map((p) => p.score));
  const tied = s.players.filter((p) => p.score === top).map((p) => p.id);
  if (tied.length < 2) return finish(s, tied, now);
  s.phase = 'tiebreak';
  s.contenders = tied;
  s.tiebreaks = 0;
  s.q = question(s, 0, true, now + COUNTDOWN_MS);
}

/** After a tiebreak question: whoever scored most on it wins; if several did, they go again. */
function concludeTiebreak(s: BattleState, q: BattleQuestion, now: number): void {
  const points = (id: string) => s.players.find((p) => p.id === id)?.tiebreak[q.index] ?? 0;
  const best = Math.max(...s.contenders.map(points));
  const leaders = s.contenders.filter((id) => points(id) === best);
  s.tiebreaks++;
  if (leaders.length === 1 || s.tiebreaks >= MAX_TIEBREAKS) return finish(s, leaders, now);
  s.contenders = leaders;
  s.q = question(s, q.index + 1, true, now + LEAD_MS);
}

/**
 * Moves the battle along its clock: ends a question when its time is up or
 * when every connected player has answered, and after the pause that shows the
 * answer, brings on the next one. True if anything changed.
 */
export function advance(s: BattleState, now: number, connected: ReadonlySet<string>): boolean {
  let changed = false;
  // A few steps can be due at once, after the server has been asleep; the guard is only a backstop.
  for (let guard = 0; guard < 1000; guard++) {
    const q = s.q;
    if (!q || (s.phase !== 'playing' && s.phase !== 'tiebreak')) break;
    if (q.revealUntil === null) {
      const waitingFor = s.players.filter((p) => activeIds(s).includes(p.id) && connected.has(p.id));
      const allIn = now >= q.startsAt && waitingFor.length > 0 && waitingFor.every((p) => hasAnswered(p, q));
      if (!allIn && now < q.endsAt + GRACE_MS) break;
      q.revealUntil = now + REVEAL_MS;
    } else {
      if (now < q.revealUntil) break;
      if (q.tiebreak) concludeTiebreak(s, q, now);
      else if (q.index + 1 < s.total) s.q = question(s, q.index + 1, false, now + LEAD_MS);
      else concludeMain(s, now);
    }
    changed = true;
    s.updatedAt = now;
  }
  return changed;
}

/** When the server next needs to wake up for this battle, in server time. */
export function nextWake(s: BattleState): number {
  if (s.phase === 'lobby') return s.updatedAt + LOBBY_TTL_MS;
  if (s.phase === 'done') return (s.finishedAt ?? s.updatedAt) + DONE_TTL_MS;
  const q = s.q!;
  return q.revealUntil === null ? q.endsAt + GRACE_MS : q.revealUntil;
}

/** A lobby nobody started, or a battle whose results have been up long enough. */
export function expired(s: BattleState, now: number): boolean {
  return (s.phase === 'lobby' || s.phase === 'done') && now >= nextWake(s);
}

// ---- What the players see ---------------------------------------------------

export interface PlayerView {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  /** Has answered the question on screen. */
  answered: boolean;
  /** Still in the tiebreak. */
  contender: boolean;
}

export interface Standing {
  id: string;
  name: string;
  score: number;
  /** 1 for the winner; players with the same score share a place. */
  place: number;
  winner: boolean;
}

/** The battle as every player sees it: no secrets, plus the server's clock. */
export interface BattleView {
  code: string;
  settings: BattleSettings;
  total: number;
  seed: number;
  host: string;
  phase: BattlePhase;
  players: PlayerView[];
  q: BattleQuestion | null;
  tiebreaks: number;
  winners: string[];
  standings: Standing[];
  rematch: string | null;
  /** The server's time when this was sent, to set the players' clocks by. */
  now: number;
}

/** The final order: the winner first, then by score; equal scores share a place. */
export function standings(s: Pick<BattleState, 'players' | 'winners'>): Standing[] {
  const wins = new Set(s.winners);
  const sorted = [...s.players].sort((a, b) => Number(wins.has(b.id)) - Number(wins.has(a.id)) || b.score - a.score);
  const out: Standing[] = [];
  sorted.forEach((p, i) => {
    const prev = out[i - 1];
    const winner = wins.has(p.id);
    const place = winner ? 1 : prev && !prev.winner && prev.score === p.score ? prev.place : i + 1;
    out.push({ id: p.id, name: p.name, score: p.score, place, winner });
  });
  return out;
}

export function viewOf(s: BattleState, now: number, connected: ReadonlySet<string>): BattleView {
  const q = s.q;
  return {
    code: s.code,
    settings: s.settings,
    total: s.total,
    seed: s.seed,
    host: s.host,
    phase: s.phase,
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      connected: connected.has(p.id),
      answered: !!q && hasAnswered(p, q),
      contender: s.contenders.includes(p.id),
    })),
    q,
    tiebreaks: s.tiebreaks,
    winners: s.winners,
    standings: s.phase === 'done' ? standings(s) : [],
    rematch: s.rematch,
    now,
  };
}

/** Which player a secret belongs to, told only to them. */
export function selfOf(s: BattleState, secret: string): { id: string } | null {
  const p = playerBySecret(s, secret);
  return p ? { id: p.id } : null;
}

// ---- Messages -----------------------------------------------------------------

/** From a player to the battle. */
export type ClientMessage =
  | { t: 'hello'; secret: string; name: string }
  | { t: 'ping'; c: number }
  | { t: 'start' }
  | { t: 'answer'; index: number; tiebreak: boolean; points: number }
  | { t: 'name'; name: string }
  | { t: 'leave' }
  | { t: 'rematch'; code: string };

/** From the battle to a player. */
export type ServerMessage =
  | { t: 'state'; view: BattleView }
  | { t: 'welcome'; you: string }
  | { t: 'pong'; c: number; s: number }
  | { t: 'error'; error: 'full' | 'started' | 'name' | 'missing' | 'bad' };
