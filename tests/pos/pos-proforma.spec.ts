import { test, expect, Response } from '@playwright/test';
import { PosPage, TIMEOUTS, TipoProforma, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT, PRECIO_PRODUCTO_RAPIDO } from './pos.page';

// Producto real y estable del catálogo, ya usado por el resto de la suite
// (pos-orden-caja.spec.ts) como "producto normal" — evita depender de la
// posición en el grid o de un producto de precio variable.
const PRODUCTO_NORMAL = 'FRENOS';

const TIPOS_PROFORMA: { tipo: TipoProforma; etiqueta: string }[] = [
  { tipo: 'normal', etiqueta: 'Normal' },
  { tipo: 'consignacion', etiqueta: 'Consignación' },
  { tipo: 'taller', etiqueta: 'Taller' },
];

// ─── Helpers compartidos ────────────────────────────────────────────────────
// Todos componen métodos ya existentes de PosPage — ninguno reimplementa
// lógica de agregar productos, clientes, descuentos ni esperas.

/** Carga el POS y agrega un producto de precio fijo — punto de partida común a todos los escenarios. */
async function cargarPosConProducto(pos: PosPage) {
  await pos.cargarPosDesdeDashboard();
  await pos.cerrarModalNotificacionesSiAparece();
  await pos.cerrarAvisoConsecutivoSiAparece();
  await pos.cerrarTodosLosToastsSiAparecen();
  await pos.buscarProductoEnGrid(PRODUCTO_NORMAL);
  await pos.agregarProductoPorNombre(PRODUCTO_NORMAL);
}

/**
 * Agrega los tres tipos de producto pedidos (fraccionado primero: crea uno
 * nuevo y recarga el POS, lo que vaciaría cualquier producto ya agregado —
 * mismo orden y motivo ya usados en pos-orden-caja.spec.ts). El producto
 * normal se busca con buscarProductoEnGrid() antes de agregarlo por nombre,
 * igual que el resto de la suite, para no depender de la vista por defecto
 * del grid.
 */
async function agregarProductosMixtos(pos: PosPage, sufijo: string) {
  await pos.crearYAgregarProductoFraccionadoSimple(`Fraccionado Proforma ${sufijo}`);
  await pos.buscarProductoEnGrid(PRODUCTO_NORMAL);
  await pos.agregarProductoPorNombre(PRODUCTO_NORMAL);
  await pos.agregarProductoRapidoSimple(`Rápido Proforma ${sufijo}`, PRECIO_PRODUCTO_RAPIDO);
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

// ═══════════════════════════════════════════════════════════════════════════
// Crear Proformas
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Proformas — Crear', () => {

  test.describe('Cliente', () => {
    for (const { tipo, etiqueta } of TIPOS_PROFORMA) {
      test(`Crear una Proforma ${etiqueta} con un cliente existente`, async ({ page }) => {
        test.setTimeout(TIMEOUTS.TEST);
        const pos = new PosPage(page);
        await cargarPosConProducto(pos);

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
      test(`Crear una Proforma ${etiqueta} utilizando únicamente el nombre del cliente`, async ({ page }) => {
        test.setTimeout(TIMEOUTS.TEST);
        const pos = new PosPage(page);
        await cargarPosConProducto(pos);

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
      test(`Crear una Proforma ${etiqueta} seleccionando un vendedor`, async ({ page }) => {
        test.setTimeout(TIMEOUTS.TEST);
        const pos = new PosPage(page);
        await cargarPosConProducto(pos);

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
      test(`Crear una Proforma ${etiqueta} con producto normal, rápido y fraccionado, y vendedor`, async ({ page }) => {
        test.setTimeout(TIMEOUTS.TEST);
        const pos = new PosPage(page);
        await pos.cargarPosDesdeDashboard();
        await pos.cerrarModalNotificacionesSiAparece();
        await pos.cerrarAvisoConsecutivoSiAparece();
        await pos.cerrarTodosLosToastsSiAparecen();

        const monedaOriginal = tipo === 'taller' ? await pos.asegurarMonedaBaseActiva() : null;
        try {
          let clavesAntes: string[] = [];
          await test.step('Agregar producto normal, rápido y fraccionado', async () => {
            clavesAntes = await pos.obtenerClavesProductos();
            await agregarProductosMixtos(pos, `${etiqueta} ${Date.now()}`);
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
      test(`Crear una Proforma ${etiqueta} con productos mixtos aplicando descuento individual`, async ({ page }) => {
        test.setTimeout(TIMEOUTS.TEST);
        const pos = new PosPage(page);
        await pos.cargarPosDesdeDashboard();
        await pos.cerrarModalNotificacionesSiAparece();
        await pos.cerrarAvisoConsecutivoSiAparece();
        await pos.cerrarTodosLosToastsSiAparecen();

        const monedaOriginal = tipo === 'taller' ? await pos.asegurarMonedaBaseActiva() : null;
        try {
          await agregarProductosMixtos(pos, `Desc Individual ${etiqueta} ${Date.now()}`);
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
      test(`Crear una Proforma ${etiqueta} con productos mixtos, vendedor y descuento general`, async ({ page }) => {
        test.setTimeout(TIMEOUTS.TEST);
        const pos = new PosPage(page);
        await pos.cargarPosDesdeDashboard();
        await pos.cerrarModalNotificacionesSiAparece();
        await pos.cerrarAvisoConsecutivoSiAparece();
        await pos.cerrarTodosLosToastsSiAparecen();

        const monedaOriginal = tipo === 'taller' ? await pos.asegurarMonedaBaseActiva() : null;
        try {
          await agregarProductosMixtos(pos, `Desc General ${etiqueta} ${Date.now()}`);

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
});

// ═══════════════════════════════════════════════════════════════════════════
// Gestión de Proforma (modal que aparece automáticamente tras guardar)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Proformas — Gestión', () => {

  test('Enviar una Proforma por correo (creada con cliente existente)', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    await cargarPosConProducto(pos);

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
        page.locator('.noty_bar', { hasText: /enviada/i }),
        'No apareció el mensaje de confirmación de envío por correo'
      ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    });
  });

  test('Imprimir una Proforma', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    await cargarPosConProducto(pos);

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
  });

  test('Descargar el PDF de una Proforma', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    await cargarPosConProducto(pos);

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
  });

  test('Ver todas las Proformas desde el modal de gestión', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    await cargarPosConProducto(pos);

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
  });
});
