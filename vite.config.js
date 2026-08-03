import { defineConfig } from 'vite';

// Relative base so the dist zip works on itch.io (and file:// / nested paths).
export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', port: 5173 },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    outDir: 'dist',
    emptyOutDir: true,
  },
});
