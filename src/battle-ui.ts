// Battles in the game: the setup screen, the invitation, the lobby, the
// countdown, the live scoreboard and the results. The Battle class follows the
// battle's state from the server and tells the game (src/app.ts) which question
// to show and when.
import {
  COUNTDOWN_MS,
  MAX_PLAYERS,
  MAX_TIEBREAKS,
  battleRound,
  defaultTimeout,
  duration,
  inviteMessage,
  inviteTitle,
  timeoutOptions,
  type BattleSettings,
  type BattleView,
  type PlayerView,
  type ServerMessage,
} from './battle';
import { BattleSocket, battleUrl, createBattle, deviceSecret, peekBattle, randomSeed, saveBattle, savedBattle } from './battle-client';
import { h } from './dom';
import { battlePlan, type BattlePlan, type Question } from './game';
import { saveName, savedName } from './highscores';
import { MAX_NAME_LENGTH, cleanName, type Category } from './leaderboard';
import { makeRng } from './rng';
import type { Entry } from './structures';

/** One battle question for the game to put on screen. */
export interface BattleAsk {
  question: Question;
  /** Where the round is: "3 / 10", or "Tiebreaker". */
  progress: string;
  /** On this device's clock, in ms since the epoch. The speed bonus counts from startsAt. */
  startsAt: number;
  endsAt: number;
  /** The points the player's answer scored; 0 for a wrong one or none in time. */
  onAnswer(points: number): void;
}

/** What a battle needs from the game. */
export interface BattleHost {
  openOverlay(content: HTMLElement): void;
  closeOverlay(): void;
  showMenu(): void;
  /** The structures a round of this kind draws its questions from. */
  poolFor(c: Category): Entry[];
  /** Clears the screen for a battle's round. */
  battleStart(s: BattleSettings): void;
  battleAsk(ask: BattleAsk): void;
  /** Nothing to answer for now: before the first question, or while others play a tiebreak. */
  battleWait(text: string): void;
  /** The question is over for everyone: whoever hasn't answered sees the answer now. */
  battleTimeUp(): void;
  battleEnd(): void;
  battleHud(board: HTMLElement | null, score: number): void;
}

const TEXT = {
  solo: 'Solo',
  battle: '⚔️ Battle',
  title: 'Battle',
  intro: `Up to ${MAX_PLAYERS} players get the same questions at the same moment, with a live scoreboard. Most points wins.`,
  timeoutHeading: 'Time per question',
  yourName: 'Your name',
  create: 'Create battle',
  creating: 'Creating…',
  createFailed: 'Couldn’t create the battle. Check your connection and try again.',
  back: 'Back',
  notNow: 'Not now',
  aFriend: 'A friend',
  lobbyTitle: (code: string) => `Battle ${code}`,
  inviteHint: (left: number) => (left > 0 ? `Send this link to up to ${left} ${left === 1 ? 'friend' : 'friends'}:` : 'The battle is full.'),
  shareInvite: 'Invite friends',
  copyLink: 'Copy link',
  copied: 'Link copied. Paste it to your friends!',
  players: (n: number) => `Players (${n}/${MAX_PLAYERS})`,
  host: 'host',
  you: 'you',
  offline: 'offline',
  start: 'Start the battle',
  waitingForHost: (host: string) => `Waiting for ${host} to start…`,
  waitingAlone: 'Start whenever you like, even before everyone has joined.',
  leave: 'Leave battle',
  join: 'Join battle',
  nameNeeded: 'Type your name first.',
  full: `This battle is full: it already has ${MAX_PLAYERS} players.`,
  started: 'This battle has already started.',
  missing: 'This battle doesn’t exist, or it has expired.',
  mismatch: 'This battle was made with another version of the game. Reload the page and try again.',
  unavailable: 'Battles aren’t available right now.',
  connecting: 'Connecting…',
  reconnecting: 'Connection lost. Reconnecting…',
  getReady: 'Get ready!',
  go: 'Go!',
  tiebreakTitle: 'Tiebreaker!',
  tiebreakBetween: (names: string) => `${names} are tied for first. Sudden death: most points on the next question wins.`,
  tiebreakHud: 'Tiebreaker',
  tiebreakWatch: (names: string) => `Tiebreaker: ${names}`,
  waiting: 'Waiting for the others…',
  backToBattle: 'Back to the battle',
  youWin: 'You win!',
  winner: (name: string) => `${name} wins!`,
  sharedWin: (names: string) => `A tie for first: ${names}`,
  wonTiebreak: 'won the tiebreaker',
  rematch: 'Rematch',
  joinRematch: 'Join the rematch',
  settingUpRematch: 'Setting up the rematch…',
  menu: 'Menu',
  points: (n: number) => `${n.toLocaleString('en')} ${n === 1 ? 'point' : 'points'}`,
  /** "Dana and Omer", "Dana, Omer and Noa". */
  list: (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`),
};

/** The menu's Solo / Battle switch. */
export const PLAY_NAMES = { solo: TEXT.solo, battle: TEXT.battle };

const MEDALS = ['🥇', '🥈', '🥉'];

/** A name field with the last name used, which says so when left empty. */
function nameField(): { field: HTMLElement; input: HTMLInputElement; value: () => string | null } {
  const input = h('input', {
    class: 'field',
    type: 'text',
    value: savedName(),
    maxlength: String(MAX_NAME_LENGTH),
    placeholder: TEXT.yourName,
    'aria-label': TEXT.yourName,
    autocomplete: 'nickname',
    spellcheck: 'false',
  });
  const note = h('p', { class: 'scores-note bad', 'aria-live': 'polite' });
  const value = () => {
    const name = cleanName(input.value);
    if (name) return name;
    note.textContent = TEXT.nameNeeded;
    input.focus();
    return null;
  };
  return { field: h('div', { class: 'battle-name' }, input, note), input, value };
}

/** The screen that sets up a battle on the round picked in the menu. */
export function battleSetup(round: Category, onCreate: (s: BattleSettings, name: string) => Promise<void>, onBack: () => void): HTMLElement {
  let timeout = defaultTimeout(round.mode);
  const settings = (): BattleSettings => ({ mode: round.mode, system: round.system, level: round.level, timeout });
  const { field, value } = nameField();
  const note = h('p', { class: 'scores-note bad', 'aria-live': 'polite' });
  const chips = h('div', { class: 'choices' });
  const roundLine = h('p', { class: 'battle-round' });
  const draw = () => {
    roundLine.textContent = battleRound(settings());
    chips.replaceChildren(
      ...timeoutOptions(round.mode).map((n) =>
        h(
          'button',
          {
            'aria-pressed': String(n === timeout),
            onclick: () => {
              timeout = n;
              draw();
            },
          },
          duration(n),
        ),
      ),
    );
  };
  draw();
  const create = h('button', { class: 'primary' }, TEXT.create);
  create.addEventListener('click', async () => {
    const name = value();
    if (!name) return;
    create.disabled = true;
    create.textContent = TEXT.creating;
    note.textContent = '';
    try {
      await onCreate(settings(), name);
    } catch (err) {
      console.warn(err);
      note.textContent = TEXT.createFailed;
      create.disabled = false;
      create.textContent = TEXT.create;
    }
  });
  return h(
    'div',
    { class: 'battle' },
    h('h1', null, `⚔️ ${TEXT.title}`),
    roundLine,
    h('p', { class: 'battle-intro' }, TEXT.intro),
    h('h2', null, TEXT.timeoutHeading),
    chips,
    h('h2', null, TEXT.yourName),
    field,
    note,
    create,
    h('button', { class: 'ghost', onclick: onBack }, TEXT.back),
  );
}

/** A player in the lobby: their name, and whether they are the host, you, or have dropped out. */
function playerTags(view: BattleView, p: PlayerView, you: string | null): Node[] {
  return [
    h('span', { class: 'battle-player-name' }, p.name),
    p.id === view.host ? h('span', { class: 'tag' }, `👑 ${TEXT.host}`) : null,
    p.id === you ? h('span', { class: 'tag you' }, TEXT.you) : null,
    !p.connected && view.phase !== 'done' ? h('span', { class: 'tag off' }, TEXT.offline) : null,
  ].filter((n): n is HTMLElement => !!n);
}

export class Battle {
  private socket: BattleSocket | null = null;
  private code = '';
  private view: BattleView | null = null;
  private you: string | null = null;
  private name = '';
  /** The battle's questions, worked out once from its seed, and the battle they are for. */
  private plan: BattlePlan | null = null;
  private planFor = '';
  /** The question already put on screen, so a repeat of the same state doesn't ask it again. */
  private shown = '';
  private started = false;
  private timers: number[] = [];
  private countdown: HTMLElement | null = null;
  private paused = false;
  private online = true;
  private wantRematch = false;

  constructor(private readonly host: BattleHost) {}

  /** In a battle's round: the ✕ button pauses this screen instead of going to the menu, since the battle goes on. */
  get inRound(): boolean {
    return !!this.socket && (this.view?.phase === 'playing' || this.view?.phase === 'tiebreak');
  }

  /** Makes a battle from the menu's round, and opens its lobby. */
  async create(s: BattleSettings, name: string): Promise<void> {
    const code = await createBattle(s, randomSeed(), name);
    saveName(name);
    await this.open(code, name);
  }

  /** Opens a battle link: straight in for a player already in it, or the invitation for a new one. */
  async open(code: string, name?: string): Promise<void> {
    this.close();
    let peek: Awaited<ReturnType<typeof peekBattle>>;
    try {
      peek = await peekBattle(code);
    } catch (err) {
      console.warn(err);
      return this.message(TEXT.unavailable);
    }
    if (!peek) {
      if (savedBattle() === code) saveBattle(null);
      return this.message(TEXT.missing);
    }
    const { view, you } = peek;
    if (you || (view.phase === 'lobby' && name)) return this.connect(code, name ?? savedName());
    if (view.phase === 'lobby') return this.host.openOverlay(this.invitation(code, view));
    if (view.phase === 'done') {
      this.view = view;
      return this.host.openOverlay(this.results(view, false));
    }
    this.message(TEXT.started);
  }

  /** Back to a battle after the app was closed, if it is still going; false when there is none to go back to. */
  async resume(): Promise<boolean> {
    const code = savedBattle();
    if (!code) return false;
    try {
      const peek = await peekBattle(code);
      if (peek?.you && peek.view.phase !== 'done') {
        this.connect(code, savedName());
        return true;
      }
    } catch (err) {
      console.warn(err);
    }
    saveBattle(null);
    return false;
  }

  /** Leaves the battle for good and goes back to the menu. */
  leave(): void {
    this.socket?.send({ t: 'leave' });
    saveBattle(null);
    this.close();
    this.host.showMenu();
  }

  pause(): void {
    if (!this.inRound) return;
    this.paused = true;
    this.host.openOverlay(
      h(
        'div',
        { class: 'battle' },
        h('h1', null, `⚔️ ${TEXT.title}`),
        this.view && h('p', { class: 'battle-round' }, battleRound(this.view.settings)),
        h('button', { class: 'primary', onclick: () => this.unpause() }, TEXT.backToBattle),
        h('button', { class: 'ghost', onclick: () => this.leave() }, TEXT.leave),
      ),
    );
  }

  unpause(): void {
    this.paused = false;
    this.host.closeOverlay();
  }

  /** Closes the connection and clears the battle off the screen. */
  close(): void {
    this.socket?.close();
    this.socket = null;
    this.clearTimers();
    this.hideCountdown();
    this.host.battleEnd();
    if (this.code && savedBattle() === this.code && this.view?.phase !== 'playing' && this.view?.phase !== 'tiebreak') saveBattle(null);
    this.code = '';
    this.view = null;
    this.you = null;
    this.plan = null;
    this.planFor = '';
    this.shown = '';
    this.started = false;
    this.paused = false;
    this.wantRematch = false;
  }

  // ---- Connection ---------------------------------------------------------

  private connect(code: string, name: string): void {
    this.close();
    this.code = code;
    this.name = name;
    if (name) saveName(name);
    this.message(TEXT.connecting, false);
    const socket = new BattleSocket(code, () => ({ t: 'hello', secret: deviceSecret(), name: this.name }));
    this.socket = socket;
    socket.onMessage = (msg) => this.receive(socket, msg);
    socket.onStatus = (open) => {
      this.online = open;
      if (this.view?.phase === 'lobby') this.render();
      else this.refreshHud();
    };
    socket.connect();
  }

  private receive(socket: BattleSocket, msg: ServerMessage): void {
    if (socket !== this.socket) return;
    if (msg.t === 'welcome') {
      this.you = msg.you;
      saveBattle(this.code);
      return;
    }
    if (msg.t === 'error') {
      const text = msg.error === 'full' ? TEXT.full : msg.error === 'started' ? TEXT.started : msg.error === 'missing' ? TEXT.missing : TEXT.unavailable;
      if (savedBattle() === this.code) saveBattle(null);
      this.close();
      this.message(text);
      return;
    }
    if (msg.t === 'state') {
      socket.roughSync(msg.view.now);
      this.view = msg.view;
      this.render();
    }
  }

  // ---- Following the battle -----------------------------------------------

  /** The battle's questions; false when this game doesn't count the same ones as the server, so the players wouldn't get the same. */
  private prepare(view: BattleView): boolean {
    if (this.planFor !== view.code) {
      this.planFor = view.code;
      this.plan = battlePlan(this.host.poolFor(view.settings), makeRng(view.seed), MAX_TIEBREAKS);
    }
    return this.plan!.main.length === view.total;
  }

  private render(): void {
    const view = this.view;
    if (!view || !this.socket) return;
    if (view.phase === 'lobby') return this.host.openOverlay(this.lobby(view));
    if (!this.prepare(view)) {
      this.close();
      return this.message(TEXT.mismatch);
    }
    if (view.phase === 'done') {
      this.clearTimers();
      this.hideCountdown();
      this.host.battleEnd();
      saveBattle(null);
      if (this.wantRematch && view.rematch) {
        void this.open(view.rematch, this.name);
        return;
      }
      this.paused = false;
      this.host.openOverlay(this.results(view, true));
      return;
    }
    this.play(view);
  }

  /** Puts the battle's question on screen at its moment, or what to wait for instead. */
  private play(view: BattleView): void {
    const host = this.host;
    const socket = this.socket!;
    if (!this.started) {
      this.started = true;
      host.battleStart(view.settings);
    }
    if (!this.paused) host.closeOverlay();
    const q = view.q;
    if (!q) return;
    const key = `${q.tiebreak ? 't' : 'm'}${q.index}`;
    const me = view.players.find((p) => p.id === this.you);
    const startsAt = socket.toLocal(q.startsAt);
    const endsAt = socket.toLocal(q.endsAt);
    const question = (q.tiebreak ? this.plan!.tiebreak : this.plan!.main)[q.index];
    if (key !== this.shown && question) {
      this.shown = key;
      this.clearTimers();
      const contenders = view.players.filter((p) => p.contender).map((p) => p.name);
      const firstTiebreak = q.tiebreak && q.index === 0;
      const intro = firstTiebreak ? TEXT.tiebreakTitle : !q.tiebreak && q.index === 0 ? TEXT.getReady : null;
      const watching = q.tiebreak && !me?.contender;
      // The top bar has room for a few words; the countdown says the rest.
      const waitText = q.tiebreak ? (watching ? TEXT.tiebreakWatch(TEXT.list(contenders)) : TEXT.tiebreakHud) : TEXT.getReady;
      const wait = startsAt - Date.now();
      if (intro && wait > 500) this.showCountdown(intro, firstTiebreak ? TEXT.tiebreakBetween(TEXT.list(contenders)) : null, startsAt);
      if (watching) {
        host.battleWait(waitText);
      } else if (me?.answered) {
        host.battleWait(TEXT.waiting);
      } else {
        const { index, tiebreak } = q;
        const go = () =>
          host.battleAsk({
            question,
            progress: tiebreak ? TEXT.tiebreakHud : `${index + 1} / ${view.total}`,
            startsAt,
            endsAt,
            onAnswer: (points) => this.socket?.send({ t: 'answer', index, tiebreak, points }),
          });
        if (wait > 0) {
          if (intro) host.battleWait(waitText);
          this.timers.push(window.setTimeout(go, wait));
        } else {
          go();
        }
      }
    }
    // The battle moved on: whoever hasn't answered sees the answer now.
    if (q.revealUntil !== null) {
      this.clearTimers();
      host.battleTimeUp();
    }
    this.refreshHud();
  }

  private refreshHud(): void {
    const view = this.view;
    if (!view || !this.started) return;
    this.host.battleHud(this.scoreboard(view), view.players.find((p) => p.id === this.you)?.score ?? 0);
  }

  /** The live scoreboard, under the top bar. */
  private scoreboard(view: BattleView): HTMLElement {
    const tiebreak = view.phase === 'tiebreak';
    const players = [...view.players].sort((a, b) => b.score - a.score);
    return h(
      'ol',
      { class: 'battle-board', 'aria-label': TEXT.players(players.length) },
      !this.online && h('li', { class: 'battle-offline' }, TEXT.reconnecting),
      players.map((p) =>
        h(
          'li',
          { class: [p.id === this.you && 'you', !p.connected && 'off', tiebreak && !p.contender && 'out'].filter(Boolean).join(' ') },
          h('span', { class: 'bb-name' }, p.name),
          h('b', null, p.score.toLocaleString('en')),
          view.q && h('i', { class: 'bb-tick', 'aria-hidden': 'true' }, p.answered ? '✓' : ''),
        ),
      ),
    );
  }

  private showCountdown(title: string, note: string | null, at: number): void {
    this.hideCountdown();
    const number = h('div', { class: 'battle-count' });
    const el = h('div', { class: 'battle-countdown', role: 'status' }, h('div', { class: 'battle-count-title' }, title), note && h('p', null, note), number);
    document.body.append(el);
    this.countdown = el;
    const tick = () => {
      const left = at - Date.now();
      number.textContent = left > 0 ? String(Math.min(Math.ceil(left / 1000), Math.ceil(COUNTDOWN_MS / 1000))) : TEXT.go;
      if (left <= -700) this.hideCountdown();
      else this.timers.push(window.setTimeout(tick, Math.min(250, Math.max(50, left % 1000 || 250))));
    };
    tick();
  }

  private hideCountdown(): void {
    this.countdown?.remove();
    this.countdown = null;
  }

  private clearTimers(): void {
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers = [];
  }

  // ---- Screens ------------------------------------------------------------

  /** A short screen with one message and a way back to the menu. */
  private message(text: string, withMenu = true): void {
    this.host.openOverlay(
      h(
        'div',
        { class: 'battle' },
        h('h1', null, `⚔️ ${TEXT.title}`),
        h('p', { class: 'battle-intro' }, text),
        withMenu && h('button', { class: 'primary', onclick: () => this.host.showMenu() }, TEXT.menu),
      ),
    );
  }

  /** A battle link for someone not in it yet: who it's from, the round, and their name to join with. */
  private invitation(code: string, view: BattleView): HTMLElement {
    const host = view.players.find((p) => p.id === view.host)?.name ?? TEXT.aFriend;
    const { field, input, value } = nameField();
    const full = view.players.length >= MAX_PLAYERS;
    const join = () => {
      const name = value();
      if (name) this.connect(code, name);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') join();
    });
    return h(
      'div',
      { class: 'battle' },
      h('h1', null, `⚔️ ${inviteTitle(host)}`),
      h('p', { class: 'battle-round' }, battleRound(view.settings)),
      h('p', { class: 'battle-intro' }, TEXT.intro),
      h('h2', null, TEXT.players(view.players.length)),
      h('ul', { class: 'battle-players' }, view.players.map((p) => h('li', null, playerTags(view, p, null)))),
      full ? h('p', { class: 'scores-note bad' }, TEXT.full) : [h('h2', null, TEXT.yourName), field],
      !full && h('button', { class: 'primary', onclick: join }, TEXT.join),
      h('button', { class: 'ghost', onclick: () => this.host.showMenu() }, TEXT.notNow),
    );
  }

  private lobby(view: BattleView): HTMLElement {
    const isHost = view.host === this.you;
    const host = view.players.find((p) => p.id === view.host);
    const url = battleUrl(view.code);
    const note = h('p', { class: 'scores-note', 'aria-live': 'polite' });
    const left = MAX_PLAYERS - view.players.length;
    const link = h('input', { class: 'field battle-link', type: 'text', readonly: true, value: url, 'aria-label': TEXT.copyLink, onfocus: (e: Event) => (e.target as HTMLInputElement).select() });
    const share = async () => {
      const text = `${inviteMessage(view.settings)}\n${url}`;
      if (navigator.share) {
        try {
          await navigator.share({ text });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
        }
      }
      try {
        await navigator.clipboard.writeText(text);
        note.textContent = TEXT.copied;
      } catch {
        link.select();
      }
    };
    return h(
      'div',
      { class: 'battle' },
      h('h1', null, `⚔️ ${TEXT.lobbyTitle(view.code)}`),
      h('p', { class: 'battle-round' }, battleRound(view.settings)),
      !this.online && h('p', { class: 'scores-note bad' }, TEXT.reconnecting),
      h('p', { class: 'battle-intro' }, TEXT.inviteHint(left)),
      left > 0 && h('div', { class: 'battle-share' }, link, h('button', { onclick: () => void share() }, 'share' in navigator ? TEXT.shareInvite : TEXT.copyLink)),
      note,
      h('h2', null, TEXT.players(view.players.length)),
      h('ul', { class: 'battle-players' }, view.players.map((p) => h('li', { class: p.connected ? '' : 'off' }, playerTags(view, p, this.you)))),
      isHost
        ? h('button', { class: 'primary', disabled: !this.online, onclick: () => this.socket?.send({ t: 'start' }) }, TEXT.start)
        : h('p', { class: 'battle-intro' }, TEXT.waitingForHost(host?.name ?? TEXT.aFriend)),
      isHost && view.players.length < 2 && h('p', { class: 'scores-note' }, TEXT.waitingAlone),
      h('button', { class: 'ghost', onclick: () => this.leave() }, TEXT.leave),
    );
  }

  /** The final standings; `live` when this player is in the battle and can ask for a rematch. */
  private results(view: BattleView, live: boolean): HTMLElement {
    const names = (ids: string[]) => ids.map((id) => view.players.find((p) => p.id === id)?.name ?? '?');
    const headline =
      view.winners.length === 1
        ? view.winners[0] === this.you
          ? `🏆 ${TEXT.youWin}`
          : `🏆 ${TEXT.winner(names(view.winners)[0])}`
        : TEXT.sharedWin(TEXT.list(names(view.winners)));
    const byTiebreak = view.tiebreaks > 0 && view.winners.length === 1;
    const rematch = h('button', { class: 'primary' }, view.rematch ? TEXT.joinRematch : this.wantRematch ? TEXT.settingUpRematch : TEXT.rematch);
    rematch.disabled = this.wantRematch && !view.rematch;
    rematch.addEventListener('click', async () => {
      this.wantRematch = true;
      if (view.rematch) return this.open(view.rematch, this.name || savedName());
      rematch.disabled = true;
      rematch.textContent = TEXT.settingUpRematch;
      try {
        // The rematch is made here, like any battle, and offered to the others; the first one offered wins.
        const code = await createBattle(view.settings, randomSeed(), this.name || savedName());
        this.socket?.send({ t: 'rematch', code });
      } catch (err) {
        console.warn(err);
        this.wantRematch = false;
        rematch.disabled = false;
        rematch.textContent = TEXT.rematch;
      }
    });
    return h(
      'div',
      { class: 'battle' },
      h('h1', null, headline),
      h('p', { class: 'battle-round' }, battleRound(view.settings)),
      h(
        'ol',
        { class: 'battle-standings' },
        view.standings.map((s) =>
          h(
            'li',
            { class: [s.winner && 'winner', s.id === this.you && 'you'].filter(Boolean).join(' ') },
            h('span', { class: 'place' }, MEDALS[s.place - 1] ?? `${s.place}.`),
            h('span', { class: 'battle-player-name' }, s.name),
            s.id === this.you && h('span', { class: 'tag you' }, TEXT.you),
            s.winner && byTiebreak && h('span', { class: 'tag' }, TEXT.wonTiebreak),
            h('b', { class: 'battle-score' }, TEXT.points(s.score)),
          ),
        ),
      ),
      live && rematch,
      h(
        'button',
        {
          class: 'ghost',
          onclick: () => {
            this.close();
            this.host.showMenu();
          },
        },
        TEXT.menu,
      ),
    );
  }
}
