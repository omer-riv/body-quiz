// What the game tells you about a structure once its question is answered.
// A structure without an entry here just shows nothing: fill them in as you go
// (`npm run missing-facts` lists the ones left).
export interface Fact {
  /** What it is or does, in one plain sentence. */
  does: string;
  /** Something surprising about it, in one sentence. */
  fun: string;
}

// By structure name, exactly as in RULES in src/structures.ts. A name that
// exists at several levels ("Ribs") has one entry for all of them.
export const FACTS: Record<string, Fact> = {
  'Thigh bone (femur)': {
    does: 'It carries your weight from the hip to the knee, and anchors the big muscles that move the leg.',
    fun: 'It is the longest and strongest bone in the body, about a quarter of your height.',
  },
};

export function factFor(structure: string): Fact | undefined {
  return FACTS[structure];
}
