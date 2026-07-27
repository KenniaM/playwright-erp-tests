import { test, expect } from '@playwright/test';
import { ReportesPage, TIMEOUTS } from './reportes.page';
import {
  ReporteAbonosPage,
  ReporteAntiguedadCreditoPage,
  ReporteComprasExternasPage,
  ReporteComprasPage,
  ReporteCuentasPorPagarPage,
  ReporteGastosComprasPage,
  ReporteMovFacIngresadasPage,
  SUBMODULOS_REPORTES_COMPRAS,
} from './rp-compras.page';

// El viewport por defecto de 'Desktop Chrome' (1280x720) provoca overlaps de
// layout responsive en este módulo que no ocurren en una pantalla real de
// escritorio (confirmado en vivo: con 1920x1080 desaparecen tanto el
// solapamiento de botones en Compras Externas como el calendario huérfano de
// Cuentas por Pagar) — se usa una resolución de escritorio realista.
test.use({ viewport: { width: 1920, height: 1080 } });

for (const submodulo of SUBMODULOS_REPORTES_COMPRAS) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Reportes > Compras`, async ({ page }) => {
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
// En Abonos/Compras/Compras Externas/Gastos/Cuentas por Pagar/Antigüedad de
// Crédito, el campo de fecha es un `<input>` de texto controlado por un
// widget bootstrap-datepicker: escribir directo con `.fill()` solo cambia el
// texto visible, pero el backend lee el estado interno del propio plugin, no
// el texto crudo — por eso una primera investigación con `.fill()` concluyó
// (incorrectamente) que el rango "no persistía". Interactuando con el
// calendario real (clic en un día, navegando Días → Meses → Años igual que
// un usuario) el filtro SÍ se aplica y persiste tras "Buscar" — confirmado
// en vivo con rangos amplios (ej. 2023-01-15 a 2026-08-15). Todos los tests
// de este archivo usan `seleccionarFechaInicial`/`seleccionarFechaFinal`,
// que ya hacen clic en el calendario real internamente.
//
// La única excepción real es Mov. Fac. Ingresadas: sus campos `#start_date`/
// `#end_date` son `<input type="date">` NATIVOS (sin widget propio), donde
// `.fill()` sí es la interacción correcta — y aun así el valor escrito
// revierte al rango por defecto tras "Buscar" (confirmado en vivo,
// reproducible). Ese caso concreto sí es un bug de sistema genuino y su test
// de rango de fechas lo documenta explícitamente en vez de asumir que el
// filtro cambió.

test.describe('Mov. Fac. Ingresadas', () => {
  test('carga el documento de cierre diario con sus filtros y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const mov = new ReporteMovFacIngresadasPage(page);

    await test.step('Abrir el reporte', async () => {
      await mov.abrirReporteMovFacIngresadas();
    });

    await test.step('El documento de cierre es visible', async () => {
      await mov.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await mov.validarSinErrores();
    });
  });

  test('la búsqueda por texto se ejecuta sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const mov = new ReporteMovFacIngresadasPage(page);
    await mov.abrirReporteMovFacIngresadas();

    await mov.buscar('a');
    await mov.validarTabla();
    await mov.validarSinErrores();

    await mov.limpiarBusqueda();
    await mov.validarSinErrores();
  });

  test('BUG: la fecha escrita en el rango revierte al valor por defecto tras "Buscar"', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const mov = new ReporteMovFacIngresadasPage(page);
    await mov.abrirReporteMovFacIngresadas();

    const inicialPorDefecto = await mov.obtenerFechaInicial();
    await mov.aumentarRangoFechas('2023-01-15', '2026-07-20');
    expect(await mov.obtenerFechaInicial()).toBe('2023-01-15');

    await mov.buscar();
    await mov.validarSinErrores();

    // El valor escrito NO persiste: vuelve al rango por defecto (bug de sistema confirmado en vivo).
    expect(await mov.obtenerFechaInicial()).toBe(inicialPorDefecto);
  });

  test('las 4 pestañas de vista se pueden seleccionar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const mov = new ReporteMovFacIngresadasPage(page);
    await mov.abrirReporteMovFacIngresadas();

    // No se le asume ningún efecto de filtrado real a estas pestañas
    // (confirmado en vivo que no disparan AJAX ni cambian qué secciones son
    // visibles) — solo se valida que el campo oculto se actualice y que no
    // se produzcan errores.
    for (const vista of ['purchase_invoice', 'external_purchase_invoice', 'expense_invoices', 'all'] as const) {
      await mov.seleccionarVista(vista);
      expect(await mov.obtenerVistaActiva()).toBe(vista);
      await mov.validarSinErrores();
    }
  });

  test('"Imprimir" abre una pestaña nueva con el documento de cierre', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const mov = new ReporteMovFacIngresadasPage(page);
    await mov.abrirReporteMovFacIngresadas();

    const popup = await mov.imprimir();
    expect(popup).toBeTruthy();
    await popup.close();
  });
});

test.describe('Abonos', () => {
  test('carga la tabla con sus columnas y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const abonos = new ReporteAbonosPage(page);

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

  test('buscar un término inexistente no produce errores y limpiar la búsqueda restaura la tabla', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const abonos = new ReporteAbonosPage(page);
    await abonos.abrirReporteAbonos();

    await abonos.aumentarRangoFechas('2023-01-15', '2026-08-15');
    await abonos.buscar('zzzz_termino_que_no_existe_9999');
    expect(await abonos.obtenerFechaInicial()).toBe('2023-01-15');
    expect(await abonos.obtenerFechaFinal()).toBe('2026-08-15');
    await abonos.validarSinErrores();

    await abonos.limpiarBusqueda();
    await abonos.validarTabla();
    await abonos.validarSinErrores();
  });

  test('los filtros Proveedor, Tipo de pago, Tipo de documento y Moneda se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const abonos = new ReporteAbonosPage(page);
    await abonos.abrirReporteAbonos();

    await test.step('Aplicar Proveedor + Tipo de pago combinados', async () => {
      await abonos.seleccionarProveedor('proveedor 2');
      await abonos.seleccionarTipoPago('Efectivo');
      await abonos.buscar();
      await abonos.validarTabla();
      await abonos.validarSinErrores();
    });

    await test.step('Aplicar Tipo de documento + Moneda combinados', async () => {
      await abonos.seleccionarTipoDocumento('Compra');
      await abonos.seleccionarMoneda('₡ - CRC');
      await abonos.buscar();
      await abonos.validarTabla();
      await abonos.validarSinErrores();
    });

    await test.step('"limpiar filtros" restaura los valores por defecto sin errores', async () => {
      await abonos.limpiarFiltros();
      await abonos.validarTabla();
      await abonos.validarSinErrores();
    });
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const abonos = new ReporteAbonosPage(page);
    await abonos.abrirReporteAbonos();

    const descarga = await abonos.descargarExcel();
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });

  // Este ambiente de QA no tiene ningún abono registrado (confirmado en
  // vivo incluso con rango 2023-2026): no existe ordenamiento, paginación
  // ni columna de acciones por fila en este reporte — no se crean pruebas
  // ficticias para ninguna de ellas.
});

test.describe('Compras', () => {
  test('carga la tabla con sus columnas y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const compras = new ReporteComprasPage(page);

    await test.step('Abrir el reporte', async () => {
      await compras.abrirReporteCompras();
    });

    await test.step('La tabla es visible', async () => {
      await compras.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await compras.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const compras = new ReporteComprasPage(page);
    await compras.abrirReporteCompras();

    await compras.aumentarRangoFechas('2023-01-15', '2026-08-15');
    await compras.buscar('a');
    expect(await compras.obtenerFechaInicial()).toBe('2023-01-15');
    expect(await compras.obtenerFechaFinal()).toBe('2026-08-15');
    await compras.validarTabla();
    await compras.validarSinErrores();

    await compras.limpiarBusqueda();
    await compras.validarSinErrores();
  });

  test('los 4 chips de estado y el Tipo de pago se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const compras = new ReporteComprasPage(page);
    await compras.abrirReporteCompras();

    for (const estado of ['pending', 'paid', 'deleted', 'all'] as const) {
      await test.step(`Estado = ${estado}`, async () => {
        await compras.seleccionarEstado(estado);
        await compras.validarTabla();
        await compras.validarSinErrores();
      });
    }

    await test.step('Tipo de pago + Moneda combinados', async () => {
      await compras.seleccionarTipoPago('Efectivo');
      await compras.seleccionarMoneda('Todos');
      await compras.buscar();
      await compras.validarSinErrores();
    });

    await test.step('"limpiar filtros" restaura los valores por defecto sin errores', async () => {
      await compras.limpiarFiltros();
      await compras.validarTabla();
      await compras.validarSinErrores();
    });
  });

  test('"Exportar compras" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const compras = new ReporteComprasPage(page);
    await compras.abrirReporteCompras();

    const descarga = await compras.descargarCompras();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  test('"Exportar compras con detalles" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const compras = new ReporteComprasPage(page);
    await compras.abrirReporteCompras();

    const descarga = await compras.descargarComprasConDetalles();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });
});

test.describe('Compras Externas', () => {
  test('carga la tabla con sus columnas y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const externas = new ReporteComprasExternasPage(page);

    await test.step('Abrir el reporte', async () => {
      await externas.abrirReporteComprasExternas();
    });

    await test.step('La tabla es visible', async () => {
      await externas.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await externas.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const externas = new ReporteComprasExternasPage(page);
    await externas.abrirReporteComprasExternas();

    await externas.aumentarRangoFechas('2023-01-15', '2026-08-15');
    await externas.buscar('a');
    expect(await externas.obtenerFechaInicial()).toBe('2023-01-15');
    expect(await externas.obtenerFechaFinal()).toBe('2026-08-15');
    await externas.validarTabla();
    await externas.validarSinErrores();

    await externas.limpiarBusqueda();
    await externas.validarSinErrores();
  });

  test('los 3 chips de estado se pueden aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const externas = new ReporteComprasExternasPage(page);
    await externas.abrirReporteComprasExternas();

    for (const estado of ['pending', 'paid', 'all'] as const) {
      await test.step(`Estado = ${estado}`, async () => {
        await externas.seleccionarEstado(estado);
        await externas.validarTabla();
        await externas.validarSinErrores();
      });
    }
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const externas = new ReporteComprasExternasPage(page);
    await externas.abrirReporteComprasExternas();

    const descarga = await externas.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });

  // No existe filtro de Moneda en este reporte (confirmado en vivo) — no se
  // crea ninguna prueba ficticia para él.
});

test.describe('Gastos (Compras)', () => {
  test('carga la tabla con sus columnas y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosComprasPage(page);

    await test.step('Abrir el reporte', async () => {
      await gastos.abrirReporteGastos();
    });

    await test.step('La tabla es visible', async () => {
      await gastos.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await gastos.validarSinErrores();
    });
  });

  test('la búsqueda por texto y el rango de fechas se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosComprasPage(page);
    await gastos.abrirReporteGastos();

    await gastos.aumentarRangoFechas('2023-01-15', '2026-08-15');
    await gastos.buscar('a');
    expect(await gastos.obtenerFechaInicial()).toBe('2023-01-15');
    expect(await gastos.obtenerFechaFinal()).toBe('2026-08-15');
    await gastos.validarTabla();
    await gastos.validarSinErrores();

    await gastos.limpiarBusqueda();
    await gastos.validarSinErrores();
  });

  test('el estado se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosComprasPage(page);
    await gastos.abrirReporteGastos();

    await gastos.seleccionarEstado('pending');
    await gastos.buscar();
    await gastos.validarTabla();
    await gastos.validarSinErrores();

    await gastos.limpiarFiltros();
    await gastos.validarSinErrores();
  });

  test('BUG: el filtro de Moneda no es funcional (botón permanece oculto sin importar el Estado aplicado)', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosComprasPage(page);
    await gastos.abrirReporteGastos();

    expect(await gastos.monedaEsVisible()).toBe(false);

    await gastos.seleccionarEstado('pending');
    await gastos.buscar();
    expect(await gastos.monedaEsVisible()).toBe(false);
  });

  test('"Descargar" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosComprasPage(page);
    await gastos.abrirReporteGastos();

    const descarga = await gastos.descargarExcel();
    expect(descarga.suggestedFilename().length).toBeGreaterThan(0);
  });
});

test.describe('Cuentas por Pagar', () => {
  test('carga con sus tarjetas KPI, el gráfico y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cxp = new ReporteCuentasPorPagarPage(page);

    await test.step('Abrir el reporte', async () => {
      await cxp.abrirReporteCuentasPorPagar();
    });

    await test.step('Las tarjetas KPI muestran valores numéricos', async () => {
      const kpis = await cxp.obtenerKPIs();
      expect(kpis.total).toBeGreaterThanOrEqual(0);
      expect(kpis.abonado).toBeGreaterThanOrEqual(0);
      expect(kpis.saldo).toBeGreaterThanOrEqual(0);
    });

    await test.step('El gráfico es visible', async () => {
      expect(await cxp.graficoVisible()).toBe(true);
    });

    await test.step('No hay mensaje de error visible', async () => {
      await cxp.validarSinErrores();
    });
  });

  test('con el estado por defecto ("Pendiente") este ambiente de QA no tiene cuentas por pagar (mensaje real de "sin resultados")', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cxp = new ReporteCuentasPorPagarPage(page);
    await cxp.abrirReporteCuentasPorPagar();

    await cxp.validarMensajeSinResultados();
    expect(await cxp.contarFilas()).toBe(0);
    await cxp.validarSinErrores();
  });

  test('los filtros Proveedor, Tipo de documento, Modo de consulta, Tipo de fecha y Moneda se pueden aplicar combinados sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cxp = new ReporteCuentasPorPagarPage(page);
    await cxp.abrirReporteCuentasPorPagar();

    await test.step('Estado = Todas (para maximizar la posibilidad de datos reales)', async () => {
      await cxp.seleccionarEstado('all');
      await cxp.validarSinErrores();
    });

    await test.step('Proveedor + Tipo de documento combinados', async () => {
      await cxp.seleccionarProveedor('( PROSISA ) PROVEDORA DE SEGURIDAD INDUSTRIAL');
      await cxp.seleccionarTipoDocumento('Compra');
      await cxp.buscar();
      await cxp.validarTabla();
      await cxp.validarSinErrores();
    });

    await test.step('Modo de consulta + Tipo de fecha + Moneda combinados', async () => {
      await cxp.seleccionarModoConsulta('Saldo al corte');
      await cxp.seleccionarTipoFecha('Canceladas');
      await cxp.seleccionarMoneda('₡ - CRC');
      await cxp.buscar();
      await cxp.validarTabla();
      await cxp.validarSinErrores();
    });

    await test.step('"limpiar filtros" restaura los valores por defecto sin errores', async () => {
      await cxp.limpiarFiltros();
      await cxp.validarSinErrores();
    });
  });

  test('"Excel" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cxp = new ReporteCuentasPorPagarPage(page);
    await cxp.abrirReporteCuentasPorPagar();
    await cxp.seleccionarEstado('all');

    const descarga = await cxp.descargarExcel();
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });
});

test.describe('Antigüedad de Crédito', () => {
  test('carga la tabla con sus columnas y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const antiguedad = new ReporteAntiguedadCreditoPage(page);

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

  test('la búsqueda por texto, el rango de fechas y la Moneda se ejecutan sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const antiguedad = new ReporteAntiguedadCreditoPage(page);
    await antiguedad.abrirReporteAntiguedadCredito();

    await antiguedad.aumentarRangoFechas('2023-01-15', '2026-08-15');
    await antiguedad.buscar('a');
    expect(await antiguedad.obtenerFechaInicial()).toBe('2023-01-15');
    expect(await antiguedad.obtenerFechaFinal()).toBe('2026-08-15');
    await antiguedad.validarTabla();
    await antiguedad.validarSinErrores();

    await antiguedad.seleccionarMoneda('$ - USD');
    await antiguedad.validarSinErrores();

    await antiguedad.limpiarFiltros();
    await antiguedad.validarSinErrores();
  });

  test('"Descargar Excel" genera un archivo real y confirma el SweetAlert de éxito', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const antiguedad = new ReporteAntiguedadCreditoPage(page);
    await antiguedad.abrirReporteAntiguedadCredito();

    const descarga = await antiguedad.descargarExcel();
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });

  // Este ambiente de QA no tiene ningún proveedor con saldo pendiente
  // (confirmado en vivo incluso con rango 2023-2026): no se crean pruebas
  // ficticias sobre filas de datos, totales por columna ni la columna
  // "Acciones" (no se pudo confirmar su contenido real sin datos).
});
