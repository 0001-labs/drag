import { flowHolds, flowStarts, type Flow, type FlowItem } from './flow';
import type { Cleanup } from './types';
import { once } from './util';

export type SortableAxis = 'vertical' | 'horizontal';

export type SortableLocation = {
  droppableId: string;
  index: number;
};

export type SortableStart = {
  draggableId: string;
  type: string;
  source: SortableLocation;
  mode: 'FLUID' | 'SNAP';
};

export type SortableCombine = {
  draggableId: string;
  droppableId: string;
};

export type SortableUpdate = SortableStart & {
  destination: SortableLocation | null;
  combine: SortableCombine | null;
};

export type SortableResult = SortableUpdate & {
  reason: 'DROP' | 'CANCEL';
};

export type SortableContainerArgs = {
  element: HTMLElement;
  id: string;
  type?: string;
  axis?: SortableAxis;
  isDropDisabled?: () => boolean;
  isCombineEnabled?: () => boolean;
  label?: string;
  still?: boolean;
  lockAxis?: 'x' | 'y';
  renderPreview?: (source: HTMLElement) => HTMLElement | null | undefined;
  hitArea?: HTMLElement;
};

export type SortableItemArgs = {
  element: HTMLElement;
  id: string;
  type?: string;
  handle?: HTMLElement | null;
  canDrag?: (by: { input: string; target: Element | null }) => boolean;
  allowInteractive?: boolean;
  label?: string;
  text?: {
    hold: () => number;
    axis?: 'x' | 'y';
    carries?: (point: { x: number; y: number }) => boolean;
  };
};

export type SortableAnnouncement = {
  item: string;
  list: string;
  position: number;
  count: number;
};

export type SortableMessages = {
  instructions: string;
  lifted: (at: SortableAnnouncement) => string;
  moved: (at: SortableAnnouncement) => string;
  outside: (item: string) => string;
  combining: (item: string, target: string) => string;
  combined: (item: string, target: string) => string;
  dropped: (at: SortableAnnouncement) => string;
  returned: (at: SortableAnnouncement) => string;
};

export type SortableOptions = {
  onBeforeCapture?: (before: { draggableId: string; mode: SortableStart['mode'] }) => void;
  onDragStart?: (start: SortableStart) => void;
  onDragUpdate?: (update: SortableUpdate) => void;
  onDragEnd?: (result: SortableResult) => void;
  prepareDrop?: (result: SortableResult) => HTMLElement | null | (() => HTMLElement | null) | Promise<HTMLElement | null | (() => HTMLElement | null)>;
  touchHold?: number;
  dragDistance?: number;
  outOfTheWay?: { duration: number; easing: string };
  drop?: { minDuration: number; maxDuration: number; easing: string };
  autoScrollEdge?: number;
  lockAxis?: 'x' | 'y';
  inheritProperties?: string[];
  renderPreview?: (source: HTMLElement) => HTMLElement;
  onPreview?: (preview: HTMLElement, source: HTMLElement) => void;
  stay?: (point: { x: number; y: number }) => boolean;
  messages?: Partial<SortableMessages>;
  pointerPoint?: (event: PointerEvent) => { x: number; y: number };
  onDropOutside?: (start: SortableStart, point: { x: number; y: number }) => boolean;
  onMovement?: (movement: SortableMovement) => void;
};

export type SortableMovement = {
  element: HTMLElement;
  phase: 'drag' | 'drop';
  x: number;
  y: number;
};

export type SortableController = {
  container: (args: SortableContainerArgs) => Cleanup;
  item: (args: SortableItemArgs) => Cleanup;
  isDragging: () => boolean;
  cancel: () => void;
  destroy: () => void;
};

const defaultMessages: SortableMessages = {
  instructions: 'Press space to lift. Then use the arrow keys to move, space to drop and escape to cancel.',
  lifted: (at) => `Lifted ${at.item}, position ${at.position} of ${at.count} in ${at.list}.`,
  moved: (at) => `${at.item}, position ${at.position} of ${at.count} in ${at.list}.`,
  outside: (item) => `${item} is outside every list.`,
  combining: (item, target) => `${item} is over ${target}. Drop to put them together.`,
  combined: (item, target) => `Dropped ${item} onto ${target}.`,
  dropped: (at) => `Dropped ${at.item} at position ${at.position} of ${at.count} in ${at.list}.`,
  returned: (at) => `${at.item} is back at position ${at.position} of ${at.count} in ${at.list}.`,
};

const defaults = {
  touchHold: 250,
  dragDistance: 5,
  outOfTheWay: { duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  drop: { minDuration: 330, maxDuration: 550, easing: 'cubic-bezier(.2, 1, .1, 1)' },
  autoScrollEdge: 60,
} as const;

const maxDropDistance = 1500;
const maxScrollSpeed = 24;
const scrollFrame = 1000 / 60;
const scrollIntent = 10;
const inheritedText = ['color', 'font', 'letter-spacing', 'line-height', '-webkit-font-smoothing'];
const interactive = 'input, textarea, select, option, button, a[href], [contenteditable]:not([contenteditable="false"])';
const handleStyleId = 'data-0001-drag-sortable-style';
const handleStyles = `
[data-drag-handle]:not([data-drag-handle="text"]){-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;cursor:grab;touch-action:manipulation}
:root[data-drag-active],:root[data-drag-active] *{-webkit-user-select:none!important;user-select:none!important;cursor:grabbing!important;overflow-anchor:none!important}
`;

type ContainerRegistration = Required<Omit<SortableContainerArgs, 'isDropDisabled' | 'isCombineEnabled' | 'label' | 'lockAxis' | 'renderPreview' | 'hitArea'>> & {
  isDropDisabled: () => boolean;
  isCombineEnabled: () => boolean;
  label: () => string;
  lockAxis: SortableContainerArgs['lockAxis'];
  renderPreview: SortableContainerArgs['renderPreview'];
  hitArea: HTMLElement | null;
};

type ItemRegistration = Required<Omit<SortableItemArgs, 'handle' | 'canDrag' | 'label' | 'text'>> & {
  handle: HTMLElement;
  canDrag: (by: { input: string; target: Element | null }) => boolean;
  text: SortableItemArgs['text'];
  label: () => string;
};

type Box = { left: number; top: number; width: number; height: number };

type Scroller = {
  element: HTMLElement;
  liftLeft: number;
  liftTop: number;
};

type Slot = {
  item: ItemRegistration;
  original: number;
  box: Box;
};

type ContainerSnapshot = {
  registration: ContainerRegistration;
  box: Box;
  gap: number;
  paddingStart: number;
  scrollers: Scroller[];
  horizontalScroll: { liftLeft: number } | undefined;
  hitArea: { element: HTMLElement; scrollers: HTMLElement[] } | null;
  slots: Slot[];
  room: number;
  marginStart: number;
  scale: number;
  isHome: boolean;
  flow: { items: FlowItem[]; source: FlowItem; flow: Flow; origin: number } | null;
};

type Pending = {
  item: ItemRegistration;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  timer: ReturnType<typeof setTimeout> | null;
  held: boolean;
  choosing?: boolean;
};

type Session = {
  item: ItemRegistration;
  mode: SortableStart['mode'];
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  liftBox: Box;
  previewScale: number;
  sourceIndex: number;
  home: ContainerSnapshot;
  containers: ContainerSnapshot[];
  windowLiftX: number;
  windowLiftY: number;
  overlay: HTMLElement;
  preview: HTMLElement;
  destination: { container: ContainerSnapshot; index: number } | null;
  shifts: Map<HTMLElement, { value: number; scale: number; translate: string; transition: string }>;
  sourceVisibility: string;
  reserved: ContainerSnapshot | null;
  scrollFrame: number | null;
  scrollTime: number | null;
  scrollOwed: Map<object, { x: number; y: number }>;
  scrollArmed: Map<object, { left: boolean; right: boolean; top: boolean; bottom: boolean }>;
  impactFrame: number | null;
  dropping: boolean;
  preparing?: boolean;
  land?: () => void;
  committed?: { boxes: Map<HTMLElement, Box>; scrollX: number; scrollY: number };
  landing?: { element: HTMLElement; visibility: string };
  combine: { container: ContainerSnapshot; slot: Slot } | null;
  lockAxis: 'x' | 'y' | undefined;
};

export function createSortable(options: SortableOptions = {}): SortableController {
  const settings = {
    touchHold: options.touchHold ?? defaults.touchHold,
    dragDistance: options.dragDistance ?? defaults.dragDistance,
    outOfTheWay: options.outOfTheWay ?? defaults.outOfTheWay,
    drop: options.drop ?? defaults.drop,
    autoScrollEdge: options.autoScrollEdge ?? defaults.autoScrollEdge,
  };
  const messages: SortableMessages = { ...defaultMessages, ...options.messages };
  const pointOf = options.pointerPoint ?? ((event: PointerEvent) => ({ x: event.clientX, y: event.clientY }));
  const containers = new Map<HTMLElement, ContainerRegistration>();
  const items = new Map<HTMLElement, ItemRegistration>();
  const handles = new Map<HTMLElement, ItemRegistration>();
  let pending: Pending | null = null;
  let session: Session | null = null;
  const documents = new Map<Document, { view: Window; instructions: HTMLElement; liveRegion: HTMLElement }>();
  let eventView: Window | null = null;
  let destroyed = false;
  let reducedMotion = false;
  const settling = new Set<Animation>();
  let liveRegion: HTMLElement | null = null;
  let forgetRelease: (() => void) | null = null;

  function container(args: SortableContainerArgs): Cleanup {
    const registration: ContainerRegistration = {
      element: args.element,
      id: args.id,
      type: args.type ?? 'default',
      axis: args.axis ?? 'vertical',
      isDropDisabled: args.isDropDisabled ?? (() => false),
      isCombineEnabled: args.isCombineEnabled ?? (() => false),
      label: () => args.label ?? args.element.getAttribute('aria-label') ?? args.id,
      still: args.still ?? false,
      lockAxis: args.lockAxis,
      renderPreview: args.renderPreview,
      hitArea: args.hitArea ?? null,
    };
    containers.set(args.element, registration);
    return once(() => {
      if (containers.get(args.element) === registration) containers.delete(args.element);
    });
  }

  function item(args: SortableItemArgs): Cleanup {
    const handle = args.handle ?? args.element;
    const registration: ItemRegistration = {
      element: args.element,
      id: args.id,
      type: args.type ?? 'default',
      handle,
      canDrag: args.canDrag ?? (() => true),
      allowInteractive: args.allowInteractive ?? false,
      label: () => args.label ?? labelOf(args.element, handle),
      text: args.text,
    };
    items.set(args.element, registration);
    handles.set(handle, registration);
    handle.setAttribute('data-drag-handle', args.text ? 'text' : '');
    const addedTabIndex = !args.text && !handle.hasAttribute('tabindex') && !handle.matches(interactive);
    if (addedTabIndex) handle.tabIndex = 0;
    const describedBy = handle.getAttribute('aria-describedby');
    const { instructions } = installDocument(handle.ownerDocument);
    if (!args.text) {
      handle.setAttribute('aria-describedby', [describedBy, instructions.id].filter(Boolean).join(' '));
    }
    return once(() => {
      if (items.get(args.element) === registration) items.delete(args.element);
      if (handles.get(handle) === registration) {
        handles.delete(handle);
        handle.removeAttribute('data-drag-handle');
        if (addedTabIndex) handle.removeAttribute('tabindex');
        if (args.text) return;
        if (describedBy) handle.setAttribute('aria-describedby', describedBy);
        else handle.removeAttribute('aria-describedby');
      }
    });
  }

  function installDocument(document: Document) {
    const existing = documents.get(document);
    if (existing) return existing;
    const view = document.defaultView ?? window;
    view.addEventListener('pointerdown', onPointerDown, true);
    view.addEventListener('keydown', onHandleKeyDown, true);
    if (!document.querySelector(`style[${handleStyleId}]`)) {
      const style = document.createElement('style');
      style.setAttribute(handleStyleId, '');
      style.textContent = handleStyles;
      document.head.appendChild(style);
    }
    const instructions = hiddenText(document, `0001-drag-instructions-${++instanceCount}`);
    instructions.textContent = messages.instructions;
    const liveRegion = hiddenText(document, `0001-drag-live-${instanceCount}`);
    liveRegion.setAttribute('aria-live', 'assertive');
    liveRegion.setAttribute('aria-atomic', 'true');
    const registration = { view, instructions, liveRegion };
    documents.set(document, registration);
    return registration;
  }

  function announce(message: string): void {
    if (liveRegion) liveRegion.textContent = message;
  }

  function announcement(current: Session): SortableAnnouncement | null {
    const destination = current.destination;
    if (!destination) return null;
    return {
      item: current.item.label(),
      list: destination.container.registration.label(),
      position: destination.index + 1,
      count: destination.container.slots.length + 1,
    };
  }

  function announceMove(current: Session): void {
    const at = announcement(current);
    announce(at ? messages.moved(at) : messages.outside(current.item.label()));
  }

  function onHandleKeyDown(event: KeyboardEvent): void {
    if (destroyed || session || pending || event.key !== ' ' || event.defaultPrevented) return;
    const target = eventElement(event.target);
    if (target?.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    const registration = target ? handles.get(target as HTMLElement) : undefined;
    if (!registration || registration.text || !registration.canDrag({ input: 'keyboard', target: registration.handle })) return;
    event.preventDefault();
    event.stopPropagation();
    addWindowListeners(registration.element.ownerDocument.defaultView ?? window);
    const box = measure(registration.element);
    lift(registration, -1, box.left + box.width / 2, box.top + box.height / 2, 'SNAP');
  }

  function findHandle(target: EventTarget | null): ItemRegistration | null {
    let element = eventElement(target);
    let crossedInteractive = false;
    while (element) {
      const registration = handles.get(element as HTMLElement);
      if (registration) {
        return crossedInteractive && !registration.allowInteractive ? null : registration;
      }
      if (element.matches(interactive)) crossedInteractive = true;
      element = element.parentElement;
    }
    return null;
  }

  function onPointerDown(event: PointerEvent): void {
    if (destroyed) return;
    forgetRelease?.();
    if (session?.dropping && !pending) session.land?.();
    if (session && session.mode === 'SNAP' && !session.dropping) {
      void drop('CANCEL');
      return;
    }
    if (session || pending) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const registration = findHandle(event.target);
    const target = eventElement(event.target);
    if (!registration || !registration.canDrag({ input: event.pointerType || 'mouse', target })) return;

    const hold = event.pointerType !== 'touch' && registration.text ? Math.max(0, registration.text.hold()) : 0;
    pending = {
      item: registration,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: pointOf(event).x,
      startY: pointOf(event).y,
      timer: null,
      held: hold > 0,
    };
    if (event.pointerType === 'touch' || hold > 0) {
      pending.timer = setTimeout(() => {
        if (pending) lift(pending.item, pending.pointerId, pending.startX, pending.startY);
      }, hold || settings.touchHold);
    }
    addWindowListeners(registration.element.ownerDocument.defaultView ?? window);
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      if (pending && event.pointerId === pending.pointerId) clearPending();
      else if (session && session.mode === 'FLUID' && event.pointerId === session.pointerId && !session.dropping) void drop('CANCEL');
      return;
    }
    if (pending && event.pointerId === pending.pointerId) {
      const point = pointOf(event);
      const distance = Math.hypot(point.x - pending.startX, point.y - pending.startY);
      if (distance < settings.dragDistance) return;
      const carries = pending.pointerType !== 'touch' ? pending.item.text?.carries : undefined;
      if ((pending.pointerType === 'touch' || pending.held || pending.choosing) && !carries?.(point)) {
        if (pending.choosing) return;
        const axis = pending.pointerType !== 'touch' ? pending.item.text?.axis : undefined;
        const along = Math.abs(axis === 'x' ? point.x - pending.startX : point.y - pending.startY);
        const across = Math.abs(axis === 'x' ? point.y - pending.startY : point.x - pending.startX);
        if (!axis || along < 2 * across) {
          if (!carries) {
            clearPending();
            return;
          }
          if (pending.timer) clearTimeout(pending.timer);
          pending.timer = null;
          pending.held = false;
          pending.choosing = true;
          return;
        }
      }
      lift(pending.item, pending.pointerId, pending.startX, pending.startY);
    }
    if (session && event.pointerId === session.pointerId && !session.dropping) {
      const point = pointOf(event);
      move(point.x, point.y);
    }
  }

  function onPointerUp(event: PointerEvent): void {
    if (pending && event.pointerId === pending.pointerId) {
      clearPending();
      return;
    }
    if (session && event.pointerId === session.pointerId && !session.dropping) {
      suppressClick();
      void drop('DROP');
    }
  }

  function onPointerCancel(event: PointerEvent): void {
    if (pending && event.pointerId === pending.pointerId) clearPending();
    if (session && event.pointerId === session.pointerId && !session.dropping) void drop('CANCEL');
  }

  function onKeyDown(event: KeyboardEvent): void {
    const current = session;
    if (!current || current.dropping) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      void drop('CANCEL');
      return;
    }
    if (current.mode !== 'SNAP') return;
    if (event.key === ' ' || event.key === 'Enter') {
      void drop('DROP');
    } else if (event.key in arrows) {
      moveByKey(current, arrows[event.key as keyof typeof arrows]);
    } else if (event.key !== 'Tab') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  function onTouchMove(event: TouchEvent): void {
    if (session && event.cancelable) event.preventDefault();
  }

  function onContextMenu(event: Event): void {
    if (!pending && !session) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onNativeDragStart(event: Event): void {
    if (pending || session) event.preventDefault();
  }

  function onBlur(): void {
    clearPending();
    if (session && !session.dropping) void drop('CANCEL');
  }

  function onVisibility(event: Event): void {
    if (event.type === 'visibilitychange' && eventView?.document.visibilityState !== 'hidden') return;
    onBlur();
  }

  function onScroll(): void {
    if (!session || session.dropping || session.impactFrame !== null) return;
    const view = session.overlay.ownerDocument.defaultView;
    if (!view) return;
    session.impactFrame = view.requestAnimationFrame(() => {
      if (!session) return;
      session.impactFrame = null;
      if (session.mode === 'SNAP') placePreview(session, false);
      else updateImpact(session);
    });
  }

  function addWindowListeners(view: Window): void {
    if (eventView === view) return;
    removeWindowListeners();
    eventView = view;
    liveRegion = documents.get(view.document)?.liveRegion ?? null;
    view.addEventListener('pointermove', onPointerMove, true);
    view.addEventListener('pointerup', onPointerUp, true);
    view.addEventListener('pointercancel', onPointerCancel, true);
    view.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    view.addEventListener('contextmenu', onContextMenu, true);
    view.addEventListener('dragstart', onNativeDragStart, true);
    view.addEventListener('keydown', onKeyDown, true);
    view.addEventListener('blur', onBlur);
    view.addEventListener('pagehide', onVisibility);
    view.document.addEventListener('visibilitychange', onVisibility);
    view.addEventListener('scroll', onScroll, true);
  }

  function removeWindowListeners(): void {
    const view = eventView;
    if (!view) return;
    eventView = null;
    view.removeEventListener('pointermove', onPointerMove, true);
    view.removeEventListener('pointerup', onPointerUp, true);
    view.removeEventListener('pointercancel', onPointerCancel, true);
    view.removeEventListener('touchmove', onTouchMove, true);
    view.removeEventListener('contextmenu', onContextMenu, true);
    view.removeEventListener('dragstart', onNativeDragStart, true);
    view.removeEventListener('keydown', onKeyDown, true);
    view.removeEventListener('blur', onBlur);
    view.removeEventListener('pagehide', onVisibility);
    view.document.removeEventListener('visibilitychange', onVisibility);
    view.removeEventListener('scroll', onScroll, true);
  }

  function clearPending(): void {
    if (!pending) return;
    if (pending.timer) clearTimeout(pending.timer);
    pending = null;
    if (!session) removeWindowListeners();
  }

  function swallowRelease(view: Window, pointerId: number): void {
    forgetRelease?.();
    const released = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      forgetRelease?.();
      if (event.type === 'pointerup') suppressClick(view);
    };
    view.addEventListener('pointerup', released, true);
    view.addEventListener('pointercancel', released, true);
    forgetRelease = () => {
      forgetRelease = null;
      view.removeEventListener('pointerup', released, true);
      view.removeEventListener('pointercancel', released, true);
    };
  }

  function suppressClick(view: Window = session?.overlay.ownerDocument.defaultView ?? eventView ?? window): void {
    const stop = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    view.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => view.removeEventListener('click', stop, true), 0);
  }

  function lift(
    pressed: ItemRegistration,
    pointerId: number,
    startX: number,
    startY: number,
    mode: SortableStart['mode'] = 'FLUID',
  ): void {
    if (pending?.timer) clearTimeout(pending.timer);
    pending = null;

    options.onBeforeCapture?.({ draggableId: pressed.id, mode });
    for (const animation of settling) animation.finish();
    settling.clear();
    const registration = registrationFor(pressed);
    if (!registration) {
      removeWindowListeners();
      return;
    }
    const document = registration.element.ownerDocument;
    const view = document.defaultView ?? window;
    const homeRegistration = closestContainer(registration);
    if (!homeRegistration) {
      removeWindowListeners();
      return;
    }

    reducedMotion = view.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const liftBox = measure(registration.element);
    const sourceStyle = view.getComputedStyle(registration.element);
    const margins = {
      top: parsePixels(sourceStyle.marginTop),
      left: parsePixels(sourceStyle.marginLeft),
      vertical: parsePixels(sourceStyle.marginTop) + parsePixels(sourceStyle.marginBottom),
      horizontal: parsePixels(sourceStyle.marginLeft) + parsePixels(sourceStyle.marginRight),
    };
    const itemScale = scaleOf(registration.element, liftBox);
    const scrollers = new Map<HTMLElement, Scroller>();
    const snapshots: ContainerSnapshot[] = [];
    let sourceIndex = 0;

    for (const candidate of containers.values()) {
      if (candidate.type !== registration.type || !candidate.element.isConnected || candidate.element.ownerDocument !== document) continue;
      if (registration.element.contains(candidate.element)) continue;
      const members = itemsOf(candidate);
      const isHome = candidate === homeRegistration;
      const style = view.getComputedStyle(candidate.element);
      const vertical = candidate.axis === 'vertical';
      const box = measure(candidate.element);
      const scale = scaleOf(candidate.element, box);
      const gap = parsePixels(vertical ? style.rowGap : style.columnGap) * scale;
      const slots: Slot[] = [];
      const flowItems: FlowItem[] = [];
      const along = (element: HTMLElement, box: Box): FlowItem => {
        const style = view.getComputedStyle(element);
        const scale = scaleOf(element, box);
        return {
          start: vertical ? box.top : box.left,
          size: vertical ? box.height : box.width,
          marginStart: parsePixels(vertical ? style.marginTop : style.marginLeft) * scale,
          marginEnd: parsePixels(vertical ? style.marginBottom : style.marginRight) * scale,
        };
      };
      members.forEach((member, original) => {
        const memberBox = member === registration ? liftBox : measure(member.element);
        if (!candidate.still) flowItems.push(along(member.element, memberBox));
        if (member === registration) {
          sourceIndex = original;
          return;
        }
        slots.push({ item: member, original, box: memberBox });
      });
      const ancestors = scrollParents(candidate.element).map(element => {
        let scroller = scrollers.get(element);
        if (!scroller) {
          scroller = { element, liftLeft: element.scrollLeft, liftTop: element.scrollTop };
          scrollers.set(element, scroller);
        }
        return scroller;
      });
      snapshots.push({
        registration: candidate,
        box,
        scale,
        gap,
        paddingStart: parsePixels(vertical ? style.paddingTop : style.paddingLeft) * scale,
        scrollers: ancestors,
        horizontalScroll: !vertical && (style.overflowX === 'auto' || style.overflowX === 'scroll') && candidate.element.scrollWidth > candidate.element.clientWidth
          ? { liftLeft: candidate.element.scrollLeft } : undefined,
        hitArea: candidate.hitArea ? { element: candidate.hitArea, scrollers: scrollParents(candidate.hitArea) } : null,
        slots,
        room: candidate.still ? 0 : (vertical ? liftBox.height + margins.vertical * itemScale : liftBox.width + margins.horizontal * itemScale) + gap,
        marginStart: (vertical ? margins.top : margins.left) * itemScale,
        isHome,
        flow: candidate.still ? null : flowOf(style, box, scale, vertical, flowItems, isHome ? flowItems[sourceIndex] : along(registration.element, liftBox)),
      });
    }

    const home = snapshots.find((snapshot) => snapshot.isHome);
    if (!home) {
      removeWindowListeners();
      return;
    }

    const overlay = document.createElement('div');
    overlay.setAttribute('data-drag-overlay', '');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '2147483000',
      contain: 'layout style',
    });
    for (const property of options.inheritProperties ?? []) {
      overlay.style.setProperty(property, sourceStyle.getPropertyValue(property));
    }

    const customPreview = home.registration.renderPreview?.(registration.element) ?? options.renderPreview?.(registration.element);
    const copied = customPreview ? null : cloneForPreview(registration.element);
    const preview = customPreview ?? copied!.clone;
    for (const property of customPreview ? inheritedText : []) {
      preview.style.setProperty(property, sourceStyle.getPropertyValue(property));
    }
    preview.setAttribute('data-drag-preview', '');
    preview.setAttribute('aria-hidden', 'true');
    Object.assign(preview.style, {
      position: 'absolute',
      left: `${liftBox.left}px`,
      top: `${liftBox.top}px`,
      width: `${liftBox.width / itemScale}px`,
      height: `${liftBox.height / itemScale}px`,
      transformOrigin: '0 0',
      margin: '0',
      boxSizing: 'border-box',
      translate: 'none',
      transform: previewTransform(0, 0, itemScale),
      transition: 'none',
      willChange: 'transform',
      pointerEvents: 'none',
    });
    overlay.appendChild(preview);
    if (!customPreview) standOnBackground(preview, registration.element);
    options.onPreview?.(preview, registration.element);
    document.body.appendChild(overlay);
    for (const [copy, left, top] of copied?.scrolled ?? []) {
      copy.scrollLeft = left;
      copy.scrollTop = top;
    }

    const element = registration.element;
    session = {
      item: registration,
      mode,
      pointerId,
      startX,
      startY,
      lastX: startX,
      lastY: startY,
      liftBox,
      previewScale: itemScale,
      sourceIndex,
      home,
      containers: snapshots,
      windowLiftX: view.scrollX,
      windowLiftY: view.scrollY,
      overlay,
      preview,
      destination: { container: home, index: sourceIndex },
      shifts: new Map(),
      sourceVisibility: element.style.visibility,
      reserved: null,
      scrollFrame: null,
      scrollTime: null,
      scrollOwed: new Map(),
      scrollArmed: new Map(),
      impactFrame: null,
      dropping: false,
      combine: null,
      lockAxis: home.registration.lockAxis ?? options.lockAxis,
    };

    element.style.visibility = 'hidden';
    element.setAttribute('data-drag-source', '');
    home.registration.element.setAttribute('data-drag-over', '');
    document.documentElement.setAttribute('data-drag-active', registration.type);

    options.onDragStart?.(startOf(session));
    const lifted = announcement(session);
    if (lifted) announce(messages.lifted(lifted));
  }

  function move(clientX: number, clientY: number): void {
    const current = session;
    if (!current) return;
    current.lastX = clientX;
    current.lastY = clientY;
    const x = current.lockAxis === 'y' ? 0 : clientX - current.startX;
    const y = current.lockAxis === 'x' ? 0 : clientY - current.startY;
    current.preview.style.transform = previewTransform(x, y, current.previewScale);
    updateImpact(current);
    scheduleAutoScroll(current);
  }

  function offsetOf(current: Session, snapshot: ContainerSnapshot, includeContent = true): { x: number; y: number } {
    const view = current.overlay.ownerDocument.defaultView ?? window;
    let x = view.scrollX - current.windowLiftX;
    let y = view.scrollY - current.windowLiftY;
    for (const scroller of snapshot.scrollers) {
      x += scroller.element.scrollLeft - scroller.liftLeft;
      y += scroller.element.scrollTop - scroller.liftTop;
    }
    if (includeContent && snapshot.horizontalScroll) x += snapshot.registration.element.scrollLeft - snapshot.horizontalScroll.liftLeft;
    return { x, y };
  }

  function containerBox(current: Session, snapshot: ContainerSnapshot): Box {
    if (snapshot.hitArea) {
      return snapshot.hitArea.scrollers.reduce((clipped, element) => intersect(clipped, measure(element)), measure(snapshot.hitArea.element));
    }
    const offset = offsetOf(current, snapshot, false);
    const box = snapshot.box;
    const visible = { ...box, left: box.left - offset.x, top: box.top - offset.y };
    return snapshot.scrollers.reduce((clipped, { element }) => intersect(clipped, measure(element)), visible);
  }

  function updateImpact(current: Session): void {
    const pointerX = current.lastX;
    const pointerY = current.lastY;
    let over: ContainerSnapshot | null = null;
    let overArea = Infinity;

    if (options.stay?.({ x: pointerX, y: pointerY })) {
      const uncombined = setCombine(current, null);
      const previous = current.destination;
      if (previous?.container === current.home && previous.index === current.sourceIndex) {
        if (uncombined) options.onDragUpdate?.(updateOf(current));
        return;
      }
      current.destination = { container: current.home, index: current.sourceIndex };
      applyShifts(current, previous?.container ?? null);
      current.overlay.ownerDocument.documentElement.toggleAttribute('data-drag-outside', false);
      options.onDragUpdate?.(updateOf(current));
      announceMove(current);
      return;
    }

    for (const snapshot of current.containers) {
      if (snapshot.registration.isDropDisabled()) continue;
      const box = containerBox(current, snapshot);
      if (!contains(box, pointerX, pointerY)) continue;
      const area = box.width * box.height;
      if (area < overArea) {
        over = snapshot;
        overArea = area;
      }
    }

    const combining = over && current.mode === 'FLUID' ? combineIn(current, over) : null;
    if (combining && over) {
      if (setCombine(current, { container: over, slot: combining })) {
        options.onDragUpdate?.(updateOf(current));
        announce(messages.combining(current.item.label(), combining.item.label()));
      }
      return;
    }
    const uncombined = setCombine(current, null);

    let next: Session['destination'] = null;
    if (over) next = { container: over, index: indexIn(current, over) };

    const previous = current.destination;
    if (previous?.container === next?.container && previous?.index === next?.index) {
      if (uncombined) {
        options.onDragUpdate?.(updateOf(current));
        announceMove(current);
      }
      return;
    }
    current.destination = next;
    applyShifts(current, previous?.container ?? null);
    current.overlay.ownerDocument.documentElement.toggleAttribute('data-drag-outside', !next);
    options.onDragUpdate?.(updateOf(current));
    announceMove(current);
  }

  function moveByKey(current: Session, direction: { x: number; y: number }): void {
    const from = current.destination ?? { container: current.home, index: current.sourceIndex };
    const vertical = from.container.registration.axis === 'vertical';
    const along = vertical ? direction.y : direction.x;
    let next: NonNullable<Session['destination']> | null = null;

    if (along !== 0) {
      const index = from.index + along;
      if (index >= 0 && index <= from.container.slots.length) next = { container: from.container, index };
    } else {
      const neighbour = neighbourOf(current, from.container, direction);
      if (neighbour) next = { container: neighbour, index: indexNear(current, neighbour) };
    }
    if (!next) return;

    const previous = current.destination?.container ?? null;
    current.destination = next;
    applyShifts(current, previous);
    placePreview(current, true);
    revealPreview(current);
    options.onDragUpdate?.(updateOf(current));
    announceMove(current);
  }

  function neighbourOf(current: Session, from: ContainerSnapshot, direction: { x: number; y: number }): ContainerSnapshot | null {
    const origin = centreOf(containerBox(current, from));
    let best: ContainerSnapshot | null = null;
    let bestDistance = Infinity;
    for (const snapshot of current.containers) {
      if (snapshot === from || snapshot.registration.isDropDisabled()) continue;
      const centre = centreOf(containerBox(current, snapshot));
      const ahead = (centre.x - origin.x) * direction.x + (centre.y - origin.y) * direction.y;
      if (ahead <= 1) continue;
      const aside = Math.abs((centre.x - origin.x) * direction.y) + Math.abs((centre.y - origin.y) * direction.x);
      const distance = ahead + aside * 2;
      if (distance < bestDistance) {
        best = snapshot;
        bestDistance = distance;
      }
    }
    return best;
  }

  function indexNear(current: Session, snapshot: ContainerSnapshot): number {
    const vertical = snapshot.registration.axis === 'vertical';
    const offset = offsetOf(current, snapshot);
    const placed = parseTranslate(current.preview.style.transform);
    const centre = vertical
      ? current.liftBox.top + placed.y + current.liftBox.height / 2
      : current.liftBox.left + placed.x + current.liftBox.width / 2;
    return snapshot.slots.filter((slot) => {
      const start = baselineStart(current, snapshot, slot) - (vertical ? offset.y : offset.x);
      return start + (vertical ? slot.box.height : slot.box.width) / 2 < centre;
    }).length;
  }

  function placePreview(current: Session, animate: boolean): void {
    const target = targetPosition(current);
    const { duration, easing } = settings.outOfTheWay;
    current.preview.style.transition = animate && !reducedMotion ? `transform ${duration}ms ${easing}` : 'none';
    current.preview.style.transform = previewTransform(target.x, target.y, current.previewScale);
  }

  function revealPreview(current: Session): void {
    const view = current.overlay.ownerDocument.defaultView;
    if (!view) return;
    const margin = settings.autoScrollEdge;
    const into = (frame: Box) => {
      const target = targetPosition(current);
      const left = current.liftBox.left + target.x;
      const top = current.liftBox.top + target.y;
      return {
        x: Math.min(0, left - margin - frame.left) + Math.max(0, left + current.liftBox.width + margin - frame.left - frame.width),
        y: Math.min(0, top - margin - frame.top) + Math.max(0, top + current.liftBox.height + margin - frame.top - frame.height),
      };
    };
    for (const { element } of current.destination?.container.scrollers ?? []) {
      const by = into(measure(element));
      if (by.x || by.y) element.scrollBy(by.x, by.y);
    }
    const page = into({ left: 0, top: 0, width: view.innerWidth, height: view.innerHeight });
    if (page.x || page.y) view.scrollBy(page.x, page.y);
    placePreview(current, true);
  }

  function spanOf(current: Session, snapshot: ContainerSnapshot): { start: number; end: number } {
    const vertical = snapshot.registration.axis === 'vertical';
    const liftStart = vertical ? current.liftBox.top : current.liftBox.left;
    const size = vertical ? current.liftBox.height : current.liftBox.width;
    const moved =
      vertical
        ? current.lockAxis === 'x' ? 0 : current.lastY - current.startY
        : current.lockAxis === 'y' ? 0 : current.lastX - current.startX;
    return { start: liftStart + moved, end: liftStart + moved + size };
  }

  function combineIn(current: Session, snapshot: ContainerSnapshot): Slot | null {
    const destination = current.destination;
    if (!destination || destination.container !== snapshot || !snapshot.registration.isCombineEnabled()) return null;
    const vertical = snapshot.registration.axis === 'vertical';
    const scrolled = vertical ? offsetOf(current, snapshot).y : offsetOf(current, snapshot).x;
    const dragged = spanOf(current, snapshot);
    return snapshot.slots.find((slot, position) => {
      const size = vertical ? slot.box.height : slot.box.width;
      const after = position >= destination.index;
      const start = baselineStart(current, snapshot, slot) - scrolled + (after ? snapshot.room : 0);
      const threshold = size / 4;
      const edge = after ? dragged.end : dragged.start;
      return edge > start + threshold && edge < start + size - threshold;
    }) ?? null;
  }

  function setCombine(current: Session, next: Session['combine']): boolean {
    if (current.combine?.slot === next?.slot) return false;
    current.combine?.slot.item.element.removeAttribute('data-drag-combine');
    next?.slot.item.element.setAttribute('data-drag-combine', '');
    current.combine = next;
    return true;
  }

  function indexIn(current: Session, snapshot: ContainerSnapshot): number {
    const vertical = snapshot.registration.axis === 'vertical';
    const offset = offsetOf(current, snapshot);
    const { start: draggedStart, end: draggedEnd } = spanOf(current, snapshot);
    const scrolled = vertical ? offset.y : offset.x;
    if (snapshot.horizontalScroll) {
      const viewport = containerBox(current, snapshot);
      return snapshot.slots.filter(slot => {
        const start = slot.box.left - scrolled;
        const end = start + slot.box.width;
        const visibleStart = Math.max(start, viewport.left);
        const visibleEnd = Math.min(end, viewport.left + viewport.width);
        const centre = visibleStart < visibleEnd ? (visibleStart + visibleEnd) / 2 : (start + end) / 2;
        return centre < current.lastX;
      }).length;
    }
    const centres = snapshot.slots.map((slot) => baselineStart(current, snapshot, slot) - scrolled + (vertical ? slot.box.height : slot.box.width) / 2);
    const count = centres.length;

    if (current.destination?.container !== snapshot) {
      const centre = (draggedStart + draggedEnd) / 2;
      return centres.filter((value) => value < centre).length;
    }

    let index = current.destination.index;
    while (index > 0 && draggedStart < centres[index - 1]) index--;
    if (index !== current.destination.index) return index;
    while (index < count && draggedEnd > centres[index] + snapshot.room) index++;
    return index;
  }

  function baselineStart(current: Session, snapshot: ContainerSnapshot, slot: Slot): number {
    const vertical = snapshot.registration.axis === 'vertical';
    const start = vertical ? slot.box.top : slot.box.left;
    return snapshot.isHome && slot.original > current.sourceIndex ? start - snapshot.room : start;
  }

  function applyShifts(current: Session, previous: ContainerSnapshot | null): void {
    const destination = current.destination;
    const touched = new Set<ContainerSnapshot>([current.home]);
    if (previous) touched.add(previous);
    if (destination) touched.add(destination.container);

    for (const snapshot of touched) {
      const drawn = flowOrder(current, snapshot);
      snapshot.slots.forEach((slot, position) => {
        let value = 0;
        if (drawn) value = drawn.shifts[position];
        else {
          if (snapshot.isHome && slot.original > current.sourceIndex) value -= snapshot.room;
          if (destination?.container === snapshot && position >= destination.index) value += snapshot.room;
        }
        shift(current, slot.item.element, value, snapshot);
      });
    }

    const foreign = destination && !destination.container.isHome ? destination.container : null;
    if (current.reserved !== foreign) {
      current.reserved?.registration.element.style.removeProperty('--drag-reserve');
      current.reserved?.registration.element.removeAttribute('data-drag-over');
      if (foreign && !foreign.registration.still) {
        foreign.registration.element.style.setProperty('--drag-reserve', `${foreign.room}px`);
      }
      current.reserved = foreign;
    }
    for (const snapshot of current.containers) {
      const isOver = destination?.container === snapshot;
      if (isOver) snapshot.registration.element.setAttribute('data-drag-over', '');
      else snapshot.registration.element.removeAttribute('data-drag-over');
    }
  }

  function flowOrder(current: Session, snapshot: ContainerSnapshot): { shifts: number[]; source: number | null } | null {
    const model = snapshot.flow;
    if (!model) return null;
    const order = snapshot.slots.map((slot) => model.items[slot.original]);
    const at = current.destination?.container === snapshot ? current.destination.index : -1;
    if (at >= 0) order.splice(at, 0, model.source);
    const starts = flowStarts(order, model.flow, model.origin);
    const shifts = snapshot.slots.map((slot, position) => starts[at >= 0 && position >= at ? position + 1 : position] - model.items[slot.original].start);
    return { shifts, source: at >= 0 ? starts[at] : null };
  }

  function shift(current: Session, element: HTMLElement, screen: number, snapshot: ContainerSnapshot): void {
    const axis = snapshot.registration.axis;
    const value = screen / snapshot.scale;
    const existing = current.shifts.get(element);
    const before = existing?.value ?? 0;
    if (Math.abs(before - value) < 0.01) return;
    if (!existing) {
      current.shifts.set(element, {
        value,
        scale: snapshot.scale,
        translate: element.style.translate,
        transition: element.style.transition,
      });
      const { duration, easing } = settings.outOfTheWay;
      element.style.transition = reducedMotion ? 'none' : `translate ${duration}ms ${easing}`;
    } else {
      existing.value = value;
    }
    const moved = (value - before) * snapshot.scale;
    options.onMovement?.({ element, phase: 'drag', x: axis === 'vertical' ? 0 : moved, y: axis === 'vertical' ? moved : 0 });
    element.style.translate = value === 0 ? 'none' : axis === 'vertical' ? `0 ${value}px` : `${value}px 0`;
    element.style.setProperty('--drag-shift', `${value}px`);
  }

  function scheduleAutoScroll(current: Session): void {
    if (current.scrollFrame !== null) return;
    const view = current.overlay.ownerDocument.defaultView;
    if (!view) return;
    const step = (time: number) => {
      if (session !== current || current.dropping) return;
      current.scrollFrame = null;
      const elapsed = current.scrollTime === null ? scrollFrame : time - current.scrollTime;
      current.scrollTime = time;
      if (autoScroll(current, Math.min(2, Math.max(0.25, elapsed / scrollFrame)))) {
        updateImpact(current);
        current.scrollFrame = view.requestAnimationFrame(step);
      } else {
        current.scrollTime = null;
      }
    };
    current.scrollFrame = view.requestAnimationFrame(step);
  }

  function autoScroll(current: Session, frames: number): boolean {
    const view = current.overlay.ownerDocument.defaultView;
    if (!view) return false;
    let takenX = false, takenY = false, moved = false;
    const scroll = (key: object, speed: { x: number; y: number }, by: (x: number, y: number) => void, at: () => { x: number; y: number }) => {
      const x = takenX ? 0 : speed.x, y = takenY ? 0 : speed.y;
      const owed = current.scrollOwed.get(key) ?? { x: 0, y: 0 };
      current.scrollOwed.set(key, owed);
      owed.x = x ? owed.x + x * frames : 0;
      owed.y = y ? owed.y + y * frames : 0;
      if (!x && !y) return;
      const stepX = Math.trunc(owed.x), stepY = Math.trunc(owed.y);
      owed.x -= stepX;
      owed.y -= stepY;
      const before = at();
      if (stepX || stepY) by(stepX, stepY);
      const after = at();
      const wentX = stepX ? after.x !== before.x : !!x, wentY = stepY ? after.y !== before.y : !!y;
      takenX ||= wentX;
      takenY ||= wentY;
      moved ||= wentX || wentY;
    };
    const container = current.destination?.container ?? current.home;
    if (container.horizontalScroll) {
      const element = container.registration.element;
      const box = containerBox(current, container);
      if (contains(box, current.lastX, current.lastY)) {
        scroll(element, { x: edgeSpeed(current, element, box).x, y: 0 },
          x => element.scrollBy({ left: x, behavior: 'instant' }), () => ({ x: element.scrollLeft, y: element.scrollTop }));
      }
    }
    for (const { element } of container.scrollers) {
      const box = measure(element);
      if (!contains(box, current.lastX, current.lastY)) continue;
      scroll(element, edgeSpeed(current, element, box), (x, y) => element.scrollBy(x, y), () => ({ x: element.scrollLeft, y: element.scrollTop }));
      if (takenX && takenY) return true;
    }
    const page = { left: 0, top: 0, width: view.innerWidth, height: view.innerHeight };
    scroll(view, edgeSpeed(current, view, page), (x, y) => view.scrollBy(x, y), () => ({ x: view.scrollX, y: view.scrollY }));
    return moved;
  }

  function edgeSpeed(current: Session, key: object, box: Box): { x: number; y: number } {
    const armed = current.scrollArmed.get(key) ?? { left: false, right: false, top: false, bottom: false };
    current.scrollArmed.set(key, armed);
    const along = (position: number, lifted: number, start: number, length: number, before: 'left' | 'top', after: 'right' | 'bottom') => {
      const edge = Math.min(settings.autoScrollEdge, length / 5);
      if (edge <= 0) return 0;
      const fromStart = position - start;
      const fromEnd = start + length - position;
      if (fromStart >= edge || position <= lifted - scrollIntent) armed[before] = true;
      if (fromEnd >= edge || position >= lifted + scrollIntent) armed[after] = true;
      if (fromStart < edge) return armed[before] ? -maxScrollSpeed * ((edge - Math.max(fromStart, 0)) / edge) ** 2 : 0;
      if (fromEnd < edge) return armed[after] ? maxScrollSpeed * ((edge - Math.max(fromEnd, 0)) / edge) ** 2 : 0;
      return 0;
    };
    const x = along(current.lastX, current.startX, box.left, box.width, 'left', 'right');
    const y = along(current.lastY, current.startY, box.top, box.height, 'top', 'bottom');
    return { x, y };
  }

  async function drop(reason: SortableResult['reason']): Promise<void> {
    const current = session;
    if (!current || current.dropping) return;
    current.dropping = true;
    const view = current.overlay.ownerDocument.defaultView ?? window;
    if (current.scrollFrame !== null) view.cancelAnimationFrame(current.scrollFrame);
    if (current.impactFrame !== null) view.cancelAnimationFrame(current.impactFrame);

    if (reason === 'DROP' && current.combine) {
      const { container, slot } = current.combine;
      const result: SortableResult = { ...startOf(current), destination: null, combine: combineOf(current), reason };
      const vertical = container.registration.axis === 'vertical';
      const offset = offsetOf(current, container);
      const index = container.slots.indexOf(slot);
      const along = baselineStart(current, container, slot) + (current.destination && index >= current.destination.index ? container.room : 0);
      const x = (vertical ? slot.box.left : along) - offset.x - current.liftBox.left;
      const y = (vertical ? along : slot.box.top) - offset.y - current.liftBox.top;
      const { maxDuration, easing } = settings.drop;
      if (reducedMotion) {
        finish(current, result);
        return;
      }
      current.preview.style.transition = `transform ${maxDuration}ms ${easing}, opacity ${maxDuration}ms ${easing}`;
      current.preview.style.transform = previewTransform(x, y, current.previewScale * 0.75);
      current.preview.style.opacity = '0';
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        finish(current, result);
      };
      current.land = done;
      current.preview.addEventListener('transitionend', done, { once: true });
      setTimeout(done, maxDuration + 50);
      return;
    }
    setCombine(current, null);
    if (reason === 'CANCEL' && current.mode === 'FLUID') swallowRelease(view, current.pointerId);

    if (reason === 'DROP' && !current.destination && current.mode === 'FLUID') {
      if (options.onDropOutside?.(startOf(current), { x: current.lastX, y: current.lastY })) {
        finish(current, { ...startOf(current), destination: null, combine: null, reason: 'DROP' });
        return;
      }
    }
    const returning = reason === 'CANCEL' || !current.destination;
    if (returning) {
      const previous = current.destination?.container ?? null;
      current.destination = { container: current.home, index: current.sourceIndex };
      applyShifts(current, previous);
    }

    let finalElement: HTMLElement | null = null;
    let finalBox: Box | null = null;
    const settle = (siblings: HTMLElement[], before: Map<HTMLElement, DOMRect>, resting: Map<HTMLElement, Box>) => {
      const displaced = new Map<HTMLElement, { x: number; y: number }>();
      current.committed = { boxes: new Map(), scrollX: view.scrollX, scrollY: view.scrollY };
      for (const element of siblings) {
        if (!element.isConnected || element === finalElement) continue;
        const old = before.get(element)!, next = element.getBoundingClientRect();
        reportDrop(element, resting.get(element)!, next);
        displaced.set(element, { x: old.left - next.left, y: old.top - next.top });
        current.committed.boxes.set(element, { left: next.left, top: next.top, width: next.width, height: next.height });
      }
      for (const [element, from] of reducedMotion ? [] : displaced) {
        let holder = element.parentElement;
        while (holder && !displaced.has(holder)) holder = holder.parentElement;
        const carried = holder ? displaced.get(holder)! : { x: 0, y: 0 };
        const x = from.x - carried.x, y = from.y - carried.y;
        if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) continue;
        const animation = element.animate([{ translate: `${x}px ${y}px` }, { translate: (element.ownerDocument.defaultView ?? window).getComputedStyle(element).translate }], { duration: settings.outOfTheWay.duration, easing: settings.outOfTheWay.easing });
        if (!animation) continue;
        settling.add(animation);
        animation.addEventListener?.('finish', () => settling.delete(animation));
        animation.addEventListener?.('cancel', () => settling.delete(animation));
      }
    };
    if (reason === 'DROP' && options.prepareDrop) {
      current.preparing = true;
      const siblings = siblingsOf(current);
      const before = new Map(siblings.map(element => [element, element.getBoundingClientRect()]));
      const resting = restingBoxes(current, siblings);
      for (const [element, saved] of current.shifts) { element.style.transition = 'none'; element.style.translate = saved.translate; }
      current.reserved?.registration.element.style.removeProperty('--drag-reserve');
      try {
        const prepared = options.prepareDrop({ ...startOf(current), destination: returning ? null : locationOf(current.destination!), combine: null, reason });
        const resolved = promiseLike(prepared) ? await prepared : prepared;
        const locate = typeof resolved === 'function' ? resolved : () => resolved;
        finalElement = locate();
        if (session !== current) return;
        if (finalElement?.isConnected) {
          current.landing = { element: finalElement, visibility: finalElement.style.visibility };
          finalElement.style.visibility = 'hidden';
        }
        finalBox = finalElement?.isConnected ? measure(finalElement) : null;
        settle(siblings, before, resting);
        await new Promise<void>(resolve => (current.overlay.ownerDocument.defaultView ?? window).requestAnimationFrame(() => resolve()));
        if (session !== current) return;
        const updated = locate();
        if (updated !== finalElement) {
          if (current.landing) current.landing.element.style.visibility = current.landing.visibility;
          finalElement = updated;
          if (finalElement?.isConnected) { current.landing = { element: finalElement, visibility: finalElement.style.visibility }; finalElement.style.visibility = 'hidden'; }
          finalBox = finalElement?.isConnected ? restingBox(finalElement, current.shifts) : null;
        }
      } catch (error) {
        if (session === current) finish(current, { ...startOf(current), destination: null, combine: null, reason: 'CANCEL' });
        reportFailure(view, error);
        return;
      }
    }
    const landingContainer = current.destination?.container;
    if (landingContainer?.horizontalScroll) {
      const box = containerBox(current, landingContainer);
      const inset = [box.top, view.innerWidth - box.left - box.width, view.innerHeight - box.top - box.height, box.left];
      current.overlay.style.clipPath = `inset(${inset.map(value => `${Math.max(0, value)}px`).join(' ')})`;
    }
    const target = finalBox ? { x: finalBox.left - current.liftBox.left, y: finalBox.top - current.liftBox.top } : targetPosition(current);
    const from = parseTranslate(current.preview.style.transform);
    const distance = Math.hypot(target.x - from.x, target.y - from.y);
    const { minDuration, maxDuration, easing } = settings.drop;
    const lands = !returning && !!current.destination?.container.registration.still;
    const duration = distance < 0.5 || reducedMotion || lands ? 0 : minDuration + (maxDuration - minDuration) * Math.min(distance / maxDropDistance, 1);

    const result: SortableResult = {
      ...startOf(current),
      destination: returning || !current.destination ? null : locationOf(current.destination),
      combine: null,
      reason,
    };

    if (duration === 0) {
      finish(current, result);
      return;
    }
    current.preview.style.transition = `transform ${duration}ms ${easing}`;
    current.preview.style.transform = previewTransform(target.x, target.y, current.previewScale);
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      finish(current, result);
    };
    current.land = done;
    current.preview.addEventListener('transitionend', done, { once: true });
    setTimeout(done, duration + 50);
  }

  function targetPosition(current: Session): { x: number; y: number } {
    const destination = current.destination ?? { container: current.home, index: current.sourceIndex };
    const snapshot = destination.container;
    const vertical = snapshot.registration.axis === 'vertical';
    const offset = offsetOf(current, snapshot);
    const slots = snapshot.slots;
    let start: number;
    const still = snapshot.registration.still;
    const over = still ? stillSlot(snapshot, destination.index) : undefined;

    const flowed = still ? null : flowOrder(current, snapshot)?.source ?? null;

    if (snapshot.isHome && destination.index === current.sourceIndex) {
      start = vertical ? current.liftBox.top : current.liftBox.left;
    } else if (flowed !== null) {
      start = flowed;
    } else if (over) {
      start = vertical ? over.box.top : over.box.left;
    } else if (still && slots.length > 0) {
      const last = slots[slots.length - 1];
      start = (vertical ? last.box.top + last.box.height : last.box.left + last.box.width) + snapshot.gap;
    } else if (destination.index < slots.length) {
      start = baselineStart(current, snapshot, slots[destination.index]);
    } else if (slots.length > 0) {
      const last = slots[slots.length - 1];
      const size = vertical ? current.liftBox.height : current.liftBox.width;
      start = baselineStart(current, snapshot, last) + (vertical ? last.box.height : last.box.width) + snapshot.room - size;
    } else {
      start = (vertical ? snapshot.box.top : snapshot.box.left) + snapshot.paddingStart + snapshot.marginStart;
    }

    const crossInHome = vertical ? current.liftBox.left - current.home.box.left : current.liftBox.top - current.home.box.top;
    const cross = snapshot.isHome
      ? vertical
        ? current.liftBox.left
        : current.liftBox.top
      : (vertical ? snapshot.box.left : snapshot.box.top) + crossInHome;

    const startNow = start - (vertical ? offset.y : offset.x);
    const crossNow = cross - (vertical ? offset.x : offset.y);
    return {
      x: (vertical ? crossNow : startNow) - current.liftBox.left,
      y: (vertical ? startNow : crossNow) - current.liftBox.top,
    };
  }

  function stillSlot(snapshot: ContainerSnapshot, index: number): Slot | undefined {
    if (!snapshot.isHome) return snapshot.slots[index];
    return snapshot.slots.find((slot) => slot.original === index);
  }

  function finish(current: Session, result: SortableResult): void {
    const at = announcement(current);
    const siblings = options.onMovement && !current.preparing ? siblingsOf(current) : [];
    const resting = restingBoxes(current, siblings);
    try {
      options.onDragEnd?.(result);
    } finally {
      cleanup(current);
    }
    const view = current.overlay.ownerDocument.defaultView ?? window;
    if (siblings.length) {
      view.requestAnimationFrame(() => {
        for (const element of siblings) if (element.isConnected) reportDrop(element, resting.get(element)!, element.getBoundingClientRect());
      });
    }
    const committed = options.onMovement ? current.committed : undefined;
    if (committed) {
      view.requestAnimationFrame(() => {
        const scrolledX = view.scrollX - committed.scrollX, scrolledY = view.scrollY - committed.scrollY;
        for (const [element, box] of committed.boxes) {
          if (!element.isConnected) continue;
          const now = restingBox(element, current.shifts);
          reportDrop(element, box, { ...now, left: now.left + scrolledX, top: now.top + scrolledY });
        }
      });
    }
    if (result.combine && current.combine) announce(messages.combined(current.item.label(), current.combine.slot.item.label()));
    else if (at) announce(result.reason === 'DROP' && result.destination ? messages.dropped(at) : messages.returned(at));
    if (current.mode === 'SNAP') {
      for (const registration of items.values()) {
        if (registration.id === current.item.id && registration.element.isConnected) {
          registration.handle.focus({ preventScroll: true });
          break;
        }
      }
    }
  }

  function siblingsOf(current: Session): HTMLElement[] {
    return [...new Set(current.containers.flatMap((snapshot) => snapshot.slots.map((slot) => slot.item.element)))].filter((element) => element.isConnected);
  }

  function restingBoxes(current: Session, elements: HTMLElement[]): Map<HTMLElement, Box> {
    return new Map(elements.map((element) => [element, restingBox(element, current.shifts)]));
  }

  function reportDrop(element: HTMLElement, resting: Box, next: Box): void {
    const x = next.left - resting.left, y = next.top - resting.top;
    if (Math.abs(x) > 1 || Math.abs(y) > 1) options.onMovement?.({ element, phase: 'drop', x, y });
  }

  function cleanup(current: Session): void {
    const element = current.item.element;
    const view = current.overlay.ownerDocument.defaultView ?? window;
    for (const [shifted, saved] of current.shifts) {
      shifted.style.transition = 'none';
      shifted.style.translate = saved.translate;
      shifted.style.removeProperty('--drag-shift');
    }
    const restored = [...current.shifts];
    view.requestAnimationFrame(() => {
      view.requestAnimationFrame(() => {
        for (const [shifted, saved] of restored) shifted.style.transition = saved.transition;
      });
    });
    if (current.landing) current.landing.element.style.visibility = current.landing.visibility;
    element.style.visibility = current.sourceVisibility;
    element.removeAttribute('data-drag-source');
    current.combine?.slot.item.element.removeAttribute('data-drag-combine');
    current.reserved?.registration.element.style.removeProperty('--drag-reserve');
    for (const snapshot of current.containers) snapshot.registration.element.removeAttribute('data-drag-over');
    current.overlay.remove();
    element.ownerDocument.documentElement.removeAttribute('data-drag-active');
    element.ownerDocument.documentElement.removeAttribute('data-drag-outside');
    session = null;
    removeWindowListeners();
  }

  function closestContainer(registration: ItemRegistration): ContainerRegistration | null {
    let element = registration.element.parentElement;
    while (element) {
      const candidate = containers.get(element);
      if (candidate && candidate.type === registration.type) return candidate;
      element = element.parentElement;
    }
    return null;
  }

  function itemsOf(registration: ContainerRegistration): ItemRegistration[] {
    const members: ItemRegistration[] = [];
    for (const candidate of items.values()) {
      if (candidate.type !== registration.type || !candidate.element.isConnected) continue;
      if (closestContainer(candidate) === registration) members.push(candidate);
    }
    return members.sort((a, b) =>
      a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
  }

  function startOf(current: Session): SortableStart {
    return {
      draggableId: current.item.id,
      type: current.item.type,
      source: { droppableId: current.home.registration.id, index: current.sourceIndex },
      mode: current.mode,
    };
  }

  function updateOf(current: Session): SortableUpdate {
    return {
      ...startOf(current),
      destination: current.destination && !current.combine ? locationOf(current.destination) : null,
      combine: combineOf(current),
    };
  }

  function combineOf(current: Session): SortableCombine | null {
    return current.combine
      ? { draggableId: current.combine.slot.item.id, droppableId: current.combine.container.registration.id }
      : null;
  }

  function registrationFor(lifted: ItemRegistration): ItemRegistration | null {
    if (lifted.element.isConnected && items.get(lifted.element) === lifted) return lifted;
    for (const candidate of items.values()) {
      if (candidate.id === lifted.id && candidate.type === lifted.type && candidate.element.isConnected) return candidate;
    }
    return null;
  }

  function locationOf(destination: NonNullable<Session['destination']>): SortableLocation {
    return { droppableId: destination.container.registration.id, index: destination.index };
  }

  return {
    container,
    item,
    isDragging: () => session !== null,
    cancel: () => {
      clearPending();
      if (session && !session.dropping) void drop('CANCEL');
    },
    destroy: () => {
      destroyed = true;
      clearPending();
      forgetRelease?.();
      if (session && !session.preparing) cleanup(session);
      for (const { view, instructions, liveRegion } of documents.values()) {
        view.removeEventListener('pointerdown', onPointerDown, true);
        view.removeEventListener('keydown', onHandleKeyDown, true);
        instructions.remove(); liveRegion.remove();
      }
      documents.clear();
      containers.clear();
      items.clear();
      handles.clear();
    },
  };
}

function reportFailure(view: Window, error: unknown): void {
  const report = (view as Window & { reportError?: (error: unknown) => void }).reportError;
  if (typeof report === 'function') report.call(view, error);
  else setTimeout(() => { throw error; });
}

function promiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return !!value && typeof (value as Promise<T>).then === 'function';
}

function eventElement(target: EventTarget | null): Element | null {
  return target && (target as Node).nodeType === 1 ? target as Element : null;
}

let instanceCount = 0;

const arrows = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
} as const;

function centreOf(box: Box): { x: number; y: number } {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function hiddenText(document: Document, id: string): HTMLElement {
  const element = document.createElement('div');
  element.id = id;
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

function labelOf(element: HTMLElement, handle: HTMLElement): string {
  const named = element.getAttribute('aria-label') ?? handle.getAttribute('aria-label');
  const text = named ?? element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return text.length > 60 ? `${text.slice(0, 59)}…` : text || 'Item';
}

function scaleOf(element: HTMLElement, box: Box): number {
  if (element.offsetWidth <= 0 || box.width <= 0) return 1;
  const scale = box.width / element.offsetWidth;
  return Math.abs(scale - 1) < 0.02 ? 1 : scale;
}

function previewTransform(x: number, y: number, scale: number): string {
  return `translate3d(${x}px, ${y}px, 0)${scale === 1 ? '' : ` scale(${scale})`}`;
}

function measure(element: HTMLElement): Box {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function intersect(a: Box, b: Box): Box {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function contains(box: Box, x: number, y: number): boolean {
  return x >= box.left && x < box.left + box.width && y >= box.top && y < box.top + box.height;
}

function flowOf(style: CSSStyleDeclaration, box: Box, scale: number, vertical: boolean, items: FlowItem[], source: FlowItem): ContainerSnapshot['flow'] {
  const collapse = vertical && /^(block|flow-root|list-item)$/.test(style.display);
  const gap = collapse ? 0 : parsePixels(vertical ? style.rowGap : style.columnGap) * scale;
  const origin = (vertical ? box.top : box.left)
    + (parsePixels(vertical ? style.borderTopWidth : style.borderLeftWidth) + parsePixels(vertical ? style.paddingTop : style.paddingLeft)) * scale;
  const first = items[0];
  const through = collapse && !!first && first.marginStart > 0.5 && Math.abs(first.start - origin) <= 1;
  const flow = { gap, collapse, through };
  return flowHolds(items, flow, origin) ? { items, source, flow, origin } : null;
}

function restingBox(element: HTMLElement, shifts: Map<HTMLElement, { scale: number }>): Box {
  const box = measure(element);
  const view = element.ownerDocument.defaultView ?? window;
  const pair = (value: string) => {
    if (!value || value === 'none') return { x: 0, y: 0 };
    const [x = '0', y = '0'] = value.trim().split(/\s+/);
    return { x: parsePixels(x), y: parsePixels(y) };
  };
  let left = box.left, top = box.top;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const set = node.style.translate, drawn = view.getComputedStyle(node).translate;
    if (set === drawn || (!set && drawn === 'none')) continue;
    const target = pair(set), now = pair(drawn), scale = shifts.get(node)?.scale ?? 1;
    left += (target.x - now.x) * scale;
    top += (target.y - now.y) * scale;
  }
  return { ...box, left, top };
}

function parsePixels(value: string): number {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function parseTranslate(transform: string): { x: number; y: number } {
  const match = /translate3d\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(transform);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 };
}

function scrollParents(element: HTMLElement): HTMLElement[] {
  const parents: HTMLElement[] = [];
  const view = element.ownerDocument.defaultView;
  let parent = element.parentElement;
  while (parent && parent !== element.ownerDocument.body && parent !== element.ownerDocument.documentElement) {
    const style = view?.getComputedStyle(parent);
    const scrolls = (value: string | undefined) => value === 'auto' || value === 'scroll' || value === 'overlay';
    if (style && (scrolls(style.overflowY) || scrolls(style.overflowX))) parents.push(parent);
    parent = parent.parentElement;
  }
  return parents;
}

function paintsNoBackground(style: CSSStyleDeclaration): boolean {
  return (!style.backgroundImage || style.backgroundImage === 'none') && /^(transparent|rgba\([^)]*,\s*0\)|)$/.test(style.backgroundColor.trim());
}

function standOnBackground(preview: HTMLElement, source: HTMLElement): void {
  const view = source.ownerDocument.defaultView;
  if (!view || !paintsNoBackground(view.getComputedStyle(source))) return;
  for (let node: Element | null = source.parentElement; node; node = node.parentElement ?? ((node.getRootNode() as ShadowRoot).host ?? null)) {
    const style = view.getComputedStyle(node);
    if (style.backgroundColor && !paintsNoBackground(style)) {
      preview.style.setProperty('background-color', style.backgroundColor, 'important');
      return;
    }
  }
}

const unstyled = /^(style|script|template|link|meta|title|head)$/;

function cloneForPreview(source: HTMLElement): { clone: HTMLElement; scrolled: Array<[Element, number, number]> } {
  const clone = source.cloneNode(true) as HTMLElement;
  const view = source.ownerDocument.defaultView!;
  const scrolled: Array<[Element, number, number]> = [];
  const sourceStyle = view.getComputedStyle(source);
  const listed = Array.from(sourceStyle).filter((property) => !property.startsWith('--'));
  const standard = listed.length > 100 ? listed : null;
  const inherited = new Map<string, string>();
  const paint = (from: HTMLCanvasElement, to: HTMLCanvasElement) => {
    try { to.getContext('2d')?.drawImage(from, 0, 0); } catch {}
  };
  const drawsPseudo = (element: Element, pseudo: string) => {
    const content = view.getComputedStyle(element, pseudo).content;
    return !!content && content !== 'none' && content !== 'normal';
  };
  const copy = (element: Element, target: Element, drawn = false): void => {
    const styled = target as HTMLElement | SVGElement;
    if (drawn) {
      if (element.scrollLeft || element.scrollTop) scrolled.push([target, element.scrollLeft, element.scrollTop]);
      if (element.localName === 'canvas') paint(element as HTMLCanvasElement, target as HTMLCanvasElement);
    } else if (styled.style && !unstyled.test(element.localName)) {
      const properties = (element.constructor as { elementProperties?: unknown }).elementProperties;
      if (properties instanceof Map) {
        for (const name of properties.keys() as Iterable<PropertyKey>) {
          (target as unknown as Record<PropertyKey, unknown>)[name] = (element as unknown as Record<PropertyKey, unknown>)[name];
        }
      }
      const style = view.getComputedStyle(element);
      if (element !== source && style.display === 'none') {
        styled.style.setProperty('display', 'none', 'important');
        return;
      }
      if (!standard || element === source) {
        for (const property of Array.from(style)) {
          const value = style.getPropertyValue(property);
          if (property.startsWith('--')) inherited.set(property, value);
          styled.style.setProperty(property, value, 'important');
        }
      } else {
        for (const property of standard) styled.style.setProperty(property, style.getPropertyValue(property), 'important');
        if (element.localName.includes('-') || !!element.shadowRoot || drawsPseudo(element, '::before') || drawsPseudo(element, '::after')) {
          for (let index = 0; index < style.length; index++) {
            const property = style[index];
            if (!property.startsWith('--')) continue;
            const value = style.getPropertyValue(property);
            if (inherited.get(property) !== value) styled.style.setProperty(property, value, 'important');
          }
        }
      }
      styled.style.setProperty('pointer-events', 'none', 'important');
      target.removeAttribute('contenteditable');
      if (element.scrollLeft || element.scrollTop) scrolled.push([target, element.scrollLeft, element.scrollTop]);
      if (element.localName === 'canvas') paint(element as HTMLCanvasElement, target as HTMLCanvasElement);
    }
    const shadow = element.shadowRoot;
    if (shadow && !target.shadowRoot && !view.customElements?.get(element.localName)) {
      try {
        const root = target.attachShadow({ mode: 'open' });
        for (const child of Array.from(shadow.childNodes)) root.appendChild(child.cloneNode(true));
        if (shadow.adoptedStyleSheets?.length) root.adoptedStyleSheets = [...shadow.adoptedStyleSheets];
        pairs(shadow, root, true);
      } catch {}
    }
    pairs(element, target, drawn);
  };
  const pairs = (from: ParentNode, to: ParentNode, drawn: boolean): void => {
    const originals = from.children, copies = to.children;
    for (let index = 0; index < originals.length && index < copies.length; index++) copy(originals[index], copies[index], drawn);
  };
  copy(source, clone);
  for (const property of ['inset', 'inset-block', 'inset-inline', 'inset-block-start', 'inset-block-end', 'inset-inline-start', 'inset-inline-end', 'top', 'right', 'bottom', 'left', 'margin-block', 'margin-inline', 'margin-block-start', 'margin-block-end', 'margin-inline-start', 'margin-inline-end']) clone.style.removeProperty(property);
  clone.removeAttribute('id');
  clone.removeAttribute('data-drag-source');
  clone.style.visibility = 'visible';
  for (const element of clone.querySelectorAll('[id]')) element.removeAttribute('id');
  for (const element of clone.querySelectorAll('[data-drag-handle]')) element.removeAttribute('data-drag-handle');
  clone.removeAttribute('data-drag-handle');
  return { clone, scrolled };
}
