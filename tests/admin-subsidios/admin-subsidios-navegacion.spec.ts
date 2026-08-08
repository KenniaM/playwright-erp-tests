import { test, expect } from '@playwright/test';
import { AdminSubsidiosPage, SUBMODULOS_ADMIN_SUBSIDIOS, TIMEOUTS } from './admin-subsidios.page';

for (const submodulo of SUBMODULOS_ADMIN_SUBSIDIOS) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Admin. Subsidios`, async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const adminSubsidios = new AdminSubsidiosPage(page);

    await test.step(`Navegar a "${submodulo.nombre}"`, async () => {
      await adminSubsidios.irA(submodulo.url);
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
