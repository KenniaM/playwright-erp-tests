import { test, expect } from '@playwright/test';
import { BASE_URL } from '../env.config';

const PERSONALIZA_MODULOS_URL = BASE_URL + '/dash/marketplace';

const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  CARGA:    15_000,
} as const;

test('Cargar el módulo Personaliza tus Módulos', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);

  await test.step('Navegar al módulo Personaliza tus Módulos', async () => {
    await page.goto(PERSONALIZA_MODULOS_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  });

  await test.step('Validar que la URL final corresponde al módulo esperado', async () => {
    expect(page.url()).toContain('dash/marketplace');
  });

  await test.step('Validar el título de la página', async () => {
    await expect(page).toHaveTitle(/marketplace de m[oó]dulos/i);
  });

  await test.step('Validar que el catálogo de módulos cargó correctamente', async () => {
    await expect(page.locator('#section_marketplace')).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await expect(page.locator('[id^="mp-module-"]').first()).toBeVisible();
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});
