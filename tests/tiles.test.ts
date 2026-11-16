import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTiles, type TilesChange, type TilesController } from '../src/tiles';

const side = 100;

function pointer(type: string, target: EventTarget, x: number, y: number, more: { shiftKey?: boolean; altKey?: boolean } = {}): Event {
  const event = new Event(type, { bubbles: true, cancelable: true, composed: true });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'mouse' },
    button: { value: 0 },
    clientX: { value: x },
    clientY: { value: y },
    shiftKey: { value: !!more.shiftKey },
    altKey: { value: !!more.altKey },
  });
  target.dispatchEvent(event);
  return event;
}

function key(type: 'keydown' | 'keyup', name: string): void {
  window.dispatchEvent(new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true }));
}

/** A row of square tiles, laid out by the order it is told: the first at the wall's corner, each a side further on. */
function wall(names: string[], slots: (order: string[]) => string[] = (order) => order) {
  const surface = document.createElement('div');
  const tiles = names.map((name) => Object.assign(document.createElement('div'), { id: name }));
  const places = new Map<HTMLElement, number>();
  let order: HTMLElement[] = [...tiles];
  const drawn: string[][] = [];
  const arrange = (next: HTMLElement[]) => {
    const stand = slots(next.map((tile) => tile.id));
    next.forEach((tile) => places.set(tile, stand.indexOf(tile.id)));
    drawn.push(next.map((tile) => tile.id));
  };
  arrange(order);
  drawn.length = 0;
  surface.getBoundingClientRect = () => new DOMRect(0, 0, side * tiles.length, side);
  for (const tile of tiles) tile.getBoundingClientRect = () => new DOMRect((places.get(tile) ?? 0) * side, 0, side, side);
  surface.append(...tiles);
  document.body.append(surface);
  const changes: TilesChange[] = [];
  const cancelled: string[] = [];
  return {
    surface,
    tile: (name: string) => tiles.find((tile) => tile.id === name)!,
    tiles: () => order,
    arrange,
    drawn,
    changes,
    cancelled,
    onDrop: (change: TilesChange) => { changes.push(change); order = change.order; },
    onCancel: (tile: HTMLElement) => cancelled.push(tile.id),
    names: (list: HTMLElement[]) => list.map((tile) => tile.id),
  };
}

/** The middle of the place a tile at this index stands in. */
const middle = (index: number) => index * side + side / 2;

describe('createTiles', () => {
  let controller: TilesController;

  beforeEach(() => {
    vi.useFakeTimers();
    if (typeof DOMRect === 'undefined') throw new Error('The test environment has no DOMRect.');
  });

  afterEach(() => {
    controller?.destroy();
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('pushes: the carried tile takes the place of the one under the pointer and the rest step aside', () => {
    const page = wall(['a', 'b', 'c', 'd']);
    controller = createTiles(page);
    pointer('pointerdown', page.tile('a'), middle(0), 50);
    pointer('pointermove', window, middle(0) + 10, 50);
    expect(controller.isCarrying()).toBe(true);
    expect(page.tile('a').hasAttribute('data-drag-carried')).toBe(true);
    pointer('pointermove', window, middle(2), 50);
    expect(page.drawn.at(-1)).toEqual(['b', 'c', 'a', 'd']);
    pointer('pointerup', window, middle(2), 50);
    expect(controller.isCarrying()).toBe(false);
    expect(page.changes).toHaveLength(1);
    expect(page.changes[0]).toMatchObject({ from: 0, to: 2, mode: 'push', swapped: null });
    expect(page.names(page.changes[0].order)).toEqual(['b', 'c', 'a', 'd']);
    expect(page.tile('a').hasAttribute('data-drag-carried')).toBe(false);
  });

  it('keeps the carried tile under the pointer, where it was taken hold of', () => {
    const page = wall(['a', 'b', 'c']);
    controller = createTiles(page);
    pointer('pointerdown', page.tile('a'), 20, 30);
    pointer('pointermove', window, 60, 45);
    expect(page.tile('a').style.translate).toBe('40px 15px');
  });

  it('swaps while Shift is held: two tiles trade places and the others stay', () => {
    const page = wall(['a', 'b', 'c', 'd']);
    controller = createTiles(page);
    pointer('pointerdown', page.tile('a'), middle(0), 50, { shiftKey: true });
    pointer('pointermove', window, middle(0) + 10, 50);
    pointer('pointermove', window, middle(2), 50);
    expect(page.drawn.at(-1)).toEqual(['c', 'b', 'a', 'd']);
    pointer('pointermove', window, middle(3), 50);
    expect(page.drawn.at(-1)).toEqual(['d', 'b', 'c', 'a']);
    pointer('pointerup', window, middle(3), 50);
    expect(page.changes[0]).toMatchObject({ from: 0, to: 3, mode: 'swap' });
    expect(page.changes[0].swapped?.id).toBe('d');
  });

  it('puts a swap back when the pointer returns to where the tile came from', () => {
    const page = wall(['a', 'b', 'c']);
    controller = createTiles(page);
    pointer('pointerdown', page.tile('a'), middle(0), 50, { shiftKey: true });
    pointer('pointermove', window, middle(0) + 10, 50);
    pointer('pointermove', window, middle(2), 50);
    expect(page.drawn.at(-1)).toEqual(['c', 'b', 'a']);
    pointer('pointermove', window, middle(0), 50);
    expect(page.drawn.at(-1)).toEqual(['a', 'b', 'c']);
    pointer('pointerup', window, middle(0), 50);
    expect(page.changes).toHaveLength(0);
    expect(page.cancelled).toEqual(['a']);
  });

  it('reads the same pointer the other way when Shift is pressed mid-carry', () => {
    const page = wall(['a', 'b', 'c', 'd']);
    controller = createTiles(page);
    pointer('pointerdown', page.tile('a'), middle(0), 50);
    pointer('pointermove', window, middle(0) + 10, 50);
    pointer('pointermove', window, middle(2), 50);
    expect(page.drawn.at(-1)).toEqual(['b', 'c', 'a', 'd']);
    pointer('pointermove', window, middle(1), 50);
    key('keydown', 'Shift');
    expect(page.drawn.at(-1)).toEqual(['b', 'a', 'c', 'd']);
    key('keyup', 'Shift');
    expect(page.drawn.at(-1)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('takes everything back on Escape', () => {
    const page = wall(['a', 'b', 'c']);
    controller = createTiles(page);
    pointer('pointerdown', page.tile('a'), middle(0), 50);
    pointer('pointermove', window, middle(0) + 10, 50);
    pointer('pointermove', window, middle(2), 50);
    key('keydown', 'Escape');
    expect(controller.isCarrying()).toBe(false);
    expect(page.drawn.at(-1)).toEqual(['a', 'b', 'c']);
    expect(page.changes).toHaveLength(0);
    expect(page.cancelled).toEqual(['a']);
    expect(page.tile('a').style.translate).toBe('');
  });

  it('leaves a press on a control inside a tile to the control', () => {
    const page = wall(['a', 'b']);
    const button = document.createElement('button');
    page.tile('a').append(button);
    controller = createTiles(page);
    pointer('pointerdown', button, middle(0), 50);
    pointer('pointermove', window, middle(1), 50);
    expect(controller.isCarrying()).toBe(false);
    expect(page.drawn).toHaveLength(0);
  });

  it('keeps the browser from dragging a pressed tile, and leaves it to the browser when the page says not to carry', () => {
    const page = wall(['a', 'b']);
    controller = createTiles({ ...page, canCarry: (_tile, event) => !event.altKey });
    pointer('pointerdown', page.tile('a'), middle(0), 50);
    const kept = new Event('dragstart', { bubbles: true, cancelable: true });
    page.tile('a').dispatchEvent(kept);
    expect(kept.defaultPrevented).toBe(true);
    pointer('pointerup', window, middle(0), 50);
    pointer('pointerdown', page.tile('a'), middle(0), 50, { altKey: true });
    const left = new Event('dragstart', { bubbles: true, cancelable: true });
    page.tile('a').dispatchEvent(left);
    expect(left.defaultPrevented).toBe(false);
    pointer('pointermove', window, middle(1), 50);
    expect(controller.isCarrying()).toBe(false);
  });

  it('does not let the order flip back and forth over the tile it just changed places with', () => {
    const page = wall(['a', 'b', 'c']);
    controller = createTiles(page);
    pointer('pointerdown', page.tile('a'), middle(0), 50);
    pointer('pointermove', window, middle(0) + 10, 50);
    pointer('pointermove', window, middle(1), 50);
    expect(page.drawn.at(-1)).toEqual(['b', 'a', 'c']);
    const count = page.drawn.length;
    pointer('pointermove', window, middle(1) + 20, 50);
    pointer('pointermove', window, middle(1) - 20, 50);
    expect(page.drawn).toHaveLength(count);
  });

  it('holds its choice while the layout slides another tile under a still pointer', () => {
    // A layout that re-flows: once a leads b, c is drawn where b stood.
    const page = wall(['a', 'b', 'c'], (order) => (order.join() === 'b,a,c' ? ['b', 'c', 'a'] : order));
    controller = createTiles(page);
    pointer('pointerdown', page.tile('a'), middle(0), 50);
    pointer('pointermove', window, middle(0) + 10, 50);
    pointer('pointermove', window, middle(1), 50);
    expect(page.drawn.at(-1)).toEqual(['b', 'a', 'c']);
    const count = page.drawn.length;
    pointer('pointermove', window, middle(1) + 30, 50);
    pointer('pointermove', window, middle(1) - 30, 50);
    expect(page.drawn).toHaveLength(count);
    pointer('pointermove', window, middle(0), 50);
    expect(page.drawn.at(-1)).toEqual(['a', 'b', 'c']);
  });
});
