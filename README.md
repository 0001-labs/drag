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

## Docs

The docs site is built with Astro/Starlight and deployed to Cloudflare Pages.

- Production target: https://drag.0001.dev
- Current Pages URL: https://0001-drag-docs.pages.dev

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm docs:build
pnpm test:browser
```

Run the local docs site:

```bash
pnpm docs:dev
```

## License

MIT
