---
title: Grid
description: Move, resize or connect things using coordinates in whole squares.
---

**Development API.** This entry point is not in the published `0.2.0-alpha.0` package yet. See [versions](/start-here/install/#versions).

```ts
import { createGrid } from '@0001-labs/drag/grid';
```

The grid engine reports where a gesture goes. It does not clone, move, resize or save anything. Your callbacks draw the preview and commit the final result. [Try the grid demo](/examples/grid/).

## Register a surface

```ts
const grid = createGrid();
const unregister = grid.surface({
  element: board,
  unit: () => 20,
  press: ({ square, target }) => {
    const box = findBox(target); // your app's lookup
    if (!box) return null;
    const origin = { x: box.x, y: box.y };
    return {
      onMove: ({ moved }) => draw(box, origin.x + moved.x, origin.y + moved.y),
      onDrop: ({ moved }) => save(box, origin.x + moved.x, origin.y + moved.y),
      onCancel: () => draw(box, origin.x, origin.y),
      onClick: () => select(box),
    };
  },
});
```

`unit()` returns the size of a square in the surface's pixels, and can read your current zoom or device scale. Returning nothing from `press` leaves that press to the page. `findBox`, `draw`, `save` and `select` above belong to your app.

## Controller

| Method | Purpose |
| --- | --- |
| `surface({ element, unit, press? })` | Register a surface; returns cleanup. |
| `source({ element, surface, press })` | Register an external tool, such as a box dragged from a toolbar onto the registered surface; returns cleanup. |
| `keyboard({ surface, from, gesture })` | Begin a keyboard gesture at grid coordinates. |
| `isDragging()` | Whether a gesture is active. |
| `cancel()` | Cancel a gesture or pending press. |
| `destroy()` | Cancel and release listeners and registrations. |

## Coordinates

Every gesture callback receives `GridDrag`:

| Field | Meaning |
| --- | --- |
| `input` | `mouse`, `pen`, `touch` or `keyboard`. |
| `origin` | Starting `{ x, y }` in squares. |
| `point` | Current position in squares, including fractions. |
| `square` | Integer column and row under the pointer, counted from zero. |
| `moved` | Delta from the origin, rounded to whole squares. |
| `inside` | Whether the pointer is over the surface. |
| `target` | Element under the pointer, through shadow roots; null for keyboard gestures. |

Coordinates include the surface's scroll. Keep a copy of the initial model position and add `moved` to that copy, rather than repeatedly adding it to an already updated position.

## Gesture callbacks

`press` returns a `GridGesture` with optional `onStart`, `onMove`, `onDrop`, `onCancel` and `onClick`. A press released before lifting calls `onClick`. Escape, lost pointer capture and window blur cancel a gesture; moving a finger before its hold also cancels the pending press.

For keyboard gestures, provide `targets(): GridPoint[]` for Tab/Shift+Tab navigation and `announce(drag, phase)` for screen-reader messages. Phase is `start`, `move`, `drop` or `cancel`.

```ts
grid.keyboard({
  surface: board,
  from: { x: 2.5, y: 1.5 },
  gesture: {
    onMove: ({ square }) => drawDestination(square),
    onDrop: ({ square }) => commitDestination(square),
    announce: ({ square }, phase) => `${phase}: column ${square.x}, row ${square.y}`,
  },
});
```

The app provides a focusable trigger and decides when to start. Arrows move one square; Shift+arrows move `step` squares; Space/Enter drops and Escape cancels. The engine does not impose your canvas boundaries: clamp or reject positions in your callbacks where necessary.

## Options

`createGrid({ dragDistance, touchHold, autoScrollEdge, step, pointerPoint })` defaults to 5 pixels, 250 ms, a 40-pixel edge and a four-square step. `pointerPoint` overrides viewport coordinates. A finger moving before the hold scrolls the page; an active gesture can scroll near the surface or viewport edge.

Unregister removed surfaces and tools, then call `destroy()` when the view is removed.
