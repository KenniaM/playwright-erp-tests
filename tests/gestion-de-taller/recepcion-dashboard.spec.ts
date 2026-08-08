import { test, expect } from '@playwright/test';
import {
  espiarErroresJS,
  RecepcionPage,
  TAB_DASHBOARD,
  TIMEOUTS,
  validarSinErrores,
} from './recepcion.page';

// ─────────────────────────────────────────────────────────────────────────────
// recepcion-dashboard.spec.ts — funcionalidades específicas del tab DASHBOARD:
// filtros de periodo (Hoy/Semana/Mes/Rango), Vista General (KPIs + Flujo
// operativo del taller) y las 4 pestañas aún sin implementar en este
// ambiente (Mecánicos/Finanzas/Citas/Repuestos).
// ─────────────────────────────────────────────────────────────────────────────

test('Dashboard: los filtros de periodo (Hoy/Semana/Mes/Rango) cambian la información mostrada', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_DASHBOARD);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  const contenedor = page.locator(TAB_DASHBOARD.contenedorContenido);

  await test.step('Abrir el módulo y entrar al tab Dashboard', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_DASHBOARD);
  });

  for (const periodo of ['Hoy', 'Semana', 'Mes'] as const) {
    await test.step(`Aplicar el filtro "${periodo}" y validar que el periodo mostrado corresponde`, async () => {
      await recepcion.seleccionarPeriodoDashboard(periodo);
      await expect(contenedor, `El Dashboard no reflejó el periodo "${periodo}" tras aplicarlo`).toContainText(
        new RegExp(`${periodo}\\s*·`)
      );
    });
  }

  await test.step('Aplicar un rango de fechas personalizado y validar que se refleja', async () => {
    const hoy = new Date();
    const hace7 = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
    const formato = (d: Date) => d.toISOString().slice(0, 10);

    await recepcion.aplicarRangoDashboard(formato(hace7), formato(hoy));
    await expect(contenedor, 'El Dashboard no reflejó el rango de fechas personalizado aplicado').toContainText(/Rango\s*·/);
  });

  await test.step('Volver a "Hoy" para limpiar el filtro de rango', async () => {
    await recepcion.seleccionarPeriodoDashboard('Hoy');
    await expect(contenedor).toContainText(/Hoy\s*·/);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});


test('Dashboard: Vista General muestra sus KPIs y la sección "Flujo operativo del taller"', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_DASHBOARD);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);

  await test.step('Abrir el módulo, entrar al Dashboard y seleccionar "Vista General"', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_DASHBOARD);
    await recepcion.seleccionarVistaDashboard('Vista General');
  });

  await test.step('Validar que las tarjetas KPI de Vista General son visibles y tienen valores', async () => {
    const kpis = page.locator(TAB_DASHBOARD.contenedorContenido).locator('.js-vrd-open-detail.vrd-kpi-action');
    await expect(kpis.first()).toBeVisible({ timeout: TIMEOUTS.CARGA });
    expect(await kpis.count()).toBeGreaterThanOrEqual(6);
  });

  await test.step('Validar que "Flujo operativo del taller" carga con datos por columna del tablero', async () => {
    const seccion = page.locator('.vrd-section-title', { hasText: 'Flujo operativo del taller' });
    await expect(seccion, 'La sección "Flujo operativo del taller" no está visible').toBeVisible({ timeout: TIMEOUTS.CARGA });

    const verOrdenes = page.locator(TAB_DASHBOARD.contenedorContenido).locator('.js-vrd-open-detail.vrd-stage-action');
    expect(await verOrdenes.count(), 'No hay ninguna tarjeta de columna en "Flujo operativo del taller"').toBeGreaterThan(0);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});


test('Dashboard: las pestañas Mecánicos/Finanzas/Citas/Repuestos cargan (estado real: "disponible en una siguiente entrega")', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_DASHBOARD);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);

  await test.step('Abrir el módulo y entrar al Dashboard', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_DASHBOARD);
  });

  for (const vista of ['Mecánicos', 'Finanzas', 'Citas', 'Repuestos'] as const) {
    await test.step(`Seleccionar "${vista}" y validar que carga sin errores (pestaña aún no implementada en este ambiente)`, async () => {
      await recepcion.seleccionarVistaDashboard(vista);
      expect(await recepcion.dashboardMuestraPestanaPendiente(), `"${vista}" no mostró la leyenda esperada de pestaña pendiente`).toBe(true);
    });
  }

  await test.step('Volver a "Vista General"', async () => {
    await recepcion.seleccionarVistaDashboard('Vista General');
    expect(await recepcion.dashboardMuestraPestanaPendiente()).toBe(false);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

