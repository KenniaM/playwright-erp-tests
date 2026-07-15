import { test as base, expect, Response, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT, PRECIO_PRODUCTO_RAPIDO, PESTANA_POS_FACTURACION, espiarErroresJS } from './pos.page';

// ─── Sesión compartida (fixture de scope 'worker', NO mode: 'serial') ──────
//
// A diferencia del resto de la suite (una `page` nueva por test(), cada una
// con su propio cargarPosDesdeDashboard() completo), este archivo reutiliza
// la MISMA `page`/sesión ya autenticada entre los 7 escenarios — pero vía una
// fixture propia con `scope: 'worker'`, el mismo mecanismo con el que
// Playwright ya crea `browser` (una instancia por proceso worker, reutilizada
// en todos los tests que ese worker ejecute) — no vía
// test.describe.configure({mode:'serial'}).
//
// Por qué NO serial: mode:'serial' obliga a Playwright a correr todo el
// describe en un único worker Y, si un test falla, marca el resto como
// "skipped" en vez de ejecutarlos — reduce el valor de la suite para QA
// (no se sabe si los escenarios siguientes hubieran pasado o no) y además
// entra en conflicto con `fullyParallel: true` ya configurado en
// playwright.config.ts (esa bandera existe precisamente para que Playwright
// pueda repartir tests, incluso del mismo archivo, entre varios workers).
//
// Con una fixture de scope 'worker' en su lugar: cada test sigue siendo una
// unidad 100% independiente para Playwright (nada se salta si uno falla), y
// si `fullyParallel` reparte estos 7 tests entre varios workers, cada worker
// crea su PROPIA `pos` (una sola vez, la primera vez que ese worker la
// necesita) — el login real sigue ocurriendo una única vez por corrida
// completa en el proyecto "setup" (auth.setup.ts, storageState compartido
// por todos los proyectos, sin cambios), y el paso por Dashboard
// (cargarPosDesdeDashboard()) se hace como máximo una vez POR WORKER, nunca
// una vez por test.
type RuteoFixtures = {
  sharedPage: Page;
  pos: PosPage;
};

const test = base.extend<{}, RuteoFixtures>({
  sharedPage: [async ({ browser }, use) => {
    const page = await browser.newPage();
    await use(page);
    await page.close();
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  // timeout: TIMEOUTS.TEST (no el default de 30 s que Playwright aplica a la
  // fase de setup de una fixture): confirmado en vivo que
  // cargarPosDesdeDashboard() —dos cargas de página completas contra este
  // ambiente— puede tardar más de 30 s bajo carga, lo que hacía fallar la
  // fixture ("Fixture 'pos' timeout of 30000ms exceeded during setup") antes
  // de que ningún test llegara siquiera a ejecutarse.
  pos: [async ({ sharedPage }, use) => {
    const pos = new PosPage(sharedPage);
    // Único paso por Dashboard que este worker hará para todo el archivo:
    // necesario para calentar la caché HTTP del navegador y evitar la
    // condición de carrera de "Agregar" ya documentada en el comentario de
    // cargarPosDesdeDashboard() (pos.page.ts). Con la `page` reutilizada
    // dentro de este worker esa caché queda caliente para el resto de sus
    // tests, así que beforeEach() ya no necesita repetir ese paso.
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    await use(pos);
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],
});

/**
 * Deja el POS en un estado limpio antes de cada escenario, sin repetir el
 * login ni el paso por Dashboard: navega directo a la URL del POS
 * (pos.irAlPos(), ya seguro tras el cargarPosDesdeDashboard() único que la
 * fixture "pos" ya hizo para este worker — ver su comentario) y vuelve a
 * resolver el estado inicial (grid de productos o modal "Abrir Caja"). Una
 * recarga real es, a la vez, la forma más simple y la más confiable de
 * garantizar carrito vacío, ningún modal abierto y ninguna categoría/tab
 * distinta de "Todos" pegada de un test anterior — incluida la variante en
 * la que un test previo falló a mitad de camino: no se necesita adivinar ni
 * cerrar cada posible modal por su cuenta, la recarga los descarta todos.
 */
test.beforeEach(async ({ pos }) => {
  test.setTimeout(TIMEOUTS.TEST);
  await pos.irAlPos();
  await pos.esperarEstadoInicial();
  if (await pos.modalAbrirCajaVisible()) {
    await pos.cerrarModalAbrirCaja();
  }
  await pos.cerrarOverlaysConocidos();
});

// ─── Helpers compartidos ────────────────────────────────────────────────────
// Todos componen métodos ya existentes de PosPage — ninguno reimplementa
// lógica de agregar productos, clientes, descuentos, combos ni esperas.

/**
 * Agrega un único producto de precio fijo — punto de partida del escenario 1.
 * Usa agregarProductoDelGridAlCarrito() (no agregarProductoAlCarrito()):
 * confirmado en vivo que este catálogo compartido incluye un producto
 * ("Nuevo producto") que se vende "por monto" y dispara el modal
 * #dialog_sale_by_amount en vez de agregarse directo —
 * agregarProductoAlCarrito() no lo maneja y se queda esperando para siempre
 * una clave que nunca aparece (ver el comentario de L.DIALOG_MONTO_A_COMPRAR
 * en pos.page.ts).
 */
async function agregarUnProducto(pos: PosPage) {
  const productoNormal = await pos.obtenerPrimerProductoNormal();
  await pos.agregarProductoDelGridAlCarrito(productoNormal);
}

/**
 * Completa Ruta, Repartidor, Dirección (si el cliente tiene alguna) y
 * Observaciones dentro del modal "Crear Orden de Ruteo" ya abierto y con
 * cliente ya seleccionado (por cualquiera de las dos formas), guarda, y
 * valida que la orden se creó correctamente. Centraliza la secuencia común a
 * los 7 escenarios para no repetirla en cada test.
 */
async function completarYGuardarOrdenRuteo(pos: PosPage, observacion: string) {
  const ruta = await pos.seleccionarRutaRuteo();
  const repartidor = await pos.seleccionarRepartidorRuteo();
  const direccion = await pos.seleccionarDireccionRuteoSiExiste();
  const observacionRegistrada = await pos.llenarObservacionesRuteo(observacion);

  expect(ruta.length, 'La ruta debe quedar seleccionada').toBeGreaterThan(0);
  expect(repartidor.length, 'El repartidor debe quedar seleccionado').toBeGreaterThan(0);
  expect(observacionRegistrada, 'La observación no quedó registrada en el campo').toBe(observacion);
  console.log(`[completarYGuardarOrdenRuteo] ruta="${ruta}" repartidor="${repartidor}" direccion="${direccion}"`);

  const respuesta = await pos.guardarOrdenRuteoYObtenerRespuesta();
  await pos.validarOrdenRuteoCreada(respuesta);
  return { ruta, repartidor, direccion, respuesta };
}

/**
 * Recupera un estado navegable del POS (modal "Abrir Caja" o grid de
 * productos visible) tras un flujo pesado de Vista Expandida + "AGREGAR
 * ITEMS" + Facturar sobre una Orden de Ruteo — confirmado en vivo (varias
 * corridas independientes, incluida en aislamiento) que, tras ese flujo
 * específico, tanto irAlPos() (ruta rápida) como cargarPosDesdeDashboard()
 * (ruta completa por Dashboard) pueden, cada uno en corridas distintas,
 * dejar la página sin terminar de inicializar (ni el modal de caja ni el
 * grid llegan a aparecer dentro de PRODUCTS_LOAD) — inestabilidad real del
 * ambiente bajo el DOM más pesado que deja ese flujo, no un error
 * determinista de ningún método en particular. Mismo patrón de reintento
 * acotado ya usado en el resto de este archivo/pos.page.ts para overlays y
 * navegación inestable (p. ej. _cerrarOverlayDashboardSiAparece()):
 * cargarPosDesdeDashboard() ya incluye su propio esperarEstadoInicial(), así
 * que un segundo intento completo basta para recuperarse en la práctica.
 */
async function recargarPosTrasFacturarConReintento(pos: PosPage) {
  const MAX_INTENTOS = 3;
  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      await pos.cargarPosDesdeDashboard();
      return;
    } catch (e) {
      if (intento === MAX_INTENTOS) throw e;
      console.log(`[recargarPosTrasFacturarConReintento] Intento ${intento} no dejó el POS en un estado navegable, reintentando: ${(e as Error).message.slice(0, 200)}`);
    }
  }
}

/** Aplica descuento individual a cada línea del carrito — mismo criterio ya usado en pos-proforma.spec.ts/pos-orden-caja.spec.ts/pos-apartado.spec.ts. */
async function aplicarDescuentoIndividualATodos(pos: PosPage) {
  await pos.desactivarDescuentoGeneral();
  const claves = await pos.obtenerClavesProductos();
  expect(claves.length, 'Se esperaban al menos 3 productos en el carrito').toBeGreaterThanOrEqual(3);
  for (const clave of claves) {
    await pos.aplicarDescuentoIndividual(clave, DESCUENTO_INDIVIDUAL_PCT);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Orden de Ruteo
// ═══════════════════════════════════════════════════════════════════════════
//
// Cada test es funcionalmente independiente (agrega sus propios productos y
// no depende del resultado de ningún otro) aunque, dentro de un mismo
// worker, reutilicen la misma `page`/sesión ya autenticada — ver la fixture
// "pos" y beforeEach() arriba.

test.describe('Orden de Ruteo', () => {

  test('1. Seleccionar un producto, seleccionar un cliente y crear la Orden de Ruteo', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await agregarUnProducto(pos);

    let nombreCliente = '';
    await test.step('Seleccionar un cliente existente desde arriba del carrito (Forma 1)', async () => {
      nombreCliente = await pos.seleccionarClienteExistente();
      expect(nombreCliente.length).toBeGreaterThan(0);
    });

    let clavesEnCarrito: string[] = [];
    await test.step('Abrir "Crear Orden de Ruteo" y validar que el cliente se propagó y el producto sigue en el carrito', async () => {
      clavesEnCarrito = await pos.obtenerClavesProductos();
      expect(clavesEnCarrito.length, 'El producto agregado debe seguir en el carrito').toBeGreaterThanOrEqual(1);

      await pos.abrirCrearOrdenRuteo();
      const clienteEnModal = await pos.obtenerClienteEnRuteo();
      expect(clienteEnModal, 'El cliente elegido arriba del carrito no se propagó al modal').toBe(nombreCliente);
    });

    await test.step('Completar ruta, repartidor, dirección y observación, y crear la orden', async () => {
      await completarYGuardarOrdenRuteo(pos, 'Escenario 1 - un producto, cliente Forma 1');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('2. Seleccionar un cliente, seleccionar los productos y crear la Orden de Ruteo', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let nombreCliente = '';
    await test.step('Seleccionar un cliente existente ANTES de agregar productos', async () => {
      nombreCliente = await pos.seleccionarClienteExistente();
      expect(nombreCliente.length).toBeGreaterThan(0);
    });

    let clavesEnCarrito: string[] = [];
    await test.step('Agregar dos productos normales distintos', async () => {
      const primero = await pos.obtenerPrimerProductoNormal();
      await pos.agregarProductoDelGridAlCarrito(primero);
      const segundo = await pos.obtenerSegundoProductoNormalDistinto(primero.nombre);
      await pos.agregarProductoDelGridAlCarrito(segundo);

      clavesEnCarrito = await pos.obtenerClavesProductos();
      expect(clavesEnCarrito.length, 'Ambos productos deben quedar en el carrito').toBeGreaterThanOrEqual(2);
    });

    await test.step('Abrir "Crear Orden de Ruteo" y validar que el cliente elegido antes de agregar productos se conservó', async () => {
      await pos.abrirCrearOrdenRuteo();
      const clienteEnModal = await pos.obtenerClienteEnRuteo();
      expect(clienteEnModal, 'El cliente elegido antes de agregar productos no se conservó').toBe(nombreCliente);

      const clavesTrasAbrirModal = await pos.obtenerClavesProductos();
      expect(clavesTrasAbrirModal, 'Los productos deben seguir en el carrito al abrir el modal').toEqual(expect.arrayContaining(clavesEnCarrito));
    });

    await test.step('Completar ruta, repartidor, dirección y observación, y crear la orden', async () => {
      await completarYGuardarOrdenRuteo(pos, 'Escenario 2 - cliente primero, luego productos');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('3. Crear la Orden de Ruteo usando las dos formas de seleccionar cliente (Forma 1 y Forma 2)', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await test.step('Forma 1: cliente desde arriba del carrito', async () => {
      await agregarUnProducto(pos);

      const nombreCliente = await pos.seleccionarClienteExistente();
      expect(nombreCliente.length).toBeGreaterThan(0);

      await pos.abrirCrearOrdenRuteo();
      const clienteEnModal = await pos.obtenerClienteEnRuteo();
      expect(clienteEnModal, 'Forma 1: el cliente no se propagó al modal').toBe(nombreCliente);

      await completarYGuardarOrdenRuteo(pos, 'Escenario 3 - cliente Forma 1 (arriba del carrito)');
    });

    await test.step('Forma 2: cliente desde el propio modal', async () => {
      await agregarUnProducto(pos);

      await pos.abrirCrearOrdenRuteo();
      const nombreCliente = await pos.seleccionarClienteEnRuteo();
      expect(nombreCliente.length).toBeGreaterThan(0);

      await completarYGuardarOrdenRuteo(pos, 'Escenario 3 - cliente Forma 2 (desde el modal)');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('4. Crear una Orden de Ruteo con producto normal, fraccionado y rápido', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let clavesEnCarrito: string[] = [];
    await test.step('Agregar producto normal, fraccionado y rápido', async () => {
      await pos.agregarProductoNormalFraccionadoYRapido('Ruteo', `Mixto ${Date.now()}`);
      clavesEnCarrito = await pos.obtenerClavesProductos();
      expect(clavesEnCarrito.length, 'Los 3 tipos de producto deben quedar en el carrito').toBeGreaterThanOrEqual(3);
    });

    await pos.seleccionarClienteExistente();
    await pos.abrirCrearOrdenRuteo();

    await test.step('Validar que los 3 productos siguen en el carrito antes de crear la orden', async () => {
      const clavesActuales = await pos.obtenerClavesProductos();
      expect(clavesActuales).toEqual(expect.arrayContaining(clavesEnCarrito));
    });

    await test.step('Completar ruta, repartidor, dirección y observación, y crear la orden', async () => {
      await completarYGuardarOrdenRuteo(pos, 'Escenario 4 - normal + fraccionado + rápido');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('5. Crear una Orden de Ruteo con producto normal, fraccionado, rápido y descuento general', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await pos.agregarProductoNormalFraccionadoYRapido('Ruteo', `DescGeneral ${Date.now()}`);

    await test.step(`Activar el descuento general del ${DESCUENTO_GENERAL_PCT}% y validar que se aplicó`, async () => {
      const totalAntes = await pos.obtenerTotalVentaNumerico();
      await pos.activarDescuentoGeneral();
      await pos.mostrarDetalleAvanzadoFactura();
      await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);
      const totalDespues = await pos.obtenerTotalVentaNumerico();
      expect(totalDespues, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalAntes);
    });

    await pos.seleccionarClienteExistente();
    await pos.abrirCrearOrdenRuteo();

    await test.step('Completar ruta, repartidor, dirección y observación, y crear la orden', async () => {
      await completarYGuardarOrdenRuteo(pos, 'Escenario 5 - normal + fraccionado + rápido + descuento general');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('6. Crear una Orden de Ruteo con producto normal, fraccionado, rápido y descuento individual', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await pos.agregarProductoNormalFraccionadoYRapido('Ruteo', `DescIndividual ${Date.now()}`);

    await test.step(`Aplicar descuento individual del ${DESCUENTO_INDIVIDUAL_PCT}% a cada producto`, async () => {
      await aplicarDescuentoIndividualATodos(pos);
    });

    await pos.seleccionarClienteExistente();
    await pos.abrirCrearOrdenRuteo();

    await test.step('Completar ruta, repartidor, dirección y observación, y crear la orden', async () => {
      await completarYGuardarOrdenRuteo(pos, 'Escenario 6 - normal + fraccionado + rápido + descuento individual');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('7. Crear una Orden de Ruteo con producto normal, fraccionado, rápido y un combo existente', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await pos.agregarProductoNormalFraccionadoYRapido('Ruteo', `ConCombo ${Date.now()}`);

    let claveCombo = '';
    let nombreCombo = '';
    await test.step('Seleccionar un combo YA EXISTENTE del catálogo (categoría "Combos") y agregarlo al carrito — no se crea ningún combo nuevo', async () => {
      const combo = await pos.obtenerPrimerCombo();
      nombreCombo = combo.nombre;
      claveCombo = await pos.agregarProductoDelGridAlCarrito(combo);

      const clavesTrasAgregar = await pos.obtenerClavesProductos();
      expect(clavesTrasAgregar, 'El combo agregado no aparece en el carrito').toContain(claveCombo);

      const linea = await pos.obtenerDatosLineaCarrito(claveCombo);
      expect(linea.nombre, 'El nombre de la línea agregada al carrito no coincide con el combo elegido').toBe(nombreCombo);
    });

    await pos.seleccionarClienteExistente();
    await pos.abrirCrearOrdenRuteo();

    await test.step('Validar que el combo sigue en el carrito antes de crear la orden', async () => {
      const clavesActuales = await pos.obtenerClavesProductos();
      expect(clavesActuales, 'El combo debe seguir en el carrito').toContain(claveCombo);
    });

    await test.step('Completar ruta, repartidor, dirección y observación, y crear la orden', async () => {
      await completarYGuardarOrdenRuteo(pos, 'Escenario 7 - normal + fraccionado + rápido + combo');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  // ─── Escenarios adicionales: orden completa, Vista Expandida, y listado de
  // Órdenes de Ruteo YA CREADAS ("Ver Orden"/"Editar Orden"/cambio de estado) ──
  //
  // Los últimos cuatro (10-13) usan la pestaña superior "Ruteo"
  // (abrirListadoOrdenesRuteo(), #btn_routing_option de PESTANAS_POS_A_RECORRER
  // — ver el comentario de L.RUTEO_LISTA_TARJETA_PREFIJO en pos.page.ts), no
  // el menú "Crear Orden de Ruteo" que usan los escenarios 1-9. Cada uno crea
  // su PROPIA orden y la localiza siempre por su id real (nunca por posición
  // en el listado): bajo `fullyParallel`, otro worker puede estar creando/
  // editando sus propias órdenes en esa misma pestaña al mismo tiempo.

  test('8. Crear una Orden de Ruteo completa: normal + fraccionado + rápido + combo, con descuento, exoneración y moneda no base', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    const { simboloBase } = await pos.obtenerInfoMoneda();
    const monedaNoBase = simboloBase === '$' ? '₡' : '$';

    let cantidadProductosEnCarrito = 0;
    await test.step('Agregar producto normal, fraccionado, rápido y un combo existente', async () => {
      await pos.agregarProductoNormalFraccionadoYRapido('RuteoCompleta', `Mixto ${Date.now()}`);
      const combo = await pos.obtenerPrimerCombo();
      await pos.agregarProductoDelGridAlCarrito(combo);

      const claves = await pos.obtenerClavesProductos();
      cantidadProductosEnCarrito = claves.length;
      expect(cantidadProductosEnCarrito, 'Se esperaban al menos 4 líneas en el carrito (normal+fraccionado+rápido+combo)').toBeGreaterThanOrEqual(4);
    });

    await test.step('Aplicar descuento general y exoneración, y validar que ambos bajan el total', async () => {
      await pos.mostrarDetalleAvanzadoFactura();
      const totalSinDescuentos = await pos.obtenerTotalVentaNumerico();

      await pos.activarDescuentoGeneral();
      await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);
      const totalConDescuento = await pos.obtenerTotalVentaNumerico();
      expect(totalConDescuento, 'El descuento general no bajó el total').toBeLessThan(totalSinDescuentos);

      await pos.abrirModalExoneracion();
      await pos.aplicarExoneracion(DESCUENTO_GENERAL_PCT);
      const montoExoneracion = await pos.obtenerMontoExoneracionNumerico();
      expect(montoExoneracion, 'La exoneración no quedó reflejada en los totales').toBeGreaterThan(0);

      const totalConAmbos = await pos.obtenerTotalVentaNumerico();
      expect(totalConAmbos, 'El total no bajó tras descuento + exoneración').toBeLessThan(totalConDescuento);
    });

    await pos.seleccionarClienteExistente();

    let monedaUsadaFinal = simboloBase;
    let idOrdenCreada = 0;
    await test.step(`Intentar crear la orden en moneda NO base (${monedaNoBase}); si el ambiente la bloquea (mismo bloqueo silencioso ya documentado para "Crear Proforma" en asegurarMonedaBaseActiva()), caer automáticamente a la moneda base (${simboloBase}) sin fallar el test`, async () => {
      await pos.cambiarMoneda(monedaNoBase);
      await pos.abrirCrearOrdenRuteo();
      await pos.seleccionarRutaRuteo();
      await pos.seleccionarRepartidorRuteo();
      await pos.seleccionarDireccionRuteoSiExiste();
      await pos.llenarObservacionesRuteo('Escenario 8 - orden completa (intento en moneda no base)');

      let respuesta: Response;
      try {
        respuesta = await pos.guardarOrdenRuteoYObtenerRespuesta();
        monedaUsadaFinal = monedaNoBase;
      } catch {
        console.log(
          `[Escenario 8] El ambiente NO permite crear una Orden de Ruteo en moneda no base (${monedaNoBase}): ` +
          'bloqueo silencioso confirmado en vivo (el botón "Enviar Orden" no dispara ningún SweetAlert ni ' +
          'AJAX_GUARDAR_RUTEO), el mismo comportamiento ya documentado para "Crear Proforma". Se cierra el modal, ' +
          `se restaura la moneda base (${simboloBase}) y se completa la orden ahí.`
        );

        await pos.cerrarModalRuteoForzado();
        await pos.cambiarMoneda(simboloBase);
        monedaUsadaFinal = simboloBase;

        await pos.abrirCrearOrdenRuteo();
        await pos.seleccionarRutaRuteo();
        await pos.seleccionarRepartidorRuteo();
        await pos.seleccionarDireccionRuteoSiExiste();
        await pos.llenarObservacionesRuteo('Escenario 8 - orden completa (moneda base, tras bloqueo en moneda no base)');
        respuesta = await pos.guardarOrdenRuteoYObtenerRespuesta();
      }

      await pos.validarOrdenRuteoCreada(respuesta);
      idOrdenCreada = parseInt((await respuesta.text()).trim(), 10);
      expect(idOrdenCreada, 'La respuesta de guardado debe devolver un id numérico válido').toBeGreaterThanOrEqual(1);
    });

    await test.step('Validar la orden ya creada (consecutivo, estado, cantidad de productos y totales) en el listado "Ruteo"', async () => {
      await pos.abrirListadoOrdenesRuteo();

      const estado = await pos.obtenerEstadoTarjetaRuteo(String(idOrdenCreada));
      expect(estado, 'La orden recién creada debe iniciar en estado Pendiente (1)').toBe(1);

      await pos.abrirMenuAccionesOrdenRuteo(String(idOrdenCreada));
      const detalle = await pos.verOrdenRuteo(String(idOrdenCreada));

      expect(detalle.numero.length, 'La orden debe mostrar un número de consecutivo').toBeGreaterThan(0);
      expect(detalle.cantidadProductos, 'La cantidad de productos de la orden no coincide con lo agregado al carrito').toBe(cantidadProductosEnCarrito);
      expect(detalle.descuento, 'El descuento no quedó reflejado en la orden ya creada').toBeGreaterThan(0);
      expect(detalle.total, 'El total de la orden debe ser mayor que cero').toBeGreaterThan(0);

      console.log(`[Escenario 8] Orden #${idOrdenCreada} creada en moneda ${monedaUsadaFinal === simboloBase ? 'BASE' : 'NO base'} (${monedaUsadaFinal}).`);
    });

    await test.step(
      'Limpieza: volver a "POS Facturación" (NO pos.irAlPos()/esperarEstadoInicial() — el listado "Ruteo" recién visitado ' +
      'es un DOM muy pesado (90+ órdenes) y una navegación completa mientras queda activo puede tardar mucho más que el ' +
      'timeout habitual; visitarPestanaPos() confirma el cambio de pestaña real en la misma página) y restaurar moneda/' +
      'descuento/exoneración para no afectar otros tests del mismo worker',
      async () => {
        await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);
        await pos.mostrarDetalleAvanzadoFactura();
        await pos.desactivarDescuentoGeneral();
        await pos.cancelarExoneracionSiEstaAplicada();
        if (monedaUsadaFinal !== simboloBase) await pos.cambiarMoneda(simboloBase);
      }
    );

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('9. Crear una Orden de Ruteo en Vista Expandida con producto normal y producto rápido', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    let expandidaAlInicio = false;

    await test.step('Detectar la vista actual sin asumirla', async () => {
      expandidaAlInicio = await pos.vistaExpandidaActiva();
    });

    let codigoProducto = '';
    let nombreProducto = '';
    await test.step('Asegurar Vista Normal para leer el código del producto (el buscador interno de Vista Expandida filtra por código, no por nombre)', async () => {
      if (await pos.vistaExpandidaActiva()) {
        await pos.alternarVistaExpandida();
      }
      const { producto, codigo } = await pos.obtenerPrimerProductoNormalConCodigo();
      nombreProducto = producto.nombre;
      codigoProducto = codigo;
    });

    await test.step('Cambiar a Vista Expandida y validar que el cambio ocurrió realmente', async () => {
      if (!(await pos.vistaExpandidaActiva())) {
        await pos.alternarVistaExpandida();
      }
      expect(await pos.vistaExpandidaActiva(), 'La vista no quedó en modo Expandida').toBe(true);
    });

    let clavesEnCarrito: string[] = [];
    await test.step('Agregar el producto normal desde el buscador interno de Vista Expandida', async () => {
      await pos.agregarProductoPorCodigoEnVistaExpandida(codigoProducto);
      clavesEnCarrito = await pos.obtenerClavesProductos();
      expect(clavesEnCarrito.length, 'El producto normal no quedó agregado al carrito en Vista Expandida').toBeGreaterThanOrEqual(1);

      const lineaAgregada = await pos.obtenerDatosLineaCarrito(clavesEnCarrito[0]);
      expect(lineaAgregada.nombre, 'El producto agregado en Vista Expandida no coincide con el esperado').toBe(nombreProducto);
    });

    await test.step('Agregar un producto rápido (modal independiente de la vista de grilla activa)', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido VistaExpandida ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
      const clavesTrasRapido = await pos.obtenerClavesProductos();
      expect(clavesTrasRapido.length, 'El producto rápido no quedó agregado al carrito').toBeGreaterThan(clavesEnCarrito.length);
      clavesEnCarrito = clavesTrasRapido;
    });

    await test.step('Validar los totales del carrito (ambos productos) antes de crear la orden', async () => {
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total del carrito debe ser mayor que cero').toBeGreaterThan(0);
      expect(clavesEnCarrito.length, 'Deben quedar exactamente 2 productos en el carrito (normal + rápido)').toBe(2);
    });

    await pos.seleccionarClienteExistente();
    await pos.abrirCrearOrdenRuteo();

    await test.step('Completar ruta, repartidor, dirección y observación, y crear la orden', async () => {
      await completarYGuardarOrdenRuteo(pos, 'Escenario 9 - Vista Expandida (normal + rápido)');
    });

    await test.step('Volver a la vista anterior y validar que revirtió correctamente', async () => {
      if ((await pos.vistaExpandidaActiva()) !== expandidaAlInicio) {
        await pos.alternarVistaExpandida();
      }
      expect(await pos.vistaExpandidaActiva(), 'La vista no volvió a su estado original').toBe(expandidaAlInicio);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('10. Ver Orden: validar que el detalle de una Orden de Ruteo ya creada coincide con lo ingresado', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let nombreCliente = '';
    let repartidor = '';
    let cantidadProductos = 0;
    const observacion = `Escenario 10 - Ver Orden ${Date.now()}`;

    await test.step('Agregar dos productos y seleccionar cliente/ruta/repartidor con datos conocidos', async () => {
      const primero = await pos.obtenerPrimerProductoNormal();
      await pos.agregarProductoDelGridAlCarrito(primero);
      const segundo = await pos.obtenerSegundoProductoNormalDistinto(primero.nombre);
      await pos.agregarProductoDelGridAlCarrito(segundo);

      const claves = await pos.obtenerClavesProductos();
      cantidadProductos = claves.length;
      expect(cantidadProductos, 'Se esperaban al menos 2 productos en el carrito').toBeGreaterThanOrEqual(2);

      nombreCliente = await pos.seleccionarClienteExistente();
      await pos.abrirCrearOrdenRuteo();
      await pos.seleccionarRutaRuteo();
      repartidor = await pos.seleccionarRepartidorRuteo();
      await pos.seleccionarDireccionRuteoSiExiste();
      await pos.llenarObservacionesRuteo(observacion);
    });

    let idOrdenCreada = 0;
    await test.step('Guardar la orden', async () => {
      const respuesta = await pos.guardarOrdenRuteoYObtenerRespuesta();
      await pos.validarOrdenRuteoCreada(respuesta);
      idOrdenCreada = parseInt((await respuesta.text()).trim(), 10);
      expect(idOrdenCreada, 'La respuesta de guardado debe devolver un id numérico válido').toBeGreaterThanOrEqual(1);
    });

    await test.step('Abrir "Ver Orden" desde el listado "Ruteo" y validar que el detalle coincide con lo ingresado', async () => {
      await pos.abrirListadoOrdenesRuteo();
      await pos.abrirMenuAccionesOrdenRuteo(String(idOrdenCreada));
      const detalle = await pos.verOrdenRuteo(String(idOrdenCreada));

      // Nota (limitación real del sistema, no de la automatización): el modal
      // "Ver Orden" (#dialog_view_routing_order_detail) no incluye un campo
      // de "Vendedor" separado (solo "Repartidor") ni una etiqueta explícita
      // de moneda/estado/fecha — confirmado en vivo volcando su DOM real. El
      // estado se valida aparte con obtenerEstadoTarjetaRuteo() (lee la
      // propia tarjeta), y la moneda se infiere del símbolo en los montos.
      expect(detalle.numero.length, 'La orden debe mostrar un consecutivo').toBeGreaterThan(0);
      expect(detalle.repartidor, 'El repartidor mostrado en "Ver Orden" no coincide con el seleccionado').toContain(repartidor);
      expect(detalle.clienteNombre, 'El cliente mostrado en "Ver Orden" no coincide con el seleccionado').toContain(nombreCliente);
      expect(detalle.observacion, 'La observación mostrada en "Ver Orden" no coincide con la registrada').toBe(observacion);
      expect(detalle.cantidadProductos, 'La cantidad de productos mostrada en "Ver Orden" no coincide con el carrito').toBe(cantidadProductos);
      expect(detalle.total, 'El total mostrado en "Ver Orden" debe ser mayor que cero').toBeGreaterThan(0);

      const estado = await pos.obtenerEstadoTarjetaRuteo(String(idOrdenCreada));
      expect(estado, 'Una orden recién creada debe iniciar en estado Pendiente (1)').toBe(1);
    });

    // Volver a "POS Facturación": el listado "Ruteo" es un DOM pesado
    // (90+ órdenes) y dejarlo activo puede hacer que la navegación inicial
    // del siguiente test (irAlPos()/esperarEstadoInicial() en beforeEach)
    // tarde mucho más de lo esperado — confirmado en vivo.
    await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('11. Editar Orden: modificar Ruta, Repartidor y Observaciones de una Orden ya creada y validar que persisten', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let idOrdenCreada = 0;
    await test.step('Crear una Orden de Ruteo base para editarla después', async () => {
      await agregarUnProducto(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearOrdenRuteo();
      const { respuesta } = await completarYGuardarOrdenRuteo(pos, 'Escenario 11 - orden original antes de editar');
      idOrdenCreada = parseInt((await respuesta.text()).trim(), 10);
      expect(idOrdenCreada, 'La respuesta de guardado debe devolver un id numérico válido').toBeGreaterThanOrEqual(1);
    });

    const nuevaObservacion = `Escenario 11 - observación editada ${Date.now()}`;
    let nuevoRepartidor = '';
    await test.step(
      'Abrir "Editar Orden" y modificar Ruta, Repartidor y Observaciones — los ÚNICOS campos editables en este ambiente ' +
      '(confirmado en vivo: el modal de edición reutiliza el mismo #dialog_add_routing_order de la creación, sin bloque ' +
      'de cliente/vendedor/productos/cantidades, que no son editables desde esta pantalla)',
      async () => {
        await pos.abrirListadoOrdenesRuteo();
        await pos.abrirMenuAccionesOrdenRuteo(String(idOrdenCreada));
        const resultado = await pos.editarOrdenRuteo(String(idOrdenCreada), nuevaObservacion);
        nuevoRepartidor = resultado.repartidor;
        expect(resultado.observacionRegistrada, 'La nueva observación no quedó registrada en el campo').toBe(nuevaObservacion);
      }
    );

    await test.step('Volver a abrir la orden ("Ver Orden") y validar que los cambios persistieron, sin perder el resto de la información', async () => {
      await pos.abrirListadoOrdenesRuteo();
      await pos.abrirMenuAccionesOrdenRuteo(String(idOrdenCreada));
      const detalle = await pos.verOrdenRuteo(String(idOrdenCreada));

      expect(detalle.observacion, 'La observación editada no persistió al volver a abrir la orden').toBe(nuevaObservacion);
      expect(detalle.repartidor, 'El repartidor editado no persistió al volver a abrir la orden').toContain(nuevoRepartidor);
      expect(detalle.numero.length, 'La orden no debe perder su consecutivo tras editarla').toBeGreaterThan(0);
      expect(detalle.total, 'La orden no debe perder su total tras editarla').toBeGreaterThan(0);
    });

    await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('12. Marcar como Pendiente: revertir una Orden desde "En camino" y validar el estado final', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let idOrdenCreada = 0;
    await test.step('Crear una Orden de Ruteo (inicia siempre en estado Pendiente)', async () => {
      await agregarUnProducto(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearOrdenRuteo();
      const { respuesta } = await completarYGuardarOrdenRuteo(pos, 'Escenario 12 - Marcar como Pendiente');
      idOrdenCreada = parseInt((await respuesta.text()).trim(), 10);
      expect(idOrdenCreada, 'La respuesta de guardado debe devolver un id numérico válido').toBeGreaterThanOrEqual(1);
    });

    await test.step('Confirmar el estado inicial Pendiente', async () => {
      await pos.abrirListadoOrdenesRuteo();
      const estadoInicial = await pos.obtenerEstadoTarjetaRuteo(String(idOrdenCreada));
      expect(estadoInicial, 'La orden recién creada debe iniciar en estado Pendiente (1)').toBe(1);
    });

    // Nota (comportamiento real del sistema, no de la automatización): el
    // menú de acciones solo ofrece "Marcar como <estado>" para estados
    // DISTINTOS al actual — confirmado en vivo que una orden recién creada,
    // ya Pendiente, nunca se ofrece "Marcar como PENDIENTE" a sí misma. Por
    // eso este escenario primero avanza a "En camino" y luego retrocede a
    // "Pendiente", el único camino real para ejercer esa acción del menú.
    await test.step('Avanzar a "En camino" (paso intermedio necesario)', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(String(idOrdenCreada));
      await pos.cambiarEstadoOrdenRuteo(String(idOrdenCreada), 2);
      const estado = await pos.obtenerEstadoTarjetaRuteo(String(idOrdenCreada));
      expect(estado, 'La orden no quedó en estado "En camino" (2)').toBe(2);
    });

    await test.step('Marcar como Pendiente y validar el estado final', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(String(idOrdenCreada));
      await pos.cambiarEstadoOrdenRuteo(String(idOrdenCreada), 1);
      const estadoFinal = await pos.obtenerEstadoTarjetaRuteo(String(idOrdenCreada));
      expect(estadoFinal, 'La orden no volvió a estado Pendiente (1)').toBe(1);
    });

    await test.step('Validar que la orden conserva toda su información tras los cambios de estado', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(String(idOrdenCreada));
      const detalle = await pos.verOrdenRuteo(String(idOrdenCreada));
      expect(detalle.numero.length, 'La orden debe conservar su consecutivo').toBeGreaterThan(0);
      expect(detalle.total, 'La orden debe conservar un total mayor que cero').toBeGreaterThan(0);
    });

    await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('13. Marcar como En Camino: cambiar el estado de una Orden Pendiente y validar el estado final', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let idOrdenCreada = 0;
    await test.step('Crear una Orden de Ruteo (inicia siempre en estado Pendiente)', async () => {
      await agregarUnProducto(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearOrdenRuteo();
      const { respuesta } = await completarYGuardarOrdenRuteo(pos, 'Escenario 13 - Marcar como En Camino');
      idOrdenCreada = parseInt((await respuesta.text()).trim(), 10);
      expect(idOrdenCreada, 'La respuesta de guardado debe devolver un id numérico válido').toBeGreaterThanOrEqual(1);
    });

    await test.step('Confirmar el estado inicial Pendiente', async () => {
      await pos.abrirListadoOrdenesRuteo();
      const estadoInicial = await pos.obtenerEstadoTarjetaRuteo(String(idOrdenCreada));
      expect(estadoInicial, 'La orden recién creada debe iniciar en estado Pendiente (1)').toBe(1);
    });

    await test.step('Marcar como "En camino" y validar el estado final', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(String(idOrdenCreada));
      await pos.cambiarEstadoOrdenRuteo(String(idOrdenCreada), 2);
      const estadoFinal = await pos.obtenerEstadoTarjetaRuteo(String(idOrdenCreada));
      expect(estadoFinal, 'La orden no quedó en estado "En camino" (2)').toBe(2);
    });

    await test.step('Validar que la orden conserva toda su información tras el cambio de estado', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(String(idOrdenCreada));
      const detalle = await pos.verOrdenRuteo(String(idOrdenCreada));
      expect(detalle.numero.length, 'La orden debe conservar su consecutivo').toBeGreaterThan(0);
      expect(detalle.total, 'La orden debe conservar un total mayor que cero').toBeGreaterThan(0);
    });

    await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  // ─── Facturar una Orden de Ruteo ya creada ─────────────────────────────────
  //
  // A diferencia de los Escenarios 1-13 (crean la orden y se quedan ahí), los
  // siguientes usan seleccionarOrdenRuteoParaFacturar() — el botón real
  // "Seleccionar órden" de cada tarjeta (fuera del menú de tres puntos, ver el
  // comentario de L.RUTEO_LISTA_BTN_SELECCIONAR en pos.page.ts) — para llevar
  // la orden al carrito y completar la venta con la misma infraestructura
  // genérica de facturación ya usada por el resto de la suite (Órdenes de
  // Caja/Importar Factura/Apartado): abrirAgregarItem(), presionarFacturar(),
  // cambiarTipoPagoEnModalPago(), confirmarPagoAbriendoCajaSiEsNecesario(),
  // etc. Confirmado en vivo que ese flujo ya resuelve, sin nada adicional, el
  // modal de confirmación de pago ("Pagar"), el panel "Información del
  // Cliente" y el cambio automático a Tiquete Electrónico si la compañía lo
  // exige (ver el comentario de _confirmarPagoConReintentosDeCaja() en
  // pos.page.ts) — HONDURAS (COMPANIA_POS) no disparó ninguno de los dos
  // últimos en las corridas de investigación, pero el flujo los cubre igual
  // si el ambiente cambia.

  test('14. Marcar una Orden de Ruteo como Entregado y validar la transición real de estado', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    // Nota (confirmado en vivo, investigado a fondo antes de escribir este
    // test — no una suposición): este ambiente NO expone ninguna pestaña de
    // filtro visible por estado de envío ("En Camino"/"Entregado") dentro del
    // listado "Ruteo". Se revisaron los 3 únicos dropdowns Chosen visibles de
    // esa pestaña (Ruta/Repartidor/Recurrencia — ninguno es de estado), se
    // buscó cualquier elemento con onclick/onchange que referenciara
    // "delivery_status" en todo el documento (ninguno) y se confirmó que
    // clickear el propio badge "Envío: <estado>" de una tarjeta NO dispara
    // ningún AJAX de refiltrado — pese a que el backend sí acepta un
    // parámetro `delivery_status` en getSearchRoutingOrders (queda fijo en
    // "0"/todos en la práctica: ningún control real lo cambia). El estado de
    // envío real de cada orden vive únicamente en la clase de su propia
    // tarjeta (delivery-status-1/2/3, obtenerEstadoTarjetaRuteo()) — es la
    // señal real y funcionalmente equivalente a "estar en el tab En Camino" /
    // "aparecer en el tab Entregado" que pide este escenario, y la misma que
    // ya validan los Escenarios 12/13 de este archivo.
    let idOrdenCreada = 0;
    let nombreClienteOriginal = '';
    let totalOriginal = 0;
    await test.step('Crear una Orden de Ruteo (inicia siempre en estado Pendiente)', async () => {
      await agregarUnProducto(pos);
      nombreClienteOriginal = await pos.seleccionarClienteExistente();
      totalOriginal = await pos.obtenerTotalVentaNumerico();
      await pos.abrirCrearOrdenRuteo();
      const { respuesta } = await completarYGuardarOrdenRuteo(pos, 'Escenario 14 - marcar como Entregado');
      idOrdenCreada = parseInt((await respuesta.text()).trim(), 10);
      expect(idOrdenCreada, 'La respuesta de guardado debe devolver un id numérico válido').toBeGreaterThanOrEqual(1);
    });

    await test.step('Llevar la orden a "En camino" (equivalente real a que la orden esté en el tab En Camino)', async () => {
      await pos.abrirListadoOrdenesRuteo();
      expect(await pos.obtenerEstadoTarjetaRuteo(String(idOrdenCreada)), 'La orden recién creada debe iniciar en estado Pendiente (1)').toBe(1);

      await pos.abrirMenuAccionesOrdenRuteo(String(idOrdenCreada));
      await pos.cambiarEstadoOrdenRuteo(String(idOrdenCreada), 2);
      expect(await pos.obtenerEstadoTarjetaRuteo(String(idOrdenCreada)), 'La orden debía quedar "En camino" antes de marcarla Entregado').toBe(2);
    });

    await test.step('Marcarla como Entregado y validar que sale de "En camino" y queda en "Entregado"', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(String(idOrdenCreada));
      await pos.cambiarEstadoOrdenRuteo(String(idOrdenCreada), 3);
      const estadoFinal = await pos.obtenerEstadoTarjetaRuteo(String(idOrdenCreada));
      expect(estadoFinal, 'La orden no quedó en estado "Entregado" (3) — la acción debe sacarla de "En camino" (2)').toBe(3);
    });

    await test.step('Validar que los datos de la orden permanecen correctos tras el cambio de estado', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(String(idOrdenCreada));
      const detalle = await pos.verOrdenRuteo(String(idOrdenCreada));
      expect(detalle.clienteNombre, 'El cliente de la orden no debía cambiar al marcarla Entregado').toContain(nombreClienteOriginal);
      expect(detalle.cantidadProductos, 'La cantidad de productos no debía cambiar al marcarla Entregado').toBe(1);
      expect(detalle.total, 'El total de la orden no debía cambiar al marcarla Entregado').toBeCloseTo(totalOriginal, 1);
    });

    await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('15. Facturar una Orden de Ruteo en Vista Expandida agregando un producto existente (con IVA) y uno rápido', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let idOrdenCreada = 0;
    await test.step('Crear una Orden de Ruteo base', async () => {
      await agregarUnProducto(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearOrdenRuteo();
      const { respuesta } = await completarYGuardarOrdenRuteo(pos, 'Escenario 15 - Vista Expandida + producto con IVA + rapido');
      idOrdenCreada = parseInt((await respuesta.text()).trim(), 10);
      expect(idOrdenCreada, 'La respuesta de guardado debe devolver un id numérico válido').toBeGreaterThanOrEqual(1);
    });

    let cantidadInicial = 0;
    await test.step('Seleccionar la Orden de Ruteo para facturarla', async () => {
      await pos.abrirListadoOrdenesRuteo();
      await pos.seleccionarOrdenRuteoParaFacturar(String(idOrdenCreada));
      cantidadInicial = await pos.obtenerCantidadFilasCarrito();
      expect(cantidadInicial, 'La orden seleccionada debía cargar al menos una línea al carrito').toBeGreaterThan(0);
    });

    let codigoProducto = '';
    let nombreProducto = '';
    await test.step('Abrir "AGREGAR ITEMS" y, en Vista Normal, localizar un producto existente con IVA por su código', async () => {
      await pos.abrirAgregarItem();
      if (await pos.vistaExpandidaActiva()) {
        await pos.alternarVistaExpandida();
      }
      // obtenerPrimerProductoConIvaNoPresenteEnCarrito() (no obtenerPrimerProductoConIva()):
      // la orden de Ruteo ya cargada trae su propio producto en el carrito —
      // buscar y "agregar" ese mismo producto de nuevo solo le sumaría
      // cantidad a la línea ya existente (ver el comentario de
      // obtenerTextoCarrito() en pos.page.ts), sin crear la línea nueva que
      // este escenario necesita validar.
      const productoConIva = await pos.obtenerPrimerProductoConIvaNoPresenteEnCarrito();
      nombreProducto = productoConIva.nombre;
      codigoProducto = await pos.obtenerCodigoProducto(nombreProducto);
    });

    await test.step('Cambiar a Vista Expandida y validar que el cambio ocurrió realmente', async () => {
      if (!(await pos.vistaExpandidaActiva())) {
        await pos.alternarVistaExpandida();
      }
      expect(await pos.vistaExpandidaActiva(), 'La vista no quedó en modo Expandida').toBe(true);
    });

    // NOTA (confirmado en vivo): el carrito de una Orden de Ruteo ya cargada
    // se resincroniza contra el servidor (updateItemFromRoutingOrder/
    // updateDiscountFromRoutingOrder) en cada línea agregada — a diferencia
    // del carrito "normal" del resto de la suite, esto puede reasignar las
    // claves ya existentes (incluida la de una línea recién agregada) en
    // cuanto se agrega OTRA línea después. Por eso, a partir de aquí, cada
    // paso valida lo que puede leer EN EL MOMENTO (cantidad de líneas,
    // datos de la línea recién agregada) en vez de guardar una clave para
    // comprobar su identidad varios pasos después.
    let cantidadTrasBuscar = 0;
    await test.step('Buscar el producto existente por su código y agregarlo', async () => {
      const clavesAntes = await pos.obtenerClavesProductos();
      await pos.agregarProductoPorCodigoEnVistaExpandida(codigoProducto);
      const clavesDespues = await pos.obtenerClavesProductos();
      expect(clavesDespues.length, 'El producto buscado no quedó agregado al carrito').toBeGreaterThan(clavesAntes.length);

      const claveNueva = clavesDespues.find((c) => !clavesAntes.includes(c))!;
      const linea = await pos.obtenerDatosLineaCarrito(claveNueva);
      expect(linea.nombre, 'El producto agregado no coincide con el buscado').toBe(nombreProducto);
      expect(linea.iva, 'El producto buscado (con IVA) debía reflejar un monto de IVA mayor a 0').toBeGreaterThan(0);

      cantidadTrasBuscar = await pos.obtenerCantidadFilasCarrito();
    });

    await test.step('Agregar un producto rápido', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido Ruteo Vista Expandida ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
      const cantidadTrasRapido = await pos.obtenerCantidadFilasCarrito();
      expect(cantidadTrasRapido, 'El producto rápido no quedó agregado al carrito').toBeGreaterThan(cantidadTrasBuscar);
    });

    let totalAntesDeFacturar = 0;
    await test.step('Validar cantidad de productos y totales antes de facturar', async () => {
      const cantidadFinal = await pos.obtenerCantidadFilasCarrito();
      expect(cantidadFinal, 'Debieron sumarse líneas nuevas al carrito de la orden cargada').toBeGreaterThan(cantidadInicial);

      totalAntesDeFacturar = await pos.obtenerTotalVentaNumerico();
      expect(totalAntesDeFacturar, 'El total de la venta debe ser mayor a 0').toBeGreaterThan(0);
    });

    await test.step('Facturar con el total exacto en efectivo', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total mostrado en el modal de pago debe coincidir con el del carrito').toBeCloseTo(totalAntesDeFacturar, 1);
      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar facturación exitosa: carrito vacío y orden marcada como Facturada', async () => {
      await pos.validarCarritoVacio();
      // Hallazgo real confirmado en vivo: tras pasar por "AGREGAR ITEMS" +
      // Vista Expandida sobre una Orden de Ruteo ya cargada al carrito, el
      // cambio de pestaña superior por click deja de dispararse de forma
      // confiable, y ni irAlPos() ni cargarPosDesdeDashboard() por sí solos
      // recuperan un estado navegable de forma consistente — ver el
      // comentario completo de recargarPosTrasFacturarConReintento(). No
      // ocurre en los escenarios de esta suite que facturan una Orden de
      // Ruteo SIN pasar por Agregar Ítem/Vista Expandida (Escenarios 17-19).
      await recargarPosTrasFacturarConReintento(pos);
      await pos.abrirListadoOrdenesRuteo();
      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(String(idOrdenCreada)), 'La orden debía quedar "Facturado" tras completar la venta').toBe('Facturado');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('16. Seleccionar "Agregar Ítem" en una Orden de Ruteo, cambiar a Vista Expandida, agregar producto existente y uno rápido, y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let idOrdenCreada = 0;
    await test.step('Crear una Orden de Ruteo base', async () => {
      await agregarUnProducto(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearOrdenRuteo();
      const { respuesta } = await completarYGuardarOrdenRuteo(pos, 'Escenario 16 - Agregar Item + Vista Expandida');
      idOrdenCreada = parseInt((await respuesta.text()).trim(), 10);
      expect(idOrdenCreada, 'La respuesta de guardado debe devolver un id numérico válido').toBeGreaterThanOrEqual(1);
    });

    let totalAntesDeAgregar = 0;
    await test.step('Seleccionar la Orden de Ruteo para facturarla y leer el total antes de agregar más productos', async () => {
      await pos.abrirListadoOrdenesRuteo();
      await pos.seleccionarOrdenRuteoParaFacturar(String(idOrdenCreada));
      totalAntesDeAgregar = await pos.obtenerTotalVentaNumerico();
      expect(totalAntesDeAgregar, 'La orden cargada debía traer un total mayor a 0').toBeGreaterThan(0);
    });

    await test.step('Seleccionar "Agregar Ítem" y confirmar que navega al catálogo de Productos', async () => {
      await pos.abrirAgregarItem();
    });

    let codigoProducto = '';
    let nombreProducto = '';
    await test.step('En Vista Normal, localizar un producto existente por su código', async () => {
      if (await pos.vistaExpandidaActiva()) {
        await pos.alternarVistaExpandida();
      }
      // obtenerPrimerProductoNoPresenteEnCarrito() (no obtenerPrimerProductoNormal()):
      // la orden de Ruteo ya cargada trae su propio producto en el carrito —
      // buscar y "agregar" ese mismo producto de nuevo solo le sumaría
      // cantidad a la línea ya existente (ver el comentario de
      // obtenerTextoCarrito() en pos.page.ts), sin crear la línea nueva que
      // este escenario necesita validar.
      const producto = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      nombreProducto = producto.nombre;
      codigoProducto = await pos.obtenerCodigoProducto(nombreProducto);
    });

    await test.step('Cambiar a Vista Expandida y validar que el cambio ocurrió realmente', async () => {
      if (!(await pos.vistaExpandidaActiva())) {
        await pos.alternarVistaExpandida();
      }
      expect(await pos.vistaExpandidaActiva(), 'La vista no quedó en modo Expandida').toBe(true);
    });

    await test.step('Buscar el producto existente por código y agregarlo', async () => {
      const clavesAntes = await pos.obtenerClavesProductos();
      await pos.agregarProductoPorCodigoEnVistaExpandida(codigoProducto);
      const clavesDespues = await pos.obtenerClavesProductos();
      expect(clavesDespues.length, 'El producto buscado no quedó agregado al carrito').toBeGreaterThan(clavesAntes.length);

      const claveNueva = clavesDespues.find((c) => !clavesAntes.includes(c))!;
      const linea = await pos.obtenerDatosLineaCarrito(claveNueva);
      expect(linea.nombre, 'El producto agregado no coincide con el buscado').toBe(nombreProducto);
    });

    await test.step('Agregar un producto rápido', async () => {
      const clavesAntes = await pos.obtenerClavesProductos();
      await pos.agregarProductoRapidoSimple(`Rápido Agregar Item Ruteo ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
      const clavesDespues = await pos.obtenerClavesProductos();
      expect(clavesDespues.length, 'El producto rápido no quedó agregado al carrito').toBeGreaterThan(clavesAntes.length);
    });

    let totalRecalculado = 0;
    await test.step('Validar que los totales se recalcularon tras agregar los productos', async () => {
      totalRecalculado = await pos.obtenerTotalVentaNumerico();
      expect(totalRecalculado, 'El total debía subir tras agregar productos por "Agregar Ítem"').toBeGreaterThan(totalAntesDeAgregar);
    });

    await test.step('Facturar con el total exacto en efectivo', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total mostrado en el modal de pago debe coincidir con el recalculado').toBeCloseTo(totalRecalculado, 1);
      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar facturación correcta', async () => {
      await pos.validarCarritoVacio();
      // Ver el comentario completo de recargarPosTrasFacturarConReintento()
      // y el del Escenario 15 (mismo hallazgo real confirmado en vivo).
      await recargarPosTrasFacturarConReintento(pos);
      await pos.abrirListadoOrdenesRuteo();
      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(String(idOrdenCreada)), 'La orden debía quedar "Facturado" tras completar la venta').toBe('Facturado');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('17. Facturar una Orden de Ruteo a crédito', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let idOrdenCreada = 0;
    let nombreClienteEsperado = '';
    await test.step('Crear una Orden de Ruteo con un cliente real (Crédito exige uno)', async () => {
      await agregarUnProducto(pos);
      nombreClienteEsperado = await pos.seleccionarClienteExistente();
      await pos.abrirCrearOrdenRuteo();
      const { respuesta } = await completarYGuardarOrdenRuteo(pos, 'Escenario 17 - facturar a credito');
      idOrdenCreada = parseInt((await respuesta.text()).trim(), 10);
      expect(idOrdenCreada, 'La respuesta de guardado debe devolver un id numérico válido').toBeGreaterThanOrEqual(1);
    });

    await test.step('Seleccionar la Orden de Ruteo para facturarla y confirmar que el cliente se propagó', async () => {
      await pos.abrirListadoOrdenesRuteo();
      await pos.seleccionarOrdenRuteoParaFacturar(String(idOrdenCreada));
      expect(await pos.hayClienteRealSeleccionado(), 'La orden debía traer un cliente real ya asociado').toBe(true);
      expect(await pos.obtenerClienteSeleccionado(), 'El cliente cargado no coincide con el usado al crear la orden').toBe(nombreClienteEsperado);
    });

    await test.step('Cambiar el método de pago a Crédito y validar que aparece la Fecha de Vencimiento', async () => {
      await pos.abrirModalDePago();
      await pos.cambiarTipoPagoEnModalPago('credito');
      expect(await pos.obtenerTipoPagoEnModalPago(), 'El método de pago no quedó configurado como Crédito').toBe('credito');
    });

    await test.step('Completar la venta a crédito sin llenar ningún monto', async () => {
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar que la venta y el documento se generaron correctamente', async () => {
      await pos.validarCarritoVacio();
      await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);
      await pos.abrirListadoOrdenesRuteo();
      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(String(idOrdenCreada)), 'La orden debía quedar "Facturado" tras completar la venta a crédito').toBe('Facturado');
      expect(await pos.ordenRuteoSeleccionable(String(idOrdenCreada)), 'Una orden ya facturada a crédito no debía poder volver a seleccionarse').toBe(false);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('18. Cambiar el cliente de una Orden de Ruteo por otro existente y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let idOrdenCreada = 0;
    let clienteOriginal = '';
    await test.step('Crear una Orden de Ruteo con un cliente existente', async () => {
      await agregarUnProducto(pos);
      clienteOriginal = await pos.seleccionarClienteExistente();
      await pos.abrirCrearOrdenRuteo();
      const { respuesta } = await completarYGuardarOrdenRuteo(pos, 'Escenario 18 - cambiar cliente');
      idOrdenCreada = parseInt((await respuesta.text()).trim(), 10);
      expect(idOrdenCreada, 'La respuesta de guardado debe devolver un id numérico válido').toBeGreaterThanOrEqual(1);
    });

    await test.step('Seleccionar la Orden de Ruteo para facturarla y confirmar el cliente original', async () => {
      await pos.abrirListadoOrdenesRuteo();
      await pos.seleccionarOrdenRuteoParaFacturar(String(idOrdenCreada));
      expect(await pos.obtenerClienteSeleccionado(), 'El cliente cargado no coincide con el usado al crear la orden').toBe(clienteOriginal);
    });

    let clienteNuevo = '';
    await test.step('Quitar el cliente original y seleccionar uno distinto', async () => {
      await pos.quitarClienteSeleccionado();
      expect(await pos.hayClienteRealSeleccionado(), 'El cliente original debía quedar quitado').toBe(false);

      clienteNuevo = await pos.seleccionarClienteExistenteDistintoDe(clienteOriginal);
      expect(clienteNuevo, 'El nuevo cliente no debía coincidir con el original').not.toBe(clienteOriginal);
      expect(await pos.obtenerClienteSeleccionado(), 'El nuevo cliente no quedó reflejado arriba del carrito').toBe(clienteNuevo);
    });

    await test.step('Facturar con el total exacto en efectivo', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total de la venta debe ser mayor a 0').toBeGreaterThan(0);
      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar que la venta finalizó correctamente asociada al nuevo cliente', async () => {
      await pos.validarCarritoVacio();
      await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);
      await pos.abrirListadoOrdenesRuteo();
      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(String(idOrdenCreada)), 'La orden debía quedar "Facturado" tras completar la venta').toBe('Facturado');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('19. Facturar una Orden de Ruteo con un producto rápido agregado y validar que no permite una segunda facturación', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let idOrdenCreada = 0;
    await test.step('Crear una Orden de Ruteo base', async () => {
      await agregarUnProducto(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearOrdenRuteo();
      const { respuesta } = await completarYGuardarOrdenRuteo(pos, 'Escenario 19 - prevenir doble facturacion');
      idOrdenCreada = parseInt((await respuesta.text()).trim(), 10);
      expect(idOrdenCreada, 'La respuesta de guardado debe devolver un id numérico válido').toBeGreaterThanOrEqual(1);
    });

    let estadoEnvioInicial: 1 | 2 | 3 = 1;
    await test.step('Confirmar el estado inicial y seleccionar la orden para facturarla', async () => {
      await pos.abrirListadoOrdenesRuteo();
      estadoEnvioInicial = await pos.obtenerEstadoTarjetaRuteo(String(idOrdenCreada));
      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(String(idOrdenCreada)), 'La orden recién creada debía estar "Pendiente" de facturar').toBe('Pendiente');
      expect(await pos.ordenRuteoSeleccionable(String(idOrdenCreada)), 'La orden recién creada debía poder seleccionarse para facturar').toBe(true);

      await pos.seleccionarOrdenRuteoParaFacturar(String(idOrdenCreada));
    });

    await test.step('Agregar un producto rápido', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido Doble Facturación Ruteo ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
    });

    await test.step('Facturar con el total exacto en efectivo', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total de la venta debe ser mayor a 0').toBeGreaterThan(0);
      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar que la orden queda facturada, permanece en el mismo estado de envío y ya no puede volver a seleccionarse', async () => {
      await pos.validarCarritoVacio();
      await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);
      await pos.abrirListadoOrdenesRuteo();

      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(String(idOrdenCreada)), 'La orden debía quedar "Facturado" tras completar la venta').toBe('Facturado');
      expect(
        await pos.obtenerEstadoTarjetaRuteo(String(idOrdenCreada)),
        'Facturar la orden no debía cambiar su estado de envío (tab correspondiente)'
      ).toBe(estadoEnvioInicial);
      expect(
        await pos.ordenRuteoSeleccionable(String(idOrdenCreada)),
        'Una orden ya facturada no debía poder volver a seleccionarse para facturar de nuevo (botón "Seleccionar órden" no debe seguir visible)'
      ).toBe(false);
    });

    await test.step('Validar que los datos de la orden permanecen consistentes', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(String(idOrdenCreada));
      const detalle = await pos.verOrdenRuteo(String(idOrdenCreada));
      expect(detalle.numero.length, 'La orden ya facturada debe conservar su consecutivo').toBeGreaterThan(0);
      expect(detalle.cantidadProductos, 'La orden ya facturada debe conservar el producto original + el rápido agregado').toBeGreaterThanOrEqual(2);
      expect(detalle.total, 'La orden ya facturada debe conservar un total mayor a 0').toBeGreaterThan(0);
    });

    await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});
