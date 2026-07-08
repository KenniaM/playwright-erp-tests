import { test, expect } from '@playwright/test';
import { PosPage, TIMEOUTS, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT, PRECIO_PRODUCTO_RAPIDO, espiarErroresJS } from './pos.page';

// ─── Helpers compartidos ────────────────────────────────────────────────────
// Todos componen métodos ya existentes de PosPage — ninguno reimplementa
// lógica de facturación, productos, descuentos ni esperas.
//
// IMPORTANTE: cargarPosDesdeDashboard(), nunca cargarPosYCerrarModalSiAparece()
// — mismo criterio ya usado en pos-proforma.spec.ts/pos-orden-caja.spec.ts/
// pos-apartado.spec.ts (ver el comentario de abrirCrearApartado() en pos.page.ts).

/** Carga el POS vía Dashboard, asegura la caja abierta, e importa la primera factura disponible. */
async function cargarPosEImportarFactura(pos: PosPage) {
  await pos.cargarPosDesdeDashboard();
  await pos.cerrarOverlaysConocidos();
  if (await pos.modalAbrirCajaVisible()) {
    await pos.completarAperturaCaja();
  }
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

// ═══════════════════════════════════════════════════════════════════════════
// Importar Factura
// ═══════════════════════════════════════════════════════════════════════════
//
// Cada test es independiente: carga su propio POS, importa su propia factura
// y no depende del resultado de ningún otro test. Las facturas del catálogo
// pueden tener cliente asociado o ser "Cliente de contado" indistintamente —
// confirmado en vivo (Fase 1) que la propia app sincroniza #customer_select
// en ambos casos sin necesitar lógica especial de este lado, así que ningún
// escenario distingue entre ambos casos.

test.describe('Importar Factura', () => {

  test('1. Seleccionar una factura, importarla y facturar normalmente', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const erroresJS = espiarErroresJS(page);
    await cargarPosEImportarFactura(pos);

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

  test('2. Seleccionar una factura, importarla, agregar un producto rápido y facturar en efectivo', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const erroresJS = espiarErroresJS(page);
    await cargarPosEImportarFactura(pos);

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

  test('3. Seleccionar una factura, importarla, agregar dos productos rápidos, aplicar descuento individual y facturar con pago mixto (efectivo + tarjeta)', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const erroresJS = espiarErroresJS(page);
    await cargarPosEImportarFactura(pos);

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

  test('4. Seleccionar una factura, importarla, agregar dos productos rápidos, aplicar descuento general y facturar con pago mixto (efectivo + tarjeta)', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const erroresJS = espiarErroresJS(page);
    await cargarPosEImportarFactura(pos);

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
});
