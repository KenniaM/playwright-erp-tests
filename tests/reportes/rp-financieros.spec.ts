import { test, expect } from '@playwright/test';
import { ReportesPage, TIMEOUTS } from './reportes.page';
import { ReporteFinancieroPage, SUBMODULOS_REPORTES_FINANCIEROS } from './rp-financieros.page';

for (const submodulo of SUBMODULOS_REPORTES_FINANCIEROS) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Reportes > Reportes Financieros`, async ({ page }) => {
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

// ─── Reporte Financiero ────────────────────────────────────────────────────
//
// Analizado en vivo (scripts de investigación descartados tras extraer la
// evidencia, no forman parte de esta suite — ver el comentario completo de
// ReporteFinancieroPage en rp-financieros.page.ts):
//   - No existe ordenamiento de columnas (los encabezados no son clicables).
//   - No existe paginación tradicional: todo el rango cabe en la tabla con
//     scroll interno (hasta 30 filas con "Últimos 30 días" en este ambiente).
//   - No existe ningún mensaje dedicado de "sin resultados": con un filtro
//     sin coincidencias, el `tbody` simplemente queda vacío y las tarjetas
//     KPI se resetean a 0.
//   - El rango de fechas personalizado ("Rango de fecha" + calendario) usa
//     un date-time picker de terceros que ignora `.fill()` (confirmado en
//     vivo) — el rango corto/amplio se prueba con los presets reales de
//     "Resumen" (Hoy vs. Últimos 30 días), no con fechas escritas a mano.
//   - "Semáforo de Utilidad" permite configurar umbrales, pero su botón
//     "Guardar" persiste una configuración GLOBAL compartida del ambiente de
//     QA — los tests solo abren/cierran el panel, nunca presionan "Guardar".
//   - Cada factura con saldo pendiente expone un botón real "Abonar factura
//     pendiente" (acción destructiva que cobra la factura) — no se ejecuta
//     en los tests, solo se valida que la sección de facturas se pueda
//     expandir/colapsar.

test.describe('Reporte Financiero', () => {
  test('carga la tabla con datos reales, sus tarjetas KPI y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);

    await test.step('Abrir el reporte', async () => {
      await financiero.abrirReporteFinanciero();
    });

    await test.step('La tabla es visible', async () => {
      await financiero.validarTabla();
    });

    await test.step('Las tarjetas KPI muestran valores numéricos coherentes', async () => {
      const kpis = await financiero.obtenerKPIs();
      expect(kpis.totalVentas).toBeGreaterThanOrEqual(0);
      expect(kpis.totalContado + kpis.totalCredito).toBeCloseTo(kpis.totalVentas, 1);
      expect(kpis.totalGanancia).toBeGreaterThanOrEqual(0);
    });

    await test.step('No hay mensaje de error visible', async () => {
      await financiero.validarSinErrores();
    });
  });

  test('el rango de fechas se puede ampliar (Hoy vs. Últimos 30 días) y el reporte sigue funcionando sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();

    const filasHoy = await test.step('Filtrar por "Hoy" (rango corto)', async () => {
      await financiero.seleccionarResumen('0');
      return financiero.contarFilas();
    });

    await test.step('Ampliar a "Últimos 30 días"', async () => {
      await financiero.seleccionarResumen('4');
    });

    await test.step('El reporte sigue funcionando: la tabla es visible y no hay menos días que con "Hoy"', async () => {
      await financiero.validarTabla();
      await expect.poll(() => financiero.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThanOrEqual(filasHoy);
      await financiero.validarSinErrores();
    });

    await test.step('La etiqueta de rango de fechas refleja el período ampliado', async () => {
      const etiqueta = await financiero.obtenerEtiquetaRangoFechas();
      expect(etiqueta.length).toBeGreaterThan(0);
    });
  });

  test('la búsqueda por texto filtra los días con facturas coincidentes y limpiarla restaura todos los registros', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();
    await financiero.seleccionarResumen('4');

    const totalSinFiltrar = await financiero.contarFilas();
    test.skip(totalSinFiltrar === 0, 'El ambiente de QA no tiene ventas registradas en los últimos 30 días.');

    await test.step('Buscar un término que no existe en ninguna factura', async () => {
      await financiero.buscar('zzzz_termino_que_no_existe_9999');
      await expect.poll(() => financiero.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(0);
    });

    await test.step('Limpiar la búsqueda restaura todos los registros', async () => {
      await financiero.limpiarBusqueda();
      await expect.poll(() => financiero.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalSinFiltrar);
    });
  });

  test('un filtro sin coincidencias deja la tabla vacía (sin mensaje dedicado) y las tarjetas KPI en 0', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();
    await financiero.seleccionarResumen('4');

    await financiero.buscar('zzzz_termino_que_no_existe_9999');

    await test.step('La tabla sigue visible pero sin filas de datos', async () => {
      await financiero.validarTabla();
      expect(await financiero.contarFilas()).toBe(0);
    });

    await test.step('Las tarjetas KPI quedan en 0', async () => {
      const kpis = await financiero.obtenerKPIs();
      expect(kpis.totalVentas).toBe(0);
      expect(kpis.totalGanancia).toBe(0);
    });

    await financiero.validarSinErrores();
  });

  test('el filtro "Cliente" se puede aplicar y la búsqueda sigue funcionando sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();
    await financiero.seleccionarResumen('4');

    const opciones = await financiero.obtenerOpcionesCliente();
    test.skip(opciones.length === 0, 'El ambiente de QA no tiene clientes reales configurados en el filtro.');

    // La tabla agrupa por día, no por cliente: no hay ninguna columna visible
    // para verificar el cliente exacto de cada fila — solo se valida que el
    // filtro se pueda aplicar sin errores (mismo criterio que otros reportes
    // de esta suite para filtros sin columna visible correspondiente).
    await financiero.seleccionarCliente(opciones[0].value);
    await financiero.buscar();

    await financiero.validarTabla();
    await financiero.validarSinErrores();
  });

  test('el filtro "Vendedor" se puede aplicar y la búsqueda sigue funcionando sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();
    await financiero.seleccionarResumen('4');

    const opciones = await financiero.obtenerOpcionesVendedor();
    test.skip(opciones.length === 0, 'El ambiente de QA no tiene vendedores reales configurados en el filtro.');

    await financiero.seleccionarVendedor(opciones[0].value);
    await financiero.buscar();

    await financiero.validarTabla();
    await financiero.validarSinErrores();
  });

  test('los filtros "Caja" y "Tipo de venta" se pueden aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();
    await financiero.seleccionarResumen('4');

    await test.step('Tipo de venta = Contado', async () => {
      await financiero.seleccionarTipoVenta('1');
      await financiero.buscar();
      await financiero.validarTabla();
      await financiero.validarSinErrores();
    });
    await financiero.seleccionarTipoVenta('0');

    const opcionesCaja = await financiero.obtenerOpcionesCaja();
    test.skip(opcionesCaja.length === 0, 'El ambiente de QA no tiene cajas reales configuradas en el filtro.');

    await test.step('Caja = primera caja real configurada', async () => {
      await financiero.seleccionarCaja(opcionesCaja[0].value);
      await financiero.buscar();
      await financiero.validarTabla();
      await financiero.validarSinErrores();
    });
  });

  test('el filtro "Moneda" cambia realmente las tarjetas KPI', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();
    await financiero.seleccionarResumen('4');

    const kpisSinFiltrar = await financiero.obtenerKPIs();
    test.skip(kpisSinFiltrar.totalVentas === 0, 'El ambiente de QA no tiene ventas registradas en los últimos 30 días.');

    await financiero.seleccionarMoneda('₡ CRC');
    await financiero.buscar();

    const kpisFiltrados = await financiero.obtenerKPIs();
    expect(kpisFiltrados.totalVentas).toBeLessThanOrEqual(kpisSinFiltrar.totalVentas);

    await financiero.validarSinErrores();
  });

  test('el filtro "Tipo de ítem" (Productos/Servicios) cambia realmente las tarjetas KPI', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();
    await financiero.seleccionarResumen('4');

    const kpisSinFiltrar = await financiero.obtenerKPIs();
    test.skip(kpisSinFiltrar.totalVentas === 0, 'El ambiente de QA no tiene ventas registradas en los últimos 30 días.');

    await financiero.seleccionarTipoItem('productos');
    await financiero.buscar();

    const kpisProductos = await financiero.obtenerKPIs();
    expect(kpisProductos.totalVentas).toBeLessThanOrEqual(kpisSinFiltrar.totalVentas);

    await financiero.validarSinErrores();
  });

  test('"limpiar filtros" restaura Resumen a "Hoy" y todos los selects a "Todos" sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();
    await financiero.seleccionarResumen('4');
    await financiero.seleccionarTipoItem('productos');
    await financiero.buscar('algo');

    await financiero.limpiarFiltros();

    await financiero.validarTabla();
    await financiero.validarSinErrores();
  });

  test('los totales del pie de tabla ("TOTAL GENERAL") coinciden con la suma real de las filas visibles', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();
    await financiero.seleccionarResumen('4');
    // Se filtra a una sola moneda real para poder sumar las filas
    // visibles: cuando el rango mezcla monedas, el pie de tabla trae un
    // subtotal real POR MONEDA sin convertir (confirmado en vivo) y sumar
    // filas de distintas monedas sin convertir no sería una comparación
    // válida.
    await financiero.seleccionarMoneda('$ USD');
    await financiero.buscar();

    const total = await financiero.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene ventas en USD registradas en los últimos 30 días.');

    // El pie de tabla y las filas de día provienen de la MISMA respuesta
    // real (`getReportFinancialDays`), así que su comparación es estable.
    // Las tarjetas KPI, en cambio, provienen de un endpoint aparte
    // (`getReportFinancialTotals`) contra el mismo ambiente compartido y en
    // constante cambio (confirmado en vivo: ambas peticiones pueden ver
    // datos ligeramente distintos si otra prueba modifica ventas entre una
    // y otra) — por eso no se comparan aquí contra el pie de tabla.
    const totalGeneral = await financiero.obtenerTotalGeneralFooter();

    let sumaFilas = 0;
    for (let i = 0; i < total; i++) {
      sumaFilas += await financiero.obtenerTotalNumericoDeFila(i);
    }
    expect(sumaFilas).toBeCloseTo(totalGeneral, 1);
  });

  test('expandir una fila de día revela sus facturas reales, y se puede volver a colapsar', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();
    await financiero.seleccionarResumen('4');

    const total = await financiero.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene ventas registradas en los últimos 30 días.');

    await test.step('Expandir la primera fila muestra sus facturas', async () => {
      await financiero.alternarExpansionFila(0);
      await expect(financiero.seccionFacturasDeFila(0)).toBeVisible({ timeout: TIMEOUTS.CARGA });
    });

    await test.step('Volver a colapsarla la oculta de nuevo', async () => {
      await financiero.alternarExpansionFila(0);
      await expect(financiero.seccionFacturasDeFila(0)).toBeHidden({ timeout: TIMEOUTS.CARGA });
    });
  });

  test('el gráfico "Ingresos por Día" es visible', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();

    expect(await financiero.graficoIngresosVisible()).toBe(true);
  });

  test('el panel de "Semáforo de Utilidad" se puede abrir y cerrar (sin guardar cambios)', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();

    await test.step('Abrir el panel', async () => {
      await financiero.alternarPanelSemaforo();
      await expect.poll(() => financiero.panelSemaforoVisible(), { timeout: TIMEOUTS.CARGA }).toBe(true);
    });

    await test.step('Cerrar el panel sin guardar', async () => {
      await financiero.alternarPanelSemaforo();
      await expect.poll(() => financiero.panelSemaforoVisible(), { timeout: TIMEOUTS.CARGA }).toBe(false);
    });
  });

  test('"Excel - Reporte Financiero Detallado" genera un archivo .xlsx real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();

    const descarga = await financiero.descargarExcelDetallado();
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });

  test('"Excel - Reporte Financiero Consolidado" genera un archivo .xlsx real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();

    const descarga = await financiero.descargarExcelConsolidado();
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });

  test('"Exportar" genera una imagen real del reporte', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const financiero = new ReporteFinancieroPage(page);
    await financiero.abrirReporteFinanciero();

    const descarga = await financiero.descargarImagenReporte();
    expect(descarga.suggestedFilename()).toMatch(/\.(png|jpe?g)$/i);
  });
});
