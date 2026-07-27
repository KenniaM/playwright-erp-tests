import { test, expect } from '@playwright/test';
import { BASE_URL } from '../env.config';

// URL confirmada por el usuario: el link "Cotizaciones" del menú lateral
// (distinto del atajo "Cotizaciones" que abre el POS en la pestaña PROFORMA).
const COTIZACIONES_URL = BASE_URL + '/proform/printPosProform';

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
    // Antes: locator('input[placeholder="Buscar"]') — ambiguo (modo estricto
    // de Playwright falla con "resolved to 2 elements") en cualquier
    // ambiente/compañía donde el buscador global del menú lateral
    // (#sidebar_menu_search) también esté presente y comparta el mismo
    // placeholder "Buscar" que el buscador real de esta pantalla
    // (#receip_search) — confirmado en vivo contra qa_restaurant. El ID real
    // del buscador de "Ver cotizaciones" es #receip_search en ambos
    // ambientes, así que apuntar directo a él es además más preciso que el
    // placeholder en el ambiente original.
    await expect(page.locator('#receip_search')).toBeVisible();
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});
