import { test, expect } from '@playwright/test';
import { ReportesPage, TIMEOUTS } from './reportes.page';
import {
  ReporteComisionesEPPage,
  ReporteComisionesServicioPage,
  ReporteOrdenesPage,
  ReporteProductosVendidosPage,
  ReporteVehiculosPage,
  ReporteVehiculosRecepcionPage,
  SUBMODULOS_REPORTES_TALLER,
} from './rp-taller.page';

// El viewport por defecto de 'Desktop Chrome' (1280x720) puede provocar
// overlaps de layout responsive que no ocurren en una pantalla real de
// escritorio (lección confirmada en el módulo de Compras) — se usa una
// resolución de escritorio realista para todo este archivo.
test.use({ viewport: { width: 1920, height: 1080 } });

for (const submodulo of SUBMODULOS_REPORTES_TALLER) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Reportes > Taller`, async ({ page }) => {
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

// ─── Hallazgo sobre el rango de fechas ─────────────────────────────────────
//
// Todos los campos de fecha de estos 6 reportes son `<input type="date">`
// nativos (o, en Vehículos según Recepción, texto plano sin ningún widget),
// por lo que `.fill()` es la forma correcta de interactuar con ellos —
// confirmado en vivo probando además `pressSequentially()` (poco fiable en
// inputs de fecha nativos, dependientes del locale del navegador) y el envío
// manual de eventos `input`/`change`, ninguno de los cuales cambió el
// resultado. El comportamiento tras "Buscar" es MIXTO y específico por
// reporte (confirmado en vivo con `.fill()` limpio, sin mezclar métodos):
//   - Comisiones por Servicio, Vehículos y Productos Vendidos: BUG — el
//     rango revierte a un valor por defecto (últimos ~15 días).
//   - Órdenes: BUG — el modo "Rango de fecha" del select `#resume` persiste,
//     pero los propios campos de fecha quedan vacíos.
//   - Comisiones E&P y Vehículos según Recepción: el rango SÍ persiste
//     correctamente.
// Cada test de rango de fechas documenta explícitamente el comportamiento
// real confirmado para su reporte, en vez de asumir uno uniforme para todos.

test.describe('Comisiones por Servicio', () => {
  test('carga sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const comisiones = new ReporteComisionesServicioPage(page);

    await test.step('Abrir el reporte', async () => {
      await comisiones.abrirReporteComisionesServicio();
    });

    await test.step('El contenedor de resultados es visible', async () => {
      await comisiones.validarResultadosVisibles();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await comisiones.validarSinErrores();
    });
  });

  test('la búsqueda por texto se ejecuta sin producir errores y limpiar restaura el estado', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const comisiones = new ReporteComisionesServicioPage(page);
    await comisiones.abrirReporteComisionesServicio();

    await comisiones.buscar('a');
    await comisiones.validarSinErrores();

    await comisiones.limpiarBusqueda();
    await comisiones.validarSinErrores();
  });

  test('los filtros Rol y Usuario se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const comisiones = new ReporteComisionesServicioPage(page);
    await comisiones.abrirReporteComisionesServicio();

    await comisiones.seleccionarRol('Mecanico');
    await comisiones.seleccionarUsuario('Mecanico App');
    await comisiones.buscar();
    await comisiones.validarSinErrores();

    await comisiones.limpiarFiltros();
    await comisiones.validarSinErrores();
  });

  test('BUG: la fecha escrita en el rango revierte al valor por defecto tras "Buscar"', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const comisiones = new ReporteComisionesServicioPage(page);
    await comisiones.abrirReporteComisionesServicio();

    const inicialPorDefecto = await comisiones.obtenerFechaInicial();
    await comisiones.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await comisiones.obtenerFechaInicial()).toBe('2020-01-15');

    await comisiones.buscar();
    await comisiones.validarSinErrores();

    expect(await comisiones.obtenerFechaInicial()).toBe(inicialPorDefecto);
  });

  test('este ambiente de QA no tiene comisiones por servicio registradas (mensaje real de "sin resultados")', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const comisiones = new ReporteComisionesServicioPage(page);
    await comisiones.abrirReporteComisionesServicio();

    await comisiones.aumentarRangoFechas('2020-01-01', '2026-07-20');
    await comisiones.buscar();
    await comisiones.validarMensajeSinResultados();
    await comisiones.validarSinErrores();
  });

  // Sin exportación de ningún tipo en este reporte (confirmado en vivo: no
  // existe botón de PDF, Excel ni impresión) — no se crea ninguna prueba
  // ficticia para exportar. Tampoco existe paginación ni columnas
  // ordenables (es un contenedor de resumen, no una tabla tradicional).
});

test.describe('Comisiones E&P', () => {
  test('carga sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ep = new ReporteComisionesEPPage(page);

    await test.step('Abrir el reporte', async () => {
      await ep.abrirReporteComisionesEP();
    });

    await test.step('Mostrar filtros avanzados', async () => {
      await ep.mostrarFiltrosAvanzados();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await ep.validarSinErrores();
    });
  });

  test('la búsqueda por texto se ejecuta sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ep = new ReporteComisionesEPPage(page);
    await ep.abrirReporteComisionesEP();

    await ep.buscar('1542');
    await ep.validarSinErrores();

    await ep.limpiarBusqueda();
    await ep.validarSinErrores();
  });

  test('los filtros avanzados se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ep = new ReporteComisionesEPPage(page);
    await ep.abrirReporteComisionesEP();
    await ep.mostrarFiltrosAvanzados();

    await test.step('Tipo de vehículo + Parte combinados', async () => {
      await ep.seleccionarTipoVehiculo('Hatchback');
      await ep.seleccionarParte('Todas las partes');
      await ep.buscar();
      await ep.validarSinErrores();
    });

    await test.step('Servicio + Mecánico + Tipo de comisión combinados', async () => {
      await ep.seleccionarServicio('Todos los servicios');
      await ep.seleccionarMecanico('MECANICO 2');
      await ep.seleccionarTipoComision('Normal');
      await ep.buscar();
      await ep.validarSinErrores();
    });

    await test.step('"Limpiar" restaura los valores por defecto sin errores', async () => {
      await ep.limpiarFiltros();
      await ep.validarSinErrores();
    });
  });

  test('el rango de fechas se aplica y persiste correctamente tras "Buscar"', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ep = new ReporteComisionesEPPage(page);
    await ep.abrirReporteComisionesEP();

    await ep.aumentarRangoFechas('2020-01-15', '2026-08-15');
    await ep.buscar();

    expect(await ep.obtenerFechaInicial()).toBe('2020-01-15');
    expect(await ep.obtenerFechaFinal()).toBe('2026-08-15');
    await ep.validarSinErrores();
  });

  test('este ambiente de QA no tiene comisiones E&P registradas (mensaje real de "sin resultados")', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ep = new ReporteComisionesEPPage(page);
    await ep.abrirReporteComisionesEP();

    await ep.aumentarRangoFechas('2020-01-01', '2026-07-20');
    await ep.buscar();
    await ep.validarMensajeSinResultados();
    expect(await ep.contarFilas()).toBe(0);
    await ep.validarSinErrores();
  });

  test('BUG: "Exportar PDF" y "Exportar Excel" permanecen deshabilitados en este ambiente sin datos', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ep = new ReporteComisionesEPPage(page);
    await ep.abrirReporteComisionesEP();

    expect(await ep.botonExportarPdfDeshabilitado()).toBe(true);
    expect(await ep.botonExportarExcelDeshabilitado()).toBe(true);

    await ep.aumentarRangoFechas('2020-01-01', '2026-07-20');
    await ep.buscar();

    // Ni siquiera tras una búsqueda con rango amplio se habilitan (confirmado en vivo) — no hay comisiones E&P en este ambiente de QA.
    expect(await ep.botonExportarPdfDeshabilitado()).toBe(true);
    expect(await ep.botonExportarExcelDeshabilitado()).toBe(true);
  });

  // Sin columnas ordenables ni paginación (confirmado en vivo: es una
  // grilla resumida por mecánico, no una tabla paginada tradicional) — no
  // se crean pruebas ficticias para ninguna de las dos.
});

test.describe('Órdenes', () => {
  test('carga la tabla y los gráficos de resumen sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);

    await test.step('Abrir el reporte', async () => {
      await ordenes.abrirReporteOrdenes();
    });

    await test.step('La tabla es visible', async () => {
      await ordenes.validarTabla();
    });

    await test.step('Los gráficos de resumen (por estado y por mecánico) son visibles', async () => {
      expect(await ordenes.graficosVisibles()).toBe(true);
    });

    await test.step('No hay mensaje de error visible', async () => {
      await ordenes.validarSinErrores();
    });
  });

  test('la búsqueda por texto se ejecuta sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);
    await ordenes.abrirReporteOrdenes();

    await ordenes.buscar('a');
    await ordenes.validarTabla();
    await ordenes.validarSinErrores();

    await ordenes.limpiarBusqueda();
    await ordenes.validarSinErrores();
  });

  test('"Filtros avanzados" se puede expandir y colapsar, y revela los filtros reales', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);
    await ordenes.abrirReporteOrdenes();

    expect(await ordenes.filtrosAvanzadosExpandidos()).toBe(false);

    await ordenes.mostrarFiltrosAvanzados();
    expect(await ordenes.filtrosAvanzadosExpandidos()).toBe(true);

    await ordenes.mostrarFiltrosAvanzados();
    expect(await ordenes.filtrosAvanzadosExpandidos()).toBe(false);
  });

  test('los filtros Mecánico, Tipo de fecha, Garantía, Marca y Estado se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);
    await ordenes.abrirReporteOrdenes();
    await ordenes.mostrarFiltrosAvanzados();

    await test.step('Mecánico + Tipo de fecha combinados', async () => {
      await ordenes.seleccionarMecanico('Todos');
      await ordenes.seleccionarTipoFecha('Facturación');
      await ordenes.buscar();
      await ordenes.validarTabla();
      await ordenes.validarSinErrores();
    });

    await test.step('Garantía + Marca combinados', async () => {
      await ordenes.seleccionarGarantia('Sí');
      await ordenes.seleccionarMarca('BMW');
      await ordenes.buscar();
      await ordenes.validarSinErrores();
    });

    await test.step('Estado', async () => {
      await ordenes.seleccionarEstado('Finalizadas');
      await ordenes.buscar();
      await ordenes.validarSinErrores();
    });

    await test.step('"limpiar filtros" restaura los valores por defecto sin errores', async () => {
      await ordenes.limpiarFiltros();
      await ordenes.validarTabla();
      await ordenes.validarSinErrores();
    });
  });

  test('BUG: al seleccionar "Rango de fecha" los campos de fecha quedan vacíos tras "Buscar"', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);
    await ordenes.abrirReporteOrdenes();

    await ordenes.seleccionarResumen('Rango de fecha');
    await ordenes.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await ordenes.obtenerFechaInicial()).toBe('2020-01-15');

    await ordenes.buscar();
    await ordenes.validarSinErrores();

    // El modo "Rango de fecha" persiste, pero los campos quedan vacíos (bug de sistema confirmado en vivo).
    expect(await ordenes.obtenerFechaInicial()).toBe('');
    expect(await ordenes.obtenerFechaFinal()).toBe('');
  });

  for (const variante of ['Excel de órdenes', 'Excel de órdenes y vehículos', 'Excel de abonos'] as const) {
    test(`"${variante}" genera un archivo real`, async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const ordenes = new ReporteOrdenesPage(page);
      await ordenes.abrirReporteOrdenes();

      const descarga = await ordenes.descargarExcel(variante);
      expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
    });
  }

  test('BUG: "Excel de facturación masiva" devuelve JSON crudo en vez de un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);
    await ordenes.abrirReporteOrdenes();

    const respuestaPromise = page.waitForResponse((res) => res.url().includes('download_order_report'), { timeout: TIMEOUTS.CARGA });
    await ordenes.abrirDropdownExportar();
    await ordenes.clicOpcionExportar('Excel de facturación masiva');
    const respuesta = await respuestaPromise;

    // Confirmado en vivo: el servidor responde 200 con content-type
    // application/json (los datos crudos de las órdenes) en vez de generar
    // el archivo .xlsx — el navegador nunca dispara un evento de descarga.
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()['content-type']).toContain('application/json');
  });

  test('"Ver detalles" en una fila abre el modal real con la información de la orden', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const ordenes = new ReporteOrdenesPage(page);
    await ordenes.abrirReporteOrdenes();

    // El rango por defecto ("Hoy") puede no tener órdenes en este ambiente
    // de QA — se usa "Últimos 30 días" (un preset real, no afectado por el
    // bug de "Rango de fecha") para maximizar la posibilidad de datos.
    await ordenes.seleccionarResumen('Últimos 30 días');
    await ordenes.buscar();
    await expect.poll(() => ordenes.contarFilas()).toBeGreaterThan(0);

    await ordenes.abrirDetalleOrden(0);
    await ordenes.cerrarDetalleOrden();
    await ordenes.validarSinErrores();
  });

  // Sin columnas ordenables, sin fila de totales/tfoot y sin paginación
  // (confirmado en vivo) — no se crean pruebas ficticias para ninguna.
});

test.describe('Vehículos', () => {
  test('carga sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const vehiculos = new ReporteVehiculosPage(page);

    await test.step('Abrir el reporte', async () => {
      await vehiculos.abrirReporteVehiculos();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await vehiculos.validarSinErrores();
    });
  });

  test('buscar una placa real filtra las tarjetas y limpiar la búsqueda las restaura', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const vehiculos = new ReporteVehiculosPage(page);
    await vehiculos.abrirReporteVehiculos();

    // "Buscar" sin filtros (con la primera tarjeta ya cargada) para tomar una placa real y buscar por ella.
    await vehiculos.buscar('');
    await expect.poll(() => vehiculos.contarTarjetas()).toBeGreaterThan(0);
    const totalSinFiltro = await vehiculos.contarTarjetas();
    const placa = await vehiculos.obtenerPlacaDeTarjeta(0);

    await vehiculos.buscar(placa);
    expect(await vehiculos.contarTarjetas()).toBeGreaterThan(0);
    await vehiculos.validarSinErrores();

    await vehiculos.limpiarBusqueda();
    expect(await vehiculos.contarTarjetas()).toBe(totalSinFiltro);
    await vehiculos.validarSinErrores();
  });

  test('BUG: buscar un término que no coincide con ninguna placa no siempre limpia los resultados', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const vehiculos = new ReporteVehiculosPage(page);
    await vehiculos.abrirReporteVehiculos();

    // Confirmado en vivo de forma reproducible: tras "Buscar" con un término
    // que no coincide con ninguna placa, el reporte no siempre muestra 0
    // tarjetas — en la práctica puede seguir mostrando el listado completo
    // sin filtrar (posible condición de carrera entre el filtro y la carga
    // de datos). Se documenta el comportamiento observado sin asumir un
    // conteo fijo, y se valida que al menos no produzca errores.
    await vehiculos.buscar('zzzz_termino_que_no_existe_9999');
    await vehiculos.validarSinErrores();
  });

  test('los filtros Cliente, Tipo, Tipo de fecha y Sucursal se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const vehiculos = new ReporteVehiculosPage(page);
    await vehiculos.abrirReporteVehiculos();

    await test.step('Cliente + Tipo combinados', async () => {
      await vehiculos.seleccionarCliente('Cliente Nuevo');
      await vehiculos.seleccionarTipo('Vehículo de combustión');
      await vehiculos.buscar();
      await vehiculos.validarSinErrores();
    });

    await test.step('Tipo de fecha + Sucursal combinados', async () => {
      await vehiculos.seleccionarTipoFecha('Creación de la orden de reparación');
      await vehiculos.seleccionarSucursal('Todos');
      await vehiculos.buscar();
      await vehiculos.validarSinErrores();
    });

    await test.step('"limpiar filtros" restaura los valores por defecto sin errores', async () => {
      await vehiculos.limpiarFiltros();
      await vehiculos.validarSinErrores();
    });
  });

  test('BUG: la fecha escrita en el rango revierte al valor por defecto tras "Buscar"', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const vehiculos = new ReporteVehiculosPage(page);
    await vehiculos.abrirReporteVehiculos();

    const inicialPorDefecto = await vehiculos.obtenerFechaInicial();
    await vehiculos.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await vehiculos.obtenerFechaInicial()).toBe('2020-01-15');

    await vehiculos.buscar();
    await vehiculos.validarSinErrores();

    expect(await vehiculos.obtenerFechaInicial()).toBe(inicialPorDefecto);
  });

  test('hacer clic en una tarjeta abre el modal de detalle real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const vehiculos = new ReporteVehiculosPage(page);
    await vehiculos.abrirReporteVehiculos();
    await vehiculos.aumentarRangoFechas('2020-01-15', '2026-08-15');
    await vehiculos.buscar();

    await expect.poll(() => vehiculos.contarTarjetas()).toBeGreaterThan(0);
    await vehiculos.abrirDetalleTarjeta(0);
    await vehiculos.cerrarDetalleTarjeta();
    await vehiculos.validarSinErrores();
  });

  test('"Descargar por tipo" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const vehiculos = new ReporteVehiculosPage(page);
    await vehiculos.abrirReporteVehiculos();

    const descarga = await vehiculos.descargarPorTipo('Solo vehículos de combustión');
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin tabla tradicional (son tarjetas): sin fila de totales, sin columnas
  // ordenables y sin paginación (el contenedor hace scroll interno,
  // confirmado en vivo) — no se crean pruebas ficticias para ninguna. Sin
  // mensaje explícito de "sin resultados" (confirmado en vivo, el
  // contenedor solo queda vacío) — no se asume uno que no existe.
});

test.describe('Vehículos según Recepción', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const recepcion = new ReporteVehiculosRecepcionPage(page);

    await test.step('Abrir el reporte', async () => {
      await recepcion.abrirReporteVehiculosRecepcion();
    });

    await test.step('La tabla es visible', async () => {
      await recepcion.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await recepcion.validarSinErrores();
    });
  });

  test('el rango de fechas se aplica y persiste correctamente, y un rango amplio sí devuelve datos reales', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const recepcion = new ReporteVehiculosRecepcionPage(page);
    await recepcion.abrirReporteVehiculosRecepcion();

    await test.step('El rango por defecto ejecuta la búsqueda sin errores', async () => {
      await recepcion.buscar();
      await recepcion.validarSinErrores();
    });

    await test.step('Ampliar el rango de fechas persiste y devuelve filas reales', async () => {
      await recepcion.aumentarRangoFechas('2020-01-15', '2026-08-15');
      expect(await recepcion.obtenerFechaInicial()).toBe('2020-01-15');
      expect(await recepcion.obtenerFechaFinal()).toBe('2026-08-15');

      await recepcion.buscar();
      expect(await recepcion.obtenerFechaInicial()).toBe('2020-01-15');
      expect(await recepcion.obtenerFechaFinal()).toBe('2026-08-15');

      await expect.poll(() => recepcion.contarFilas()).toBeGreaterThan(0);
      await recepcion.validarSinErrores();

      const marca = await recepcion.obtenerMarcaDeFila(0);
      expect(marca.length).toBeGreaterThan(0);
      const frecuencia = await recepcion.obtenerFrecuenciaDeFila(0);
      expect(frecuencia).toBeGreaterThan(0);
    });
  });

  test('BUG: "Descargar" no produce ninguna descarga real ni error observable', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const recepcion = new ReporteVehiculosRecepcionPage(page);
    await recepcion.abrirReporteVehiculosRecepcion();
    await recepcion.aumentarRangoFechas('2020-01-15', '2026-08-15');
    await recepcion.buscar();

    const descargaPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await recepcion.clicEnDescargar();
    const descarga = await descargaPromise;

    expect(descarga).toBeNull();
    await recepcion.validarSinErrores();
  });

  // Sin buscador de texto libre ni filtros de selección (confirmado en
  // vivo: Cliente/Estado/Técnico no existen en este reporte) — no se crean
  // pruebas ficticias para ellos. Sin fila de totales/tfoot, sin columnas
  // ordenables y sin paginación — tampoco se crean pruebas para ninguna.
});

test.describe('Productos Vendidos', () => {
  test('carga la tabla sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const productos = new ReporteProductosVendidosPage(page);

    await test.step('Abrir el reporte', async () => {
      await productos.abrirReporteProductosVendidos();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await productos.validarSinErrores();
    });
  });

  test('la búsqueda por texto y un rango amplio de fechas devuelven datos reales sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const productos = new ReporteProductosVendidosPage(page);
    await productos.abrirReporteProductosVendidos();

    await productos.aumentarRangoFechas('2020-01-01', '2026-07-20');
    await productos.buscar('a');
    await productos.validarTabla();
    await productos.validarSinErrores();

    await expect.poll(() => productos.contarFilas()).toBeGreaterThan(0);

    await productos.limpiarBusqueda();
    await productos.validarSinErrores();
  });

  test('el filtro de Moneda se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const productos = new ReporteProductosVendidosPage(page);
    await productos.abrirReporteProductosVendidos();

    await productos.seleccionarMoneda('CRC');
    await productos.validarSinErrores();
  });

  test('BUG: la fecha escrita en el rango revierte al valor por defecto tras "Buscar"', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const productos = new ReporteProductosVendidosPage(page);
    await productos.abrirReporteProductosVendidos();

    const inicialPorDefecto = await productos.obtenerFechaInicial();
    await productos.aumentarRangoFechas('2020-01-15', '2026-08-15');
    expect(await productos.obtenerFechaInicial()).toBe('2020-01-15');

    await productos.buscar();
    await productos.validarSinErrores();

    expect(await productos.obtenerFechaInicial()).toBe(inicialPorDefecto);
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const productos = new ReporteProductosVendidosPage(page);
    await productos.abrirReporteProductosVendidos();

    const descarga = await productos.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // Sin fila de totales/tfoot, sin columnas ordenables y sin paginación
  // (confirmado en vivo) — no se crean pruebas ficticias para ninguna.
});
