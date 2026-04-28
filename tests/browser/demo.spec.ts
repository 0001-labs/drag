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
