import { test, expect, Page } from '@playwright/test';
import {
  PosPage, TIMEOUTS, espiarErroresJS, METODO,
  FilaFacturaVenta,
} from './pos.page';
import { HistoricoVentasPage, FormaDePagoFacturaHistorico } from '../../ventas/historico-ventas.page';

// ═══════════════════════════════════════════════════════════════════════════
// INVESTIGACIÓN: trazabilidad del método de pago en facturas de CONTADO
// (POS → Facturar directo, POS → Órdenes de Caja).
//
// Objetivo (pedido explícito del usuario): confirmar, para cada método de
// pago real disponible en este ambiente (Efectivo/Tarjeta/SINPE/Transacción/
// Mixto), que el método SELECCIONADO en la UI del modal de pago == el método
// que queda registrado en Cierre de Caja → Tab Facturas (columna "Tipo
// Pago") == el método que muestra Histórico de Ventas → detalle de factura
// ("Forma de pago"). Los 3 puntos de esa cadena ya existen como
// infraestructura reutilizable en el repo (PosCierreCaja.leerFacturas*(),
// HistoricoVentasPage.leerFormaDePagoFacturaAbierta()) pero, confirmado revisando
// pos-cierre-caja.spec.ts/pos-orden-caja.spec.ts antes de escribir esto, NUNCA
// se habían cruzado los 3 juntos para la MISMA factura, y Órdenes de Caja
// nunca se había facturado con otro método que Efectivo — ver el informe de
// esta investigación para el detalle completo de la brecha real encontrada.
//
// No es un archivo de exploración descartable: cada escenario es una
// aserción real y reproducible (mismo criterio que el resto de la suite
// permanente) — se mantiene como cobertura de regresión de esta
// trazabilidad si todos los escenarios quedan en verde.
// ═══════════════════════════════════════════════════════════════════════════

type EscenarioPago = {
  nombre: string;
  metodoEsperadoRegex: RegExp;
  aplicar: (pos: PosPage, page: Page, total: number) => Promise<void>;
  /** Métodos con monto>0 que deben aparecer en la sección "Forma de pago" de Histórico. */
  camposHistoricoEsperados: (keyof FormaDePagoFacturaHistorico)[];
};

const ESCENARIOS_UN_SOLO_METODO: EscenarioPago[] = [
  {
    nombre: 'Efectivo (monto exacto)',
    metodoEsperadoRegex: /efectivo/i,
    aplicar: async (pos, _page, total) => { await pos.seleccionarPagoEfectivo(String(total)); },
    camposHistoricoEsperados: ['efectivoRecibido'],
  },
  {
    nombre: 'Tarjeta',
    metodoEsperadoRegex: /tarjeta/i,
    aplicar: async (pos) => { await pos.seleccionarPagoExacto(METODO.TARJETA); },
    camposHistoricoEsperados: ['tarjeta'],
  },
  {
    nombre: 'SINPE',
    metodoEsperadoRegex: /sinpe/i,
    aplicar: async (pos) => { await pos.seleccionarPagoExacto(METODO.SINPE); },
    camposHistoricoEsperados: ['sinpe'],
  },
  {
    nombre: 'Transacción',
    metodoEsperadoRegex: /transacci[oó]n/i,
    aplicar: async (pos) => { await pos.seleccionarPagoExacto(METODO.TRANSACCION); },
    camposHistoricoEsperados: ['transaccion'],
  },
];

/** Fila de la matriz final — impresa por consola para armar el informe (ver el objetivo del archivo). */
type FilaMatriz = {
  flujo: string;
  metodo: string;
  numeroFactura: string;
  montoEsperado: number;
  tipoPagoCierre: string;
  montoCierre: number;
  formaDePagoHistorico: FormaDePagoFacturaHistorico;
  consistente: boolean;
  notas: string;
};

function logFilaMatriz(fila: FilaMatriz) {
  console.log(`[TRAZABILIDAD] ${JSON.stringify(fila)}`);
}

/**
 * Diferencia FilaFacturaVenta[] antes/después por numeroFactura y devuelve la
 * (única) fila nueva — mismo criterio de "delta, nunca total absoluto" que
 * pos-cierre-caja.spec.ts, necesario porque el ambiente de QA es compartido
 * y sin limpieza (ver CLAUDE.md).
 */
function facturaNueva(antes: FilaFacturaVenta[], despues: FilaFacturaVenta[]): FilaFacturaVenta {
  const numerosAntes = antes.map((f) => f.numeroFactura);
  const nuevas = despues.filter((f) => !numerosAntes.includes(f.numeroFactura));
  expect(nuevas.length, `Debe aparecer exactamente 1 factura nueva (aparecieron ${nuevas.length})`).toBe(1);
  return nuevas[0];
}

/**
 * Núcleo común a Facturar directo y Órdenes de Caja: a partir del carrito YA
 * PREPARADO (línea(s) cargadas, listo para presionar "Facturar"), aplica el
 * escenario de pago indicado y valida los 3 puntos de la cadena de
 * trazabilidad. `leerTablaFn` es leerFacturasContadoDirectas() o
 * leerFacturasContadoOrdenes() según el flujo — inyectado para no duplicar
 * este núcleo dos veces.
 */
async function ejecutarYValidarTrazabilidad(
  pos: PosPage,
  page: Page,
  ventas: HistoricoVentasPage,
  flujo: string,
  escenario: EscenarioPago,
  leerTablaFn: () => Promise<FilaFacturaVenta[]>,
): Promise<FilaMatriz> {
  const antes = await runDentroDeCierre(pos, leerTablaFn);

  await pos.presionarFacturar();
  await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  await pos.cambiarTipoPagoEnModalPago('contado');
  await expect(page.locator('#payment_cash_total'), 'El campo de efectivo no quedó visible tras cambiar a "Contado"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

  const total = await pos.obtenerTotalVentaNumerico();
  expect(total, 'El total de la venta debe ser mayor a 0').toBeGreaterThan(0);

  await escenario.aplicar(pos, page, total);
  await pos.confirmarPagoAbriendoCajaSiEsNecesario();
  await pos.validarCarritoVacio();

  const despues = await runDentroDeCierre(pos, leerTablaFn);
  const nueva = facturaNueva(antes, despues);

  const notas: string[] = [];

  const tipoPagoOk = escenario.metodoEsperadoRegex.test(nueva.tipoPago);
  if (!tipoPagoOk) notas.push(`Cierre de Caja muestra Tipo Pago="${nueva.tipoPago}", esperado ~/${escenario.metodoEsperadoRegex.source}/`);

  const montoCierreOk = Math.abs(nueva.monto - total) < 0.02;
  if (!montoCierreOk) notas.push(`Cierre de Caja muestra monto=${nueva.monto}, esperado ${total}`);

  await ventas.buscarEnHistoricoVentas(nueva.numeroFactura);
  await ventas.abrirFacturaEnHistorico(nueva.numeroFactura);
  const formaDePago = await ventas.leerFormaDePagoFacturaAbierta();

  for (const campo of escenario.camposHistoricoEsperados) {
    const valor = formaDePago[campo] as number | null;
    if (valor === null) {
      notas.push(`Histórico NO muestra ningún monto para "${campo}" (esperado ${total})`);
    } else if (Math.abs(valor - total) >= 0.02) {
      notas.push(`Histórico muestra "${campo}"=${valor}, esperado ${total}`);
    }
  }
  // Ningún OTRO método (de los 4 posibles) debería aparecer con monto > 0 —
  // detecta el patrón exacto reportado por el usuario ("se factura en un
  // método pero queda registrado en otro").
  const TODOS_LOS_CAMPOS: (keyof FormaDePagoFacturaHistorico)[] = ['efectivoRecibido', 'tarjeta', 'sinpe', 'transaccion'];
  for (const campo of TODOS_LOS_CAMPOS) {
    if (escenario.camposHistoricoEsperados.includes(campo)) continue;
    const valor = formaDePago[campo] as number | null;
    if (valor !== null && valor > 0.01) {
      notas.push(`Histórico muestra un monto INESPERADO en "${campo}"=${valor} (método no seleccionado)`);
    }
  }

  const fila: FilaMatriz = {
    flujo,
    metodo: escenario.nombre,
    numeroFactura: nueva.numeroFactura,
    montoEsperado: total,
    tipoPagoCierre: nueva.tipoPago,
    montoCierre: nueva.monto,
    formaDePagoHistorico: formaDePago,
    consistente: notas.length === 0,
    notas: notas.join(' | '),
  };
  logFilaMatriz(fila);
  return fila;
}

/** Abre "Detalle de Cierre", ejecuta `fn` (una lectura) y cancela el modal sin cerrar la caja. */
async function runDentroDeCierre<T>(pos: PosPage, fn: () => Promise<T>): Promise<T> {
  await pos.abrirDetalleDeCierre();
  const resultado = await fn();
  await pos.cancelarModalCerrarCaja();
  return resultado;
}

async function asegurarCajaAbierta(pos: PosPage) {
  await pos.cargarPosDesdeDashboard();
  await pos.cerrarOverlaysConocidos();
  if (await pos.modalAbrirCajaVisible()) {
    await pos.completarAperturaCaja();
    await expect(pos.modalAbrirCaja).toBeHidden();
  }
}

/**
 * Crea una Orden de Caja de CONTADO con un producto de precio conocido y un
 * nombre de cliente ÚNICO (texto libre, ver ingresarNombreCliente()) —
 * necesario para poder localizarla después entre las decenas de Órdenes de
 * Caja ya acumuladas por otras corridas en este ambiente compartido (ver
 * CLAUDE.md). Deja el carrito vacío al terminar (validarOrdenCajaCreada() ya
 * lo confirma).
 */
async function crearOrdenDeCajaLocalizable(pos: PosPage, precio: string): Promise<string> {
  const sufijo = Date.now();
  const nombreCliente = `QA Trazabilidad Pago ${sufijo}`;
  await pos.agregarProductoRapidoSimple(`Trazabilidad Pago ${sufijo}`, precio);
  await pos.ingresarNombreCliente(nombreCliente);
  await pos.abrirMenuOrdenCaja();
  await pos.seleccionarTipoPagoOrdenCaja('contado');
  await pos.llenarObservacionesOrdenCaja(`Investigacion trazabilidad metodo de pago - ${sufijo}`);
  const respuesta = await pos.enviarOrdenCaja();
  await pos.validarOrdenCajaCreada(respuesta);
  return nombreCliente;
}

/** Localiza y carga al carrito la Orden de Caja recién creada, por su nombre de cliente único. */
async function cargarOrdenDeCajaPorCliente(pos: PosPage, nombreCliente: string) {
  await pos.abrirOrdenesCaja();
  await pos.buscarOrdenesCajaPorTexto(nombreCliente);
  await pos.cargarPrimeraOrdenCajaDisponible();
}

// ─── Facturar directo: un solo método (Efectivo/Tarjeta/SINPE/Transacción) ──

for (const escenario of ESCENARIOS_UN_SOLO_METODO) {
  test(`Facturar directo — trazabilidad completa con ${escenario.nombre}`, async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const ventas = new HistoricoVentasPage(page);
    const erroresJS = espiarErroresJS(page);

    await test.step('Cargar el POS y asegurar caja abierta', async () => {
      await asegurarCajaAbierta(pos);
    });

    let fila: FilaMatriz;
    await test.step(`Facturar un producto rápido de contado con ${escenario.nombre} y validar UI -> Cierre de Caja -> Histórico`, async () => {
      await pos.agregarProductoRapidoSimple(`Facturar ${escenario.nombre} ${Date.now()}`, '1000');
      fila = await ejecutarYValidarTrazabilidad(
        pos, page, ventas, 'Facturar directo', escenario,
        () => pos.leerFacturasContadoDirectas(),
      );
    });

    await test.step('Validar consistencia y ausencia de errores', async () => {
      expect(fila!.notas, `Inconsistencia de trazabilidad detectada: ${fila!.notas}`).toBe('');
      await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });
}


// ─── Órdenes de Caja: un solo método (Efectivo/Tarjeta/SINPE/Transacción) ───
// GAP DE COBERTURA REAL confirmado antes de escribir este archivo: revisando
// pos-orden-caja.spec.ts (35 escenarios), TODOS facturan la Orden de Caja con
// seleccionarPagoEfectivo() — ninguno prueba Tarjeta/SINPE/Transacción/Mixto
// en este flujo. Estos 4 escenarios cierran esa brecha.

for (const escenario of ESCENARIOS_UN_SOLO_METODO) {
  test(`Órdenes de Caja — trazabilidad completa con ${escenario.nombre}`, async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const ventas = new HistoricoVentasPage(page);
    const erroresJS = espiarErroresJS(page);

    await test.step('Cargar el POS y asegurar caja abierta', async () => {
      await asegurarCajaAbierta(pos);
    });

    let nombreCliente = '';
    await test.step('Crear una Orden de Caja de contado, localizable por nombre de cliente único', async () => {
      nombreCliente = await crearOrdenDeCajaLocalizable(pos, '1100');
    });

    await test.step('Localizar esa Orden de Caja y cargarla al carrito', async () => {
      await cargarOrdenDeCajaPorCliente(pos, nombreCliente);
    });

    let fila: FilaMatriz;
    await test.step(`Facturar la Orden de Caja con ${escenario.nombre} y validar UI -> Cierre de Caja -> Histórico`, async () => {
      // CORRECCIÓN DE AUTOMATIZACIÓN confirmada en vivo: la tabla "Órdenes" de
      // Cierre de Caja (leerFacturasContadoOrdenes(), columna "N orden") está
      // documentada en pos.types.ts como específica de "Órdenes de TALLER"
      // (facturarOrdenPOS() en pos-taller.page.ts) — un concepto de negocio
      // distinto de "Orden de Caja" ("Enviar a caja" / pos-orden-caja.page.ts).
      // Confirmado en vivo (primer intento de este escenario): facturar una
      // Orden de Caja real hizo 0 filas nuevas en leerFacturasContadoOrdenes()
      // pese a que la venta sí se completó (popup de impresión real) — la
      // factura cae en "Ventas directas", igual que cualquier venta directa
      // del POS. Se usa leerFacturasContadoDirectas(), no *Ordenes(), para
      // este flujo.
      fila = await ejecutarYValidarTrazabilidad(
        pos, page, ventas, 'Órdenes de Caja', escenario,
        () => pos.leerFacturasContadoDirectas(),
      );
    });

    await test.step('Validar consistencia y ausencia de errores', async () => {
      expect(fila!.notas, `Inconsistencia de trazabilidad detectada: ${fila!.notas}`).toBe('');
      await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });
}


// ─── Pago Mixto (Efectivo + Tarjeta): Facturar directo y Órdenes de Caja ────
// El pago mixto es un flujo VÁLIDO (instrucción explícita del usuario, no se
// marca como bug por sí solo) — se valida cada método por separado: el
// campo "tipoPago" de Cierre de Caja para una fila mixta y el conjunto real
// de campos con monto>0 en Histórico (ambos deben reflejar los 2 métodos).

async function validarPagoMixto(
  pos: PosPage, page: Page, ventas: HistoricoVentasPage, flujo: string,
  leerTablaFn: () => Promise<FilaFacturaVenta[]>,
): Promise<FilaMatriz> {
  const antes = await runDentroDeCierre(pos, leerTablaFn);

  await pos.presionarFacturar();
  await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  await pos.cambiarTipoPagoEnModalPago('contado');
  await expect(page.locator('#payment_cash_total'), 'El campo de efectivo no quedó visible tras cambiar a "Contado"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

  const total = await pos.obtenerTotalVentaNumerico();
  expect(total).toBeGreaterThan(0);
  const montoTarjeta = Number((total / 2).toFixed(2));
  const montoEfectivo = Number((total - montoTarjeta).toFixed(2));

  await pos.seleccionarPagoMixto(String(montoTarjeta), String(montoEfectivo));
  await pos.confirmarPagoAbriendoCajaSiEsNecesario();
  await pos.validarCarritoVacio();

  const despues = await runDentroDeCierre(pos, leerTablaFn);
  const nueva = facturaNueva(antes, despues);

  const notas: string[] = [];
  if (Math.abs(nueva.monto - total) >= 0.02) notas.push(`Cierre de Caja muestra monto=${nueva.monto}, esperado ${total}`);

  await ventas.buscarEnHistoricoVentas(nueva.numeroFactura);
  await ventas.abrirFacturaEnHistorico(nueva.numeroFactura);
  const formaDePago = await ventas.leerFormaDePagoFacturaAbierta();

  if (formaDePago.tarjeta === null || Math.abs(formaDePago.tarjeta - montoTarjeta) >= 0.02) {
    notas.push(`Histórico "tarjeta"=${formaDePago.tarjeta}, esperado ${montoTarjeta}`);
  }
  if (formaDePago.efectivoRecibido === null || Math.abs(formaDePago.efectivoRecibido - montoEfectivo) >= 0.02) {
    notas.push(`Histórico "efectivoRecibido"=${formaDePago.efectivoRecibido}, esperado ${montoEfectivo}`);
  }
  if (formaDePago.sinpe !== null && formaDePago.sinpe > 0.01) notas.push(`Histórico muestra SINPE inesperado=${formaDePago.sinpe}`);
  if (formaDePago.transaccion !== null && formaDePago.transaccion > 0.01) notas.push(`Histórico muestra Transacción inesperada=${formaDePago.transaccion}`);

  const fila: FilaMatriz = {
    flujo,
    metodo: `Mixto (Tarjeta ${montoTarjeta} + Efectivo ${montoEfectivo})`,
    numeroFactura: nueva.numeroFactura,
    montoEsperado: total,
    tipoPagoCierre: nueva.tipoPago,
    montoCierre: nueva.monto,
    formaDePagoHistorico: formaDePago,
    consistente: notas.length === 0,
    notas: notas.join(' | '),
  };
  logFilaMatriz(fila);
  return fila;
}

test('Facturar directo — trazabilidad completa con pago Mixto (Tarjeta + Efectivo)', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const ventas = new HistoricoVentasPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await asegurarCajaAbierta(pos);
  });

  let fila: FilaMatriz;
  await test.step('Facturar un producto rápido de contado con pago Mixto', async () => {
    await pos.agregarProductoRapidoSimple(`Facturar Mixto ${Date.now()}`, '1300');
    fila = await validarPagoMixto(pos, page, ventas, 'Facturar directo', () => pos.leerFacturasContadoDirectas());
  });

  await test.step('Validar consistencia y ausencia de errores', async () => {
    expect(fila!.notas, `Inconsistencia de trazabilidad detectada: ${fila!.notas}`).toBe('');
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});

test('Órdenes de Caja — trazabilidad completa con pago Mixto (Tarjeta + Efectivo)', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const ventas = new HistoricoVentasPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await asegurarCajaAbierta(pos);
  });

  let nombreCliente = '';
  await test.step('Crear una Orden de Caja de contado, localizable por nombre de cliente único', async () => {
    nombreCliente = await crearOrdenDeCajaLocalizable(pos, '1400');
  });

  await test.step('Localizar esa Orden de Caja y cargarla al carrito', async () => {
    await cargarOrdenDeCajaPorCliente(pos, nombreCliente);
  });

  let fila: FilaMatriz;
  await test.step('Facturar la Orden de Caja con pago Mixto', async () => {
    // Ver el comentario de la corrección de automatización equivalente en los
    // escenarios de un solo método: "Órdenes" de Cierre de Caja es Taller, no
    // Orden de Caja — se usa leerFacturasContadoDirectas().
    fila = await validarPagoMixto(pos, page, ventas, 'Órdenes de Caja', () => pos.leerFacturasContadoDirectas());
  });

  await test.step('Validar consistencia y ausencia de errores', async () => {
    expect(fila!.notas, `Inconsistencia de trazabilidad detectada: ${fila!.notas}`).toBe('');
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});


// ─── Efectivo con VUELTO (sobrepago) — el vuelto no debe alterar el registro ─
// Instrucción explícita del usuario: el vuelto es un escenario válido, se
// valida que el método siga siendo Efectivo y que el monto real (no el
// recibido) quede registrado igual en Cierre de Caja e Histórico.

test('Facturar directo — Efectivo con sobrepago (vuelto real) no altera el método ni el monto registrado', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const ventas = new HistoricoVentasPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await asegurarCajaAbierta(pos);
  });

  let antes: FilaFacturaVenta[] = [];
  await test.step('Leer Fact. Contado (Directas) ANTES', async () => {
    antes = await runDentroDeCierre(pos, () => pos.leerFacturasContadoDirectas());
  });

  let total = 0;
  let montoRecibido = 0;
  await test.step('Facturar con un monto en efectivo SUPERIOR al total (vuelto real)', async () => {
    await pos.agregarProductoRapidoSimple(`Facturar Vuelto ${Date.now()}`, '990');
    await pos.presionarFacturar();
    await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await pos.cambiarTipoPagoEnModalPago('contado');
    await expect(page.locator('#payment_cash_total'), 'El campo de efectivo no quedó visible tras cambiar a "Contado"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    total = await pos.obtenerTotalVentaNumerico();
    expect(total).toBeGreaterThan(0);
    montoRecibido = Number((total + 500).toFixed(2)); // sobrepago fijo y conocido
    await pos.seleccionarPagoEfectivo(String(montoRecibido));
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  let fila: FilaMatriz | null = null;
  await test.step('Validar Cierre de Caja e Histórico: método Efectivo, monto = TOTAL de la venta (no el recibido), vuelto real registrado', async () => {
    const despues = await runDentroDeCierre(pos, () => pos.leerFacturasContadoDirectas());
    const nueva = facturaNueva(antes, despues);

    const notas: string[] = [];
    if (!/efectivo/i.test(nueva.tipoPago)) notas.push(`Cierre de Caja muestra Tipo Pago="${nueva.tipoPago}", esperado Efectivo`);
    if (Math.abs(nueva.monto - total) >= 0.02) notas.push(`Cierre de Caja muestra monto=${nueva.monto}, esperado el TOTAL real ${total} (no el recibido ${montoRecibido})`);

    await ventas.buscarEnHistoricoVentas(nueva.numeroFactura);
    await ventas.abrirFacturaEnHistorico(nueva.numeroFactura);
    const formaDePago = await ventas.leerFormaDePagoFacturaAbierta();

    const vueltoEsperado = Number((montoRecibido - total).toFixed(2));
    if (formaDePago.efectivoRecibido === null || Math.abs(formaDePago.efectivoRecibido - montoRecibido) >= 0.02) {
      notas.push(`Histórico "efectivoRecibido"=${formaDePago.efectivoRecibido}, esperado el monto RECIBIDO ${montoRecibido}`);
    }
    if (formaDePago.vuelto === null || Math.abs(formaDePago.vuelto - vueltoEsperado) >= 0.02) {
      notas.push(`Histórico "vuelto"=${formaDePago.vuelto}, esperado ${vueltoEsperado}`);
    }
    if (formaDePago.tarjeta !== null && formaDePago.tarjeta > 0.01) notas.push(`Histórico muestra Tarjeta inesperada=${formaDePago.tarjeta}`);
    if (formaDePago.sinpe !== null && formaDePago.sinpe > 0.01) notas.push(`Histórico muestra SINPE inesperado=${formaDePago.sinpe}`);
    if (formaDePago.transaccion !== null && formaDePago.transaccion > 0.01) notas.push(`Histórico muestra Transacción inesperada=${formaDePago.transaccion}`);

    fila = {
      flujo: 'Facturar directo', metodo: 'Efectivo con vuelto', numeroFactura: nueva.numeroFactura,
      montoEsperado: total, tipoPagoCierre: nueva.tipoPago, montoCierre: nueva.monto,
      formaDePagoHistorico: formaDePago, consistente: notas.length === 0, notas: notas.join(' | '),
    };
    logFilaMatriz(fila);
    expect(notas.join(' | '), `Inconsistencia de trazabilidad detectada: ${notas.join(' | ')}`).toBe('');
  });

  expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
});


// ─── Efectivo en moneda secundaria — la conversión no debe alterar el método ─

test('Facturar directo — Efectivo en moneda secundaria se registra con el método y monto correctos', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const ventas = new HistoricoVentasPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await asegurarCajaAbierta(pos);
  });

  const simbolos = await pos.obtenerSimbolosMonedaDisponibles();
  test.skip(simbolos.length < 2, `Este ambiente solo tiene 1 moneda disponible (${simbolos.join(', ')}) — no aplica`);

  let antes: FilaFacturaVenta[] = [];
  await test.step('Leer Fact. Contado (Directas) ANTES', async () => {
    antes = await runDentroDeCierre(pos, () => pos.leerFacturasContadoDirectas());
  });

  let total = 0;
  let simboloUsado = '';
  await test.step('Cambiar a la moneda secundaria y facturar de contado en Efectivo', async () => {
    const infoAntes = await pos.obtenerInfoMoneda();
    const secundaria = simbolos.find((s) => s !== infoAntes.simboloBase) ?? simbolos[1];
    simboloUsado = await pos.cambiarMoneda(secundaria);

    await pos.agregarProductoRapidoSimple(`Facturar Moneda ${Date.now()}`, '500');
    await pos.presionarFacturar();
    await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await pos.cambiarTipoPagoEnModalPago('contado');
    await expect(page.locator('#payment_cash_total'), 'El campo de efectivo no quedó visible tras cambiar a "Contado"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    total = await pos.obtenerTotalVentaNumerico();
    expect(total).toBeGreaterThan(0);
    await pos.seleccionarPagoEfectivo(String(total));
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  await test.step('Restaurar la moneda base (no interferir con otros escenarios)', async () => {
    await pos.asegurarMonedaBaseActiva();
  });

  await test.step('Validar Cierre de Caja e Histórico con el monto real de esta moneda', async () => {
    const despues = await runDentroDeCierre(pos, () => pos.leerFacturasContadoDirectas());
    const nueva = facturaNueva(antes, despues);

    const notas: string[] = [];
    if (!/efectivo/i.test(nueva.tipoPago)) notas.push(`Cierre de Caja muestra Tipo Pago="${nueva.tipoPago}", esperado Efectivo`);
    if (Math.abs(nueva.monto - total) >= 0.02) notas.push(`Cierre de Caja muestra monto=${nueva.monto}, esperado ${total}`);

    await ventas.buscarEnHistoricoVentas(nueva.numeroFactura);
    await ventas.abrirFacturaEnHistorico(nueva.numeroFactura);
    const formaDePago = await ventas.leerFormaDePagoFacturaAbierta();
    if (formaDePago.efectivoRecibido === null || Math.abs(formaDePago.efectivoRecibido - total) >= 0.02) {
      notas.push(`Histórico "efectivoRecibido"=${formaDePago.efectivoRecibido}, esperado ${total}`);
    }

    const fila: FilaMatriz = {
      flujo: 'Facturar directo', metodo: `Efectivo (moneda ${simboloUsado})`, numeroFactura: nueva.numeroFactura,
      montoEsperado: total, tipoPagoCierre: nueva.tipoPago, montoCierre: nueva.monto,
      formaDePagoHistorico: formaDePago, consistente: notas.length === 0, notas: notas.join(' | '),
    };
    logFilaMatriz(fila);
    expect(notas.join(' | '), `Inconsistencia de trazabilidad detectada: ${notas.join(' | ')}`).toBe('');
  });

  expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
});
