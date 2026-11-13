import { describe, expect, it } from 'vitest';
import { ENOUGH, STEPS, Tutorial, cameraMove, type TutorialEvent } from '../src/tutorial';

const at = (x: number, y: number, z: number) => ({ x, y, z });
const origin = at(0, 0, 0);

describe('cameraMove', () => {
  it('tells a turn from a zoom from a move', () => {
    const from = { position: at(0, 0, 2), target: origin };
    const turned = cameraMove(from, { position: at(2, 0, 0), target: origin });
    expect(turned.turn).toBeCloseTo(Math.PI / 2);
    expect(turned.zoom).toBe(0);
    expect(turned.pan).toBe(0);

    const zoomed = cameraMove(from, { position: at(0, 0, 1), target: origin });
    expect(zoomed.zoom).toBeCloseTo(Math.log(2));
    expect(zoomed.turn).toBe(0);

    const moved = cameraMove(from, { position: at(1, 0, 2), target: at(1, 0, 0) });
    expect(moved.pan).toBeCloseTo(0.5);
    expect(moved.turn).toBeCloseTo(0);
    expect(moved.zoom).toBe(0);
  });

  it('counts a zoom towards the pointer as a zoom only, though it shifts the target', () => {
    const move = cameraMove({ position: at(0, 0, 2), target: origin }, { position: at(0.5, 0, 1), target: at(0.5, 0, 0) });
    expect(move.pan).toBe(0);
    expect(move.zoom).toBeGreaterThan(0);
  });
});

describe('Tutorial', () => {
  const camera = (turn: number, zoom: number, pan: number): TutorialEvent => ({ kind: 'camera', move: { turn, zoom, pan } });
  // One way through every step, and things that don't finish it first.
  const through: Record<string, { not: TutorialEvent[]; yes: TutorialEvent[] }> = {
    turn: { not: [camera(0, 1, 1), camera(ENOUGH.turn / 2, 0, 0)], yes: [camera(ENOUGH.turn / 2, 0, 0)] },
    zoom: { not: [camera(5, 0, 5), { kind: 'home' }], yes: [camera(0, ENOUGH.zoom, 0)] },
    pan: { not: [camera(5, 5, 0)], yes: [camera(0, 0, ENOUGH.pan)] },
    home: { not: [{ kind: 'select' }], yes: [{ kind: 'home' }] },
    layers: { not: [{ kind: 'layer', layer: 'muscle', on: false }, { kind: 'layer', layer: 'skin', on: true }], yes: [{ kind: 'layer', layer: 'skin', on: false }] },
    tap: { not: [{ kind: 'peel' }], yes: [{ kind: 'select' }] },
    isolate: { not: [{ kind: 'isolate', on: false }, { kind: 'isolate', on: true }], yes: [{ kind: 'isolate', on: false }] },
    peel: { not: [{ kind: 'restore' }, { kind: 'peel' }], yes: [{ kind: 'peel' }] },
    restore: { not: [{ kind: 'peel' }], yes: [{ kind: 'restore' }] },
  };

  it('goes through every step, each finished only by doing what it asks', () => {
    const tutorial = new Tutorial();
    for (const step of STEPS.slice(0, -1)) {
      expect(tutorial.step.id).toBe(step.id);
      const { not, yes } = through[step.id];
      for (const event of not) expect(tutorial.record(event)).toBe(false);
      for (const event of yes) expect(tutorial.record(event)).toBe(true);
      tutorial.next();
    }
    expect(tutorial.finished).toBe(true);
    expect(tutorial.record({ kind: 'home' })).toBe(false);
  });

  it('starts each step afresh', () => {
    const tutorial = new Tutorial();
    tutorial.record(camera(0, ENOUGH.zoom * 2, 0));
    tutorial.next();
    expect(tutorial.step.id).toBe('zoom');
    expect(tutorial.record(camera(0, ENOUGH.zoom / 2, 0))).toBe(false);
  });

  it('has short, distinct steps', () => {
    expect(new Set(STEPS.map((s) => s.id)).size).toBe(STEPS.length);
    expect(STEPS[STEPS.length - 1].id).toBe('done');
    for (const step of STEPS) {
      expect(step.touch.length).toBeLessThanOrEqual(140);
      expect(step.mouse.length).toBeLessThanOrEqual(140);
    }
  });
});
