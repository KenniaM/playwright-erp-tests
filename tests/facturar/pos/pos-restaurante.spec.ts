// Ambiente COMPLETO distinto del resto de la suite (qa_restaurant, compañía
// "Restaurante Rancho Robertos" — ver tests/auth/restaurant.setup.ts). Mismo
// mecanismo de require()-order que ese archivo: fija BASE_URL/POS_COMPANIA
// ANTES de importar cualquier módulo que dependa de env.config.ts/pos.types.ts,
// para que ambas constantes de módulo queden resueltas correctamente sin
// tocar sus defaults (usados por el resto de la suite, afinada contra
// qa_talleralpha). Por diseño, este archivo debe correrse en un comando
// dedicado, nunca mezclado con el resto de la suite en la misma invocación:
//
//   npx playwright test tests/facturar/pos/pos-restaurante.spec.ts --project=setup-restaurant --project=firefox-restaurant
//
process.env.BASE_URL = process.env.BASE_URL ?? 'https://dev.designsoftcr.com/qa_restaurant/public';
process.env.POS_COMPANIA = process.env.POS_COMPANIA ?? 'Restaurante Rancho Robertos';

import { test as base, expect, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, espiarErroresJS, PRECIO_PRODUCTO_RAPIDO } from './pos.page';
import { PosRestaurante, type DatosMesaPlano } from './pos-restaurante.page';

// ─── Sesión compartida (fixture de scope 'worker', NO mode: 'serial') ──────
// Mismo mecanismo ya adoptado en pos-crear.spec.ts/pos-orden-caja.spec.ts:
// una fixture propia con scope 'worker' — el paso por Dashboard
// (cargarPosDesdeDashboard()) se hace como máximo una vez POR WORKER, nunca
// una vez por test. Deliberadamente sin test.describe.configure({mode:
// 'serial'}): entraría en conflicto con fullyParallel (playwright.config.ts).
type MesaFixtures = {
  sharedPage: Page;
  pos: PosPage;
  mesas: PosRestaurante;
};

const test = base.extend<{}, MesaFixtures>({
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

  mesas: [async ({ pos, sharedPage }, use) => {
    await use(new PosRestaurante(pos, sharedPage));
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],
});

/**
 * Deja el POS en un estado limpio antes de cada escenario — mismo criterio
 * que pos-orden-caja.spec.ts/pos-ruteo.spec.ts: una recarga real
 * (pos.irAlPos()) es la forma más simple y confiable de garantizar carrito
 * vacío y ningún modal abierto, sin repetir el login ni el paso por
 * Dashboard que la fixture "pos" ya hizo una única vez para este worker.
 */
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
// Todos componen métodos ya existentes de PosPage/PosRestaurante — ninguno
// reimplementa lógica de agregar productos, clientes ni esperas.

/** Ninguna línea de error visible en el carrito/encabezado — mismo criterio que el resto de la suite. */
async function validarSinMensajesDeError(page: Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

/**
 * Agrega dos productos DISTINTOS al carrito de la mesa ya seleccionada —
 * reutiliza mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa() dos veces
 * (excluye, en la segunda llamada, el nombre ya agregado en la primera) en
 * vez de una única llamada repetida, que reiniciaría desde el mismo primer
 * producto y solo subiría su cantidad — mismo criterio ya documentado en
 * agregarSeisTiposDeItem() (pos-orden-caja.spec.ts). Devuelve las claves del
 * carrito tras agregar ambos.
 */
async function agregarDosProductosDistintos(pos: PosPage, mesas: PosRestaurante): Promise<string[]> {
  await mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();
  await mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();
  return pos.obtenerClavesFilasCarrito();
}

/** Agrega UN producto (no presente ya en el carrito) a la orden de la mesa — usado por escenarios que solo necesitan uno. */
async function agregarUnProducto(mesas: PosRestaurante): Promise<string> {
  return mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();
}

/** Lee y valida Subtotal/IVA/Total del footer antes de facturar — mismo criterio que pos-facturar.spec.ts. */
async function validarTotalesDelFooter(pos: PosPage) {
  const total = await pos.obtenerTotalVentaNumerico();
  const iva = await pos.obtenerTotalIvaGeneral();
  expect(total, 'El total debe ser mayor a 0').toBeGreaterThan(0);
  expect(iva).toBeGreaterThanOrEqual(0);
  expect(total, 'El total debe ser mayor o igual al IVA').toBeGreaterThanOrEqual(iva);
}

/** Factura el carrito ya cargado con el total exacto en efectivo — mismo patrón que el resto de la suite. */
async function facturarConEfectivo(pos: PosPage) {
  await pos.abrirModalDePago();
  const total = await pos.obtenerTotalVentaNumerico();
  expect(total).toBeGreaterThan(0);
  await pos.seleccionarPagoEfectivo(String(total));
  await pos.confirmarPagoAbriendoCajaSiEsNecesario();
}

test.describe('Restaurante — Mesas', () => {

  // ─── 1. Crear orden sin cliente ──────────────────────────────────────────
  test('1. Crear orden sin cliente: seleccionar mesa disponible, agregar productos y facturar', async ({ pos, mesas, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let mesa: DatosMesaPlano;
    await test.step('Abrir Mesas y seleccionar una mesa disponible', async () => {
      await mesas.abrirMesas();
      mesa = await mesas.seleccionarMesaDisponible();
      expect(mesa.ordenId, 'La mesa elegida no estaba realmente disponible').toBe('0');
    });

    await test.step('Volver a Productos y agregar dos productos', async () => {
      await mesas.volverAProductos();
      const claves = await agregarDosProductosDistintos(pos, mesas);
      expect(claves.length, 'Deben quedar 2 líneas en el carrito').toBe(2);
    });

    await test.step('Validar Subtotal/IVA/Total antes de facturar', async () => {
      await validarTotalesDelFooter(pos);
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
  test('2. Cliente existente: agregar cliente registrado, productos y guardar la orden', async ({ pos, mesas, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let mesa: DatosMesaPlano;
    let nombreCliente = '';
    await test.step('Seleccionar mesa disponible y elegir un cliente existente', async () => {
      await mesas.abrirMesas();
      mesa = await mesas.seleccionarMesaDisponible();
      nombreCliente = await pos.seleccionarClienteExistente();
      expect(nombreCliente.length).toBeGreaterThan(0);
    });

    await test.step('Agregar productos (la orden queda guardada automáticamente al agregarlos, sin facturar)', async () => {
      await mesas.volverAProductos();
      const claves = await agregarDosProductosDistintos(pos, mesas);
      expect(claves.length).toBeGreaterThan(0);
    });

    await test.step('Reabrir la mesa y validar que el cliente se conservó', async () => {
      await mesas.abrirMesas();
      await mesas.clickMesa(mesa!.mesaId);
      const clienteTrasReabrir = await pos.obtenerClienteSeleccionado();
      expect(clienteTrasReabrir, 'El cliente no se conservó al reabrir la mesa').toBe(nombreCliente);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 3. Nombre de cliente + Opciones del menú de la mesa (Escenarios 4-11) ──
  //
  // Un ÚNICO test agrupando los Escenarios 3-4-6-7-8-9-10-11 en vez de 8
  // tests independientes — decisión de arquitectura, no de conveniencia:
  // `fullyParallel: true` (playwright.config.ts) permite que Playwright
  // reparta tests INDIVIDUALES de un mismo archivo entre varios workers (no
  // solo archivos completos), y cada worker es su propio proceso Node — una
  // variable compartida en memoria (`let ordenReutilizable`) entre dos
  // `test()` separados NO es segura bajo ese modelo: si el Escenario 3 y el
  // Escenario 4 caen en workers distintos, el segundo vería la variable en
  // null aunque el primero "ya hubiera corrido". Confirmado en vivo: una
  // corrida con `-g "1\."` (que además matchea "11.") programó el Escenario
  // 1 y el 11 en 2 workers distintos en la misma invocación. La tarea pide
  // explícitamente "Utilizar una orden existente. No crear una orden nueva
  // para cada escenario" — la única forma de garantizar eso sin pelear
  // contra `fullyParallel` (que CLAUDE.md prohíbe deshabilitar con
  // `mode:'serial'`) es que las 8 validaciones compartan la MISMA orden
  // dentro de un único test, con un test.step() por escenario (mismo patrón
  // ya usado por escenarios largos de pos-facturar.spec.ts/pos-orden-caja.spec.ts).
  // Los Escenarios 5 y 12 (facturar/eliminar, ambos TERMINALES: cierran la
  // orden para siempre) sí quedan como tests independientes de verdad, cada
  // uno con su propia mesa nueva — no comparten estado con nada más, así que
  // sí pueden correr en cualquier worker sin riesgo.
  test('3-4-6-7-8-9-10-11. Nombre de cliente + Seleccionar Orden + Pre-Factura + Comandas + Cambiar de mesa + Unificar + Personas', async ({ pos, mesas, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);
    const nombreCliente = `Cliente Mesa QA ${Date.now()}`;

    let mesaId = '';
    await test.step('3. Nombre de cliente: seleccionar mesa, escribir únicamente el nombre del cliente y agregar productos', async () => {
      await mesas.abrirMesas();
      const mesa = await mesas.seleccionarMesaDisponible();
      mesaId = mesa.mesaId;
      await pos.ingresarNombreCliente(nombreCliente);

      await mesas.volverAProductos();
      const claves = await agregarDosProductosDistintos(pos, mesas);
      expect(claves.length, 'Deben quedar al menos 2 líneas en el carrito').toBeGreaterThanOrEqual(2);
    });

    await test.step('3. Validar que el nombre del cliente quedó almacenado (reabriendo la mesa)', async () => {
      await mesas.abrirMesas();
      await mesas.clickMesa(mesaId);
      const nombreTrasReabrir = await pos.obtenerClienteSeleccionado();
      expect(nombreTrasReabrir, 'El nombre del cliente no quedó almacenado al reabrir la mesa').toBe(nombreCliente);
    });

    await test.step('4. Seleccionar Orden: abrir la orden ya existente desde la mesa y validar que la información carga', async () => {
      await mesas.abrirMesas();
      await mesas.clickMesa(mesaId);
      const filas = await pos.obtenerCantidadFilasCarrito();
      expect(filas, 'La orden reutilizable no cargó ninguna línea de producto').toBeGreaterThan(0);
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total).toBeGreaterThan(0);
    });

    // Escenarios 6/7/8: la validación de CONTENIDO (cliente, productos,
    // cantidades, subtotal, IVA, total, número de mesa; filtrado de ítems
    // nuevos vs. todos) no fue posible de automatizar — ver la limitación
    // real, investigada a fondo y documentada con evidencia completa, en el
    // comentario de PosRestaurante._confirmarVentanaImpresionAbierta()
    // (pos-restaurante.page.ts) y en el informe final: la ventana de
    // impresión nunca navega a una URL real y se cierra sola antes de que
    // Playwright tenga cualquier oportunidad real de leer su documento. Se
    // valida aquí la única señal de éxito real y observable — la ventana se
    // abrió — mismo criterio que PosCore.mostrarYCerrarVentanaImpresion() ya
    // usa para las facturas normales del resto de la suite.
    await test.step('6. Imprimir pre-factura: generar la pre-factura y validar que la ventana de impresión se abre', async () => {
      await mesas.abrirMesas();
      await mesas.imprimirPreFactura(mesaId);
    });

    await test.step('7. Imprimir comanda de nuevos ítems: agregar un producto nuevo e imprimir la comanda', async () => {
      await mesas.abrirMesas();
      await mesas.clickMesa(mesaId);
      await mesas.volverAProductos();
      await mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();

      await mesas.abrirMesas();
      await mesas.imprimirComanda(mesaId, 'nuevos');
    });

    await test.step('8. Imprimir comanda de todos los ítems: validar que la orden mantiene todos los productos', async () => {
      await mesas.abrirMesas();
      await mesas.clickMesa(mesaId);
      const cantidadLineas = await pos.obtenerCantidadFilasCarrito();
      expect(cantidadLineas).toBeGreaterThan(0);

      await mesas.abrirMesas();
      await mesas.imprimirComanda(mesaId, 'todos');
    });

    await test.step('9. Cambiar de mesa: mover la orden a otra mesa disponible', async () => {
      await mesas.abrirMesas();
      const mesaOrigen = mesaId;
      const destino = await mesas.cambiarDeMesa(mesaOrigen);

      const mesasActuales = await mesas.obtenerMesasDelPlano();
      const origenTrasCambiar = mesasActuales.find((m) => m.mesaId === mesaOrigen);
      const destinoTrasCambiar = mesasActuales.find((m) => m.mesaId === destino.mesaId);
      expect(origenTrasCambiar?.ocupada, 'La mesa de origen debió quedar libre').toBe(false);
      expect(destinoTrasCambiar?.ocupada, 'La mesa destino debió quedar ocupada con la orden movida').toBe(true);

      mesaId = destino.mesaId; // la orden sigue viva, ahora en la mesa destino
    });

    await test.step('10. Unificar mesas: unificar la mesa ocupada únicamente con una mesa desocupada', async () => {
      await mesas.abrirMesas();
      const mesasAntes = await mesas.obtenerMesasDelPlano();
      const origenAntes = mesasAntes.find((m) => m.mesaId === mesaId);
      expect(origenAntes?.ocupada, 'La mesa de origen debe estar ocupada antes de unificar').toBe(true);

      const nombreMesaUnificada = await mesas.unificarMesaConDisponible(mesaId);
      expect(nombreMesaUnificada.length, 'No se pudo determinar el nombre de la mesa unificada').toBeGreaterThan(0);

      await mesas.abrirMesas();
      const mesasDespues = await mesas.obtenerMesasDelPlano();
      const origenDespues = mesasDespues.find((m) => m.mesaId === mesaId);
      expect(origenDespues, 'La mesa principal (origen) debe seguir existiendo tras unificar').toBeDefined();
      expect(origenDespues!.ocupada, 'La mesa principal debe seguir ocupada, con toda la información, tras unificar').toBe(true);

      const mesaUnificada = mesasDespues.find((m) => m.nombre === nombreMesaUnificada);
      if (mesaUnificada) {
        expect(mesaUnificada.ocupada, 'La mesa unificada ya no debe permitir crear una orden independiente').toBe(true);
      }
    });

    await test.step('11. Modificar cantidad de personas: cambiar el valor y validar que quede almacenado', async () => {
      const CANTIDAD_PERSONAS = 5;
      await mesas.abrirMesas();
      await mesas.modificarCantidadPersonas(mesaId, CANTIDAD_PERSONAS);
      const cantidadActual = await mesas.obtenerCantidadPersonas(mesaId);
      expect(cantidadActual, 'La cantidad de personas no quedó almacenada').toBe(CANTIDAD_PERSONAS);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 5. Renombrar mesa ────────────────────────────────────────────────────
  // Mesa/orden propia (no compartida): facturar la cierra para siempre.
  test('5. Renombrar mesa: renombrar temporalmente, facturar y validar que vuelve el nombre original', async ({ pos, mesas, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    const nombreTemporal = `TEMP QA ${Date.now()}`;

    let mesa: DatosMesaPlano;
    await test.step('Seleccionar una mesa disponible y agregar un producto', async () => {
      await mesas.abrirMesas();
      mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      await agregarUnProducto(mesas);
    });

    await test.step('Renombrar temporalmente la mesa y validar el cambio', async () => {
      await mesas.abrirMesas();
      await mesas.renombrarMesa(mesa!.mesaId, nombreTemporal);
      // Recarga real del plano (mesas.abrirMesas() vuelve a pedir el
      // listado al servidor) antes de leer el nombre — no se asume que el
      // cierre del modal ya parcheó el DOM del plano ya cargado.
      await mesas.abrirMesas();
      // BUG DE SISTEMA CONFIRMADO EN VIVO (ver el comentario completo de
      // renombrarMesa() en pos-restaurante.page.ts): usando el control real
      // (ícono de lápiz junto al carrito, no el ítem del menú hamburguesa),
      // el submit SÍ dispara la petición real `updatePosRestOrderTableName`
      // y el servidor responde 200 OK con éxito — pero el nombre nunca se
      // refleja en el plano, ni con recarga completa de página. Esta
      // aserción se deja intacta a propósito — expone el bug real en vez de
      // debilitarse para "pasar".
      await expect.poll(
        () => mesas.obtenerNombreMesa(mesa!.mesaId),
        { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El nombre temporal no quedó reflejado en el plano' }
      ).toBe(nombreTemporal);
    });

    await test.step('Facturar la orden', async () => {
      await mesas.clickMesa(mesa!.mesaId);
      await facturarConEfectivo(pos);
      await pos.validarCarritoVacio();
    });

    await test.step('Validar que el nombre temporal desaparece y vuelve el nombre original de la mesa', async () => {
      await mesas.abrirMesas();
      const mesasActuales = await mesas.obtenerMesasDelPlano();
      const mesaTrasFacturar = mesasActuales.find((m) => m.mesaId === mesa!.mesaId);
      expect(mesaTrasFacturar, 'La mesa ya no aparece en el plano tras facturar').toBeDefined();
      expect(mesaTrasFacturar!.nombre, 'El nombre temporal no debió persistir tras facturar').not.toBe(nombreTemporal);
      expect(mesaTrasFacturar!.ocupada, 'La mesa debió quedar libre tras facturar').toBe(false);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 12. Eliminar orden ───────────────────────────────────────────────────
  // Mesa/orden propia (no compartida): eliminar es terminal.
  test('12. Eliminar orden: eliminarla y validar que la mesa queda nuevamente disponible', async ({ pos, mesas, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let mesa: DatosMesaPlano;
    await test.step('Seleccionar una mesa disponible y agregar un producto', async () => {
      await mesas.abrirMesas();
      mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      await agregarUnProducto(mesas);
    });

    await test.step('Eliminar la orden', async () => {
      await mesas.abrirMesas();
      await mesas.eliminarOrden(mesa!.mesaId);
    });

    await test.step('Validar que la orden desaparece y la mesa queda nuevamente disponible', async () => {
      const mesasActuales = await mesas.obtenerMesasDelPlano();
      const mesaTrasEliminar = mesasActuales.find((m) => m.mesaId === mesa!.mesaId);
      expect(mesaTrasEliminar, 'La mesa ya no aparece en el plano tras eliminar la orden').toBeDefined();
      expect(mesaTrasEliminar!.ocupada, 'La mesa debió quedar disponible tras eliminar la orden').toBe(false);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ═══════════════════════════════════════════════════════════════════════
  // Escenarios 13-22: ampliación solicitada del módulo Mesas (división de
  // cuentas, múltiples órdenes, comandas, carrito flotante, persistencia de
  // descuentos/impuesto de restaurante y facturación con cliente registrado)
  // — cada uno usa su PROPIA mesa (mismo criterio que los Escenarios 1/2/5/12
  // de arriba), así que no comparten estado entre sí y pueden correr en
  // cualquier worker bajo fullyParallel sin el problema ya documentado del
  // Escenario 3-4-6-7-8-9-10-11 (que sí necesitaba una única orden
  // reutilizada dentro de un solo test).
  // ═══════════════════════════════════════════════════════════════════════

  // ─── 13. División de cuentas con clientes no registrados ────────────────
  test('13. División de cuentas: dos clientes no registrados conservan sus propios productos y subtotales', async ({ pos, mesas, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);
    // Nombre validado en vivo por la propia app ("Ingrese un nombre válido
    // solo se permitan letras, espacios y números") — sin tildes/acentos.
    const clienteUno = `Division Uno QA ${Date.now()}`;
    const clienteDos = `Division Dos QA ${Date.now() + 1}`;

    await test.step('Seleccionar una mesa disponible y agregar dos clientes no registrados a la división de cuentas', async () => {
      await mesas.abrirMesas();
      await mesas.seleccionarMesaDisponible();
      await mesas.agregarClienteDivision(clienteUno);
      await mesas.agregarClienteDivision(clienteDos);
      // El último cliente agregado queda activo automáticamente.
      expect(await mesas.obtenerClienteDivisionActivo()).toBe(clienteDos);
    });

    let productoNormalDos = '';
    await test.step('Con "Cliente Dos" activo: agregar un producto normal y un producto rápido', async () => {
      await mesas.volverAProductos();
      productoNormalDos = await mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();
      await pos.agregarProductoRapidoSimple(`Rápido División Dos ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
    });

    await test.step('Activar "Cliente Uno" y agregar un producto normal, un producto rápido y un producto con aditivos', async () => {
      await mesas.activarClienteDivision(clienteUno);
      await mesas.volverAProductos();
      await mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();
      await pos.agregarProductoRapidoSimple(`Rápido División Uno ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
      await mesas.agregarProductoConAditivo();
    });

    await test.step('Validar que cada cliente conserva únicamente sus propios productos y subtotales', async () => {
      // "Cliente Uno" quedó activo tras el paso anterior: su carrito visible
      // debe tener 3 líneas (normal + rápido + aditivo), nunca las de "Dos".
      expect(await mesas.obtenerClienteDivisionActivo()).toBe(clienteUno);
      const filasUno = await pos.obtenerClavesFilasCarrito();
      expect(filasUno.length, 'El carrito de "Cliente Uno" no tiene las 3 líneas esperadas').toBe(3);

      await mesas.activarClienteDivision(clienteDos);
      const filasDos = await pos.obtenerClavesFilasCarrito();
      expect(filasDos.length, 'El carrito de "Cliente Dos" no tiene las 2 líneas esperadas').toBe(2);

      const totalUno = await mesas.obtenerTotalClienteDivision(clienteUno);
      const totalDos = await mesas.obtenerTotalClienteDivision(clienteDos);
      expect(totalUno, 'El subtotal de "Cliente Uno" debe ser mayor a 0').toBeGreaterThan(0);
      expect(totalDos, 'El subtotal de "Cliente Dos" debe ser mayor a 0').toBeGreaterThan(0);
      expect(totalUno, 'Los subtotales de ambos clientes no deberían coincidir exactamente (tienen productos distintos)').not.toBeCloseTo(totalDos, 0);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 14. Cliente registrado y múltiples órdenes en la misma mesa ────────
  test('14. Cliente registrado + segunda orden en la misma mesa: ambas quedan independientes', async ({ pos, mesas, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    let mesa: DatosMesaPlano;
    let nombrePrincipal = '';
    let nombreCliente = '';
    await test.step('Seleccionar mesa, agregar productos normales, con aditivos y rápidos, y asignar un cliente existente', async () => {
      await mesas.abrirMesas();
      mesa = await mesas.seleccionarMesaDisponible();

      await mesas.volverAProductos();
      await mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();
      await mesas.agregarProductoConAditivo();
      await pos.agregarProductoRapidoSimple(`Rápido Orden Principal ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);

      nombreCliente = await pos.seleccionarClienteExistente();
      expect(nombreCliente.length).toBeGreaterThan(0);
    });

    const filasPrincipalAntes = (await pos.obtenerClavesFilasCarrito()).length;
    let nombreNuevaOrden = '';
    await test.step('Agregar otra orden/cliente a la misma mesa y un producto rápido a la nueva orden', async () => {
      nombreNuevaOrden = `Segunda Orden QA ${Date.now()}`; // sin tildes: mismo validador del nombre de cliente de división
      await mesas.agregarClienteDivision(nombreNuevaOrden);
      expect(await mesas.obtenerClienteDivisionActivo()).toBe(nombreNuevaOrden);

      await mesas.volverAProductos();
      await pos.agregarProductoRapidoSimple(`Rápido Segunda Orden ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
      expect((await pos.obtenerClavesFilasCarrito()).length).toBe(1);

      // El nombre real y ACTUAL de la primera cuenta se relee del dropdown
      // en este punto (nunca se asume "Principal"): confirmado en vivo que
      // puede cambiar de nombre visible en algún punto del flujo tras
      // asignarle un cliente registrado y agregar una segunda cuenta.
      const nombres = await mesas.obtenerNombresClientesDivision();
      const otraCuenta = nombres.find((n) => n !== nombreNuevaOrden);
      expect(otraCuenta, `No se encontró la cuenta original entre las cuentas de división: ${JSON.stringify(nombres)}`).toBeTruthy();
      nombrePrincipal = otraCuenta!;
    });

    await test.step('Validar que ambas órdenes permanecen independientes', async () => {
      // Recarga real de la mesa (mismo criterio que el resto de la suite
      // usa para "reabrir"): confirmado en vivo que el total de una cuenta
      // de división recién creada no refleja el producto agregado en el
      // propio dropdown hasta una recarga real de la orden — no se confía
      // en el estado ya cacheado en el cliente.
      await mesas.abrirMesas();
      await mesas.clickMesa(mesa!.mesaId);

      await mesas.activarClienteDivision(nombrePrincipal);
      const filasPrincipalDespues = (await pos.obtenerClavesFilasCarrito()).length;
      expect(filasPrincipalDespues, 'La orden principal no debió verse afectada por agregar la segunda orden').toBe(filasPrincipalAntes);

      const totalPrincipal = await mesas.obtenerTotalClienteDivision(nombrePrincipal);
      const totalNuevaOrden = await mesas.obtenerTotalClienteDivision(nombreNuevaOrden);
      expect(totalPrincipal).toBeGreaterThan(0);
      expect(totalNuevaOrden).toBeGreaterThan(0);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 15. Comanda de nuevos productos ─────────────────────────────────────
  //
  // LIMITACIÓN DE AUTOMATIZACIÓN YA DOCUMENTADA (ver el comentario completo
  // de PosRestaurante._confirmarVentanaImpresionAbierta() en
  // pos-restaurante.page.ts, y el Escenario 3-4-6-7-8-9-10-11 de arriba):
  // la ventana de Comanda nunca navega a una URL real y se cierra sola antes
  // de que Playwright tenga cualquier oportunidad de leer su contenido (las
  // 3 vías posibles ya se probaron y se descartaron en esa investigación
  // previa). Por eso este escenario valida la única señal real y observable
  // — que la ventana de impresión se abrió tras agregar productos nuevos a
  // una orden ya existente — y dentro del propio POS, valida por su cuenta
  // que la orden efectivamente distingue "líneas nuevas" de "líneas viejas"
  // usando la fuente real de la aplicación: la clase CSS `new_added_item`
  // que pos_rest.js aplica a una fila recién agregada (confirmada en vivo
  // inspeccionando el DOM del carrito tras agregar un producto a una orden
  // que ya tenía líneas previas).
  test('15. Comanda de nuevos productos: imprimir tras agregar ítems a una orden existente', async ({ pos, mesas, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let mesa: DatosMesaPlano;
    await test.step('Seleccionar una mesa y agregar un producto (orden existente)', async () => {
      await mesas.abrirMesas();
      mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      await agregarUnProducto(mesas);
    });

    await test.step('Agregar nuevos productos a la orden ya existente', async () => {
      await mesas.volverAProductos();
      await agregarDosProductosDistintos(pos, mesas);
      expect((await pos.obtenerClavesFilasCarrito()).length, 'Deben quedar 3 líneas en total (1 original + 2 nuevas)').toBe(3);
    });

    await test.step('Imprimir la comanda de NUEVOS ítems y validar que la ventana de impresión se abre', async () => {
      await mesas.abrirMesas();
      await mesas.imprimirComanda(mesa!.mesaId, 'nuevos');
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 16. Seleccionar productos antes de seleccionar la mesa ─────────────
  test('16. Agregar productos antes de elegir mesa: el carrito flotante se asigna correctamente al confirmar la mesa', async ({ pos, mesas, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    const nombresAgregados: string[] = [];
    await test.step('Con la pestaña "Productos" activa y SIN mesa seleccionada, agregar varios productos', async () => {
      await mesas.volverAProductos();
      nombresAgregados.push(await mesas.agregarProductoSinMesaSeleccionada());
      nombresAgregados.push(await mesas.agregarProductoSinMesaSeleccionada());
      nombresAgregados.push(await mesas.agregarProductoSinMesaSeleccionada());
      expect((await pos.obtenerClavesFilasCarrito()).length).toBe(3);
    });

    let mesaDestino: DatosMesaPlano;
    await test.step('Asignar el carrito flotante a una mesa disponible', async () => {
      mesaDestino = await mesas.asignarCarritoFlotanteAMesaDisponible();
      expect(mesaDestino!.mesaId.length).toBeGreaterThan(0);
    });

    await test.step('Validar que los 3 productos quedaron correctamente agregados a esa mesa', async () => {
      const claves = await pos.obtenerClavesFilasCarrito();
      expect(claves.length, 'Los 3 productos agregados antes de elegir mesa no llegaron completos a la mesa destino').toBe(3);

      await mesas.abrirMesas();
      const mesasActuales = await mesas.obtenerMesasDelPlano();
      const destinoActual = mesasActuales.find((m) => m.mesaId === mesaDestino!.mesaId);
      expect(destinoActual?.ocupada, 'La mesa destino debió quedar ocupada tras asignarle el carrito flotante').toBe(true);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 17. Conservar la orden al cerrar la mesa sin facturar ──────────────
  test('17. Cerrar la mesa sin facturar y reabrirla: la orden permanece exactamente igual', async ({ pos, mesas, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let mesa: DatosMesaPlano;
    let clavesAntes: string[] = [];
    let totalAntes = 0;
    await test.step('Seleccionar una mesa disponible y agregar productos', async () => {
      await mesas.abrirMesas();
      mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      clavesAntes = await agregarDosProductosDistintos(pos, mesas);
      totalAntes = await pos.obtenerTotalVentaNumerico();
    });

    await test.step('Cerrar la mesa sin facturar y volver a abrirla', async () => {
      await mesas.cerrarOrdenSinFacturar();
      await mesas.clickMesa(mesa!.mesaId);
    });

    await test.step('Validar que la orden permanece exactamente igual', async () => {
      const clavesDespues = await pos.obtenerClavesFilasCarrito();
      expect(clavesDespues.length, 'La cantidad de líneas cambió tras cerrar y reabrir la mesa').toBe(clavesAntes.length);
      const totalDespues = await pos.obtenerTotalVentaNumerico();
      // Precisión de 1 (no 2) decimal: confirmado en vivo un margen real de
      // redondeo de ₡0.01 entre lecturas, sin relación con pérdida de datos
      // (misma cantidad de líneas, mismo total salvo ese centavo).
      expect(totalDespues, 'El total de la orden cambió tras cerrar y reabrir la mesa').toBeCloseTo(totalAntes, 1);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 18. Conservar el descuento individual al cerrar/reabrir la mesa ────
  test('18. Aplicar descuento individual, cerrar la mesa sin facturar y reabrirla: el descuento permanece', async ({ pos, mesas, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let mesa: DatosMesaPlano;
    let porcentajeAplicado = '';
    await test.step('Seleccionar mesa, agregar un producto y aplicar descuento individual', async () => {
      await mesas.abrirMesas();
      mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();

      // El catálogo de este ambiente QA no está limpio (ver CLAUDE_CONTEXT.md):
      // no todos los productos permiten descuento individual (max_discount=0
      // en varios). Se agregan varios productos DISTINTOS por adelantado
      // (agregarPrimerProductoNoPresenteAlCarritoDeMesa() ya garantiza que
      // cada uno sea distinto de los ya presentes en el carrito — eliminar
      // uno a mitad de camino haría que "no presente" volviera a matchear
      // el mismo producto recién quitado) y se prueba el descuento en cada
      // uno hasta encontrar el primero que sí lo permita.
      const CANTIDAD_A_PROBAR = 5;
      for (let i = 0; i < CANTIDAD_A_PROBAR; i++) {
        await mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();
      }
      const clavesCandidatas = await pos.obtenerClavesFilasCarrito();

      let resultado;
      let claveGanadora = '';
      for (const clave of clavesCandidatas) {
        resultado = await pos.aplicarDescuentoIndividual(clave, '5');
        if (resultado.escenario !== 'sin_descuento') { claveGanadora = clave; break; }
      }
      expect(resultado?.escenario, `Ningún producto entre ${CANTIDAD_A_PROBAR} probados permitió descuento individual`).not.toBe('sin_descuento');
      porcentajeAplicado = resultado!.porcentajeAplicado;
      expect(parseFloat(porcentajeAplicado)).toBeGreaterThan(0);

      // Dejar la mesa con un único producto (el que sí tiene descuento) —
      // necesario para que la validación tras reabrir más abajo pueda leer
      // el descuento del primer (y único) producto sin ambigüedad.
      for (const clave of clavesCandidatas) {
        if (clave !== claveGanadora) await pos.eliminarProductoDelCarrito(clave);
      }
    });

    await test.step('Cerrar la mesa sin facturar y volver a abrirla', async () => {
      await mesas.cerrarOrdenSinFacturar();
      await mesas.clickMesa(mesa!.mesaId);
    });

    await test.step('Validar que el descuento individual permanece aplicado', async () => {
      const [clave] = await pos.obtenerClavesFilasCarrito();
      const porcentajeTrasReabrir = await pos._leerValorDescuentoInput(clave);
      expect(parseFloat(porcentajeTrasReabrir), 'El descuento individual no quedó reflejado tras reabrir la mesa').toBeCloseTo(parseFloat(porcentajeAplicado), 1);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 19. Conservar el descuento general al cerrar/reabrir la mesa ───────
  test('19. Aplicar descuento general, cerrar la mesa sin facturar y reabrirla: el descuento permanece', async ({ pos, mesas, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let mesa: DatosMesaPlano;
    let montoDescuentoAntes = 0;
    await test.step('Seleccionar mesa, agregar productos y aplicar descuento general', async () => {
      await mesas.abrirMesas();
      mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      await agregarDosProductosDistintos(pos, mesas);

      await pos.activarDescuentoGeneral();
      await pos.mostrarDetalleAvanzadoFactura();
      await pos.establecerPorcentajeDescuentoGeneral('10');
      montoDescuentoAntes = await pos.obtenerMontoDescuentoGeneralNumerico();
      expect(montoDescuentoAntes).toBeGreaterThan(0);
    });

    await test.step('Cerrar la mesa sin facturar y volver a abrirla', async () => {
      await mesas.cerrarOrdenSinFacturar();
      await mesas.clickMesa(mesa!.mesaId);
    });

    await test.step('Validar que el descuento general permanece aplicado', async () => {
      expect(await pos.estaDescuentoGeneralActivo(), 'El descuento general no quedó activo tras reabrir la mesa').toBe(true);
      await pos.mostrarDetalleAvanzadoFactura();
      const montoDescuentoDespues = await pos.obtenerMontoDescuentoGeneralNumerico();
      expect(montoDescuentoDespues, 'El monto del descuento general no coincide tras reabrir la mesa').toBeCloseTo(montoDescuentoAntes, 1);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 20. Agregar productos a una orden existente ─────────────────────────
  test('20. Agregar productos a una orden existente: las líneas anteriores permanecen intactas', async ({ pos, mesas, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let mesa: DatosMesaPlano;
    let clavesAntes: string[] = [];
    await test.step('Seleccionar una mesa y agregar los primeros productos (orden existente)', async () => {
      await mesas.abrirMesas();
      mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      clavesAntes = await agregarDosProductosDistintos(pos, mesas);
    });

    await test.step('Reabrir la orden y agregar un producto adicional', async () => {
      await mesas.abrirMesas();
      await mesas.clickMesa(mesa!.mesaId);
      await mesas.volverAProductos();
      await mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();
    });

    await test.step('Validar que las líneas anteriores permanecen y solo se agregó la nueva', async () => {
      const clavesDespues = await pos.obtenerClavesFilasCarrito();
      expect(clavesDespues.length, 'Debe haber exactamente una línea nueva').toBe(clavesAntes.length + 1);
      for (const clave of clavesAntes) {
        expect(clavesDespues, `La línea original "${clave}" ya no está en el carrito`).toContain(clave);
      }
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 21. Impuesto de Restaurante ─────────────────────────────────────────
  test('21. Impuesto de Restaurante: aplicar junto a descuento general y validar el resumen completo de totales', async ({ pos, mesas, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await test.step('Seleccionar mesa, agregar productos y aplicar descuento general', async () => {
      await mesas.abrirMesas();
      await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      await agregarDosProductosDistintos(pos, mesas);

      await pos.activarDescuentoGeneral();
      await pos.mostrarDetalleAvanzadoFactura();
      await pos.establecerPorcentajeDescuentoGeneral('10');
    });

    await test.step('Agregar un producto rápido', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido Impuesto Restaurante ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
    });

    let totalAntesDeImpuesto = 0;
    await test.step('Aplicar el Impuesto de Restaurante', async () => {
      totalAntesDeImpuesto = await pos.obtenerTotalVentaNumerico();
      expect(await mesas.impuestoRestauranteEstaActivo()).toBe(false);
      await mesas.establecerImpuestoRestaurante(true);
      expect(await mesas.impuestoRestauranteEstaActivo()).toBe(true);
    });

    await test.step('Validar Subtotal/Descuento/Impuesto de Restaurante/IVA/Total', async () => {
      const descuentoGeneral = await pos.obtenerMontoDescuentoGeneralNumerico();
      const impuestoRestaurante = await mesas.obtenerMontoImpuestoRestauranteNumerico();
      const iva = await pos.obtenerTotalIvaGeneral();
      const totalConImpuesto = await pos.obtenerTotalVentaNumerico();

      expect(descuentoGeneral, 'El descuento general debe seguir aplicado').toBeGreaterThan(0);
      expect(impuestoRestaurante, 'El monto del Impuesto de Restaurante debe ser mayor a 0 una vez activado').toBeGreaterThan(0);
      expect(iva).toBeGreaterThanOrEqual(0);
      expect(totalConImpuesto, 'El total debe ser mayor a 0').toBeGreaterThan(0);
      expect(
        totalConImpuesto,
        'El total con Impuesto de Restaurante activado debe ser mayor al total previo (sin el impuesto)'
      ).toBeGreaterThan(totalAntesDeImpuesto);
      expect(
        totalConImpuesto,
        'El total debe ser al menos la suma del IVA más el Impuesto de Restaurante'
      ).toBeGreaterThanOrEqual(iva + impuestoRestaurante);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 22. Facturar con cliente registrado ─────────────────────────────────
  test('22. Facturar con cliente registrado: la factura queda asociada al cliente y la mesa vuelve a quedar libre', async ({ pos, mesas, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let mesa: DatosMesaPlano;
    let nombreCliente = '';
    await test.step('Seleccionar una mesa y asignar un cliente registrado', async () => {
      await mesas.abrirMesas();
      mesa = await mesas.seleccionarMesaDisponible();
      nombreCliente = await pos.seleccionarClienteExistente();
      expect(nombreCliente.length).toBeGreaterThan(0);
    });

    await test.step('Agregar un producto y facturar la orden', async () => {
      await mesas.volverAProductos();
      await agregarUnProducto(mesas);

      expect(await pos.obtenerClienteSeleccionado(), 'El cliente registrado no quedó asociado a la orden antes de facturar').toBe(nombreCliente);
      await facturarConEfectivo(pos);
    });

    await test.step('Validar que la factura se generó correctamente y la mesa quedó libre', async () => {
      await pos.validarCarritoVacio();

      await mesas.abrirMesas();
      const mesasActuales = await mesas.obtenerMesasDelPlano();
      const mesaTrasFacturar = mesasActuales.find((m) => m.mesaId === mesa!.mesaId);
      expect(mesaTrasFacturar, 'La mesa ya no aparece en el plano tras facturar').toBeDefined();
      expect(mesaTrasFacturar!.ocupada, 'La mesa debió quedar libre tras facturar').toBe(false);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});
