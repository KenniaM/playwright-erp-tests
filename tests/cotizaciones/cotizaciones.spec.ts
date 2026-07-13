import { test, expect } from '@playwright/test';

// URL confirmada por el usuario: el link "Cotizaciones" del menú lateral
// (distinto del atajo "Cotizaciones" que abre el POS en la pestaña PROFORMA).
const COTIZACIONES_URL = 'https://dev.designsoftcr.com/qa_talleralpha/public/proform/printPosProform';

const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  CARGA:    15_000,
} as const;

test('Cargar el módulo Cotizaciones', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);

  await test.step('Navegar al módulo Cotizaciones', async () => {
    await page.goto(COTIZACIONES_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  });

  await test.step('Validar que la URL final corresponde al módulo esperado', async () => {
    expect(page.url()).toContain('proform/printPosProform');
  });

  await test.step('Validar el título de la página', async () => {
    await expect(page).toHaveTitle(/proformas/i);
  });

  await test.step('Validar que el encabezado y los filtros de "Ver cotizaciones" cargaron correctamente', async () => {
    await expect(page.locator('.content-header', { hasText: /ver cotizaciones/i })).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await expect(page.locator('#btn_proform')).toBeVisible();
    await expect(page.locator('input[placeholder="Buscar"]')).toBeVisible();
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});
