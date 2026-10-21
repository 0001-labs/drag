---
title: React
description: Use Drag with React state, a provider and registration hooks.
---

**Development API.** This entry point is not in the published `0.2.0-alpha.0` package yet. See [versions](/start-here/install/#versions).

The React entry point wraps the sortable engine. React draws the committed order; Drag moves the preview and nearby rows during a gesture without rendering every pointer move.

The current hooks use React 19 callback-ref cleanup. Add `react` and `react-dom` to your app; they are optional peer dependencies of Drag.

```tsx
import { useState } from 'react';
import { reorder } from '@0001-labs/drag';
import {
  SortableProvider,
  useSortableContainer,
  useSortableItem,
  type SortableResult,
} from '@0001-labs/drag/react';

function Row({ id }: { id: string }) {
  const ref = useSortableItem<HTMLLIElement>(id, {
    handle: '.handle',
    label: id,
  });
  return (
    <li ref={ref}>
      <span className="handle" role="button" aria-label={`Move ${id}`}>Move</span>
      {id}
    </li>
  );
}

function List({ items }: { items: string[] }) {
  const ref = useSortableContainer<HTMLUListElement>('reading', {
    label: 'Reading list',
  });
  return <ul ref={ref}>{items.map(id => <Row key={id} id={id} />)}</ul>;
}

export function ReadingList() {
  const [items, setItems] = useState(['Read', 'Build', 'Ship']);
  function onDragEnd({ source, destination, reason }: SortableResult) {
    if (reason !== 'DROP' || !destination) return;
    setItems(current => reorder({
      list: current,
      startIndex: source.index,
      finishIndex: destination.index,
    }));
  }
  return (
    <SortableProvider onDragEnd={onDragEnd}>
      <List items={items} />
    </SortableProvider>
  );
}
```

## Provider

`SortableProvider` accepts the [sortable options](/api/sortable/). It flushes state updates from `onBeforeCapture` and `onDragEnd` synchronously, so measurement and cleanup see the updated DOM. Callback props stay current; other controller options are read on mount. Remount the provider to replace those options.

## Hooks

| Hook | Result |
| --- | --- |
| `useSortableContainer(id, options)` | A ref for a container. Options include `type`, `axis`, `label`, `isDropDisabled`, `isCombineEnabled`, `still`, `lockAxis` and `renderPreview`. |
| `useSortableItem(id, options)` | A ref for an item. Options include `type`, a `handle` selector, `canDrag`, `allowInteractive` and `label`. |
| `useSortableController()` | The controller from the nearest provider, for example to call `cancel()`. |

Call hooks inside the provider and keep item keys stable. The provider destroys its controller on unmount, and ref cleanup unregisters each element. The imperative item's `text` mode is not exposed by `useSortableItem`.
