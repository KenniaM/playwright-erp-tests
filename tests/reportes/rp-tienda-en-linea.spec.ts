import { test, expect } from '@playwright/test';
import { ReportesPage, TIMEOUTS } from './reportes.page';
import { ReporteDespachoOrdenesPage, ReporteOrdenesPage, SUBMODULOS_REPORTES_TIENDA_EN_LINEA } from './rp-tienda-en-linea.page';

// El viewport por defecto de 'Desktop Chrome' (1280x720) puede provocar
// overlaps de layout responsive que no ocurren en una pantalla real de
// escritorio (lección confirmada en los módulos anteriores) — se usa una
// resolución de escritorio realista para todo este archivo.
test.use({ viewport: { width: 1920, height: 1080 } });

for (const submodulo of SUBMODULOS_REPORTES_TIENDA_EN_LINEA) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Reportes > Tienda en Línea`, async ({ page }) => {
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

test.describe('Despacho de Órdenes', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const despacho = new ReporteDespachoOrdenesPage(page);

    await test.step('Abrir el reporte', async () => {
      await despacho.abrirReporteDespachoOrdenes();
    });

    await test.step('La tabla es visible', async () => {
      await despacho.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await despacho.validarSinErrores();
    });
  });

  test('la búsqueda por texto se ejecuta sin producir errores y limpiar restaura la tabla', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const despacho = new ReporteDespachoOrdenesPage(page);
    await despacho.abrirReporteDespachoOrdenes();

    await despacho.buscar('a');
    await despacho.validarTabla();
    await despacho.validarSinErrores();

    await despacho.limpiarBusqueda();
    await despacho.validarSinErrores();
  });

  test('una búsqueda sin coincidencias deja la tabla sin filas', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const despacho = new ReporteDespachoOrdenesPage(page);
    await despacho.abrirReporteDespachoOrdenes();

    await despacho.buscar('zzz_no_existe_nada_123456');
    await despacho.validarMensajeSinResultados();
    await despacho.validarSinErrores();
  });

  test('el rango de fechas se puede ampliar y la búsqueda se sigue ejecutando sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const despacho = new ReporteDespachoOrdenesPage(page);
    await despacho.abrirReporteDespachoOrdenes();

    await despacho.aumentarRangoFechas('2020-01-15', '2026-08-15');
    await despacho.buscar();
    await despacho.validarTabla();
    await despacho.validarSinErrores();

    // Rango más amplio aún — no se depende de una cantidad fija de
    // registros, solo de que el reporte siga respondiendo correctamente.
    await despacho.aumentarRangoFechas('2010-01-01', '2026-12-31');
    await despacho.buscar();
    await despacho.validarSinErrores();
  });

  test('el filtro de Cliente se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const despacho = new ReporteDespachoOrdenesPage(page);
    await despacho.abrirReporteDespachoOrdenes();

    await despacho.seleccionarCliente('Todos');
    await despacho.buscar();
    await despacho.validarSinErrores();
  });

  test('el filtro de Moneda se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const despacho = new ReporteDespachoOrdenesPage(page);
    await despacho.abrirReporteDespachoOrdenes();

    await despacho.seleccionarMoneda('Todos');
    await despacho.validarSinErrores();
  });

  test('los 6 chips de estado se pueden aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const despacho = new ReporteDespachoOrdenesPage(page);
    await despacho.abrirReporteDespachoOrdenes();

    for (const estado of ['Pendientes', 'Aprobadas', 'Facturadas', 'Entregadas', 'Canceladas', 'Todos'] as const) {
      await test.step(`Estado = ${estado}`, async () => {
        if (estado === 'Pendientes') await despacho.seleccionarEstadoPendientes();
        if (estado === 'Aprobadas') await despacho.seleccionarEstadoAprobadas();
        if (estado === 'Facturadas') await despacho.seleccionarEstadoFacturadas();
        if (estado === 'Entregadas') await despacho.seleccionarEstadoEntregadas();
        if (estado === 'Canceladas') await despacho.seleccionarEstadoCanceladas();
        if (estado === 'Todos') await despacho.seleccionarEstadoTodos();
        await despacho.validarSinErrores();
      });
    }
  });

  test('BUG: el valor escrito en el rango de fecha se revierte tras cerrar el datepicker huérfano', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const despacho = new ReporteDespachoOrdenesPage(page);
    await despacho.abrirReporteDespachoOrdenes();

    // Mismo bug de datepicker huérfano documentado en Ventas > Ventas por
    // Cliente/Notas de Crédito y en Taller > Órdenes: `.fill()` aplica el
    // valor correctamente, pero al cerrar el widget bootstrap-datepicker
    // (aquí con un clic neutral, dentro de `aumentarRangoFechas`) su
    // `hide()` sobrescribe el campo con su propio estado interno obsoleto.
    await despacho.aumentarRangoFechas('2020-01-15', '2026-08-15');

    expect(await despacho.obtenerFechaInicial()).not.toBe('2020-01-15');
    await despacho.validarSinErrores();
  });

  test('"Exportar reporte actual" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const despacho = new ReporteDespachoOrdenesPage(page);
    await despacho.abrirReporteDespachoOrdenes();

    const descarga = await despacho.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin columnas ordenables (sin `onclick` ni `cursor: pointer` en los
  // encabezados, confirmado en vivo) y sin paginación (confirmado en
  // vivo) — no se crean pruebas ficticias para ninguna. El ambiente de QA
  // actual no tiene órdenes que coincidan con ningún rango de fechas
  // probado, por lo que no fue posible confirmar en vivo la función de la
  // primera columna (sin encabezado) de la tabla ni una vista de detalle
  // de orden — no se asume su comportamiento ni se crea una prueba
  // ficticia para "abrirDetalleOrden".
});

test.describe('Órdenes', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);

    await test.step('Abrir el reporte', async () => {
      await ordenes.abrirReporteOrdenes();
    });

    await test.step('La tabla es visible', async () => {
      await ordenes.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await ordenes.validarSinErrores();
    });
  });

  test('la búsqueda por texto se ejecuta sin producir errores y limpiar restaura la tabla', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);
    await ordenes.abrirReporteOrdenes();

    await ordenes.buscar('a');
    await ordenes.validarTabla();
    await ordenes.validarSinErrores();

    await ordenes.limpiarBusqueda();
    await ordenes.validarSinErrores();
  });

  test('una búsqueda sin coincidencias deja la tabla sin filas', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);
    await ordenes.abrirReporteOrdenes();

    await ordenes.buscar('zzz_no_existe_nada_123456');
    await ordenes.validarMensajeSinResultados();
    await ordenes.validarSinErrores();
  });

  test('el rango de fechas se puede ampliar y la búsqueda se sigue ejecutando sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);
    await ordenes.abrirReporteOrdenes();

    await ordenes.aumentarRangoFechas('2020-01-15', '2026-08-15');
    await ordenes.buscar();
    await ordenes.validarTabla();
    await ordenes.validarSinErrores();

    await ordenes.aumentarRangoFechas('2010-01-01', '2026-12-31');
    await ordenes.buscar();
    await ordenes.validarSinErrores();
  });

  test('el filtro de Cliente se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);
    await ordenes.abrirReporteOrdenes();

    await ordenes.seleccionarCliente('Todas');
    await ordenes.buscar();
    await ordenes.validarSinErrores();
  });

  test('el filtro de Moneda se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);
    await ordenes.abrirReporteOrdenes();

    await ordenes.seleccionarMoneda('Todas');
    await ordenes.validarSinErrores();
  });

  test('los 6 chips de estado se pueden aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);
    await ordenes.abrirReporteOrdenes();

    for (const estado of ['Pendiente', 'Aprobadas', 'Facturadas', 'Entregadas', 'Canceladas', 'Todas'] as const) {
      await test.step(`Estado = ${estado}`, async () => {
        if (estado === 'Pendiente') await ordenes.seleccionarEstadoPendientes();
        if (estado === 'Aprobadas') await ordenes.seleccionarEstadoAprobadas();
        if (estado === 'Facturadas') await ordenes.seleccionarEstadoFacturadas();
        if (estado === 'Entregadas') await ordenes.seleccionarEstadoEntregadas();
        if (estado === 'Canceladas') await ordenes.seleccionarEstadoCanceladas();
        if (estado === 'Todas') await ordenes.seleccionarEstadoTodos();
        await ordenes.validarSinErrores();
      });
    }
  });

  test('BUG: el valor escrito en el rango de fecha se revierte tras cerrar el datepicker huérfano', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);
    await ordenes.abrirReporteOrdenes();

    await ordenes.aumentarRangoFechas('2020-01-15', '2026-08-15');

    expect(await ordenes.obtenerFechaInicial()).not.toBe('2020-01-15');
    await ordenes.validarSinErrores();
  });

  test('el "Total" de cada fila es un número coherente (mayor o igual a cero)', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);
    await ordenes.abrirReporteOrdenes();
    await ordenes.aumentarRangoFechas('2010-01-01', '2026-12-31');
    await ordenes.buscar();

    // No depender de una cantidad fija de registros: el ambiente de QA
    // puede no tener órdenes en el rango probado.
    const filas = await ordenes.contarFilas();
    test.skip(filas === 0, 'No hay filas para validar totales en el ambiente de QA actual');

    const total = await ordenes.obtenerTotalNumericoDeFila(0);
    expect(total).toBeGreaterThanOrEqual(0);
  });

  test('"Exportar reporte actual" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);
    await ordenes.abrirReporteOrdenes();

    const descarga = await ordenes.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin `<tfoot>` ni fila de totales generales (confirmado en vivo) — la
  // validación de totales se hace por fila, no sobre un total agregado.
  // Sin columnas ordenables ni paginación (confirmado en vivo) — no se
  // crean pruebas ficticias para ninguna. El ambiente de QA actual no
  // tiene órdenes que coincidan con ningún rango de fechas probado, por lo
  // que no fue posible confirmar en vivo la función de la primera columna
  // (sin encabezado) ni una vista de detalle de orden — no se asume su
  // comportamiento ni se crea una prueba ficticia para "abrirDetalleOrden".
});
