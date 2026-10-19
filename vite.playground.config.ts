import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/** Design system 1's theme goes on before the first paint, inline in the head. */
function themeBootstrap(): Plugin {
  return {
    name: 'theme-bootstrap',
    transformIndexHtml(html) {
      const script = readFileSync(new URL('./playground/ds1/0-face/theme-bootstrap.js', import.meta.url), 'utf8');
      return html.replace('<!-- theme-bootstrap -->', `<script>${script}</script>`);
    },
  };
}

export default defineConfig({
  root: 'playground',
  base: '/playground/',
  plugins: [themeBootstrap()],
  esbuild: { jsx: 'automatic' },
  build: {
    outDir: '../docs-dist/playground',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5188,
    strictPort: true,
  },
});
