---
title: Sortable demo
description: Try pointer, touch and keyboard reordering on the sortable engine.
---

Drag a handle, or focus it and press Space, then arrows, then Space or Enter. Escape cancels. A finger holds before lifting.

<div class="docs-demo" data-sortable-demo data-ds-not-prose>
  <ul class="sortable-demo-list" aria-label="Reading list">
    <li data-name="Read"><span data-demo-handle role="button" aria-label="Move Read"><span class="ds-icon" style="--ds-icon: url(/icons/handle.svg)" aria-hidden="true"></span></span><span>Read the guide</span></li>
    <li data-name="Build"><span data-demo-handle role="button" aria-label="Move Build"><span class="ds-icon" style="--ds-icon: url(/icons/handle.svg)" aria-hidden="true"></span></span><span>Build a list</span></li>
    <li data-name="Ship"><span data-demo-handle role="button" aria-label="Move Ship"><span class="ds-icon" style="--ds-icon: url(/icons/handle.svg)" aria-hidden="true"></span></span><span>Ship it</span></li>
  </ul>
  <p class="demo-status" role="status">Order: Read, Build, Ship</p>
</div>

This example uses `createSortable` and commits DOM order in `onDragEnd`. The [complete setup](/start-here/sortable/) shows the registrations and cleanup. For several lists, performance counters and an engine comparison, use [Play](/), the front page.
