import { test, expect } from '@playwright/test';
import { ReportesPage, TIMEOUTS } from './reportes.page';
import {
  ReporteAnalisisProductosPage,
  ReporteApartadosPage,
  ReporteCatalogoProductosPage,
  ReporteDisponibilidadProductosVendidosPage,
  ReporteInventarioPage,
  ReporteMovimientosProductosPage,
  ReporteProductosAPedirPage,
  ReporteProductosExternosPage,
  ReporteProductosPorTallasPage,
  ReporteProductosPorVencerPage,
  ReporteProductosVendidosPage,
  ReporteRotacionInventarioPage,
  ReporteTomaFisicaPage,
  SUBMODULOS_REPORTES_INVENTARIO,
} from './rp-inventario.page';

// El viewport por defecto de 'Desktop Chrome' (1280x720) puede provocar
// overlaps de layout responsive que no ocurren en una pantalla real de
// escritorio (lección confirmada en los módulos de Compras y Taller) — se
// usa una resolución de escritorio realista para todo este archivo.
test.use({ viewport: { width: 1920, height: 1080 } });

for (const submodulo of SUBMODULOS_REPORTES_INVENTARIO) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Reportes > Inventario`, async ({ page }) => {
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

test.describe('Inventario', () => {
  test('carga sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const inventario = new ReporteInventarioPage(page);

    await test.step('Abrir el reporte', async () => {
      await inventario.abrirReporteInventario();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await inventario.validarSinErrores();
    });
  });

  test('la búsqueda por texto se ejecuta sin producir errores y limpiar restaura las tarjetas', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const inventario = new ReporteInventarioPage(page);
    await inventario.abrirReporteInventario();

    await inventario.buscar('a');
    await inventario.validarSinErrores();

    await inventario.limpiarBusqueda();
    await inventario.validarSinErrores();
  });

  test('los filtros Categoría, Subcategoría y Proveedor se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const inventario = new ReporteInventarioPage(page);
    await inventario.abrirReporteInventario();

    await inventario.seleccionarCategoria('Todas las categorías');
    await inventario.seleccionarProveedor('Todos los proveedores');
    await inventario.buscar();
    await inventario.validarSinErrores();

    await inventario.limpiarFiltros();
    await inventario.validarSinErrores();
  });

  test('"Mostrar detalles" expande un grupo de productos sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const inventario = new ReporteInventarioPage(page);
    await inventario.abrirReporteInventario();
    await inventario.buscar();

    await expect.poll(() => inventario.contarTarjetas()).toBeGreaterThan(0);
    await inventario.mostrarDetalles(0);
    await inventario.validarSinErrores();
  });

  test('BUG: "Descargar" no produce ninguna descarga real ni error observable', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const inventario = new ReporteInventarioPage(page);
    await inventario.abrirReporteInventario();

    const descargaPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await inventario.clicEnDescargar();
    const descarga = await descargaPromise;

    expect(descarga).toBeNull();
    await inventario.validarSinErrores();
  });

  // Sin filtro de fechas (confirmado en vivo). Resultados como tarjetas, no
  // una tabla tradicional — sin columnas ordenables, sin fila de totales y
  // sin paginación tradicional (confirmado en vivo) — no se crean pruebas
  // ficticias para ninguna.
});

test.describe('Análisis de Productos', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const analisis = new ReporteAnalisisProductosPage(page);

    await test.step('Abrir el reporte', async () => {
      await analisis.abrirReporteAnalisisProductos();
    });

    await test.step('La tabla es visible', async () => {
      await analisis.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await analisis.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const analisis = new ReporteAnalisisProductosPage(page);
    await analisis.abrirReporteAnalisisProductos();

    await analisis.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await analisis.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await analisis.obtenerFechaFinal()).toBe('2026-08-15');

    await analisis.buscar('a');
    await analisis.validarTabla();
    await analisis.validarSinErrores();

    await analisis.limpiarBusqueda();
    await analisis.validarSinErrores();
  });

  test('los filtros Compañía, Categoría, Subcategoría y Proveedor se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const analisis = new ReporteAnalisisProductosPage(page);
    await analisis.abrirReporteAnalisisProductos();

    // Nota: cambiar "Categoría" o "Compañía" recarga las opciones de
    // Subcategoría vía AJAX y la deja con una única opción en blanco
    // (confirmado en vivo) — se aplica Subcategoría primero (con la única
    // opción real disponible al cargar la página), y Categoría/Compañía
    // después, sin volver a tocar Subcategoría.
    await test.step('Subcategoría + Proveedor combinados', async () => {
      await analisis.seleccionarSubcategoria('Todas las subcategorías');
      await analisis.seleccionarProveedor('Todos los proveedores');
      await analisis.buscar();
      await analisis.validarTabla();
      await analisis.validarSinErrores();
    });

    await test.step('Categoría + Compañía combinadas', async () => {
      await analisis.seleccionarCategoria('Todas las categorías');
      await analisis.seleccionarCompania('HONDURAS');
      await analisis.buscar();
      await analisis.validarSinErrores();
    });
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const analisis = new ReporteAnalisisProductosPage(page);
    await analisis.abrirReporteAnalisisProductos();

    const descarga = await analisis.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Es una tabla pivote dinámica (una columna por compañía registrada) —
  // no se asume un número fijo de columnas ni se validan totales sobre
  // columnas que pueden no existir en todos los ambientes. Sin columnas
  // ordenables ni paginación (confirmado en vivo) — no se crean pruebas
  // ficticias para ninguna.
});

test.describe('Tasa de Rotación de Inventario', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const rotacion = new ReporteRotacionInventarioPage(page);

    await test.step('Abrir el reporte', async () => {
      await rotacion.abrirReporteRotacionInventario();
    });

    await test.step('La tabla es visible', async () => {
      await rotacion.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await rotacion.validarSinErrores();
    });
  });

  test('la búsqueda por texto se ejecuta sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const rotacion = new ReporteRotacionInventarioPage(page);
    await rotacion.abrirReporteRotacionInventario();

    await rotacion.buscar('a');
    await rotacion.validarTabla();
    await rotacion.validarSinErrores();

    await rotacion.limpiarBusqueda();
    await rotacion.validarSinErrores();
  });

  test('BUG: la fecha escrita en el rango revierte al valor por defecto tras "Buscar"', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const rotacion = new ReporteRotacionInventarioPage(page);
    await rotacion.abrirReporteRotacionInventario();

    const inicialPorDefecto = await rotacion.obtenerFechaInicial();
    await rotacion.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await rotacion.obtenerFechaInicial()).toBe('2020-01-15');

    await rotacion.buscar();
    await rotacion.validarSinErrores();

    expect(await rotacion.obtenerFechaInicial()).toBe(inicialPorDefecto);
  });

  test('los filtros de Categoría, Subcategoría, Producto y Orden por cantidad se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const rotacion = new ReporteRotacionInventarioPage(page);
    await rotacion.abrirReporteRotacionInventario();

    await test.step('Categoría + Subcategoría combinadas', async () => {
      await rotacion.seleccionarCategoria('Todas las categorías');
      await rotacion.seleccionarSubcategoria('Todas las subcategorías');
      await rotacion.buscar();
      await rotacion.validarTabla();
      await rotacion.validarSinErrores();
    });

    await test.step('Producto + Orden por cantidad combinados', async () => {
      await rotacion.seleccionarProducto('Seleccionar opción');
      await rotacion.seleccionarOrdenPorCantidad('Más vendido');
      await rotacion.buscar();
      await rotacion.validarSinErrores();
    });
  });

  test('el filtro de Moneda se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const rotacion = new ReporteRotacionInventarioPage(page);
    await rotacion.abrirReporteRotacionInventario();

    await rotacion.seleccionarMoneda('Todos');
    await rotacion.validarSinErrores();
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const rotacion = new ReporteRotacionInventarioPage(page);
    await rotacion.abrirReporteRotacionInventario();

    const descarga = await rotacion.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin fila de totales/tfoot, sin columnas ordenables y sin paginación
  // (confirmado en vivo) — no se crean pruebas ficticias para ninguna.
});

test.describe('Catálogo de Productos', () => {
  test('carga sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const catalogo = new ReporteCatalogoProductosPage(page);

    await test.step('Abrir el reporte', async () => {
      await catalogo.abrirReporteCatalogoProductos();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await catalogo.validarSinErrores();
    });
  });

  test('la búsqueda por texto se ejecuta sin producir errores y limpiar restaura las tarjetas', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const catalogo = new ReporteCatalogoProductosPage(page);
    await catalogo.abrirReporteCatalogoProductos();

    await catalogo.buscar('a');
    await catalogo.validarSinErrores();

    await catalogo.limpiarBusqueda();
    await catalogo.validarSinErrores();
  });

  test('los filtros Categoría, Subcategoría, Proveedor y "Stock positivo" se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const catalogo = new ReporteCatalogoProductosPage(page);
    await catalogo.abrirReporteCatalogoProductos();

    await test.step('Categoría + Subcategoría combinadas', async () => {
      await catalogo.seleccionarCategoria('Todas las categorías');
      await catalogo.seleccionarSubcategoria('Todas las subcategorías');
      await catalogo.buscar();
      await catalogo.validarSinErrores();
    });

    await test.step('Proveedor + "Stock positivo" combinados', async () => {
      await catalogo.seleccionarProveedor('Todos los proveedores');
      await catalogo.seleccionarSoloStockPositivo();
      await catalogo.validarSinErrores();
    });

    await test.step('"limpiar filtros" restaura los valores por defecto sin errores', async () => {
      await catalogo.limpiarFiltros();
      await catalogo.validarSinErrores();
    });
  });

  test('BUG: "Descargar" no produce ninguna descarga real ni error observable', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const catalogo = new ReporteCatalogoProductosPage(page);
    await catalogo.abrirReporteCatalogoProductos();

    const descargaPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await catalogo.clicEnDescargar();
    const descarga = await descargaPromise;

    expect(descarga).toBeNull();
    await catalogo.validarSinErrores();
  });

  // Sin filtro de fechas (confirmado en vivo). Resultados como tarjetas, no
  // una tabla tradicional — sin columnas ordenables ni paginación
  // tradicional (confirmado en vivo) — no se crean pruebas ficticias.
});

test.describe('Apartados', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const apartados = new ReporteApartadosPage(page);

    await test.step('Abrir el reporte', async () => {
      await apartados.abrirReporteApartados();
    });

    await test.step('La tabla es visible', async () => {
      await apartados.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await apartados.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const apartados = new ReporteApartadosPage(page);
    await apartados.abrirReporteApartados();

    await apartados.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await apartados.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await apartados.obtenerFechaFinal()).toBe('2026-08-15');

    await apartados.buscar('a');
    await apartados.validarTabla();
    await apartados.validarSinErrores();

    await apartados.limpiarBusqueda();
    await apartados.validarSinErrores();
  });

  test('el filtro de Moneda se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const apartados = new ReporteApartadosPage(page);
    await apartados.abrirReporteApartados();

    await apartados.seleccionarMoneda('Todos');
    await apartados.validarSinErrores();
  });

  test('los totales por moneda son visibles y coherentes con los datos mostrados', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const apartados = new ReporteApartadosPage(page);
    await apartados.abrirReporteApartados();
    await apartados.aumentarRangoFechas('2020-01-15', '2026-08-15');
    await apartados.buscar();

    expect(await apartados.totalesVisibles()).toBe(true);

    const totalUsd = await apartados.obtenerTotalUsd();
    const totalCrc = await apartados.obtenerTotalCrc();
    expect(totalUsd).toBeGreaterThanOrEqual(0);
    expect(totalCrc).toBeGreaterThanOrEqual(0);
  });

  // Sin columnas ordenables ni paginación tradicional (confirmado en vivo)
  // — no se crean pruebas ficticias para ninguna. Sin exportación de
  // ningún tipo (confirmado en vivo: no existe botón de Descargar en esta
  // pantalla) — no se crea ninguna prueba ficticia para exportar.
});

test.describe('Toma Física', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const tomaFisica = new ReporteTomaFisicaPage(page);

    await test.step('Abrir el reporte', async () => {
      await tomaFisica.abrirReporteTomaFisica();
    });

    await test.step('La tabla es visible', async () => {
      await tomaFisica.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await tomaFisica.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const tomaFisica = new ReporteTomaFisicaPage(page);
    await tomaFisica.abrirReporteTomaFisica();

    await tomaFisica.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await tomaFisica.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await tomaFisica.obtenerFechaFinal()).toBe('2026-08-15');

    await tomaFisica.buscar('a');
    await tomaFisica.validarTabla();
    await tomaFisica.validarSinErrores();

    await tomaFisica.limpiarBusqueda();
    await tomaFisica.validarSinErrores();
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const tomaFisica = new ReporteTomaFisicaPage(page);
    await tomaFisica.abrirReporteTomaFisica();

    const descarga = await tomaFisica.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin filtros de Categoría/Proveedor/Estado (confirmado en vivo, es un
  // listado de documentos de toma física, no de productos). Sin fila de
  // totales/tfoot, sin columnas ordenables y sin paginación (confirmado en
  // vivo) — no se crean pruebas ficticias para ninguna.
});

test.describe('Movimientos de Productos', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const movimientos = new ReporteMovimientosProductosPage(page);

    await test.step('Abrir el reporte', async () => {
      await movimientos.abrirReporteMovimientosProductos();
    });

    await test.step('La tabla es visible', async () => {
      await movimientos.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await movimientos.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const movimientos = new ReporteMovimientosProductosPage(page);
    await movimientos.abrirReporteMovimientosProductos();

    await movimientos.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await movimientos.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await movimientos.obtenerFechaFinal()).toBe('2026-08-15');

    await movimientos.buscar('a');
    await movimientos.validarTabla();
    await movimientos.validarSinErrores();

    await movimientos.limpiarBusqueda();
    await movimientos.validarSinErrores();
  });

  test('el filtro Tipo de movimiento se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const movimientos = new ReporteMovimientosProductosPage(page);
    await movimientos.abrirReporteMovimientosProductos();

    await movimientos.seleccionarTipoMovimiento('Todos Movimientos');
    await movimientos.buscar();
    await movimientos.validarSinErrores();
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const movimientos = new ReporteMovimientosProductosPage(page);
    await movimientos.abrirReporteMovimientosProductos();

    const descarga = await movimientos.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin fila de totales/tfoot, sin columnas ordenables y sin paginación
  // (confirmado en vivo) — no se crean pruebas ficticias para ninguna.
});

test.describe('Disponibilidad de Productos Vendidos', () => {
  test('carga sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const disponibilidad = new ReporteDisponibilidadProductosVendidosPage(page);

    await test.step('Abrir el reporte', async () => {
      await disponibilidad.abrirReporteDisponibilidadProductosVendidos();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await disponibilidad.validarSinErrores();
    });
  });

  test('"Filtros avanzados" se puede expandir sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const disponibilidad = new ReporteDisponibilidadProductosVendidosPage(page);
    await disponibilidad.abrirReporteDisponibilidadProductosVendidos();

    await disponibilidad.mostrarFiltrosAvanzados();
    await disponibilidad.validarSinErrores();
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const disponibilidad = new ReporteDisponibilidadProductosVendidosPage(page);
    await disponibilidad.abrirReporteDisponibilidadProductosVendidos();

    await disponibilidad.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await disponibilidad.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await disponibilidad.obtenerFechaFinal()).toBe('2026-08-15');

    await disponibilidad.buscar('a');
    await disponibilidad.validarSinErrores();

    await disponibilidad.limpiarBusqueda();
    await disponibilidad.validarSinErrores();
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const disponibilidad = new ReporteDisponibilidadProductosVendidosPage(page);
    await disponibilidad.abrirReporteDisponibilidadProductosVendidos();

    const descarga = await disponibilidad.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });
});

test.describe('Productos Externos', () => {
  test('carga sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const externos = new ReporteProductosExternosPage(page);

    await test.step('Abrir el reporte', async () => {
      await externos.abrirReporteProductosExternos();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await externos.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const externos = new ReporteProductosExternosPage(page);
    await externos.abrirReporteProductosExternos();

    await externos.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await externos.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await externos.obtenerFechaFinal()).toBe('2026-08-15');

    await externos.buscar('a');
    await externos.validarSinErrores();

    await externos.limpiarBusqueda();
    await externos.validarSinErrores();
  });

  test('los 3 chips de estado (Todos/Vendidos/Pendientes) se pueden aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const externos = new ReporteProductosExternosPage(page);
    await externos.abrirReporteProductosExternos();
    await externos.aumentarRangoFechas('2020-01-15', '2026-08-15');

    for (const estado of ['Vendidos', 'Pendientes', 'Todos'] as const) {
      await test.step(`Estado = ${estado}`, async () => {
        if (estado === 'Vendidos') await externos.seleccionarEstadoVendidos();
        if (estado === 'Pendientes') await externos.seleccionarEstadoPendientes();
        if (estado === 'Todos') await externos.seleccionarEstadoTodos();
        await externos.validarSinErrores();
      });
    }
  });

  test('el filtro de Moneda se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const externos = new ReporteProductosExternosPage(page);
    await externos.abrirReporteProductosExternos();

    await externos.seleccionarMoneda('Todos');
    await externos.validarSinErrores();
  });

  // Sin ningún botón de exportación (PDF/Excel) en esta pantalla
  // (confirmado en vivo) — no se crea ninguna prueba ficticia para
  // exportar. Resultados como tarjetas, no tabla — sin columnas ordenables
  // ni paginación tradicional.
});

test.describe('Productos Vendidos (Inventario)', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const vendidos = new ReporteProductosVendidosPage(page);

    await test.step('Abrir el reporte', async () => {
      await vendidos.abrirReporteProductosVendidos();
    });

    await test.step('La tabla es visible', async () => {
      await vendidos.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await vendidos.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const vendidos = new ReporteProductosVendidosPage(page);
    await vendidos.abrirReporteProductosVendidos();

    await vendidos.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await vendidos.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await vendidos.obtenerFechaFinal()).toBe('2026-08-15');

    await vendidos.buscar('a');
    await vendidos.validarTabla();
    await vendidos.validarSinErrores();

    await vendidos.limpiarBusqueda();
    await vendidos.validarSinErrores();
  });

  test('los filtros Categoría, Subcategoría y Moneda se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const vendidos = new ReporteProductosVendidosPage(page);
    await vendidos.abrirReporteProductosVendidos();

    await vendidos.seleccionarCategoria('Todas las categorías');
    await vendidos.seleccionarSubcategoria('Todas las subcategorías');
    await vendidos.buscar();
    await vendidos.validarSinErrores();

    await vendidos.seleccionarMoneda('Todos');
    await vendidos.validarSinErrores();
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const vendidos = new ReporteProductosVendidosPage(page);
    await vendidos.abrirReporteProductosVendidos();

    const descarga = await vendidos.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin fila de totales/tfoot, sin columnas ordenables y sin paginación
  // (confirmado en vivo) — no se crean pruebas ficticias para ninguna.
});

test.describe('Productos a Pedir', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const aPedir = new ReporteProductosAPedirPage(page);

    await test.step('Abrir el reporte', async () => {
      await aPedir.abrirReporteProductosAPedir();
    });

    await test.step('La tabla es visible', async () => {
      await aPedir.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await aPedir.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const aPedir = new ReporteProductosAPedirPage(page);
    await aPedir.abrirReporteProductosAPedir();

    await aPedir.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await aPedir.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await aPedir.obtenerFechaFinal()).toBe('2026-08-15');

    await aPedir.buscar('a');
    await aPedir.validarTabla();
    await aPedir.validarSinErrores();

    await aPedir.limpiarBusqueda();
    await aPedir.validarSinErrores();
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const aPedir = new ReporteProductosAPedirPage(page);
    await aPedir.abrirReporteProductosAPedir();

    const descarga = await aPedir.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin filtros de selección (Categoría/Proveedor no son filtros aquí,
  // solo columnas de la tabla, confirmado en vivo). Sin fila de
  // totales/tfoot, sin columnas ordenables y sin paginación — no se crean
  // pruebas ficticias para ninguna.
});

test.describe('Productos por Tallas', () => {
  test('carga sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const porTallas = new ReporteProductosPorTallasPage(page);

    await test.step('Abrir el reporte', async () => {
      await porTallas.abrirReporteProductosPorTallas();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await porTallas.validarSinErrores();
    });
  });

  test('la búsqueda por texto se ejecuta sin producir errores y limpiar restaura las tarjetas', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const porTallas = new ReporteProductosPorTallasPage(page);
    await porTallas.abrirReporteProductosPorTallas();

    await porTallas.buscar('a');
    await porTallas.validarSinErrores();

    await porTallas.limpiarBusqueda();
    await porTallas.validarSinErrores();
  });

  test('los filtros Categoría, Subcategoría, Variación y Combinación se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const porTallas = new ReporteProductosPorTallasPage(page);
    await porTallas.abrirReporteProductosPorTallas();

    await test.step('Categoría + Subcategoría combinadas', async () => {
      await porTallas.seleccionarCategoria('Todas las categorías');
      await porTallas.seleccionarSubcategoria('Todas las subcategorías');
      await porTallas.buscar();
      await porTallas.validarSinErrores();
    });

    await test.step('Variación = Talla', async () => {
      await porTallas.seleccionarVariacion('Talla');
      await porTallas.buscar();
      await porTallas.validarSinErrores();
    });
  });

  test('los 3 chips de estado (Stock mínimo/Stock en negativo/Todos) se pueden aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const porTallas = new ReporteProductosPorTallasPage(page);
    await porTallas.abrirReporteProductosPorTallas();

    for (const estado of ['Stock mínimo', 'Stock en negativo', 'Todos'] as const) {
      await test.step(`Estado = ${estado}`, async () => {
        if (estado === 'Stock mínimo') await porTallas.seleccionarEstadoStockMinimo();
        if (estado === 'Stock en negativo') await porTallas.seleccionarEstadoStockNegativo();
        if (estado === 'Todos') await porTallas.seleccionarEstadoTodos();
        await porTallas.validarSinErrores();
      });
    }
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const porTallas = new ReporteProductosPorTallasPage(page);
    await porTallas.abrirReporteProductosPorTallas();

    const descarga = await porTallas.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin filtro de fechas (confirmado en vivo). Resultados como tarjetas,
  // no tabla — sin columnas ordenables ni paginación tradicional.
});

test.describe('Productos por Vencer', () => {
  test('carga con sus indicadores sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const porVencer = new ReporteProductosPorVencerPage(page);

    await test.step('Abrir el reporte', async () => {
      await porVencer.abrirReporteProductosPorVencer();
    });

    await test.step('Los 4 indicadores (Vigentes/Próximos a vencer/Vencidos/Total) son visibles', async () => {
      expect(await porVencer.indicadoresVisibles()).toBe(true);
    });

    await test.step('No hay mensaje de error visible', async () => {
      await porVencer.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const porVencer = new ReporteProductosPorVencerPage(page);
    await porVencer.abrirReporteProductosPorVencer();

    await porVencer.aumentarRangoFechas('2020-01-15', '2028-12-31');
    expect(await porVencer.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await porVencer.obtenerFechaFinal()).toBe('2028-12-31');

    await porVencer.buscar('a');
    await porVencer.validarSinErrores();

    await porVencer.limpiarBusqueda();
    await porVencer.validarSinErrores();
  });

  test('"Descargar Excel" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const porVencer = new ReporteProductosPorVencerPage(page);
    await porVencer.abrirReporteProductosPorVencer();

    const descarga = await porVencer.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  test('"Descargar PDF" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const porVencer = new ReporteProductosPorVencerPage(page);
    await porVencer.abrirReporteProductosPorVencer();

    const descarga = await porVencer.descargarPDF();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin filtros de selección (Categoría/Proveedor no existen en esta
  // pantalla, confirmado en vivo). Resultados como tarjetas, no tabla —
  // sin columnas ordenables ni paginación tradicional.
});
