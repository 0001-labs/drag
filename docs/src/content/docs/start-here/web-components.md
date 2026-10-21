---
title: Web Components
description: Reorder an HTML list with drag-list, drag-item and drag-handle.
---

The HTML layer registers three custom elements and changes their DOM order on drop. It uses the native element adapter, rather than the pointer-driven sortable engine. For touch-hold dragging, previews, cross-list moves and lift/move/drop keyboard gestures, use [sortable](/start-here/sortable/).

```ts
import '@0001-labs/drag/elements';
```

```html
<drag-list aria-label="Reading list">
  <drag-item value="read" label="Read the guide">
    <drag-handle aria-label="Move Read the guide"></drag-handle>
    <span>Read the guide</span>
  </drag-item>
  <drag-item value="build" label="Build a list">
    <drag-handle aria-label="Move Build a list"></drag-handle>
    <span>Build a list</span>
  </drag-item>
  <div data-0001-drag-live-region aria-live="polite" aria-atomic="true"></div>
</drag-list>
```

The supplied live region is visible here. You can visually hide it with an accessible screen-reader-only style. Do not use `hidden` or `display: none`: the automatic fallback region in the current element implementation uses `hidden`, so provide your own accessible region when announcements matter.

## Elements

| Element | Contract |
| --- | --- |
| `drag-list` | Supplies a list role unless you set one. Its `items` getter returns the items. `moveItem(sourceValue, targetValue)` changes their order. |
| `drag-item` | Supplies a list-item role. Give it a stable, unique `value` and a readable `label`; both otherwise fall back to its text. |
| `drag-handle` | Supplies a button role, a tab stop and a default accessible name. ArrowUp/ArrowDown move immediately; Home/End move to the beginning/end. |

`defineDragElements()` is also exported and is safe to call repeatedly. Import the elements only in the browser, because their classes extend `HTMLElement`.

## Changes

Listen for `0001-drag-reorder` on the list. Its bubbling event has this detail:

```ts
{
  sourceValue: 'read',
  targetValue: 'build',
  startIndex: 0,
  finishIndex: 1,
  values: ['build', 'read'],
}
```

Use `values` to persist the order. The elements already moved the DOM; this is a notification, not a cancelable request. The item also emits `0001-drag-start`, `0001-drag-target-change`, `0001-drag-move`, `0001-drag-drop`, `0001-drag-enter` and `0001-drag-leave`, with element-adapter payloads.

[Try the HTML list](/examples/live-demo/).
