import { expect, test } from '@playwright/test';

test('demo page loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  await page.goto('/examples/');

  await expect(page.getByRole('heading', { name: '@0001-labs/drag' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Project tasks' })).toBeVisible();
  await expect(page.getByText('Research architecture')).toBeVisible();
  expect(errors).toEqual([]);
});

test('keyboard reorder moves an item and announces the change', async ({ page }) => {
  await page.goto('/examples/');

  await page.getByRole('button', { name: 'Move Research architecture' }).focus();
  await page.keyboard.press('ArrowDown');

  const items = page.locator('drag-item');
  await expect(items.nth(0)).toHaveAttribute('value', 'engine');
  await expect(items.nth(1)).toHaveAttribute('value', 'research');
  await expect(page.locator('[data-0001-drag-live-region]')).toHaveText(
    'Research architecture moved to position 2 of 3.',
  );
});

test('pointer drag reorders list items', async ({ page }) => {
  await page.goto('/examples/');

  await page
    .getByRole('button', { name: 'Move Research architecture' })
    .dragTo(page.getByText('Write deterministic tests'));

  const items = page.locator('drag-item');
  await expect(items.nth(0)).toHaveAttribute('value', 'engine');
  await expect(items.nth(1)).toHaveAttribute('value', 'tests');
  await expect(items.nth(2)).toHaveAttribute('value', 'research');
});

test('parent-owned sortable reorders inside a script-free iframe by pointer and keyboard', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/examples/');
  await page.evaluate(async () => {
    const source = '/src/sortable.ts';
    const { createSortable } = await import(source) as typeof import('../../src/sortable');
    const frame = document.createElement('iframe'); frame.id = 'sort-frame'; frame.setAttribute('sandbox', 'allow-same-origin');
    frame.style.cssText = 'position:fixed;left:20px;top:20px;width:360px;height:420px;z-index:9999;background:white';
    const loaded = new Promise<void>(resolve => frame.onload = () => resolve());
    frame.srcdoc = '<!doctype html><html><head><style>body{margin:20px}main{display:flex;flex-direction:column;gap:20px}section{height:80px;background:#eee;padding:20px;box-sizing:border-box}</style></head><body><main><section id="a">First</section><section id="b">Second</section><section id="c">Third</section></main></body></html>';
    document.body.append(frame); await loaded;
    const doc = frame.contentDocument!, list = doc.querySelector('main')!;
    const sortable = createSortable({ lockAxis: 'y', prepareDrop(result) {
      const target = doc.getElementById(result.draggableId)!;
      if (result.reason === 'DROP' && result.destination) {
        const children = [...list.children].filter(child => child !== target);
        list.insertBefore(target, children[result.destination.index] ?? null);
      }
      return target;
    }, onDragEnd(result) { doc.body.dataset.last = `${result.reason}:${result.draggableId}:${result.destination?.index}`; } });
    sortable.container({ element: list, id: 'framed' });
    for (const element of list.querySelectorAll<HTMLElement>('section')) sortable.item({ element, id: element.id });
  });
  const frame = page.frameLocator('#sort-frame');
  const first = await frame.locator('#a').boundingBox();
  // Playwright's native-drag interception uses iframe timers, forbidden by this sandbox.
  const input = await page.context().newCDPSession(page);
  await input.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: first!.x + 150, y: first!.y + 40 });
  await input.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: first!.x + 150, y: first!.y + 40, button: 'left', buttons: 1, clickCount: 1 });
  await input.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: first!.x + 150, y: first!.y + 150, button: 'left', buttons: 1 });
  await expect(frame.locator('[data-drag-preview]')).toBeVisible();
  await expect(page.locator('[data-drag-overlay]')).toHaveCount(0);
  await input.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: first!.x + 150, y: first!.y + 150, button: 'left', buttons: 0, clickCount: 1 });
  await expect(frame.locator('body')).toHaveAttribute('data-last', 'DROP:a:1');
  await expect(frame.locator('main > section')).toHaveText(['Second', 'First', 'Third']);
  await expect(frame.locator('[data-drag-overlay]')).toHaveCount(0);
  await frame.locator('#b').focus(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space');
  await expect(frame.locator('body')).toHaveAttribute('data-last', 'DROP:b:1');
  await expect(frame.locator('main > section')).toHaveText(['First', 'Second', 'Third']);
  await frame.locator('#a').focus(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape');
  await expect(frame.locator('body')).toHaveAttribute('data-last', 'CANCEL:a:undefined');
  await expect(frame.locator('main > section')).toHaveText(['First', 'Second', 'Third']);
});
