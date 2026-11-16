/**
 * Tiles the page lays out, carried among each other: a wall of pictures, a
 * masonry, cards of every size.
 *
 * The page owns the layout (`arrange`): told an order, it places every tile.
 * A tile pressed and moved is lifted as it is, nothing cloned, and stays under
 * the pointer where it was taken hold of. The others go where the order now
 * draws them, sliding there in transform alone. The order changes in one of
 * two ways. `push`: the tile takes the place of the one the pointer is over
 * and the rest step aside. `swap`: it and that one trade places and nothing
 * else moves (while Shift is held, unless `mode` says otherwise). Let go, it
 * settles into its place and the page hears the order (`onDrop`); Escape, a
 * lost pointer or the window losing the focus put everything back.
 *
 * The gesture is the grid's (`createGrid`): a mouse or a pen lifts after five
 * pixels, a finger after a still hold, a press that never lifted stays a
 * click. Near the top or the foot of whatever scrolls the tiles, shadow roots
 * included, it scrolls under the pointer.
 */
import { createGrid, type GridOptions } from './grid';
import { reorder } from './util';

export type TilesMode = 'push' | 'swap';

export type TilesChange = {
  tile: HTMLElement;
  /** Where it stood in the order, and where it stands now. */
  from: number;
  to: number;
  /** How the order last changed. */
  mode: TilesMode;
  /** The tile it traded places with, after a swap. */
  swapped: HTMLElement | null;
  order: HTMLElement[];
};

/** What is being carried, told to the page with each order it draws. */
export type TilesCarry = {
  tile: HTMLElement;
  mode: TilesMode;
  /** The order the carry began with. */
  original: readonly HTMLElement[];
};

/** The pointer has come over another tile while pushing. */
export type TilesPlace = {
  tile: HTMLElement;
  over: HTMLElement;
  order: readonly HTMLElement[];
  original: readonly HTMLElement[];
  /** Where in `over` the pointer is, as a share of its width and height. */
  at: { x: number; y: number };
};

export type TilesArgs = {
  /** What the tiles stand in; their places are measured from its corner. */
  surface: HTMLElement;
  /** The tiles in their order. */
  tiles: () => HTMLElement[];
  /** Draw an order: place every tile where it puts it. Called at each change of place, never per frame. */
  arrange: (order: HTMLElement[], carry: TilesCarry) => void;
  /**
   * Where a pushed tile goes when the pointer comes over another: return the order to draw.
   * Without it the tile takes the other's place in the order. For a layout whose places are
   * more than an order (columns, say), decide here and remember it for `arrange`.
   */
  place?: (place: TilesPlace) => HTMLElement[] | undefined | void;
  /** Whether a press on a tile carries it. A press on a control inside a tile never does. */
  canCarry?: (tile: HTMLElement, event: PointerEvent) => boolean;
  /** Which way the order changes; Shift swaps by default. */
  mode?: (keys: { shiftKey: boolean }) => TilesMode;
  onStart?: (tile: HTMLElement) => void;
  /** Let go on a changed order. */
  onDrop?: (change: TilesChange) => void;
  /** Let go where it was taken, or taken back. */
  onCancel?: (tile: HTMLElement) => void;
};

export type TilesOptions = GridOptions & {
  /** How long a tile slides to a new place, in milliseconds; nothing slides under reduced motion. */
  duration?: number;
  easing?: string;
  /** How far the pointer moves before the order may change again, in pixels. */
  changeDistance?: number;
};

export type TilesController = {
  isCarrying: () => boolean;
  /** Put everything back. */
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
  /** Where in the tile it was taken hold of, as a share of its width and height. */
  grab: Point;
  mode: TilesMode;
  /** The page placed it (`place`): its place may differ though the order does not. */
  placed: boolean;
  /** Where the tile it last changed places with stood: nothing changes again until the pointer has left there, whatever slides under it. */
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

  /** The pointer's place from the surface's corner, whatever has scrolled. */
  function pointer(): Point {
    const base = surface.getBoundingClientRect();
    return { x: client.x - base.left + surface.scrollLeft, y: client.y - base.top + surface.scrollTop };
  }

  function boxOf(tile: HTMLElement, base: DOMRect): Box {
    const rect = tile.getBoundingClientRect();
    return { x: rect.left - base.left + surface.scrollLeft, y: rect.top - base.top + surface.scrollTop, width: rect.width, height: rect.height };
  }

  /** Keep the carried tile under the pointer, where it was taken hold of. */
  function follow(current: Carry): void {
    const box = current.boxes.get(current.tile);
    if (!box) return;
    const at = pointer();
    current.tile.style.translate = `${at.x - current.grab.x * box.width - box.x}px ${at.y - current.grab.y * box.height - box.y}px`;
  }

  /** Draw an order, each tile but the carried one sliding from where it is seen to where it now stands. */
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

  /** The order the pointer now asks for, drawn if it differs. */
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
      // Over the tile now standing where it came from, everything goes back.
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

  /** Shift pressed or released: the same pointer, read the other way from the order it began with. */
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

  /** How fast the pointer near the top or the foot scrolls what holds the tiles. */
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

  /** The carried tile, let go: from under the pointer to where its place is. */
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

  // A picture or a link pressed would be taken by the browser's own drag, which ends the pointer's.
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
