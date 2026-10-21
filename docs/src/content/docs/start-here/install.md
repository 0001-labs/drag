---
title: Install
description: Install the published alpha or build the current Drag source.
---

## Package

```sh
pnpm add @0001-labs/drag@alpha
```

With npm, use `npm install @0001-labs/drag@alpha`. Drag ships ES modules, CommonJS and TypeScript declarations. The package declares Node 22.12 or later for tooling; drag gestures run in the browser.

## Entry points

```ts
import { combine, once, reorder } from '@0001-labs/drag';
import { createSortable } from '@0001-labs/drag/sortable';
import { createGrid } from '@0001-labs/drag/grid';
import { draggable, dropTargetForElements, monitorForElements } from '@0001-labs/drag/element';
import '@0001-labs/drag/elements';
```

For React, import the provider and hooks from `@0001-labs/drag/react`. Use React 19 for the current ref hooks, which return registration cleanup functions. Other entry points do not require React.

## Versions

The documentation and live examples follow the development source. The published `0.2.0-alpha.0` package exports the root utilities, `/element` and `/elements`. It does **not** yet export `/sortable`, `/react` or `/grid`.

The sortable, React and grid pages document the next API and provide working development demos. These entry points need a build of the development source and are not available through the current npm install. The public repository can also lag behind the development build; check its `package.json` exports before building it.

The npm `latest` tag still selects `0.1.0-alpha.0`. Use `@alpha` explicitly for the newer published preview. Pre-release APIs may change.

For the currently published package, start with [HTML elements](/start-here/web-components/) or the [native element adapter](/start-here/manual-setup/).

## First list

Continue with the complete [sortable list example](/start-here/sortable/), [React example](/start-here/react/) or [HTML elements](/start-here/web-components/). The [API reference](/api/sortable/) covers configuration and cleanup.
