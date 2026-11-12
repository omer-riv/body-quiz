// The shared high-score tables: talking to /api/scores, and drawing the tables.
import { MAX_NAME_LENGTH, PERIODS, wouldPlace, type Boards, type Entry, type Period, type Placement } from './leaderboard';

const NAME_KEY = 'body-quiz:name';
const TIMEOUT_MS = 8000;

const TEXT = {
  highScores: 'High scores',
  periods: { week: 'This week', month: 'This month', all: 'All time' } as Record<Period, string>,
  rankIn: (rank: number, period: Period) => `#${rank} ${{ week: 'this week', month: 'this month', all: 'all time' }[period]}`,
  madeHighScores: 'You made the high scores!',
  yourName: 'Your name',
  submitScore: 'Submit',
  submitFailed: 'Couldn’t send your score. Try again?',
  notPlaced: 'Saved, but other scores got ahead of it.',
  noScoresYet: 'No scores yet. Be the first!',
  scoresOffline: 'High scores aren’t available right now.',
  loadingScores: 'Loading high scores…',
};

type Child = Node | string | null | undefined | false;

/** Tiny element builder: h('button', { class: 'x', onclick }, 'Label'). */
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> | null = null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value as EventListener);
    else if (key === 'class') el.className = String(value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  for (const child of children.flat()) if (child) el.append(child);
  return el;
}

async function api<T>(init: RequestInit & { query?: string } = {}): Promise<T> {
  const url = new URL('api/scores', document.baseURI);
  if (init.query) url.search = init.query;
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'content-type': 'application/json' } });
  if (!res.ok) throw new Error(`Scores request failed: ${res.status}`);
  // Without the Worker (npm run dev), the path answers with the game's page, and this throws.
  return (await res.json()) as T;
}

export const fetchBoards = (category: string) => api<Boards>({ query: new URLSearchParams({ category }).toString() });

export const submitScore = (category: string, name: string, score: number) =>
  api<Placement>({ method: 'POST', body: JSON.stringify({ category, name, score }) });

/** The name typed last time, so it is ready for the next score. */
export function savedName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // Not remembered; it just has to be typed again.
  }
}

interface TablesOptions {
  /** The tables, when already loaded; otherwise they are fetched. */
  boards?: Boards;
  /** An entry to pick out, such as the score just submitted. */
  highlight?: number;
  period?: Period;
}

/** The three tables behind This week / This month / All time tabs. */
export function scoreTables(category: string, opts: TablesOptions = {}): HTMLElement {
  const root = h('div', { class: 'scores' });
  const year = new Date().getFullYear();
  const day = (at: number) =>
    new Date(at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: new Date(at).getFullYear() === year ? undefined : 'numeric' });
  let period = opts.period ?? 'week';
  let boards = opts.boards;

  const row = (e: Entry, i: number) =>
    h(
      'li',
      { class: e.id === opts.highlight ? 'mine' : null },
      h('span', { class: 'scores-rank' }, String(i + 1)),
      h('span', { class: 'scores-name' }, e.name),
      h('span', { class: 'scores-score' }, e.score.toLocaleString('en')),
      h('span', { class: 'scores-date' }, day(e.at)),
    );

  const render = () => {
    const tabs = h(
      'div',
      { class: 'choices scores-tabs', role: 'tablist' },
      PERIODS.map((p) =>
        h(
          'button',
          {
            role: 'tab',
            'aria-selected': String(p === period),
            'aria-pressed': String(p === period),
            onclick: () => {
              period = p;
              render();
            },
          },
          TEXT.periods[p],
        ),
      ),
    );
    const entries = boards?.[period];
    const body = !boards
      ? h('p', { class: 'scores-note' }, TEXT.loadingScores)
      : entries!.length
        ? h('ol', { class: 'scores-list' }, entries!.map(row))
        : h('p', { class: 'scores-note' }, TEXT.noScoresYet);
    root.replaceChildren(tabs, body);
  };

  render();
  if (!boards) {
    fetchBoards(category)
      .then((b) => {
        boards = b;
        render();
      })
      .catch((err: unknown) => {
        console.warn(err);
        root.replaceChildren(h('p', { class: 'scores-note' }, TEXT.scoresOffline));
      });
  }
  return root;
}

/**
 * The high-score part of the round summary: when the score would make a
 * table, a name box to submit it; then the tables, with the new score picked
 * out. Empty when the scores can't be reached, since the round's own score
 * and the personal best are on the summary anyway.
 */
export function summaryScores(category: string, score: number): HTMLElement {
  const root = h('div', { class: 'summary-scores' }, h('p', { class: 'scores-note' }, TEXT.loadingScores));

  const showTables = (placement: Placement | Pick<Placement, 'boards'>) => {
    const placed = 'ranks' in placement ? placement : undefined;
    const ranks = placed ? PERIODS.filter((p) => placed.ranks[p] !== null).map((p) => TEXT.rankIn(placed.ranks[p]!, p)) : [];
    // Open on the widest table the score made, which is the most impressive one.
    const period = [...PERIODS].reverse().find((p) => placed?.ranks[p] != null) ?? 'week';
    root.replaceChildren(
      h('h2', null, TEXT.highScores),
      placed ? h('p', { class: 'scores-placed' }, ranks.length ? ranks.join(' · ') : TEXT.notPlaced) : '',
      scoreTables(category, { boards: placement.boards, highlight: placed?.id, period }),
    );
  };

  const showForm = (boards: Boards) => {
    const input = h('input', {
      type: 'text',
      value: savedName(),
      maxlength: MAX_NAME_LENGTH,
      placeholder: TEXT.yourName,
      'aria-label': TEXT.yourName,
      autocomplete: 'nickname',
      enterkeyhint: 'send',
      required: true,
    });
    const button = h('button', { class: 'primary', type: 'submit' }, TEXT.submitScore);
    const feedback = h('p', { class: 'scores-note bad', 'aria-live': 'polite' });
    const form = h(
      'form',
      {
        class: 'scores-form',
        onsubmit: async (e: Event) => {
          e.preventDefault();
          const name = input.value.trim();
          if (!name) return input.focus();
          button.disabled = input.disabled = true;
          feedback.textContent = '';
          try {
            const placement = await submitScore(category, name, score);
            saveName(name);
            showTables(placement);
          } catch (err) {
            console.warn(err);
            feedback.textContent = TEXT.submitFailed;
            button.disabled = input.disabled = false;
          }
        },
      },
      input,
      button,
    );
    root.replaceChildren(h('h2', null, TEXT.madeHighScores), form, feedback, scoreTables(category, { boards }));
  };

  fetchBoards(category)
    .then((boards) => {
      if (PERIODS.some((p) => wouldPlace(boards[p], score))) showForm(boards);
      else showTables({ boards });
    })
    .catch((err: unknown) => {
      console.warn(err);
      root.replaceChildren();
    });
  return root;
}
