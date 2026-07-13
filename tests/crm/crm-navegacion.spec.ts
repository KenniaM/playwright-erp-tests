import { test, expect } from '@playwright/test';
import { CRMPage, REPORTES_ROTO, SUBMODULOS_CRM, TIMEOUTS } from './crm.page';

for (const submodulo of SUBMODULOS_CRM) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo CRM`, async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const crm = new CRMPage(page);

    await test.step(`Navegar a "${submodulo.nombre}"`, async () => {
      await crm.irA(submodulo.url);
    });

    await test.step('Validar que la URL final corresponde al submódulo esperado', async () => {
      expect(page.url()).toContain(submodulo.rutaEsperada);
    });

    await test.step('Validar que el contenido propio del submódulo cargó correctamente', async () => {
      await expect(submodulo.obtenerLocatorDeCarga(page)).toBeVisible({ timeout: TIMEOUTS.CARGA });
    });

    await test.step('Validar que no queda ningún mensaje de error visible', async () => {
      await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    });
  });
}

// Hallazgo confirmado en vivo (dos veces, en aislamiento, con goto directo y
// siguiendo el href real del link del menú): "Reportes" no carga — la
// petición a CRM/report responde 302 y termina en la página 404 del sistema.
// Se documenta la falla en vez de forzar un "passing test" sobre una función
// que realmente está rota (mismo criterio que "Reporte de Inspección" en
// gestion-navegacion.spec.ts).
test('Cargar el submódulo "Reportes" — hallazgo esperado: redirige a la página 404', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const crm = new CRMPage(page);

  await test.step('Navegar a "Reportes"', async () => {
    await crm.irA(REPORTES_ROTO.url);
  });

  await test.step('Confirmar que la navegación termina en la página 404 del sistema', async () => {
    await expect(page).toHaveURL(/error\/404/);
    await expect(page).toHaveTitle(/404/i);
  });
});
