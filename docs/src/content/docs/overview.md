---
title: Overview
description: Drag and drop for lists, boards and grids, with TypeScript, React or HTML.
---

Drag lets people move things in your interface with a mouse, a finger, a pen or the keyboard. Use it to reorder a list, carry an item between columns, or move a box across a grid.

The engine is written in TypeScript and works without a framework. Your app owns the data and commits each change when the person drops it.

[Install Drag](/start-here/install/), [try the sortable demo](/examples/sortable/), or try [Play](/).

## Choose an API

| You are building | Start with | What it does |
| --- | --- | --- |
| A sortable list or columns | [Sortable](/start-here/sortable/) | Moves a preview, makes room between items, scrolls at the edges and supports keyboard dragging. |
| A React interface | [React](/start-here/react/) | A provider and ref hooks over the same sortable engine. |
| A diagram or a canvas on squares | [Grid](/api/grid/) | Reports gestures in grid coordinates; you draw the movement and save the result. |
| A small HTML list | [Web Components](/start-here/web-components/) | Custom elements that reorder their own children. |
| Native browser drag events | [Element adapter](/api/element-adapter/) | Sources, drop targets and monitors with typed lifecycle events. |

## Open source

Drag is [MIT licensed](https://github.com/0001-labs/Drag/blob/main/LICENSE). The sortable motion carries over behavior from @hello-pangea/dnd; its attribution is in [NOTICE](https://github.com/0001-labs/Drag/blob/main/NOTICE). React is optional. The framework-neutral entry points do not need it.

These guides follow the current source. See [installation and versions](/start-here/install/#versions) before choosing between the published alpha and a source build.
