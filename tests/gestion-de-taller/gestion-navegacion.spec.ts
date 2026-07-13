import { test, expect } from '@playwright/test';
import {
  REPORTE_INSPECCION_ROTO,
  SUBMODULOS_TALLER_CONFIGURACION,
  SUBMODULOS_TALLER_PRINCIPALES,
  SubmoduloTaller,
  TallerPage,
  TIMEOUTS,
} from './taller.page';

function cargarSubmoduloYValidar(submodulo: SubmoduloTaller) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Gestión de Taller`, async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const taller = new TallerPage(page);

    await test.step(`Navegar a "${submodulo.nombre}"`, async () => {
      await taller.irA(submodulo.url);
    });

    await test.step('Validar que la URL final corresponde al submódulo esperado', async () => {
      expect(page.url()).toContain(submodulo.rutaEsperada);
    });

    if (submodulo.tituloEsperado) {
      await test.step('Validar el título de la página', async () => {
        await expect(page).toHaveTitle(submodulo.tituloEsperado!);
      });
    }

    await test.step('Validar que el contenido propio del submódulo cargó correctamente', async () => {
      await expect(submodulo.obtenerLocatorDeCarga(page)).toBeVisible({ timeout: TIMEOUTS.CARGA });
    });

    await test.step('Validar que no queda ningún mensaje de error visible', async () => {
      await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    });
  });
}

// ─── Submódulos principales ─────────────────────────────────────────────────

for (const submodulo of SUBMODULOS_TALLER_PRINCIPALES) {
  cargarSubmoduloYValidar(submodulo);
}

// Hallazgo confirmado en vivo (dos veces, en aislamiento): "Reporte de
// Inspección" no renderiza su pantalla — el backend responde con el error de
// Laravel "Route [getOrderInspectionSearchReportExcel] not defined" en vez
// del reporte. Se documenta la falla en vez de forzar un "passing test"
// sobre una función que realmente está rota (mismo criterio que el tab
// "Twilio" en panel-control.spec.ts).
test('Cargar el submódulo "Reporte de Inspección" — hallazgo esperado: error del servidor', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const taller = new TallerPage(page);

  await test.step('Navegar a "Reporte de Inspección"', async () => {
    await taller.irA(REPORTE_INSPECCION_ROTO.url);
  });

  await test.step('Confirmar que la página no renderiza: error de Laravel visible', async () => {
    await expect(page).toHaveTitle('');
    await expect(page.getByText(/whoops/i)).toBeVisible();
  });
});

// ─── Submódulos de Configuración (submenú propio dentro de Gestión de Taller) ─

for (const submodulo of SUBMODULOS_TALLER_CONFIGURACION) {
  cargarSubmoduloYValidar(submodulo);
}
