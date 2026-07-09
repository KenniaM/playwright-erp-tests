import { test as base, expect, Response, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT, PRECIO_PRODUCTO_RAPIDO, PESTANAS_POS_A_RECORRER, espiarErroresJS } from './pos.page';

const NOMBRE_TERCERO = 'Tercero De Prueba QA';

// ─── Sesión compartida (fixture de scope 'worker', NO mode: 'serial') ──────
//
// Mismo mecanismo ya adoptado en pos-ruteo.spec.ts (la última suite del POS):
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
type OrdenCajaFixtures = {
  sharedPage: Page;
  pos: PosPage;
};

const test = base.extend<{}, OrdenCajaFixtures>({
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
 * Deja el POS en un estado limpio antes de cada escenario, sin repetir el
 * login ni el paso por Dashboard: navega directo a la URL del POS
 * (pos.irAlPos(), ya seguro tras el cargarPosDesdeDashboard() único que la
 * fixture "pos" ya hizo para este worker) y vuelve a resolver el estado
 * inicial (grid de productos o modal "Abrir Caja"). Mismo criterio que
 * pos-ruteo.spec.ts: una recarga real es la forma más simple y más confiable
 * de garantizar carrito vacío, ningún modal abierto y ninguna pestaña/
 * categoría distinta de la inicial pegada de un test anterior — incluida la
 * variante en la que un test previo falló a mitad de camino.
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

/** Agrega un producto de precio fijo — punto de partida común a varios escenarios de "Crear". */
async function agregarProductoDePrecioFijo(pos: PosPage) {
  await pos.agregarPrimerProductoDePrecioFijo();
}

/** Ninguna línea de error visible en el carrito — mismo criterio ya usado en pos-crear.spec.ts. */
async function validarSinMensajesDeError(page: Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

/** Va a la pestaña "Órdenes de caja" y carga la primera orden disponible — mismo criterio "primera disponible, sin buscar" ya adoptado para Importar Factura. */
async function cargarPrimeraOrdenCaja(pos: PosPage) {
  await pos.abrirOrdenesCaja();
  await pos.cargarPrimeraOrdenCajaDisponible();
}

/** La pestaña "Órdenes de caja" registrada en PESTANAS_POS_A_RECORRER — reutilizada por volverDesdeAgregarItem() en los escenarios que presionan "Volver". */
const PESTANA_ORDENES_CAJA = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Órdenes de caja')!;

// ─── Orden de Caja — Crear ──────────────────────────────────────────────────
//
// Cada test es funcionalmente independiente (agrega sus propios productos y
// no depende del resultado de ningún otro) aunque, dentro de un mismo
// worker, reutilicen la misma `page`/sesión ya autenticada — ver la fixture
// "pos" y beforeEach() arriba. Estructura pensada para crecer: nuevos
// describe() hermanos de este (Editar, Eliminar, Buscar/Filtros, Impresión,
// Historial, Permisos) pueden agregarse al mismo nivel que "Crear" y
// "Seleccionar y Facturar" más adelante.

test.describe('Orden de Caja — Crear', () => {

  test.describe('Cliente', () => {
    test('1. Crear una Orden de Caja seleccionando el cliente desde la parte superior del carrito', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      const erroresJS = espiarErroresJS(sharedPage);

      let nombreCliente = '';
      await test.step('Seleccionar cliente desde arriba del carrito (Forma 1)', async () => {
        nombreCliente = await pos.seleccionarClienteExistente();
      });

      await test.step('Abrir "Enviar a caja" y confirmar que el cliente se propagó automáticamente', async () => {
        await pos.abrirMenuOrdenCaja();
        await expect(
          await pos.obtenerClienteEnOrdenCaja(),
          'El cliente elegido arriba del carrito no se propagó al modal "Enviar a caja"'
        ).toBe(nombreCliente);
      });

      let respuesta;
      await test.step('Llenar observaciones y enviar', async () => {
        await pos.llenarObservacionesOrdenCaja('Orden de caja QA - cliente desde el carrito');
        respuesta = await pos.enviarOrdenCaja();
      });

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(sharedPage);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('2. Crear una Orden de Caja seleccionando el cliente desde el modal de Orden de Caja', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      const erroresJS = espiarErroresJS(sharedPage);

      let nombreCliente = '';
      await test.step('Abrir "Enviar a caja" y seleccionar cliente desde el propio modal (Forma 2)', async () => {
        await pos.abrirMenuOrdenCaja();
        nombreCliente = await pos.seleccionarClienteEnOrdenCaja();
        expect(nombreCliente.length).toBeGreaterThan(0);
      });

      let respuesta;
      await test.step('Llenar observaciones y enviar', async () => {
        await pos.llenarObservacionesOrdenCaja('Orden de caja QA - cliente desde el modal');
        respuesta = await pos.enviarOrdenCaja();
      });

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(sharedPage);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Contado', () => {
    test('3. Crear una Orden de Caja con cliente existente al contado', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      const erroresJS = espiarErroresJS(sharedPage);

      await pos.seleccionarClienteExistente();
      await pos.abrirMenuOrdenCaja();

      await test.step('Seleccionar "Contado" (valor por defecto, se confirma igual)', async () => {
        await pos.seleccionarTipoPagoOrdenCaja('contado');
      });

      await pos.llenarObservacionesOrdenCaja('Orden de caja QA - contado, cliente existente');
      const respuesta = await pos.enviarOrdenCaja();

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(sharedPage);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('4. Crear una Orden de Caja con cliente existente al contado seleccionando un vendedor', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      const erroresJS = espiarErroresJS(sharedPage);

      await pos.seleccionarClienteExistente();
      await pos.abrirMenuOrdenCaja();
      await pos.seleccionarTipoPagoOrdenCaja('contado');

      let nombreVendedor = '';
      await test.step('Seleccionar vendedor', async () => {
        nombreVendedor = await pos.seleccionarVendedorOrdenCaja();
      });

      await pos.llenarObservacionesOrdenCaja('Orden de caja QA - contado con vendedor');
      const respuesta = await pos.enviarOrdenCaja();

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(sharedPage);
      });

      expect(nombreVendedor.length).toBeGreaterThan(0);
      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Crédito', () => {
    test('5. Crear una Orden de Caja con cliente existente a crédito', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      const erroresJS = espiarErroresJS(sharedPage);

      // Confirmado en vivo: "Crédito" exige un cliente real seleccionado —
      // se elige ANTES de abrir el menú para que se propague al modal
      // (Forma 1), igual que valida el test 1.
      await pos.seleccionarClienteExistente();
      await pos.abrirMenuOrdenCaja();

      await test.step('Seleccionar "Crédito" y confirmar que aparece la Fecha de Vencimiento', async () => {
        await pos.seleccionarTipoPagoOrdenCaja('credito');
      });

      await pos.llenarObservacionesOrdenCaja('Orden de caja QA - credito, cliente existente');
      const respuesta = await pos.enviarOrdenCaja();

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(sharedPage);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('6. Crear una Orden de Caja con cliente existente a crédito seleccionando un vendedor', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      const erroresJS = espiarErroresJS(sharedPage);

      await pos.seleccionarClienteExistente();
      await pos.abrirMenuOrdenCaja();
      await pos.seleccionarTipoPagoOrdenCaja('credito');

      let nombreVendedor = '';
      await test.step('Seleccionar vendedor', async () => {
        nombreVendedor = await pos.seleccionarVendedorOrdenCaja();
      });

      await pos.llenarObservacionesOrdenCaja('Orden de caja QA - credito con vendedor');
      const respuesta = await pos.enviarOrdenCaja();

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(sharedPage);
      });

      expect(nombreVendedor.length).toBeGreaterThan(0);
      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Nombre del cliente', () => {
    test('7. Crear una Orden de Caja utilizando únicamente el nombre del cliente', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      const erroresJS = espiarErroresJS(sharedPage);
      const nombreCliente = `Cliente Solo Nombre QA ${Date.now()}`;

      await test.step('Escribir únicamente el nombre del cliente (sin seleccionar uno registrado)', async () => {
        await pos.ingresarNombreCliente(nombreCliente);
      });

      await pos.abrirMenuOrdenCaja();
      // Contado: "Crédito" exige cliente real (ver test 5), un nombre libre no alcanza.
      await pos.seleccionarTipoPagoOrdenCaja('contado');
      await pos.llenarObservacionesOrdenCaja('Orden de caja QA - solo nombre del cliente');
      const respuesta = await pos.enviarOrdenCaja();

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(sharedPage);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Nombre de terceros', () => {
    test('8. Crear una Orden de Caja utilizando únicamente un nombre de cliente y facturando a nombre de terceros', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      const erroresJS = espiarErroresJS(sharedPage);
      const nombreCliente = `Cliente Solo Nombre Tercero QA ${Date.now()}`;

      await pos.ingresarNombreCliente(nombreCliente);
      await pos.abrirMenuOrdenCaja();
      await pos.seleccionarTipoPagoOrdenCaja('contado');

      await test.step('Activar "A nombre de terceros" y llenar el nombre', async () => {
        await pos.activarNombreTercerosOrdenCaja(NOMBRE_TERCERO);
        await expect(pos.campoTercerosOrdenCaja).toHaveValue(NOMBRE_TERCERO);
      });

      await pos.llenarObservacionesOrdenCaja('Orden de caja QA - solo nombre + terceros');
      const respuesta = await pos.enviarOrdenCaja();

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(sharedPage);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('9. Crear una Orden de Caja al contado con cliente existente a nombre de terceros', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      const erroresJS = espiarErroresJS(sharedPage);

      await pos.seleccionarClienteExistente();
      await pos.abrirMenuOrdenCaja();
      await pos.seleccionarTipoPagoOrdenCaja('contado');

      await test.step('Activar "A nombre de terceros" y llenar el nombre', async () => {
        await pos.activarNombreTercerosOrdenCaja(NOMBRE_TERCERO);
        await expect(pos.campoTercerosOrdenCaja).toHaveValue(NOMBRE_TERCERO);
      });

      await pos.llenarObservacionesOrdenCaja('Orden de caja QA - contado, cliente + terceros');
      const respuesta = await pos.enviarOrdenCaja();

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(sharedPage);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Descuentos', () => {
    test('10. Crear una Orden de Caja con productos utilizando descuento individual', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      const erroresJS = espiarErroresJS(sharedPage);

      await pos.desactivarDescuentoGeneral();

      let clave = '';
      let totalAntes = 0;
      await test.step('Registrar el total antes de aplicar el descuento individual', async () => {
        clave = (await pos.obtenerClavesProductos())[0];
        totalAntes = await pos.obtenerTotalVentaNumerico();
      });

      await test.step(`Aplicar descuento individual del ${DESCUENTO_INDIVIDUAL_PCT}% y validar que el total baja (si el sistema lo permite)`, async () => {
        const resultado = await pos.aplicarDescuentoIndividual(clave, DESCUENTO_INDIVIDUAL_PCT);
        if (resultado.escenario !== 'sin_descuento') {
          const totalDespues = await pos.obtenerTotalVentaNumerico();
          expect(totalDespues, 'El total no bajó tras aplicar el descuento individual').toBeLessThan(totalAntes);
        }
      });

      await pos.seleccionarClienteExistente();
      await pos.abrirMenuOrdenCaja();
      await pos.seleccionarTipoPagoOrdenCaja('contado');
      await pos.llenarObservacionesOrdenCaja('Orden de caja QA - descuento individual');
      const respuesta = await pos.enviarOrdenCaja();

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(sharedPage);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('11. Crear una Orden de Caja utilizando descuento general', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      const erroresJS = espiarErroresJS(sharedPage);

      let totalAntes = 0;
      await test.step('Registrar el total antes del descuento general', async () => {
        totalAntes = await pos.obtenerTotalVentaNumerico();
      });

      await test.step(`Activar el checkbox de descuento general, ingresar ${DESCUENTO_GENERAL_PCT}% y validar que se aplicó`, async () => {
        await pos.activarDescuentoGeneral();
        await pos.mostrarDetalleAvanzadoFactura();
        await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);

        const montoDescuento = await pos.obtenerMontoDescuentoGeneralNumerico();
        expect(montoDescuento, 'El monto de descuento general no quedó reflejado en los totales').toBeGreaterThan(0);

        const totalDespues = await pos.obtenerTotalVentaNumerico();
        expect(totalDespues, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalAntes);
      });

      await pos.seleccionarClienteExistente();
      await pos.abrirMenuOrdenCaja();
      await pos.seleccionarTipoPagoOrdenCaja('contado');
      await pos.llenarObservacionesOrdenCaja('Orden de caja QA - descuento general');
      const respuesta = await pos.enviarOrdenCaja();

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(sharedPage);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Productos múltiples', () => {
    test('12. Crear una Orden de Caja al contado con producto normal, rápido y fraccionado', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      let clavesAntes: string[] = [];
      await test.step('Agregar producto normal, rápido y fraccionado', async () => {
        clavesAntes = await pos.obtenerClavesProductos();
        await pos.agregarProductoNormalFraccionadoYRapido('Orden Caja', `contado ${Date.now()}`);
        await expect.poll(async () => (await pos.obtenerClavesProductos()).length).toBeGreaterThan(clavesAntes.length);
      });

      await test.step('Confirmar que los tres productos permanecen en el carrito', async () => {
        const clavesDespues = await pos.obtenerClavesProductos();
        expect(clavesDespues.length - clavesAntes.length, 'No quedaron las 3 líneas esperadas en el carrito').toBeGreaterThanOrEqual(3);
      });

      await pos.seleccionarClienteExistente();
      await pos.abrirMenuOrdenCaja();
      await pos.seleccionarTipoPagoOrdenCaja('contado');
      await pos.llenarObservacionesOrdenCaja('Orden de caja QA - multiples productos, contado');
      const respuesta = await pos.enviarOrdenCaja();

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(sharedPage);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('13. Crear una Orden de Caja al contado con producto normal, rápido y fraccionado aplicando descuentos', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      await pos.agregarProductoNormalFraccionadoYRapido('Orden Caja', `contado desc ${Date.now()}`);

      let totalAntes = 0;
      await test.step(`Activar descuento general del ${DESCUENTO_GENERAL_PCT}% y validar que se aplicó`, async () => {
        totalAntes = await pos.obtenerTotalVentaNumerico();
        await pos.activarDescuentoGeneral();
        await pos.mostrarDetalleAvanzadoFactura();
        await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);

        const totalDespues = await pos.obtenerTotalVentaNumerico();
        expect(totalDespues, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalAntes);
      });

      await pos.seleccionarClienteExistente();
      await pos.abrirMenuOrdenCaja();
      await pos.seleccionarTipoPagoOrdenCaja('contado');
      await pos.llenarObservacionesOrdenCaja('Orden de caja QA - multiples productos con descuento, contado');
      const respuesta = await pos.enviarOrdenCaja();

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(sharedPage);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('14. Crear una Orden de Caja a crédito con producto normal, rápido y fraccionado', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      await pos.agregarProductoNormalFraccionadoYRapido('Orden Caja', `credito ${Date.now()}`);

      // Crédito exige cliente real (ver test 5) — se selecciona antes de abrir el menú.
      await pos.seleccionarClienteExistente();
      await pos.abrirMenuOrdenCaja();
      await pos.seleccionarTipoPagoOrdenCaja('credito');
      await pos.llenarObservacionesOrdenCaja('Orden de caja QA - multiples productos, credito');
      const respuesta = await pos.enviarOrdenCaja();

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(sharedPage);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('15. Crear una Orden de Caja a crédito con producto normal, rápido y fraccionado aplicando descuentos', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const erroresJS = espiarErroresJS(sharedPage);

      await pos.agregarProductoNormalFraccionadoYRapido('Orden Caja', `credito desc ${Date.now()}`);

      let totalAntes = 0;
      await test.step(`Activar descuento general del ${DESCUENTO_GENERAL_PCT}% y validar que se aplicó`, async () => {
        totalAntes = await pos.obtenerTotalVentaNumerico();
        await pos.activarDescuentoGeneral();
        await pos.mostrarDetalleAvanzadoFactura();
        await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);

        const totalDespues = await pos.obtenerTotalVentaNumerico();
        expect(totalDespues, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalAntes);
      });

      await pos.seleccionarClienteExistente();
      await pos.abrirMenuOrdenCaja();
      await pos.seleccionarTipoPagoOrdenCaja('credito');
      await pos.llenarObservacionesOrdenCaja('Orden de caja QA - multiples productos con descuento, credito');
      const respuesta = await pos.enviarOrdenCaja();

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(sharedPage);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Orden de Caja — Seleccionar y Facturar
// ═══════════════════════════════════════════════════════════════════════════
//
// A diferencia de "Crear" (arma un carrito nuevo y lo deja pendiente vía
// "Enviar a caja"), estos escenarios parten de una Orden de Caja YA
// EXISTENTE (creada por cualquiera de los tests de "Crear" de arriba, en
// ejecuciones anteriores) seleccionada desde la pestaña "Órdenes de caja", y
// la llevan hasta Facturar — el otro extremo del mismo ciclo de vida.
// Siempre se toma la primera orden disponible en la lista, sin buscar una en
// particular (mismo criterio ya adoptado para Importar Factura).

test.describe('Orden de Caja — Seleccionar y Facturar', () => {

  test('16. Seleccionar la primera Orden de Caja disponible y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await test.step('Ir al tab "Órdenes de caja" y seleccionar la primera disponible', async () => {
      await cargarPrimeraOrdenCaja(pos);
      expect(await pos.obtenerCantidadFilasCarrito(), 'La Orden de Caja no cargó ninguna línea al carrito').toBeGreaterThan(0);
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

  test('17. Seleccionar una Orden de Caja, agregar un producto vía "AGREGAR ITEMS" y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await cargarPrimeraOrdenCaja(pos);

    let claveProducto = '';
    await test.step('Presionar "AGREGAR ITEMS", confirmar que cambia a la vista de Productos, y agregar un producto', async () => {
      await pos.abrirAgregarItem();
      const producto = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      claveProducto = await pos.agregarProductoDelGridAlCarrito(producto);
      expect(await pos.obtenerClavesProductos(), 'El producto agregado no aparece en el carrito').toContain(claveProducto);
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

  test('18. Seleccionar una Orden de Caja, agregar un producto, presionar "Volver" y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await cargarPrimeraOrdenCaja(pos);

    let clavesAntesDeVolver: string[] = [];
    let filasAntesDeVolver = 0;
    await test.step('Presionar "AGREGAR ITEMS" y agregar un producto', async () => {
      await pos.abrirAgregarItem();
      const producto = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await pos.agregarProductoDelGridAlCarrito(producto);
      clavesAntesDeVolver = await pos.obtenerClavesProductos();
      filasAntesDeVolver = await pos.obtenerCantidadFilasCarrito();
    });

    await test.step('Presionar "Volver" y validar que el sistema regresa al tab "Órdenes de caja" conservando el carrito', async () => {
      await pos.volverDesdeAgregarItem(PESTANA_ORDENES_CAJA);

      const clavesTrasVolver = await pos.obtenerClavesProductos();
      expect(clavesTrasVolver, 'El producto agregado no sobrevivió al volver al tab Órdenes de caja').toEqual(expect.arrayContaining(clavesAntesDeVolver));
      expect(await pos.obtenerCantidadFilasCarrito(), 'La cantidad de líneas del carrito cambió al volver').toBe(filasAntesDeVolver);
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

  test('19. Seleccionar una Orden de Caja, agregar un producto rápido y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await cargarPrimeraOrdenCaja(pos);

    await test.step('Agregar un producto rápido (el FAB funciona igual sobre el carrito ya cargado, sin pasar por "AGREGAR ITEMS")', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido Orden Caja ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
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

  test('20. Seleccionar una Orden de Caja, agregar un producto vía "AGREGAR ITEMS", aplicar descuento individual y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await cargarPrimeraOrdenCaja(pos);

    let claveProducto = '';
    await test.step('Presionar "AGREGAR ITEMS" y agregar un producto', async () => {
      await pos.abrirAgregarItem();
      const producto = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      claveProducto = await pos.agregarProductoDelGridAlCarrito(producto);
    });

    await test.step(`Aplicar descuento individual del ${DESCUENTO_INDIVIDUAL_PCT}% al producto agregado`, async () => {
      // El descuento individual de las líneas YA CARGADAS de la Orden de Caja
      // está deshabilitado — confirmado en vivo: cada
      // input_product_discount_<id> de esas líneas trae disabled=true. Solo
      // se puede aplicar a productos agregados desde el catálogo (vía
      // "AGREGAR ITEMS"), de ahí que este paso vaya después de agregar el
      // producto, no antes.
      await pos.desactivarDescuentoGeneral();
      const totalAntes = await pos.obtenerTotalVentaNumerico();
      const resultado = await pos.aplicarDescuentoIndividual(claveProducto, DESCUENTO_INDIVIDUAL_PCT);
      if (resultado.escenario !== 'sin_descuento') {
        const totalDespues = await pos.obtenerTotalVentaNumerico();
        expect(totalDespues, 'El total no bajó tras aplicar el descuento individual').toBeLessThan(totalAntes);
      }
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

  test('21. Seleccionar una Orden de Caja, aplicar descuento general, agregar producto fraccionado y rápido, volver y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await cargarPrimeraOrdenCaja(pos);
    await pos.abrirAgregarItem();

    await test.step(`Activar el descuento general del ${DESCUENTO_GENERAL_PCT}% y validar que se aplicó`, async () => {
      // La Orden de Caja "primera disponible" puede llegar con descuento
      // general YA activo (creada por otro escenario de "Crear" que también
      // lo aplica) — confirmado en vivo, 2/2 corridas: el checkbox y el
      // monto de descuento ya traían un valor > 0 antes de tocar nada, lo
      // que dejaba establecerPorcentajeDescuentoGeneral() satisfecho sin
      // haber cambiado realmente nada (su espera solo valida monto > 0, no
      // que haya cambiado desde el valor previo). Se desactiva primero —
      // mismo criterio que ya usa el test 20 antes de un descuento
      // individual — para partir de un estado conocido y que la
      // comparación de abajo mida el efecto real de ESTE 10%.
      await pos.desactivarDescuentoGeneral();
      const totalAntes = await pos.obtenerTotalVentaNumerico();
      await pos.activarDescuentoGeneral();
      await pos.mostrarDetalleAvanzadoFactura();
      await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);
      const totalDespues = await pos.obtenerTotalVentaNumerico();
      expect(totalDespues, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalAntes);
    });

    let clavesAntesDeVolver: string[] = [];
    await test.step('Agregar un producto fraccionado y un producto rápido', async () => {
      const fraccionado = await pos.obtenerPrimerProductoFraccionadoNoPresenteEnCarrito();
      await pos.agregarProductoFraccionadoAlCarrito(fraccionado);
      await pos.agregarProductoRapidoSimple(`Rápido Orden Caja DescGeneral ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);

      clavesAntesDeVolver = await pos.obtenerClavesProductos();
      expect(clavesAntesDeVolver.length, 'El fraccionado y el rápido deben quedar en el carrito').toBeGreaterThanOrEqual(2);
    });

    await test.step('Presionar "Volver" y validar que el sistema regresa al tab "Órdenes de caja" conservando el carrito y el descuento', async () => {
      const totalConDescuentoAntes = await pos.obtenerTotalVentaNumerico();
      await pos.volverDesdeAgregarItem(PESTANA_ORDENES_CAJA);

      const clavesTrasVolver = await pos.obtenerClavesProductos();
      expect(clavesTrasVolver, 'Los productos agregados no sobrevivieron al volver').toEqual(expect.arrayContaining(clavesAntesDeVolver));
      expect(await pos.obtenerTotalVentaNumerico(), 'El descuento general ya no se refleja en el total tras volver').toBeCloseTo(totalConDescuentoAntes, 1);
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

  test('22. Seleccionar una Orden de Caja y agregar producto rápido, combo existente, fraccionado y normal, volver y facturar', async ({ pos, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    await cargarPrimeraOrdenCaja(pos);
    await pos.abrirAgregarItem();

    let clavesAntesDeVolver: string[] = [];
    await test.step('Agregar un producto rápido, un combo existente (sin crear ninguno), un producto fraccionado y un producto normal', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido Orden Caja Mixto ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);

      const combo = await pos.obtenerPrimerCombo();
      await pos.agregarProductoDelGridAlCarrito(combo);

      // obtenerPrimerCombo() deja activa la categoría "Combos" — volver a
      // "Todos" antes de buscar el fraccionado/normal, mismo criterio que ya
      // usa el resto de la suite para no arrastrar el filtro de categoría de
      // un paso anterior.
      await pos.categoriaTodos.click();

      const fraccionado = await pos.obtenerPrimerProductoFraccionadoNoPresenteEnCarrito();
      await pos.agregarProductoFraccionadoAlCarrito(fraccionado);

      const normal = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await pos.agregarProductoDelGridAlCarrito(normal);

      clavesAntesDeVolver = await pos.obtenerClavesProductos();
      expect(clavesAntesDeVolver.length, 'Los 4 productos deben quedar en el carrito').toBeGreaterThanOrEqual(4);
    });

    await test.step('Presionar "Volver" y validar que el sistema regresa al tab "Órdenes de caja" conservando el carrito', async () => {
      await pos.volverDesdeAgregarItem(PESTANA_ORDENES_CAJA);

      const clavesTrasVolver = await pos.obtenerClavesProductos();
      expect(clavesTrasVolver, 'Los productos agregados no sobrevivieron al volver').toEqual(expect.arrayContaining(clavesAntesDeVolver));
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
