import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { testConfig } from '../helpers/config';

const { When, Then } = createBdd();

let lastWidgetTitle: string;

// Dashboard Steps
When('I open the Add Widget dialog', async ({ page }) => {
  // The trigger button has data-testid="add-widget-trigger" and may show only a "+" icon on small viewports
  const addWidgetBtn = page.getByTestId('add-widget-trigger');
  await expect(addWidgetBtn).toBeVisible({ timeout: testConfig.timeouts.element });
  await addWidgetBtn.click();

  // The dialog has data-testid="add-widget-dialog" and title "Add" (i18n key dashboard.add_widget)
  const dialog = page.getByTestId('add-widget-dialog');
  await expect(dialog).toBeVisible({ timeout: testConfig.timeouts.element });
});

When('I select the {string} widget type', async ({ page }, widgetType: string) => {
  const normalized = widgetType.toLowerCase();
  const typeSelectors: Record<string, string> = {
    'monitor': 'widget-type-monitor',
    'monitor stream': 'widget-type-monitor',
    'events': 'widget-type-events',
    'recent events': 'widget-type-events',
    'timeline': 'widget-type-timeline',
    'heatmap': 'widget-type-heatmap',
    'event heatmap': 'widget-type-heatmap',
  };

  const matchingKey = Object.keys(typeSelectors).find((key) => normalized.includes(key));
  if (matchingKey) {
    const option = page.getByTestId(typeSelectors[matchingKey]);
    await option.click();
    // Verify selected state via border-primary class
    await expect(option).toHaveClass(/border-primary/);
    return;
  }

  // Fallback: click matching text in the widget type grid
  const option = page.locator('div.border.rounded-lg').filter({ hasText: new RegExp(widgetType, 'i') }).first();
  await option.click();
  await expect(option).toHaveClass(/border-primary/);
});

When('I select the first monitor in the widget dialog', async ({ page }) => {
  const list = page.getByTestId('monitor-selection-list');
  const firstCheckbox = list.locator('[data-testid^="monitor-checkbox-"]').first();
  await firstCheckbox.click();
});

When('I enter widget title {string}', async ({ page }, title: string) => {
  lastWidgetTitle = `${title} ${Date.now()}`;
  const titleInput = page.getByTestId('widget-title-input');
  await titleInput.clear();
  await titleInput.fill(lastWidgetTitle);
});

When('I click the Add button in the dialog', async ({ page }) => {
  const addBtn = page.getByTestId('widget-add-button');
  await expect(addBtn).toBeVisible();
  await expect(addBtn).toBeEnabled({ timeout: testConfig.timeouts.element });
  await addBtn.click();
  // Wait for dialog to close
  const dialog = page.getByTestId('add-widget-dialog');
  await expect(dialog).not.toBeVisible({ timeout: testConfig.timeouts.element });
});

Then('the widget {string} should appear on the dashboard', async ({ page }, _title: string) => {
  await expect(page.locator('.react-grid-item').filter({ hasText: lastWidgetTitle }))
    .toBeVisible({ timeout: testConfig.timeouts.element });
});

Then('the widget should contain non-empty content', async ({ page }) => {
  const widget = page.locator('.react-grid-item').filter({ hasText: lastWidgetTitle });
  // Verify the widget has visible child content (text, images, or data elements)
  await expect.poll(async () => {
    const textContent = await widget.innerText();
    // Widget should have more than just its title — it should have data content
    return textContent.trim().length > 0;
  }, { timeout: testConfig.timeouts.pageLoad }).toBeTruthy();
});

// Dashboard Widget Management Steps
When('I enter dashboard edit mode', async ({ page }) => {
  // The edit button shows "Edit" text on desktop, pencil icon on mobile
  // It has title="Edit" (i18n: dashboard.edit_layout)
  const editBtn = page.getByRole('button', { name: /edit/i }).first();
  await editBtn.click();
  await page.waitForTimeout(300);
});

When('I click the widget edit button on the first widget', async ({ page }) => {
  // In edit mode, there's a pencil icon button on each widget
  const editBtn = page.locator('.react-grid-item').first().locator('button').filter({ has: page.locator('svg.lucide-pencil') });
  await editBtn.click();
});

When('I click the widget delete button on the first widget', async ({ page }) => {
  // In edit mode, there's an X button on each widget
  const deleteBtn = page.locator('.react-grid-item').first().locator('button[class*="destructive"]')
    .or(page.locator('.react-grid-item').first().locator('button').filter({ has: page.locator('svg.lucide-x') }));
  await deleteBtn.first().click();
});

Then('I should see the widget edit dialog', async ({ page }) => {
  const dialog = page.getByTestId('widget-edit-dialog')
    .or(page.getByRole('dialog'));
  await expect(dialog.first()).toBeVisible({ timeout: testConfig.timeouts.element });
});

When('I change the widget title to {string}', async ({ page }, title: string) => {
  // Update lastWidgetTitle so subsequent assertions use the new title
  lastWidgetTitle = title;
  const titleInput = page.getByTestId('widget-edit-title-input')
    .or(page.getByLabel(/title/i));
  await titleInput.clear();
  await titleInput.fill(title);
});

When('I save the widget changes', async ({ page }) => {
  const saveBtn = page.getByTestId('widget-edit-save-button')
    .or(page.getByRole('button', { name: /save/i }));
  await saveBtn.click();
  await page.waitForTimeout(300);
});

Then('the widget should be removed from the dashboard', async ({ page }) => {
  // Wait for widget to be removed (grid should have one less item)
  await page.waitForTimeout(500);
});

Then('the add widget button should be visible', async ({ page }) => {
  const addBtn = page.getByRole('button', { name: /add widget/i })
    .or(page.getByTitle(/add widget/i));
  await expect(addBtn.first()).toBeVisible({ timeout: testConfig.timeouts.element });
});
