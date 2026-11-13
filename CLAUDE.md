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
- **High scores**: the shared tables, kept by the Worker, one per round kind (`find:skeleton:1`, a *category* in the code), each over three **periods**: this week, this month, all time. **Table** is one of them; the code's `Boards` is a category's three. The **personal best** is the player's own, kept in the browser.
- **Ghost**: a part drawn as a glassy outline. **Peel**: to take parts away to see behind them. **Focus**: some parts solid, the rest ghosts.

## Checks

```sh
npm test
npm run typecheck
```

`npm test` doesn't open a browser. After changing what is drawn or tapped, run `npm run dev` and look. `npm run dev` has no Worker, so no high scores; `npm run serve` runs the real Worker with a local database.

## Adding things

- A structure: a rule in `RULES` in `src/structures.ts`. Within a system the first rule that fits at the level wins, so put the narrower one first. The tests check that every system has enough structures at every level and that no name repeats.
- A fact: an entry in `FACTS` in `src/facts.ts`, under the structure's name exactly as `RULES` has it. `does` is one plain sentence on what the structure is or does; `fun` is one surprising thing about it. Each is a full sentence of at most 140 characters, in everyday words, and true: check it against a reliable source, and leave a structure out before guessing. Don't open with "Did you know". `npm run missing-facts` lists the structures without one, best known first.
- A mode or system on the high-score tables: `src/leaderboard.ts` holds the rules the game and the Worker share, so keep it free of DOM code. A new mode with a score goes in `RANKED_MODES`; a new system is on the tables once it is in `SYSTEMS`. `maxScore` must be what a flawless round scores, so change it with the points, and a system with fewer than `ROUND_LENGTH` structures at a level needs its length in `SHORT_ROUNDS`. The tests in `tests/leaderboard.test.ts` check all of this against the model, and fail when a rule in `RULES` changes a short round's length. Category ids are stored with the scores: don't rename them.
- Every random choice that shapes a question takes an `Rng` (`src/rng.ts`), as `pickOptions` does, so a round can be replayed from its seed. Battles will need that.
- `public/body/` is generated: change `scripts/build-body.py` and run `npm run build-body`, don't edit the files. They are under BodyParts3D's CC BY-SA licence, and the game must keep showing its credit.

## Workflow

- Ask follow-up questions before starting, and again whenever a choice comes up that the request doesn't settle, to check you and the user agree on what to build. Don't guess at what they want.
- Make every feature on its own branch and open a pull request for it, one feature per pull request.
- Before merging, rebase the branch on the latest `main` (`git fetch origin main && git rebase origin/main`), run the checks again, and push.

## Known failures

- The Cloudflare build (Workers Builds) fails on every branch except `main`: Cloudflare isn't wired up for feature branches yet, so they get no preview. That failure on a pull request is expected and isn't caused by the change; run `npm test` and `npm run typecheck` locally instead.
