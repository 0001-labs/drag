---
title: HTML lists
description: Try the Drag Web Components directly in the documentation.
---

Use the handle to drag items. Focus a handle and use `ArrowUp`, `ArrowDown`, `Home`, or `End` for keyboard movement.

<div class="docs-demo" data-ds-not-prose aria-label="Live drag demo">
  <div class="docs-demo-header">
    <h2>Project tasks</h2>
    <span id="live-demo-status" class="status-pill">Ready</span>
  </div>
  <drag-list class="docs-list" data-docs-demo data-status-target="live-demo-status" data-announcement-target="live-demo-announcement" aria-label="Project tasks">
    <drag-item value="install" label="Install the package">
      <drag-handle aria-label="Move Install the package"><span class="ds-icon" style="--ds-icon: url(/icons/handle.svg)" aria-hidden="true"></span></drag-handle>
      <span class="item-label">Install the package</span>
    </drag-item>
    <drag-item value="wire" label="Wire the adapter">
      <drag-handle aria-label="Move Wire the adapter"><span class="ds-icon" style="--ds-icon: url(/icons/handle.svg)" aria-hidden="true"></span></drag-handle>
      <span class="item-label">Wire the adapter</span>
    </drag-item>
    <drag-item value="ship" label="Ship accessible controls">
      <drag-handle aria-label="Move Ship accessible controls"><span class="ds-icon" style="--ds-icon: url(/icons/handle.svg)" aria-hidden="true"></span></drag-handle>
      <span class="item-label">Ship accessible controls</span>
    </drag-item>
    <div data-0001-drag-live-region aria-live="polite" aria-atomic="true"></div>
  </drag-list>
</div>

<div class="note-panel">
  <h3>Latest announcement</h3>
  <p id="live-demo-announcement">Reorder the live example to mirror the screen reader announcement here.</p>
</div>

```html
<drag-list aria-label="Project tasks">
  <drag-item value="install" label="Install the package">
    <drag-handle aria-label="Move Install the package"><span class="ds-icon" style="--ds-icon: url(/icons/handle.svg)" aria-hidden="true"></span></drag-handle>
    <span>Install the package</span>
  </drag-item>
</drag-list>
```

These examples use the HTML custom elements. Their arrow keys move immediately; the [sortable demo](/examples/sortable/) uses Space to lift and drop.
