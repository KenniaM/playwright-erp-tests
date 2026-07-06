import { test, expect, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT, PRECIO_PRODUCTO_RAPIDO } from './pos.page';

// Producto real y estable del catálogo, ya usado por el resto de la suite
// (pos.spec.ts) para "producto normal" — evita depender de la posición en
// el grid o de un producto de precio variable.
const PRODUCTO_NORMAL = 'FRENOS';
const NOMBRE_TERCERO = 'Tercero De Prueba QA';

// ─── Helpers compartidos ────────────────────────────────────────────────────
// Todos componen métodos ya existentes de PosPage — ninguno reimplementa
// lógica de agregar productos, clientes, descuentos ni esperas.

/**
 * Registra los errores de JavaScript NO capturados (excepciones reales,
 * "pageerror") desde el momento en que se llama, no desde el inicio de la
 * página. Confirmado en vivo: cargarPosDesdeDashboard() dispara de forma
 * consistente un error preexistente y ajeno a esta suite ("$(...).steps is
 * not a function", de un conflicto de plugins en el Dashboard) que no tiene
 * relación con "Enviar a caja" — por eso el espía se arma DESPUÉS de cargar
 * el POS y agregar productos, para no reportar como propio un error que ya
 * existía antes de tocar nada de Orden de Caja.
 */
function espiarErroresJS(page: Page): string[] {
  const errores: string[] = [];
  page.on('pageerror', (err) => errores.push(err.message));
  return errores;
}

/** Carga el POS y agrega un producto de precio fijo — punto de partida común a todos los escenarios. */
async function cargarPosConProducto(pos: PosPage) {
  await pos.cargarPosDesdeDashboard();
  await pos.cerrarModalNotificacionesSiAparece();
  await pos.cerrarAvisoConsecutivoSiAparece();
  await pos.cerrarTodosLosToastsSiAparecen();
  await pos.agregarPrimerProductoDePrecioFijo();
}

/**
 * Agrega un Producto Rápido mínimo (sin tocar CABYS/IVA, no relevante para
 * estos escenarios) — mismo criterio ya confirmado en pos.spec.ts
 * (agregarProductoRapidoParaValidacionIva con activarIva=false): no tocar
 * el checkbox de IVA es la forma real de guardarlo sin IVA en este
 * ambiente.
 */
async function agregarProductoRapidoSimple(pos: PosPage, nombre: string, precio: string) {
  await pos.abrirProductoRapido();
  await pos.llenarDatosBasicosProductoRapido(nombre, precio);
  await pos.guardarProductoRapidoYObtenerRespuesta();
  await expect(pos.modalProductoRapido).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
}

/**
 * Crea un Producto Fraccionado nuevo (mínimo: nombre + fraccionar + precio
 * por caja/fracción, únicos campos obligatorios — mismo criterio ya
 * probado en pos-crear.spec.ts) y lo agrega al carrito. Recarga el POS
 * después de crearlo (cargarPosDesdeDashboard, igual que
 * buscarProductoYAgregarAlCarrito en pos-crear.spec.ts) porque el grid por
 * defecto no refleja productos recién creados — por eso esta función debe
 * llamarse ANTES de agregar cualquier otro producto al carrito en el mismo
 * test: la recarga vacía el carrito.
 */
async function crearYAgregarProductoFraccionado(pos: PosPage, nombre: string): Promise<string> {
  await pos.abrirCrearProducto();
  await pos.llenarNombreProducto(nombre);
  await pos.avanzarPasoInfoGeneralProducto();
  await pos.llenarCostoProducto('1000');
  await pos.activarFraccionarProducto();
  await pos.llenarCostosFraccionadoProducto('9000', '850', '12', '10');
  await pos.avanzarPasoCostosProducto();
  await pos.finalizarCrearProducto();

  await pos.cargarPosDesdeDashboard();
  await pos.cerrarModalNotificacionesSiAparece();
  await pos.cerrarAvisoConsecutivoSiAparece();
  await pos.cerrarTodosLosToastsSiAparecen();

  const clavesAntes = await pos.obtenerClavesProductos();
  await pos.buscarProductoEnGrid(nombre);
  await pos.agregarProductoFraccionadoPorNombre(nombre, '1');
  await expect.poll(
    async () => (await pos.obtenerClavesProductos()).length,
    { timeout: TIMEOUTS.PRODUCTS_LOAD }
  ).toBeGreaterThan(clavesAntes.length);

  const clavesDespues = await pos.obtenerClavesProductos();
  return clavesDespues.find((c) => !clavesAntes.includes(c))!;
}

/**
 * Agrega los tres tipos de producto pedidos (fraccionado primero, ver el
 * comentario de crearYAgregarProductoFraccionado). El producto normal se
 * busca con buscarProductoEnGrid() antes de agregarlo por nombre —
 * confirmado en vivo que la vista por defecto del grid está limitada a un
 * cupo alfabético fijo (mismo caveat ya documentado para
 * PRODUCTO_BUSCADOR_GRID en pos.page.ts) y, tras la cantidad de productos
 * ya creados por el resto de la suite, "FRENOS" dejó de aparecer ahí sin
 * buscarlo explícitamente.
 */
async function agregarProductosMultiples(pos: PosPage, sufijo: string) {
  await crearYAgregarProductoFraccionado(pos, `Fraccionado Orden Caja ${sufijo}`);
  await pos.buscarProductoEnGrid(PRODUCTO_NORMAL);
  await pos.agregarProductoPorNombre(PRODUCTO_NORMAL);
  await agregarProductoRapidoSimple(pos, `Rápido Orden Caja ${sufijo}`, PRECIO_PRODUCTO_RAPIDO);
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
      await pos.cerrarModalNotificacionesSiAparece();
      await pos.cerrarAvisoConsecutivoSiAparece();
      await pos.cerrarTodosLosToastsSiAparecen();
      const erroresJS = espiarErroresJS(page);

      let clavesAntes: string[] = [];
      await test.step('Agregar producto normal, rápido y fraccionado', async () => {
        clavesAntes = await pos.obtenerClavesProductos();
        await agregarProductosMultiples(pos, `contado ${Date.now()}`);
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
      await pos.cerrarModalNotificacionesSiAparece();
      await pos.cerrarAvisoConsecutivoSiAparece();
      await pos.cerrarTodosLosToastsSiAparecen();
      const erroresJS = espiarErroresJS(page);

      await agregarProductosMultiples(pos, `contado desc ${Date.now()}`);

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
      await pos.cerrarModalNotificacionesSiAparece();
      await pos.cerrarAvisoConsecutivoSiAparece();
      await pos.cerrarTodosLosToastsSiAparecen();
      const erroresJS = espiarErroresJS(page);

      await agregarProductosMultiples(pos, `credito ${Date.now()}`);

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
      await pos.cerrarModalNotificacionesSiAparece();
      await pos.cerrarAvisoConsecutivoSiAparece();
      await pos.cerrarTodosLosToastsSiAparecen();
      const erroresJS = espiarErroresJS(page);

      await agregarProductosMultiples(pos, `credito desc ${Date.now()}`);

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
