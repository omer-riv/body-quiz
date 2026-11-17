// Sharing a score as a challenge link, opening one, and how a round did against it.
import { h } from './dom';
import { saveName, savedName } from './highscores';
import { MAX_NAME_LENGTH, cleanName } from './leaderboard';
import { A_FRIEND, CHALLENGE_PATH, beatLine, challengeQuery, challengeRound, shareMessage, type Challenge } from './share';

const TEXT = {
  challengeFrom: (name: string) => `A challenge from ${name}`,
  sameQuestions: 'The same questions, in the same order.',
  ask: 'Can you beat it?',
  accept: 'Accept challenge',
  notNow: 'Not now',
  shareScore: 'Challenge a friend',
  nameHint: 'Your name, so they know who it’s from',
  yourName: 'Your name',
  copied: 'Link copied. Paste it to a friend!',
  copyByHand: 'Copy this link and send it to a friend:',
  beat: (name: string, score: string) => `You beat ${name}’s ${score}!`,
  tied: (name: string, score: string) => `A tie with ${name} at ${score}. So close!`,
  lost: (name: string, score: string) => `${name} is still ahead with ${score}. Try again?`,
};

export const challengeUrl = (c: Challenge) => new URL(`${CHALLENGE_PATH}?${challengeQuery(c)}`, document.baseURI).href;

/** The screen a challenge link opens: whose score, on which round, and a button to play it. */
export function challengeScreen(c: Challenge, onAccept: () => void, onDecline: () => void): HTMLElement {
  return h(
    'div',
    { class: 'battle challenge' },
    h('h1', null, TEXT.challengeFrom(c.name || A_FRIEND)),
    h('p', { class: 'challenge-score' }, c.score.toLocaleString('en-US'), h('small', null, c.score === 1 ? ' point' : ' points')),
    h('p', { class: 'battle-round' }, challengeRound(c)),
    c.beat && h('p', { class: 'challenge-beat' }, beatLine(c.beat)),
    h('p', { class: 'battle-intro' }, TEXT.sameQuestions),
    h('p', { class: 'challenge-ask' }, TEXT.ask),
    h('button', { class: 'primary', onclick: onAccept }, TEXT.accept),
    h('button', { class: 'ghost', onclick: onDecline }, TEXT.notNow),
  );
}

/** How a finished round did against the challenge it was played for. */
export function challengeResult(c: Challenge, score: number): HTMLElement {
  const name = c.name || A_FRIEND;
  const theirs = c.score.toLocaleString('en-US');
  const [tone, text] = score > c.score ? ['good', TEXT.beat(name, theirs)] : score === c.score ? ['', TEXT.tied(name, theirs)] : ['bad', TEXT.lost(name, theirs)];
  return h('p', { class: `challenge-result ${tone}` }, text);
}

/**
 * The "Challenge a friend" button. It asks for a name first when there is none
 * saved, then opens the phone's share sheet, or copies the link where there is none.
 */
export function shareBox(challenge: Omit<Challenge, 'name'>): HTMLElement {
  const root = h('div', { class: 'share-box' });
  const note = h('p', { class: 'scores-note', 'aria-live': 'polite' });

  const share = async (name: string) => {
    const c: Challenge = { ...challenge, name };
    const url = challengeUrl(c);
    const text = `${shareMessage(c)}\n${url}`;
    note.textContent = '';
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        // Closing the share sheet isn't a failure.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      note.textContent = TEXT.copied;
    } catch {
      // No clipboard either: show the link to copy by hand.
      const field = h('input', { class: 'field', type: 'text', readonly: true, value: url, 'aria-label': TEXT.copyByHand, onfocus: (e: Event) => (e.target as HTMLInputElement).select() });
      root.replaceChildren(h('p', { class: 'scores-note' }, TEXT.copyByHand), field);
      field.focus();
    }
  };

  const askName = () => {
    const input = h('input', {
      type: 'text',
      maxlength: String(MAX_NAME_LENGTH),
      placeholder: TEXT.yourName,
      'aria-label': TEXT.nameHint,
      autocomplete: 'nickname',
      spellcheck: 'false',
      enterkeyhint: 'send',
    });
    const form = h(
      'form',
      {
        class: 'scores-form',
        onsubmit: (e: Event) => {
          e.preventDefault();
          const name = cleanName(input.value);
          if (name) {
            saveName(name);
            // Saves typing it again for the high scores.
            for (const other of document.querySelectorAll<HTMLInputElement>('#summary-scores input')) other.value ||= name;
          }
          void share(name);
        },
      },
      input,
      h('button', { class: 'primary', type: 'submit' }, 'Send'),
    );
    root.replaceChildren(h('p', { class: 'scores-note' }, TEXT.nameHint), form, note);
    input.focus();
  };

  const open = () => {
    const name = savedName();
    if (name) void share(name);
    else askName();
  };
  root.append(h('button', { class: 'share', type: 'button', onclick: open }, `↗ ${TEXT.shareScore}`), note);
  return root;
}

