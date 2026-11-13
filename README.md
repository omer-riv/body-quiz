# Body Quiz

A 3D anatomy quiz game (working title), in the spirit of Landfall: plain TypeScript, Vite and Three.js in `src/`, a Cloudflare Worker in `worker/`. You turn a real 3D human body, switch its layers on and off, and find or name its bones, muscles and organs.

## How to play

- **Find It**: you are asked for a structure ("Thigh bone (femur)") and tap it on the body. Three tries: 100, 60 and 30 points. What you look for may be under something else: switch layers off, or use **Peel** and tap parts to take them away. **Show me** gives up and shows where it is.
- **Name It**: a structure lights up inside a see-through body, and you pick its name from four. 100 points.
- **Explore**: tap anything to see its name. **Isolate** shows it alone; **Hide** takes it away. **Find** (the magnifier at the top) looks a structure up by name, at any level ("femur", "skull", "liver"), and lights it up where it is: its layer comes on and it is put back if it was peeled.

Once a question is answered, the game says what the structure does and one fun fact about it, where it has them (`src/facts.ts`; most are still to be written, and `npm run missing-facts` lists which).

A round is 10 questions from one **system** (Skeleton, Muscles, Organs, Brain, or Everything) at one **level**. Easy asks for what most people have heard of (the skull, the biceps, the liver), Medium for more (the frontal bone, the rotator cuff, the spleen), Hard for everything the model has, about 340 structures. A system with fewer than 10 structures at a level has a shorter round: Brain at Easy has 6. Your best score for each combination is kept in the browser.

Drag to turn the body, pinch or scroll to zoom, drag with two fingers (or the right mouse button) to move.

**How to play** walks through all of this on the real body, one thing at a time: turning, zooming and moving it, **Whole body**, the layers, tapping a part, **Isolate**, **Peel** and **Put back**. Each step waits until you have done what it asks, and **Skip** leaves at any time. It starts by itself before your first round (remembered in the browser), and the menu's **How to play** opens it again.

## Installing as an app

The game is a Progressive Web App. A browser that supports it offers to install it: **Install the app** on the menu in Chrome and Edge, or **Share → Add to Home Screen** in Safari on iPhone and iPad. Installed, it opens full screen from its own icon.

The first visit caches the whole game, 3D body included (about 15 MB), so after that it loads at once and plays offline, installed or not. High scores need a connection: offline, the summary leaves the tables out, as when the server can't be reached.

A new version is picked up on the next visit after it is published, and the one after that runs it. Only files that changed are downloaded again, so the body is fetched again only when `npm run build-body` changed it.

## High scores

Find It and Name It have shared high-score tables, the same for everyone who plays: **This week**, **This month** and **All time**. Weeks start on Monday and months on the 1st, at midnight UTC. Each combination of mode, system and level is its own table, 30 in all. Explore has no score, so it has no table.

There are no accounts. When a round's score would make the top 10 of any of the three tables, the summary asks for a name and a **Submit**, then says where the score placed and picks it out on the table; the name is remembered for next time. A name can appear more than once on a table, once for each score that makes it. A score that wouldn't make a table isn't sent, and the summary just shows the table.

**High scores** on the menu opens the table for the mode, system and level picked there (the Find It table when the mode is Explore). The screen names the table it is on, and **Filter** opens the modes, systems and levels to move to any other table. That doesn't change the round picked in the menu.

Since anyone can type any name, the tables are on trust: the server only turns away scores no round could reach, which is more than 100 points a question (1000 for most rounds, 600 for Brain at Easy). Names are tidied to single spaces, without control characters, at most 20 characters.

When the scores can't be reached, the game plays as usual: the summary leaves the tables out, and the high scores screen says they aren't available.

## Development

```sh
npm install
npm run dev         # the game alone, with hot reload
npm test            # unit tests
npm run typecheck
npm run build       # production build in dist/
npm run serve       # build, then run it with the Worker and a local database, so high scores work
```

`npm run dev` runs the game without the Worker, so there are no high scores in it, and without the service worker, so nothing is cached. To try the app offline, use `npm run build && npm run preview` or `npm run serve`. `npm run serve` is at <http://localhost:8787/>, with its local D1 database in `.wrangler/`.

In `npm run dev` the game is on `window.app`, to poke at from the console.

## The 3D body

The body is [BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/) 3.0, © The Database Center for Life Science, licensed under [CC Attribution-Share Alike 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en): one adult male, in 933 separately modelled parts. The files in `public/body/` are adapted from it and are under the same licence. The game shows the credit on its menu.

`npm run build-body` (`scripts/build-body.py`, needs Python with `numpy`, `trimesh` and `fast-simplification`) makes those files. It fetches the source once into `.cache/` (1.3 GB, 26 million triangles), sorts each part into a layer, simplifies it to about 4% of its triangles, and writes one binary file per layer plus `manifest.json`: 14 MB in all, loaded layer by layer. The generated files are committed, so building the game doesn't need Python.

What the model has shapes the game: there is skin, the skeleton, the muscles, the organs of the chest and belly, the big vessels of the trunk and the brain, but no nerves outside the head and no vessels in the arms and legs.

## Deployment

Hosted on Cloudflare Workers, connected to this GitHub repository (Workers Builds). Every push to `main` runs the tests, builds the game and publishes it; if a test fails, nothing is published. Other branches aren't wired up to Cloudflare yet: their build fails and they get no preview URL. `.nvmrc` pins the Node version Cloudflare builds with.

One-time setup in the Cloudflare dashboard:

1. **Workers & Pages → Create → Import a repository**, pick `omer-riv/body-quiz`.
2. Project name `body-quiz` (must match `name` in `wrangler.jsonc`).
3. Build command `npm test && npm run build`, deploy command `npx wrangler deploy`.
4. Production branch `main`; turn on **builds for non-production branches** for preview URLs.

`wrangler.jsonc` sets up a small Worker (`worker/index.ts`) that answers `/api/scores` and `/api/health`, and serves `dist/` for everything else.

High scores are stored in a [D1](https://developers.cloudflare.com/d1/) database named `body-quiz-scores`, bound to the Worker as `DB`. `wrangler deploy` creates it on the first deploy (or binds it if it already exists), and the Worker creates its table on first use, so there is no setup step. If the build can't create databases, create it once with `npx wrangler d1 create body-quiz-scores` and add the `database_id` it prints to `wrangler.jsonc`. Preview builds of other branches use the same database.

To look at or clean up scores: `npx wrangler d1 execute body-quiz-scores --remote --command "SELECT * FROM scores ORDER BY created_at DESC LIMIT 20"`, and `DELETE FROM scores WHERE id = …` to remove one.

## Files

| Path | What it is |
| --- | --- |
| `src/structures.ts` | What is asked: the rules that turn the model's 933 parts into structures, per system and level |
| `src/facts.ts` | What each structure does and a fun fact about it, shown after its question |
| `src/search.ts` | Find in Explore: every level's structures, matched against what is typed |
| `src/game.ts` | A round: picking questions and options, answers, scoring |
| `src/body.ts` | The 3D body: loading its parts, layers, peeling, glows, ghosts |
| `src/view.ts` | The camera and canvas: turning and zooming, flying to a part, telling which part was tapped |
| `src/app.ts` | The screens: menu, a round's questions and answers, Explore, the summary, the high scores |
| `src/tutorial.ts` | How to play: its steps, and when each is done |
| `src/leaderboard.ts` | High-score rules shared by the game and the Worker: tables, periods, names, limits |
| `src/pwa.ts` | Installing as an app: registering the service worker and the Install button |
| `src/service-worker.js` | The service worker, which caches the game to play offline; `vite.config.ts` turns it into `sw.js` with the list of files to cache |
| `public/manifest.webmanifest`, `public/icons/` | The app's name, colours and icons; the PNGs are drawn from `icon.svg` |
| `src/highscores.ts` | High-score tables and the submit form, and talking to `/api/scores` |
| `src/settings.ts` | The player's choices and best scores, kept in the browser |
| `src/rng.ts` | The seeded random numbers a round's questions come from |
| `scripts/build-body.py` | Builds `public/body/` from BodyParts3D |
| `worker/index.ts` | Cloudflare Worker: the `/api/scores` endpoint over D1, and the game's files |
| `tests/` | Vitest unit tests |
