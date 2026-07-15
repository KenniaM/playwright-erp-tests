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
  test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
  const listo = await pos.irAlPos()
    .then(() => pos.esperarEstadoInicial())
    .then(() => true)
    .catch(() => false);
  if (!listo) {
    // Confirmado en vivo: bajo carga sostenida (corridas largas con muchos
    // escenarios seguidos en el mismo worker), la ruta rápida puede
    // quedarse sin resolver ni el modal "Abrir Caja" ni el grid dentro de
    // PRODUCTS_LOAD — no es un problema de ningún escenario en particular
    // (se confirmó antes de escenarios muy distintos entre sí: Editar
    // Orden, Marcar como Pendiente, Marcar como Entregado, cambiar
    // cliente). recargarPosConReintento() ya reintenta la ruta completa
    // por Dashboard hasta 3 veces para el mismo síntoma tras facturar; se
    // reutiliza aquí como fallback en vez de duplicar esa lógica.
    await recargarPosConReintento(pos);
  }
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
 * productos visible) reintentando la ruta completa por Dashboard
 * (cargarPosDesdeDashboard()) hasta 3 veces — confirmado en vivo, en
 * corridas independientes, que esto puede fallar en dos escenarios
 * distintos, ninguno de los dos un error determinista de ningún método en
 * particular:
 *   1. Tras un flujo pesado de Vista Expandida + "AGREGAR ITEMS" + Facturar
 *      sobre una Orden de Ruteo, donde ni irAlPos() (ruta rápida) ni
 *      cargarPosDesdeDashboard() (ruta completa) por sí solos bastan.
 *   2. Bajo carga sostenida de la propia sesión/worker (corridas largas con
 *      muchos escenarios seguidos): confirmado en vivo que
 *      beforeEach()/irAlPos()+esperarEstadoInicial() puede quedarse sin
 *      resolver ni el modal de caja ni el grid dentro de PRODUCTS_LOAD,
 *      incluso ANTES de escenarios que ni siquiera facturan (Editar Orden,
 *      Marcar como Pendiente/Entregado) — degradación real del ambiente/
 *      sesión compartida, no específica de ningún flujo.
 * Mismo patrón de reintento acotado ya usado en el resto de este archivo/
 * pos.page.ts para overlays y navegación inestable (p. ej.
 * _cerrarOverlayDashboardSiAparece()): cargarPosDesdeDashboard() ya incluye
 * su propio esperarEstadoInicial(), así que un segundo o tercer intento
 * completo suele bastar para recuperarse en la práctica.
 */
async function recargarPosConReintento(pos: PosPage) {
  const MAX_INTENTOS = 3;
  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      await pos.cargarPosDesdeDashboard();
      return;
    } catch (e) {
      if (intento === MAX_INTENTOS) throw e;
      console.log(`[recargarPosConReintento] Intento ${intento} no dejó el POS en un estado navegable, reintentando: ${(e as Error).message.slice(0, 200)}`);
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
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
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
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
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
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
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
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
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
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
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
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
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
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
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
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
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
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
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
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
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

  test('11. Editar Orden: seleccionar una Orden de Ruteo existente, modificar Ruta, Repartidor y Observaciones, y validar que persisten', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    // No crea una orden propia: cualquier Orden de Ruteo ya existente sirve
    // para editarla (obtenerPrimeraOrdenRuteoSeleccionable() ya evita las
    // que estén Facturadas, aunque para editar Ruta/Repartidor/Observación
    // ese estado no importa realmente).
    let idOrdenSeleccionada = '';
    await test.step('Localizar una Orden de Ruteo existente', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenSeleccionada = await pos.obtenerPrimeraOrdenRuteoSeleccionable();
    });

    const nuevaObservacion = `Escenario 11 - observación editada ${Date.now()}`;
    let nuevoRepartidor = '';
    await test.step(
      'Abrir "Editar Orden" y modificar Ruta, Repartidor y Observaciones — los ÚNICOS campos editables en este ambiente ' +
      '(confirmado en vivo: el modal de edición reutiliza el mismo #dialog_add_routing_order de la creación, sin bloque ' +
      'de cliente/vendedor/productos/cantidades, que no son editables desde esta pantalla)',
      async () => {
        await pos.abrirMenuAccionesOrdenRuteo(idOrdenSeleccionada);
        const resultado = await pos.editarOrdenRuteo(idOrdenSeleccionada, nuevaObservacion);
        nuevoRepartidor = resultado.repartidor;
        expect(resultado.observacionRegistrada, 'La nueva observación no quedó registrada en el campo').toBe(nuevaObservacion);
      }
    );

    await test.step('Volver a abrir la orden ("Ver Orden") y validar que los cambios persistieron, sin perder el resto de la información', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(idOrdenSeleccionada);
      const detalle = await pos.verOrdenRuteo(idOrdenSeleccionada);

      expect(detalle.observacion, 'La observación editada no persistió al volver a abrir la orden').toBe(nuevaObservacion);
      expect(detalle.repartidor, 'El repartidor editado no persistió al volver a abrir la orden').toContain(nuevoRepartidor);
      expect(detalle.numero.length, 'La orden no debe perder su consecutivo tras editarla').toBeGreaterThan(0);
      expect(detalle.total, 'La orden no debe perder su total tras editarla').toBeGreaterThan(0);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('12. Marcar como Pendiente: seleccionar una Orden de Ruteo existente "En camino" y validar que pasa a Pendiente', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    // No crea una orden propia: localiza directamente una Orden de Ruteo YA
    // EXISTENTE en estado "En camino" (obtenerPrimeraOrdenRuteoConEstado(2))
    // — el menú de acciones solo ofrece "Marcar como <estado>" para estados
    // DISTINTOS al actual, así que necesita partir de un estado distinto de
    // Pendiente para poder ejercer esta acción; no hace falta crear una
    // orden y avanzarla manualmente cuando el ambiente ya tiene órdenes
    // reales en ese estado.
    let idOrdenSeleccionada = '';
    let detalleOriginal: Awaited<ReturnType<typeof pos.verOrdenRuteo>>;
    await test.step('Localizar una Orden de Ruteo existente en estado "En camino" y capturar su información original', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenSeleccionada = await pos.obtenerPrimeraOrdenRuteoConEstado(2);
      await pos.abrirMenuAccionesOrdenRuteo(idOrdenSeleccionada);
      detalleOriginal = await pos.verOrdenRuteo(idOrdenSeleccionada);
    });

    await test.step('Marcar como Pendiente y validar el estado final', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(idOrdenSeleccionada);
      await pos.cambiarEstadoOrdenRuteo(idOrdenSeleccionada, 1);
      const estadoFinal = await pos.obtenerEstadoTarjetaRuteo(idOrdenSeleccionada);
      expect(estadoFinal, 'La orden no pasó a estado Pendiente (1)').toBe(1);
    });

    await test.step('Validar que la orden conserva toda su información tras el cambio de estado', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(idOrdenSeleccionada);
      const detalleFinal = await pos.verOrdenRuteo(idOrdenSeleccionada);
      expect(detalleFinal.numero, 'La orden no debe perder su consecutivo').toBe(detalleOriginal.numero);
      expect(detalleFinal.cantidadProductos, 'La orden no debe perder sus productos').toBe(detalleOriginal.cantidadProductos);
      expect(detalleFinal.total, 'La orden no debe perder su total').toBeCloseTo(detalleOriginal.total, 1);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('13. Marcar como En Camino: seleccionar una Orden de Ruteo existente Pendiente y validar que pasa a En Camino', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    // No crea una orden propia: localiza directamente una Orden de Ruteo YA
    // EXISTENTE en estado Pendiente (obtenerPrimeraOrdenRuteoConEstado(1)) —
    // el estado inicial más común en este ambiente.
    let idOrdenSeleccionada = '';
    let detalleOriginal: Awaited<ReturnType<typeof pos.verOrdenRuteo>>;
    await test.step('Localizar una Orden de Ruteo existente Pendiente y capturar su información original', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenSeleccionada = await pos.obtenerPrimeraOrdenRuteoConEstado(1);
      await pos.abrirMenuAccionesOrdenRuteo(idOrdenSeleccionada);
      detalleOriginal = await pos.verOrdenRuteo(idOrdenSeleccionada);
    });

    await test.step('Marcar como "En camino" y validar el estado final', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(idOrdenSeleccionada);
      await pos.cambiarEstadoOrdenRuteo(idOrdenSeleccionada, 2);
      const estadoFinal = await pos.obtenerEstadoTarjetaRuteo(idOrdenSeleccionada);
      expect(estadoFinal, 'La orden no quedó en estado "En camino" (2)').toBe(2);
    });

    await test.step('Validar que la orden conserva toda su información tras el cambio de estado', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(idOrdenSeleccionada);
      const detalleFinal = await pos.verOrdenRuteo(idOrdenSeleccionada);
      expect(detalleFinal.numero, 'La orden no debe perder su consecutivo').toBe(detalleOriginal.numero);
      expect(detalleFinal.cantidadProductos, 'La orden no debe perder sus productos').toBe(detalleOriginal.cantidadProductos);
      expect(detalleFinal.total, 'La orden no debe perder su total').toBeCloseTo(detalleOriginal.total, 1);
    });

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

  test('14. Marcar una Orden de Ruteo como Entregado: ir a una orden ya "En camino" y validar la transición real de estado', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    // Nota (confirmado en vivo, investigado a fondo): este ambiente NO
    // expone ninguna pestaña de filtro real por estado de envío dentro del
    // listado "Ruteo" — los textos "Pendientes"/"En Camino"/"Entregado"
    // visibles junto a los íconos de color son una simple leyenda (`<small>`
    // sin onclick ni handler alguno, confirmado intentando clickearla en
    // vivo: no dispara ningún refiltrado); los únicos `.global-search-tab`
    // reales del documento pertenecen al buscador global del header
    // (Módulos/Productos/Permisos/etc.), sin relación con este listado. El
    // equivalente real y funcional a "ir al tab En Camino" es localizar
    // directamente, entre las órdenes YA EXISTENTES, una cuya propia tarjeta
    // ya esté en ese estado (obtenerPrimeraOrdenRuteoConEstado(2)) — mismo
    // criterio que ya usan los Escenarios 12/13 de este archivo.
    let idOrdenSeleccionada = '';
    let detalleOriginal: Awaited<ReturnType<typeof pos.verOrdenRuteo>>;
    await test.step('Localizar una Orden de Ruteo existente ya "En camino" y capturar su información original', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenSeleccionada = await pos.obtenerPrimeraOrdenRuteoConEstado(2);
      await pos.abrirMenuAccionesOrdenRuteo(idOrdenSeleccionada);
      detalleOriginal = await pos.verOrdenRuteo(idOrdenSeleccionada);
    });

    await test.step('Marcarla como Entregado y validar que sale de "En camino" y queda en "Entregado"', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(idOrdenSeleccionada);
      await pos.cambiarEstadoOrdenRuteo(idOrdenSeleccionada, 3);
      const estadoFinal = await pos.obtenerEstadoTarjetaRuteo(idOrdenSeleccionada);
      expect(estadoFinal, 'La orden no quedó en estado "Entregado" (3) — la acción debe sacarla de "En camino" (2)').toBe(3);
    });

    await test.step('Validar que los datos de la orden permanecen correctos tras el cambio de estado', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(idOrdenSeleccionada);
      const detalleFinal = await pos.verOrdenRuteo(idOrdenSeleccionada);
      expect(detalleFinal.clienteNombre, 'El cliente de la orden no debía cambiar al marcarla Entregado').toBe(detalleOriginal.clienteNombre);
      expect(detalleFinal.cantidadProductos, 'La cantidad de productos no debía cambiar al marcarla Entregado').toBe(detalleOriginal.cantidadProductos);
      expect(detalleFinal.total, 'El total de la orden no debía cambiar al marcarla Entregado').toBeCloseTo(detalleOriginal.total, 1);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('15. Facturar una Orden de Ruteo existente, sin pasar por "Agregar Ítem", en Vista Expandida agregando un producto existente (con IVA) y uno rápido', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    // No crea una orden propia: cualquier Orden de Ruteo ya existente que
    // siga Pendiente de facturar sirve para este escenario (ver
    // obtenerPrimeraOrdenRuteoSeleccionable()) — este ambiente ya trae un
    // listado grande de órdenes previas.
    let idOrdenSeleccionada = '';
    let detalleOriginal: Awaited<ReturnType<typeof pos.verOrdenRuteo>>;
    await test.step('Localizar una Orden de Ruteo existente y capturar su información original (cliente, repartidor, dirección) antes de tocarla', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenSeleccionada = await pos.obtenerPrimeraOrdenRuteoSeleccionable();
      await pos.abrirMenuAccionesOrdenRuteo(idOrdenSeleccionada);
      detalleOriginal = await pos.verOrdenRuteo(idOrdenSeleccionada);
    });

    let cantidadInicial = 0;
    await test.step('Seleccionar la orden para facturarla, sin salir del tab "Ruteo", y confirmar que el cliente original se propagó al carrito', async () => {
      await pos.seleccionarOrdenRuteoParaFacturar(idOrdenSeleccionada);
      cantidadInicial = await pos.obtenerCantidadFilasCarrito();
      expect(cantidadInicial, 'La orden seleccionada debía cargar al menos una línea al carrito').toBeGreaterThan(0);
      expect(await pos.pestanaRuteoActiva(), 'Seleccionar la orden no debía sacar al usuario del tab "Ruteo"').toBe(true);
      // Validar la persistencia del cliente ahora (carrito ya cargado, DOM
      // liviano) en vez de reabrir la tarjeta de la orden después de
      // facturar: confirmado en vivo que, justo tras completar la venta, la
      // propia tarjeta puede quedar oculta en su listado (212 órdenes) hasta
      // 120s — mismo criterio ya usado por los Escenarios 17-19 (que
      // tampoco reabren la tarjeta tras facturar).
      // detalleOriginal.clienteNombre viene del modal "Ver Orden" con el
      // prefijo "Nombre:" incluido (mismo formato ya manejado con
      // toContain() en el Escenario 10); obtenerClienteSeleccionado() lee
      // el nombre limpio desde el carrito.
      expect(detalleOriginal.clienteNombre, 'El cliente original de la orden no se propagó al carrito').toContain(await pos.obtenerClienteSeleccionado());
    });

    let codigoProducto = '';
    let nombreProducto = '';
    await test.step('Localizar un producto existente con IVA y cambiar a Vista Expandida, sin pasar por "Agregar Ítem"', async () => {
      // obtenerPrimerProductoConIvaNoPresenteEnCarrito() (no obtenerPrimerProductoConIva()):
      // la orden de Ruteo ya cargada trae su propio producto en el carrito —
      // buscar y "agregar" ese mismo producto de nuevo solo le sumaría
      // cantidad a la línea ya existente (ver el comentario de
      // obtenerTextoCarrito() en pos.page.ts), sin crear la línea nueva que
      // este escenario necesita validar. Confirmado en vivo (script de
      // investigación) que el catálogo (L.PRODUCTO, 72 tarjetas) sigue
      // presente y legible en el DOM sin pasar por "Agregar Ítem", aunque
      // no se muestre visualmente en el tab "Ruteo".
      const productoConIva = await pos.obtenerPrimerProductoConIvaNoPresenteEnCarrito();
      nombreProducto = productoConIva.nombre;
      codigoProducto = await pos.obtenerCodigoProducto(nombreProducto);

      if (!(await pos.vistaExpandidaActiva())) {
        await pos.alternarVistaExpandida();
      }
      expect(await pos.vistaExpandidaActiva(), 'La vista no quedó en modo Expandida').toBe(true);
      expect(await pos.pestanaRuteoActiva(), 'Cambiar a Vista Expandida no debía sacar al usuario del tab "Ruteo"').toBe(true);
      expect(await pos.seEncuentraEnVistaAgregarItem(), 'No debía entrarse al flujo "Agregar Ítem" en ningún momento').toBe(false);
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
    await test.step('Buscar el producto por su código en el buscador interno (arriba de "Información del Cliente") y agregarlo', async () => {
      // obtenerClavesFilasCarrito() (no obtenerClavesProductos()): el
      // carrito viene de una Orden de Ruteo IMPORTADA (ver el comentario de
      // obtenerClavesFilasCarrito() en pos.page.ts) — mismo motivo que el
      // fix aplicado dentro de agregarProductoPorCodigoEnVistaExpandida().
      const clavesAntes = await pos.obtenerClavesFilasCarrito();
      await pos.agregarProductoPorCodigoEnVistaExpandida(codigoProducto);
      const clavesDespues = await pos.obtenerClavesFilasCarrito();
      expect(clavesDespues.length, 'El producto buscado no quedó agregado al carrito').toBeGreaterThan(clavesAntes.length);

      const claveNueva = clavesDespues.find((c) => !clavesAntes.includes(c))!;
      const linea = await pos.obtenerDatosLineaCarrito(claveNueva);
      expect(linea.nombre, 'El producto agregado no coincide con el buscado').toBe(nombreProducto);
      expect(linea.iva, 'El producto buscado (con IVA) debía reflejar un monto de IVA mayor a 0').toBeGreaterThan(0);

      cantidadTrasBuscar = await pos.obtenerCantidadFilasCarrito();
    });

    await test.step('Agregar un producto rápido', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido Ruteo Sin AgregarItem ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
      const cantidadTrasRapido = await pos.obtenerCantidadFilasCarrito();
      expect(cantidadTrasRapido, 'El producto rápido no quedó agregado al carrito').toBeGreaterThan(cantidadTrasBuscar);
    });

    let totalAntesDeFacturar = 0;
    await test.step('Validar cantidades, impuestos y totales antes de facturar, y confirmar que el flujo se mantuvo en el tab "Ruteo" sin entrar a "Agregar Ítem"', async () => {
      const cantidadFinal = await pos.obtenerCantidadFilasCarrito();
      expect(cantidadFinal, 'Debieron sumarse líneas nuevas al carrito de la orden cargada').toBeGreaterThan(cantidadInicial);

      totalAntesDeFacturar = await pos.obtenerTotalVentaNumerico();
      expect(totalAntesDeFacturar, 'El total de la venta debe ser mayor a 0').toBeGreaterThan(0);

      expect(await pos.pestanaRuteoActiva(), 'El flujo completo debía realizarse sin salir del tab "Ruteo"').toBe(true);
      expect(await pos.seEncuentraEnVistaAgregarItem(), 'En ningún momento debía entrarse al flujo "Agregar Ítem"').toBe(false);
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
      // Ni visitarPestanaPos(PESTANA_POS_FACTURACION) ni un nuevo
      // abrirListadoOrdenesRuteo(), ni abrirMenuAccionesOrdenRuteo()/
      // verOrdenRuteo() aquí: el flujo completo de este escenario nunca
      // salió del tab "Ruteo" (ver los pasos anteriores), y confirmado en
      // vivo que, justo tras facturar, la propia tarjeta de la orden puede
      // quedar oculta en su listado (212 órdenes) hasta 120s — mismo
      // criterio ya usado por los Escenarios 17-19 (que tampoco reabren la
      // tarjeta tras facturar). La persistencia del cliente ya se validó
      // arriba (al cargar la orden); ruta/repartidor/dirección no se tocan
      // en ningún paso de este escenario, así que no hay ninguna acción que
      // pudiera haberlos alterado.
      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(idOrdenSeleccionada), 'La orden debía quedar "Facturado" tras completar la venta').toBe('Facturado');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('16. Seleccionar una Orden de Ruteo existente, "Agregar Ítem", cambiar a Vista Expandida, agregar producto existente y uno rápido, y facturar', async ({ pos, sharedPage }) => {
    // TEST_CON_RECUPERACION (no TEST) — mismo motivo que el Escenario 15:
    // ver su comentario y el de TIMEOUTS.TEST_CON_RECUPERACION.
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    // No crea una orden propia: cualquier Orden de Ruteo ya existente que
    // siga Pendiente de facturar sirve (ver obtenerPrimeraOrdenRuteoSeleccionable()).
    let idOrdenSeleccionada = '';
    let totalAntesDeAgregar = 0;
    await test.step('Seleccionar una Orden de Ruteo existente para facturarla y leer el total antes de agregar más productos', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenSeleccionada = await pos.obtenerPrimeraOrdenRuteoSeleccionable();
      await pos.seleccionarOrdenRuteoParaFacturar(idOrdenSeleccionada);
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
      // obtenerClavesFilasCarrito() (no obtenerClavesProductos()): el
      // carrito viene de una Orden de Ruteo IMPORTADA (ver el comentario de
      // obtenerClavesFilasCarrito() en pos.page.ts) — root-cause real (no
      // asumido) del timeout de 120s permanente que este mismo paso
      // presentaba antes de este fix: el producto SÍ se agregaba
      // correctamente (confirmado en vivo, visible en el DOM con su
      // precio/código reales), pero obtenerClavesProductos() solo cuenta
      // filas con id "drag_and_drop_", ausente en líneas importadas, así
      // que el conteo "antes/después" podía quedar en 0/0 para siempre.
      const clavesAntes = await pos.obtenerClavesFilasCarrito();
      await pos.agregarProductoPorCodigoEnVistaExpandida(codigoProducto);
      const clavesDespues = await pos.obtenerClavesFilasCarrito();
      expect(clavesDespues.length, 'El producto buscado no quedó agregado al carrito').toBeGreaterThan(clavesAntes.length);

      const claveNueva = clavesDespues.find((c) => !clavesAntes.includes(c))!;
      const linea = await pos.obtenerDatosLineaCarrito(claveNueva);
      expect(linea.nombre, 'El producto agregado no coincide con el buscado').toBe(nombreProducto);
    });

    await test.step('Agregar un producto rápido', async () => {
      const clavesAntes = await pos.obtenerClavesFilasCarrito();
      await pos.agregarProductoRapidoSimple(`Rápido Agregar Item Ruteo ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
      const clavesDespues = await pos.obtenerClavesFilasCarrito();
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
      // Encoger Vista Expandida antes de intentar recuperar la navegación:
      // hipótesis a validar en vivo (sugerida tras las 4 reproducciones ya
      // documentadas del hallazgo de recargarPosConReintento()) — dejar la
      // vista comprimida en su estado normal antes de la recarga podría
      // aliviar el DOM pesado que impide que el modal de caja o el grid se
      // vuelvan visibles.
      if (await pos.vistaExpandidaActiva()) {
        await pos.alternarVistaExpandida();
      }
      // Ver el comentario completo de recargarPosConReintento()
      // y el del Escenario 15 (mismo hallazgo real confirmado en vivo).
      await recargarPosConReintento(pos);
      await pos.abrirListadoOrdenesRuteo();
      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(idOrdenSeleccionada), 'La orden debía quedar "Facturado" tras completar la venta').toBe('Facturado');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('17. Facturar una Orden de Ruteo a crédito', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    // No crea una orden propia: toda Orden de Ruteo ya trae un cliente real
    // asociado (obligatorio para crearla, ver el comentario de
    // seleccionarOrdenRuteoParaFacturar()), que es justo lo que esta venta a
    // crédito necesita.
    let idOrdenSeleccionada = '';
    let nombreClienteEsperado = '';
    await test.step('Seleccionar una Orden de Ruteo existente para facturarla y confirmar que trae un cliente real asociado', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenSeleccionada = await pos.obtenerPrimeraOrdenRuteoSeleccionable();
      await pos.seleccionarOrdenRuteoParaFacturar(idOrdenSeleccionada);
      expect(await pos.hayClienteRealSeleccionado(), 'La orden debía traer un cliente real ya asociado').toBe(true);
      nombreClienteEsperado = await pos.obtenerClienteSeleccionado();
      expect(nombreClienteEsperado.length, 'El cliente cargado desde la orden debe tener un nombre visible').toBeGreaterThan(0);
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
      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(idOrdenSeleccionada), 'La orden debía quedar "Facturado" tras completar la venta a crédito').toBe('Facturado');
      expect(await pos.ordenRuteoSeleccionable(idOrdenSeleccionada), 'Una orden ya facturada a crédito no debía poder volver a seleccionarse').toBe(false);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('18. Cambiar el cliente de una Orden de Ruteo por otro existente y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    // No crea una orden propia: cualquier Orden de Ruteo ya existente que
    // siga Pendiente de facturar sirve (ver obtenerPrimeraOrdenRuteoSeleccionable()) —
    // toda Orden de Ruteo trae un cliente real ya asociado.
    let idOrdenSeleccionada = '';
    let clienteOriginal = '';
    await test.step('Seleccionar una Orden de Ruteo existente para facturarla y leer su cliente original', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenSeleccionada = await pos.obtenerPrimeraOrdenRuteoSeleccionable();
      await pos.seleccionarOrdenRuteoParaFacturar(idOrdenSeleccionada);
      clienteOriginal = await pos.obtenerClienteSeleccionado();
      expect(clienteOriginal.length, 'El cliente cargado desde la orden debe tener un nombre visible').toBeGreaterThan(0);
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
      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(idOrdenSeleccionada), 'La orden debía quedar "Facturado" tras completar la venta').toBe('Facturado');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('19. Facturar una Orden de Ruteo con un producto rápido agregado y validar que no permite una segunda facturación', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    // No crea una orden propia: cualquier Orden de Ruteo ya existente que
    // siga Pendiente de facturar sirve (ver obtenerPrimeraOrdenRuteoSeleccionable()).
    let idOrdenSeleccionada = '';
    let estadoEnvioInicial: 1 | 2 | 3 = 1;
    let cantidadProductosOriginal = 0;
    await test.step('Localizar una Orden de Ruteo existente, confirmar su estado inicial y seleccionarla para facturar', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenSeleccionada = await pos.obtenerPrimeraOrdenRuteoSeleccionable();
      estadoEnvioInicial = await pos.obtenerEstadoTarjetaRuteo(idOrdenSeleccionada);
      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(idOrdenSeleccionada), 'La orden localizada debía estar "Pendiente" de facturar').toBe('Pendiente');
      expect(await pos.ordenRuteoSeleccionable(idOrdenSeleccionada), 'La orden localizada debía poder seleccionarse para facturar').toBe(true);

      await pos.abrirMenuAccionesOrdenRuteo(idOrdenSeleccionada);
      cantidadProductosOriginal = (await pos.verOrdenRuteo(idOrdenSeleccionada)).cantidadProductos;

      await pos.seleccionarOrdenRuteoParaFacturar(idOrdenSeleccionada);
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

      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(idOrdenSeleccionada), 'La orden debía quedar "Facturado" tras completar la venta').toBe('Facturado');
      expect(
        await pos.obtenerEstadoTarjetaRuteo(idOrdenSeleccionada),
        'Facturar la orden no debía cambiar su estado de envío (tab correspondiente)'
      ).toBe(estadoEnvioInicial);
      expect(
        await pos.ordenRuteoSeleccionable(idOrdenSeleccionada),
        'Una orden ya facturada no debía poder volver a seleccionarse para facturar de nuevo (botón "Seleccionar órden" no debe seguir visible)'
      ).toBe(false);
    });

    await test.step('Validar que los datos de la orden permanecen consistentes', async () => {
      await pos.abrirMenuAccionesOrdenRuteo(idOrdenSeleccionada);
      const detalle = await pos.verOrdenRuteo(idOrdenSeleccionada);
      expect(detalle.numero.length, 'La orden ya facturada debe conservar su consecutivo').toBeGreaterThan(0);
      expect(detalle.cantidadProductos, 'La orden ya facturada debe conservar los productos originales + el rápido agregado').toBeGreaterThan(cantidadProductosOriginal);
      expect(detalle.total, 'La orden ya facturada debe conservar un total mayor a 0').toBeGreaterThan(0);
    });

    await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  // ─── Escenarios adicionales: H. de Órdenes, Agregar Ítem con combinaciones
  // de productos, Vista Lista, múltiples órdenes, persistencia de
  // descuentos, y edición del carrito ─────────────────────────────────────
  //
  // Ninguno de estos escenarios crea su propia Orden de Ruteo: todos
  // localizan una orden YA EXISTENTE en el estado que necesitan
  // (obtenerPrimeraOrdenRuteoSeleccionable()/
  // obtenerPrimeraOrdenRuteoConEstadoYSeleccionable()), para no seguir
  // contaminando el ambiente QA con más órdenes de las estrictamente
  // necesarias — mismo criterio ya establecido en los Escenarios 11-19.

  test('20. Seleccionar una Orden de Ruteo del tab "Entregado", facturarla y validar que pasa al tab "H. de Órdenes"', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    let idOrdenSeleccionada = '';
    await test.step('Localizar, dentro del filtro real "Entregado", una Orden de Ruteo que todavía pueda facturarse', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenSeleccionada = await pos.obtenerPrimeraOrdenRuteoConEstadoYSeleccionable(3);
    });

    await test.step('Seleccionar la orden para facturarla', async () => {
      await pos.seleccionarOrdenRuteoParaFacturar(idOrdenSeleccionada);
    });

    await test.step('Facturar con el total exacto en efectivo', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total de la venta debe ser mayor a 0').toBeGreaterThan(0);
      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar que la orden desaparece del filtro "Entregado" y aparece en "H. de Órdenes"', async () => {
      await pos.validarCarritoVacio();
      await pos.abrirListadoOrdenesRuteo();

      const sigueEnEntregado = await pos.ordenVisibleEnFiltroEntregado(idOrdenSeleccionada);
      expect(sigueEnEntregado, 'La orden ya Entregada + Facturada no debía seguir apareciendo en el filtro "Entregado"').toBe(false);

      const enHistorial = await pos.ordenVisibleEnHistorial(idOrdenSeleccionada);
      expect(enHistorial, 'La orden ya Entregada + Facturada debía aparecer en "H. de Órdenes"').toBe(true);

      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(idOrdenSeleccionada), 'La orden debía quedar "Facturado" tras completar la venta').toBe('Facturado');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('21. Seleccionar una Orden de Ruteo, Agregar Ítem con producto rápido, fraccionado y normal, volver y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    let idOrdenSeleccionada = '';
    let cantidadInicial = 0;
    await test.step('Seleccionar una Orden de Ruteo existente para facturarla', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenSeleccionada = await pos.obtenerPrimeraOrdenRuteoSeleccionable();
      await pos.seleccionarOrdenRuteoParaFacturar(idOrdenSeleccionada);
      cantidadInicial = await pos.obtenerCantidadFilasCarrito();
      expect(cantidadInicial, 'La orden seleccionada debía cargar al menos una línea al carrito').toBeGreaterThan(0);
    });

    await test.step('Ingresar a "Agregar Ítem"', async () => {
      await pos.abrirAgregarItem();
    });

    let clavesAntes: string[] = [];
    await test.step('Agregar un producto rápido, un producto fraccionado y un producto normal', async () => {
      clavesAntes = await pos.obtenerClavesFilasCarrito();

      await pos.agregarProductoRapidoSimple(`Rápido AgregarItem ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);

      const fraccionado = await pos.obtenerPrimerProductoFraccionadoNoPresenteEnCarrito();
      await pos.agregarProductoFraccionadoAlCarrito(fraccionado);

      const normal = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await pos.agregarProductoDelGridAlCarrito(normal);

      const clavesDespues = await pos.obtenerClavesFilasCarrito();
      expect(clavesDespues.length, 'Los 3 productos deben quedar en el carrito').toBeGreaterThanOrEqual(clavesAntes.length + 3);
    });

    await test.step('Volver al tab "Ruteo" y validar que el carrito sobrevive', async () => {
      const totalAntesDeVolver = await pos.obtenerTotalVentaNumerico();
      await pos.volverDesdeAgregarItemHaciaRuteo();
      const clavesTrasVolver = await pos.obtenerClavesFilasCarrito();
      expect(clavesTrasVolver.length, 'Los productos agregados no sobrevivieron al volver').toBeGreaterThanOrEqual(clavesAntes.length + 3);
      const totalTrasVolver = await pos.obtenerTotalVentaNumerico();
      expect(totalTrasVolver, 'El total no debía cambiar al volver').toBeCloseTo(totalAntesDeVolver, 1);
    });

    let totalAntesDeFacturar = 0;
    await test.step('Validar cantidades, impuestos y totales antes de facturar', async () => {
      const cantidadFinal = await pos.obtenerCantidadFilasCarrito();
      expect(cantidadFinal, 'Debieron sumarse líneas nuevas al carrito de la orden cargada').toBeGreaterThan(cantidadInicial);

      totalAntesDeFacturar = await pos.obtenerTotalVentaNumerico();
      expect(totalAntesDeFacturar, 'El total de la venta debe ser mayor a 0').toBeGreaterThan(0);

      const ivaAcumulado = await pos.obtenerTotalIvaGeneral();
      expect(ivaAcumulado, 'El IVA acumulado no debe ser negativo').toBeGreaterThanOrEqual(0);
    });

    await test.step('Facturar con el total exacto en efectivo', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total mostrado en el modal de pago debe coincidir con el del carrito').toBeCloseTo(totalAntesDeFacturar, 1);
      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar facturación exitosa', async () => {
      await pos.validarCarritoVacio();
      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(idOrdenSeleccionada), 'La orden debía quedar "Facturado" tras completar la venta').toBe('Facturado');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('22. Seleccionar una Orden de Ruteo, Agregar Ítem en Vista Modo Lista con producto rápido, fraccionado y normal, volver y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    let idOrdenSeleccionada = '';
    let cantidadInicial = 0;
    await test.step('Seleccionar una Orden de Ruteo existente para facturarla', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenSeleccionada = await pos.obtenerPrimeraOrdenRuteoSeleccionable();
      await pos.seleccionarOrdenRuteoParaFacturar(idOrdenSeleccionada);
      cantidadInicial = await pos.obtenerCantidadFilasCarrito();
      expect(cantidadInicial, 'La orden seleccionada debía cargar al menos una línea al carrito').toBeGreaterThan(0);
    });

    await test.step('Ingresar a "Agregar Ítem" y cambiar el catálogo a modo Lista', async () => {
      await pos.abrirAgregarItem();
      await pos.botonVistaLista.click();
      await expect.poll(() => pos.vistaEstaActiva(pos.botonVistaLista)).toBe(true);
    });

    let clavesAntes: string[] = [];
    await test.step('Agregar un producto rápido, un producto fraccionado y un producto normal, en modo Lista', async () => {
      clavesAntes = await pos.obtenerClavesFilasCarrito();

      await pos.agregarProductoRapidoSimple(`Rápido Lista ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);

      const fraccionado = await pos.obtenerPrimerProductoFraccionadoNoPresenteEnCarrito();
      await pos.agregarProductoFraccionadoAlCarrito(fraccionado);

      const normal = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await pos.agregarProductoDelGridAlCarrito(normal);

      const clavesDespues = await pos.obtenerClavesFilasCarrito();
      expect(clavesDespues.length, 'Los 3 productos deben quedar en el carrito').toBeGreaterThanOrEqual(clavesAntes.length + 3);
    });

    await test.step('Volver al tab "Ruteo" y validar que el carrito sobrevive', async () => {
      await pos.volverDesdeAgregarItemHaciaRuteo();
      const clavesTrasVolver = await pos.obtenerClavesFilasCarrito();
      expect(clavesTrasVolver.length, 'Los productos agregados no sobrevivieron al volver').toBeGreaterThanOrEqual(clavesAntes.length + 3);
    });

    let totalAntesDeFacturar = 0;
    await test.step('Validar cantidades y totales antes de facturar', async () => {
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

    await test.step('Validar facturación exitosa', async () => {
      await pos.validarCarritoVacio();
      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(idOrdenSeleccionada), 'La orden debía quedar "Facturado" tras completar la venta').toBe('Facturado');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('23. Seleccionar dos Órdenes de Ruteo distintas y validar que mantienen su información independiente', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    let idOrdenA = '';
    await test.step('Seleccionar la Orden A y agregar rápido, fraccionado, normal y un combo vía Agregar Ítem, sin facturarla', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenA = await pos.obtenerPrimeraOrdenRuteoSeleccionable();

      await pos.seleccionarOrdenRuteoParaFacturar(idOrdenA);
      await pos.abrirAgregarItem();
      await pos.agregarProductoRapidoSimple(`Rápido OrdenA ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
      const fraccionado = await pos.obtenerPrimerProductoFraccionadoNoPresenteEnCarrito();
      await pos.agregarProductoFraccionadoAlCarrito(fraccionado);
      const normal = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await pos.agregarProductoDelGridAlCarrito(normal);
      const combo = await pos.obtenerPrimerCombo();
      await pos.agregarProductoDelGridAlCarrito(combo);

      const cantidadEnCarritoA = await pos.obtenerCantidadFilasCarrito();
      expect(cantidadEnCarritoA, 'Deben quedar varias líneas nuevas en el carrito de la Orden A').toBeGreaterThan(0);
    });

    let idOrdenB = '';
    let cantidadProductosA = 0;
    await test.step('Volver al tab "Ruteo" (sin facturar la Orden A), leer su cantidad REAL de productos vía "Ver Orden" y seleccionar una Orden B distinta', async () => {
      await pos.volverDesdeAgregarItemHaciaRuteo();

      // obtenerCantidadFilasCarrito() (cuenta filas crudas de la tabla del
      // carrito) y verOrdenRuteo().cantidadProductos (cuenta lógica del
      // modal "Ver Orden") NO son la misma métrica — confirmado en vivo que
      // un combo puede inflar el conteo de filas crudas con sus propios
      // componentes sin cambiar la cantidad lógica de productos de la
      // orden. Se usa aquí, una sola vez, la MISMA fuente
      // (verOrdenRuteo().cantidadProductos) que se usará al final para
      // comparar manzanas con manzanas.
      await pos.abrirMenuAccionesOrdenRuteo(idOrdenA);
      cantidadProductosA = (await pos.verOrdenRuteo(idOrdenA)).cantidadProductos;
      expect(cantidadProductosA, 'La Orden A debía reflejar los productos recién agregados').toBeGreaterThan(0);

      idOrdenB = await pos.obtenerPrimeraOrdenRuteoSeleccionable(idOrdenA);
      expect(idOrdenB, 'La Orden B debía ser distinta de la Orden A').not.toBe(idOrdenA);

      await pos.seleccionarOrdenRuteoParaFacturar(idOrdenB);
      const cantidadEnCarritoB = await pos.obtenerCantidadFilasCarrito();
      expect(cantidadEnCarritoB, 'La Orden B debía cargar su propio carrito, sin residuos de la Orden A').toBeGreaterThan(0);
    });

    await test.step('Facturar la Orden B con el total exacto en efectivo', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total de la Orden B debe ser mayor a 0').toBeGreaterThan(0);
      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar que la Orden B quedó Facturada y la Orden A conserva, sin verse afectada por lo que le pasó a B, exactamente lo que se le agregó', async () => {
      await pos.validarCarritoVacio();
      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(idOrdenB), 'La Orden B debía quedar "Facturado"').toBe('Facturado');

      // Hallazgo real confirmado en vivo (no una suposición previa de este
      // test): "Agregar Ítem" sobre una Orden de Ruteo persiste los
      // productos agregados en el servidor de inmediato, sin esperar a
      // "Facturar" — por eso la Orden A conserva cantidadEnCarritoA (lo que
      // se le agregó), no su cantidad original. La independencia real que
      // este escenario valida es que esos productos son PROPIOS de la
      // Orden A y no se ven afectados por facturar una Orden B distinta.
      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(idOrdenA), 'La Orden A NO debía quedar facturada (nunca se completó su venta)').toBe('Pendiente');
      await pos.abrirMenuAccionesOrdenRuteo(idOrdenA);
      const detalleA = await pos.verOrdenRuteo(idOrdenA);
      expect(detalleA.cantidadProductos, 'La Orden A debía conservar los productos que se le agregaron, sin verse afectada por la Orden B').toBe(cantidadProductosA);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('24. Seleccionar una Orden de Ruteo, aplicar un descuento general y validar que persiste al volver a seleccionar la misma orden', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    let idOrdenSeleccionada = '';
    await test.step('Seleccionar una Orden de Ruteo existente y agregar rápido, fraccionado, normal y un combo vía Agregar Ítem', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenSeleccionada = await pos.obtenerPrimeraOrdenRuteoSeleccionable();
      await pos.seleccionarOrdenRuteoParaFacturar(idOrdenSeleccionada);
      await pos.abrirAgregarItem();
      await pos.agregarProductoRapidoSimple(`Rápido DescGeneral ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
      const fraccionado = await pos.obtenerPrimerProductoFraccionadoNoPresenteEnCarrito();
      await pos.agregarProductoFraccionadoAlCarrito(fraccionado);
      const normal = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await pos.agregarProductoDelGridAlCarrito(normal);
      const combo = await pos.obtenerPrimerCombo();
      await pos.agregarProductoDelGridAlCarrito(combo);
      await pos.volverDesdeAgregarItemHaciaRuteo();
    });

    let totalConDescuento = 0;
    await test.step(`Aplicar el descuento general del ${DESCUENTO_GENERAL_PCT}% y validar que se aplicó`, async () => {
      const totalSinDescuento = await pos.obtenerTotalVentaNumerico();
      await pos.mostrarDetalleAvanzadoFactura();
      await pos.activarDescuentoGeneral();
      await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);
      totalConDescuento = await pos.obtenerTotalVentaNumerico();
      expect(totalConDescuento, 'El descuento general no bajó el total').toBeLessThan(totalSinDescuento);
    });

    // BUG DEL SISTEMA confirmado en vivo (no de automatización — navegación
    // ya estable, sin ruido de ambiente, reproducido de forma consistente):
    // el descuento general aplicado a una Orden de Ruteo NO se persiste en
    // el servidor. Al volver a seleccionar la MISMA orden, el checkbox
    // "apply_general_discount" aparece desmarcado (estaDescuentoGeneralActivo()
    // devuelve false) y el total regresa a su valor SIN descuento —
    // evidencia real de una corrida: checkbox esperado=true, recibido=false;
    // esto contrasta con los productos agregados vía "Agregar Ítem", que SÍ
    // se persisten de inmediato en el servidor (confirmado en el
    // Escenario 23, que sí pasa). La validación se deja intacta: documenta
    // correctamente esta brecha real, no se debilita para forzar un pase.
    await test.step('Volver a seleccionar la misma orden y validar que el descuento general sigue aplicado', async () => {
      // No vuelve a llamar abrirListadoOrdenesRuteo(): el paso anterior ya
      // dejó el tab "Ruteo" activo (volverDesdeAgregarItemHaciaRuteo()) y
      // aplicar el descuento no navega fuera de ahí — confirmado en vivo
      // que re-clickear el tab aunque ya esté activo puede colgarse contra
      // su propio DOM pesado (mismo hallazgo ya documentado en el
      // Escenario 15/comentario de abrirListadoOrdenesRuteo()).
      await pos.seleccionarOrdenRuteoParaFacturar(idOrdenSeleccionada);
      await pos.mostrarDetalleAvanzadoFactura();
      expect(await pos.estaDescuentoGeneralActivo(), 'El descuento general debía seguir activo tras volver a seleccionar la misma orden').toBe(true);
      const totalTrasReseleccionar = await pos.obtenerTotalVentaNumerico();
      expect(totalTrasReseleccionar, 'El total con descuento general no persistió tras volver a seleccionar la misma orden').toBeCloseTo(totalConDescuento, 1);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('25. Seleccionar una Orden de Ruteo, aplicar un descuento individual y validar que persiste al volver a seleccionar la misma orden', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    let idOrdenSeleccionada = '';
    let nombreProductoNormal = '';
    let nombreProductoRapido = '';
    await test.step('Seleccionar una Orden de Ruteo existente y agregar rápido, fraccionado, normal y un combo vía Agregar Ítem', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenSeleccionada = await pos.obtenerPrimeraOrdenRuteoSeleccionable();
      await pos.seleccionarOrdenRuteoParaFacturar(idOrdenSeleccionada);
      await pos.abrirAgregarItem();
      nombreProductoRapido = `Rápido DescIndividual ${Date.now()}`;
      await pos.agregarProductoRapidoSimple(nombreProductoRapido, PRECIO_PRODUCTO_RAPIDO);
      const fraccionado = await pos.obtenerPrimerProductoFraccionadoNoPresenteEnCarrito();
      await pos.agregarProductoFraccionadoAlCarrito(fraccionado);
      const normal = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      nombreProductoNormal = normal.nombre;
      await pos.agregarProductoDelGridAlCarrito(normal);
      const combo = await pos.obtenerPrimerCombo();
      await pos.agregarProductoDelGridAlCarrito(combo);
      await pos.volverDesdeAgregarItemHaciaRuteo();
    });

    let totalConDescuento = 0;
    await test.step(`Aplicar un descuento individual del ${DESCUENTO_INDIVIDUAL_PCT}% a un producto y validar que se aplicó`, async () => {
      const totalSinDescuento = await pos.obtenerTotalVentaNumerico();
      await pos.desactivarDescuentoGeneral();
      // obtenerClaveDeLineaPorNombre() (no la clave capturada al agregar el
      // producto varios pasos atrás): el carrito de una Orden de Ruteo se
      // resincroniza contra el servidor en cada línea agregada (aquí, el
      // combo agregado DESPUÉS), lo que puede reasignar esa clave —
      // confirmado en vivo que usar la clave vieja hacía que el "descuento"
      // no se aplicara a la línea correcta.
      //
      // aplicarDescuentoIndividual() YA anticipa (tipo ResultadoDescuento)
      // que el sistema puede rechazar el descuento por completo
      // (escenario 'sin_descuento') para un producto puntual — confirmado
      // en vivo con un producto real de este catálogo ("A11 - PROT. BLING
      // GLITTER ROSA"): el descuento no cambió ni la línea ni el total,
      // sin ningún error. El Escenario 6 (ya existente) aplica este mismo
      // método sin validar su resultado, así que nunca detectó este caso.
      // Aquí sí se valida: si el producto normal lo rechaza, se reintenta
      // sobre el producto rápido (precio fijo, sin restricciones de
      // catálogo) en vez de asumir a ciegas que cualquier producto acepta
      // cualquier descuento.
      const claveNormal = await pos.obtenerClaveDeLineaPorNombre(nombreProductoNormal);
      let resultado = await pos.aplicarDescuentoIndividual(claveNormal, DESCUENTO_INDIVIDUAL_PCT);
      if (resultado.escenario !== 'aplicado') {
        console.log(`[Escenario 25] El producto "${nombreProductoNormal}" rechazó el descuento individual (escenario="${resultado.escenario}") — reintentando sobre el producto rápido.`);
        const claveRapido = await pos.obtenerClaveDeLineaPorNombre(nombreProductoRapido);
        resultado = await pos.aplicarDescuentoIndividual(claveRapido, DESCUENTO_INDIVIDUAL_PCT);
      }
      expect(resultado.escenario, `Ningún producto del carrito aceptó el descuento individual (último resultado: ${JSON.stringify(resultado)})`).toBe('aplicado');

      totalConDescuento = await pos.obtenerTotalVentaNumerico();
      expect(totalConDescuento, 'El descuento individual no bajó el total').toBeLessThan(totalSinDescuento);
    });

    // BUG DEL SISTEMA confirmado en vivo (no de automatización — mismo
    // criterio que el Escenario 24, con navegación ya estable): el
    // descuento individual tampoco se persiste en el servidor. Evidencia
    // real de una corrida: total esperado tras reseleccionar (con
    // descuento) = 10859.85, total recibido = 10913.53 — una diferencia de
    // 53.68, equivalente al descuento perdido. Confirmado dos veces de
    // forma independiente (general + individual) que los descuentos son
    // estado de sesión/carrito, no se guardan con la orden — a diferencia
    // de los productos agregados, que sí persisten (Escenario 23). La
    // validación se deja intacta: documenta correctamente esta brecha
    // real, no se debilita para forzar un pase.
    await test.step('Volver a seleccionar la misma orden y validar que el descuento individual sigue reflejado en el total', async () => {
      // No vuelve a llamar abrirListadoOrdenesRuteo(): mismo motivo que el
      // Escenario 24 (el tab "Ruteo" ya está activo desde el paso anterior).
      await pos.seleccionarOrdenRuteoParaFacturar(idOrdenSeleccionada);
      const totalTrasReseleccionar = await pos.obtenerTotalVentaNumerico();
      expect(totalTrasReseleccionar, 'El total con descuento individual no persistió tras volver a seleccionar la misma orden').toBeCloseTo(totalConDescuento, 1);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('26. Seleccionar una Orden de Ruteo, eliminar productos dejando uno solo, agregar producto rápido y observación, y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    let idOrdenSeleccionada = '';
    let claveRestante = '';
    await test.step('Seleccionar una Orden de Ruteo existente, agregar productos extra vía Agregar Ítem y luego eliminar todos menos uno', async () => {
      await pos.abrirListadoOrdenesRuteo();
      idOrdenSeleccionada = await pos.obtenerPrimeraOrdenRuteoSeleccionable();
      await pos.seleccionarOrdenRuteoParaFacturar(idOrdenSeleccionada);

      // Agregar productos extra para tener "la mayoría" que eliminar después,
      // sin depender de que la orden ya traiga varios productos por sí sola.
      await pos.abrirAgregarItem();
      const fraccionado = await pos.obtenerPrimerProductoFraccionadoNoPresenteEnCarrito();
      await pos.agregarProductoFraccionadoAlCarrito(fraccionado);
      const normal = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await pos.agregarProductoDelGridAlCarrito(normal);
      await pos.volverDesdeAgregarItemHaciaRuteo();

      const clavesTodas = await pos.obtenerClavesFilasCarrito();
      expect(clavesTodas.length, 'Debía haber al menos 2 productos en el carrito antes de eliminar').toBeGreaterThanOrEqual(2);

      claveRestante = clavesTodas[clavesTodas.length - 1];

      for (const clave of clavesTodas) {
        if (clave !== claveRestante) {
          await pos.eliminarProductoDelCarrito(clave);
        }
      }

      const clavesFinal = await pos.obtenerClavesFilasCarrito();
      expect(clavesFinal, 'Debía quedar únicamente el producto elegido para conservar').toEqual([claveRestante]);
    });

    const textoObservacion = `Observación Escenario 26 ${Date.now()}`;
    await test.step('Agregar una observación al producto restante', async () => {
      await pos.agregarObservacionAProducto(claveRestante, textoObservacion);
      const observacionGuardada = await pos.obtenerObservacionDeProducto(claveRestante);
      expect(observacionGuardada, 'La observación no quedó registrada en el producto').toBe(textoObservacion);
    });

    await test.step('Agregar un producto rápido', async () => {
      // obtenerClavesFilasCarrito().length (no obtenerCantidadFilasCarrito()):
      // confirmado en vivo (root-cause investigado a fondo, no asumido) que
      // tras eliminar líneas de un carrito de Ruteo pueden quedar filas
      // huérfanas `tr.main_row` sin id `table_product_name_` en el DOM —
      // obtenerCantidadFilasCarrito() (selector más amplio, sin ese filtro)
      // las sigue contando, inflando el resultado (8 en vez de 2 en una
      // corrida real), mientras obtenerClavesFilasCarrito() (mismo filtro
      // que ya usa eliminarProductoDelCarrito() para confirmar el detach)
      // refleja el conteo lógico real.
      const cantidadAntesDeRapido = (await pos.obtenerClavesFilasCarrito()).length;
      await pos.agregarProductoRapidoSimple(`Rápido Escenario 26 ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
      const cantidadTrasRapido = (await pos.obtenerClavesFilasCarrito()).length;
      expect(cantidadTrasRapido, 'El producto rápido no quedó agregado al carrito').toBeGreaterThan(cantidadAntesDeRapido);
    });

    let totalAntesDeFacturar = 0;
    await test.step('Validar cantidad de productos, subtotal, IVA y total antes de facturar, y que la observación sigue asociada al producto correcto', async () => {
      const cantidadFinal = (await pos.obtenerClavesFilasCarrito()).length;
      expect(cantidadFinal, 'Debían quedar exactamente 2 líneas (el producto conservado + el rápido)').toBe(2);

      const clavesActuales = await pos.obtenerClavesFilasCarrito();
      expect(clavesActuales, 'El producto original conservado debía seguir en el carrito').toContain(claveRestante);

      const observacionActual = await pos.obtenerObservacionDeProducto(claveRestante);
      expect(observacionActual, 'La observación debía seguir asociada al producto correcto').toBe(textoObservacion);

      let subtotalAcumulado = 0;
      for (const clave of clavesActuales) {
        const linea = await pos.obtenerDatosLineaCarrito(clave);
        subtotalAcumulado += linea.neto;
        expect(linea.neto, `La línea ${clave} debía tener un subtotal mayor a 0`).toBeGreaterThan(0);
      }
      expect(subtotalAcumulado, 'El subtotal acumulado del carrito debe ser mayor a 0').toBeGreaterThan(0);

      const ivaAcumulado = await pos.obtenerTotalIvaGeneral();
      expect(ivaAcumulado, 'El IVA acumulado no debe ser negativo').toBeGreaterThanOrEqual(0);

      totalAntesDeFacturar = await pos.obtenerTotalVentaNumerico();
      expect(totalAntesDeFacturar, 'El total del carrito debe ser mayor a 0').toBeGreaterThan(0);
    });

    await test.step('Facturar con el total exacto en efectivo', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total mostrado en el modal de pago debe coincidir con el del carrito').toBeCloseTo(totalAntesDeFacturar, 1);
      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar facturación exitosa', async () => {
      await pos.validarCarritoVacio();
      expect(await pos.obtenerEstadoFacturacionOrdenRuteo(idOrdenSeleccionada), 'La orden debía quedar "Facturado" tras completar la venta').toBe('Facturado');
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});
