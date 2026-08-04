import { test, expect, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, PESTANA_POS_FACTURACION, espiarErroresJS } from './pos.page';
import { PosTaller } from './pos-taller.page';
import { VentasPage } from '../../ventas/ventas.page';

// Fixture `page` estándar por test (no worker-compartida): mismo criterio ya
// usado en pos-cierre-caja.spec.ts para varios de sus escenarios — con solo
// 2 tests en este archivo, la amortización de cargar el POS una vez por
// worker no compensa la fragilidad extra observada en vivo al reutilizar la
// misma sesión/página entre tests con este flujo puntual (facturar una
// Orden de Taller real y verificar su vínculo cruzando a otro módulo,
// Ventas → Histórico de Ventas).

/**
 * Carga una Orden de Taller al carrito y presiona "Facturar". Confirmado en
 * vivo que, bajo carga del ambiente compartido, el modal de pago
 * (`#dialog_payment`) puede tardar más de los 15s de `TIMEOUTS.PAYMENT_MODAL`
 * en completar su transición a visible (Bootstrap modal fade) — se usa
 * `TIMEOUTS.NAVIGATE` (más holgado) para esta espera puntual.
 */
async function cargarOrdenYPresionarFacturar(pos: PosPage, taller: PosTaller, page: Page, id: string) {
  await taller.facturarOrdenPOS(id);
  await pos.presionarFacturar();
  await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.NAVIGATE });
}

// ═══════════════════════════════════════════════════════════════════════════
// Relación Orden de Taller <-> Factura (validada contra Histórico de Ventas)
// ═══════════════════════════════════════════════════════════════════════════
//
// Investigación real (ver informe de la sesión): el módulo "Ventas →
// Histórico de Ventas" (`/receip/printPosReceip`) es la fuente de verdad
// pedida por el negocio para esta relación — su propio panel de detalle de
// factura muestra un campo real "Número Orden de Reparación"
// (`VentasPage.leerDetalleFacturaAbierta()`, confirmado en vivo con su HTML
// real: `.receip-v2-order-item` > `.order-label`/`.order-value`).
//
// Confirmado en vivo, comparando los flujos reales de facturación de
// Órdenes de Taller disponibles en el POS:
//   1. "Facturar Orden POS" (una sola orden) + Contado/Efectivo -> el campo
//      muestra el consecutivo real de la orden. Funciona correctamente.
//   2. "Facturar Orden POS" (una sola orden) + Crédito/Tarjeta/con
//      Descuento General/con una orden recién creada desde cero -> igual,
//      el campo muestra el consecutivo real en todos los casos (confirmado
//      aparte en esta misma sesión de investigación, ver el informe).
//   3. "Facturar Seleccionadas" (Facturación Masiva, 2+ órdenes combinadas
//      en una sola factura) -> el campo queda vacío ("—") y la factura cae
//      en "Ventas directas" del modal "Detalle de Cierre" de Caja en vez de
//      en "Órdenes". ACLARACIÓN EXPLÍCITA DE NEGOCIO: este comportamiento
//      NO es un bug — es esperado. Facturación Masiva consolida varias
//      órdenes en una sola factura, así que, funcionalmente, esa factura no
//      debe (ni puede, de forma no ambigua) quedar relacionada
//      individualmente con una única Orden de Taller. El segundo test de
//      este archivo documenta esto como comportamiento esperado (no falla),
//      para dejar registrada la diferencia real de comportamiento frente al
//      caso de una sola orden sin reportarlo como defecto.
//
// El primer test es la regresión del caso normal que SÍ debe preservar el
// vínculo (red de seguridad). El segundo es documentación ejecutable del
// comportamiento esperado de Facturación Masiva (consolidación), no una
// prueba de regresión de un bug.

test('Facturar Orden POS (una sola orden, Contado) SÍ queda vinculada en Histórico de Ventas', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
  const pos = new PosPage(page);
  const taller = new PosTaller(pos, page);
  const ventas = new VentasPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    if (await pos.modalAbrirCajaVisible()) {
      await pos.completarAperturaCaja();
      await expect(pos.modalAbrirCaja).toBeHidden();
    }
  });

  let facturasAntes: Awaited<ReturnType<PosPage['leerFacturasContadoOrdenes']>> = [];
  await test.step('Leer Fact. Contado (Órdenes) ANTES', async () => {
    await pos.abrirDetalleDeCierre();
    facturasAntes = await pos.leerFacturasContadoOrdenes();
    await pos.cancelarModalCerrarCaja();
  });

  let consecutivoOrden = '';
  let totalOrden = 0;
  await test.step('Facturar una Orden de Taller real de contado en efectivo', async () => {
    await taller.abrirListadoTaller();
    const [id] = await taller.obtenerIdsOrdenesConMontoValido(1);
    expect(id, 'No se encontró ninguna Orden de Taller con monto real').toBeTruthy();
    const datos = await taller.obtenerDatosTarjeta(id);
    consecutivoOrden = datos.consecutivo;

    // Manual (no abrirModalDePago()): una Orden de Taller real puede
    // heredar tipo de pago Crédito y dejar el campo de efectivo oculto -
    // mismo criterio ya documentado en pos-cierre-caja.spec.ts.
    await cargarOrdenYPresionarFacturar(pos, taller, page, id);
    await pos.cambiarTipoPagoEnModalPago('contado');
    await expect(page.locator('#payment_cash_total'), 'El campo de efectivo no quedó visible tras cambiar a Contado').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    totalOrden = await pos.obtenerTotalVentaNumerico();
    expect(totalOrden).toBeGreaterThan(0);
    await pos.seleccionarPagoEfectivo(String(totalOrden));
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  let numeroFacturaGenerada = '';
  await test.step('Identificar la factura nueva en "Tab Facturas > Órdenes" de Cierre de Caja', async () => {
    await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);
    await pos.abrirDetalleDeCierre();
    const facturasDespues = await pos.leerFacturasContadoOrdenes();
    const numerosAntes = facturasAntes.map((f) => f.numeroFactura);
    const nuevas = facturasDespues.filter((f) => !numerosAntes.includes(f.numeroFactura));
    expect(nuevas.length, 'Debe aparecer exactamente 1 factura nueva en la tabla de Órdenes de Cierre de Caja').toBe(1);
    numeroFacturaGenerada = nuevas[0].numeroFactura;
    expect(nuevas[0].numeroOrden, 'Cierre de Caja debe mostrar el "N orden" real').toBe(consecutivoOrden);
    await pos.cancelarModalCerrarCaja();
  });

  await test.step('Validar en Histórico de Ventas que "Número Orden de Reparación" muestra la orden real', async () => {
    await ventas.buscarEnHistoricoVentas(numeroFacturaGenerada);
    await ventas.abrirFacturaEnHistorico(numeroFacturaGenerada);
    const detalle = await ventas.leerDetalleFacturaAbierta();
    expect(detalle.numeroOrdenReparacion, 'Histórico de Ventas debe mostrar el número de la Orden de Taller de origen').toBe(consecutivoOrden);
  });

  expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
});


test('Facturación Masiva (varias Órdenes de Taller -> 1 factura) NO queda relacionada individualmente - comportamiento esperado', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
  const pos = new PosPage(page);
  const taller = new PosTaller(pos, page);
  const ventas = new VentasPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    if (await pos.modalAbrirCajaVisible()) {
      await pos.completarAperturaCaja();
      await expect(pos.modalAbrirCaja).toBeHidden();
    }
  });

  let facturasOrdenesAntes: Awaited<ReturnType<PosPage['leerFacturasContadoOrdenes']>> = [];
  let facturasDirectasAntes: Awaited<ReturnType<PosPage['leerFacturasContadoDirectas']>> = [];
  await test.step('Leer Fact. Contado (Órdenes + Directas) ANTES', async () => {
    await pos.abrirDetalleDeCierre();
    facturasOrdenesAntes = await pos.leerFacturasContadoOrdenes();
    facturasDirectasAntes = await pos.leerFacturasContadoDirectas();
    await pos.cancelarModalCerrarCaja();
  });

  let consecutivosOrigen: string[] = [];
  let totalCombinado = 0;
  await test.step('Seleccionar 2 Órdenes de Taller reales y facturarlas vía "Facturar Seleccionadas" (Facturación Masiva)', async () => {
    await taller.abrirListadoTaller();
    const ids = await taller.obtenerIdsOrdenesConMontoValido(2);
    expect(ids.length, 'Se necesitan al menos 2 Órdenes de Taller con monto real').toBeGreaterThanOrEqual(2);
    for (const id of ids) {
      const datos = await taller.obtenerDatosTarjeta(id);
      consecutivosOrigen.push(datos.consecutivo);
    }

    await taller.entrarModoSeleccionMasiva();
    for (const id of ids) await taller.marcarOrdenParaSeleccionMasiva(id);

    const resultado = await taller.facturarSeleccionadas();
    expect(resultado.errores, 'Ninguna orden debe fallar dentro de la Facturación Masiva').toBe(0);
    expect(resultado.procesadas, 'Todas las órdenes seleccionadas deben quedar cargadas en el carrito').toBe(ids.length);

    await pos.abrirModalDePago();
    totalCombinado = await pos.obtenerTotalVentaNumerico();
    expect(totalCombinado).toBeGreaterThan(0);
    await pos.seleccionarPagoEfectivo(String(totalCombinado));
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  let numeroFacturaGenerada = '';
  let categorizadaComoOrden = false;
  await test.step('Identificar la factura combinada nueva en Cierre de Caja', async () => {
    await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);
    await pos.abrirDetalleDeCierre();

    const facturasOrdenesDespues = await pos.leerFacturasContadoOrdenes();
    const numerosOrdenesAntes = facturasOrdenesAntes.map((f) => f.numeroFactura);
    const nuevasEnOrdenes = facturasOrdenesDespues.filter((f) => !numerosOrdenesAntes.includes(f.numeroFactura));

    const facturasDirectasDespues = await pos.leerFacturasContadoDirectas();
    const numerosDirectasAntes = facturasDirectasAntes.map((f) => f.numeroFactura);
    const nuevasEnDirectas = facturasDirectasDespues.filter((f) => !numerosDirectasAntes.includes(f.numeroFactura));

    if (nuevasEnOrdenes.length >= 1) {
      numeroFacturaGenerada = nuevasEnOrdenes[0].numeroFactura;
      categorizadaComoOrden = true;
    } else if (nuevasEnDirectas.length >= 1) {
      numeroFacturaGenerada = nuevasEnDirectas[0].numeroFactura;
      categorizadaComoOrden = false;
    }
    expect(numeroFacturaGenerada, 'No se identificó la factura nueva generada por Facturación Masiva').toBeTruthy();

    console.log(`[Facturación Masiva] Órdenes de origen: ${consecutivosOrigen.join(', ')} | Factura generada: ${numeroFacturaGenerada} | ¿Categorizada como "Orden" en Cierre de Caja?: ${categorizadaComoOrden}`);
    await pos.cancelarModalCerrarCaja();
  });

  await test.step('Documentar el comportamiento esperado: Histórico de Ventas no muestra una Orden de Taller individual para la factura combinada', async () => {
    await ventas.buscarEnHistoricoVentas(numeroFacturaGenerada);
    await ventas.abrirFacturaEnHistorico(numeroFacturaGenerada);
    const detalle = await ventas.leerDetalleFacturaAbierta();
    console.log(`[Facturación Masiva] "Número Orden de Reparación" mostrado: "${detalle.numeroOrdenReparacion}" (órdenes de origen consolidadas: ${consecutivosOrigen.join(', ')})`);

    // Comportamiento ESPERADO por negocio (aclarado explícitamente): al
    // consolidar 2+ Órdenes de Taller en una sola factura, esa factura no
    // debe quedar relacionada individualmente con una única orden - ni el
    // campo "Número Orden de Reparación" de Histórico de Ventas ni la
    // categorización en Cierre de Caja ("Órdenes" vs. "Ventas directas")
    // identifican una orden específica, y eso es correcto. Esta prueba
    // documenta ese comportamiento (no lo reporta como bug): confirma que
    // el campo queda vacío y deja registrada la categorización real que
    // tomó Cierre de Caja, como referencia para quien lea este test.
    expect(detalle.numeroOrdenReparacion, 'Comportamiento esperado: Facturación Masiva no debe mostrar una única Orden de Taller en Histórico de Ventas').toBe('—');
    console.log(`[Facturación Masiva] Categorización en Cierre de Caja: ${categorizadaComoOrden ? '"Órdenes"' : '"Ventas directas"'} (informativo, no se valida como error)`);
  });

  expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
});
