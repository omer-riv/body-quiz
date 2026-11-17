// The image in a challenge link's preview: WhatsApp and other messaging apps
// show it as a card with the score. It is drawn here as an SVG and turned into
// a PNG (worker/render.ts), since those apps don't show SVG previews.
import { A_FRIEND, beatLine, challengeRound, type Challenge } from '../src/share';

export const IMAGE_WIDTH = 1200;
export const IMAGE_HEIGHT = 630;
const FONT = 'Rubik';

const escapeXml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/**
 * A font size that fits `text` in `width`: Rubik's characters average a bit
 * under 0.6 em, so this errs on the small side rather than overflowing.
 */
function fitSize(text: string, width: number, max: number, perChar = 0.6): number {
  const chars = [...text].length || 1;
  return Math.max(14, Math.min(max, Math.floor(width / (chars * perChar))));
}

/** The figure from the game's icon (public/icons/icon.svg), drawn on its 512 grid. */
const FIGURE = `<g fill="none" stroke="#35c8ff" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="256" cy="256" r="150" stroke-width="10" opacity="0.35"/>
    <g stroke-width="26">
      <path d="M256 196 V300"/>
      <path d="M200 214 Q256 196 312 214"/>
      <path d="M204 216 L182 290"/>
      <path d="M308 216 L330 290"/>
      <path d="M232 304 L222 380"/>
      <path d="M280 304 L290 380"/>
      <path d="M228 300 H284"/>
    </g>
  </g>
  <circle cx="256" cy="156" r="28" fill="#35c8ff"/>`;

/** The preview image, as SVG. */
export function challengeSvg(c: Challenge): string {
  const panel = { x: 40, y: 40, w: 640, h: IMAGE_HEIGHT - 80 };
  const pad = 48;
  const x = panel.x + pad;
  const textWidth = panel.w - pad * 2;
  const text = (y: number, size: number, weight: number, fill: string, content: string) =>
    `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(content)}</text>`;

  const who = `${c.name || A_FRIEND}’s score`;
  const score = c.score.toLocaleString('en-US');
  const round = challengeRound(c);
  const beat = c.beat ? beatLine(c.beat) : '';
  // Top to bottom: whose score, the score, its unit, the round, and what it beat.
  const scoreSize = fitSize(score, textWidth, beat ? 130 : 150, 0.62);
  const lines = { who: 180, score: 190 + scoreSize * 0.85, unit: 0, round: 0, beat: 0 };
  lines.unit = lines.score + 48;
  lines.round = lines.unit + 50;
  lines.beat = lines.round + 42;
  const invite = 'Same questions. Can you beat it?';
  const pillSize = 28;
  const pillWidth = Math.min(textWidth, Math.round([...invite].length * pillSize * 0.56 + 64));
  const pillY = panel.y + panel.h - pad - 60;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" viewBox="0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}" font-family="${FONT}">
  <defs>
    <radialGradient id="bg" cx="78%" cy="45%" r="75%">
      <stop offset="0" stop-color="#24344c"/>
      <stop offset="0.55" stop-color="#0c1320"/>
      <stop offset="1" stop-color="#05070c"/>
    </radialGradient>
  </defs>
  <rect width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="url(#bg)"/>
  <g transform="translate(${940 - 256 * 1.6} ${IMAGE_HEIGHT / 2 - 256 * 1.6}) scale(1.6)">
  ${FIGURE}
  </g>
  <rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${panel.h}" rx="28" fill="#0d131e" fill-opacity="0.85" stroke="#a0beff" stroke-opacity="0.16" stroke-width="2"/>
  <g transform="translate(${x} 78) scale(0.0859)">
    <rect width="512" height="512" rx="110" fill="#05070c"/>
    ${FIGURE}
  </g>
  <text x="${x + 58}" y="110" font-size="30" font-weight="700" fill="#e9eef7">Vitals</text>
  ${text(lines.who, fitSize(who, textWidth, 40), 500, '#93a0b8', who)}
  ${text(lines.score, scoreSize, 800, '#e9eef7', score)}
  ${text(lines.unit, 34, 700, '#35c8ff', c.score === 1 ? 'point' : 'points')}
  ${text(lines.round, fitSize(round, textWidth, 30, 0.56), 500, '#e9eef7', round)}
  ${beat ? text(lines.beat, fitSize(beat, textWidth, 28, 0.56), 700, '#2fe28a', beat) : ''}
  <rect x="${x}" y="${pillY}" width="${pillWidth}" height="60" rx="30" fill="#35c8ff"/>
  <text x="${x + pillWidth / 2}" y="${pillY + 40}" font-size="${pillSize}" font-weight="700" fill="#03121c" text-anchor="middle">${escapeXml(invite)}</text>
</svg>`;
}
