import { test, expect } from '@playwright/test';
import { RutasPage, TIMEOUTS } from './rutas.page';

test('Carga del módulo Admin. Rutas', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const rutas = new RutasPage(page);

  await test.step('Navegar al módulo Admin. Rutas', async () => {
    await rutas.irARutas();
  });

  await test.step('Esperar a que la tabla de rutas termine de cargar (AJAX)', async () => {
    await rutas.esperarFilasCargadas();
  });

  await test.step('Validar título, buscador y botón "Agregar Nueva Ruta"', async () => {
    await expect(page.locator('body')).toContainText(/administrar rutas/i);
    await expect(rutas.buscador).toBeVisible();
    await expect(rutas.botonBuscar).toBeVisible();
    await expect(rutas.botonAgregar).toBeVisible();
  });

  await test.step('Validar que el listado tiene al menos una ruta', async () => {
    const cantidad = await rutas.filasRutas.count();
    expect(cantidad, 'El listado de rutas está vacío').toBeGreaterThan(0);
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});
