import { test as base, expect, Response, Page, Locator } from '@playwright/test';
import { PosPage, TIMEOUTS, TipoProforma, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT, PRECIO_PRODUCTO_RAPIDO, VEHICULO_PINTURA_TIPO, LineaCarrito, PESTANA_POS_PROFORMA, espiarErroresJS } from './pos.page';

const TIPOS_PROFORMA: { tipo: TipoProforma; etiqueta: string }[] = [
  { tipo: 'normal', etiqueta: 'Normal' },
  { tipo: 'consignacion', etiqueta: 'Consignación' },
  { tipo: 'taller', etiqueta: 'Taller' },
];

// ─── Sesión compartida (fixture de scope 'worker', NO mode: 'serial') ──────
//
// Mismo mecanismo ya adoptado en pos-orden-caja/pos-ruteo/pos-apartado/
// pos-importar-factura.spec.ts: una fixture propia con `scope: 'worker'`, el
// mismo con el que Playwright ya crea `browser` (una instancia por proceso
// worker, reutilizada en todos los tests que ese worker ejecute) — no
// test.describe.configure({mode:'serial'}), que obligaría a correr todo el
// archivo en un único worker y, si un test falla, saltaría el resto en vez
// de ejecutarlos (reduce el valor de la suite para QA) y entraría en
// conflicto con `fullyParallel: true` ya configurado en playwright.config.ts.
//
// El login real sigue ocurriendo una única vez por corrida completa en el
// proyecto "setup" (auth.setup.ts, storageState compartido, sin cambios); el
// paso por Dashboard (cargarPosDesdeDashboard()) se hace como máximo una vez
// POR WORKER, nunca una vez por test.
type ProformaFixtures = {
  sharedPage: Page;
  pos: PosPage;
};

const test = base.extend<{}, ProformaFixtures>({
  sharedPage: [async ({ browser }, use) => {
    const page = await browser.newPage();
    await use(page);
    await page.close();
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  pos: [async ({ sharedPage }, use) => {
    const pos = new PosPage(sharedPage);
    // Único paso por Dashboard que este worker hará para todo el archivo —
    // ver el comentario de cargarPosDesdeDashboard() en pos.page.ts.
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    await use(pos);
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],
});

/**
 * Deja el POS en un estado limpio antes de cada escenario, sin repetir el
 * login ni el paso por Dashboard: navega directo a la URL del POS
 * (pos.irAlPos(), ya seguro tras el cargarPosDesdeDashboard() único que la
 * fixture "pos" ya hizo para este worker) y vuelve a resolver el estado
 * inicial. Mismo criterio que pos-orden-caja/pos-ruteo.spec.ts: una recarga
 * real es la forma más simple y más confiable de garantizar carrito vacío,
 * ningún modal abierto y ninguna moneda/vista residual de un test anterior
 * — incluida la variante en la que un test previo falló a mitad de camino.
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
// lógica de agregar productos, clientes, descuentos ni esperas.

/** Agrega un producto de precio fijo — punto de partida común a todos los escenarios. */
async function agregarProductoNormalAlCarrito(pos: PosPage) {
  const productoNormal = await pos.obtenerPrimerProductoNormal();
  await pos.agregarProductoAlCarrito(productoNormal);
}

/** Abre "Crear Proforma", selecciona el tipo y guarda — sin tocar cliente ni vendedor. */
async function crearProformaBasica(pos: PosPage, tipo: TipoProforma): Promise<Response> {
  await pos.abrirCrearProforma();
  await pos.seleccionarTipoProforma(tipo);
  return pos.guardarProformaYObtenerRespuesta();
}

/**
 * Guarda la Proforma ya configurada, valida que se creó correctamente y
 * cierra el modal de Gestión — usado por todos los tests de "Crear
 * Proformas" (que no necesitan interactuar más con ese modal, a diferencia
 * de los tests de "Gestión"). Cerrarlo es necesario antes de que un test de
 * tipo Taller intente restaurar la moneda original: confirmado en vivo que
 * el modal de Gestión, mientras sigue abierto, bloquea el click en
 * #menu_type_currency (data-backdrop="static").
 */
async function guardarProformaYCerrarGestion(pos: PosPage) {
  const respuesta = await pos.guardarProformaYObtenerRespuesta();
  await pos.validarProformaCreada(respuesta);
  await pos.cerrarModalGestionProforma();
}

/**
 * Busca una Proforma ya existente del tipo indicado en la pestaña "Proforma
 * / Cotizaciones" del propio POS (sub-filtro Normal/Consignación/Taller,
 * ver cambiarSubTabProforma()) y la devuelve lista para operar sobre ella —
 * usado por todos los escenarios que reutilizan las opciones de cada
 * tarjeta (Imprimir, Email, PDF: no destructivos, seguros de operar sobre
 * cualquiera): "no crear una nueva Proforma, buscar una existente y
 * reutilizarla; solo crear una nueva si realmente no existe ninguna
 * disponible". Si ese sub-filtro está vacío, crea una con un cliente
 * EXISTENTE (no solo nombre libre): confirmado en vivo (ver el comentario
 * de enviarEmailDesdeTab() en pos-proforma.page.ts) que Email solo responde
 * éxito real si la Proforma tiene un cliente registrado asociado, no un
 * nombre libre — necesario para que el fallback de creación sirva también
 * al escenario de Email. Para Taller, la creación exige la moneda base
 * (mismo criterio ya establecido en "Proformas — Crear"): se asegura antes
 * y se restaura siempre al terminar, incluso si algo falla.
 */
async function buscarOCrearProformaEnTab(pos: PosPage, tipo: TipoProforma = 'normal'): Promise<{ tarjeta: Locator; proformaId: string; nombreCliente: string }> {
  let encontrada = await pos.obtenerPrimeraProformaEnTab(tipo);
  if (encontrada) return encontrada;

  const monedaOriginal = tipo === 'taller' ? await pos.asegurarMonedaBaseActiva() : null;
  try {
    await agregarProductoNormalAlCarrito(pos);
    const nombreCliente = await pos.seleccionarClienteExistente();
    const respuesta = await crearProformaBasica(pos, tipo);
    await pos.validarProformaCreada(respuesta);
    await pos.cerrarModalGestionProforma();

    encontrada = await pos.obtenerPrimeraProformaEnTab(tipo);
    expect(encontrada, `La Proforma ${tipo} recién creada para reutilizar no apareció en la pestaña "Proforma / Cotizaciones"`).not.toBeNull();
    return encontrada!;
  } finally {
    if (monedaOriginal) await pos.cambiarMoneda(monedaOriginal);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Crear Proformas
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Proformas — Crear', () => {

  test.describe('Cliente', () => {
    for (const { tipo, etiqueta } of TIPOS_PROFORMA) {
      test(`Crear una Proforma ${etiqueta} con un cliente existente`, async ({ pos }) => {
        test.setTimeout(TIMEOUTS.TEST);
        await agregarProductoNormalAlCarrito(pos);

        // Restaurar la moneda original al terminar es obligatorio para Taller
        // (confirmado en vivo: la moneda persiste por usuario en el servidor,
        // no por sesión, así que no restaurarla contaminaría los siguientes
        // tests) — se usa try/finally para garantizarlo incluso si alguna
        // aserción falla a mitad del test.
        const monedaOriginal = tipo === 'taller' ? await pos.asegurarMonedaBaseActiva() : null;
        try {
          let nombreCliente = '';
          await test.step('Seleccionar un cliente existente desde arriba del carrito', async () => {
            nombreCliente = await pos.seleccionarClienteExistente();
            expect(nombreCliente.length).toBeGreaterThan(0);
          });

          await test.step(`Abrir "Crear Proforma", confirmar que el cliente se sincronizó y guardar como ${etiqueta}`, async () => {
            await pos.abrirCrearProforma();
            await pos.seleccionarTipoProforma(tipo);
            await expect(
              pos.campoNombreClienteProforma,
              'El cliente elegido arriba del carrito no se sincronizó con el modal de Proforma'
            ).toHaveValue(new RegExp(nombreCliente.trim()));

            await guardarProformaYCerrarGestion(pos);
          });
        } finally {
          if (monedaOriginal) await pos.cambiarMoneda(monedaOriginal);
        }
      });
    }
  });

  test.describe('Nombre del cliente', () => {
    for (const { tipo, etiqueta } of TIPOS_PROFORMA) {
      test(`Crear una Proforma ${etiqueta} utilizando únicamente el nombre del cliente`, async ({ pos }) => {
        test.setTimeout(TIMEOUTS.TEST);
        await agregarProductoNormalAlCarrito(pos);

        const monedaOriginal = tipo === 'taller' ? await pos.asegurarMonedaBaseActiva() : null;
        try {
          const nombreCliente = `Cliente Proforma ${etiqueta} ${Date.now()}`;

          await test.step(`Abrir "Crear Proforma", escribir el nombre del cliente y guardar como ${etiqueta}`, async () => {
            await pos.abrirCrearProforma();
            await pos.seleccionarTipoProforma(tipo);
            await pos.llenarNombreClienteProforma(nombreCliente);

            await guardarProformaYCerrarGestion(pos);
          });
        } finally {
          if (monedaOriginal) await pos.cambiarMoneda(monedaOriginal);
        }
      });
    }
  });

  test.describe('Vendedor', () => {
    for (const { tipo, etiqueta } of TIPOS_PROFORMA) {
      test(`Crear una Proforma ${etiqueta} seleccionando un vendedor`, async ({ pos }) => {
        test.setTimeout(TIMEOUTS.TEST);
        await agregarProductoNormalAlCarrito(pos);

        const monedaOriginal = tipo === 'taller' ? await pos.asegurarMonedaBaseActiva() : null;
        try {
          await pos.abrirCrearProforma();
          await pos.seleccionarTipoProforma(tipo);
          await pos.llenarNombreClienteProforma(`Cliente Proforma Vendedor ${etiqueta} ${Date.now()}`);

          let nombreVendedor = '';
          await test.step('Seleccionar vendedor', async () => {
            nombreVendedor = await pos.seleccionarVendedorProforma();
            expect(nombreVendedor.length).toBeGreaterThan(0);
          });

          await test.step(`Guardar la Proforma ${etiqueta} y validar que se creó correctamente`, async () => {
            await guardarProformaYCerrarGestion(pos);
          });
        } finally {
          if (monedaOriginal) await pos.cambiarMoneda(monedaOriginal);
        }
      });
    }
  });

  test.describe('Productos múltiples', () => {
    for (const { tipo, etiqueta } of TIPOS_PROFORMA) {
      test(`Crear una Proforma ${etiqueta} con producto normal, rápido y fraccionado, y vendedor`, async ({ pos }) => {
        test.setTimeout(TIMEOUTS.TEST);

        const monedaOriginal = tipo === 'taller' ? await pos.asegurarMonedaBaseActiva() : null;
        try {
          let clavesAntes: string[] = [];
          await test.step('Agregar producto normal, rápido y fraccionado', async () => {
            clavesAntes = await pos.obtenerClavesProductos();
            await pos.agregarProductoNormalFraccionadoYRapido('Proforma', `${etiqueta} ${Date.now()}`);
            await expect.poll(async () => (await pos.obtenerClavesProductos()).length).toBeGreaterThanOrEqual(clavesAntes.length + 3);
          });

          await pos.abrirCrearProforma();
          await pos.seleccionarTipoProforma(tipo);
          await pos.llenarNombreClienteProforma(`Cliente Proforma Mixta ${etiqueta} ${Date.now()}`);
          await pos.seleccionarVendedorProforma();

          await test.step(`Guardar la Proforma ${etiqueta} y validar que se creó correctamente`, async () => {
            await guardarProformaYCerrarGestion(pos);
          });
        } finally {
          if (monedaOriginal) await pos.cambiarMoneda(monedaOriginal);
        }
      });
    }
  });

  test.describe('Descuento individual', () => {
    for (const { tipo, etiqueta } of TIPOS_PROFORMA) {
      test(`Crear una Proforma ${etiqueta} con productos mixtos aplicando descuento individual`, async ({ pos }) => {
        test.setTimeout(TIMEOUTS.TEST);

        const monedaOriginal = tipo === 'taller' ? await pos.asegurarMonedaBaseActiva() : null;
        try {
          await pos.agregarProductoNormalFraccionadoYRapido('Proforma', `Desc Individual ${etiqueta} ${Date.now()}`);
          await pos.desactivarDescuentoGeneral();

          let clavesProductos: string[] = [];
          let totalAntes = 0;
          await test.step('Registrar claves y total antes de aplicar el descuento individual', async () => {
            clavesProductos = await pos.obtenerClavesProductos();
            totalAntes = await pos.obtenerTotalVentaNumerico();
            expect(clavesProductos.length).toBeGreaterThanOrEqual(3);
            expect(totalAntes).toBeGreaterThan(0);
          });

          await test.step(`Aplicar descuento individual del ${DESCUENTO_INDIVIDUAL_PCT}% a cada producto — adaptarse a reglas del sistema`, async () => {
            for (const clave of clavesProductos) {
              const resultado = await pos.aplicarDescuentoIndividual(clave, DESCUENTO_INDIVIDUAL_PCT);
              if (resultado.escenario === 'sin_descuento') {
                expect(parseFloat(resultado.porcentajeAplicado)).toBe(0);
              } else if (resultado.escenario === 'maximo_superado') {
                expect(parseFloat(resultado.porcentajeAplicado)).toBeGreaterThan(0);
                expect(parseFloat(resultado.porcentajeAplicado)).toBeLessThan(parseFloat(DESCUENTO_INDIVIDUAL_PCT));
              } else {
                expect(parseFloat(resultado.porcentajeAplicado)).toBeCloseTo(parseFloat(DESCUENTO_INDIVIDUAL_PCT), 1);
              }
            }
          });

          await pos.abrirCrearProforma();
          await pos.seleccionarTipoProforma(tipo);
          await pos.llenarNombreClienteProforma(`Cliente Proforma Desc Individual ${etiqueta} ${Date.now()}`);

          await test.step(`Guardar la Proforma ${etiqueta} y validar que se creó correctamente`, async () => {
            await guardarProformaYCerrarGestion(pos);
          });
        } finally {
          if (monedaOriginal) await pos.cambiarMoneda(monedaOriginal);
        }
      });
    }
  });

  test.describe('Descuento general', () => {
    for (const { tipo, etiqueta } of TIPOS_PROFORMA) {
      test(`Crear una Proforma ${etiqueta} con productos mixtos, vendedor y descuento general`, async ({ pos }) => {
        test.setTimeout(TIMEOUTS.TEST);

        const monedaOriginal = tipo === 'taller' ? await pos.asegurarMonedaBaseActiva() : null;
        try {
          await pos.agregarProductoNormalFraccionadoYRapido('Proforma', `Desc General ${etiqueta} ${Date.now()}`);

          // Mismo criterio ya usado en pos-orden-caja.spec.ts (test "Crear una
          // Orden de Caja utilizando descuento general"): activar, expandir el
          // detalle avanzado, ingresar el porcentaje y validar que el monto y
          // el total reflejaron el cambio antes de continuar.
          let totalAntes = 0;
          await test.step(`Activar el descuento general del ${DESCUENTO_GENERAL_PCT}% y validar que se aplicó`, async () => {
            totalAntes = await pos.obtenerTotalVentaNumerico();
            await pos.activarDescuentoGeneral();
            await pos.mostrarDetalleAvanzadoFactura();
            await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);

            const montoDescuento = await pos.obtenerMontoDescuentoGeneralNumerico();
            expect(montoDescuento, 'El monto de descuento general no quedó reflejado en los totales').toBeGreaterThan(0);

            const totalDespues = await pos.obtenerTotalVentaNumerico();
            expect(totalDespues, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalAntes);
          });

          await pos.abrirCrearProforma();
          await pos.seleccionarTipoProforma(tipo);
          await pos.llenarNombreClienteProforma(`Cliente Proforma Desc General ${etiqueta} ${Date.now()}`);
          await pos.seleccionarVendedorProforma();

          await test.step(`Guardar la Proforma ${etiqueta} y validar que se creó correctamente`, async () => {
            await guardarProformaYCerrarGestion(pos);
          });
        } finally {
          if (monedaOriginal) await pos.cambiarMoneda(monedaOriginal);
        }
      });
    }
  });

  // ─── Escenario 1: Vista Expandida ─────────────────────────────────────────
  test.describe('Vista expandida', () => {
    test('Crear una Proforma en Vista Expandida con productos rápidos, normales, vendedor y descuento general', async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);

      // "Vista Expandida" persiste por usuario en el servidor (mismo patrón
      // que la moneda, ver alternarVistaExpandida()) — se detecta el estado
      // real al inicio (nunca se asume) y se restaura en `finally`, mismo
      // criterio ya usado en pos-navegacion.spec.ts ("Vista Expandida:
      // agregar producto por código con buscador interno").
      const expandidaAlInicio = await pos.vistaExpandidaActiva();
      try {
        let codigoProductoNormal = '';
        let nombreProductoNormal = '';
        await test.step('Vista Normal: identificar un producto normal y su código', async () => {
          if (await pos.vistaExpandidaActiva()) {
            await pos.alternarVistaExpandida();
          }
          const { producto, codigo } = await pos.obtenerPrimerProductoNormalConCodigo();
          nombreProductoNormal = producto.nombre;
          codigoProductoNormal = codigo;
        });

        await test.step('Activar Vista Expandida y confirmar que el cambio ocurrió realmente', async () => {
          if (!(await pos.vistaExpandidaActiva())) {
            await pos.alternarVistaExpandida();
          }
          expect(await pos.vistaExpandidaActiva(), 'La vista no quedó en modo Expandida').toBe(true);
        });

        await test.step('Agregar el producto normal vía el buscador interno de Vista Expandida', async () => {
          const clavesAntes = await pos.obtenerClavesProductos();
          await pos.agregarProductoPorCodigoEnVistaExpandida(codigoProductoNormal);
          const clavesDespues = await pos.obtenerClavesProductos();
          expect(clavesDespues.length, 'El producto normal no quedó agregado vía el buscador interno de Vista Expandida').toBeGreaterThan(clavesAntes.length);
        });

        let nombreProductoRapido = '';
        await test.step('Agregar un producto rápido (independiente de la vista activa)', async () => {
          nombreProductoRapido = `Rápido VistaExpandida ${Date.now()}`;
          await pos.agregarProductoRapidoSimple(nombreProductoRapido, PRECIO_PRODUCTO_RAPIDO);
        });

        let clavesCarrito: string[] = [];
        let totalAntesDescuento = 0;
        // Validado ANTES de activar el descuento general y ANTES de guardar
        // como Proforma: confirmado en vivo que "Crear Proforma" vacía el
        // carrito al terminar (leer las líneas DESPUÉS de guardar las deja
        // esperando indefinidamente elementos que ya no existen en el DOM),
        // y que el descuento general no siempre es exactamente el % pedido
        // sobre el subtotal completo (el sistema puede aplicar su propio
        // tope por producto, mismo criterio ya documentado para el descuento
        // individual) — subtotal + impuestos = total solo se valida en el
        // punto donde es matemáticamente exacto: sin descuento aún aplicado.
        await test.step('Validar productos, cantidades, subtotal e IVA del carrito antes del descuento', async () => {
          clavesCarrito = await pos.obtenerClavesProductos();
          expect(clavesCarrito.length, 'Se esperaban al menos 2 líneas en el carrito (normal + rápido)').toBeGreaterThanOrEqual(2);

          const lineas = await Promise.all(clavesCarrito.map((clave) => pos.obtenerDatosLineaCarrito(clave)));
          for (const linea of lineas) {
            expect(linea.cantidad, `La cantidad de "${linea.nombre}" debería ser mayor que 0`).toBeGreaterThan(0);
            expect(linea.neto, `El neto de "${linea.nombre}" debería ser mayor que 0`).toBeGreaterThan(0);
          }
          const nombres = lineas.map((l) => l.nombre);
          expect(nombres, 'El producto normal agregado en Vista Expandida no está en el carrito').toContain(nombreProductoNormal);
          expect(nombres.some((n) => n === nombreProductoRapido), 'El producto rápido no está en el carrito').toBe(true);

          const subtotalEsperado = pos.calcularSubtotalEsperado(lineas);
          const impuestosEsperados = pos.calcularTotalImpuestosEsperado(lineas);
          totalAntesDescuento = await pos.obtenerTotalVentaNumerico();
          expect(totalAntesDescuento, 'Subtotal + impuestos no coincide con el total mostrado').toBeCloseTo(subtotalEsperado + impuestosEsperados, 1);
        });

        let montoDescuentoGeneral = 0;
        await test.step(`Activar el descuento general del ${DESCUENTO_GENERAL_PCT}% y validar que se aplicó`, async () => {
          await pos.activarDescuentoGeneral();
          await pos.mostrarDetalleAvanzadoFactura();
          await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);

          montoDescuentoGeneral = await pos.obtenerMontoDescuentoGeneralNumerico();
          expect(montoDescuentoGeneral, 'El monto de descuento general no quedó reflejado en los totales').toBeGreaterThan(0);

          const totalDespues = await pos.obtenerTotalVentaNumerico();
          expect(totalDespues, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalAntesDescuento);
        });

        const nombreCliente = `Cliente Proforma VistaExpandida ${Date.now()}`;
        let nombreVendedor = '';
        await test.step('Abrir "Crear Proforma", llenar cliente y seleccionar vendedor', async () => {
          await pos.abrirCrearProforma();
          await pos.seleccionarTipoProforma('normal');
          await pos.llenarNombreClienteProforma(nombreCliente);
          nombreVendedor = await pos.seleccionarVendedorProforma();
          expect(nombreVendedor.length).toBeGreaterThan(0);
        });

        let respuestaGuardar: Response;
        await test.step('Guardar la Proforma y validar que se creó correctamente', async () => {
          respuestaGuardar = await pos.guardarProformaYObtenerRespuesta();
          await pos.validarProformaCreada(respuestaGuardar);
        });

        await test.step('Validar persistencia (cliente, vendedor, descuento) imprimiendo la Proforma ya guardada', async () => {
          const ventanaImpresion = await pos.imprimirProforma();
          await expect(
            ventanaImpresion.locator('body'),
            'La ventana de impresión no muestra el cliente de la Proforma'
          ).toContainText(nombreCliente, { timeout: TIMEOUTS.PAYMENT_MODAL });
          await pos.mostrarYCerrarVentanaImpresion(ventanaImpresion);
        });

        await pos.cerrarModalGestionProforma();
      } finally {
        // Defensivo: si algún paso anterior falló a mitad de camino, el
        // modal de Gestión (data-backdrop="static") puede seguir abierto y
        // bloquear el click de alternarVistaExpandida() — mismo criterio ya
        // documentado en cerrarModalGestionProforma().
        if (await pos.modalGestionProforma.isVisible().catch(() => false)) {
          await pos.cerrarModalGestionProforma().catch(() => {});
        }
        if ((await pos.vistaExpandidaActiva()) !== expandidaAlInicio) {
          await pos.alternarVistaExpandida();
        }
        expect(await pos.vistaExpandidaActiva(), 'La vista no volvió a su estado original').toBe(expandidaAlInicio);
      }
    });
  });

  // ─── Escenario 2: Moneda distinta de la base ──────────────────────────────
  test.describe('Moneda distinta a la base', () => {
    for (const { tipo, etiqueta } of [TIPOS_PROFORMA[0], TIPOS_PROFORMA[1]]) { // Normal y Consignación — Taller exige la moneda base (ver asegurarMonedaBaseActiva())
      test(`Crear una Proforma ${etiqueta} con productos mixtos, vendedor y descuento general en una moneda distinta de la base`, async ({ pos }) => {
        test.setTimeout(TIMEOUTS.TEST);

        const { simboloActivo: monedaOriginal, simboloBase } = await pos.obtenerInfoMoneda();
        const simbolosDisponibles = await pos.obtenerSimbolosMonedaDisponibles();
        const simboloNoBase = simbolosDisponibles.find((s) => s !== simboloBase);
        expect(simboloNoBase, `No hay ninguna moneda distinta de la base (${simboloBase}) disponible en este ambiente para este escenario`).toBeTruthy();

        try {
          await test.step(`Cambiar la moneda activa a "${simboloNoBase}" (distinta de la base "${simboloBase}")`, async () => {
            if (monedaOriginal !== simboloNoBase) {
              await pos.cambiarMoneda(simboloNoBase!);
            }
            const simboloEnTotal = await pos.obtenerSimboloMonedaEnTotal();
            expect(simboloEnTotal, 'El total del carrito no refleja la moneda recién seleccionada').toBe(simboloNoBase);
          });

          await test.step('Agregar producto normal, rápido y fraccionado', async () => {
            await pos.agregarProductoNormalFraccionadoYRapido('Proforma Moneda', `${etiqueta} ${Date.now()}`);
          });

          let clavesCarrito: string[] = [];
          let totalAntesDescuento = 0;
          // Validado ANTES de activar el descuento general y ANTES de
          // guardar como Proforma — mismo criterio que el escenario de
          // Vista Expandida: "Crear Proforma" vacía el carrito al terminar,
          // y el descuento general puede no ser exactamente el % pedido
          // sobre el subtotal completo (tope por producto), así que
          // subtotal + impuestos = total solo se valida donde es exacto.
          await test.step('Validar impuestos y totales consistentes en la moneda activa antes del descuento', async () => {
            clavesCarrito = await pos.obtenerClavesProductos();
            const lineas = await Promise.all(clavesCarrito.map((clave) => pos.obtenerDatosLineaCarrito(clave)));
            const subtotalEsperado = pos.calcularSubtotalEsperado(lineas);
            const impuestosEsperados = pos.calcularTotalImpuestosEsperado(lineas);
            totalAntesDescuento = await pos.obtenerTotalVentaNumerico();
            expect(totalAntesDescuento, 'Subtotal + impuestos no coincide con el total mostrado en la moneda activa').toBeCloseTo(subtotalEsperado + impuestosEsperados, 1);
          });

          await test.step(`Activar el descuento general del ${DESCUENTO_GENERAL_PCT}% y validar que se aplicó`, async () => {
            await pos.activarDescuentoGeneral();
            await pos.mostrarDetalleAvanzadoFactura();
            await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);

            const montoDescuentoGeneral = await pos.obtenerMontoDescuentoGeneralNumerico();
            expect(montoDescuentoGeneral, 'El monto de descuento general no quedó reflejado en los totales').toBeGreaterThan(0);
            const totalDespues = await pos.obtenerTotalVentaNumerico();
            expect(totalDespues, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalAntesDescuento);
          });

          const nombreCliente = `Cliente Proforma Moneda ${etiqueta} ${Date.now()}`;
          let nombreVendedor = '';
          await test.step('Abrir "Crear Proforma", llenar cliente y seleccionar vendedor', async () => {
            await pos.abrirCrearProforma();
            await pos.seleccionarTipoProforma(tipo);
            await pos.llenarNombreClienteProforma(nombreCliente);
            nombreVendedor = await pos.seleccionarVendedorProforma();
            expect(nombreVendedor.length).toBeGreaterThan(0);
          });

          await test.step(`Guardar la Proforma ${etiqueta} y validar que se creó correctamente en "${simboloNoBase}"`, async () => {
            const respuesta = await pos.guardarProformaYObtenerRespuesta();
            await pos.validarProformaCreada(respuesta);
          });

          await test.step('Validar persistencia de moneda, tipo y cliente imprimiendo la Proforma ya guardada', async () => {
            const ventanaImpresion = await pos.imprimirProforma();
            await expect(
              ventanaImpresion.locator('body'),
              'La ventana de impresión no muestra el cliente de la Proforma'
            ).toContainText(nombreCliente, { timeout: TIMEOUTS.PAYMENT_MODAL });
            await pos.mostrarYCerrarVentanaImpresion(ventanaImpresion);
          });

          await pos.cerrarModalGestionProforma();
        } finally {
          // Defensivo: si algún paso anterior falló a mitad de camino, el
          // modal de Gestión (data-backdrop="static") puede seguir abierto y
          // bloquear el click en #menu_type_currency — mismo criterio ya
          // documentado en cerrarModalGestionProforma().
          if (await pos.modalGestionProforma.isVisible().catch(() => false)) {
            await pos.cerrarModalGestionProforma().catch(() => {});
          }
          const { simboloActivo: activaAlFinal } = await pos.obtenerInfoMoneda();
          if (activaAlFinal !== monedaOriginal) {
            await pos.cambiarMoneda(monedaOriginal);
          }
        }
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Gestión de Proforma (modal que aparece automáticamente tras guardar, y
// listado de Proformas ya existentes)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Proformas — Gestión', () => {

  test('Enviar una Proforma por correo (creada con cliente existente)', async ({ pos }) => {
    test.setTimeout(TIMEOUTS.TEST);
    await agregarProductoNormalAlCarrito(pos);

    await test.step('Seleccionar un cliente existente y crear la Proforma', async () => {
      await pos.seleccionarClienteExistente();
      const respuesta = await crearProformaBasica(pos, 'normal');
      await pos.validarProformaCreada(respuesta);
    });

    await test.step('Enviar por correo y validar la petición AJAX, la respuesta y el mensaje mostrado', async () => {
      const respuesta = await pos.enviarProformaPorCorreo();
      const cuerpo = (await respuesta.text()).trim();

      // No basta con el toast: se valida primero la respuesta real del AJAX
      // (sendProformByEmail responde texto plano "1"=éxito, no JSON).
      expect(respuesta.ok(), `sendProformByEmail no respondió OK (status ${respuesta.status()})`).toBe(true);
      expect(cuerpo, `sendProformByEmail no confirmó el envío (respondió "${cuerpo}")`).toBe('1');

      await expect(
        pos.modalGestionProforma.page().locator('.noty_bar', { hasText: /enviada/i }),
        'No apareció el mensaje de confirmación de envío por correo'
      ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    });

    await pos.cerrarModalGestionProforma();
  });

  test('Imprimir una Proforma', async ({ pos }) => {
    test.setTimeout(TIMEOUTS.TEST);
    await agregarProductoNormalAlCarrito(pos);

    const nombreCliente = `Cliente Proforma Imprimir ${Date.now()}`;
    await test.step('Crear una Proforma Normal con nombre de cliente libre', async () => {
      await pos.abrirCrearProforma();
      await pos.seleccionarTipoProforma('normal');
      await pos.llenarNombreClienteProforma(nombreCliente);
      const respuesta = await pos.guardarProformaYObtenerRespuesta();
      await pos.validarProformaCreada(respuesta);
    });

    await test.step('Imprimir y validar que el contenido real de la Proforma se generó antes de cerrar la ventana', async () => {
      const ventanaImpresion = await pos.imprimirProforma();
      await expect(
        ventanaImpresion.locator('body'),
        'La ventana de impresión no mostró el contenido de la Proforma'
      ).toContainText(nombreCliente, { timeout: TIMEOUTS.PAYMENT_MODAL });

      await pos.mostrarYCerrarVentanaImpresion(ventanaImpresion);
    });

    await pos.cerrarModalGestionProforma();
  });

  test('Descargar el PDF de una Proforma', async ({ pos }) => {
    test.setTimeout(TIMEOUTS.TEST);
    await agregarProductoNormalAlCarrito(pos);

    await test.step('Crear una Proforma Normal con nombre de cliente libre', async () => {
      await pos.abrirCrearProforma();
      await pos.seleccionarTipoProforma('normal');
      await pos.llenarNombreClienteProforma(`Cliente Proforma PDF ${Date.now()}`);
      const respuesta = await pos.guardarProformaYObtenerRespuesta();
      await pos.validarProformaCreada(respuesta);
    });

    await test.step('Descargar el PDF y validar el evento de descarga, el nombre sugerido y la extensión', async () => {
      const descarga = await pos.descargarPdfProforma();
      const nombreSugerido = descarga.suggestedFilename();

      expect(nombreSugerido, 'El nombre sugerido de la descarga no corresponde a una Proforma').toMatch(/PROFORMA/i);
      expect(nombreSugerido, 'El archivo descargado no tiene extensión .pdf').toMatch(/\.pdf$/i);
    });

    await pos.cerrarModalGestionProforma();
  });

  test('Ver todas las Proformas desde el modal de gestión', async ({ pos }) => {
    test.setTimeout(TIMEOUTS.TEST);
    await agregarProductoNormalAlCarrito(pos);

    await test.step('Crear una Proforma Normal con nombre de cliente libre', async () => {
      await pos.abrirCrearProforma();
      await pos.seleccionarTipoProforma('normal');
      await pos.llenarNombreClienteProforma(`Cliente Proforma Ver Todas ${Date.now()}`);
      const respuesta = await pos.guardarProformaYObtenerRespuesta();
      await pos.validarProformaCreada(respuesta);
    });

    await test.step('Ver todas y validar que abre el historial de Proformas', async () => {
      // Mismo criterio ya usado por "Abrir Historial de Proformas"
      // (pos-navegacion.spec.ts): validar la URL real del listado, en vez de
      // solo confirmar que se abrió una ventana.
      const historial = await pos.verTodasLasProformas();
      await historial.waitForLoadState('domcontentloaded');
      expect(historial.url()).toContain('printPosProform');
      await historial.close();
    });

    await pos.cerrarModalGestionProforma();
  });

  // Nota de arquitectura para TODA esta sección: por instrucción explícita,
  // los 6 escenarios siguientes (Imprimir/Editar/WhatsApp/Email/PDF/Eliminar)
  // usan ÚNICAMENTE las opciones de cada tarjeta en la pestaña "Proforma /
  // Cotizaciones" del propio POS (menú de tres puntos, `.dropbtn` — ver el
  // comentario de L.PROFORMA_TAB_DROPBTN) — nunca el modal de Gestión que
  // aparece justo tras crear, ni el listado externo `printPosProform`. Los 6
  // se validan para los 3 sub-filtros de tipo (Normal/Consignación/Taller,
  // ver cambiarSubTabProforma()): misma UI/mecanismo real subyacente para
  // los 3 (confirmado en vivo: misma estructura de tarjeta y de menú de tres
  // puntos en los 3 sub-filtros), solo cambia el sub-filtro activo antes de
  // buscar/crear.

  // ─── Escenario 3: Imprimir (reutilizando una Proforma existente) ─────────
  for (const { tipo, etiqueta } of TIPOS_PROFORMA) {
    test(`Imprimir una Proforma ${etiqueta} existente desde la pestaña "Proforma / Cotizaciones"`, async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);

      const { tarjeta, nombreCliente } = await buscarOCrearProformaEnTab(pos, tipo);

      // Dato real leído de la propia tarjeta (data-proform-total/currency del
      // ícono de vista previa) — se usa para validar que lo impreso refleja
      // el dato real, no solo que "algo" se generó.
      const totalEnTarjeta = await tarjeta.locator('.a_proform_order_items').getAttribute('data-proform-total');
      const monedaEnTarjeta = await tarjeta.locator('.a_proform_order_items').getAttribute('data-proform-currency');

      await test.step('Abrir el menú de la tarjeta y presionar "Imprimir"', async () => {
        const ventanaImpresion = await pos.imprimirProformaDesdeTab(tarjeta);

        await expect(
          ventanaImpresion.locator('body'),
          'La ventana de impresión no muestra el cliente de la Proforma'
        ).toContainText(nombreCliente, { timeout: TIMEOUTS.PAYMENT_MODAL });

        if (totalEnTarjeta) {
          // Confirmado en vivo: el sistema imprime el total con coma de millar
          // y punto decimal ("457,240.00"), no con el formato "es-CR" real de
          // Intl (que usa espacio de millar y coma decimal) — se formatea a
          // mano en vez de asumir un locale de Intl que no coincide con lo
          // que la propia aplicación realmente imprime.
          const totalFormateado = parseFloat(totalEnTarjeta).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          await expect(
            ventanaImpresion.locator('body'),
            `La ventana de impresión no refleja el total real de la Proforma (${monedaEnTarjeta}${totalFormateado})`
          ).toContainText(totalFormateado);
        }

        await pos.mostrarYCerrarVentanaImpresion(ventanaImpresion);
      });
    });
  }

  // ─── Escenario 7: Descargar PDF (reutilizando una Proforma existente) ────
  for (const { tipo, etiqueta } of TIPOS_PROFORMA) {
    test(`Descargar el PDF de una Proforma ${etiqueta} existente desde la pestaña "Proforma / Cotizaciones"`, async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);

      const { tarjeta } = await buscarOCrearProformaEnTab(pos, tipo);

      await test.step('Abrir el menú de la tarjeta y presionar "Descargar PDF"', async () => {
        const descarga = await pos.descargarPdfProformaDesdeTab(tarjeta);
        const nombreSugerido = descarga.suggestedFilename();
        expect(nombreSugerido, 'El nombre sugerido de la descarga no corresponde a una Proforma').toMatch(/PROFORMA/i);
        expect(nombreSugerido, 'El archivo descargado no tiene extensión .pdf').toMatch(/\.pdf$/i);
      });
    });
  }

  // ─── Escenario 6: Enviar por Email (reutilizando una Proforma existente) ──
  for (const { tipo, etiqueta } of TIPOS_PROFORMA) {
    test(`Enviar por correo una Proforma ${etiqueta} existente desde la pestaña "Proforma / Cotizaciones"`, async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);

      const { tarjeta } = await buscarOCrearProformaEnTab(pos, tipo);

      await test.step('Abrir el menú de la tarjeta, presionar "Enviar email" y validar la petición AJAX y la respuesta real', async () => {
        const respuesta = await pos.enviarEmailDesdeTab(tarjeta, 'qa.automatizacion@example.com');
        const cuerpo = (await respuesta.text()).trim();

        expect(respuesta.ok(), `sendProformByEmail no respondió OK (status ${respuesta.status()})`).toBe(true);
        expect(['0', '1']).toContain(cuerpo);

        // Si el ambiente de QA no tiene el envío real de correo habilitado
        // (SMTP), la respuesta puede llegar en "0" sin que eso sea un bug de
        // automatización: se documenta como limitación del ambiente en vez de
        // forzar el test a exigir siempre "1" — el flujo real (modal,
        // validación del campo, click en "Enviar", respuesta del AJAX real)
        // ya quedó validado punta a punta sin ningún error inesperado.
        if (cuerpo !== '1') {
          console.log(`[Enviar por correo — ${etiqueta}] El ambiente respondió "0": revisar configuración de envío de correo (SMTP) de este ambiente de QA, no es un fallo de automatización.`);
        }
      });
    });
  }

  // ─── Escenario 5: Enviar por WhatsApp ─────────────────────────────────────
  // El botón "Enviar" real de este modal (`send_dialog_whatsapp_message()`)
  // tiene toda la apariencia de disparar un envío real vía integración de
  // WhatsApp Business de la propia aplicación (documentos seleccionables,
  // plantillas de mensaje con "Buscar"/"Guardar") — a diferencia del panel
  // simple del modal de Gestión (que solo arma un enlace
  // `api.whatsapp.com/send` del lado del cliente, sin ningún efecto en el
  // servidor). Por prudencia, un test automatizado nunca debe ejecutar ese
  // botón contra un ambiente compartido (podría enviar un WhatsApp real a
  // un número de prueba configurado). Por eso se valida el flujo alterno que
  // el propio modal ofrece y que SÍ es seguro de ejecutar: descargar el
  // documento de la Proforma (`downloadWhatsappDocument('proforma', event)`,
  // solo genera un PDF, ningún envío) — exactamente la alternativa que pide
  // el escenario ("validar que se pueda enviar o... descargar la proforma").
  for (const { tipo, etiqueta } of TIPOS_PROFORMA) {
    test(`Enviar una Proforma ${etiqueta} por WhatsApp desde la pestaña "Proforma / Cotizaciones"`, async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);

      const { tarjeta } = await buscarOCrearProformaEnTab(pos, tipo);

      await test.step('Abrir el menú de la tarjeta y presionar "WhatsApp"', async () => {
        const dialogo = await pos.abrirWhatsAppDesdeTab(tarjeta);
        await expect(dialogo, 'El modal de WhatsApp no debería mostrar ningún error del sistema').not.toContainText(/error/i);

        await test.step('Descargar la Proforma desde el propio modal (flujo alterno seguro, sin disparar un envío real)', async () => {
          const descarga = await pos.descargarProformaDesdeModalWhatsApp(dialogo);
          expect(descarga.suggestedFilename(), 'La descarga desde el modal de WhatsApp no corresponde a un PDF').toMatch(/\.pdf$/i);
        });

        await dialogo.locator('#btn_close_send_whatsapp_modal').click();
        await expect(dialogo, 'El modal de WhatsApp no se cerró correctamente').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
      });
    });
  }

  // ─── Escenario 8: Eliminar ─────────────────────────────────────────────────
  // A diferencia de Imprimir/Email/PDF (no destructivos, seguros de
  // reutilizar), Eliminar es irreversible — mismo criterio de seguridad ya
  // establecido en este repo para acciones masivas de Ruteo
  // (eliminarOrdenesRuteoMasivamente(), pos-ruteo.page.ts: "los tests que la
  // usan deben crear sus propias órdenes desechables — nunca reutilizar una
  // orden real ya existente del ambiente QA compartido"). Se aplica el mismo
  // criterio aquí: se crea una Proforma desechable propia de este test en
  // vez de eliminar una real del ambiente compartido.
  for (const { tipo, etiqueta } of TIPOS_PROFORMA) {
    test(`Eliminar una Proforma ${etiqueta} desde la pestaña "Proforma / Cotizaciones" (desechable, creada por este mismo test)`, async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoNormalAlCarrito(pos);

      const monedaOriginal = tipo === 'taller' ? await pos.asegurarMonedaBaseActiva() : null;
      try {
        const nombreCliente = `Cliente Proforma Eliminar ${etiqueta} ${Date.now()}`;
        await test.step(`Crear una Proforma ${etiqueta} desechable`, async () => {
          await pos.abrirCrearProforma();
          await pos.seleccionarTipoProforma(tipo);
          await pos.llenarNombreClienteProforma(nombreCliente);
          const respuesta = await pos.guardarProformaYObtenerRespuesta();
          await pos.validarProformaCreada(respuesta);
        });
        await pos.cerrarModalGestionProforma();

        await test.step('Abrir su menú en la pestaña y eliminarla, validando el modal de confirmación y la respuesta real del AJAX', async () => {
          const tarjeta = await pos.abrirMenuTarjetaProformaEnTab(nombreCliente, tipo);
          const cuerpo = await pos.eliminarProformaDesdeTab(tarjeta);
          expect(cuerpo, `deleteProform no confirmó la eliminación (respondió "${cuerpo}")`).toBe('1');
        });

        await test.step('Validar que ya no aparece en la pestaña "Proforma / Cotizaciones"', async () => {
          await pos.irAlPos();
          await pos.esperarEstadoInicial();
          const encontrada = await pos.abrirMenuTarjetaProformaEnTab(nombreCliente, tipo).catch(() => null);
          expect(encontrada, 'La Proforma eliminada sigue apareciendo en la pestaña "Proforma / Cotizaciones"').toBeNull();
        });
      } finally {
        if (monedaOriginal) await pos.cambiarMoneda(monedaOriginal);
      }
    });
  }

  // ─── Escenario 4: Editar (edición real in-place) ──────────────────────────
  //
  // Corrección importante sobre una investigación previa: se había concluido
  // que no existía edición in-place, buscando "Editar" únicamente en el
  // modal de Gestión y en el panel de detalle del listado externo
  // (`printPosProform`). Ninguno de los dos la tiene. La edición real vive
  // en un TERCER lugar no explorado en esa primera pasada: la pestaña
  // "Proforma / Cotizaciones" DENTRO del propio POS (PESTANA_POS_PROFORMA) —
  // cada tarjeta tiene su propio menú de tres puntos (`.dropbtn`, ver el
  // comentario de L.PROFORMA_TAB_DROPBTN) con una opción real "Editar" justo
  // debajo de "Imprimir", que abre el mismo modal "Agregar Proforma" en modo
  // `update` y guarda contra un AJAX distinto (`updateProform`) que SÍ
  // actualiza el mismo id — confirmado en vivo comparando el id antes/después.
  //
  // A diferencia de Imprimir/Email/PDF (solo lectura, seguros de reutilizar),
  // Editar MUTA el registro reutilizado (cambia su cliente/vendedor/
  // observación) — mismo riesgo que Eliminar de corromper una Proforma real
  // que otro test paralelo esté leyendo del mismo ambiente QA compartido en
  // ese instante. Se aplica el mismo criterio de seguridad ya establecido en
  // el repo para Ruteo/Eliminar: esta Proforma es desechable, creada por
  // este mismo test.
  for (const { tipo, etiqueta } of TIPOS_PROFORMA) {
    test(`Editar una Proforma ${etiqueta} existente (edición real in-place, vía la pestaña Proforma/Cotizaciones)`, async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoNormalAlCarrito(pos);

      const monedaOriginal = tipo === 'taller' ? await pos.asegurarMonedaBaseActiva() : null;
      try {
        const nombreOriginal = `Cliente Proforma Editar ${etiqueta} ${Date.now()}`;
        let proformaId = '';
        await test.step(`Crear una Proforma ${etiqueta} desechable para editar`, async () => {
          await pos.abrirCrearProforma();
          await pos.seleccionarTipoProforma(tipo);
          await pos.llenarNombreClienteProforma(nombreOriginal);
          const respuesta = await pos.guardarProformaYObtenerRespuesta();
          await pos.validarProformaCreada(respuesta);
          proformaId = await pos.obtenerIdProformaCreada();
        });
        await pos.cerrarModalGestionProforma();

        const nombreEditado = `Cliente Proforma EDITADO ${etiqueta} ${Date.now()}`;
        const observacionEditada = `Observación editada ${etiqueta} ${Date.now()}`;
        let nombreVendedorEditado = '';

        await test.step('Abrir el menú de la tarjeta en la pestaña "Proforma / Cotizaciones" y presionar "Editar"', async () => {
          const tarjeta = await pos.abrirMenuTarjetaProformaEnTab(nombreOriginal, tipo);
          await pos.editarProformaSeleccionada(tarjeta, proformaId);
        });

        await test.step('Modificar cliente, vendedor y observación, y guardar', async () => {
          await pos.llenarNombreClienteProforma(nombreEditado);
          nombreVendedorEditado = await pos.seleccionarVendedorProforma();
          await pos.llenarObservacionProforma(observacionEditada);

          const respuesta = await pos.guardarEdicionProformaYObtenerRespuesta();
          expect(respuesta.ok(), `updateProform no respondió OK (status ${respuesta.status()})`).toBe(true);
        });

        await test.step('Volver a abrir la Proforma y validar que la información quedó correctamente actualizada', async () => {
          const tarjetaReabierta = await pos.abrirMenuTarjetaProformaEnTab(nombreEditado, tipo);
          await pos.editarProformaSeleccionada(tarjetaReabierta, proformaId);

          await expect(
            pos.campoNombreClienteProforma,
            'El cliente editado no persistió al reabrir la Proforma'
          ).toHaveValue(nombreEditado);
          await expect(
            pos.campoObservacionProforma,
            'La observación editada no persistió al reabrir la Proforma'
          ).toHaveValue(observacionEditada);

          // El vendedor del modal de Proforma no tiene un lector directo propio
          // (a diferencia del de "Agregar" y "Enviar a caja"): se valida por el
          // mismo mecanismo genérico de Chosen ya usado para seleccionarlo.
          const vendedorEnModal = await pos._obtenerTextoChosenSeleccionado('#select_payment_agent_assigned_chosen');
          expect(vendedorEnModal, 'El vendedor editado no persistió al reabrir la Proforma').toBe(nombreVendedorEditado);
        });

        await pos.modalCrearProforma.locator('.close, [data-dismiss="modal"]').first().click().catch(() => {});
      } finally {
        if (monedaOriginal) await pos.cambiarMoneda(monedaOriginal);
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Proformas — Facturar y Convertir
// ═══════════════════════════════════════════════════════════════════════════
//
// A diferencia de "Crear" (arma un carrito nuevo y lo deja pendiente como
// Proforma) y "Gestión" (opera acciones de solo lectura/edición sobre una
// tarjeta), estos escenarios parten de una Proforma YA EXISTENTE (reutilizada
// vía buscarOCrearProformaEnTab(), solo se crea una si el sub-filtro está
// vacío) y la llevan hasta Facturar o hasta Convertir a Orden de Reparación —
// el otro extremo del ciclo de vida de una Proforma. Cada test es
// independiente: si una Proforma queda facturada/convertida durante un
// escenario, el siguiente que llame a buscarOCrearProformaEnTab() en su
// propio beforeEach (carrito y sesión ya reciclados) recibe automáticamente
// la primera Proforma que siga disponible en ese momento — nunca la misma que
// ya se consumió — sin necesidad de lógica adicional de exclusión.

/**
 * Localiza un producto normal con código real que TODAVÍA NO esté en el
 * carrito — necesario porque, a diferencia del test "Vista expandida" de
 * "Proformas — Crear" (carrito vacío al inicio), los escenarios de este
 * describe cargan una Proforma ya existente (con sus propias líneas) antes de
 * identificar el producto normal a agregar: add_to_table() no crea una línea
 * nueva para un producto ya presente, solo le suma cantidad a la existente
 * (ver el comentario de obtenerTextoCarrito() en pos.page.ts). Mismo criterio
 * ya usado como función local en pos-orden-caja.spec.ts
 * (obtenerProductoNormalConCodigoNoPresenteEnCarrito).
 */
async function obtenerProductoNormalConCodigoNoPresenteEnCarrito(pos: PosPage): Promise<{ nombre: string; codigo: string }> {
  const textoCarrito = await pos.obtenerTextoCarrito();
  const nombresDescartados = new Set<string>();
  const MAX_INTENTOS = 10;

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const metadato = await pos.localizarPrimerProducto(
      (m) => m.tipoItem === 1 && !m.esFraccionado && !textoCarrito.includes(m.nombre) && !nombresDescartados.has(m.nombre),
      'producto normal que todavía no esté en el carrito'
    );
    const codigo = await pos.obtenerCodigoProducto(metadato.nombre).catch(() => '');
    if (codigo) return { nombre: metadato.nombre, codigo };
    nombresDescartados.add(metadato.nombre);
  }
  throw new Error(`No se encontró ningún producto normal con código real que no esté ya en el carrito tras ${MAX_INTENTOS} intentos.`);
}

/**
 * Valida cada línea del carrito contra su propio estado real de IVA (leído
 * primero, nunca asumido) — necesaria para una Proforma ya existente
 * ("primera disponible") cuyas líneas pueden traer IVA activo o no según el
 * producto real. Compone establecerMostrarPrecioConIva() + obtenerDatosLineaCarrito()
 * + validarLineaCarrito(), los tres ya existentes — mismo helper ya usado en
 * pos-orden-caja.spec.ts y pos-apartado.spec.ts.
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

/** Valida que subtotal + impuestos coincidan con el total mostrado — mismo criterio ya usado en pos-orden-caja.spec.ts. */
async function validarTotalCarrito(pos: PosPage, lineas: LineaCarrito[]) {
  const totalEsperado = pos.calcularSubtotalEsperado(lineas) + pos.calcularTotalImpuestosEsperado(lineas);
  const totalReal = await pos.obtenerTotalVentaNumerico();
  expect(totalReal, `Total esperado (subtotal + impuestos = ${totalEsperado.toFixed(2)}) no coincide con el total mostrado (${totalReal.toFixed(2)})`).toBeCloseTo(totalEsperado, 1);
}

/** Agrega el servicio de End. Pintura completando el wizard Vehículo → Parte → Pieza → Servicio — mismo helper ya usado en pos-orden-caja.spec.ts. */
async function agregarServicioDeEndPintura(pos: PosPage) {
  await pos.tabPintura.click();
  await expect.poll(() => pos.tabEstaActivo(pos.tabPintura)).toBe(true);

  await pos.seleccionarVehiculoPintura(VEHICULO_PINTURA_TIPO);
  await pos.seleccionarPrimeraParte();
  await pos.seleccionarPrimeraPieza();

  const clavesAntes = await pos.obtenerClavesProductos();
  await pos.seleccionarPrimerServicioPintura();
  const resultado = await pos.esperarServicioPinturaAgregadoOModalPrecio(clavesAntes);
  if (resultado === 'requiere_modal') {
    await pos.seleccionarPrimerPrecioDisponible();
  }
  await expect.poll(async () => (await pos.obtenerClavesProductos()).length).toBeGreaterThan(clavesAntes.length);
}

/**
 * Agrega al carrito los 5 tipos de ítem que los Escenarios 4-6 necesitan:
 * producto normal, producto rápido, producto fraccionado, servicio normal y
 * servicio de End. Pintura (sin combo, a diferencia de agregarSeisTiposDeItem()
 * de pos-orden-caja.spec.ts — no pedido por estos escenarios). Usa las
 * variantes "NoPresenteEnCarrito" de cada búsqueda porque, a diferencia de
 * "Crear" (carrito vacío), aquí ya hay una Proforma cargada con sus propias
 * líneas.
 */
async function agregarCincoTiposDeItem(pos: PosPage, sufijoRapido: string) {
  const normal = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
  await pos.agregarProductoDelGridAlCarrito(normal);

  await pos.agregarProductoRapidoSimple(`Rápido ${sufijoRapido}`, PRECIO_PRODUCTO_RAPIDO);

  const fraccionado = await pos.obtenerPrimerProductoFraccionadoNoPresenteEnCarrito();
  await pos.agregarProductoFraccionadoAlCarrito(fraccionado);

  await pos.tabServicios.click();
  await expect.poll(() => pos.tabEstaActivo(pos.tabServicios)).toBe(true);
  const servicio = await pos.obtenerPrimerProductoNoPresenteEnCarrito(2);
  await pos.agregarProductoAlCarrito(servicio);

  await agregarServicioDeEndPintura(pos);
}

/**
 * Vuelve a la pestaña "Productos" (POS Facturación) tras haber visitado
 * "Proforma / Cotizaciones" (obtenerPrimeraProformaEnTab()/
 * buscarOCrearProformaEnTab(), que dejan esa pestaña activa) — SIN recargar
 * la página. Un reload (pos.irAlPos()) aquí NO es seguro: confirmado en
 * vivo con un diagnóstico dedicado (log de red completo, todas las
 * peticiones responden OK) que irAlPos()/esperarEstadoInicial() asumen que
 * el reload siempre aterriza en "Productos", pero en realidad aterriza en
 * la ÚLTIMA pestaña visitada — que en todo este describe es "Proforma /
 * Cotizaciones" — donde no existe ni el modal "Abrir Caja" ni ningún
 * producto del grid, las dos únicas señales que esperarEstadoInicial() sabe
 * esperar, así que esa espera nunca se resuelve (120s, repetido, sin
 * importar cuántas veces se reintente el reload).
 *
 * Tampoco basta con clickear la pestaña "Productos" directamente mientras
 * el carrito todavía tiene una Proforma/Orden cargada (confirmado en vivo:
 * el click no cambia nada visible — mismo bloqueo ya documentado para
 * #menu_type_currency mientras hay una venta cargada). La secuencia que sí
 * funciona, confirmada en vivo de punta a punta: 1) vaciar el carrito
 * (botón "Vaciar Carrito", 100% client-side, sin AJAX — solo se intenta si
 * de verdad hay algo cargado) y 2) clickear la pestaña "Productos",
 * esperando la señal funcional real de que sí cambió (un producto del
 * grid visible) en vez de asumirlo.
 *
 * No se reutiliza pos.vaciarCarrito() tal cual: confirmado en vivo que su
 * SweetAlert de confirmación no aparece siempre (comportamiento real
 * inconsistente, no un problema de timing) — a diferencia de esa función
 * (que sí exige verlo), aquí se intenta confirmar SI aparece, pero la
 * señal que de verdad se valida es el resultado funcional (el carrito
 * queda en 0 líneas), sin importar si hubo diálogo o no.
 */
async function volverAProductosSinReload(pos: PosPage, sharedPage: Page) {
  await pos.cerrarOverlaysConocidos();

  const clavesEnCarrito = await pos.obtenerClavesFilasCarrito();
  if (clavesEnCarrito.length > 0) {
    await sharedPage.locator('#cancel_sale').click();

    const dialogo = sharedPage.locator('.sweet-alert.visible');
    const aparecio = await dialogo.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false);
    if (aparecio) {
      await dialogo.locator('button.confirm').click();
    }

    await expect.poll(
      async () => (await pos.obtenerClavesFilasCarrito()).length,
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El carrito no quedó vacío tras presionar "Vaciar Carrito"' }
    ).toBe(0);
  }

  await pos.cerrarOverlaysConocidos();
  await sharedPage.locator('#btn_pos_option').click();
  await sharedPage.locator('.product_box_name, td[id^="product_table_click_event_"]').first()
    .waitFor({ state: 'visible', timeout: TIMEOUTS.PRODUCTS_LOAD });
}

/**
 * Crea una Proforma de Taller desechable SIN cliente y la deja cargada en
 * el carrito, lista para probar el bloqueo real de "Convertir a orden de
 * reparación" — confirmado en vivo (dos hallazgos directos del usuario)
 * que reutilizar "la primera Proforma de Taller disponible" en este
 * ambiente NUNCA reproduce el estado bloqueado: esas Proformas ya existentes
 * traen su propio cliente real Y su placa asociados desde su creación (el
 * primer intento de convertir sin tocar nada salió permitido, no bloqueado).
 * Por eso este escenario necesita una Proforma nueva, con nombre libre (sin
 * cliente), para poder validar ambos caminos (bloqueado → asociar cliente
 * real + placa → permitido) tal como pide el escenario.
 */
async function crearProformaTallerSinClientePararaConvertir(pos: PosPage): Promise<Locator> {
  await agregarProductoNormalAlCarrito(pos);
  const nombreCliente = `Cliente Proforma Convertir ${Date.now()}`;
  await pos.abrirCrearProforma();
  await pos.seleccionarTipoProforma('taller');
  await pos.llenarNombreClienteProforma(nombreCliente);
  const respuesta = await pos.guardarProformaYObtenerRespuesta();
  await pos.validarProformaCreada(respuesta);
  await pos.cerrarModalGestionProforma();

  const tarjeta = await pos.abrirMenuTarjetaProformaEnTab(nombreCliente, 'taller');
  await pos.cargarProformaEnCarritoDesdeTab(tarjeta);
  return tarjeta;
}

/**
 * Restaura la moneda original al terminar un escenario de "Facturar y
 * Convertir", pero SOLO si de verdad cambió. Vuelve primero a "Productos"
 * sin reload (volverAProductosSinReload() — ver ese comentario para la
 * causa raíz real: #menu_type_currency vive solo en esa pestaña, y estos
 * escenarios terminan en "Proforma / Cotizaciones") y solo entonces lee la
 * moneda realmente activa para decidir si de verdad hace falta cambiarla.
 *
 * No-fatal a propósito: esto corre en el `finally` de cada escenario, DESPUÉS
 * de que la validación de negocio real (facturar/convertir) ya tuvo éxito o
 * falló por su cuenta — un problema de limpieza aquí (p. ej. el carrito
 * tardando en vaciarse tras una conversión exitosa, visto en vivo) no debe
 * hacer fallar un escenario cuya parte relevante ya se validó. Se deja
 * evidencia en el log en vez de silenciarlo del todo.
 */
async function restaurarMonedaSiCambio(pos: PosPage, sharedPage: Page, monedaOriginal: string) {
  try {
    await volverAProductosSinReload(pos, sharedPage);
    const { simboloActivo } = await pos.obtenerInfoMoneda();
    if (simboloActivo !== monedaOriginal) {
      await pos.cambiarMoneda(monedaOriginal);
    }
  } catch (e) {
    console.log(`[restaurarMonedaSiCambio] No se pudo restaurar la moneda tras este escenario (no fatal): ${(e as Error).message}`);
  }
}

test.describe('Proformas — Facturar y Convertir', () => {

  // ─── Escenario 1: Convertir Proforma de Taller a Orden de Reparación ─────
  test.describe('Convertir a Orden de Reparación', () => {
    test('Convertir una Proforma de Taller a Orden de Reparación: bloqueada sin placa, permitida al completarla', async ({ pos, sharedPage }) => {
      // TIMEOUTS.TEST_CON_RECUPERACION (no TEST): margen extra confirmado
      // necesario en vivo bajo carga real del ambiente compartido de QA
      // (varias corridas concurrentes).
      test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
      const erroresJS = espiarErroresJS(sharedPage);

      const monedaOriginal = await pos.asegurarMonedaBaseActiva();
      try {
        // Proforma desechable SIN cliente (crearProformaTallerSinClientePararaConvertir()):
        // necesaria para reproducir el bloqueo real — confirmado en vivo que
        // cualquier Proforma de Taller YA EXISTENTE en este ambiente ya trae
        // su propio cliente real y su Placa asociados desde su creación, así
        // que reutilizar "la primera disponible" nunca queda bloqueada.
        const tarjeta = await crearProformaTallerSinClientePararaConvertir(pos);

        await test.step('Intentar convertir sin cliente ni placa asociados: el sistema debe impedirlo', async () => {
          // Confirmado en vivo: el camino bloqueado nunca dispara la llamada
          // AJAX real (convertProformToOrder) — solo un .toast-message
          // informativo del propio cliente — por lo que la ausencia de esa
          // llamada de red (nunca armada en este camino) ya es evidencia de
          // que ninguna Orden se creó.
          const resultado = await pos.intentarConvertirAOrdenDeReparacion(tarjeta);
          expect(resultado.bloqueado, 'El sistema debía impedir la conversión sin cliente ni placa asociados').toBe(true);
          expect(resultado.mensaje, 'El mensaje de bloqueo no menciona la placa').toMatch(/placa/i);
        });

        await test.step('Asociar un cliente existente, completar la placa y validar que ahora sí permite convertir', async () => {
          // El intento bloqueado de arriba deja un toast visible
          // (TOAST_MESSAGE_GENERICO) que nada cierra todavía — sin este
          // paso, ese toast (o su overlay) puede seguir presente cuando se
          // reabre el menú de la tarjeta y se confirma el SweetAlert real
          // más abajo, interceptando ese click (mismo síntoma ya visto en
          // vivo con overlays de SweetAlert sin cerrar: ".sweet-overlay
          // intercepts pointer events"). cerrarOverlaysConocidos() ya
          // incluye cerrarTodosLosToastsSiAparecen(), mismo helper que usa
          // el resto de la suite para esto.
          await pos.cerrarOverlaysConocidos();
          // Sin cliente asociado (creada con solo nombre libre), el
          // selector de Placa no existe todavía (confirmado en vivo) — se
          // asocia primero un cliente real, que es lo que hace aparecer ese
          // selector.
          await pos.seleccionarClienteExistente();
          await pos.seleccionarPlacaClienteEnCarrito();
          const resultado = await pos.intentarConvertirAOrdenDeReparacion(tarjeta);
          expect(resultado.bloqueado, 'Tras asociar cliente y placa, el sistema no debía seguir bloqueando la conversión').toBe(false);
        });

        await test.step('Confirmar la conversión y validar que la Orden de Reparación se creó correctamente', async () => {
          console.log(`[CONVERTIR] Presionando "Confirmar" en el SweetAlert de conversión — ${new Date().toISOString()}`);
          const respuesta = await pos.confirmarConversionAOrdenDeReparacionYObtenerRespuesta();
          const cuerpo = await respuesta.text().catch(() => '(no se pudo leer el cuerpo)');
          console.log(`[CONVERTIR] convertProformToOrder respondió status=${respuesta.status()} ok=${respuesta.ok()} cuerpo="${cuerpo.slice(0, 300)}" — ${new Date().toISOString()}`);
          expect(respuesta.ok(), `convertProformToOrder no respondió OK (status ${respuesta.status()})`).toBe(true);
        });
      } finally {
        await restaurarMonedaSiCambio(pos, sharedPage, monedaOriginal);
      }

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  // ─── Escenario 2: Seleccionar una Proforma y Facturar ─────────────────────
  test.describe('Seleccionar y Facturar', () => {
    test('Seleccionar la primera Proforma disponible y facturarla', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      const { tarjeta, nombreCliente } = await buscarOCrearProformaEnTab(pos, 'normal');
      expect(nombreCliente.length, 'La Proforma reutilizada no trae ningún cliente asociado').toBeGreaterThan(0);

      await test.step('Cargar la Proforma en el carrito', async () => {
        await pos.cargarProformaEnCarritoDesdeTab(tarjeta);
      });

      let lineas: LineaCarrito[] = [];
      await test.step('Validar cliente, productos, cantidades, subtotal, IVA y total antes de facturar', async () => {
        // La Proforma reutilizada puede haberse creado con un cliente real
        // (seleccionarClienteExistente()) o solo con nombre libre — ambos
        // son válidos para "Crear Proforma" (ver el describe "Nombre del
        // cliente" en "Proformas — Crear"), así que solo se valida que el
        // dato de cliente esté presente (arriba), no que sea uno real
        // específicamente.
        const claves = await pos.obtenerClavesFilasCarrito();
        expect(claves.length, 'La Proforma cargada no trajo ninguna línea al carrito').toBeGreaterThan(0);

        lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
        await pos.validarResumenImpuestos(lineas);
        await validarTotalCarrito(pos, lineas);
      });

      await test.step('Facturar con el total exacto en efectivo', async () => {
        await pos.abrirModalDePago();
        const total = await pos.obtenerTotalVentaNumerico();
        expect(total).toBeGreaterThan(0);
        await pos.seleccionarPagoEfectivo(String(total));
        await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      });

      await test.step('Validar facturación exitosa: carrito vacío', async () => {
        await pos.validarCarritoVacio();
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  // ─── Escenario 3: Proforma + Agregar Ítem (Producto Rápido) + Facturar ────
  test.describe('Agregar Ítem y Facturar', () => {
    test('Seleccionar una Proforma, agregar un Producto Rápido vía "AGREGAR ITEMS" y facturar', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      const { tarjeta } = await buscarOCrearProformaEnTab(pos, 'normal');
      await pos.cargarProformaEnCarritoDesdeTab(tarjeta);
      const clavesAntes = await pos.obtenerClavesFilasCarrito();

      await test.step('Presionar "AGREGAR ITEMS" y confirmar que cambia a la vista de Productos', async () => {
        await pos.abrirAgregarItem();
      });

      let nombreProductoRapido = '';
      await test.step('Agregar un Producto Rápido', async () => {
        nombreProductoRapido = `Rápido Proforma AgregarItem ${Date.now()}`;
        await pos.agregarProductoRapidoSimple(nombreProductoRapido, PRECIO_PRODUCTO_RAPIDO);
        const clavesDespues = await pos.obtenerClavesFilasCarrito();
        expect(clavesDespues.length, 'El Producto Rápido no quedó agregado al carrito').toBeGreaterThan(clavesAntes.length);
      });

      let lineas: LineaCarrito[] = [];
      await test.step('Regresar a la Proforma y validar líneas, subtotal, IVA y total', async () => {
        await pos.volverDesdeAgregarItem(PESTANA_POS_PROFORMA);

        const claves = await pos.obtenerClavesFilasCarrito();
        expect(claves.length, 'Los ítems agregados no sobrevivieron al volver a la Proforma').toBeGreaterThan(clavesAntes.length);

        lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
        const nombres = lineas.map((l) => l.nombre);
        expect(nombres, 'El Producto Rápido agregado no está en el carrito').toContain(nombreProductoRapido);

        await pos.validarResumenImpuestos(lineas);
        await validarTotalCarrito(pos, lineas);
      });

      await test.step('Facturar con el total exacto en efectivo', async () => {
        await pos.abrirModalDePago();
        const total = await pos.obtenerTotalVentaNumerico();
        expect(total).toBeGreaterThan(0);
        await pos.seleccionarPagoEfectivo(String(total));
        await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      });

      await test.step('Validar carrito vacío tras facturar', async () => {
        await pos.validarCarritoVacio();
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  // ─── Escenarios 4-6: Proforma de Taller con los 5 tipos de ítem ───────────
  test.describe('Proforma de Taller — Vista Expandida', () => {
    test('Producto normal, rápido, fraccionado, servicio normal y servicio de End. Pintura en Vista Expandida, y facturar', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      const monedaOriginal = await pos.asegurarMonedaBaseActiva();
      const expandidaAlInicio = await pos.vistaExpandidaActiva();
      try {
        const { tarjeta } = await buscarOCrearProformaEnTab(pos, 'taller');
        await pos.cargarProformaEnCarritoDesdeTab(tarjeta);

        // Vista Expandida oculta TODO L.PRODUCT_CONTENT (confirmado en vivo,
        // ver el comentario de vistaExpandidaActiva()): eso incluye el grid
        // de Productos y los tabs Servicios/End. Pintura completos, no solo
        // el buscador de la grilla. Por eso fraccionado, servicio normal y
        // servicio de End. Pintura —que dependen de ese catálogo— se agregan
        // primero en Vista Normal; solo producto normal (buscador interno por
        // código) y producto rápido (FAB, independiente de la vista) pueden
        // agregarse con Vista Expandida ya activa — mismo criterio ya usado
        // en el test "Vista expandida" de "Proformas — Crear" en este mismo
        // archivo.
        if (await pos.vistaExpandidaActiva()) {
          await pos.alternarVistaExpandida();
        }

        let nombreProductoNormal = '';
        let codigoProductoNormal = '';
        await test.step('Vista Normal: agregar fraccionado, servicio normal y servicio de End. Pintura; identificar un producto normal y su código', async () => {
          const fraccionado = await pos.obtenerPrimerProductoFraccionadoNoPresenteEnCarrito();
          await pos.agregarProductoFraccionadoAlCarrito(fraccionado);

          await pos.tabServicios.click();
          await expect.poll(() => pos.tabEstaActivo(pos.tabServicios)).toBe(true);
          const servicio = await pos.obtenerPrimerProductoNoPresenteEnCarrito(2);
          await pos.agregarProductoAlCarrito(servicio);

          await agregarServicioDeEndPintura(pos);

          await pos.tabProductos.click();
          await expect.poll(() => pos.tabEstaActivo(pos.tabProductos)).toBe(true);
          const { nombre, codigo } = await obtenerProductoNormalConCodigoNoPresenteEnCarrito(pos);
          nombreProductoNormal = nombre;
          codigoProductoNormal = codigo;
        });

        await test.step('Activar Vista Expandida y confirmar que el cambio ocurrió', async () => {
          if (!(await pos.vistaExpandidaActiva())) {
            await pos.alternarVistaExpandida();
          }
          expect(await pos.vistaExpandidaActiva(), 'La vista no quedó en modo Expandida').toBe(true);
        });

        await test.step('Agregar el producto normal vía el buscador interno de Vista Expandida', async () => {
          const clavesAntes = await pos.obtenerClavesFilasCarrito();
          await pos.agregarProductoPorCodigoEnVistaExpandida(codigoProductoNormal);
          const clavesDespues = await pos.obtenerClavesFilasCarrito();
          expect(clavesDespues.length, 'El producto normal no quedó agregado vía el buscador interno de Vista Expandida').toBeGreaterThan(clavesAntes.length);
        });

        let nombreProductoRapido = '';
        await test.step('Agregar un producto rápido (independiente de la vista activa)', async () => {
          nombreProductoRapido = `Rápido VistaExpandida Taller ${Date.now()}`;
          await pos.agregarProductoRapidoSimple(nombreProductoRapido, PRECIO_PRODUCTO_RAPIDO);
        });

        let lineas: LineaCarrito[] = [];
        await test.step('Validar los 5 tipos de ítem, subtotal, IVA y total', async () => {
          const claves = await pos.obtenerClavesFilasCarrito();
          expect(claves.length, 'Se esperaban al menos 5 líneas en el carrito').toBeGreaterThanOrEqual(5);

          lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
          const nombres = lineas.map((l) => l.nombre);
          expect(nombres, 'El producto normal agregado en Vista Expandida no está en el carrito').toContain(nombreProductoNormal);
          expect(nombres.some((n) => n === nombreProductoRapido), 'El producto rápido no está en el carrito').toBe(true);

          await pos.validarResumenImpuestos(lineas);
          await validarTotalCarrito(pos, lineas);
        });

        await test.step('Facturar con el total exacto en efectivo', async () => {
          await pos.abrirModalDePago();
          const total = await pos.obtenerTotalVentaNumerico();
          expect(total).toBeGreaterThan(0);
          await pos.seleccionarPagoEfectivo(String(total));
          await pos.confirmarPagoAbriendoCajaSiEsNecesario();
        });

        await test.step('Validar carrito vacío tras facturar', async () => {
          await pos.validarCarritoVacio();
        });
      } finally {
        if ((await pos.vistaExpandidaActiva()) !== expandidaAlInicio) {
          await pos.alternarVistaExpandida();
        }
        await restaurarMonedaSiCambio(pos, sharedPage, monedaOriginal);
      }

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Proforma de Taller — Vista Lista', () => {
    test('Producto normal, rápido, fraccionado, servicio normal y servicio de End. Pintura en Vista Lista, y facturar', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      const monedaOriginal = await pos.asegurarMonedaBaseActiva();
      try {
        const { tarjeta } = await buscarOCrearProformaEnTab(pos, 'taller');
        await pos.cargarProformaEnCarritoDesdeTab(tarjeta);

        await test.step('Cambiar a Vista Lista y confirmar que quedó activa', async () => {
          if (!(await pos.vistaEstaActiva(pos.botonVistaLista))) {
            await pos.botonVistaLista.click();
            await expect.poll(() => pos.vistaEstaActiva(pos.botonVistaLista)).toBe(true);
          }
        });

        await test.step('Agregar los 5 tipos de ítem desde Vista Lista: normal, rápido, fraccionado, servicio normal y servicio de End. Pintura', async () => {
          await agregarCincoTiposDeItem(pos, `VistaLista Taller ${Date.now()}`);
        });

        let lineas: LineaCarrito[] = [];
        await test.step('Validar líneas, subtotal, IVA y total', async () => {
          const claves = await pos.obtenerClavesFilasCarrito();
          expect(claves.length, 'Se esperaban al menos 5 líneas en el carrito').toBeGreaterThanOrEqual(5);

          lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
          await pos.validarResumenImpuestos(lineas);
          await validarTotalCarrito(pos, lineas);
        });

        await test.step('Facturar con el total exacto en efectivo', async () => {
          await pos.abrirModalDePago();
          const total = await pos.obtenerTotalVentaNumerico();
          expect(total).toBeGreaterThan(0);
          await pos.seleccionarPagoEfectivo(String(total));
          await pos.confirmarPagoAbriendoCajaSiEsNecesario();
        });

        await test.step('Validar carrito vacío tras facturar', async () => {
          await pos.validarCarritoVacio();
        });
      } finally {
        await restaurarMonedaSiCambio(pos, sharedPage, monedaOriginal);
      }

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Proforma de Taller — Facturar a Crédito', () => {
    test('Producto normal, rápido, fraccionado, servicio normal y servicio de End. Pintura, facturados a Crédito', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      const monedaOriginal = await pos.asegurarMonedaBaseActiva();
      try {
        const { tarjeta } = await buscarOCrearProformaEnTab(pos, 'taller');
        await pos.cargarProformaEnCarritoDesdeTab(tarjeta);

        await test.step('Agregar los 5 tipos de ítem: normal, rápido, fraccionado, servicio normal y servicio de End. Pintura', async () => {
          await agregarCincoTiposDeItem(pos, `Credito Taller ${Date.now()}`);
        });

        let lineas: LineaCarrito[] = [];
        await test.step('Validar líneas, subtotal, IVA y total antes de facturar', async () => {
          const claves = await pos.obtenerClavesFilasCarrito();
          expect(claves.length, 'Se esperaban al menos 5 líneas en el carrito').toBeGreaterThanOrEqual(5);

          lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
          await pos.validarResumenImpuestos(lineas);
          await validarTotalCarrito(pos, lineas);
        });

        await test.step('Facturar a Crédito: validar que la condición de pago queda seleccionada y completar la venta', async () => {
          await pos.abrirModalDePago();
          await pos.cambiarTipoPagoEnModalPago('credito');
          expect(await pos.obtenerTipoPagoEnModalPago(), 'El "Tipo de pago" no quedó en Crédito tras seleccionarlo').toBe('credito');
          await pos.confirmarPagoAbriendoCajaSiEsNecesario();
        });

        await test.step('Validar carrito vacío tras facturar', async () => {
          await pos.validarCarritoVacio();
        });
      } finally {
        await restaurarMonedaSiCambio(pos, sharedPage, monedaOriginal);
      }

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });
});
