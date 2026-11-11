// The Cloudflare Worker in front of the game: /api/* is answered here, and
// everything else is the built game in dist/.
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export const VERSION = '0.1.0';

export function handleApi(url: URL): Response | null {
  if (url.pathname === '/api/health') {
    return Response.json({ ok: true, version: VERSION });
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApi(url) ?? Response.json({ error: 'not found' }, { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
};
