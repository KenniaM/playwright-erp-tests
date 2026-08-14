import { test, expect } from '@playwright/test';
import {
  espiarErroresJS,
  RecepcionPage,
  TAB_GRAFICOS,
  TIMEOUTS,
  validarSinErrores,
} from './recepcion.page';

// ─────────────────────────────────────────────────────────────────────────────
// recepcion-graficos.spec.ts — funcionalidades específicas del tab GRÁFICOS:
// filtros (mecánico, servicio, subservicio, fechas, formato) y la opción
// "Ver mas" de cada uno de los 4 KPIs (Facturados/Rechazados, último mes/año).
// ─────────────────────────────────────────────────────────────────────────────

test('Gráficos: los filtros (mecánico, servicio, fechas) cambian el contenido mostrado', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_GRAFICOS);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);

  await test.step('Abrir el módulo y entrar al tab Gráficos', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_GRAFICOS);
  });

  const contenedor = recepcion.contenedorGraficos;

  await test.step('Filtrar por el primer mecánico real disponible y validar que el contenido cambia', async () => {
    const textoAntes = await contenedor.innerText();
    await recepcion.seleccionarPrimeraOpcionChosen('#mechanics_select');
    await recepcion.buscarGraficos();
    await expect.poll(() => contenedor.innerText(), { timeout: TIMEOUTS.CARGA }).not.toBe(textoAntes);
  });

  await test.step('Filtrar además por un rango de fechas y validar que el contenido vuelve a cambiar', async () => {
    const textoAntes = await contenedor.innerText();
    const hoy = new Date();
    const haceUnAnio = new Date(hoy.getTime() - 365 * 24 * 60 * 60 * 1000);
    const formato = (d: Date) => d.toISOString().slice(0, 10);

    await recepcion.establecerFechasGraficos(formato(haceUnAnio), formato(hoy));
    await recepcion.buscarGraficos();
    await expect.poll(() => contenedor.innerText(), { timeout: TIMEOUTS.CARGA }).not.toBe(textoAntes);
  });

  await test.step('Refrescar el caché de Gráficos', async () => {
    await recepcion.refrescarGraficos();
    await expect(contenedor).toBeVisible({ timeout: TIMEOUTS.CARGA });
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});


test('Gráficos: "Ver mas" de cada KPI actualiza el resumen y el gráfico', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_GRAFICOS);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);

  await test.step('Abrir el módulo y entrar al tab Gráficos', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_GRAFICOS);
  });

  const nombresKpi = ['Facturados último mes', 'Facturados último año', 'Rechazados último mes', 'Rechazados último año'];
  for (let indice = 0; indice < nombresKpi.length; indice++) {
    await test.step(`"Ver mas" en "${nombresKpi[indice]}" actualiza el resumen y el gráfico`, async () => {
      await recepcion.abrirVerMasKpiGraficos(indice);
    });
  }

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

