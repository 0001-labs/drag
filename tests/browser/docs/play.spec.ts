import { expect, test, type Locator, type Page } from '@playwright/test';

/** Holds a cell, moves in small steps as a hand does, and lets go. */
async function dragTo(page: Page, from: Locator, to: { x: number; y: number }): Promise<void> {
  const box = await from.boundingBox();
  if (!box) throw new Error('Nothing to hold');
  const start = { x: box.x + 10, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y + 8, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 24 });
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForTimeout(700);
}

const column = (page: Page, list: string, name: string) =>
  page.getByRole('region', { name: list }).locator('.play-column', { has: page.locator('.play-column__name', { hasText: name }) });

const cellTitles = (page: Page, list: string, name: string) => column(page, list, name).locator('.play-cell').allTextContents();

test.describe('Play', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Play' })).toBeVisible();
  });

  test('draws cells on the square, a pixel apart', async ({ page }) => {
    const cells = column(page, 'Week', 'Monday').locator('.play-cell');
    const first = await cells.nth(1).boundingBox();
    const second = await cells.nth(2).boundingBox();
    expect(first?.width).toBe(79);
    expect(first?.height).toBe(19);
    expect((second?.y ?? 0) - (first?.y ?? 0)).toBe(20);
  });

  test('moves a cell down its column', async ({ page }) => {
    const cells = column(page, 'Week', 'Monday').locator('.play-cell');
    const target = await cells.nth(3).boundingBox();
    await dragTo(page, cells.getByText('Write the brief', { exact: true }), { x: (target?.x ?? 0) + 10, y: (target?.y ?? 0) + 30 });
    const titles = await cellTitles(page, 'Week', 'Monday');
    expect(titles.indexOf('Write the brief')).toBeGreaterThan(1);
    expect(titles[1]).toBe('Call Mika');
  });

  test('moves a cell into another list', async ({ page }) => {
    const ideas = column(page, 'Studio', 'Ideas').locator('.play-cell');
    const target = await ideas.nth(0).boundingBox();
    await dragTo(page, page.getByText('Groceries', { exact: true }), { x: (target?.x ?? 0) + 10, y: (target?.y ?? 0) + 5 });
    expect(await cellTitles(page, 'Studio', 'Ideas')).toContain('Groceries');
    expect(await cellTitles(page, 'Week', 'Monday')).not.toContain('Groceries');
  });

  test('moves a column by its name', async ({ page }) => {
    const week = page.getByRole('region', { name: 'Week' });
    const wednesday = await week.locator('.play-column__name', { hasText: 'Wednesday' }).boundingBox();
    await dragTo(page, week.locator('.play-column__name', { hasText: 'Monday' }), { x: (wednesday?.x ?? 0) + 70, y: (wednesday?.y ?? 0) + 10 });
    await expect(week.locator('.play-column__name').first()).toHaveText('Tuesday');
  });

  test('moves a cell with the keyboard', async ({ page }) => {
    await page.getByText('Write the brief', { exact: true }).focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowRight']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
    }
    await page.keyboard.press('Space');
    await page.waitForTimeout(700);
    expect(await cellTitles(page, 'Week', 'Tuesday')).toContain('Write the brief');
    expect(await cellTitles(page, 'Week', 'Monday')).not.toContain('Write the brief');
  });

  test('measures the drag', async ({ page }) => {
    const cells = column(page, 'Week', 'Monday').locator('.play-cell');
    const target = await cells.nth(3).boundingBox();
    await dragTo(page, cells.getByText('Call Mika', { exact: true }), { x: (target?.x ?? 0) + 10, y: (target?.y ?? 0) + 30 });
    await expect(page.locator('.readout')).toContainText('frames a second');
  });
});
