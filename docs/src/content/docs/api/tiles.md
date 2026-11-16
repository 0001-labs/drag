---
title: Tiles
description: Rearrange tiles your page lays out, such as a masonry wall, by pushing others aside or swapping two.
---

**Development API.** This entry point is not in the published `0.2.0-alpha.0` package yet. See [versions](/start-here/install/#versions).

```ts
import { createTiles } from '@0001-labs/drag/tiles';
```

Tiles are things of any size in a layout your page computes: a masonry wall, a gallery, cards. Your page owns the layout. The engine carries the pressed tile under the pointer, tells you each new order to draw, and slides the other tiles from where they were to where your layout now puts them.

Nothing is cloned. The carried tile is the element itself, moved with `translate`; the others slide with a transform animation, so layout is read once per change of place, never per frame.

## Set it up

```ts
const tiles = createTiles({
  surface: wall,
  tiles: () => [...wall.children] as HTMLElement[],
  arrange: (order) => layOut(order), // your layout: place every tile for this order
  onDrop: ({ order, tile, from, to, mode, swapped }) => save(order),
});
```

`arrange(order)` is called whenever the order changes while a tile is carried, and once more with the first order if the carry is taken back. Place every tile, the carried one included: it stays under the pointer and settles into its place when let go. `layOut` and `save` are your own.

## Two ways to rearrange

| Mode | What happens |
| --- | --- |
| `push` | The carried tile takes the place of the tile under the pointer, and the rest step aside. The default. |
| `swap` | The carried tile and the tile under the pointer trade places; nothing else moves. Moving on puts the last one back. Used while Shift is held. |

Shift may be pressed or released mid-carry: the order goes back to where it began and the pointer is read again the other way. To choose the mode yourself, pass `mode: ({ shiftKey }) => 'push' | 'swap'`.

## Layouts with more than an order

In a masonry that re-flows from an order, pushing one tile moves many others across columns. If your layout keeps something besides the order, such as each tile's column, use `place` so only the tiles below move down:

```ts
createTiles({
  surface: wall,
  tiles,
  place: ({ tile, over, order, at }) => {
    column.set(tile, column.get(over)); // your own record, read by arrange
    const rest = order.filter((each) => each !== tile);
    rest.splice(rest.indexOf(over) + (at.y < 0.5 ? 0 : 1), 0, tile); // above or below
    return rest;
  },
  arrange: (order, carry) => {
    if (same(order, carry.original)) column = new Map(columnsAtStart); // taken back
    layOut(order, column);
  },
  onDrop: ({ order }) => save(order, column),
});
```

A tile the page placed counts as moved even when the order is unchanged, so `onDrop` still fires. When the order returns to `carry.original` (Escape, or Shift pressed mid-carry), put your own record back too.

## Arguments

| Argument | Meaning |
| --- | --- |
| `surface` | The element the tiles stand in. Places are measured from its corner. |
| `tiles()` | The tiles in their current order. |
| `arrange(order, carry)` | Draw an order. `carry` is the carried `tile`, the `mode` and the `original` order the carry began with. |
| `place({ tile, over, order, original, at })` | Decide where a pushed tile goes when the pointer comes over another tile, and return the order to draw. `at` is where in `over` the pointer is, as a share of its width and height. See [layouts with more than an order](#layouts-with-more-than-an-order). |
| `canCarry(tile, event)` | Return `false` to leave a press to the page, for example to let the browser's own drag take a picture out while a modifier is held. |
| `mode({ shiftKey })` | Which way the order changes. |
| `onStart(tile)` | A tile was lifted. |
| `onDrop(change)` | Let go on a changed order: `tile`, `from`, `to`, `mode`, `swapped` (the other tile after a swap) and the new `order`. |
| `onCancel(tile)` | Let go where it was taken, or taken back. |

A press on a control inside a tile (a button, a link, a field, or anything marked `data-drag-ignore`) is never a carry.

## Options

`createTiles(args, options)` takes the [grid's options](/api/grid/) (`dragDistance`, `touchHold`) and:

| Option | Default | Meaning |
| --- | --- | --- |
| `duration` | `200` | How long a tile slides to a new place, in milliseconds. Nothing slides under reduced motion. |
| `easing` | `cubic-bezier(0.2, 0, 0, 1)` | The slide's curve. |
| `changeDistance` | `8` | How far the pointer moves before the order may change again, in pixels. |

## Behaviour

- A mouse or pen lifts after five pixels; a finger after a still hold, so a finger that moves sooner scrolls the page. A press that never lifts stays a click.
- Escape, a lost pointer or the window losing focus puts everything back.
- Near the top or the foot of whatever scrolls the tiles, shadow roots included, the tiles scroll under the pointer.
- While a tile is pressed, the browser's own drag of a picture or link inside it is prevented, unless `canCarry` returned `false`.
- After a change, nothing changes again until the pointer has left the place it was aimed at, whatever slides under it, so a layout that re-flows tiles of different sizes does not flip back and forth.

## Styling

The engine sets `data-drag-carried` on the carried tile, `data-drag-settling` while it settles, and `data-drag-tiles` on the surface during a carry. It raises the carried tile with `z-index: 1`. Give the tiles `position` so that applies, and style the lifted look yourself:

```css
[data-drag-carried] { box-shadow: 0 8px 24px rgb(0 0 0 / 0.25); cursor: grabbing; }
```

## Controller

| Method | Purpose |
| --- | --- |
| `isCarrying()` | Whether a tile is lifted. |
| `cancel()` | Put everything back. |
| `destroy()` | Cancel and release listeners. |
