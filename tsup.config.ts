import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    element: 'src/element.ts',
    elements: 'src/elements.ts',
    sortable: 'src/sortable.ts',
    grid: 'src/grid.ts',
    tiles: 'src/tiles.ts',
    react: 'src/react.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: ['react', 'react-dom'],
});
