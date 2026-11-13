// The Cloudflare Worker in front of the game: /api/scores reads and writes the
// shared high scores in D1, /api/battles and /battle run battles (each one a
// Durable Object, worker/battle.ts), and everything else is the built game in dist/.
import { BATTLE_PATH, inviteMessage, inviteTitle, isBattleCode, type BattleView } from '../src/battle';
import { BOARD_SIZE, PERIODS, cleanName, maxScore, nameKey, parseCategory, periodStart, type Boards, type Entry, type Placement } from '../src/leaderboard';
import { BattleRoom, battleStub, createRoom, parseCreate, type DurableObjectNamespace } from './battle';

export { BattleRoom };

// Just the parts of the Workers runtime types used here.
interface D1Result<T> {
  results: T[];
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
}
interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}
export interface Env {
  DB: D1Database;
  BATTLES: DurableObjectNamespace;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const VERSION = '0.1.0';

// Created on first use, so a fresh database needs no setup step. Names are typed
// in; there are no accounts. name_key is the name lowercased, and created_at is
// in ms since the epoch.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS scores_by_score ON scores (category, score DESC, created_at)',
  'CREATE INDEX IF NOT EXISTS scores_by_time ON scores (category, created_at)',
];
let schemaReady: Promise<unknown> | null = null;

function ensureSchema(db: D1Database): Promise<unknown> {
  schemaReady ??= db.batch(SCHEMA.map((sql) => db.prepare(sql))).catch((err: unknown) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

// The top scores on the table, earliest first on a tie. A player can hold several places.
const BOARD_SQL = `
  SELECT id, name, score, created_at AS at FROM scores
  WHERE category = ?1 AND created_at >= ?2
  ORDER BY score DESC, created_at ASC, id ASC LIMIT ${BOARD_SIZE}`;

/** A category's three tables, in one round trip. */
async function readBoards(db: D1Database, category: string, now: number): Promise<Boards> {
  const results = await db.batch<Entry>(PERIODS.map((p) => db.prepare(BOARD_SQL).bind(category, periodStart(p, now))));
  return Object.fromEntries(PERIODS.map((p, i) => [p, results[i].results])) as Boards;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const error = (status: number, message: string) => json({ error: message }, status);

async function handleScores(request: Request, env: Env): Promise<Response> {
  const now = Date.now();
  await ensureSchema(env.DB);
  if (request.method === 'GET') {
    const category = new URL(request.url).searchParams.get('category') ?? '';
    if (!parseCategory(category)) return error(400, 'Unknown category');
    return json(await readBoards(env.DB, category, now));
  }
  if (request.method !== 'POST') return error(405, 'Method not allowed');

  let body: { category?: unknown; name?: unknown; score?: unknown };
  try {
    body = await request.json();
  } catch {
    return error(400, 'Expected JSON');
  }
  const category = typeof body?.category === 'string' ? body.category : '';
  const parsed = parseCategory(category);
  if (!parsed) return error(400, 'Unknown category');
  const name = typeof body.name === 'string' ? cleanName(body.name) : '';
  if (!name) return error(400, 'Name required');
  const score = body.score;
  if (typeof score !== 'number' || !Number.isInteger(score) || score <= 0 || score > maxScore(parsed)) return error(400, 'Invalid score');

  const row = await env.DB.prepare('INSERT INTO scores (category, name, name_key, score, created_at) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id')
    .bind(category, name, nameKey(name), score, now)
    .first<{ id: number }>();
  const id = row!.id;
  const boards = await readBoards(env.DB, category, now);
  const rank = (entries: Entry[]) => {
    const i = entries.findIndex((e) => e.id === id);
    return i < 0 ? null : i + 1;
  };
  const placement: Placement = { id, boards, ranks: { week: rank(boards.week), month: rank(boards.month), all: rank(boards.all) } };
  return json(placement, 201);
}

/** /api/battles makes a battle; /api/battles/CODE looks at one, and /api/battles/CODE/ws plays it. */
async function handleBattles(request: Request, env: Env, pathname: string): Promise<Response> {
  if (pathname === '/api/battles') {
    if (request.method !== 'POST') return error(405, 'Method not allowed');
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error(400, 'Expected JSON');
    }
    const req = parseCreate(body);
    if (!req) return error(400, 'Invalid battle');
    const code = await createRoom(env, req);
    return code ? json({ code }, 201) : error(400, 'Name required');
  }
  const match = /^\/api\/battles\/([A-Za-z0-9]+)(\/ws)?$/.exec(pathname);
  const code = match?.[1].toUpperCase() ?? '';
  if (!match || !isBattleCode(code)) return error(404, 'No such battle');
  const ws = !!match[2];
  if (ws !== (request.headers.get('Upgrade')?.toLowerCase() === 'websocket')) return error(426, 'Expected a WebSocket');
  if (!ws && request.method !== 'GET') return error(405, 'Method not allowed');
  return battleStub(env, code).fetch(request);
}

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** The page with [Open Graph](https://ogp.me/) tags, which chat apps draw a link's preview from. */
export function withPreview(html: string, title: string, description: string, pageUrl: string): string {
  const tags = { 'og:type': 'website', 'og:site_name': 'Vitals', 'og:title': title, 'og:description': description, 'og:url': pageUrl };
  const meta = Object.entries(tags).map(([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}" />`);
  return html.replace('</head>', `${meta.join('')}</head>`);
}

/** The game's page for a battle link, with a preview naming who the battle is from. */
async function battlePage(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(new Request(new URL('/', url), request));
  const code = (url.searchParams.get('b') ?? '').toUpperCase();
  if (!page.ok || !isBattleCode(code)) return page;
  try {
    const res = await battleStub(env, code).fetch(new Request('https://battle/view'));
    if (!res.ok) return page;
    const { view } = (await res.json()) as { view: BattleView };
    const host = view.players.find((p) => p.id === view.host)?.name || 'A friend';
    const html = withPreview(await page.text(), inviteTitle(host), inviteMessage(view.settings), `${url.origin}/${BATTLE_PATH}?b=${code}`);
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
  } catch (err) {
    console.error(err);
    return page;
  }
}

/** The API paths that need nothing but the URL. */
export function handleApi(url: URL): Response | null {
  if (url.pathname === '/api/health') {
    return Response.json({ ok: true, version: VERSION });
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/scores') {
      try {
        return await handleScores(request, env);
      } catch (err) {
        console.error(err);
        return error(500, 'Scores are unavailable');
      }
    }
    if (url.pathname === `/${BATTLE_PATH}`) return battlePage(request, env);
    if (url.pathname === '/api/battles' || url.pathname.startsWith('/api/battles/')) {
      try {
        return await handleBattles(request, env, url.pathname);
      } catch (err) {
        console.error(err);
        return error(500, 'Battles are unavailable');
      }
    }
    if (url.pathname.startsWith('/api/')) {
      return handleApi(url) ?? error(404, 'not found');
    }
    return env.ASSETS.fetch(request);
  },
};
