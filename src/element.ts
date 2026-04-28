import { getElementFromPoint, getInput, writeNativeData } from './platform';
import type {
  Cleanup,
  DragData,
  DragKind,
  DragLifecycle,
  DragLocation,
  DragLocationHistory,
  DraggableArgs,
  DropEffect,
  DropTargetArgs,
  DropTargetRecord,
  ElementDragEventPayload,
  ElementDragSource,
  MonitorArgs,
} from './types';
import { once } from './util';

type DraggableRegistration = Required<Pick<DraggableArgs, 'element'>> &
  DragLifecycle & {
    dragHandle: HTMLElement | null;
    canDrag: NonNullable<DraggableArgs['canDrag']>;
    getData: NonNullable<DraggableArgs['getData']>;
    getNativeData: NonNullable<DraggableArgs['getNativeData']>;
  };

type DropTargetRegistration = Required<Pick<DropTargetArgs, 'element'>> &
  DragLifecycle & {
    canDrop: NonNullable<DropTargetArgs['canDrop']>;
    getData: NonNullable<DropTargetArgs['getData']>;
    getDropEffect: NonNullable<DropTargetArgs['getDropEffect']>;
    getIsSticky: NonNullable<DropTargetArgs['getIsSticky']>;
  };

type MonitorRegistration = MonitorArgs & {
  id: number;
  canMonitor: NonNullable<MonitorArgs['canMonitor']>;
};

type DragSession = {
  id: string;
  kind: DragKind;
  source: ElementDragSource;
  sourceRegistration: DraggableRegistration;
  activeMonitors: MonitorRegistration[];
  location: DragLocationHistory;
  nativeEvent: DragEvent;
  pendingDragPayload: ElementDragEventPayload | null;
  dragFrame:
    | { type: 'animation'; id: number; view: Window }
    | { type: 'timeout'; id: ReturnType<typeof globalThis.setTimeout> }
    | null;
  finished: boolean;
};

const draggables = new Map<HTMLElement, DraggableRegistration>();
const dropTargets = new Map<HTMLElement, DropTargetRegistration>();
const monitors: MonitorRegistration[] = [];

let currentSession: DragSession | null = null;
let monitorId = 0;
let sessionId = 0;
let activeDispatchDepth = 0;
let globalCleanup: Cleanup | null = null;

const defaultData = (): DragData => ({});

const defaultNativeData = (): Record<string, string> => ({});

const defaultCanDrag = (): boolean => true;

const defaultCanDrop = (): boolean => true;

const defaultDropEffect = (): DropEffect => 'move';

const defaultIsSticky = (): boolean => false;

export function draggable(args: DraggableArgs): Cleanup {
  if (draggables.has(args.element)) {
    throw new Error('A draggable is already registered for this element.');
  }

  const dragHandle = args.dragHandle ?? null;
  const dragElement = dragHandle ?? args.element;
  const previousDraggable = dragElement.draggable;
  const registration: DraggableRegistration = {
    ...args,
    dragHandle,
    canDrag: args.canDrag ?? defaultCanDrag,
    getData: args.getData ?? defaultData,
    getNativeData: args.getNativeData ?? defaultNativeData,
  };

  draggables.set(args.element, registration);
  dragElement.draggable = true;
  dragElement.addEventListener('dragstart', onDragStart);
  dragElement.addEventListener('dragend', onDragEnd);

  return once(() => {
    draggables.delete(args.element);
    dragElement.removeEventListener('dragstart', onDragStart);
    dragElement.removeEventListener('dragend', onDragEnd);
    dragElement.draggable = previousDraggable;
  });
}

export function dropTargetForElements(args: DropTargetArgs): Cleanup {
  if (dropTargets.has(args.element)) {
    throw new Error('A drop target is already registered for this element.');
  }

  const registration: DropTargetRegistration = {
    ...args,
    canDrop: args.canDrop ?? defaultCanDrop,
    getData: args.getData ?? defaultData,
    getDropEffect: args.getDropEffect ?? defaultDropEffect,
    getIsSticky: args.getIsSticky ?? defaultIsSticky,
  };

  dropTargets.set(args.element, registration);
  args.element.addEventListener('dragover', onDragOver);
  args.element.addEventListener('drop', onDrop);

  return once(() => {
    dropTargets.delete(args.element);
    args.element.removeEventListener('dragover', onDragOver);
    args.element.removeEventListener('drop', onDrop);
  });
}

export function monitorForElements(args: MonitorArgs): Cleanup {
  const registration: MonitorRegistration = {
    ...args,
    id: monitorId++,
    canMonitor: args.canMonitor ?? defaultCanDrop,
  };

  monitors.push(registration);

  if (currentSession) {
    const payload = createPayload(
      currentSession,
      currentSession.location.current,
      currentSession.location.previous,
      currentSession.location.initial,
      currentSession.nativeEvent,
    );
    if (registration.canMonitor(payload)) {
      currentSession.activeMonitors.push(registration);
    }
  }

  return once(() => {
    const index = monitors.indexOf(registration);
    if (index >= 0) {
      monitors.splice(index, 1);
    }

    if (currentSession) {
      currentSession.activeMonitors = currentSession.activeMonitors.filter(
        (monitor) => monitor !== registration,
      );
    }
  });
}

function onDragStart(event: DragEvent): void {
  const registration = findDraggable(event.currentTarget);

  if (!registration) {
    return;
  }

  const input = getInput(event);
  const feedbackArgs = { input, nativeEvent: event };

  if (!registration.canDrag(feedbackArgs)) {
    event.preventDefault();
    return;
  }

  const source: ElementDragSource = {
    element: registration.element,
    dragHandle: registration.dragHandle,
    data: registration.getData(feedbackArgs),
  };
  const initialLocation = createEmptyLocation(input);
  const session: DragSession = {
    id: `drag-${++sessionId}`,
    kind: 'element',
    source,
    sourceRegistration: registration,
    activeMonitors: [],
    location: {
      initial: initialLocation,
      current: initialLocation,
      previous: { dropTargets: [] },
    },
    nativeEvent: event,
    pendingDragPayload: null,
    dragFrame: null,
    finished: false,
  };

  currentSession = session;
  installGlobalListeners(registration.element.ownerDocument);

  writeNativeData(event.dataTransfer, registration.getNativeData(feedbackArgs));

  const current = resolveLocation(session, event);
  session.location = {
    initial: current,
    current,
    previous: { dropTargets: [] },
  };

  const startPayload = createPayload(
    session,
    current,
    { dropTargets: [] },
    current,
    event,
  );

  session.activeMonitors = monitors.filter((monitor) => monitor.canMonitor(startPayload));

  dispatchNormal('onGenerateDragPreview', startPayload);
  dispatchNormal('onDragStart', startPayload);
}

function onDragOver(event: DragEvent): void {
  const session = currentSession;

  if (!session || session.finished) {
    return;
  }

  event.preventDefault();
  updateLocation(session, event);

  const innermost = session.location.current.dropTargets.at(0);

  if (event.dataTransfer && innermost) {
    event.dataTransfer.dropEffect = innermost.dropEffect;
  }

  scheduleDrag(session, event);
}

function onDrop(event: DragEvent): void {
  const session = currentSession;

  if (!session || session.finished) {
    return;
  }

  event.preventDefault();
  updateLocation(session, event);
  finishSession(session, event);
}

function onDragEnd(event: DragEvent): void {
  const session = currentSession;

  if (!session || session.finished) {
    return;
  }

  finishSession(session, event);
}

function findDraggable(currentTarget: EventTarget | null): DraggableRegistration | null {
  if (!(currentTarget instanceof HTMLElement)) {
    return null;
  }

  for (const registration of draggables.values()) {
    if (registration.element === currentTarget || registration.dragHandle === currentTarget) {
      return registration;
    }
  }

  return null;
}

function createEmptyLocation(input: ReturnType<typeof getInput>): DragLocation {
  return {
    input,
    dropTargets: [],
  };
}

function updateLocation(session: DragSession, event: DragEvent): void {
  session.nativeEvent = event;
  const previous = session.location.current;
  const current = resolveLocation(session, event);

  if (sameDropTargets(previous.dropTargets, current.dropTargets)) {
    session.location = {
      ...session.location,
      current,
      previous: { dropTargets: previous.dropTargets },
    };
    return;
  }

  session.location = {
    ...session.location,
    current,
    previous: { dropTargets: previous.dropTargets },
  };

  const payload = createPayload(
    session,
    current,
    { dropTargets: previous.dropTargets },
    session.location.initial,
    event,
  );

  dispatchDropTargetChange(payload, previous.dropTargets, current.dropTargets);
}

function resolveLocation(session: DragSession, event: DragEvent): DragLocation {
  const input = getInput(event);
  const ownerDocument = session.source.element.ownerDocument;
  const start = getElementFromPoint(ownerDocument, input, event.target);
  const records: DropTargetRecord[] = [];
  let element: Element | null = start;

  while (element) {
    if (element instanceof HTMLElement) {
      const target = dropTargets.get(element);

      if (target) {
        const preliminary = createPayload(
          session,
          { input, dropTargets: records },
          { dropTargets: session.location.current.dropTargets },
          session.location.initial,
          event,
        );

        if (target.canDrop(preliminary)) {
          const targetPayload = createPayload(
            session,
            { input, dropTargets: records },
            { dropTargets: session.location.current.dropTargets },
            session.location.initial,
            event,
          );

          records.push({
            element,
            kind: 'element',
            data: target.getData(targetPayload),
            dropEffect: target.getDropEffect(targetPayload),
          });
        }
      }
    }

    element = element.parentElement;
  }

  return { input, dropTargets: records };
}

function createPayload(
  session: DragSession,
  current: DragLocation,
  previous: Pick<DragLocation, 'dropTargets'>,
  initial: DragLocation,
  nativeEvent: DragEvent,
): ElementDragEventPayload {
  const nativeSetDragImage =
    nativeEvent.dataTransfer?.setDragImage.bind(nativeEvent.dataTransfer) ?? null;

  return {
    sessionId: session.id,
    kind: session.kind,
    source: session.source,
    location: {
      initial,
      current,
      previous,
    },
    nativeEvent,
    nativeSetDragImage,
  };
}

function dispatchNormal(
  eventName: keyof DragLifecycle,
  payload: ElementDragEventPayload,
): void {
  dispatch(() => {
    currentSession?.sourceRegistration[eventName]?.(payload);
    payload.location.current.dropTargets.forEach((record) => {
      const target = dropTargets.get(record.element);
      target?.[eventName]?.(payload);
    });
    for (const monitor of payloadMonitorList()) {
      monitor[eventName]?.(payload);
    }
  });
}

function dispatchDropTargetChange(
  payload: ElementDragEventPayload,
  previous: DropTargetRecord[],
  current: DropTargetRecord[],
): void {
  dispatch(() => {
    currentSession?.sourceRegistration.onDropTargetChange?.(payload);

    for (const record of previous) {
      const target = dropTargets.get(record.element);
      target?.onDropTargetChange?.(payload);

      if (!current.some((item) => item.element === record.element)) {
        target?.onDragLeave?.(payload);
      }
    }

    for (const record of current) {
      const target = dropTargets.get(record.element);
      target?.onDropTargetChange?.(payload);

      if (!previous.some((item) => item.element === record.element)) {
        target?.onDragEnter?.(payload);
      }
    }

    for (const monitor of payloadMonitorList()) {
      monitor.onDropTargetChange?.(payload);
    }
  });
}

function payloadMonitorList(): MonitorRegistration[] {
  return currentSession?.activeMonitors ?? [];
}

function dispatch(fn: () => void): void {
  activeDispatchDepth++;

  try {
    fn();
  } finally {
    activeDispatchDepth--;
  }
}

function scheduleDrag(session: DragSession, event: DragEvent): void {
  const payload = createPayload(
    session,
    session.location.current,
    session.location.previous,
    session.location.initial,
    event,
  );

  session.pendingDragPayload = payload;

  if (session.dragFrame !== null) {
    return;
  }

  const view = event.view;

  if (view) {
    session.dragFrame = {
      type: 'animation',
      id: view.requestAnimationFrame(() => {
        flushScheduledDrag(session);
      }),
      view,
    };
    return;
  }

  session.dragFrame = {
    type: 'timeout',
    id: globalThis.setTimeout(() => {
      flushScheduledDrag(session);
    }, 16),
  };
}

function flushScheduledDrag(session: DragSession): void {
    session.dragFrame = null;
    const pending = session.pendingDragPayload;
    session.pendingDragPayload = null;

    if (pending && !session.finished) {
      dispatchNormal('onDrag', pending);
    }
}

function finishSession(session: DragSession, event: DragEvent): void {
  session.finished = true;

  if (session.dragFrame !== null) {
    if (session.dragFrame.type === 'animation') {
      session.dragFrame.view.cancelAnimationFrame(session.dragFrame.id);
    } else {
      globalThis.clearTimeout(session.dragFrame.id);
    }
    session.dragFrame = null;
  }

  const payload = createPayload(
    session,
    session.location.current,
    session.location.previous,
    session.location.initial,
    event,
  );

  dispatchNormal('onDrop', payload);
  currentSession = null;
  uninstallGlobalListeners();
}

function sameDropTargets(a: DropTargetRecord[], b: DropTargetRecord[]): boolean {
  return a.length === b.length && a.every((record, index) => record.element === b[index]?.element);
}

function installGlobalListeners(document: Document): void {
  if (globalCleanup) {
    return;
  }

  const window = document.defaultView;

  document.addEventListener('dragover', onDragOver, true);
  document.addEventListener('drop', onDrop, true);
  document.addEventListener('pointermove', recoverBrokenDrag, true);
  document.addEventListener('mousemove', recoverBrokenDrag, true);
  window?.addEventListener('blur', recoverBrokenDrag);

  globalCleanup = once(() => {
    document.removeEventListener('dragover', onDragOver, true);
    document.removeEventListener('drop', onDrop, true);
    document.removeEventListener('pointermove', recoverBrokenDrag, true);
    document.removeEventListener('mousemove', recoverBrokenDrag, true);
    window?.removeEventListener('blur', recoverBrokenDrag);
  });
}

function uninstallGlobalListeners(): void {
  globalCleanup?.();
  globalCleanup = null;
}

function recoverBrokenDrag(event: Event): void {
  const session = currentSession;

  if (!session || session.finished || activeDispatchDepth > 0) {
    return;
  }

  if (session.source.element.isConnected) {
    return;
  }

  if (event instanceof DragEvent) {
    finishSession(session, event);
    return;
  }

  const fallbackEvent = new DragEvent('dragend', {
    bubbles: true,
    cancelable: true,
  });
  finishSession(session, fallbackEvent);
}
