---
title: Sortable lists
description: Create a sortable list with a pointer preview and keyboard controls.
---

**Development API.** This entry point is not in the published `0.2.0-alpha.0` package yet. See [versions](/start-here/install/#versions).

Register a container and its items. Drag moves a preview and offsets the surrounding rows during the gesture. Your app changes the actual order in `onDragEnd`.

```html
<ul id="reading">
  <li data-id="read"><span class="handle" role="button" aria-label="Move Read">Move</span> Read</li>
  <li data-id="build"><span class="handle" role="button" aria-label="Move Build">Move</span> Build</li>
  <li data-id="ship"><span class="handle" role="button" aria-label="Move Ship">Move</span> Ship</li>
</ul>
```

```ts
import { createSortable } from '@0001-labs/drag/sortable';
import { combine, reorder } from '@0001-labs/drag';

const list = document.querySelector<HTMLUListElement>('#reading')!;
const sortable = createSortable({
  onDragEnd({ source, destination, reason }) {
    if (reason !== 'DROP' || !destination) return;
    const rows = reorder({
      list: Array.from(list.children),
      startIndex: source.index,
      finishIndex: destination.index,
    });
    for (const row of rows) list.appendChild(row);
  },
});

const unregister = combine(
  sortable.container({ element: list, id: 'reading' }),
  ...Array.from(list.querySelectorAll<HTMLElement>('li'), (row) =>
    sortable.item({
      element: row,
      id: row.dataset.id!,
      handle: row.querySelector<HTMLElement>('.handle'),
      label: row.dataset.id!,
    }),
  ),
);

// When this view is removed:
function dispose() {
  unregister();
  sortable.destroy();
}
```

Keep the handle visibly focusable. Space lifts, arrows move, Space or Enter drops, and Escape cancels. A mouse or pen lifts after five pixels; a finger lifts after a 250 ms hold by default.

## Between lists

Register every list with the same controller. Items move between containers with matching `type` values. Give containers and items stable, unique IDs. In the result, `source.droppableId` and `destination.droppableId` tell you which collections to update.

Remove the item from the source array and insert it into the destination array at the reported index. Apply both changes synchronously before the callback returns. A drop outside the lists has `destination: null`; cancellation has `reason: 'CANCEL'`. Neither should reorder data.

## Combining

A container with `isCombineEnabled: () => true` can accept a drop onto another item. Such a result has `combine: { draggableId, droppableId }` and no destination. Your app decides whether that means grouping, nesting or another domain action.

[Try the demo](/examples/sortable/) and read the [sortable options](/api/sortable/).
