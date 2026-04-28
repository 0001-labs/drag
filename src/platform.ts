import type { DragInput, NativeDragData } from './types';

export function getInput(event: DragEvent): DragInput {
  return {
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    button: event.button,
    buttons: event.buttons,
    clientX: event.clientX,
    clientY: event.clientY,
    pageX: event.pageX,
    pageY: event.pageY,
  };
}

export function writeNativeData(
  dataTransfer: DataTransfer | null,
  nativeData: NativeDragData,
): void {
  if (!dataTransfer) {
    return;
  }

  let wroteData = false;

  for (const [type, value] of Object.entries(nativeData)) {
    try {
      dataTransfer.setData(type, value);
      wroteData = true;
    } catch {
      // Browsers can reject unsupported media types. Keep local drag state alive.
    }
  }

  try {
    dataTransfer.setData('application/x-0001-drag', 'element');
    wroteData = true;
  } catch {
    // Best-effort marker only.
  }

  if (!wroteData) {
    try {
      dataTransfer.setData('text/plain', '');
    } catch {
      // Some test doubles and browsers can reject this too.
    }
  }
}

export function getElementFromPoint(
  document: Document,
  input: DragInput,
  fallback: EventTarget | null,
): Element | null {
  const fromPoint =
    typeof document.elementFromPoint === 'function'
      ? document.elementFromPoint(input.clientX, input.clientY)
      : null;

  if (fromPoint) {
    return fromPoint;
  }

  return fallback instanceof Element ? fallback : null;
}
