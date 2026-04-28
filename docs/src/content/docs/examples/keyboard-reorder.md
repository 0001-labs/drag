---
title: Keyboard Reorder
description: Accessible reorder controls for list items.
---

Pointer dragging should not be the only way to complete a reorder. The Web Component layer provides a focusable handle and keyboard movement by default.

<div class="docs-demo" aria-label="Keyboard reorder demo">
  <div class="docs-demo-header">
    <h2>Keyboard flow</h2>
    <span id="keyboard-demo-status" class="status-pill">Ready</span>
  </div>
  <drag-list class="docs-list" data-docs-demo data-status-target="keyboard-demo-status" data-announcement-target="keyboard-demo-announcement" aria-label="Keyboard reorder tasks">
    <drag-item value="focus" label="Focus the handle">
      <drag-handle aria-label="Move Focus the handle"></drag-handle>
      <span class="item-label">Focus the handle</span>
    </drag-item>
    <drag-item value="move" label="Press ArrowDown">
      <drag-handle aria-label="Move Press ArrowDown"></drag-handle>
      <span class="item-label">Press ArrowDown</span>
    </drag-item>
    <drag-item value="announce" label="Confirm the announcement">
      <drag-handle aria-label="Move Confirm the announcement"></drag-handle>
      <span class="item-label">Confirm the announcement</span>
    </drag-item>
  </drag-list>
</div>

<p id="keyboard-demo-announcement">Keyboard changes will be announced here.</p>

## Controls

- `ArrowUp` moves an item before its previous sibling.
- `ArrowDown` moves an item after its next sibling.
- `Home` moves an item to the top.
- `End` moves an item to the bottom.
