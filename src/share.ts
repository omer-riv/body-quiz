// Challenge links: a finished round's score, shared so a friend can play the
// very same questions and try to beat it. Used by the game and by the Worker,
// which gives the links their preview (worker/share.ts), so it has no DOM code.
import { categoryFor, cleanName, maxScore, parseCategory, roundLength, roundName, type Category } from './leaderboard';

/** The page a challenge link opens, next to the game's index.html. */
export const CHALLENGE_PATH = 'challenge';

export interface Challenge extends Category {
  /** The seed the round's questions were drawn with, so the friend gets the same ones in the same order. */
  seed: number;
  score: number;
  /** Who set it; empty when they didn't give a name. */
  name: string;
  /** The friend whose challenge this score beat, so the preview can say so. */
  beat?: { name: string; score: number };
}

export function challengeQuery(c: Challenge): string {
  const q = new URLSearchParams({ mode: c.mode, system: c.system, level: String(c.level), seed: String(c.seed), score: String(c.score) });
  if (c.name) q.set('name', c.name);
  if (c.beat) {
    q.set('beat', c.beat.name);
    q.set('beatscore', String(c.beat.score));
  }
  return q.toString();
}

const validScore = (raw: string | null, max: number) => {
  const n = raw && /^\d{1,7}$/.test(raw) ? Number(raw) : 0;
  return n > 0 && n <= max ? n : null;
};

const validSeed = (raw: string | null) => {
  const n = raw && /^\d{1,10}$/.test(raw) ? Number(raw) : -1;
  return n >= 0 && n <= 0xffffffff ? n : null;
};

/** Reads a challenge link's query; null unless it describes a ranked round the game can play. */
export function parseChallenge(params: URLSearchParams): Challenge | null {
  const category = parseCategory(`${params.get('mode')}:${params.get('system')}:${params.get('level')}`);
  if (!category || !categoryFor(category)) return null;
  const seed = validSeed(params.get('seed'));
  const score = validScore(params.get('score'), maxScore(category));
  if (seed === null || !score) return null;
  const challenge: Challenge = { ...category, seed, score, name: cleanName(params.get('name') ?? '') };
  const beatName = cleanName(params.get('beat') ?? '');
  const beatScore = validScore(params.get('beatscore'), score);
  if (beatName && beatScore) challenge.beat = { name: beatName, score: beatScore };
  return challenge;
}

/** Whether a round is the one a challenge set: the same kind of round, drawn from the same seed. */
export const isChallengeRound = (c: Challenge, round: Category & { seed: number }) =>
  c.mode === round.mode && c.system === round.system && c.level === round.level && c.seed === round.seed;

// ---- Wording shared by the game and the link preview -------------------------

export const A_FRIEND = 'A friend';
/** The round, as one line: "Find It · Skeleton · Easy · 10 questions". */
export const challengeRound = (c: Category) => `${roundName(c)} · ${roundLength(c.system, c.level)} questions`;
/** "1,240 points" */
export const points = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'point' : 'points'}`;
export const challengeTitle = (c: Challenge) => `A challenge from ${c.name || A_FRIEND}: ${points(c.score)}`;
export const beatLine = (beat: NonNullable<Challenge['beat']>) => `Beat ${beat.name}’s ${beat.score.toLocaleString('en-US')}`;

/** The text sent along with a challenge link. */
export function shareMessage(c: Challenge): string {
  const beat = c.beat ? `I just beat your ${c.beat.score.toLocaleString('en-US')}, ${c.beat.name}! ` : '';
  return `${beat}My Vitals score: ${points(c.score)} (${challengeRound(c)}). Same questions for you. ${c.beat ? 'Your move.' : 'Can you beat it?'}`;
}

