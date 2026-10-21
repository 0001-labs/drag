---
title: Lifecycle and cleanup
description: Keep data updates and registrations aligned with the rendered view.
---

## The app owns the result

For sortable and grid gestures, movement is a preview. Apply the model change once, at drop. Do not persist every pointer move. For sortable results, ignore `CANCEL`, handle `combine` separately, and check for a non-null destination before reordering.

`onBeforeCapture` runs before measurements. If a drag changes the shape of your view, draw that change synchronously here. `onDragEnd` runs as the drag finishes settling; apply the new order synchronously before the engine removes temporary offsets. The React provider handles the flush around these callbacks.

## Registration lifetime

Keep the cleanup function returned by each registration. Call it when its DOM element is removed or replaced. Destroy the controller when its whole view goes away.

```ts
const removeList = sortable.container({ element: list, id: 'reading' });
const removeItem = sortable.item({ element: row, id: 'read' });

function dispose() {
  removeItem();
  removeList();
  sortable.destroy();
}
```

Stable IDs connect the result to your data. Register new rows when they appear, unregister removed rows, and avoid using an array index as an item's identity.

## Different layers, different responsibilities

- Sortable reports a proposed order; your app applies it.
- Grid reports coordinates; your app draws and commits them.
- The element adapter reports native drag events; your app chooses their meaning.
- The HTML custom elements move their own DOM children and then emit `0001-drag-reorder`.

Do not attach multiple drag engines to the same handle. When integrating with a framework, let it own the final DOM order rather than making DOM changes behind its state.
