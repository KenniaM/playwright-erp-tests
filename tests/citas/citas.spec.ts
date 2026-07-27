import { test, expect } from '@playwright/test';
import { BASE_URL } from '../env.config';

const CITAS_URL = BASE_URL + '/reservation/reservation';

const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  CARGA:    15_000,
} as const;

test('Cargar el módulo Citas', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);

  await test.step('Navegar al módulo Citas', async () => {
    await page.goto(CITAS_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  });

  await test.step('Validar que la URL final corresponde al módulo esperado', async () => {
    expect(page.url()).toContain('reservation/reservation');
  });

  await test.step('Validar el título de la página', async () => {
    await expect(page).toHaveTitle(/citas/i);
  });

  await test.step('Validar que el calendario de citas cargó correctamente', async () => {
    await expect(page.locator('#btn_add_cita_new')).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await expect(page.locator('input[placeholder="Buscar citas, clientes..."]')).toBeVisible();
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});
