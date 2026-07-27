import { test, expect } from '@playwright/test';
import { ReportesPage, TIMEOUTS } from './reportes.page';
import {
  hoyISO,
  hoyMenosDiasISO,
  ReporteBitacoraClientesPage,
  ReporteClientesFrecuentesPage,
  ReporteClientesPorVendedorPage,
  ReporteEstadoCuentaPage,
  ReporteRedesSocialesPage,
  SUBMODULOS_REPORTES_CLIENTES,
} from './rp-clientes.page';

for (const submodulo of SUBMODULOS_REPORTES_CLIENTES) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Reportes > Clientes`, async ({ page }) => {
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

// ─── Reporte de Clientes Frecuentes ────────────────────────────────────────
//
// Analizado en vivo (ver comentario de ReporteClientesFrecuentesPage en
// rp-clientes.page.ts): no existe ninguna exportación (ni Excel ni PDF) ni
// ordenamiento/paginación en este reporte — no se crean pruebas para esas
// funcionalidades porque no existen.

test.describe('Reporte de Clientes Frecuentes', () => {
  test('carga la tabla con sus columnas y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const clientes = new ReporteClientesFrecuentesPage(page);

    await test.step('Abrir el reporte', async () => {
      await clientes.abrir();
    });

    await test.step('La tabla es visible', async () => {
      await clientes.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await clientes.validarSinErrores();
    });
  });

  test('el rango de fechas se puede ampliar y la búsqueda sigue funcionando sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const clientes = new ReporteClientesFrecuentesPage(page);
    await clientes.abrir();

    const filasRangoCorto = await test.step('Buscar con el rango por defecto (hoy)', async () => {
      await clientes.aumentarRangoFechas(hoyISO(), hoyISO());
      await clientes.buscar();
      return clientes.contarFilas();
    });

    await test.step('Ampliar el rango a los últimos 2 años y buscar de nuevo', async () => {
      await clientes.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
      await clientes.buscar();
    });

    await test.step('El reporte sigue funcionando: la tabla es visible y no hay menos resultados que con el rango corto', async () => {
      await clientes.validarTabla();
      await expect.poll(() => clientes.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThanOrEqual(filasRangoCorto);
      await clientes.validarSinErrores();
    });
  });

  test('la búsqueda por texto filtra los resultados y limpiarla los restaura', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const clientes = new ReporteClientesFrecuentesPage(page);
    await clientes.abrir();
    await clientes.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await clientes.buscar();

    const totalSinFiltrar = await clientes.contarFilas();
    test.skip(totalSinFiltrar === 0, 'El ambiente de QA no tiene clientes frecuentes registrados en el rango probado.');

    const termino = await test.step('Tomar el nombre de la primera fila como término de búsqueda', async () => {
      const nombreCompleto = await clientes.obtenerNombreDeFila(0);
      return nombreCompleto.trim().split(/\s+/)[0];
    });

    await test.step('Buscar por ese término', async () => {
      await clientes.buscar(termino);
      await expect.poll(() => clientes.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThan(0);
    });

    await test.step('Cada fila visible corresponde al término buscado', async () => {
      const filasFiltradas = await clientes.contarFilas();
      for (let i = 0; i < filasFiltradas; i++) {
        const nombre = await clientes.obtenerNombreDeFila(i);
        expect(nombre.toLowerCase()).toContain(termino.toLowerCase());
      }
    });

    await test.step('Limpiar la búsqueda restaura todos los registros', async () => {
      await clientes.limpiarBusqueda();
      await expect.poll(() => clientes.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalSinFiltrar);
    });
  });

  test('el filtro de moneda se puede aplicar y limpiar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const clientes = new ReporteClientesFrecuentesPage(page);
    await clientes.abrir();
    await clientes.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await clientes.buscar();

    await test.step('Filtrar por una moneda específica (USD)', async () => {
      await clientes.seleccionarMoneda('USD');
      await clientes.validarTabla();
      await clientes.validarSinErrores();
    });

    await test.step('Volver a "Todas" restaura el filtro sin errores', async () => {
      await clientes.seleccionarMoneda('Todas');
      await clientes.validarTabla();
      await clientes.validarSinErrores();
    });
  });
});

// ─── Reporte de Bitácora de Clientes ───────────────────────────────────────
//
// Analizado en vivo (ver comentario de ReporteBitacoraClientesPage en
// rp-clientes.page.ts): no existe exportación a PDF ni ordenamiento/paginación
// en este reporte — no se crean pruebas para esas funcionalidades porque no
// existen.

test.describe('Reporte de Bitácora de Clientes', () => {
  test('carga la tabla con datos reales y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const bitacora = new ReporteBitacoraClientesPage(page);

    await test.step('Abrir el reporte', async () => {
      await bitacora.abrir();
    });

    await test.step('La tabla es visible', async () => {
      await bitacora.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await bitacora.validarSinErrores();
    });
  });

  test('el rango de fechas se puede ampliar y la búsqueda sigue funcionando sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const bitacora = new ReporteBitacoraClientesPage(page);
    await bitacora.abrir();

    const filasRangoCorto = await test.step('Buscar con el rango por defecto (mes en curso)', async () => {
      await bitacora.buscar();
      return bitacora.contarFilas();
    });

    await test.step('Ampliar el rango a los últimos 2 años y buscar de nuevo', async () => {
      await bitacora.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
      await bitacora.buscar();
    });

    await test.step('El reporte sigue funcionando: la tabla es visible y no hay menos resultados que con el rango corto', async () => {
      await bitacora.validarTabla();
      await expect.poll(() => bitacora.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThanOrEqual(filasRangoCorto);
      await bitacora.validarSinErrores();
    });
  });

  test('la búsqueda por texto filtra los resultados y limpiarla los restaura', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const bitacora = new ReporteBitacoraClientesPage(page);
    await bitacora.abrir();
    await bitacora.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await bitacora.buscar();

    const totalSinFiltrar = await bitacora.contarFilas();
    test.skip(totalSinFiltrar === 0, 'El ambiente de QA no tiene movimientos de bitácora registrados en el rango probado.');

    const termino = await test.step('Tomar el cliente de la primera fila como término de búsqueda', async () => {
      const clienteCompleto = await bitacora.obtenerClienteDeFila(0);
      return clienteCompleto.trim().split(/\s+/)[0];
    });

    await test.step('Buscar por ese término', async () => {
      await bitacora.buscar(termino);
      await expect.poll(() => bitacora.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThan(0);
    });

    await test.step('Cada fila visible corresponde al término buscado', async () => {
      const filasFiltradas = await bitacora.contarFilas();
      for (let i = 0; i < filasFiltradas; i++) {
        const cliente = await bitacora.obtenerClienteDeFila(i);
        expect(cliente.toLowerCase()).toContain(termino.toLowerCase());
      }
    });

    await test.step('Limpiar la búsqueda restaura todos los registros', async () => {
      await bitacora.limpiarBusqueda();
      await expect.poll(() => bitacora.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalSinFiltrar);
    });
  });

  test('el filtro de moneda se puede aplicar y limpiar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const bitacora = new ReporteBitacoraClientesPage(page);
    await bitacora.abrir();

    await test.step('Filtrar por una moneda específica (USD)', async () => {
      await bitacora.seleccionarMoneda('USD');
      await bitacora.validarTabla();
      await bitacora.validarSinErrores();
    });

    await test.step('Volver a "Todas" restaura el filtro sin errores', async () => {
      await bitacora.seleccionarMoneda('Todas');
      await bitacora.validarTabla();
      await bitacora.validarSinErrores();
    });
  });

  test('"Descargar Excel" genera un archivo .xlsx', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const bitacora = new ReporteBitacoraClientesPage(page);
    await bitacora.abrir();

    const descarga = await bitacora.descargarExcel();
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });

  test('las pestañas "Ventas" y "Proformas" alternan el panel visible del cliente', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const bitacora = new ReporteBitacoraClientesPage(page);
    await bitacora.abrir();

    await test.step('Por defecto, el panel "Ventas" está visible', async () => {
      await expect(bitacora.panelVentasEsVisible()).toBeVisible();
    });

    await test.step('Al hacer clic en "Proformas" se muestra ese panel y se oculta "Ventas"', async () => {
      await bitacora.irAPestanaProformas();
      await expect(bitacora.panelProformasEsVisible()).toBeVisible();
      await expect(bitacora.panelVentasEsVisible()).toBeHidden();
    });

    await test.step('Volver a "Ventas" restaura el panel original', async () => {
      await bitacora.irAPestanaVentas();
      await expect(bitacora.panelVentasEsVisible()).toBeVisible();
      await expect(bitacora.panelProformasEsVisible()).toBeHidden();
    });
  });
});

// ─── Reporte de Estado de Cuenta ───────────────────────────────────────────
//
// Analizado en vivo (ver comentario de ReporteEstadoCuentaPage en
// rp-clientes.page.ts): no tiene buscador de texto libre, rango de fechas,
// ni exportación a nivel de reporte (la exportación es por fila) — no se
// crean pruebas para esas funcionalidades porque no existen a ese nivel.
// Tampoco existe ordenamiento/paginación. Las acciones "Correo"/"Enviar por
// WhatsApp" y "Enviar a todos" no se ejecutan por tener efectos secundarios
// reales (envío de comunicaciones); solo se valida que existen y están
// habilitadas.

test.describe('Reporte de Estado de Cuenta', () => {
  test('carga la tabla con datos reales y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const estadoCuenta = new ReporteEstadoCuentaPage(page);

    await test.step('Abrir el reporte', async () => {
      await estadoCuenta.abrir();
    });

    await test.step('La tabla es visible', async () => {
      await estadoCuenta.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await estadoCuenta.validarSinErrores();
    });

    await test.step('El botón "Enviar a todos" está habilitado', async () => {
      await expect(estadoCuenta.botonEnviarATodos()).toBeEnabled();
    });
  });

  test('el filtro "Cliente" acota los resultados al cliente seleccionado', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const estadoCuenta = new ReporteEstadoCuentaPage(page);
    await estadoCuenta.abrir();

    const totalSinFiltrar = await estadoCuenta.contarFilas();
    const opciones = await estadoCuenta.obtenerOpcionesDeCliente();
    test.skip(opciones.length === 0, 'El ambiente de QA no tiene clientes disponibles para probar el filtro.');

    const clienteElegido = opciones[0];

    await test.step(`Filtrar por "${clienteElegido}"`, async () => {
      await estadoCuenta.seleccionarCliente(clienteElegido);
      await estadoCuenta.buscar();
      await expect.poll(() => estadoCuenta.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeLessThanOrEqual(totalSinFiltrar);
    });

    await test.step('Cada fila visible corresponde al cliente elegido', async () => {
      const filasFiltradas = await estadoCuenta.contarFilas();
      for (let i = 0; i < filasFiltradas; i++) {
        const cliente = await estadoCuenta.obtenerClienteDeFila(i);
        expect(cliente.trim()).toContain(clienteElegido.trim());
      }
    });

    await test.step('Volver a "Todas" restaura todos los registros', async () => {
      await estadoCuenta.seleccionarCliente('Todas');
      await estadoCuenta.buscar();
      await expect.poll(() => estadoCuenta.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalSinFiltrar);
    });
  });

  test('el filtro de moneda se puede aplicar y limpiar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const estadoCuenta = new ReporteEstadoCuentaPage(page);
    await estadoCuenta.abrir();

    await test.step('Filtrar por una moneda específica (USD)', async () => {
      await estadoCuenta.seleccionarMoneda('USD');
      await estadoCuenta.validarTabla();
      await estadoCuenta.validarSinErrores();
    });

    await test.step('Volver a "Todas" restaura el filtro sin errores', async () => {
      await estadoCuenta.seleccionarMoneda('Todas');
      await estadoCuenta.validarTabla();
      await estadoCuenta.validarSinErrores();
    });
  });

  test('el menú de acciones de una fila permite ver el detalle en un modal', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const estadoCuenta = new ReporteEstadoCuentaPage(page);
    await estadoCuenta.abrir();

    const total = await estadoCuenta.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene estados de cuenta registrados.');

    await estadoCuenta.verDetalleDeFila(0);
    await expect(estadoCuenta.modalDetalle()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  });

  test('el menú de acciones de una fila descarga un PDF individual', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const estadoCuenta = new ReporteEstadoCuentaPage(page);
    await estadoCuenta.abrir();

    const total = await estadoCuenta.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene estados de cuenta registrados.');

    const descarga = await estadoCuenta.descargarPdfDeFila(0);
    expect(descarga.suggestedFilename()).toMatch(/\.pdf$/i);
  });
});

// ─── Reporte de Clientes por Vendedor ──────────────────────────────────────
//
// Analizado en vivo (ver comentario de ReporteClientesPorVendedorPage en
// rp-clientes.page.ts): no tiene rango de fechas, filtro de moneda,
// exportación a PDF, ni ordenamiento/paginación — no se crean pruebas para
// esas funcionalidades porque no existen.

test.describe('Reporte de Clientes por Vendedor', () => {
  test('carga la tabla con datos reales y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const porVendedor = new ReporteClientesPorVendedorPage(page);

    await test.step('Abrir el reporte', async () => {
      await porVendedor.abrir();
    });

    await test.step('La tabla es visible', async () => {
      await porVendedor.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await porVendedor.validarSinErrores();
    });
  });

  test('la búsqueda por texto filtra los resultados y limpiarla los restaura', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const porVendedor = new ReporteClientesPorVendedorPage(page);
    await porVendedor.abrir();

    const totalSinFiltrar = await porVendedor.contarFilas();
    test.skip(totalSinFiltrar === 0, 'El ambiente de QA no tiene clientes por vendedor registrados.');

    const termino = await test.step('Tomar el nombre de la primera fila como término de búsqueda', async () => {
      const nombreCompleto = await porVendedor.obtenerNombreDeFila(0);
      return nombreCompleto.trim().split(/\s+/)[0];
    });

    await test.step('Buscar por ese término', async () => {
      await porVendedor.buscar(termino);
      await expect.poll(() => porVendedor.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThan(0);
    });

    await test.step('Cada fila visible corresponde al término buscado', async () => {
      const filasFiltradas = await porVendedor.contarFilas();
      for (let i = 0; i < filasFiltradas; i++) {
        const nombre = await porVendedor.obtenerNombreDeFila(i);
        expect(nombre.toLowerCase()).toContain(termino.toLowerCase());
      }
    });

    await test.step('Limpiar la búsqueda restaura todos los registros', async () => {
      await porVendedor.limpiarBusqueda();
      await expect.poll(() => porVendedor.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalSinFiltrar);
    });
  });

  test('"Descargar" genera un archivo .xlsx', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const porVendedor = new ReporteClientesPorVendedorPage(page);
    await porVendedor.abrir();

    const descarga = await porVendedor.descargarExcel();
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });
});

// ─── Reporte de Redes Sociales ─────────────────────────────────────────────
//
// Analizado en vivo (ver comentario de ReporteRedesSocialesPage en
// rp-clientes.page.ts): no existe exportación a PDF ni ordenamiento/paginación
// en este reporte — no se crean pruebas para esas funcionalidades porque no
// existen.

test.describe('Reporte de Redes Sociales', () => {
  test('carga la tabla con sus columnas y sin errores, incluso sin resultados', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const redesSociales = new ReporteRedesSocialesPage(page);

    await test.step('Abrir el reporte', async () => {
      await redesSociales.abrir();
    });

    await test.step('La tabla es visible', async () => {
      await redesSociales.validarTabla();
    });

    await test.step('Sin resultados no hay mensaje de error (el ambiente de QA no tiene clientes con redes sociales registradas)', async () => {
      await redesSociales.validarSinErrores();
    });
  });

  test('el rango de fechas se puede ampliar y la búsqueda sigue funcionando sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const redesSociales = new ReporteRedesSocialesPage(page);
    await redesSociales.abrir();

    const filasRangoCorto = await test.step('Buscar con el rango por defecto (mes en curso)', async () => {
      await redesSociales.buscar();
      return redesSociales.contarFilas();
    });

    await test.step('Ampliar el rango a los últimos 2 años y buscar de nuevo', async () => {
      await redesSociales.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
      await redesSociales.buscar();
    });

    await test.step('El reporte sigue funcionando: la tabla es visible y no hay menos resultados que con el rango corto', async () => {
      await redesSociales.validarTabla();
      await expect.poll(() => redesSociales.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThanOrEqual(filasRangoCorto);
      await redesSociales.validarSinErrores();
    });
  });

  test('la búsqueda por texto filtra los resultados y limpiarla los restaura', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const redesSociales = new ReporteRedesSocialesPage(page);
    await redesSociales.abrir();
    await redesSociales.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await redesSociales.buscar();

    const totalSinFiltrar = await redesSociales.contarFilas();
    test.skip(
      totalSinFiltrar === 0,
      'El ambiente de QA no tiene clientes con redes sociales registradas en ningún rango — no hay datos reales para validar el filtrado por texto.'
    );

    await test.step('Buscar un término que no debería coincidir con ningún registro', async () => {
      await redesSociales.buscar('zzzz_termino_que_no_existe_9999');
      await expect.poll(() => redesSociales.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeLessThan(totalSinFiltrar);
    });

    await test.step('Limpiar la búsqueda restaura todos los resultados', async () => {
      await redesSociales.limpiarBusqueda();
      await expect.poll(() => redesSociales.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalSinFiltrar);
    });
  });

  test('el filtro de estado (Todas/Clientes/Prospectos) se puede aplicar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const redesSociales = new ReporteRedesSocialesPage(page);
    await redesSociales.abrir();
    await redesSociales.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await redesSociales.buscar();

    const totalTodas = await redesSociales.contarFilas();

    await test.step('Filtrar por "Clientes"', async () => {
      await redesSociales.filtrarPorEstado('Clientes');
      await redesSociales.validarTabla();
      await redesSociales.validarSinErrores();
      await expect.poll(() => redesSociales.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeLessThanOrEqual(totalTodas);
    });

    await test.step('Filtrar por "Prospectos"', async () => {
      await redesSociales.filtrarPorEstado('Prospectos');
      await redesSociales.validarTabla();
      await redesSociales.validarSinErrores();
      await expect.poll(() => redesSociales.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeLessThanOrEqual(totalTodas);
    });

    await test.step('Volver a "Todas" restaura el total original', async () => {
      await redesSociales.filtrarPorEstado('Todas');
      await expect.poll(() => redesSociales.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalTodas);
    });
  });

  test('el filtro de moneda se puede aplicar y limpiar sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const redesSociales = new ReporteRedesSocialesPage(page);
    await redesSociales.abrir();

    await test.step('Filtrar por una moneda específica (USD)', async () => {
      await redesSociales.seleccionarMoneda('USD');
      await redesSociales.validarTabla();
      await redesSociales.validarSinErrores();
    });

    await test.step('Volver a "Todas" restaura el filtro sin errores', async () => {
      await redesSociales.seleccionarMoneda('Todas');
      await redesSociales.validarTabla();
      await redesSociales.validarSinErrores();
    });
  });

  test('"Descargar" genera un archivo .xlsx, incluso con la tabla vacía', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const redesSociales = new ReporteRedesSocialesPage(page);
    await redesSociales.abrir();
    await redesSociales.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await redesSociales.buscar();

    const descarga = await redesSociales.descargarExcel();
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });
});
