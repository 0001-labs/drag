// Rendered text, across slots and open shadow roots. Token pairs alone cannot
// tell what ink a component actually draws on its own surface.
export type RGBA = [number, number, number, number];
const clear: RGBA = [0, 0, 0, 0];
export const TEXT_CONTRAST_MINIMUM = 4.5;
export const contrastRatio = (a: RGBA, b: RGBA) => {
  const luminance = (c: RGBA) => c.slice(0, 3).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + .05) / (low! + .05);
};
export function composite(top: RGBA, bottom: RGBA): RGBA {
  const alpha = top[3] + bottom[3] * (1 - top[3]);
  return alpha ? [...[0, 1, 2].map(i => (top[i]! * top[3] + bottom[i]! * bottom[3] * (1 - top[3])) / alpha), alpha] as RGBA : [...clear];
}
const styleOf = (e: Element, pseudo?: string) => e.ownerDocument.defaultView!.getComputedStyle(e, pseudo);
/** The painted parent, including the slot's styles and the shadow host's surface. */
export function paintedParent(e: Element): Element | null {
  return e.assignedSlot ?? e.parentElement ?? (e.getRootNode() as ShadowRoot).host ?? null;
}

/** Computed RGB stays full precision; modern colour spaces use the browser's sRGB canvas conversion. */
export function colorReader(document: Document) {
  const cache = new Map<string, RGBA | null>();
  let context: CanvasRenderingContext2D | null | undefined;
  return (value: string): RGBA | null => {
    if (cache.has(value)) return cache.get(value)!;
    let color: RGBA | null = null;
    if (value === 'transparent') color = [...clear];
    const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
    if (rgb) {
      const parts = rgb[1]!.split(/[\s,/]+/).filter(Boolean);
      if (parts.length >= 3) color = [...parts.slice(0, 3).map(v => parseFloat(v) / (v.endsWith('%') ? 100 : 255)), parts[3] ? parseFloat(parts[3]) / (parts[3].endsWith('%') ? 100 : 1) : 1] as RGBA;
    } else if (value && document.defaultView?.CSS.supports('color', value)) {
      context ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      if (context) {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        color = Array.from(context.getImageData(0, 0, 1, 1).data, v => v / 255) as RGBA;
      }
    }
    cache.set(value, color);
    return color;
  };
}

type TextSample = { element: Element; text: string; pseudo?: string; paintElement?: Element };

/** Screen-reader-only text still has layout rectangles, but a collapsed clip paints none of it. */
function fullyClipped(style: CSSStyleDeclaration): boolean {
  const rect = /^rect\(([^)]+)\)$/.exec(style.clip);
  if (rect && (style.position === 'absolute' || style.position === 'fixed')) {
    const edges = rect[1]!.split(/[\s,]+/).filter(Boolean);
    if (edges.length === 4 && edges.every(value => /^-?[\d.]+px$/.test(value))) {
      const [top, right, bottom, left] = edges.map(Number.parseFloat);
      if (bottom! <= top! || right! <= left!) return true;
    }
  }
  const inset = /^inset\(([^)]+)\)$/.exec(style.clipPath)?.[1]?.split(/\s+round\s+/)[0]?.trim().split(/\s+/);
  if (!inset || inset.length > 4 || !inset.every(value => /^(?:-?[\d.]+%|0(?:px)?)$/.test(value))) return false;
  const [top, right = top, bottom = top, left = right] = inset.map(Number.parseFloat);
  return top! + bottom! >= 100 || right! + left! >= 100;
}

/** Text nodes are visited once in their composed position; hidden menus and inactive controls do not count. */
function* textSamples(root: ParentNode, style: (e: Element) => CSSStyleDeclaration): Generator<TextSample | undefined> {
  const seen = new Set<Node>();
  const excluded = new Map<Element, boolean>();
  const visibility = new Map<Element, boolean>();
  function excludedFromPaint(e: Element): boolean {
    const cached = excluded.get(e);
    if (cached !== undefined) return cached;
    const s = style(e);
    const parent = paintedParent(e);
    const hidden = s.display === 'none' || s.contentVisibility === 'hidden' || Number(s.opacity) === 0 || fullyClipped(s)
      || e.matches(':disabled, [aria-disabled="true"], [data-ds-constraint-panel]')
      || (parent !== null && excludedFromPaint(parent));
    excluded.set(e, hidden);
    return hidden;
  }
  function visible(e: Element): boolean {
    const cached = visibility.get(e);
    if (cached !== undefined) return cached;
    const s = style(e);
    const visible = s.visibility === 'visible' && !excludedFromPaint(e)
      && (s.display === 'contents' || e.getClientRects().length > 0);
    visibility.set(e, visible);
    return visible;
  }
  function* visit(node: Node): Generator<TextSample | undefined> {
    if (seen.has(node)) return;
    seen.add(node);
    yield;
    if (node.nodeType === 3) {
      const text = node.textContent?.trim();
      const element = node.parentElement;
      const paintElement = (node as Text).assignedSlot ?? element;
      if (text && element && paintElement && visible(paintElement)) {
        const range = element.ownerDocument.createRange();
        range.selectNodeContents(node);
        if (Array.from(range.getClientRects()).some(r => r.width > 0 && r.height > 0)) yield { element, text, paintElement };
      }
      return;
    }
    if (node.nodeType === 1) {
      const e = node as Element;
      if (e.matches('script, style, template, noscript, option, [data-ds-constraint-panel]')) return;
      if (excludedFromPaint(e)) return;
      if (visible(e)) {
        if (e.localName === 'input' || e.localName === 'textarea') {
          const input = e as HTMLInputElement;
          if (!['hidden', 'checkbox', 'radio', 'range', 'color', 'file', 'image'].includes(input.type)) {
            if (input.value) yield { element: e, text: input.type === 'password' ? 'Password value' : input.value };
            else if (input.placeholder) yield { element: e, text: input.placeholder, pseudo: '::placeholder' };
          }
        } else if (e.localName === 'select') {
          const text = (e as unknown as HTMLSelectElement).selectedOptions[0]?.textContent?.trim();
          if (text) yield { element: e, text };
        }
        for (const pseudo of ['::before', '::after']) {
          const s = styleOf(e, pseudo);
          if (/^["'].*["']$/.test(s.content) && s.content.slice(1, -1).trim() && s.display !== 'none' && s.visibility === 'visible' && Number(s.opacity) !== 0) {
            yield { element: e, text: s.content.slice(1, -1), pseudo };
          }
        }
      }
      if (e.localName === 'slot') {
        const assigned = (e as HTMLSlotElement).assignedNodes({ flatten: true });
        for (const child of assigned.length ? assigned : e.childNodes) yield* visit(child);
        return;
      }
      if (e.shadowRoot) { yield* visit(e.shadowRoot); return; }
      // Values/placeholder above represent these controls, not their fallback children.
      if (e.matches('input, textarea, select')) return;
    }
    for (const child of node.childNodes) yield* visit(child);
  }
  yield* visit(root as Node);
}

export type TextContrastResult = { element: Element; text: string; ratio?: number; reason?: string; foreground?: string; background?: string };
const rgbLabel = (c: RGBA) => `rgb(${c.slice(0, 3).map(v => Math.round(v * 255)).join(', ')})`;

/** Yields between DOM nodes so passive callers can scan in short idle slices. */
export function* scanTextContrast(root: ParentNode): Generator<TextContrastResult | undefined> {
  const document = (root as Node).ownerDocument ?? root as Document;
  const read = colorReader(document);
  const styles = new Map<Element, CSSStyleDeclaration>();
  const style = (e: Element) => { if (!styles.has(e)) styles.set(e, styleOf(e)); return styles.get(e)!; };
  function measure({ element, text, pseudo, paintElement = element }: TextSample): TextContrastResult | undefined {
    const result: TextContrastResult = { element, text: text.replace(/\s+/g, ' ').slice(0, 60) };
    const inkStyle = pseudo ? styleOf(element, pseudo) : style(paintElement);
    let foreground = read(inkStyle.getPropertyValue('-webkit-text-fill-color') || inkStyle.color);
    let background: RGBA = [...clear];
    if (!foreground) return { ...result, reason: 'The rendered text colour could not be resolved.' };
    const chain: CSSStyleDeclaration[] = [];
    if (pseudo) chain.push(inkStyle);
    for (let p: Element | null = paintElement; p; p = paintedParent(p)) chain.push(style(p));
    // Transparent text paints no glyphs. Keep text painted by shadows, outlines or clipped
    // backgrounds in the review path, and keep every nonzero alpha in normal measurement.
    if (Number(inkStyle.opacity) === 0) return;
    if (foreground[3] === 0) {
      const otherPaint = (inkStyle.textShadow && inkStyle.textShadow !== 'none')
        || Number.parseFloat(inkStyle.getPropertyValue('-webkit-text-stroke-width')) > 0
        || chain.some(s => (s.backgroundClip.includes('text') || s.getPropertyValue('-webkit-background-clip').includes('text')) && (s.backgroundImage !== 'none' || (read(s.backgroundColor)?.[3] ?? 0) > 0));
      return otherPaint ? { ...result, reason: 'Transparent text painted by a shadow, stroke or background needs a visual contrast review.' } : undefined;
    }
    for (const s of chain) {
      if (s.mixBlendMode && s.mixBlendMode !== 'normal' || s.filter && s.filter !== 'none' || s.backdropFilter && s.backdropFilter !== 'none') {
        return { ...result, reason: 'A blend or filter needs a visual contrast review.' };
      }
      if (background[3] < 1 && s.backgroundImage && s.backgroundImage !== 'none') {
        return { ...result, reason: 'Text over an image or gradient needs a visual contrast review.' };
      }
      const fill = read(s.backgroundColor);
      if (!fill) return { ...result, reason: 'The rendered background colour could not be resolved.' };
      foreground = composite(foreground, fill);
      background = composite(background, fill);
      const opacity = Number(s.opacity);
      foreground[3] *= opacity;
      background[3] *= opacity;
    }
    // With no declared page background, compare both possible user-agent canvases.
    // Usually the opaque html/body surface makes these identical.
    const candidates: RGBA[] = [[1, 1, 1, 1], [0, 0, 0, 1]];
    const pairs = candidates.map(canvas => ({ foreground: composite(foreground!, canvas), background: composite(background, canvas) }));
    const values = pairs.map(pair => ({ ...pair, ratio: contrastRatio(pair.foreground, pair.background) })).sort((a, b) => a.ratio - b.ratio);
    const worst = values[0]!;
    if (background[3] < 1 && worst.ratio < TEXT_CONTRAST_MINIMUM) return { ...result, reason: 'Declare an opaque page background so text contrast can be verified.' };
    return { ...result, ratio: worst.ratio, foreground: rgbLabel(worst.foreground), background: rgbLabel(worst.background) };
  }
  for (const sample of textSamples(root, style)) yield sample && measure(sample);
}

export function measureTextContrast(root: ParentNode): TextContrastResult[] {
  const results: TextContrastResult[] = [];
  for (const result of scanTextContrast(root)) if (result) results.push(result);
  return results;
}

export function inspectTextContrast(root: ParentNode) {
  return measureTextContrast(root).flatMap(result => {
    const label = `“${result.text}”`;
    // What cannot be measured is a review for a person, not a broken rule; a colour that could not be read is.
    if (result.reason) return [{ element: result.element, message: `${label}: ${result.reason}`, review: /visual contrast review/.test(result.reason) }];
    return result.ratio! < TEXT_CONTRAST_MINIMUM ? [{ element: result.element, message: `${label} has ${result.ratio!.toFixed(2)}:1 text contrast (${result.foreground} on ${result.background}); at least ${TEXT_CONTRAST_MINIMUM}:1 is required.` }] : [];
  });
}
