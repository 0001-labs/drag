import { afterEach, describe, expect, it } from 'vitest';
import { draggable, dropTargetForElements, monitorForElements } from '../src/element';
import type { Cleanup } from '../src';
import { TestDataTransfer, dragEvent } from './fixtures';

const cleanups: Cleanup[] = [];

afterEach(() => {
  while (cleanups.length) {
    cleanups.pop()?.();
  }

  document.body.replaceChildren();
});

function track(cleanup: Cleanup): Cleanup {
  cleanups.push(cleanup);
  return cleanup;
}

function element(name: string): HTMLElement {
  const node = document.createElement('div');
  node.dataset.name = name;
  document.body.append(node);
  return node;
}

describe('element adapter', () => {
  it('rejects duplicate draggables and duplicate drop targets', () => {
    const node = element('node');

    track(draggable({ element: node }));
    expect(() => draggable({ element: node })).toThrow('A draggable is already registered');

    track(dropTargetForElements({ element: node }));
    expect(() => dropTargetForElements({ element: node })).toThrow(
      'A drop target is already registered',
    );
  });

  it('writes native data separately from local source data', () => {
    const source = element('source');
    const dataTransfer = new TestDataTransfer();

    track(
      draggable({
        element: source,
        getData: () => ({ id: 1 }),
        getNativeData: () => ({ 'text/plain': 'native text' }),
      }),
    );

    dragEvent('dragstart', source, { dataTransfer });

    expect(dataTransfer.getData('text/plain')).toBe('native text');
    expect(dataTransfer.getData('application/x-0001-drag')).toBe('element');
  });

  it('dispatches source, inner target, outer target, and monitor in order', () => {
    const source = element('source');
    const outer = element('outer');
    const inner = document.createElement('div');
    outer.append(inner);
    const calls: string[] = [];

    track(draggable({ element: source, onDrop: () => calls.push('source') }));
    track(dropTargetForElements({ element: outer, onDrop: () => calls.push('outer') }));
    track(dropTargetForElements({ element: inner, onDrop: () => calls.push('inner') }));
    track(monitorForElements({ onDrop: () => calls.push('monitor') }));

    const dataTransfer = new TestDataTransfer();
    dragEvent('dragstart', source, { dataTransfer });
    dragEvent('dragover', inner, { dataTransfer });
    dragEvent('drop', inner, { dataTransfer });

    expect(calls).toEqual(['source', 'inner', 'outer', 'monitor']);
  });

  it('skips targets whose canDrop returns false while keeping ancestors', () => {
    const source = element('source');
    const outer = element('outer');
    const inner = document.createElement('div');
    outer.append(inner);
    const calls: string[] = [];

    track(draggable({ element: source }));
    track(dropTargetForElements({ element: outer, onDrop: () => calls.push('outer') }));
    track(
      dropTargetForElements({
        element: inner,
        canDrop: () => false,
        onDrop: () => calls.push('inner'),
      }),
    );

    const dataTransfer = new TestDataTransfer();
    dragEvent('dragstart', source, { dataTransfer });
    dragEvent('dragover', inner, { dataTransfer });
    dragEvent('drop', inner, { dataTransfer });

    expect(calls).toEqual(['outer']);
  });

  it('uses monitor creation order', () => {
    const source = element('source');
    const target = element('target');
    const calls: string[] = [];

    track(draggable({ element: source }));
    track(dropTargetForElements({ element: target }));
    track(monitorForElements({ onDrop: () => calls.push('first') }));
    track(monitorForElements({ onDrop: () => calls.push('second') }));

    const dataTransfer = new TestDataTransfer();
    dragEvent('dragstart', source, { dataTransfer });
    dragEvent('dragover', target, { dataTransfer });
    dragEvent('drop', target, { dataTransfer });

    expect(calls).toEqual(['first', 'second']);
  });

  it('honors cleanup during active sessions', () => {
    const source = element('source');
    const target = element('target');
    const calls: string[] = [];

    track(draggable({ element: source }));
    const cleanupTarget = track(dropTargetForElements({ element: target, onDrop: () => calls.push('target') }));

    const dataTransfer = new TestDataTransfer();
    dragEvent('dragstart', source, { dataTransfer });
    cleanupTarget();
    dragEvent('dragover', target, { dataTransfer });
    dragEvent('drop', target, { dataTransfer });

    expect(calls).toEqual([]);
  });
});
