---
title: Manual Setup
description: Register draggables, drop targets, and monitors manually.
---

The core API is imperative. Register behavior against DOM elements, keep the cleanup function, and call it when your view unmounts.

```ts
import { combine } from "@0001-labs/drag";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@0001-labs/drag/element";

const cleanup = combine(
  draggable({
    element: item,
    dragHandle: handle,
    getData: () => ({ type: "task", id: "task-1" }),
  }),
  dropTargetForElements({
    element: item,
    getData: () => ({ type: "position", id: "task-1" }),
  }),
  monitorForElements({
    onDrop: ({ location }) => {
      console.log(location.current.dropTargets);
    },
  }),
);

cleanup();
```

## Data layers

Local drag data stays in memory and can contain rich values. Native `DataTransfer` data is string-only and should be provided explicitly when you need browser or OS interoperability.
