import { test, expect } from '@playwright/test';
import { PANEL_CONTROL_URL } from './panel-control.page';
import { SUBMODULOS_CONFIGURACIONES, TIMEOUTS } from './configuraciones.page';

test('Cargar el submódulo "Panel de control" del módulo Configuración', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);

  await test.step('Navegar a "Panel de control"', async () => {
    await page.goto(PANEL_CONTROL_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  });

  await test.step('Validar que la URL final corresponde al submódulo esperado', async () => {
    expect(page.url()).toContain('sett/setting');
  });

  await test.step('Validar el título de la página', async () => {
    await expect(page).toHaveTitle(/panel de control/i);
  });

  await test.step('Validar que el contenido propio del submódulo cargó correctamente', async () => {
    await expect(page.locator('#input_search_setting')).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await expect(page.locator('#save_settings')).toBeVisible();
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});

for (const submodulo of SUBMODULOS_CONFIGURACIONES) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Configuración`, async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);

    await test.step(`Navegar a "${submodulo.nombre}"`, async () => {
      await page.goto(submodulo.url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    });

    await test.step('Validar que la URL final corresponde al submódulo esperado', async () => {
      expect(page.url()).toContain(submodulo.rutaEsperada);
    });

    await test.step('Validar el título de la página', async () => {
      await expect(page).toHaveTitle(submodulo.tituloEsperado);
    });

    await test.step('Validar que el contenido propio del submódulo cargó correctamente', async () => {
      await expect(submodulo.obtenerLocatorDeCarga(page)).toBeVisible({ timeout: TIMEOUTS.CARGA });
    });

    await test.step('Validar que no queda ningún mensaje de error visible', async () => {
      await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    });
  });
}
