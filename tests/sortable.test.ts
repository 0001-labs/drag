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

  it('preserves contextual appearance in the lifted clone and its descendants', () => {
    const a = column('a', 0, 2);
    const style = document.createElement('style');
    style.textContent = '[data-id="a"] > div { background: rgb(20, 30, 40); padding: 3px; border-radius: 7px } [data-id="a"] strong { color: rgb(120, 40, 30); font-size: 18px }';
    document.body.append(style);
    a.cells[0].innerHTML = 'Words with <strong>emphasis</strong>';
    register(sortable, a, 'a');
    pointer('pointerdown', a.cells[0], 10, 10);
    pointer('pointermove', window, 10, 35);
    const preview = document.querySelector<HTMLElement>('[data-drag-preview]')!;
    expect(getComputedStyle(preview).backgroundColor).toBe('rgb(20, 30, 40)');
    expect(getComputedStyle(preview).padding).toBe('3px');
    expect(getComputedStyle(preview).borderRadius).toBe('7px');
    expect(getComputedStyle(preview.querySelector('strong')!).color).toBe('rgb(120, 40, 30)');
    expect(getComputedStyle(preview.querySelector('strong')!).fontSize).toBe('18px');
  });

  it('lets overlay coordinates override copied logical insets', () => {
    const a = column('a', 300, 2);
    a.cells[0].style.setProperty('inset-inline', '0px', 'important');
    a.cells[0].style.setProperty('inset-block', '0px', 'important');
    register(sortable, a, 'a');
    pointer('pointerdown', a.cells[0], 310, 10);
    pointer('pointermove', window, 310, 35);
    const preview = document.querySelector<HTMLElement>('[data-drag-preview]')!;
    expect(preview.style.getPropertyValue('inset-inline')).toBe('');
    expect(preview.style.getPropertyValue('inset-block')).toBe('');
    expect(preview.style.left).toBe('300px');
    expect(preview.style.top).toBe('0px');
    expect(a.cells[0].style.getPropertyValue('inset-inline')).toBe('0px');
  });

  it('owns pointer and keyboard gestures in an iframe document', async () => {
    const frame = document.createElement('iframe'); document.body.append(frame);
    const doc = frame.contentDocument!, view = frame.contentWindow!;
    const list = doc.createElement('div'); doc.body.append(list); stubBox(list, 0, 0, 100, 300);
    const cells = [0, 1, 2].map(index => { const cell = doc.createElement('div'); cell.textContent = String(index); stubBox(cell, 0, index * 20, 80, 19); list.append(cell); return cell; });
    register(sortable, { list, cells }, 'framed');
    pointer('pointerdown', cells[0], 10, 10); pointer('pointermove', view, 10, 35);
    expect(sortable.isDragging()).toBe(true);
    expect(doc.querySelector('[data-drag-preview]')).not.toBeNull();
    expect(document.querySelector('[data-drag-preview]')).toBeNull();
    pointer('pointerup', view, 10, 35); await vi.runAllTimersAsync();
    expect(ended[0]).toEqual(expect.objectContaining({ destination: { droppableId: 'framed', index: 1 }, reason: 'DROP' }));
    cells[0].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(sortable.isDragging()).toBe(true);
    view.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await vi.runAllTimersAsync();
    expect(ended.at(-1)?.reason).toBe('CANCEL');
    const remove = vi.spyOn(view, 'removeEventListener'); sortable.destroy();
    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
    expect(doc.querySelector('[aria-live]')).toBeNull();
  });

  it('lands at the prepared authored layout and hands visibility back once', async () => {
    // The layout handoff waits for the owner window's frame; tie it to this test's clock.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => window.setTimeout(() => callback(performance.now()), 16));
    sortable.destroy();
    const a = column('a', 0, 3);
    let final: HTMLElement;
    sortable = createSortable({
      prepareDrop: () => {
        final = document.createElement('div'); a.list.append(final);
        stubBox(final, 120, 140, 80, 20);
        sortable.destroy(); // Nested editors are replaced when columns are committed.
        return () => final;
      },
      onDragEnd: result => ended.push(result),
    });
    register(sortable, a, 'a');
    pointer('pointerdown', a.cells[0], 10, 10);
    pointer('pointermove', window, 10, 35);
    pointer('pointerup', window, 10, 35);
    expect(final!.style.visibility).toBe('hidden');
    await vi.advanceTimersByTimeAsync(20);
    expect((document.querySelector('[data-drag-preview]') as HTMLElement).style.transform).toContain('120px, 140px');
    expect(ended).toHaveLength(0);
    await vi.runAllTimersAsync();
    expect(final!.style.visibility).toBe('');
    expect(ended).toHaveLength(1);
    expect(document.querySelector('[data-drag-preview]')).toBeNull();
  });

  it('scrolls the shared board while the pointer crosses a gap between lists', async () => {
    const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => window.setTimeout(() => callback(performance.now()), 16));
    const a = column('a', 0, 2);
    const b = column('b', 100, 2);
    const scroller = document.createElement('div');
    scroller.style.overflowX = 'auto';
    stubBox(scroller, 0, 0, 100, 400);
    scroller.scrollBy = (x = 0) => { scroller.scrollLeft += Number(x); };
    scroller.append(a.list, b.list);
    document.body.append(scroller);
    register(sortable, a, 'a');
    register(sortable, b, 'b');

    pointer('pointerdown', a.cells[0], 10, 60);
    pointer('pointermove', window, 89, 60);
    expect(updates.at(-1)).toBeNull();
    await vi.advanceTimersByTimeAsync(32);
    expect(scroller.scrollLeft).toBeGreaterThan(0);
    frame.mockRestore();
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
    // The sibling closes up by the cell and its pixel, and says how far for what is inside it.
    expect(a.cells[1].style.translate).toBe('0 -20px');
    expect(a.cells[1].style.getPropertyValue('--drag-shift')).toBe('-20px');
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

  it('keeps a native drag from taking a pressed or lifted item, from the lifted clone too', () => {
    const a = column('a', 0, 3);
    register(sortable, a, 'a');
    const nativeDrag = (target: EventTarget) => {
      const event = new Event('dragstart', { bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    pointer('pointerdown', a.cells[0], 10, 10);
    expect(nativeDrag(a.cells[0])).toBe(true);
    pointer('pointermove', window, 10, 40);
    const clone = document.querySelector('[data-drag-overlay]')!.firstElementChild!;
    expect(nativeDrag(clone)).toBe(true);
    pointer('pointermove', window, 300, 40);
    pointer('pointerup', window, 300, 40);
    vi.runAllTimers();
    expect(ended[0]).toEqual(expect.objectContaining({ destination: null, reason: 'DROP' }));
    expect(nativeDrag(a.cells[0])).toBe(false);
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

  it('cancels when the page is hidden or left, as it does on blur', () => {
    const a = column('a', 0, 3);
    register(sortable, a, 'a');
    let hidden = false;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    pointer('pointerdown', a.cells[0], 10, 10);
    pointer('pointermove', window, 10, 40);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sortable.isDragging()).toBe(true);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    vi.runAllTimers();
    expect(ended[0]).toEqual(expect.objectContaining({ destination: null, reason: 'CANCEL' }));
    hidden = false;
    pointer('pointerdown', a.cells[0], 10, 10);
    pointer('pointermove', window, 10, 40);
    window.dispatchEvent(new Event('pagehide'));
    vi.runAllTimers();
    expect(ended[1]).toEqual(expect.objectContaining({ destination: null, reason: 'CANCEL' }));
    expect(document.querySelector('[data-drag-overlay]')).toBeNull();
    // @ts-expect-error The test's own property is removed again.
    delete document.visibilityState;
  });

  it('ignores a second pointer while one carries an item', () => {
    const a = column('a', 0, 3);
    register(sortable, a, 'a');
    const second = (type: string, target: EventTarget, x: number, y: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, { pointerId: { value: 2 }, pointerType: { value: 'touch' }, button: { value: 0 }, clientX: { value: x }, clientY: { value: y } });
      target.dispatchEvent(event);
    };
    pointer('pointerdown', a.cells[0], 10, 10, 'touch');
    vi.advanceTimersByTime(250);
    expect(sortable.isDragging()).toBe(true);
    second('pointerdown', a.cells[2], 10, 50);
    second('pointermove', window, 10, 80);
    second('pointerup', window, 10, 80);
    second('pointercancel', window, 10, 80);
    expect(sortable.isDragging()).toBe(true);
    expect(updates).toEqual([]);
    pointer('pointermove', window, 10, 40, 'touch');
    pointer('pointerup', window, 10, 40, 'touch');
    vi.runAllTimers();
    expect(ended).toHaveLength(1);
    expect(ended[0]).toEqual(expect.objectContaining({ draggableId: 'a0', destination: { droppableId: 'a', index: 1 }, reason: 'DROP' }));
  });

  it('never offers a list inside the lifted item, nor reports its items as moving', () => {
    sortable.destroy();
    const movements: unknown[] = [];
    sortable = createSortable({ onDragEnd: (result) => ended.push(result), onMovement: (movement) => movements.push(movement) });
    const a = column('a', 0, 3);
    register(sortable, a, 'a');
    // a0 holds a list of its own, drawn inside it.
    const inner = document.createElement('div');
    stubBox(inner, 0, 0, cellWidth, cellHeight);
    const child = document.createElement('div');
    stubBox(child, 0, 0, cellWidth, 10);
    inner.append(child); a.cells[0].append(inner);
    sortable.container({ element: inner, id: 'inner', type: 'cell' });
    sortable.item({ element: child, id: 'child', type: 'cell' });
    pointer('pointerdown', a.cells[0], 70, 15);
    pointer('pointermove', window, 70, 9);
    expect(sortable.isDragging()).toBe(true);
    pointer('pointerup', window, 70, 9);
    vi.runAllTimers();
    expect(ended[0]?.destination?.droppableId).not.toBe('inner');
    expect(movements.filter((movement) => (movement as { element: Element }).element === child)).toEqual([]);
  });

  it('finishes the last drop\'s settling before a new lift measures the page', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => window.setTimeout(() => callback(performance.now()), 16));
    sortable.destroy();
    const a = column('a', 0, 3);
    const finished: HTMLElement[] = [];
    const animate = vi.fn(function (this: HTMLElement) {
      return { finish: () => finished.push(this), addEventListener: () => {} } as unknown as Animation;
    });
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    sortable = createSortable({
      // The committed order draws a1 where a0 was.
      prepareDrop: () => { stubBox(a.cells[1], 0, 0, cellWidth, cellHeight); stubBox(a.cells[0], 0, pitch, cellWidth, cellHeight); return a.cells[0]; },
      onDragEnd: result => ended.push(result),
    });
    register(sortable, a, 'a');
    pointer('pointerdown', a.cells[0], 10, 10);
    pointer('pointermove', window, 10, 35);
    pointer('pointerup', window, 10, 35);
    await vi.advanceTimersByTimeAsync(20);
    expect(animate).toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(ended).toHaveLength(1);
    expect(finished).toEqual([]);
    pointer('pointerdown', a.cells[2], 10, 50);
    pointer('pointermove', window, 10, 60);
    expect(finished).toContain(a.cells[1]);
    // @ts-expect-error The test's own animate is removed again.
    delete HTMLElement.prototype.animate;
    await vi.runAllTimersAsync();
  });

  it('hands a foreign list\'s reserved room to the commit', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => window.setTimeout(() => callback(performance.now()), 16));
    sortable.destroy();
    const a = column('a', 0, 2), b = column('b', 100, 2);
    const reserves: string[] = [];
    sortable = createSortable({
      prepareDrop: () => { reserves.push(b.list.style.getPropertyValue('--drag-reserve')); return a.cells[0]; },
      onDragEnd: result => ended.push(result),
    });
    register(sortable, a, 'a'); register(sortable, b, 'b');
    pointer('pointerdown', a.cells[0], 10, 10);
    pointer('pointermove', window, 110, 50);
    expect(b.list.style.getPropertyValue('--drag-reserve')).toBe('20px');
    pointer('pointerup', window, 110, 50);
    await vi.runAllTimersAsync();
    expect(reserves).toEqual(['']);
    expect(ended[0]?.destination?.droppableId).toBe('b');
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

  describe('when the items are writing', () => {
    function writing(layout: Layout, hold: () => number, seen?: Array<{ input: string; target: Element | null }>): void {
      sortable.container({ element: layout.list, id: 'a', type: 'cell' });
      layout.cells.forEach((cell, index) => {
        cell.contentEditable = 'true';
        sortable.item({ element: cell, id: `a${index}`, type: 'cell', text: { hold }, canDrag: (by) => { seen?.push(by); return true } });
      });
    }

    it('lifts only after a press held still, and leaves a moving press to select words', () => {
      const a = column('a', 0, 3);
      writing(a, () => 400);
      pointer('pointerdown', a.cells[0], 10, 10);
      pointer('pointermove', window, 10, 30);
      vi.advanceTimersByTime(500);
      expect(sortable.isDragging()).toBe(false);
      pointer('pointerup', window, 10, 30);

      pointer('pointerdown', a.cells[0], 10, 10);
      pointer('pointermove', window, 11, 12);
      vi.advanceTimersByTime(399);
      expect(sortable.isDragging()).toBe(false);
      vi.advanceTimersByTime(1);
      expect(sortable.isDragging()).toBe(true);
      pointer('pointermove', window, 11, 52);
      pointer('pointerup', window, 11, 52);
      vi.runAllTimers();
      expect(ended[0]).toEqual(expect.objectContaining({ reason: 'DROP', source: { droppableId: 'a', index: 0 }, destination: { droppableId: 'a', index: 2 } }));
    });

    it('lifts at once on a move along its axis, and leaves a move any other way to select words', () => {
      const a = column('a', 0, 3);
      sortable.container({ element: a.list, id: 'a', type: 'cell' });
      a.cells.forEach((cell, index) => {
        cell.contentEditable = 'true';
        sortable.item({ element: cell, id: `a${index}`, type: 'cell', text: { hold: () => 400, axis: 'y' } });
      });
      pointer('pointerdown', a.cells[0], 10, 10);
      pointer('pointermove', window, 20, 11);
      expect(sortable.isDragging()).toBe(false);
      vi.advanceTimersByTime(500);
      expect(sortable.isDragging()).toBe(false);
      pointer('pointerup', window, 20, 11);

      pointer('pointerdown', a.cells[0], 10, 10);
      pointer('pointermove', window, 14, 14);
      expect(sortable.isDragging()).toBe(false);
      pointer('pointerup', window, 14, 14);

      pointer('pointerdown', a.cells[0], 10, 10);
      pointer('pointermove', window, 11, 16);
      expect(sortable.isDragging()).toBe(true);
      pointer('pointermove', window, 11, 52);
      pointer('pointerup', window, 11, 52);
      vi.runAllTimers();
      expect(ended[0]).toEqual(expect.objectContaining({ reason: 'DROP', source: { droppableId: 'a', index: 0 }, destination: { droppableId: 'a', index: 2 } }));
    });

    it('lifts at once on a move when its hold is nought', () => {
      const a = column('a', 0, 3);
      writing(a, () => 0);
      pointer('pointerdown', a.cells[1], 10, 30);
      pointer('pointermove', window, 10, 36);
      expect(sortable.isDragging()).toBe(true);
    });

    it('keeps its caret, cursor and keys: no grab, no tab stop, no instructions, no space to lift', () => {
      const a = column('a', 0, 2);
      writing(a, () => 400);
      const cell = a.cells[0];
      expect(cell.getAttribute('data-drag-handle')).toBe('text');
      expect(cell.hasAttribute('aria-describedby')).toBe(false);
      expect(cell.getAttribute('tabindex')).toBeNull();
      cell.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      expect(sortable.isDragging()).toBe(false);
      expect(document.querySelector('style[data-0001-drag-sortable-style]')?.textContent).toContain(':not([data-drag-handle="text"])');
    });

    it('tells canDrag what was pressed', () => {
      const a = column('a', 0, 2);
      const seen: Array<{ input: string; target: Element | null }> = [];
      writing(a, () => 400, seen);
      const word = document.createElement('span');
      a.cells[1].append(word);
      pointer('pointerdown', word, 10, 30);
      expect(seen.at(-1)).toEqual({ input: 'mouse', target: word });
    });
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

  it('keeps the lifted item on its line when asked', () => {
    sortable.destroy();
    sortable = createSortable({ lockAxis: 'y' });
    const a = column('a', 0, 3);
    register(sortable, a, 'a');
    pointer('pointerdown', a.cells[0], 10, 10);
    pointer('pointermove', window, 60, 40);
    expect(document.querySelector<HTMLElement>('[data-drag-preview]')?.style.transform).toBe('translate3d(0px, 30px, 0)');
  });

  describe('a list whose items hold still', () => {
    const still = (layout: Layout, id: string, extra: Partial<Parameters<SortableController['container']>[0]> = {}) => {
      sortable.container({ element: layout.list, id, type: 'cell', still: true, ...extra });
      layout.cells.forEach((cell, index) => sortable.item({ element: cell, id: `${id}${index}`, type: 'cell' }));
    };
    const preview = () => document.querySelector<HTMLElement>('[data-drag-preview]');

    it('moves nothing out of the way and lands a drop at once', () => {
      const a = column('a', 0, 4);
      const b = column('b', 100, 3);
      still(a, 'a');
      still(b, 'b');
      pointer('pointerdown', a.cells[0], 10, 10);
      pointer('pointermove', window, 10, 50);
      expect(updates.at(-1)).toEqual({ droppableId: 'a', index: 2 });
      expect(a.cells.map((cell) => cell.style.translate)).toEqual(['', '', '', '']);
      pointer('pointermove', window, 110, 10);
      expect(b.cells[0].style.translate).toBe('');
      expect(b.list.style.getPropertyValue('--drag-reserve')).toBe('');
      pointer('pointerup', window, 110, 10);
      // No timers run: the drop is there at once.
      expect(ended).toEqual([expect.objectContaining({ destination: { droppableId: 'b', index: 0 }, reason: 'DROP' })]);
      expect(preview()).toBeNull();
    });

    it('steps the keyboard from item to item, over each as it stood', () => {
      const a = column('a', 0, 4);
      still(a, 'a');
      a.cells[1].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      const down = () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      down();
      // Over a2, a square below where a1 was lifted.
      expect(updates.at(-1)).toEqual({ droppableId: 'a', index: 2 });
      expect(preview()?.style.transform).toBe('translate3d(0px, 20px, 0)');
      down();
      expect(preview()?.style.transform).toBe('translate3d(0px, 40px, 0)');
      expect(a.cells.map((cell) => cell.style.translate)).toEqual(['', '', '', '']);
    });

    it('draws the preview its list asks for, kept on the list\'s own line', () => {
      const a = column('a', 0, 3);
      const drawn = document.createElement('div');
      drawn.textContent = 'block';
      still(a, 'a', { lockAxis: 'x', renderPreview: () => drawn });
      pointer('pointerdown', a.cells[0], 10, 10);
      pointer('pointermove', window, 40, 60);
      expect(preview()).toBe(drawn);
      expect(drawn.style.transform).toBe('translate3d(30px, 0px, 0)');
    });
  });

  describe('combining', () => {
    let combines: Array<{ draggableId: string; droppableId: string } | null>;

    beforeEach(() => {
      sortable.destroy();
      combines = [];
      sortable = createSortable({
        onDragUpdate: (update) => {
          updates.push(update.destination);
          combines.push(update.combine);
        },
        onDragEnd: (result) => ended.push(result),
      });
    });

    const combinable = (layout: Layout, id: string) => {
      sortable.container({ element: layout.list, id, type: 'cell', isCombineEnabled: () => true });
      layout.cells.forEach((cell, index) => sortable.item({ element: cell, id: `${id}${index}`, type: 'cell' }));
    };

    it('combines once the leading edge is inside the middle half of the next item', () => {
      const a = column('a', 0, 4);
      combinable(a, 'a');
      pointer('pointerdown', a.cells[0], 10, 10);
      // The bottom edge at 27: inside 24.75 to 34.25, the middle half of a1 where it stands.
      pointer('pointermove', window, 10, 18);
      expect(combines.at(-1)).toEqual({ draggableId: 'a1', droppableId: 'a' });
      expect(updates.at(-1)).toBeNull();
      expect(a.cells[1].hasAttribute('data-drag-combine')).toBe(true);
      // Past it, the item goes back to moving between the others.
      pointer('pointermove', window, 10, 26);
      expect(combines.at(-1)).toBeNull();
      expect(updates.at(-1)).toEqual({ droppableId: 'a', index: 1 });
      expect(a.cells[1].hasAttribute('data-drag-combine')).toBe(false);
    });

    it('drops onto the item it is held over', () => {
      const a = column('a', 0, 3);
      combinable(a, 'a');
      pointer('pointerdown', a.cells[0], 10, 10);
      pointer('pointermove', window, 10, 18);
      pointer('pointerup', window, 10, 18);
      vi.runAllTimers();
      expect(ended[0]).toEqual(
        expect.objectContaining({ reason: 'DROP', destination: null, combine: { draggableId: 'a1', droppableId: 'a' } }),
      );
      expect(a.cells[1].hasAttribute('data-drag-combine')).toBe(false);
    });

    it('never combines where the list does not allow it', () => {
      const a = column('a', 0, 3);
      register(sortable, a, 'a');
      pointer('pointerdown', a.cells[0], 10, 10);
      pointer('pointermove', window, 10, 18);
      expect(combines.filter(Boolean)).toEqual([]);
    });
  });

  it('lets the page draw itself before the lift is measured', () => {
    sortable.destroy();
    const calls: string[] = [];
    const a = column('a', 0, 4);
    sortable = createSortable({
      onDragUpdate: (update) => updates.push(update.destination),
      // A selection folded into the row that carries it: a2 leaves the list before the lift.
      onBeforeCapture: ({ draggableId, mode }) => {
        calls.push(`${draggableId}:${mode}`);
        a.cells[2].remove();
      },
      onDragStart: () => calls.push('start'),
    });
    register(sortable, a, 'a');
    pointer('pointerdown', a.cells[0], 10, 10);
    pointer('pointermove', window, 10, 100);
    expect(calls).toEqual(['a0:FLUID', 'start']);
    // Only a1 and a3 are left to pass: the end of the list is index 2.
    expect(updates.at(-1)).toEqual({ droppableId: 'a', index: 2 });
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
