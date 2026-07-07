import { test, expect, Response } from '@playwright/test';
import { PosPage, TIMEOUTS, METODO, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT, espiarErroresJS } from './pos.page';

// ─── Helpers compartidos ────────────────────────────────────────────────────
// Todos componen métodos ya existentes de PosPage — ninguno reimplementa
// lógica de agregar productos, clientes, descuentos, pagos ni esperas.
//
// IMPORTANTE: siempre cargarPosDesdeDashboard(), nunca cargarPosYCerrarModalSiAparece()
// (ver el comentario de abrirCrearApartado() en pos.page.ts) — cargar directo a
// la URL del POS dispara una condición de carga en frío ya documentada que
// puede impedir que el modal de Apartado llegue a mostrarse. Mismo patrón que
// ya usan pos-proforma.spec.ts y pos-orden-caja.spec.ts.

/** Carga el POS vía Dashboard, asegura la caja abierta y agrega un producto de precio fijo. */
async function cargarPosConProducto(pos: PosPage) {
  await pos.cargarPosDesdeDashboard();
  await pos.cerrarOverlaysConocidos();
  if (await pos.modalAbrirCajaVisible()) {
    await pos.completarAperturaCaja();
  }
  await pos.agregarPrimerProductoDePrecioFijo();
}

/** Carga el POS vía Dashboard y asegura la caja abierta, sin agregar ningún producto todavía — usado por los escenarios que agregan su propia combinación de productos. */
async function cargarPos(pos: PosPage) {
  await pos.cargarPosDesdeDashboard();
  await pos.cerrarOverlaysConocidos();
  if (await pos.modalAbrirCajaVisible()) {
    await pos.completarAperturaCaja();
  }
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
// Cada test es independiente: carga su propio POS, agrega sus propios
// productos y no depende del resultado de ningún otro test.

test.describe('Apartados — Crear', () => {

  test.describe('Cliente', () => {
    test('1. Crear un Apartado seleccionando el cliente desde arriba del carrito (Forma 1)', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      const erroresJS = espiarErroresJS(page);

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

    test('2. Crear un Apartado seleccionando el cliente desde el modal (Forma 2)', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      const erroresJS = espiarErroresJS(page);

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
    test('3. Crear un Apartado sin abono inicial', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Dejar el abono en 0 y guardar', async () => {
        await pos.seleccionarPagoEfectivo('0');
        await guardarApartadoYValidar(pos);
      });
    });

    test('4. Crear un Apartado con abono inicial en efectivo', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Abonar en efectivo un monto menor al total y guardar', async () => {
        const monto = await calcularAbonoParcial(pos);
        await pos.seleccionarPagoEfectivo(monto);
        await guardarApartadoYValidar(pos);
      });
    });

    test('5. Crear un Apartado con abono inicial en tarjeta', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Abonar con tarjeta un monto menor al total y guardar', async () => {
        const monto = await calcularAbonoParcial(pos);
        await pos.seleccionarPagoParcial(METODO.TARJETA, monto);
        await guardarApartadoYValidar(pos);
      });
    });

    test('6. Crear un Apartado con abono inicial en SINPE (tercera opción)', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Abonar con SINPE un monto menor al total y guardar', async () => {
        const monto = await calcularAbonoParcial(pos);
        await pos.seleccionarPagoParcial(METODO.SINPE, monto);
        await guardarApartadoYValidar(pos);
      });
    });

    test('7. Crear un Apartado con abono inicial en transacción', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      await pos.seleccionarClienteExistente();
      await pos.abrirCrearApartado();

      await test.step('Abonar con transacción un monto menor al total y guardar', async () => {
        const monto = await calcularAbonoParcial(pos);
        await pos.seleccionarPagoParcial(METODO.TRANSACCION, monto);
        await guardarApartadoYValidar(pos);
      });
    });

    test('8. Crear un Apartado con abono inicial mixto (efectivo + tarjeta)', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
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
    test('9. Crear un Apartado con producto normal, rápido y fraccionado, con abono inicial', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPos(pos);

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

    test('10. Crear un Apartado con producto normal, rápido y fraccionado, sin abono', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPos(pos);

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
    test('11. Crear un Apartado con productos mixtos, descuento individual y abono inicial', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPos(pos);
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

    test('12. Crear un Apartado con productos mixtos, descuento individual, sin abono', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPos(pos);
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
    test('13. Crear un Apartado con productos mixtos, descuento general y abono inicial', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPos(pos);
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

    test('14. Crear un Apartado con productos mixtos, descuento general, sin abono', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPos(pos);
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
    test('15. Crear un Apartado con productos mixtos, descuento individual y abono inicial en pago mixto (efectivo + tarjeta)', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPos(pos);
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
