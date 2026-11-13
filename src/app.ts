// The game on screen: the menu, a round's questions and answers, and the summary.
import { BATTLE_PATH, canBattle, isBattleCode, type BattleSettings } from './battle';
import { Battle, PLAY_NAMES, battleSetup, type BattleAsk, type BattleHost } from './battle-ui';
import { Body, type Part } from './body';
import { factFor } from './facts';
import { MODE_NAMES, Round, pickQuestions, FIND_POINTS, type ModeId } from './game';
import { scoreTables, summaryScores } from './highscores';
import { BOARD_SYSTEMS, LEVELS, RANKED_MODES, categoryFor, categoryOf, roundName, scoresViewFor, systemName, type Category } from './leaderboard';
import { makeRng } from './rng';
import { MAX_SPEED_BONUS } from './scoring';
import { search, searchable } from './search';
import { bestKey, bestScore, loadSettings, markTutorialSeen, recordScore, saveSettings, tutorialSeen } from './settings';
import {
  LAYERS, LAYER_NAMES, LEVEL_NAMES, SYSTEM_NAMES,
  describe, entries, structureOf, type Entry, type Layer, type Level, type SystemId,
} from './structures';
import { STEPS, Tutorial, cameraMove, type Step, type TutorialEvent } from './tutorial';
import { View } from './view';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const MODE_HINTS: Record<ModeId, string> = {
  find: 'Tap the part you are asked for',
  name: 'Name the part that lights up',
  explore: 'Tap anything to learn its name',
};
const MODES: ModeId[] = ['find', 'name', 'explore'];
const LAYER_DOTS: Record<Layer, string> = { skin: '#c79676', muscle: '#c0443e', bone: '#e2d6b5', organ: '#d98a94', vessel: '#5a7be0', brain: '#e0b0c0' };
// What a round starts with on screen. The player can change it from there.
const START_LAYERS: Record<SystemId | 'all', Layer[]> = {
  all: ['muscle', 'bone', 'organ', 'vessel', 'brain'],
  skeleton: ['bone'],
  muscles: ['muscle', 'bone'],
  organs: ['organ', 'vessel'],
  brain: ['brain'],
};
const MENU_LAYERS: Layer[] = ['bone', 'organ', 'vessel', 'brain'];
// How to play starts with skin on, for its step that takes it off.
const TUTORIAL_LAYERS: Layer[] = ['skin', 'muscle', 'bone', 'organ'];

export class App implements BattleHost {
  private readonly body = new Body();
  private readonly view = new View($<HTMLCanvasElement>('scene'), this.body);
  private readonly settings = loadSettings();
  /** The kind of round on screen: the one picked in the menu, or a battle's. */
  private current: Category = this.settings;
  private round: Round | null = null;
  private readonly battles = new Battle(this);
  /** How the menu's round is played: alone, or as a battle against friends. Kept while the app is open. */
  private playBattle = false;
  /** In a battle's round, and the question of it that is waiting for an answer. */
  private inBattle = false;
  private asked: BattleAsk | null = null;
  private clockTimer = 0;
  /** The table the high scores screen is on. */
  private scoresView: Category = scoresViewFor(this.settings);
  private playing: ModeId | null = null;
  /** Every structure of the round's level, by name and by part. */
  private byName = new Map<string, Entry>();
  /** Every structure of every level, for Find in Explore. */
  private findable: Entry[] = [];
  private found: Entry[] = [];
  private foundIndex = 0;
  private peeling = false;
  private selected: string[] = [];
  private focused = false;
  /** When the question on screen appeared, for the speed bonus. */
  private askedAt = 0;
  private timer = 0;
  private toastTimer = 0;
  private coachTimer = 0;
  /** How to play, while it is on, and where it goes when it ends. */
  private tutorial: Tutorial | null = null;
  private afterTutorial: 'menu' | 'play' = 'menu';

  async start(): Promise<void> {
    this.buildMenu();
    this.buildHud();
    this.body.setLayers(MENU_LAYERS);
    this.view.autoRotate = true;
    this.view.onTap = (part) => this.tap(part);
    this.view.onHover = (part) => this.hover(part);
    try {
      await this.body.load((p) => {
        $('loading-bar').style.width = `${Math.round(p * 100)}%`;
      });
    } catch {
      $('loading-text').textContent = 'The body failed to load. Check your connection and reload.';
      return;
    }
    $('loading').hidden = true;
    $('credit').textContent = `3D model: ${this.body.credit}.`;
    this.showMenu();

    // A battle link: battle?b=CODE. Otherwise, back into a battle that was going on when the app closed.
    const link = location.pathname.endsWith(`/${BATTLE_PATH}`) ? (new URLSearchParams(location.search).get('b') ?? '').toUpperCase() : null;
    if (link === null) await this.battles.resume();
    else {
      history.replaceState(null, '', new URL('./', document.baseURI));
      if (isBattleCode(link)) await this.battles.open(link);
    }
  }

  // ---- Menu ----------------------------------------------------------------

  private buildMenu(): void {
    const choice = <T,>(host: string, values: readonly T[], label: (v: T) => string, current: () => T, set: (v: T) => void) => {
      const el = $(host);
      const draw = () => {
        el.replaceChildren(
          ...values.map((value) => {
            const button = document.createElement('button');
            button.innerHTML = label(value);
            button.setAttribute('aria-pressed', String(value === current()));
            button.onclick = () => {
              set(value);
              saveSettings(this.settings);
              draw();
              this.menuChanged();
            };
            return button;
          }),
        );
      };
      draw();
    };
    const s = this.settings;
    choice('modes', MODES, (m) => `${MODE_NAMES[m]}<small>${MODE_HINTS[m]}</small>`, () => s.mode, (m) => (s.mode = m));
    choice<SystemId | 'all'>('systems', BOARD_SYSTEMS, systemName, () => s.system, (v) => (s.system = v));
    choice<Level>('levels', [1, 2, 3], (l) => LEVEL_NAMES[l], () => s.level, (l) => (s.level = l));
    choice<'solo' | 'battle'>('plays', ['solo', 'battle'], (v) => PLAY_NAMES[v], () => (this.playBattle ? 'battle' : 'solo'), (v) => (this.playBattle = v === 'battle'));
    $('start').onclick = () => {
      if (this.playBattle && canBattle(s)) this.openOverlay(battleSetup(s, (settings, name) => this.battles.create(settings, name), () => this.showMenu()));
      else if (tutorialSeen()) this.play();
      else this.startTutorial('play');
    };
    $('how-to').onclick = () => this.startTutorial('menu');
    $('again').onclick = () => this.play();
    $('to-menu').onclick = () => this.showMenu();
    $('open-scores').onclick = () => this.showScores();
    $('scores-back').onclick = () => this.showMenu();
    $('scores-filter').onclick = () => this.setScoresFilter($('scores-filter').getAttribute('aria-expanded') !== 'true');
  }

  private menuChanged(): void {
    const s = this.settings;
    $('level-block').hidden = s.mode === 'explore';
    const best = s.mode === 'explore' ? 0 : bestScore(bestKey(s));
    $('best').textContent = best ? `Your best: ${best}` : '';
    // Solo or Battle is offered for rounds with a score, which Explore has none of.
    $('play-block').hidden = !canBattle(s);
    $('start').textContent = s.mode === 'explore' ? 'Explore' : this.playBattle ? 'Set up battle' : 'Start';
  }

  showMenu(): void {
    this.stop();
    $('hud').hidden = true;
    $('summary').hidden = true;
    $('scores').hidden = true;
    $('battle').hidden = true;
    $('menu').hidden = false;
    this.menuChanged();
    this.body.setLayers(MENU_LAYERS);
    this.view.inset = { top: 0, bottom: innerWidth < 760 ? $('menu').offsetHeight : 0 };
    this.view.home();
    this.view.autoRotate = true;
  }

  /** The high scores screen: it opens on the table of the round picked in the menu, and its filter moves it to any other. */
  private showScores(): void {
    this.scoresView = scoresViewFor(this.settings);
    $('menu').hidden = true;
    $('scores').hidden = false;
    this.setScoresFilter(false);
    this.drawScores();
    this.view.inset = { top: 0, bottom: innerWidth < 760 ? $('scores').offsetHeight : 0 };
    this.view.home();
  }

  private setScoresFilter(open: boolean): void {
    $('scores-filters').hidden = !open;
    $('scores-filter').setAttribute('aria-expanded', String(open));
  }

  /** The table on show, named above it, and the filter's choices. They don't change the round picked in the menu. */
  private drawScores(): void {
    const view = this.scoresView;
    $('scores-round').textContent = roundName(view);
    $('scores-tables').replaceChildren(scoreTables(categoryOf(view.mode, view.system, view.level)));
    const choice = <K extends keyof Category>(host: string, key: K, values: readonly Category[K][], label: (v: Category[K]) => string) =>
      $(host).replaceChildren(
        ...values.map((value) => {
          const button = document.createElement('button');
          button.textContent = label(value);
          button.setAttribute('aria-pressed', String(value === view[key]));
          button.onclick = () => {
            this.scoresView = { ...view, [key]: value };
            this.drawScores();
          };
          return button;
        }),
      );
    choice('scores-modes', 'mode', RANKED_MODES, (m) => MODE_NAMES[m]);
    choice('scores-systems', 'system', BOARD_SYSTEMS, systemName);
    choice('scores-levels', 'level', LEVELS, (l) => LEVEL_NAMES[l]);
  }

  // ---- A round -------------------------------------------------------------

  private stop(): void {
    clearTimeout(this.timer);
    this.stopClock();
    this.inBattle = false;
    this.asked = null;
    $('hud').classList.remove('battling');
    $('battle-board').replaceChildren();
    this.current = this.settings;
    this.round = null;
    this.playing = null;
    this.peeling = false;
    this.selected = [];
    this.closeSearch();
    this.focused = false;
    this.body.restore();
    this.body.clearGlows();
    this.body.setFocus(null);
    this.hideToast();
    this.tutorial = null;
    clearTimeout(this.coachTimer);
    $('coach').hidden = true;
    this.pointAt(undefined);
  }

  /** The structures a round of this kind draws its questions from. */
  poolFor(c: Pick<Category, 'system' | 'level'>): Entry[] {
    const all = entries([...this.body.parts.values()], c.level);
    return c.system === 'all' ? all : all.filter((e) => e.system === c.system);
  }

  /** Sets the level whose structures taps and names are read by, on screen from here on. */
  private useLevel(level: Level): void {
    this.byName = new Map(entries([...this.body.parts.values()], level).map((e) => [e.name, e]));
  }

  private play(): void {
    this.stop();
    const { mode, system, level } = this.settings;
    this.openHud(mode, mode === 'explore' && system === 'all' ? MENU_LAYERS : START_LAYERS[system]);

    if (mode === 'explore') {
      this.useLevel(3);
      if (!this.findable.length) this.findable = searchable([...this.body.parts.values()]);
      $('prompt-kind').textContent = 'Explore';
      $('prompt-text').textContent = 'Tap any part';
      $('progress').textContent = '';
      $('score').textContent = '';
      this.frameSystem();
      return;
    }
    this.useLevel(level);
    this.round = new Round(mode, pickQuestions(this.poolFor(this.settings), makeRng(Date.now())));
    this.frameSystem();
    this.ask();
  }

  /** The screen a round is played on, cleared, with these layers on. */
  private openHud(mode: ModeId, layers: Layer[], top = 84): void {
    this.playing = mode;
    $('menu').hidden = true;
    $('summary').hidden = true;
    $('scores').hidden = true;
    $('battle').hidden = true;
    $('hud').hidden = false;
    this.view.autoRotate = false;
    this.view.inset = { top, bottom: mode === 'name' ? 190 : 110 };
    this.body.setLayers(layers);
    this.drawLayers();
    for (const id of ['options', 'card', 'fact', 'next', 'skip', 'restore']) $(id).hidden = true;
    $('peel').hidden = mode === 'name';
    $('peel').setAttribute('aria-pressed', 'false');
    $('layers').hidden = mode === 'name';
    $('find').hidden = mode !== 'explore';
    $('tries').replaceChildren();
  }

  private frameSystem(): void {
    if (this.current.system === 'brain') this.view.flyToParts(this.partsOf(['brain']));
    else this.view.home();
  }

  private partsOf(layers: Layer[]): string[] {
    return [...this.body.parts.values()].filter((p) => layers.includes(p.layer)).map((p) => p.id);
  }

  private ask(): void {
    const round = this.round!;
    const question = round.question;
    if (!question) return this.finish();
    this.askedAt = Date.now();
    this.body.clearGlows();
    this.hideToast();
    $('next').hidden = true;
    $('fact').hidden = true;
    if (!this.inBattle) {
      $('progress').textContent = `${round.index + 1} / ${round.questions.length}`;
      $('score').textContent = String(round.score);
    }
    if (round.mode === 'find') {
      if (this.focused) this.body.setFocus(null);
      this.focused = false;
      $('prompt-kind').textContent = `Find · ${SYSTEM_NAMES[question.target.system]}`;
      $('prompt-text').textContent = question.target.name;
      $('skip').hidden = false;
      this.drawTries();
    } else {
      $('prompt-kind').textContent = 'Name It';
      $('prompt-text').textContent = 'What is lit up?';
      this.body.setFocus(question.target.parts);
      this.body.glow('pick', question.target.parts);
      this.view.flyToParts(question.target.parts);
      const options = $('options');
      options.hidden = false;
      options.replaceChildren(
        ...question.options.map((option) => {
          const button = document.createElement('button');
          button.textContent = option.name;
          button.onclick = () => this.choose(option.name, button);
          return button;
        }),
      );
    }
  }

  private drawTries(): void {
    const misses = this.round?.misses ?? 0;
    $('tries').replaceChildren(
      ...FIND_POINTS.map((_, i) => {
        const dot = document.createElement('i');
        if (i < misses) dot.className = 'used';
        return dot;
      }),
    );
  }

  /** The parts that make up the structure a part belongs to at the round's level, or just the part. */
  private groupOf(part: Part): string[] {
    const level = this.playing === 'explore' ? 3 : this.current.level;
    const structure = structureOf(part, level);
    return (structure && this.byName.get(structure.name)?.parts) || [part.id];
  }

  private hover(part: Part | null): void {
    const live = this.playing === 'explore' || (this.playing === 'find' && this.round && !this.round.resolved);
    this.view.canvas.classList.toggle('pointing', !!part && !!live);
    this.body.glow('hover', part && live ? this.groupOf(part).filter((id) => !this.selected.includes(id)) : []);
  }

  private tap(part: Part | null): void {
    if (this.playing === 'explore') return this.select(part);
    const round = this.round;
    if (!round || round.mode !== 'find' || round.resolved || !part) return;
    const group = this.groupOf(part);
    if (this.peeling) {
      this.body.peel(group);
      $('restore').hidden = false;
      return;
    }

    const target = round.question!.target;
    const outcome = round.answer(structureOf(part, this.current.level)?.name ?? null, Date.now() - this.askedAt);
    this.drawTries();
    this.body.glow('hover', []);
    if (outcome === 'correct') {
      const points = round.results[round.results.length - 1].points;
      this.body.glow('right', target.parts);
      this.toast(`${target.name}  +${points}`, 'right');
      this.resolved(true);
    } else {
      this.body.glow('wrong', group);
      const name = this.current.level === 3 ? describe(part) : structureOf(part, this.current.level)?.name ?? describe(part);
      if (outcome === 'wrong') {
        this.toast(`That's the ${lower(name)}`, 'wrong');
        clearTimeout(this.timer);
        this.timer = window.setTimeout(() => this.body.glow('wrong', []), 900);
      } else {
        this.reveal(`That's the ${lower(name)}. Here is the ${lower(target.name)}`);
      }
    }
  }

  /** Shows where the target is, after the tries ran out or the player gave up. */
  private reveal(message: string): void {
    const target = this.round!.question!.target;
    this.body.setFocus(target.parts);
    this.focused = true;
    this.body.glow('wrong', []);
    this.body.glow('right', target.parts);
    this.view.flyToParts(target.parts);
    this.toast(message, 'wrong', 0);
    this.resolved(false);
  }

  /** After an answer: a right one with nothing to read moves on by itself, anything else waits for Next. */
  private resolved(correct: boolean): void {
    const round = this.round!;
    $('skip').hidden = true;
    if (this.inBattle) return this.battleAnswered(correct);
    $('score').textContent = String(round.score);
    clearTimeout(this.timer);
    const fact = factFor(round.question!.target.name);
    $('fact').hidden = !fact;
    if (fact) {
      $('fact-does').textContent = fact.does;
      $('fact-fun').textContent = fact.fun;
    }
    if (correct && !fact) {
      this.timer = window.setTimeout(() => this.advance(), 1100);
    } else {
      $('next').hidden = false;
      $('next').textContent = round.index + 1 >= round.questions.length ? 'See your score' : 'Next';
    }
  }

  private advance(): void {
    this.round?.next();
    this.ask();
  }

  private choose(name: string, button: HTMLButtonElement): void {
    const round = this.round;
    if (!round || round.resolved) return;
    const target = round.question!.target;
    const outcome = round.answer(name, Date.now() - this.askedAt);
    if (outcome !== 'correct') button.classList.add('wrong');
    this.showName(target, outcome === 'correct');
  }

  /** Name It, once answered: which name was right. */
  private showName(target: Entry, correct: boolean): void {
    for (const b of $('options').querySelectorAll('button')) {
      b.disabled = true;
      if (b.textContent === target.name) b.classList.add('right');
    }
    this.body.glow('pick', []);
    this.body.glow(correct ? 'right' : 'wrong', target.parts);
    $('prompt-text').textContent = target.name;
    this.resolved(correct);
  }

  // ---- A battle's round (src/battle-ui.ts says when) ------------------------

  /** A screen over the game: a battle's setup, lobby or results, or its pause. */
  openOverlay(content: HTMLElement): void {
    for (const id of ['menu', 'summary', 'scores']) $(id).hidden = true;
    const panel = $('battle');
    panel.replaceChildren(content);
    panel.hidden = false;
    panel.scrollTop = 0;
    if ($('hud').hidden) this.view.inset = { top: 0, bottom: innerWidth < 760 ? panel.offsetHeight : 0 };
  }

  closeOverlay(): void {
    $('battle').hidden = true;
  }

  battleStart(s: BattleSettings): void {
    this.stop();
    this.current = s;
    this.inBattle = true;
    this.useLevel(s.level);
    // Room at the top for the scoreboard.
    this.openHud(s.mode, START_LAYERS[s.system], 124);
    $('hud').classList.add('battling');
    this.frameSystem();
    this.battleWait('Get ready!');
  }

  battleAsk(ask: BattleAsk): void {
    if (!this.inBattle) return;
    this.asked = ask;
    // Each question is a round of one, scored as in a round played alone.
    this.round = new Round(this.current.mode, [ask.question]);
    this.ask();
    // The bonus counts from when the question appeared for everyone, so a slow connection doesn't cost points.
    this.askedAt = ask.startsAt;
    $('progress').textContent = ask.progress;
    this.startClock(ask.startsAt, ask.endsAt);
  }

  battleWait(text: string): void {
    if (!this.inBattle) return;
    this.asked = null;
    this.round = null;
    this.stopClock();
    clearTimeout(this.timer);
    this.body.clearGlows();
    this.body.setFocus(null);
    this.focused = false;
    this.hideToast();
    $('options').hidden = true;
    $('skip').hidden = true;
    $('tries').replaceChildren();
    $('prompt-kind').textContent = 'Battle';
    $('prompt-text').textContent = text;
    $('progress').textContent = '';
  }

  battleTimeUp(): void {
    const round = this.round;
    if (!this.inBattle || !round || round.resolved) return;
    const target = round.question!.target;
    round.skip();
    if (round.mode === 'find') this.reveal(`Time’s up! Here is the ${lower(target.name)}`);
    else this.showName(target, false);
  }

  battleEnd(): void {
    if (!this.inBattle) return;
    this.stop();
    $('hud').hidden = true;
    this.body.setLayers(MENU_LAYERS);
    this.view.home();
    this.view.autoRotate = true;
  }

  battleHud(board: HTMLElement | null, score: number): void {
    if (!this.inBattle) return;
    $('battle-board').replaceChildren(...(board ? [board] : []));
    $('score').textContent = String(score);
  }

  /** A battle question is answered or over: the points go to the battle, which brings the next question for everyone. */
  private battleAnswered(correct: boolean): void {
    const points = this.round!.results[0].points;
    this.stopClock();
    clearTimeout(this.timer);
    if (correct && this.round!.mode === 'name') this.toast(`+${points}`, 'right');
    $('prompt-kind').textContent = 'Waiting for the others…';
    this.asked?.onAnswer(points);
    this.asked = null;
  }

  /** The bar that runs down a battle question's time. When it runs out here, the question is over on this screen. */
  private startClock(startsAt: number, endsAt: number): void {
    this.stopClock();
    const bar = $('clock');
    bar.hidden = false;
    const tick = () => {
      const left = endsAt - Date.now();
      bar.style.setProperty('--left', String(Math.min(1, Math.max(0, left / (endsAt - startsAt)))));
      bar.classList.toggle('low', left < 5000);
      if (left > 0) return;
      this.stopClock();
      this.battleTimeUp();
    };
    tick();
    if (!bar.hidden) this.clockTimer = window.setInterval(tick, 100);
  }

  private stopClock(): void {
    clearInterval(this.clockTimer);
    $('clock').hidden = true;
  }

  private finish(): void {
    const round = this.round!;
    const isBest = recordScore(bestKey(this.settings), round.score);
    this.body.clearGlows();
    this.body.setFocus(null);
    this.body.restore();
    $('hud').hidden = true;
    $('summary').hidden = false;
    // The title is for what was known, not how fast: the share of the points before the speed bonus.
    const share = round.results.reduce((sum, r) => sum + r.points - r.bonus, 0) / (round.maxScore - round.questions.length * MAX_SPEED_BONUS);
    $('summary-title').textContent = round.flawless ? 'Flawless!' : share >= 0.8 ? 'Great round' : share >= 0.5 ? 'Nice work' : 'Keep exploring';
    $('summary-score').innerHTML = `${round.score} <small>/ ${round.maxScore}</small>`;
    $('summary-best').textContent = isBest ? 'New personal best!' : `Your best: ${bestScore(bestKey(this.settings))}`;
    // The shared tables fill in once they load, and stay empty when they can't be reached.
    const category = categoryFor(this.settings);
    $('summary-scores').replaceChildren(...(category ? [summaryScores(category, round.score)] : []));
    $('summary-list').replaceChildren(
      ...round.results.map((result) => {
        const li = document.createElement('li');
        if (!result.points) li.className = 'missed';
        li.innerHTML = `<span></span><b>${result.points ? '+' + result.points : 'missed'}</b>`;
        li.firstElementChild!.textContent = result.target.name;
        // Tapping a line shows that structure on the body behind the summary.
        li.onclick = () => {
          this.body.setFocus(result.target.parts);
          this.body.glow('pick', result.target.parts);
          this.view.flyToParts(result.target.parts);
        };
        return li;
      }),
    );
    this.view.inset = { top: 0, bottom: innerWidth < 760 ? $('summary').offsetHeight : 0 };
    this.view.home();
  }

  // ---- Explore -------------------------------------------------------------

  private select(part: Part | null): void {
    if (this.peeling && part) {
      this.body.peel(this.groupOf(part));
      $('restore').hidden = false;
      this.told({ kind: 'peel' });
      return;
    }
    if (this.focused) {
      this.body.setFocus(null);
      this.focused = false;
    }
    this.selected = part ? this.groupOf(part) : [];
    this.body.glow('hover', []);
    this.body.glow('pick', this.selected);
    $('card').hidden = !part;
    if (part) this.drawCard(describe(part));
  }

  /** The card for what is selected: its name, its layers and how many parts it is. */
  private drawCard(name: string): void {
    const layers = [...new Set(this.selected.map((id) => this.body.parts.get(id)!.layer))];
    const count = this.selected.length;
    $('card').hidden = false;
    $('card-name').textContent = name;
    $('card-sub').textContent = `${layers.map((l) => LAYER_NAMES[l]).join(', ')}${count > 1 ? ` · ${count} parts` : ''}`;
    this.told({ kind: 'select' });
    $('card-focus').textContent = 'Isolate';
  }

  // ---- Find, in Explore ----------------------------------------------------

  private openSearch(): void {
    $('prompt').hidden = true;
    $('search').hidden = false;
    $('find').setAttribute('aria-expanded', 'true');
    const input = $<HTMLInputElement>('search-input');
    input.value = '';
    this.drawFound();
    input.focus();
  }

  private closeSearch(): void {
    $('prompt').hidden = false;
    $('search').hidden = true;
    $('search-results').hidden = true;
    $('find').setAttribute('aria-expanded', 'false');
    this.found = [];
  }

  private drawFound(): void {
    const query = $<HTMLInputElement>('search-input').value;
    this.found = search(this.findable, query);
    this.foundIndex = 0;
    const list = $('search-results');
    list.hidden = !query.trim();
    if (!this.found.length) {
      const li = document.createElement('li');
      li.className = 'none';
      li.textContent = 'Nothing by that name';
      list.replaceChildren(li);
      return;
    }
    list.replaceChildren(
      ...this.found.map((entry, i) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(i === 0));
        li.innerHTML = '<span></span><small></small>';
        li.firstElementChild!.textContent = entry.name;
        li.lastElementChild!.textContent = SYSTEM_NAMES[entry.system];
        // mousedown, so the input keeps its focus until the choice is made
        li.onmousedown = (event) => event.preventDefault();
        li.onclick = () => this.showFound(entry);
        return li;
      }),
    );
  }

  private moveFound(by: number): void {
    if (!this.found.length) return;
    this.foundIndex = (this.foundIndex + by + this.found.length) % this.found.length;
    const items = $('search-results').querySelectorAll('li');
    items.forEach((li, i) => li.setAttribute('aria-selected', String(i === this.foundIndex)));
    items[this.foundIndex].scrollIntoView({ block: 'nearest' });
  }

  /** Shows a structure where it is: its layers on, its parts put back if peeled, lit up, and the camera on it. */
  private showFound(entry: Entry): void {
    this.closeSearch();
    $<HTMLInputElement>('search-input').blur();
    if (this.focused) {
      this.body.setFocus(null);
      this.focused = false;
    }
    const layers = new Set(entry.parts.map((id) => this.body.parts.get(id)!.layer));
    for (const layer of layers) if (!this.body.isLayerOn(layer)) this.body.setLayer(layer, true);
    this.drawLayers();
    this.body.unpeel(entry.parts);
    $('restore').hidden = this.body.peeledCount === 0;
    this.selected = entry.parts;
    this.body.glow('hover', []);
    this.body.glow('pick', this.selected);
    this.drawCard(entry.name);
    this.view.flyToParts(this.selected);
  }

  // ---- The HUD's buttons ---------------------------------------------------

  private buildHud(): void {
    // In a battle's round the ✕ pauses this screen and offers to leave, since the battle goes on.
    $('quit').onclick = () => (this.battles.inRound ? this.battles.pause() : this.showMenu());
    $('find').onclick = () => ($('search').hidden ? this.openSearch() : this.closeSearch());
    $('search-input').oninput = () => this.drawFound();
    $('search').onsubmit = (event) => {
      event.preventDefault();
      const entry = this.found[this.foundIndex];
      if (entry) this.showFound(entry);
    };
    $('search-input').onkeydown = (event) => {
      if (event.key === 'ArrowDown') this.moveFound(1);
      else if (event.key === 'ArrowUp') this.moveFound(-1);
      else if (event.key === 'Escape') this.closeSearch();
      else return;
      event.preventDefault();
    };
    $('home').onclick = () => {
      this.view.home();
      this.told({ kind: 'home' });
    };
    $('next').onclick = () => this.advance();
    $('skip').onclick = () => {
      const round = this.round;
      if (!round || round.resolved) return;
      const name = round.question!.target.name;
      round.skip();
      this.reveal(`Here is the ${lower(name)}`);
    };
    $('peel').onclick = () => {
      this.peeling = !this.peeling;
      $('peel').setAttribute('aria-pressed', String(this.peeling));
      // How to play says it in its own card, where the toast would cover it.
      if (this.peeling && !this.tutorial) this.toast('Tap parts to take them away', '', 1800);
    };
    $('restore').onclick = () => {
      this.body.restore();
      $('restore').hidden = true;
      this.told({ kind: 'restore' });
    };
    $('card-focus').onclick = () => {
      if (!this.selected.length) return;
      this.focused = !this.focused;
      this.body.setFocus(this.focused ? this.selected : null);
      $('card-focus').textContent = this.focused ? 'Show all' : 'Isolate';
      if (this.focused) this.view.flyToParts(this.selected);
      this.told({ kind: 'isolate', on: this.focused });
    };
    $('card-hide').onclick = () => {
      this.body.peel(this.selected);
      $('restore').hidden = false;
      this.select(null);
      this.told({ kind: 'peel' });
    };
    $('coach-skip').onclick = () => this.endTutorial();
    $('coach-go').onclick = () => this.endTutorial();
    this.watchCamera();
  }

  private drawLayers(): void {
    $('layers').replaceChildren(
      ...LAYERS.map((layer) => {
        const button = document.createElement('button');
        button.textContent = LAYER_NAMES[layer];
        button.dataset.layer = layer;
        button.style.setProperty('--dot', LAYER_DOTS[layer]);
        button.setAttribute('aria-pressed', String(this.body.isLayerOn(layer)));
        button.onclick = () => {
          const on = !this.body.isLayerOn(layer);
          this.body.setLayer(layer, on);
          button.setAttribute('aria-pressed', String(on));
          this.told({ kind: 'layer', layer, on });
        };
        return button;
      }),
    );
  }

  // ---- How to play ---------------------------------------------------------

  /** Starts How to play on the real body. Afterwards it goes back to the menu, or on to the round picked there. */
  private startTutorial(after: 'menu' | 'play'): void {
    this.stop();
    markTutorialSeen();
    this.afterTutorial = after;
    this.openHud('explore', TUTORIAL_LAYERS, 150);
    $('find').hidden = true;
    this.useLevel(3);
    this.tutorial = new Tutorial();
    $('prompt-kind').textContent = 'How to play';
    $('score').textContent = '';
    $('coach').hidden = false;
    this.view.home();
    this.showStep(this.tutorial.step);
  }

  private showStep(step: Step): void {
    const tutorial = this.tutorial!;
    const last = tutorial.finished;
    // Each step starts from where it makes sense: Skin on to take it off, nothing isolated to peel.
    if (step.id === 'layers' && !this.body.isLayerOn('skin')) {
      this.body.setLayer('skin', true);
      this.drawLayers();
    }
    $('prompt-text').textContent = step.title;
    $('progress').textContent = last ? '' : `${tutorial.index + 1} / ${STEP_COUNT}`;
    $('coach').classList.remove('done');
    $('coach-text').textContent = matchMedia('(hover: none)').matches ? step.touch : step.mouse;
    $('coach-skip').hidden = last;
    $('coach-go').hidden = !last;
    $('coach-go').textContent = this.afterTutorial === 'play' ? (this.settings.mode === 'explore' ? 'Explore' : 'Start the round') : 'Back to the menu';
    this.pointAt(step.target);
  }

  /** Passes what the player did to How to play, and moves on when it finishes a step. */
  private told(event: TutorialEvent): void {
    const tutorial = this.tutorial;
    if (!tutorial || tutorial.finished || $('coach').classList.contains('done') || !tutorial.record(event)) return;
    $('coach').classList.add('done');
    this.pointAt(undefined);
    clearTimeout(this.coachTimer);
    this.coachTimer = window.setTimeout(() => {
      if (this.tutorial === tutorial) this.showStep(tutorial.next());
    }, 900);
  }

  private endTutorial(): void {
    const play = this.afterTutorial === 'play';
    this.stop();
    if (play) this.play();
    else this.showMenu();
  }

  /** Rings the button a step is about. */
  private pointAt(selector: string | undefined): void {
    for (const el of document.querySelectorAll('.coach-target')) el.classList.remove('coach-target');
    if (selector) document.querySelector(selector)?.classList.add('coach-target');
  }

  /** Tells How to play how the player turned, zoomed and moved the camera. Flights to a part don't count. */
  private watchCamera(): void {
    const { camera, controls } = this.view;
    const snap = () => ({ position: camera.position.clone(), target: controls.target.clone() });
    let last = snap();
    // A gesture goes on moving the camera for a moment after the finger lifts.
    let until = 0;
    controls.addEventListener('start', () => (until = Infinity));
    controls.addEventListener('end', () => (until = performance.now() + 700));
    controls.addEventListener('change', () => {
      const now = snap();
      if (this.tutorial && performance.now() < until) this.told({ kind: 'camera', move: cameraMove(last, now) });
      last = now;
    });
  }

  private toast(text: string, tone: '' | 'right' | 'wrong', ms = 1600): void {
    const el = $('toast');
    el.hidden = true;
    void el.offsetWidth; // restart the animation
    el.textContent = text;
    el.className = tone;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    if (ms) this.toastTimer = window.setTimeout(() => (el.hidden = true), ms);
  }
  private hideToast(): void {
    clearTimeout(this.toastTimer);
    $('toast').hidden = true;
  }
}

const STEP_COUNT = STEPS.length - 1;

// "That's the Shinbone (tibia)" reads better as "the shinbone (tibia)", but "Achilles" keeps its capital.
function lower(name: string): string {
  return /^(Achilles|Adam|IT )/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}
