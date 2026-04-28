import { draggable, dropTargetForElements } from './element';
import { combine, reorder } from './util';
import type { Cleanup, ElementDragEventPayload } from './types';

const itemType = '0001-drag-list-item';

export class DragListElement extends HTMLElement {
  #liveRegion: HTMLElement | null = null;

  connectedCallback(): void {
    if (!this.hasAttribute('role')) {
      this.setAttribute('role', 'list');
    }

    this.#liveRegion = this.querySelector('[data-0001-drag-live-region]');

    if (!this.#liveRegion) {
      this.#liveRegion = document.createElement('div');
      this.#liveRegion.setAttribute('data-0001-drag-live-region', '');
      this.#liveRegion.setAttribute('aria-live', 'polite');
      this.#liveRegion.setAttribute('aria-atomic', 'true');
      this.#liveRegion.hidden = true;
      this.append(this.#liveRegion);
    }
  }

  get items(): DragItemElement[] {
    return Array.from(this.querySelectorAll('drag-item'));
  }

  moveItem(sourceValue: string, targetValue: string): void {
    const items = this.items;
    const startIndex = items.findIndex((item) => item.value === sourceValue);
    const finishIndex = items.findIndex((item) => item.value === targetValue);

    if (startIndex < 0 || finishIndex < 0 || startIndex === finishIndex) {
      return;
    }

    const nextItems = reorder({ list: items, startIndex, finishIndex });
    for (const item of nextItems) {
      this.insertBefore(item, this.#liveRegion);
    }

    const moved = items[startIndex];
    const position = finishIndex + 1;
    const count = items.length;
    const label = moved?.label ?? sourceValue;

    this.#announce(`${label} moved to position ${position} of ${count}.`);
    this.dispatchEvent(
      new CustomEvent('0001-drag-reorder', {
        bubbles: true,
        detail: {
          sourceValue,
          targetValue,
          startIndex,
          finishIndex,
          values: nextItems.map((item) => item.value),
        },
      }),
    );
  }

  moveByKeyboard(item: DragItemElement, direction: 'before' | 'after' | 'top' | 'bottom'): void {
    const items = this.items;
    const startIndex = items.indexOf(item);

    if (startIndex < 0) {
      return;
    }

    const finishIndex =
      direction === 'before'
        ? Math.max(0, startIndex - 1)
        : direction === 'after'
          ? Math.min(items.length - 1, startIndex + 1)
          : direction === 'top'
            ? 0
            : items.length - 1;

    const target = items[finishIndex];

    if (!target) {
      return;
    }

    this.moveItem(item.value, target.value);
    item.handle?.focus();
  }

  #announce(message: string): void {
    if (this.#liveRegion) {
      this.#liveRegion.textContent = message;
    }
  }
}

export class DragItemElement extends HTMLElement {
  #cleanup: Cleanup | null = null;

  connectedCallback(): void {
    if (!this.hasAttribute('role')) {
      this.setAttribute('role', 'listitem');
    }

    queueMicrotask(() => {
      if (!this.isConnected || this.#cleanup) {
        return;
      }

      const list = this.list;
      const handle = this.handle;

      this.#cleanup = combine(
        draggable({
          element: this,
          dragHandle: handle,
          getData: () => ({
            type: itemType,
            value: this.value,
            label: this.label,
          }),
          onDragStart: (payload) => this.#emit('0001-drag-start', payload),
          onDropTargetChange: (payload) => this.#emit('0001-drag-target-change', payload),
          onDrag: (payload) => this.#emit('0001-drag-move', payload),
          onDrop: (payload) => {
            this.#emit('0001-drag-drop', payload);
            this.removeAttribute('data-dragging');
          },
        }),
        dropTargetForElements({
          element: this,
          canDrop: (payload) =>
            payload.source.data.type === itemType && payload.source.data.value !== this.value,
          getData: () => ({
            type: itemType,
            value: this.value,
            label: this.label,
          }),
          onDragEnter: (payload) => this.#emit('0001-drag-enter', payload),
          onDragLeave: (payload) => this.#emit('0001-drag-leave', payload),
          onDrop: (payload) => {
            const sourceValue = payload.source.data.value;

            if (typeof sourceValue === 'string' && list) {
              list.moveItem(sourceValue, this.value);
            }
          },
        }),
      );
    });
  }

  disconnectedCallback(): void {
    this.#cleanup?.();
    this.#cleanup = null;
  }

  get value(): string {
    return this.getAttribute('value') ?? this.textContent?.trim() ?? '';
  }

  get label(): string {
    return this.getAttribute('label') ?? this.textContent?.trim() ?? this.value;
  }

  get list(): DragListElement | null {
    return this.closest('drag-list');
  }

  get handle(): DragHandleElement | null {
    return this.querySelector('drag-handle');
  }

  #emit(type: string, payload: ElementDragEventPayload): void {
    this.dispatchEvent(
      new CustomEvent(type, {
        bubbles: true,
        detail: payload,
      }),
    );
  }
}

export class DragHandleElement extends HTMLElement {
  connectedCallback(): void {
    if (!this.hasAttribute('role')) {
      this.setAttribute('role', 'button');
    }

    if (!this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
    }

    if (!this.hasAttribute('aria-label')) {
      const item = getClosestDragItem(this);
      this.setAttribute('aria-label', item ? `Move ${item.label}` : 'Move item');
    }

    this.addEventListener('keydown', this.#onKeyDown);
  }

  disconnectedCallback(): void {
    this.removeEventListener('keydown', this.#onKeyDown);
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    const item = getClosestDragItem(this);
    const list = item?.list ?? null;

    if (!item || !list) {
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      list.moveByKeyboard(item, 'before');
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      list.moveByKeyboard(item, 'after');
    }

    if (event.key === 'Home') {
      event.preventDefault();
      list.moveByKeyboard(item, 'top');
    }

    if (event.key === 'End') {
      event.preventDefault();
      list.moveByKeyboard(item, 'bottom');
    }
  };
}

function getClosestDragItem(element: Element): DragItemElement | null {
  const item = element.closest('drag-item');
  return item instanceof DragItemElement ? item : null;
}

export function defineDragElements(): void {
  if (!customElements.get('drag-list')) {
    customElements.define('drag-list', DragListElement);
  }

  if (!customElements.get('drag-item')) {
    customElements.define('drag-item', DragItemElement);
  }

  if (!customElements.get('drag-handle')) {
    customElements.define('drag-handle', DragHandleElement);
  }
}

defineDragElements();
