---
title: Accessibility
description: Keyboard behavior, announcements and focus for each Drag API.
---

Drag gestures need an equivalent keyboard path. Each API has a different contract; choose it deliberately and test it in the interface where it is used.

## Sortable and React

The engine adds a tab stop when needed, instructions referenced with `aria-describedby`, and an assertive live region. Give each handle a meaningful accessible name and visible focus styling. Give containers and items readable `label` values.

| Key | Action |
| --- | --- |
| Space on a handle | Lift the item. |
| Arrow keys | Move through slots or compatible lists. |
| Space or Enter while lifted | Drop. |
| Escape | Cancel and return. |
| Tab while lifted | Kept within the drag; drop or cancel before continuing tab navigation. |

The `messages` option can replace `instructions` and the `lifted`, `moved`, `outside`, `combining`, `combined`, `dropped` and `returned` messages. Position and count in announcement arguments are one-based. Translate the messages to match your app.

Text-mode items deliberately keep editor keyboard behavior and do not lift from the keyboard. Supply your own move commands for those blocks.

## Grid

The app creates a keyboard gesture with `grid.keyboard()`. Provide a focusable trigger, a meaningful label, optional Tab targets and an `announce` function. Restore your preview on cancellation and preserve focus when committing model changes.

## HTML custom elements

Handles move immediately with ArrowUp, ArrowDown, Home and End. They do not use Space to lift. Focus returns to the handle after a keyboard move.

Provide a `data-0001-drag-live-region` element with `aria-live="polite"` and `aria-atomic="true"`. The current automatic fallback is hidden with the HTML `hidden` attribute, which removes it from the accessibility tree; it is not sufficient for screen-reader announcements. The examples provide their own visible region.

## Native element adapter

The element adapter alone handles native drag events and does not add a keyboard reorder interaction. Supply separate move commands or use the sortable layer.

## Check in your app

Complete the same action by mouse, touch and keyboard. Check accessible names, the announced item and destination, Escape cancellation, focus after a drop, moving between lists and reduced motion. Unit tests and these examples do not establish assistive-technology support for every consuming app.
