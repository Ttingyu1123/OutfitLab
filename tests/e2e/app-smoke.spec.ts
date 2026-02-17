import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('shows API key modal on first load', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Gemini API Key/i })).toBeVisible();
  await expect(page.getByPlaceholder('AIza...')).toBeVisible();
  await expect(page.getByRole('button', { name: /Save|儲存|保存/i })).toBeVisible();
});

test('language switcher updates modal title', async ({ page }) => {
  await page.goto('/');
  await page.locator('select').first().selectOption('en');
  await expect(page.getByRole('heading', { name: 'Enter your Gemini API Key' })).toBeVisible();

  await page.locator('select').first().selectOption('ja');
  await expect(page.getByRole('heading', { name: 'Gemini API Key を入力' })).toBeVisible();

  await page.locator('select').first().selectOption('ko');
  await expect(page.getByRole('heading', { name: 'Gemini API Key 입력' })).toBeVisible();
});

test('save key then open API key status panel', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('AIza...').fill('AIzaFAKE_TEST_KEY_1234567890');
  await page.getByRole('button', { name: /Save|儲存|保存|저장/i }).first().click();

  await expect(page.getByText('OutfitLab')).toBeVisible();

  await page.getByTitle('API Key Status').click();
  await expect(page.getByText('API Key Status')).toBeVisible();
  await expect(page.getByText(/Connected|Not Set/)).toBeVisible();
});
