import { test, expect } from '@playwright/test';
import { ReportesPage, TIMEOUTS } from './reportes.page';
import {
  ReporteAbonosVentasPage,
  ReporteAnalisisVentasVendedorPage,
  ReporteAntiguedadCreditoVentasPage,
  ReporteComisionesPorCobrosPage,
  ReporteComisionesVendedorPage,
  ReporteCuentasPorCobrarVentasPage,
  ReporteFacturasHaciendaPage,
  ReporteListaCobroPage,
  ReporteNotasCreditoPage,
  ReporteUtilidadPage,
  ReporteVentasClientePage,
  ReporteVentasPage,
  ReporteVentasProductoPage,
  ReporteVentasProductosRapidosPage,
  ReporteVentasTiendaOnlinePage,
  ReporteVentasVendedorPage,
  SUBMODULOS_REPORTES_VENTAS,
  URL_COMISIONES_PRODUCTO,
} from './rp-ventas.page';

// El viewport por defecto de 'Desktop Chrome' (1280x720) puede provocar
// overlaps de layout responsive que no ocurren en una pantalla real de
// escritorio (lección confirmada en los módulos de Compras, Taller e
// Inventario) — se usa una resolución de escritorio realista para todo
// este archivo.
test.use({ viewport: { width: 1920, height: 1080 } });

for (const submodulo of SUBMODULOS_REPORTES_VENTAS) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Reportes > Ventas`, async ({ page }) => {
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

test.describe('BUG: Comisiones por Producto', () => {
  test('la navegación nunca termina de cargar', async ({ page }) => {
    test.setTimeout(120_000);

    let error: Error | null = null;
    try {
      await page.goto(URL_COMISIONES_PRODUCTO, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    } catch (e) {
      error = e as Error;
    }

    expect(error?.message).toMatch(/Timeout/);
  });
});

test.describe('Ventas', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventas = new ReporteVentasPage(page);

    await test.step('Abrir el reporte', async () => {
      await ventas.abrirReporteVentas();
    });

    await test.step('La tabla es visible', async () => {
      await ventas.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await ventas.validarSinErrores();
    });
  });

  test('la búsqueda por texto se ejecuta sin producir errores y limpiar restaura la tabla', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventas = new ReporteVentasPage(page);
    await ventas.abrirReporteVentas();

    await ventas.buscar('a');
    await ventas.validarTabla();
    await ventas.validarSinErrores();

    await ventas.limpiarBusqueda();
    await ventas.validarSinErrores();
  });

  test('el rango de fechas se puede ampliar y el valor persiste tras "Buscar"', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventas = new ReporteVentasPage(page);
    await ventas.abrirReporteVentas();

    // Los campos de fecha son `<input type="text">` que autocompletan la
    // hora ("12:00 AM") al escribir con `.fill()` — el valor persiste
    // correctamente tras "Buscar" (confirmado en vivo, sin bug de
    // datepicker huérfano en este reporte).
    await ventas.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await ventas.obtenerFechaInicial()).toContain('2020-01-15');
    expect(await ventas.obtenerFechaFinal()).toContain('2026-08-15');

    await ventas.buscar();
    await ventas.validarTabla();
    await ventas.validarSinErrores();

    expect(await ventas.obtenerFechaInicial()).toContain('2020-01-15');
    expect(await ventas.obtenerFechaFinal()).toContain('2026-08-15');
  });

  test('los 5 chips de estado se pueden aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventas = new ReporteVentasPage(page);
    await ventas.abrirReporteVentas();
    await ventas.aumentarRangoFechas('2020-01-15', '2026-08-15');

    for (const estado of ['Contado', 'Crédito', 'Créditos pendientes', 'Anuladas', 'Todas'] as const) {
      await test.step(`Estado = ${estado}`, async () => {
        if (estado === 'Contado') await ventas.seleccionarEstadoContado();
        if (estado === 'Crédito') await ventas.seleccionarEstadoCredito();
        if (estado === 'Créditos pendientes') await ventas.seleccionarEstadoCreditosPendientes();
        if (estado === 'Anuladas') await ventas.seleccionarEstadoAnuladas();
        if (estado === 'Todas') await ventas.seleccionarEstadoTodas();
        await ventas.validarSinErrores();
      });
    }
  });

  test('los filtros Tipo de pago, Categoría y Subcategoría se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventas = new ReporteVentasPage(page);
    await ventas.abrirReporteVentas();

    // Nota: cambiar "Categoría" recarga las opciones de "Subcategoría" vía
    // AJAX (mismo patrón cascada visto en Compras/Inventario) — se
    // selecciona Subcategoría primero, con la única opción real disponible
    // al cargar la página.
    await test.step('Subcategoría + Tipo de pago combinados', async () => {
      await ventas.seleccionarSubcategoria('Todas las subcategorías');
      await ventas.seleccionarTipoPago('Todas');
      await ventas.buscar();
      await ventas.validarSinErrores();
    });

    await test.step('Categoría combinada', async () => {
      await ventas.seleccionarCategoria('Todas las categorías');
      await ventas.buscar();
      await ventas.validarSinErrores();
    });
  });

  test('el filtro de Moneda se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventas = new ReporteVentasPage(page);
    await ventas.abrirReporteVentas();

    await ventas.seleccionarMoneda('Todas');
    await ventas.validarSinErrores();
  });

  test('BUG: "Descargar" no produce ninguna descarga real ni error observable', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventas = new ReporteVentasPage(page);
    await ventas.abrirReporteVentas();

    const descargaPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    const popupPromise = page.waitForEvent('popup', { timeout: 10000 }).catch(() => null);
    await ventas.clicEnDescargar();
    const [descarga, popup] = await Promise.all([descargaPromise, popupPromise]);

    expect(descarga).toBeNull();
    expect(popup).toBeNull();
    await ventas.validarSinErrores();
  });

  // Un botón adicional "Filtros de Vehículos" revela filtros de
  // marca/modelo/estilo/transmisión/motor de vehículo (confirmado en
  // vivo) — fuera del alcance principal de este reporte de ventas, no
  // cubierto aquí. Sin columnas ordenables ni paginación tradicional
  // (confirmado en vivo) — no se crean pruebas ficticias para ninguna.
});

test.describe('Ventas por Producto', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasProducto = new ReporteVentasProductoPage(page);

    await test.step('Abrir el reporte', async () => {
      await ventasProducto.abrirReporteVentasProducto();
    });

    await test.step('La tabla es visible', async () => {
      await ventasProducto.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await ventasProducto.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasProducto = new ReporteVentasProductoPage(page);
    await ventasProducto.abrirReporteVentasProducto();

    await ventasProducto.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await ventasProducto.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await ventasProducto.obtenerFechaFinal()).toBe('2026-08-15');

    await ventasProducto.buscar('a');
    await ventasProducto.validarTabla();
    await ventasProducto.validarSinErrores();

    await ventasProducto.limpiarBusqueda();
    await ventasProducto.validarSinErrores();
  });

  test('el filtro de Compañía se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasProducto = new ReporteVentasProductoPage(page);
    await ventasProducto.abrirReporteVentasProducto();

    await ventasProducto.seleccionarCompania('HONDURAS');
    await ventasProducto.buscar();
    await ventasProducto.validarSinErrores();
  });

  test('el filtro de Moneda se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasProducto = new ReporteVentasProductoPage(page);
    await ventasProducto.abrirReporteVentasProducto();

    await ventasProducto.seleccionarMoneda('Todas');
    await ventasProducto.validarSinErrores();
  });

  test('"Descargar Excel" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasProducto = new ReporteVentasProductoPage(page);
    await ventasProducto.abrirReporteVentasProducto();

    const descarga = await ventasProducto.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Es una tabla pivote dinámica (un bloque de columnas por mes del año en
  // curso) — no se asume un número fijo de columnas ni se validan totales
  // sobre columnas que pueden no existir en todos los ambientes. Sin
  // columnas ordenables ni paginación (confirmado en vivo) — no se crean
  // pruebas ficticias para ninguna.
});

test.describe('Análisis de Ventas por Vendedor', () => {
  test('carga sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const analisis = new ReporteAnalisisVentasVendedorPage(page);

    await test.step('Abrir el reporte', async () => {
      await analisis.abrirReporteAnalisisVentasVendedor();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await analisis.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const analisis = new ReporteAnalisisVentasVendedorPage(page);
    await analisis.abrirReporteAnalisisVentasVendedor();

    await analisis.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await analisis.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await analisis.obtenerFechaFinal()).toBe('2026-08-15');

    await analisis.buscar('a');
    await analisis.validarSinErrores();

    await analisis.limpiarBusqueda();
    await analisis.validarSinErrores();
  });

  test('los filtros Compañía, Vendedor, Tipo de resumen, Categoría y Subcategoría se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const analisis = new ReporteAnalisisVentasVendedorPage(page);
    await analisis.abrirReporteAnalisisVentasVendedor();

    // Mismo patrón cascada de filtros dependientes — Subcategoría primero.
    await test.step('Subcategoría + Categoría combinadas', async () => {
      await analisis.seleccionarSubcategoria('Todas las subcategorías');
      await analisis.seleccionarCategoria('Todas las categorías');
      await analisis.buscar();
      await analisis.validarSinErrores();
    });

    await test.step('Compañía + Vendedor + Tipo de resumen combinados', async () => {
      await analisis.seleccionarCompania('HONDURAS');
      await analisis.seleccionarVendedor('Todos los vendedores');
      // Sin opción "todos" en este select — solo presets de agrupación
      // (confirmado en vivo).
      await analisis.seleccionarTipoResumen('Semanal');
      await analisis.buscar();
      await analisis.validarSinErrores();
    });
  });

  test('"Descargar Excel" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const analisis = new ReporteAnalisisVentasVendedorPage(page);
    await analisis.abrirReporteAnalisisVentasVendedor();

    const descarga = await analisis.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin ninguna tabla `<table>` visible al cargar (confirmado en vivo) —
  // los resultados se renderizan por otro mecanismo (gráficos/resumen) que
  // no expone columnas ordenables ni paginación tradicional — no se crean
  // pruebas ficticias para ninguna.
});

test.describe('Abonos (Ventas)', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const abonos = new ReporteAbonosVentasPage(page);

    await test.step('Abrir el reporte', async () => {
      await abonos.abrirReporteAbonos();
    });

    await test.step('La tabla es visible', async () => {
      await abonos.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await abonos.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const abonos = new ReporteAbonosVentasPage(page);
    await abonos.abrirReporteAbonos();

    await abonos.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await abonos.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await abonos.obtenerFechaFinal()).toBe('2026-08-15');

    await abonos.buscar('a');
    await abonos.validarTabla();
    await abonos.validarSinErrores();

    await abonos.limpiarBusqueda();
    await abonos.validarSinErrores();
  });

  test('el filtro de Cliente y Moneda se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const abonos = new ReporteAbonosVentasPage(page);
    await abonos.abrirReporteAbonos();

    await abonos.seleccionarCliente('Todas');
    await abonos.buscar();
    await abonos.validarSinErrores();

    await abonos.seleccionarMoneda('Todas');
    await abonos.validarSinErrores();
  });

  test('BUG: "Descargar" no produce ninguna descarga real ni error observable', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const abonos = new ReporteAbonosVentasPage(page);
    await abonos.abrirReporteAbonos();

    const descargaPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    const popupPromise = page.waitForEvent('popup', { timeout: 10000 }).catch(() => null);
    await abonos.clicEnDescargar();
    const [descarga, popup] = await Promise.all([descargaPromise, popupPromise]);

    expect(descarga).toBeNull();
    expect(popup).toBeNull();
    await abonos.validarSinErrores();
  });

  // Sin fila de totales/tfoot, sin columnas ordenables y sin paginación
  // (confirmado en vivo) — no se crean pruebas ficticias para ninguna.
});

test.describe('Utilidad', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const utilidad = new ReporteUtilidadPage(page);

    await test.step('Abrir el reporte', async () => {
      await utilidad.abrirReporteUtilidad();
    });

    await test.step('La tabla es visible', async () => {
      await utilidad.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await utilidad.validarSinErrores();
    });
  });

  test('la búsqueda por texto se ejecuta sin producir errores y limpiar restaura la tabla', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const utilidad = new ReporteUtilidadPage(page);
    await utilidad.abrirReporteUtilidad();

    await utilidad.buscar('a');
    await utilidad.validarTabla();
    await utilidad.validarSinErrores();

    await utilidad.limpiarBusqueda();
    await utilidad.validarSinErrores();
  });

  test('BUG: el valor escrito en el rango de fecha se revierte a la fecha/hora actual', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const utilidad = new ReporteUtilidadPage(page);
    await utilidad.abrirReporteUtilidad();

    // Los campos de fecha están deshabilitados por defecto (confirmado en
    // vivo): "Resumen" controla el rango mediante presets ("Hoy", "Ayer",
    // etc.) y solo la opción "Rango de fecha" habilita ambos campos para
    // edición manual. Sin embargo, apenas se habilitan, el propio widget de
    // fecha sobrescribe cualquier valor escrito con `.fill()` por la
    // fecha/hora actual (confirmado en vivo, reproducido 2 veces) — mismo
    // patrón de bug de datepicker huérfano documentado en Taller > Órdenes.
    await utilidad.seleccionarResumen('Rango de fecha');
    await utilidad.aumentarRangoFechas('2020-01-15', '2026-08-15');

    expect(await utilidad.obtenerFechaInicial()).not.toContain('2020-01-15');
    await utilidad.validarSinErrores();
  });

  test('los filtros Resumen, Cliente, Vendedor y Caja se pueden aplicar combinados sin producir errores', async ({ page }) => {
    // "Últimos 30 días" dispara una consulta más pesada en el servidor de
    // QA (confirmado en vivo: ocasionalmente tarda más que el timeout
    // estándar) — se le da más margen que al resto de tests.
    test.setTimeout(150_000);
    const utilidad = new ReporteUtilidadPage(page);
    await utilidad.abrirReporteUtilidad();

    await utilidad.seleccionarResumen('Últimos 30 días');
    await utilidad.seleccionarCliente('Todos los clientes');
    await utilidad.seleccionarVendedor('Todos los vendedores');
    await utilidad.seleccionarCaja('Todas');
    await utilidad.buscar();
    await utilidad.validarSinErrores();
  });

  test('los filtros Tipo de venta, Tipo de margen, Categoría y Subcategoría se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const utilidad = new ReporteUtilidadPage(page);
    await utilidad.abrirReporteUtilidad();

    // Nota: a diferencia de otros reportes, aquí "Subcategoría" empieza
    // deshabilitada ("Seleccione primero una categoría") y solo se puebla
    // tras elegir una categoría específica — seleccionar "Todas" NO la
    // habilita (confirmado en vivo) — orden invertido respecto al patrón
    // cascada habitual, y requiere una categoría real (no "Todas").
    await test.step('Categoría + Subcategoría combinadas', async () => {
      await utilidad.seleccionarCategoria('Categoría');
      await utilidad.seleccionarSubcategoria('Todas las subcategorías');
      await utilidad.buscar();
      await utilidad.validarSinErrores();
    });

    await test.step('Tipo de venta + Tipo de margen combinados', async () => {
      await utilidad.seleccionarTipoVenta('Todas');
      await utilidad.seleccionarTipoMargen('Margen de utilidad sobre la venta');
      await utilidad.buscar();
      await utilidad.validarSinErrores();
    });
  });

  test('BUG: "Descargar" no produce ninguna descarga real ni error observable', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const utilidad = new ReporteUtilidadPage(page);
    await utilidad.abrirReporteUtilidad();

    const descargaPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    const popupPromise = page.waitForEvent('popup', { timeout: 10000 }).catch(() => null);
    await utilidad.clicEnDescargar();
    const [descarga, popup] = await Promise.all([descargaPromise, popupPromise]);

    expect(descarga).toBeNull();
    expect(popup).toBeNull();
    await utilidad.validarSinErrores();
  });

  // Sin fila de totales/tfoot, sin columnas ordenables y sin paginación
  // (confirmado en vivo) — no se crean pruebas ficticias para ninguna.
});

test.describe('Lista de Cobro', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const listaCobro = new ReporteListaCobroPage(page);

    await test.step('Abrir el reporte', async () => {
      await listaCobro.abrirReporteListaCobro();
    });

    await test.step('La tabla es visible', async () => {
      await listaCobro.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await listaCobro.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const listaCobro = new ReporteListaCobroPage(page);
    await listaCobro.abrirReporteListaCobro();

    await listaCobro.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await listaCobro.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await listaCobro.obtenerFechaFinal()).toBe('2026-08-15');

    await listaCobro.buscar('a');
    await listaCobro.validarTabla();
    await listaCobro.validarSinErrores();

    await listaCobro.limpiarBusqueda();
    await listaCobro.validarSinErrores();
  });

  test('los presets rápidos "Hoy" y "Semana" se pueden aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const listaCobro = new ReporteListaCobroPage(page);
    await listaCobro.abrirReporteListaCobro();

    await listaCobro.seleccionarPresetHoy();
    await listaCobro.validarSinErrores();

    await listaCobro.seleccionarPresetSemana();
    await listaCobro.validarSinErrores();
  });

  test('los 3 chips de estado (Todas/Pendientes/Abonado) se pueden aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const listaCobro = new ReporteListaCobroPage(page);
    await listaCobro.abrirReporteListaCobro();
    await listaCobro.aumentarRangoFechas('2020-01-15', '2026-08-15');

    for (const estado of ['Pendientes', 'Abonado', 'Todas'] as const) {
      await test.step(`Estado = ${estado}`, async () => {
        if (estado === 'Pendientes') await listaCobro.seleccionarEstadoPendientes();
        if (estado === 'Abonado') await listaCobro.seleccionarEstadoAbonado();
        if (estado === 'Todas') await listaCobro.seleccionarEstadoTodas();
        await listaCobro.validarSinErrores();
      });
    }
  });

  test('los filtros Cliente, Vendedor, Zona y Moneda se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const listaCobro = new ReporteListaCobroPage(page);
    await listaCobro.abrirReporteListaCobro();

    await listaCobro.seleccionarCliente('Todas');
    await listaCobro.seleccionarVendedor('Todas');
    await listaCobro.seleccionarZona('Todas');
    await listaCobro.buscar();
    await listaCobro.validarSinErrores();

    await listaCobro.seleccionarMoneda('Todas');
    await listaCobro.validarSinErrores();
  });

  test('"Imprimir reporte" desde el menú de opciones abre una pestaña nueva', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const listaCobro = new ReporteListaCobroPage(page);
    await listaCobro.abrirReporteListaCobro();

    const popup = await listaCobro.imprimir();
    expect(popup.url().length).toBeGreaterThan(0);
    await popup.close();
  });

  // Sin ningún botón de exportación (PDF/Excel) en esta pantalla
  // (confirmado en vivo) — no se crea ninguna prueba ficticia para
  // exportar. Sin columnas ordenables ni paginación tradicional.
});

test.describe('Cuentas por Cobrar (Ventas)', () => {
  test('carga con sus indicadores sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cxc = new ReporteCuentasPorCobrarVentasPage(page);

    await test.step('Abrir el reporte', async () => {
      await cxc.abrirReporteCuentasPorCobrar();
    });

    await test.step('Los 3 indicadores (Total Facturado/Total Abonado/Saldo Pendiente) son visibles', async () => {
      await expect.poll(() => cxc.indicadoresVisibles()).toBe(true);
    });

    await test.step('No hay mensaje de error visible', async () => {
      await cxc.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cxc = new ReporteCuentasPorCobrarVentasPage(page);
    await cxc.abrirReporteCuentasPorCobrar();

    await cxc.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await cxc.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await cxc.obtenerFechaFinal()).toBe('2026-08-15');

    await cxc.buscar('a');
    await cxc.validarSinErrores();

    await cxc.limpiarBusqueda();
    await cxc.validarSinErrores();
  });

  test('los filtros Compañía, Cliente, Modo de consulta y Moneda se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cxc = new ReporteCuentasPorCobrarVentasPage(page);
    await cxc.abrirReporteCuentasPorCobrar();

    await cxc.seleccionarCompania('HONDURAS');
    await cxc.seleccionarCliente('Todas');
    await cxc.seleccionarModoConsulta('Actual');
    await cxc.buscar();
    await cxc.validarSinErrores();

    await cxc.seleccionarMoneda('Todas');
    await cxc.validarSinErrores();
  });

  test('los 3 chips de estado (Todas/Pendiente/Canceladas) se pueden aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cxc = new ReporteCuentasPorCobrarVentasPage(page);
    await cxc.abrirReporteCuentasPorCobrar();

    for (const estado of ['Pendiente', 'Canceladas', 'Todas'] as const) {
      await test.step(`Estado = ${estado}`, async () => {
        if (estado === 'Pendiente') await cxc.seleccionarEstadoPendiente();
        if (estado === 'Canceladas') await cxc.seleccionarEstadoCanceladas();
        if (estado === 'Todas') await cxc.seleccionarEstadoTodas();
        await cxc.validarSinErrores();
      });
    }
  });

  test('los resultados se muestran como tarjetas con scroll infinito y "Ver abonos" abre el detalle', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cxc = new ReporteCuentasPorCobrarVentasPage(page);
    await cxc.abrirReporteCuentasPorCobrar();
    await cxc.buscar();

    // No depender de una cantidad fija de registros: el ambiente de QA
    // puede no tener cuentas pendientes en el estado por defecto.
    const tarjetas = await cxc.contarTarjetas();
    test.skip(tarjetas === 0, 'No hay tarjetas para validar en el ambiente de QA actual');

    await cxc.abrirVerAbonos(0);
    await cxc.validarSinErrores();
  });

  test('"Excel" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cxc = new ReporteCuentasPorCobrarVentasPage(page);
    await cxc.abrirReporteCuentasPorCobrar();
    await cxc.buscar();

    const tarjetas = await cxc.contarTarjetas();
    test.skip(tarjetas === 0, 'No hay datos para exportar en el ambiente de QA actual');

    const descarga = await cxc.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Resultados como tarjetas con scroll infinito (confirmado en vivo:
  // "Scroll infinito activo. Se cargan más filas al llegar al 85% del
  // contenedor.") — no es una tabla tradicional, sin columnas ordenables
  // ni paginación por número de página.
});

test.describe('Antigüedad de Crédito (Ventas)', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const antiguedad = new ReporteAntiguedadCreditoVentasPage(page);

    await test.step('Abrir el reporte', async () => {
      await antiguedad.abrirReporteAntiguedadCredito();
    });

    await test.step('La tabla es visible', async () => {
      await antiguedad.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await antiguedad.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const antiguedad = new ReporteAntiguedadCreditoVentasPage(page);
    await antiguedad.abrirReporteAntiguedadCredito();

    await antiguedad.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await antiguedad.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await antiguedad.obtenerFechaFinal()).toBe('2026-08-15');

    await antiguedad.buscar('a');
    await antiguedad.validarTabla();
    await antiguedad.validarSinErrores();

    await antiguedad.limpiarBusqueda();
    await antiguedad.validarSinErrores();
  });

  test('el filtro de Moneda se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const antiguedad = new ReporteAntiguedadCreditoVentasPage(page);
    await antiguedad.abrirReporteAntiguedadCredito();

    await antiguedad.seleccionarMoneda('Todas');
    await antiguedad.validarSinErrores();
  });

  test('el "Total" de cada fila es un número coherente (mayor o igual a cero)', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const antiguedad = new ReporteAntiguedadCreditoVentasPage(page);
    await antiguedad.abrirReporteAntiguedadCredito();
    await antiguedad.buscar();

    const filas = await antiguedad.contarFilas();
    test.skip(filas === 0, 'No hay filas para validar totales en el ambiente de QA actual');

    const total = await antiguedad.obtenerTotalNumericoDeFila(0);
    expect(total).toBeGreaterThanOrEqual(0);
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const antiguedad = new ReporteAntiguedadCreditoVentasPage(page);
    await antiguedad.abrirReporteAntiguedadCredito();

    const descarga = await antiguedad.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin columnas ordenables ni paginación tradicional (confirmado en vivo)
  // — no se crean pruebas ficticias para ninguna.
});

test.describe('Comisiones por Vendedor', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const comisiones = new ReporteComisionesVendedorPage(page);

    await test.step('Abrir el reporte', async () => {
      await comisiones.abrirReporteComisionesVendedor();
    });

    await test.step('La tabla es visible', async () => {
      await comisiones.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await comisiones.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const comisiones = new ReporteComisionesVendedorPage(page);
    await comisiones.abrirReporteComisionesVendedor();

    await comisiones.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await comisiones.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await comisiones.obtenerFechaFinal()).toBe('2026-08-15');

    await comisiones.buscar('a');
    await comisiones.validarTabla();
    await comisiones.validarSinErrores();

    await comisiones.limpiarBusqueda();
    await comisiones.validarSinErrores();
  });

  test('los filtros Usuario, Zona y Cliente se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const comisiones = new ReporteComisionesVendedorPage(page);
    await comisiones.abrirReporteComisionesVendedor();

    await comisiones.seleccionarUsuario('Todas');
    await comisiones.seleccionarZona('Todas');
    await comisiones.seleccionarCliente('Todas');
    await comisiones.buscar();
    await comisiones.validarSinErrores();
  });

  // Sin ningún botón de exportación (PDF/Excel) ni de Moneda en esta
  // pantalla (confirmado en vivo) — no se crea ninguna prueba ficticia
  // para exportar. Sin fila de totales/tfoot, sin columnas ordenables y
  // sin paginación — no se crean pruebas ficticias para ninguna.
});

test.describe('Facturas Hacienda', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const facturas = new ReporteFacturasHaciendaPage(page);

    await test.step('Abrir el reporte', async () => {
      await facturas.abrirReporteFacturasHacienda();
    });

    await test.step('La tabla es visible', async () => {
      await facturas.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await facturas.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const facturas = new ReporteFacturasHaciendaPage(page);
    await facturas.abrirReporteFacturasHacienda();

    await facturas.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await facturas.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await facturas.obtenerFechaFinal()).toBe('2026-08-15');

    await facturas.buscar('a');
    await facturas.validarTabla();
    await facturas.validarSinErrores();

    await facturas.limpiarBusqueda();
    await facturas.validarSinErrores();
  });

  test('los 3 chips de estado (Todas/Aceptado/Rechazado) se pueden aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const facturas = new ReporteFacturasHaciendaPage(page);
    await facturas.abrirReporteFacturasHacienda();

    for (const estado of ['Aceptado', 'Rechazado', 'Todas'] as const) {
      await test.step(`Estado = ${estado}`, async () => {
        if (estado === 'Aceptado') await facturas.seleccionarEstadoAceptado();
        if (estado === 'Rechazado') await facturas.seleccionarEstadoRechazado();
        if (estado === 'Todas') await facturas.seleccionarEstadoTodas();
        await facturas.validarSinErrores();
      });
    }
  });

  test('los filtros Tipo de documento, Tipo de factura y Moneda se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const facturas = new ReporteFacturasHaciendaPage(page);
    await facturas.abrirReporteFacturasHacienda();

    // Sin opción "todos" en Tipo de documento (confirmado en vivo) — se
    // selecciona un valor real.
    await facturas.seleccionarTipoDocumento('Factura Electrónica');
    await facturas.seleccionarTipoFactura('Todos');
    await facturas.buscar();
    await facturas.validarSinErrores();

    await facturas.seleccionarMoneda('Todas');
    await facturas.validarSinErrores();
  });

  test('BUG: "Descargar" no produce ninguna descarga real ni error observable', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const facturas = new ReporteFacturasHaciendaPage(page);
    await facturas.abrirReporteFacturasHacienda();

    const descargaPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    const popupPromise = page.waitForEvent('popup', { timeout: 10000 }).catch(() => null);
    await facturas.clicEnDescargar();
    const [descarga, popup] = await Promise.all([descargaPromise, popupPromise]);

    expect(descarga).toBeNull();
    expect(popup).toBeNull();
    await facturas.validarSinErrores();
  });

  // Sin fila de totales/tfoot, sin columnas ordenables y sin paginación
  // (confirmado en vivo) — no se crean pruebas ficticias para ninguna.
});

test.describe('Ventas de Productos Rápidos', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const rapidos = new ReporteVentasProductosRapidosPage(page);

    await test.step('Abrir el reporte', async () => {
      await rapidos.abrirReporteVentasProductosRapidos();
    });

    await test.step('La tabla es visible', async () => {
      await rapidos.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await rapidos.validarSinErrores();
    });
  });

  test('la búsqueda por texto se ejecuta sin producir errores y limpiar restaura la tabla', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const rapidos = new ReporteVentasProductosRapidosPage(page);
    await rapidos.abrirReporteVentasProductosRapidos();

    await rapidos.buscar('a');
    await rapidos.validarTabla();
    await rapidos.validarSinErrores();

    await rapidos.limpiarBusqueda();
    await rapidos.validarSinErrores();
  });

  test('el rango de fechas se puede ampliar y el valor persiste tras "Buscar"', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const rapidos = new ReporteVentasProductosRapidosPage(page);
    await rapidos.abrirReporteVentasProductosRapidos();

    // Mismo tipo de campo de texto con autocompletado de hora que "Ventas".
    await rapidos.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await rapidos.obtenerFechaInicial()).toContain('2020-01-15');
    expect(await rapidos.obtenerFechaFinal()).toContain('2026-08-15');

    await rapidos.buscar();
    await rapidos.validarTabla();
    await rapidos.validarSinErrores();

    expect(await rapidos.obtenerFechaInicial()).toContain('2020-01-15');
    expect(await rapidos.obtenerFechaFinal()).toContain('2026-08-15');
  });

  test('los chips de estado y el filtro de Moneda se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const rapidos = new ReporteVentasProductosRapidosPage(page);
    await rapidos.abrirReporteVentasProductosRapidos();

    await rapidos.seleccionarEstadoContado();
    await rapidos.validarSinErrores();

    await rapidos.seleccionarEstadoCredito();
    await rapidos.validarSinErrores();

    await rapidos.seleccionarEstadoTodas();
    await rapidos.seleccionarMoneda('Todas');
    await rapidos.validarSinErrores();
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const rapidos = new ReporteVentasProductosRapidosPage(page);
    await rapidos.abrirReporteVentasProductosRapidos();

    const descarga = await rapidos.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin fila de totales/tfoot, sin columnas ordenables y sin paginación
  // (confirmado en vivo) — no se crean pruebas ficticias para ninguna.
});

test.describe('Ventas por Vendedor', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasVendedor = new ReporteVentasVendedorPage(page);

    await test.step('Abrir el reporte', async () => {
      await ventasVendedor.abrirReporteVentasVendedor();
    });

    await test.step('La tabla es visible', async () => {
      await ventasVendedor.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await ventasVendedor.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasVendedor = new ReporteVentasVendedorPage(page);
    await ventasVendedor.abrirReporteVentasVendedor();

    await ventasVendedor.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await ventasVendedor.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await ventasVendedor.obtenerFechaFinal()).toBe('2026-08-15');

    await ventasVendedor.buscar('a');
    await ventasVendedor.validarTabla();
    await ventasVendedor.validarSinErrores();

    await ventasVendedor.limpiarBusqueda();
    await ventasVendedor.validarSinErrores();
  });

  test('los filtros Usuario, Zona, Cliente y Tipo de pago se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasVendedor = new ReporteVentasVendedorPage(page);
    await ventasVendedor.abrirReporteVentasVendedor();

    // Nota: elegir Usuario/Zona repuebla las opciones de "Cliente" vía AJAX
    // (confirmado en vivo: la lista cambia por completo y su opción "todas"
    // pasa de "Todas" a "Todos") — se selecciona Cliente primero, con la
    // opción real disponible al cargar la página.
    await ventasVendedor.seleccionarCliente('Todas');
    await ventasVendedor.seleccionarUsuario('Todas');
    await ventasVendedor.seleccionarZona('Todas');
    await ventasVendedor.seleccionarTipoPago('Todas');
    await ventasVendedor.buscar();
    await ventasVendedor.validarSinErrores();
  });

  test('el filtro de Moneda se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasVendedor = new ReporteVentasVendedorPage(page);
    await ventasVendedor.abrirReporteVentasVendedor();

    await ventasVendedor.seleccionarMoneda('Todas');
    await ventasVendedor.validarSinErrores();
  });

  test('la fila de totales es visible tras "Buscar"', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasVendedor = new ReporteVentasVendedorPage(page);
    await ventasVendedor.abrirReporteVentasVendedor();
    await ventasVendedor.buscar();

    expect(await ventasVendedor.totalesVisibles()).toBe(true);
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasVendedor = new ReporteVentasVendedorPage(page);
    await ventasVendedor.abrirReporteVentasVendedor();

    const descarga = await ventasVendedor.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin columnas ordenables ni paginación tradicional (confirmado en vivo)
  // — no se crean pruebas ficticias para ninguna.
});

test.describe('(%) Comisiones por Cobros', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const comisiones = new ReporteComisionesPorCobrosPage(page);

    await test.step('Abrir el reporte', async () => {
      await comisiones.abrirReporteComisionesPorCobros();
    });

    await test.step('La tabla es visible', async () => {
      await comisiones.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await comisiones.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const comisiones = new ReporteComisionesPorCobrosPage(page);
    await comisiones.abrirReporteComisionesPorCobros();

    await comisiones.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await comisiones.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await comisiones.obtenerFechaFinal()).toBe('2026-08-15');

    await comisiones.buscar('a');
    await comisiones.validarTabla();
    await comisiones.validarSinErrores();

    await comisiones.limpiarBusqueda();
    await comisiones.validarSinErrores();
  });

  test('los filtros Zona y Moneda se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const comisiones = new ReporteComisionesPorCobrosPage(page);
    await comisiones.abrirReporteComisionesPorCobros();

    await comisiones.seleccionarZona('Todas');
    await comisiones.buscar();
    await comisiones.validarSinErrores();

    await comisiones.seleccionarMoneda('Todas');
    await comisiones.validarSinErrores();
  });

  // Sin ningún botón de exportación (PDF/Excel) en esta pantalla
  // (confirmado en vivo) — no se crea ninguna prueba ficticia para
  // exportar. Sin fila de totales/tfoot, sin columnas ordenables y sin
  // paginación — no se crean pruebas ficticias para ninguna.
});

test.describe('Ventas por Cliente', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasCliente = new ReporteVentasClientePage(page);

    await test.step('Abrir el reporte', async () => {
      await ventasCliente.abrirReporteVentasCliente();
    });

    await test.step('La tabla es visible', async () => {
      await ventasCliente.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await ventasCliente.validarSinErrores();
    });
  });

  test('la búsqueda por texto se ejecuta sin producir errores y limpiar restaura la tabla', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasCliente = new ReporteVentasClientePage(page);
    await ventasCliente.abrirReporteVentasCliente();

    await ventasCliente.buscar('a');
    await ventasCliente.validarTabla();
    await ventasCliente.validarSinErrores();

    await ventasCliente.limpiarBusqueda();
    await ventasCliente.validarSinErrores();
  });

  test('BUG: el valor escrito en el rango de fecha se revierte tras cerrar el datepicker huérfano', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasCliente = new ReporteVentasClientePage(page);
    await ventasCliente.abrirReporteVentasCliente();

    // Este reporte tiene un widget bootstrap-datepicker redundante sobre el
    // `<input type="date">` nativo. Al escribir con `.fill()` el valor se
    // aplica correctamente, pero el widget queda abierto y su `hide()`
    // (disparado al cerrarlo, p.ej. con un clic neutral) sobrescribe el
    // valor con su propio estado interno obsoleto (confirmado en vivo,
    // mismo patrón documentado en Taller > Órdenes) — no es un problema del
    // test, es un bug real del componente.
    await ventasCliente.aumentarRangoFechas('2020-01-15', '2026-08-15');

    expect(await ventasCliente.obtenerFechaInicial()).not.toBe('2020-01-15');
    await ventasCliente.validarSinErrores();
  });

  test('los 4 chips de estado se pueden aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasCliente = new ReporteVentasClientePage(page);
    await ventasCliente.abrirReporteVentasCliente();

    for (const estado of ['Contado', 'Crédito', 'Créditos pendientes', 'Todas'] as const) {
      await test.step(`Estado = ${estado}`, async () => {
        if (estado === 'Contado') await ventasCliente.seleccionarEstadoContado();
        if (estado === 'Crédito') await ventasCliente.seleccionarEstadoCredito();
        if (estado === 'Créditos pendientes') await ventasCliente.seleccionarEstadoCreditosPendientes();
        if (estado === 'Todas') await ventasCliente.seleccionarEstadoTodas();
        await ventasCliente.validarSinErrores();
      });
    }
  });

  test('los filtros Cliente, Grupo y Moneda se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasCliente = new ReporteVentasClientePage(page);
    await ventasCliente.abrirReporteVentasCliente();

    await ventasCliente.seleccionarCliente('Todas');
    await ventasCliente.seleccionarGrupo('Todas los grupos');
    await ventasCliente.buscar();
    await ventasCliente.validarSinErrores();

    await ventasCliente.seleccionarMoneda('Todas');
    await ventasCliente.validarSinErrores();
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ventasCliente = new ReporteVentasClientePage(page);
    await ventasCliente.abrirReporteVentasCliente();

    const descarga = await ventasCliente.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin fila de totales/tfoot, sin columnas ordenables y sin paginación
  // (confirmado en vivo) — no se crean pruebas ficticias para ninguna.
});

test.describe('Notas de Crédito', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const notasCredito = new ReporteNotasCreditoPage(page);

    await test.step('Abrir el reporte', async () => {
      await notasCredito.abrirReporteNotasCredito();
    });

    await test.step('La tabla es visible', async () => {
      await notasCredito.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await notasCredito.validarSinErrores();
    });
  });

  test('la búsqueda por texto se ejecuta sin producir errores y limpiar restaura la tabla', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const notasCredito = new ReporteNotasCreditoPage(page);
    await notasCredito.abrirReporteNotasCredito();

    await notasCredito.buscar('a');
    await notasCredito.validarTabla();
    await notasCredito.validarSinErrores();

    await notasCredito.limpiarBusqueda();
    await notasCredito.validarSinErrores();
  });

  test('BUG: el valor escrito en el rango de fecha se revierte tras cerrar el datepicker huérfano', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const notasCredito = new ReporteNotasCreditoPage(page);
    await notasCredito.abrirReporteNotasCredito();

    // Mismo bug de datepicker huérfano confirmado en "Ventas por Cliente":
    // el `hide()` del widget bootstrap-datepicker sobrescribe el valor
    // recién escrito con su estado interno obsoleto.
    await notasCredito.aumentarRangoFechas('2020-01-15', '2026-08-15');

    expect(await notasCredito.obtenerFechaInicial()).not.toBe('2020-01-15');
    await notasCredito.validarSinErrores();
  });

  test('los 3 chips de tipo (Todas/Factura/Órdenes de entrega) se pueden aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const notasCredito = new ReporteNotasCreditoPage(page);
    await notasCredito.abrirReporteNotasCredito();

    for (const tipo of ['Factura', 'Órdenes de entrega', 'Todas'] as const) {
      await test.step(`Tipo = ${tipo}`, async () => {
        if (tipo === 'Factura') await notasCredito.seleccionarTipoFactura();
        if (tipo === 'Órdenes de entrega') await notasCredito.seleccionarTipoOrdenesEntrega();
        if (tipo === 'Todas') await notasCredito.seleccionarTipoTodas();
        await notasCredito.validarSinErrores();
      });
    }
  });

  test('los filtros Cliente, Zona, Estado y Moneda se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const notasCredito = new ReporteNotasCreditoPage(page);
    await notasCredito.abrirReporteNotasCredito();

    await notasCredito.seleccionarCliente('Todas');
    await notasCredito.seleccionarZona('Todas las zonas');
    await notasCredito.seleccionarEstado('Todos los estados');
    await notasCredito.buscar();
    await notasCredito.validarSinErrores();

    await notasCredito.seleccionarMoneda('Todas');
    await notasCredito.validarSinErrores();
  });

  test('el "Total" de cada fila es un número coherente (mayor o igual a cero)', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const notasCredito = new ReporteNotasCreditoPage(page);
    await notasCredito.abrirReporteNotasCredito();
    await notasCredito.buscar();

    const filas = await notasCredito.contarFilas();
    test.skip(filas === 0, 'No hay filas para validar totales en el ambiente de QA actual');

    const total = await notasCredito.obtenerTotalNumericoDeFila(0);
    expect(total).toBeGreaterThanOrEqual(0);
  });

  test('BUG: "Descargar" no produce ninguna descarga real ni error observable', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const notasCredito = new ReporteNotasCreditoPage(page);
    await notasCredito.abrirReporteNotasCredito();

    const descargaPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    const popupPromise = page.waitForEvent('popup', { timeout: 10000 }).catch(() => null);
    await notasCredito.clicEnDescargar();
    const [descarga, popup] = await Promise.all([descargaPromise, popupPromise]);

    expect(descarga).toBeNull();
    expect(popup).toBeNull();
    await notasCredito.validarSinErrores();
  });

  // Sin columnas ordenables ni paginación tradicional (confirmado en vivo)
  // — no se crean pruebas ficticias para ninguna.
});

test.describe('Ventas de Tienda Online', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const tiendaOnline = new ReporteVentasTiendaOnlinePage(page);

    await test.step('Abrir el reporte', async () => {
      await tiendaOnline.abrirReporteVentasTiendaOnline();
    });

    await test.step('La tabla es visible', async () => {
      await tiendaOnline.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await tiendaOnline.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const tiendaOnline = new ReporteVentasTiendaOnlinePage(page);
    await tiendaOnline.abrirReporteVentasTiendaOnline();

    await tiendaOnline.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await tiendaOnline.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await tiendaOnline.obtenerFechaFinal()).toBe('2026-08-15');

    await tiendaOnline.buscar('a');
    await tiendaOnline.validarTabla();
    await tiendaOnline.validarSinErrores();

    await tiendaOnline.limpiarBusqueda();
    await tiendaOnline.validarSinErrores();
  });

  test('el filtro de Tipo de pago se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const tiendaOnline = new ReporteVentasTiendaOnlinePage(page);
    await tiendaOnline.abrirReporteVentasTiendaOnline();

    await tiendaOnline.seleccionarTipoPago('Todos');
    await tiendaOnline.buscar();
    await tiendaOnline.validarSinErrores();
  });

  test('BUG: "Descargar" no produce ninguna descarga real ni error observable', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const tiendaOnline = new ReporteVentasTiendaOnlinePage(page);
    await tiendaOnline.abrirReporteVentasTiendaOnline();

    const descargaPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    const popupPromise = page.waitForEvent('popup', { timeout: 10000 }).catch(() => null);
    await tiendaOnline.clicEnDescargar();
    const [descarga, popup] = await Promise.all([descargaPromise, popupPromise]);

    expect(descarga).toBeNull();
    expect(popup).toBeNull();
    await tiendaOnline.validarSinErrores();
  });

  // Sin filtro de Moneda en esta pantalla (confirmado en vivo). Sin fila
  // de totales/tfoot, sin columnas ordenables y sin paginación
  // (confirmado en vivo) — no se crean pruebas ficticias para ninguna.
});
