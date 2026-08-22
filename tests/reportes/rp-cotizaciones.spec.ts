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
import { PosPage, TIMEOUTS as POS_TIMEOUTS } from '../facturar/pos/pos.page';

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

// ─── Bugs de sistema confirmados en vivo (módulo Cotizaciones) ─────────────
//
// Investigación disparada por: "el símbolo de moneda no se registra
// correctamente en Cotizaciones al crear una proforma". Se probó
// exhaustivamente crear Proformas en moneda base y no-base (Normal,
// Consignación), con cliente existente y nombre libre, con descuento general
// y facturadas, consultando las 3 superficies reales donde "Cotizaciones"
// puede mostrar una Proforma: la pestaña interna "Proforma / Cotizaciones"
// del POS, el listado externo `/proform/printPosProform` y este Reporte de
// Cotizaciones (`/reports/seeProformaReport`) — en TODOS los casos probados
// el símbolo/código de moneda mostrado coincidió exactamente con la moneda
// realmente usada al crear (confirmado además con el payload crudo de
// `getPosProformSearch`: campos `local_currency`/`currency_code` siempre
// correctos). No se encontró ningún caso de símbolo de moneda incorrecto,
// vacío o de otra moneda.
//
// Sí se encontraron, en el camino, 2 bugs de sistema reales y 100%
// reproducibles en este MISMO Reporte — no sobre el símbolo en sí, sino
// sobre la VISIBILIDAD de la Proforma (y, por extensión, de su moneda/total)
// una vez editada o facturada. Se documentan aquí con `test.fail()` (mismo
// criterio ya usado en rp-caja.spec.ts para bugs de sistema confirmados) en
// vez de debilitar ninguna aserción existente.
test.describe('Reporte de Cotizaciones — bugs de sistema confirmados', () => {

  // ─── Bug 1: editar una Proforma la borra del índice de búsqueda del Reporte ──
  //
  // Repro controlada (mismo id de Proforma, antes y después de UNA sola
  // edición que no toca moneda/monto, ninguna otra variable de por medio):
  //   1. Crear una Proforma Normal simple → SÍ aparece de inmediato en el
  //      Reporte (`getPosProformSearch`, buscando por el nombre de cliente).
  //   2. Editar esa misma Proforma desde la pestaña "Proforma / Cotizaciones"
  //      del POS (solo se cambia la Observación — `updateProform`) → la
  //      MISMA Proforma deja de aparecer POR COMPLETO en el Reporte, con
  //      cualquier filtro de estado, incluso buscando por el nombre exacto
  //      de su cliente.
  // Confirmado que NO es un retraso de indexación genérico: una Proforma
  // recién creada (sin editar) aparece de inmediato, y re-consultar el
  // Reporte varios minutos después de editar (incluyendo un reload completo
  // de la página) sigue sin mostrarla. La Proforma editada SÍ sigue
  // existiendo y visible con datos correctos en las otras 2 superficies
  // (pestaña interna del POS y listado externo `printPosProform`) — el
  // problema es específico del índice/consulta que alimenta este Reporte
  // tras un `updateProform`, no una pérdida real del registro.
  test.fail(
    'BUG CONOCIDO: editar una Proforma (updateProform) la hace desaparecer del Reporte de Cotizaciones, aunque siga existiendo y visible en la pestaña interna del POS y en el listado externo printPosProform',
    async ({ page, context }) => {
      test.setTimeout(POS_TIMEOUTS.TEST);
      const pos = new PosPage(page);
      // Página SEPARADA para el Reporte: `reporte.abrirReporteCotizaciones()`
      // navega la página que reciba a `/reports/seeProformaReport` — usar la
      // misma `page` del POS la dejaría fuera de la pestaña "Proforma /
      // Cotizaciones" (confirmado en vivo: la siguiente llamada a
      // abrirMenuTarjetaProformaEnTab() se queda esperando #btn_proform_option
      // el timeout completo, porque `page` ya no está en el POS).
      const reportPage = await context.newPage();
      const reporte = new ReporteCotizacionesPage(reportPage);

      await test.step('Cargar el POS y crear una Proforma Normal simple, desechable', async () => {
        await pos.cargarPosDesdeDashboard();
        await pos.cerrarOverlaysConocidos();
        await pos.esperarEstadoInicial();
        if (await pos.modalAbrirCajaVisible()) {
          await pos.cerrarModalAbrirCaja();
        }
      });

      const nombreCliente = `Cliente Reporte BugEditar ${Date.now()}`;
      let proformaId = '';
      await test.step('Crear la Proforma', async () => {
        const producto = await pos.obtenerPrimerProductoNormal();
        await pos.agregarProductoAlCarrito(producto);
        await pos.abrirCrearProforma();
        await pos.seleccionarTipoProforma('normal');
        await pos.llenarNombreClienteProforma(nombreCliente);
        const respuesta = await pos.guardarProformaYObtenerRespuesta();
        await pos.validarProformaCreada(respuesta);
        proformaId = await pos.obtenerIdProformaCreada();
        await pos.cerrarModalGestionProforma();
      });

      await test.step('ANTES de editar: la Proforma aparece en el Reporte de Cotizaciones', async () => {
        await reporte.abrirReporteCotizaciones();
        await reporte.buscar(nombreCliente);
        expect(await reporte.contarFilas(), 'La Proforma recién creada debería aparecer en el Reporte antes de editarla').toBe(1);
      });

      await test.step('Editar la Proforma (solo la Observación) desde la pestaña interna del POS', async () => {
        const tarjeta = await pos.abrirMenuTarjetaProformaEnTab(nombreCliente, 'normal');
        await pos.editarProformaSeleccionada(tarjeta, proformaId);
        await pos.llenarObservacionProforma(`Editada ${Date.now()}`);
        const respuestaEdicion = await pos.guardarEdicionProformaYObtenerRespuesta();
        expect(respuestaEdicion.ok(), 'updateProform no respondió OK').toBe(true);
      });

      await test.step('DESPUÉS de editar: la Proforma debería seguir apareciendo en el Reporte (falla: desaparece)', async () => {
        await reporte.abrirReporteCotizaciones();
        await reporte.buscar(nombreCliente);
        expect(await reporte.contarFilas(), 'La Proforma editada desapareció del Reporte de Cotizaciones').toBe(1);
      });

      await reportPage.close();
    }
  );

  // ─── Bug 2: el chip "Todos" no incluye las Proformas en estado "Facturados" ──
  //
  // Confirmado comparando los 3 chips de estado del propio Reporte
  // (mutuamente excluyentes: Todos/Facturados/Pendientes/Anuladas) con la
  // misma Proforma facturada: buscándola con el chip "Facturados" activo SÍ
  // aparece; con el chip "Todos" (el que carga por defecto al abrir el
  // Reporte) NO aparece. Confirmado además a nivel de conteo total: en una
  // corrida real, "Pendientes" + "Facturados" sumó más filas que "Todos" —
  // los resultados de "Todos" fueron un subconjunto EXACTO de "Pendientes"
  // (mismos ids, mismo orden), es decir "Todos" se comporta como
  // "Pendientes" y excluye silenciosamente el estado "Facturados" pese a su
  // nombre. Esto también implica que los totales agregados por moneda del
  // pie de tabla ("Total CRC"/"Total USD"/"Total HNL"), calculados sobre el
  // filtro activo, quedan subestimados por defecto (excluyen todo lo ya
  // facturado) sin ninguna advertencia visible para quien use el Reporte.
  test.fail(
    'BUG CONOCIDO: el chip "Todos" del Reporte de Cotizaciones no incluye las Proformas en estado "Facturados"',
    async ({ page }) => {
      test.setTimeout(POS_TIMEOUTS.TEST);
      const pos = new PosPage(page);
      const reporte = new ReporteCotizacionesPage(page);

      await test.step('Cargar el POS y crear + facturar una Proforma Normal simple, desechable', async () => {
        await pos.cargarPosDesdeDashboard();
        await pos.cerrarOverlaysConocidos();
        await pos.esperarEstadoInicial();
        if (await pos.modalAbrirCajaVisible()) {
          await pos.cerrarModalAbrirCaja();
        }
      });

      const nombreCliente = `Cliente Reporte BugTodos ${Date.now()}`;
      await test.step('Crear la Proforma con un cliente existente y facturarla de contado', async () => {
        const producto = await pos.obtenerPrimerProductoNormal();
        await pos.agregarProductoAlCarrito(producto);
        await pos.seleccionarClienteExistente();
        await pos.abrirCrearProforma();
        await pos.seleccionarTipoProforma('normal');
        await pos.llenarNombreClienteProforma(nombreCliente);
        const respuesta = await pos.guardarProformaYObtenerRespuesta();
        await pos.validarProformaCreada(respuesta);
        await pos.cerrarModalGestionProforma();

        const tarjeta = await pos.abrirMenuTarjetaProformaEnTab(nombreCliente, 'normal');
        await pos.cargarProformaEnCarritoDesdeTab(tarjeta);
        await pos.abrirModalDePago();
        const total = await pos.obtenerTotalVentaNumerico();
        await pos.seleccionarPagoEfectivo(String(total));
        await pos.confirmarPagoAbriendoCajaSiEsNecesario();
        await pos.validarCarritoVacio();
      });

      await test.step('Con el chip "Facturados" activo, la Proforma facturada SÍ aparece', async () => {
        await reporte.abrirReporteCotizaciones();
        await reporte.seleccionarEstado('cash');
        await reporte.buscar(nombreCliente);
        expect(await reporte.contarFilas(), 'La Proforma facturada debería aparecer con el chip "Facturados"').toBe(1);
      });

      await test.step('Con el chip "Todos" activo, la misma Proforma debería seguir apareciendo (falla: desaparece)', async () => {
        await reporte.seleccionarEstado('all');
        await reporte.buscar(nombreCliente);
        expect(await reporte.contarFilas(), 'La Proforma facturada no aparece con el chip "Todos"').toBe(1);
      });
    }
  );

  // ─── Bug 3: "Análisis de Cotizaciones" mezcla monedas SIN CONVERTIR (multiplica en vez de dividir) ──
  //
  // Investigación disparada por: "el símbolo de moneda no se registra
  // correctamente en Cotizaciones al crear una proforma en dólares". Nunca se
  // encontró un símbolo incorrecto en ninguna de las 3 superficies de
  // Cotizaciones (pestaña interna del POS, listado externo, este Reporte),
  // pero SÍ se encontró un defecto real y cuantificable en el reporte
  // "Análisis de Cotizaciones" (`/reports/proformAnalysis`), que agrupa el
  // KPI "Valor Cotizado" por vendedor SIN ninguna columna ni separación por
  // moneda (a diferencia de "Reporte de Cotizaciones", que sí separa "Total
  // CRC"/"Total USD"/"Total HNL").
  //
  // Repro controlada, mismo vendedor, ambiente real (tasa de cambio real
  // observada ₡/$ ≈ 635): se leyó el "Valor Cotizado" del vendedor ANTES y
  // DESPUÉS de agregar una única Proforma nueva en moneda NO BASE (₡). El
  // incremento real observado fue $3,629,011,694.77 para una Proforma de
  // ₡5,715,000 — la tasa implícita del incremento (delta ÷ total en ₡) dio
  // **634.9977**, prácticamente idéntica a la tasa de cambio real del
  // ambiente (635.0000), no a 1 (sin convertir) ni a 1/635≈0.00157
  // (conversión correcta a dólares). Es decir: el sistema toma el monto en
  // moneda NO BASE y lo MULTIPLICA por la tasa de cambio en vez de
  // dividirlo (o de no tocarlo) — el resultado correcto hubiera sido sumar
  // ≈$9,000 (el equivalente real en dólares), y en cambio sumó ≈$3,629
  // millones bajo el mismo símbolo "$" fijo de la columna. Cualquier
  // vendedor con Proformas en más de una moneda ve un "Valor Cotizado" sin
  // sentido matemático, inflado por un factor ≈635x — el defecto de moneda
  // más severo encontrado en toda esta investigación, aunque su síntoma no
  // sea un símbolo incorrecto sino un monto astronómicamente inflado bajo un
  // símbolo fijo que no refleja la mezcla real de monedas.
  test.fail(
    'BUG CONOCIDO: "Análisis de Cotizaciones" (Valor Cotizado por vendedor) multiplica por la tasa de cambio en vez de convertir una Proforma en moneda no-base, inflando el total ≈635x cuando se mezcla con Proformas en la moneda base',
    async ({ page }) => {
      test.setTimeout(POS_TIMEOUTS.TEST);
      const pos = new PosPage(page);
      const analisis = new ReporteAnalisisCotizacionesPage(page);

      await test.step('Cargar el POS y confirmar moneda base + moneda no-base disponibles', async () => {
        await pos.cargarPosDesdeDashboard();
        await pos.cerrarOverlaysConocidos();
        await pos.esperarEstadoInicial();
        if (await pos.modalAbrirCajaVisible()) {
          await pos.cerrarModalAbrirCaja();
        }
      });

      const { simboloBase } = await pos.obtenerInfoMoneda();
      const simbolos = await pos.obtenerSimbolosMonedaDisponibles();
      const simboloNoBase = simbolos.find((s) => s !== simboloBase);
      expect(simboloNoBase, `No hay ninguna moneda distinta de la base (${simboloBase}) disponible en este ambiente`).toBeTruthy();

      let nombreVendedor = '';
      let valorCotizadoAntes = 0;
      await test.step('Crear una Proforma en moneda BASE y leer el "Valor Cotizado" del vendedor', async () => {
        await pos.cambiarMoneda(simboloBase);
        const producto = await pos.obtenerPrimerProductoNormal();
        await pos.agregarProductoAlCarrito(producto);
        await pos.abrirCrearProforma();
        await pos.seleccionarTipoProforma('normal');
        await pos.llenarNombreClienteProforma(`Cliente Analisis MezclaMoneda ${Date.now()}`);
        nombreVendedor = await pos.seleccionarVendedorProforma();
        const respuesta = await pos.guardarProformaYObtenerRespuesta();
        await pos.validarProformaCreada(respuesta);
        await pos.cerrarModalGestionProforma();

        await analisis.abrirReporteAnalisisCotizaciones();
        await analisis.seleccionarFechaInicial(hoyISO());
        await analisis.seleccionarFechaFinal(hoyISO());
        await analisis.buscar();
        valorCotizadoAntes = await leerValorCotizadoDeVendedor(analisis, nombreVendedor);
      });

      let totalNoBase = 0;
      let valorCotizadoDespues = 0;
      await test.step('Agregar UNA Proforma en moneda NO BASE con el mismo vendedor y volver a leer el "Valor Cotizado"', async () => {
        await pos.cambiarMoneda(simboloNoBase!);
        const producto = await pos.obtenerPrimerProductoNormal();
        await pos.agregarProductoAlCarrito(producto);
        totalNoBase = await pos.obtenerTotalVentaNumerico();
        await pos.abrirCrearProforma();
        await pos.seleccionarTipoProforma('normal');
        await pos.llenarNombreClienteProforma(`Cliente Analisis MezclaMoneda2 ${Date.now()}`);
        // El Chosen de vendedor ya trae preseleccionado el mismo (único
        // vendedor real disponible en este ambiente, confirmado en vivo) —
        // se lee en vez de reintentar seleccionarlo (no hay "otra opción").
        await pos.guardarProformaYObtenerRespuesta().then((r) => pos.validarProformaCreada(r));
        await pos.cerrarModalGestionProforma();

        await analisis.abrirReporteAnalisisCotizaciones();
        await analisis.seleccionarFechaInicial(hoyISO());
        await analisis.seleccionarFechaFinal(hoyISO());
        await analisis.buscar();
        valorCotizadoDespues = await leerValorCotizadoDeVendedor(analisis, nombreVendedor);

        await pos.cambiarMoneda(simboloBase);
      });

      await test.step('El incremento del "Valor Cotizado" debería ser el equivalente real en dólares de la Proforma en moneda no-base (falla: aparece multiplicado por la tasa de cambio)', async () => {
        const incrementoReal = valorCotizadoDespues - valorCotizadoAntes;
        console.log(`[Análisis mezcla monedas] antes=${valorCotizadoAntes}, después=${valorCotizadoDespues}, incremento=${incrementoReal}, total Proforma no-base=${totalNoBase}, tasa implícita=${incrementoReal / totalNoBase}`);
        // Cota generosa (2x el monto real en moneda no-base) — cualquier
        // conversión razonable (correcta, o incluso sin convertir del todo)
        // cae dentro de este rango; solo la multiplicación por la tasa real
        // (≈635x en este ambiente) lo excede por 2-3 órdenes de magnitud.
        expect(incrementoReal, 'El incremento del "Valor Cotizado" está multiplicado por la tasa de cambio en vez de convertido correctamente').toBeLessThan(totalNoBase * 2);
      });
    }
  );
});

/**
 * Lee la celda "Valor Cotizado" (columna 6, ver el comentario de
 * ReporteAnalisisCotizacionesPage: "Vendedor/Total/Convertidas/Pendientes/
 * Eliminadas/% Conversión/Valor Cotizado/Valor Vendido/Días Prom.") de la
 * fila de un vendedor específico — el propio Page Object no expone un
 * lector directo de esta columna (solo Vendedor y "Total", ver
 * COLUMNA_VENDEDOR/COLUMNA_TOTAL), así que se lee aquí sobre sus locators
 * públicos (`filas()`) en vez de duplicar la clase por un solo campo nuevo.
 */
async function leerValorCotizadoDeVendedor(analisis: ReporteAnalisisCotizacionesPage, vendedor: string): Promise<number> {
  const COLUMNA_VALOR_COTIZADO = 6;
  const filas = analisis.filas();
  const total = await filas.count();
  for (let i = 0; i < total; i++) {
    const texto = await filas.nth(i).innerText();
    if (texto.includes(vendedor)) {
      const celda = await filas.nth(i).locator('td').nth(COLUMNA_VALOR_COTIZADO).innerText();
      return parseFloat(celda.replace(/[^\d.-]/g, '')) || 0;
    }
  }
  throw new Error(`No se encontró ninguna fila para el vendedor "${vendedor}" en "Resumen por Vendedor"`);
}
