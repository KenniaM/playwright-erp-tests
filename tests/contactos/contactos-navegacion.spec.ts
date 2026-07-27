import { test, expect } from '@playwright/test';
import { CLIENTES_ROTO, ContactosPage, SUBMODULOS_CONTACTOS, TIMEOUTS } from './contactos.page';

for (const submodulo of SUBMODULOS_CONTACTOS) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Contactos`, async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const contactos = new ContactosPage(page);

    await test.step(`Navegar a "${submodulo.nombre}"`, async () => {
      await contactos.irA(submodulo.url);
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

// Hallazgo confirmado en vivo (tres veces, en intentos separados en el
// tiempo, descartando lentitud general del ambiente): "Clientes" no carga —
// la navegación se queda colgada indefinidamente sin respuesta del servidor.
// Se documenta la falla en vez de forzar un "passing test" sobre una función
// que realmente está rota (mismo criterio que "Reporte de Inspección" en
// gestion-navegacion.spec.ts).
test('Cargar el submódulo "Clientes" — hallazgo esperado: la página nunca responde', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);

  await test.step('Confirmar que la navegación agota el tiempo de espera sin respuesta', async () => {
    let agotoTiempoDeEspera = false;
    try {
      await page.goto(CLIENTES_ROTO.url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVEGACION_ROTA });
    } catch (error) {
      agotoTiempoDeEspera = /timeout/i.test((error as Error).message);
    }
    expect(
      agotoTiempoDeEspera,
      'Se esperaba que la navegación a "Clientes" agotara el tiempo de espera (hallazgo confirmado en vivo); si esto falla, la página volvió a responder y el hallazgo debería revisarse'
    ).toBe(true);
  });
});
