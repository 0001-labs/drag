---
title: Grid demo
description: Move a box on squares with a pointer or the keyboard.
---

Carry the box to another square. Or focus it, press Space or Enter, use arrows to move, and press Space or Enter again to drop. Shift+arrows moves four squares; Escape restores the starting position.

<div class="docs-demo" data-grid-demo data-ds-not-prose>
  <div class="grid-demo" aria-label="Grid surface">
    <div class="grid-box" role="button" tabindex="0" aria-label="Move box on the grid">Move me</div>
  </div>
  <p class="demo-status" role="status">Column 1, row 1</p>
</div>

The demo keeps the box inside the surface. The engine reports the gesture; the example clamps coordinates, draws with a transform and commits on drop. This boundary behavior belongs to the app, not the engine.

Read the [grid API](/api/grid/) for surfaces, toolbar sources and keyboard gestures.
