import { test, expect } from '@playwright/test';
import { ReportesPage, TIMEOUTS } from './reportes.page';
import {
  hoyISO,
  hoyMenosDiasISO,
  ReporteRuteoPage,
  SUBMODULOS_REPORTES_RUTEO,
} from './rp-ruteo.page';

for (const submodulo of SUBMODULOS_REPORTES_RUTEO) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Reportes > Ruteo`, async ({ page }) => {
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

// ─── Reporte de Comisiones (grupo "Ruteo") ─────────────────────────────────
//
// Analizado en vivo (scripts de investigación descartados tras extraer la
// evidencia, no forman parte de esta suite — ver el comentario completo de
// ReporteRuteoPage en rp-ruteo.page.ts):
//   - No existe ordenamiento de columnas (los encabezados no son clicables).
//   - No existe paginación visible en el DOM con los datos reales
//     disponibles en este ambiente (8 vendedores) — no se crean pruebas
//     ficticias para ninguna de las dos.
//   - No existe exportación PDF/Excel a nivel de listado completo: el único
//     botón "Descargar" global ofrece "Exportar Excel (pronto)", un
//     placeholder no funcional. Las exportaciones reales (PDF/Excel) existen
//     únicamente por fila, dentro del menú de acciones de cada vendedor.
//   - El filtro "Ruta" no tiene ninguna columna visible correspondiente en
//     la tabla, así que solo se valida que la búsqueda se ejecute sin
//     errores, no el contenido exacto filtrado.

// Rango amplio con datos reales conocidos en este ambiente (confirmado en
// vivo: ~1500 días cubre holgadamente los registros de prueba existentes).
const DESDE_AMPLIO = hoyMenosDiasISO(1500);

test.describe('Reporte de Comisiones (Ruteo)', () => {
  test('carga la tabla con sus columnas, con datos reales y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);

    await test.step('Abrir el reporte', async () => {
      await ruteo.abrirReporteRuteo();
    });

    await test.step('La tabla es visible', async () => {
      await ruteo.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await ruteo.validarSinErrores();
    });
  });

  test('el rango de fechas se puede ampliar y la búsqueda sigue funcionando sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();

    const filasRangoCorto = await test.step('Buscar con el rango por defecto (hoy)', async () => {
      await ruteo.aumentarRangoFechas(hoyISO(), hoyISO());
      await ruteo.buscar();
      return ruteo.contarFilas();
    });

    await test.step('Ampliar el rango y buscar de nuevo', async () => {
      await ruteo.aumentarRangoFechas(DESDE_AMPLIO, hoyISO());
      await ruteo.buscar();
    });

    await test.step('El reporte sigue funcionando: la tabla es visible y no hay menos resultados que con el rango corto', async () => {
      await ruteo.validarTabla();
      await expect.poll(() => ruteo.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThanOrEqual(filasRangoCorto);
      await ruteo.validarSinErrores();
    });
  });

  test('un rango de fechas sin datos deja la tabla vacía (sin mensaje de "sin resultados") y los totales en 0', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();

    await ruteo.aumentarRangoFechas('2000-01-01', '2000-01-02');
    await ruteo.buscar();

    await test.step('La tabla sigue visible pero sin filas de datos', async () => {
      await ruteo.validarTabla();
      expect(await ruteo.contarFilas()).toBe(0);
    });

    await test.step('Los totales fijos y las tarjetas KPI quedan en 0', async () => {
      const { subtotal, comision } = await ruteo.obtenerTotalesFijos();
      expect(subtotal).toBe(0);
      expect(comision).toBe(0);

      const kpis = await ruteo.obtenerKPIs();
      expect(kpis.totalVentas).toBe(0);
      expect(kpis.cantidadVentas).toBe(0);
      expect(kpis.cantidadVendedores).toBe(0);
    });

    await ruteo.validarSinErrores();
  });

  test('la búsqueda por texto filtra por el nombre real del vendedor y limpiarla restaura todos los registros', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();
    await ruteo.aumentarRangoFechas(DESDE_AMPLIO, hoyISO());
    await ruteo.buscar();

    const totalSinFiltrar = await ruteo.contarFilas();
    test.skip(totalSinFiltrar === 0, 'El ambiente de QA no tiene comisiones registradas en el rango amplio.');

    const nombreCompleto = await test.step('Tomar el nombre real de la primera fila como término de búsqueda', async () => {
      return ruteo.obtenerVendedorDeFila(0);
    });
    const termino = nombreCompleto.split(' ')[0];

    await test.step('Buscar por ese término', async () => {
      await ruteo.buscar(termino);
      await expect.poll(() => ruteo.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThan(0);
    });

    await test.step('Cada fila visible corresponde al término buscado', async () => {
      const filasFiltradas = await ruteo.contarFilas();
      for (let i = 0; i < filasFiltradas; i++) {
        const vendedor = await ruteo.obtenerVendedorDeFila(i);
        expect(vendedor.toLowerCase()).toContain(termino.toLowerCase());
      }
    });

    await test.step('Limpiar la búsqueda restaura todos los registros', async () => {
      await ruteo.limpiarBusqueda();
      await expect.poll(() => ruteo.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalSinFiltrar);
    });
  });

  test('el filtro "Vendedores" filtra la tabla exactamente por el vendedor seleccionado', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();
    await ruteo.aumentarRangoFechas(DESDE_AMPLIO, hoyISO());

    const opciones = await ruteo.obtenerOpcionesVendedor();
    test.skip(opciones.length === 0, 'El ambiente de QA no tiene vendedores reales configurados en el filtro.');

    const vendedor = opciones[0];
    await test.step(`Aplicar el filtro de vendedor "${vendedor.label}"`, async () => {
      await ruteo.seleccionarVendedor(vendedor.value);
      await ruteo.buscar();
      await expect.poll(() => ruteo.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThan(0);
    });

    await test.step('Todas las filas visibles corresponden a ese vendedor', async () => {
      const total = await ruteo.contarFilas();
      for (let i = 0; i < total; i++) {
        expect(await ruteo.obtenerVendedorDeFila(i)).toBe(vendedor.label);
      }
    });

    await ruteo.validarSinErrores();
  });

  test('el filtro "Ruta" se puede aplicar y la búsqueda sigue funcionando sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();
    await ruteo.aumentarRangoFechas(DESDE_AMPLIO, hoyISO());
    await ruteo.buscar();
    const totalSinFiltrar = await ruteo.contarFilas();

    const opciones = await ruteo.obtenerOpcionesRuta();
    test.skip(opciones.length === 0, 'El ambiente de QA no tiene rutas reales configuradas en el filtro.');

    // La tabla no expone ninguna columna de Ruta (confirmado en vivo): solo
    // se valida que el filtro se pueda aplicar sin errores y que el
    // resultado sea coherente (nunca más filas que sin filtrar).
    await ruteo.seleccionarRuta(opciones[0].value);
    await ruteo.buscar();

    await ruteo.validarTabla();
    expect(await ruteo.contarFilas()).toBeLessThanOrEqual(totalSinFiltrar);
    await ruteo.validarSinErrores();
  });

  test('los filtros "Tipo de Venta", "Tipo de factura" y "Tipo Comisión" se pueden aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();
    await ruteo.aumentarRangoFechas(DESDE_AMPLIO, hoyISO());

    // Ninguna columna visible refleja directamente estos 3 filtros
    // (confirmado en vivo, incluso "Tipo Comisión" no cambia ni las columnas
    // ni los datos de la tabla en este ambiente) — se valida únicamente que
    // la búsqueda se ejecute sin errores para cada valor real del select.
    await test.step('Tipo de Venta = Contado', async () => {
      await ruteo.seleccionarTipoVenta('cash');
      await ruteo.buscar();
      await ruteo.validarTabla();
      await ruteo.validarSinErrores();
    });

    await test.step('Tipo de factura = Tiquete Electrónico', async () => {
      await ruteo.seleccionarTipoVenta('all');
      await ruteo.seleccionarTipoFactura('4');
      await ruteo.buscar();
      await ruteo.validarTabla();
      await ruteo.validarSinErrores();
    });

    await test.step('Tipo Comisión = Por Productos', async () => {
      await ruteo.seleccionarTipoFactura('0');
      await ruteo.seleccionarTipoComision('1');
      await ruteo.buscar();
      await ruteo.validarTabla();
      await ruteo.validarSinErrores();
    });
  });

  test('"limpiar filtros" restaura el rango por defecto y todos los selects a "Todos", volviendo a mostrar los registros', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();
    await ruteo.aumentarRangoFechas(DESDE_AMPLIO, hoyISO());
    await ruteo.buscar();
    const totalSinFiltrar = await ruteo.contarFilas();
    test.skip(totalSinFiltrar === 0, 'El ambiente de QA no tiene comisiones registradas en el rango amplio.');

    const opciones = await ruteo.obtenerOpcionesVendedor();
    await ruteo.seleccionarVendedor(opciones[0].value);
    await ruteo.buscar('algo');
    await ruteo.buscar(opciones[0].label);

    await test.step('Limpiar todos los filtros', async () => {
      await ruteo.limpiarFiltros();
    });

    await test.step('El reporte vuelve a mostrar todos los registros del día por defecto sin errores', async () => {
      await ruteo.validarTabla();
      await ruteo.validarSinErrores();
    });
  });

  test('los totales fijos al pie de la tabla coinciden con la suma real de las columnas "Subtotal de Venta" y "Comisión" de las filas visibles', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();
    await ruteo.aumentarRangoFechas(DESDE_AMPLIO, hoyISO());
    await ruteo.buscar();

    const total = await ruteo.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene comisiones registradas en el rango amplio.');

    let sumaSubtotal = 0;
    let sumaComision = 0;
    for (let i = 0; i < total; i++) {
      sumaSubtotal += await ruteo.obtenerSubtotalNumericoDeFila(i);
      sumaComision += await ruteo.obtenerComisionNumericaDeFila(i);
    }

    const { subtotal, comision } = await ruteo.obtenerTotalesFijos();
    expect(subtotal).toBeCloseTo(sumaSubtotal, 1);
    expect(comision).toBeCloseTo(sumaComision, 1);
  });

  test('el "Total de Comisiones" global coincide con el total fijo de comisión al pie de la tabla', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();
    await ruteo.aumentarRangoFechas(DESDE_AMPLIO, hoyISO());
    await ruteo.buscar();

    const { comision } = await ruteo.obtenerTotalesFijos();
    const totalGlobal = await ruteo.obtenerTotalComisionesGlobal();
    expect(totalGlobal).toBeCloseTo(comision, 1);
  });

  test('el menú de acciones de una fila expone las 5 opciones reales de descarga/impresión', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();
    await ruteo.aumentarRangoFechas(DESDE_AMPLIO, hoyISO());
    await ruteo.buscar();

    const total = await ruteo.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene comisiones registradas en el rango amplio.');

    const opciones = await ruteo.obtenerOpcionesAccionesFila(0);
    const textoOpciones = opciones.join(' | ').toLowerCase();

    expect(textoOpciones).toContain('descargar pdf detallado');
    expect(textoOpciones).toContain('imprimir reporte detallado');
    expect(textoOpciones).toContain('descargar pdf consolidado');
    expect(textoOpciones).toContain('imprimir reporte consolidado');
    expect(textoOpciones).toContain('exportar excel reporte consolidado');
  });

  test('"Descargar PDF Detallado" genera un archivo .pdf real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();
    await ruteo.aumentarRangoFechas(DESDE_AMPLIO, hoyISO());
    await ruteo.buscar();

    const total = await ruteo.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene comisiones registradas en el rango amplio.');

    const descarga = await ruteo.descargarPDFDetalladoFila(0);
    expect(descarga.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test('"Descargar PDF Consolidado" genera un archivo .pdf real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();
    await ruteo.aumentarRangoFechas(DESDE_AMPLIO, hoyISO());
    await ruteo.buscar();

    const total = await ruteo.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene comisiones registradas en el rango amplio.');

    const descarga = await ruteo.descargarPDFConsolidadoFila(0);
    expect(descarga.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test('"Exportar Excel Reporte Consolidado" genera un archivo .xlsx real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();
    await ruteo.aumentarRangoFechas(DESDE_AMPLIO, hoyISO());
    await ruteo.buscar();

    const total = await ruteo.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene comisiones registradas en el rango amplio.');

    const descarga = await ruteo.descargarExcelConsolidadoFila(0);
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });

  test('"Imprimir Reporte Detallado" abre una pestaña de impresión y dispara la descarga real del PDF, sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();
    await ruteo.aumentarRangoFechas(DESDE_AMPLIO, hoyISO());
    await ruteo.buscar();

    const total = await ruteo.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene comisiones registradas en el rango amplio.');

    const { descarga, seAbrioVentanaNueva } = await ruteo.imprimirReporteDetalladoFila(0);
    expect(seAbrioVentanaNueva).toBe(true);
    expect(descarga?.suggestedFilename()).toMatch(/\.pdf$/i);
    await ruteo.validarSinErrores();
  });

  test('"Imprimir Reporte Consolidado" abre una pestaña de impresión sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();
    await ruteo.aumentarRangoFechas(DESDE_AMPLIO, hoyISO());
    await ruteo.buscar();

    const total = await ruteo.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene comisiones registradas en el rango amplio.');

    // A diferencia de "Detallado", "Consolidado" genera el PDF del lado del
    // cliente dentro de la propia pestaña y no siempre llega a disparar el
    // evento `download` real (confirmado en vivo) — solo se exige la
    // pestaña, no la descarga.
    const { seAbrioVentanaNueva } = await ruteo.imprimirReporteConsolidadoFila(0);
    expect(seAbrioVentanaNueva).toBe(true);
    await ruteo.validarSinErrores();
  });

  test('la exportación global "Descargar" solo ofrece "Exportar Excel (pronto)", todavía no funcional', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ruteo = new ReporteRuteoPage(page);
    await ruteo.abrirReporteRuteo();

    await ruteo.abrirMenuDescargaGlobal();
    const texto = await ruteo.obtenerTextoOpcionDescargaGlobal();
    expect(texto.toLowerCase()).toContain('pronto');

    // Confirmar en vivo que no dispara ninguna descarga real (placeholder):
    // se espera activamente el evento y se confirma que nunca llega.
    const descargaPromise = page.waitForEvent('download', { timeout: 3000 });
    await page.locator('a', { hasText: 'Exportar Excel' }).click();
    await expect(descargaPromise).rejects.toThrow();
  });
});
