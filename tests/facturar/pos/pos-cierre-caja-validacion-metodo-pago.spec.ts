import { test, expect } from '@playwright/test';
import { PosPage, TIMEOUTS, METODO, espiarErroresJS } from './pos.page';

// Suite dedicada a "Validación por método de pago" — sección real del modal
// "Detalle de Cierre" (`#container_payment_validation`), investigada en vivo
// leyendo el `js/pos.js` real de la app (código fuente fechado 18-08-2026,
// sin documentación previa en este repo — ver el comentario de cabecera de
// la sección homónima en `pos-cierre-caja.page.ts` para el mecanismo
// completo confirmado).
//
// AGNÓSTICA DE AMBIENTE: no fija BASE_URL/COMPANIA_POS propios — corre tal
// cual bajo cualquier `--project` (el original o
// `--project=setup-restaurant --project=firefox-restaurant`). Confirmada en
// vivo únicamente contra qa_restaurant en esta sesión; el propio contenedor
// puede no existir en otra compañía/ambiente — `validacionMetodoPagoExiste()`
// se comprueba SIEMPRE antes de operar sobre esta sección, y cada test la
// usa como guarda real (`test.skip` si no existe), nunca asumida.
//
// Mecánica real confirmada (ids 1=Efectivo/2=Tarjeta/4=SINPE ("check"
// internamente)/3=Transacción):
// - Efectivo SIEMPRE validado (switch deshabilitado) — su "Monto contado" es
//   un ESPEJO BIDIRECCIONAL del campo "Efectivo en caja" (`closure_posted_balance`).
// - Los otros 3 métodos nacen desactivados — su estado NO se resetea solo al
//   reabrir el modal (confirmado leyendo pos.js: `clear_modal_cash()` corre
//   una sola vez, al cargar la página, no en cada apertura del modal) — cada
//   test de esta suite deja known-state explícito al inicio, sin asumir el
//   estado dejado por un test anterior de la misma corrida.
// - "Monto sistema" es de solo lectura: Efectivo == "Datos de Cierre: Total"
//   (`resumenTabGeneral.datosCierre.total`); Tarjeta == "Consolidado
//   Tarjeta: Total" (`resumenTabGeneral.consolidadoTarjeta.total`) — AMBAS
//   igualdades confirmadas en vivo con precisión EXACTA (mismo valor, dos
//   vistas del mismo dato). SINPE/Transacción no tienen un equivalente ya
//   expuesto en otra parte del modal para cruzar 1:1 — se validan por DELTA
//   contra una venta propia y conocida.
// - Cerrar caja con un método validado sin "Monto contado" BLOQUEA el cierre
//   (toast de error, el modal nunca llega al SweetAlert de confirmación).
//   Diferencias (≠0) en métodos validados se listan como ADVERTENCIA en el
//   SweetAlert de confirmación, pero NO bloquean el cierre.
// - Esta información NO aparece reflejada en el Reporte de Cierres de Caja
//   (`js/report_cash.js` no tiene ninguna referencia a "payment_validation" —
//   confirmado leyendo el bundle real servido) — no se crea ninguna prueba
//   de cruce contra el reporte para esta sección específica porque el propio
//   reporte todavía no la expone.

/** Deja los 3 métodos no-Efectivo en un estado conocido (desactivados, sin monto) — Efectivo no se puede desactivar. */
async function resetearValidacionMetodoPago(pos: PosPage) {
  await pos.desactivarValidacionMetodo(2);
  await pos.desactivarValidacionMetodo(4);
  await pos.desactivarValidacionMetodo(3);
}

async function abrirCajaYDetalleDeCierre(pos: PosPage) {
  await pos.cargarPosDesdeDashboard();
  await pos.cerrarOverlaysConocidos();
  if (await pos.modalAbrirCajaVisible()) {
    await pos.completarAperturaCaja();
    await expect(pos.modalAbrirCaja).toBeHidden();
  }
  await pos.asegurarMonedaBaseActiva();
  await pos.abrirDetalleDeCierre();
}

test('La sección existe, expone los 4 métodos reales y Efectivo siempre queda activo (switch deshabilitado)', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  await abrirCajaYDetalleDeCierre(pos);

  const existe = await pos.validacionMetodoPagoExiste();
  test.skip(!existe, 'La sección "Validación por método de pago" no existe en este ambiente/compañía.');

  const todas = await pos.leerTodasLasValidacionesMetodoPago();
  expect(todas.efectivo.activo, 'Efectivo debería estar siempre activo').toBe(true);
  await expect(pos.modalCerrarCaja.locator('#pv_switch_1'), 'El switch de Efectivo debería estar deshabilitado (no se puede desactivar)').toBeDisabled();

  for (const m of [todas.efectivo, todas.tarjeta, todas.sinpe, todas.transaccion]) {
    expect(['PENDIENTE', 'CONFORME', 'CON DIFERENCIA'], `Estado de badge inesperado: "${m.estado}"`).toContain(m.estado);
    expect(m.montoSistema, 'El "Monto sistema" no es un número válido').toBeGreaterThanOrEqual(0);
  }
});

test('"Monto sistema" de Efectivo y Tarjeta coincide EXACTAMENTE con sus equivalentes ya expuestos en el propio modal', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  await abrirCajaYDetalleDeCierre(pos);
  const existe = await pos.validacionMetodoPagoExiste();
  test.skip(!existe, 'La sección "Validación por método de pago" no existe en este ambiente/compañía.');

  const resumen = await pos.leerResumenTabGeneral();
  const pv = await pos.leerTodasLasValidacionesMetodoPago();

  expect(pv.efectivo.montoSistema, '"Monto sistema" de Efectivo (Validación) ≠ "Datos de Cierre: Total"').toBeCloseTo(resumen.datosCierre.total, 2);
  expect(pv.tarjeta.montoSistema, '"Monto sistema" de Tarjeta (Validación) ≠ "Consolidado Tarjeta: Total"').toBeCloseTo(resumen.consolidadoTarjeta.total, 2);
});

test('"Monto sistema" de SINPE y Transacción refleja exactamente el DELTA de una venta propia y conocida en cada método', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const erroresJS = espiarErroresJS(page);
  await abrirCajaYDetalleDeCierre(pos);
  const existe = await pos.validacionMetodoPagoExiste();
  test.skip(!existe, 'La sección "Validación por método de pago" no existe en este ambiente/compañía.');

  const pvAntes = await pos.leerTodasLasValidacionesMetodoPago();
  await pos.cancelarModalCerrarCaja();

  // Se lee el TOTAL REAL mostrado en el modal de pago (nunca se asume que el
  // precio digitado en "Producto Rápido" es el total final): confirmado en
  // vivo que este ambiente aplica un impuesto adicional (~1%) incluso con
  // `activarIva=false`, delta real 784.77 contra un precio digitado de 777 —
  // mismo criterio ya establecido en el resto de esta suite
  // (`obtenerTotalVentaNumerico()` tras abrir el modal de pago, nunca el
  // precio de entrada).
  let totalRealSinpe = 0;
  await test.step('Venta con SINPE', async () => {
    await pos.agregarProductoRapidoParaValidacionIva(`QA PV SINPE ${Date.now()}`, '777', false);
    await pos.presionarFacturar();
    await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await pos.cambiarTipoPagoEnModalPago('contado');
    totalRealSinpe = await pos.obtenerTotalVentaNumerico();
    await pos.seleccionarPagoExacto(METODO.SINPE);
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  let totalRealTransaccion = 0;
  await test.step('Venta con Transacción', async () => {
    await pos.agregarProductoRapidoParaValidacionIva(`QA PV Transaccion ${Date.now()}`, '888', false);
    await pos.presionarFacturar();
    await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await pos.cambiarTipoPagoEnModalPago('contado');
    totalRealTransaccion = await pos.obtenerTotalVentaNumerico();
    await pos.seleccionarPagoExacto(METODO.TRANSACCION);
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  await pos.abrirDetalleDeCierre();
  const pvDespues = await pos.leerTodasLasValidacionesMetodoPago();

  expect(pvDespues.sinpe.montoSistema - pvAntes.sinpe.montoSistema, 'El DELTA de "Monto sistema" de SINPE no coincide con el total real de la venta').toBeCloseTo(totalRealSinpe, 1);
  expect(pvDespues.transaccion.montoSistema - pvAntes.transaccion.montoSistema, 'El DELTA de "Monto sistema" de Transacción no coincide con el total real de la venta').toBeCloseTo(totalRealTransaccion, 1);

  expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
});

test('Activar un método revela su formulario sin alterar "Monto sistema"; desactivarlo lo limpia y lo oculta', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  await abrirCajaYDetalleDeCierre(pos);
  const existe = await pos.validacionMetodoPagoExiste();
  test.skip(!existe, 'La sección "Validación por método de pago" no existe en este ambiente/compañía.');
  await resetearValidacionMetodoPago(pos);

  const antes = await pos.leerValidacionMetodo(4); // SINPE
  expect(antes.activo).toBe(false);
  await expect(pos.modalCerrarCaja.locator('#pv_body_4'), 'El cuerpo de la tarjeta debería estar oculto con el método inactivo').toHaveClass(/is-hidden/);
  await expect(pos.modalCerrarCaja.locator('#pv_hint_4'), 'El hint "Active la validación..." debería estar visible con el método inactivo').not.toHaveClass(/is-hidden/);

  await pos.activarValidacionMetodo(4);
  const activo = await pos.leerValidacionMetodo(4);
  expect(activo.activo).toBe(true);
  expect(activo.montoSistema, '"Monto sistema" no debería cambiar solo por activar la validación').toBeCloseTo(antes.montoSistema, 2);
  await expect(pos.modalCerrarCaja.locator('#pv_body_4'), 'El cuerpo de la tarjeta debería quedar visible con el método activo').not.toHaveClass(/is-hidden/);
  await expect(pos.modalCerrarCaja.locator('#pv_hint_4')).toHaveClass(/is-hidden/);

  await pos.establecerMontoContadoValidacion(4, '123.45');
  await pos.desactivarValidacionMetodo(4);
  const trasDesactivar = await pos.leerValidacionMetodo(4);
  expect(trasDesactivar.activo).toBe(false);
  expect(trasDesactivar.montoContado, 'El "Monto contado" debería limpiarse al desactivar la validación').toBeNull();
});

test('Monto contado = Monto sistema → estado CONFORME y diferencia exacta 0; monto distinto → CON DIFERENCIA con el signo correcto', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  await abrirCajaYDetalleDeCierre(pos);
  const existe = await pos.validacionMetodoPagoExiste();
  test.skip(!existe, 'La sección "Validación por método de pago" no existe en este ambiente/compañía.');
  await resetearValidacionMetodoPago(pos);

  // Se asegura una venta real con Tarjeta ANTES de esta prueba: el campo
  // "Monto contado" es un monto físico contado, no acepta negativos
  // (confirmado en vivo — la app lo sanea silenciosamente, sin signo). Con
  // "Monto sistema" en 0 (caja recién abierta, sin ventas propias de
  // Tarjeta todavía), "Monto sistema − 12.25" produciría un "Monto contado"
  // NEGATIVO real (−12.25), que el campo rechaza — no un bug de la
  // validación en sí, sino una entrada sin sentido de negocio (nadie cuenta
  // "-12.25" en caja). Esta venta garantiza margen suficiente para restar
  // sin cruzar 0.
  await pos.cancelarModalCerrarCaja();
  await pos.agregarProductoRapidoParaValidacionIva(`QA PV Tarjeta Margen ${Date.now()}`, '500', false);
  await pos.presionarFacturar();
  await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  await pos.cambiarTipoPagoEnModalPago('contado');
  await pos.seleccionarPagoExacto(METODO.TARJETA);
  await pos.confirmarPagoAbriendoCajaSiEsNecesario();
  await pos.validarCarritoVacio();
  await pos.abrirDetalleDeCierre();
  await resetearValidacionMetodoPago(pos);

  await pos.activarValidacionMetodo(2); // Tarjeta
  const { montoSistema } = await pos.leerValidacionMetodo(2);
  expect(montoSistema, 'La venta de margen no se reflejó en "Monto sistema" de Tarjeta').toBeGreaterThan(12.25);

  await test.step('Monto contado = Monto sistema → CONFORME, diferencia 0', async () => {
    await pos.establecerMontoContadoValidacion(2, montoSistema.toFixed(2));
    const resultado = await pos.leerValidacionMetodo(2);
    expect(resultado.estado).toBe('CONFORME');
    expect(resultado.diferencia).toBeCloseTo(0, 2);
  });

  await test.step('Monto contado > Monto sistema (sobrante) → CON DIFERENCIA, diferencia positiva exacta', async () => {
    const contado = montoSistema + 37.5;
    await pos.establecerMontoContadoValidacion(2, contado.toFixed(2));
    const resultado = await pos.leerValidacionMetodo(2);
    expect(resultado.estado).toBe('CON DIFERENCIA');
    expect(resultado.diferencia, 'Diferencia (sobrante) ≠ Monto contado − Monto sistema').toBeCloseTo(37.5, 2);
  });

  await test.step('Monto contado < Monto sistema (faltante) → CON DIFERENCIA, diferencia negativa exacta', async () => {
    const contado = montoSistema - 12.25;
    await pos.establecerMontoContadoValidacion(2, contado.toFixed(2));
    const resultado = await pos.leerValidacionMetodo(2);
    expect(resultado.estado).toBe('CON DIFERENCIA');
    expect(resultado.diferencia, 'Diferencia (faltante) ≠ Monto contado − Monto sistema').toBeCloseTo(-12.25, 2);
  });
});

test('"Validar todos" activa los 4 métodos simultáneamente sin alterar ningún "Monto sistema"', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  await abrirCajaYDetalleDeCierre(pos);
  const existe = await pos.validacionMetodoPagoExiste();
  test.skip(!existe, 'La sección "Validación por método de pago" no existe en este ambiente/compañía.');
  await resetearValidacionMetodoPago(pos);

  const antes = await pos.leerTodasLasValidacionesMetodoPago();
  await pos.activarValidarTodosLosMetodos();
  const despues = await pos.leerTodasLasValidacionesMetodoPago();

  for (const metodo of ['efectivo', 'tarjeta', 'sinpe', 'transaccion'] as const) {
    expect(despues[metodo].activo, `"${metodo}" debería quedar activo tras "Validar todos"`).toBe(true);
    expect(despues[metodo].montoSistema, `"Monto sistema" de "${metodo}" cambió solo por activar la validación`).toBeCloseTo(antes[metodo].montoSistema, 2);
  }
});

test('Efectivo es un espejo BIDIRECCIONAL de "Efectivo en caja": llenar cualquiera de los dos sincroniza el otro', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  await abrirCajaYDetalleDeCierre(pos);
  const existe = await pos.validacionMetodoPagoExiste();
  test.skip(!existe, 'La sección "Validación por método de pago" no existe en este ambiente/compañía.');

  await test.step('Llenar "Efectivo en caja" sincroniza "Monto contado" de Efectivo', async () => {
    await pos.completarFormularioCerrarCaja('456.78', '0', 'QA espejo efectivo A');
    const efectivo = await pos.leerValidacionMetodo(1);
    expect(efectivo.montoContado, 'El "Monto contado" de Efectivo no se sincronizó desde "Efectivo en caja"').toBeCloseTo(456.78, 2);
  });

  await test.step('Llenar el "Monto contado" de Efectivo sincroniza "Efectivo en caja"', async () => {
    await pos.establecerMontoContadoValidacion(1, '999.11');
    const valorCampoBase = await pos.modalCerrarCaja.locator('#closure_posted_balance').inputValue();
    expect(parseFloat(valorCampoBase), '"Efectivo en caja" no se sincronizó desde el "Monto contado" de Efectivo').toBeCloseTo(999.11, 2);
  });
});

test('Cerrar caja con un método validado SIN monto contado BLOQUEA el cierre (no navega, no confirma)', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  await abrirCajaYDetalleDeCierre(pos);
  const existe = await pos.validacionMetodoPagoExiste();
  test.skip(!existe, 'La sección "Validación por método de pago" no existe en este ambiente/compañía.');
  await resetearValidacionMetodoPago(pos);

  await pos.completarFormularioCerrarCaja('50', '0', 'QA bloqueo validacion sin monto');
  await pos.activarValidacionMetodo(4); // SINPE activo, sin "Monto contado"

  await pos.presionarBotonCerrarCaja();

  await expect(pos.modalCerrarCaja, 'El modal de cierre no debería cerrarse cuando un método validado no tiene monto contado').toBeVisible();
  await expect(page.locator('.sweet-alert.visible'), 'El SweetAlert de confirmación NO debería aparecer cuando el cierre está bloqueado').toBeHidden();
  await expect(pos.modalCerrarCaja.locator('#pv_counted_4'), 'El campo de SINPE debería marcarse con error').toHaveClass(/error/);

  // Limpieza: dejar el modal en un estado que no bloquee futuros cierres de otros escenarios de esta suite.
  await pos.desactivarValidacionMetodo(4);
});

test('Cerrar caja con una diferencia real en un método validado SÍ permite cerrar, advirtiendo la diferencia en el SweetAlert', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const erroresJS = espiarErroresJS(page);
  await abrirCajaYDetalleDeCierre(pos);
  const existe = await pos.validacionMetodoPagoExiste();
  test.skip(!existe, 'La sección "Validación por método de pago" no existe en este ambiente/compañía.');
  await resetearValidacionMetodoPago(pos);

  await pos.completarFormularioCerrarCaja('10', '0', `QA diferencia advertida ${Date.now()}`);
  await pos.activarValidacionMetodo(2); // Tarjeta
  const { montoSistema } = await pos.leerValidacionMetodo(2);
  const diferenciaEsperada = -25;
  await pos.establecerMontoContadoValidacion(2, (montoSistema + diferenciaEsperada).toFixed(2));

  await pos.presionarBotonCerrarCaja();
  const mensaje = await pos.leerMensajeConfirmacionCerrarCaja();
  expect(mensaje, 'El SweetAlert de confirmación no menciona "Tarjeta" pese a la diferencia real').toMatch(/Tarjeta/i);
  expect(mensaje, 'El SweetAlert de confirmación no muestra el monto de la diferencia real').toMatch(/25/);

  await pos.confirmarSweetAlertDeCierre();
  await expect(pos.modalCerrarCaja, 'El cierre debería completarse pese a la diferencia (solo advierte, no bloquea)').toBeHidden();

  expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
});
