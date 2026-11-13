// Shared high-score rules, used by the game in the browser and by the Worker
// that stores scores (worker/index.ts). Kept free of DOM code for that reason.
import { ROUND_LENGTH, maxPoints, type ModeId } from './game';
import { SYSTEMS, type Level, type SystemId } from './structures';

export type Period = 'week' | 'month' | 'all';
export const PERIODS: Period[] = ['week', 'month', 'all'];
/** Entries shown per table. */
export const BOARD_SIZE = 10;
export const MAX_NAME_LENGTH = 20;

export interface Entry {
  id: number;
  name: string;
  score: number;
  /** When it was scored, in ms since the epoch. */
  at: number;
}

export type Boards = Record<Period, Entry[]>;

/** What the server answers to a submitted score: the tables, and where the new score landed in each (1-based). */
export interface Placement {
  id: number;
  boards: Boards;
  ranks: Record<Period, number | null>;
}

/** A round's system: one of the body's, or all of them together. */
export type RoundSystem = SystemId | 'all';

/** Modes with a score. Explore has none. */
export const RANKED_MODES: ModeId[] = ['find', 'name'];
export const BOARD_SYSTEMS: RoundSystem[] = ['all', ...SYSTEMS];
export const LEVELS: Level[] = [1, 2, 3];

/**
 * The rounds with fewer than ROUND_LENGTH questions, because the system has
 * fewer structures at that level, by `system:level`. The Worker can't count
 * the model's structures itself, so they are written down here; a test checks
 * them against the model.
 */
const SHORT_ROUNDS: Record<string, number> = { 'brain:1': 6 };

/** How many questions a round on a system at a level has. */
export function roundLength(system: RoundSystem, level: Level): number {
  return SHORT_ROUNDS[`${system}:${level}`] ?? ROUND_LENGTH;
}

export interface Category {
  mode: ModeId;
  system: RoundSystem;
  level: Level;
}

export const categoryOf = (mode: ModeId, system: RoundSystem, level: Level) => `${mode}:${system}:${level}`;

/** The table a round's score goes on, or null when the mode isn't ranked. */
export function categoryFor(s: Category): string | null {
  return RANKED_MODES.includes(s.mode) ? categoryOf(s.mode, s.system, s.level) : null;
}

/** The table the high scores screen opens on: the round picked in the menu, or Find It when that is Explore. */
export function scoresViewFor(s: Category): Category {
  return { mode: RANKED_MODES.includes(s.mode) ? s.mode : 'find', system: s.system, level: s.level };
}

/** Checks a category from a request; null unless it is one the game can produce. */
export function parseCategory(category: string): Category | null {
  const parts = category.split(':');
  if (parts.length !== 3) return null;
  const [mode, system, lvl] = parts as [ModeId, RoundSystem, string];
  const level = Number(lvl) as Level;
  if (!RANKED_MODES.includes(mode) || !BOARD_SYSTEMS.includes(system) || !/^\d$/.test(lvl) || !LEVELS.includes(level)) return null;
  return { mode, system, level };
}

/**
 * The most a round can score: every question right the first time, with the
 * whole speed bonus. It keeps
 * out obvious junk, but it is not cheat protection: with names only and no
 * accounts, anyone can post any score a round could reach.
 */
export function maxScore(c: Category): number {
  return roundLength(c.system, c.level) * maxPoints(c.mode);
}

/** Tidies a typed name: no control characters, single spaces, at most MAX_NAME_LENGTH characters. */
export function cleanName(raw: string): string {
  const chars = [...raw.normalize('NFC').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '').replace(/\s+/g, ' ').trim()];
  return chars.slice(0, MAX_NAME_LENGTH).join('').trim();
}

/** Names that differ only in case or width count as the same player. */
export const nameKey = (name: string) => cleanName(name).normalize('NFKC').toLocaleLowerCase('en');

/** Midnight UTC on the Monday of this week, or on the 1st of this month; 0 for all time. */
export function periodStart(period: Period, now: number): number {
  if (period === 'all') return 0;
  const d = new Date(now);
  if (period === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday);
}

/** Whether a score would make a table: it isn't full yet, or the score beats its last entry. */
export function wouldPlace(board: Entry[], score: number): boolean {
  if (score <= 0) return false;
  return board.length < BOARD_SIZE || score > board[board.length - 1].score;
}
