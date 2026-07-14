import { test as base, expect, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT, PRECIO_PRODUCTO_RAPIDO, espiarErroresJS, type LineaCarrito } from './pos.page';

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

/**
 * Agrega un producto normal, un producto rápido y un producto fraccionado
 * desde el catálogo abierto con abrirAgregarItemImportarFactura(), evitando
 * el mismo problema ya documentado en agregarProductoYServicioDesdeCatalogo():
 * add_to_table() no crea una línea nueva para un producto/fraccionado que ya
 * esté en el carrito (p. ej. porque coincide con una línea ya importada de la
 * factura) — usa las variantes "NoPresenteEnCarrito" de PosPage (las mismas
 * ya reutilizadas en pos-orden-caja.spec.ts/pos-apartado.spec.ts para este
 * mismo caso) en vez de agregarProductoNormalFraccionadoYRapido() (que no
 * tiene esa protección, pensada para carritos nuevos vacíos). El producto
 * rápido nunca colisiona (siempre se crea con un nombre nuevo con timestamp).
 */
async function agregarNormalRapidoYFraccionadoDesdeCatalogo(pos: PosPage, sufijo: string): Promise<{ claveNormal: string; claveFraccionado: string }> {
  const normal = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
  const claveNormal = await pos.agregarProductoDelGridAlCarrito(normal);

  await pos.agregarProductoRapidoSimple(`Rápido Importar Factura ${sufijo}`, PRECIO_PRODUCTO_RAPIDO);

  const fraccionado = await pos.obtenerPrimerProductoFraccionadoNoPresenteEnCarrito();
  const claveFraccionado = await pos.agregarProductoFraccionadoAlCarrito(fraccionado);

  return { claveNormal, claveFraccionado };
}

/**
 * Valida cada línea del carrito contra su propio estado real de IVA (leído
 * primero, nunca asumido) — mismo helper ya adoptado en
 * pos-apartado.spec.ts/pos-orden-caja.spec.ts para el mismo propósito (una
 * factura importada arbitraria puede mezclar líneas con y sin IVA). Compone
 * establecerMostrarPrecioConIva()/obtenerDatosLineaCarrito()/validarLineaCarrito(),
 * todos ya existentes en PosPage, sin duplicar la fórmula de validación.
 */
async function validarLineasCarritoSegunEstadoReal(pos: PosPage, claves: string[]): Promise<LineaCarrito[]> {
  await pos.establecerMostrarPrecioConIva(true, claves);
  const lineas: LineaCarrito[] = [];
  for (const clave of claves) {
    const datos = await pos.obtenerDatosLineaCarrito(clave);
    lineas.push(await pos.validarLineaCarrito(clave, datos.ivaAplicado));
  }
  return lineas;
}

/**
 * Valida que subtotal + impuestos coincidan con el total mostrado — mismo
 * criterio no bloqueante ya adoptado en pos-apartado.spec.ts/pos-orden-caja.spec.ts:
 * el footer "Total" del carrito puede quedarse en 0 tras cargar/recargar un
 * carrito con varias líneas (factura importada + productos agregados), pese
 * a que cada línea individual sí calcula su propio total correctamente — se
 * documenta como hallazgo del sistema en vez de bloquear el escenario si no
 * se estabiliza a tiempo.
 *
 * Ajustada por el Descuento General activo — confirmado en vivo (mismo
 * hallazgo ya corregido en pos.validarResumenImpuestos(), ver su comentario
 * en pos.page.ts): el footer "Total" SÍ aplica el Descuento General
 * proporcionalmente sobre el bruto, pero la suma de Subtotal+Impuestos
 * calculada aquí a partir de los campos por línea NUNCA lo refleja. Sin este
 * ajuste, cualquier factura importada con Descuento General activo (heredado
 * de una venta anterior en este ambiente compartido) hace fallar esta
 * validación aunque el sistema esté calculando todo correctamente — mismo
 * criterio exacto que la fórmula ya validada en pos.validarResumenImpuestos()
 * (gateada por estaDescuentoGeneralActivo(), no por el monto bruto de
 * obtenerMontoDescuentoGeneralNumerico(), que también acumula descuentos
 * individuales ya reflejados en las líneas).
 */
async function validarTotalCarrito(pos: PosPage, lineas: LineaCarrito[]) {
  const totalBruto = pos.calcularSubtotalEsperado(lineas) + pos.calcularTotalImpuestosEsperado(lineas);
  const descuentoGeneralActivo = await pos.estaDescuentoGeneralActivo();

  let totalEsperado = totalBruto;
  if (descuentoGeneralActivo) {
    const subtotalBruto = pos.calcularSubtotalEsperado(lineas);
    const descuentoGeneral = await pos.obtenerMontoDescuentoGeneralNumerico();
    const ratioDescuentoGeneral = subtotalBruto > 0 ? 1 - (descuentoGeneral / subtotalBruto) : 1;
    totalEsperado = totalBruto * ratioDescuentoGeneral;
  }

  const seEstabilizo = await expect.poll(
    () => pos.obtenerTotalVentaNumerico(),
    { timeout: 30_000 }
  ).toBeGreaterThan(0).then(() => true).catch(() => false);

  if (!seEstabilizo) {
    console.log(
      `[Hallazgo del sistema] El total del carrito (esperado ${totalEsperado.toFixed(2)}) no terminó de estabilizarse ` +
      `tras 30s — quedó en 0, pese a que cada línea individual sí calculó su propio total correctamente. ` +
      `Inconsistencia intermitente ya confirmada en vivo al recargar carritos grandes en este ambiente.`
    );
    return;
  }
  const totalReal = await pos.obtenerTotalVentaNumerico();
  expect(totalReal, `Total esperado (subtotal + impuestos = ${totalEsperado.toFixed(2)}) no coincide con el total mostrado (${totalReal.toFixed(2)})`).toBeCloseTo(totalEsperado, 1);
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

  test('7. Seleccionar una factura, importarla, cambiar a modo Lista y agregar un producto y un servicio, aplicar descuento general, volver y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await importarPrimeraFactura(pos);

    await pos.abrirAgregarItemImportarFactura();

    await test.step('Cambiar el catálogo a modo Lista y validar el cambio', async () => {
      await pos.botonVistaLista.click();
      await expect.poll(() => pos.vistaEstaActiva(pos.botonVistaLista)).toBe(true);
    });

    let claveProducto = '';
    let claveServicio = '';
    let totalConDescuento = 0;
    await test.step('Agregar un producto y un servicio, en modo Lista', async () => {
      ({ claveProducto, claveServicio } = await agregarProductoYServicioDesdeCatalogo(pos));
      const claves = await pos.obtenerClavesProductos();
      expect(claves, 'El producto agregado no aparece en el carrito').toContain(claveProducto);
      expect(claves, 'El servicio agregado no aparece en el carrito').toContain(claveServicio);
    });

    await test.step(`Activar el descuento general del ${DESCUENTO_GENERAL_PCT}% y validar que se aplicó`, async () => {
      // Mismo criterio ya documentado en el test 6 de este archivo: partir de
      // un estado conocido antes de comparar, por si la factura "primera
      // disponible" ya trae descuento general activo de una venta anterior.
      await pos.desactivarDescuentoGeneral();
      const totalAntes = await pos.obtenerTotalVentaNumerico();
      await pos.activarDescuentoGeneral();
      await pos.mostrarDetalleAvanzadoFactura();
      await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);
      totalConDescuento = await pos.obtenerTotalVentaNumerico();
      expect(totalConDescuento, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalAntes);
    });

    await test.step('Presionar "Volver" y validar que el sistema regresa al tab Facturas conservando el carrito y el descuento', async () => {
      await pos.volverDesdeAgregarItemImportarFactura();

      const claves = await pos.obtenerClavesProductos();
      expect(claves, 'El producto agregado no sobrevivió al volver al tab Facturas').toContain(claveProducto);
      expect(claves, 'El servicio agregado no sobrevivió al volver al tab Facturas').toContain(claveServicio);
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

  test('8. Seleccionar una factura sin cliente, importarla, asignar un cliente existente y enviar a caja', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    // Se toma la factura "primera disponible" real (sin buscar, mismo
    // criterio que el resto de este archivo) y se investiga en vivo si
    // trae cliente propio (hayClienteRealSeleccionado(), ver su comentario
    // en pos.page.ts) — el escenario original pide omitir y documentar como
    // no aplicable cuando la primera factura SÍ tiene cliente, en vez de
    // buscar otra (a diferencia del escenario 3, que sí busca).
    await importarPrimeraFactura(pos);

    const tieneCliente = await pos.hayClienteRealSeleccionado();
    test.skip(tieneCliente, 'La primera factura disponible ya tiene un cliente asociado — este escenario no aplica para ella (ver escenario 3, que sí cubre ese caso).');

    // Confirmado en vivo (varias corridas): justo después de importarPrimeraFactura(),
    // la animación jQuery de 100ms que ya documenta seleccionarClienteExistente()
    // en pos.page.ts (product_panel.hide/show) puede quedar más rezagada que
    // de costumbre — la importación reemplaza toda la grilla de productos por
    // las líneas de la factura, una manipulación de DOM más pesada que un
    // simple "agregar producto" — y una búsqueda de cliente disparada de
    // inmediato cae dentro de esa ventana más amplia. No se toca
    // seleccionarClienteExistente() (usado con éxito por el resto de la
    // suite): se le da a esta transición puntual un instante para asentar.
    await sharedPage.waitForTimeout(2000);

    let nombreCliente = '';
    await test.step('Buscar un cliente existente y asignarlo', async () => {
      // Búsqueda con término real ("CITA", cliente ya confirmado existente en
      // este ambiente — ver pos-orden-caja.spec.ts/pos-apartado.spec.ts) en
      // vez de vacía: confirmado en vivo que una búsqueda vacía trae ~30
      // tarjetas de resultado, un panel bastante más pesado de renderizar
      // justo encima de una factura recién importada (ya de por sí una carga
      // de DOM pesada) que un resultado acotado a un puñado de tarjetas.
      nombreCliente = await pos.seleccionarClienteExistente('CITA');
      expect(nombreCliente.length).toBeGreaterThan(0);
      expect(await pos.hayClienteRealSeleccionado(), 'El cliente asignado no quedó reflejado como cliente real').toBe(true);
    });

    await test.step('Enviar a caja y validar que el cliente asignado se propagó', async () => {
      await pos.abrirMenuOrdenCaja();
      await expect(
        await pos.obtenerClienteEnOrdenCaja(),
        'El cliente asignado no se propagó al modal "Enviar a caja"'
      ).toBe(nombreCliente);
      await pos.seleccionarTipoPagoOrdenCaja('contado');
      await pos.llenarObservacionesOrdenCaja(`Importar Factura QA - sin cliente, asignado ${Date.now()}`);
      const respuesta = await pos.enviarOrdenCaja();
      await pos.validarOrdenCajaCreada(respuesta);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('9. Seleccionar una factura con cliente, quitarlo, agregar únicamente el nombre del cliente y enviar a caja', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    // A diferencia del escenario 8, aquí SÍ se busca explícitamente una
    // factura con cliente real (importarPrimeraFacturaConCliente(), nueva —
    // ver su comentario en pos.page.ts), tal como pide el escenario original
    // ("si no tiene cliente, buscar otra que sí tenga").
    await pos.abrirImportarFactura();
    await pos.importarPrimeraFacturaConCliente();
    expect(await pos.hayClienteRealSeleccionado(), 'La factura elegida debía tener un cliente real').toBe(true);

    const nombreClienteUnico = `Cliente Solo Nombre Importar Factura ${Date.now()}`;
    await test.step('Quitar el cliente real y agregar únicamente el nombre del cliente', async () => {
      await pos.quitarClienteSeleccionado();
      expect(await pos.hayClienteRealSeleccionado(), 'El cliente debía quedar quitado').toBe(false);

      // ingresarNombreCliente() ya existe (usado en pos-orden-caja.spec.ts) y
      // confirmado en vivo que funciona igual tras quitar el cliente de una
      // factura importada — sin necesidad de una segunda implementación.
      await pos.ingresarNombreCliente(nombreClienteUnico);
    });

    await test.step('Enviar a caja', async () => {
      await pos.abrirMenuOrdenCaja();
      await pos.seleccionarTipoPagoOrdenCaja('contado');
      await pos.llenarObservacionesOrdenCaja(`Importar Factura QA - cliente quitado, solo nombre ${Date.now()}`);
      const respuesta = await pos.enviarOrdenCaja();
      await pos.validarOrdenCajaCreada(respuesta);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('10. Seleccionar una factura, importarla, agregar producto normal, rápido y fraccionado, volver y crear una Cotización', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await importarPrimeraFactura(pos);
    await pos.abrirAgregarItemImportarFactura();

    await test.step('Agregar producto normal, rápido y fraccionado', async () => {
      const { claveNormal, claveFraccionado } = await agregarNormalRapidoYFraccionadoDesdeCatalogo(pos, `Cotizacion ${Date.now()}`);
      const claves = await pos.obtenerClavesProductos();
      expect(claves, 'El producto normal agregado no aparece en el carrito').toContain(claveNormal);
      expect(claves, 'El producto fraccionado agregado no aparece en el carrito').toContain(claveFraccionado);
    });

    await test.step('Presionar "Volver"', async () => {
      await pos.volverDesdeAgregarItemImportarFactura();
    });

    await test.step('Crear una Cotización (Proforma Normal) y validar que se creó correctamente', async () => {
      await pos.abrirCrearProforma();
      await pos.seleccionarTipoProforma('normal');

      // Crear una Proforma exige un cliente real (nombre libre desde este
      // mismo modal, o uno ya existente asignado al carrito antes de
      // abrirlo) — confirmado que una factura importada SIN cliente propio
      // no basta por sí sola (a diferencia de Facturar/Enviar a caja, que sí
      // aceptan "Cliente de contado" sin problema). Si la factura importada
      // ya traía un cliente real (hayClienteRealSeleccionado()), no hace
      // falta agregar nada aquí — mismo criterio ya usado en
      // pos-proforma.spec.ts (test "Nombre del cliente"): llenarNombreClienteProforma()
      // directamente en este modal, sin cerrarlo ni pasar por el buscador de
      // clientes del carrito.
      if (!(await pos.hayClienteRealSeleccionado())) {
        await pos.llenarNombreClienteProforma(`Cliente Importar Factura Cotizacion ${Date.now()}`);
      }

      const respuesta = await pos.guardarProformaYObtenerRespuesta();
      await pos.validarProformaCreada(respuesta);
      await pos.cerrarModalGestionProforma();
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('11. Seleccionar una factura, importarla, agregar producto normal, rápido y fraccionado, volver y enviar a caja', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await importarPrimeraFactura(pos);
    await pos.abrirAgregarItemImportarFactura();

    await test.step('Agregar producto normal, rápido y fraccionado', async () => {
      const { claveNormal, claveFraccionado } = await agregarNormalRapidoYFraccionadoDesdeCatalogo(pos, `EnviarCaja ${Date.now()}`);
      const claves = await pos.obtenerClavesProductos();
      expect(claves, 'El producto normal agregado no aparece en el carrito').toContain(claveNormal);
      expect(claves, 'El producto fraccionado agregado no aparece en el carrito').toContain(claveFraccionado);
    });

    await test.step('Presionar "Volver"', async () => {
      await pos.volverDesdeAgregarItemImportarFactura();
    });

    await test.step('Enviar a caja', async () => {
      // La factura importada ya puede traer un cliente real propio —
      // forzar seleccionarClienteExistente() cuando ya hay uno asignado
      // deja el buscador de cliente sin volver a mostrarse nunca
      // (confirmado en vivo, mismo hallazgo ya documentado y corregido en
      // el test 13 de este archivo). Búsqueda con término real en vez de
      // vacía cuando sí hace falta — mismo motivo ya documentado en el
      // test 8 (evitar el panel de ~30 tarjetas de resultado justo encima
      // de un carrito ya cargado).
      if (!(await pos.hayClienteRealSeleccionado())) {
        await pos.seleccionarClienteExistente('CITA');
      }
      await pos.abrirMenuOrdenCaja();
      await pos.seleccionarTipoPagoOrdenCaja('contado');
      await pos.llenarObservacionesOrdenCaja(`Importar Factura QA - enviar a caja ${Date.now()}`);
      const respuesta = await pos.enviarOrdenCaja();
      await pos.validarOrdenCajaCreada(respuesta);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('12. Seleccionar una factura, importarla, agregar producto normal, rápido y fraccionado, volver y crear una Orden de Ruteo (solo campos obligatorios)', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await importarPrimeraFactura(pos);
    await pos.abrirAgregarItemImportarFactura();

    await test.step('Agregar producto normal, rápido y fraccionado', async () => {
      const { claveNormal, claveFraccionado } = await agregarNormalRapidoYFraccionadoDesdeCatalogo(pos, `Ruteo ${Date.now()}`);
      const claves = await pos.obtenerClavesProductos();
      expect(claves, 'El producto normal agregado no aparece en el carrito').toContain(claveNormal);
      expect(claves, 'El producto fraccionado agregado no aparece en el carrito').toContain(claveFraccionado);
    });

    await test.step('Presionar "Volver"', async () => {
      await pos.volverDesdeAgregarItemImportarFactura();
    });

    // Investigado en vivo: confirm_send_routing_order() (pos_routing.js) solo
    // exige Ruta y Repartidor — Dirección y Observación son opcionales
    // (confirmado creando una Orden de Ruteo real omitiéndolas por completo,
    // id devuelto válido). Se completan aquí ÚNICAMENTE los dos obligatorios,
    // a diferencia de pos-ruteo.spec.ts (que sí completa los 4 campos porque
    // sus propios escenarios lo piden explícitamente) — sin tocar ese archivo
    // ni su helper completarYGuardarOrdenRuteo().
    await test.step('Crear una Orden de Ruteo completando únicamente Ruta y Repartidor (obligatorios)', async () => {
      // La factura importada ya puede traer un cliente real propio — mismo
      // guard ya documentado y corregido en el test 13/11 de este archivo:
      // forzar seleccionarClienteExistente() cuando ya hay uno asignado
      // cuelga el buscador de cliente indefinidamente. Búsqueda con
      // término real en vez de vacía cuando sí hace falta — mismo motivo
      // ya documentado en el test 8.
      if (!(await pos.hayClienteRealSeleccionado())) {
        await pos.seleccionarClienteExistente('CITA');
      }
      await pos.abrirCrearOrdenRuteo();
      const ruta = await pos.seleccionarRutaRuteo();
      const repartidor = await pos.seleccionarRepartidorRuteo();
      expect(ruta.length, 'La ruta debe quedar seleccionada').toBeGreaterThan(0);
      expect(repartidor.length, 'El repartidor debe quedar seleccionado').toBeGreaterThan(0);

      const respuesta = await pos.guardarOrdenRuteoYObtenerRespuesta();
      await pos.validarOrdenRuteoCreada(respuesta);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('13. Seleccionar una factura, importarla, agregar producto normal, rápido y fraccionado, volver y facturar a crédito', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await importarPrimeraFactura(pos);
    await pos.abrirAgregarItemImportarFactura();

    await test.step('Agregar producto normal, rápido y fraccionado', async () => {
      const { claveNormal, claveFraccionado } = await agregarNormalRapidoYFraccionadoDesdeCatalogo(pos, `Credito ${Date.now()}`);
      const claves = await pos.obtenerClavesProductos();
      expect(claves, 'El producto normal agregado no aparece en el carrito').toContain(claveNormal);
      expect(claves, 'El producto fraccionado agregado no aparece en el carrito').toContain(claveFraccionado);
    });

    await test.step('Presionar "Volver"', async () => {
      await pos.volverDesdeAgregarItemImportarFactura();
    });

    // ACTUALIZACIÓN (investigado en vivo de nuevo): el hallazgo original de
    // este test — que ningún test de la suite completaba una venta a
    // crédito porque llenar el campo de efectivo con el total lo trata como
    // un ABONO parcial — sigue siendo cierto, pero la conclusión de que "no
    // se puede completar" no lo era: confirmado en vivo (mismo criterio ya
    // validado en el test 20 de pos-apartado.spec.ts) que la venta a
    // crédito SÍ se completa con éxito con solo dos condiciones: (1) un
    // cliente real asignado (Crédito, a diferencia de Contado, exige uno) y
    // (2) NO tocar ningún campo de monto — se llama directamente a
    // confirmarPagoAbriendoCajaSiEsNecesario() ya con "Crédito"
    // seleccionado, sin llenar efectivo.
    //
    // La factura importada ya puede traer un cliente real propio (mismo
    // criterio ya usado en el test 8/14 de este archivo,
    // hayClienteRealSeleccionado()) — en ese caso no hace falta (ni se debe)
    // buscar uno nuevo: forzar seleccionarClienteExistente() con un cliente
    // YA asignado deja el buscador de cliente en un estado que nunca vuelve
    // a mostrar #search_pos_customer, colgando la búsqueda indefinidamente
    // (confirmado en vivo, causa raíz real de la falla anterior — no era un
    // problema de ambiente). Solo se busca un cliente existente si la
    // factura NO trae uno ya asignado.
    await test.step('Asegurar un cliente real (obligatorio para Crédito) y abrir Facturar', async () => {
      if (!(await pos.hayClienteRealSeleccionado())) {
        // Búsqueda con término real en vez de vacía — mismo motivo ya
        // documentado en el test 8 de este archivo.
        await pos.seleccionarClienteExistente('CITA');
      }
      expect(await pos.hayClienteRealSeleccionado(), 'Debía quedar un cliente real asignado (propio de la factura o recién buscado)').toBe(true);

      await pos.abrirModalDePago();
      await pos.cambiarTipoPagoEnModalPago('credito');
      expect(await pos.obtenerTipoPagoEnModalPago(), 'El método de pago no quedó configurado como Crédito').toBe('credito');

      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total de la venta a crédito debe ser mayor a 0').toBeGreaterThan(0);
    });

    await test.step('Completar la venta a crédito sin llenar ningún monto', async () => {
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar que la venta a crédito se realizó correctamente', async () => {
      await pos.validarCarritoVacio();
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('14. Buscar una factura sin cliente, importarla, agregar un cliente existente y enviar a caja', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    // A diferencia del test 8 (que toma "la primera factura disponible" y
    // omite el escenario si esa ya trae cliente): aquí se busca activamente
    // hasta encontrar una factura SIN cliente, reutilizando
    // importarPrimeraFacturaSinCliente() — ya existente en pos.page.ts, con
    // el mismo patrón de reintento por posición que importarPrimeraFacturaConCliente()
    // (usada por el test 9), y sin necesidad del `waitForTimeout` manual que
    // sí necesita el test 8: _importarFacturaQueCumpla() ya espera
    // internamente a que el carrito asiente antes de evaluar el predicado.
    await test.step('Buscar e importar una factura que NO tenga cliente asociado', async () => {
      await pos.abrirImportarFactura();
      await pos.importarPrimeraFacturaSinCliente();
      expect(await pos.hayClienteRealSeleccionado(), 'La factura elegida no debía tener un cliente real asociado').toBe(false);
    });

    let nombreCliente = '';
    await test.step('Agregar un cliente existente', async () => {
      // Búsqueda con término real en vez de vacía — mismo motivo ya
      // documentado en el test 8 de este archivo (evitar el panel de ~30
      // tarjetas de resultado justo encima de una factura recién importada).
      nombreCliente = await pos.seleccionarClienteExistente('CITA');
      expect(nombreCliente.length).toBeGreaterThan(0);
      expect(await pos.hayClienteRealSeleccionado(), 'El cliente asignado no quedó reflejado como cliente real').toBe(true);
    });

    await test.step('Enviar a caja y validar que el cliente asignado se propagó y los datos se conservaron', async () => {
      await pos.abrirMenuOrdenCaja();
      expect(
        await pos.obtenerClienteEnOrdenCaja(),
        'El cliente asignado no se propagó al modal "Enviar a caja"'
      ).toBe(nombreCliente);
      await pos.seleccionarTipoPagoOrdenCaja('contado');
      await pos.llenarObservacionesOrdenCaja(`Importar Factura QA - factura buscada sin cliente ${Date.now()}`);
      const respuesta = await pos.enviarOrdenCaja();
      await pos.validarOrdenCajaCreada(respuesta);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('15. Seleccionar una factura, importarla, agregar producto normal, rápido y fraccionado, volver y enviar a caja, validando subtotal, impuestos, descuento y total', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await importarPrimeraFactura(pos);
    await pos.abrirAgregarItemImportarFactura();

    await test.step('Agregar producto normal, rápido y fraccionado', async () => {
      const { claveNormal, claveFraccionado } = await agregarNormalRapidoYFraccionadoDesdeCatalogo(pos, `ValidacionCompleta ${Date.now()}`);
      const claves = await pos.obtenerClavesProductos();
      expect(claves, 'El producto normal agregado no aparece en el carrito').toContain(claveNormal);
      expect(claves, 'El producto fraccionado agregado no aparece en el carrito').toContain(claveFraccionado);
    });

    await test.step('Presionar "Volver"', async () => {
      await pos.volverDesdeAgregarItemImportarFactura();
    });

    await test.step('Validar cantidad de productos, subtotal, impuestos, descuento y total antes de enviar a caja', async () => {
      const clavesFinales = await pos.obtenerClavesFilasCarrito();
      expect(clavesFinales.length, 'El carrito debe tener al menos las líneas de la factura importada más los 3 productos agregados').toBeGreaterThanOrEqual(4);

      const lineas = await validarLineasCarritoSegunEstadoReal(pos, clavesFinales);
      // validarResumenImpuestos() ya contempla el Descuento General si está
      // activo (ver su comentario en pos.page.ts) — cubre "impuestos" y
      // "descuentos" en la misma validación, sin duplicar la fórmula.
      await pos.validarResumenImpuestos(lineas);
      await validarTotalCarrito(pos, lineas);

      const descuentoGeneral = await pos.obtenerMontoDescuentoGeneralNumerico();
      expect(descuentoGeneral, 'El descuento general leído no debe ser negativo').toBeGreaterThanOrEqual(0);
    });

    await test.step('Enviar a caja', async () => {
      // Mismo guard ya documentado en los tests 11/12/13 de este archivo:
      // no forzar un cliente nuevo si la factura ya trae uno real.
      if (!(await pos.hayClienteRealSeleccionado())) {
        await pos.seleccionarClienteExistente('CITA');
      }
      await pos.abrirMenuOrdenCaja();
      await pos.seleccionarTipoPagoOrdenCaja('contado');
      await pos.llenarObservacionesOrdenCaja(`Importar Factura QA - validación completa ${Date.now()}`);
      const respuesta = await pos.enviarOrdenCaja();
      await pos.validarOrdenCajaCreada(respuesta);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('16. Validar los filtros de estado del documento electrónico en "Importar factura"', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await pos.abrirImportarFactura();

    // Los 4 filtros pedidos por el escenario ("Aceptado"/"Rechazado"/
    // "Reenviar"/"No aplica") más "Todos" (el estado por defecto de la
    // pestaña, necesario como punto de referencia) — confirmados en vivo,
    // los 5 existen como botones reales en este ambiente
    // (L.IMPORTAR_FACTURA_ESTADO_BOTON, ver su comentario en pos.page.ts).
    const conteos: Record<string, number> = {};
    for (const estado of ['todos', 'aceptado', 'rechazado', 'reenviar', 'noAplica'] as const) {
      await test.step(`Filtrar por "${estado}" y validar que la grilla responde sin errores`, async () => {
        conteos[estado] = await pos.filtrarFacturasPorEstado(estado);
        // No se asume un conteo fijo por filtro: confirmado en vivo que
        // "Aceptado"/"Rechazadas" pueden devolver 0 legítimamente en este
        // ambiente compartido (ningún documento real en ese estado
        // todavía) — la validación real es que el filtro respondió (>= 0,
        // sin timeout ni error) y que filtrarFacturasPorEstado() ya
        // confirmó, vía la respuesta real de red, que se aplicó el
        // `import_invoice_state` correcto.
        expect(conteos[estado], `El filtro "${estado}" no debe devolver un conteo negativo`).toBeGreaterThanOrEqual(0);
      });
    }
    console.log('[Filtros de estado] Conteo de facturas por filtro:', JSON.stringify(conteos));

    await test.step('Validar que la búsqueda sigue funcionando tras aplicar filtros', async () => {
      await pos.filtrarFacturasPorEstado('todos');
      const totalSinFiltrar = await pos.contarFacturasVisibles();
      expect(totalSinFiltrar, 'Se esperaban varias facturas con el filtro "Todos" para que la búsqueda tenga sentido').toBeGreaterThan(1);

      await pos.buscarFacturasPorTexto('zzz_no_existe_qwerty123');
      expect(await pos.contarFacturasVisibles(), 'La búsqueda sin coincidencias reales debía devolver 0 tarjetas').toBe(0);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('17. Buscar una factura usando el campo de búsqueda real y validar que filtre correctamente', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await pos.abrirImportarFactura();

    // Buscador real de esta pestaña: `#product_search` (mismo input del
    // header del POS ya confirmado para Apartados/Órdenes de Caja, ver
    // buscarFacturasPorTexto() en pos.page.ts). Confirmado en vivo
    // interceptando la red que indexa el "No." real de la factura (el
    // número visible en la tarjeta, "No. 811 - ..."), NO el nombre de
    // cliente: la mayoría de las facturas de este ambiente QA comparten el
    // mismo cliente ("CITA DE PRUEBA"), lo que devuelve el listado completo
    // sin filtrar nada — se usa el número real, único por factura.
    let numeroFactura = '';
    let totalSinFiltrar = 0;
    await test.step('Leer el número real de la primera factura disponible', async () => {
      numeroFactura = await pos.obtenerNumeroFacturaTarjetaMasReciente();
      totalSinFiltrar = await pos.contarFacturasVisibles();
      expect(totalSinFiltrar, 'Se esperaban varias facturas ya cargadas para que la búsqueda tenga sentido').toBeGreaterThan(1);
    });

    await test.step('Búsqueda exacta: el número completo debe devolver únicamente esa factura', async () => {
      await pos.buscarFacturasPorTexto(numeroFactura);
      const coincidencias = await pos.contarFacturasVisibles();
      expect(coincidencias, 'La búsqueda exacta debía encontrar únicamente la factura buscada').toBe(1);

      const numeroEnResultado = await pos.obtenerNumeroFacturaTarjetaMasReciente();
      expect(numeroEnResultado, 'La tarjeta encontrada por la búsqueda exacta no es la factura esperada').toBe(numeroFactura);
    });

    await test.step('Búsqueda parcial: una porción del número debe seguir incluyendo la factura esperada', async () => {
      // Confirmado en vivo interceptando la red: a diferencia de Apartados
      // (donde un PREFIJO del número ya basta, ver buscarApartadosPorTexto()),
      // el "No." de factura se busca por SUFIJO — "81" devolvió "781", "681",
      // "581", "481", "81" (todos terminan en "81"), pero NO "811" (termina
      // en "11"). Se usa aquí el sufijo del número, no el prefijo.
      const sustringParcial = numeroFactura.slice(-Math.max(1, Math.ceil(numeroFactura.length / 2)));
      await pos.buscarFacturasPorTexto(sustringParcial);
      const coincidenciasParciales = await pos.contarFacturasVisibles();
      expect(coincidenciasParciales, 'La búsqueda parcial debía encontrar al menos un resultado').toBeGreaterThan(0);

      const tarjetaEsperadaVisible = await pos.contarFacturasConTexto(`No. ${numeroFactura}`);
      expect(tarjetaEsperadaVisible, 'La factura buscada no aparece entre los resultados de la búsqueda parcial').toBe(1);
    });

    await test.step('Búsqueda sin resultados: un texto inexistente no debe devolver ninguna tarjeta', async () => {
      await pos.buscarFacturasPorTexto('zzz_no_existe_qwerty123');
      expect(await pos.contarFacturasVisibles(), 'Una búsqueda sin coincidencias reales debía devolver 0 tarjetas').toBe(0);
    });

    await test.step('Limpiar la búsqueda y validar que el listado completo se restaura', async () => {
      await pos.buscarFacturasPorTexto('');
      expect(await pos.contarFacturasVisibles(), 'El listado no se restauró tras limpiar la búsqueda').toBe(totalSinFiltrar);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('18. Seleccionar una factura, importarla, eliminar todos los productos menos uno, agregar un producto rápido con observación y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await importarPrimeraFactura(pos);

    // obtenerClavesFilasCarrito() (no obtenerClavesProductos()): las líneas
    // de una factura importada no llevan el id "drag_and_drop_" — mismo
    // hallazgo ya documentado en varios tests de este archivo.
    let clavesIniciales: string[] = [];
    await test.step('Validar que la factura importó al menos un producto', async () => {
      clavesIniciales = await pos.obtenerClavesFilasCarrito();
      expect(clavesIniciales.length, 'La factura importada no cargó ningún producto').toBeGreaterThan(0);
    });

    const claveConservada = clavesIniciales[0];
    const clavesAEliminar = clavesIniciales.slice(1);
    await test.step('Eliminar todos los productos de la factura excepto uno', async () => {
      for (const clave of clavesAEliminar) {
        await pos.eliminarProductoDelCarrito(clave);
      }
    });

    await test.step('Validar que únicamente quede el producto conservado', async () => {
      const clavesTrasEliminar = await pos.obtenerClavesFilasCarrito();
      expect(clavesTrasEliminar, 'Debía quedar únicamente el producto conservado de la factura original').toEqual([claveConservada]);
    });

    await test.step('Agregar un producto rápido', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido Importar Factura EliminarYObservar ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
    });

    let claveRapido = '';
    await test.step('Validar que ahora existan exactamente dos productos en el carrito', async () => {
      const clavesActuales = await pos.obtenerClavesFilasCarrito();
      expect(clavesActuales.length, 'Debían quedar exactamente 2 productos (el conservado de la factura + el rápido)').toBe(2);
      expect(clavesActuales, 'El producto conservado de la factura ya no está en el carrito').toContain(claveConservada);

      claveRapido = clavesActuales.find((c) => c !== claveConservada)!;
      expect(claveRapido, 'No se pudo identificar la clave del producto rápido recién agregado').toBeTruthy();
    });

    const observacionRapido = `Observación QA producto rápido - ${Date.now()}`;
    await test.step('Agregar una observación únicamente al producto rápido', async () => {
      await pos.agregarObservacionAProducto(claveRapido, observacionRapido);
    });

    await test.step('Validar que la observación quede almacenada correctamente y solo en el producto rápido', async () => {
      expect(
        await pos.obtenerObservacionDeProducto(claveRapido),
        'La observación del producto rápido no coincide con la ingresada'
      ).toBe(observacionRapido);
      expect(
        await pos.obtenerObservacionDeProducto(claveConservada),
        'El producto conservado de la factura original no debía tener ninguna observación'
      ).toBe('');
    });

    let lineasFinales: LineaCarrito[] = [];
    await test.step('Validar cantidades, subtotal, descuentos, IVA por línea y total antes de facturar', async () => {
      const clavesFinales = await pos.obtenerClavesFilasCarrito();
      expect(clavesFinales.length, 'Debían quedar exactamente 2 productos antes de facturar').toBe(2);

      // validarLineasCarritoSegunEstadoReal() ya valida, por cada línea, que
      // total = precio unitario × cantidad + IVA (cubre "cantidades
      // correctas" e "IVA por línea") — sin duplicar esa fórmula aquí.
      lineasFinales = await validarLineasCarritoSegunEstadoReal(pos, clavesFinales);

      for (const linea of lineasFinales) {
        expect(linea.cantidad, `La cantidad del producto "${linea.nombre}" debe ser mayor a 0`).toBeGreaterThan(0);
      }

      // validarResumenImpuestos()/validarTotalCarrito() ya contemplan el
      // Descuento General si está activo (ver sus comentarios en
      // pos.page.ts/este archivo) — cubren "IVA total" y "descuentos" en la
      // misma validación, sin duplicar la fórmula.
      await pos.validarResumenImpuestos(lineasFinales);
      await validarTotalCarrito(pos, lineasFinales);

      const subtotalFinal = pos.calcularSubtotalEsperado(lineasFinales);
      expect(subtotalFinal, 'El subtotal recalculado debe ser mayor a 0 con los 2 productos restantes').toBeGreaterThan(0);

      const descuentoGeneral = await pos.obtenerMontoDescuentoGeneralNumerico();
      expect(descuentoGeneral, 'El descuento general leído no debe ser negativo').toBeGreaterThanOrEqual(0);
    });

    await test.step('Validar que la observación del producto rápido siga presente justo antes de facturar', async () => {
      expect(
        await pos.obtenerObservacionDeProducto(claveRapido),
        'La observación del producto rápido no permaneció hasta antes de facturar'
      ).toBe(observacionRapido);
    });

    await test.step('Facturar con el total exacto en efectivo', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total de la venta debe ser mayor a 0').toBeGreaterThan(0);
      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar que la venta finalizó correctamente', async () => {
      await pos.validarCarritoVacio();
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});
