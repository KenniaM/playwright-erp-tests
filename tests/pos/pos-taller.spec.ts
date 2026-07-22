import { test as base, expect, Page } from '@playwright/test';
import {
  PosPage, TIMEOUTS, DESCUENTO_GENERAL_PCT, DESCUENTO_INDIVIDUAL_PCT, PRECIO_PRODUCTO_RAPIDO,
  VEHICULO_PINTURA_TIPO, PESTANAS_POS_A_RECORRER, PESTANA_POS_FACTURACION, espiarErroresJS,
  type LineaCarrito,
} from './pos.page';
import { PosTaller, FormaPagoAbono } from './pos-taller.page';

const PESTANA_TALLER = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Taller')!;

/**
 * Recorre el wizard "End. Pintura" (Vehículo → Parte → Pieza → Servicio) y
 * agrega el primer servicio disponible — misma composición ya usada y
 * verificada en vivo en pos-orden-caja.spec.ts/pos.spec.ts, centralizada
 * aquí para no duplicarla en cada escenario nuevo que también la necesita.
 * Soporta ambos flujos reales del sistema (agregado directo, o con un modal
 * de precios de por medio) reutilizando esperarServicioPinturaAgregadoOModalPrecio()
 * tal cual — nunca asume cuál de los dos va a ocurrir.
 */
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
 * Valida cada línea del carrito contra su propio estado real de IVA (leído
 * primero, nunca asumido) — mismo helper ya adoptado en
 * pos-orden-caja.spec.ts/pos-apartado.spec.ts para el mismo propósito: una
 * orden de Taller arbitraria puede mezclar líneas con y sin IVA.
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
    await test.step('Seleccionar varias órdenes existentes', async () => {
      ids = await taller.obtenerIdsOrdenesConMontoValido(3);
      expect(ids.length, 'Se esperaban al menos 2 órdenes con monto real disponibles en el listado Taller').toBeGreaterThanOrEqual(2);

      await taller.entrarModoSeleccionMasiva();
      for (const id of ids) await taller.marcarOrdenParaSeleccionMasiva(id);
    });

    // "Facturar Seleccionadas" abre el asistente "Facturación Masiva" (2
    // pasos + modal de progreso) — confirmado en vivo que este asistente
    // SOLO carga las líneas de las órdenes seleccionadas en el carrito del
    // POS ("Completado 100%" se refiere a esa carga, no a la venta). La
    // orden real sigue "Pendiente" hasta completar el mismo cierre de venta
    // de cualquier factura del POS: presionar "Facturar", pagar y confirmar.
    await test.step('Facturar Seleccionadas: completar el asistente "Facturación Masiva"', async () => {
      const resultado = await taller.facturarSeleccionadas();
      console.log(`[Escenario 1] "Facturación Masiva" cargó ${resultado.procesadas}/${resultado.total} órdenes al carrito (errores: ${resultado.errores})`);
      expect(resultado.total, 'El asistente debe reportar tantas órdenes como se seleccionaron').toBe(ids.length);
      expect(resultado.procesadas, 'Todas las órdenes seleccionadas deben quedar cargadas en el carrito').toBe(ids.length);
      expect(resultado.errores, 'Ninguna orden debe fallar dentro de la Facturación Masiva').toBe(0);
    });

    await test.step('Facturar y completar el pago del carrito combinado', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      console.log(`[Escenario 1] Total combinado de las ${ids.length} órdenes en el modal de pago: ${total}`);
      expect(total, 'El total a facturar debe ser mayor a cero').toBeGreaterThan(0);

      await pos.seleccionarPagoEfectivo(String(total));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    await test.step('Validar que las órdenes ya no aparecen como pendientes en el listado Taller', async () => {
      await taller.abrirListadoTaller();
      for (const id of ids) {
        const siguenPendientes = await taller.tarjeta(id).isVisible().catch(() => false);
        expect(siguenPendientes, `La orden #${id} debería desaparecer del listado de pendientes tras completar el pago`).toBe(false);
      }
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('2. Ver Orden: validar toda la información mostrada', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesConMontoValido(1);
    expect(id, 'No se encontró ninguna orden visible con monto real (total > 0)').toBeTruthy();
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

    // No toda orden visible sirve para agregar abonos: confirmado en vivo
    // que (a) algunas órdenes tienen monto $0.00 (sin productos/servicios
    // cargados) — el sistema no permite abonar ahí en absoluto —, y (b)
    // tras suficiente actividad de facturación sobre el listado compartido,
    // otras quedan con saldo pendiente $0.00 aunque su monto original sí sea
    // mayor a cero — el sistema rechaza correctamente cualquier abono ahí
    // ("El abono no puede ser mayor al saldo pendiente ($0,00)"). Se prueban
    // varias órdenes existentes (nunca se crea una nueva mientras haya
    // disponibles) hasta encontrar una con monto real Y saldo pendiente
    // suficiente para los 4 abonos de este escenario, mismo criterio que ya
    // usa el Escenario 11 para "sin mecánico asignado".
    const candidatos = await taller.obtenerIdsOrdenesVisibles(10);
    let id = '';
    for (const candidato of candidatos) {
      const datos = await taller.obtenerDatosTarjeta(candidato);
      if (datos.total > 0 && datos.total - datos.abonado > 10) { id = candidato; break; }
    }
    expect(id, `Ninguna de las ${candidatos.length} órdenes probadas (${candidatos.join(', ')}) tiene un monto real con saldo pendiente suficiente para aplicar abonos`).not.toBe('');

    await taller.abrirVerOrden(id);
    await taller.abrirPestanaAbono();

    const metodos: FormaPagoAbono[] = ['Efectivo', 'Tarjeta', 'SINPE MOVIL', 'Transacción'];
    // El test debe soportar tanto una orden completamente nueva (sin
    // abonos) como una que ya traiga uno o más abonos registrados de antes.
    // Confirmado en vivo, dos veces, que el "Historial de Abonos" puede leer
    // menos filas de las reales al primer vistazo de la pestaña (el widget
    // no siempre termina de cargar el histórico completo antes de que se
    // consulte) — esto invalida por igual comparar contra un "saldoPrevio"
    // externo Y contar deltas de filas "antes"/"después": ambos dependen de
    // una lectura inicial que puede estar incompleta. En vez de eso, cada
    // abono se valida identificando SU PROPIA fila nueva por contenido
    // (forma de pago + monto exacto recién aplicado, tomando siempre la
    // última coincidencia — las filas van en orden cronológico ascendente)
    // y comparándola contra SU PROPIO "saldo anterior" de esa misma fila:
    // autoconsistente sin importar cuántos abonos previos existieran ni si
    // el histórico los mostraba correctamente al abrir la pestaña.
    for (const metodo of metodos) {
      await test.step(`Abonar con ${metodo}`, async () => {
        const { cajaSeleccionada } = await taller.aplicarAbono('1', metodo);
        console.log(`[Escenario 3] Abono aplicado con ${metodo}, caja: "${cajaSeleccionada}"`);

        // La tabla "Historial de Abonos" ya abierta no se actualiza sola
        // tras un guardado exitoso — confirmado en vivo con captura de red
        // que el guardado responde 200 casi de inmediato mientras la tabla
        // puede quedar sin la fila nueva indefinidamente. Se cierra y
        // reabre "Ver Orden" para forzar una recarga real del historial
        // antes de validar.
        await taller.cerrarVerOrden();
        await taller.abrirVerOrden(id);
        await taller.abrirPestanaAbono();

        const historial = await taller.obtenerHistorialAbonos();
        expect(historial.length, 'El abono debe quedar registrado en el historial').toBeGreaterThan(0);
        const filasDeEsteAbono = historial.filter((f) => f.formaPago.includes(metodo.split(' ')[0]) && f.abono === 1);
        expect(filasDeEsteAbono.length, `Debe existir una fila del historial con forma de pago "${metodo}" y monto 1`).toBeGreaterThan(0);
        const ultimo = filasDeEsteAbono[filasDeEsteAbono.length - 1];
        expect(ultimo.nuevoSaldo, 'El nuevo saldo de la fila debe ser menor al saldo anterior de esa misma fila').toBeLessThan(ultimo.saldoAnterior);
        expect(ultimo.nuevoSaldo, 'El saldo no puede quedar negativo').toBeGreaterThanOrEqual(0);
      });
    }

    await taller.cerrarVerOrden();
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('4. Ver Orden Online: validar apertura, URL y datos visibles', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesConMontoValido(1);
    expect(id, 'No se encontró ninguna orden visible con monto real (total > 0)').toBeTruthy();
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

    const [id] = await taller.obtenerIdsOrdenesConMontoValido(1);
    expect(id, 'No se encontró ninguna orden visible con monto real (total > 0)').toBeTruthy();
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

    const [id] = await taller.obtenerIdsOrdenesConMontoValido(1);
    expect(id, 'No se encontró ninguna orden visible con monto real (total > 0)').toBeTruthy();
    await taller.abrirEnviarEmail(id);
    await taller.enviarEmail('automatizado@example.com');

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('7. Crear PDF General: validar generación del documento', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesConMontoValido(1);
    expect(id, 'No se encontró ninguna orden visible con monto real (total > 0)').toBeTruthy();
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

    const [id] = await taller.obtenerIdsOrdenesConMontoValido(1);
    expect(id, 'No se encontró ninguna orden visible con monto real (total > 0)').toBeTruthy();
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

    const [id] = await taller.obtenerIdsOrdenesConMontoValido(1);
    expect(id, 'No se encontró ninguna orden visible con monto real (total > 0)').toBeTruthy();
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

    const [id] = await taller.obtenerIdsOrdenesConMontoValido(1);
    expect(id, 'No se encontró ninguna orden visible con monto real (total > 0)').toBeTruthy();
    await taller.imprimirOrden(id);

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('11. PDF Reporte de Inspección: validar generación del documento', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    // No todas las órdenes existentes tienen datos de inspección vehicular
    // cargados: confirmado en vivo que, cuando los servicios de la orden no
    // tienen ningún mecánico asignado, la app solo muestra un toast de
    // advertencia y no genera ningún PDF (ni descarga ni pestaña nueva) — una
    // limitación de los datos de la orden, no un fallo de la generación de
    // PDF en sí. Se reutilizan varias órdenes existentes con monto real
    // (nunca se crea una nueva mientras haya disponibles) hasta encontrar
    // una que sí tenga datos de inspección.
    const ids = await taller.obtenerIdsOrdenesConMontoValido(8);
    let resultado: Awaited<ReturnType<typeof taller.descargarReporteInspeccion>> | null = null;
    let idUsado = '';
    for (const id of ids) {
      resultado = await taller.descargarReporteInspeccion(id).catch(() => null);
      if (resultado) { idUsado = id; break; }
    }
    expect(resultado, `Ninguna de las ${ids.length} órdenes probadas (${ids.join(', ')}) tiene datos de inspección vehicular disponibles para generar el PDF`).not.toBeNull();
    console.log(`[Escenario 11] PDF de Reporte de Inspección generado con la orden #${idUsado}`);

    if (resultado!.tipo === 'download') {
      expect(await resultado!.download.failure(), 'La descarga del Reporte de Inspección falló').toBeNull();
    } else {
      await resultado!.popup.close();
    }

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('12. QR del Vehículo: validar que descargue correctamente la imagen', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesConMontoValido(1);
    expect(id, 'No se encontró ninguna orden visible con monto real (total > 0)').toBeTruthy();
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

    const [id] = await taller.obtenerIdsOrdenesConMontoValido(1);
    expect(id, 'No se encontró ninguna orden visible con monto real (total > 0)').toBeTruthy();
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

    const ids = await taller.obtenerIdsOrdenesConMontoValido(2);
    expect(ids.length, 'Se esperaban al menos 2 órdenes con monto real disponibles en el listado Taller').toBeGreaterThanOrEqual(2);
    const id = ids[ids.length - 1];
    await taller.facturarOrdenPOS(id);

    // La orden de Taller puede llegar al carrito con el descuento general
    // del POS ya activo (heredado de una operación anterior sobre la misma
    // orden/sesión) — confirmado en vivo que, si no se normaliza antes de
    // medir "totalSinDescuento", ese valor ya refleja un descuento parcial
    // en vez del precio pleno, y aplicar el 10% de este escenario termina
    // comparando contra una base incorrecta. Se desactiva primero (mismo
    // helper que ya usa el resto de la suite) para garantizar una base
    // limpia sin importar el estado con el que la orden haya llegado.
    if (await pos.estaDescuentoGeneralActivo()) {
      console.log('[Escenario 14] La orden llegó al carrito con descuento general ya activo — se desactiva para medir el total pleno.');
      await pos.desactivarDescuentoGeneral();
    }

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

// ═══════════════════════════════════════════════════════════════════════════
// Tab "Taller" del POS — Agregar ítems a una orden existente y facturar
// ═══════════════════════════════════════════════════════════════════════════
//
// A diferencia del describe() de arriba (acciones desde el menú de tres
// puntos de la tarjeta), este grupo carga una orden existente al carrito
// (facturarOrdenPOS(), ya existente) y usa el catálogo real de
// Productos/Servicios vía abrirAgregarItem()/volverDesdeAgregarItem() —
// confirmado en vivo que ambos métodos genéricos (ya usados por
// Apartados/Proforma/Órdenes de Caja/Importar Factura) funcionan igual para
// una orden de Taller, sin necesitar ningún locator ni lógica nueva para
// ese paso.

test.describe('Taller (POS) — Agregar ítems a una orden existente', () => {

  test('1. Agregar Producto rápido, Producto normal, Servicio normal y Servicio de End. Pintura, y facturar', async ({ pos, taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    // Cualquier orden existente sirve para este escenario, incluida una sin
    // ningún producto/servicio cargado (monto $0.00) — confirmado en vivo
    // que "AGREGAR ITEMS" (#add_btn_items) aparece igual aunque el carrito
    // quede en 0 filas al seleccionarla. Se usa un click directo sobre la
    // tarjeta (reutilizando el getter `tarjeta()` ya existente) en vez de
    // `facturarOrdenPOS()`: ese método SÍ exige que cargue al menos una
    // línea (correcto para el Escenario 13, que valida justo eso), una
    // condición que no aplica aquí.
    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    expect(id, 'Se esperaba al menos una orden visible en el listado Taller').toBeTruthy();
    const datosOrden = await taller.obtenerDatosTarjeta(id);

    await taller.tarjeta(id).click();
    await pos.abrirAgregarItem();

    let clavesAgregadas: string[] = [];
    await test.step('Agregar Producto rápido, Producto normal, Servicio normal y Servicio de End. Pintura', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido Taller ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);

      const normal = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await pos.agregarProductoDelGridAlCarrito(normal);

      await pos.tabServicios.click();
      await expect.poll(() => pos.tabEstaActivo(pos.tabServicios)).toBe(true);
      // obtenerPrimerServicio() (sin filtrar) puede devolver un servicio que
      // OTRO escenario de este mismo describe() ya agregó al carrito en la
      // misma sesión de worker compartida — confirmado en vivo que la app
      // entonces solo incrementa la cantidad de esa línea existente en vez
      // de crear una fila nueva, y ninguna clave nueva aparece (mismo
      // comportamiento ya documentado para obtenerPrimerProductoNoPresenteEnCarrito()).
      // Se usa la variante "no presente en carrito" (tipoItem=2 = servicio),
      // ya existente para justo este caso (usada por Importar Factura).
      const servicio = await pos.obtenerPrimerProductoNoPresenteEnCarrito(2);
      await pos.agregarProductoAlCarrito(servicio);

      await agregarServicioDeEndPintura(pos);

      clavesAgregadas = await pos.obtenerClavesProductos();
      expect(clavesAgregadas.length, 'Se esperaban al menos 4 ítems nuevos en el carrito').toBeGreaterThanOrEqual(4);
    });

    await test.step('Validar productos, servicios, cantidad de líneas, IVA y totales', async () => {
      const clavesActuales = await pos.obtenerClavesFilasCarrito();
      expect(clavesActuales.length, 'La cantidad de líneas debe incluir los ítems importados de la orden más los agregados').toBeGreaterThanOrEqual(clavesAgregadas.length);
      const lineas = await validarLineasCarritoSegunEstadoReal(pos, clavesActuales);
      await pos.validarResumenImpuestos(lineas);
    });

    await test.step('Volver a la orden (persistencia de los ítems agregados)', async () => {
      await pos.volverDesdeAgregarItem(PESTANA_TALLER);
      const clavesTrasVolver = await pos.obtenerClavesFilasCarrito();
      expect(clavesTrasVolver, 'Los ítems agregados no sobrevivieron al volver a la orden').toEqual(expect.arrayContaining(clavesAgregadas));
    });

    await test.step('Facturar con el total exacto en efectivo', async () => {
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total a facturar debe ser mayor a cero').toBeGreaterThan(0);
      await pos.abrirModalDePago();
      const totalModal = await pos.obtenerTotalVentaNumerico();
      await pos.seleccionarPagoEfectivo(String(totalModal));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    console.log(`[Escenario 1] Orden #${id} (consecutivo ${datosOrden.consecutivo}, cliente "${datosOrden.clienteNombre}", placa "${datosOrden.placa}") facturada con los 4 ítems agregados.`);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('2. Agregar Producto rápido, Producto normal, Servicio normal, Servicio de End. Pintura y Combo existente, aplicar descuento individual y facturar', async ({ pos, taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    expect(id, 'Se esperaba al menos una orden visible en el listado Taller').toBeTruthy();
    const datosOrden = await taller.obtenerDatosTarjeta(id);

    await taller.tarjeta(id).click();
    await pos.abrirAgregarItem();

    let clavesAgregadas: string[] = [];
    await test.step('Agregar Producto rápido, Producto normal, Servicio normal, Servicio de End. Pintura y Combo existente', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido Taller2 ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);

      const normal = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await pos.agregarProductoDelGridAlCarrito(normal);

      const combo = await pos.obtenerPrimerCombo();
      await pos.agregarProductoDelGridAlCarrito(combo);
      // obtenerPrimerCombo() deja activa la categoría "Combos" — volver a
      // "Todos" antes de seguir, mismo criterio ya usado en
      // pos-orden-caja.spec.ts/pos-apartado.spec.ts.
      await pos.categoriaTodos.click();

      await pos.tabServicios.click();
      await expect.poll(() => pos.tabEstaActivo(pos.tabServicios)).toBe(true);
      // obtenerPrimerServicio() (sin filtrar) puede devolver un servicio que
      // OTRO escenario de este mismo describe() ya agregó al carrito en la
      // misma sesión de worker compartida — confirmado en vivo que la app
      // entonces solo incrementa la cantidad de esa línea existente en vez
      // de crear una fila nueva, y ninguna clave nueva aparece (mismo
      // comportamiento ya documentado para obtenerPrimerProductoNoPresenteEnCarrito()).
      // Se usa la variante "no presente en carrito" (tipoItem=2 = servicio),
      // ya existente para justo este caso (usada por Importar Factura).
      const servicio = await pos.obtenerPrimerProductoNoPresenteEnCarrito(2);
      await pos.agregarProductoAlCarrito(servicio);

      await agregarServicioDeEndPintura(pos);

      clavesAgregadas = await pos.obtenerClavesProductos();
      expect(clavesAgregadas.length, 'Se esperaban al menos 5 ítems nuevos en el carrito').toBeGreaterThanOrEqual(5);
    });

    await test.step('Aplicar descuento individual a cada ítem agregado', async () => {
      await pos.desactivarDescuentoGeneral();
      for (const clave of clavesAgregadas) {
        const resultado = await pos.aplicarDescuentoIndividual(clave, DESCUENTO_INDIVIDUAL_PCT);
        console.log(`[Escenario 2] Descuento individual en línea ${clave}: ${resultado.escenario} (solicitado ${resultado.porcentajeSolicitado}%, aplicado ${resultado.porcentajeAplicado}%)`);
      }
    });

    await test.step('Validar productos, servicios, cantidad de líneas, descuentos, IVA y totales', async () => {
      const clavesActuales = await pos.obtenerClavesFilasCarrito();
      expect(clavesActuales.length, 'La cantidad de líneas debe incluir los ítems importados de la orden más los agregados').toBeGreaterThanOrEqual(clavesAgregadas.length);
      const lineas = await validarLineasCarritoSegunEstadoReal(pos, clavesActuales);
      await pos.validarResumenImpuestos(lineas);
    });

    await test.step('Volver a la orden (persistencia de los ítems y descuentos agregados)', async () => {
      await pos.volverDesdeAgregarItem(PESTANA_TALLER);
      const clavesTrasVolver = await pos.obtenerClavesFilasCarrito();
      expect(clavesTrasVolver, 'Los ítems agregados no sobrevivieron al volver a la orden').toEqual(expect.arrayContaining(clavesAgregadas));
    });

    await test.step('Facturar con el total exacto en efectivo', async () => {
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total a facturar debe ser mayor a cero').toBeGreaterThan(0);
      await pos.abrirModalDePago();
      const totalModal = await pos.obtenerTotalVentaNumerico();
      await pos.seleccionarPagoEfectivo(String(totalModal));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    console.log(`[Escenario 2] Orden #${id} (consecutivo ${datosOrden.consecutivo}, cliente "${datosOrden.clienteNombre}", placa "${datosOrden.placa}") facturada con los 5 ítems agregados y descuento individual.`);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('3. Agregar Producto rápido, Producto normal, Servicio normal y Servicio de End. Pintura, aplicar descuento general, volver y facturar', async ({ pos, taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    expect(id, 'Se esperaba al menos una orden visible en el listado Taller').toBeTruthy();
    const datosOrden = await taller.obtenerDatosTarjeta(id);

    await taller.tarjeta(id).click();
    await pos.abrirAgregarItem();

    let clavesAgregadas: string[] = [];
    await test.step('Agregar Producto rápido, Producto normal, Servicio normal y Servicio de End. Pintura', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido Taller3 ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);

      const normal = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await pos.agregarProductoDelGridAlCarrito(normal);

      await pos.tabServicios.click();
      await expect.poll(() => pos.tabEstaActivo(pos.tabServicios)).toBe(true);
      // obtenerPrimerServicio() (sin filtrar) puede devolver un servicio que
      // OTRO escenario de este mismo describe() ya agregó al carrito en la
      // misma sesión de worker compartida — confirmado en vivo que la app
      // entonces solo incrementa la cantidad de esa línea existente en vez
      // de crear una fila nueva, y ninguna clave nueva aparece (mismo
      // comportamiento ya documentado para obtenerPrimerProductoNoPresenteEnCarrito()).
      // Se usa la variante "no presente en carrito" (tipoItem=2 = servicio),
      // ya existente para justo este caso (usada por Importar Factura).
      const servicio = await pos.obtenerPrimerProductoNoPresenteEnCarrito(2);
      await pos.agregarProductoAlCarrito(servicio);

      await agregarServicioDeEndPintura(pos);

      clavesAgregadas = await pos.obtenerClavesProductos();
      expect(clavesAgregadas.length, 'Se esperaban al menos 4 ítems nuevos en el carrito').toBeGreaterThanOrEqual(4);
    });

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

    await test.step('Validar productos, servicios, cantidad de líneas, IVA y totales', async () => {
      const clavesActuales = await pos.obtenerClavesFilasCarrito();
      expect(clavesActuales.length, 'La cantidad de líneas debe incluir los ítems importados de la orden más los agregados').toBeGreaterThanOrEqual(clavesAgregadas.length);
      const lineas = await validarLineasCarritoSegunEstadoReal(pos, clavesActuales);
      await pos.validarResumenImpuestos(lineas);
    });

    await test.step('Volver al detalle de la orden (persistencia de ítems y descuento general)', async () => {
      await pos.volverDesdeAgregarItem(PESTANA_TALLER);
      const clavesTrasVolver = await pos.obtenerClavesFilasCarrito();
      expect(clavesTrasVolver, 'Los ítems agregados no sobrevivieron al volver a la orden').toEqual(expect.arrayContaining(clavesAgregadas));
      const totalTrasVolver = await pos.obtenerTotalVentaNumerico();
      expect(totalTrasVolver, 'El descuento general no persistió tras volver al detalle de la orden').toBeCloseTo(totalConDescuento, 0);
    });

    await test.step('Facturar y validar el estado final', async () => {
      await pos.abrirModalDePago();
      const totalModal = await pos.obtenerTotalVentaNumerico();
      expect(totalModal, 'El total del modal de pago debe reflejar el descuento aplicado').toBeCloseTo(totalConDescuento, 0);
      await pos.seleccionarPagoEfectivo(String(totalModal));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    console.log(`[Escenario 3] Orden #${id} (consecutivo ${datosOrden.consecutivo}, cliente "${datosOrden.clienteNombre}", placa "${datosOrden.placa}") facturada con descuento general.`);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('4. Cambiar a vista expandida, agregar Producto rápido y Producto normal, aplicar Descuento y Exoneración, y facturar', async ({ pos, taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    expect(id, 'Se esperaba al menos una orden visible en el listado Taller').toBeTruthy();
    const datosOrden = await taller.obtenerDatosTarjeta(id);

    await taller.tarjeta(id).click();
    await pos.abrirAgregarItem();

    // "Vista Expandida" es el toggle "Expandir/Encoger" del menú de tres
    // puntos del carrito (#switch_compress, ya expuesto como
    // pos.alternarVistaExpandida()/vistaExpandidaActiva()) — un control
    // completamente distinto al de cuadrícula/lista del catálogo de
    // productos (ese otro par de botones nunca marca "activa" la
    // cuadrícula en el DOM, confirmado en vivo, así que no sirve para
    // validar este paso). Reutiliza el método ya existente y probado.
    await test.step('Cambiar a Vista Expandida y validar el cambio', async () => {
      // alternarVistaExpandida() invierte el estado actual — se comprueba
      // primero para no depender de qué estado haya dejado la sesión
      // compartida del worker (nunca se asume "apagada" de entrada).
      if (!(await pos.vistaExpandidaActiva())) {
        await pos.alternarVistaExpandida();
      }
      expect(await pos.vistaExpandidaActiva(), 'Vista Expandida no quedó activa').toBe(true);
    });

    let clavesAgregadas: string[] = [];
    await test.step('Agregar Producto rápido y Producto normal', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido Taller4 ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);

      // Con Vista Expandida activa, PRODUCT_CONTENT (la grilla de productos)
      // queda oculto (confirmado en vivo, ver el comentario de
      // vistaExpandidaActiva()), así que agregarProductoDelGridAlCarrito()
      // —que requiere clickear la tarjeta— se queda esperando para siempre un
      // elemento no interactuable. El propio sistema expone para este caso un
      // buscador interno que filtra por código (agregarProductoPorCodigoEnVistaExpandida()),
      // ya usado en pos-navegacion/pos-ruteo/pos-proforma/pos-orden-caja.
      const { codigo } = await pos.obtenerPrimerProductoNormalConCodigoNoPresenteEnCarrito();
      const clavesAntesDeNormal = await pos.obtenerClavesProductos();
      await pos.agregarProductoPorCodigoEnVistaExpandida(codigo);
      await expect.poll(async () => (await pos.obtenerClavesProductos()).length).toBeGreaterThan(clavesAntesDeNormal.length);

      clavesAgregadas = await pos.obtenerClavesProductos();
      expect(clavesAgregadas.length, 'Se esperaban al menos 2 ítems nuevos en el carrito').toBeGreaterThanOrEqual(2);
    });

    let montoDescuento = 0;
    let montoExoneracion = 0;
    await test.step(`Aplicar Descuento General del ${DESCUENTO_GENERAL_PCT}% y Exoneración del ${DESCUENTO_GENERAL_PCT}%`, async () => {
      await pos.activarDescuentoGeneral();
      await pos.mostrarDetalleAvanzadoFactura();
      await pos.establecerPorcentajeDescuentoGeneral(DESCUENTO_GENERAL_PCT);
      montoDescuento = await pos.obtenerMontoDescuentoGeneralNumerico();
      expect(montoDescuento, 'El monto de Descuento General no quedó reflejado en los totales').toBeGreaterThan(0);

      await pos.abrirModalExoneracion();
      await pos.aplicarExoneracion(DESCUENTO_GENERAL_PCT);
      montoExoneracion = await pos.obtenerMontoExoneracionNumerico();
      expect(montoExoneracion, 'El monto de Exoneración no quedó reflejado en los totales').toBeGreaterThan(0);
    });

    await test.step('Validar productos, cantidad de líneas, descuentos, IVA y totales', async () => {
      const clavesActuales = await pos.obtenerClavesFilasCarrito();
      expect(clavesActuales.length, 'La cantidad de líneas debe incluir los ítems importados de la orden más los agregados').toBeGreaterThanOrEqual(clavesAgregadas.length);
      const lineas = await validarLineasCarritoSegunEstadoReal(pos, clavesActuales);
      await pos.validarResumenImpuestos(lineas);
    });

    await test.step('Facturar', async () => {
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total a facturar debe ser mayor a cero').toBeGreaterThan(0);
      await pos.abrirModalDePago();
      const totalModal = await pos.obtenerTotalVentaNumerico();
      await pos.seleccionarPagoEfectivo(String(totalModal));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    console.log(`[Escenario 4] Orden #${id} (consecutivo ${datosOrden.consecutivo}, cliente "${datosOrden.clienteNombre}", placa "${datosOrden.placa}") facturada con descuento (${montoDescuento}) y exoneración (${montoExoneracion}).`);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('5. Cambiar a modo Lista, agregar Producto rápido, Producto normal, Combo existente, Servicio normal y Servicio de End. Pintura, y facturar', async ({ pos, taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    expect(id, 'Se esperaba al menos una orden visible en el listado Taller').toBeTruthy();
    const datosOrden = await taller.obtenerDatosTarjeta(id);

    await taller.tarjeta(id).click();
    await pos.abrirAgregarItem();

    await test.step('Cambiar el catálogo a modo Lista y validar el cambio', async () => {
      await pos.botonVistaLista.click();
      await expect.poll(() => pos.vistaEstaActiva(pos.botonVistaLista)).toBe(true);
    });

    let clavesAgregadas: string[] = [];
    await test.step('Agregar Producto rápido, Producto normal, Combo existente, Servicio normal y Servicio de End. Pintura, en modo Lista', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido Taller5 ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);

      const normal = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await pos.agregarProductoDelGridAlCarrito(normal);

      const combo = await pos.obtenerPrimerCombo();
      await pos.agregarProductoDelGridAlCarrito(combo);
      await pos.categoriaTodos.click();

      await pos.tabServicios.click();
      await expect.poll(() => pos.tabEstaActivo(pos.tabServicios)).toBe(true);
      // obtenerPrimerServicio() (sin filtrar) puede devolver un servicio que
      // OTRO escenario de este mismo describe() ya agregó al carrito en la
      // misma sesión de worker compartida — confirmado en vivo que la app
      // entonces solo incrementa la cantidad de esa línea existente en vez
      // de crear una fila nueva, y ninguna clave nueva aparece (mismo
      // comportamiento ya documentado para obtenerPrimerProductoNoPresenteEnCarrito()).
      // Se usa la variante "no presente en carrito" (tipoItem=2 = servicio),
      // ya existente para justo este caso (usada por Importar Factura).
      const servicio = await pos.obtenerPrimerProductoNoPresenteEnCarrito(2);
      await pos.agregarProductoAlCarrito(servicio);

      await agregarServicioDeEndPintura(pos);

      clavesAgregadas = await pos.obtenerClavesProductos();
      expect(clavesAgregadas.length, 'Se esperaban al menos 5 ítems nuevos en el carrito').toBeGreaterThanOrEqual(5);
    });

    await test.step('Validar productos, servicios, cantidad de líneas, IVA y totales', async () => {
      const clavesActuales = await pos.obtenerClavesFilasCarrito();
      expect(clavesActuales.length, 'La cantidad de líneas debe incluir los ítems importados de la orden más los agregados').toBeGreaterThanOrEqual(clavesAgregadas.length);
      const lineas = await validarLineasCarritoSegunEstadoReal(pos, clavesActuales);
      await pos.validarResumenImpuestos(lineas);
    });

    await test.step('Facturar con el total exacto en efectivo', async () => {
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total a facturar debe ser mayor a cero').toBeGreaterThan(0);
      await pos.abrirModalDePago();
      const totalModal = await pos.obtenerTotalVentaNumerico();
      await pos.seleccionarPagoEfectivo(String(totalModal));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    console.log(`[Escenario 5] Orden #${id} (consecutivo ${datosOrden.consecutivo}, cliente "${datosOrden.clienteNombre}", placa "${datosOrden.placa}") facturada con los 5 ítems agregados en modo Lista.`);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('6. Cambiar a modo Lista, agregar 5 tipos de ítem y facturar a Crédito', async ({ pos, taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    const [id] = await taller.obtenerIdsOrdenesVisibles(1);
    expect(id, 'Se esperaba al menos una orden visible en el listado Taller').toBeTruthy();
    const datosOrden = await taller.obtenerDatosTarjeta(id);

    await taller.tarjeta(id).click();
    await pos.abrirAgregarItem();

    await test.step('Cambiar el catálogo a modo Lista y validar el cambio', async () => {
      await pos.botonVistaLista.click();
      await expect.poll(() => pos.vistaEstaActiva(pos.botonVistaLista)).toBe(true);
    });

    let clavesAgregadas: string[] = [];
    await test.step('Agregar Producto rápido, Producto normal, Combo existente, Servicio normal y Servicio de End. Pintura, en modo Lista', async () => {
      await pos.agregarProductoRapidoSimple(`Rápido Taller6 ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);

      const normal = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await pos.agregarProductoDelGridAlCarrito(normal);

      const combo = await pos.obtenerPrimerCombo();
      await pos.agregarProductoDelGridAlCarrito(combo);
      await pos.categoriaTodos.click();

      await pos.tabServicios.click();
      await expect.poll(() => pos.tabEstaActivo(pos.tabServicios)).toBe(true);
      const servicio = await pos.obtenerPrimerProductoNoPresenteEnCarrito(2);
      await pos.agregarProductoAlCarrito(servicio);

      await agregarServicioDeEndPintura(pos);

      clavesAgregadas = await pos.obtenerClavesProductos();
      expect(clavesAgregadas.length, 'Se esperaban al menos 5 ítems nuevos en el carrito').toBeGreaterThanOrEqual(5);
    });

    await test.step('Validar productos, servicios, cantidad de líneas, IVA y totales', async () => {
      const clavesActuales = await pos.obtenerClavesFilasCarrito();
      expect(clavesActuales.length, 'La cantidad de líneas debe incluir los ítems importados de la orden más los agregados').toBeGreaterThanOrEqual(clavesAgregadas.length);
      const lineas = await validarLineasCarritoSegunEstadoReal(pos, clavesActuales);
      await pos.validarResumenImpuestos(lineas);
    });

    await test.step('Facturar a Crédito y validar que el método de pago quede correctamente configurado', async () => {
      await pos.abrirModalDePago();
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total a facturar debe ser mayor a cero').toBeGreaterThan(0);

      await pos.cambiarTipoPagoEnModalPago('credito');
      expect(await pos.obtenerTipoPagoEnModalPago(), 'El método de pago no quedó configurado como Crédito').toBe('credito');

      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    console.log(`[Escenario 6] Orden #${id} (consecutivo ${datosOrden.consecutivo}, cliente "${datosOrden.clienteNombre}", placa "${datosOrden.placa}") facturada a crédito con los 5 ítems agregados.`);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('7. Buscar una orden mediante el campo de búsqueda y validar que el resultado corresponda exactamente', async ({ taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    // Se busca por la placa (campo único por vehículo) en vez del nombre de
    // cliente genérico ("CITA DE PRUEBA", compartido por casi todas las
    // órdenes de prueba del ambiente — confirmado en vivo que buscar por ese
    // nombre no reduce el conteo de tarjetas en absoluto, al matchear
    // prácticamente todas). La placa sí distingue una orden real de las demás.
    const idsAntes = await taller.obtenerIdsOrdenesVisibles();
    expect(idsAntes.length, 'Se esperaba al menos una orden visible en el listado Taller').toBeGreaterThan(0);
    const datosBuscados = await taller.obtenerDatosTarjeta(idsAntes[0]);
    expect(datosBuscados.placa.length, 'La orden elegida para buscar debe tener una placa real').toBeGreaterThan(0);

    await taller.buscarOrdenesTallerPorTexto(datosBuscados.placa);

    const idsDespues = await taller.obtenerIdsOrdenesVisibles();
    expect(idsDespues.length, 'La búsqueda por placa debe devolver al menos un resultado').toBeGreaterThan(0);
    expect(idsDespues, 'La orden buscada debe aparecer entre los resultados').toContain(idsAntes[0]);

    for (const id of idsDespues) {
      const datos = await taller.obtenerDatosTarjeta(id);
      expect(datos.placa, `El resultado de la orden #${id} no corresponde con la búsqueda por placa "${datosBuscados.placa}"`).toBe(datosBuscados.placa);
    }

    console.log(`[Escenario 7] Búsqueda por placa "${datosBuscados.placa}": ${idsAntes.length} órdenes antes → ${idsDespues.length} después, todas coincidiendo exactamente.`);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  test('8. Eliminar un producto, agregar Producto rápido con observación, y facturar', async ({ pos, taller, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    // A diferencia de otros escenarios de este grupo, "eliminar un producto"
    // exige que la orden ya traiga al menos uno cargado — se usa
    // obtenerIdsOrdenesConMontoValido() (monto real > 0) en vez de cualquier
    // orden visible, mismo criterio ya usado en el Escenario 3 (Abonos) para
    // el mismo tipo de requisito mínimo funcional.
    const [id] = await taller.obtenerIdsOrdenesConMontoValido(1);
    expect(id, 'No se encontró ninguna orden con al menos un producto/servicio ya cargado para eliminar').toBeTruthy();
    const datosOrden = await taller.obtenerDatosTarjeta(id);

    await taller.tarjeta(id).click();
    await pos.abrirAgregarItem();

    let clavesAntes: string[] = [];
    let claveEliminada = '';
    await test.step('Eliminar un producto ya existente en la orden', async () => {
      clavesAntes = await pos.obtenerClavesFilasCarrito();
      expect(clavesAntes.length, 'La orden debía traer al menos una línea ya cargada').toBeGreaterThan(0);
      claveEliminada = clavesAntes[0];
      await pos.eliminarProductoDelCarrito(claveEliminada);

      const clavesTrasEliminar = await pos.obtenerClavesFilasCarrito();
      expect(clavesTrasEliminar, 'La línea eliminada no debía seguir en el carrito').not.toContain(claveEliminada);
      expect(clavesTrasEliminar.length, 'La cantidad de líneas debe disminuir en 1 tras eliminar el producto').toBe(clavesAntes.length - 1);
    });

    let claveRapido = '';
    const textoObservacion = `Observación de prueba ${Date.now()}`;
    await test.step('Agregar un Producto rápido y una observación asociada a él', async () => {
      const clavesAntesDeAgregar = await pos.obtenerClavesProductos();
      await pos.agregarProductoRapidoSimple(`Rápido Taller8 ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
      const clavesTrasAgregar = await pos.obtenerClavesProductos();
      claveRapido = clavesTrasAgregar.find((c) => !clavesAntesDeAgregar.includes(c))!;
      expect(claveRapido, 'No se pudo identificar la clave del Producto rápido recién agregado').toBeTruthy();

      await pos.agregarObservacionAProducto(claveRapido, textoObservacion);
      const observacionGuardada = await pos.obtenerObservacionDeProducto(claveRapido);
      expect(observacionGuardada, 'La observación no quedó guardada en el producto').toBe(textoObservacion);
    });

    await test.step('Validar cantidad de productos, cantidad de líneas, subtotal, IVA, descuentos y total', async () => {
      const clavesActuales = await pos.obtenerClavesFilasCarrito();
      expect(clavesActuales.length, 'La cantidad de líneas debe reflejar la eliminación y el nuevo producto agregado').toBe(clavesAntes.length - 1 + 1);
      const lineas = await validarLineasCarritoSegunEstadoReal(pos, clavesActuales);
      await pos.validarResumenImpuestos(lineas);

      // La observación debe seguir asociada al producto justo antes de
      // facturar (persistencia real, no solo al momento de agregarla).
      const observacionAntesDeFacturar = await pos.obtenerObservacionDeProducto(claveRapido);
      expect(observacionAntesDeFacturar, 'La observación no persistió hasta el momento de facturar').toBe(textoObservacion);
    });

    await test.step('Facturar con el total exacto en efectivo', async () => {
      const total = await pos.obtenerTotalVentaNumerico();
      expect(total, 'El total a facturar debe ser mayor a cero').toBeGreaterThan(0);
      await pos.abrirModalDePago();
      const totalModal = await pos.obtenerTotalVentaNumerico();
      await pos.seleccionarPagoEfectivo(String(totalModal));
      await pos.confirmarPagoAbriendoCajaSiEsNecesario();
      await pos.validarCarritoVacio();
    });

    console.log(`[Escenario 8] Orden #${id} (consecutivo ${datosOrden.consecutivo}, cliente "${datosOrden.clienteNombre}", placa "${datosOrden.placa}") facturada tras eliminar un producto y agregar uno rápido con observación.`);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});
