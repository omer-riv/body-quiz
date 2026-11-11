// What the player has chosen, kept in the browser.
import type { ModeId } from './game';
import type { Level, SystemId } from './structures';

export interface Settings {
  mode: ModeId;
  system: SystemId | 'all';
  level: Level;
}

const KEY = 'body-quiz:settings';
const DEFAULTS: Settings = { mode: 'find', system: 'all', level: 1 };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows may refuse; the game works without it.
  }
}

export function loadSettings(): Settings {
  return read(KEY, { ...DEFAULTS });
}
export function saveSettings(settings: Settings): void {
  write(KEY, settings);
}

const BEST = 'body-quiz:best';
export function bestKey(s: Pick<Settings, 'mode' | 'system' | 'level'>): string {
  return `${s.mode}:${s.system}:${s.level}`;
}
export function bestScore(key: string): number {
  return read<Record<string, number>>(BEST, {})[key] ?? 0;
}
/** Records a score and says whether it is a new best. */
export function recordScore(key: string, score: number): boolean {
  const all = read<Record<string, number>>(BEST, {});
  if (score <= (all[key] ?? 0)) return false;
  write(BEST, { ...all, [key]: score });
  return true;
}
