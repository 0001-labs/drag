/**
 * What a product copies from Drag with Sync 1 (`sync1`): the sortable engine's
 * TypeScript source, into a folder the copy owns whole. `react: true` adds the
 * React layer (react.ts), for products drawn with React, `grid: true` the
 * engine that carries things on squares (grid.ts), for a board, and
 * `tiles: true` the tiles a page lays out and a person rearranges (tiles.ts,
 * with the grid it is carried by), for a wall.
 */
export default {
  exports: {
    sortable: {
      owned: true,
      files({ read, options }) {
        const files = new Map([
          ['sortable.ts', read('src/sortable.ts')],
          ['flow.ts', read('src/flow.ts')],
          ['types.ts', read('src/types.ts')],
          ['util.ts', read('src/util.ts')],
          ['LICENSE', read('LICENSE')],
          ['NOTICE', read('NOTICE')],
        ]);
        if (options.react) files.set('react.ts', read('src/react.ts'));
        if (options.grid || options.tiles) files.set('grid.ts', read('src/grid.ts'));
        if (options.tiles) files.set('tiles.ts', read('src/tiles.ts'));
        return files;
      },
    },
  },
};
