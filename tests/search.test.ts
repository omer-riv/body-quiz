import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { search, searchable } from '../src/search';
import { entries, type PartInfo } from '../src/structures';

const parts: PartInfo[] = JSON.parse(readFileSync('public/body/manifest.json', 'utf8')).parts;
const list = searchable(parts);
const names = (query: string) => search(list, query).map((e) => e.name);

describe('search', () => {
  it('has every level\'s structures, each name once', () => {
    const all = new Set(list.map((e) => e.name));
    for (const level of [1, 2, 3] as const) for (const e of entries(parts, level)) expect(all.has(e.name), e.name).toBe(true);
    expect(all.size).toBe(list.length);
  });

  it('finds a structure by any word of its name', () => {
    expect(names('femur')).toContain('Thigh bone (femur)');
    expect(names('thigh')).toContain('Thigh bone (femur)');
    expect(names('Skull')[0]).toBe('Skull');
    expect(names('sphenoid')).toContain('Sphenoid bone');
    expect(names('adams apple')).toContain("Adam's apple (thyroid cartilage)");
  });

  it('puts names that start with what was typed first', () => {
    expect(names('bic')[0]).toBe('Biceps');
  });

  it('covers every part a name has at any level', () => {
    const ribs = list.find((e) => e.name === 'Ribs')!;
    for (const level of [1, 2, 3] as const) {
      for (const id of entries(parts, level).find((e) => e.name === 'Ribs')!.parts) expect(ribs.parts).toContain(id);
    }
  });

  it('finds nothing for nothing', () => {
    expect(search(list, '  ')).toEqual([]);
    expect(search(list, 'xyzzy')).toEqual([]);
  });

  it('stops at the limit', () => {
    expect(search(list, 'bone', 5).length).toBe(5);
  });
});
