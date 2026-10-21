/**
 * A thin React layer over the sortable engine. React draws the lists and hears
 * the lift and the drop; the engine moves everything in between without a
 * render. Lifted, hovered and dragging states are attributes for CSS:
 * `data-drag-source` on the source item, `data-drag-over` on the list under it,
 * `data-drag-preview` on the lifted copy and `data-drag-active` on the root.
 */
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import {
  createSortable,
  type SortableAxis,
  type SortableController,
  type SortableOptions,
  type SortableResult,
  type SortableStart,
  type SortableUpdate,
} from './sortable';

export * from './sortable';

const Sortable = createContext<SortableController | null>(null);

export type SortableProviderProps = Omit<SortableOptions, 'onBeforeCapture' | 'onDragStart' | 'onDragUpdate' | 'onDragEnd'> & {
  /** Change state here before the lift is measured; it is drawn at once. */
  onBeforeCapture?: (before: { draggableId: string; mode: SortableStart['mode'] }) => void;
  onDragStart?: (start: SortableStart) => void;
  onDragUpdate?: (update: SortableUpdate) => void;
  /** Update state here; it is drawn at once so the engine's offsets can go. */
  onDragEnd?: (result: SortableResult) => void;
  children?: ReactNode;
};

/** One engine for the lists inside it; its options are read when it mounts. */
export function SortableProvider({ onBeforeCapture, onDragStart, onDragUpdate, onDragEnd, children, ...options }: SortableProviderProps) {
  const callbacks = useRef({ onBeforeCapture, onDragStart, onDragUpdate, onDragEnd });
  callbacks.current = { onBeforeCapture, onDragStart, onDragUpdate, onDragEnd };
  const initial = useRef(options);
  const controller = useMemo(
    () =>
      createSortable({
        ...initial.current,
        onBeforeCapture: (before) => {
          const callback = callbacks.current.onBeforeCapture;
          if (callback) flushSync(() => callback(before));
        },
        onDragStart: (start) => callbacks.current.onDragStart?.(start),
        onDragUpdate: (update) => callbacks.current.onDragUpdate?.(update),
        onDragEnd: (result) => flushSync(() => callbacks.current.onDragEnd?.(result)),
      }),
    [],
  );
  useEffect(() => () => controller.destroy(), [controller]);
  return createElement(Sortable.Provider, { value: controller }, children);
}

export function useSortableController(): SortableController {
  const controller = useContext(Sortable);
  if (!controller) throw new Error('useSortable… needs a SortableProvider above it.');
  return controller;
}

export type UseSortableContainerOptions = {
  type?: string;
  axis?: SortableAxis;
  isDropDisabled?: () => boolean;
  isCombineEnabled?: () => boolean;
  label?: string;
  /** Its items hold still while one is carried over them; see `SortableContainerArgs.still`. */
  still?: boolean;
  lockAxis?: 'x' | 'y';
  renderPreview?: (source: HTMLElement) => HTMLElement | null | undefined;
};

/** A ref that makes its element a list of sortable items. */
export function useSortableContainer<T extends HTMLElement>(id: string, options: UseSortableContainerOptions = {}) {
  const controller = useSortableController();
  const latest = useRef(options);
  latest.current = options;
  const { type, axis, still, lockAxis } = options;
  return useCallback(
    (element: T | null) => {
      if (!element) return undefined;
      return controller.container({
        element,
        id,
        ...(type === undefined ? {} : { type }),
        ...(axis === undefined ? {} : { axis }),
        ...(still === undefined ? {} : { still }),
        ...(lockAxis === undefined ? {} : { lockAxis }),
        isDropDisabled: () => latest.current.isDropDisabled?.() ?? false,
        isCombineEnabled: () => latest.current.isCombineEnabled?.() ?? false,
        renderPreview: (source) => latest.current.renderPreview?.(source),
        ...(latest.current.label === undefined ? {} : { label: latest.current.label }),
      });
    },
    [controller, id, type, axis, still, lockAxis],
  );
}

export type UseSortableItemOptions = {
  type?: string;
  /** A selector for the handle inside the item; the item itself when left out. */
  handle?: string;
  canDrag?: (by: { input: string }) => boolean;
  allowInteractive?: boolean;
  label?: string;
};

/** A ref that makes its element a sortable item, held by its handle. */
export function useSortableItem<T extends HTMLElement>(id: string, options: UseSortableItemOptions = {}) {
  const controller = useSortableController();
  const latest = useRef(options);
  latest.current = options;
  const { type, handle, allowInteractive } = options;
  return useCallback(
    (element: T | null) => {
      if (!element) return undefined;
      const held = handle ? element.querySelector<HTMLElement>(handle) : null;
      return controller.item({
        element,
        id,
        handle: held,
        ...(type === undefined ? {} : { type }),
        ...(allowInteractive === undefined ? {} : { allowInteractive }),
        canDrag: (by) => latest.current.canDrag?.(by) ?? true,
        ...(latest.current.label === undefined ? {} : { label: latest.current.label }),
      });
    },
    [controller, id, type, handle, allowInteractive],
  );
}
