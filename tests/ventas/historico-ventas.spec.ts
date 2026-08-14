import { test, expect, Page } from '@playwright/test';
import { HistoricoVentasPage, TIMEOUTS } from './historico-ventas.page';
import { PosPage, TIMEOUTS as POS_TIMEOUTS, espiarErroresJS } from '../facturar/pos/pos.page';

// Suite del submódulo "Histórico de Ventas" (Ventas → Histórico de Ventas).
// Investigación en vivo confirmó: filtros (método de pago, tipo de
// documento, estado electrónico, rango de fechas, 5 pills de estado),
// detalle de factura (cliente/fecha/forma de pago/resumen de totales/
// detalle de productos) y 2 acciones destructivas reales (Anular Factura,
// Aplicar Devolución) — cubiertas aquí. "Enviar email" y "Editar Venta"
// (esta última: formulario `edit_sale_*` confirmado en el DOM pero sin
// disparador localizado dentro del presupuesto de esta investigación) NO se
// automatizan — documentadas en el informe de la sesión, no inventadas.
//
// Fixture `page` estándar por test (no worker-compartida): igual que
// `pos-taller-historico-ventas.spec.ts`, cada escenario cruza módulos (POS
// para generar una factura real + Ventas para inspeccionarla), y el
// aislamiento por test pesa más que la amortización de una sola carga por
// worker (mismo criterio ya documentado ahí).

/** Crea una venta de contado en efectivo real desde POS, para escenarios que necesitan una factura propia y conocida. */
async function crearVentaDeContadoConocida(page: Page, monto: string): Promise<{ pos: PosPage; total: number }> {
  const pos = new PosPage(page);
  await pos.cargarPosDesdeDashboard();
  await pos.cerrarOverlaysConocidos();
  if (await pos.modalAbrirCajaVisible()) {
    await pos.completarAperturaCaja();
    await expect(pos.modalAbrirCaja).toBeHidden();
  }

  await pos.agregarProductoRapidoSimple(`Historico Ventas Spec ${Date.now()}`, monto);
  await pos.presionarFacturar();
  await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: POS_TIMEOUTS.PAYMENT_MODAL });
  await pos.cambiarTipoPagoEnModalPago('contado');
  await expect(page.locator('#payment_cash_total'), 'El campo de efectivo no quedó visible tras cambiar a "Contado"').toBeVisible({ timeout: POS_TIMEOUTS.PAYMENT_MODAL });
  const total = await pos.obtenerTotalVentaNumerico();
  expect(total).toBeGreaterThan(0);
  await pos.seleccionarPagoEfectivo(String(total));
  await pos.confirmarPagoAbriendoCajaSiEsNecesario();
  await pos.validarCarritoVacio();

  return { pos, total };
}

// ─── Consulta: listado, búsqueda y filtros ─────────────────────────────────

test('Cargar Histórico de Ventas y validar que el listado real carga', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const historico = new HistoricoVentasPage(page);

  await test.step('Navegar a Histórico de Ventas', async () => {
    await historico.irA();
  });

  await test.step('Validar que el listado muestra al menos una factura real', async () => {
    const cantidad = await historico.contarFacturasVisibles();
    expect(cantidad, 'El listado de Histórico de Ventas debería mostrar al menos 1 factura (ambiente compartido con datos reales)').toBeGreaterThan(0);
  });
});

test('Buscar una factura por número y abrir su detalle', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const historico = new HistoricoVentasPage(page);
  const erroresJS = espiarErroresJS(page);

  let numeroFactura = '';
  let totalEsperado = 0;
  await test.step('Crear una venta de contado propia y conocida', async () => {
    const resultado = await crearVentaDeContadoConocida(page, '321');
    totalEsperado = resultado.total;
  });

  await test.step('Localizar la factura recién creada (primera del listado) y leer su consecutivo', async () => {
    await historico.irA();
    const primeraTarjeta = page.locator('.receip-v2-sale-consecutive').first();
    const texto = await primeraTarjeta.textContent();
    numeroFactura = (texto ?? '').replace(/Consec\.\s*/i, '').trim();
    expect(numeroFactura.length, 'No se pudo leer el consecutivo de la factura recién creada').toBeGreaterThan(0);
  });

  await test.step('Buscar esa factura por su número y abrir el detalle', async () => {
    await historico.buscarEnHistoricoVentas(numeroFactura);
    await historico.abrirFacturaEnHistorico(numeroFactura);
    const formaDePago = await historico.leerFormaDePagoFacturaAbierta();
    expect(formaDePago.efectivoRecibido, 'La factura buscada no muestra el monto real en efectivo').toBeCloseTo(totalEsperado, 2);
  });

  expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
});

test('Filtrar por método de pago (Efectivo) y validar el primer resultado', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const historico = new HistoricoVentasPage(page);

  await test.step('Navegar y filtrar por método de pago "Efectivo"', async () => {
    await historico.irA();
    await historico.filtrarPorMetodoPago('Efectivo');
  });

  await test.step('Abrir la primera factura del resultado filtrado y validar que su método real es Efectivo', async () => {
    const cantidad = await historico.contarFacturasVisibles();
    expect(cantidad, 'El filtro "Efectivo" no devolvió ninguna factura').toBeGreaterThan(0);
    await historico.abrirPrimeraFacturaDelListado();
    const formaDePago = await historico.leerFormaDePagoFacturaAbierta();
    expect(formaDePago.efectivoRecibido, 'La primera factura del filtro "Efectivo" no muestra un monto real en efectivo').not.toBeNull();
    expect(formaDePago.tarjeta, 'La primera factura del filtro "Efectivo" no debería mostrar Tarjeta').toBeNull();
    expect(formaDePago.transaccion, 'La primera factura del filtro "Efectivo" no debería mostrar Transacción').toBeNull();
  });
});

test('Filtrar por tipo de documento "Facturas"', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const historico = new HistoricoVentasPage(page);

  await historico.irA();
  await historico.filtrarPorTipoDocumento('Facturas');
  const cantidad = await historico.contarFacturasVisibles();
  expect(cantidad, 'El filtro "Facturas" no devolvió ningún resultado').toBeGreaterThan(0);
});

for (const estado of ['contado', 'credito', 'anuladas'] as const) {
  test(`Filtrar por estado de factura: ${estado}`, async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const historico = new HistoricoVentasPage(page);

    await historico.irA();
    const antesDelFiltro = await historico.contarFacturasVisibles();
    await historico.filtrarPorEstado(estado);
    const despuesDelFiltro = await historico.contarFacturasVisibles();

    // No se asume un total absoluto (ambiente compartido sin limpieza) —
    // solo que el filtro realmente reduce o iguala el conjunto general
    // ("Todas"), nunca lo supera.
    expect(despuesDelFiltro, `El filtro "${estado}" mostró más facturas que sin filtrar (${despuesDelFiltro} > ${antesDelFiltro})`).toBeLessThanOrEqual(antesDelFiltro);
  });
}

test('Combinar filtro de estado (Contado) + rango de fechas', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const historico = new HistoricoVentasPage(page);

  await historico.irA();
  await historico.filtrarPorEstado('contado');
  const hoy = new Date().toISOString().slice(0, 10);
  await historico.filtrarPorRangoFechas(hoy, hoy);

  const cantidad = await historico.contarFacturasVisibles();
  expect(cantidad, 'La combinación de filtros (Contado + fecha de hoy) no devolvió ninguna factura — se esperaba al menos la actividad de esta suite en el día de hoy').toBeGreaterThan(0);
});

// ─── Detalle de factura ─────────────────────────────────────────────────────

test('Detalle de factura: validar cliente, forma de pago, resumen de totales y detalle de productos', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const historico = new HistoricoVentasPage(page);
  const erroresJS = espiarErroresJS(page);

  let total = 0;
  await test.step('Crear una venta de contado propia y conocida', async () => {
    const resultado = await crearVentaDeContadoConocida(page, '456');
    total = resultado.total;
  });

  await test.step('Abrir su detalle en Histórico de Ventas (la más reciente)', async () => {
    await historico.irA();
    await historico.abrirPrimeraFacturaDelListado();
  });

  await test.step('Validar Forma de pago y Resumen de totales contra el monto real facturado', async () => {
    const formaDePago = await historico.leerFormaDePagoFacturaAbierta();
    expect(formaDePago.estado, 'El estado de la factura no es "Procesado"').toMatch(/procesado/i);
    expect(formaDePago.efectivoRecibido, 'El efectivo recibido no coincide con el total facturado').toBeCloseTo(total, 2);

    const resumen = await historico.leerResumenTotalesFactura();
    expect(resumen.total, 'El TOTAL del resumen no coincide con el monto facturado').toBeCloseTo(total, 2);
    expect(resumen.subtotal, 'El Subtotal del resumen no coincide con el monto facturado (sin descuento ni impuestos en este escenario)').toBeCloseTo(total, 2);
  });

  await test.step('Expandir "Ver detalles" y validar que aparece al menos 1 línea de producto', async () => {
    await historico.expandirDetalleProductos();
    const lineas = await historico.contarLineasDetalleProductos();
    expect(lineas, 'El detalle de productos no muestra ninguna línea').toBeGreaterThan(0);
  });

  expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
});

// ─── Acciones destructivas: Anular Factura / Aplicar Devolución ────────────

test('Anular una factura de contado recién creada', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const historico = new HistoricoVentasPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Crear una venta de contado propia', async () => {
    await crearVentaDeContadoConocida(page, '111');
  });

  await test.step('Anularla desde Histórico de Ventas', async () => {
    await historico.irA();
    await historico.abrirPrimeraFacturaDelListado();
    await historico.anularFacturaAbierta();
  });

  await test.step('Validar que ahora aparece bajo el filtro "Anuladas"', async () => {
    await historico.irA();
    await historico.filtrarPorEstado('anuladas');
    const cantidad = await historico.contarFacturasVisibles();
    expect(cantidad, 'La factura recién anulada no aparece bajo el filtro "Anuladas"').toBeGreaterThan(0);
  });

  expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
});

test('Aplicar una devolución completa sobre una factura de contado recién creada', async ({ page, context }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const historico = new HistoricoVentasPage(page);
  const erroresJS = espiarErroresJS(page);

  let total = 0;
  await test.step('Crear una venta de contado propia y conocida', async () => {
    const resultado = await crearVentaDeContadoConocida(page, '222');
    total = resultado.total;
  });

  await test.step('Aplicar una devolución completa desde Histórico de Ventas', async () => {
    await historico.irA();
    await historico.abrirPrimeraFacturaDelListado();
    await historico.aplicarDevolucionCompleta(context, total);
  });

  expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
});
