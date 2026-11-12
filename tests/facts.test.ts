import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FACTS } from '../src/facts';
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
