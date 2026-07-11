import { test as setup, expect } from '@playwright/test';

// Configurable vía variables de entorno para que la suite pueda correr
// contra cualquier cuenta/compañía del ambiente (junto con POS_COMPANIA en
// pos.page.ts) sin tocar este archivo — kadmin queda como valor por defecto
// únicamente para no romper la suite existente cuando no se define.
const EMAIL = process.env.POS_USER_EMAIL ?? 'kadmin@gmail.com';
const PASSWORD = process.env.POS_USER_PASSWORD ?? 'qa0000';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('https://dev.designsoftcr.com/qa_talleralpha/public/log/login');

  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);

  await page.locator('#loginButton').click();

  await expect(page.locator('#dashboardTitle')).toBeVisible({ timeout: 60000 });

  await page.context().storageState({
    path: 'playwright/.auth/admin.json'
  });
});