import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGrid, type GridController, type GridDrag, type GridGesture } from '../src/grid';

const unit = 20;

function pointer(type: string, target: EventTarget, x: number, y: number, pointerType = 'mouse'): Event {
  const event = new Event(type, { bubbles: true, cancelable: true, composed: true });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: pointerType },
    button: { value: 0 },
    clientX: { value: x },
    clientY: { value: y },
  });
  target.dispatchEvent(event);
  return event;
}

function key(name: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true });
  document.body.dispatchEvent(event);
  return event;
}

function stubBox(element: HTMLElement, left: number, top: number, width: number, height: number): void {
  element.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });
}

/** A gesture that writes down everything it hears. */
function recorder(): GridGesture & { heard: Array<[string, GridDrag]> } {
  const heard: Array<[string, GridDrag]> = [];
  return {
    heard,
    onStart: (drag) => heard.push(['start', drag]),
    onMove: (drag) => heard.push(['move', drag]),
    onDrop: (drag) => heard.push(['drop', drag]),
    onCancel: (drag) => heard.push(['cancel', drag]),
    onClick: (drag) => heard.push(['click', drag]),
  };
}

describe('createGrid', () => {
  let grid: GridController;
  let board: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    grid = createGrid();
    board = document.createElement('div');
    // A board of twenty squares by ten, its corner at (100, 50) on the page.
    stubBox(board, 100, 50, 400, 200);
    document.body.append(board);
  });

  afterEach(() => {
    grid.destroy();
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('carries a press a whole square at a time from where it began, and lets it go', () => {
    const gesture = recorder();
    const press = vi.fn(() => gesture);
    grid.surface({ element: board, unit: () => unit, press });
    pointer('pointerdown', board, 100 + 2.5 * unit, 50 + 0.5 * unit);
    expect(press).toHaveBeenCalledWith(expect.objectContaining({ input: 'mouse', point: { x: 2.5, y: 0.5 }, square: { x: 2, y: 0 }, inside: true, target: board }));
    // Four pixels is not yet a drag.
    pointer('pointermove', document.body, 100 + 2.5 * unit + 4, 50 + 0.5 * unit);
    expect(gesture.heard).toEqual([]);
    pointer('pointermove', document.body, 100 + 5.4 * unit, 50 + 2.6 * unit);
    expect(grid.isDragging()).toBe(true);
    expect(gesture.heard.map(([what]) => what)).toEqual(['start', 'move', 'move']);
    const [, last] = gesture.heard.at(-1)!;
    expect(last.moved).toEqual({ x: 3, y: 2 });
    expect(last.square).toEqual({ x: 5, y: 2 });
    expect(last.inside).toBe(true);
    pointer('pointerup', document.body, 100 + 5.4 * unit, 50 + 2.6 * unit);
    expect(gesture.heard.at(-1)![0]).toBe('drop');
    expect(gesture.heard.at(-1)![1].moved).toEqual({ x: 3, y: 2 });
    expect(grid.isDragging()).toBe(false);
    // The click a drop would make on what it was let go over never arrives.
    const clicked = vi.fn();
    board.addEventListener('click', clicked);
    board.click();
    expect(clicked).not.toHaveBeenCalled();
  });

  it('hears a press that never moved as a click, and leaves a press it is given nothing for to the page', () => {
    const gesture = recorder();
    let carry = true;
    grid.surface({ element: board, unit: () => unit, press: () => (carry ? gesture : null) });
    pointer('pointerdown', board, 110, 60);
    pointer('pointerup', document.body, 110, 60);
    expect(gesture.heard.map(([what]) => what)).toEqual(['click']);
    carry = false;
    pointer('pointerdown', board, 110, 60);
    pointer('pointermove', document.body, 200, 160);
    pointer('pointerup', document.body, 200, 160);
    expect(gesture.heard.map(([what]) => what)).toEqual(['click']);
  });

  it('takes back what is carried on Escape', () => {
    const gesture = recorder();
    grid.surface({ element: board, unit: () => unit, press: () => gesture });
    pointer('pointerdown', board, 110, 60);
    pointer('pointermove', document.body, 170, 60);
    const escape = key('Escape');
    expect(escape.defaultPrevented).toBe(true);
    expect(gesture.heard.at(-1)![0]).toBe('cancel');
    pointer('pointerup', document.body, 170, 60);
    expect(gesture.heard.at(-1)![0]).toBe('cancel');
  });

  it('lifts for a finger only after a still hold, and lets a finger that moves sooner scroll', () => {
    const gesture = recorder();
    grid.surface({ element: board, unit: () => unit, press: () => gesture });
    pointer('pointerdown', board, 110, 60, 'touch');
    pointer('pointermove', document.body, 110, 90, 'touch');
    expect(gesture.heard.map(([what]) => what)).toEqual(['cancel']);
    vi.advanceTimersByTime(300);
    expect(grid.isDragging()).toBe(false);
    pointer('pointerdown', board, 110, 60, 'touch');
    vi.advanceTimersByTime(250);
    expect(grid.isDragging()).toBe(true);
    pointer('pointermove', document.body, 150, 60, 'touch');
    pointer('pointerup', document.body, 150, 60, 'touch');
    expect(gesture.heard.at(-1)![1].moved).toEqual({ x: 2, y: 0 });
  });

  it('measures a source outside the surface on the surface\'s squares', () => {
    const tool = document.createElement('button');
    stubBox(tool, 0, 0, 19, 19);
    document.body.append(tool);
    const gesture = recorder();
    grid.surface({ element: board, unit: () => unit });
    grid.source({ element: tool, surface: board, press: () => gesture });
    pointer('pointerdown', tool, 10, 10);
    pointer('pointermove', document.body, 40, 10);
    expect(gesture.heard.at(-1)![1].inside).toBe(false);
    pointer('pointermove', document.body, 100 + 7.5 * unit, 50 + 3.5 * unit);
    pointer('pointerup', document.body, 100 + 7.5 * unit, 50 + 3.5 * unit);
    const [what, drag] = gesture.heard.at(-1)!;
    expect(what).toBe('drop');
    expect(drag.inside).toBe(true);
    expect(drag.square).toEqual({ x: 7, y: 3 });
  });

  it('counts the surface\'s own scroll in its squares', () => {
    Object.defineProperty(board, 'scrollLeft', { value: 3 * unit, configurable: true });
    const press = vi.fn(() => null);
    grid.surface({ element: board, unit: () => unit, press });
    pointer('pointerdown', board, 100 + 0.5 * unit, 50 + 0.5 * unit);
    expect(press).toHaveBeenCalledWith(expect.objectContaining({ square: { x: 3, y: 0 } }));
  });

  it('carries a gesture with the keys: arrows a square, Shift four, Tab to each target, Enter lets go', () => {
    const gesture = Object.assign(recorder(), {
      targets: () => [{ x: 10.5, y: 0.5 }, { x: 2.5, y: 6.5 }],
      announce: (drag: GridDrag, phase: string) => `${phase} ${drag.square.x} ${drag.square.y}`,
    });
    grid.surface({ element: board, unit: () => unit });
    grid.keyboard({ surface: board, from: { x: 1.5, y: 0.5 }, gesture });
    expect(grid.isDragging()).toBe(true);
    expect(document.body.textContent).toContain('start 1 0');
    expect(key('ArrowRight').defaultPrevented).toBe(true);
    expect(gesture.heard.at(-1)![1].square).toEqual({ x: 2, y: 0 });
    key('ArrowDown', true);
    expect(gesture.heard.at(-1)![1].square).toEqual({ x: 2, y: 4 });
    expect(gesture.heard.at(-1)![1].moved).toEqual({ x: 1, y: 4 });
    key('Tab');
    expect(gesture.heard.at(-1)![1].square).toEqual({ x: 10, y: 0 });
    key('Tab');
    expect(gesture.heard.at(-1)![1].square).toEqual({ x: 2, y: 6 });
    key('Tab', true);
    expect(gesture.heard.at(-1)![1].square).toEqual({ x: 10, y: 0 });
    expect(document.body.textContent).toContain('move 10 0');
    key('Enter');
    expect(gesture.heard.at(-1)![0]).toBe('drop');
    expect(document.body.textContent).toContain('drop 10 0');
    expect(grid.isDragging()).toBe(false);
    // Let go, the keys are the page's again.
    expect(key('ArrowRight').defaultPrevented).toBe(false);
  });

  it('takes a keyboard gesture back on Escape, and on destroy', () => {
    const gesture = recorder();
    grid.surface({ element: board, unit: () => unit });
    grid.keyboard({ surface: board, from: { x: 0.5, y: 0.5 }, gesture });
    key('Escape');
    expect(gesture.heard.at(-1)![0]).toBe('cancel');
    grid.keyboard({ surface: board, from: { x: 0.5, y: 0.5 }, gesture });
    grid.destroy();
    expect(gesture.heard.at(-1)![0]).toBe('cancel');
    expect(grid.isDragging()).toBe(false);
  });

  it('lets go of a surface it no longer carries on', () => {
    const gesture = recorder();
    const stop = grid.surface({ element: board, unit: () => unit, press: () => gesture });
    pointer('pointerdown', board, 110, 60);
    pointer('pointermove', document.body, 170, 60);
    stop();
    expect(gesture.heard.at(-1)![0]).toBe('cancel');
    pointer('pointerdown', board, 110, 60);
    expect(gesture.heard.at(-1)![0]).toBe('cancel');
  });
});
