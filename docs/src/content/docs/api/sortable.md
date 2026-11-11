---
title: Sortable
description: Controller, registration, results and options for createSortable.
---

**Development API.** This entry point is not in the published `0.2.0-alpha.0` package yet. See [versions](/start-here/install/#versions).

```ts
import { createSortable } from '@0001-labs/drag/sortable';
```

`createSortable(options?)` returns a controller. It provides pointer, touch and keyboard dragging, an overlay preview, sibling displacement and edge scrolling. It never commits your data or final DOM order.

## Controller

| Method | Purpose |
| --- | --- |
| `container(args)` | Registers a list and returns its cleanup function. |
| `item(args)` | Registers an item and returns its cleanup function. |
| `isDragging()` | Reports whether a drag is active. |
| `cancel()` | Cancels the current gesture. |
| `destroy()` | Cancels and releases the controller's registrations and listeners. |

## Container

`element: HTMLElement` and `id: string` are required.

| Option | Meaning |
| --- | --- |
| `type` | Matches items and containers; use the same value for lists that accept each other's items. |
| `axis` | `vertical` by default, or `horizontal`. |
| `label` | Name used in announcements; falls back to `aria-label` or the ID. |
| `isDropDisabled()` | Returns whether the list currently rejects drops. |
| `isCombineEnabled()` | Allows dropping onto another item instead of into a slot. |
| `still` | Keeps surrounding items still; the app draws the destination itself. |
| `lockAxis` | Constrains the preview to `x` or `y` for items lifted here. |
| `renderPreview(source)` | Returns a preview element; null/undefined falls back to the controller preview or a clone. |
| `hitArea` | The element whose box accepts a drop, measured as it stands at each move; the list itself when left out. Give a column so a drop over its header, its footer or the room below its last item lands in its list. Slots, flow and the landing still follow the list. |

## Item

`element: HTMLElement` and `id: string` are required.

| Option | Meaning |
| --- | --- |
| `type` | The compatible container type. |
| `handle` | Element that starts a gesture; defaults to the item. |
| `label` | Item name in announcements; falls back to its accessible label or text. |
| `canDrag({ input, target })` | Whether the item may lift now. Input is mouse, pen, touch or keyboard. |
| `allowInteractive` | Allows a press on an interactive descendant to start a drag. Off by default. |
| `text` | `{ hold: () => milliseconds, axis?: 'x' \| 'y' }` for editable text blocks. |

Text mode preserves the caret, selection, cursor and keys. It does not add a tab stop or keyboard lifting. A mouse or pen must hold still for the requested duration; movement sooner stays text selection. Setting `axis` allows an initial movement at least twice as far along that axis to lift immediately. Give people another keyboard way to move text blocks.

## Results

```ts
type SortableResult = {
  draggableId: string;
  type: string;
  source: { droppableId: string; index: number };
  destination: { droppableId: string; index: number } | null;
  combine: { draggableId: string; droppableId: string } | null;
  mode: 'FLUID' | 'SNAP';
  reason: 'DROP' | 'CANCEL';
};
```

Indexes start at zero. `FLUID` means pointer movement; `SNAP` means keyboard movement. Combining and dropping outside containers both have no destination. Check `reason`, then `combine`, then `destination` before changing your data.

## Lifecycle

| Callback | When |
| --- | --- |
| `onBeforeCapture({ draggableId, mode })` | Before measurement; update the view synchronously if the lifted shape changes. |
| `onDragStart(start)` | Once the item lifts; receives ID, type, source and mode. |
| `onDragUpdate(update)` | When the destination changes; adds destination and combine. |
| `onDragEnd(result)` | After settling; commit the order synchronously before offsets are removed. |
| `prepareDrop(result)` | Commit the final layout before the landing and return the element the item now is (or a function that finds it; a promise of either is awaited). The preview lands on that element once, where it rests. With it, `onDragEnd` is a notification. If it throws or rejects, the drag ends as a cancel with nothing left lifted and the error is raised through `reportError`. |
| `onMovement({ element, phase, x, y })` | Every move a sibling makes: `drag` while the item is carried, `drop` for any move after release, which means the page drew it somewhere other than where it had made room. |
| `onDropOutside(start, point)` | Pointer dropped outside all containers. Return true if the app accepts it there; `onDragEnd` still follows with no destination. |

## Options

| Option | Default / purpose |
| --- | --- |
| `dragDistance` | 5 pixels before mouse/pen lift. |
| `touchHold` | 250 ms before touch lift. |
| `autoScrollEdge` | 60 pixels from an edge, at most a fifth of the scroller's visible length. |
| `outOfTheWay` | `{ duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' }`. |
| `drop` | `{ minDuration: 330, maxDuration: 550, easing: 'cubic-bezier(.2, 1, .1, 1)' }`. |
| `lockAxis` | Optional `x` or `y` preview constraint. |
| `inheritProperties` | Additional CSS custom properties copied to the preview. |
| `renderPreview(source)` | Custom preview element instead of the default clone. |
| `onPreview(preview, source)` | The page's last word on the preview before it is shown: take off what belongs to its own editing (a selection mark the clone copied) or add to it (a count). The item itself is left alone. |
| `messages` | Partial replacement for instructions and announcement functions. |
| `pointerPoint(event)` | Custom viewport coordinates; defaults to `clientX` and `clientY`. |

## What the engine sees to

- **The preview looks like the item.** Each element's resolved appearance is written onto its copy, so it holds outside the item's ancestors. What had scrolled inside the item stays scrolled, a canvas keeps its picture, and a component the page has no definition for (made in another window and adopted) is copied with its tree as it stands.
- **Edge scrolling follows the clock**, not the frame rate: at most 24 pixels for each sixtieth of a second, on any screen. An item lifted inside an edge's band does not scroll that edge until the pointer leaves the band or goes 10 pixels on towards it.
- **Scroll anchoring is off while an item is carried**, so a commit above or below the fold never scrolls the page under the landing.
- **The landing is measured before siblings settle.** An item dropped while its list is still sliding lands where it rests, and a list that slides carries its items with it.
- **A press during the landing lands the drop at once** and is handled as a new press.
- **A drag always ends.** A mouse that comes back with no button down was released out of sight: the press is dropped and a carried item goes home. A pointer pressed during a keyboard carry puts the item back. After a cancel with the button still down, the click of the release is swallowed.

See [styling](/guides/styling/) for state attributes and [accessibility](/guides/accessibility/) for messages and controls.
