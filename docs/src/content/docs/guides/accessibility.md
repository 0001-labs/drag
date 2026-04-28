---
title: Accessibility
description: Accessible drag-and-drop expectations for Drag.
---

Drag-and-drop cannot be pointer-only. The Web Component layer ships with a small accessible baseline for list reordering.

## Baseline behavior

- Every item can expose a focusable handle.
- Handles have meaningful accessible names.
- Keyboard movement supports before, after, top, and bottom actions.
- Successful moves are announced with a live region.
- Focus returns to the handle after keyboard movement.

## Recommended markup

```html
<drag-item value="docs" label="Write docs">
  <drag-handle aria-label="Move Write docs"></drag-handle>
  <span>Write docs</span>
</drag-item>
```

Keep the accessible label specific to the item being moved. Avoid relying on drag gestures as the only way to reorder content.
