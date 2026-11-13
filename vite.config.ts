import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** Every file under dir, as paths relative to it with forward slashes. */
function filesIn(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith('.'))
    .map((d) => relative(dir, join(d.parentPath, d.name)).split('\\').join('/'));
}

const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex').slice(0, 12);

/**
 * Writes dist/sw.js from src/service-worker.js, with the list of files the
 * built game is made of and a hash of each, so the service worker can cache
 * them all for playing offline (see that file).
 */
function serviceWorker(): Plugin {
  let publicDir = '';
  return {
    name: 'body-quiz-service-worker',
    apply: 'build',
    // After the other plugins, so index.html and every asset are in the bundle.
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_, bundle) {
      const files: [string, string][] = [];
      for (const out of Object.values(bundle)) {
        if (out.fileName.endsWith('.map')) continue;
        files.push([out.fileName, hash(out.type === 'chunk' ? out.code : out.source)]);
      }
      for (const path of filesIn(publicDir)) files.push([path, hash(readFileSync(join(publicDir, path)))]);
      files.sort(([a], [b]) => a.localeCompare(b));
      const source = readFileSync('src/service-worker.js', 'utf8').replace('self.__PRECACHE__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // Relative asset paths, so the built game works from any folder or static host.
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
  plugins: [serviceWorker()],
});
