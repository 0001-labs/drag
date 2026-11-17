import type { Cleanup } from './types';
import { once } from './util';

export type GridPoint = { x: number; y: number };

export type GridInput = 'mouse' | 'pen' | 'touch' | 'keyboard';

export type GridDrag = {
  input: GridInput;
  origin: GridPoint;
  point: GridPoint;
  square: GridPoint;
  moved: GridPoint;
  inside: boolean;
  target: Element | null;
};

export type GridGesture = {
  onStart?: (drag: GridDrag) => void;
  onMove?: (drag: GridDrag) => void;
  onDrop?: (drag: GridDrag) => void;
  onCancel?: (drag: GridDrag) => void;
  onClick?: (drag: GridDrag) => void;
  targets?: () => GridPoint[];
  announce?: (drag: GridDrag, phase: 'start' | 'move' | 'drop' | 'cancel') => string | undefined;
};

export type GridPress = {
  input: Exclude<GridInput, 'keyboard'>;
  point: GridPoint;
  square: GridPoint;
  inside: boolean;
  target: Element | null;
  event: PointerEvent;
};

export type GridSurfaceArgs = {
  element: HTMLElement;
  unit: () => number;
  press?: (press: GridPress) => GridGesture | null | undefined | void;
};

export type GridSourceArgs = {
  element: HTMLElement;
  surface: HTMLElement;
  press: (press: GridPress) => GridGesture | null | undefined | void;
};

export type GridKeyboardArgs = {
  surface: HTMLElement;
  from: GridPoint;
  gesture: GridGesture;
};

export type GridOptions = {
  dragDistance?: number;
  touchHold?: number;
  autoScrollEdge?: number;
  step?: number;
  pointerPoint?: (event: PointerEvent) => GridPoint;
};

export type GridController = {
  surface: (args: GridSurfaceArgs) => Cleanup;
  source: (args: GridSourceArgs) => Cleanup;
  keyboard: (args: GridKeyboardArgs) => void;
  isDragging: () => boolean;
  cancel: () => void;
  destroy: () => void;
};

const defaults = { dragDistance: 5, touchHold: 250, autoScrollEdge: 40, step: 4 } as const;
const maxScrollSpeed = 20;
const styleId = 'data-0001-drag-grid-style';
const styles = ':root[data-drag-grid],:root[data-drag-grid] *{-webkit-user-select:none!important;user-select:none!important}';

type Surface = Required<Pick<GridSurfaceArgs, 'element' | 'unit'>> & { press?: GridSurfaceArgs['press'] };

type Pending = {
  surface: Surface;
  gesture: GridGesture;
  input: Exclude<GridInput, 'keyboard'>;
  pointerId: number;
  startX: number;
  startY: number;
  origin: GridPoint;
  target: Element | null;
  timer: ReturnType<typeof setTimeout> | null;
};

type Session = {
  surface: Surface;
  gesture: GridGesture;
  input: GridInput;
  pointerId: number;
  origin: GridPoint;
  clientX: number;
  clientY: number;
  point: GridPoint;
  landed: number;
  scrollFrame: number | null;
};

export function createGrid(options: GridOptions = {}): GridController {
  const settings = {
    dragDistance: options.dragDistance ?? defaults.dragDistance,
    touchHold: options.touchHold ?? defaults.touchHold,
    autoScrollEdge: options.autoScrollEdge ?? defaults.autoScrollEdge,
    step: options.step ?? defaults.step,
  };
  const pointOf = options.pointerPoint ?? ((event: PointerEvent) => ({ x: event.clientX, y: event.clientY }));
  const surfaces = new Map<HTMLElement, Surface>();
  let pending: Pending | null = null;
  let session: Session | null = null;
  let destroyed = false;
  let liveRegion: HTMLElement | null = null;

  function surface(args: GridSurfaceArgs): Cleanup {
    const registration: Surface = { element: args.element, unit: args.unit, press: args.press };
    surfaces.set(args.element, registration);
    const down = (event: PointerEvent) => {
      if (registration.press) onPress(event, registration, registration.press);
    };
    args.element.addEventListener('pointerdown', down);
    return once(() => {
      args.element.removeEventListener('pointerdown', down);
      if (surfaces.get(args.element) === registration) surfaces.delete(args.element);
      if (pending?.surface === registration) clearPending();
      if (session?.surface === registration) end('cancel');
    });
  }

  function source(args: GridSourceArgs): Cleanup {
    const down = (event: PointerEvent) => {
      const registration = surfaces.get(args.surface);
      if (registration) onPress(event, registration, args.press);
    };
    args.element.addEventListener('pointerdown', down);
    return once(() => args.element.removeEventListener('pointerdown', down));
  }

  function onPress(event: PointerEvent, registration: Surface, ask: NonNullable<GridSurfaceArgs['press']>): void {
    if (destroyed || session || pending) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const input: Pending['input'] = event.pointerType === 'touch' || event.pointerType === 'pen' ? event.pointerType : 'mouse';
    const client = pointOf(event);
    const at = locate(registration, client.x, client.y);
    const first = event.composedPath?.()[0];
    const target = first instanceof Element ? first : event.target instanceof Element ? event.target : null;
    const gesture = ask({ input, point: at.point, square: squareOf(at.point), inside: at.inside, target, event });
    if (!gesture) return;
    pending = { surface: registration, gesture, input, pointerId: event.pointerId, startX: client.x, startY: client.y, origin: at.point, target, timer: null };
    if (input === 'touch') {
      pending.timer = setTimeout(() => {
        if (pending) lift(pending);
      }, settings.touchHold);
    }
    addWindowListeners();
  }

  function lift(from: Pending): void {
    if (from.timer) clearTimeout(from.timer);
    pending = null;
    session = {
      surface: from.surface,
      gesture: from.gesture,
      input: from.input,
      pointerId: from.pointerId,
      origin: from.origin,
      clientX: from.startX,
      clientY: from.startY,
      point: from.origin,
      landed: -1,
      scrollFrame: null,
    };
    installStyle(from.surface.element.ownerDocument);
    from.surface.element.ownerDocument.documentElement.setAttribute('data-drag-grid', '');
    const drag = dragOf(session);
    from.gesture.onStart?.(drag);
    from.gesture.onMove?.(drag);
  }

  function onPointerMove(event: PointerEvent): void {
    const client = pointOf(event);
    if (pending && event.pointerId === pending.pointerId) {
      if (Math.hypot(client.x - pending.startX, client.y - pending.startY) < settings.dragDistance) return;
      if (pending.input === 'touch') {
        const gesture = pending.gesture, drag = pendingDrag(pending);
        clearPending();
        gesture.onCancel?.(drag);
        return;
      }
      lift(pending);
    }
    if (session && session.input !== 'keyboard' && event.pointerId === session.pointerId) {
      session.clientX = client.x;
      session.clientY = client.y;
      moveTo(session);
      scheduleAutoScroll(session);
    }
  }

  function onPointerUp(event: PointerEvent): void {
    if (pending && event.pointerId === pending.pointerId) {
      const gesture = pending.gesture, drag = pendingDrag(pending);
      clearPending();
      gesture.onClick?.(drag);
      return;
    }
    if (session && session.input !== 'keyboard' && event.pointerId === session.pointerId) {
      suppressClick();
      end('drop');
    }
  }

  function onPointerCancel(event: PointerEvent): void {
    if (pending && event.pointerId === pending.pointerId) {
      const gesture = pending.gesture, drag = pendingDrag(pending);
      clearPending();
      gesture.onCancel?.(drag);
    }
    if (session && event.pointerId === session.pointerId) end('cancel');
  }

  function onKeyDown(event: KeyboardEvent): void {
    const current = session;
    if (!current) {
      if (pending && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
      return;
    }
    if (event.key === 'Escape') {
      end('cancel');
    } else if (current.input !== 'keyboard') {
      return;
    } else if (event.key === 'Enter' || event.key === ' ') {
      end('drop');
    } else if (event.key in arrows) {
      const by = event.shiftKey ? settings.step : 1;
      const arrow = arrows[event.key as keyof typeof arrows];
      current.point = { x: Math.max(0, current.point.x + arrow.x * by), y: Math.max(0, current.point.y + arrow.y * by) };
      moveTo(current, 'move');
    } else if (event.key === 'Tab') {
      const targets = current.gesture.targets?.() ?? [];
      if (!targets.length) return;
      const count = targets.length;
      current.landed = current.landed < 0 ? (event.shiftKey ? count - 1 : 0) : (current.landed + (event.shiftKey ? count - 1 : 1)) % count;
      current.point = targets[current.landed];
      moveTo(current, 'move');
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  function onTouchMove(event: TouchEvent): void {
    if (session && event.cancelable) event.preventDefault();
  }

  function onContextMenu(event: Event): void {
    if (pending || session) event.preventDefault();
  }

  function onBlur(): void {
    if (pending) {
      const gesture = pending.gesture, drag = pendingDrag(pending);
      clearPending();
      gesture.onCancel?.(drag);
    }
    if (session) end('cancel');
  }

  function onScroll(): void {
    if (session && session.input !== 'keyboard') moveTo(session);
  }

  function addWindowListeners(): void {
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerCancel, true);
    window.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    window.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('scroll', onScroll, true);
  }

  function removeWindowListeners(): void {
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerCancel, true);
    window.removeEventListener('touchmove', onTouchMove, true);
    window.removeEventListener('contextmenu', onContextMenu, true);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('scroll', onScroll, true);
  }

  function clearPending(): void {
    if (!pending) return;
    if (pending.timer) clearTimeout(pending.timer);
    pending = null;
    if (!session) removeWindowListeners();
  }

  function suppressClick(): void {
    const stop = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', stop, true), 0);
  }

  function keyboard(args: GridKeyboardArgs): void {
    const registration = surfaces.get(args.surface);
    if (destroyed || session || !registration) return;
    clearPending();
    session = {
      surface: registration,
      gesture: args.gesture,
      input: 'keyboard',
      pointerId: -1,
      origin: args.from,
      clientX: 0,
      clientY: 0,
      point: args.from,
      landed: -1,
      scrollFrame: null,
    };
    addWindowListeners();
    const drag = dragOf(session);
    args.gesture.onStart?.(drag);
    args.gesture.onMove?.(drag);
    say(args.gesture.announce?.(drag, 'start'));
  }

  function moveTo(current: Session, phase?: 'move'): void {
    if (current.input !== 'keyboard') current.point = locate(current.surface, current.clientX, current.clientY).point;
    const drag = dragOf(current);
    current.gesture.onMove?.(drag);
    if (phase) say(current.gesture.announce?.(drag, phase));
  }

  function end(how: 'drop' | 'cancel'): void {
    const current = session;
    if (!current) return;
    session = null;
    if (current.scrollFrame !== null) cancelAnimationFrame(current.scrollFrame);
    removeWindowListeners();
    current.surface.element.ownerDocument.documentElement.removeAttribute('data-drag-grid');
    const drag = dragOf(current);
    if (how === 'drop') current.gesture.onDrop?.(drag);
    else current.gesture.onCancel?.(drag);
    if (current.input === 'keyboard') say(current.gesture.announce?.(drag, how));
  }

  function cancel(): void {
    if (pending) {
      const gesture = pending.gesture, drag = pendingDrag(pending);
      clearPending();
      gesture.onCancel?.(drag);
    }
    end('cancel');
  }

  function dragOf(current: Session): GridDrag {
    const inside = current.input === 'keyboard' ? true : locate(current.surface, current.clientX, current.clientY).inside;
    return {
      input: current.input,
      origin: current.origin,
      point: current.point,
      square: squareOf(current.point),
      moved: { x: Math.round(current.point.x - current.origin.x), y: Math.round(current.point.y - current.origin.y) },
      inside,
      target: current.input === 'keyboard' ? null : deepest(current.surface.element.ownerDocument, current.clientX, current.clientY),
    };
  }

  function pendingDrag(from: Pending): GridDrag {
    return { input: from.input, origin: from.origin, point: from.origin, square: squareOf(from.origin), moved: { x: 0, y: 0 }, inside: true, target: from.target };
  }

  function scheduleAutoScroll(current: Session): void {
    if (current.scrollFrame !== null || !speedFor(current)) return;
    const step = () => {
      current.scrollFrame = null;
      if (session !== current) return;
      const speed = speedFor(current);
      if (!speed) return;
      const scroller = speed.element;
      const before = scroller ? { x: scroller.scrollLeft, y: scroller.scrollTop } : { x: window.scrollX, y: window.scrollY };
      if (scroller) scroller.scrollBy(speed.x, speed.y);
      else window.scrollBy(speed.x, speed.y);
      const after = scroller ? { x: scroller.scrollLeft, y: scroller.scrollTop } : { x: window.scrollX, y: window.scrollY };
      if (after.x === before.x && after.y === before.y) return;
      moveTo(current);
      current.scrollFrame = requestAnimationFrame(step);
    };
    current.scrollFrame = requestAnimationFrame(step);
  }

  function speedFor(current: Session): { element: HTMLElement | null; x: number; y: number } | null {
    const edge = settings.autoScrollEdge;
    const along = (position: number, start: number, length: number) => {
      const fromStart = position - start, fromEnd = start + length - position;
      if (fromStart < edge) return -maxScrollSpeed * ((edge - Math.max(fromStart, 0)) / edge) ** 2;
      if (fromEnd < edge) return maxScrollSpeed * ((edge - Math.max(fromEnd, 0)) / edge) ** 2;
      return 0;
    };
    const element = current.surface.element;
    const rect = element.getBoundingClientRect();
    const inside = current.clientX >= rect.left && current.clientX < rect.right && current.clientY >= rect.top && current.clientY < rect.bottom;
    if (inside) {
      const x = element.scrollWidth > element.clientWidth ? along(current.clientX, rect.left, rect.width) : 0;
      const y = element.scrollHeight > element.clientHeight ? along(current.clientY, rect.top, rect.height) : 0;
      const movable = (x < 0 && element.scrollLeft > 0) || (x > 0 && element.scrollLeft + element.clientWidth < element.scrollWidth)
        || (y < 0 && element.scrollTop > 0) || (y > 0 && element.scrollTop + element.clientHeight < element.scrollHeight);
      if (movable) return { element, x, y };
    }
    const y = along(current.clientY, 0, window.innerHeight);
    return y ? { element: null, x: 0, y } : null;
  }

  function say(message: string | undefined): void {
    if (!message) return;
    liveRegion ??= hiddenText(document);
    liveRegion.textContent = message;
  }

  function destroy(): void {
    if (destroyed) return;
    cancel();
    destroyed = true;
    surfaces.clear();
    removeWindowListeners();
    liveRegion?.remove();
    liveRegion = null;
  }

  return { surface, source, keyboard, isDragging: () => !!session, cancel, destroy };
}

const arrows = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
} as const;

function locate(surface: Surface, x: number, y: number): { point: GridPoint; inside: boolean } {
  const element = surface.element;
  const rect = element.getBoundingClientRect();
  const scale = element.offsetWidth > 0 && rect.width > 0 && Math.abs(rect.width / element.offsetWidth - 1) >= 0.02 ? rect.width / element.offsetWidth : 1;
  const unit = surface.unit() || 1;
  return {
    point: {
      x: ((x - rect.left) / scale - element.clientLeft + element.scrollLeft) / unit,
      y: ((y - rect.top) / scale - element.clientTop + element.scrollTop) / unit,
    },
    inside: x >= rect.left && x < rect.left + rect.width && y >= rect.top && y < rect.top + rect.height,
  };
}

function squareOf(point: GridPoint): GridPoint {
  return { x: Math.floor(point.x), y: Math.floor(point.y) };
}

function deepest(document: Document, x: number, y: number): Element | null {
  let element = document.elementFromPoint?.(x, y) ?? null;
  while (element?.shadowRoot) {
    const inner = element.shadowRoot.elementFromPoint?.(x, y) ?? null;
    if (!inner || inner === element) break;
    element = inner;
  }
  return element;
}

function installStyle(document: Document): void {
  if (document.querySelector(`style[${styleId}]`)) return;
  const style = document.createElement('style');
  style.setAttribute(styleId, '');
  style.textContent = styles;
  document.head.appendChild(style);
}

function hiddenText(document: Document): HTMLElement {
  const element = document.createElement('div');
  element.setAttribute('aria-live', 'assertive');
  element.setAttribute('aria-atomic', 'true');
  Object.assign(element.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '-1px',
    padding: '0',
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
    border: '0',
  });
  document.body.appendChild(element);
  return element;
}
