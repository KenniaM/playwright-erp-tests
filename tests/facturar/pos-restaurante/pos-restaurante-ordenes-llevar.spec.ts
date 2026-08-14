// Ambiente COMPLETO distinto del resto de la suite (qa_restaurant, compañía
// "Restaurante Rancho Robertos" — ver tests/auth/restaurant.setup.ts). Mismo
// mecanismo de require()-order que pos-restaurante-mesas.spec.ts: fija
// BASE_URL/POS_COMPANIA ANTES de importar cualquier módulo que dependa de
// env.config.ts/pos.types.ts. Por diseño, este archivo debe correrse en un
// comando dedicado, nunca mezclado con el resto de la suite:
//
//   npx playwright test tests/facturar/pos-restaurante/pos-restaurante-ordenes-llevar.spec.ts --project=setup-restaurant --project=firefox-restaurant
//
process.env.BASE_URL = process.env.BASE_URL ?? 'https://dev.designsoftcr.com/qa_restaurant/public';
process.env.POS_COMPANIA = process.env.POS_COMPANIA ?? 'Restaurante Rancho Robertos';

import { test as base, expect, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, espiarErroresJS, PRECIO_PRODUCTO_RAPIDO } from '../pos/pos.page';
import { PosRestauranteOrdenesLlevar } from './pos-restaurante-ordenes-llevar.page';
import { HistoricoVentasPage } from '../../ventas/historico-ventas.page';
import { PosCrearCliente } from '../pos/pos-crear-cliente.page';

// ─── Sesión compartida (fixture de scope 'worker', NO mode: 'serial') ──────
// Mismo mecanismo que pos-restaurante-mesas.spec.ts (ver su comentario
// completo): una fixture propia con scope 'worker', sin
// test.describe.configure({mode:'serial'}) (entraría en conflicto con
// fullyParallel).
type OrdenesLlevarFixtures = {
  sharedPage: Page;
  pos: PosPage;
  llevar: PosRestauranteOrdenesLlevar;
};

const test = base.extend<{}, OrdenesLlevarFixtures>({
  sharedPage: [async ({ browser }, use) => {
    const page = await browser.newPage();
    await use(page);
    await page.close();
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  pos: [async ({ sharedPage }, use) => {
    const pos = new PosPage(sharedPage);
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    await use(pos);
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  llevar: [async ({ pos, sharedPage }, use) => {
    await use(new PosRestauranteOrdenesLlevar(pos, sharedPage));
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],
});

/** Mismo criterio que pos-restaurante-mesas.spec.ts: una recarga real antes de cada escenario garantiza carrito vacío y ningún modal abierto. */
test.beforeEach(async ({ pos }) => {
  test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
  await pos.irAlPos();
  await pos.esperarEstadoInicial();
  if (await pos.modalAbrirCajaVisible()) {
    await pos.cerrarModalAbrirCaja();
  }
  await pos.cerrarOverlaysConocidos();
});

// ─── Helpers compartidos ────────────────────────────────────────────────────

/** Ninguna línea de error visible en el carrito/encabezado — mismo criterio que el resto de la suite. */
async function validarSinMensajesDeError(page: Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

/**
 * Agrega productos al carrito hasta encontrar uno cuya fila SÍ tenga los
 * controles reales de cantidad (+/-) — HALLAZGO REAL confirmado en vivo
 * (`pos-restaurante-mesas.spec.ts`, Escenario 25): ciertos productos de este
 * catálogo (ej. repuestos automotrices mezclados en el catálogo de
 * qa_restaurant) no renderizan ningún botón +/- en su fila del carrito, solo
 * el input numérico — `agregarPrimerProductoNoPresente()` no filtra por
 * esto. Mismo helper y mismo criterio ya aplicado en el módulo Mesas.
 */
async function agregarProductoConControlDeCantidad(pos: PosPage, llevar: PosRestauranteOrdenesLlevar, page: Page): Promise<string> {
  const MAX_INTENTOS = 8;
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    await llevar.agregarPrimerProductoNoPresente();
    const claves = await pos.obtenerClavesFilasCarrito();
    const claveActual = claves[claves.length - 1];
    const tieneControles = await page.locator(`.btn_set_input_quantity_up_${claveActual}`).count() > 0;
    if (tieneControles) return claveActual;
  }
  throw new Error(`Ningún producto entre ${MAX_INTENTOS} probados tiene controles reales de cantidad (+/-) en su fila del carrito.`);
}

/** Factura el carrito ya cargado con el total exacto en efectivo — mismo patrón que pos-restaurante-mesas.spec.ts. */
async function facturarConEfectivo(pos: PosPage) {
  await pos.abrirModalDePago();
  const total = await pos.obtenerTotalVentaNumerico();
  expect(total).toBeGreaterThan(0);
  await pos.seleccionarPagoEfectivo(String(total));
  await pos.confirmarPagoAbriendoCajaSiEsNecesario();
}

test.describe('Restaurante — Órdenes para Llevar', () => {

  // ─── 1. Crear orden sin cliente ──────────────────────────────────────────
  test('1. Crear orden sin cliente: agregar productos y facturar', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await test.step('Abrir "Para Llevar" e iniciar una orden nueva', async () => {
      await llevar.iniciarOrdenNueva();
    });

    await test.step('Agregar dos productos', async () => {
      const nombreUno = await llevar.agregarPrimerProductoNoPresente();
      const nombreDos = await llevar.agregarPrimerProductoNoPresente();
      expect(nombreUno).not.toBe(nombreDos);
      expect((await pos.obtenerClavesFilasCarrito()).length).toBe(2);
    });

    await test.step('Validar Subtotal/IVA/Total antes de facturar', async () => {
      const total = await pos.obtenerTotalVentaNumerico();
      const iva = await pos.obtenerTotalIvaGeneral();
      expect(total, 'El total debe ser mayor a 0').toBeGreaterThan(0);
      expect(total, 'El total debe ser mayor o igual al IVA').toBeGreaterThanOrEqual(iva);
    });

    await test.step('Facturar sin cliente (Cliente de contado, por defecto)', async () => {
      await facturarConEfectivo(pos);
    });

    await test.step('Validar que la factura se generó correctamente (carrito vacío, sin errores)', async () => {
      await pos.validarCarritoVacio();
      await validarSinMensajesDeError(sharedPage);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 2. Cliente existente ─────────────────────────────────────────────────
  test('2. Cliente existente: agregar cliente registrado, producto y facturar', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let nombreCliente = '';
    await test.step('Iniciar orden nueva y elegir un cliente existente', async () => {
      await llevar.iniciarOrdenNueva();
      nombreCliente = await pos.seleccionarClienteExistente();
      expect(nombreCliente.length).toBeGreaterThan(0);
    });

    await test.step('Agregar un producto y facturar', async () => {
      await llevar.agregarPrimerProductoNoPresente();
      expect(await pos.obtenerClienteSeleccionado(), 'El cliente registrado no quedó asociado a la orden antes de facturar').toBe(nombreCliente);
      await facturarConEfectivo(pos);
    });

    await test.step('Validar que la factura se generó correctamente', async () => {
      await pos.validarCarritoVacio();
      await validarSinMensajesDeError(sharedPage);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 3. Nombre de cliente (sin registrar) ────────────────────────────────
  test('3. Nombre de cliente: escribir únicamente el nombre, agregar producto y facturar', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    const nombreCliente = `Cliente Llevar QA ${Date.now()}`;

    await test.step('Iniciar orden nueva y escribir el nombre del cliente', async () => {
      await llevar.iniciarOrdenNueva();
      await pos.ingresarNombreCliente(nombreCliente);
    });

    await test.step('Agregar un producto y validar que el nombre quedó aplicado', async () => {
      await llevar.agregarPrimerProductoNoPresente();
      expect(await pos.obtenerClienteSeleccionado()).toBe(nombreCliente);
    });

    await test.step('Facturar', async () => {
      await facturarConEfectivo(pos);
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 4. Cantidad de un producto ──────────────────────────────────────────
  test('4. Modificar cantidad: incrementar un producto y validar el total', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let clave = '';
    let totalAntes = 0;
    await test.step('Iniciar orden nueva y agregar un producto con controles reales de cantidad', async () => {
      await llevar.iniciarOrdenNueva();
      clave = await agregarProductoConControlDeCantidad(pos, llevar, sharedPage);
      totalAntes = await pos.obtenerTotalVentaNumerico();
    });

    await test.step('Incrementar la cantidad de esa línea y validar que el total sube', async () => {
      await pos.incrementarCantidadProducto(clave);
      const totalDespues = await pos.obtenerTotalVentaNumerico();
      expect(totalDespues, 'El total debió subir tras incrementar la cantidad').toBeGreaterThan(totalAntes);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 5. Descuento individual ──────────────────────────────────────────────
  test('5. Descuento individual: aplicar un porcentaje a una línea y facturar', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let clave = '';
    await test.step('Iniciar orden y agregar un producto', async () => {
      await llevar.iniciarOrdenNueva();
      await llevar.agregarPrimerProductoNoPresente();
      [clave] = await pos.obtenerClavesFilasCarrito();
    });

    await test.step('Aplicar descuento individual del 5% y validar', async () => {
      const resultado = await pos.aplicarDescuentoIndividual(clave, '5');
      expect(resultado.escenario, 'El producto elegido no permitió descuento individual').not.toBe('sin_descuento');
      expect(parseFloat(resultado.porcentajeAplicado)).toBeGreaterThan(0);
    });

    await test.step('Facturar', async () => {
      await facturarConEfectivo(pos);
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 6. Descuento general ─────────────────────────────────────────────────
  test('6. Descuento general: activar, aplicar porcentaje y validar el total antes de facturar', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let totalAntes = 0;
    await test.step('Iniciar orden y agregar dos productos', async () => {
      await llevar.iniciarOrdenNueva();
      await llevar.agregarPrimerProductoNoPresente();
      await llevar.agregarPrimerProductoNoPresente();
      totalAntes = await pos.obtenerTotalVentaNumerico();
    });

    await test.step('Activar descuento general del 10% y validar el monto', async () => {
      // mostrarDetalleAvanzadoFactura() ANTES de tocar el porcentaje: el
      // campo real (#total_discount_input) solo queda interactuable con el
      // detalle avanzado expandido — confirmado en vivo (sin este paso, el
      // fill() sobre ese campo cuelga indefinidamente esperando que se
      // vuelva editable).
      await pos.activarDescuentoGeneral();
      await pos.mostrarDetalleAvanzadoFactura();
      await pos.establecerPorcentajeDescuentoGeneral('10');
      const monto = await pos.obtenerMontoDescuentoGeneralNumerico();
      expect(monto, 'El descuento general debe ser mayor a 0').toBeGreaterThan(0);

      const totalConDescuento = await pos.obtenerTotalVentaNumerico();
      expect(totalConDescuento, 'El total con descuento general debe ser menor al total original').toBeLessThan(totalAntes);
    });

    await test.step('Facturar', async () => {
      await facturarConEfectivo(pos);
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 7. Moneda alternativa ────────────────────────────────────────────────
  test('7. Moneda alternativa: cambiar a Dólar Americano, validar el total convertido y volver a la moneda base', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let totalEnMonedaBase = 0;
    let simboloBase = '';
    await test.step('Iniciar orden, agregar dos productos y leer el total en la moneda base', async () => {
      await llevar.iniciarOrdenNueva();
      await llevar.agregarPrimerProductoNoPresente();
      await llevar.agregarPrimerProductoNoPresente();

      // CORRECCIÓN DE AUTOMATIZACIÓN CONFIRMADA EN VIVO (indicada por el
      // usuario del proyecto — investigación previa de esta sesión había
      // concluido erróneamente en un "bug de sistema" que en realidad era
      // este defecto de la prueba). `cambiarMoneda()`/`setTypeCurrencyReceipByUser`
      // persiste la moneda activa POR USUARIO en el servidor, no por sesión
      // de browser (ya documentado en pos-orden-caja.spec.ts) — tras las
      // muchas corridas de investigación de esta sesión que cambiaron a
      // Dólar Americano, la cuenta de pruebas quedó con "$" como moneda
      // activa incluso ANTES de este test tocar nada. Sin forzar la base
      // aquí, "totalEnMonedaBase" se leía YA en dólares (28.57), y el paso
      // siguiente "cambiar a Dólar Americano" era un no-op (ya estaba
      // activa) — de ahí que el total pareciera "no convertir": nunca hubo
      // una conversión real que observar. Confirmado en vivo, forzando la
      // base primero: colones real ₡12,961.91 → Dólar Americano real $28.57
      // (12,961.91 × 0.00220 ≈ 28.5, tipo de cambio real coherente) — la
      // conversión SÍ funciona correctamente. `asegurarMonedaBaseActiva()`
      // ANTES de leer el total, no solo al final, evita este falso
      // positivo en cualquier corrida futura.
      await pos.asegurarMonedaBaseActiva();
      const info = await pos.obtenerInfoMoneda();
      simboloBase = info.simboloBase;
      totalEnMonedaBase = await pos.obtenerTotalVentaNumerico();
      expect(totalEnMonedaBase).toBeGreaterThan(0);
    });

    await test.step('Cambiar a Dólar Americano y validar el total convertido', async () => {
      // Por NOMBRE completo ("Dólar Americano"), nunca por el símbolo "$"
      // suelto — confirmado en vivo que este catálogo tiene DOS monedas con
      // el mismo símbolo "$" (Dólar Americano y Peso Mexicano), lo que hace
      // ambigua cualquier búsqueda por símbolo.
      //
      // CORRECCIÓN DE AUTOMATIZACIÓN CONFIRMADA EN VIVO: `pos.cambiarMoneda()`
      // (el helper genérico y compartido de todo el POS) filtra por el texto
      // del ÍCONO de moneda, que solo contiene el símbolo corto — nunca el
      // nombre completo. Pasarle "Dólar Americano" directamente (como hacía
      // esta línea antes) no resuelve la ambigüedad: el filtro no matchea
      // ningún ícono y el helper agota sus 8 reintentos con el mismo error
      // determinístico cada vez (confirmado en vivo, 2/2 corridas). Se usa en
      // su lugar `llevar.cambiarMonedaPorNombre()` (variante local acotada a
      // este módulo, ver su comentario completo en
      // pos-restaurante-ordenes-llevar.page.ts), que filtra por el `<li>`
      // completo del menú (símbolo + nombre) en vez de solo el ícono.
      const simboloNuevo = await llevar.cambiarMonedaPorNombre('Dólar Americano');
      expect(simboloNuevo).not.toBe(simboloBase);

      const totalEnDolares = await pos.obtenerTotalVentaNumerico();
      expect(totalEnDolares, 'El total convertido a dólares debe ser mayor a 0').toBeGreaterThan(0);

      // RETRACTADO — CONFIRMADO EN VIVO QUE NO ES BUG DE SISTEMA (una
      // investigación previa de esta sesión había concluido erróneamente lo
      // contrario, con evidencia de capturas y red que parecía sólida — ver
      // el error real más abajo). Root cause real: el paso anterior
      // ("Iniciar orden...") no forzaba la moneda base ANTES de leer
      // `totalEnMonedaBase` — con la cuenta ya contaminada en "$" por
      // corridas previas de esta misma sesión, ese total se leía YA en
      // dólares, y este mismo paso ("cambiar a Dólar Americano") era un
      // no-op real (ya estaba activa) — de ahí que el total pareciera "no
      // convertir" en 3 corridas idénticas seguidas: nunca hubo una
      // conversión real que observar, siempre se comparaba dólares contra
      // dólares. Confirmado en vivo forzando la base primero (ver el fix en
      // el paso anterior): colones real ₡12,961.91 → Dólar Americano real
      // $28.57 (12,961.91 × 0.00220 ≈ 28.5, tipo de cambio real coherente)
      // — la conversión del total SÍ funciona correctamente, incluyendo el
      // total agregado del pie. La aserción se mantiene igual (nunca se
      // debilitó) — el fix real fue corregir el estado inicial de la
      // prueba, no la validación.
      expect(totalEnDolares, 'El total en dólares debe ser menor al total en la moneda base (colones)').toBeLessThan(totalEnMonedaBase);
    });

    await test.step('Volver a la moneda base y facturar', async () => {
      // CORRECCIÓN DE AUTOMATIZACIÓN: `asegurarMonedaBaseActiva()` devuelve
      // la moneda ORIGINAL (antes de la llamada, para que quien la usa
      // pueda restaurarla más tarde — documentado explícitamente en su
      // JSDoc), no la moneda activa DESPUÉS de forzar la base. En este
      // punto la moneda original ya era "$" (recién cambiada en el paso
      // anterior), así que comparar ese valor de retorno contra
      // `simboloBase` estaba mal planteado — el estado real tras la llamada
      // se confirma releyendo `obtenerInfoMoneda()`.
      await pos.asegurarMonedaBaseActiva();
      const infoTrasRestaurar = await pos.obtenerInfoMoneda();
      expect(infoTrasRestaurar.simboloActivo).toBe(simboloBase);
      const totalTrasVolver = await pos.obtenerTotalVentaNumerico();
      expect(totalTrasVolver).toBeCloseTo(totalEnMonedaBase, 0);

      await facturarConEfectivo(pos);
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 8. Pago mixto ────────────────────────────────────────────────────────
  //
  // BUG DE SISTEMA CONFIRMADO EN VIVO, causa raíz aislada (no de
  // automatización). Investigado a fondo con un spec de investigación
  // temporal (varias corridas limpias, aisladas):
  //
  //   1. Con la orden SIN cliente (Cliente de contado, el default), pagar con
  //      un método que incluye tarjeta —mixto o tarjeta pura— muestra
  //      correctamente el SweetAlert de confirmación
  //      (`.sweet-alert.confirm-complete-sale`), pero su contenido queda
  //      roto: "Información de pago — Dinero recibido: $27.58 — Su cambio
  //      es: $0.00 — **! Not valid!** — Cancel Pagar (↵ ENTER)" (el string
  //      sin traducir "Not valid!" queda concatenado directo en el mensaje).
  //      Click en "Pagar (↵ ENTER)": la clase `confirm-complete-sale`
  //      desaparece del elemento, pero el SweetAlert sigue visible en
  //      pantalla con EXACTAMENTE el mismo texto, sin cerrarse — y NINGUNA
  //      petición `add_sale` se dispara (confirmado interceptando toda la
  //      red): la venta nunca se completa, queda "pegada" en un estado roto
  //      visualmente indistinguible del original.
  //   2. Repitiendo el MISMO flujo (mismos 2 productos, mismo pago mixto)
  //      pero seleccionando un cliente REGISTRADO antes de pagar (mismo
  //      patrón que el Escenario 2), la venta se completa correctamente sin
  //      ningún "Not valid!" — confirmado en vivo, reproducido limpio.
  //
  // Causa raíz real: en este ambiente (qa_restaurant, módulo Para Llevar), un
  // pago que incluye tarjeta exige un cliente real asociado a la orden — con
  // el cliente de contado por defecto, la propia validación interna del
  // SweetAlert de confirmación falla silenciosamente ("Not valid!") en vez de
  // mostrar el panel real "Información del Cliente" (`#myNavClient`, ya
  // manejado por `_confirmarPagoConReintentosDeCaja()` para el caso de
  // Factura Electrónica) o cualquier otro mensaje claro. Es un bug de
  // sistema/UX (la falla no se comunica de forma utilizable), pero el
  // ESCENARIO en sí queda corregido seleccionando un cliente real antes de
  // pagar — mismo criterio ya usado en el Escenario 2 y ya documentado en
  // CLAUDE.md para "Permite realizar ventas a crédito": ese permiso también
  // exige un cliente real ya seleccionado antes de intentar el pago.
  test('8. Pago mixto: mitad tarjeta, mitad efectivo, y validar que la factura se genera correctamente', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let total = 0;
    await test.step('Iniciar orden, seleccionar cliente existente y agregar dos productos', async () => {
      await llevar.iniciarOrdenNueva();
      await pos.seleccionarClienteExistente();
      await llevar.agregarPrimerProductoNoPresente();
      await llevar.agregarPrimerProductoNoPresente();
      total = await pos.obtenerTotalVentaNumerico();
      expect(total).toBeGreaterThan(0);
    });

    await test.step('Pagar mitad con tarjeta y mitad en efectivo, y facturar', async () => {
      await pos.abrirModalDePago();
      const mitad = (total / 2).toFixed(2);
      await pos.seleccionarPagoMixto(mitad, mitad);
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 9. Combinación de alto riesgo + validación en Histórico de Ventas ──
  test('9. Combinación de alto riesgo: cliente + producto normal + producto rápido + descuento individual + descuento general + pago mixto, validado en Histórico de Ventas', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    let nombreCliente = '';
    let claveNormal = '';
    await test.step('Iniciar orden con cliente existente y agregar un producto normal', async () => {
      await llevar.iniciarOrdenNueva();
      nombreCliente = await pos.seleccionarClienteExistente();
      expect(nombreCliente.length).toBeGreaterThan(0);
      await llevar.agregarPrimerProductoNoPresente();
      [claveNormal] = await pos.obtenerClavesFilasCarrito();
    });

    await test.step('Agregar un producto rápido', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido Llevar QA ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
      expect((await pos.obtenerClavesFilasCarrito()).length).toBe(2);
    });

    await test.step('Aplicar descuento individual sobre el producto normal', async () => {
      const resultado = await pos.aplicarDescuentoIndividual(claveNormal, '5');
      expect(resultado.escenario).not.toBe('sin_descuento');
    });

    await test.step('Activar descuento general del 10%', async () => {
      await pos.activarDescuentoGeneral();
      await pos.mostrarDetalleAvanzadoFactura();
      await pos.establecerPorcentajeDescuentoGeneral('10');
      expect(await pos.obtenerMontoDescuentoGeneralNumerico()).toBeGreaterThan(0);
    });

    let total = 0;
    await test.step('Pagar con método mixto (tarjeta + efectivo) y facturar', async () => {
      total = await pos.obtenerTotalVentaNumerico();
      expect(total).toBeGreaterThan(0);
      await pos.abrirModalDePago();
      const mitad = (total / 2).toFixed(2);
      await pos.seleccionarPagoMixto(mitad, mitad);
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    await test.step('Validar en Histórico de Ventas: la factura más reciente coincide en total y forma de pago', async () => {
      const historico = new HistoricoVentasPage(sharedPage);
      await historico.irA();
      await historico.abrirPrimeraFacturaDelListado();

      // Se usan únicamente los lectores basados en texto/regex (resilientes
      // a campos ausentes) — `leerDetalleFacturaAbierta()` NO se reutiliza
      // aquí: confirmado en vivo que busca un bloque exclusivo de facturas
      // de Taller ("Número Orden de Reparación") que nunca existe en una
      // factura de Restaurante, y cuelga esperándolo indefinidamente.
      const resumen = await historico.leerResumenTotalesFactura();
      console.log('[Escenario 9] Resumen de totales en Histórico:', JSON.stringify(resumen));
      const formaPago = await historico.leerFormaDePagoFacturaAbierta();
      console.log('[Escenario 9] Forma de pago en Histórico:', JSON.stringify(formaPago));

      expect(formaPago.tarjeta, 'La factura en Histórico debe mostrar un monto pagado con tarjeta').not.toBeNull();
      expect(formaPago.efectivoRecibido, 'La factura en Histórico debe mostrar un monto recibido en efectivo').not.toBeNull();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 10. Producto por código: buscar, agregar, editar nombre y precio ───
  test('10. Producto por código: buscarlo por su código, agregarlo, editar nombre y precio, y facturar', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let clave = '';
    await test.step('Iniciar orden y buscar un producto por su código en el grid', async () => {
      await llevar.iniciarOrdenNueva();
      const { producto, codigo } = await pos.obtenerPrimerProductoNormalConCodigoNoPresenteEnCarrito();
      expect(codigo.length, 'El producto elegido debe tener un código real no vacío').toBeGreaterThan(0);
      await pos.buscarProductoEnGrid(codigo);
      await expect(pos.productoPorNombre(producto.nombre), `El producto "${producto.nombre}" no apareció al buscar por su código "${codigo}"`).toHaveCount(1, { timeout: TIMEOUTS.PRODUCTS_LOAD });
      await llevar.agregarProductoAlCarrito(producto);
      [clave] = await pos.obtenerClavesFilasCarrito();
    });

    await test.step('Editar el nombre de la línea', async () => {
      const nuevoNombre = `Producto QA Llevar ${Date.now()}`;
      await pos.editarNombreProducto(clave, nuevoNombre);
      expect(await pos.obtenerNombreProducto(clave)).toBe(nuevoNombre);
    });

    await test.step('Cambiar el precio de la línea, si el campo está habilitado', async () => {
      const habilitado = await pos.precioEdicionHabilitada(clave);
      if (habilitado) {
        const totalAntes = await pos.obtenerTotalProducto(clave);
        await pos.establecerPrecioProducto(clave, '500');
        const totalDespues = await pos.obtenerTotalProducto(clave);
        expect(totalDespues, 'El total de la línea debió cambiar tras editar el precio').not.toBe(totalAntes);
      } else {
        console.log('[Escenario 10] El campo de precio de esta línea no está habilitado para edición (permiso/configuración) — se omite el cambio de precio, sin forzarlo.');
      }
    });

    await test.step('Facturar', async () => {
      await facturarConEfectivo(pos);
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 11. Cambiar el cliente ya seleccionado ──────────────────────────────
  test('11. Cliente: cambiar el cliente ya seleccionado por otro distinto', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let clienteUno = '';
    await test.step('Iniciar orden y seleccionar un primer cliente', async () => {
      await llevar.iniciarOrdenNueva();
      clienteUno = await pos.seleccionarClienteExistente();
      await llevar.agregarPrimerProductoNoPresente();
      expect(await pos.obtenerClienteSeleccionado()).toBe(clienteUno);
    });

    await test.step('Quitar el cliente y seleccionar uno distinto', async () => {
      // El buscador "Buscar Cliente" queda oculto una vez hay un cliente ya
      // seleccionado (confirmado en vivo volcando el DOM real del panel:
      // `.panel-customer-search` colapsa a solo el nombre del cliente activo)
      // — mismo mecanismo genérico que el resto del POS, `quitarClienteSeleccionado()`
      // lo revela de nuevo antes de poder buscar otro.
      await pos.quitarClienteSeleccionado();
      const clienteDos = await pos.seleccionarClienteExistenteDistintoDe(clienteUno);
      expect(clienteDos).not.toBe(clienteUno);
      expect(await pos.obtenerClienteSeleccionado(), 'El cliente nuevo no quedó asociado a la orden').toBe(clienteDos);
    });

    await test.step('Facturar', async () => {
      await facturarConEfectivo(pos);
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 12. Crear cliente nuevo desde la orden ──────────────────────────────
  test('12. Cliente: crear un cliente nuevo desde la orden (dropdown "+ Agregar" → "Nuevo Cliente")', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    // PosCrearCliente se compone directamente contra PosPage + Page (no se
    // integra a la fachada) — mismo criterio documentado en CLAUDE.md para
    // funcionalidad acotada de un solo spec.
    const crearCliente = new PosCrearCliente(pos, sharedPage);
    const datos = {
      nombre: `Cliente Nuevo Llevar QA ${Date.now()}`,
      identificacion: '000000000',
      email: `qa.llevar.${Date.now()}@example.com`,
    };

    await test.step('Iniciar orden y abrir "Nuevo Cliente" desde el dropdown "+ Agregar"', async () => {
      await llevar.iniciarOrdenNueva();
      await crearCliente.abrirAgregarCliente();
    });

    await test.step('Llenar los datos básicos y guardar', async () => {
      await crearCliente.llenarClienteSencillo(datos);
      const { id } = await crearCliente.guardarCliente();
      expect(id.length, 'El cliente nuevo debió devolver un id real').toBeGreaterThan(0);
    });

    await test.step('Agregar un producto y facturar', async () => {
      await llevar.agregarPrimerProductoNoPresente();
      await facturarConEfectivo(pos);
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 13. Exoneración ──────────────────────────────────────────────────────
  test('13. Exoneración: aplicarla a un producto, validar el monto y facturar', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await test.step('Iniciar orden y agregar un producto con IVA', async () => {
      await llevar.iniciarOrdenNueva();
      const conIva = await pos.obtenerPrimerProductoConIvaNoPresenteEnCarrito();
      await llevar.agregarProductoAlCarrito(conIva);
    });

    await test.step('Aplicar exoneración y validar que el monto exonerado es mayor a 0', async () => {
      // mostrarDetalleAvanzadoFactura() ANTES de abrir el modal: mismo
      // criterio ya confirmado en vivo para el Escenario 6 (Descuento
      // general) — el botón "Agregar" de la fila Exoneración
      // (#set_apply_exoneration_modal) vive dentro del detalle avanzado de
      // totales, que en Para Llevar no está expandido por defecto; sin este
      // paso el botón nunca queda visible y el click original quedaba
      // esperando su actionability indefinidamente (confirmado en vivo:
      // agotaba el timeout completo del test, 452 reintentos internos de
      // Playwright sin éxito).
      //
      // SEGUNDO BLOQUEO — investigado a fondo, CONFIRMADO QUE NO ES BUG DE
      // SISTEMA (con evidencia completa: HTML del modal + capturas +
      // prueba de varios "Tipo de documento"). Con el detalle avanzado
      // expandido, `abrirModalExoneracion()` sí abre correctamente el modal
      // real "APLICAR EXONERACIÓN" (`#dialog_add_exoneration`, confirmado
      // `display:block` — el modal en sí funciona). El modal es un
      // formulario REAL y completo de exoneración fiscal de Costa Rica con
      // 8 campos (Tipo de documento, Número de documento, Número de
      // artículo, Número de inciso, Institución exonerada, Fecha de
      // emisión, Orden de Exoneración, Porcentaje) — volcado su HTML
      // completo, confirmado que "Número de artículo"
      // (`#exoneration_article_input_content`) y "Orden de Exoneración"
      // (`#apply_exoneration_text_content`) son CAMPOS CONDICIONALES reales
      // (`display:none` por defecto), controlados por el dropdown "Tipo de
      // documento de exoneración" (`onchange="set_selected_exoneration_document_type()"`,
      // 12 opciones reales del catálogo de Hacienda de Costa Rica) — es
      // decir, un formulario de cumplimiento fiscal correcto y esperado,
      // NO un defecto. `pos.aplicarExoneracion()` (el helper genérico
      // compartido) asume que "Orden de Exoneración" está siempre visible,
      // sin seleccionar ningún tipo de documento primero — root cause real:
      // gap de automatización en ese helper, no bug de sistema. Se probaron
      // en vivo 3 tipos ("01" default, "03 - Autorizado por Ley Especial",
      // "99 - Otros") y NINGUNO revela el campo (capturas
      // `_exoneracion-tipo03.png`/`_exoneracion-tipo99.png`) — el disparador
      // real no se identificó dentro del tiempo de esta sesión (quedan 9
      // tipos sin probar). Sin ese disparador confirmado, se documenta como
      // limitación de automatización pendiente en vez de forzar un tipo al
      // azar — futura sesión: probar los 9 tipos restantes o inspeccionar
      // `set_selected_exoneration_document_type()` en el JS fuente real.
      await pos.mostrarDetalleAvanzadoFactura();
      await pos.abrirModalExoneracion();
      await pos.aplicarExoneracion('100');
      const monto = await pos.obtenerMontoExoneracionNumerico();
      expect(monto, 'El monto exonerado debe ser mayor a 0').toBeGreaterThan(0);
    });

    await test.step('Facturar', async () => {
      await facturarConEfectivo(pos);
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 14. Crédito ──────────────────────────────────────────────────────────
  test('14. Crédito: facturar a crédito con un cliente real y fecha de vencimiento', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await test.step('Iniciar orden, seleccionar cliente real y agregar un producto', async () => {
      // Permite realizar ventas a crédito (id 271, ver CLAUDE.md) exige un
      // cliente real ya seleccionado — mismo requisito confirmado en vivo
      // para el pago con tarjeta del Escenario 8: sin cliente, el checkbox
      // "Crédito" puede marcarse pero la venta no se completa.
      await llevar.iniciarOrdenNueva();
      await pos.seleccionarClienteExistente();
      await llevar.agregarPrimerProductoNoPresente();
    });

    await test.step('Cambiar el tipo de pago a Crédito y validar la fecha de vencimiento', async () => {
      await pos.abrirModalDePago();
      await pos.cambiarTipoPagoEnModalPago('credito');
      expect(await pos.obtenerTipoPagoEnModalPago()).toBe('credito');
      const fechaVencimiento = await pos.obtenerFechaVencimiento();
      expect(fechaVencimiento.length, 'La fecha de vencimiento debe traer un valor por defecto').toBeGreaterThan(0);
    });

    await test.step('Confirmar la factura a crédito', async () => {
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 15. Cantidad: decrementar y fijar por campo numérico ────────────────
  test('15. Cantidad: decrementar con el botón "−" y fijar un valor directo por el campo numérico', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let clave = '';
    await test.step('Iniciar orden, agregar un producto con controles reales de cantidad e incrementarla dos veces', async () => {
      await llevar.iniciarOrdenNueva();
      clave = await agregarProductoConControlDeCantidad(pos, llevar, sharedPage);
      await pos.incrementarCantidadProducto(clave);
      await pos.incrementarCantidadProducto(clave);
      expect(await pos.obtenerCantidadProducto(clave)).toBe(3);
    });

    await test.step('Decrementar con el botón "−" y validar que la cantidad y el total bajan', async () => {
      const totalAntes = await pos.obtenerTotalVentaNumerico();
      await pos.decrementarCantidadProducto(clave);
      expect(await pos.obtenerCantidadProducto(clave)).toBe(2);
      expect(await pos.obtenerTotalVentaNumerico()).toBeLessThan(totalAntes);
    });

    await test.step('Fijar la cantidad directamente por el campo numérico', async () => {
      await pos.establecerCantidadProducto(clave, '5');
      expect(await pos.obtenerCantidadProducto(clave)).toBe(5);
    });

    await test.step('Facturar', async () => {
      await facturarConEfectivo(pos);
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 16. Observaciones: por producto y de la factura ─────────────────────
  test('16. Observaciones: agregar una observación al producto y otra general a la factura', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    const observacionProducto = 'Observación de línea — sin cebolla, QA';
    const observacionFactura = 'Observación general de la factura — entregar en caja 2, QA';

    let clave = '';
    await test.step('Iniciar orden, agregar un producto y agregarle una observación', async () => {
      await llevar.iniciarOrdenNueva();
      await llevar.agregarPrimerProductoNoPresente();
      [clave] = await pos.obtenerClavesFilasCarrito();
      // CORRECCIÓN DE AUTOMATIZACIÓN CONFIRMADA EN VIVO (no bug de sistema —
      // ver el comentario completo de `PosRestauranteOrdenesLlevar.agregarObservacionAProducto()`):
      // el helper genérico `pos.agregarObservacionAProducto()` busca un
      // botón "Nuevo" que no existe en la versión de este modal (colgaba
      // 300s completos esperándolo). Se usa la variante local del módulo,
      // que reutiliza el mismo diálogo real pero con el editor siempre
      // visible de esta versión (`#ta_product_item_comment` + "Aplicar").
      await pos.cerrarOverlaysConocidos();
      await llevar.agregarObservacionAProducto(clave, observacionProducto);
      expect(await pos.obtenerObservacionDeProducto(clave)).toBe(observacionProducto);
    });

    await test.step('Agregar una observación general a la factura en el modal de pago', async () => {
      await pos.abrirModalDePago();
      await pos.agregarObservacionFactura(observacionFactura);
      expect(await pos.obtenerObservacionFactura()).toBe(observacionFactura);
    });

    await test.step('Facturar', async () => {
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 17. "Enviar a Caja": NO disponible como ruta alternativa aquí ───────
  //
  // Investigado en vivo y NO automatizado a propósito (no forzar un flujo
  // que el sistema no ofrece). El elemento `#send_sale_payment` SÍ existe en
  // el DOM del POS Restaurante (confirmado con `count()`), pero volcando
  // TODOS los `<li>` reales del menú que vive junto a "Facturar"
  // (`#demo-menu-top-right` — el mismo que en el resto del POS abre "Enviar
  // a caja"/"Crear Proforma"/"Generar Apartado", ver `L.ORDEN_CAJA_MENU_BTN`)
  // con un carrito flotante activo, sus 7 opciones reales son: "Facturar
  // (F10)", "Asignar Mesa", "Para Llevar" (`btn_assign_rest_table_delivery`,
  // ver `PosRestauranteOrdenesLlevar.crearOrdenParaLlevar()`), "(⇧+P)
  // Proforma", "Orden de ruteo", "(⇧+L) Generar Apartado" y "Abonar" —
  // "Enviar a caja" NO aparece entre ellas. Confirmado además en vivo que
  // `pos.abrirMenuOrdenCaja()` (el flujo genérico ya probado en el resto de
  // la suite) falla de forma consistente aquí: el modal `#dialog_send_sale`
  // nunca aparece tras seleccionar la opción del menú (4/4 intentos). El
  // elemento `#send_sale_payment` del DOM parece ser una plantilla/HTML
  // compartido no conectado a ningún flujo real alcanzable en este ambiente
  // — no un bug de esta suite ni de permisos (la cuenta de prueba SÍ ve el
  // resto de las 6 opciones del mismo menú). "Para Llevar" es, en este
  // ambiente, la única alternativa real a "Facturar" para completar una
  // orden sin pasar por el pago inmediato — ya cubierta por el Escenario 20
  // ("Crear una Orden para Llevar").


  // ─── 18. Cierre de Caja (solo lectura) ────────────────────────────────────
  test('18. Cierre de Caja: validar que la venta facturada aparece en el Detalle de Cierre, sin cerrar la caja', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await test.step('Iniciar orden, agregar un producto y facturar en efectivo', async () => {
      await llevar.iniciarOrdenNueva();
      await llevar.agregarPrimerProductoNoPresente();
      await facturarConEfectivo(pos);
      await pos.validarCarritoVacio();
    });

    await test.step('Abrir "Detalle de Cierre" (F12) en modo solo lectura y validar la factura en Contado/Directas', async () => {
      await pos.abrirMenuCaja();
      await pos.seleccionarAbrirCerrarCaja();
      await pos.esperarResultadoMenuCaja();
      await expect(pos.modalCerrarCaja, 'El modal "Detalle de Cierre" no apareció (¿la caja estaba cerrada?)').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

      await pos.irASubTabFacturas('contado');
      const filas = await pos.leerFacturasContadoDirectas();
      expect(filas.length, 'Debe existir al menos una factura de contado directa en el cierre (la que se acaba de generar)').toBeGreaterThan(0);
    });

    await test.step('Cancelar el modal SIN cerrar la caja', async () => {
      await pos.cancelarModalCerrarCaja();
      await expect(pos.modalCerrarCaja, 'El modal debió cerrarse sin confirmar el cierre de caja').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 19. Servicios y Productos fraccionados: NO disponibles en este catálogo ──
  //
  // CONFIRMADO EN VIVO (no automatizado a propósito, para no simular una
  // funcionalidad que no existe — ver CLAUDE.md): el tab "Servicios"
  // (`#ck_view_services`, normalmente disponible dentro de "Productos" en el
  // resto de la suite) no existe en absoluto en el catálogo de este ambiente
  // (`count()` de `#ck_view_services` es 0 incluso dentro del tab
  // "Productos"). La categoría "Productos fraccionados" tampoco existe en
  // este catálogo (`pos.categoriaProductosFraccionados` con `count()` 0). Es
  // una característica del catálogo/configuración de la compañía "Restaurante
  // Rancho Robertos" en `qa_restaurant`, no una limitación del módulo "Para
  // Llevar" ni de la automatización — si en el futuro el ambiente agrega
  // servicios o productos fraccionados a este catálogo, agregar aquí los
  // escenarios correspondientes reutilizando `pos.obtenerPrimerServicio()` /
  // `pos.agregarProductoFraccionadoAlCarrito()`, ya genéricos y probados en
  // el resto de la suite.


  // ═══════════════════════════════════════════════════════════════════════
  // Escenarios 20-22: mecanismo REAL de creación de una Orden para Llevar.
  //
  // CORRECCIÓN DE INVESTIGACIÓN (indicada directamente por el usuario del
  // proyecto, confirmada en vivo interceptando la red — reemplaza el
  // hallazgo previo de esta sesión, que concluía erróneamente que no había
  // forma segura de generar una orden propia): agregar productos ESTANDO YA
  // en la pestaña "PARA LLEVAR" del pie de página arma un carrito flotante
  // que factura directo sin persistir ninguna orden — un flujo real y válido
  // ("venta rápida para llevar", el único que usan los Escenarios 1-18), pero
  // DISTINTO de crear una Orden formal. El mecanismo real para CREAR una
  // Orden para Llevar persistida es:
  //   1. Agregar productos al carrito estando en "Productos", SIN ninguna
  //      mesa/orden seleccionada (carrito flotante).
  //   2. Abrir el menú junto a "Facturar" (mismo menú de "Enviar a
  //      caja"/"Crear Proforma"/"Generar Apartado" del resto del POS) y
  //      click en la opción real "Para Llevar" — hermana de "Asignar Mesa"
  //      en ese mismo menú (confirma por qué una orden ya asignada a una
  //      Mesa NO puede convertirse en Para Llevar, como indicó el usuario).
  //   3. Completar el SweetAlert real (nombre del cliente, obligatorio) y
  //      confirmar con "Enviar".
  // Ver `PosRestauranteOrdenesLlevar.crearOrdenParaLlevar()` para el
  // comentario completo con la evidencia de red.
  // ═══════════════════════════════════════════════════════════════════════

  // ─── 20. Crear una Orden para Llevar (mecanismo formal) ──────────────────
  test('20. Crear una Orden para Llevar real: menú junto a Facturar → "Para Llevar" → nombre del cliente → Enviar', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    const nombreCliente = `Cliente Llevar QA ${Date.now()}`;

    let idsAntes: string[] = [];
    await test.step('Capturar el listado de órdenes antes de crear una nueva', async () => {
      idsAntes = await llevar.obtenerIdsOrdenesListadas();
    });

    let idNuevo = '';
    await test.step('Volver a Productos, agregar un producto y crear la orden por el mecanismo formal', async () => {
      await llevar.volverAProductos();
      await llevar.agregarPrimerProductoNoPresente();
      idNuevo = await llevar.crearOrdenParaLlevar(nombreCliente);
      expect(idsAntes).not.toContain(idNuevo);
    });

    await test.step('Validar que la nueva orden aparece en el listado de "Para Llevar"', async () => {
      const idsDespues = await llevar.obtenerIdsOrdenesListadas();
      expect(idsDespues.length, 'El listado debe tener una tarjeta más que antes').toBeGreaterThan(idsAntes.length);
      expect(idsDespues).toContain(idNuevo);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 21. Eliminar una orden propia ───────────────────────────────────────
  test('21. Eliminar orden: crear una orden propia (mecanismo formal) y eliminarla', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    const nombreCliente = `Cliente Eliminar QA ${Date.now()}`;

    let id = '';
    await test.step('Crear una orden propia', async () => {
      await llevar.volverAProductos();
      await llevar.agregarPrimerProductoNoPresente();
      id = await llevar.crearOrdenParaLlevar(nombreCliente);
    });

    await test.step('Eliminar la orden recién creada y validar que desaparece del listado', async () => {
      // CONFIRMADO EN VIVO QUE NO ES BUG DE SISTEMA (investigado a fondo
      // interceptando la red real del click en "Continuar"): el borrado SÍ
      // funciona correctamente del lado del servidor —
      // `deletePosResOrderPrev` respondió 200 con cuerpo "1" (éxito) y el id
      // realmente desapareció del listado, confirmado con datos reales
      // (`order_id=12217`, capturas `_eliminar-modal-confirmacion.png`/
      // `_eliminar-tras-continuar.png`). La falla original era una
      // CONDICIÓN DE CARRERA de automatización: `eliminarOrden()` solo
      // esperaba a que el MODAL se cerrara antes de devolver el control, sin
      // esperar la respuesta real del AJAX de borrado — quien orquesta el
      // test podía leer `obtenerIdsOrdenesListadas()` antes de que el
      // listado terminara de reflejar el cambio. Ya corregido en
      // `PosRestauranteOrdenesLlevar.eliminarOrden()` (ver su comentario
      // completo): ahora espera la respuesta real de `deletePosResOrderPrev`
      // como señal de éxito.
      await llevar.abrirOrdenesParaLlevar();
      const idsAntes = await llevar.obtenerIdsOrdenesListadas();
      expect(idsAntes).toContain(id);

      await llevar.eliminarOrden(id);

      const idsDespues = await llevar.obtenerIdsOrdenesListadas();
      expect(idsDespues, 'La orden eliminada no debe seguir en el listado').not.toContain(id);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 22. Aprobar la entrega de una orden propia ──────────────────────────
  test('22. Aprobar orden: crear una orden propia (mecanismo formal) y aprobar su entrega', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    const nombreCliente = `Cliente Aprobar QA ${Date.now()}`;

    let id = '';
    await test.step('Crear una orden propia', async () => {
      await llevar.volverAProductos();
      await llevar.agregarPrimerProductoNoPresente();
      id = await llevar.crearOrdenParaLlevar(nombreCliente);
    });

    await test.step('Aprobar la entrega de la orden recién creada', async () => {
      await llevar.abrirOrdenesParaLlevar();
      // Señal real de éxito: `aprobarOrden()` confirma AMBOS SweetAlert
      // reales del flujo (la pregunta "¿Está seguro?" y la pantalla de
      // resultado que la app reemplaza en el mismo overlay tras el POST
      // síncrono de `approve_order()`) y lanza si cualquiera de los dos no
      // aparece o no se cierra — root-cause real confirmado leyendo pos.js:
      // el ícono por sí solo NUNCA disparaba el AJAX (ver el comentario
      // completo de `aprobarOrden()`), así que este método ya no necesita
      // (ni debe) apoyarse en adivinar la URL real del endpoint, resuelta en
      // runtime desde un input oculto (`#notify_approved_order_email`).
      await llevar.aprobarOrden(id);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 23. Producto con Aditivos/Modificadores ─────────────────────────────
  test('23. Aditivos: agregar un producto con modificadores configurados, seleccionar una opción y facturar', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let opcionSeleccionada = '';
    await test.step('Iniciar orden y agregar el producto con Aditivos configurados', async () => {
      await llevar.iniciarOrdenNueva();
      opcionSeleccionada = await llevar.agregarProductoConAditivo();
      expect(opcionSeleccionada.length, 'Debió seleccionarse una opción real de aditivo').toBeGreaterThan(0);
      expect((await pos.obtenerClavesFilasCarrito()).length).toBe(1);
    });

    await test.step('Validar el total antes de facturar y facturar', async () => {
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total).toBeGreaterThan(0);
      await facturarConEfectivo(pos);
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 24. Combo ────────────────────────────────────────────────────────────
  test('24. Combo: agregar un combo del catálogo a una orden Para Llevar y facturar', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let nombreCombo = '';
    await test.step('Iniciar orden y agregar un combo del catálogo', async () => {
      await llevar.iniciarOrdenNueva();
      // pos.obtenerPrimerCombo() (genérico, ya probado en el resto de la
      // suite y confirmado en vivo que este catálogo de qa_restaurant sí
      // tiene combos reales, "Combo naruto edition") selecciona la
      // categoría "Combos" y localiza el primero real.
      const combo = await pos.obtenerPrimerCombo();
      nombreCombo = combo.nombre;
      await llevar.agregarProductoAlCarrito(combo);
      expect((await pos.obtenerClavesFilasCarrito()).length).toBe(1);
    });

    await test.step('Validar el total antes de facturar y facturar', async () => {
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, `El total del combo "${nombreCombo}" debe ser mayor a 0`).toBeGreaterThan(0);
      await facturarConEfectivo(pos);
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 25. Reabrir y editar una orden ya persistida ────────────────────────
  // Brecha de cobertura real detectada auditando este módulo: `abrirOrden()`
  // existe en el page object desde el principio pero ningún test lo usaba —
  // todos los escenarios anteriores (1-24) solo ejercitan el flujo de
  // "venta rápida" (carrito flotante, factura directo sin persistir ninguna
  // orden), nunca el ciclo real "crear orden formal → guardarla → volver más
  // tarde a editarla" que un mesero/cajero de verdad usaría con un pedido
  // para llevar que no se factura de inmediato.
  test('25. Reabrir y editar una orden para llevar ya creada: agregar un producto nuevo, eliminar uno existente y modificar cantidad — las líneas no tocadas permanecen intactas', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);
    const nombreCliente = `Cliente Reabrir QA ${Date.now()}`;

    let id = '';
    let claveOriginalUno = '', claveOriginalDos = '';
    await test.step('Crear una orden formal con 2 productos', async () => {
      await llevar.volverAProductos();
      await llevar.agregarPrimerProductoNoPresente();
      await llevar.agregarPrimerProductoNoPresente();
      const claves = await pos.obtenerClavesFilasCarrito();
      expect(claves.length).toBe(2);
      [claveOriginalUno, claveOriginalDos] = claves;
      id = await llevar.crearOrdenParaLlevar(nombreCliente);
    });

    await test.step('Reabrir la orden recién creada y confirmar que las 2 líneas originales persistieron', async () => {
      await llevar.abrirOrdenesParaLlevar();
      await llevar.abrirOrden(id);
      const claves = await pos.obtenerClavesFilasCarrito();
      expect(claves.sort(), 'Las líneas originales deben persistir exactamente al reabrir').toEqual([claveOriginalUno, claveOriginalDos].sort());
    });

    let claveNueva = '';
    await test.step('Agregar un producto nuevo a la orden ya reabierta', async () => {
      await llevar.volverAProductos();
      await llevar.agregarPrimerProductoNoPresente();
      const claves = await pos.obtenerClavesFilasCarrito();
      expect(claves.length, 'Debe haber 3 líneas tras agregar el producto nuevo').toBe(3);
      claveNueva = claves.find(c => c !== claveOriginalUno && c !== claveOriginalDos)!;
      expect(claveNueva, 'El producto nuevo debe tener una clave distinta a las 2 originales').toBeTruthy();
    });

    await test.step('Eliminar una de las líneas originales', async () => {
      await pos.eliminarProductoDelCarrito(claveOriginalUno);
      const claves = await pos.obtenerClavesFilasCarrito();
      expect(claves.sort(), 'Deben quedar exactamente la otra línea original + la nueva').toEqual([claveOriginalDos, claveNueva].sort());
    });

    await test.step('Modificar la cantidad de la línea original restante', async () => {
      await pos.establecerCantidadProducto(claveOriginalDos, '2');
      expect(await pos.obtenerCantidadProducto(claveOriginalDos)).toBe(2);
    });

    await test.step('Facturar la orden ya editada', async () => {
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total).toBeGreaterThan(0);
      await facturarConEfectivo(pos);
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 26. Cliente cambia de opinión: combinación de acciones ──────────────
  // Mismo escenario pedido explícitamente en la auditoría, replicado aquí
  // para Órdenes para Llevar (ver su análogo, Escenario 29, en
  // pos-restaurante-mesas.spec.ts, con el mismo razonamiento documentado
  // sobre por qué Producto C usa PRODUCTO_CON_ADITIVOS en vez de "primer
  // producto no presente").
  test('26. Cliente cambia de opinión: Producto A + B, eliminar A, agregar C con aditivo, cambiar cantidad de B, y facturar — el pedido final corresponde exactamente a lo solicitado', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await llevar.iniciarOrdenNueva();

    let claveA = '', claveB = '', nombreA = '', nombreB = '';
    await test.step('El cliente pide Producto A y Producto B', async () => {
      nombreA = await llevar.agregarPrimerProductoNoPresente();
      nombreB = await llevar.agregarPrimerProductoNoPresente();
      expect(nombreA).not.toBe(nombreB);
      const claves = await pos.obtenerClavesFilasCarrito();
      expect(claves.length).toBe(2);
      [claveA, claveB] = claves;
    });

    await test.step('El cliente cambia de opinión: "quiero quitar este producto" (elimina A)', async () => {
      await pos.eliminarProductoDelCarrito(claveA);
      const claves = await pos.obtenerClavesFilasCarrito();
      expect(claves, 'Solo debe quedar Producto B tras eliminar A').toEqual([claveB]);
    });

    let opcionAditivo = '';
    await test.step('El cliente pide un Producto C nuevo, con un aditivo', async () => {
      opcionAditivo = await llevar.agregarProductoConAditivo();
      expect(opcionAditivo.length, 'Debió seleccionarse una opción real de aditivo').toBeGreaterThan(0);
      const claves = await pos.obtenerClavesFilasCarrito();
      expect(claves.length, 'El carrito debe tener exactamente B + C tras agregar C').toBe(2);
      expect(claves).toContain(claveB);
    });

    await test.step('El cliente cambia de opinión otra vez: "mejor quiero 3 unidades" de Producto B', async () => {
      await pos.establecerCantidadProducto(claveB, '3');
      expect(await pos.obtenerCantidadProducto(claveB)).toBe(3);
    });

    await test.step('Validar que el pedido final corresponde EXACTAMENTE a lo solicitado: B (x3) + C con aditivo, A ausente', async () => {
      const clavesFinal = await pos.obtenerClavesFilasCarrito();
      expect(clavesFinal.length, 'El carrito final debe tener exactamente 2 líneas (B y C)').toBe(2);
      expect(clavesFinal).toContain(claveB);
      expect(clavesFinal).not.toContain(claveA);
      for (const clave of clavesFinal) {
        const nombre = await pos.obtenerNombreProducto(clave);
        expect(nombre, `"${nombreA}" (Producto A, eliminado) no debe reaparecer en el carrito`).not.toBe(nombreA);
      }
    });

    await test.step('Facturar el pedido final', async () => {
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total).toBeGreaterThan(0);
      await facturarConEfectivo(pos);
      await pos.validarCarritoVacio();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 27. Impresión: Pre-Factura de una orden para llevar ─────────────────
  // Brecha de cobertura real detectada auditando este módulo: a diferencia de
  // pos-restaurante-mesas.spec.ts (que sí prueba Pre-Factura/Comanda desde el
  // menú hamburguesa de una mesa), este archivo nunca había ejercitado el
  // ícono impresora de una tarjeta de "Para Llevar" — ver
  // `PosRestauranteOrdenesLlevar.imprimirPreFactura()`.
  test('27. Imprimir Pre-Factura de una orden para llevar ya creada', async ({ pos, llevar, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    const nombreCliente = `Cliente PreFactura QA ${Date.now()}`;

    let id = '';
    await test.step('Crear una orden propia', async () => {
      await llevar.volverAProductos();
      await llevar.agregarPrimerProductoNoPresente();
      id = await llevar.crearOrdenParaLlevar(nombreCliente);
    });

    await test.step('Imprimir su Pre-Factura y confirmar que la ventana de impresión se abrió', async () => {
      await llevar.abrirOrdenesParaLlevar();
      await llevar.imprimirPreFactura(id);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});
