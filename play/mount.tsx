import { createRoot } from 'react-dom/client';
import { App } from './app';

/** Draws Play into `host`, on the docs' front page. */
export function mountPlay(host: HTMLElement): () => void {
  const root = createRoot(host);
  root.render(<App />);
  return () => root.unmount();
}
