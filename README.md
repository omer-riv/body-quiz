# Body Quiz

A 3D anatomy quiz game (working title), in the spirit of Landfall: plain TypeScript, Vite and Three.js in `src/`, a Cloudflare Worker in `worker/`.

## Development

```sh
npm install
npm run dev         # the game alone, with hot reload
npm test            # unit tests
npm run typecheck
npm run build       # production build in dist/
npm run serve       # build, then run it with the real Worker locally
```

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
| `src/main.ts` | Entry point; for now a placeholder Three.js scene |
| `worker/index.ts` | Cloudflare Worker: `/api/*` and the game's files |
| `tests/` | Vitest unit tests |
