// The game's side of a battle's connection: making a battle, looking at one
// before joining, and the WebSocket that plays it, which reconnects by itself
// and keeps this device's clock in step with the server's.
import { BATTLE_PATH, type BattleSettings, type BattleView, type ClientMessage, type ServerMessage } from './battle';

const SECRET_KEY = 'body-quiz:battle-secret';
const CURRENT_KEY = 'body-quiz:battle';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** This device's secret in every battle: it is how a player who reconnects is known again. */
export function deviceSecret(): string {
  const saved = storage()?.getItem(SECRET_KEY);
  if (saved && /^[A-Za-z0-9_-]{16,64}$/.test(saved)) return saved;
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const secret = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  try {
    storage()?.setItem(SECRET_KEY, secret);
  } catch {
    // Not remembered: a reload can't rejoin this battle, but it can still be played.
  }
  return secret;
}

/** The battle being played, so the app goes back to it after a reload. */
export function savedBattle(): string | null {
  return storage()?.getItem(CURRENT_KEY) ?? null;
}

export function saveBattle(code: string | null): void {
  try {
    if (code) storage()?.setItem(CURRENT_KEY, code);
    else storage()?.removeItem(CURRENT_KEY);
  } catch {
    // Not remembered; only resuming after a reload is lost.
  }
}

export const battleUrl = (code: string) => new URL(`${BATTLE_PATH}?b=${code}`, document.baseURI).href;

const TIMEOUT_MS = 8000;

const apiUrl = (path: string) => new URL(`api/battles${path}`, document.baseURI);

export async function createBattle(settings: BattleSettings, seed: number, name: string): Promise<string> {
  const res = await fetch(apiUrl(''), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ settings, seed, name, secret: deviceSecret() }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Battle not created: ${res.status}`);
  return ((await res.json()) as { code: string }).code;
}

/** The battle as it is now, and whether this device is in it; null when there is no such battle. */
export async function peekBattle(code: string): Promise<{ view: BattleView; you: string | null } | null> {
  const res = await fetch(apiUrl(`/${code}`), { headers: { 'x-battle-secret': deviceSecret() }, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Battle unavailable: ${res.status}`);
  // Without the Worker (npm run dev), the path answers with the game's page, and this throws.
  return (await res.json()) as { view: BattleView; you: string | null };
}

export const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

/** Clock samples taken on each (re)connect, and how often the connection is checked after that. */
const SYNC_PINGS = 5;
const KEEPALIVE_MS = 20_000;

export class BattleSocket {
  onMessage: (msg: ServerMessage) => void = () => {};
  /** Whether the connection is open; it reconnects by itself after a drop. */
  onStatus: (open: boolean) => void = () => {};

  private ws: WebSocket | null = null;
  private closed = false;
  private attempts = 0;
  private retryTimer = 0;
  private keepalive = 0;
  /** The server's clock minus this device's, from the ping with the shortest round trip. */
  private offset = 0;
  private bestRtt = Infinity;
  /** Answers sent while the connection was down, sent again once it is back; the server ignores repeats. */
  private outbox: ClientMessage[] = [];

  constructor(
    private readonly code: string,
    private readonly hello: () => ClientMessage,
  ) {}

  connect(): void {
    const url = apiUrl(`/${this.code}/ws`);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.attempts = 0;
      ws.send(JSON.stringify(this.hello()));
      for (const msg of this.outbox.splice(0)) ws.send(JSON.stringify(msg));
      for (let i = 0; i < SYNC_PINGS; i++) window.setTimeout(() => this.ping(), i * 250);
      window.clearInterval(this.keepalive);
      this.keepalive = window.setInterval(() => this.ping(), KEEPALIVE_MS);
      this.onStatus(true);
    };
    ws.onmessage = (e) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(e.data)) as ServerMessage;
      } catch {
        return;
      }
      if (msg.t === 'pong') this.pong(msg.c, msg.s);
      else this.onMessage(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      window.clearInterval(this.keepalive);
      if (this.closed) return;
      this.onStatus(false);
      this.retryTimer = window.setTimeout(() => this.connect(), Math.min(8000, 500 * 2 ** this.attempts++));
    };
  }

  /** Sends now, or once the connection is back for answers that must not be lost. */
  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else if (msg.t === 'answer') this.outbox.push(msg);
  }

  close(): void {
    this.closed = true;
    window.clearTimeout(this.retryTimer);
    window.clearInterval(this.keepalive);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }

  /** A time on the server's clock, as this device's clock reads it. */
  toLocal(serverTime: number): number {
    return serverTime - this.offset;
  }

  private ping(): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'ping', c: Date.now() } satisfies ClientMessage));
  }

  private pong(sent: number, server: number): void {
    const now = Date.now();
    const rtt = now - sent;
    if (rtt < 0 || rtt > this.bestRtt) return;
    this.bestRtt = rtt;
    this.offset = server - (sent + rtt / 2);
  }

  /** Before any ping is back: the server's time on a message, which is late by the trip, but close. */
  roughSync(serverNow: number): void {
    if (this.bestRtt === Infinity) this.offset = serverNow - Date.now();
  }
}
