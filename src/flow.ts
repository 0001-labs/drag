export type FlowItem = { start: number; size: number; marginStart: number; marginEnd: number };

export type Flow = {
  gap: number;
  collapse: boolean;
  through: boolean;
};

export function collapsed(a: number, b: number): number {
  return Math.max(a, b, 0) + Math.min(a, b, 0);
}

export function flowStarts(items: readonly FlowItem[], flow: Flow, origin: number): number[] {
  const starts: number[] = [];
  let edge = origin;
  items.forEach((item, index) => {
    const previous = items[index - 1];
    const space = !previous
      ? flow.collapse && flow.through ? 0 : item.marginStart
      : flow.collapse ? collapsed(previous.marginEnd, item.marginStart) : previous.marginEnd + flow.gap + item.marginStart;
    starts.push(edge + space);
    edge += space + item.size;
  });
  return starts;
}

export function flowHolds(items: readonly FlowItem[], flow: Flow, origin: number): boolean {
  const starts = flowStarts(items, flow, origin);
  return items.every((item, index) => Math.abs(starts[index] - item.start) <= 1);
}
