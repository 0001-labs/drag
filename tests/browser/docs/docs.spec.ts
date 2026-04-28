import { expect, test } from '@playwright/test';

test('docs homepage loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  await page.goto('/');

  await expect(page.getByRole('link', { name: 'Drag' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Introduction' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Drag primitives for framework-neutral interfaces.' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Documentation' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('docs live example supports keyboard reorder', async ({ page }) => {
  await page.goto('/examples/live-demo/');

  await expect.poll(() => page.evaluate(() => customElements.get('drag-list') !== undefined)).toBe(true);

  await page.getByRole('button', { name: 'Move Install the package' }).focus();
  await page.keyboard.press('ArrowDown');

  const items = page.locator('drag-list.docs-list drag-item');
  await expect(items.nth(0)).toHaveAttribute('value', 'wire');
  await expect(items.nth(1)).toHaveAttribute('value', 'install');
  await expect(page.locator('#live-demo-announcement')).toHaveText(
    'Install the package moved to position 2 of 3.',
  );
});

test('docs live example supports pointer drag', async ({ page }) => {
  await page.goto('/examples/live-demo/');

  await expect.poll(() => page.evaluate(() => customElements.get('drag-list') !== undefined)).toBe(true);

  await page
    .getByRole('button', { name: 'Move Install the package' })
    .dragTo(page.getByText('Ship accessible controls'));

  const items = page.locator('drag-list.docs-list drag-item');
  await expect(items.nth(0)).toHaveAttribute('value', 'wire');
  await expect(items.nth(1)).toHaveAttribute('value', 'ship');
  await expect(items.nth(2)).toHaveAttribute('value', 'install');
});
