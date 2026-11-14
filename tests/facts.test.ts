import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLUES, FACTS } from '../src/facts';
import { entries, type Level, type PartInfo } from '../src/structures';

const parts: PartInfo[] = JSON.parse(readFileSync('public/body/manifest.json', 'utf8')).parts;
const LEVELS: Level[] = [1, 2, 3];
// Every structure's name, with the easiest level it is asked at.
const structures = new Map<string, Level>();
for (const level of LEVELS) for (const e of entries(parts, level)) if (!structures.has(e.name)) structures.set(e.name, level);

describe('facts', () => {
  it('are each about a structure the game asks for', () => {
    for (const name of Object.keys(FACTS)) expect(structures.has(name), `"${name}" is not a structure's name`).toBe(true);
  });

  it('are two short sentences that fit a phone', () => {
    for (const [name, fact] of Object.entries(FACTS)) {
      for (const text of [fact.does, fact.fun]) {
        expect(text.length, name).toBeGreaterThan(20);
        expect(text.length, `${name}: "${text}" is too long`).toBeLessThanOrEqual(140);
        expect(text, name).toMatch(/^[A-Z].*[.!?]$/);
      }
    }
  });

  // FACTS_REPORT=1 (npm run missing-facts) prints what is left to write, easiest level first.
  it('lists the structures still without one', () => {
    const missing = [...structures].filter(([name]) => !FACTS[name]);
    expect(missing.length).toBe(structures.size - Object.keys(FACTS).length);
    if (!process.env.FACTS_REPORT) return;
    for (const level of LEVELS) {
      const names = missing.filter(([, l]) => l === level).map(([name]) => name);
      console.log(`\nFirst asked at level ${level}: ${names.length} without a fact\n` + names.map((n) => '  ' + n).join('\n'));
    }
  });
});

describe('clues', () => {
  const brain = (level: Level) => entries(parts, level).filter((e) => e.system === 'brain');

  it('has one for every structure of the brain at every level, and for nothing else', () => {
    const asked = new Set(LEVELS.flatMap((level) => brain(level).map((e) => e.name)));
    for (const name of asked) expect(CLUES[name], `"${name}" has no clue`).toBeTruthy();
    for (const name of Object.keys(CLUES)) expect(asked.has(name), `"${name}" is not a structure of the brain`).toBe(true);
  });

  it('are each the end of "Which part of the brain …?", short enough for the top of a phone', () => {
    for (const [name, clue] of Object.entries(CLUES)) {
      expect(clue, name).toMatch(/^[a-z].*[a-z]$/);
      expect(clue.length, `${name}: "${clue}" is too long`).toBeLessThanOrEqual(50);
    }
    expect(new Set(Object.values(CLUES)).size).toBe(Object.keys(CLUES).length);
  });

  it('do not give the answer away', () => {
    for (const [name, clue] of Object.entries(CLUES)) {
      const words = name.toLowerCase().replace(/[()']/g, '').split(' ').filter((w) => w.length > 4 && !['gyrus', 'cortex', 'gland', 'lobule'].includes(w));
      for (const word of words) expect(clue.includes(word), `"${clue}" names the ${name}`).toBe(false);
    }
  });
});

