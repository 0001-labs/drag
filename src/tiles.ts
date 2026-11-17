import { createGrid, type GridOptions } from './grid';
import { reorder } from './util';

export type TilesMode = 'push' | 'swap';

export type TilesChange = {
  tile: HTMLElement;
  from: number;
  to: number;
  mode: TilesMode;
  swapped: HTMLElement | null;
  order: HTMLElement[];
};

export type TilesCarry = {
  tile: HTMLElement;
  mode: TilesMode;
  original: readonly HTMLElement[];
};

export type TilesPlace = {
  tile: HTMLElement;
  over: HTMLElement;
  order: readonly HTMLElement[];
  original: readonly HTMLElement[];
  at: { x: number; y: number };
};

export type TilesArgs = {
  surface: HTMLElement;
  tiles: () => HTMLElement[];
  arrange: (order: HTMLElement[], carry: TilesCarry) => void;
  place?: (place: TilesPlace) => HTMLElement[] | undefined | void;
  canCarry?: (tile: HTMLElement, event: PointerEvent) => boolean;
  mode?: (keys: { shiftKey: boolean }) => TilesMode;
  onStart?: (tile: HTMLElement) => void;
  onDrop?: (change: TilesChange) => void;
  onCancel?: (tile: HTMLElement) => void;
};

export type TilesOptions = GridOptions & {
  duration?: number;
  easing?: string;
  changeDistance?: number;
};

export type TilesController = {
  isCarrying: () => boolean;
  cancel: () => void;
  destroy: () => void;
};

type Box = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

type Carry = {
  tile: HTMLElement;
  original: HTMLElement[];
  order: HTMLElement[];
  boxes: Map<HTMLElement, Box>;
  grab: Point;
  mode: TilesMode;
  placed: boolean;
  hold: Box | null;
  changedAt: Point | null;
  slides: Map<HTMLElement, Animation>;
  scrollFrame: number | null;
  zIndex: string;
  willChange: string;
};

const controls = 'button, a[href], input, select, textarea, summary, [contenteditable=""], [contenteditable="true"], [role="button"], [data-drag-ignore]';
const edge = 40;
const maxScrollSpeed = 20;

export function createTiles(args: TilesArgs, options: TilesOptions = {}): TilesController {
  const { surface } = args;
  const easing = options.easing ?? 'cubic-bezier(0.2, 0, 0, 1)';
  const changeDistance = options.changeDistance ?? 8;
  const modeOf = args.mode ?? ((keys: { shiftKey: boolean }) => (keys.shiftKey ? 'swap' : 'push'));
  let client: Point = { x: 0, y: 0 };
  let pressed = false;
  let shiftKey = false;
  let carry: Carry | null = null;

  const grid = createGrid({
    ...options,
    pointerPoint: (event) => {
      client = options.pointerPoint?.(event) ?? { x: event.clientX, y: event.clientY };
      return client;
    },
  });

  const duration = (): number => {
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return still ? 0 : options.duration ?? 200;
  };

  function pointer(): Point {
    const base = surface.getBoundingClientRect();
    return { x: client.x - base.left + surface.scrollLeft, y: client.y - base.top + surface.scrollTop };
  }

  function boxOf(tile: HTMLElement, base: DOMRect): Box {
    const rect = tile.getBoundingClientRect();
    return { x: rect.left - base.left + surface.scrollLeft, y: rect.top - base.top + surface.scrollTop, width: rect.width, height: rect.height };
  }

  function follow(current: Carry): void {
    const box = current.boxes.get(current.tile);
    if (!box) return;
    const at = pointer();
    current.tile.style.translate = `${at.x - current.grab.x * box.width - box.x}px ${at.y - current.grab.y * box.height - box.y}px`;
  }

  function draw(current: Carry, next: HTMLElement[], carried: boolean): void {
    const base = surface.getBoundingClientRect();
    const seen = new Map<HTMLElement, Box>();
    for (const tile of current.order) if (tile !== current.tile) seen.set(tile, boxOf(tile, base));
    for (const slide of current.slides.values()) slide.cancel();
    current.slides.clear();
    const held = current.tile.style.translate;
    current.tile.style.translate = 'none';
    current.order = next;
    args.arrange(next, { tile: current.tile, mode: current.mode, original: current.original });
    const now = surface.getBoundingClientRect();
    current.boxes = new Map(next.map((tile) => [tile, boxOf(tile, now)]));
    const time = duration();
    for (const tile of next) {
      const from = seen.get(tile), to = current.boxes.get(tile);
      if (!from || !to || !to.width || !to.height) continue;
      const x = from.x - to.x, y = from.y - to.y, wide = from.width / to.width, tall = from.height / to.height;
      if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5 && Math.abs(wide - 1) < 0.005 && Math.abs(tall - 1) < 0.005) continue;
      slide(current, tile, `translate(${x}px, ${y}px) scale(${wide}, ${tall})`, time);
    }
    if (carried) follow(current);
    else current.tile.style.translate = held;
  }

  function slide(current: Carry, tile: HTMLElement, from: string, time: number): void {
    if (!time || typeof tile.animate !== 'function') return;
    const animation = tile.animate([{ transformOrigin: '0 0', transform: from }, { transformOrigin: '0 0', transform: 'none' }], { duration: time, easing });
    current.slides.set(tile, animation);
    const done = () => { if (current.slides.get(tile) === animation) current.slides.delete(tile); };
    animation.addEventListener('finish', done);
    animation.addEventListener('cancel', done);
  }

  function seek(current: Carry): void {
    const at = pointer();
    const inside = (box: Box | null | undefined) => !!box && at.x >= box.x && at.x < box.x + box.width && at.y >= box.y && at.y < box.y + box.height;
    if (inside(current.hold)) return;
    current.hold = null;
    const over = current.order.find((tile) => tile !== current.tile && inside(current.boxes.get(tile))) ?? null;
    if (!over) return;
    if (current.changedAt && Math.hypot(at.x - current.changedAt.x, at.y - current.changedAt.y) < changeDistance) return;
    const mode = modeOf({ shiftKey });
    current.mode = mode;
    let next: HTMLElement[];
    if (mode === 'swap') {
      const home = current.original.indexOf(current.tile);
      next = [...current.original];
      if (current.order.indexOf(over) !== home || current.original[home] === over) {
        next[current.original.indexOf(over)] = current.tile;
        next[home] = over;
      }
    } else {
      const box = current.boxes.get(over);
      const share = box ? { x: (at.x - box.x) / box.width, y: (at.y - box.y) / box.height } : { x: 0.5, y: 0.5 };
      const placed = args.place?.({ tile: current.tile, over, order: current.order, original: current.original, at: share });
      current.placed = !!placed;
      next = placed ?? reorder({ list: current.order, startIndex: current.order.indexOf(current.tile), finishIndex: current.order.indexOf(over) });
    }
    if (mode === 'swap') current.placed = false;
    current.changedAt = at;
    current.hold = current.boxes.get(over) ?? null;
    if (current.placed || !same(next, current.order)) draw(current, next, true);
  }

  function remode(current: Carry): void {
    current.hold = null;
    current.changedAt = null;
    current.mode = modeOf({ shiftKey });
    if (changed(current)) { current.placed = false; draw(current, [...current.original], true); }
    seek(current);
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key !== 'Shift' || !carry) return;
    const down = event.type === 'keydown';
    if (down === shiftKey) return;
    shiftKey = down;
    remode(carry);
  }

  function scrollerOf(): HTMLElement | null {
    for (let node: Element | null = surface; node; node = node.assignedSlot ?? node.parentElement ?? (node.getRootNode() as ShadowRoot).host ?? null) {
      if (!(node instanceof HTMLElement) || node.scrollHeight <= node.clientHeight) continue;
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') return node;
    }
    return null;
  }

  function scrollSpeed(scroller: HTMLElement | null): number {
    const rect = scroller?.getBoundingClientRect();
    const start = rect ? Math.max(rect.top, 0) : 0, end = rect ? Math.min(rect.bottom, window.innerHeight) : window.innerHeight;
    const above = client.y - start, below = end - client.y;
    if (above < edge) return -maxScrollSpeed * ((edge - Math.max(above, 0)) / edge) ** 2;
    if (below < edge) return maxScrollSpeed * ((edge - Math.max(below, 0)) / edge) ** 2;
    return 0;
  }

  function autoScroll(current: Carry): void {
    if (current.scrollFrame !== null || typeof requestAnimationFrame !== 'function') return;
    const scroller = scrollerOf();
    if (!scrollSpeed(scroller)) return;
    const step = () => {
      current.scrollFrame = null;
      if (carry !== current) return;
      const speed = scrollSpeed(scroller);
      if (!speed) return;
      const before = scroller ? scroller.scrollTop : window.scrollY;
      if (scroller) scroller.scrollBy(0, speed);
      else window.scrollBy(0, speed);
      if ((scroller ? scroller.scrollTop : window.scrollY) === before) return;
      follow(current);
      seek(current);
      current.scrollFrame = requestAnimationFrame(step);
    };
    current.scrollFrame = requestAnimationFrame(step);
  }

  function lift(tile: HTMLElement, held: Point): void {
    const order = args.tiles();
    if (!order.includes(tile)) return;
    const base = surface.getBoundingClientRect();
    const rect = tile.getBoundingClientRect();
    carry = {
      tile,
      original: order,
      order: [...order],
      boxes: new Map(order.map((each) => [each, boxOf(each, base)])),
      grab: { x: rect.width ? (held.x - rect.left) / rect.width : 0.5, y: rect.height ? (held.y - rect.top) / rect.height : 0.5 },
      mode: modeOf({ shiftKey }),
      hold: null,
      placed: false,
      changedAt: null,
      slides: new Map(),
      scrollFrame: null,
      zIndex: tile.style.zIndex,
      willChange: tile.style.willChange,
    };
    tile.style.zIndex = '1';
    tile.style.willChange = 'translate';
    tile.setAttribute('data-drag-carried', '');
    surface.setAttribute('data-drag-tiles', '');
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    args.onStart?.(tile);
  }

  function settle(current: Carry): void {
    const { tile } = current;
    const from = tile.style.translate;
    const time = duration();
    const rest = () => {
      tile.style.zIndex = current.zIndex;
      tile.style.willChange = current.willChange;
      tile.removeAttribute('data-drag-settling');
    };
    tile.style.translate = '';
    tile.removeAttribute('data-drag-carried');
    if (!time || !from || from === 'none' || typeof tile.animate !== 'function') { rest(); return; }
    tile.setAttribute('data-drag-settling', '');
    const animation = tile.animate([{ translate: from }, { translate: '0px 0px' }], { duration: time * 1.3, easing });
    animation.addEventListener('finish', rest);
    animation.addEventListener('cancel', rest);
  }

  function finish(how: 'drop' | 'cancel'): void {
    const current = carry;
    pressed = false;
    if (!current) return;
    carry = null;
    if (current.scrollFrame !== null) cancelAnimationFrame(current.scrollFrame);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKey, true);
    surface.removeAttribute('data-drag-tiles');
    const moved = changed(current);
    if (how === 'cancel' && moved) { current.placed = false; draw(current, [...current.original], false); }
    settle(current);
    if (how === 'drop' && moved) {
      const from = current.original.indexOf(current.tile);
      const swapped = current.mode === 'swap' ? current.order[from] ?? null : null;
      args.onDrop?.({ tile: current.tile, from, to: current.order.indexOf(current.tile), mode: current.mode, swapped, order: [...current.order] });
    } else {
      args.onCancel?.(current.tile);
    }
  }

  const unregister = grid.surface({
    element: surface,
    unit: () => 1,
    press: (press) => {
      const path = press.event.composedPath?.() ?? [];
      const all = args.tiles();
      const at = path.findIndex((node) => node instanceof HTMLElement && all.includes(node));
      if (at < 0) return;
      const tile = path[at] as HTMLElement;
      if (path.slice(0, at).some((node) => node instanceof Element && node.matches(controls))) return;
      if (args.canCarry && !args.canCarry(tile, press.event)) return;
      pressed = true;
      shiftKey = press.event.shiftKey;
      const held = { ...client };
      return {
        onStart: () => lift(tile, held),
        onMove: () => {
          if (!carry) return;
          follow(carry);
          seek(carry);
          autoScroll(carry);
        },
        onDrop: () => finish('drop'),
        onCancel: () => finish('cancel'),
        onClick: () => { pressed = false; },
      };
    },
  });

  const onDragStart = (event: Event) => {
    if (pressed) event.preventDefault();
  };
  surface.addEventListener('dragstart', onDragStart, true);

  return {
    isCarrying: () => !!carry,
    cancel: () => grid.cancel(),
    destroy: () => {
      grid.destroy();
      unregister();
      surface.removeEventListener('dragstart', onDragStart, true);
    },
  };
}

function changed(carry: { order: readonly unknown[]; original: readonly unknown[]; placed: boolean }): boolean {
  return carry.placed || !same(carry.order, carry.original);
}

function same(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((each, index) => each === b[index]);
}
