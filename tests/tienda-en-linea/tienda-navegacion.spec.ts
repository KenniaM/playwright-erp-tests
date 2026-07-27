import { test, expect } from '@playwright/test';
import { SUBMODULOS_TIENDA, TIMEOUTS, TiendaPage, VER_TIENDA_ROTO } from './tienda.page';

for (const submodulo of SUBMODULOS_TIENDA) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Tienda en Linea`, async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const tienda = new TiendaPage(page);

    await test.step(`Navegar a "${submodulo.nombre}"`, async () => {
      await tienda.irA(submodulo.url);
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

// Hallazgo confirmado en vivo (dos veces, en aislamiento): "Ver la Tienda"
// no carga — la navegación entra en un bucle de redirecciones
// (net::ERR_TOO_MANY_REDIRECTS) y nunca llega a renderizar. Se documenta la
// falla en vez de forzar un "passing test" sobre una función que realmente
// está rota (mismo criterio que "Reporte de Inspección" en
// gestion-navegacion.spec.ts).
test('Cargar el submódulo "Ver la Tienda" — hallazgo esperado: bucle de redirecciones', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);

  await test.step('Confirmar que la navegación falla por exceso de redirecciones', async () => {
    let fueBucleDeRedirecciones = false;
    try {
      await page.goto(VER_TIENDA_ROTO.url, { timeout: TIMEOUTS.NAVEGACION_ROTA });
    } catch (error) {
      fueBucleDeRedirecciones = /ERR_TOO_MANY_REDIRECTS/i.test((error as Error).message);
    }
    expect(
      fueBucleDeRedirecciones,
      'Se esperaba que la navegación a "Ver la Tienda" fallara por ERR_TOO_MANY_REDIRECTS (hallazgo confirmado en vivo); si esto falla, la página volvió a responder y el hallazgo debería revisarse'
    ).toBe(true);
  });
});
