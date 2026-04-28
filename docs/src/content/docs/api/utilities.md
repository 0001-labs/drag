---
title: Utilities
description: Cleanup and list helper APIs.
---

## combine

Composes cleanup functions and makes the composed cleanup idempotent.

```ts
const cleanup = combine(cleanupDraggable, cleanupTarget, cleanupMonitor);
cleanup();
cleanup(); // no-op
```

## once

Runs a function once and returns the first result for later calls.

```ts
const setup = once(() => expensiveSetup());
```

## reorder

Returns a reordered copy of a list without mutating the original.

```ts
const next = reorder({
  list: tasks,
  startIndex: 0,
  finishIndex: 2,
});
```
