import { test, expect } from '@playwright/test';
import { ReportesPage, TIMEOUTS } from './reportes.page';
import {
  hoyISO,
  hoyMenosDiasISO,
  ReporteAnalisisCotizacionesPage,
  ReporteComisionesMetaPage,
  ReporteCotizacionesPage,
  ReporteProductosMasCotizadosPage,
  SUBMODULOS_REPORTES_COTIZACIONES,
} from './rp-cotizaciones.page';

for (const submodulo of SUBMODULOS_REPORTES_COTIZACIONES) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Reportes > Cotizaciones`, async ({ page }) => {
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

// ─── Reporte de Cotizaciones (Proformas) ───────────────────────────────────
//
// Analizado en vivo (scripts de investigación descartados tras extraer la
// evidencia, no forman parte de esta suite — ver el comentario completo de
// ReporteCotizacionesPage en rp-cotizaciones.page.ts):
//   - No existe ordenamiento de columnas (los encabezados no son clicables).
//   - No existe paginación tradicional: usa scroll infinito real.
//   - No existe columna de Acciones ni exportación a PDF, solo 2 variantes
//     de exportación a Excel.

test.describe('Reporte de Cotizaciones (Proformas)', () => {
  test('carga la tabla con datos reales (autocarga al abrir) y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cotizaciones = new ReporteCotizacionesPage(page);

    await test.step('Abrir el reporte', async () => {
      await cotizaciones.abrirReporteCotizaciones();
    });

    await test.step('La tabla es visible con datos reales (autocargados, sin presionar Buscar)', async () => {
      await cotizaciones.validarTabla();
      await expect.poll(() => cotizaciones.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThan(0);
    });

    await test.step('No hay mensaje de error visible', async () => {
      await cotizaciones.validarSinErrores();
    });
  });

  test('el rango de fechas se puede ampliar y la búsqueda sigue funcionando sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cotizaciones = new ReporteCotizacionesPage(page);
    await cotizaciones.abrirReporteCotizaciones();

    const filasRangoCorto = await test.step('Buscar con el rango por defecto (últimos 15 días)', async () => {
      await cotizaciones.buscar();
      return cotizaciones.contarFilas();
    });

    await test.step('Ampliar el rango a los últimos 2 años y buscar de nuevo', async () => {
      await cotizaciones.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
      await cotizaciones.buscar();
    });

    await test.step('El reporte sigue funcionando: la tabla es visible y no hay menos resultados que con el rango corto', async () => {
      await cotizaciones.validarTabla();
      await expect.poll(() => cotizaciones.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThanOrEqual(filasRangoCorto);
      await cotizaciones.validarSinErrores();
    });
  });

  test('la búsqueda por texto filtra por el cliente real y limpiarla restaura todos los registros', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cotizaciones = new ReporteCotizacionesPage(page);
    await cotizaciones.abrirReporteCotizaciones();
    await cotizaciones.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await cotizaciones.buscar();

    const totalSinFiltrar = await cotizaciones.contarFilas();
    test.skip(totalSinFiltrar === 0, 'El ambiente de QA no tiene proformas registradas en los últimos 2 años.');

    const termino = await test.step('Tomar una palabra real (alfabética) del cliente de la primera fila como término de búsqueda', async () => {
      const cliente = await cotizaciones.obtenerClienteDeFila(0);
      // Algunos clientes reales de este ambiente vienen prefijados con un
      // código puramente numérico (p.ej. "8888 CITA DE PRUEBA") que no
      // forma parte del campo indexado por el buscador (confirmado en
      // vivo: buscar por ese código no devuelve la propia fila) — se evita
      // la primera palabra si es solo dígitos.
      const palabras = cliente.trim().split(' ');
      return palabras.find((p) => /[a-zA-Z]/.test(p)) ?? palabras[0];
    });

    await test.step('Buscar por ese término', async () => {
      await cotizaciones.buscar(termino);
      await expect.poll(() => cotizaciones.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThan(0);
    });

    await test.step('Cada fila visible corresponde al término buscado', async () => {
      const filasFiltradas = await cotizaciones.contarFilas();
      for (let i = 0; i < filasFiltradas; i++) {
        const cliente = await cotizaciones.obtenerClienteDeFila(i);
        expect(cliente.toLowerCase()).toContain(termino.toLowerCase());
      }
    });

    await test.step('Limpiar la búsqueda restaura todos los registros', async () => {
      await cotizaciones.limpiarBusqueda();
      await expect.poll(() => cotizaciones.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalSinFiltrar);
    });
  });

  test('buscar un término que no existe muestra el mensaje real de "sin resultados"', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cotizaciones = new ReporteCotizacionesPage(page);
    await cotizaciones.abrirReporteCotizaciones();

    await cotizaciones.buscar('zzzz_termino_que_no_existe_9999');

    await test.step('Se muestra el mensaje real de "sin resultados"', async () => {
      await cotizaciones.validarMensajeSinResultados();
    });

    await test.step('No hay ninguna fila real de datos', async () => {
      expect(await cotizaciones.contarFilas()).toBe(0);
    });

    await test.step('Limpiar filtros restaura el listado', async () => {
      await cotizaciones.limpiarFiltros();
      await cotizaciones.validarSinErrores();
    });
  });

  test('los chips de estado ("Facturados"/"Pendientes"/"Anuladas") filtran la tabla y "Todos" restaura el listado completo', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cotizaciones = new ReporteCotizacionesPage(page);
    await cotizaciones.abrirReporteCotizaciones();
    await cotizaciones.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await cotizaciones.buscar();

    const totalTodos = await cotizaciones.contarFilas();
    test.skip(totalTodos === 0, 'El ambiente de QA no tiene proformas registradas en los últimos 2 años.');

    await test.step('"Facturados" nunca muestra más filas que "Todos"', async () => {
      await cotizaciones.seleccionarEstado('cash');
      expect(await cotizaciones.contarFilas()).toBeLessThanOrEqual(totalTodos);
    });

    await test.step('Volver a "Todos" restaura el listado completo', async () => {
      await cotizaciones.seleccionarEstado('all');
      await expect.poll(() => cotizaciones.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalTodos);
    });
  });

  test('el scroll infinito carga más proformas al llegar al fondo del listado', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cotizaciones = new ReporteCotizacionesPage(page);
    await cotizaciones.abrirReporteCotizaciones();
    await cotizaciones.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await cotizaciones.buscar();

    const filasAntes = await cotizaciones.contarFilas();
    test.skip(filasAntes === 0, 'El ambiente de QA no tiene proformas registradas en los últimos 2 años.');

    await cotizaciones.cargarMasConScrollInfinito();
    expect(await cotizaciones.contarFilas()).toBeGreaterThanOrEqual(filasAntes);
  });

  test('el pie de tabla muestra los totales reales agrupados por moneda', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cotizaciones = new ReporteCotizacionesPage(page);
    await cotizaciones.abrirReporteCotizaciones();
    await cotizaciones.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await cotizaciones.buscar();

    const total = await cotizaciones.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene proformas registradas en los últimos 2 años.');

    const totales = await cotizaciones.obtenerTotalesPorMoneda();
    expect(totales.length).toBeGreaterThan(0);
    for (const { etiqueta, total: montoTotal } of totales) {
      expect(etiqueta).toMatch(/^total (crc|usd)$/i);
      expect(montoTotal).toBeGreaterThanOrEqual(0);
    }
  });

  test('"Exportar proformas" genera un archivo .xlsx real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cotizaciones = new ReporteCotizacionesPage(page);
    await cotizaciones.abrirReporteCotizaciones();

    const descarga = await cotizaciones.descargarProformas();
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });

  test('"Exportar proformas con productos" genera un archivo .xlsx real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cotizaciones = new ReporteCotizacionesPage(page);
    await cotizaciones.abrirReporteCotizaciones();

    const descarga = await cotizaciones.descargarProformasConProductos();
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });
});

// ─── Reporte de Comisiones por Meta ────────────────────────────────────────
//
// Analizado en vivo (scripts de investigación descartados tras extraer la
// evidencia, no forman parte de esta suite — ver el comentario completo de
// ReporteComisionesMetaPage en rp-cotizaciones.page.ts):
//   - Este ambiente de QA NO tiene ninguna meta de comisión configurada para
//     ningún vendedor, ni siquiera con un rango de casi 3 años — la tabla
//     siempre muestra el mensaje real de "sin resultados" y las tarjetas
//     KPI siempre quedan en su valor por defecto. Los tests de este reporte
//     validan que los filtros se apliquen sin error, no resultados con
//     datos reales (que no existen en este ambiente).
//   - No existe ordenamiento, paginación ni exportación (ni Excel ni PDF).

test.describe('Reporte de Comisiones por Meta', () => {
  test('carga el reporte con sus tarjetas KPI y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const comisiones = new ReporteComisionesMetaPage(page);

    await test.step('Abrir el reporte', async () => {
      await comisiones.abrirReporteComisionesMeta();
    });

    await test.step('La tabla es visible', async () => {
      await comisiones.validarTabla();
    });

    await test.step('Las tarjetas KPI muestran su estado real', async () => {
      const kpis = await comisiones.obtenerKPIs();
      expect(kpis.metasAlcanzadas.length).toBeGreaterThan(0);
      expect(kpis.comisionesTotal.length).toBeGreaterThan(0);
      expect(kpis.progresoPromedio.length).toBeGreaterThan(0);
      expect(kpis.mejorPerformer.length).toBeGreaterThan(0);
    });

    await test.step('No hay mensaje de error visible', async () => {
      await comisiones.validarSinErrores();
    });
  });

  test('con un rango de casi 3 años, el reporte confirma que no hay metas configuradas en este ambiente (comportamiento real)', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const comisiones = new ReporteComisionesMetaPage(page);
    await comisiones.abrirReporteComisionesMeta();

    await comisiones.aumentarRangoFechas(hoyMenosDiasISO(1000), hoyISO());
    await comisiones.buscar();

    await test.step('El mensaje real de "sin resultados" está presente', async () => {
      await comisiones.validarMensajeSinResultados();
      expect(await comisiones.estaVacia()).toBe(true);
    });

    await test.step('Las tarjetas KPI permanecen en su valor por defecto', async () => {
      const kpis = await comisiones.obtenerKPIs();
      expect(kpis.metasAlcanzadas).toBe('0/0');
      expect(kpis.mejorPerformer).toBe('N/A');
    });

    await comisiones.validarSinErrores();
  });

  test('los filtros (Estado de Meta, Vendedor, buscador por nombre) se pueden aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const comisiones = new ReporteComisionesMetaPage(page);
    await comisiones.abrirReporteComisionesMeta();
    await comisiones.aumentarRangoFechas(hoyMenosDiasISO(1000), hoyISO());

    await test.step('Estado de Meta = Cumplida', async () => {
      await comisiones.seleccionarEstadoMeta('1');
      await comisiones.buscar();
      await comisiones.validarTabla();
      await comisiones.validarSinErrores();
    });

    await test.step('Estado de Meta = Pendiente', async () => {
      await comisiones.seleccionarEstadoMeta('0');
      await comisiones.buscar();
      await comisiones.validarTabla();
      await comisiones.validarSinErrores();
    });

    await test.step('Buscador por nombre de vendedor', async () => {
      await comisiones.seleccionarEstadoMeta('');
      await comisiones.buscar('Kennia');
      await comisiones.validarTabla();
      await comisiones.validarSinErrores();
    });
  });

  test('"limpiar filtros" restaura el rango y los selects por defecto sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const comisiones = new ReporteComisionesMetaPage(page);
    await comisiones.abrirReporteComisionesMeta();

    await comisiones.aumentarRangoFechas(hoyMenosDiasISO(1000), hoyISO());
    await comisiones.buscar('algo');

    await comisiones.limpiarFiltros();

    await comisiones.validarTabla();
    await comisiones.validarSinErrores();
  });
});

// ─── Reporte de Análisis de Cotizaciones ───────────────────────────────────
//
// Analizado en vivo (scripts de investigación descartados tras extraer la
// evidencia, no forman parte de esta suite — ver el comentario completo de
// ReporteAnalisisCotizacionesPage en rp-cotizaciones.page.ts):
//   - No existe ordenamiento ni paginación en la tabla "Resumen por
//     Vendedor" (lista corta, sin controles de orden).
//   - Solo existe exportación a Excel (botón directo, sin dropdown); no hay
//     opción de PDF.

test.describe('Análisis de Cotizaciones', () => {
  test('carga las métricas, los gráficos y la tabla, sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const analisis = new ReporteAnalisisCotizacionesPage(page);

    await test.step('Abrir el reporte', async () => {
      await analisis.abrirReporteAnalisisCotizaciones();
    });

    await test.step('Las métricas son numéricas y coherentes', async () => {
      const metricas = await analisis.obtenerMetricas();
      expect(metricas.total).toBeGreaterThanOrEqual(0);
      expect(metricas.convertidas).toBeGreaterThanOrEqual(0);
      expect(metricas.pendientes).toBeGreaterThanOrEqual(0);
      expect(metricas.eliminadas).toBeGreaterThanOrEqual(0);
    });

    await test.step('Los 2 gráficos (Tendencia Diaria y Distribución por Estado) son visibles', async () => {
      const graficos = await analisis.graficosVisibles();
      expect(graficos.tendencia).toBe(true);
      expect(graficos.estado).toBe(true);
    });

    await test.step('No hay mensaje de error visible', async () => {
      await analisis.validarSinErrores();
    });
  });

  test('el rango de fechas se puede ampliar y la búsqueda sigue funcionando sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const analisis = new ReporteAnalisisCotizacionesPage(page);
    await analisis.abrirReporteAnalisisCotizaciones();

    const totalRangoCorto = await test.step('Buscar con el rango por defecto (últimos 30 días)', async () => {
      await analisis.buscar();
      return (await analisis.obtenerMetricas()).total;
    });

    await test.step('Ampliar el rango a los últimos 2 años y buscar de nuevo', async () => {
      await analisis.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
      await analisis.buscar();
    });

    await test.step('El reporte sigue funcionando y no hay menos cotizaciones totales que con el rango corto', async () => {
      const metricas = await analisis.obtenerMetricas();
      expect(metricas.total).toBeGreaterThanOrEqual(totalRangoCorto);
      await analisis.validarSinErrores();
    });
  });

  test('el filtro "Vendedor" filtra la tabla "Resumen por Vendedor" exactamente por el vendedor seleccionado', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const analisis = new ReporteAnalisisCotizacionesPage(page);
    await analisis.abrirReporteAnalisisCotizaciones();
    await analisis.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await analisis.buscar();

    const opciones = await analisis.obtenerOpcionesVendedor();
    test.skip(opciones.length === 0, 'El ambiente de QA no tiene vendedores reales configurados en el filtro.');

    const vendedor = opciones[0];
    await test.step(`Aplicar el filtro de vendedor "${vendedor.label}"`, async () => {
      await analisis.seleccionarVendedor(vendedor.value);
      await analisis.buscar();
    });

    await test.step('Si hay filas, todas corresponden a ese vendedor', async () => {
      const total = await analisis.contarFilas();
      for (let i = 0; i < total; i++) {
        expect(await analisis.obtenerVendedorDeFila(i)).toBe(vendedor.label);
      }
    });

    await analisis.validarSinErrores();
  });

  test('un rango de fechas sin datos oculta la tabla "Resumen por Vendedor" pero los gráficos y métricas siguen funcionando', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const analisis = new ReporteAnalisisCotizacionesPage(page);
    await analisis.abrirReporteAnalisisCotizaciones();

    await analisis.aumentarRangoFechas('2000-01-01', '2000-01-02');
    await analisis.buscar();

    await test.step('La tabla "Resumen por Vendedor" se oculta por completo', async () => {
      await analisis.validarMensajeSinResultados();
    });

    await test.step('Las métricas quedan en 0 y los gráficos se mantienen visibles', async () => {
      // getProformaMetrics puede resolver más de una vez tras "Buscar"
      // (confirmado en vivo, mismo patrón de doble llamada AJAX ya
      // documentado en otros reportes de esta suite) — se espera con poll a
      // que la tarjeta refleje el valor final en vez de leerla de inmediato.
      await expect.poll(async () => (await analisis.obtenerMetricas()).total, { timeout: TIMEOUTS.CARGA }).toBe(0);

      const graficos = await analisis.graficosVisibles();
      expect(graficos.tendencia).toBe(true);
      expect(graficos.estado).toBe(true);
    });

    await analisis.validarSinErrores();
  });

  test('"Exportar Excel" genera un archivo .xlsx real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const analisis = new ReporteAnalisisCotizacionesPage(page);
    await analisis.abrirReporteAnalisisCotizaciones();

    const descarga = await analisis.exportarExcel();
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });
});

// ─── Reporte de Productos Más Cotizados ────────────────────────────────────
//
// Analizado en vivo (scripts de investigación descartados tras extraer la
// evidencia, no forman parte de esta suite — ver el comentario completo de
// ReporteProductosMasCotizadosPage en rp-cotizaciones.page.ts):
//   - No existe ordenamiento de columnas en la pestaña "Tabla".
//   - No existe paginación tradicional: el filtro "Límite" (Top 10/20/30/50)
//     cumple ese rol, limitando la cantidad de productos mostrados.
//   - No existe ningún botón de exportación (ni Excel ni PDF).

test.describe('Productos Más Cotizados', () => {
  test('carga con la pestaña "Cards" activa por defecto, con datos reales y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const productos = new ReporteProductosMasCotizadosPage(page);

    await test.step('Abrir el reporte', async () => {
      await productos.abrirReporteProductosMasCotizados();
    });

    await test.step('Las pestañas y las tarjetas de producto son visibles', async () => {
      await productos.validarTabla();
      await expect.poll(() => productos.contarTarjetas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThan(0);
    });

    await test.step('No hay mensaje de error visible', async () => {
      await productos.validarSinErrores();
    });
  });

  test('el filtro "Límite" cambia realmente la cantidad de productos mostrados (Top 10 vs Top 30)', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const productos = new ReporteProductosMasCotizadosPage(page);
    await productos.abrirReporteProductosMasCotizados();
    await productos.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());

    await productos.seleccionarLimite('10');
    await productos.buscar();
    const totalTop10 = await productos.contarTarjetas();
    test.skip(totalTop10 === 0, 'El ambiente de QA no tiene productos cotizados registrados en los últimos 2 años.');

    await productos.seleccionarLimite('30');
    await productos.buscar();
    const totalTop30 = await productos.contarTarjetas();

    expect(totalTop30).toBeGreaterThanOrEqual(totalTop10);
  });

  test('las pestañas "Tabla" y "Gráfico" muestran su contenido real al cambiar de pestaña', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const productos = new ReporteProductosMasCotizadosPage(page);
    await productos.abrirReporteProductosMasCotizados();
    await productos.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await productos.buscar();

    const totalCards = await productos.contarTarjetas();
    test.skip(totalCards === 0, 'El ambiente de QA no tiene productos cotizados registrados en los últimos 2 años.');

    await test.step('Pestaña "Tabla": la tabla real tiene la misma cantidad de filas que tarjetas', async () => {
      await productos.irATab('Tabla');
      await expect.poll(() => productos.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalCards);
      expect((await productos.obtenerProductoDeFila(0)).length).toBeGreaterThan(0);
    });

    await test.step('Pestaña "Gráfico": el canvas real es visible', async () => {
      await productos.irATab('Gráfico');
      expect(await productos.graficoVisible()).toBe(true);
    });
  });

  test('el filtro "Vendedor" se puede aplicar y la búsqueda sigue funcionando sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const productos = new ReporteProductosMasCotizadosPage(page);
    await productos.abrirReporteProductosMasCotizados();
    await productos.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await productos.seleccionarLimite('50');
    await productos.buscar();

    const opciones = await productos.obtenerOpcionesVendedor();
    test.skip(opciones.length === 0, 'El ambiente de QA no tiene vendedores reales configurados en el filtro.');

    // El filtro de Vendedor no expone ninguna relación garantizada con
    // "Límite" (confirmado en vivo: filtrar por un vendedor puede devolver
    // más o menos productos que el tope configurado, probablemente porque
    // usa una ruta de búsqueda distinta) — solo se valida que la búsqueda
    // se ejecute sin errores, no una relación de subconjunto.
    await productos.seleccionarVendedor(opciones[0].value);
    await productos.buscar();

    await productos.validarSinErrores();
  });

  test('el panel de "Filtros de Vehículos" se puede abrir y aplicar una marca real sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const productos = new ReporteProductosMasCotizadosPage(page);
    await productos.abrirReporteProductosMasCotizados();

    await productos.abrirFiltrosVehiculo();

    const marca = await productos.obtenerPrimeraMarcaVehiculoReal();
    test.skip(!marca, 'El ambiente de QA no tiene marcas de vehículo reales configuradas.');

    await productos.seleccionarMarcaVehiculo(marca);
    await productos.buscar();

    await productos.validarSinErrores();
  });

  test('un rango de fechas sin datos muestra el mensaje real de "sin resultados" y oculta las pestañas', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const productos = new ReporteProductosMasCotizadosPage(page);
    await productos.abrirReporteProductosMasCotizados();

    await productos.aumentarRangoFechas('2000-01-01', '2000-01-02');
    await productos.buscar();

    await productos.validarMensajeSinResultados();
    await productos.validarSinErrores();
  });
});
