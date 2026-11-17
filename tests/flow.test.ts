import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collapsed, flowHolds, flowStarts } from '../src/flow';
import { createSortable, type SortableMovement } from '../src/sortable';

describe('flow', () => {
  it('collapses adjoining margins as block flow does', () => {
    expect(collapsed(20, 40)).toBe(40);
    expect(collapsed(20, -10)).toBe(10);
    expect(collapsed(-20, -10)).toBe(-20);
  });

  it('adds margins and the gap where nothing collapses', () => {
    const items = [{ start: 0, size: 20, marginStart: 0, marginEnd: 20 }, { start: 0, size: 20, marginStart: 20, marginEnd: 0 }];
    expect(flowStarts(items, { gap: 20, collapse: false, through: false }, 0)).toEqual([0, 80]);
    expect(flowStarts(items, { gap: 0, collapse: true, through: false }, 0)).toEqual([0, 40]);
  });

  it('holds only where it draws the list where the page did', () => {
    const items = [{ start: 0, size: 20, marginStart: 0, marginEnd: 0 }, { start: 40, size: 20, marginStart: 0, marginEnd: 0 }];
    expect(flowHolds(items, { gap: 20, collapse: false, through: false }, 0)).toBe(true);
    expect(flowHolds(items, { gap: 0, collapse: false, through: false }, 0)).toBe(false);
  });
});

function pointer(type: string, target: EventTarget, x: number, y: number): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: 'mouse' }, button: { value: 0 }, clientX: { value: x }, clientY: { value: y } });
  target.dispatchEvent(event);
}

function stub(element: HTMLElement, layout: number, height: number): void {
  element.getBoundingClientRect = () => {
    const [, y = '0'] = (element.style.translate || '0 0').split(' ');
    const top = layout + (Number.parseFloat(y) || 0);
    return { left: 0, top, width: 200, height, right: 200, bottom: top + height, x: 0, y: top, toJSON: () => ({}) };
  };
}

function page() {
  const list = document.createElement('div');
  list.style.paddingTop = '20px';
  stub(list, 0, 400);
  const parts = [
    { top: 60, height: 40, margins: ['40px', '0px'] },
    { top: 100, height: 60, margins: ['0px', '20px'] },
    { top: 180, height: 20, margins: ['20px', '0px'] },
  ].map(({ top, height, margins }, index) => {
    const element = document.createElement('div');
    element.textContent = `part ${index}`;
    [element.style.marginTop, element.style.marginBottom] = margins;
    stub(element, top, height);
    list.append(element);
    return element;
  });
  document.body.append(list);
  return { list, parts };
}

describe('one movement per change of place', () => {
  let movements: SortableMovement[];
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] }); movements = []; HTMLElement.prototype.animate = vi.fn(); });
  afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); });

  function drag(drawn: (parts: HTMLElement[]) => void) {
    const { list, parts } = page();
    const sortable = createSortable({
      onMovement: (movement) => movements.push(movement),
      prepareDrop: () => { drawn(parts); return parts[1]; },
    });
    sortable.container({ element: list, id: 'page' });
    parts.forEach((part, index) => sortable.item({ element: part, id: `part${index}` }));
    pointer('pointerdown', parts[1], 10, 120);
    pointer('pointermove', window, 10, 126);
    pointer('pointermove', window, 10, 200);
    return { sortable, parts };
  }

  it('moves a sibling straight to where the dropped order draws it, margins collapsed', () => {
    const { sortable, parts } = drag(() => {});
    expect(parts[2].style.translate).toBe('0 -60px');
    sortable.destroy();
  });

  it('moves nothing again on release when the page draws what the drag showed', async () => {
    const { sortable } = drag((parts) => { stub(parts[2], 120, 20); stub(parts[1], 160, 60); });
    pointer('pointerup', window, 10, 200);
    await vi.runAllTimersAsync();
    expect(movements.filter((movement) => movement.phase === 'drag').map((movement) => movement.y)).toEqual([-60]);
    expect(movements.filter((movement) => movement.phase === 'drop')).toEqual([]);
    sortable.destroy();
  });

  it('reports a second move when the page draws a sibling elsewhere', async () => {
    const { sortable, parts } = drag((parts) => { stub(parts[2], 130, 20); });
    pointer('pointerup', window, 10, 200);
    await vi.runAllTimersAsync();
    expect(movements.filter((movement) => movement.phase === 'drop')).toEqual([{ element: parts[2], phase: 'drop', x: 0, y: 10 }]);
    sortable.destroy();
  });
});
