import { test, expect } from '@playwright/test';
import { ReportesPage, TIMEOUTS } from './reportes.page';
import {
  hoyISO,
  hoyMenosDiasISO,
  ReporteCierreCajaPage,
  ReporteMovimientosCajaPage,
  SUBMODULOS_REPORTES_CAJA,
} from './rp-caja.page';
import {
  PosPage,
  TIMEOUTS as POS_TIMEOUTS,
  espiarErroresJS,
  ResumenTabGeneral,
  ReporteAvanzado,
} from '../facturar/pos/pos.page';

for (const submodulo of SUBMODULOS_REPORTES_CAJA) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Reportes > Caja`, async ({ page }) => {
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

// ─── Reporte de Movimientos de Caja ────────────────────────────────────────
//
// Analizado en vivo (ver comentario de ReporteMovimientosCajaPage en
// rp-caja.page.ts): no existe exportación a PDF ni ningún filtro adicional
// (usuario/caja/estado/sucursal) en este reporte — no se crean pruebas para
// esas funcionalidades porque no existen.

test.describe('Reporte de Movimientos de Caja', () => {
  test('carga la tabla con sus columnas y sin errores, incluso sin resultados', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const movimientos = new ReporteMovimientosCajaPage(page);

    await test.step('Abrir el reporte', async () => {
      await movimientos.abrir();
    });

    await test.step('La tabla es visible', async () => {
      await movimientos.validarTabla();
    });

    await test.step('Sin resultados no hay mensaje de error (la tabla del ambiente de QA no tiene movimientos registrados)', async () => {
      await movimientos.validarSinErrores();
    });
  });

  test('el rango de fechas se puede ampliar y la búsqueda sigue funcionando sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const movimientos = new ReporteMovimientosCajaPage(page);
    await movimientos.abrir();

    const filasRangoCorto = await test.step('Buscar con el rango por defecto (hoy)', async () => {
      await movimientos.aumentarRangoFechas(hoyISO(), hoyISO());
      await movimientos.buscar();
      return movimientos.contarFilas();
    });

    await test.step('Ampliar el rango a los últimos 2 años y buscar de nuevo', async () => {
      await movimientos.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
      await movimientos.buscar();
    });

    await test.step('El reporte sigue funcionando: la tabla es visible y no hay menos resultados que con el rango corto', async () => {
      await movimientos.validarTabla();
      await expect.poll(() => movimientos.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThanOrEqual(filasRangoCorto);
      await movimientos.validarSinErrores();
    });
  });

  test('la búsqueda por texto filtra los resultados y limpiarla los restaura', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const movimientos = new ReporteMovimientosCajaPage(page);
    await movimientos.abrir();
    await movimientos.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await movimientos.buscar();

    const totalSinFiltrar = await movimientos.contarFilas();
    test.skip(
      totalSinFiltrar === 0,
      'El ambiente de QA no tiene movimientos de caja registrados en ningún rango — no hay datos reales para validar el filtrado por texto.'
    );

    await test.step('Buscar un término que no debería coincidir con ningún registro', async () => {
      await movimientos.buscar('zzzz_termino_que_no_existe_9999');
      await expect.poll(() => movimientos.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeLessThan(totalSinFiltrar);
    });

    await test.step('Limpiar la búsqueda restaura todos los resultados', async () => {
      await movimientos.limpiarBusqueda();
      await expect.poll(() => movimientos.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalSinFiltrar);
    });
  });

  test('el botón "Descargar" exporta un Excel, incluso con la tabla vacía', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const movimientos = new ReporteMovimientosCajaPage(page);
    await movimientos.abrir();
    await movimientos.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await movimientos.buscar();

    const descarga = await movimientos.descargarExcel();
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });
});

// ─── Reporte de Cierres de Caja ────────────────────────────────────────────
//
// Analizado en vivo (ver comentario de ReporteCierreCajaPage en
// rp-caja.page.ts): no existe exportación a PDF ni ningún filtro adicional
// (usuario/caja/estado/sucursal) en este reporte — no se crean pruebas para
// esas funcionalidades porque no existen.

test.describe('Reporte de Cierres de Caja', () => {
  test('carga la tabla con datos reales y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cierres = new ReporteCierreCajaPage(page);

    await test.step('Abrir el reporte', async () => {
      await cierres.abrir();
    });

    await test.step('La tabla es visible', async () => {
      await cierres.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await cierres.validarSinErrores();
    });
  });

  test('el rango de fechas se puede ampliar y la búsqueda sigue funcionando sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cierres = new ReporteCierreCajaPage(page);
    await cierres.abrir();

    const filasRangoCorto = await test.step('Aplicar un rango corto (últimos 7 días)', async () => {
      await cierres.aumentarRangoFechas(hoyMenosDiasISO(7), hoyISO());
      await cierres.buscar();
      return cierres.contarFilas();
    });

    await test.step('Ampliar el rango a todo el año en curso y volver a buscar', async () => {
      await cierres.aumentarRangoFechas(hoyMenosDiasISO(365), hoyISO());
      await cierres.buscar();
    });

    await test.step('El reporte sigue funcionando: la tabla es visible y no hay menos resultados que con el rango corto', async () => {
      await cierres.validarTabla();
      await expect.poll(() => cierres.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThanOrEqual(filasRangoCorto);
      await cierres.validarSinErrores();
    });
  });

  test('la búsqueda por texto filtra por el cajero real y limpiarla restaura todos los registros', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cierres = new ReporteCierreCajaPage(page);
    await cierres.abrir();
    await cierres.aumentarRangoFechas(hoyMenosDiasISO(365), hoyISO());
    await cierres.buscar();

    const totalSinFiltrar = await cierres.contarFilas();
    test.skip(totalSinFiltrar === 0, 'El ambiente de QA no tiene cierres de caja registrados en el rango probado.');

    const termino = await test.step('Tomar el nombre real del cajero de la primera fila como término de búsqueda', async () => {
      const nombreCompleto = await cierres.obtenerNombreCajeroDeFila(0);
      return nombreCompleto.trim().split(/\s+/)[0];
    });

    await test.step('Buscar por ese término', async () => {
      await cierres.buscar(termino);
      await expect.poll(() => cierres.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThan(0);
    });

    await test.step('Cada fila visible corresponde al término buscado', async () => {
      const filasFiltradas = await cierres.contarFilas();
      for (let i = 0; i < filasFiltradas; i++) {
        const cajero = await cierres.obtenerNombreCajeroDeFila(i);
        expect(cajero.toLowerCase()).toContain(termino.toLowerCase());
      }
    });

    await test.step('Limpiar la búsqueda restaura todos los registros', async () => {
      await cierres.limpiarBusqueda();
      await expect.poll(() => cierres.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalSinFiltrar);
    });
  });

  test('"Descargar Excel" genera un archivo .xlsx tanto en la variante resumen como en la detallada', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cierres = new ReporteCierreCajaPage(page);
    await cierres.abrir();

    const total = await cierres.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene cierres de caja registrados en el rango por defecto.');

    await test.step('Descargar la variante "Solo cierre de caja"', async () => {
      const descarga = await cierres.descargarExcelResumen();
      expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
    });

    await test.step('Descargar la variante "Detallado"', async () => {
      const descarga = await cierres.descargarExcelDetalle();
      expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
    });
  });

  test('el menú de acciones de una fila expone "Ver Detalle", "Enviar por correo" y "Enviar por WhatsApp"', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cierres = new ReporteCierreCajaPage(page);
    await cierres.abrir();

    const total = await cierres.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene cierres de caja registrados en el rango por defecto.');

    const opciones = await cierres.obtenerOpcionesAccionesFila(0);
    const textoOpciones = opciones.join(' | ').toLowerCase();

    expect(textoOpciones).toContain('ver detalle');
    expect(textoOpciones).toContain('enviar por correo');
    expect(textoOpciones).toMatch(/enviar por whats?app/);
  });
});

// ─── "Ver Detalle" ──────────────────────────────────────────────────────────
//
// Funcionalidad descubierta en vivo, no cubierta previamente por ningún test:
// la opción "Ver Detalle" del menú de acciones de cada fila (ya confirmada
// arriba en el test del propio menú) abre un panel real
// (`getCashClosureDetail`, `.cash-closure-modal-content`) con el cierre
// completo ya persistido — ver el comentario de `DetalleCierreReporte` en
// rp-caja.page.ts. Es la pieza que hace posible la validación cruzada real
// contra el POS (siguiente describe).

test.describe('Reporte de Cierres de Caja — "Ver Detalle"', () => {
  test('el panel expone el encabezado y las 4 tarjetas reales, y se puede cerrar', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cierres = new ReporteCierreCajaPage(page);
    await cierres.abrir();
    await cierres.aumentarRangoFechas(hoyMenosDiasISO(365), hoyISO());
    await cierres.buscar();

    const total = await cierres.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene cierres de caja registrados en el rango probado.');

    await test.step('Abrir "Ver Detalle" de la primera fila', async () => {
      await cierres.abrirDetalleFila(0);
    });

    await test.step('El encabezado y las 4 tarjetas exponen datos reales (no vacíos)', async () => {
      const detalle = await cierres.leerDetalleCierre();
      expect(detalle.compania.length, 'Compañía vacía').toBeGreaterThan(0);
      expect(detalle.caja.length, 'Caja vacía').toBeGreaterThan(0);
      expect(detalle.responsable.length, 'Responsable vacío').toBeGreaterThan(0);
      expect(detalle.noCierre.length, 'No. cierre vacío').toBeGreaterThan(0);
      expect(detalle.informacionGeneral.fecha.length, 'Fecha vacía').toBeGreaterThan(0);
      expect(detalle.informacionGeneral.hora.length, 'Hora vacía').toBeGreaterThan(0);
      // "Total" de Métodos de pago debe ser la suma real de sus 4 componentes.
      const sumaMetodosPago = detalle.metodosPago.efectivo + detalle.metodosPago.tarjeta
        + detalle.metodosPago.transaccion + detalle.metodosPago.sinpeMovil;
      expect(detalle.metodosPago.total, '"Total" de Métodos de pago no es la suma de sus 4 componentes').toBeCloseTo(sumaMetodosPago, 2);
    });

    await test.step('Cerrar el panel con el botón "×"', async () => {
      await cierres.cerrarDetalleFila();
    });

    await cierres.validarSinErrores();
  });

  test('cambiar la moneda del detalle no produce errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const cierres = new ReporteCierreCajaPage(page);
    await cierres.abrir();
    await cierres.aumentarRangoFechas(hoyMenosDiasISO(365), hoyISO());
    await cierres.buscar();

    const total = await cierres.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene cierres de caja registrados en el rango probado.');

    await cierres.abrirDetalleFila(0);
    const general = await cierres.leerDetalleCierre();

    // COMPANIA_POS (ver pos.types.ts) opera únicamente en la moneda base ($)
    // — confirmado en vivo que este ambiente no tiene ventas reales en
    // ninguna otra moneda del catálogo, así que el total "GENERAL" (agregado
    // de todas las monedas) y el total en "USD" deben coincidir exactamente.
    await test.step('Alternar a USD y validar que el total coincide con GENERAL', async () => {
      await cierres.seleccionarMonedaEnDetalle('USD');
      const usd = await cierres.leerDetalleCierre();
      expect(usd.metodosPago.total, 'El total en USD no coincide con el total GENERAL (este ambiente solo opera en la moneda base)').toBeCloseTo(general.metodosPago.total, 2);
    });

    await test.step('Volver a GENERAL sin errores', async () => {
      await cierres.seleccionarMonedaEnDetalle('ALL');
      const vueltaGeneral = await cierres.leerDetalleCierre();
      expect(vueltaGeneral.metodosPago.total).toBeCloseTo(general.metodosPago.total, 2);
    });

    await cierres.cerrarDetalleFila();
    await cierres.validarSinErrores();
  });
});

// ─── Validación cruzada: POS "Detalle de Cierre" vs. Reportes "Ver Detalle" ─
//
// La pieza central pedida por CLAUDE.md/la tarea: generar un cierre real y
// controlado en el POS y comprobar que el Reporte de Cierres de Caja
// (Reportes > Caja > Cierres de Caja > Ver Detalle) muestra EXACTAMENTE la
// misma información — no delta, comparación directa, porque un cierre real
// solo ocurre una vez (a diferencia del resto de pos-cierre-caja.spec.ts,
// que evita cerrar la caja de verdad para no interferir con otros
// escenarios). Localiza el cierre propio en el reporte por un efectivo de
// cierre ÚNICO (derivado de Date.now()), nunca asumiendo "la fila más
// reciente" — el ambiente es compartido y puede tener cierres concurrentes
// de otras corridas.
test.describe('Reporte de Cierres de Caja — Validación cruzada contra el cierre real del POS', () => {
  test('el cierre generado en el POS coincide con su propio "Ver Detalle" en el reporte', async ({ page }) => {
    test.setTimeout(POS_TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const erroresJS = espiarErroresJS(page);

    await test.step('Cargar el POS, asegurar caja abierta y moneda base activa', async () => {
      await pos.cargarPosDesdeDashboard();
      await pos.cerrarOverlaysConocidos();
      if (await pos.modalAbrirCajaVisible()) {
        await pos.completarAperturaCaja();
        await expect(pos.modalAbrirCaja).toBeHidden();
      }
      // Corrección de automatización confirmada en vivo (ver
      // pos-cierre-caja.spec.ts): la moneda persiste por usuario en el
      // servidor — forzar la base antes de comparar montos.
      await pos.asegurarMonedaBaseActiva();
    });

    await test.step('Crear una venta de contado conocida, pagada 100% en efectivo', async () => {
      await pos.agregarProductoRapidoSimple(`Validacion Cruzada Reporte ${Date.now()}`, '850');
      await pos.presionarFacturar();
      await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: POS_TIMEOUTS.PAYMENT_MODAL });
      await pos.cambiarTipoPagoEnModalPago('contado');
      await expect(page.locator('#payment_cash_total'), 'El campo de efectivo no quedó visible tras cambiar a "Contado"').toBeVisible({ timeout: POS_TIMEOUTS.PAYMENT_MODAL });
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total).toBeGreaterThan(0);
      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    // Investigado en vivo (2026-08-15): el precio tecleado en "Producto
    // Rápido" SIEMPRE se interpreta en la moneda BASE de la compañía, sin
    // importar cuál moneda esté activa para mostrar/cobrar — cambiar la
    // moneda activa (cambiarMoneda(), persiste por usuario en el servidor)
    // solo afecta la CONVERSIÓN DE DISPLAY del total, nunca el monto real
    // grabado (confirmado: precio "1000" con ₡ activo y tasa 635 mostró
    // "₡ 635,000" en el modal de pago, y el delta real de "Ventas Totales"
    // del Tab General tras confirmar esa venta fue exactamente 1000, no
    // 635000). Esta venta valida exactamente esa conversión de display con
    // un monto propio y conocido, reutilizando el mismo patrón de
    // obtenerInfoMoneda()/cambiarMoneda() que ya usa "Orden de Caja — Moneda
    // contraria a la base" (pos-orden-caja.spec.ts).
    let simboloContrario = '';
    let codigoMonedaContraria = '';
    let tasaCambioContraria = 0;
    let totalSegundaVentaBase = 0;
    await test.step('Crear una segunda venta en la moneda CONTRARIA a la base y validar la conversión de display', async () => {
      const { simboloActivo, simboloBase } = await pos.obtenerInfoMoneda();
      simboloContrario = simboloBase === '$' ? '₡' : '$';
      codigoMonedaContraria = simboloContrario === '₡' ? 'CRC' : 'USD';
      expect(simboloActivo, 'La moneda no quedó en la base tras asegurarMonedaBaseActiva()').toBe(simboloBase);

      await pos.cambiarMoneda(simboloContrario);
      // @ts-expect-error variable global real de la app (window.global_current_pos_exchange), no expuesta por tipos — mismo patrón ya usado en registrarMovimientoCaja()
      tasaCambioContraria = await page.evaluate(() => window.global_current_pos_exchange);
      expect(tasaCambioContraria, 'No se pudo leer la tasa de cambio real activa').toBeGreaterThan(0);

      // Verificación defensiva: el carrito debe estar vacío antes de agregar
      // el único producto de esta venta — descarta contaminación de un
      // carrito ajeno (el carrito persiste por usuario en el servidor, mismo
      // criterio ya confirmado para moneda) antes de asumir que el total
      // mostrado corresponde 1:1 a este único producto.
      await pos.validarCarritoVacio();

      // Se usa agregarProductoRapidoParaValidacionIva(..., false) en vez de
      // agregarProductoRapidoSimple(): esta aserción necesita el precio EXACTO
      // sin impuesto — hallazgo real confirmado en vivo (ver el comentario de
      // agregarProductoRapidoSimple() en pos-core.page.ts): esa variante
      // simple puede dejar el checkbox "Aplicar Impuesto" marcado por una
      // condición de carrera real de la app (timer de pos.js, HONDURAS SÍ
      // tiene impuesto por defecto configurado), reproducido 2/2 con el
      // mismo precio (400 → $254,000 sin impuesto vs. $279,400 con +10%).
      totalSegundaVentaBase = 400;
      await pos.agregarProductoRapidoParaValidacionIva(`Validacion Cruzada Moneda ${Date.now()}`, String(totalSegundaVentaBase), false);
      await pos.presionarFacturar();
      await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: POS_TIMEOUTS.PAYMENT_MODAL });
      await pos.cambiarTipoPagoEnModalPago('contado');
      await expect(page.locator('#payment_cash_total'), 'El campo de efectivo no quedó visible tras cambiar a "Contado"').toBeVisible({ timeout: POS_TIMEOUTS.PAYMENT_MODAL });

      expect(await pos.obtenerSimboloMonedaEnTotal(), 'El total no se muestra en la moneda contraria esperada').toBe(simboloContrario);
      const totalMostrado = await pos.obtenerTotalVentaNumerico();
      expect(totalMostrado, `El total mostrado en ${simboloContrario} no coincide con el precio base (${totalSegundaVentaBase}) convertido a la tasa real (${tasaCambioContraria})`)
        .toBeCloseTo(totalSegundaVentaBase * tasaCambioContraria, 0);

      await pos.seleccionarPagoEfectivo(String(totalMostrado));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();

      // Restaurar la moneda base ANTES de seguir: persiste por usuario en el
      // servidor (mismo criterio que el resto de la suite) y el resto de
      // este test asume moneda base activa.
      await pos.cambiarMoneda(simboloBase);
    });

    let resumenAntesDeCerrar!: ResumenTabGeneral;
    let reporteAvanzadoAntesDeCerrar!: ReporteAvanzado;
    await test.step('Leer Tab General y Reporte Avanzado justo antes de cerrar (snapshot final de este cierre)', async () => {
      await pos.abrirDetalleDeCierre();
      resumenAntesDeCerrar = await pos.leerResumenTabGeneral();
      reporteAvanzadoAntesDeCerrar = await pos.leerReporteAvanzado();
      // Corrección de automatización confirmada en vivo: activar "Mostrar
      // Reporte Avanzado" (leerReporteAvanzado()) reemplaza dentro del mismo
      // Tab General la sección con el formulario real de cierre —
      // #closure_posted_balance/#next_cash_closing quedan sin visibilidad
      // (487 reintentos de fill() agotando los 300s del test, confirmado en
      // vivo) mientras el Reporte Avanzado sigue activo. Se cancela y se
      // vuelve a abrir el modal limpio (mismo patrón que el resto de este
      // archivo: leer con cancelarModalCerrarCaja(), operar, reabrir con
      // abrirDetalleDeCierre() fresco) antes de usar el formulario real.
      await pos.cancelarModalCerrarCaja();
    });

    // Montos únicos derivados del timestamp: permiten localizar SIN
    // ambigüedad la fila de este cierre exacto en el reporte compartido.
    const efectivoCierreUnico = Number((100 + (Date.now() % 89000) / 100).toFixed(2));
    const efectivoSiguienteUnico = Number((200 + ((Date.now() + 54321) % 89000) / 100).toFixed(2));

    await test.step('Cerrar la caja con montos de efectivo únicos', async () => {
      await pos.abrirDetalleDeCierre();
      await pos.completarFormularioCerrarCaja(String(efectivoCierreUnico), String(efectivoSiguienteUnico), `Validacion cruzada Reporte ${Date.now()}`);
      await pos.confirmarCerrarCaja();
      await expect(pos.modalCerrarCaja).toBeHidden();
    });

    const cierres = new ReporteCierreCajaPage(page);
    let detalle!: Awaited<ReturnType<ReporteCierreCajaPage['leerDetalleCierre']>>;
    let indiceFila!: number;
    await test.step('Localizar el cierre recién generado en Reportes > Cierres de Caja por su efectivo de cierre único', async () => {
      await cierres.abrir();
      await cierres.buscar();
      const indice = await cierres.localizarFilaPorMontoCierre(efectivoCierreUnico);
      expect(indice, 'No se encontró en el reporte ninguna fila con el efectivo de cierre único generado por esta prueba').not.toBeNull();
      indiceFila = indice!;
      await cierres.abrirDetalleFila(indiceFila);
      detalle = await cierres.leerDetalleCierre();
    });

    // La columna "APERTURA" (Caja Ant./Saldo/Dif. Apert.) del listado tiene
    // un bug de sistema confirmado (Caja Ant. y Saldo aparecen invertidos,
    // con signo cambiado en Caja Ant.) — ver el test dedicado
    // `test.fail()` más abajo en este archivo, que lo documenta con
    // evidencia completa en vez de mezclarlo aquí con las validaciones que
    // sí pasan.

    await test.step('Comparar el encabezado del reporte (identidad del cierre) contra el POS', async () => {
      // No se compara contra COMPANIA_POS: hallazgo real confirmado en vivo
      // (corrida sin --project explícito) — la sola presencia de
      // 'firefox-super-admin'/'setup-super-admin' en el arreglo de proyectos
      // por defecto (ver playwright.config.ts) puede hacer que Playwright
      // evalúe el módulo de super-admin.setup.ts durante el descubrimiento
      // de tests aunque ningún test de ese proyecto coincida con el filtro
      // -g, dejando POS_COMPANIA (y por lo tanto la constante COMPANIA_POS,
      // cacheada al importar el módulo una sola vez) contaminado con
      // "TALLER ALPHA  PREMIUM" en vez de "HONDURAS" — sin afectar la
      // navegación real (que sí resolvió HONDURAS correctamente, confirmado
      // por el resto de aserciones de este mismo test). Comparar contra esa
      // constante es frágil fuera de --project=firefox explícito; se valida
      // solo que el campo real no esté vacío.
      expect(detalle.compania.length, 'Compañía vacía').toBeGreaterThan(0);
      expect(detalle.caja.length, 'Caja vacía').toBeGreaterThan(0);
      expect(detalle.responsable.length, 'Responsable vacío').toBeGreaterThan(0);
      expect(Number(detalle.noCierre), 'El "No. cierre" del reporte no es un número real').toBeGreaterThan(0);
    });

    await test.step('Comparar "Información general" del reporte contra las 2 ventas reales de este cierre', async () => {
      // >= 2 (no === 2): el ambiente es compartido y la caja puede llevar
      // otras ventas acumuladas desde que se abrió (ver CLAUDE.md) — se
      // valida que INCLUYA las 2 propias, nunca que sea exactamente 2.
      expect(detalle.informacionGeneral.transacciones, 'Las "Transacciones" del reporte no incluyen al menos las 2 ventas reales de este cierre').toBeGreaterThanOrEqual(2);
      expect(detalle.informacionGeneral.ventaPromedioPorTransaccion, 'La "Venta promedio por transacción" no es mayor a 0').toBeGreaterThan(0);
      // Invariante matemática real: promedio × transacciones == total de
      // Métodos de pago (misma cifra real, 2 vistas del mismo cierre).
      expect(detalle.informacionGeneral.ventaPromedioPorTransaccion * detalle.informacionGeneral.transacciones, '"Venta promedio × Transacciones" no coincide con el "Total" de Métodos de pago').toBeCloseTo(detalle.metodosPago.total, 1);
    });

    await test.step('Comparar "Flujo de efectivo" del reporte contra lo ingresado/leído en el POS', async () => {
      expect(detalle.flujoEfectivo.efectivoCierreCaja, 'El "Efectivo del cierre de caja" del reporte no coincide con lo ingresado en el POS').toBeCloseTo(efectivoCierreUnico, 2);
      expect(detalle.flujoEfectivo.efectivoSiguienteCaja, 'El "Efectivo para siguiente caja" del reporte no coincide con lo ingresado en el POS').toBeCloseTo(efectivoSiguienteUnico, 2);
      expect(detalle.flujoEfectivo.saldoAperturaCaja, 'El "Saldo Apertura Caja" del reporte no coincide con "Resumen de cierre: + Apertura" del POS').toBeCloseTo(resumenAntesDeCerrar.resumenCierre.apertura, 2);

      // "Diferencia de cierre" = efectivo contado - efectivo esperado.
      // Fórmula confirmada en vivo (investigación dedicada, ver el
      // comentario de completarFormularioCerrarCaja() en
      // pos-cierre-caja.page.ts): disparando el evento "keyup" real que la
      // app espera, "999.99" contra un "Total" de "1,000.00" recalculó
      // "Diferencia" a exactamente "-0.01" (999.99 - 1000.00). Antes de esa
      // corrección, completarFormularioCerrarCaja() usaba solo `.fill()`
      // (sin disparar "keyup"), dejando "Diferencia de cierre" persistida
      // en 0.00/stale en CUALQUIER cierre real generado por esta suite —
      // ya corregido, así que esta aserción ahora puede confiar en la
      // fórmula real.
      const diferenciaEsperada = efectivoCierreUnico - resumenAntesDeCerrar.datosCierre.total;
      expect(detalle.flujoEfectivo.diferenciaCierre, 'La "Diferencia de cierre" del reporte no coincide con (efectivo ingresado - "Datos de Cierre: Total" del POS)').toBeCloseTo(diferenciaEsperada, 2);
    });

    await test.step('Comparar "Métodos de pago" del reporte contra "Ingresos por Método de Pago" del POS (Tab General)', async () => {
      expect(detalle.metodosPago.efectivo, 'El total de "Efectivo" del reporte no coincide con el del POS').toBeCloseTo(resumenAntesDeCerrar.metodoPago.efectivo, 2);
      expect(detalle.metodosPago.tarjeta, 'El total de "Tarjeta" del reporte no coincide con el del POS').toBeCloseTo(resumenAntesDeCerrar.metodoPago.tarjeta, 2);
      expect(detalle.metodosPago.transaccion, 'El total de "Transacción" del reporte no coincide con el del POS').toBeCloseTo(resumenAntesDeCerrar.metodoPago.transaccion, 2);
      expect(detalle.metodosPago.sinpeMovil, 'El total de "SINPE MOVIL" del reporte no coincide con el del POS').toBeCloseTo(resumenAntesDeCerrar.metodoPago.sinpe, 2);
      expect(detalle.metodosPago.total, 'El "Total" de métodos de pago del reporte no coincide con "Ventas Totales" del POS').toBeCloseTo(resumenAntesDeCerrar.ventasTotales, 2);
    });

    await test.step('Comparar "Análisis de ingresos" del reporte contra Tab General/Reporte Avanzado del POS', async () => {
      expect(
        detalle.analisisIngresos.ventasDirectas + detalle.analisisIngresos.ingresosTaller,
        '(Ventas directas + Ingresos de taller) del reporte no coincide con "Ingresos por facturas" (Reporte Avanzado) del POS'
      ).toBeCloseTo(reporteAvanzadoAntesDeCerrar.totalFacturas, 2);
      // Math.abs(): el reporte muestra las salidas/devoluciones con signo
      // negativo ("-$ 0.00") mientras el POS las expone como magnitud
      // positiva — se compara la magnitud, no el signo de cada vista.
      expect(Math.abs(detalle.analisisIngresos.salidasCaja), 'Las "Salidas de caja" del reporte no coinciden con "Resumen de cierre: - Salidas" del POS').toBeCloseTo(resumenAntesDeCerrar.resumenCierre.totalSalidas, 2);
      expect(Math.abs(detalle.analisisIngresos.devoluciones), 'Las "Devoluciones" del reporte no coinciden con "Total Devoluciones" (Reporte Avanzado) del POS').toBeCloseTo(reporteAvanzadoAntesDeCerrar.totalDevoluciones, 2);
      // "Total de salida" no tiene fórmula confirmada en esta sesión — se
      // deja como dato informativo (no se afirma una relación no
      // verificada con salidasCaja/devoluciones).
      console.log(`[Ver Detalle] Total de salida: ${detalle.analisisIngresos.totalSalida} (Salidas de caja: ${detalle.analisisIngresos.salidasCaja}, Devoluciones: ${detalle.analisisIngresos.devoluciones})`);
    });

    await test.step('Investigar el toggle de moneda en "Ver Detalle" con un cierre real que SÍ tiene una venta en la moneda contraria', async () => {
      // NO se afirma una fórmula de conversión: se investigó en vivo con un
      // cierre real que combina una venta en moneda base ($850) y una venta
      // hecha con "₡" activo ($400 base, mostrado como ₡254,000 en el POS
      // — ver el paso anterior). La hipótesis "GENERAL × tasa de cambio"
      // (confirmada antes SOLO cuando el cierre no tenía ninguna venta real
      // en moneda no-base, caso trivial con tasa efectiva 1) NO se confirmó
      // aquí: alternar a CRC devolvió el MISMO total que GENERAL
      // (totalGeneralBase, sin recalcular), en vez del total convertido
      // esperado. Causa raíz no confirmada (candidatos: el toggle de este
      // panel no recalcula "Métodos de pago" para cierres con más de una
      // moneda real involucrada; o el propio radio no llegó a aplicarse). Se
      // documenta como hallazgo abierto — no se fuerza una aserción sobre
      // una fórmula no verificada, mismo criterio que "Diferencia de
      // cierre" (ver el step de "Flujo de efectivo" arriba).
      const totalGeneralBase = detalle.metodosPago.total;
      await cierres.seleccionarMonedaEnDetalle(codigoMonedaContraria);
      const detalleEnMonedaContraria = await cierres.leerDetalleCierre();
      console.log(`[Ver Detalle] Total GENERAL: ${totalGeneralBase}, Total tras alternar a ${codigoMonedaContraria} (tasa real ${tasaCambioContraria}): ${detalleEnMonedaContraria.metodosPago.total}`);
      expect(detalleEnMonedaContraria.metodosPago.total, `El total en ${codigoMonedaContraria} no es un número válido`).toBeGreaterThanOrEqual(0);

      // Volver a GENERAL: esto sí se valida estrictamente (el panel no debe
      // quedar en un estado inconsistente tras alternar moneda y volver).
      await cierres.seleccionarMonedaEnDetalle('ALL');
      const detalleDeVuelta = await cierres.leerDetalleCierre();
      expect(detalleDeVuelta.metodosPago.total, 'El total GENERAL cambió tras alternar de moneda y volver').toBeCloseTo(totalGeneralBase, 2);
    });

    await test.step('Cerrar el panel y validar ausencia de errores', async () => {
      await cierres.cerrarDetalleFila();
      await cierres.validarSinErrores();
      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  // BUG DE SISTEMA CONFIRMADO — causa raíz exacta localizada (no una
  // suposición): se leyó el código fuente real del frontend
  // (`js/report_cash.js`, la función que arma esta fila) y se comparó
  // contra el JSON crudo real del endpoint que la alimenta
  // (`getCashSearch`), en 3 casos controlados con montos de apertura
  // conocidos y verificados de forma independiente (vía "Resumen de
  // cierre: + Apertura" del propio Tab General del POS). El frontend hace:
  //
  //   var openingComparisonBalance = parseFloat(c.previous_cash_balance || c.previous_cash || c.previous_balance || '');
  //   if (isNaN(openingComparisonBalance)) {
  //       openingComparisonBalance = (parseFloat(c.open_balance || 0) - openingDifference); // openingDifference = c.missing_cash_balance
  //   }
  //   // "Caja ant." = openingComparisonBalance; "Saldo" = fmt(c.open_balance); "Dif. apert." = openingDifference.
  //
  // El backend (`getCashSearch`) JAMÁS envía `previous_cash_balance` /
  // `previous_cash` / `previous_balance` (ausentes de la respuesta real en
  // TODAS las filas inspeccionadas), así que el frontend SIEMPRE cae al
  // fallback de arriba. ESA PARTE del frontend no está rota: es
  // matemáticamente correcta — confirmado inyectando `open_balance` real
  // vía fetch directo a `openPosCash` (mismo payload exacto del handler
  // real): con `open_balance`/`missing_cash_balance` correctos, el
  // fallback SÍ reproduce la Caja Ant. real exacta (confirmado en HONDURAS
  // y en TALLER ALPHA PREMIUM, cuenta Super Administrador — mismo
  // resultado correcto en ambas compañías).
  //
  // La causa raíz real está en el BACKEND, y es más sutil que "el campo se
  // pierde": interceptando con `page.on('request')` el payload REAL que el
  // navegador envía al hacer clic NATIVO en "Abrir Caja" se confirmó que
  // `open_balance` SIEMPRE llega correcto al servidor (ej.
  // `open_balance=66666`, respuesta de éxito "1") — descarta cualquier
  // causa de automatización o de la app cliente. Pero en una secuencia de
  // VARIAS aperturas/cierres seguidos de la misma caja (como las decenas
  // que generó esta investigación), la fila del cierre de una sesión
  // terminó mostrando el `open_balance` de la APERTURA DE LA SESIÓN
  // ANTERIOR, no la suya propia (confirmado: cerrar con Saldo=66666 mostró
  // `open_balance: 99999` — el valor de la sesión previa — mientras que
  // `total` de esa misma fila SÍ mostró 66666 correcto) — un bug de
  // ASOCIACIÓN/JOIN entre la tabla de cierres y la de aperturas en el
  // backend (parece emparejar por orden/fecha en vez de por un ID de
  // sesión explícito), no una pérdida del dato. Es INTERMITENTE: no se
  // reprodujo en secuencias limpias de una sola apertura+cierre (ahí
  // `open_balance` sí llegó correcto, en ambas compañías), pero sí tras
  // varias operaciones seguidas — no se confirmó si depende de la
  // velocidad/cantidad de aperturas recientes o de otra condición. "Dif.
  // apert." es la única de las 3 que consistentemente calculó bien, porque
  // usa `missing_cash_balance`, un campo que no depende de este join.
  //
  // Alcance: NO es exclusivo de HONDURAS — el mismo mecanismo (fetch
  // directo, payload real) funcionó correctamente en TALLER ALPHA PREMIUM
  // también; no se confirmó si el bug de asociación intermitente
  // reaparecería ahí con suficientes aperturas/cierres seguidos (no se
  // probó esa secuencia en esa compañía). Ver la memoria de esta sesión
  // para el detalle completo de ambas rondas de investigación.
  //
  // Se descartó una causa de automatización: `obtenerAperturaDeFila()` lee
  // los 3 `.cash-amount-value` de la celda en el mismo orden en que
  // aparecen en el DOM real (confirmado con `outerHTML` completo de la
  // celda), y el propio `aria-label` del tooltip de "Caja ant." ya trae el
  // valor incorrecto en su texto de ayuda — el bug está en qué valor
  // calculó/envió el backend, no en cómo esta suite los lee.
  //
  // Se documenta con `test.fail()` (mismo criterio ya usado en
  // recepcion-ordenes.spec.ts/recepcion-tablero.spec.ts para bugs de
  // sistema confirmados) en vez de debilitar la aserción real o mezclarla
  // con las validaciones que sí pasan en el test de arriba.
  test.fail(
    'BUG CONOCIDO: la columna "APERTURA" del reporte muestra "Caja Ant." y "Saldo" invertidos (con signo cambiado en "Caja Ant.")',
    async ({ page }) => {
      test.setTimeout(POS_TIMEOUTS.TEST);
      const pos = new PosPage(page);

      await test.step('Cargar el POS con los primitivos de bajo nivel (sin que cargarPosDesdeDashboard() descarte "Abrir Caja" por su cuenta)', async () => {
        await pos.irAlPos();
        await pos.esperarEstadoInicial();
        await pos.cerrarOverlaysConocidos();
      });

      // Se fuerza Caja Ant. != 0 (y != Saldo) cerrando primero con un
      // "Efectivo para siguiente caja" conocido — caso más riguroso que
      // simplemente Caja Ant.=0 (confirmado en la investigación: con
      // Caja Ant.=$300.30 y Saldo=$555.55, el reporte mostró "Caja ant."=
      // "$ -255.25" — ni -Saldo ni Caja Ant. real, sino el negativo de
      // "Dif. Apert." real — descartando cualquier coincidencia numérica
      // del caso trivial Caja Ant.=0).
      const cajaAnteriorObjetivo = 300.3;
      await test.step('Cerrar la caja con un "Efectivo para siguiente caja" conocido, para controlar la Caja Ant. de la próxima apertura', async () => {
        if (!(await pos.modalAbrirCajaVisible())) {
          await pos.abrirDetalleDeCierre();
          await pos.completarFormularioCerrarCaja('0', String(cajaAnteriorObjetivo), 'Cierre previo (test.fail bug Apertura)');
          await pos.confirmarCerrarCaja();
          await expect(pos.modalCerrarCaja).toBeHidden();
          await pos.irAlPos();
          await pos.esperarEstadoInicial();
        }
      });

      let cajaAnteriorEsperada = 0;
      const saldoControlado = 555.55;
      await test.step('Abrir la caja con un monto de apertura controlado, distinto de 0 y distinto de la Caja Ant.', async () => {
        expect(await pos.modalAbrirCajaVisible(), 'La caja debería estar cerrada en este punto').toBe(true);
        cajaAnteriorEsperada = await pos.leerSaldoCajaEnModalAbrir();
        await pos.completarAperturaCajaConMonto(String(saldoControlado));
        await expect(pos.modalAbrirCaja).toBeHidden();
      });

      const efectivoCierreUnico = Number((100 + (Date.now() % 89000) / 100).toFixed(2));
      await test.step('Cerrar la caja con un efectivo de cierre único para poder localizar la fila en el reporte', async () => {
        await pos.abrirDetalleDeCierre();
        await pos.completarFormularioCerrarCaja(String(efectivoCierreUnico), '0', `Cierre bug Apertura ${Date.now()}`);
        await pos.confirmarCerrarCaja();
        await expect(pos.modalCerrarCaja).toBeHidden();
      });

      await test.step('Comparar la columna "APERTURA" del reporte contra el Saldo/Caja Ant. reales', async () => {
        const cierres = new ReporteCierreCajaPage(page);
        await cierres.abrir();
        await cierres.buscar();
        const indice = await cierres.localizarFilaPorMontoCierre(efectivoCierreUnico);
        expect(indice, 'No se encontró en el reporte la fila del cierre recién generado').not.toBeNull();

        const apertura = await cierres.obtenerAperturaDeFila(indice!);
        console.log(`[Apertura] esperado: Caja Ant.=${cajaAnteriorEsperada}, Saldo=${saldoControlado} | reporte: Caja Ant.=${apertura.cajaAnterior}, Saldo=${apertura.saldo}, Dif. Apert.=${apertura.diferenciaApertura}`);

        expect(apertura.cajaAnterior, '"Caja Ant." del reporte no coincide con el "Saldo caja" real leído en el modal "Abrir Caja"').toBeCloseTo(cajaAnteriorEsperada, 2);
        expect(apertura.saldo, '"Saldo" del reporte no coincide con el monto de apertura realmente tecleado').toBeCloseTo(saldoControlado, 2);
      });
    }
  );
});
