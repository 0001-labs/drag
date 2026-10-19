import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSortable, type SortableController, type SortableResult } from '../src/sortable';

const pitch = 20;
const cellHeight = 19;
const cellWidth = 79;

type Layout = { list: HTMLElement; cells: HTMLElement[] };

function pointer(type: string, target: EventTarget, x: number, y: number, pointerType = 'mouse'): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: pointerType },
    button: { value: 0 },
    clientX: { value: x },
    clientY: { value: y },
  });
  target.dispatchEvent(event);
}

function stubBox(element: HTMLElement, left: number, top: number, width: number, height: number): void {
  element.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });
}

/** A column of cells 19px high a pixel apart, as an Ezo list draws them. */
function column(id: string, left: number, count: number): Layout {
  const list = document.createElement('div');
  list.dataset.id = id;
  stubBox(list, left, 0, cellWidth, 400);
  const cells = Array.from({ length: count }, (_, index) => {
    const cell = document.createElement('div');
    cell.textContent = `${id}${index}`;
    cell.style.marginBottom = '1px';
    stubBox(cell, left, index * pitch, cellWidth, cellHeight);
    list.append(cell);
    return cell;
  });
  document.body.append(list);
  return { list, cells };
}

function register(sortable: SortableController, layout: Layout, id: string): void {
  sortable.container({ element: layout.list, id, type: 'cell' });
  layout.cells.forEach((cell, index) => sortable.item({ element: cell, id: `${id}${index}`, type: 'cell' }));
}

describe('createSortable', () => {
  let sortable: SortableController;
  let ended: SortableResult[];
  let updates: Array<{ droppableId: string; index: number } | null>;

  beforeEach(() => {
    vi.useFakeTimers();
    ended = [];
    updates = [];
    sortable = createSortable({
      onDragUpdate: (update) => updates.push(update.destination),
      onDragEnd: (result) => ended.push(result),
    });
  });

  afterEach(() => {
    sortable.destroy();
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('waits for the mouse to move five pixels before it lifts', () => {
    const a = column('a', 0, 3);
    register(sortable, a, 'a');
    pointer('pointerdown', a.cells[0], 10, 10);
    pointer('pointermove', window, 10, 13);
    expect(sortable.isDragging()).toBe(false);
    pointer('pointermove', window, 10, 16);
    expect(sortable.isDragging()).toBe(true);
    expect(document.querySelector('[data-drag-preview]')).not.toBeNull();
    expect(a.cells[0].style.visibility).toBe('hidden');
  });

  it('moves a sibling once the lifted edge passes its centre, by the lifted size', () => {
    const a = column('a', 0, 4);
    register(sortable, a, 'a');
    pointer('pointerdown', a.cells[0], 10, 10);
    // The bottom edge (19 + moved) passes the next centre (29.5) once moved past 10.5.
    pointer('pointermove', window, 10, 20);
    expect(updates).toEqual([]);
    pointer('pointermove', window, 10, 21);
    expect(updates.at(-1)).toEqual({ droppableId: 'a', index: 1 });
    // The sibling closes up by the cell and its pixel.
    expect(a.cells[1].style.translate).toBe('0 -20px');
  });

  it('does not flicker back when the lifted item stops just past a centre', () => {
    const a = column('a', 0, 4);
    register(sortable, a, 'a');
    pointer('pointerdown', a.cells[0], 10, 10);
    pointer('pointermove', window, 10, 22);
    pointer('pointermove', window, 10, 21);
    pointer('pointermove', window, 10, 20);
    expect(updates).toEqual([{ droppableId: 'a', index: 1 }]);
    // Back once the top edge passes the moved sibling's centre (9.5).
    pointer('pointermove', window, 10, 19);
    expect(updates.at(-1)).toEqual({ droppableId: 'a', index: 0 });
  });

  it('drops into another list and makes room there', () => {
    const a = column('a', 0, 3);
    const b = column('b', 100, 3);
    register(sortable, a, 'a');
    register(sortable, b, 'b');
    pointer('pointerdown', a.cells[0], 10, 10);
    pointer('pointermove', window, 110, 10);
    expect(updates.at(-1)).toEqual({ droppableId: 'b', index: 0 });
    expect(b.cells[0].style.translate).toBe('0 20px');
    expect(a.cells[1].style.translate).toBe('0 -20px');
    pointer('pointerup', window, 110, 10);
    vi.runAllTimers();
    expect(ended).toEqual([
      expect.objectContaining({
        draggableId: 'a0',
        source: { droppableId: 'a', index: 0 },
        destination: { droppableId: 'b', index: 0 },
        reason: 'DROP',
      }),
    ]);
    expect(document.querySelector('[data-drag-preview]')).toBeNull();
    expect(b.cells[0].style.translate).toBe('');
    expect(a.cells[0].style.visibility).toBe('');
  });

  it('reports no destination for a drop outside every list', () => {
    const a = column('a', 0, 3);
    register(sortable, a, 'a');
    pointer('pointerdown', a.cells[0], 10, 10);
    pointer('pointermove', window, 300, 10);
    pointer('pointerup', window, 300, 10);
    vi.runAllTimers();
    expect(ended[0]).toEqual(expect.objectContaining({ destination: null, reason: 'DROP' }));
  });

  it('cancels with Escape and sends the item home', () => {
    const a = column('a', 0, 3);
    register(sortable, a, 'a');
    pointer('pointerdown', a.cells[0], 10, 10);
    pointer('pointermove', window, 10, 40);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(a.cells[1].style.translate).toBe('none');
    vi.runAllTimers();
    expect(ended[0]).toEqual(expect.objectContaining({ destination: null, reason: 'CANCEL' }));
  });

  it('lifts on touch only after the hold, and lets a moving finger scroll', () => {
    const a = column('a', 0, 3);
    register(sortable, a, 'a');
    pointer('pointerdown', a.cells[0], 10, 10, 'touch');
    pointer('pointermove', window, 10, 30, 'touch');
    vi.advanceTimersByTime(300);
    expect(sortable.isDragging()).toBe(false);

    pointer('pointerup', window, 10, 30, 'touch');
    pointer('pointerdown', a.cells[0], 10, 10, 'touch');
    vi.advanceTimersByTime(249);
    expect(sortable.isDragging()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(sortable.isDragging()).toBe(true);
  });

  it('does not lift from a button inside the item unless it allows it', () => {
    const a = column('a', 0, 2);
    const button = document.createElement('button');
    a.cells[0].append(button);
    register(sortable, a, 'a');
    pointer('pointerdown', button, 10, 10);
    pointer('pointermove', window, 10, 30);
    expect(sortable.isDragging()).toBe(false);
  });

  it('lets the product take an item dropped outside every list, where it lies', () => {
    sortable.destroy();
    const taken: Array<{ x: number; y: number }> = [];
    sortable = createSortable({
      onDragEnd: (result) => ended.push(result),
      onDropOutside: (_start, point) => {
        taken.push(point);
        return true;
      },
    });
    const a = column('a', 0, 2);
    register(sortable, a, 'a');
    pointer('pointerdown', a.cells[0], 10, 10);
    pointer('pointermove', window, 300, 50);
    expect(document.documentElement.hasAttribute('data-drag-outside')).toBe(true);
    pointer('pointerup', window, 300, 50);
    expect(taken).toEqual([{ x: 300, y: 50 }]);
    expect(ended[0]).toEqual(expect.objectContaining({ destination: null, reason: 'DROP' }));
    expect(document.documentElement.hasAttribute('data-drag-outside')).toBe(false);
  });

  it('reads the pointer where the page says it is', () => {
    sortable.destroy();
    sortable = createSortable({
      onDragUpdate: (update) => updates.push(update.destination),
      pointerPoint: (event) => ({ x: event.clientX * 2, y: event.clientY * 2 }),
    });
    const a = column('a', 0, 4);
    register(sortable, a, 'a');
    pointer('pointerdown', a.cells[0], 5, 5);
    pointer('pointermove', window, 5, 16);
    expect(updates.at(-1)).toEqual({ droppableId: 'a', index: 1 });
  });

  describe('with the keyboard', () => {
    const key = (target: EventTarget, name: string) =>
      target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
    const spoken = () => document.querySelector('[aria-live="assertive"]')?.textContent;

    it('makes handles reachable and says how to lift them', () => {
      const a = column('a', 0, 2);
      register(sortable, a, 'a');
      const cell = a.cells[0];
      expect(cell.tabIndex).toBe(0);
      const described = document.getElementById(cell.getAttribute('aria-describedby') ?? '');
      expect(described?.textContent).toContain('Press space to lift');
    });

    it('lifts with space, moves a slot with each arrow and drops with space', () => {
      const a = column('a', 0, 4);
      register(sortable, a, 'a');
      sortable.container({ element: a.list, id: 'a', type: 'cell', label: 'Monday' });
      key(a.cells[0], ' ');
      expect(sortable.isDragging()).toBe(true);
      expect(spoken()).toBe('Lifted a0, position 1 of 4 in Monday.');
      key(document.body, 'ArrowDown');
      key(document.body, 'ArrowDown');
      expect(updates.at(-1)).toEqual({ droppableId: 'a', index: 2 });
      expect(spoken()).toBe('a0, position 3 of 4 in Monday.');
      expect(a.cells[1].style.translate).toBe('0 -20px');
      expect(a.cells[3].style.translate).toBe('');
      key(document.body, 'ArrowUp');
      key(document.body, ' ');
      vi.runAllTimers();
      expect(ended[0]).toEqual(
        expect.objectContaining({ mode: 'SNAP', reason: 'DROP', destination: { droppableId: 'a', index: 1 } }),
      );
      expect(spoken()).toBe('Dropped a0 at position 2 of 4 in Monday.');
      expect(document.activeElement).toBe(a.cells[0]);
    });

    it('moves across to the list beside it', () => {
      const a = column('a', 0, 3);
      const b = column('b', 100, 3);
      register(sortable, a, 'a');
      register(sortable, b, 'b');
      key(a.cells[1], ' ');
      key(document.body, 'ArrowRight');
      expect(updates.at(-1)).toEqual({ droppableId: 'b', index: 1 });
      key(document.body, 'ArrowLeft');
      expect(updates.at(-1)).toEqual({ droppableId: 'a', index: 1 });
    });

    it('keeps the arrows to the ends of a list', () => {
      const a = column('a', 0, 2);
      register(sortable, a, 'a');
      key(a.cells[0], ' ');
      key(document.body, 'ArrowUp');
      expect(updates).toEqual([]);
    });

    it('cancels with escape and says where the item is', () => {
      const a = column('a', 0, 3);
      register(sortable, a, 'a');
      key(a.cells[0], ' ');
      key(document.body, 'ArrowDown');
      key(document.body, 'Escape');
      vi.runAllTimers();
      expect(ended[0]).toEqual(expect.objectContaining({ reason: 'CANCEL', destination: null }));
      expect(spoken()).toBe('a0 is back at position 1 of 3 in a.');
    });

    it('leaves space alone in a field inside the item', () => {
      const a = column('a', 0, 2);
      const field = document.createElement('input');
      a.cells[0].append(field);
      register(sortable, a, 'a');
      key(field, ' ');
      expect(sortable.isDragging()).toBe(false);
    });
  });
});
