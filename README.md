# @0001-labs/drag

A small framework-agnostic drag-and-drop engine for TypeScript applications.

`@0001-labs/drag` provides headless element drag primitives, typed lifecycle payloads, cleanup helpers, and a minimal Web Component layer for accessible list reordering.

## Install

```bash
pnpm add @0001-labs/drag
```

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

`canDrag({ input, target })` says whether an item may lift now, by `'mouse'`, `'pen'`, `'touch'` or `'keyboard'`, and from the element pressed. An item that is writing, a block an editor draws, takes `text: { hold: () => 400 }`: it keeps its caret, selection, cursor and keys, a mouse or pen lifts it only after a press held still that long (a press that moves sooner selects words), and the keyboard never lifts it. A hold of nought lifts it as soon as the press moves, as Aa does for blocks already selected.

## Site

https://drag.0001.dev holds the docs (Astro/Starlight) and the playground at `/playground/`: an Ezo board on Drag and on @hello-pangea/dnd, switched in place, each drag measured. A Cloudflare Worker serves both from `docs-dist` (`pnpm run deploy`).

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm docs:build
pnpm playground:dev
pnpm test:browser
```

Run the local docs site:

```bash
pnpm docs:dev
```

## License

MIT
