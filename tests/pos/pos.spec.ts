import { test, expect, Locator, Page } from '@playwright/test';
import { PosPage, METODO, MONTO_EFECTIVO, DESCUENTO_INDIVIDUAL_PCT, CAJA_TEXTO, TIMEOUTS, ResultadoDescuento, NOMBRE_SERVICIO, VEHICULO_PINTURA_TIPO } from './pos.page';

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
    await expect(pos.modalAbrirCaja.getByText(CAJA_TEXTO)).toBeVisible();
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
 * Espera (con reintentos reales, no una pausa fija) a que la condición de
 * "activo" dada se cumpla — usado para confirmar que una categoría o un tab
 * quedó seleccionado tras hacer click.
 */
async function esperarQuedaActivo(chequeoActivo: () => Promise<boolean>) {
  await expect.poll(chequeoActivo).toBe(true);
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
    await pos.agregarPrimerProductoDePrecioFijo();
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
    await pos.agregarPrimerProductoDePrecioFijo();
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
    await pos.agregarPrimerProductoDePrecioFijo();
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
    await pos.agregarPrimerProductoDePrecioFijo();
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
    // Por nombre exacto, no por posición: el catálogo puede reordenarse en
    // cualquier momento con solo agregar productos nuevos.
    await pos.agregarProductoPorNombre('FRENOS');
    await pos.agregarProductoPorNombre('PRODUCTO CON 13%');
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
    const totalNum  = await pos.obtenerTotalVentaNumerico();
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

test('facturar un servicio del tab Servicios en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir el POS y cerrar overlays conocidos si aparecen', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
  });

  await test.step('Cambiar al tab Servicios y validar que quedó activo', async () => {
    await pos.tabServicios.click();
    await esperarQuedaActivo(() => pos.tabEstaActivo(pos.tabServicios));
  });

  let clavesAntes: string[] = [];
  await test.step('Seleccionar un servicio por nombre y validar que se agregó al carrito', async () => {
    // El tab Servicios repuebla la misma grilla `.product_box_name` que usan los
    // productos (mismo onclick "add_to_table", confirmado inspeccionando el DOM
    // en vivo), así que se reutiliza agregarProductoPorNombre tal cual en vez de
    // duplicar su lógica de búsqueda por nombre exacto.
    clavesAntes = await pos.obtenerClavesProductos();
    await pos.agregarProductoPorNombre(NOMBRE_SERVICIO);
    await expect.poll(async () => (await pos.obtenerClavesProductos()).length).toBeGreaterThan(clavesAntes.length);
  });

  await test.step('Abrir modal de pago', async () => {
    await abrirModalDePago(pos);
  });

  await test.step('Pagar en efectivo', async () => {
    await pos.seleccionarPagoEfectivo(MONTO_EFECTIVO);
  });

  await test.step('Confirmar factura y cerrar impresión', async () => {
    await confirmarPagoAbriendoCajaSiEsNecesario(pos, page);
  });

  await test.step('Validar carrito vacío', async () => {
    await pos.validarCarritoVacio();
  });
});

test('facturar un servicio de End. Pintura en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir el POS y cerrar overlays conocidos si aparecen', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
  });

  await test.step('Cambiar al tab End. Pintura y validar que quedó activo', async () => {
    await pos.tabPintura.click();
    await esperarQuedaActivo(() => pos.tabEstaActivo(pos.tabPintura));
  });

  await test.step('Recorrer el wizard: vehículo → parte → pieza → servicio', async () => {
    // El tipo de vehículo es una lista fija de la interfaz (se selecciona por
    // nombre); parte, pieza y servicio son catálogo configurable por la empresa
    // sin nombre estable, así que se toma la primera opción disponible en cada
    // paso — mismo criterio que ya usa agregarPrimerProductoDePrecioFijo cuando
    // no hay un nombre por el cual buscar.
    await pos.seleccionarVehiculoPintura(VEHICULO_PINTURA_TIPO);
    await pos.seleccionarPrimeraParte();
    await pos.seleccionarPrimeraPieza();
    await pos.seleccionarPrimerServicioPintura();
  });

  let clavesAntes: string[] = [];
  await test.step('Seleccionar un precio en el modal y validar que el servicio se agregó al carrito', async () => {
    clavesAntes = await pos.obtenerClavesProductos();
    await pos.seleccionarPrimerPrecioDisponible();
    await expect.poll(async () => (await pos.obtenerClavesProductos()).length).toBeGreaterThan(clavesAntes.length);
  });

  await test.step('Abrir modal de pago', async () => {
    await abrirModalDePago(pos);
  });

  await test.step('Pagar en efectivo', async () => {
    await pos.seleccionarPagoEfectivo(MONTO_EFECTIVO);
  });

  await test.step('Confirmar factura y cerrar impresión', async () => {
    await confirmarPagoAbriendoCajaSiEsNecesario(pos, page);
  });

  await test.step('Validar carrito vacío', async () => {
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
    //
    // El click sobre el <li> del menú puede quedar bloqueado por un overlay
    // transitorio del encabezado (banner de notificaciones, un toast "noty") que
    // en ese instante ocupe esa esquina — confirmado en vivo inspeccionando el
    // DOM real. Por eso cada vuelta: (1) limpia esos overlays antes de tocar el
    // menú, (2) nunca vuelve a pulsar #menu_cash si el menú ya está desplegado
    // (es un toggle: un segundo click lo cerraría en vez de dejarlo abierto), y
    // (3) nunca vuelve a tocar el menú si algún modal de caja ya está visible —
    // con el modal abierto, #menu_cash queda bloqueado por su backdrop estático
    // hasta agotar su propio timeout, sin lograr nada.
    const MAX_INTENTOS = 5;
    let cerrada = false;

    for (let intento = 1; intento <= MAX_INTENTOS && !cerrada; intento++) {
      const abrirCajaYaVisible = await pos.modalAbrirCajaVisible();
      const cerrarCajaYaVisible = await pos.modalCerrarCaja.isVisible().catch(() => false);

      if (!abrirCajaYaVisible && !cerrarCajaYaVisible) {
        await pos.abrirMenuCaja();
        await pos.seleccionarAbrirCerrarCaja().catch((e) => {
          console.log(`[Cerrar caja] click en "Abrir/Cerrar Caja" no tuvo éxito en el intento ${intento}: ${e.message}`);
        });
        await pos.esperarResultadoMenuCaja().catch(() => {});
      }

      if (await pos.modalAbrirCajaVisible()) {
        // Escenario: caja cerrada (o se cerró de nuevo). Abrirla y reintentar el
        // ciclo completo desde el menú, sin asumir que quedará abierta de inmediato.
        await expect(pos.modalAbrirCaja).toBeVisible();
        await pos.completarAperturaCaja();
        await expect(pos.modalAbrirCaja).toBeHidden();
        continue;
      }

      if (await pos.modalCerrarCaja.isVisible().catch(() => false)) {
        // Escenario: caja abierta. Completar y confirmar el cierre.
        await pos.completarFormularioCerrarCaja('0', '0', 'Cierre de prueba automatizado');
        await pos.confirmarCerrarCaja();
        cerrada = !(await pos.modalCerrarCaja.isVisible().catch(() => false));
        continue;
      }

      // Ninguno de los dos modales apareció: el click pudo haber sido bloqueado
      // por completo (menú nunca se abrió) o el menú quedó abierto pero tapado.
      // La siguiente vuelta vuelve a comprobar el estado real en vez de asumir.
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
    await expect(pos.modalAbrirCaja.getByText(CAJA_TEXTO)).toBeVisible();

    // No debe quedar ningún mensaje de error visible tras el cierre.
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});

test('Abrir Historial de Facturas', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  let historial: Page;

  await test.step('Abrir POS y cerrar modales opcionales si aparecen', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
  });

  await test.step('Abrir el menú de tres puntos y seleccionar "Historial de Facturas"', async () => {
    await pos.abrirMenuTresPuntos();
    historial = await pos.abrirHistorialFacturas();
  });

  await test.step('Validar que la ventana de Historial de Facturas se abrió correctamente', async () => {
    await historial.waitForLoadState('domcontentloaded');
    expect(historial.url()).toContain('printPosReceip');
  });

  await test.step('Cerrar la ventana', async () => {
    await historial.close();
  });
});

test('Abrir Historial de Proformas', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  let proformas: Page;

  await test.step('Abrir POS', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
  });

  await test.step('Cerrar mensaje de consecutivo y modal de permisos si aparecen, antes de usar el menú de tres puntos', async () => {
    // Ambos son avisos opcionales del sistema: pueden aparecer o no, y en
    // ningún caso deben bloquear el resto del flujo.
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarModalNotificacionesSiAparece();
  });

  await test.step('Abrir el menú de tres puntos y seleccionar "Historial de Proformas"', async () => {
    await pos.abrirMenuTresPuntos();
    proformas = await pos.abrirHistorialProformas();
  });

  await test.step('Validar que la ventana de Historial de Proformas se abrió correctamente', async () => {
    await proformas.waitForLoadState('domcontentloaded');
    expect(proformas.url()).toContain('printPosProform');
  });

  await test.step('Cerrar la ventana', async () => {
    await proformas.close();
  });
});

test('Seleccionar una categoría', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir el POS', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
  });

  await test.step('Seleccionar la categoría "Combos"', async () => {
    await pos.categoriaCombos.click();
  });

  await test.step('Validar que la categoría quedó seleccionada', async () => {
    await esperarQuedaActivo(() => pos.categoriaEstaActiva(pos.categoriaCombos));
  });
});

test('Seleccionar los combos de la sección Categorías', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir el POS', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
  });

  // Los cinco tipos de categoría disponibles en la barra lateral. "Lista de
  // precios" queda fuera: el propio sistema la mantiene oculta (display: none)
  // para esta compañía, así que no es una opción real a probar.
  const combos: Array<{ nombre: string; obtenerLocator: () => Locator }> = [
    { nombre: 'TODOS', obtenerLocator: () => pos.categoriaTodos },
    { nombre: 'Combos', obtenerLocator: () => pos.categoriaCombos },
    { nombre: 'Categoría', obtenerLocator: () => pos.categoriaTipo },
    { nombre: 'Productos fraccionados', obtenerLocator: () => pos.categoriaProductosFraccionados },
    { nombre: 'Productos variantes', obtenerLocator: () => pos.categoriaProductosVariantes },
  ];

  for (const combo of combos) {
    await test.step(`Seleccionar "${combo.nombre}" y validar que cambió la información`, async () => {
      const item = combo.obtenerLocator();
      await item.click();
      await esperarQuedaActivo(() => pos.categoriaEstaActiva(item));
    });
  }
});

test('Cambiar entre modo Lista y modo Cuadrícula', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  let listaActivaAlInicio = false;

  await test.step('Abrir el POS', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
  });

  await test.step('Detectar cuál vista está activa actualmente, sin asumirla', async () => {
    const listaActiva = await pos.vistaEstaActiva(pos.botonVistaLista);
    const cuadriculaActiva = await pos.vistaEstaActiva(pos.botonVistaCuadricula);

    if (listaActiva) {
      listaActivaAlInicio = true;
    } else if (cuadriculaActiva) {
      listaActivaAlInicio = false;
    } else {
      // Ninguno de los dos botones fue interactuado todavía en esta sesión:
      // el sistema reporta el estilo inicial en un elemento oculto del DOM.
      listaActivaAlInicio = (await pos.estiloVistaTexto()) === 'list';
    }
  });

  await test.step('Cambiar a la vista contraria y validar el cambio', async () => {
    if (listaActivaAlInicio) {
      await pos.botonVistaCuadricula.click();
      await expect.poll(() => pos.vistaEstaActiva(pos.botonVistaCuadricula)).toBe(true);
      await expect.poll(() => pos.vistaEstaActiva(pos.botonVistaLista)).toBe(false);
    } else {
      await pos.botonVistaLista.click();
      await expect.poll(() => pos.vistaEstaActiva(pos.botonVistaLista)).toBe(true);
      await expect.poll(() => pos.vistaEstaActiva(pos.botonVistaCuadricula)).toBe(false);
    }
  });
});

test('Seleccionar el tab Servicios', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir el POS', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
  });

  await test.step('Seleccionar el tab "Servicios"', async () => {
    await pos.tabServicios.click();
  });

  await test.step('Validar que el tab "Servicios" quedó activo', async () => {
    await esperarQuedaActivo(() => pos.tabEstaActivo(pos.tabServicios));
  });
});

test('Seleccionar el tab End. Pintura', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir el POS', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
  });

  await test.step('Seleccionar el tab "End. Pintura"', async () => {
    await pos.tabPintura.click();
  });

  await test.step('Validar que el tab "End. Pintura" quedó activo', async () => {
    await esperarQuedaActivo(() => pos.tabEstaActivo(pos.tabPintura));
  });
});
