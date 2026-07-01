import { test, expect, Page } from '@playwright/test';
import { PosPage, METODO, MONTO_EFECTIVO, DESCUENTO_INDIVIDUAL_PCT, TIMEOUTS, ResultadoDescuento } from './pos.page';

/**
 * Carga el POS y decide qué hacer con el modal "Abrir Caja" si aparece: lo valida y
 * lo cierra sin completar la apertura, ya que agregar productos no requiere la caja
 * abierta (eso se decide más adelante, al facturar). Comportamiento esperado, no un error.
 */
async function cargarPosYCerrarModalSiAparece(pos: PosPage) {
  await pos.irAlPos();
  await pos.esperarEstadoInicial();
  if (await pos.modalAbrirCajaVisible()) {
    await expect(pos.modalAbrirCaja).toBeVisible();
    await expect(pos.modalAbrirCaja.getByText('Caja: Cerrada')).toBeVisible();
    await pos.cerrarModalAbrirCaja();
  }
}

/**
 * Presiona el primer "Facturar" (abre el modal de pago). Este botón nunca requiere
 * abrir la caja —eso solo puede ocurrir al confirmar el pago, más adelante— así que
 * aquí no se valida ni se intenta abrir la caja en ningún caso.
 */
async function abrirModalDePago(pos: PosPage) {
  await pos.presionarFacturar();
  await pos.esperarModalPago();
}

/**
 * Presiona el "Facturar" del modal de pago (confirma el pago) y monitorea lo que
 * ocurre después, sin asumir que el modal "Abrir Caja" —si aparece— lo hace
 * inmediatamente: el backend puede tardar en procesar la solicitud antes de
 * mostrarlo. Por la misma razón, la ventana de impresión puede abrirse de forma
 * síncrona junto con la respuesta del click, así que la espera de ambos eventos
 * (popup y modal) se arma ANTES de cada click —incluidos los reintentos—, nunca
 * después: un listener registrado después del click puede perderse el evento.
 *
 * Si el modal "Abrir Caja" aparece en cualquier momento antes de terminar la
 * facturación (comportamiento esperado, no un error), se valida, se completa la
 * apertura, se confirma que desapareció y se vuelve a presionar "Facturar" —con
 * las esperas nuevamente armadas antes de ese click— hasta obtener el resultado
 * final: la ventana de impresión, que sí forma parte del flujo real del sistema.
 */
async function confirmarPagoAbriendoCajaSiEsNecesario(pos: PosPage, page: Page) {
  const MAX_INTENTOS = 3;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const popupPromise = page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP })
      .then((printPage) => ({ tipo: 'popup' as const, printPage }));
    const modalPromise = pos.modalAbrirCaja.waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP })
      .then(() => ({ tipo: 'modalAbrirCaja' as const }));

    await pos.presionarConfirmarPago();
    await pos.cerrarAvisoConsecutivoSiAparece();

    const resultado = await Promise.race([popupPromise, modalPromise]);

    if (resultado.tipo === 'popup') {
      await pos.mostrarYCerrarVentanaImpresion(resultado.printPage);
      return;
    }

    // El modal "Abrir Caja" apareció: se valida, se completa la apertura y se
    // confirma que desapareció antes de volver al inicio del ciclo, donde se arma
    // una nueva espera de popup/modal antes del siguiente click en "Facturar".
    await expect(pos.modalAbrirCaja).toBeVisible();
    await pos.completarAperturaCaja();
    await expect(pos.modalAbrirCaja).toBeHidden();
  }

  throw new Error(
    `La facturación no se completó tras ${MAX_INTENTOS} intentos de abrir la caja: ` +
    'el sistema siguió pidiendo abrir la caja o nunca mostró la ventana de impresión.'
  );
}

test('facturar producto con efectivo en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir POS y agregar producto al carrito', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
    await pos.agregarPrimerProducto();
  });

  await test.step('Abrir modal de pago', async () => {
    await abrirModalDePago(pos);
  });

  await test.step('Ingresar pago en efectivo', async () => {
    await pos.seleccionarPagoEfectivo(MONTO_EFECTIVO);
  });

  await test.step('Confirmar factura y cerrar impresión', async () => {
    await confirmarPagoAbriendoCajaSiEsNecesario(pos, page);
  });

  await test.step('Validar carrito vacío', async () => {
    await pos.validarCarritoVacio();
  });
});

test('facturar producto con tarjeta en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir POS y agregar producto al carrito', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
    await pos.agregarPrimerProducto();
  });

  await test.step('Abrir modal de pago', async () => {
    await abrirModalDePago(pos);
  });

  await test.step('Seleccionar tarjeta y llenar monto exacto', async () => {
    await pos.seleccionarPagoExacto(METODO.TARJETA);
  });

  await test.step('Confirmar factura y cerrar impresión', async () => {
    await confirmarPagoAbriendoCajaSiEsNecesario(pos, page);
  });

  await test.step('Validar carrito vacío', async () => {
    await pos.validarCarritoVacio();
  });
});

test('facturar producto con SINPE Móvil en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir POS y agregar producto al carrito', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
    await pos.agregarPrimerProducto();
  });

  await test.step('Abrir modal de pago', async () => {
    await abrirModalDePago(pos);
  });

  await test.step('Seleccionar SINPE Móvil y llenar monto exacto', async () => {
    await pos.seleccionarPagoExacto(METODO.SINPE);
  });

  await test.step('Confirmar factura y cerrar impresión', async () => {
    await confirmarPagoAbriendoCajaSiEsNecesario(pos, page);
  });

  await test.step('Validar carrito vacío', async () => {
    await pos.validarCarritoVacio();
  });
});

test('facturar producto con transacción bancaria en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir POS y agregar producto al carrito', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
    await pos.agregarPrimerProducto();
  });

  await test.step('Abrir modal de pago', async () => {
    await abrirModalDePago(pos);
  });

  await test.step('Seleccionar transacción bancaria y llenar monto exacto', async () => {
    await pos.seleccionarPagoExacto(METODO.TRANSACCION);
  });

  await test.step('Confirmar factura y cerrar impresión', async () => {
    await confirmarPagoAbriendoCajaSiEsNecesario(pos, page);
  });

  await test.step('Validar carrito vacío', async () => {
    await pos.validarCarritoVacio();
  });
});

test('facturar dos productos con descuento individual y pago mixto (tarjeta + efectivo)', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  let clavesProductos: string[] = [];
  let totalAntes = 0;
  let resultadosDescuento: ResultadoDescuento[] = [];

  await test.step('Cargar el POS y validar el modal "Abrir Caja" si aparece', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
    // Escenario 1 (no apareció) o tras cerrar el modal: el POS debe seguir funcionando.
  });

  await test.step('Agregar dos productos al carrito', async () => {
    await pos.agregarPrimerProducto();       // producto índice 0 (FRENOS)
    await pos.agregarProductoPorIndice(2);   // producto índice 2 (PRODUCTO CON 13%)
  });

  await test.step('Desactivar descuento general si está activo', async () => {
    await pos.desactivarDescuentoGeneral();
  });

  await test.step('Registrar total de venta y claves antes de aplicar descuentos', async () => {
    clavesProductos = await pos.obtenerClavesProductos();
    totalAntes      = await pos.obtenerTotalVentaNumerico();
    expect(clavesProductos.length).toBeGreaterThanOrEqual(2);
    expect(totalAntes).toBeGreaterThan(0);
  });

  await test.step(`Aplicar descuento del ${DESCUENTO_INDIVIDUAL_PCT}% por producto — adaptarse a reglas del sistema`, async () => {
    for (const clave of clavesProductos) {
      const r = await pos.aplicarDescuentoIndividual(clave, DESCUENTO_INDIVIDUAL_PCT);
      resultadosDescuento.push(r);

      // Validar el escenario que respondió el sistema
      if (r.escenario === 'sin_descuento') {
        // Producto sin descuento: mensaje esperado y porcentaje aplicado = 0
        expect(parseFloat(r.porcentajeAplicado)).toBe(0);
      } else if (r.escenario === 'maximo_superado') {
        // Descuento capado al máximo: se aplicó algo, pero menos de lo solicitado
        expect(parseFloat(r.porcentajeAplicado)).toBeGreaterThan(0);
        expect(parseFloat(r.porcentajeAplicado)).toBeLessThan(parseFloat(DESCUENTO_INDIVIDUAL_PCT));
      } else {
        // Descuento aplicado exactamente
        expect(parseFloat(r.porcentajeAplicado)).toBeCloseTo(parseFloat(DESCUENTO_INDIVIDUAL_PCT), 1);
      }
    }
  });

  await test.step('Verificar que los totales reflejan los descuentos efectivamente aplicados', async () => {
    const hayDescuento = resultadosDescuento.some(r => parseFloat(r.porcentajeAplicado) > 0);
    if (hayDescuento) {
      const totalDespues = await pos.obtenerTotalVentaNumerico();
      expect(totalDespues).toBeLessThan(totalAntes);
    }
    // Cada producto debe seguir teniendo un total positivo independientemente del descuento
    for (const clave of clavesProductos) {
      expect(await pos.obtenerTotalProducto(clave)).toBeGreaterThan(0);
    }
  });

  await test.step('Presionar "Facturar": debe abrir el modal de pago (sin intentar abrir caja aquí)', async () => {
    await abrirModalDePago(pos);
  });

  await test.step('Configurar pago mixto: 50% tarjeta + 50% efectivo', async () => {
    const textoTotal = await page.evaluate(
      (id) => document.getElementById(id)?.textContent ?? '',
      'total_sale_txt'
    );
    const totalNum  = parseFloat(textoTotal.replace(/[^0-9.]/g, ''));
    const montoCard = (Math.floor(totalNum * 100 / 2) / 100).toFixed(2);
    const montoCash = (totalNum - parseFloat(montoCard)).toFixed(2);
    await pos.seleccionarPagoMixto(montoCard, montoCash);
  });

  await test.step('Presionar "Facturar" del modal de pago y validar el modal "Abrir Caja" si aparece', async () => {
    // El aviso de consecutivo fuera de rango es una advertencia informativa del
    // sistema, no un error: no debe hacer fallar el test. El criterio de éxito real
    // es el resultado final de la operación, validado en el siguiente paso.
    await confirmarPagoAbriendoCajaSiEsNecesario(pos, page);
  });

  await test.step('Validar resultado final: factura generada y carrito vacío', async () => {
    await pos.validarCarritoVacio();
  });
});

test('Cerrar caja', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir el POS', async () => {
    // El modal "Abrir Caja" al cargar bloquea toda la página (incluido el menú
    // "Caja"), sin importar el estado real de la caja: hay que cerrarlo para poder
    // continuar. Cerrarlo con "Cancelar" no abre la caja, así que no interfiere con
    // la detección de estado que hace el propio flujo de "Abrir/Cerrar Caja (F12)".
    await cargarPosYCerrarModalSiAparece(pos);
  });

  await test.step('Verificar y descartar modales/mensajes opcionales antes del flujo principal', async () => {
    // Ninguno de los dos es parte del flujo de cerrar caja: se comprueban y
    // descartan aquí, en este orden, para que no interfieran con los clicks del
    // menú "Caja" más adelante. Su ausencia es igual de válida que su aparición.
    if (await pos.modalNotificaciones.isVisible().catch(() => false)) {
      await pos.cerrarModalNotificacionesSiAparece();
      await expect(pos.modalNotificaciones).toBeHidden();
    }

    if (await pos.avisoConsecutivoFueraDeRango.isVisible().catch(() => false)) {
      await pos.cerrarAvisoConsecutivoSiAparece();
      await expect(pos.avisoConsecutivoFueraDeRango).toBeHidden();
    }
  });

  await test.step('Abrir el menú "Caja", detectar el estado y cerrarla (abriéndola primero si es necesario)', async () => {
    // El mismo ítem "Abrir/Cerrar Caja (F12)" muestra el modal "Abrir Caja" (cerrada)
    // o "Detalle de Cierre" (abierta): la decisión se basa únicamente en cuál de los
    // dos aparece, nunca se asume de antemano. Además, que la caja parezca abierta
    // en un momento no garantiza que lo siga estando en el siguiente (el sistema
    // puede volver a reportarla cerrada de forma asíncrona), así que todo el ciclo
    // —entrar al menú, abrir si hace falta, y finalmente cerrar— se reintenta como
    // una unidad hasta lograrlo, monitoreando continuamente el estado real.
    const MAX_INTENTOS = 5;
    let cerrada = false;

    for (let intento = 1; intento <= MAX_INTENTOS && !cerrada; intento++) {
      await pos.abrirMenuCaja();
      await pos.seleccionarAbrirCerrarCaja();
      await pos.esperarResultadoMenuCaja();

      if (await pos.modalAbrirCajaVisible()) {
        // Escenario: caja cerrada (o se cerró de nuevo). Abrirla y reintentar el
        // ciclo completo desde el menú, sin asumir que quedará abierta de inmediato.
        await expect(pos.modalAbrirCaja).toBeVisible();
        await pos.completarAperturaCaja();
        await expect(pos.modalAbrirCaja).toBeHidden();
        continue;
      }

      // Escenario: caja abierta. Completar y confirmar el cierre.
      await expect(pos.modalCerrarCaja).toBeVisible();
      await pos.completarFormularioCerrarCaja('0', '0', 'Cierre de prueba automatizado');
      await pos.confirmarCerrarCaja();

      cerrada = !(await pos.modalCerrarCaja.isVisible().catch(() => false));
    }

    expect(cerrada, `La caja no quedó cerrada tras ${MAX_INTENTOS} intentos`).toBe(true);
  });

  await test.step('Validar que la caja quedó cerrada y que el sistema no muestra errores', async () => {
    // El modal de cierre debe haber desaparecido y el POS debe seguir funcionando.
    await expect(pos.modalCerrarCaja).toBeHidden();
    await expect(pos.primerProducto).toBeVisible();

    // Verificación independiente (no basada solo en la UI que ya se manipuló):
    // recargar el POS y confirmar que ahora sí pide abrir la caja.
    await pos.irAlPos();
    await pos.esperarEstadoInicial();
    await expect(pos.modalAbrirCaja).toBeVisible();
    await expect(pos.modalAbrirCaja.getByText('Caja: Cerrada')).toBeVisible();

    // No debe quedar ningún mensaje de error visible tras el cierre.
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});
