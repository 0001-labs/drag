---
title: Element Adapter
description: API reference for draggable elements, drop targets, and monitors.
---

The element adapter coordinates native browser drag events and turns them into typed lifecycle callbacks.

<div class="api-grid">
  <div class="api-card">
    <h3>draggable</h3>
    <p>Registers an element as a drag source and returns an idempotent cleanup function.</p>
    <code>draggable({ element, dragHandle, getData, getNativeData })</code>
  </div>
  <div class="api-card">
    <h3>dropTargetForElements</h3>
    <p>Registers an element as a drop target for element drags.</p>
    <code>dropTargetForElements({ element, canDrop, getData, getDropEffect })</code>
  </div>
  <div class="api-card">
    <h3>monitorForElements</h3>
    <p>Listens to element drag lifecycle events after source and target callbacks.</p>
    <code>monitorForElements({ canMonitor, onDragStart, onDrop })</code>
  </div>
  <div class="api-card">
    <h3>Lifecycle callbacks</h3>
    <p>Use preview, start, target-change, drag, and drop callbacks for UI and state updates.</p>
    <code>onGenerateDragPreview, onDragStart, onDropTargetChange, onDrag, onDrop</code>
  </div>
</div>

## Event order

Events dispatch in this order:

1. Drag source.
2. Current drop targets from innermost to outermost.
3. Monitors in creation order.
