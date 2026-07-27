import { test, expect } from '@playwright/test';
import { ReportesPage, TIMEOUTS } from './reportes.page';
import {
  hoyISO,
  hoyMenosDiasISO,
  ReporteCierreCajaPage,
  ReporteMovimientosCajaPage,
  SUBMODULOS_REPORTES_CAJA,
} from './rp-caja.page';

for (const submodulo of SUBMODULOS_REPORTES_CAJA) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Reportes > Caja`, async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const reportes = new ReportesPage(page);

    await test.step(`Navegar a "${submodulo.nombre}"`, async () => {
      await reportes.irA(submodulo.url);
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

// ─── Reporte de Movimientos de Caja ────────────────────────────────────────
//
// Analizado en vivo (ver comentario de ReporteMovimientosCajaPage en
// rp-caja.page.ts): no existe exportación a PDF ni ningún filtro adicional
// (usuario/caja/estado/sucursal) en este reporte — no se crean pruebas para
// esas funcionalidades porque no existen.

test.describe('Reporte de Movimientos de Caja', () => {
  test('carga la tabla con sus columnas y sin errores, incluso sin resultados', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const movimientos = new ReporteMovimientosCajaPage(page);

    await test.step('Abrir el reporte', async () => {
      await movimientos.abrir();
    });

    await test.step('La tabla es visible', async () => {
      await movimientos.validarTabla();
    });

    await test.step('Sin resultados no hay mensaje de error (la tabla del ambiente de QA no tiene movimientos registrados)', async () => {
      await movimientos.validarSinErrores();
    });
  });

  test('el rango de fechas se puede ampliar y la búsqueda sigue funcionando sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const movimientos = new ReporteMovimientosCajaPage(page);
    await movimientos.abrir();

    const filasRangoCorto = await test.step('Buscar con el rango por defecto (hoy)', async () => {
      await movimientos.aumentarRangoFechas(hoyISO(), hoyISO());
      await movimientos.buscar();
      return movimientos.contarFilas();
    });

    await test.step('Ampliar el rango a los últimos 2 años y buscar de nuevo', async () => {
      await movimientos.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
      await movimientos.buscar();
    });

    await test.step('El reporte sigue funcionando: la tabla es visible y no hay menos resultados que con el rango corto', async () => {
      await movimientos.validarTabla();
      await expect.poll(() => movimientos.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThanOrEqual(filasRangoCorto);
      await movimientos.validarSinErrores();
    });
  });

  test('la búsqueda por texto filtra los resultados y limpiarla los restaura', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const movimientos = new ReporteMovimientosCajaPage(page);
    await movimientos.abrir();
    await movimientos.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await movimientos.buscar();

    const totalSinFiltrar = await movimientos.contarFilas();
    test.skip(
      totalSinFiltrar === 0,
      'El ambiente de QA no tiene movimientos de caja registrados en ningún rango — no hay datos reales para validar el filtrado por texto.'
    );

    await test.step('Buscar un término que no debería coincidir con ningún registro', async () => {
      await movimientos.buscar('zzzz_termino_que_no_existe_9999');
      await expect.poll(() => movimientos.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeLessThan(totalSinFiltrar);
    });

    await test.step('Limpiar la búsqueda restaura todos los resultados', async () => {
      await movimientos.limpiarBusqueda();
      await expect.poll(() => movimientos.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalSinFiltrar);
    });
  });

  test('el botón "Descargar" exporta un Excel, incluso con la tabla vacía', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const movimientos = new ReporteMovimientosCajaPage(page);
    await movimientos.abrir();
    await movimientos.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await movimientos.buscar();

    const descarga = await movimientos.descargarExcel();
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });
});

// ─── Reporte de Cierres de Caja ────────────────────────────────────────────
//
// Analizado en vivo (ver comentario de ReporteCierreCajaPage en
// rp-caja.page.ts): no existe exportación a PDF ni ningún filtro adicional
// (usuario/caja/estado/sucursal) en este reporte — no se crean pruebas para
// esas funcionalidades porque no existen.

test.describe('Reporte de Cierres de Caja', () => {
  test('carga la tabla con datos reales y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cierres = new ReporteCierreCajaPage(page);

    await test.step('Abrir el reporte', async () => {
      await cierres.abrir();
    });

    await test.step('La tabla es visible', async () => {
      await cierres.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await cierres.validarSinErrores();
    });
  });

  test('el rango de fechas se puede ampliar y la búsqueda sigue funcionando sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cierres = new ReporteCierreCajaPage(page);
    await cierres.abrir();

    const filasRangoCorto = await test.step('Aplicar un rango corto (últimos 7 días)', async () => {
      await cierres.aumentarRangoFechas(hoyMenosDiasISO(7), hoyISO());
      await cierres.buscar();
      return cierres.contarFilas();
    });

    await test.step('Ampliar el rango a todo el año en curso y volver a buscar', async () => {
      await cierres.aumentarRangoFechas(hoyMenosDiasISO(365), hoyISO());
      await cierres.buscar();
    });

    await test.step('El reporte sigue funcionando: la tabla es visible y no hay menos resultados que con el rango corto', async () => {
      await cierres.validarTabla();
      await expect.poll(() => cierres.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThanOrEqual(filasRangoCorto);
      await cierres.validarSinErrores();
    });
  });

  test('la búsqueda por texto filtra por el cajero real y limpiarla restaura todos los registros', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cierres = new ReporteCierreCajaPage(page);
    await cierres.abrir();
    await cierres.aumentarRangoFechas(hoyMenosDiasISO(365), hoyISO());
    await cierres.buscar();

    const totalSinFiltrar = await cierres.contarFilas();
    test.skip(totalSinFiltrar === 0, 'El ambiente de QA no tiene cierres de caja registrados en el rango probado.');

    const termino = await test.step('Tomar el cajero de la primera fila como término de búsqueda', async () => {
      const cajeroCompleto = await cierres.obtenerCajeroDeFila(0);
      return cajeroCompleto.trim().split(/\s+/)[0];
    });

    await test.step('Buscar por ese término', async () => {
      await cierres.buscar(termino);
      await expect.poll(() => cierres.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThan(0);
    });

    await test.step('Cada fila visible corresponde al término buscado', async () => {
      const filasFiltradas = await cierres.contarFilas();
      for (let i = 0; i < filasFiltradas; i++) {
        const cajero = await cierres.obtenerCajeroDeFila(i);
        expect(cajero.toLowerCase()).toContain(termino.toLowerCase());
      }
    });

    await test.step('Limpiar la búsqueda restaura todos los registros', async () => {
      await cierres.limpiarBusqueda();
      await expect.poll(() => cierres.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalSinFiltrar);
    });
  });

  test('"Descargar Excel" genera un archivo .xlsx tanto en la variante resumen como en la detallada', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cierres = new ReporteCierreCajaPage(page);
    await cierres.abrir();

    const total = await cierres.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene cierres de caja registrados en el rango por defecto.');

    await test.step('Descargar la variante "Solo cierre de caja"', async () => {
      const descarga = await cierres.descargarExcelResumen();
      expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
    });

    await test.step('Descargar la variante "Detallado"', async () => {
      const descarga = await cierres.descargarExcelDetalle();
      expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
    });
  });

  test('el menú de acciones de una fila expone "Ver Detalle", "Enviar por correo" y "Enviar por WhatsApp"', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cierres = new ReporteCierreCajaPage(page);
    await cierres.abrir();

    const total = await cierres.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene cierres de caja registrados en el rango por defecto.');

    const opciones = await cierres.obtenerOpcionesAccionesFila(0);
    const textoOpciones = opciones.join(' | ').toLowerCase();

    expect(textoOpciones).toContain('ver detalle');
    expect(textoOpciones).toContain('enviar por correo');
    expect(textoOpciones).toMatch(/enviar por whats?app/);
  });
});
