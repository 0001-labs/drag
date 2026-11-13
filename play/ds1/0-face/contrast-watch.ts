/**
 * Contrast watch: the `color.text-contrast` rule, run in the product on the theme the
 * person is using. Visible text under 4.5:1 is reported once per session as a
 * `contrast.<theme>.element.<authored-key>` failure through `reportFailure`, which the Feedback loop
 * turns into an issue. The message names colours, ratio, component, element and path;
 * it never carries the page's text. Text under a fade in flight (opacity or a colour in a
 * transition or an animation) is left for a later run: a frame of a fade is no state of the page.
 *
 * Load it with a dynamic import once the page has loaded and gone idle, then call
 * `startContrastWatch()`; it does nothing per frame.
 */
import { scanTextContrast, paintedParent, TEXT_CONTRAST_MINIMUM } from './text-contrast';
import { reportFailure, type Failure } from './failures';
import { contrastIdentity, contrastSelectorRegistry, type ContrastSelector } from './contrast-selectors';
export { contrastIdentity, contrastSelectorRegistry } from './contrast-selectors';
export type { ContrastSelector } from './contrast-selectors';

export type ContrastWatchOptions = {
  /** At most 128 source-authored selector identities including DS1 defaults; never runtime/user data. */
  selectors?: readonly ContrastSelector[];
  /** What is measured; the whole document by default. */
  root?: ParentNode;
  /** The least ratio, 4.5 by default. */
  minimum?: number;
  /** Findings reported by one run, 10 by default. */
  maxPerRun?: number;
  /** Where findings go; `reportFailure` by default. */
  report?: (failure: Failure) => void;
  /** Remembers what was reported this session; sessionStorage by default, null for memory only. */
  storage?: Storage | null;
  now?: () => number;
  /** Also warns in the console with the element; on in a Vite development build. */
  debug?: boolean;
  /** The least time between two runs, 10 s by default. */
  interval?: number;
  /** How long the page stays unchanged after mutations before a run, 2 s by default. */
  quiet?: number;
};

const STORAGE_KEY = 'ds1:contrast-watch';
const MAX_KEYS = 200;
/** How often a page is measured again for text that failed under a fade in flight. */
const MAX_FADE_RETRIES = 3;
/** A page with more pieces of text than this is left alone: measuring it would cost too much. */
const MAX_TEXTS = 4000;

/** `light` or `dark`, as theme-bootstrap.js marks the root, else the system's. */
export function contrastTheme(document: Document): 'light' | 'dark' {
  const root = document.documentElement;
  if (root.classList.contains('dark-theme')) return 'dark';
  if (root.classList.contains('light-theme')) return 'light';
  const marked = root.getAttribute('data-theme') ?? root.getAttribute('theme');
  if (marked === 'dark' || marked === 'light') return marked;
  try { return document.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
}

/** The DS1 component text sits in: the nearest `ds-*` element across shadow roots, else the nearest `ds-*` class, else its own tag. */
export function contrastComponent(element: Element): string {
  for (let p: Element | null = element; p; p = paintedParent(p)) if (p.localName.startsWith('ds-')) return p.localName;
  for (let p: Element | null = element; p; p = paintedParent(p)) {
    const name = Array.from(p.classList).find(c => c.startsWith('ds-') && c.length > 3);
    if (name) return name.slice(3);
  }
  return element.localName;
}


/** Opacity or a colour on its way between two values, by a transition or an animation, on the text's element or anything it is drawn in. */
function fading(element: Element): boolean {
  const starts = [element];
  // Words given straight to a slot are drawn in the slot's shadow tree, not in their parent's.
  for (const node of element.childNodes) { const slot = node.nodeType === 3 ? (node as Text).assignedSlot : null; if (slot) starts.push(slot); }
  return starts.some(start => {
    for (let p: Element | null = start; p; p = paintedParent(p)) {
      if ((p.getAnimations?.() ?? []).some(animation => animation.playState === 'running'
        && ((animation.effect as KeyframeEffect | null)?.getKeyframes?.() ?? []).some(frame => 'opacity' in frame || 'color' in frame || 'backgroundColor' in frame))) return true;
    }
    return false;
  });
}

function hasTooMuchText(root: ParentNode) {
  const document = (root as Node).ownerDocument ?? root as Document;
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);
  let count = 0;
  while (walker.nextNode()) if (/\S/.test((walker.currentNode as Text).data) && ++count > MAX_TEXTS) return true;
  return false;
}

function developing() {
  try {
    const env = (import.meta as { env?: { DEV?: boolean } }).env;
    return typeof env !== 'undefined' && env.DEV === true;
  } catch { return false; }
}

/** Starts watching; returns the function that stops it. */
export function startContrastWatch(options: ContrastWatchOptions = {}): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  const now = options.now ?? Date.now;
  const root = options.root ?? document;
  const registry = contrastSelectorRegistry(document, options.selectors);
  const minimum = options.minimum ?? TEXT_CONTRAST_MINIMUM;
  const maxPerRun = options.maxPerRun ?? 10;
  const interval = options.interval ?? 10_000;
  const quiet = options.quiet ?? 2_000;
  const report = options.report ?? reportFailure;
  const debug = options.debug ?? developing();
  let storage: Storage | null = null;
  if (options.storage !== undefined) storage = options.storage;
  else try { storage = window.sessionStorage; } catch { /* Storage can be blocked. */ }

  let reported: string[] = [];
  try { const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]'); if (Array.isArray(saved)) reported = saved.filter(k => typeof k === 'string'); } catch { /* Unreadable: start afresh. */ }
  const known = new Set(reported);
  const remember = (key: string) => {
    known.add(key);
    reported.push(key);
    if (reported.length > MAX_KEYS) known.delete(reported.shift()!);
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(reported)); } catch { /* Memory still holds it. */ }
  };

  const ran = new Set<string>();
  const fadeRetries = new Map<string, number>();
  let lastRun = -Infinity;
  let lastTheme = '';
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelIdle: (() => void) | undefined;
  let settle: ReturnType<typeof setTimeout> | undefined;
  let burstStart = 0;

  function run() {
    if (stopped || settle !== undefined || document.visibilityState !== 'visible') return;
    const theme = contrastTheme(document);
    const path = location.pathname;
    const page = `${theme} ${path}`;
    // One run per theme and path, unless the theme changed since the last run.
    if (ran.has(page) && theme === lastTheme) return;
    if (now() < lastRun + interval) { schedule(); return; }
    let faded = false;
    const finish = () => {
      lastRun = now();
      lastTheme = theme;
      // Text that failed mid-fade is no finding yet: the page is measured again once the fade has had time to end.
      const retries = fadeRetries.get(page) ?? 0;
      if (faded && retries < MAX_FADE_RETRIES) { fadeRetries.set(page, retries + 1); ran.delete(page); schedule(); }
      else ran.add(page);
    };
    if (hasTooMuchText(root)) { finish(); return; }
    const scan = scanTextContrast(root);
    let count = 0;
    function slice(idle?: IdleDeadline) {
      if (stopped || settle !== undefined || document.visibilityState !== 'visible'
        || location.pathname !== path || contrastTheme(document) !== theme) {
        schedule();
        return;
      }
      const end = performance.now() + Math.max(1, Math.min(8, idle?.timeRemaining() ?? 8));
      do {
        const next = scan.next();
        if (next.done || count >= maxPerRun) { finish(); return; }
        const result = next.value;
        if (result?.ratio === undefined || result.ratio >= minimum || !result.foreground || !result.background) continue;
        if (fading(result.element)) { faded = true; continue; }
        const identity = contrastIdentity(result.element, registry);
        const key = `contrast.${theme}.${identity.key}`;
        if (known.has(key)) continue;
        remember(key);
        count++;
        // Rounded down, so a ratio just under the minimum never reads as meeting it.
        const ratio = (Math.floor(result.ratio * 10) / 10).toFixed(1);
        const message = `${result.foreground} on ${result.background}, ${ratio}:1 (${identity.label}) on ${path}`.slice(0, 200);
        report({ code: key, message });
        if (debug) console.warn(`[DS1 contrast] ${message}`, result.element);
      } while (performance.now() < end);
      atIdle(slice);
    }
    atIdle(slice);
  }

  function atIdle(callback: (idle?: IdleDeadline) => void) {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(idle => { cancelIdle = undefined; callback(idle); }, { timeout: 5_000 });
      cancelIdle = () => window.cancelIdleCallback(id);
    } else {
      const id = setTimeout(() => { cancelIdle = undefined; callback(); }, 1);
      cancelIdle = () => clearTimeout(id);
    }
  }

  function schedule() {
    if (stopped || settle !== undefined || timer !== undefined || cancelIdle || document.visibilityState !== 'visible') return;
    timer = setTimeout(() => {
      timer = undefined;
      atIdle(run);
    }, Math.max(0, lastRun + interval - now()));
  }

  // A burst of changes runs once it has been quiet for a moment; a page that never
  // stops changing still runs after five quiet periods.
  const waitForQuiet = () => {
    const at = now();
    if (settle === undefined) burstStart = at;
    else if (at - burstStart > quiet * 5) return;
    clearTimeout(settle);
    settle = setTimeout(() => { settle = undefined; schedule(); }, quiet);
  };
  const observer = new MutationObserver(waitForQuiet);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'theme'] });
  let media: MediaQueryList | null = null;
  try { media = window.matchMedia('(prefers-color-scheme: dark)'); } catch { /* No media queries. */ }
  window.addEventListener('theme-changed', schedule);
  window.addEventListener('popstate', schedule);
  document.addEventListener('visibilitychange', schedule);
  media?.addEventListener?.('change', schedule);
  waitForQuiet();

  return () => {
    stopped = true;
    observer.disconnect();
    clearTimeout(timer);
    clearTimeout(settle);
    cancelIdle?.();
    window.removeEventListener('theme-changed', schedule);
    window.removeEventListener('popstate', schedule);
    document.removeEventListener('visibilitychange', schedule);
    media?.removeEventListener?.('change', schedule);
  };
}
