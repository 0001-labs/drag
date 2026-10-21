import { defineDragElements } from '../../../src/elements';
import { createSortable } from '../../../src/sortable';
import { createGrid, type GridGesture } from '../../../src/grid';

export function setupDocsInteractions(): void {
  defineDragElements();
  document.querySelectorAll('drag-list[data-docs-demo]').forEach((list) => {
    list.addEventListener('0001-drag-reorder', (event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail: unknown = event.detail;
      if (!isReorderDetail(detail)) return;
      for (const attribute of ['data-status-target', 'data-announcement-target']) {
        const id = list.getAttribute(attribute);
        const status = id ? document.getElementById(id) : null;
        if (status) status.textContent = `Order: ${detail.values.join(', ')}`;
      }
    });
  });
  document.querySelectorAll<HTMLElement>('[data-sortable-demo]').forEach((host) => {
    const list = host.querySelector<HTMLElement>('ul')!;
    const status = host.querySelector<HTMLElement>('[role="status"]')!;
    const engine = createSortable({
      onDragEnd: ({ source, destination, reason }) => {
        if (reason !== 'DROP' || !destination) return;
        const rows = Array.from(list.children);
        const [moved] = rows.splice(source.index, 1);
        if (!moved) return;
        rows.splice(destination.index, 0, moved);
        for (const row of rows) list.appendChild(row);
        status.textContent = `Order: ${rows.map(row => row.getAttribute('data-name')).join(', ')}`;
      },
    });
    engine.container({ element: list, id: 'example', label: 'Reading list' });
    list.querySelectorAll<HTMLElement>('li').forEach((row) => {
      engine.item({ element: row, id: row.dataset.name!, label: row.dataset.name!, handle: row.querySelector<HTMLElement>('[data-demo-handle]') });
    });
    window.addEventListener('pagehide', () => engine.destroy(), { once: true });
  });
  document.querySelectorAll<HTMLElement>('[data-grid-demo]').forEach((host) => {
    const surface = host.querySelector<HTMLElement>('.grid-demo')!;
    const box = host.querySelector<HTMLElement>('.grid-box')!;
    const status = host.querySelector<HTMLElement>('[role="status"]')!;
    const grid = createGrid();
    let position = { x: 1, y: 1 };
    const unit = () => parseFloat(getComputedStyle(box).height) / 2;
    const draw = (at: { x: number; y: number }) => { box.style.transform = `translate(${at.x * unit()}px, ${at.y * unit()}px)`; };
    const gesture = (): GridGesture => {
      const origin = { ...position };
      const next = (moved: { x: number; y: number }) => ({
        x: Math.max(0, Math.min(Math.floor(surface.clientWidth / unit()) - 4, origin.x + moved.x)),
        y: Math.max(0, Math.min(8, origin.y + moved.y)),
      });
      return {
        onMove: ({ moved }) => draw(next(moved)),
        onDrop: ({ moved }) => { position = next(moved); draw(position); status.textContent = `Column ${position.x}, row ${position.y}`; },
        onCancel: () => draw(origin),
        announce: ({ moved }, phase) => `${phase}: column ${next(moved).x}, row ${next(moved).y}`,
      };
    };
    grid.surface({ element: surface, unit, press: ({ target }) => target?.closest('.grid-box') ? gesture() : null });
    box.addEventListener('keydown', (event) => {
      if (grid.isDragging() || (event.key !== ' ' && event.key !== 'Enter')) return;
      event.preventDefault();
      grid.keyboard({ surface, from: { x: position.x + .5, y: position.y + .5 }, gesture: gesture() });
    });
    const resize = new ResizeObserver(() => draw(position));
    resize.observe(surface);
    draw(position);
    window.addEventListener('pagehide', () => { grid.destroy(); resize.disconnect(); }, { once: true });
  });
}
function isReorderDetail(value: unknown): value is { values: string[] } {
  return typeof value === 'object' && value !== null && 'values' in value && Array.isArray(value.values) && value.values.every((item) => typeof item === 'string');
}
