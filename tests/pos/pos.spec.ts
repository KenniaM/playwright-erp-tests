import { test, expect, Locator, Page } from '@playwright/test';
import { PosPage, METODO, MONTO_EFECTIVO, DESCUENTO_INDIVIDUAL_PCT, CAJA_TEXTO, TIMEOUTS, ResultadoDescuento, NOMBRE_SERVICIO, VEHICULO_PINTURA_TIPO, CABYS_BUSQUEDA, CABYS_BUSQUEDA_SIN_IVA, PRECIO_PRODUCTO_RAPIDO, COMBO_BUSQUEDA_PRODUCTO, LineaCarrito, PESTANA_POS_FACTURACION, PESTANAS_POS_A_RECORRER } from './pos.page';

const NOMBRE_CLIENTE_FACTURA = 'Cliente De Prueba QA';

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

/**
 * Agrega un producto rápido al carrito para las pruebas de validación de
 * IVA, con la cantidad indicada. Reutiliza los métodos ya existentes de
 * PosPage —abrirProductoRapido, llenarDatosBasicosProductoRapido,
 * manejarCabysSiAplica, seleccionarIvaManualmente— en vez de duplicar su
 * lógica.
 *
 * Ya NO lee ni depende del checkbox del formulario "Producto Rápido"
 * (#check_quick_product_apply_tax) para determinar qué validar después: ese
 * checkbox solo sirve aquí para CONFIGURAR el producto al crearlo —sigue
 * siendo la forma real de decirle al sistema si debe llevar impuesto—, pero
 * la verificación de qué quedó realmente aplicado se hace por separado,
 * después de guardar, contra `product_hide_apply_iva_<clave>` (la única
 * fuente de verdad confirmada por el trace de red) y contra el checkbox
 * `#show_price_with_iva` (arriba del carrito) para saber qué total leer —
 * ver `validarLineaCarrito()` en pos.page.ts.
 *
 * Cuando `activarIva` es true: si el CABYS aparece, lo completa (el IVA se
 * autocompleta a partir de él); si no aparece, lo selecciona manualmente.
 * Cuando es false: no toca CABYS ni el checkbox de IVA en absoluto —queda
 * en su estado por defecto, sin marcar—, que es la forma real de guardar
 * un producto sin IVA en este ambiente (confirmado en vivo: el país
 * configurado actualmente para esta compañía no exige CABYS para poder
 * guardar).
 */
async function agregarProductoRapidoParaValidacionIva(
  pos: PosPage,
  nombre: string,
  precio: string,
  activarIva: boolean,
  cantidad = 1
) {
  await pos.abrirProductoRapido();
  await pos.llenarDatosBasicosProductoRapido(nombre, precio);
  if (cantidad !== 1) {
    await pos.establecerCantidadProductoRapido(cantidad);
  }

  if (activarIva) {
    const cabysAplicado = await pos.manejarCabysSiAplica(CABYS_BUSQUEDA);
    if (cabysAplicado) {
      await pos.esperarIvaAutocompletado();
    } else {
      await pos.seleccionarIvaManualmente();
    }
  }

  await pos.guardarProductoRapidoYObtenerRespuesta();
  await expect(pos.modalProductoRapido).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
}

/**
 * Pasos comunes a ambos escenarios de "Crear Combo": abrir el modal, llenar
 * nombre/cantidad y agregar un producto real. El manejo del checkbox de IVA
 * y de CABYS es responsabilidad de cada escenario (crearComboConIva /
 * crearComboSinIva), porque el orden entre ambos —no solo su presencia—
 * determina el resultado (ver el comentario de activarIvaCombo() en
 * pos.page.ts): factorizarlo aquí evitaría poder expresar ese orden.
 */
async function abrirCrearComboConProducto(pos: PosPage, nombre: string) {
  await pos.abrirCrearCombo();
  await pos.llenarDatosBasicosCombo(nombre);
  await pos.buscarYAgregarPrimerProductoAlCombo(COMBO_BUSQUEDA_PRODUCTO);
}

/**
 * Fija un precio válido y guarda el combo ya configurado, validando la
 * respuesta real de red (save_company_combo) — mismo cierre para ambos
 * escenarios, sin duplicarlo.
 */
async function guardarComboConfigurado(pos: PosPage) {
  await pos.establecerPrecioValidoCombo();

  const respuesta = await pos.guardarComboYObtenerRespuesta();
  expect(respuesta.ok(), `La petición a save_company_combo no respondió OK (status ${respuesta.status()})`).toBe(true);
  await expect(pos.modalCrearCombo).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
}

/**
 * Escenario "Crear Combo con IVA": activa el checkbox "¿Aplicar impuesto?"
 * PRIMERO y verifica que quedó marcado, y solo después maneja CABYS (si el
 * formulario lo ofrece en este ambiente — depende del país configurado para
 * la compañía, no es fijo). Ese orden es obligatorio, no cosmético:
 * confirmado en vivo que el select de tasa (`#tax_rate_list`) SOLO se
 * autosincroniza con la tasa real del CABYS aplicado si el checkbox ya
 * estaba activado en ese momento — con el checkbox desmarcado, aplicar el
 * mismo CABYS deja el select en su valor por defecto ("0% Exento") sin
 * tocarlo. Por eso, a diferencia de una versión anterior de este helper,
 * activarIvaCombo() ya no se limita a ser un respaldo para cuando CABYS no
 * aparece: es el primer paso siempre.
 *
 * Si CABYS aparece, se aplica (CABYS_BUSQUEDA = "aceite", tasa 13%) y se
 * valida que la tasa seleccionada en el combo coincide exactamente con la
 * tasa que el propio CABYS sugiere (validarIvaCoincideConCabysCombo()) — no
 * solo que "algo" quedó aplicado. Si CABYS no aparece, no se lo toca: el
 * checkbox ya activado en el paso anterior es la única señal de "con IVA"
 * disponible en ese ambiente.
 *
 * Devuelve si CABYS terminó aplicado, para que el test lo registre.
 */
async function crearComboConIva(pos: PosPage, nombre: string): Promise<boolean> {
  await abrirCrearComboConProducto(pos, nombre);

  await pos.activarIvaCombo();
  await expect(
    pos.checkboxIvaCombo,
    'El checkbox "¿Aplicar impuesto?" de "Crear Combo" no quedó activado'
  ).toBeChecked();

  const cabysAplicado = await pos.manejarCabysSiAplica(CABYS_BUSQUEDA, pos.configCabysCombo);
  if (cabysAplicado) {
    await pos.validarIvaCoincideConCabysCombo();
  }

  await guardarComboConfigurado(pos);
  return cabysAplicado;
}

/**
 * Escenario "Crear Combo sin IVA": "sin IVA" es simplemente no agregarlo —
 * el checkbox "¿Aplicar impuesto?" ya está desactivado por defecto al abrir
 * el modal, así que no hace falta tocarlo de entrada. "Sin IVA" tampoco se
 * simula buscando deliberadamente un CABYS de clasificación "Exento":
 * CABYS es un campo fiscal obligatorio independiente del checkbox, así que
 * se usa el mismo término que el escenario "con IVA" (CABYS_BUSQUEDA,
 * "aceite") si el formulario lo ofrece en este ambiente.
 *
 * Aplicar ese CABYS SÍ activa el checkbox de IVA como efecto secundario —
 * confirmado en vivo, con un desfase de ~500ms (ver
 * esperarIvaAutocompletadoCombo(), homóloga de esperarIvaAutocompletado()
 * de Producto Rápido) — así que hay que ESPERAR esa activación automática
 * antes de revertirla: desactivar el checkbox de inmediato, sin esperar,
 * corre el riesgo de ganarle la carrera al propio sistema y terminar con
 * el checkbox marcado de todos modos.
 *
 * Nota de comportamiento real del sistema (confirmado en vivo): esperando
 * correctamente esa auto-activación antes de revertirla, el checkbox
 * termina realmente desactivado, y el combo queda guardado con
 * `product_hide_apply_iva_<clave>="0"` e IVA real = 0 en el carrito, sin
 * importar si se aplicó un CABYS o no — a diferencia de lo que se había
 * observado en una versión anterior de este flujo (que leía el checkbox
 * antes de que la auto-activación disparara, y por eso el "desactivar"
 * corría antes de que hubiera algo real que desactivar, dejando el
 * checkbox marcado al final). "Sin IVA" es entonces siempre
 * ivaAplicado=false en la línea del carrito, consistente con que el
 * checkbox es lo único que define este escenario.
 *
 * Devuelve si CABYS terminó aplicado, para que el test lo registre.
 */
async function crearComboSinIva(pos: PosPage, nombre: string): Promise<boolean> {
  await abrirCrearComboConProducto(pos, nombre);

  const cabysAplicado = await pos.manejarCabysSiAplica(CABYS_BUSQUEDA, pos.configCabysCombo);
  if (cabysAplicado) {
    await pos.esperarIvaAutocompletadoCombo();
    await pos.desactivarIvaCombo();
  }

  await expect(
    pos.checkboxIvaCombo,
    'El checkbox "¿Aplicar impuesto?" de "Crear Combo" no quedó desactivado'
  ).not.toBeChecked();

  await guardarComboConfigurado(pos);
  return cabysAplicado;
}

/**
 * Busca por nombre exacto el combo recién creado en la categoría "Combos"
 * (reutilizando productoPorNombre/agregarProductoPorNombre, igual que el
 * resto de la suite para cualquier producto del catálogo) y devuelve la
 * clave de la línea que se agregó al carrito.
 */
async function buscarComboYAgregarAlCarrito(pos: PosPage, nombre: string): Promise<string> {
  await pos.categoriaCombos.click();
  await esperarQuedaActivo(() => pos.categoriaEstaActiva(pos.categoriaCombos));
  await expect(
    pos.productoPorNombre(nombre),
    `El combo "${nombre}" no aparece en la categoría "Combos"`
  ).toHaveCount(1, { timeout: TIMEOUTS.PRODUCTS_LOAD });

  const clavesAntes = await pos.obtenerClavesProductos();
  await pos.agregarProductoPorNombre(nombre);
  await expect.poll(async () => (await pos.obtenerClavesProductos()).length).toBeGreaterThan(clavesAntes.length);
  const clavesDespues = await pos.obtenerClavesProductos();
  return clavesDespues.find(c => !clavesAntes.includes(c))!;
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
    // cualquier momento con solo agregar productos nuevos. Se busca primero
    // en el buscador real del grid (mismo patrón defensivo ya usado en
    // pos-orden-caja.spec.ts): la vista por defecto del catálogo tiene un
    // cupo fijo y un producto puede no aparecer ahí sin buscarlo
    // explícitamente a medida que el catálogo compartido de QA crece.
    //
    // "PRODUCTO CON 13%" (nombre anterior del segundo producto) no
    // corresponde a ningún producto real del catálogo — confirmado en vivo
    // que ni el buscador ni ningún término relacionado ("13", "con 13",
    // "PRODUCTO CON") lo encuentran; el historial de git muestra que ese
    // literal viene de un comentario descriptivo de una versión anterior
    // (`agregarProductoPorIndice(2) // producto índice 2 (PRODUCTO CON
    // 13%)`) que quedó mal convertido a un nombre exacto al reemplazar la
    // selección por índice. Se reemplaza por "Producto de prueba 1", un
    // producto real y estable del catálogo (confirmado en vivo: coincidencia
    // exacta única, sin ambigüedad con "Producto de prueba 10") que sí
    // agrega una segunda línea distinta al carrito — necesario para que el
    // descuento individual por producto tenga dos claves reales sobre las
    // que aplicarse.
    await pos.buscarProductoEnGrid('FRENOS');
    await pos.agregarProductoPorNombre('FRENOS');
    await pos.buscarProductoEnGrid('Producto de prueba 1');
    await pos.agregarProductoPorNombre('Producto de prueba 1');
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

test('agregar y facturar un Producto Rápido en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard y cerrar overlays conocidos si aparecen', async () => {
    // cargarPosDesdeDashboard(), no irAlPos() directo: evita una condición de
    // carrera real de la aplicación (pos.js) que deja sin ligar el click del
    // botón "Agregar" cuando el POS es la primera página de un contexto
    // nuevo — ver el comentario de ese método en pos.page.ts para la
    // evidencia completa.
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
  });

  let clavesAntes: string[] = [];
  await test.step('Abrir "Producto Rápido" desde el botón flotante', async () => {
    clavesAntes = await pos.obtenerClavesProductos();
    await pos.abrirProductoRapido();
  });

  await test.step('Llenar nombre y precio', async () => {
    await pos.llenarDatosBasicosProductoRapido(`Producto Rápido ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
  });

  await test.step('Detectar si aparece CABYS: si aparece, completarlo obligatoriamente; si no, seleccionar IVA manualmente', async () => {
    const cabysAplicado = await pos.manejarCabysSiAplica(CABYS_BUSQUEDA);
    console.log(`[agregar y facturar un Producto Rápido en POS] cabysAplicado=${cabysAplicado}`);
    if (cabysAplicado) {
      await pos.esperarIvaAutocompletado();
    } else {
      // Confirmado en vivo que sí ocurre: la visibilidad de CABYS depende
      // del país configurado para la compañía (server-side), no es fija —
      // ver el comentario de seleccionarIvaManualmente() en pos.page.ts.
      await pos.seleccionarIvaManualmente();
    }
  });

  await test.step('Presionar "Agregar" y validar que el producto se agregó al carrito', async () => {
    await pos.guardarProductoRapido();
    await expect(pos.modalProductoRapido).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await expect.poll(async () => (await pos.obtenerClavesProductos()).length).toBeGreaterThan(clavesAntes.length);
  });

  await test.step('Validar el toast de confirmación "Producto agregado"', async () => {
    await expect(page.locator('.noty_bar', { hasText: 'Producto agregado' })).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
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

test('Seleccionar un cliente existente en el POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard y cerrar overlays conocidos si aparecen', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
  });

  await test.step('Buscar y seleccionar el primer cliente existente disponible', async () => {
    const nombreCliente = await pos.seleccionarClienteExistente();
    expect(nombreCliente.length).toBeGreaterThan(0);
  });
});

test('Ingresar nombre del cliente en el POS sin seleccionar uno registrado', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard y cerrar overlays conocidos si aparecen', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
  });

  await test.step('Abrir "Agregar" → "Nombre del cliente" e ingresar el nombre', async () => {
    await pos.ingresarNombreCliente(NOMBRE_CLIENTE_FACTURA);
  });
});
