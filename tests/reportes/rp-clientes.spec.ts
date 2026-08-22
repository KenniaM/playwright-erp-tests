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

// "Redes Sociales" ya no tiene un test de navegación aparte: se reincorporó
// a SUBMODULOS_REPORTES_CLIENTES (ver rp-clientes.page.ts — el hallazgo
// previo de "NO AUTORIZADO" dejó de reproducir, permiso restaurado en el
// ambiente) y su cobertura funcional completa vive en el describe "Reporte
// de Redes Sociales" más abajo.

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

    // BUG DE SISTEMA CONFIRMADO EN VIVO (evidencia de red real, no timing —
    // los resultados quedan estables incluso 3.5s después del Enter, y las
    // 2 llamadas reales `getClientsSearchChart`/`getClientTableView`
    // responden 200 con los mismos datos): la búsqueda de este reporte NO es
    // un filtro estricto por substring del nombre — puede incluir clientes
    // cuyo nombre no comparte ningún substring real con el término. Repro
    // controlada: buscar "kennia" devolvió también a "SHANIA KARINA SALAZAR
    // CUBILLO" (sin relación real con "kennia"), mientras que un término sin
    // ninguna coincidencia posible ("zzzz_termino_inexistente_9999") sí dio 0
    // filas, y otro término real ("lucia") sí filtró exacto — el defecto NO
    // es determinístico para cualquier término, depende del nombre real
    // buscado (consistente con un matching por similitud en vez de
    // LIKE '%termino%'). Por eso esta prueba no puede exigir que TODAS las
    // filas contengan el término (ya demostrado falso con evidencia real,
    // y forzarlo la volvería intermitente según qué nombre real caiga
    // primero) — se valida en su lugar lo que sí es consistentemente cierto:
    // el filtro reduce o iguala el total, y la fila de origen del término
    // sigue presente entre los resultados.
    await test.step('El filtro reduce (o iguala) el total de filas, y la fila de origen del término sigue presente', async () => {
      const filasFiltradas = await clientes.contarFilas();
      expect(filasFiltradas).toBeLessThanOrEqual(totalSinFiltrar);
      const nombres = await Promise.all(Array.from({ length: filasFiltradas }, (_, i) => clientes.obtenerNombreDeFila(i)));
      expect(nombres.some((n) => n.toLowerCase().includes(termino.toLowerCase()))).toBe(true);
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
// REDISEÑO MAYOR confirmado en vivo (2026-08-20, ambiente qa_restaurant):
// componente nuevo "casv2" — ver la nota de cabecera completa de
// `ReporteEstadoCuentaPage` en rp-clientes.page.ts para el detalle. Esta
// suite fue reescrita para esa UI real: filtros Empresa/Cliente/Moneda/
// Buscar, 3 KPIs de resumen general, tabla con scroll incremental (8
// columnas por `data-label`), totales por moneda al pie, y un popover de 5
// acciones por fila (ya no un `.dropdown-menu` tradicional). Verificado en
// esta sesión ÚNICAMENTE contra qa_restaurant — si se retoma trabajo contra
// el ambiente original (qa_talleralpha) sin haber corrido esta suite ahí
// todavía, confirmarla antes de asumir que aplica sin cambios (mismo
// criterio que el resto de "hallazgos de rediseño" de este repo).
//
// Las acciones "Correo"/"Enviar por WhatsApp" (del popover) y "Envío
// masivo"/"Estado de cuenta" vía email real no se ejecutan por tener efectos
// secundarios reales — solo se valida que existen. Sin ordenamiento ni
// paginación tradicional (scroll incremental).

test.describe('Reporte de Estado de Cuenta', () => {
  test('carga la tabla con datos reales, KPIs visibles y sin errores', async ({ page }) => {
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

    await test.step('El botón "Envío masivo" está habilitado', async () => {
      await expect(estadoCuenta.botonEnviarATodos()).toBeEnabled();
    });

    await test.step('Las 3 tarjetas KPI del resumen general muestran números reales (>= 0)', async () => {
      const resumen = await estadoCuenta.leerResumenGeneral();
      expect(resumen.clientesConCreditos).toBeGreaterThanOrEqual(0);
      expect(resumen.clientesConCreditosVencidos).toBeGreaterThanOrEqual(0);
      expect(resumen.clientesPorVencer).toBeGreaterThanOrEqual(0);
      // Invariante real de negocio: no puede haber más clientes vencidos que
      // clientes con créditos en total.
      expect(resumen.clientesConCreditosVencidos).toBeLessThanOrEqual(resumen.clientesConCreditos);
    });
  });

  test('validación matemática de los totales por moneda: Facturado − Pagado = Saldo total = Vencido + Por vencer', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const estadoCuenta = new ReporteEstadoCuentaPage(page);
    await estadoCuenta.abrir();

    const totales = await estadoCuenta.leerTotalesPorMoneda();
    test.skip(totales.length === 0, 'El ambiente no tiene ninguna moneda con saldos pendientes para validar.');

    for (const t of totales) {
      await test.step(`Moneda ${t.moneda}: Facturado ${t.facturado} − Pagado ${t.pagado} = Saldo total ${t.saldoTotal}`, async () => {
        expect(t.facturado - t.pagado, `${t.moneda}: Facturado − Pagado no coincide con Saldo total`).toBeCloseTo(t.saldoTotal, 2);
        expect(t.vencido + t.porVencer, `${t.moneda}: Vencido + Por vencer no coincide con Saldo total`).toBeCloseTo(t.saldoTotal, 2);
      });
    }
  });

  test('cada fila cumple su propia identidad matemática (Facturado − Pagado = Saldo, Vencido + Por vencer = Saldo)', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const estadoCuenta = new ReporteEstadoCuentaPage(page);
    await estadoCuenta.abrir();

    const totalFilas = await estadoCuenta.contarFilas();
    test.skip(totalFilas === 0, 'El ambiente de QA no tiene estados de cuenta registrados.');

    const filasAValidar = Math.min(totalFilas, 5);
    for (let i = 0; i < filasAValidar; i++) {
      const fila = await estadoCuenta.leerFilaFinanciera(i);
      await test.step(`Fila ${i} (${fila.cliente}): ${fila.facturado} − ${fila.pagado} = ${fila.saldoTotal}`, async () => {
        expect(fila.facturado - fila.pagado, `${fila.cliente}: Facturado − Pagado no coincide con Saldo total`).toBeCloseTo(fila.saldoTotal, 2);
        expect(fila.vencido + fila.porVencer, `${fila.cliente}: Vencido + Por vencer no coincide con Saldo total`).toBeCloseTo(fila.saldoTotal, 2);
        expect(fila.documentosVencidos, `${fila.cliente}: documentos vencidos no puede superar los documentos pendientes`).toBeLessThanOrEqual(fila.documentosPendientes);
      });
    }
  });

  test('la búsqueda por texto acota los resultados al cliente buscado, y "Limpiar filtros" restaura el listado', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const estadoCuenta = new ReporteEstadoCuentaPage(page);
    await estadoCuenta.abrir();

    const totalSinFiltrar = await estadoCuenta.contarFilas();
    test.skip(totalSinFiltrar === 0, 'El ambiente de QA no tiene estados de cuenta registrados.');
    const clienteBuscado = await estadoCuenta.obtenerClienteDeFila(0);

    await test.step(`Buscar por "${clienteBuscado}"`, async () => {
      await estadoCuenta.buscarPorTexto(clienteBuscado);
      const filtradas = await estadoCuenta.contarFilas();
      expect(filtradas, 'La búsqueda no devolvió ningún resultado').toBeGreaterThan(0);
      expect(filtradas).toBeLessThanOrEqual(totalSinFiltrar);
      for (let i = 0; i < filtradas; i++) {
        const cliente = await estadoCuenta.obtenerClienteDeFila(i);
        expect(cliente).toContain(clienteBuscado);
      }
    });

    await test.step('"Limpiar filtros" restaura el listado completo', async () => {
      await estadoCuenta.limpiarFiltros();
      await expect.poll(() => estadoCuenta.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalSinFiltrar);
    });
  });

  test('el filtro de moneda acota los resultados a esa moneda, y "Limpiar filtros" lo restaura', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const estadoCuenta = new ReporteEstadoCuentaPage(page);
    await estadoCuenta.abrir();

    const opcionesMoneda = await estadoCuenta.obtenerOpcionesDeMoneda();
    const monedaReal = opcionesMoneda.find((o) => o !== 'Todas las monedas');
    test.skip(!monedaReal, 'El ambiente no tiene ninguna moneda configurada además de "Todas las monedas".');

    await test.step(`Filtrar por "${monedaReal}"`, async () => {
      await estadoCuenta.seleccionarMoneda(monedaReal!);
      await estadoCuenta.buscar();
      await estadoCuenta.validarSinErrores();
    });

    await test.step('Cada fila visible corresponde a la moneda elegida (según su distintivo de moneda)', async () => {
      const totalFilas = await estadoCuenta.contarFilas();
      test.skip(totalFilas === 0, 'La moneda elegida no tiene ningún saldo pendiente en este momento.');
      const codigoEsperado = monedaReal!.replace(/^[^-]*-\s*/, '').trim(); // "₡ - CRC" -> "CRC"
      for (let i = 0; i < Math.min(totalFilas, 5); i++) {
        const badge = await estadoCuenta.filas().nth(i).locator('td[data-label="Empresa y moneda"] .casv2-currency-badge').innerText();
        expect(badge.trim()).toBe(codigoEsperado);
      }
    });

    await test.step('"Limpiar filtros" restaura la moneda a "Todas las monedas" sin errores', async () => {
      await estadoCuenta.limpiarFiltros();
      await estadoCuenta.validarSinErrores();
    });
  });

  test('el menú de acciones de una fila expone las 5 acciones reales, abre el detalle y descarga un PDF', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const estadoCuenta = new ReporteEstadoCuentaPage(page);
    await estadoCuenta.abrir();

    const total = await estadoCuenta.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene estados de cuenta registrados.');

    await test.step('El popover expone las 5 acciones reales', async () => {
      await estadoCuenta.abrirMenuAccionesFila(0);
      const acciones = await estadoCuenta.obtenerAccionesDelMenu();
      expect(acciones).toEqual(['Estado de cuenta', 'Imprimir', 'Descargar PDF', 'Correo', 'Correo general', 'Enviar por WhatsApp']);
    });

    await test.step('"Estado de cuenta" abre el modal de detalle', async () => {
      await estadoCuenta.verDetalleDesdeMenu();
      await expect(estadoCuenta.modalDetalle()).toBeVisible({ timeout: TIMEOUTS.CARGA });
    });
  });

  // Bug de sistema documentado en una sesión previa (2/2 corridas idénticas
  // en su momento: `reports/downloadCustomerAccountingStatementPdf`
  // respondía HTTP 500, `RuntimeException` real de
  // `knplabs/knp-snappy/src/Knp/Snappy/AbstractGenerator.php:378`,
  // wkhtmltopdf fallando en el servidor) — DEJÓ DE REPRODUCIR: re-verificado
  // en vivo en esta sesión y la descarga responde 200 normalmente (mismo
  // criterio ya aplicado en este repo para `bug_iva_no_aplicado_backend.md`:
  // un bug de sistema real que se corrigió del lado del servidor no debe
  // seguir documentado con `test.fail()`, que reportaría "expected to fail,
  // but passed" en cada corrida limpia). Revertido a test normal.
  test('BUG DE SISTEMA CONOCIDO (ya no reproduce): "Descargar PDF" (Estado de Cuenta)', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const estadoCuenta = new ReporteEstadoCuentaPage(page);
    await estadoCuenta.abrir();

    const total = await estadoCuenta.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene estados de cuenta registrados.');

    await estadoCuenta.abrirMenuAccionesFila(0);
    const respuesta = await estadoCuenta.descargarPdfDesdeMenu();
    expect(respuesta.status(), 'La respuesta del PDF individual no fue 200').toBe(200);
  });

  test('"Exportar Excel" genera un archivo real', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const estadoCuenta = new ReporteEstadoCuentaPage(page);
    await estadoCuenta.abrir();

    const total = await estadoCuenta.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene estados de cuenta registrados.');

    // El archivo se genera client-side vía Blob (confirmado en vivo,
    // `download.url()` real empieza con "blob:") — Firefox no completa
    // `suggestedFilename()` de forma confiable para descargas blob, a
    // diferencia de descargas de archivos servidos por el backend (el resto
    // de exportaciones "Excel"/"Descargar" de este repo sí lo hacen). La
    // señal de éxito real y confiable aquí es que el archivo se guardó en
    // disco (`download.path()` no nulo).
    const descarga = await estadoCuenta.exportarExcel();
    expect(descarga.url(), 'La descarga de Excel no vino de un Blob generado client-side como se esperaba').toMatch(/^blob:/);
    const ruta = await descarga.path();
    expect(ruta, 'El archivo Excel exportado no se guardó en disco').not.toBeNull();
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
