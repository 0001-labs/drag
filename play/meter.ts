export type Reading = {
  frames: number;
  longestFrame: number;
  pointerRate: number;
  renders: number;
  seconds: number;
};

let measuring = false;
let started = 0;
let lastFrame = 0;
let frames = 0;
let longest = 0;
let pointerEvents = 0;
let renders = 0;
let frame = 0;

const onPointerMove = (event: PointerEvent) => {
  pointerEvents += event.getCoalescedEvents?.().length || 1;
};

function tick(now: number) {
  if (!measuring) return;
  if (lastFrame) longest = Math.max(longest, now - lastFrame);
  lastFrame = now;
  frames++;
  frame = requestAnimationFrame(tick);
}

export function startMeasuring(): void {
  measuring = true;
  started = performance.now();
  lastFrame = 0;
  frames = 0;
  longest = 0;
  pointerEvents = 0;
  renders = 0;
  window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
  frame = requestAnimationFrame(tick);
}

export function countRender(): void {
  if (measuring) renders++;
}

export function stopMeasuring(): Reading | null {
  if (!measuring) return null;
  measuring = false;
  cancelAnimationFrame(frame);
  window.removeEventListener('pointermove', onPointerMove, true);
  const seconds = (performance.now() - started) / 1000;
  if (seconds < 0.1) return null;
  return {
    frames: Math.round(frames / seconds),
    longestFrame: Math.round(longest),
    pointerRate: Math.round(pointerEvents / seconds),
    renders,
    seconds,
  };
}
