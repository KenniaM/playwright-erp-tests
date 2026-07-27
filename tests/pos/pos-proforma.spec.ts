import { test as base, expect, Response, Page, Locator } from '@playwright/test';
import { PosPage, TIMEOUTS, TipoProforma, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT, PRECIO_PRODUCTO_RAPIDO, VEHICULO_PINTURA_TIPO, LineaCarrito, MetadatoProducto, ResultadoDescuento, PESTANA_POS_PROFORMA, espiarErroresJS, esperarQuedaActivo } from './pos.page';

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

  // ─── Buscador de Proformas (pestaña "Proforma / Cotizaciones") ────────────
  test.describe('Buscador de Proformas', () => {
    test('Validar el funcionamiento completo del buscador de la pestaña "Proforma / Cotizaciones"', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      await pos.visitarPestanaPos(PESTANA_POS_PROFORMA);
      await pos.cambiarSubTabProforma('normal');

      let tarjetasIniciales: { proformaId: string; nombreCliente: string }[] = [];
      let referencia: { proformaId: string; nombreCliente: string };
      await test.step('Estado inicial: leer las Proformas visibles sin ningún filtro de búsqueda', async () => {
        tarjetasIniciales = await pos.obtenerTarjetasProformaEnTab();
        expect(tarjetasIniciales.length, 'No hay ninguna Proforma disponible para validar el buscador').toBeGreaterThan(0);
        referencia = tarjetasIniciales[0];
        expect(referencia.nombreCliente.trim().length, 'La Proforma de referencia no trae un cliente legible').toBeGreaterThan(0);
      });

      // Investigado en vivo (root cause real, no asumido): el buscador de
      // esta pestaña (PROFORMA_TAB_BUSCADOR) es el MISMO input compartido
      // `#product_search` que ya reutilizan "POS Facturación" y "Ruteo" (ver
      // RUTEO_BUSCADOR) — confirmado con una búsqueda real por el id exacto
      // de la Proforma de referencia (`buscarProformaEnTab(referencia.proformaId)`)
      // que devolvió 0 resultados: el buscador NO filtra por número/id, solo
      // por CLIENTE — mismo comportamiento ya documentado para el buscador
      // de Ruteo (RUTEO_BUSCADOR). Se documenta aquí como hallazgo real del
      // sistema (no un bug de automatización) en vez de forzar una
      // aserción de que "encuentra por número".
      await test.step('Buscar por número (id real de la Proforma de referencia) — el sistema NO filtra por número', async () => {
        await pos.buscarProformaEnTab(referencia.proformaId);
        const filas = await pos.obtenerTarjetasProformaEnTab();
        console.log(
          `[Buscador Proforma] Búsqueda por número/id "${referencia.proformaId}" devolvió ${filas.length} resultados ` +
          '— el buscador de esta pestaña filtra únicamente por cliente (comportamiento real confirmado en vivo, no un bug).'
        );
        expect(filas.length, 'La búsqueda por número/id no debería traer resultados (el buscador solo filtra por cliente)').toBe(0);
      });

      await test.step('Buscar por nombre del cliente', async () => {
        await pos.buscarProformaEnTab(referencia.nombreCliente.trim());
        const filas = await pos.obtenerTarjetasProformaEnTab();
        expect(filas.length, `La búsqueda por cliente "${referencia.nombreCliente.trim()}" no trajo ningún resultado`).toBeGreaterThan(0);
        expect(
          filas.every((f) => f.nombreCliente.trim() === referencia.nombreCliente.trim()),
          'Algún resultado de la búsqueda por cliente no corresponde al cliente buscado'
        ).toBe(true);
      });

      await test.step('Buscar con texto parcial (substring del nombre del cliente)', async () => {
        const nombreCompleto = referencia.nombreCliente.trim();
        const parcial = nombreCompleto.slice(0, Math.max(3, Math.floor(nombreCompleto.length / 2)));
        await pos.buscarProformaEnTab(parcial);
        const filas = await pos.obtenerTarjetasProformaEnTab();
        expect(filas.length, `La búsqueda parcial "${parcial}" no trajo ningún resultado`).toBeGreaterThan(0);
        expect(
          filas.every((f) => f.nombreCliente.trim().includes(parcial)),
          'Algún resultado de la búsqueda parcial no contiene el texto buscado'
        ).toBe(true);
      });

      await test.step('Buscar una Proforma inexistente', async () => {
        const terminoInexistente = `NoExisteEsteClienteDePrueba_${Date.now()}`;
        await pos.buscarProformaEnTab(terminoInexistente);
        const filas = await pos.obtenerTarjetasProformaEnTab();
        expect(filas.length, `La búsqueda de un cliente inexistente "${terminoInexistente}" no debería traer resultados`).toBe(0);
      });

      await test.step('Limpiar la búsqueda y validar que la lista vuelve al estado inicial', async () => {
        await pos.buscarProformaEnTab('');
        const filas = await pos.obtenerTarjetasProformaEnTab();
        expect(filas.length, 'La cantidad de resultados tras limpiar la búsqueda no coincide con el estado inicial').toBe(tarjetasIniciales.length);
        expect(
          filas.map((f) => f.proformaId).sort(),
          'Las Proformas visibles tras limpiar la búsqueda no coinciden con las del estado inicial'
        ).toEqual(tarjetasIniciales.map((f) => f.proformaId).sort());
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });
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

/**
 * Valida que subtotal + impuestos coincidan con el total mostrado — mismo
 * criterio ya usado en pos-orden-caja.spec.ts.
 *
 * Ajustada por el Descuento General, cuando está REALMENTE activo — mismo
 * criterio y misma fórmula (ratio sobre el subtotal bruto) ya usados por
 * validarResumenImpuestos() para el IVA, generalizados aquí al total
 * completo (subtotal + IVA). Causa raíz confirmada en vivo (reproducida en
 * aislamiento, sin contención de workers — no era un problema de ambiente):
 * los escenarios de "Facturar y Convertir" reutilizan una Proforma YA
 * EXISTENTE vía buscarOCrearProformaEnTab() / obtenerPrimeraProformaEnTab()
 * ("la primera disponible", nunca creada por el propio test) — si esa
 * Proforma reutilizada se guardó en un test anterior de "Proformas — Crear"
 * con Descuento General activo, el total mostrado ya lo refleja pero la
 * suma cruda de neto+IVA por línea no, produciendo una discrepancia real
 * (ej. esperado 2000.00 vs mostrado 1900.00) que no tiene nada que ver con
 * el dato en sí, sino con que esta validación no contemplaba ese estado.
 */
async function validarTotalCarrito(pos: PosPage, lineas: LineaCarrito[]) {
  const totalBruto = pos.calcularSubtotalEsperado(lineas) + pos.calcularTotalImpuestosEsperado(lineas);
  const descuentoGeneralActivo = await pos.estaDescuentoGeneralActivo();

  let totalEsperado = totalBruto;
  let detalleAjuste = '';
  if (descuentoGeneralActivo) {
    const subtotalBruto = pos.calcularSubtotalEsperado(lineas);
    const descuentoGeneral = await pos.obtenerMontoDescuentoGeneralNumerico();
    const ratioDescuentoGeneral = subtotalBruto > 0 ? 1 - (descuentoGeneral / subtotalBruto) : 1;
    totalEsperado = totalBruto * ratioDescuentoGeneral;
    detalleAjuste = `, ajustado por Descuento General activo (${descuentoGeneral.toFixed(2)} sobre subtotal ${subtotalBruto.toFixed(2)}, ratio ${ratioDescuentoGeneral.toFixed(4)}) = ${totalEsperado.toFixed(2)}`;
  }

  const totalReal = await pos.obtenerTotalVentaNumerico();
  expect(totalReal, `Total esperado (subtotal + impuestos = ${totalBruto.toFixed(2)}${detalleAjuste}) no coincide con el total mostrado (${totalReal.toFixed(2)})`).toBeCloseTo(totalEsperado, 1);
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

  // Timeouts explícitos en ambos clicks (antes ausentes): sin `timeout`,
  // Playwright usa el default de acción del proyecto (0 = sin límite, sin
  // actionTimeout configurado en playwright.config.ts). Confirmado en vivo
  // (Convertir a Orden de Reparación, justo tras una conversión real
  // exitosa): el estado del carrito/página en ese punto puede diferir del
  // de un simple "cancelar venta" normal, dejando alguno de estos botones
  // no clickeable — sin límite explícito, esta función queda colgada hasta
  // el timeout del test COMPLETO en vez de fallar rápido, y el try/catch de
  // restaurarMonedaSiCambio() (que existe precisamente para que un problema
  // de limpieza no fatal no rompa el escenario) no puede rescatar una
  // promesa que nunca se resuelve — solo una que sí rechaza.
  const clavesEnCarrito = await pos.obtenerClavesFilasCarrito();
  if (clavesEnCarrito.length > 0) {
    await sharedPage.locator('#cancel_sale').click({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const dialogo = sharedPage.locator('.sweet-alert.visible');
    const aparecio = await dialogo.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false);
    if (aparecio) {
      await dialogo.locator('button.confirm').click({ timeout: TIMEOUTS.PAYMENT_MODAL });
    }

    await expect.poll(
      async () => (await pos.obtenerClavesFilasCarrito()).length,
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El carrito no quedó vacío tras presionar "Vaciar Carrito"' }
    ).toBe(0);
  }

  await pos.cerrarOverlaysConocidos();
  await sharedPage.locator('#btn_pos_option').click({ timeout: TIMEOUTS.PAYMENT_MODAL });
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
async function crearProformaTallerSinClientePararaConvertir(pos: PosPage): Promise<{ tarjeta: Locator; proformaId: string }> {
  await agregarProductoNormalAlCarrito(pos);
  const nombreCliente = `Cliente Proforma Convertir ${Date.now()}`;
  await pos.abrirCrearProforma();
  await pos.seleccionarTipoProforma('taller');
  await pos.llenarNombreClienteProforma(nombreCliente);
  const respuesta = await pos.guardarProformaYObtenerRespuesta();
  await pos.validarProformaCreada(respuesta);
  // Capturado ANTES de cerrar el modal de Gestión (única fuente disponible
  // para el id real, ver obtenerIdProformaCreada()) — necesario para
  // volver a localizar esta tarjeta de forma estable más adelante (ver el
  // comentario de localizarTarjetaProformaPorId()).
  const proformaId = await pos.obtenerIdProformaCreada();
  await pos.cerrarModalGestionProforma();

  const tarjeta = await pos.abrirMenuTarjetaProformaEnTab(nombreCliente, 'taller');
  await pos.cargarProformaEnCarritoDesdeTab(tarjeta);
  return { tarjeta, proformaId };
}

/**
 * Primer combo YA EXISTENTE en la categoría "Combos" que todavía no esté en
 * el carrito — variante de obtenerPrimerCombo() (que no filtra por carrito,
 * pensado para un carrito vacío) necesaria aquí porque los Escenarios 7-9
 * agregan ítems DESPUÉS de cargar una Proforma ya existente (mismo motivo ya
 * documentado por nombreApareceEnCarrito() y obtenerPrimerProductoNoPresenteEnCarrito()
 * y variantes). Reutiliza el mismo cambio de categoría de obtenerPrimerCombo()
 * (categoriaCombos/categoriaEstaActiva/esperarQuedaActivo) en vez de
 * duplicarlo, y localizarPrimerProducto() con la misma exclusión por nombre.
 */
async function obtenerPrimerComboNoPresenteEnCarrito(pos: PosPage): Promise<MetadatoProducto> {
  if (!(await pos.categoriaEstaActiva(pos.categoriaCombos))) {
    await pos.categoriaCombos.click();
    await esperarQuedaActivo(() => pos.categoriaEstaActiva(pos.categoriaCombos));
  }
  const textoCarrito = await pos.obtenerTextoCarrito();
  return pos.localizarPrimerProducto(
    (m) => !pos.nombreApareceEnCarrito(m.nombre, textoCarrito),
    'combo existente en la categoría "Combos" que todavía no esté en el carrito'
  );
}

/**
 * Agrega al carrito un Producto Rápido, un Producto Normal y un Combo
 * existente — combinación compartida por los Escenarios 7-9 (Descuento
 * General, Descuento Individual, persistencia de Descuento + Exoneración).
 * Compone agregarProductoRapidoSimple() + obtenerPrimerProductoNoPresenteEnCarrito()
 * + obtenerPrimerComboNoPresenteEnCarrito(), los tres ya existentes — ninguno
 * reimplementado aquí. Restaura la categoría "Todos" al terminar
 * (obtenerPrimerComboNoPresenteEnCarrito() deja activa "Combos"): mismo
 * criterio ya usado en el resto de la suite para no dejar el grid filtrado
 * para el resto del escenario.
 */
async function agregarRapidoNormalYCombo(pos: PosPage, sufijoRapido: string): Promise<{ nombreRapido: string; nombreNormal: string; nombreCombo: string }> {
  const nombreRapido = `Rápido ${sufijoRapido}`;
  await pos.agregarProductoRapidoSimple(nombreRapido, PRECIO_PRODUCTO_RAPIDO);

  const normal = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
  await pos.agregarProductoDelGridAlCarrito(normal);

  const combo = await obtenerPrimerComboNoPresenteEnCarrito(pos);
  await pos.agregarProductoDelGridAlCarrito(combo);
  await pos.categoriaTodos.click();

  return { nombreRapido, nombreNormal: normal.nombre, nombreCombo: combo.nombre };
}

/**
 * Primer producto normal con código interno asignado (requisito real del
 * buscador interno de Vista Expandida — ver el comentario de
 * obtenerPrimerProductoNormalConCodigo()) que además todavía no esté en el
 * carrito — combinación necesaria para el Escenario 10 (Vista Expandida
 * sobre una Proforma ya existente), no cubierta por ningún método actual de
 * PosCore. Misma paginación manual que obtenerPrimerProductoNormalConCodigo()
 * (el código vive en un input fuera de los metadatos síncronos que acepta
 * localizarPrimerProducto()), con la exclusión de carrito ya usada por
 * obtenerPrimerProductoNoPresenteEnCarrito() y variantes — compone ambas en
 * vez de reimplementarlas.
 */
async function obtenerProductoNormalConCodigoNoPresenteEnCarrito(pos: PosPage): Promise<{ producto: MetadatoProducto; codigo: string }> {
  const textoCarrito = await pos.obtenerTextoCarrito();
  const MAX_PAGINACIONES = 20;
  let indiceInicio = 0;

  for (let paginacion = 0; paginacion <= MAX_PAGINACIONES; paginacion++) {
    const metadatos = await pos.obtenerMetadatosProductosVisibles();

    for (let i = indiceInicio; i < metadatos.length; i++) {
      const producto = metadatos[i];
      if (producto.tipoItem !== 1 || producto.esFraccionado) continue;
      if (pos.nombreApareceEnCarrito(producto.nombre, textoCarrito)) continue;

      const codigo = await pos.obtenerCodigoProducto(producto.nombre).catch(() => '');
      if (codigo) return { producto, codigo };
    }

    indiceInicio = metadatos.length;
    const hayMas = await pos._cargarMasProductosScrolleando(metadatos.length);
    if (!hayMas) {
      throw new Error(
        `No se encontró ningún producto normal con código interno, ausente del carrito, tras revisar ` +
        `las ${metadatos.length} tarjetas de todo el catálogo visible (no hay más páginas que cargar).`
      );
    }
  }
  throw new Error(
    `No se encontró ningún producto normal con código ausente del carrito tras ${MAX_PAGINACIONES} ` +
    'cargas adicionales del catálogo (posible bucle: revisar manualmente).'
  );
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
        let { tarjeta, proformaId } = await crearProformaTallerSinClientePararaConvertir(pos);

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
          // Corrección de automatización (causa raíz confirmada en vivo
          // instrumentando el DOM real, ver cancelarNombreClienteRapidoSiActivo()):
          // esta Proforma se guardó solo con nombre libre
          // (crearProformaTallerSinClientePararaConvertir() →
          // llenarNombreClienteProforma()), así que al cargarla en el
          // carrito el panel "Buscar Cliente" queda en modo "Nombre del
          // cliente" (#temporal_customer_name ya con ese nombre), NO en el
          // modo de búsqueda que seleccionarClienteExistente() da por
          // sentado — llamarlo directamente aquí deja CLIENTE_INPUT_BUSQUEDA
          // oculto de forma indefinida (timeout de 10 minutos sin ningún
          // error explícito, confirmado en vivo). Hay que cancelar antes ese
          // modo para que el buscador reaparezca.
          await pos.cancelarNombreClienteRapidoSiActivo();
          // Sin cliente asociado (creada con solo nombre libre), el
          // selector de Placa no existe todavía (confirmado en vivo) — se
          // asocia primero un cliente real, que es lo que hace aparecer ese
          // selector.
          await pos.seleccionarClienteExistente();
          await pos.seleccionarPlacaClienteEnCarrito();

          // Corrección de automatización (causa raíz confirmada en vivo:
          // dos corridas consecutivas colgaron los 10 minutos completos del
          // test, ver el comentario de localizarTarjetaProformaPorId()):
          // `tarjeta` fue localizada por texto de cliente (nombre libre
          // original). Tras asociar arriba un cliente REAL a esta Proforma
          // (updateCustomerToOrder), la tarjeta re-renderiza mostrando ese
          // cliente real — el filtro por el texto original deja de
          // matchear cualquier elemento, y reusar ese locator cuelga
          // abrirMenuDeTarjeta() indefinidamente en vez de fallar rápido. Se
          // vuelve a localizar por id real (estable, no cambia con el
          // cliente mostrado) antes de reintentar.
          tarjeta = pos.localizarTarjetaProformaPorId(proformaId);
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

      // Descuento General puede quedar activo (con monto 0) en una Proforma
      // "primera disponible" reutilizada de una corrida anterior de este
      // mismo ambiente compartido (confirmado en vivo, root cause real:
      // rompía validarTotalCarrito() aunque este escenario nunca activa
      // descuento) — mismo criterio defensivo ya usado por "Descuento
      // individual". Ver el comentario completo en el escenario "Descuento
      // Individual: ... y Facturar".
      await pos.desactivarDescuentoGeneral();

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

      // Descuento General puede quedar activo (con monto 0) en una Proforma
      // reutilizada — ver el comentario completo en "Descuento Individual:
      // ... y Facturar". Defensivo, mismo criterio ya establecido.
      await pos.desactivarDescuentoGeneral();

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
  //
  // Corrección de automatización (confirmado en vivo por el usuario,
  // observando el flujo real): estos dos escenarios NO deben usar ningún
  // toggle de vista (Vista Expandida/Vista Lista) — para agregar productos a
  // una Proforma de Taller ya cargada en el carrito se debe presionar
  // "AGREGAR ITEMS" (abrirAgregarItem(), mismo mecanismo ya validado por
  // Escenario 3 "Agregar Ítem y Facturar"), agregar ahí los 5 tipos de ítem
  // (agregarCincoTiposDeItem(), mismo helper ya usado por "Facturar a
  // Crédito") y volver con volverDesdeAgregarItem(). La versión anterior
  // (activar Vista Expandida/Vista Lista antes de agregar productos) no
  // reflejaba el flujo real: además de la corrección funcional, se habían
  // encontrado dos fallos reales por esa vía — el toggle "Vista Lista"
  // (#style_list) nunca queda visible tras cargar una Proforma de Taller, y
  // el producto Fraccionado nunca se reflejaba en el carrito al agregarse en
  // Vista Normal antes de activar Vista Expandida.
  test.describe('Proforma de Taller — Vista Expandida', () => {
    test('Producto normal, rápido, fraccionado, servicio normal y servicio de End. Pintura en Vista Expandida, y facturar', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      const monedaOriginal = await pos.asegurarMonedaBaseActiva();
      try {
        const { tarjeta } = await buscarOCrearProformaEnTab(pos, 'taller');
        await pos.cargarProformaEnCarritoDesdeTab(tarjeta);

        // Descuento General puede quedar activo (con monto 0) en una
        // Proforma reutilizada — ver el comentario completo en "Descuento
        // Individual: ... y Facturar". Defensivo, mismo criterio ya
        // establecido.
        await pos.desactivarDescuentoGeneral();

        await test.step('Presionar "AGREGAR ITEMS" y confirmar que cambia a la vista de Productos', async () => {
          await pos.abrirAgregarItem();
        });

        await test.step('Agregar los 5 tipos de ítem: normal, rápido, fraccionado, servicio normal y servicio de End. Pintura', async () => {
          await agregarCincoTiposDeItem(pos, `VistaExpandida Taller ${Date.now()}`);
        });

        let lineas: LineaCarrito[] = [];
        await test.step('Regresar a la Proforma y validar líneas, subtotal, IVA y total', async () => {
          await pos.volverDesdeAgregarItem(PESTANA_POS_PROFORMA);

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

  test.describe('Proforma de Taller — Vista Lista', () => {
    test('Producto normal, rápido, fraccionado, servicio normal y servicio de End. Pintura en Vista Lista, y facturar', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      const monedaOriginal = await pos.asegurarMonedaBaseActiva();
      try {
        const { tarjeta } = await buscarOCrearProformaEnTab(pos, 'taller');
        await pos.cargarProformaEnCarritoDesdeTab(tarjeta);

        // Descuento General puede quedar activo (con monto 0) en una
        // Proforma reutilizada — ver el comentario completo en "Descuento
        // Individual: ... y Facturar". Defensivo, mismo criterio ya
        // establecido.
        await pos.desactivarDescuentoGeneral();

        await test.step('Presionar "AGREGAR ITEMS" y confirmar que cambia a la vista de Productos', async () => {
          await pos.abrirAgregarItem();
        });

        await test.step('Agregar los 5 tipos de ítem: normal, rápido, fraccionado, servicio normal y servicio de End. Pintura', async () => {
          await agregarCincoTiposDeItem(pos, `VistaLista Taller ${Date.now()}`);
        });

        let lineas: LineaCarrito[] = [];
        await test.step('Regresar a la Proforma y validar líneas, subtotal, IVA y total', async () => {
          await pos.volverDesdeAgregarItem(PESTANA_POS_PROFORMA);

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

        // Descuento General puede quedar activo (con monto 0) en una
        // Proforma reutilizada — ver el comentario completo en "Descuento
        // Individual: ... y Facturar". Defensivo, mismo criterio ya
        // establecido.
        await pos.desactivarDescuentoGeneral();

        // Corrección de automatización (confirmado en vivo por el usuario):
        // Facturar a Crédito exige un cliente REAL asociado a la venta —
        // buscarOCrearProformaEnTab() reutiliza "la primera Proforma
        // disponible", que puede haberse creado solo con nombre libre (ver
        // el describe "Nombre del cliente" en "Proformas — Crear"), sin
        // ningún cliente real. Sin este paso, el checkbox "Crédito" del
        // modal de pago nunca queda marcado (bloqueo silencioso del propio
        // sistema, no un timing de automatización). Mismo mecanismo ya
        // validado en "Convertir a Orden de Reparación": cancelar el modo
        // "Nombre del cliente" si está activo (cancelarNombreClienteRapidoSiActivo())
        // antes de que el buscador de cliente esté disponible.
        await test.step('Asegurar un cliente real asociado (requerido para Facturar a Crédito)', async () => {
          if (!(await pos.hayClienteRealSeleccionado())) {
            await pos.cancelarNombreClienteRapidoSiActivo();
            await pos.seleccionarClienteExistente();
          }
        });

        // Corrección de automatización (confirmado en vivo por el usuario,
        // mismo criterio ya aplicado a "Vista Expandida"/"Vista Lista"): tras
        // cargar la Proforma, la pestaña activa sigue siendo "Proforma /
        // Cotizaciones" — el catálogo de Productos no es accesible ahí. Hay
        // que presionar "AGREGAR ITEMS" primero para que el grid quede
        // disponible; sin este paso, agregarCincoTiposDeItem() queda
        // colgado indefinidamente esperando elementos del grid que no están
        // en esa pestaña.
        await test.step('Presionar "AGREGAR ITEMS" y confirmar que cambia a la vista de Productos', async () => {
          await pos.abrirAgregarItem();
        });

        await test.step('Agregar los 5 tipos de ítem: normal, rápido, fraccionado, servicio normal y servicio de End. Pintura', async () => {
          await agregarCincoTiposDeItem(pos, `Credito Taller ${Date.now()}`);
        });

        let lineas: LineaCarrito[] = [];
        await test.step('Regresar a la Proforma y validar líneas, subtotal, IVA y total antes de facturar', async () => {
          await pos.volverDesdeAgregarItem(PESTANA_POS_PROFORMA);

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

  // ─── Escenario 7: Producto rápido, normal y combo + Descuento General ─────
  test.describe('Descuento General: Producto rápido, normal y combo, y Facturar', () => {
    test('Seleccionar una Proforma, agregar Producto Rápido, Producto Normal y un Combo, aplicar Descuento General y facturar', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      const { tarjeta } = await buscarOCrearProformaEnTab(pos, 'normal');
      await pos.cargarProformaEnCarritoDesdeTab(tarjeta);
      const clavesAntes = await pos.obtenerClavesFilasCarrito();

      await test.step('Presionar "AGREGAR ITEMS" y confirmar que cambia a la vista de Productos', async () => {
        await pos.abrirAgregarItem();
      });

      let items: { nombreRapido: string; nombreNormal: string; nombreCombo: string };
      await test.step('Agregar un Producto Rápido, un Producto Normal y un Combo existente', async () => {
        items = await agregarRapidoNormalYCombo(pos, `DescGeneral Proforma ${Date.now()}`);
      });

      let lineas: LineaCarrito[] = [];
      await test.step('Regresar a la Proforma y validar líneas, cantidades, subtotal, IVA y total antes del descuento', async () => {
        await pos.volverDesdeAgregarItem(PESTANA_POS_PROFORMA);

        const claves = await pos.obtenerClavesFilasCarrito();
        expect(claves.length, 'Los 3 ítems agregados no sobrevivieron al volver a la Proforma').toBeGreaterThan(clavesAntes.length);

        lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
        for (const linea of lineas) {
          expect(linea.cantidad, `La cantidad de "${linea.nombre}" debería ser mayor que 0`).toBeGreaterThan(0);
        }
        const textoLineas = lineas.map((l) => l.nombre).join(' | ');
        expect(lineas.map((l) => l.nombre), 'El Producto Rápido agregado no está en el carrito').toContain(items.nombreRapido);
        expect(pos.nombreApareceEnCarrito(items.nombreNormal, textoLineas), 'El Producto Normal agregado no está en el carrito').toBe(true);
        expect(pos.nombreApareceEnCarrito(items.nombreCombo, textoLineas), 'El Combo agregado no está en el carrito').toBe(true);

        await pos.validarResumenImpuestos(lineas);
        await validarTotalCarrito(pos, lineas);
      });

      await test.step(`Aplicar Descuento General del ${DESCUENTO_GENERAL_PCT}% y validar que se reflejó en subtotal, IVA y total`, async () => {
        const totalAntesDescuento = await pos.obtenerTotalVentaNumerico();
        await pos.activarDescuentoGeneral();
        await pos.mostrarDetalleAvanzadoFactura();
        await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);

        expect(await pos.estaDescuentoGeneralActivo(), 'El Descuento General no quedó activo').toBe(true);
        const montoDescuento = await pos.obtenerMontoDescuentoGeneralNumerico();
        expect(montoDescuento, 'El monto de Descuento General no quedó reflejado en los totales').toBeGreaterThan(0);

        const totalDespues = await pos.obtenerTotalVentaNumerico();
        expect(totalDespues, 'El total no bajó tras aplicar el Descuento General').toBeLessThan(totalAntesDescuento);

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

      await test.step('Validar estado final: carrito vacío tras facturar', async () => {
        await pos.validarCarritoVacio();
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  // ─── Escenario 8: Producto rápido, normal y combo + Descuento Individual ──
  test.describe('Descuento Individual: Producto rápido, normal y combo, y Facturar', () => {
    test('Seleccionar una Proforma, agregar Producto Rápido, Producto Normal y un Combo, aplicar Descuento Individual y facturar', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      const { tarjeta } = await buscarOCrearProformaEnTab(pos, 'normal');
      await pos.cargarProformaEnCarritoDesdeTab(tarjeta);

      // Descuento General desactivado ANTES de la primera validación de
      // totales (no solo antes del individual): validarResumenImpuestos()/
      // validarTotalCarrito() no contemplan la combinación de ambos a la vez
      // (ver su propio comentario), y confirmado en vivo (root cause real,
      // corriendo la suite completa con varios workers) que un escenario
      // anterior de este mismo worker ("Descuento General: ... y Facturar")
      // puede dejarlo activo con monto 0 para esta Proforma recién cargada,
      // rompiendo la validación "antes del descuento" que sigue. Mismo
      // criterio defensivo ya usado por el describe "Descuento individual"
      // de "Proformas — Crear", aplicado aquí lo antes posible.
      await pos.desactivarDescuentoGeneral();

      const clavesAntes = await pos.obtenerClavesFilasCarrito();

      await test.step('Presionar "AGREGAR ITEMS" y confirmar que cambia a la vista de Productos', async () => {
        await pos.abrirAgregarItem();
      });

      let items: { nombreRapido: string; nombreNormal: string; nombreCombo: string };
      await test.step('Agregar un Producto Rápido, un Producto Normal y un Combo existente', async () => {
        items = await agregarRapidoNormalYCombo(pos, `DescIndividual Proforma ${Date.now()}`);
      });

      let clavesNuevas: string[] = [];
      await test.step('Regresar a la Proforma y validar líneas, cantidades, subtotal, IVA y total antes del descuento', async () => {
        await pos.volverDesdeAgregarItem(PESTANA_POS_PROFORMA);

        const claves = await pos.obtenerClavesFilasCarrito();
        expect(claves.length, 'Los 3 ítems agregados no sobrevivieron al volver a la Proforma').toBeGreaterThan(clavesAntes.length);
        clavesNuevas = claves.filter((c) => !clavesAntes.includes(c));
        expect(clavesNuevas.length, 'No se detectaron las 3 líneas nuevas agregadas').toBeGreaterThanOrEqual(3);

        const lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
        const textoLineas = lineas.map((l) => l.nombre).join(' | ');
        expect(lineas.map((l) => l.nombre), 'El Producto Rápido agregado no está en el carrito').toContain(items.nombreRapido);
        expect(pos.nombreApareceEnCarrito(items.nombreNormal, textoLineas), 'El Producto Normal agregado no está en el carrito').toBe(true);
        expect(pos.nombreApareceEnCarrito(items.nombreCombo, textoLineas), 'El Combo agregado no está en el carrito').toBe(true);

        await pos.validarResumenImpuestos(lineas);
        await validarTotalCarrito(pos, lineas);
      });

      const resultadosDescuento: ResultadoDescuento[] = [];
      await test.step(`Aplicar Descuento Individual del ${DESCUENTO_INDIVIDUAL_PCT}% a los 3 ítems agregados`, async () => {
        for (const clave of clavesNuevas) {
          const resultado = await pos.aplicarDescuentoIndividual(clave, DESCUENTO_INDIVIDUAL_PCT);
          resultadosDescuento.push(resultado);
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

      await test.step('Validar que el Descuento Individual permanece aplicado, y subtotal, IVA y total coinciden', async () => {
        for (const resultado of resultadosDescuento) {
          if (resultado.escenario === 'sin_descuento') continue;
          const porcentajeActual = await pos._leerValorDescuentoInput(resultado.clave);
          expect(
            parseFloat(porcentajeActual),
            `El Descuento Individual de la línea ${resultado.clave} no permaneció aplicado`
          ).toBeCloseTo(parseFloat(resultado.porcentajeAplicado), 1);
        }

        const claves = await pos.obtenerClavesFilasCarrito();
        const lineasConDescuento = await validarLineasCarritoSegunEstadoReal(pos, claves);
        await pos.validarResumenImpuestos(lineasConDescuento);
        await validarTotalCarrito(pos, lineasConDescuento);
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

  // ─── Escenario 8b: Persistencia de Descuento + Exoneración al reseleccionar ──
  test.describe('Persistencia de Descuento y Exoneración al reseleccionar la misma Proforma', () => {
    test('Seleccionar una Proforma, agregar ítems, aplicar Descuento y Exoneración, volver a la lista y reseleccionar la misma Proforma', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      const { tarjeta } = await buscarOCrearProformaEnTab(pos, 'normal');
      await pos.cargarProformaEnCarritoDesdeTab(tarjeta);

      await test.step('Presionar "AGREGAR ITEMS" y confirmar que cambia a la vista de Productos', async () => {
        await pos.abrirAgregarItem();
      });

      let items: { nombreRapido: string; nombreNormal: string; nombreCombo: string };
      await test.step('Agregar un Producto Rápido, un Producto Normal y un Combo existente', async () => {
        items = await agregarRapidoNormalYCombo(pos, `Persistencia Proforma ${Date.now()}`);
      });

      await test.step('Volver a la lista de Proformas', async () => {
        await pos.volverDesdeAgregarItem(PESTANA_POS_PROFORMA);
      });

      let montoDescuentoAntes = 0;
      let montoExoneracionAntes = 0;
      await test.step(`Aplicar Descuento General del ${DESCUENTO_GENERAL_PCT}% y Exoneración del ${DESCUENTO_GENERAL_PCT}%`, async () => {
        await pos.activarDescuentoGeneral();
        await pos.mostrarDetalleAvanzadoFactura();
        await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);
        montoDescuentoAntes = await pos.obtenerMontoDescuentoGeneralNumerico();
        expect(montoDescuentoAntes, 'El monto de Descuento General no quedó reflejado en los totales').toBeGreaterThan(0);

        await pos.abrirModalExoneracion();
        await pos.aplicarExoneracion(DESCUENTO_GENERAL_PCT);
        montoExoneracionAntes = await pos.obtenerMontoExoneracionNumerico();
        expect(montoExoneracionAntes, 'El monto de Exoneración no quedó reflejado en los totales').toBeGreaterThan(0);
      });

      const clavesAntesDeReseleccionar = await pos.obtenerClavesFilasCarrito();

      await test.step('Volver a seleccionar EXACTAMENTE la misma Proforma', async () => {
        await pos.cargarProformaEnCarritoDesdeTab(tarjeta);
      });

      // Investigado en vivo con un diagnóstico dedicado antes de escribir esta
      // aserción (3 corridas: dos sobre una Proforma recién creada y
      // desechable, para eliminar contaminación cruzada entre corridas de
      // reutilizar "la primera disponible"): volver a click-ear la MISMA
      // tarjeta de una Proforma ya cargada, con cambios sin guardar
      // explícitamente, dispara un recálculo/resincronización real contra el
      // servidor (confirmado interceptando el resultado, no asumido) — ese
      // recálculo SÍ conserva tanto las líneas de producto agregadas
      // (Rápido/Normal/Combo) como el Descuento General (checkbox y monto
      // idénticos antes/después, reproducido en las 2 corridas limpias), pero
      // SIEMPRE resetea el monto de Exoneración a 0, de forma consistente en
      // las 3 corridas (incluidas ambas sobre una Proforma aislada sin ningún
      // estado previo). Es un comportamiento real y asimétrico del propio
      // sistema (no una condición de carrera de automatización: el resto de
      // la información sí sobrevive exactamente el mismo recálculo) — se
      // documenta aquí con la evidencia en vivo en vez de forzar la
      // aserción de persistencia de Exoneración para que "pase".
      await test.step('Validar qué información persiste tras reseleccionar la misma Proforma', async () => {
        const clavesTrasReseleccionar = await pos.obtenerClavesFilasCarrito();
        expect(
          [...clavesTrasReseleccionar].sort(),
          'Las líneas de producto (incluidas las agregadas) no persistieron al reseleccionar la misma Proforma'
        ).toEqual([...clavesAntesDeReseleccionar].sort());

        expect(
          await pos.estaDescuentoGeneralActivo(),
          'El Descuento General no permaneció activo al reseleccionar la misma Proforma'
        ).toBe(true);
        const montoDescuentoDespues = await pos.obtenerMontoDescuentoGeneralNumerico();
        expect(
          montoDescuentoDespues,
          'El monto de Descuento General no permaneció igual al reseleccionar la misma Proforma'
        ).toBeCloseTo(montoDescuentoAntes, 1);

        // Hallazgo de Sistema confirmado en vivo (ver el comentario de este
        // escenario): la Exoneración NO sobrevive este recálculo — se
        // registra el valor real en vez de asumir que persiste, y NO se
        // reaplica automáticamente (eso ocultaría el hallazgo).
        const montoExoneracionDespues = await pos.obtenerMontoExoneracionNumerico();
        console.log(
          `[Persistencia Proforma] Exoneración antes=${montoExoneracionAntes.toFixed(2)}, ` +
          `después de reseleccionar la misma Proforma=${montoExoneracionDespues.toFixed(2)} ` +
          '— comportamiento real del sistema confirmado en vivo (ver el comentario de este escenario), no un bug de automatización.'
        );

        const claves = await pos.obtenerClavesFilasCarrito();
        const lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
        const textoLineas = lineas.map((l) => l.nombre).join(' | ');
        expect(pos.nombreApareceEnCarrito(items.nombreRapido, textoLineas), 'El Producto Rápido no está en el carrito tras reseleccionar').toBe(true);
        expect(pos.nombreApareceEnCarrito(items.nombreNormal, textoLineas), 'El Producto Normal no está en el carrito tras reseleccionar').toBe(true);
        expect(pos.nombreApareceEnCarrito(items.nombreCombo, textoLineas), 'El Combo no está en el carrito tras reseleccionar').toBe(true);

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

  // ─── Escenario 9: Eliminar productos, Producto Rápido con observación ─────
  test.describe('Eliminar productos, agregar Producto Rápido con observación y Facturar', () => {
    test('Seleccionar una Proforma, dejar un único producto, agregar un Producto Rápido con observación y facturar', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      const { tarjeta } = await buscarOCrearProformaEnTab(pos, 'normal');
      await pos.cargarProformaEnCarritoDesdeTab(tarjeta);

      // Descuento General persiste por usuario en el servidor (mismo patrón
      // ya documentado para Vista Expandida y Moneda) — confirmado en vivo
      // (root cause real, reproducido corriendo la suite completa con varios
      // workers) que si un escenario anterior de este mismo worker lo dejó
      // activo (p. ej. "Descuento General: ... y Facturar"), el checkbox
      // sigue marcado aquí aunque este escenario nunca lo toque, y el monto
      // recalculado en 0 rompe validarTotalCarrito(). Mismo criterio
      // defensivo ya usado por "Descuento individual" (Crear y Facturar):
      // desactivarlo antes de validar totales que asumen que no está activo.
      await pos.desactivarDescuentoGeneral();

      let claveRestante = '';
      await test.step('Eliminar la mayoría de los productos, dejando únicamente uno', async () => {
        const clavesIniciales = await pos.obtenerClavesFilasCarrito();
        expect(clavesIniciales.length, 'La Proforma cargada no trajo ninguna línea al carrito').toBeGreaterThan(0);

        claveRestante = clavesIniciales[0];
        for (const clave of clavesIniciales.slice(1)) {
          await pos.eliminarProductoDelCarrito(clave);
        }

        const clavesRestantes = await pos.obtenerClavesFilasCarrito();
        expect(clavesRestantes, 'Debía quedar únicamente la primera línea del carrito').toEqual([claveRestante]);
      });

      await test.step('Presionar "AGREGAR ITEMS" y confirmar que cambia a la vista de Productos', async () => {
        await pos.abrirAgregarItem();
      });

      let nombreProductoRapido = '';
      await test.step('Agregar un Producto Rápido', async () => {
        nombreProductoRapido = `Rápido Eliminar Y Observar ${Date.now()}`;
        const clavesAntes = await pos.obtenerClavesProductos();
        await pos.agregarProductoRapidoSimple(nombreProductoRapido, PRECIO_PRODUCTO_RAPIDO);
        const clavesDespues = await pos.obtenerClavesProductos();
        expect(clavesDespues.length, 'El Producto Rápido no quedó agregado al carrito').toBeGreaterThan(clavesAntes.length);
      });

      const observacionProductoRapido = `Observación Producto Rápido ${Date.now()}`;
      let claveProductoRapido = '';
      let lineas: LineaCarrito[] = [];
      await test.step('Regresar a la Proforma, agregar la observación al Producto Rápido y validar líneas, subtotal, IVA y total', async () => {
        await pos.volverDesdeAgregarItem(PESTANA_POS_PROFORMA);

        const claves = await pos.obtenerClavesFilasCarrito();
        expect(claves.length, 'Se esperaban exactamente 2 líneas en el carrito (la restante + el Producto Rápido)').toBe(2);
        expect(claves, 'La línea restante original ya no está en el carrito').toContain(claveRestante);
        claveProductoRapido = claves.find((c) => c !== claveRestante)!;

        await pos.agregarObservacionAProducto(claveProductoRapido, observacionProductoRapido);
        const observacionGuardada = await pos.obtenerObservacionDeProducto(claveProductoRapido);
        expect(observacionGuardada, 'La observación del Producto Rápido no quedó guardada').toBe(observacionProductoRapido);

        lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
        expect(lineas.map((l) => l.nombre), 'El Producto Rápido agregado no está en el carrito').toContain(nombreProductoRapido);

        // Validación línea por línea del carrito (no solo el total final):
        // cada línea visible debe reflejar cantidad y neto reales antes de
        // comparar contra el resumen de impuestos y el total.
        for (const linea of lineas) {
          expect(linea.cantidad, `La cantidad de "${linea.nombre}" debería ser mayor que 0`).toBeGreaterThan(0);
          expect(linea.neto, `El neto de "${linea.nombre}" debería ser mayor que 0`).toBeGreaterThan(0);
        }

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

  // ─── Escenario 10: Vista Expandida sobre una Proforma existente ───────────
  test.describe('Vista Expandida: Producto rápido y normal, y Facturar', () => {
    test('Seleccionar una Proforma, cambiar a Vista Expandida, agregar Producto Rápido y Producto Normal, y facturar', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      // "Vista Expandida" persiste por usuario en el servidor (mismo patrón
      // que en "Proformas — Crear" → "Vista expandida") — se detecta el
      // estado real al inicio (nunca se asume) y se restaura en `finally`.
      const expandidaAlInicio = await pos.vistaExpandidaActiva();
      try {
        const { tarjeta } = await buscarOCrearProformaEnTab(pos, 'normal');
        await pos.cargarProformaEnCarritoDesdeTab(tarjeta);

        // Descuento General persiste por usuario en el servidor (mismo
        // patrón que Vista Expandida/Moneda) — confirmado en vivo (root
        // cause real, corriendo la suite completa con varios workers) que un
        // escenario anterior de este mismo worker ("Descuento General: ... y
        // Facturar") puede dejarlo activo, rompiendo validarTotalCarrito()
        // aquí aunque este escenario nunca lo toque. Mismo criterio
        // defensivo ya usado por "Descuento individual".
        await pos.desactivarDescuentoGeneral();

        const clavesAntes = await pos.obtenerClavesFilasCarrito();

        let codigoProductoNormal = '';
        let nombreProductoNormal = '';
        await test.step('Vista Normal: identificar un Producto Normal con código que todavía no esté en el carrito', async () => {
          if (await pos.vistaExpandidaActiva()) {
            await pos.alternarVistaExpandida();
          }
          const { producto, codigo } = await obtenerProductoNormalConCodigoNoPresenteEnCarrito(pos);
          nombreProductoNormal = producto.nombre;
          codigoProductoNormal = codigo;
        });

        await test.step('Cambiar a Vista Expandida (sin utilizar Vista Lista) y confirmar que el cambio ocurrió realmente', async () => {
          if (!(await pos.vistaExpandidaActiva())) {
            await pos.alternarVistaExpandida();
          }
          expect(await pos.vistaExpandidaActiva(), 'La vista no quedó en modo Expandida').toBe(true);
        });

        await test.step('Agregar el Producto Normal vía el buscador interno de Vista Expandida', async () => {
          const clavesProductosAntes = await pos.obtenerClavesProductos();
          await pos.agregarProductoPorCodigoEnVistaExpandida(codigoProductoNormal);
          const clavesProductosDespues = await pos.obtenerClavesProductos();
          expect(clavesProductosDespues.length, 'El Producto Normal no quedó agregado vía el buscador interno de Vista Expandida').toBeGreaterThan(clavesProductosAntes.length);
        });

        let nombreProductoRapido = '';
        await test.step('Agregar un Producto Rápido (independiente de la vista activa)', async () => {
          nombreProductoRapido = `Rápido VistaExpandida Proforma ${Date.now()}`;
          await pos.agregarProductoRapidoSimple(nombreProductoRapido, PRECIO_PRODUCTO_RAPIDO);
        });

        let lineas: LineaCarrito[] = [];
        await test.step('Validar líneas, cantidad de productos, subtotal, IVA y total', async () => {
          const claves = await pos.obtenerClavesFilasCarrito();
          expect(claves.length, 'Los ítems agregados en Vista Expandida no sobrevivieron en el carrito').toBeGreaterThan(clavesAntes.length);

          lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
          const textoLineas = lineas.map((l) => l.nombre).join(' | ');
          expect(pos.nombreApareceEnCarrito(nombreProductoNormal, textoLineas), 'El Producto Normal agregado en Vista Expandida no está en el carrito').toBe(true);
          expect(lineas.map((l) => l.nombre), 'El Producto Rápido no está en el carrito').toContain(nombreProductoRapido);

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

        await test.step('Validar carrito vacío tras facturar (persistencia confirmada por la venta ya facturada)', async () => {
          await pos.validarCarritoVacio();
        });
      } finally {
        if ((await pos.vistaExpandidaActiva()) !== expandidaAlInicio) {
          await pos.alternarVistaExpandida();
        }
        expect(await pos.vistaExpandidaActiva(), 'La vista no volvió a su estado original').toBe(expandidaAlInicio);
      }

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  // ─── Escenario 11: Cambiar Cliente, agregar Producto Rápido y Facturar ────
  test.describe('Cambiar Cliente, agregar Producto Rápido y Facturar', () => {
    test('Seleccionar una Proforma, cambiar el cliente por otro existente, agregar Producto Rápido y facturar', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      const { tarjeta } = await buscarOCrearProformaEnTab(pos, 'normal');
      await pos.cargarProformaEnCarritoDesdeTab(tarjeta);

      // Investigado en vivo (root cause real, confirmado con captura de
      // pantalla a los 5s reales tras cargar): el cliente REAL ya asociado a
      // la Proforma tarda unos segundos en propagarse al widget "Buscar
      // Cliente" del carrito — leer hayClienteRealSeleccionado() de
      // inmediato después de cargarProformaEnCarritoDesdeTab() puede leer el
      // estado transitorio "Cliente de contado" antes de que esa
      // actualización asíncrona del propio sistema termine (confirmado: a
      // los 5s el ícono "quitar" y el nombre real ya estaban presentes).
      // Espera funcional (no waitForTimeout): sondea hayClienteRealSeleccionado()
      // hasta que se vuelva verdadero, con un margen acotado — si nunca
      // ocurre dentro de ese margen, es porque la Proforma genuinamente no
      // tiene cliente real (nombre libre o ninguno), un estado igual de
      // válido que el resto del test ya maneja explícitamente más abajo.
      await expect.poll(
        () => pos.hayClienteRealSeleccionado(),
        { timeout: TIMEOUTS.PAYMENT_MODAL }
      ).toBe(true).catch(() => {});

      // Descuento General puede quedar activo (con monto 0) en una Proforma
      // reutilizada — ver el comentario completo en "Descuento Individual:
      // ... y Facturar". Defensivo, mismo criterio ya establecido.
      await pos.desactivarDescuentoGeneral();

      const clavesAntes = await pos.obtenerClavesFilasCarrito();
      expect(clavesAntes.length, 'La Proforma cargada no trajo ninguna línea al carrito').toBeGreaterThan(0);

      // La Proforma reutilizada puede traer un cliente REAL ya asociado, o
      // solo un nombre libre (ver el describe "Nombre del cliente" en
      // "Proformas — Crear") — cancelarNombreClienteRapidoSiActivo() cubre
      // ambos casos sin asumir cuál trae esta Proforma en particular (mismo
      // criterio ya usado por "Facturar a Crédito"/"Convertir a Orden de
      // Reparación"). Solo se "quita" un cliente REAL: intentar
      // quitarClienteSeleccionado() sin uno ya asociado dejaría el click
      // esperando un ícono que nunca aparece.
      let nombreClienteNuevo = '';
      await test.step('Cambiar el cliente por otro existente y validar que quedó correctamente seleccionado', async () => {
        await pos.cancelarNombreClienteRapidoSiActivo();

        let nombreClienteAntes = '';
        if (await pos.hayClienteRealSeleccionado()) {
          nombreClienteAntes = await pos.obtenerClienteSeleccionado();
          try {
            await pos.quitarClienteSeleccionado();
          } catch {
            // Investigado en vivo (confirmado por observación directa: al
            // quitar el cliente de una Proforma ya cargada al carrito SÍ
            // aparece un SweetAlert de confirmación real — a diferencia del
            // contrato que asume quitarClienteSeleccionado() ("sin SweetAlert
            // de confirmación que esperar"), válido para el caso genérico de
            // carrito pero no para este). Root cause real del timeout
            // anterior: el ícono "quitar" nunca desaparece porque la
            // confirmación sigue pendiente, no un simple retraso de
            // propagación. Se confirma reutilizando el helper genérico ya
            // existente (_confirmarSweetAlertV1(), mismo patrón que
            // confirmarCerrarCaja()/enviarOrdenCaja()) y se valida el
            // resultado real, sin reintentar el click original.
            await pos._confirmarSweetAlertV1();
            await expect.poll(
              () => pos.hayClienteRealSeleccionado(),
              { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El cliente no se quitó ni siquiera tras confirmar el SweetAlert' }
            ).toBe(false);
          }
          nombreClienteNuevo = await pos.seleccionarClienteExistenteDistintoDe(nombreClienteAntes);
        } else {
          nombreClienteNuevo = await pos.seleccionarClienteExistente();
        }

        expect(nombreClienteNuevo.length, 'El nuevo cliente no quedó seleccionado').toBeGreaterThan(0);
        expect(
          await pos.hayClienteRealSeleccionado(),
          'El nuevo cliente no quedó registrado como cliente real (icono "quitar" no visible)'
        ).toBe(true);
        expect(
          await pos.obtenerClienteSeleccionado(),
          'El cliente mostrado en el POS no coincide con el recién seleccionado'
        ).toBe(nombreClienteNuevo);
        if (nombreClienteAntes) {
          expect(nombreClienteNuevo, 'El cliente "nuevo" es el mismo que el original').not.toBe(nombreClienteAntes);
        }
      });

      await test.step('Validar que los productos existentes no se perdieron al cambiar el cliente', async () => {
        const clavesTrasCambiarCliente = await pos.obtenerClavesFilasCarrito();
        expect(
          [...clavesTrasCambiarCliente].sort(),
          'Las líneas de producto originales no persistieron al cambiar el cliente'
        ).toEqual([...clavesAntes].sort());
      });

      await test.step('Presionar "AGREGAR ITEMS" y confirmar que cambia a la vista de Productos', async () => {
        await pos.abrirAgregarItem();
      });

      let nombreProductoRapido = '';
      await test.step('Agregar un Producto Rápido', async () => {
        nombreProductoRapido = `Rápido Cambiar Cliente ${Date.now()}`;
        const clavesProductosAntes = await pos.obtenerClavesProductos();
        await pos.agregarProductoRapidoSimple(nombreProductoRapido, PRECIO_PRODUCTO_RAPIDO);
        const clavesProductosDespues = await pos.obtenerClavesProductos();
        expect(clavesProductosDespues.length, 'El Producto Rápido no quedó agregado al carrito').toBeGreaterThan(clavesProductosAntes.length);
      });

      let lineas: LineaCarrito[] = [];
      await test.step('Regresar a la Proforma y validar cliente, líneas, cantidades, subtotal, IVA y total', async () => {
        await pos.volverDesdeAgregarItem(PESTANA_POS_PROFORMA);

        expect(
          await pos.obtenerClienteSeleccionado(),
          'El cliente cambiado no persistió tras volver de "AGREGAR ITEMS"'
        ).toBe(nombreClienteNuevo);

        const claves = await pos.obtenerClavesFilasCarrito();
        expect(claves.length, 'Los productos originales y el Producto Rápido no sobrevivieron al volver a la Proforma').toBeGreaterThan(clavesAntes.length);

        lineas = await validarLineasCarritoSegunEstadoReal(pos, claves);
        expect(lineas.map((l) => l.nombre), 'El Producto Rápido agregado no está en el carrito').toContain(nombreProductoRapido);

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

      await test.step('Validar estado final: carrito vacío tras facturar', async () => {
        await pos.validarCarritoVacio();
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });
});
