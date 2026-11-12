# Body Quiz

A 3D anatomy quiz game (working title), in the spirit of Landfall: plain TypeScript, Vite and Three.js in `src/`, a Cloudflare Worker in `worker/`. You turn a real 3D human body, switch its layers on and off, and find or name its bones, muscles and organs.

## How to play

- **Find It**: you are asked for a structure ("Thigh bone (femur)") and tap it on the body. Three tries: 100, 60 and 30 points. What you look for may be under something else: switch layers off, or use **Peel** and tap parts to take them away. **Show me** gives up and shows where it is.
- **Name It**: a structure lights up inside a see-through body, and you pick its name from four. 100 points.
- **Explore**: tap anything to see its name. **Isolate** shows it alone; **Hide** takes it away.

Once a question is answered, the game says what the structure does and one fun fact about it, where it has them (`src/facts.ts`; most are still to be written, and `npm run missing-facts` lists which).

A round is 10 questions from one **system** (Skeleton, Muscles, Organs, Brain, or Everything) at one **level**. Easy asks for what most people have heard of (the skull, the biceps, the liver), Medium for more (the frontal bone, the rotator cuff, the spleen), Hard for everything the model has, about 340 structures. Your best score for each combination is kept in the browser.

Drag to turn the body, pinch or scroll to zoom, drag with two fingers (or the right mouse button) to move.

## Development

```sh
npm install
npm run dev         # the game alone, with hot reload
npm test            # unit tests
npm run typecheck
npm run build       # production build in dist/
npm run serve       # build, then run it with the real Worker locally
```

In `npm run dev` the game is on `window.app`, to poke at from the console.

## The 3D body

The body is [BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/) 3.0, © The Database Center for Life Science, licensed under [CC Attribution-Share Alike 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en): one adult male, in 933 separately modelled parts. The files in `public/body/` are adapted from it and are under the same licence. The game shows the credit on its menu.

`npm run build-body` (`scripts/build-body.py`, needs Python with `numpy`, `trimesh` and `fast-simplification`) makes those files. It fetches the source once into `.cache/` (1.3 GB, 26 million triangles), sorts each part into a layer, simplifies it to about 4% of its triangles, and writes one binary file per layer plus `manifest.json`: 14 MB in all, loaded layer by layer. The generated files are committed, so building the game doesn't need Python.

What the model has shapes the game: there is skin, the skeleton, the muscles, the organs of the chest and belly, the big vessels of the trunk and the brain, but no nerves outside the head and no vessels in the arms and legs.

## Deployment

Hosted on Cloudflare Workers, connected to this GitHub repository (Workers Builds). Every push to `main` runs the tests, builds the game and publishes it; if a test fails, nothing is published. Pushes to other branches get their own preview URL. `.nvmrc` pins the Node version Cloudflare builds with.

One-time setup in the Cloudflare dashboard:

1. **Workers & Pages → Create → Import a repository**, pick `omer-riv/body-quiz`.
2. Project name `body-quiz` (must match `name` in `wrangler.jsonc`).
3. Build command `npm test && npm run build`, deploy command `npx wrangler deploy`.
4. Production branch `main`; turn on **builds for non-production branches** for preview URLs.

`wrangler.jsonc` sets up a small Worker (`worker/index.ts`) that answers `/api/*` (for now just `/api/health`) and serves `dist/` for everything else.

## Files

| Path | What it is |
| --- | --- |
| `src/structures.ts` | What is asked: the rules that turn the model's 933 parts into structures, per system and level |
| `src/facts.ts` | What each structure does and a fun fact about it, shown after its question |
| `src/game.ts` | A round: picking questions and options, answers, scoring |
| `src/body.ts` | The 3D body: loading its parts, layers, peeling, glows, ghosts |
| `src/view.ts` | The camera and canvas: turning and zooming, flying to a part, telling which part was tapped |
| `src/app.ts` | The screens: menu, a round's questions and answers, Explore, the summary |
| `src/settings.ts` | The player's choices and best scores, kept in the browser |
| `src/rng.ts` | The seeded random numbers a round's questions come from |
| `scripts/build-body.py` | Builds `public/body/` from BodyParts3D |
| `worker/index.ts` | Cloudflare Worker: `/api/*` and the game's files |
| `tests/` | Vitest unit tests |
