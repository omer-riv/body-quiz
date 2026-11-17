import { readFileSync } from 'node:fs';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { describe, expect, it } from 'vitest';
import { pickQuestions } from '../src/game';
import { maxScore } from '../src/leaderboard';
import { makeRng } from '../src/rng';
import { challengeQuery, challengeTitle, isChallengeRound, parseChallenge, shareMessage, type Challenge } from '../src/share';
import { entries, type PartInfo } from '../src/structures';
import worker, { withPreview, type Env } from '../worker/index';
import { IMAGE_HEIGHT, IMAGE_WIDTH, challengeSvg } from '../worker/share';

const parts = (JSON.parse(readFileSync('public/body/manifest.json', 'utf8')) as { parts: PartInfo[] }).parts;
const base: Challenge = { mode: 'find', system: 'skeleton', level: 1, seed: 123456789, score: 1240, name: 'Omer' };
const parse = (c: Challenge) => parseChallenge(new URLSearchParams(challengeQuery(c)));
const query = (q: Record<string, string>) => parseChallenge(new URLSearchParams({ mode: 'find', system: 'skeleton', level: '1', seed: '7', score: '500', ...q }));

describe('challenge links', () => {
  it('read back what they were written from', () => {
    expect(parse(base)).toEqual(base);
    const beat: Challenge = { ...base, mode: 'function', system: 'brain', level: 3, seed: 0xffffffff, name: '', beat: { name: 'Dana', score: 900 } };
    expect(parse(beat)).toEqual(beat);
  });

  it('only describe ranked rounds the game can play', () => {
    expect(query({ mode: 'explore' })).toBeNull();
    expect(query({ mode: 'function', system: 'skeleton' })).toBeNull();
    expect(query({ system: 'tail' })).toBeNull();
    expect(query({ level: '4' })).toBeNull();
    expect(query({})).not.toBeNull();
  });

  it('need a seed a round could be drawn with', () => {
    expect(query({ seed: '' })).toBeNull();
    expect(query({ seed: '-1' })).toBeNull();
    expect(query({ seed: '1.5' })).toBeNull();
    expect(query({ seed: String(2 ** 32) })).toBeNull();
    expect(query({ seed: '0' })?.seed).toBe(0);
  });

  it('turn away scores no round could reach', () => {
    expect(query({ score: '0' })).toBeNull();
    expect(query({ score: '1e3' })).toBeNull();
    expect(query({ score: String(maxScore(base) + 1) })).toBeNull();
    expect(query({ score: String(maxScore(base)) })).not.toBeNull();
    // Brain at Easy is a short round, so it can score less.
    expect(query({ system: 'brain', score: String(maxScore(base)) })).toBeNull();
  });

  it('only say what they beat when it is a lower score with a name', () => {
    expect(query({ beat: 'Dana', beatscore: '400' })?.beat).toEqual({ name: 'Dana', score: 400 });
    expect(query({ beat: 'Dana', beatscore: '600' })?.beat).toBeUndefined();
    expect(query({ beat: '  ', beatscore: '400' })?.beat).toBeUndefined();
  });

  it('give the friend the very same questions', () => {
    const pool = entries(parts, 1).filter((e) => e.system === 'skeleton');
    const names = (seed: number) => pickQuestions(pool, makeRng(seed)).map((q) => [q.target.name, q.options.map((o) => o.name)]);
    expect(names(parse(base)!.seed)).toEqual(names(base.seed));
    expect(names(base.seed + 1)).not.toEqual(names(base.seed));
  });

  it('count only the round played on their questions', () => {
    expect(isChallengeRound(base, { mode: 'find', system: 'skeleton', level: 1, seed: base.seed })).toBe(true);
    expect(isChallengeRound(base, { mode: 'find', system: 'skeleton', level: 1, seed: 1 })).toBe(false);
    expect(isChallengeRound(base, { mode: 'name', system: 'skeleton', level: 1, seed: base.seed })).toBe(false);
  });

  it('come with a message saying what to beat', () => {
    expect(shareMessage(base)).toBe('My Vitals score: 1,240 points (Find It · Skeleton · Easy · 10 questions). Same questions for you. Can you beat it?');
    expect(shareMessage({ ...base, beat: { name: 'Dana', score: 900 } })).toMatch(/^I just beat your 900, Dana! .* Your move\.$/);
    expect(challengeTitle({ ...base, name: '' })).toBe('A challenge from A friend: 1,240 points');
  });
});

describe('challenge page', () => {
  const page = '<!doctype html><html><head><meta charset="UTF-8" /><title>Vitals</title></head><body></body></html>';
  const env = { ASSETS: { fetch: async () => new Response(page, { headers: { 'content-type': 'text/html' } }) } } as unknown as Env;
  const get = (path: string) => worker.fetch(new Request(`https://game.test${path}`), env, { waitUntil: () => {} });

  it('carries the preview tags for a valid challenge', async () => {
    const html = await (await get(`/challenge?${challengeQuery(base)}`)).text();
    expect(html).toContain('<meta property="og:title" content="A challenge from Omer: 1,240 points" />');
    expect(html).toContain('<meta property="og:image" content="https://game.test/api/challenge.png?mode=find&amp;system=skeleton');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it('is just the game for a link it cannot read', async () => {
    expect(await (await get('/challenge?mode=explore')).text()).toBe(page);
  });

  it('turns away images for links it cannot read', async () => {
    expect((await get('/api/challenge.png?mode=find')).status).toBe(400);
  });

  it('keeps names from breaking out of the tags', () => {
    const html = withPreview(page, challengeTitle({ ...base, name: '"><script>' }), '', 'https://x/', 'https://x/i.png');
    expect(html).not.toContain('<script>');
  });

  it('renders its image as a PNG with the Rubik font', async () => {
    await initWasm(readFileSync('node_modules/@resvg/resvg-wasm/index_bg.wasm'));
    const fonts = ['500Medium/Rubik_500Medium', '700Bold/Rubik_700Bold', '800ExtraBold/Rubik_800ExtraBold'].map((f) =>
      readFileSync(`node_modules/@expo-google-fonts/rubik/${f}.ttf`),
    );
    const svg = challengeSvg({ ...base, name: 'A & <B>', beat: { name: 'Dana', score: 900 } });
    const resvg = new Resvg(svg, { font: { fontBuffers: fonts, defaultFontFamily: 'Rubik', loadSystemFonts: false } });
    const image = resvg.render();
    expect([image.width, image.height]).toEqual([IMAGE_WIDTH, IMAGE_HEIGHT]);
    expect(image.asPng().subarray(1, 4).toString()).toBe('80,78,71');
  });
});
