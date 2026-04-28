---
title: Introduction
description: Learn how to install and use @0001-labs/drag.
---

<div class="hero-panel">
  <p class="hero-kicker">drag.0001.dev</p>
  <h2 class="hero-title">Drag primitives for framework-neutral interfaces.</h2>
  <p>
    `@0001-labs/drag` is a small TypeScript drag-and-drop engine with element adapters,
    drop targets, monitors, cleanup utilities, and Web Components for accessible list
    reordering.
  </p>
  <div class="hero-actions">
    <a class="docs-button primary" href="/start-here/manual-setup/">Manual Setup</a>
    <a class="docs-button" href="/examples/live-demo/">Live Demo</a>
  </div>
</div>

## Install

```bash
pnpm add @0001-labs/drag
```

```ts
import { combine, reorder } from "@0001-labs/drag";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@0001-labs/drag/element";
```

## What it gives you

- A framework-agnostic element adapter.
- Typed drag lifecycle payloads.
- Drop targets resolved from the deepest DOM element upward.
- Source → target → monitor event ordering.
- Web Components for accessible list reordering.

## Next Steps

- [Manual Setup](/start-here/manual-setup/) - wire the imperative API.
- [Live Demo](/examples/live-demo/) - try drag and keyboard reorder.
- [Element Adapter](/api/element-adapter/) - review the core API.
