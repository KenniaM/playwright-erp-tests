import { test, expect, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT, espiarErroresJS } from './pos.page';

const NOMBRE_TERCERO = 'Tercero De Prueba QA';

// ─── Helpers compartidos ────────────────────────────────────────────────────
// Todos componen métodos ya existentes de PosPage — ninguno reimplementa
// lógica de agregar productos, clientes, descuentos ni esperas.

/** Carga el POS y agrega un producto de precio fijo — punto de partida común a todos los escenarios. */
async function cargarPosConProducto(pos: PosPage) {
  await pos.cargarPosDesdeDashboard();
  await pos.cerrarOverlaysConocidos();
  await pos.agregarPrimerProductoDePrecioFijo();
}

/** Ninguna línea de error visible en el carrito — mismo criterio ya usado en pos-crear.spec.ts. */
async function validarSinMensajesDeError(page: Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

// ─── Orden de Caja — Crear ──────────────────────────────────────────────────
//
// Cada test es independiente: carga su propio POS, agrega sus propios
// productos y no depende del resultado de ningún otro test. Estructura
// pensada para crecer: nuevos describe() hermanos de este (Editar, Eliminar,
// Convertir en factura, Buscar/Filtros, Impresión, Historial, Permisos)
// pueden agregarse al mismo nivel que "Crear" más adelante.

test.describe('Orden de Caja — Crear', () => {

  test.describe('Cliente', () => {
    test('1. Crear una Orden de Caja seleccionando el cliente desde la parte superior del carrito', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      const erroresJS = espiarErroresJS(page);

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
        await validarSinMensajesDeError(page);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('2. Crear una Orden de Caja seleccionando el cliente desde el modal de Orden de Caja', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      const erroresJS = espiarErroresJS(page);

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
        await validarSinMensajesDeError(page);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Contado', () => {
    test('3. Crear una Orden de Caja con cliente existente al contado', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      const erroresJS = espiarErroresJS(page);

      await pos.seleccionarClienteExistente();
      await pos.abrirMenuOrdenCaja();

      await test.step('Seleccionar "Contado" (valor por defecto, se confirma igual)', async () => {
        await pos.seleccionarTipoPagoOrdenCaja('contado');
      });

      await pos.llenarObservacionesOrdenCaja('Orden de caja QA - contado, cliente existente');
      const respuesta = await pos.enviarOrdenCaja();

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(page);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('4. Crear una Orden de Caja con cliente existente al contado seleccionando un vendedor', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      const erroresJS = espiarErroresJS(page);

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
        await validarSinMensajesDeError(page);
      });

      expect(nombreVendedor.length).toBeGreaterThan(0);
      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Crédito', () => {
    test('5. Crear una Orden de Caja con cliente existente a crédito', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      const erroresJS = espiarErroresJS(page);

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
        await validarSinMensajesDeError(page);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('6. Crear una Orden de Caja con cliente existente a crédito seleccionando un vendedor', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      const erroresJS = espiarErroresJS(page);

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
        await validarSinMensajesDeError(page);
      });

      expect(nombreVendedor.length).toBeGreaterThan(0);
      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Nombre del cliente', () => {
    test('7. Crear una Orden de Caja utilizando únicamente el nombre del cliente', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      const erroresJS = espiarErroresJS(page);
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
        await validarSinMensajesDeError(page);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Nombre de terceros', () => {
    test('8. Crear una Orden de Caja utilizando únicamente un nombre de cliente y facturando a nombre de terceros', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      const erroresJS = espiarErroresJS(page);
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
        await validarSinMensajesDeError(page);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('9. Crear una Orden de Caja al contado con cliente existente a nombre de terceros', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      const erroresJS = espiarErroresJS(page);

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
        await validarSinMensajesDeError(page);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Descuentos', () => {
    test('10. Crear una Orden de Caja con productos utilizando descuento individual', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      const erroresJS = espiarErroresJS(page);

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
        await validarSinMensajesDeError(page);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('11. Crear una Orden de Caja utilizando descuento general', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await cargarPosConProducto(pos);
      const erroresJS = espiarErroresJS(page);

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
        await validarSinMensajesDeError(page);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Productos múltiples', () => {
    test('12. Crear una Orden de Caja al contado con producto normal, rápido y fraccionado', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await pos.cargarPosDesdeDashboard();
      await pos.cerrarOverlaysConocidos();
      const erroresJS = espiarErroresJS(page);

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
        await validarSinMensajesDeError(page);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('13. Crear una Orden de Caja al contado con producto normal, rápido y fraccionado aplicando descuentos', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await pos.cargarPosDesdeDashboard();
      await pos.cerrarOverlaysConocidos();
      const erroresJS = espiarErroresJS(page);

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
        await validarSinMensajesDeError(page);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('14. Crear una Orden de Caja a crédito con producto normal, rápido y fraccionado', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await pos.cargarPosDesdeDashboard();
      await pos.cerrarOverlaysConocidos();
      const erroresJS = espiarErroresJS(page);

      await pos.agregarProductoNormalFraccionadoYRapido('Orden Caja', `credito ${Date.now()}`);

      // Crédito exige cliente real (ver test 5) — se selecciona antes de abrir el menú.
      await pos.seleccionarClienteExistente();
      await pos.abrirMenuOrdenCaja();
      await pos.seleccionarTipoPagoOrdenCaja('credito');
      await pos.llenarObservacionesOrdenCaja('Orden de caja QA - multiples productos, credito');
      const respuesta = await pos.enviarOrdenCaja();

      await test.step('Validar que la Orden de Caja se creó correctamente', async () => {
        await pos.validarOrdenCajaCreada(respuesta);
        await validarSinMensajesDeError(page);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });

    test('15. Crear una Orden de Caja a crédito con producto normal, rápido y fraccionado aplicando descuentos', async ({ page }) => {
      test.setTimeout(TIMEOUTS.TEST);
      const pos = new PosPage(page);
      await pos.cargarPosDesdeDashboard();
      await pos.cerrarOverlaysConocidos();
      const erroresJS = espiarErroresJS(page);

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
        await validarSinMensajesDeError(page);
      });

      expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    });
  });
});
