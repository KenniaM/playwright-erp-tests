import { test as base, expect, Response, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT, espiarErroresJS } from './pos.page';

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
});
