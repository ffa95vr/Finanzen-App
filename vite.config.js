import { defineConfig } from 'vite';

// Relative Pfade, damit die App später überall (z. B. GitHub Pages) läuft.
export default defineConfig({
  base: './',
  server: { host: true, port: 5180 },
});
