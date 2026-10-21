---
title: Element adapter
description: Native browser drag sources, drop targets and monitors.
---

```ts
import { draggable, dropTargetForElements, monitorForElements } from '@0001-labs/drag/element';
```

The element adapter coordinates native browser drag events. It does not provide sortable previews, touch-hold gestures or keyboard reordering. Use [sortable](/start-here/sortable/) for those behaviors.

Every registration returns an idempotent cleanup function. Duplicate source or target registrations for the same element throw.

## draggable

```ts
const cleanup = draggable({
  element: row,
  dragHandle: handle,
  canDrag: ({ input, nativeEvent }) => true,
  getData: () => ({ type: 'card', id: 'read' }),
  getNativeData: () => ({ 'text/plain': 'Read the guide' }),
  onDrop: ({ source, location }) => {
    // Read the source and location.current.dropTargets.
  },
});
```

`element` is required; the other fields are optional. Local `getData` returns `Record<PropertyKey, unknown>`. Native `getNativeData` returns string values by MIME type for `DataTransfer`.

## dropTargetForElements

`element` is required. Optional callbacks are `canDrop(payload)`, `getData(payload)`, `getDropEffect(payload)` and `getIsSticky(payload)`, plus lifecycle callbacks. The drop effect is `copy`, `move` or `link`.

Targets are resolved from the deepest DOM element outward. Rejecting an inner target does not reject its ancestors. Sticky targets can remain active while the pointer moves away, subject to the adapter's target resolution.

## monitorForElements

A monitor observes the drag after the source and targets. `canMonitor(payload)` selects sessions, and lifecycle callbacks receive the same payload. Monitors run in registration order.

## Lifecycle

`onGenerateDragPreview`, `onDragStart`, `onDropTargetChange`, `onDragEnter`, `onDragLeave`, `onDrag` and `onDrop` are available through `DragLifecycle`. Dispatch order is source, inner target, outer targets, then monitors. Enter and leave describe target transitions.

## Payload

| Field | Meaning |
| --- | --- |
| `sessionId`, `kind` | Session ID and the `element` drag kind. |
| `source` | `{ element, dragHandle, data }`. |
| `location.initial` | Input and targets at the start. |
| `location.current` | Current input and targets, deepest first. |
| `location.previous` | Previous drop targets. |
| `nativeEvent` | The underlying `DragEvent`. |
| `nativeSetDragImage` | Bound native preview setter when available, otherwise null. |

A target record contains `element`, `kind`, `data` and `dropEffect`. Input includes modifier keys, mouse buttons, and client/page coordinates. Keep local data separate from native string data, and release every registration when its view unmounts.
