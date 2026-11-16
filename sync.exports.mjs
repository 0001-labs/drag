/**
 * What a product copies from Drag with Sync 1 (`sync1`): the sortable engine's
 * TypeScript source, into a folder the copy owns whole. `react: true` adds the
 * React layer (react.ts), for products drawn with React, and `grid: true` the
 * engine that carries things on squares (grid.ts), for a board. `tiles` is
 * for a product that only rearranges tiles its page lays out, a wall: tiles.ts
 * with the grid it is carried by, and no sortable engine.
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
        if (options.grid) files.set('grid.ts', read('src/grid.ts'));
        return files;
      },
    },
    tiles: {
      owned: true,
      files({ read }) {
        return new Map([
          ['tiles.ts', read('src/tiles.ts')],
          ['grid.ts', read('src/grid.ts')],
          ['types.ts', read('src/types.ts')],
          ['util.ts', read('src/util.ts')],
          ['LICENSE', read('LICENSE')],
          ['NOTICE', read('NOTICE')],
        ]);
      },
    },
  },
};
