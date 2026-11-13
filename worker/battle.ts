// One battle: a Durable Object that holds the players' WebSockets, keeps the
// battle's state (src/battle.ts has the rules) and wakes itself with an alarm
// when a question's time runs out. It uses the WebSocket Hibernation API, so a
// battle waiting for answers doesn't stay in memory; the state lives in storage.
import {
  advance,
  answer,
  createBattle,
  expired,
  isSecret,
  join,
  leave,
  newBattleCode,
  nextWake,
  parseBattleSettings,
  rename,
  selfOf,
  startBattle,
  viewOf,
  offerRematch,
  validSeed,
  type BattleSettings,
  type BattleState,
  type ClientMessage,
  type ServerMessage,
} from '../src/battle';

// Just the parts of the Workers runtime types used here.
interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  deleteAll(): Promise<void>;
  setAlarm(time: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}
interface HibernatingSocket extends WebSocket {
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}
export interface DurableObjectState {
  storage: DurableObjectStorage;
  acceptWebSocket(ws: WebSocket): void;
  getWebSockets(): HibernatingSocket[];
}
interface DurableObjectStub {
  fetch(input: string | Request, init?: RequestInit): Promise<Response>;
}
export interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStub;
}
declare const WebSocketPair: { new (): { 0: WebSocket; 1: WebSocket } };

export interface BattleEnv {
  BATTLES: DurableObjectNamespace;
}

/** What a new battle is made from: its round, and the player who made it. */
export interface CreateRequest {
  settings: BattleSettings;
  /** The seed the questions come from. */
  seed: number;
  secret: string;
  name: string;
}

/** Checks a request to make a battle; null if anything in it is off. */
export function parseCreate(body: unknown): CreateRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const settings = parseBattleSettings(b.settings);
  if (!settings || !validSeed(b.seed) || !isSecret(b.secret) || typeof b.name !== 'string') return null;
  return { settings, seed: b.seed, secret: b.secret, name: b.name };
}

export const battleStub = (env: BattleEnv, code: string) => env.BATTLES.get(env.BATTLES.idFromName(code));

/** Makes a new battle under a fresh code; null if the player's name is missing. */
export async function createRoom(env: BattleEnv, req: CreateRequest): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newBattleCode();
    const res = await battleStub(env, code).fetch('https://battle/create', { method: 'POST', body: JSON.stringify({ ...req, code }) });
    if (res.status === 201) return code;
    if (res.status !== 409) return null;
  }
  throw new Error('No free battle code');
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

interface Attachment {
  secret: string;
  id: string;
}

export class BattleRoom {
  /** undefined until loaded from storage; null when there is no battle here. */
  private state: BattleState | null | undefined;
  constructor(
    private readonly ctx: DurableObjectState,
    _env: unknown,
  ) {}

  private async load(): Promise<BattleState | null> {
    if (this.state === undefined) this.state = (await this.ctx.storage.get<BattleState>('state')) ?? null;
    return this.state;
  }

  private async save(s: BattleState): Promise<void> {
    await this.ctx.storage.put('state', s);
    await this.ctx.storage.setAlarm(nextWake(s));
  }

  /** The players with a connection open, leaving out one that is closing. */
  private connected(closing?: WebSocket): Set<string> {
    const ids = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment | null;
      if (a && ws !== closing) ids.add(a.id);
    }
    return ids;
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Already closed; its close handler tidies up.
    }
  }

  private broadcast(s: BattleState, closing?: WebSocket): void {
    const view = viewOf(s, Date.now(), this.connected(closing));
    for (const ws of this.ctx.getWebSockets()) if (ws !== closing) this.send(ws, { t: 'state', view });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/create') {
      if (await this.load()) return json({ error: 'Taken' }, 409);
      const body = (await request.json()) as CreateRequest & { code: string };
      const now = Date.now();
      const s = createBattle(body.code, body.settings, body.seed, body, now);
      if (!s.players.length) return json({ error: 'Name required' }, 400);
      this.state = s;
      await this.save(s);
      return json({ code: s.code }, 201);
    }
    const s = await this.load();
    if (!s) return json({ error: 'No such battle' }, 404);
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit);
    }
    // A look at the battle before joining: who is in it, and whether this device is one of them.
    const secret = request.headers.get('x-battle-secret') ?? '';
    return json({ view: viewOf(s, Date.now(), this.connected()), you: (isSecret(secret) && selfOf(s, secret)?.id) || null });
  }

  async webSocketMessage(ws: HibernatingSocket, raw: string | ArrayBuffer): Promise<void> {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)) as ClientMessage;
    } catch {
      return;
    }
    // Answered first and without touching storage, so the clock reading is as fresh as can be.
    if (msg.t === 'ping') {
      if (typeof msg.c === 'number') this.send(ws, { t: 'pong', c: msg.c, s: Date.now() });
      return;
    }
    const s = await this.load();
    if (!s) {
      this.send(ws, { t: 'error', error: 'missing' });
      return;
    }
    const now = Date.now();
    const me = ws.deserializeAttachment() as Attachment | null;

    if (msg.t === 'hello') {
      if (!isSecret(msg.secret) || typeof msg.name !== 'string') return this.send(ws, { t: 'error', error: 'bad' });
      const joined = join(s, msg.secret, msg.name, now);
      if (!joined.ok) return this.send(ws, { t: 'error', error: joined.error });
      ws.serializeAttachment({ secret: msg.secret, id: joined.id } satisfies Attachment);
      const self = selfOf(s, msg.secret)!;
      this.send(ws, { t: 'welcome', you: self.id });
    } else if (!me) {
      return this.send(ws, { t: 'error', error: 'bad' });
    } else if (msg.t === 'start') {
      startBattle(s, me.secret, now, this.connected());
    } else if (msg.t === 'answer') {
      answer(s, me.secret, { index: msg.index, tiebreak: msg.tiebreak === true, points: msg.points }, now);
    } else if (msg.t === 'name') {
      if (typeof msg.name === 'string') rename(s, me.secret, msg.name, now);
    } else if (msg.t === 'leave') {
      leave(s, me.secret, now);
      ws.serializeAttachment(null);
    } else if (msg.t === 'rematch') {
      if (typeof msg.code === 'string') offerRematch(s, me.secret, msg.code, now);
    }
    advance(s, now, this.connected());
    await this.save(s);
    this.broadcast(s);
  }

  async webSocketClose(ws: HibernatingSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code);
    } catch {
      // Already closed.
    }
    const s = await this.load();
    if (!s) return;
    // A player dropping out can be the last answer the question was waiting for.
    advance(s, Date.now(), this.connected(ws));
    await this.save(s);
    this.broadcast(s, ws);
  }

  async webSocketError(ws: HibernatingSocket): Promise<void> {
    await this.webSocketClose(ws, 1011);
  }

  async alarm(): Promise<void> {
    const s = await this.load();
    if (!s) return;
    const now = Date.now();
    if (expired(s, now)) {
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.close(1000, 'Battle over');
        } catch {
          // Already closed.
        }
      }
      await this.ctx.storage.deleteAll();
      this.state = null;
      return;
    }
    advance(s, now, this.connected());
    await this.save(s);
    this.broadcast(s);
  }
}
