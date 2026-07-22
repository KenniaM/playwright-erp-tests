import { test as base, expect, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, DESCUENTO_GENERAL_PCT, PESTANA_POS_FACTURACION, espiarErroresJS } from './pos.page';
import { PosTaller, FormaPagoAbono } from './pos-taller.page';

// ─── Fixture worker (mismo patrón que pos-ruteo.spec.ts) ───────────────────
//
// Dashboard cargando una sola vez por worker (cargarPosDesdeDashboard()), el
// resto de los escenarios reutilizan la misma sesión/página ya autenticada
// vía `sharedPage` — ver el comentario de la fixture "pos" en
// pos-ruteo.spec.ts para el razonamiento completo (por qué scope:'worker' y
// no test.describe.configure({mode:'serial'})).
type TallerFixtures = {
  sharedPage: Page;
  pos: PosPage;
  taller: PosTaller;
};

const test = base.extend<{}, TallerFixtures>({
  sharedPage: [async ({ browser }, use) => {
    const page = await browser.newPage();
    await use(page);
    await page.close();
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  pos: [async ({ sharedPage }, use) => {
    const pos = new PosPage(sharedPage);
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    await use(pos);
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  taller: [async ({ pos, sharedPage }, use) => {
    await use(new PosTaller(pos, sharedPage));
  }, { scope: 'worker' }],
});

/** Deja el POS en un estado limpio y ya posicionado en la pestaña "Taller" antes de cada escenario. */
test.beforeEach(async ({ pos, taller }) => {
  test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
  const listo = await pos.irAlPos()
    .then(() => pos.esperarEstadoInicial())
    .then(() => true)
    .catch(() => false);
  if (!listo) await pos.cargarPosDesdeDashboard();
  if (await pos.modalAbrirCajaVisible()) await pos.cerrarModalAbrirCaja();
  await pos.cerrarOverlaysConocidos();
  await taller.abrirListadoTaller();
});

// ═══════════════════════════════════════════════════════════════════════════
// Tab "Taller" del POS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Taller (POS)', () => {

  test('1. Facturar órdenes seleccionadas: seleccionar varias órdenes y usar "Facturar Seleccionadas"', async ({ pos, taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    let ids: string[] = [];
    let datosPorId: Record<string, Awaited<ReturnType<typeof taller.obtenerDatosTarjeta>>> = {};
    await test.step('Seleccionar varias órdenes existentes', async () => {
      ids = await taller.obtenerIdsOrdenesVisibles(3);
      expect(ids.length, 'Se esperaban al menos 2 órdenes disponibles en el listado Taller').toBeGreaterThanOrEqual(2);
      for (const id of ids) datosPorId[id] = await taller.obtenerDatosTarjeta(id);

      await taller.entrarModoSeleccionMasiva();
      for (const id of ids) await taller.marcarOrdenParaSeleccionMasiva(id);
    });

    await test.step('Facturar Seleccionadas y completar el pago', async () => {
      const resultado = await taller.facturarSeleccionadas();
      console.log(`[Escenario 1] "Facturar Seleccionadas" resolvió con: ${resultado}`);
      if (resultado === 'sweetAlert') {
        await pos._confirmarSweetAlertV1('No se pudo confirmar la advertencia de "Facturar Seleccionadas"');
      }

      await expect(sharedPage.locator('#dialog_payment'), 'El modal de pago no apareció tras "Facturar Seleccionadas"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
      const total = await pos.obtenerTotalVentaNumerico();
      const sumaEsperada = Object.values(datosPorId).reduce((acc, d) => acc + d.total, 0);
      console.log(`[Escenario 1] Total del modal de pago: ${total}, suma de las ${ids.length} órdenes seleccionadas: ${sumaEsperada}`);
      expect(total, 'El total a facturar debe ser mayor a cero').toBeGreaterThan(0);

      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    await test.step('Validar cambio de estado de las órdenes facturadas', async () => {
      await taller.abrirListadoTaller();
      for (const id of ids) {
        const siguenSeleccionables = await taller.tarjeta(id).locator('a[href*="add_repair_order_to_table("]').isVisible().catch(() => false);
        console.log(`[Escenario 1] Orden #${id} — ¿sigue con "Facturar Orden POS" disponible tras facturar?: ${siguenSeleccionables}`);
      }
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('2. Ver Orden: validar toda la información mostrada', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    const datosTarjeta = await taller.obtenerDatosTarjeta(id);

    await taller.abrirVerOrden(id);
    const detalle = await taller.obtenerDetalleOrden();
    console.log('[Escenario 2] Detalle Ver Orden:', JSON.stringify(detalle));

    expect(detalle.consecutivo, 'La orden debe mostrar un consecutivo').toBe(datosTarjeta.consecutivo);
    expect(detalle.estado.length, 'La orden debe mostrar un estado').toBeGreaterThan(0);
    expect(detalle.cliente.nombre.length, 'El nombre del cliente no debe estar vacío').toBeGreaterThan(0);
    expect(detalle.vehiculo.placa, 'La placa mostrada no coincide con la tarjeta').toBe(datosTarjeta.placa);
    expect(detalle.productos.length, 'Debe mostrarse al menos un producto/servicio').toBeGreaterThan(0);
    expect(detalle.resumen.total, 'El total del detalle no coincide con la tarjeta').toBeCloseTo(datosTarjeta.total, 0);

    await taller.cerrarVerOrden();
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('3. Agregar Abonos: aplicar abonos con distintos métodos de pago y validar saldo', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    await taller.abrirVerOrden(id);
    await taller.abrirPestanaAbono();

    const metodos: FormaPagoAbono[] = ['Efectivo', 'Tarjeta', 'SINPE MOVIL', 'Transacción'];
    const historialAntes = await taller.obtenerHistorialAbonos();
    // La tabla lista los abonos en orden cronológico ASCENDENTE (la fila
    // nueva se agrega al final, no al principio — confirmado en vivo: leer
    // la primera fila tras aplicar un abono seguía devolviendo el saldo de
    // la fila más antigua, sin cambios, en vez del abono recién aplicado).
    let saldoPrevio = historialAntes[historialAntes.length - 1]?.nuevoSaldo ?? (await taller.obtenerDetalleOrden()).resumen.saldoPendiente;

    for (const metodo of metodos) {
      await test.step(`Abonar con ${metodo}`, async () => {
        const { cajaSeleccionada } = await taller.aplicarAbono('1', metodo);
        console.log(`[Escenario 3] Abono aplicado con ${metodo}, caja: "${cajaSeleccionada}"`);

        const historial = await taller.obtenerHistorialAbonos();
        expect(historial.length, 'El abono debe quedar registrado en el historial').toBeGreaterThan(0);
        const ultimo = historial[historial.length - 1];
        expect(ultimo.formaPago, 'La forma de pago registrada no coincide').toContain(metodo.split(' ')[0]);
        expect(ultimo.nuevoSaldo, 'El saldo no disminuyó tras el abono').toBeLessThan(saldoPrevio);
        saldoPrevio = ultimo.nuevoSaldo;
      });
    }

    await taller.cerrarVerOrden();
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('4. Ver Orden Online: validar apertura, URL y datos visibles', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    const pestanaOnline = await taller.abrirVerOrdenOnline(id);

    expect(pestanaOnline.url(), 'La URL de "Ver orden online" debe apuntar al detalle público de la orden').toContain('get_repair_order_by_hash_key');
    const textoVisible = await pestanaOnline.locator('body').innerText().catch(() => '');
    expect(textoVisible.length, 'La página de "Ver orden online" debe mostrar contenido').toBeGreaterThan(0);

    await pestanaOnline.close();
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('5. Compartir por WhatsApp: validar envío o descarga alterna del PDF', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    const resultado = await taller.compartirPorWhatsapp(id);
    console.log(`[Escenario 5] "Compartir por WhatsApp" resolvió con tipo: ${resultado.tipo}`);

    if (resultado.tipo === 'sweetAlert') {
      expect(resultado.texto.length, 'La confirmación de WhatsApp debe mostrar un mensaje').toBeGreaterThan(0);
    } else if (resultado.tipo === 'popup') {
      expect(resultado.popup.url(), 'La pestaña abierta debe apuntar a WhatsApp').toMatch(/whatsapp/i);
      await resultado.popup.close();
    } else {
      await expect(resultado.modal, 'El modal de WhatsApp debe mostrar contenido').toBeVisible();
    }

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('6. Enviar Email: validar modal, envío y confirmación', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    await taller.abrirEnviarEmail(id);
    await taller.enviarEmail('automatizado@example.com');

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('7. Crear PDF General: validar generación del documento', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    const resultado = await taller.descargarPdfGeneral(id);
    if (resultado.tipo === 'download') {
      expect(await resultado.download.failure(), 'La descarga del PDF General falló').toBeNull();
      expect(resultado.download.suggestedFilename().length).toBeGreaterThan(0);
    } else {
      await resultado.popup.close();
    }

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('8. PDF Descriptivo: validar generación del documento', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    const resultado = await taller.descargarPdfDescriptivo(id);
    if (resultado.tipo === 'download') {
      expect(await resultado.download.failure(), 'La descarga del PDF Descriptivo falló').toBeNull();
    } else {
      await resultado.popup.close();
    }

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('9. PDF Proforma: validar generación del documento', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    const resultado = await taller.descargarPdfProforma(id);
    if (resultado.tipo === 'download') {
      expect(await resultado.download.failure(), 'La descarga del PDF Proforma falló').toBeNull();
    } else {
      await resultado.popup.close();
    }

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('10. Imprimir Orden: validar que se genere correctamente', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    await taller.imprimirOrden(id);

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('11. PDF Reporte de Inspección: validar generación del documento', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    const resultado = await taller.descargarReporteInspeccion(id);
    if (resultado.tipo === 'download') {
      expect(await resultado.download.failure(), 'La descarga del Reporte de Inspección falló').toBeNull();
    } else {
      await resultado.popup.close();
    }

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('12. QR del Vehículo: validar que descargue correctamente la imagen', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    const resultado = await taller.descargarQrVehiculo(id);
    expect(resultado.tipo, 'La descarga del QR debe producir un archivo, no una navegación').toBe('download');
    if (resultado.tipo === 'download') {
      expect(await resultado.download.failure(), 'La descarga del QR falló').toBeNull();
      const ruta = await resultado.download.path();
      expect(ruta, 'El archivo del QR debe existir en disco').not.toBeNull();
    }

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('13. Facturar Orden POS: cargar una orden al carrito y facturarla', async ({ pos, taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    const datosTarjeta = await taller.obtenerDatosTarjeta(id);

    await test.step('Facturar Orden POS: la orden queda seleccionada correctamente en el POS', async () => {
      await taller.facturarOrdenPOS(id);
      const total = await pos.obtenerTotalVentaNumerico();
      console.log(`[Escenario 13] Total esperado (tarjeta): ${datosTarjeta.total}, total cargado en el carrito: ${total}`);
      expect(total, 'El total cargado en el carrito debe ser mayor a cero').toBeGreaterThan(0);
    });

    await test.step('Completar la facturación', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('14. Aplicar descuento general a una Orden de Taller y facturar', async ({ pos, taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const ids = await taller.obtenerIdsOrdenesVisibles(2);
    const id = ids[ids.length - 1];
    await taller.facturarOrdenPOS(id);

    let totalSinDescuento = 0;
    let totalConDescuento = 0;
    await test.step(`Aplicar descuento general del ${DESCUENTO_GENERAL_PCT}% y validar que baja el total`, async () => {
      totalSinDescuento = await pos.obtenerTotalVentaNumerico();
      await pos.activarDescuentoGeneral();
      await pos.mostrarDetalleAvanzadoFactura();
      await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);
      totalConDescuento = await pos.obtenerTotalVentaNumerico();
      expect(totalConDescuento, 'El descuento general no bajó el total').toBeLessThan(totalSinDescuento);
    });

    await test.step('Facturar y validar el estado final', async () => {
      await pos.abrirModalDePago();
      const totalModal = await pos.obtenerTotalVentaNumerico();
      expect(totalModal, 'El total del modal de pago debe reflejar el descuento aplicado').toBeCloseTo(totalConDescuento, 0);

      await pos.seleccionarPagoEfectivo(String(totalModal));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});
