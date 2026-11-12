# Body Quiz

Body Quiz (working title) is a 3D anatomy quiz game: plain TypeScript, Vite and Three.js in `src/`, a Cloudflare Worker in `worker/`. It follows Landfall (`omer-riv/find-countries`) in its stack, deployment and wording. The README covers how to play, the 3D model and the file layout.

## Terms

Use these words the same way in the UI, the README, comments and names:

- **Part**: one mesh of the 3D model, named as anatomists name it: "left fifth rib" (`Part`, `src/body.ts`).
- **Structure**: what a question is about: "Ribs", "Biceps". One or more parts, both sides of the body together (`Structure`, `Entry`, `src/structures.ts`).
- **Layer**: what is drawn together and switched on and off together: Skin, Muscles, Skeleton, Organs, Vessels, Brain (`Layer`).
- **System**: which part of the body a round asks about: Skeleton, Muscles, Organs (the organ and vessel layers), Brain, or Everything (`SystemId`).
- **Level**: Easy, Medium, Hard. It decides which structures exist, not only which are asked: the skull is one structure at Easy and several bones after.
- **Mode**: how the questions are answered: Find It, Name It, Explore (`ModeId`).
- **Round**: one game: a mode, system and level.
- **Ghost**: a part drawn as a glassy outline. **Peel**: to take parts away to see behind them. **Focus**: some parts solid, the rest ghosts.

## Checks

```sh
npm test
npm run typecheck
```

`npm test` doesn't open a browser. After changing what is drawn or tapped, run `npm run dev` and look.

## Adding things

- A structure: a rule in `RULES` in `src/structures.ts`. Within a system the first rule that fits at the level wins, so put the narrower one first. The tests check that every system has enough structures at every level and that no name repeats.
- A fact: an entry in `FACTS` in `src/facts.ts`, under the structure's name exactly as `RULES` has it. `does` is one plain sentence on what the structure is or does; `fun` is one surprising thing about it. Each is a full sentence of at most 140 characters, in everyday words, and true: check it against a reliable source, and leave a structure out before guessing. Don't open with "Did you know". `npm run missing-facts` lists the structures without one, best known first.
- Every random choice that shapes a question takes an `Rng` (`src/rng.ts`), as `pickOptions` does, so a round can be replayed from its seed. Battles will need that.
- `public/body/` is generated: change `scripts/build-body.py` and run `npm run build-body`, don't edit the files. They are under BodyParts3D's CC BY-SA licence, and the game must keep showing its credit.
