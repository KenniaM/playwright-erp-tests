import { test as base, expect, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT, PRECIO_PRODUCTO_RAPIDO, espiarErroresJS } from './pos.page';

// ─── Sesión compartida (fixture de scope 'worker', NO mode: 'serial') ──────
//
// Mismo mecanismo ya adoptado en pos-ruteo.spec.ts y pos-orden-caja.spec.ts:
// una fixture propia con `scope: 'worker'`, el mismo con el que Playwright ya
// crea `browser` (una instancia por proceso worker, reutilizada en todos los
// tests que ese worker ejecute) — no test.describe.configure({mode:'serial'}),
// que obligaría a correr todo el archivo en un único worker y, si un test
// falla, saltaría el resto en vez de ejecutarlos (reduce el valor de la
// suite para QA) y entraría en conflicto con `fullyParallel: true` ya
// configurado en playwright.config.ts.
//
// El login real sigue ocurriendo una única vez por corrida completa en el
// proyecto "setup" (auth.setup.ts, storageState compartido, sin cambios); el
// paso por Dashboard (cargarPosDesdeDashboard()) se hace como máximo una vez
// POR WORKER, nunca una vez por test.
type ImportarFacturaFixtures = {
  sharedPage: Page;
  pos: PosPage;
};

const test = base.extend<{}, ImportarFacturaFixtures>({
  sharedPage: [async ({ browser }, use) => {
    const page = await browser.newPage();
    await use(page);
    await page.close();
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  pos: [async ({ sharedPage }, use) => {
    const pos = new PosPage(sharedPage);
    // Único paso por Dashboard que este worker hará para todo el archivo:
    // necesario para calentar la caché HTTP del navegador y evitar la
    // condición de carrera de "Agregar" ya documentada en el comentario de
    // cargarPosDesdeDashboard() (pos.page.ts).
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    await use(pos);
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],
});

/**
 * Deja el POS en un estado limpio y con la caja abierta antes de cada
 * escenario, sin repetir el login ni el paso por Dashboard: navega directo a
 * la URL del POS (pos.irAlPos(), ya seguro tras el cargarPosDesdeDashboard()
 * único que la fixture "pos" ya hizo para este worker) y vuelve a resolver el
 * estado inicial (grid de productos o modal "Abrir Caja").
 *
 * Se completa la apertura si el modal aparece (no solo se cancela, a
 * diferencia de pos-ruteo.spec.ts/pos-orden-caja.spec.ts): aunque Facturar sí
 * sabe abrir la caja sobre la marcha (confirmarPagoAbriendoCajaSiEsNecesario(),
 * que cada test sigue llamando en su propio paso de "Facturar"), dejarla
 * abierta desde el beforeEach reproduce el mismo comportamiento que ya tenía
 * cada test antes de esta migración (cargarPosEImportarFactura()), evitando
 * cualquier diferencia funcional.
 */
test.beforeEach(async ({ pos }) => {
  test.setTimeout(TIMEOUTS.TEST);
  await pos.irAlPos();
  await pos.esperarEstadoInicial();
  await pos.cerrarOverlaysConocidos();
  if (await pos.modalAbrirCajaVisible()) {
    await pos.completarAperturaCaja();
  }
});

// ─── Helpers compartidos ────────────────────────────────────────────────────
// Todos componen métodos ya existentes de PosPage — ninguno reimplementa
// lógica de facturación, productos, descuentos ni esperas.

/** Importa la primera factura disponible — punto de partida común a todos los escenarios. */
async function importarPrimeraFactura(pos: PosPage) {
  await pos.abrirImportarFactura();
  await pos.importarPrimeraFacturaDisponible();
}

/** Divide el total actual en dos montos (tarjeta + efectivo) que suman exactamente el total — mismo criterio ya usado en pos.spec.ts para pago mixto en Facturar normal (a diferencia de Apartado, aquí la suma SÍ debe ser exacta, no menor). */
async function calcularPagoMixtoExacto(pos: PosPage): Promise<{ montoTarjeta: string; montoEfectivo: string }> {
  const total = await pos.obtenerTotalVentaNumerico();
  expect(total, 'El total de la venta debe ser mayor a 0').toBeGreaterThan(0);
  const montoTarjeta = (Math.floor(total * 100 / 2) / 100).toFixed(2);
  const montoEfectivo = (total - parseFloat(montoTarjeta)).toFixed(2);
  return { montoTarjeta, montoEfectivo };
}

/**
 * Agrega un producto normal y un servicio desde el catálogo abierto con
 * abrirAgregarItemImportarFactura(), devolviendo la clave de cada línea
 * agregada.
 *
 * Elige explícitamente un producto y un servicio que TODAVÍA NO estén en el
 * carrito (ver obtenerTextoCarrito() en pos.page.ts). Motivo, confirmado en
 * vivo: add_to_table() no crea una línea nueva para un producto que ya está
 * presente en el carrito (por ejemplo, si coincide con una línea ya
 * importada de la factura) — en vez de eso le suma la cantidad a la línea
 * existente, lo que deja a agregarProductoDelGridAlCarrito() esperando para
 * siempre una clave nueva que nunca aparece. No es un defecto de un producto
 * puntual del catálogo (como se creyó en una primera revisión, que evitaba
 * únicamente el primer producto normal vía obtenerSegundoProductoNormalDistinto()):
 * cualquier producto ya presente en el carrito se comporta igual, así que la
 * exclusión correcta es por contenido actual del carrito, no por nombre fijo.
 *
 * Reutiliza localizarPrimerProducto() (ya existente, pagina el catálogo
 * completo con scroll real) con un predicado que compone la misma condición
 * que ya usan obtenerPrimerProductoNormal()/obtenerPrimerServicio()
 * (tipoItem/esFraccionado) sumándole la exclusión de nombres ya presentes en
 * el carrito — no se reutilizan esos dos helpers directamente porque ninguno
 * conoce el contenido actual del carrito.
 */
async function agregarProductoYServicioDesdeCatalogo(pos: PosPage): Promise<{ claveProducto: string; claveServicio: string }> {
  const textoCarritoAntesProducto = await pos.obtenerTextoCarrito();
  const productoNormal = await pos.localizarPrimerProducto(
    (m) => m.tipoItem === 1 && !m.esFraccionado && !textoCarritoAntesProducto.includes(m.nombre),
    'producto normal que todavía no esté en el carrito'
  );
  const claveProducto = await pos.agregarProductoDelGridAlCarrito(productoNormal);

  if (!(await pos.tabEstaActivo(pos.tabServicios))) {
    await pos.tabServicios.click();
    await expect.poll(() => pos.tabEstaActivo(pos.tabServicios), { timeout: TIMEOUTS.PRODUCTS_LOAD }).toBe(true);
  }
  const textoCarritoAntesServicio = await pos.obtenerTextoCarrito();
  const servicio = await pos.localizarPrimerProducto(
    (m) => m.tipoItem === 2 && !textoCarritoAntesServicio.includes(m.nombre),
    'servicio que todavía no esté en el carrito'
  );
  const claveServicio = await pos.agregarProductoDelGridAlCarrito(servicio);

  return { claveProducto, claveServicio };
}

// ═══════════════════════════════════════════════════════════════════════════
// Importar Factura
// ═══════════════════════════════════════════════════════════════════════════
//
// Cada test es funcionalmente independiente (importa su propia factura y no
// depende del resultado de ningún otro) aunque, dentro de un mismo worker,
// reutilicen la misma `page`/sesión ya autenticada — ver la fixture "pos" y
// beforeEach() arriba. Las facturas del catálogo pueden tener cliente
// asociado o ser "Cliente de contado" indistintamente — confirmado en vivo
// (Fase 1) que la propia app sincroniza #customer_select en ambos casos sin
// necesitar lógica especial de este lado, así que ningún escenario distingue
// entre ambos casos.

test.describe('Importar Factura', () => {

  test('1. Seleccionar una factura, importarla y facturar normalmente', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await importarPrimeraFactura(pos);

    await test.step('Facturar con el total exacto en efectivo', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total).toBeGreaterThan(0);
      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar carrito vacío', async () => {
      await pos.validarCarritoVacio();
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('2. Seleccionar una factura, importarla, agregar un producto rápido y facturar en efectivo', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await importarPrimeraFactura(pos);

    await test.step('Agregar un producto rápido', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido Importar Factura ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
    });

    await test.step('Facturar con el total exacto en efectivo', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total).toBeGreaterThan(0);
      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar carrito vacío', async () => {
      await pos.validarCarritoVacio();
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('3. Seleccionar una factura, importarla, agregar dos productos rápidos, aplicar descuento individual y facturar con pago mixto (efectivo + tarjeta)', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await importarPrimeraFactura(pos);

    let clavesProductosRapidos: string[] = [];
    await test.step('Agregar dos productos rápidos', async () => {
      const sufijo = Date.now();
      await pos.agregarProductoRapidoSimple(`Rápido A Importar Factura ${sufijo}`, PRECIO_PRODUCTO_RAPIDO);
      await pos.agregarProductoRapidoSimple(`Rápido B Importar Factura ${sufijo}`, PRECIO_PRODUCTO_RAPIDO);
      // obtenerClavesProductos() no detecta las líneas de la factura importada
      // (confirmado en vivo, Fase 1: no llevan el id "drag_and_drop_") — las
      // claves devueltas aquí son exactamente las de los dos productos rápidos.
      clavesProductosRapidos = await pos.obtenerClavesProductos();
      expect(clavesProductosRapidos.length).toBeGreaterThanOrEqual(2);
    });

    await test.step(`Aplicar descuento individual del ${DESCUENTO_INDIVIDUAL_PCT}% a los productos rápidos`, async () => {
      await pos.desactivarDescuentoGeneral();
      for (const clave of clavesProductosRapidos) {
        await pos.aplicarDescuentoIndividual(clave, DESCUENTO_INDIVIDUAL_PCT);
      }
    });

    await test.step('Facturar con pago mixto: mitad tarjeta, mitad efectivo', async () => {
      await pos.abrirModalDePago();
      const { montoTarjeta, montoEfectivo } = await calcularPagoMixtoExacto(pos);
      await pos.seleccionarPagoMixto(montoTarjeta, montoEfectivo);
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar carrito vacío', async () => {
      await pos.validarCarritoVacio();
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('4. Seleccionar una factura, importarla, agregar dos productos rápidos, aplicar descuento general y facturar con pago mixto (efectivo + tarjeta)', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await importarPrimeraFactura(pos);

    await test.step('Agregar dos productos rápidos', async () => {
      const sufijo = Date.now();
      await pos.agregarProductoRapidoSimple(`Rápido A Desc General ${sufijo}`, PRECIO_PRODUCTO_RAPIDO);
      await pos.agregarProductoRapidoSimple(`Rápido B Desc General ${sufijo}`, PRECIO_PRODUCTO_RAPIDO);
    });

    await test.step(`Activar el descuento general del ${DESCUENTO_GENERAL_PCT}% y validar que se aplicó`, async () => {
      const totalAntes = await pos.obtenerTotalVentaNumerico();
      await pos.activarDescuentoGeneral();
      await pos.mostrarDetalleAvanzadoFactura();
      await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);
      const totalDespues = await pos.obtenerTotalVentaNumerico();
      expect(totalDespues, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalAntes);
    });

    await test.step('Facturar con pago mixto: mitad tarjeta, mitad efectivo', async () => {
      await pos.abrirModalDePago();
      const { montoTarjeta, montoEfectivo } = await calcularPagoMixtoExacto(pos);
      await pos.seleccionarPagoMixto(montoTarjeta, montoEfectivo);
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar carrito vacío', async () => {
      await pos.validarCarritoVacio();
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('5. Seleccionar una factura, importarla, agregar un producto y un servicio desde "AGREGAR ITEMS", y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await importarPrimeraFactura(pos);

    await test.step('Validar que la factura fue cargada al carrito', async () => {
      expect(await pos.obtenerCantidadFilasCarrito(), 'La factura importada no cargó ninguna línea al carrito').toBeGreaterThan(0);
    });

    let claveProducto = '';
    let claveServicio = '';
    await test.step('Presionar "AGREGAR ITEMS" y confirmar que navega a la vista de Productos', async () => {
      await pos.abrirAgregarItemImportarFactura();
    });

    await test.step('Agregar un producto y, en el tab Servicios, un servicio', async () => {
      ({ claveProducto, claveServicio } = await agregarProductoYServicioDesdeCatalogo(pos));
      const claves = await pos.obtenerClavesProductos();
      expect(claves, 'El producto agregado no aparece en el carrito').toContain(claveProducto);
      expect(claves, 'El servicio agregado no aparece en el carrito').toContain(claveServicio);
    });

    await test.step('Facturar con el total exacto en efectivo', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total).toBeGreaterThan(0);
      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar carrito vacío', async () => {
      await pos.validarCarritoVacio();
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('6. Seleccionar una factura, importarla, agregar un producto y un servicio, aplicar descuento general, regresar al tab Facturas y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await importarPrimeraFactura(pos);

    await test.step('Validar que la factura fue cargada al carrito', async () => {
      expect(await pos.obtenerCantidadFilasCarrito(), 'La factura importada no cargó ninguna línea al carrito').toBeGreaterThan(0);
    });

    await test.step('Presionar "AGREGAR ITEMS" y agregar un producto y un servicio', async () => {
      await pos.abrirAgregarItemImportarFactura();
    });

    let claveProducto = '';
    let claveServicio = '';
    let filasAntesDeVolver = 0;
    let totalConDescuento = 0;
    await test.step(`Activar el descuento general del ${DESCUENTO_GENERAL_PCT}% y validar que se aplicó`, async () => {
      ({ claveProducto, claveServicio } = await agregarProductoYServicioDesdeCatalogo(pos));
      filasAntesDeVolver = await pos.obtenerCantidadFilasCarrito();

      // Se desactiva primero cualquier descuento general que la factura importada
      // ya pueda traer consigo — confirmado en vivo que la factura de este
      // catálogo compartido que termina siendo "la primera de la lista" puede
      // venir con descuento general ya activado (proviene de una venta anterior
      // que sí lo aplicó), así que "activarlo al 10%" sería un no-op si ya
      // estaba en ese mismo porcentaje. Sin este reseteo, totalAntes ya vendría
      // descontado y la comparación de abajo no detectaría nada.
      await pos.desactivarDescuentoGeneral();
      const totalAntes = await pos.obtenerTotalVentaNumerico();
      await pos.activarDescuentoGeneral();
      await pos.mostrarDetalleAvanzadoFactura();
      await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);
      totalConDescuento = await pos.obtenerTotalVentaNumerico();
      expect(totalConDescuento, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalAntes);
    });

    await test.step('Presionar "Volver" y validar que el sistema regresa al tab Facturas conservando el carrito', async () => {
      // volverDesdeAgregarItemImportarFactura() ya valida que el tab "Importar
      // factura" queda activo y visible — aquí solo se valida lo propio de este
      // escenario: que nada del carrito ni del descuento ya aplicado se perdió.
      await pos.volverDesdeAgregarItemImportarFactura();

      const claves = await pos.obtenerClavesProductos();
      expect(claves, 'El producto agregado no sobrevivió al volver al tab Facturas').toContain(claveProducto);
      expect(claves, 'El servicio agregado no sobrevivió al volver al tab Facturas').toContain(claveServicio);
      expect(await pos.obtenerCantidadFilasCarrito(), 'La cantidad de líneas del carrito cambió al volver al tab Facturas').toBe(filasAntesDeVolver);
      expect(await pos.obtenerTotalVentaNumerico(), 'El descuento general ya no se refleja en el total tras volver').toBeCloseTo(totalConDescuento, 1);
    });

    await test.step('Facturar con el total exacto en efectivo', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total).toBeGreaterThan(0);
      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar carrito vacío', async () => {
      await pos.validarCarritoVacio();
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});
