import { test as setup, expect } from '@playwright/test';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('https://dev.designsoftcr.com/qa_talleralpha/public/log/login');

  await page.locator('input[name="email"]').fill('kadmin@gmail.com');
  await page.locator('input[name="password"]').fill('qa0000');

  await page.locator('#loginButton').click();

  await expect(page.locator('#dashboardTitle')).toBeVisible({ timeout: 60000 });

  await page.context().storageState({
    path: 'playwright/.auth/admin.json'
  });
});
/*import { test as setup } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('https://dev.designsoftcr.com/qa_talleralpha/public/log/login');

  await page.locator('input[name="email"]').fill('kadmin@gmail.com');
  await page.locator('input[name="password"]').fill('qa0000');
  await page.locator('#loginButton').click();

  await page.waitForLoadState('networkidle');

  await page.context().storageState({
    path: 'playwright/.auth/admin.json',
  });
});*/