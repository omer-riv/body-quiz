// How to play: a few steps on the real body, each asking the player to do one
// thing (turn the body, switch a layer off, peel a part) and moving on once
// they have. The game tells the tutorial what the player did; this file holds
// no DOM code, so the steps can be tested.
import type { Layer } from './structures';

/** What the player did, as the game reports it. */
export type TutorialEvent =
  | { kind: 'camera'; move: CameraMove }
  | { kind: 'home' }
  | { kind: 'layer'; layer: Layer; on: boolean }
  | { kind: 'select' }
  | { kind: 'isolate'; on: boolean }
  | { kind: 'peel' }
  | { kind: 'restore' };

/** How far the camera moved: turned (radians), zoomed (log of the distance) and moved (in body-distances). */
export interface CameraMove {
  turn: number;
  zoom: number;
  pan: number;
}

export type StepId = 'turn' | 'zoom' | 'pan' | 'home' | 'layers' | 'tap' | 'isolate' | 'peel' | 'restore' | 'done';

export interface Step {
  id: StepId;
  title: string;
  /** What to do, for a finger and for a mouse. */
  touch: string;
  mouse: string;
  /** The button the step is about, as a CSS selector, to point at. */
  target?: string;
}

export const STEPS: readonly Step[] = [
  { id: 'turn', title: 'Turn the body', touch: 'Drag with one finger to turn the body round.', mouse: 'Drag to turn the body round.' },
  { id: 'zoom', title: 'Zoom', touch: 'Pinch to zoom in and out.', mouse: 'Scroll to zoom in and out. It zooms towards the pointer.' },
  { id: 'pan', title: 'Move it', touch: 'Drag with two fingers to move the body across the screen.', mouse: 'Drag with the right mouse button to move the body across the screen.' },
  { id: 'home', title: 'Whole body', touch: 'Lost? Tap Whole body to see it all from the front again.', mouse: 'Lost? Click Whole body to see it all from the front again.', target: '#home' },
  { id: 'layers', title: 'Layers', touch: 'These buttons switch layers on and off. Turn off Skin to see the muscles under it.', mouse: 'These buttons switch layers on and off. Turn off Skin to see the muscles under it.', target: '#layers [data-layer="skin"]' },
  { id: 'tap', title: 'Tap a part', touch: 'Tap any muscle to see its name.', mouse: 'Click any muscle to see its name.' },
  { id: 'isolate', title: 'Isolate', touch: 'Isolate shows that part alone. Tap it, then Show all to bring the rest back.', mouse: 'Isolate shows that part alone. Click it, then Show all to bring the rest back.', target: '#card-focus' },
  { id: 'peel', title: 'Peel', touch: 'Tap Peel, then tap two muscles to take them away and see what is behind.', mouse: 'Click Peel, then click two muscles to take them away and see what is behind.', target: '#peel' },
  { id: 'restore', title: 'Put back', touch: 'Put back brings back every part you took away. Tap it.', mouse: 'Put back brings back every part you took away. Click it.', target: '#restore' },
  { id: 'done', title: "You're ready", touch: 'In a round, use the layers and Peel to reach what is hidden. You can see this again from How to play on the menu.', mouse: 'In a round, use the layers and Peel to reach what is hidden. You can see this again from How to play on the menu.' },
];

// How much of each the player has to do before a step counts as done.
export const ENOUGH: CameraMove = { turn: 0.9, zoom: 0.4, pan: 0.1 };
const PEELS = 2;

/** Takes a step's actions and says when it is done. */
export class Tutorial {
  index = 0;
  private moved: CameraMove = { turn: 0, zoom: 0, pan: 0 };
  private count = 0;
  private isolated = false;

  get step(): Step {
    return STEPS[this.index];
  }
  get finished(): boolean {
    return this.step.id === 'done';
  }

  /** Goes on to the next step, and returns it. */
  next(): Step {
    if (!this.finished) this.index++;
    this.moved = { turn: 0, zoom: 0, pan: 0 };
    this.count = 0;
    this.isolated = false;
    return this.step;
  }

  /** Records what the player did, and says whether it finishes the current step. */
  record(event: TutorialEvent): boolean {
    const step = this.step.id;
    switch (event.kind) {
      case 'camera':
        this.moved.turn += event.move.turn;
        this.moved.zoom += event.move.zoom;
        this.moved.pan += event.move.pan;
        return (step === 'turn' || step === 'zoom' || step === 'pan') && this.moved[step] >= ENOUGH[step];
      case 'home':
        return step === 'home';
      case 'layer':
        return step === 'layers' && event.layer === 'skin' && !event.on;
      case 'select':
        return step === 'tap';
      case 'isolate':
        if (step !== 'isolate') return false;
        if (event.on) this.isolated = true;
        return this.isolated && !event.on;
      case 'peel':
        return step === 'peel' && ++this.count >= PEELS;
      case 'restore':
        return step === 'restore';
    }
  }
}

interface Vec {
  x: number;
  y: number;
  z: number;
}

/**
 * How the camera moved between two frames. Turning keeps the distance to the
 * target and changes the direction; zooming changes the distance; moving shifts
 * the target and keeps the distance. A frame that zooms counts only as a zoom, as
 * zooming towards the pointer shifts the target too.
 */
export function cameraMove(from: { position: Vec; target: Vec }, to: { position: Vec; target: Vec }): CameraMove {
  const a = sub(from.position, from.target);
  const b = sub(to.position, to.target);
  const da = length(a);
  const db = length(b);
  if (!da || !db) return { turn: 0, zoom: 0, pan: 0 };
  const zoom = Math.abs(Math.log(db / da));
  const cos = Math.min(1, Math.max(-1, dot(a, b) / (da * db)));
  const turn = Math.acos(cos);
  if (zoom > 0.002) return { turn: 0, zoom, pan: 0 };
  return { turn, zoom: 0, pan: length(sub(to.target, from.target)) / da };
}

const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (a: Vec) => Math.sqrt(dot(a, a));
