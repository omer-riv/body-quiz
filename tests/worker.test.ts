import { describe, expect, it } from 'vitest';
import worker, { handleApi, type Env } from '../worker/index';

describe('worker', () => {
  it('answers /api/health', async () => {
    const res = handleApi(new URL('https://x/api/health'));
    expect(res?.status).toBe(200);
    expect(await res!.json()).toMatchObject({ ok: true });
  });

  it('404s unknown API paths and hands the rest to the assets', async () => {
    const env = { ASSETS: { fetch: async () => new Response('page') } } as unknown as Env;
    const api = await worker.fetch(new Request('https://x/api/nope'), env);
    expect(api.status).toBe(404);
    const page = await worker.fetch(new Request('https://x/'), env);
    expect(await page.text()).toBe('page');
  });
});
