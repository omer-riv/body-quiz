import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SYSTEMS, baseName, describe as label, entries, structureOf, type Level, type PartInfo } from '../src/structures';

const manifest = JSON.parse(readFileSync('public/body/manifest.json', 'utf8'));
const parts: PartInfo[] = manifest.parts;
const LEVELS: Level[] = [1, 2, 3];
const names = (level: Level) => entries(parts, level).map((e) => e.name);

describe('the body', () => {
  it('has every layer, and data for every part', () => {
    for (const layer of ['skin', 'muscle', 'bone', 'organ', 'vessel', 'brain']) {
      expect(parts.some((p) => p.layer === layer), layer).toBe(true);
      expect(readFileSync(`public/body/${layer}.bin`).length, layer).toBe(manifest.layers[layer]);
    }
    expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length);
  });
});

describe('structures', () => {
  it('drops the side from a name', () => {
    expect(baseName('left fifth rib')).toBe('fifth rib');
    expect(baseName('long head of right biceps brachii')).toBe('long head of biceps brachii');
    expect(baseName('colon, nsn')).toBe('colon');
  });

  it('asks about every system at every level, with enough to fill a round', () => {
    for (const level of LEVELS) {
      const all = entries(parts, level);
      for (const system of SYSTEMS) {
        expect(all.filter((e) => e.system === system).length, `${system} at ${level}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('has no two structures with one name at a level', () => {
    for (const level of LEVELS) expect(new Set(names(level)).size).toBe(names(level).length);
  });

  it('groups by level: the skull at Easy, its bones after', () => {
    const frontal = parts.find((p) => p.name === 'frontal bone')!;
    expect(structureOf(frontal, 1)?.name).toBe('Skull');
    expect(structureOf(frontal, 2)?.name).toBe('Frontal bone');
    const sphenoid = parts.find((p) => p.name === 'sphenoid bone')!;
    expect(structureOf(sphenoid, 2)).toBeNull();
    expect(structureOf(sphenoid, 3)?.name).toBe('Sphenoid bone');
  });

  it('takes both sides and all heads as one structure', () => {
    const biceps = entries(parts, 1).find((e) => e.name === 'Biceps')!;
    expect(biceps.parts.length).toBe(4);
    expect(entries(parts, 1).find((e) => e.name === 'Ribs')!.parts.length).toBeGreaterThanOrEqual(24);
  });

  it('keeps the well-known structures at Easy', () => {
    for (const name of ['Skull', 'Spine', 'Ribs', 'Thigh bone (femur)', 'Heart', 'Lungs', 'Liver', 'Stomach', 'Kidneys', 'Biceps', 'Quadriceps', 'Cerebellum', 'Frontal lobe']) {
      expect(names(1), name).toContain(name);
    }
  });

  it('names every muscle and bone at Hard, without a side or a "head of"', () => {
    for (const part of parts) {
      if (part.layer !== 'bone' && part.layer !== 'muscle') continue;
      const name = structureOf(part, 3)?.name;
      expect(name, part.name).toBeTruthy();
      expect(name, part.name).not.toMatch(/\b(left|right)\b| head of /i);
    }
  });

  it('asks for the lobes of the brain at Easy and Medium, and for their folds and regions at Hard', () => {
    const brain = (level: Level) => entries(parts, level).filter((e) => e.system === 'brain');
    for (const level of [1, 2] as Level[]) {
      const lobes = brain(level).filter((e) => / lobe$/.test(e.name));
      expect(lobes.map((e) => e.name).sort()).toEqual(['Frontal lobe', 'Occipital lobe', 'Parietal lobe', 'Temporal lobe']);
      // Every part a Hard round asks about on the cortex belongs to a lobe before that.
      const inLobes = new Set(lobes.flatMap((e) => e.parts));
      for (const name of ['Primary visual cortex', "Broca's area", "Wernicke's area", 'Inferior frontal gyrus', 'Fusiform gyrus', 'Angular gyrus']) {
        for (const id of brain(3).find((e) => e.name === name)!.parts) expect(inLobes.has(id), name).toBe(true);
      }
    }
    expect(brain(3).some((e) => / lobe$/.test(e.name))).toBe(false);
    expect(brain(3).length).toBeGreaterThanOrEqual(40);
  });

  it('has the regions the build cuts out: the visual cortex on both sides, the speech areas on the left', () => {
    const at3 = (name: string) => entries(parts, 3).find((e) => e.name === name)!.parts.map((id) => parts.find((p) => p.id === id)!.name);
    expect(at3('Primary visual cortex').sort()).toEqual(['left primary visual cortex', 'right primary visual cortex']);
    expect(at3("Broca's area")).toEqual(["left Broca's area"]);
    expect(at3("Wernicke's area")).toEqual(["left Wernicke's area"]);
    // What they were cut from is still there, on both sides.
    expect(at3('Visual association cortex').length).toBe(2);
    expect(at3('Inferior frontal gyrus').length).toBe(2);
    expect(at3('Insula').every((name) => /insula$/.test(name))).toBe(true);
  });

  it('keeps the thalamus out of the brainstem', () => {
    const stria = parts.find((p) => p.name === 'left stria medullaris of thalamus')!;
    expect(structureOf(stria, 1)).toBeNull();
    expect(structureOf(stria, 3)).toBeNull();
  });

  it('has a name for any part that is tapped', () => {
    for (const part of parts) expect(label(part).length, part.name).toBeGreaterThan(2);
  });
});
