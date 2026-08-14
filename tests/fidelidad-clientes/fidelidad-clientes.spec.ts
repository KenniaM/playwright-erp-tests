import { test, expect } from '@playwright/test';
import { BASE_URL } from '../env.config';

// Módulo de una sola pantalla (sin tabla de submódulos), visible en el
// Sidebar pero sin ninguna prueba de navegación previa — sigue la misma
// excepción ya documentada en CLAUDE.md para módulos pequeños de una sola
// pantalla (ver citas.spec.ts/cotizaciones.spec.ts): la URL y los TIMEOUTS
// se inlinean directo en el spec, sin `.page.ts` propio.

const FIDELIDAD_CLIENTES_URL = BASE_URL + '/points/points';

const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  CARGA:    15_000,
} as const;

test('Cargar el módulo Fidelidad de clientes', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);

  await test.step('Navegar al módulo Fidelidad de clientes', async () => {
    await page.goto(FIDELIDAD_CLIENTES_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  });

  await test.step('Validar que la URL final corresponde al módulo esperado', async () => {
    expect(page.url()).toContain('points/points');
  });

  await test.step('Validar el título de la página', async () => {
    await expect(page).toHaveTitle(/administrar puntos/i);
  });

  await test.step('Validar que el contenido propio del módulo cargó correctamente', async () => {
    await expect(page.locator('.content-header', { hasText: /admin\.?\s*puntos/i }).first()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});
