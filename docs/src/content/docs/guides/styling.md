---
title: Styling
description: Style Drag state attributes and overlay previews.
---

Drag supplies behavior. Your app supplies the typography, spacing, colors and focus indicators. There is no mandatory stylesheet for the library.

## Sortable states

| Selector | Where / when |
| --- | --- |
| `[data-drag-handle]` | The registered handle; the engine applies cursor, touch and selection rules. |
| `[data-drag-source]` | The original item while lifted. |
| `[data-drag-over]` | The container currently under the item. |
| `[data-drag-preview]` | The lifted preview in an overlay. |
| `[data-drag-overlay]` | The fixed overlay wrapper. |
| `[data-drag-combine]` | The item currently targeted for combining. |
| `:root[data-drag-active]` | A sortable gesture is active; the value is its type. |
| `:root[data-drag-outside]` | The preview is outside all matching containers. |

The preview is outside the original list's DOM ancestry. A rule like `.list > .row` may not reach it. Style a reusable row class directly, or add a `[data-drag-preview]` rule. Use `inheritProperties` for custom properties the preview needs, and `renderPreview` when it needs different content.

```css
.row { background: white; color: black; }
[data-drag-handle]:focus-visible { outline: 2px solid currentColor; }
[data-drag-preview] { border-radius: 4px; }
[data-drag-combine] { outline: 2px solid currentColor; }
```

The engine owns movement styles during a gesture. Avoid competing animations or layout changes on the registered rows while it is measuring and moving them. A displaced item exposes `--drag-shift`; advanced layouts can counter-translate a child when that child should remain still.

## Grid

A grid gesture sets `data-drag-grid` on the document root. The grid engine does not draw a preview or apply movement to your boxes. Set their `transform` from `onMove`, commit on `onDrop`, and restore on `onCancel`.

## HTML elements

`drag-list`, `drag-item` and `drag-handle` need your layout styles. Keep the handle visible and focusable. These elements use the native adapter and do not expose the sortable engine's overlay states.

## Reduced motion

The sortable engine checks the reduced-motion preference for its motion. Respect it in any extra animations your app adds. Prefer transform and opacity for moving previews, and keep focus visible in both color schemes.
