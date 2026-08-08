import { test, expect } from '@playwright/test';
import {
  espiarErroresJS,
  RecepcionPage,
  TAB_TABLA_INFORMATIVA,
  TIMEOUTS,
  validarSinErrores,
} from './recepcion.page';

// ─────────────────────────────────────────────────────────────────────────────
// recepcion-tabla-informativa.spec.ts — funcionalidades específicas del tab
// TABLA INFORMATIVA: filtros (mecánico y fechas) y los 3 totales al pie
// (Facturación, Mano de obra, Utilidad), validados matemáticamente contra la
// suma real de las filas de la tabla.
// ─────────────────────────────────────────────────────────────────────────────

test('Tabla informativa: los filtros (mecánico y fechas) cambian los datos mostrados', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_TABLA_INFORMATIVA);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);

  await test.step('Abrir el módulo y entrar al tab Tabla informativa', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_TABLA_INFORMATIVA);
  });

  const contenedor = recepcion.contenedorTablaInformativa;

  await test.step('Filtrar por el primer mecánico real disponible y validar que la tabla cambia', async () => {
    const textoAntes = await contenedor.innerText();
    await recepcion.seleccionarPrimeraOpcionChosen('#slt_mechanics_select');
    await recepcion.buscarTablaInformativa();
    await expect.poll(() => contenedor.innerText(), { timeout: TIMEOUTS.CARGA }).not.toBe(textoAntes);
  });

  await test.step('Filtrar además por un rango de fechas y validar que la tabla vuelve a cambiar', async () => {
    const textoAntes = await contenedor.innerText();
    const hoy = new Date();
    const haceUnAnio = new Date(hoy.getTime() - 365 * 24 * 60 * 60 * 1000);
    const formato = (d: Date) => d.toISOString().slice(0, 10);

    await recepcion.establecerFechasTablaInformativa(formato(haceUnAnio), formato(hoy));
    await recepcion.buscarTablaInformativa();
    await expect.poll(() => contenedor.innerText(), { timeout: TIMEOUTS.CARGA }).not.toBe(textoAntes);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});


test('Tabla informativa: los totales de Facturación, Mano de obra y Utilidad son coherentes con las filas mostradas', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_TABLA_INFORMATIVA);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);

  await test.step('Abrir el módulo, entrar a Tabla informativa y validar que los 3 totales son visibles', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_TABLA_INFORMATIVA);
    await expect(page.locator('#lb_mechanics_subservice_total')).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await expect(page.locator('#lb_workforce_mechanics_subservice')).toBeVisible();
    await expect(page.locator('#lb_utility_mechanics_subservice')).toBeVisible();
  });

  await test.step('Comparar el total de "Facturado" mostrado contra la suma real de las filas visibles', async () => {
    const totalMostrado = await recepcion.totalFacturadoTablaInformativa();
    const totalCalculado = await recepcion.totalFacturadoDesdeFilas();
    expect(totalCalculado, 'La suma de "TOTAL FACTURADO" de las filas no coincide con el total mostrado al pie').toBeCloseTo(totalMostrado, 1);
  });

  await test.step('Comparar el total de "Utilidad" mostrado contra la suma real de las filas visibles', async () => {
    const totalMostrado = await recepcion.totalUtilidadTablaInformativa();
    const totalCalculado = await recepcion.totalUtilidadDesdeFilas();
    expect(totalCalculado, 'La suma de "TOTAL UTILIDAD" de las filas no coincide con el total mostrado al pie').toBeCloseTo(totalMostrado, 1);
  });

  await test.step('Comparar el total de "Mano de obra" mostrado contra la suma real de las filas visibles', async () => {
    const totalMostrado = await recepcion.totalManoObraTablaInformativa();
    const totalCalculado = await recepcion.costoManoObraDesdeFilas();
    expect(totalCalculado, 'La suma de "COSTO MANO OBRA" de las filas no coincide con el total mostrado al pie').toBeCloseTo(totalMostrado, 1);
  });

  await test.step('Filtrar por el primer mecánico real y validar que los totales se recalculan de forma coherente', async () => {
    await recepcion.seleccionarPrimeraOpcionChosen('#slt_mechanics_select');
    await recepcion.buscarTablaInformativa();

    const totalMostrado = await recepcion.totalFacturadoTablaInformativa();
    const totalCalculado = await recepcion.totalFacturadoDesdeFilas();
    expect(totalCalculado, 'Tras filtrar por mecánico, el total "Facturado" no coincide con la suma de las filas').toBeCloseTo(totalMostrado, 1);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

