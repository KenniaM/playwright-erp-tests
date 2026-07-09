import { test as base, expect, Response, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, METODO, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT, espiarErroresJS } from './pos.page';

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
type ApartadoFixtures = {
  sharedPage: Page;
  pos: PosPage;
};

const test = base.extend<{}, ApartadoFixtures>({
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
 * A diferencia de pos-ruteo.spec.ts/pos-orden-caja.spec.ts (que solo cancelan
 * el modal "Abrir Caja" si aparece, pues ninguno de sus escenarios depende de
 * tener la caja abierta), aquí SÍ se completa la apertura: "Generar Apartado"
 * no tiene el manejo de "abrir caja sobre la marcha" que sí tiene Facturar
 * (ver confirmarPagoAbriendoCajaSiEsNecesario() en pos.page.ts), así que la
 * caja debe quedar abierta de antemano — mismo comportamiento que ya tenía
 * cada test antes de esta migración (cargarPosConProducto()/cargarPos()),
 * solo que ahora se resuelve una vez por test vía beforeEach en lugar de
 * repetir además el paso completo por Dashboard.
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
// lógica de agregar productos, clientes, descuentos, pagos ni esperas.

/** Agrega un producto de precio fijo — punto de partida común a varios escenarios. */
async function agregarProductoDePrecioFijo(pos: PosPage) {
  await pos.agregarPrimerProductoDePrecioFijo();
}

/** Guarda el Apartado ya configurado y valida que se creó correctamente. */
async function guardarApartadoYValidar(pos: PosPage): Promise<Response> {
  const respuesta = await pos.guardarApartadoYObtenerRespuesta();
  await pos.validarApartadoCreado(respuesta);
  return respuesta;
}

/**
 * Calcula un monto de abono parcial (la mitad del total actual) — el abono
 * nunca puede ser igual ni mayor al total (regla de negocio confirmada en
 * vivo, Fase 1: make_layaway()/confirm_add_layaway() en pos_layaway.js
 * rechazan cualquier monto >= total).
 */
async function calcularAbonoParcial(pos: PosPage): Promise<string> {
  const total = await pos.obtenerTotalVentaNumerico();
  expect(total, 'El total de la venta debe ser mayor a 0 para calcular un abono parcial').toBeGreaterThan(0);
  return (total / 2).toFixed(2);
}

/** Aplica descuento individual a cada línea del carrito — mismo criterio ya usado en pos-proforma.spec.ts/pos-orden-caja.spec.ts. */
async function aplicarDescuentoIndividualATodos(pos: PosPage) {
  await pos.desactivarDescuentoGeneral();
  const claves = await pos.obtenerClavesProductos();
  expect(claves.length, 'Se esperaban al menos 3 productos en el carrito').toBeGreaterThanOrEqual(3);
  for (const clave of claves) {
    await pos.aplicarDescuentoIndividual(clave, DESCUENTO_INDIVIDUAL_PCT);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Apartados — Crear
// ═══════════════════════════════════════════════════════════════════════════
//
// Cada test es funcionalmente independiente (agrega sus propios productos y
// no depende del resultado de ningún otro) aunque, dentro de un mismo
// worker, reutilicen la misma `page`/sesión ya autenticada — ver la fixture
// "pos" y beforeEach() arriba.

test.describe('Apartados — Crear', () => {

  test.describe('Cliente', () => {
    test('1. Crear un Apartado seleccionando el cliente desde arriba del carrito (Forma 1)', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      const erroresJS = espiarErroresJS(sharedPage);

      let nombreCliente = '';
      await test.step('Seleccionar un cliente existente desde arriba del carrito', async () => {
        nombreCliente = await pos.seleccionarClienteExistente();
        expect(nombreCliente.length).toBeGreaterThan(0);
      });

      await test.step('Abrir "Generar Apartado" sin abono y guardar', async () => {
        await pos.abrirCrearApartado();
        await pos.seleccionarPagoEfectivo('0');
        await guardarApartadoYValidar(pos);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('2. Crear un Apartado seleccionando el cliente desde el modal (Forma 2)', async ({ pos, sharedPage }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      const erroresJS = espiarErroresJS(sharedPage);

      await test.step('Abrir "Generar Apartado" y seleccionar cliente desde el propio modal', async () => {
        await pos.abrirCrearApartado();
        const nombreCliente = await pos.seleccionarClienteEnModalApartado();
        expect(nombreCliente.length).toBeGreaterThan(0);
      });

      await test.step('Guardar sin abono', async () => {
        await pos.seleccionarPagoEfectivo('0');
        await guardarApartadoYValidar(pos);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Abonos', () => {
    test('3. Crear un Apartado sin abono inicial', async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Dejar el abono en 0 y guardar', async () => {
        await pos.seleccionarPagoEfectivo('0');
        await guardarApartadoYValidar(pos);
      });
    });

    test('4. Crear un Apartado con abono inicial en efectivo', async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Abonar en efectivo un monto menor al total y guardar', async () => {
        const monto = await calcularAbonoParcial(pos);
        await pos.seleccionarPagoEfectivo(monto);
        await guardarApartadoYValidar(pos);
      });
    });

    test('5. Crear un Apartado con abono inicial en tarjeta', async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Abonar con tarjeta un monto menor al total y guardar', async () => {
        const monto = await calcularAbonoParcial(pos);
        await pos.seleccionarPagoParcial(METODO.TARJETA, monto);
        await guardarApartadoYValidar(pos);
      });
    });

    test('6. Crear un Apartado con abono inicial en SINPE (tercera opción)', async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Abonar con SINPE un monto menor al total y guardar', async () => {
        const monto = await calcularAbonoParcial(pos);
        await pos.seleccionarPagoParcial(METODO.SINPE, monto);
        await guardarApartadoYValidar(pos);
      });
    });

    test('7. Crear un Apartado con abono inicial en transacción', async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Abonar con transacción un monto menor al total y guardar', async () => {
        const monto = await calcularAbonoParcial(pos);
        await pos.seleccionarPagoParcial(METODO.TRANSACCION, monto);
        await guardarApartadoYValidar(pos);
      });
    });

    test('8. Crear un Apartado con abono inicial mixto (efectivo + tarjeta)', async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await agregarProductoDePrecioFijo(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Abonar parte en tarjeta y parte en efectivo (suma menor al total) y guardar', async () => {
        const total = await pos.obtenerTotalVentaNumerico();
        expect(total).toBeGreaterThan(0);
        const montoTarjeta = (total * 0.25).toFixed(2);
        const montoEfectivo = (total * 0.25).toFixed(2);
        await pos.seleccionarPagoMixto(montoTarjeta, montoEfectivo);
        await guardarApartadoYValidar(pos);
      });
    });
  });

  test.describe('Productos', () => {
    test('9. Crear un Apartado con producto normal, rápido y fraccionado, con abono inicial', async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);

      await test.step('Agregar producto normal, rápido y fraccionado', async () => {
        await pos.agregarProductoNormalFraccionadoYRapido('Apartado', `ConAbono ${Date.now()}`);
      });

      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Abonar un monto menor al total y guardar', async () => {
        const monto = await calcularAbonoParcial(pos);
        await pos.seleccionarPagoEfectivo(monto);
        await guardarApartadoYValidar(pos);
      });
    });

    test('10. Crear un Apartado con producto normal, rápido y fraccionado, sin abono', async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);

      await test.step('Agregar producto normal, rápido y fraccionado', async () => {
        await pos.agregarProductoNormalFraccionadoYRapido('Apartado', `SinAbono ${Date.now()}`);
      });

      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Dejar el abono en 0 y guardar', async () => {
        await pos.seleccionarPagoEfectivo('0');
        await guardarApartadoYValidar(pos);
      });
    });
  });

  test.describe('Descuento individual', () => {
    test('11. Crear un Apartado con productos mixtos, descuento individual y abono inicial', async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await pos.agregarProductoNormalFraccionadoYRapido('Apartado', `DescIndConAbono ${Date.now()}`);

      await test.step('Aplicar descuento individual a cada producto', async () => {
        await aplicarDescuentoIndividualATodos(pos);
      });

      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Abonar un monto menor al total y guardar', async () => {
        const monto = await calcularAbonoParcial(pos);
        await pos.seleccionarPagoEfectivo(monto);
        await guardarApartadoYValidar(pos);
      });
    });

    test('12. Crear un Apartado con productos mixtos, descuento individual, sin abono', async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await pos.agregarProductoNormalFraccionadoYRapido('Apartado', `DescIndSinAbono ${Date.now()}`);

      await test.step('Aplicar descuento individual a cada producto', async () => {
        await aplicarDescuentoIndividualATodos(pos);
      });

      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Dejar el abono en 0 y guardar', async () => {
        await pos.seleccionarPagoEfectivo('0');
        await guardarApartadoYValidar(pos);
      });
    });
  });

  test.describe('Descuento general', () => {
    test('13. Crear un Apartado con productos mixtos, descuento general y abono inicial', async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await pos.agregarProductoNormalFraccionadoYRapido('Apartado', `DescGenConAbono ${Date.now()}`);

      await test.step(`Activar el descuento general del ${DESCUENTO_GENERAL_PCT}% y validar que se aplicó`, async () => {
        const totalAntes = await pos.obtenerTotalVentaNumerico();
        await pos.activarDescuentoGeneral();
        await pos.mostrarDetalleAvanzadoFactura();
        await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);
        const totalDespues = await pos.obtenerTotalVentaNumerico();
        expect(totalDespues, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalAntes);
      });

      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Abonar un monto menor al total y guardar', async () => {
        const monto = await calcularAbonoParcial(pos);
        await pos.seleccionarPagoEfectivo(monto);
        await guardarApartadoYValidar(pos);
      });
    });

    test('14. Crear un Apartado con productos mixtos, descuento general, sin abono', async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await pos.agregarProductoNormalFraccionadoYRapido('Apartado', `DescGenSinAbono ${Date.now()}`);

      await test.step(`Activar el descuento general del ${DESCUENTO_GENERAL_PCT}% y validar que se aplicó`, async () => {
        const totalAntes = await pos.obtenerTotalVentaNumerico();
        await pos.activarDescuentoGeneral();
        await pos.mostrarDetalleAvanzadoFactura();
        await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);
        const totalDespues = await pos.obtenerTotalVentaNumerico();
        expect(totalDespues, 'El total no bajó tras aplicar el descuento general').toBeLessThan(totalAntes);
      });

      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Dejar el abono en 0 y guardar', async () => {
        await pos.seleccionarPagoEfectivo('0');
        await guardarApartadoYValidar(pos);
      });
    });
  });

  test.describe('Pago mixto', () => {
    test('15. Crear un Apartado con productos mixtos, descuento individual y abono inicial en pago mixto (efectivo + tarjeta)', async ({ pos }) => {
      test.setTimeout(TIMEOUTS.TEST);
      await pos.agregarProductoNormalFraccionadoYRapido('Apartado', `PagoMixto ${Date.now()}`);

      await test.step('Aplicar descuento individual a cada producto', async () => {
        await aplicarDescuentoIndividualATodos(pos);
      });

      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Abonar con pago mixto (tarjeta + efectivo), suma menor al total, y guardar', async () => {
        const total = await pos.obtenerTotalVentaNumerico();
        expect(total).toBeGreaterThan(0);
        const montoTarjeta = (total * 0.25).toFixed(2);
        const montoEfectivo = (total * 0.25).toFixed(2);
        await pos.seleccionarPagoMixto(montoTarjeta, montoEfectivo);
        await guardarApartadoYValidar(pos);
      });
    });
  });
});
