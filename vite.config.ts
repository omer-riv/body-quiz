import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the built game works from any folder or static host.
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
});
