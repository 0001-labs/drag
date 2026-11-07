import { paintedParent } from './text-contrast';

/** Authored in source, never built from DOM attributes, paths, content or server data. */
export type ContrastSelector = {
  /** Stable semantic name, at most 40 characters. Renaming it creates a new issue identity. */
  key: string;
  selector: string;
  /** Optional authored ancestor selector, including across a shadow boundary. */
  within?: string;
};

/** Component-owned semantic parts; products can name more specific surfaces before these. */
export const DS1_CONTRAST_SELECTORS: readonly ContrastSelector[] = [
  { key: 'ds1.input.error', selector: '.error-message', within: 'ds-input' },
  { key: 'ds1.input.value', selector: '[part~="input"]', within: 'ds-input' },
  { key: 'ds1.tag.label', selector: 'ds-tag' },
  { key: 'ds1.button.label', selector: 'ds-button' },
  { key: 'ds1.badge.label', selector: 'ds-badge' },
];

// A finite fallback vocabulary. Unknown/custom tags deliberately share one bucket; neither a
// generated class nor an unregistered custom tag can introduce a new issue identity.
const FALLBACK_TAGS = new Set('a b button caption code dd del details div dt em figcaption h1 h2 h3 h4 h5 h6 input label legend li option p pre select small span strong summary td textarea th time'.split(' '));
const MAX_SELECTORS = 128;
const MAX_ANCESTORS = 32;

/** Compile once per watch. Invalid/excess definitions fail closed to the coarse fallback. */
export function contrastSelectorRegistry(document: Document, authored: readonly ContrastSelector[] = []): readonly ContrastSelector[] {
  const entries: ContrastSelector[] = [];
  const keys = new Set<string>();
  for (const entry of [...authored, ...DS1_CONTRAST_SELECTORS]) {
    if (entries.length === MAX_SELECTORS) break;
    if (!entry || typeof entry.key !== 'string' || !/^[a-z][a-z0-9.-]{0,39}$/.test(entry.key) || keys.has(entry.key)
      || typeof entry.selector !== 'string' || !entry.selector.trim() || entry.selector.length > 200
      || entry.within !== undefined && (typeof entry.within !== 'string' || !entry.within.trim() || entry.within.length > 200)) continue;
    try {
      document.documentElement.matches(entry.selector);
      if (entry.within) document.documentElement.matches(entry.within);
    } catch { continue; }
    // Copy the source configuration; later mutations cannot rename a running watch's findings.
    entries.push({ key: entry.key, selector: entry.selector, ...(entry.within ? { within: entry.within } : {}) });
    keys.add(entry.key);
  }
  return entries;
}

function within(element: Element, selector: string): boolean {
  let depth = 0;
  for (let p: Element | null = element; p && depth++ < MAX_ANCESTORS; p = paintedParent(p)) {
    if (p.matches(selector)) return true;
  }
  return false;
}

/** Nearest authored selector wins; source order breaks ties. No DOM identifiers enter the result. */
export function contrastIdentity(element: Element, registry: readonly ContrastSelector[]): { key: string; label: string } {
  let depth = 0;
  for (let p: Element | null = element; p && depth++ < MAX_ANCESTORS; p = paintedParent(p)) {
    for (const entry of registry) {
      if (p.matches(entry.selector) && (!entry.within || within(p, entry.within))) {
        return { key: `element.${entry.key}`, label: entry.within ? `${entry.within} ${entry.selector}` : entry.selector };
      }
    }
  }
  const tag = FALLBACK_TAGS.has(element.localName) ? element.localName : 'custom';
  return { key: `unregistered.${tag}`, label: tag };
}
