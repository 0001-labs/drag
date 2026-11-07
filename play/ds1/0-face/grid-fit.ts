/** Round named area heights up to the shared unit without clipping their content. */
export function initGridFit(): void {
  const scopes = Array.from(document.querySelectorAll<HTMLElement>('[data-ds-grid-fit]'));
  if (!scopes.length || document.documentElement.hasAttribute('data-ds-grid-fit-ready')) return;
  document.documentElement.setAttribute('data-ds-grid-fit-ready', '');

  const measure = document.createElement('div');
  measure.setAttribute('aria-hidden', 'true');
  measure.style.cssText = 'position:fixed;left:0;top:0;width:0;height:var(--ds-grid-unit,20px);visibility:hidden;pointer-events:none;contain:strict';
  document.body.appendChild(measure);
  const originalMinimums = new Map<HTMLElement, string>();
  const observed = new Set<HTMLElement>();
  let frame = 0;

  const fit = () => {
    frame = 0;
    const unit = measure.getBoundingClientRect().height;
    if (unit <= 0) return;
    const activeScopes = scopes.filter((scope) => scope.isConnected);
    const elements = [...new Set(activeScopes.flatMap((scope) => Array.from(scope.querySelectorAll<HTMLElement>('[data-ds-area]'))))];
    const current = new Set(elements);
    for (const [element, minimum] of originalMinimums) {
      if (!current.has(element)) {
        element.style.minHeight = minimum;
        originalMinimums.delete(element);
      }
    }
    // Restore natural heights first, allowing containers to shrink after a
    // translation, font, or viewport change as well as grow.
    elements.forEach((element) => {
      if (!originalMinimums.has(element)) originalMinimums.set(element, element.style.minHeight);
      element.style.minHeight = originalMinimums.get(element)!;
    });
    // Children settle before their containing areas; siblings share one read phase
    // so setting a minimum does not force another layout for every named area.
    const depths = new Map<number, HTMLElement[]>();
    for (const element of elements) {
      let depth = 0;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (current.has(parent)) depth++;
      }
      const siblings = depths.get(depth) ?? [];
      siblings.push(element);
      depths.set(depth, siblings);
    }
    for (const depth of [...depths.keys()].sort((a, b) => b - a)) {
      const sizes = depths.get(depth)!.map((element) => ({
        element,
        height: element.getBoundingClientRect().height,
        hidden: getComputedStyle(element).display === 'none',
      }));
      for (const { element, height, hidden } of sizes) {
        if (!height || hidden) continue;
        const rounded = Math.max(1, Math.ceil((height - 0.02) / unit)) * unit;
        element.style.minHeight = `${rounded}px`;
      }
    }

    const targets = new Set<HTMLElement>([measure, ...activeScopes, ...elements]);
    elements.forEach((element) => {
      for (const child of element.children) if (child instanceof HTMLElement) targets.add(child);
    });
    for (const element of observed) {
      if (!targets.has(element)) { resize.unobserve(element); observed.delete(element); }
    }
    for (const element of targets) {
      if (!observed.has(element)) { resize.observe(element); observed.add(element); }
    }
    window.dispatchEvent(new CustomEvent('design-system-layout-sized'));
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(fit); };
  const resize = new ResizeObserver(schedule);
  const changes = new MutationObserver(schedule);
  scopes.forEach((scope) => changes.observe(scope, { subtree: true, childList: true, characterData: true }));
  window.addEventListener('resize', schedule);
  window.addEventListener('scaling-changed', schedule);
  window.addEventListener('language-changed', schedule);
  document.fonts.addEventListener('loadingdone', schedule);
  void document.fonts.ready.then(schedule);
  fit();
}
