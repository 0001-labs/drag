export class TestDataTransfer {
  dropEffect = 'none';
  effectAllowed = 'all';
  readonly data = new Map<string, string>();

  setData(type: string, value: string): void {
    this.data.set(type, value);
  }

  getData(type: string): string {
    return this.data.get(type) ?? '';
  }

  clearData(type?: string): void {
    if (type) {
      this.data.delete(type);
      return;
    }

    this.data.clear();
  }

  setDragImage(): void {
    return;
  }
}

export function dragEvent(
  type: string,
  target: HTMLElement,
  options: {
    clientX?: number;
    clientY?: number;
    dataTransfer?: TestDataTransfer;
  } = {},
): DragEvent {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as DragEvent;
  const dataTransfer = options.dataTransfer ?? new TestDataTransfer();

  Object.defineProperties(event, {
    clientX: { value: options.clientX ?? 0 },
    clientY: { value: options.clientY ?? 0 },
    pageX: { value: options.clientX ?? 0 },
    pageY: { value: options.clientY ?? 0 },
    button: { value: 0 },
    buttons: { value: 1 },
    altKey: { value: false },
    ctrlKey: { value: false },
    metaKey: { value: false },
    shiftKey: { value: false },
    dataTransfer: { value: dataTransfer },
    view: { value: window },
  });

  target.dispatchEvent(event);
  return event;
}
