import { test, expect } from '@playwright/test';
import {
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

// ─── Submódulos de Configuración (submenú propio dentro de Gestión de Taller) ─

for (const submodulo of SUBMODULOS_TALLER_CONFIGURACION) {
  cargarSubmoduloYValidar(submodulo);
}
