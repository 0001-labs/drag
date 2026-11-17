import { createRoot } from 'react-dom/client';
import { App } from './app';

export function mountPlay(host: HTMLElement): () => void {
  const root = createRoot(host);
  root.render(<App />);
  return () => root.unmount();
}
