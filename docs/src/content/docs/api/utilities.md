---
title: Utilities
description: Compose cleanup and reorder data without mutation.
---

```ts
import { combine, once, reorder } from '@0001-labs/drag';
```

## combine

Combines cleanup functions in their supplied order and runs them at most once.

```ts
const cleanup = combine(cleanupDraggable, cleanupTarget, cleanupMonitor);
cleanup();
cleanup(); // No-op.
```

## once

Wraps a function so subsequent calls return its first result without calling it again.

```ts
const setup = once(() => expensiveSetup());
const first = setup();
const same = setup();
```

## reorder

Returns a new array with the item at `startIndex` moved to `finishIndex`. It leaves the original array unchanged, including when both indexes are equal.

```ts
const next = reorder({ list: ['Read', 'Build', 'Ship'], startIndex: 0, finishIndex: 2 });
// ['Build', 'Ship', 'Read']
```

Both indexes must be integers within the list. Non-integer indexes throw `TypeError`; out-of-bounds indexes throw `RangeError`. Check a drag's destination before calling this helper. It reorders one list; cross-list moves need an update to both collections.
