# @0001-labs/drag

A small framework-agnostic drag-and-drop engine for TypeScript applications.

`@0001-labs/drag` provides headless element drag primitives, typed lifecycle payloads, cleanup helpers, and a minimal Web Component layer for accessible list reordering.

## Install

```bash
pnpm add @0001-labs/drag@alpha
```

## Documentation

Read the [documentation](https://drag.0001.dev/), try the [sortable demo](https://drag.0001.dev/examples/sortable/) and [grid demo](https://drag.0001.dev/examples/grid/), or open [Play](https://drag.0001.dev/#play) on the front page. The [version guide](https://drag.0001.dev/start-here/install/#versions) distinguishes the published alpha from development APIs.

## Core API

```ts
import { combine, reorder } from '@0001-labs/drag';
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@0001-labs/drag/element';

const cleanup = combine(
  draggable({
    element: item,
    dragHandle: handle,
    getData: () => ({ type: 'task', id: 'task-1' }),
  }),
  dropTargetForElements({
    element: item,
    getData: () => ({ type: 'position', id: 'task-1' }),
  }),
  monitorForElements({
    onDrop: ({ location }) => {
      console.log(location.current.dropTargets);
    },
  }),
);

cleanup();
```

## Web Components

```ts
import '@0001-labs/drag/elements';
```

```html
<drag-list aria-label="Project tasks">
  <drag-item value="docs" label="Write docs">
    <drag-handle aria-label="Move Write docs"></drag-handle>
    <span>Write docs</span>
  </drag-item>
</drag-list>
```

## Features

- Headless TypeScript element adapter.
- Source, drop target, and monitor lifecycle callbacks.
- Drop targets resolved from the deepest DOM element upward.
- Source to inner target to outer target to monitor dispatch order.
- Idempotent cleanup functions.
- Separate local drag data and native `DataTransfer` string data.
- Minimal accessible Web Components for list reordering.

## Sortable lists

`@0001-labs/drag/sortable` lifts an item by a pointer, a finger hold or a pen and moves it through lists of the same type. Siblings move out of the way by the lifted item's whole size, as @hello-pangea/dnd does (see `NOTICE`), while the lifted item moves in an overlay by its transform alone.

```ts
import { createSortable } from '@0001-labs/drag/sortable';

const sortable = createSortable({
  onDragEnd: ({ source, destination }) => {
    // Apply the new order synchronously; the engine takes its offsets away next.
  },
});
sortable.container({ element: list, id: 'today', type: 'task' });
sortable.item({ element: row, id: 'task-1', type: 'task' });
```

A list with `isCombineEnabled` lets an item held over the middle of another combine with it (the result has `combine` and no destination), and `onBeforeCapture` lets the page redraw itself before the lift is measured, as a selection folded into the row that carries it.

A list with `still` keeps its items where they are while one is carried over it: nothing makes room, the keyboard steps the lifted item over each item in turn, and a drop lands at once, for a page that draws where the item will land itself (a board of squares). A list can also keep what is lifted from it on one line (`lockAxis`) and draw its own preview (`renderPreview`), in place of the engine's.

An item making room carries how far it moved as `--drag-shift`, so what is inside it can stand still: `translate: calc(-1 * var(--drag-shift)) 0`.

`canDrag({ input, target })` says whether an item may lift now, by `'mouse'`, `'pen'`, `'touch'` or `'keyboard'`, and from the element pressed. An item that is writing, a block an editor draws, takes `text: { hold: () => 400 }`: it keeps its caret, selection, cursor and keys, a mouse or pen lifts it only after a press held still that long (a press that moves sooner selects words), and the keyboard never lifts it. A hold of nought lifts it as soon as the press moves, as Aa does for blocks already selected. With `axis: 'y'` (or `'x'`), a press that first moves along that axis, at least twice as far as across, lifts at once without waiting: words are selected along a line, so a block moved down the page is told apart from words being selected, as Aa does for its blocks.

## Things on squares

`@0001-labs/drag/grid` carries things on a surface ruled in squares, a whole square at a time, as a diagram's boxes are moved, sized and joined on a board. Nothing is cloned and nothing moves by itself: each press asks the page what it carries, and the page draws and writes what the gesture means.

```ts
import { createGrid } from '@0001-labs/drag/grid';

const grid = createGrid();
grid.surface({
  element: board,
  unit: () => 20,
  press: ({ square }) => {
    const box = boxAt(square);
    if (!box) return null; // the press is the page's
    return {
      onMove: ({ moved }) => drawAt(box, box.x + moved.x, box.y + moved.y),
      onDrop: ({ moved }) => save(box, box.x + moved.x, box.y + moved.y),
      onCancel: () => drawAt(box, box.x, box.y),
      onClick: () => choose(box),
    };
  },
});
// A tool in a bar carried onto the board, measured on the board's squares.
grid.source({ element: boxTool, surface: board, press: () => ({ onDrop: ({ inside, square }) => inside && add(square) }) });
// The keyboard carries a gesture too: arrows a square, Shift-arrows four, Tab to the next target, Enter to let go.
grid.keyboard({ surface: board, from: { x: 2.5, y: 0.5 }, gesture: { targets: () => middles, onDrop: join, announce: say } });
```

A gesture hears `origin`, `point` (squares, fractions included), `square` (the one under the pointer), `moved` (whole squares from the press), `inside` and `target` (the element under the pointer, through shadow roots). A mouse or pen lifts after five pixels, a finger after a still hold of 250ms (a finger that moves sooner scrolls the page), and near an edge the surface and the page scroll under the pointer. Escape takes it back.

## Site

https://drag.0001.dev holds the docs (Astro/Starlight), with Play on the front page: an Ezo board on Drag and on @hello-pangea/dnd, switched in place, each drag measured. A Cloudflare Worker serves them from `docs-dist` (`pnpm run deploy`).

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm docs:build
pnpm docs:dev
pnpm test:browser
```

Run the local docs site:

```bash
pnpm docs:dev
```

## License

MIT
