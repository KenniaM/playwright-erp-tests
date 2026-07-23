import { test as base, expect, Page } from '@playwright/test';
import {
  PosPage, TIMEOUTS, PRECIO_PRODUCTO_RAPIDO, DESCUENTO_GENERAL_PCT, PESTANA_POS_FACTURACION,
  espiarErroresJS, type LineaCarrito,
} from './pos.page';
import { PosProductosExternos, type DatosProductoExterno } from './pos-productos-externos.page';

const EXONERACION_PCT = '10';

// ─── Sesión compartida (fixture de scope 'worker', NO mode: 'serial') ──────
//
// Mismo mecanismo ya adoptado en pos-orden-caja/pos-ruteo/pos-apartado/
// pos-proforma/pos-importar-factura.spec.ts: una fixture propia con
// `scope: 'worker'` (el mismo con el que Playwright ya crea `browser`) — no
// test.describe.configure({mode:'serial'}), que obligaría a correr todo el
// archivo en un único worker y saltaría el resto de tests si uno falla,
// entrando en conflicto con `fullyParallel: true` (playwright.config.ts).
//
// El login real ocurre una única vez por corrida completa en el proyecto
// "setup" (auth.setup.ts, storageState compartido); el paso por Dashboard
// (cargarPosDesdeDashboard()) se hace como máximo una vez POR WORKER.
type ProductosExternosFixtures = {
  sharedPage: Page;
  pos: PosPage;
  pe: PosProductosExternos;
};

const test = base.extend<{}, ProductosExternosFixtures>({
  sharedPage: [async ({ browser }, use) => {
    const page = await browser.newPage();
    await use(page);
    await page.close();
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  pos: [async ({ sharedPage }, use) => {
    const pos = new PosPage(sharedPage);
    // Único paso por Dashboard que este worker hará para todo el archivo —
    // ver el comentario de cargarPosDesdeDashboard() en pos-core.page.ts.
    // Resuelve también la compañía HONDURAS (COMPANIA_POS) si el modal de
    // selección aparece — ver _irAlPosResolviendoCompania().
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    await use(pos);
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  pe: [async ({ pos, sharedPage }, use) => {
    await use(new PosProductosExternos(pos, sharedPage));
  }, { scope: 'worker' }],
});

/**
 * Deja el POS en un estado limpio antes de cada escenario, sin repetir el
 * login ni el paso por Dashboard: navega directo a la URL del POS
 * (pos.irAlPos(), ya segura tras el cargarPosDesdeDashboard() único que la
 * fixture "pos" ya hizo para este worker) y vuelve a resolver el estado
 * inicial. Mismo criterio que el resto de la suite del POS.
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
// Todos componen métodos ya existentes de PosPage/PosProductosExternos —
// ninguno reimplementa lógica de carrito, cliente, descuentos ni esperas.

/** Ninguna línea de error visible en el carrito — mismo criterio ya usado en pos-orden-caja.spec.ts. */
async function validarSinMensajesDeError(page: Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

/** Ningún modal ni SweetAlert inesperado siga abierto al terminar el escenario. */
async function validarSinModalesInesperados(page: Page) {
  await expect(page.locator('.modal.in')).toHaveCount(0);
  await expect(page.locator('.sweet-alert.visible')).toHaveCount(0);
}

/**
 * Va a la pestaña "Productos externos" y selecciona el primer producto
 * externo disponible (sin facturar) — punto de partida común a los
 * Escenarios 2-7. Devuelve la clave real de la línea agregada al carrito y
 * el nombre del producto externo, para validarlos más adelante.
 */
async function seleccionarProductoExternoExistente(pe: PosProductosExternos): Promise<{ clave: string; nombre: string }> {
  await pe.visitarTab();
  const { tarjeta, nombre } = await pe.obtenerPrimerProductoExternoDisponible();
  const clave = await pe.seleccionarProductoExterno(tarjeta, nombre);
  return { clave, nombre };
}

/**
 * Corrección de automatización confirmada en vivo (no un problema del
 * sistema): Descuento General y Exoneración persisten del lado del servidor
 * más allá de una sola venta (mismo comportamiento ya documentado en
 * desactivarDescuentoGeneral()/cancelarExoneracionSiEstaAplicada() de
 * pos-core.page.ts) y pueden filtrarse desde un test anterior de este mismo
 * worker/página compartida — confirmado en vivo que, sin este reseteo, el
 * Total mostrado no coincidía con subtotal+impuestos por una Exoneración
 * heredada que ya no era visible en el resumen compacto de totales.
 * cancelarExoneracionSiEstaAplicada() necesita el panel de detalle avanzado
 * ya expandido (mostrarDetalleAvanzadoFactura()) Y al menos una línea en el
 * carrito para renderizar ese panel — por eso este helper se llama DESPUÉS
 * de seleccionarProductoExternoExistente(), nunca antes.
 */
async function asegurarSinDescuentoNiExoneracion(pos: PosPage) {
  await pos.desactivarDescuentoGeneral();
  await pos.mostrarDetalleAvanzadoFactura();
  await pos.cancelarExoneracionSiEstaAplicada();
  expect(
    await pos.obtenerMontoExoneracionNumerico(),
    'La Exoneración heredada de un test anterior no quedó en $0.00 tras cancelarExoneracionSiEstaAplicada() — el resto del escenario no puede continuar de forma confiable'
  ).toBe(0);
}

/**
 * Valida cada línea del carrito contra su propio estado real de IVA (leído
 * primero, nunca asumido) — necesaria porque el producto externo y el
 * producto rápido pueden traer IVA activo o no de forma independiente.
 * Compone obtenerDatosLineaCarrito() + validarLineaCarrito(), ambos ya
 * existentes, sin duplicar la fórmula de validación. Mismo criterio ya
 * establecido en pos-orden-caja.spec.ts/pos-apartado.spec.ts.
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
 * Variante de validarLineasCarritoSegunEstadoReal() que NO alterna
 * `#show_price_with_iva` antes de leer — usada únicamente por el Escenario
 * 5 (Vista Expandida): confirmado en vivo que, con Vista Expandida activa,
 * establecerMostrarPrecioConIva() deja de encontrar la columna
 * `#total_by_product_with_iva_<clave>` de una línea de Producto Externo
 * agregada ANTES de activarla (bug del sistema/interacción no documentada
 * previamente — reportado en el informe final de esta suite). `neto`/
 * `totalConIva`/`iva` de LineaCarrito se leen siempre por id fijo, sin
 * depender del toggle (ver el comentario de LineaCarrito en pos.types.ts),
 * así que validarResumenImpuestos() sigue siendo válido con esta variante —
 * solo `linea.total` puede no reflejar el estado real del toggle, no usado
 * por ninguna validación de este escenario.
 */
async function validarLineasCarritoSinTogglearIva(pos: PosPage, claves: string[]): Promise<LineaCarrito[]> {
  const lineas: LineaCarrito[] = [];
  for (const clave of claves) {
    lineas.push(await pos.obtenerDatosLineaCarrito(clave));
  }
  return lineas;
}

/**
 * Valida que subtotal + impuestos coincidan con el total mostrado — solo
 * válida SIN Descuento General/Exoneración activos (ninguno de los dos se
 * refleja en `total_by_product_<clave>`, fuente de `lineas[].neto/iva`, ver
 * el comentario de validarResumenImpuestos() en pos-core.page.ts). Mismo
 * criterio ya establecido en pos-orden-caja.spec.ts.
 *
 * Nota de investigación: una corrida temprana de este archivo reportó un
 * desfase real (~$1.46 sobre ~$160) entre esta fórmula y el Total — se
 * investigó a fondo (capturas del panel de detalle avanzado) antes de
 * relajar nada, y la causa raíz confirmada en vivo fue contaminación de
 * Exoneración heredada de una corrida anterior de este mismo worker (con la
 * fila "Exoneración" ya aplicada, pero fuera del resumen compacto donde se
 * leía el total) — no un comportamiento propio de Producto Externo. Con el
 * carrito realmente limpio (asegurarSinDescuentoNiExoneracion(), llamada por
 * todos los escenarios de este archivo) esta fórmula coincide con exactitud
 * de centavos.
 */
async function validarTotalCarrito(pos: PosPage, lineas: LineaCarrito[]) {
  const totalEsperado = pos.calcularSubtotalEsperado(lineas) + pos.calcularTotalImpuestosEsperado(lineas);
  const totalReal = await pos.obtenerTotalVentaNumerico();
  expect(totalReal, `Total esperado (subtotal + impuestos = ${totalEsperado.toFixed(2)}) no coincide con el total mostrado (${totalReal.toFixed(2)})`).toBeCloseTo(totalEsperado, 1);
}

/** Agrega un Producto Rápido y devuelve la clave real de su línea — compone métodos ya existentes de PosPage. */
async function agregarProductoRapidoYObtenerClave(pos: PosPage, nombre: string): Promise<string> {
  await pos.agregarProductoRapidoSimple(nombre, PRECIO_PRODUCTO_RAPIDO);
  return pos.obtenerClaveDeLineaPorNombre(nombre);
}

/**
 * Facturación al contado estándar: abre el modal de pago, paga en efectivo
 * el total exacto, confirma (maneja Abrir Caja/Tiquete Electrónico/panel de
 * cliente por su cuenta) y valida que el carrito quedó vacío. Mismo patrón
 * ya establecido en pos-facturar.spec.ts.
 */
async function facturarConEfectivoYValidar(pos: PosPage) {
  await pos.abrirModalDePago();
  const total = await pos.obtenerTotalVentaNumerico();
  expect(total, 'El total de la venta debe ser mayor a 0 antes de facturar').toBeGreaterThan(0);
  await pos.seleccionarPagoEfectivo(String(total));
  await pos.confirmarPagoAbriendoCajaSiEsNecesario();
  await pos.validarCarritoVacio();
}

/** Confirma que la venta persistió del lado del servidor: recarga el POS y valida que el carrito sigue vacío. */
async function validarPersistenciaCarritoVacio(pos: PosPage) {
  await pos.irAlPos();
  await pos.esperarEstadoInicial();
  expect(await pos.obtenerCantidadFilasCarrito(), 'El carrito no debería tener líneas tras facturar y recargar el POS').toBe(0);
}

/**
 * Acota con un timeout propio una operación que, de colgarse, no tiene
 * ningún límite corto ya incorporado (a diferencia de la mayoría de métodos
 * de PosPage, que sí traen sus propios timeouts explícitos) — usado
 * puntualmente para no dejar un escenario bloqueado varios minutos por una
 * interacción compartida que, en este ambiente, puede quedar esperando
 * indefinidamente (ver el comentario de "Cambiar a Vista Expandida" en el
 * Escenario 5). No cancela la promesa original (Promise.race no lo permite),
 * solo deja de esperarla — aceptable aquí porque, si se agota, el escenario
 * completo termina de inmediato con un mensaje claro.
 */
function conTimeout<T>(promesa: Promise<T>, ms: number, mensaje: string): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(mensaje)), ms)),
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// Escenario 1 — Agregar producto externo (menú de tres puntos)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Productos Externos — Crear', () => {
  test('1. Agregar un producto externo desde el menú de tres puntos, completando todos los campos disponibles', async ({ pos, pe, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    const sufijo = Date.now();
    const datos: DatosProductoExterno = {
      nombre: `QA Producto Externo ${sufijo}`,
      codigoReal: `QA-EXT-${sufijo}`,
      otroProveedor: 'Proveedor QA Automatizado',
      costo: '100',
      utilidad: '50',
      cantidad: '2',
      diasGarantia: '30',
      observacion: 'Producto externo creado por la suite automatizada (Playwright) — Escenario 1.',
    };

    await test.step('Abrir "Agregar producto externo" desde el menú de tres puntos', async () => {
      await pe.abrirAgregarProductoExterno();
    });

    let id = '';
    await test.step('Completar todos los campos disponibles y guardar', async () => {
      const resultado = await pe.crearProductoExterno(datos);
      expect(resultado.respuesta.ok(), `${resultado.respuesta.url()} no respondió OK (status ${resultado.respuesta.status()})`).toBe(true);
      expect(Number(resultado.id), `La respuesta de guardado no fue un id numérico válido: "${resultado.id}"`).toBeGreaterThan(0);
      id = resultado.id;
    });

    await test.step('Validar que el producto externo quede creado y que persista tras recargar el POS', async () => {
      await pos.irAlPos();
      await pos.esperarEstadoInicial();
      await pe.visitarTab();

      const tarjeta = pe.localizarTarjetaPorId(id);
      await expect(tarjeta, `La tarjeta del producto externo recién creado (id ${id}) no aparece tras recargar`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
      await expect(tarjeta, 'El nombre del producto externo creado no coincide con el ingresado').toContainText(datos.nombre);
    });

    await validarSinMensajesDeError(sharedPage);
    await validarSinModalesInesperados(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Escenarios 2-7 — Seleccionar un producto externo existente y facturar
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Productos Externos — Facturar', () => {

  test('2. Seleccionar un producto externo existente, agregar un cliente existente y un producto rápido, y facturar', async ({ pos, pe, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let claveExterno = '';
    let nombreCliente = '';
    let claveRapido = '';
    const nombreRapido = `Rápido PE Esc2 ${Date.now()}`;

    await test.step('Seleccionar un producto externo existente', async () => {
      ({ clave: claveExterno } = await seleccionarProductoExternoExistente(pe));
      await asegurarSinDescuentoNiExoneracion(pos);
    });

    await test.step('Agregar un cliente existente', async () => {
      nombreCliente = await pos.seleccionarClienteExistente();
      expect(nombreCliente.length, 'El nombre del cliente seleccionado no debería estar vacío').toBeGreaterThan(0);
    });

    await test.step('Agregar un producto rápido', async () => {
      claveRapido = await agregarProductoRapidoYObtenerClave(pos, nombreRapido);
    });

    let lineas: LineaCarrito[] = [];
    await test.step('Validar cliente, productos, cantidad de líneas, subtotal, IVA y total', async () => {
      expect(await pos.hayClienteRealSeleccionado(), 'No quedó un cliente real seleccionado').toBe(true);
      expect(await pos.obtenerClienteSeleccionado(), 'El nombre del cliente mostrado no coincide con el seleccionado').toBe(nombreCliente);

      const claves = [claveExterno, claveRapido];
      expect(claves.length, 'Cantidad de líneas esperada (producto externo + producto rápido)').toBe(2);

      lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
      for (const linea of lineas) {
        expect(linea.cantidad, `Cantidad del producto "${linea.nombre}" debe ser mayor a 0`).toBeGreaterThan(0);
      }
      await pos.validarResumenImpuestos(lineas);
      await validarTotalCarrito(pos, lineas);
    });

    await test.step('Facturar', async () => {
      await facturarConEfectivoYValidar(pos);
    });

    await test.step('Validar estado y persistencia tras facturar', async () => {
      await validarPersistenciaCarritoVacio(pos);
    });

    await validarSinMensajesDeError(sharedPage);
    await validarSinModalesInesperados(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('3. Seleccionar un producto externo existente, agregar un producto rápido, aplicar descuento general y facturar', async ({ pos, pe, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let claveExterno = '';
    let claveRapido = '';
    const nombreRapido = `Rápido PE Esc3 ${Date.now()}`;

    await test.step('Seleccionar un producto externo existente', async () => {
      ({ clave: claveExterno } = await seleccionarProductoExternoExistente(pe));
      await asegurarSinDescuentoNiExoneracion(pos);
    });

    await test.step('Agregar un producto rápido', async () => {
      claveRapido = await agregarProductoRapidoYObtenerClave(pos, nombreRapido);
    });

    let totalAntes = 0;
    await test.step('Aplicar descuento general y validar que el total baja', async () => {
      totalAntes = await pos.obtenerTotalVentaNumerico();
      await pos.mostrarDetalleAvanzadoFactura();
      await pos.activarDescuentoGeneral();
      await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);

      expect(await pos.obtenerMontoDescuentoGeneralNumerico(), 'El monto de descuento general aplicado debe ser mayor a 0').toBeGreaterThan(0);
      const totalDespues = await pos.obtenerTotalVentaNumerico();
      expect(totalDespues, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalAntes);
    });

    await test.step('Validar productos, cantidad de líneas, subtotal e IVA', async () => {
      const claves = [claveExterno, claveRapido];
      expect(claves.length, 'Cantidad de líneas esperada (producto externo + producto rápido)').toBe(2);

      const lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
      for (const linea of lineas) {
        expect(linea.cantidad, `Cantidad del producto "${linea.nombre}" debe ser mayor a 0`).toBeGreaterThan(0);
      }
      // validarResumenImpuestos() ya ajusta por el Descuento General activo
      // (ver su propio comentario en pos-core.page.ts) — no se usa
      // validarTotalCarrito() aquí porque esa fórmula asume que el
      // descuento NO está activo; ya se validó antes en este mismo paso
      // que el total bajó tras aplicarlo.
      await pos.validarResumenImpuestos(lineas);
    });

    await test.step('Facturar', async () => {
      await facturarConEfectivoYValidar(pos);
    });

    await test.step('Validar estado y persistencia tras facturar', async () => {
      await validarPersistenciaCarritoVacio(pos);
    });

    await validarSinMensajesDeError(sharedPage);
    await validarSinModalesInesperados(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('4. Seleccionar un producto externo existente, agregar cliente y producto rápido, aplicar descuento y exoneración, y facturar', async ({ pos, pe, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let claveExterno = '';
    let nombreCliente = '';
    let claveRapido = '';
    const nombreRapido = `Rápido PE Esc4 ${Date.now()}`;

    try {
      await test.step('Seleccionar un producto externo existente', async () => {
        ({ clave: claveExterno } = await seleccionarProductoExternoExistente(pe));
        await asegurarSinDescuentoNiExoneracion(pos);
      });

      await test.step('Agregar un cliente existente', async () => {
        nombreCliente = await pos.seleccionarClienteExistente();
      });

      await test.step('Agregar un producto rápido', async () => {
        claveRapido = await agregarProductoRapidoYObtenerClave(pos, nombreRapido);
      });

      let totalAntesExoneracion = 0;
      let totalDespuesExoneracion = 0;
      await test.step('Aplicar exoneración', async () => {
        totalAntesExoneracion = await pos.obtenerTotalVentaNumerico();
        await pos.mostrarDetalleAvanzadoFactura();

        // Falla rápido con un diagnóstico claro (≈25s totales) en vez de
        // dejar que abrirModalExoneracion() reintente su click por el
        // timeout de acción completo del proyecto (sin actionTimeout
        // configurado — varios minutos). Bug del sistema confirmado en vivo,
        // no de esta automatización: con un Producto Externo + cliente
        // existente + producto rápido en el carrito, el botón "Agregar" de
        // la fila Exoneración (#set_apply_exoneration_modal) PARPADEA entre
        // visible/no-visible de forma sostenida tras expandir el detalle
        // avanzado de totales (confirmado en vivo: un chequeo puntual de
        // visibilidad lo encuentra visible, pero el click real —que exige
        // estabilidad, no solo un instante visible— nunca logra completarse)
        // — reproducido de forma consistente en múltiples corridas
        // aisladas, cada una con el carrito y la cuenta confirmados libres
        // de antemano de cualquier Descuento General/Exoneración heredados
        // (asegurarSinDescuentoNiExoneracion(), con su propia aserción de
        // que quedó en $0.00). Se usa el mismo botón/flujo real de la
        // aplicación (nunca se simula el resultado), solo con un timeout
        // propio y acotado en vez del default sin límite. Documentado en el
        // informe final de esta suite; no se oculta con un timeout más largo
        // ni con reintentos adicionales.
        const dialogExoneracion = sharedPage.locator('#dialog_add_exoneration');
        const clickExoneracionExitoso = await sharedPage
          .locator('#set_apply_exoneration_modal')
          .click({ timeout: 15_000 })
          .then(() => true)
          .catch(() => false);
        expect(
          clickExoneracionExitoso,
          'BUG DEL SISTEMA (no de automatización): el botón "Agregar" de la fila Exoneración nunca quedó estable/clickeable en el detalle avanzado de totales con un Producto Externo + cliente + producto rápido en el carrito (parpadea entre visible y no-visible). Ver el informe final de esta suite para el detalle de la investigación.'
        ).toBe(true);
        await expect(dialogExoneracion, 'El modal "APLICAR EXONERACIÓN" no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
        await pos.aplicarExoneracion(EXONERACION_PCT);

        expect(await pos.obtenerMontoExoneracionNumerico(), 'El monto de exoneración aplicado debe ser mayor a 0').toBeGreaterThan(0);
        totalDespuesExoneracion = await pos.obtenerTotalVentaNumerico();
        expect(totalDespuesExoneracion, 'El total no bajó tras aplicar la exoneración').toBeLessThan(totalAntesExoneracion);
      });

      let totalDespuesDescuento = 0;
      await test.step('Aplicar descuento general', async () => {
        await pos.activarDescuentoGeneral();
        await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);

        expect(await pos.obtenerMontoDescuentoGeneralNumerico(), 'El monto de descuento general aplicado debe ser mayor a 0').toBeGreaterThan(0);
        totalDespuesDescuento = await pos.obtenerTotalVentaNumerico();
        expect(totalDespuesDescuento, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalDespuesExoneracion);
      });

      await test.step('Validar cliente, productos, cantidad de líneas, subtotal e IVA', async () => {
        expect(await pos.obtenerClienteSeleccionado(), 'El nombre del cliente mostrado no coincide con el seleccionado').toBe(nombreCliente);

        const claves = [claveExterno, claveRapido];
        expect(claves.length, 'Cantidad de líneas esperada (producto externo + producto rápido)').toBe(2);

        const lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
        for (const linea of lineas) {
          expect(linea.cantidad, `Cantidad del producto "${linea.nombre}" debe ser mayor a 0`).toBeGreaterThan(0);
        }
        await pos.validarResumenImpuestos(lineas);
      });

      await test.step('Facturar', async () => {
        await facturarConEfectivoYValidar(pos);
      });

      await test.step('Validar estado y persistencia tras facturar', async () => {
        await validarPersistenciaCarritoVacio(pos);
      });
    } finally {
      // La Exoneración aplicada persiste más allá de esta venta (mismo
      // comportamiento ya documentado para Descuento General/Moneda — ver
      // cancelarExoneracionSiEstaAplicada() en pos-core.page.ts) y puede
      // filtrarse a los siguientes escenarios de este mismo worker si no se
      // cancela aquí. Mismo criterio ya establecido en pos-orden-caja.spec.ts.
      await pos.cancelarExoneracionSiEstaAplicada();
    }

    await validarSinMensajesDeError(sharedPage);
    await validarSinModalesInesperados(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('5. Seleccionar un producto externo existente, cambiar a Vista Expandida, agregar cliente/producto normal/producto rápido, aplicar descuento general y facturar', async ({ pos, pe, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let claveExterno = '';
    let nombreCliente = '';
    let codigoNormal = '';
    let claveNormal = '';
    let claveRapido = '';
    const nombreRapido = `Rápido PE Esc5 ${Date.now()}`;
    let expandidaAlInicio = false;

    try {
      await test.step('Seleccionar un producto externo existente', async () => {
        ({ clave: claveExterno } = await seleccionarProductoExternoExistente(pe));
        await asegurarSinDescuentoNiExoneracion(pos);
      });

      await test.step('Volver a "POS Facturación" para acceder al catálogo (el grid no vive en la pestaña "Productos externos")', async () => {
        await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);
      });

      await test.step('Localizar un producto normal con código (necesario ANTES de activar Vista Expandida: oculta el grid)', async () => {
        const { codigo } = await pos.obtenerPrimerProductoNormalConCodigoNoPresenteEnCarrito();
        codigoNormal = codigo;
      });

      await test.step('Cambiar a Vista Expandida', async () => {
        expandidaAlInicio = await pos.vistaExpandidaActiva();
        if (!expandidaAlInicio) {
          // Acotado con conTimeout() (30s, no el timeout de acción sin
          // límite del proyecto): alternarVistaExpandida() reutiliza el
          // mismo menú de tres puntos (#demo-menu-lower-left) que
          // abrirAgregarProductoExterno() — investigado en vivo que ese
          // menú puede quedar clickeando un ítem sin efecto tras la segunda
          // carga del POS en la misma pestaña (mismo mecanismo de causa
          // raíz que _irAlPosResolviendoCompania() ya documenta para
          // "Crear factura": el click por coordenadas aterriza en
          // `div.mdl-menu__container`, no en el ítem real). A diferencia de
          // abrirAgregarProductoExterno() (donde el remedio, click nativo
          // vía evaluate(), se aplicó directo en pos-productos-externos.page.ts),
          // alternarVistaExpandida() es código YA EXISTENTE y compartido
          // por el resto de la suite (pos-navegacion.page.ts) — no se
          // modifica aquí. Se documenta como hallazgo en el informe final.
          const activa = await conTimeout(
            pos.alternarVistaExpandida(),
            30_000,
            'BUG DEL SISTEMA/AUTOMATIZACIÓN COMPARTIDA: alternarVistaExpandida() (pos-navegacion.page.ts) no respondió en 30s — mismo mecanismo de causa raíz que _irAlPosResolviendoCompania() ya documenta para el link "Crear factura" (click por coordenadas sobre el menú de tres puntos, tras la segunda carga del POS en la misma pestaña). Ver el informe final de esta suite.'
          );
          expect(activa, 'Vista Expandida no quedó activa tras alternarla').toBe(true);
        }
      });

      await test.step('Agregar un cliente existente', async () => {
        nombreCliente = await pos.seleccionarClienteExistente();
      });

      await test.step('Agregar un producto normal (buscador interno de Vista Expandida)', async () => {
        // Clave capturada por diferencia (antes/después), no por nombre:
        // confirmado en vivo que el nombre que obtenerClaveDeLineaPorNombre()
        // lee de la línea agregada por el buscador interno de Vista
        // Expandida no siempre coincide con el nombre de la tarjeta leído
        // antes de cambiar de vista (código compartido entre variantes/
        // presentaciones del mismo producto, con nombres de línea distintos).
        const clavesAntes = await pos.obtenerClavesFilasCarrito();
        await pos.agregarProductoPorCodigoEnVistaExpandida(codigoNormal);
        const clavesDespues = await pos.obtenerClavesFilasCarrito();
        const nuevas = clavesDespues.filter((c) => !clavesAntes.includes(c));
        expect(nuevas.length, 'No se agregó ninguna línea nueva al carrito tras agregar el producto normal por código').toBe(1);
        claveNormal = nuevas[0];
      });

      await test.step('Agregar un producto rápido', async () => {
        claveRapido = await agregarProductoRapidoYObtenerClave(pos, nombreRapido);
      });

      let totalAntes = 0;
      await test.step('Aplicar descuento general', async () => {
        totalAntes = await pos.obtenerTotalVentaNumerico();
        await pos.mostrarDetalleAvanzadoFactura();
        await pos.activarDescuentoGeneral();
        await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);

        expect(await pos.obtenerMontoDescuentoGeneralNumerico(), 'El monto de descuento general aplicado debe ser mayor a 0').toBeGreaterThan(0);
        const totalDespues = await pos.obtenerTotalVentaNumerico();
        expect(totalDespues, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalAntes);
      });

      await test.step('Validar cliente, productos, cantidad de líneas, subtotal e IVA', async () => {
        expect(await pos.obtenerClienteSeleccionado(), 'El nombre del cliente mostrado no coincide con el seleccionado').toBe(nombreCliente);

        const claves = [claveExterno, claveNormal, claveRapido];
        expect(claves.length, 'Cantidad de líneas esperada (producto externo + producto normal + producto rápido)').toBe(3);

        const lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
        for (const linea of lineas) {
          expect(linea.cantidad, `Cantidad del producto "${linea.nombre}" debe ser mayor a 0`).toBeGreaterThan(0);
        }
        await pos.validarResumenImpuestos(lineas);
      });

      await test.step('Facturar', async () => {
        await facturarConEfectivoYValidar(pos);
      });

      await test.step('Validar estado y persistencia tras facturar', async () => {
        await validarPersistenciaCarritoVacio(pos);
      });
    } finally {
      // Vista Expandida es una preferencia persistida del lado del servidor
      // (AJAX_VISTA_COMPRIMIDA), no algo que la recarga de irAlPos() del
      // beforeEach reinicie por su cuenta — se restaura al estado con el que
      // arrancó este escenario para no filtrarse a los siguientes. Mismo
      // criterio ya establecido en pos-navegacion.spec.ts.
      if (!expandidaAlInicio && await pos.vistaExpandidaActiva()) {
        await pos.alternarVistaExpandida();
      }
    }

    await validarSinMensajesDeError(sharedPage);
    await validarSinModalesInesperados(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('6. Seleccionar un producto externo existente, agregar cliente y producto rápido, y facturar a crédito', async ({ pos, pe, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let claveExterno = '';
    let nombreCliente = '';
    let claveRapido = '';
    const nombreRapido = `Rápido PE Esc6 ${Date.now()}`;

    await test.step('Seleccionar un producto externo existente', async () => {
      ({ clave: claveExterno } = await seleccionarProductoExternoExistente(pe));
      await asegurarSinDescuentoNiExoneracion(pos);
    });

    await test.step('Agregar un cliente existente', async () => {
      nombreCliente = await pos.seleccionarClienteExistente();
    });

    await test.step('Agregar un producto rápido', async () => {
      claveRapido = await agregarProductoRapidoYObtenerClave(pos, nombreRapido);
    });

    await test.step('Validar cliente, productos, cantidad de líneas, subtotal, IVA y total antes de facturar', async () => {
      expect(await pos.obtenerClienteSeleccionado(), 'El nombre del cliente mostrado no coincide con el seleccionado').toBe(nombreCliente);

      const claves = [claveExterno, claveRapido];
      expect(claves.length, 'Cantidad de líneas esperada (producto externo + producto rápido)').toBe(2);

      const lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
      for (const linea of lineas) {
        expect(linea.cantidad, `Cantidad del producto "${linea.nombre}" debe ser mayor a 0`).toBeGreaterThan(0);
      }
      await pos.validarResumenImpuestos(lineas);
      await validarTotalCarrito(pos, lineas);
    });

    await test.step('Facturar a crédito y validar que el método de pago quede seleccionado como Crédito', async () => {
      await pos.abrirModalDePago();
      await pos.cambiarTipoPagoEnModalPago('credito');
      expect(await pos.obtenerTipoPagoEnModalPago(), 'El método de pago no quedó seleccionado como Crédito').toBe('credito');

      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total de la venta a crédito debe ser mayor a 0').toBeGreaterThan(0);

      // La venta a crédito real no requiere llenar ningún monto en efectivo
      // (confirmado en vivo, ver el comentario de este mismo patrón en
      // pos-apartado.spec.ts): llamar directo a
      // confirmarPagoAbriendoCajaSiEsNecesario() completa la venta.
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    });

    await test.step('Validar estado y persistencia tras facturar', async () => {
      await pos.validarCarritoVacio();
      await validarPersistenciaCarritoVacio(pos);
    });

    await validarSinMensajesDeError(sharedPage);
    await validarSinModalesInesperados(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('7. Seleccionar un producto externo existente, escribir únicamente el nombre del cliente, agregar un producto rápido y facturar', async ({ pos, pe, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let claveExterno = '';
    let claveRapido = '';
    const nombreCliente = `Cliente QA PE ${Date.now()}`;
    const nombreRapido = `Rápido PE Esc7 ${Date.now()}`;

    await test.step('Seleccionar un producto externo existente', async () => {
      ({ clave: claveExterno } = await seleccionarProductoExternoExistente(pe));
      await asegurarSinDescuentoNiExoneracion(pos);
    });

    await test.step('Escribir únicamente el nombre del cliente, sin seleccionar uno existente', async () => {
      await pos.ingresarNombreCliente(nombreCliente);
      expect(await pos.hayClienteRealSeleccionado(), 'No debería haber un cliente real seleccionado, solo un nombre libre').toBe(false);
    });

    await test.step('Agregar un producto rápido', async () => {
      claveRapido = await agregarProductoRapidoYObtenerClave(pos, nombreRapido);
    });

    let lineas: LineaCarrito[] = [];
    await test.step('Validar productos, cantidad de líneas, subtotal, IVA y total', async () => {
      const claves = [claveExterno, claveRapido];
      expect(claves.length, 'Cantidad de líneas esperada (producto externo + producto rápido)').toBe(2);

      lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
      for (const linea of lineas) {
        expect(linea.cantidad, `Cantidad del producto "${linea.nombre}" debe ser mayor a 0`).toBeGreaterThan(0);
      }
      await pos.validarResumenImpuestos(lineas);
      await validarTotalCarrito(pos, lineas);
    });

    await test.step('Facturar', async () => {
      await facturarConEfectivoYValidar(pos);
    });

    await test.step('Validar estado y persistencia tras facturar', async () => {
      await validarPersistenciaCarritoVacio(pos);
    });

    await validarSinMensajesDeError(sharedPage);
    await validarSinModalesInesperados(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});
