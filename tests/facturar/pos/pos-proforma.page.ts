import { expect, Download, Locator, Page, Response } from '@playwright/test';
import { L } from './pos.locators';
import {
  TIMEOUTS, PAUSES, CAJA_TEXTO, CHECKBOX_ID, PestanaPos, PESTANA_POS_FACTURACION,
  PESTANAS_POS_A_RECORRER, PESTANA_POS_PROFORMA, MetodoPago, METODO, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT,
  TipoPagoOrdenCaja, TipoProforma, VEHICULO_PINTURA_TIPO, COMPANIA_POS, CABYS_BUSQUEDA,
  CABYS_BUSQUEDA_SIN_IVA, PRECIO_PRODUCTO_RAPIDO, EscenarioDescuento, ResultadoDescuento,
  EstadoCheckIva, ConfigBusquedaCabys, LineaCarrito, MetadatoProducto, DASHBOARD_URL,
} from './pos.types';
import { PosCore } from './pos-core.page';
import { PosPayment } from './pos-payment.page';
import { PosNavigation } from './pos-navegacion.page';

// Parte del plan de migración a composición: dominio "PROFORMA" extraído
// de pos.page.ts. Depende de core, payment y navigation por inyección de
// constructor (composición, no herencia) — nunca al revés. Miembros que eran
// 'private' en el monolito pasan a públicos aquí por el mismo motivo que en
// PosCore: los llama la fachada por composición, no por herencia.
export class PosProforma {
  private readonly core: PosCore;
  private readonly payment: PosPayment;
  private readonly navigation: PosNavigation;

  constructor(core: PosCore, payment: PosPayment, navigation: PosNavigation) {
    this.core = core;
    this.payment = payment;
    this.navigation = navigation;
  }

  private get page() { return this.core.page; }


  // ─── "Crear Proforma" ───────────────────────────────────────────────────────

  /** Locator del modal "Agregar Proforma". */
  get modalCrearProforma() {
    return this.page.locator(L.DIALOG_PROFORMA);
  }


  /**
   * Abre el menú de acciones junto a "Facturar" (mismo menú MDL que "Enviar
   * a caja", L.ORDEN_CAJA_MENU_BTN) y selecciona "PROFORMA". Reutiliza el
   * mismo patrón de reintento + cierre de overlays ya probado en
   * abrirMenuOrdenCaja(), cambiando únicamente el ítem de éxito esperado.
   */
  async abrirCrearProforma() {
    await this.core.cerrarModalNotificacionesSiAparece();
    await this.core.cerrarAvisoConsecutivoSiAparece();

    await this.page.locator('ul.mdl-menu[data-mdl-for="demo-menu-top-right"][data-upgraded*="MaterialMenu"]')
      .waitFor({ state: 'attached', timeout: TIMEOUTS.PRODUCTS_LOAD })
      .catch(() => {});

    const item = this.page.locator(L.PROFORMA_MENU_ITEM);
    const MAX_INTENTOS = 4;
    let abierto = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierto; intento++) {
      await this.core.cerrarModalNotificacionesSiAparece();
      await this.core.cerrarAvisoConsecutivoSiAparece();

      await this.page.evaluate(
        (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
        L.ORDEN_CAJA_MENU_BTN
      );
      abierto = await item.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    }
    expect(abierto, `La opción "Proforma" no apareció en el menú de acciones tras ${MAX_INTENTOS} intentos`).toBe(true);

    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      L.PROFORMA_MENU_ITEM
    );

    await expect(this.modalCrearProforma, 'El modal "Agregar Proforma" no apareció tras seleccionar la opción del menú').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Selecciona el tipo de documento en el modal "Agregar Proforma". Las 3
   * tarjetas son mutuamente excluyentes por comportamiento propio de la
   * aplicación (confirmado en vivo: clickear una desmarca automáticamente
   * las otras dos) — pero "Proforma" (Normal) ya viene activa por defecto al
   * abrir el modal, y al ser un checkbox real (no un radio button), clickear
   * una tarjeta YA marcada la desmarca en vez de dejarla igual — confirmado
   * en vivo que este es exactamente el caso al pedir "normal" explícitamente.
   * Por eso solo se clickea si el checkbox no está ya en el estado
   * esperado, mismo criterio que _asegurarCheckboxEstado() ya usa para el
   * resto de checkboxes de la suite. Valida el checkbox real que la tarjeta
   * envuelve (no solo la clase CSS "active-*" de la tarjeta), que es la
   * fuente real del estado.
   */
  async seleccionarTipoProforma(tipo: TipoProforma) {
    const opciones = {
      normal:       { tarjeta: L.PROFORMA_CARD_NORMAL,       checkbox: L.PROFORMA_CHECK_NORMAL },
      consignacion: { tarjeta: L.PROFORMA_CARD_CONSIGNACION, checkbox: L.PROFORMA_CHECK_CONSIGNACION },
      taller:       { tarjeta: L.PROFORMA_CARD_TALLER,       checkbox: L.PROFORMA_CHECK_TALLER },
    } as const;
    const { tarjeta, checkbox } = opciones[tipo];

    const checkboxLocator = this.page.locator(checkbox);
    if (!(await checkboxLocator.isChecked())) {
      await this.page.locator(tarjeta).click();
    }
    await expect(
      checkboxLocator,
      `El checkbox interno de la tarjeta de tipo de Proforma "${tipo}" no quedó marcado`
    ).toBeChecked();
  }


  /** Locator del campo "Nombre del cliente" del modal "Agregar Proforma" — expuesto para que los tests validen su valor directamente. */
  get campoNombreClienteProforma() {
    return this.page.locator(L.PROFORMA_CLIENTE_INPUT);
  }


  /** Llena el campo "Nombre del cliente" del modal "Agregar Proforma" con texto libre. */
  async llenarNombreClienteProforma(nombre: string) {
    await this.campoNombreClienteProforma.fill(nombre);
  }


  /** Locator del campo "Observaciones" del modal "Agregar/Editar Proforma". */
  get campoObservacionProforma() {
    return this.page.locator(L.PROFORMA_OBSERVACION);
  }


  /** Llena el campo "Observaciones" del modal "Agregar/Editar Proforma". */
  async llenarObservacionProforma(texto: string) {
    await this.campoObservacionProforma.fill(texto);
  }


  /**
   * Selecciona el primer vendedor real disponible en "Agregar Proforma" —
   * mismo criterio que seleccionarVendedorOrdenCaja() (catálogo
   * configurable por la empresa, sin nombre estable). Devuelve el nombre
   * realmente seleccionado.
   */
  async seleccionarVendedorProforma(): Promise<string> {
    await this.core._seleccionarPrimeraOpcionChosen(L.PROFORMA_VENDEDOR_CHOSEN);
    const nombreVendedor = await this.core._obtenerTextoChosenSeleccionado(L.PROFORMA_VENDEDOR_CHOSEN);
    expect(nombreVendedor, 'El vendedor seleccionado en "Agregar Proforma" no quedó visible').not.toBe('');
    return nombreVendedor;
  }


  /**
   * Presiona "Crear Proforma", confirma el SweetAlert de advertencia
   * ("¿Esta seguro de crear esta proforma?") y espera la respuesta real de
   * red que efectivamente la guarda (addPosProductProform) — mismo patrón
   * ya usado en enviarOrdenCaja(): la espera del AJAX se arma ANTES de
   * confirmar el SweetAlert, no después, para no perderse la respuesta si
   * llega muy rápido.
   */
  async guardarProformaYObtenerRespuesta(): Promise<Response> {
    await this.page.locator(L.PROFORMA_BTN_GUARDAR).click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_PROFORMA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.core._confirmarSweetAlertV1('No apareció la confirmación "¿Esta seguro de crear esta proforma?"');
    return respuestaPromise;
  }


  /**
   * Valida que "Crear Proforma" terminó exitosamente, sin depender
   * únicamente del toast: la respuesta real de addPosProductProform
   * respondió OK, el modal de captura se cerró, y el modal de Gestión de
   * Proforma apareció automáticamente.
   */
  async validarProformaCreada(respuesta: Response) {
    expect(respuesta.ok(), `${L.AJAX_GUARDAR_PROFORMA} no respondió OK (status ${respuesta.status()})`).toBe(true);

    await expect(
      this.modalCrearProforma,
      'El modal "Agregar Proforma" no se cerró tras confirmar el guardado'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await expect(
      this.modalGestionProforma,
      'El modal "Gestión de Proforma" no apareció tras crear la proforma'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  // ─── Gestión de Proforma (modal posterior al guardado) ─────────────────────

  /** Locator del modal "Gestión de Proforma" que aparece automáticamente tras guardar. */
  get modalGestionProforma() {
    return this.page.locator(L.DIALOG_GESTION_PROFORMA);
  }


  /**
   * Cierra el modal de Gestión de Proforma con su botón "Cerrar" — necesario
   * antes de cualquier interacción posterior con el resto del POS (p. ej.
   * el menú de moneda): confirmado en vivo que este modal usa
   * `data-backdrop="static"` y, mientras sigue abierto, intercepta clicks en
   * cualquier otro elemento de la página, incluido `#menu_type_currency`.
   */
  async cerrarModalGestionProforma() {
    await this.modalGestionProforma.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(this.modalGestionProforma).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Presiona "Enviar por correo" en el modal de Gestión de Proforma y
   * devuelve la respuesta real del AJAX (sendProformByEmail, cuerpo crudo
   * "1"=éxito / "0"=fallo, no JSON) — confirmado en vivo que solo responde
   * éxito si la Proforma se creó con un cliente existente (con nombre libre
   * responde "0" y el sistema muestra el toast "Error al enviar
   * proforma!").
   */
  async enviarProformaPorCorreo(): Promise<Response> {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_ENVIAR_PROFORMA_CORREO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.GESTION_PROFORMA_BTN_CORREO).click();
    return respuestaPromise;
  }


  /**
   * Presiona "Descargar PDF" en el modal de Gestión de Proforma y devuelve
   * el evento de descarga real del navegador — confirmado en vivo que el
   * nombre sugerido sigue el patrón "PROFORMA #<número>.pdf".
   */
  async descargarPdfProforma(): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.GESTION_PROFORMA_BTN_PDF).click();
    return downloadPromise;
  }


  /**
   * Presiona "Imprimir" en el modal de Gestión de Proforma y devuelve la
   * ventana emergente ya cargada — confirmado en vivo que su contenido se
   * renderiza vía document.write() (la URL queda en "about:blank", igual
   * que el resto de ventanas de impresión de esta suite), así que quien
   * llama puede validar el contenido antes de cerrarla con
   * mostrarYCerrarVentanaImpresion().
   */
  async imprimirProforma(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.GESTION_PROFORMA_BTN_IMPRIMIR).click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    return popup;
  }


  /**
   * Presiona "Ver todas" en el modal de Gestión de Proforma y devuelve la
   * ventana emergente — confirmado en vivo que lleva al mismo destino real
   * (proform/printPosProform) que ya valida abrirHistorialProformas() desde
   * el menú de tres puntos, aunque el elemento que dispara el click es
   * distinto (el propio modal de gestión, no el menú de tres puntos), por
   * lo que no puede reutilizarse ese método tal cual.
   */
  async verTodasLasProformas(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.GESTION_PROFORMA_BTN_VER_TODAS).click();
    return popupPromise;
  }


  /** Lee el id numérico real de la Proforma recién creada desde el propio modal de Gestión — necesario para localizarla luego en el listado. */
  async obtenerIdProformaCreada(): Promise<string> {
    return this.page.locator(L.PROFORMA_RESULT_ID).inputValue();
  }


  /**
   * Presiona "WhatsApp" en el modal de Gestión de Proforma, confirma que el
   * panel de vista previa apareció con el mensaje ya armado (incluye el
   * enlace real de descarga del PDF por hash — confirmado en vivo) y llena
   * el teléfono si el campo estaba vacío. Devuelve el texto del mensaje para
   * que el test lo valide.
   */
  async abrirVistaPreviaWhatsApp(telefono = '88888888'): Promise<string> {
    await this.page.locator(L.GESTION_PROFORMA_BTN_WHATSAPP).click();
    await expect(
      this.page.locator(L.GESTION_PROFORMA_WHATSAPP_PREVIEW),
      'El panel de vista previa de WhatsApp no apareció tras presionar el botón "WhatsApp"'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const telefonoInput = this.page.locator(L.GESTION_PROFORMA_WHATSAPP_TELEFONO);
    if (!(await telefonoInput.inputValue())) {
      await telefonoInput.fill(telefono);
    }

    const texto = await this.page.locator(L.GESTION_PROFORMA_WHATSAPP_TEXTAREA).inputValue();
    expect(texto.length, 'El mensaje de WhatsApp quedó vacío en la vista previa').toBeGreaterThan(0);
    return texto;
  }


  /**
   * Presiona "Enviar por WhatsApp" (ya con la vista previa abierta, ver
   * abrirVistaPreviaWhatsApp()) y devuelve la pestaña real que el sistema
   * abre hacia api.whatsapp.com/send — confirmado en vivo end-to-end. Si el
   * navegador/ambiente bloquea la apertura de la pestaña (p. ej. bloqueador
   * de popups en CI), devuelve `null` en vez de lanzar: quien llama decide
   * entonces validar el flujo alterno disponible en el mismo modal (PDF/
   * Imprimir), tal como pide el escenario.
   */
  async enviarPorWhatsAppYObtenerPestana(): Promise<Page | null> {
    try {
      const [popup] = await Promise.all([
        this.page.context().waitForEvent('page', { timeout: TIMEOUTS.PRINT_POPUP }),
        this.page.locator(L.GESTION_PROFORMA_WHATSAPP_BTN_ENVIAR).click(),
      ]);
      await popup.waitForLoadState('domcontentloaded');
      return popup;
    } catch {
      return null;
    }
  }


  // ─── Listado de Proformas ya creadas (reutilización de una Proforma existente) ──

  /**
   * Abre el listado de Proformas (menú de tres puntos → "Historial de
   * Proformas") y, si se indica un término, lo busca — reutiliza
   * abrirMenuTresPuntos()/abrirHistorialProformas() ya existentes en
   * PosNavigation, ninguna lógica nueva de apertura de menú.
   *
   * Con reintentos propios: confirmado en vivo (corridas con varios workers
   * en paralelo, misma carga sostenida ya documentada para otros menús de
   * esta suite) que el click en "Historial de Proformas" —ya con el menú de
   * tres puntos abierto— puede fallar en silencio y dejar
   * abrirHistorialProformas() esperando un popup que nunca llega, sin que
   * eso sea un error real del sistema (el mismo click, reintentado,
   * funciona). Mismo criterio de reintento + cierre de overlays ya usado en
   * abrirCrearProforma()/abrirMenuOrdenCaja(), aplicado aquí porque
   * abrirHistorialProformas() (PosNavigation) es compartido con otros
   * archivos de la suite y no se modifica solo para este caso de uso.
   */
  async abrirListadoProformas(terminoBusqueda?: string): Promise<Page> {
    const MAX_INTENTOS = 3;
    let listado: Page | null = null;
    for (let intento = 1; intento <= MAX_INTENTOS && !listado; intento++) {
      await this.core.cerrarModalNotificacionesSiAparece();
      await this.core.cerrarAvisoConsecutivoSiAparece();
      await this.navigation.abrirMenuTresPuntos();
      listado = await this.navigation.abrirHistorialProformas().catch(() => null);
    }
    expect(listado, `No se pudo abrir el listado de Proformas tras ${MAX_INTENTOS} intentos`).not.toBeNull();

    await listado!.waitForLoadState('domcontentloaded');
    await listado!.locator(L.LISTADO_PROFORMA_BUSCADOR).waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL });

    if (terminoBusqueda) {
      await this.buscarEnListadoProformas(listado!, terminoBusqueda);
    }
    return listado!;
  }


  /**
   * Ejecuta una búsqueda en el listado de Proformas ya abierto
   * (abrirListadoProformas()) — extraído de ahí para poder reutilizarlo con
   * MÚLTIPLES términos sobre el mismo listado ya abierto (validar a fondo el
   * buscador: por número, por cliente, texto parcial, término inexistente,
   * limpiar) sin reabrir el popup en cada caso, que es más costoso y no
   * aporta nada nuevo (mismo listado, mismo campo). Un término vacío ('')
   * limpia la búsqueda: mismo campo y botón, el propio buscador trata un
   * valor vacío como "sin filtro" (confirmado en vivo, mismo resultado que
   * el estado inicial del listado recién abierto).
   */
  async buscarEnListadoProformas(listado: Page, termino: string): Promise<void> {
    await listado.locator(L.LISTADO_PROFORMA_BUSCADOR).fill(termino);
    await listado.locator(L.LISTADO_PROFORMA_BTN_BUSCAR).click();
    await listado.waitForLoadState('networkidle').catch(() => {});
  }


  /**
   * Lee el texto visible de cada tarjeta `.receip_item` del listado ya
   * abierto — sin seleccionar ninguna (a diferencia de
   * seleccionarPrimeraProformaDelListado(), que sí selecciona la primera y
   * lee su detalle vía AJAX). Necesario para validar el buscador: cuántos
   * resultados trae una búsqueda y si su contenido visible corresponde al
   * término buscado, sin pagar el costo de cargar el detalle de cada uno.
   */
  async obtenerFilasListadoProformas(listado: Page): Promise<string[]> {
    const filas = listado.locator(L.LISTADO_PROFORMA_FILA);
    const total = await filas.count();
    const textos: string[] = [];
    for (let i = 0; i < total; i++) {
      textos.push((await filas.nth(i).innerText()).trim());
    }
    return textos;
  }


  /**
   * Selecciona la primera Proforma disponible en un listado ya abierto
   * (abrirListadoProformas()) y espera a que su panel de detalle cargue —
   * necesario antes de leer su id/cliente o de operar sobre ella (Imprimir/
   * PDF/Email/WhatsApp/Eliminar desde el listado). Devuelve `null` si el
   * listado no tiene ninguna Proforma (quien llama decide entonces crear
   * una nueva, según el criterio pedido: reutilizar solo si existe alguna).
   */
  async seleccionarPrimeraProformaDelListado(listado: Page): Promise<{ proformaId: string; nombreCliente: string } | null> {
    const filas = listado.locator(L.LISTADO_PROFORMA_FILA);
    if ((await filas.count()) === 0) return null;

    await filas.first().click();
    await expect(
      listado.locator(L.LISTADO_PROFORMA_DETALLE_VACIO),
      'El panel de detalle de la Proforma seleccionada no cargó (siguió mostrando el placeholder "Seleccionar Proforma...")'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    // El id real se lee del propio onclick de "Eliminar" (confirm_proform(<id>))
    // — la misma fuente que usa la aplicación, nunca inferido de la clase CSS.
    const onclickEliminar = await listado.locator(L.LISTADO_PROFORMA_BTN_ELIMINAR).getAttribute('onclick');
    const proformaId = onclickEliminar?.match(/\d+/)?.[0] ?? '';
    expect(proformaId, 'No se pudo leer el id real de la Proforma seleccionada desde el botón "Eliminar"').not.toBe('');

    const nombreCliente = (await listado.locator(L.LISTADO_PROFORMA_DETALLE).locator('p', { hasText: 'Cliente:' }).first().textContent())
      ?.replace('Cliente:', '')
      .trim() ?? '';

    return { proformaId, nombreCliente };
  }


  /**
   * Elimina, desde el listado, la Proforma cuyo detalle está actualmente
   * cargado (ver seleccionarPrimeraProformaDelListado()): presiona
   * "Eliminar", confirma el SweetAlert v1 real ("¿Esta seguro eliminar esta
   * proforma?", botón "Aceptar") y espera la respuesta real del AJAX de
   * borrado. Confirmado en vivo que, tras el borrado exitoso, la propia
   * aplicación cierra esta ventana emergente sola — por eso no se valida
   * ningún estado posterior DENTRO de `listado` (quedaría apuntando a una
   * página ya cerrada); quien llama debe abrir un listado nuevo para
   * confirmar que la Proforma ya no aparece.
   */
  async eliminarProformaSeleccionadaDelListado(listado: Page): Promise<string> {
    const respuestaPromise = listado.waitForResponse(
      (res) => res.url().includes(L.AJAX_ELIMINAR_PROFORMA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await listado.locator(L.LISTADO_PROFORMA_BTN_ELIMINAR).click();

    const dialogo = listado.locator('.sweet-alert.visible');
    await expect(dialogo, 'No apareció la confirmación "¿Esta seguro eliminar esta proforma?"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await dialogo.locator('button.confirm').click();

    const respuesta = await respuestaPromise;
    return (await respuesta.text()).trim();
  }


  // ─── Pestaña "Proforma / Cotizaciones" dentro del propio POS (edición in-place) ──
  // Ver el comentario completo de L.PROFORMA_TAB_DROPBTN para la evidencia:
  // esta es la ÚNICA vía real de edición in-place de toda la aplicación.

  /**
   * Cambia el sub-filtro de tipo dentro de la pestaña "Proforma /
   * Cotizaciones" (Normal/Consignación/Taller — ver L.PROFORMA_TAB_SUBTAB_*).
   * No hace nada si el sub-filtro pedido ya está activo (clase real
   * "btn_sale_selected"), evitando una espera de red innecesaria.
   *
   * No basta con esperar UNA respuesta que contenga AJAX_BUSCAR_PROFORMAS_TAB
   * en su URL: confirmado en vivo (condición de carrera real) que, justo
   * tras entrar a esta pestaña (visitarPestanaPos()), su propia búsqueda por
   * defecto (sub-filtro "Normal") puede seguir en vuelo — un
   * waitForResponse() armado inmediatamente después puede resolver contra
   * ESA respuesta rezagada en vez de la que realmente dispara este click,
   * dejando el método por completado mientras el DOM todavía muestra el
   * sub-filtro anterior. Por eso, además de la red, se confirma el estado
   * real del DOM (la clase "activa" migró al botón pedido) antes de
   * devolver el control.
   */
  async cambiarSubTabProforma(tipo: TipoProforma) {
    const boton = {
      normal: L.PROFORMA_TAB_SUBTAB_NORMAL,
      consignacion: L.PROFORMA_TAB_SUBTAB_CONSIGNACION,
      taller: L.PROFORMA_TAB_SUBTAB_TALLER,
    }[tipo];

    // Timeout explícito (antes ausente): mismo patrón/causa raíz ya
    // confirmado en vivo en abrirMenuDeTarjeta()/obtenerPrimeraProformaEnTab()
    // — evaluate() sin `timeout` usa el default de acción de Playwright (0 =
    // sin límite en este proyecto), así que si el botón del sub-filtro tarda
    // en adjuntarse tras visitarPestanaPos() este await queda colgado hasta
    // el timeout del test COMPLETO en vez de fallar rápido.
    const yaActivo = await this.page.locator(boton).evaluate(
      (el, clase) => el.classList.contains(clase),
      L.PROFORMA_TAB_SUBTAB_ACTIVA_CLASE,
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    if (yaActivo) return;

    // Deja asentar la búsqueda por defecto que la propia pestaña dispara al
    // entrar (sub-filtro "Normal") ANTES de clickear otro sub-filtro — evita
    // que esa respuesta rezagada se confunda más abajo con la que sí
    // corresponde a este click.
    await this.page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

    // Timeout explícito (antes ausente, mismo patrón de causa raíz):
    // confirmado en vivo que este click específico —sin límite— era el
    // punto real donde "Vista Lista"/"Vista Expandida" (sub-filtro Taller)
    // quedaban colgados 150s+ incluso después de acotar el evaluate() de
    // arriba y el getAttribute() de obtenerPrimeraProformaEnTab().
    await this.page.locator(boton).click({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await expect(
      this.page.locator(boton),
      `El sub-filtro "${tipo}" no quedó activo tras el click`
    ).toHaveClass(new RegExp(L.PROFORMA_TAB_SUBTAB_ACTIVA_CLASE), { timeout: TIMEOUTS.PAYMENT_MODAL });

    // Confirmación adicional de red, best-effort (no bloqueante si ya llegó
    // antes de armar esta espera): sirve como evidencia extra, la fuente de
    // verdad real ya es la clase activa confirmada arriba.
    await this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_BUSCAR_PROFORMAS_TAB),
      { timeout: 3_000 }
    ).catch(() => {});
  }


  /**
   * Busca Proformas por CLIENTE dentro de la pestaña "Proforma /
   * Cotizaciones" usando su buscador real (PROFORMA_TAB_BUSCADOR,
   * `#product_search` — ver su comentario para la evidencia completa de por
   * qué es el mismo input compartido). Mismo criterio ya confirmado en vivo
   * y ya usado por buscarOrdenRuteoPorCliente() (pos-ruteo.page.ts): `fill()`
   * por sí solo NO dispara ninguna petición (confirmado interceptando la
   * red), hace falta Enter. Filtra sobre el sub-filtro de tipo actualmente
   * activo (Normal/Consignación/Taller) — no cambia de sub-filtro por su
   * cuenta. Un término vacío ('') limpia la búsqueda y devuelve el listado
   * completo del sub-filtro activo. Devuelve la respuesta cruda del AJAX
   * real para que quien llama pueda inspeccionar su contenido si lo
   * necesita.
   */
  async buscarProformaEnTab(termino: string): Promise<Response> {
    const buscador = this.page.locator(L.PROFORMA_TAB_BUSCADOR);
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_BUSCAR_PROFORMAS_TAB),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await buscador.fill(termino);
    await buscador.press('Enter');
    return respuestaPromise;
  }


  /**
   * Abre el menú de tres puntos de una tarjeta invocando `showOptionCard(id)`
   * directamente por JS, en vez de clickear `.dropbtn` — confirmado en vivo
   * que este menú es un dropdown clásico "mostrar en hover"
   * (onmouseover/onmouseout en el propio markup, ver L.PROFORMA_TAB_DROPBTN):
   * un click() simulado sobre el botón no lo abre de forma confiable (el
   * link interno queda "not visible" incluso tras cientos de reintentos).
   * Mismo criterio ya usado en el resto de esta suite para UI dependiente de
   * hover/JS que un click real no dispara con seguridad (ver
   * abrirCrearProforma(), FAB_TOGGLE). El id se lee del ícono de vista
   * previa de la propia tarjeta (data-proform-id), nunca asumido.
   */
  async abrirMenuDeTarjeta(tarjeta: Locator): Promise<string> {
    // Timeout explícito (antes ausente): getAttribute() sin `timeout` usa el
    // default de acción de Playwright (0 = sin límite en este proyecto, sin
    // actionTimeout configurado en playwright.config.ts), así que si
    // `tarjeta` deja de matchear algún elemento (p. ej. localizada por texto
    // de cliente que cambió — ver localizarTarjetaProformaPorId()) este
    // await queda colgado hasta el timeout del test COMPLETO en vez de
    // fallar rápido con un error diagnosticable — confirmado en vivo con dos
    // corridas consecutivas que colgaron los 10 minutos completos
    // (TIMEOUTS.TEST_CON_RECUPERACION) antes de que Playwright cerrara el
    // browser por su cuenta.
    const proformaId = (await tarjeta.locator(L.PROFORMA_TAB_ICONO_VISTA_PREVIA).getAttribute('data-proform-id', { timeout: TIMEOUTS.PAYMENT_MODAL })) ?? '';
    expect(proformaId, 'No se pudo leer el id real de la tarjeta para abrir su menú de tres puntos (¿la tarjeta ya no existe con ese filtro?)').not.toBe('');

    await this.page.evaluate((id) => (window as any).showOptionCard(id), proformaId);
    await expect(
      tarjeta.locator(L.PROFORMA_TAB_DROPDOWN_CONTENT),
      `El menú de tres puntos de la Proforma #${proformaId} no se abrió`
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    return proformaId;
  }


  /**
   * Visita la pestaña "Proforma / Cotizaciones" del POS, cambia al
   * sub-filtro del tipo indicado (cambiarSubTabProforma()), localiza por
   * texto (nombre de cliente, nunca por id) la tarjeta de una Proforma ya
   * creada y abre su menú de tres puntos (abrirMenuDeTarjeta()). Devuelve el
   * locator de la tarjeta ya con el menú desplegado, listo para que quien
   * llama elija la acción real (Editar/WhatsApp/Imprimir/etc.).
   */
  async abrirMenuTarjetaProformaEnTab(nombreCliente: string, tipo: TipoProforma = 'normal'): Promise<Locator> {
    await this.core.visitarPestanaPos(PESTANA_POS_PROFORMA);
    await this.cambiarSubTabProforma(tipo);

    const tarjeta = this.page.locator(L.PROFORMA_TAB_TARJETA).filter({ hasText: nombreCliente }).first();
    await expect(
      tarjeta,
      `No se encontró ninguna tarjeta de Proforma con el cliente "${nombreCliente}" en la pestaña "Proforma / Cotizaciones" (sub-filtro "${tipo}")`
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await this.abrirMenuDeTarjeta(tarjeta);
    return tarjeta;
  }


  /**
   * Localiza una tarjeta de Proforma por su id real (data-proform-id), no
   * por texto de cliente — necesario para volver a operar sobre una tarjeta
   * DESPUÉS de que su cliente mostrado cambió (p. ej. Convertir a Orden de
   * Reparación: tras seleccionarClienteExistente()/updateCustomerToOrder
   * asociar un cliente real a una Proforma creada con nombre libre, la
   * tarjeta re-renderiza mostrando ese cliente real). Un locator construido
   * con `.filter({ hasText: nombreOriginal })` deja de matchear cualquier
   * elemento en ese momento — y, confirmado en vivo con dos corridas
   * consecutivas, eso cuelga abrirMenuDeTarjeta() el timeout completo del
   * test en vez de fallar rápido. Filtrar por id en su lugar es inmune a
   * ese cambio de texto.
   */
  localizarTarjetaProformaPorId(proformaId: string): Locator {
    return this.page.locator(L.PROFORMA_TAB_TARJETA).filter({
      has: this.page.locator(`${L.PROFORMA_TAB_ICONO_VISTA_PREVIA}[data-proform-id="${proformaId}"]`),
    });
  }


  /**
   * Visita la pestaña "Proforma / Cotizaciones", cambia al sub-filtro del
   * tipo indicado (cambiarSubTabProforma()) y devuelve la primera Proforma
   * disponible ahí (sin buscar por nombre) — usada por los escenarios que
   * reutilizan cualquier Proforma existente (Imprimir/Email/PDF: no
   * destructivos, seguros de operar sobre la que sea). El id y el cliente
   * se leen de los atributos reales `data-proform-id`/`data-proform-client`
   * del ícono de vista previa (PROFORMA_TAB_ICONO_VISTA_PREVIA) — nunca
   * parseando el texto visible de la tarjeta. Devuelve `null` si ese
   * sub-filtro no tiene ninguna Proforma (quien llama decide entonces crear
   * una nueva, según el criterio pedido: reutilizar solo si existe alguna).
   * El menú de tres puntos NO se abre aquí: cada acción lo abre por su
   * cuenta justo antes de usarlo (mismo criterio que abrirMenuTarjetaProformaEnTab()).
   */
  async obtenerPrimeraProformaEnTab(tipo: TipoProforma = 'normal'): Promise<{ tarjeta: Locator; nombreCliente: string; proformaId: string } | null> {
    await this.core.visitarPestanaPos(PESTANA_POS_PROFORMA);
    await this.cambiarSubTabProforma(tipo);

    const tarjetas = this.page.locator(L.PROFORMA_TAB_TARJETA);
    if ((await tarjetas.count()) === 0) return null;

    const tarjeta = tarjetas.first();
    const iconoVistaPrevia = tarjeta.locator(L.PROFORMA_TAB_ICONO_VISTA_PREVIA);
    // Timeouts explícitos (antes ausentes): mismo patrón/causa raíz ya
    // confirmado en vivo en abrirMenuDeTarjeta() — getAttribute() sin
    // `timeout` usa el default de acción de Playwright (0 = sin límite en
    // este proyecto), así que si el ícono de la tarjeta "primera" tarda en
    // adjuntarse (o la lista se re-renderiza justo después del count()
    // anterior) este await queda colgado hasta el timeout del test COMPLETO
    // en vez de fallar rápido — reproducido en vivo en aislamiento total
    // (nada más corriendo) con "Agregar Ítem y Facturar"/"Vista Expandida"/
    // "Vista Lista"/"Facturar a Crédito", todos consumidores de este método
    // vía buscarOCrearProformaEnTab().
    const proformaId = (await iconoVistaPrevia.getAttribute('data-proform-id', { timeout: TIMEOUTS.PAYMENT_MODAL })) ?? '';
    const nombreCliente = (await iconoVistaPrevia.getAttribute('data-proform-client', { timeout: TIMEOUTS.PAYMENT_MODAL })) ?? '';
    expect(proformaId, 'No se pudo leer el id real de la primera Proforma de la pestaña (data-proform-id)').not.toBe('');

    return { tarjeta, nombreCliente, proformaId };
  }


  /**
   * Lee id y cliente reales (mismos atributos confiables `data-proform-id`/
   * `data-proform-client` que ya usa obtenerPrimeraProformaEnTab(), nunca el
   * texto visible) de TODAS las tarjetas actualmente visibles en el
   * sub-filtro activo de la pestaña "Proforma / Cotizaciones" — necesario
   * para validar el buscador (buscarProformaEnTab()): cuántos resultados
   * trae una búsqueda y si corresponden al término buscado, sin seleccionar
   * ninguna tarjeta.
   */
  async obtenerTarjetasProformaEnTab(): Promise<{ proformaId: string; nombreCliente: string }[]> {
    const tarjetas = this.page.locator(L.PROFORMA_TAB_TARJETA);
    const total = await tarjetas.count();
    const resultado: { proformaId: string; nombreCliente: string }[] = [];
    for (let i = 0; i < total; i++) {
      const iconoVistaPrevia = tarjetas.nth(i).locator(L.PROFORMA_TAB_ICONO_VISTA_PREVIA);
      const proformaId = (await iconoVistaPrevia.getAttribute('data-proform-id', { timeout: TIMEOUTS.PAYMENT_MODAL })) ?? '';
      const nombreCliente = (await iconoVistaPrevia.getAttribute('data-proform-client', { timeout: TIMEOUTS.PAYMENT_MODAL })) ?? '';
      resultado.push({ proformaId, nombreCliente });
    }
    return resultado;
  }


  /**
   * Presiona "Editar" en el menú de tres puntos de una tarjeta ya abierta
   * (abrirMenuTarjetaProformaEnTab()) y confirma que el modal "Agregar
   * Proforma" reabrió en modo edición real: `#proform_mode`="update" y
   * `#id_proform` con el id ya existente (confirmado en vivo, no asumido) —
   * a diferencia del checkbox de tipo, que sí puede tratarse igual que al
   * crear, este par de hidden inputs es la prueba real de que el guardado
   * posterior actualizará el mismo registro en vez de crear uno nuevo.
   */
  async editarProformaSeleccionada(tarjeta: Locator, proformaIdEsperado: string) {
    await this.abrirMenuDeTarjeta(tarjeta);
    await tarjeta.locator(L.PROFORMA_TAB_MENU_LINK_EDITAR).click();

    await expect(
      this.modalCrearProforma,
      'El modal "Agregar Proforma" no se abrió tras presionar "Editar"'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await expect(
      this.page.locator(L.PROFORMA_MODO_HIDDEN),
      'El modal no quedó en modo edición ("update") tras presionar "Editar"'
    ).toHaveValue('update');
    await expect(
      this.page.locator(L.PROFORMA_ID_HIDDEN),
      `El modal no cargó el id real de la Proforma a editar (se esperaba "${proformaIdEsperado}")`
    ).toHaveValue(proformaIdEsperado);
  }


  /**
   * Presiona "Crear Proforma" (mismo botón, `#make_proform`) estando ya en
   * modo edición (editarProformaSeleccionada()) y espera la respuesta real
   * de AJAX_ACTUALIZAR_PROFORMA (updateProform) — un endpoint DISTINTO del
   * que usa guardarProformaYObtenerRespuesta() (addPosProductProform),
   * confirmado en vivo interceptando la red completa del guardado en modo
   * edición. Investigado en vivo con resultados inconsistentes entre
   * corridas sobre si el modal de Gestión reaparece tras guardar una
   * edición (a veces sí, a veces no) — en vez de asumir un único
   * comportamiento, esta función cierra el modal de Gestión defensivamente
   * si aparece, mismo criterio ya usado en toda la suite para overlays cuya
   * aparición NO es un error (cerrarOverlaysConocidos() y similares).
   */
  async guardarEdicionProformaYObtenerRespuesta(): Promise<Response> {
    await this.page.locator(L.PROFORMA_BTN_GUARDAR).click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_ACTUALIZAR_PROFORMA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.core._confirmarSweetAlertV1('No apareció la confirmación "¿Esta seguro de crear esta proforma?" al guardar la edición');
    const respuesta = await respuestaPromise;

    // La respuesta de red llega ANTES de que el propio JS de la aplicación
    // termine de cerrar el modal "Agregar Proforma" — confirmado en vivo
    // (condición de carrera real, no asumida): sin esperar aquí, el
    // siguiente paso del test puede toparse con este modal (o el overlay del
    // SweetAlert recién confirmado) todavía intercepting clicks. Mismo
    // criterio que validarProformaCreada() ya usa para el flujo de crear.
    await expect(
      this.modalCrearProforma,
      'El modal "Agregar Proforma" no se cerró tras guardar la edición'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    // Espera acotada (no un chequeo puntual): confirmado en vivo que el
    // modal de Gestión, cuando reaparece, puede hacerlo unos segundos
    // DESPUÉS de que el modal "Agregar Proforma" ya se cerró — parece
    // depender de una de las peticiones de refresco que la propia
    // aplicación dispara tras actualizar (getPosProformSearch/
    // getPosProformTotals/getProformItemList), así que un solo
    // isVisible() puntual puede llegar demasiado pronto y perderse su
    // aparición.
    const gestionReaparecio = await this.modalGestionProforma
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (gestionReaparecio) {
      await this.cerrarModalGestionProforma();
    }

    return respuesta;
  }


  /**
   * Presiona "WhatsApp" en el menú de tres puntos de una tarjeta ya abierta
   * y devuelve el locator del modal real que abre esta pestaña
   * (`#dialog_send_whatsapp_message`, distinto y más completo que el panel
   * de WhatsApp del modal de Gestión — ver L.DIALOG_WHATSAPP_TAB).
   */
  async abrirWhatsAppDesdeTab(tarjeta: Locator): Promise<Locator> {
    await this.abrirMenuDeTarjeta(tarjeta);
    await tarjeta.locator(L.PROFORMA_TAB_MENU_LINK_WHATSAPP).click();
    const dialogo = this.page.locator(L.DIALOG_WHATSAPP_TAB);
    await expect(
      dialogo,
      'El modal "¡Enviar WhatsApp!" no apareció tras presionar "WhatsApp" en el menú de la tarjeta'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    return dialogo;
  }


  /**
   * Presiona el botón "Descargar" del documento "Proforma" DENTRO del modal
   * "¡Enviar WhatsApp!" (`downloadWhatsappDocument('proforma', event)`) —
   * flujo alterno 100% seguro (solo descarga un PDF, sin ningún efecto de
   * envío) para cuando no se ejecuta el botón real "Enviar" — ver el
   * comentario de L.WHATSAPP_TAB_BTN_DESCARGAR_PROFORMA.
   */
  async descargarProformaDesdeModalWhatsApp(dialogo: Locator): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.PRINT_POPUP });
    await dialogo.locator(L.WHATSAPP_TAB_BTN_DESCARGAR_PROFORMA).click();
    return downloadPromise;
  }


  /**
   * Presiona "Imprimir" en el menú de tres puntos de una tarjeta ya abierta
   * (misma función real `downloadProformPdf(id, true)` que usa el modal de
   * Gestión y el listado externo) y devuelve la ventana de impresión ya
   * cargada — mismo contrato que imprimirProforma().
   */
  async imprimirProformaDesdeTab(tarjeta: Locator): Promise<Page> {
    await this.abrirMenuDeTarjeta(tarjeta);
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP });
    await tarjeta.locator(L.PROFORMA_TAB_MENU_LINK_IMPRIMIR).click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    return popup;
  }


  /**
   * Presiona "Descargar PDF" en el menú de tres puntos de una tarjeta ya
   * abierta (misma función real `downloadProformPdf(id, false)`) y devuelve
   * el evento de descarga real del navegador.
   */
  async descargarPdfProformaDesdeTab(tarjeta: Locator): Promise<Download> {
    await this.abrirMenuDeTarjeta(tarjeta);
    const downloadPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.PRINT_POPUP });
    await tarjeta.locator(L.PROFORMA_TAB_MENU_LINK_PDF).click();
    return downloadPromise;
  }


  /**
   * Presiona "Enviar email" en el menú de tres puntos de una tarjeta ya
   * abierta — abre un modal propio (`#dialog_sent_email_proform`, ver
   * L.PROFORMA_TAB_DIALOG_EMAIL): confirmado en vivo que, pese a servir el
   * mismo propósito y disparar la misma función/AJAX real de envío
   * (`send_proform_by_email` → AJAX_ENVIAR_PROFORMA_CORREO), NO es el mismo
   * modal que abre el listado externo (`#dialog_sent_email_info`) — tiene su
   * propio id y su propio campo de correos
   * (`#proform_email_tags-selectized`, no `#email_tags-selectized`).
   */
  async enviarEmailDesdeTab(tarjeta: Locator, correo: string): Promise<Response> {
    await this.abrirMenuDeTarjeta(tarjeta);
    await tarjeta.locator(L.PROFORMA_TAB_MENU_LINK_EMAIL).click();
    const dialogo = this.page.locator(L.PROFORMA_TAB_DIALOG_EMAIL);
    await expect(
      dialogo,
      'El modal "Enviar Cotización/Proforma por correo" no apareció tras presionar "Enviar email" en el menú de la tarjeta'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    // Botón/input acotados AL propio modal — confirmado en vivo que la clase
    // ".send_emails_btn" también existe en otro modal no relacionado
    // ("Puntos de cliente"), presente en el DOM aunque no esté visible;
    // buscarla a nivel de página completa viola el modo estricto de
    // Playwright (dos coincidencias) y, sin ese modo estricto, arriesgaría
    // clickear el botón equivocado.
    await dialogo.locator(L.PROFORMA_TAB_EMAIL_INPUT).fill(correo);
    await dialogo.locator(L.PROFORMA_TAB_EMAIL_INPUT).press('Enter');

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_ENVIAR_PROFORMA_CORREO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await dialogo.locator(L.PROFORMA_TAB_EMAIL_BTN_ENVIAR).click();
    return respuestaPromise;
  }


  /**
   * Presiona "Eliminar" en el menú de tres puntos de una tarjeta ya abierta
   * (misma función real `confirm_proform(id)` que usa el listado externo) y
   * confirma el SweetAlert v1 real ("¿Esta seguro eliminar esta proforma?",
   * botón "Aceptar"). A diferencia del listado externo (una ventana
   * emergente que se cierra sola tras el borrado exitoso), esta vía opera
   * en la MISMA pestaña del POS — quien llama debe revisitar la pestaña
   * después para confirmar que la tarjeta ya no aparece.
   */
  async eliminarProformaDesdeTab(tarjeta: Locator): Promise<string> {
    await this.abrirMenuDeTarjeta(tarjeta);
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_ELIMINAR_PROFORMA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await tarjeta.locator(L.PROFORMA_TAB_MENU_LINK_ELIMINAR).click();

    const dialogo = this.page.locator('.sweet-alert.visible');
    await expect(dialogo, 'No apareció la confirmación "¿Esta seguro eliminar esta proforma?"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await dialogo.locator('button.confirm').click();

    const respuesta = await respuestaPromise;
    return (await respuesta.text()).trim();
  }


  /**
   * Presiona "Imprimir" desde el panel de detalle de un listado ya abierto
   * (misma función real `downloadProformPdf(id, true)` que usa el modal de
   * Gestión, confirmado en vivo) y devuelve la ventana de impresión ya
   * cargada — mismo contrato que imprimirProforma().
   */
  async imprimirProformaSeleccionadaDelListado(listado: Page): Promise<Page> {
    const popupPromise = listado.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP });
    await listado.locator(L.LISTADO_PROFORMA_BTN_IMPRIMIR).click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    return popup;
  }


  /**
   * Presiona "PDF" desde el panel de detalle de un listado ya abierto
   * (misma función real `downloadProformPdf(id)` que usa el modal de
   * Gestión) y devuelve el evento de descarga real — mismo contrato que
   * descargarPdfProforma().
   */
  async descargarPdfProformaSeleccionadaDelListado(listado: Page): Promise<Download> {
    const downloadPromise = listado.waitForEvent('download', { timeout: TIMEOUTS.PRINT_POPUP });
    await listado.locator(L.LISTADO_PROFORMA_BTN_PDF).click();
    return downloadPromise;
  }


  /**
   * Envía por correo la Proforma cuyo detalle está actualmente cargado en
   * un listado ya abierto: abre el modal "Enviar Cotización/Proforma por
   * correo" (LISTADO_PROFORMA_BTN_EMAIL), escribe el correo indicado en el
   * widget selectize (confirmado en vivo que cada dirección se confirma con
   * Enter — no basta con `.fill()`) y presiona "Enviar". Ese botón dispara
   * la MISMA función/AJAX que enviarProformaPorCorreo() (send_proform_by_email
   * → AJAX_ENVIAR_PROFORMA_CORREO), así que responde con idéntico contrato
   * (texto plano "1"/"0").
   */
  async enviarProformaSeleccionadaDelListadoPorCorreo(listado: Page, correo: string): Promise<Response> {
    await listado.locator(L.LISTADO_PROFORMA_BTN_EMAIL).click();
    await expect(
      listado.locator(L.LISTADO_PROFORMA_DIALOG_EMAIL),
      'El modal "Enviar Cotización/Proforma por correo" no apareció'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await listado.locator(L.LISTADO_PROFORMA_EMAIL_INPUT).fill(correo);
    await listado.locator(L.LISTADO_PROFORMA_EMAIL_INPUT).press('Enter');

    const respuestaPromise = listado.waitForResponse(
      (res) => res.url().includes(L.AJAX_ENVIAR_PROFORMA_CORREO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await listado.locator(L.LISTADO_PROFORMA_EMAIL_BTN_ENVIAR).click();
    return respuestaPromise;
  }


  /**
   * Presiona el enlace "Facturar" del panel de detalle (id real
   * `print_proform_btn`, target="_blank") y devuelve la pestaña nueva que
   * abre hacia el POS con `proform_id`/`pos_type_option=5` ya en la query —
   * confirmado en vivo que precarga el nombre del cliente de la Proforma,
   * pero NO repuebla el carrito con sus líneas originales (ver el
   * comentario de L.LISTADO_PROFORMA_BTN_FACTURAR): este ambiente no ofrece
   * ninguna edición in-place real de una Proforma ya creada.
   */
  async abrirLinkFacturarDelListado(listado: Page): Promise<Page> {
    const [pestana] = await Promise.all([
      listado.context().waitForEvent('page', { timeout: TIMEOUTS.PRINT_POPUP }),
      listado.locator(L.LISTADO_PROFORMA_BTN_FACTURAR).click(),
    ]);
    await pestana.waitForLoadState('domcontentloaded');
    return pestana;
  }


  // ─── Cargar una Proforma existente al carrito (Facturar / Agregar Ítem / Convertir a Orden de Reparación) ──
  //
  // Clickear el CUERPO de una tarjeta (`add_pos_proform_order_to_table(id,0)`)
  // repuebla el carrito con sus líneas reales y el cliente ya asociado —
  // confirmado en vivo end-to-end: cliente real propagado, botón "AGREGAR
  // ITEMS" (infraestructura 100% genérica, ver abrirAgregarItem() en
  // PosCore) visible, y "Facturar" (#btn_pay_sale) funciona exactamente
  // igual que con cualquier otra venta armada — mismo modal de pago
  // (#dialog_payment) ya soportado por abrirModalDePago()/
  // confirmarPagoAbriendoCajaSiEsNecesario(), sin necesitar nada propio de
  // Proforma. A diferencia del enlace "Facturar" del listado EXTERNO
  // (L.LISTADO_PROFORMA_BTN_FACTURAR, que NO repuebla el carrito — ver su
  // comentario), esta vía SÍ es la real para facturar una Proforma ya
  // creada.

  /**
   * Carga una Proforma ya localizada (tarjeta de la pestaña "Proforma /
   * Cotizaciones") al carrito, clickeando su cuerpo, y espera dos señales
   * funcionales reales de que el carrito terminó de repoblarse: al menos
   * una línea visible (mismo contenedor genérico que usa el resto de la
   * suite para ventas cargadas — Órdenes de Caja, Importar Factura, Ruteo:
   * L.IMPORTAR_FACTURA_CARRITO_FILAS, no el id "drag_and_drop_" que solo
   * usan las líneas agregadas manualmente) y el cliente real propagado
   * (hayClienteRealSeleccionado()) — mismo criterio ya usado en
   * seleccionarOrdenRuteoParaFacturar().
   */
  /**
   * Solo confirma que las líneas de producto se cargaron al carrito — NO
   * asume que la Proforma tiene un cliente REAL asociado (a diferencia del
   * análogo de Ruteo, seleccionarOrdenRuteoParaFacturar()): confirmado en
   * vivo (root-cause real, no asumido) que una Proforma puede guardarse
   * válidamente con solo un nombre libre (ver el describe "Nombre del
   * cliente" y varios de "Productos múltiples"/"Descuento..." en "Proformas
   * — Crear", que nunca llaman a seleccionarClienteExistente()) — una
   * primera aserción aquí con hayClienteRealSeleccionado() fallaba con
   * timeout de 15s cada vez que "la primera Proforma disponible" del
   * sub-filtro resultaba ser una de esas, sin que hubiera ningún bug real de
   * carga. Los escenarios que sí necesitan garantizar un cliente real
   * (p. ej. Convertir a Orden de Reparación, que exige una Placa asociada al
   * cliente) lo validan explícitamente por su cuenta tras llamar a este
   * método.
   */
  async cargarProformaEnCarritoDesdeTab(tarjeta: Locator) {
    await tarjeta.click();

    await expect(
      this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
      'No se cargó ninguna línea de producto tras clickear la tarjeta de la Proforma'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  // ─── Convertir Proforma de Taller a Orden de Reparación ────────────────────
  // Confirmado en vivo (no documentado en ningún lugar del código antes de
  // esta investigación): "Convertir a orden de reparación" es una 7ª opción
  // del menú de tres puntos, presente SOLO en tarjetas del sub-filtro
  // Taller — ver el comentario completo de
  // L.PROFORMA_TAB_MENU_LINK_CONVERTIR_ORDEN.

  /**
   * Presiona "Convertir a orden de reparación" en el menú de tres puntos de
   * una tarjeta Taller ya abierta (abrirMenuTarjetaProformaEnTab()) y
   * espera a que el sistema responda con UNA de sus dos señales reales
   * (nunca ambas, confirmado en vivo): el toast de bloqueo
   * (TOAST_MESSAGE_GENERICO, sin cliente/placa) o el SweetAlert real de
   * confirmación (con cliente y placa ya completos). Devuelve cuál de las
   * dos ocurrió y su texto, sin decidir nada por su cuenta: el test
   * correspondiente decide el siguiente paso (validar el bloqueo, o
   * confirmar con confirmarConversionAOrdenDeReparacionYObtenerRespuesta()).
   */
  async intentarConvertirAOrdenDeReparacion(tarjeta: Locator): Promise<{ bloqueado: boolean; mensaje: string }> {
    await this.abrirMenuDeTarjeta(tarjeta);
    await tarjeta.locator(L.PROFORMA_TAB_MENU_LINK_CONVERTIR_ORDEN).click();

    const toast = this.page.locator(L.TOAST_MESSAGE_GENERICO);
    const sweetAlert = this.page.locator('.sweet-alert.visible');
    await Promise.race([
      toast.waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL }),
      sweetAlert.waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL }),
    ]);

    const bloqueado = await toast.isVisible().catch(() => false);
    if (bloqueado) {
      const mensaje = (await toast.textContent())?.trim() ?? '';
      return { bloqueado: true, mensaje };
    }
    const mensaje = (await sweetAlert.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
    return { bloqueado: false, mensaje };
  }


  /**
   * Selecciona la primera placa real disponible del cliente activo en el
   * carrito (panel "customer-selected", visible una vez que la Proforma ya
   * está cargada — ver cargarProformaEnCarritoDesdeTab()). Reutiliza el
   * mecanismo YA establecido de esta suite para widgets Chosen
   * (_seleccionarPrimeraOpcionChosen()/_obtenerTextoChosenSeleccionado()) —
   * confirmado en vivo que un click manual sobre el `<span>` visible NO
   * completa el evento `change` real que valida la conversión (ver el
   * comentario de L.PROFORMA_TAB_PLACA_CHOSEN), así que nunca se hace de
   * esa forma.
   *
   * Corrección de automatización (causa raíz confirmada en vivo
   * interceptando la red en 3 corridas consecutivas — ver el comentario de
   * L.AJAX_ACTUALIZAR_PLACA_PROFORMA): el evento `change` del widget
   * dispara un AJAX real (updateCustomerVehicleProform) que persiste la
   * placa en el servidor. Sin esperar su respuesta aquí, quien llama podía
   * reintentar la conversión antes de que el servidor terminara de
   * guardarla — condición de carrera que reproducía el bloqueo
   * ("...seleccione una placa!") en ~30% de las corridas pese a que el
   * widget ya mostraba la placa correctamente seleccionada del lado del
   * cliente.
   */
  async seleccionarPlacaClienteEnCarrito(): Promise<string> {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_ACTUALIZAR_PLACA_PROFORMA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );

    await this.core._seleccionarPrimeraOpcionChosen(L.PROFORMA_TAB_PLACA_CHOSEN);
    const placa = await this.core._obtenerTextoChosenSeleccionado(L.PROFORMA_TAB_PLACA_CHOSEN);
    expect(placa, 'La placa seleccionada no quedó reflejada en el selector').not.toBe('');

    const respuesta = await respuestaPromise;
    expect(respuesta.ok(), `updateCustomerVehicleProform no respondió OK (status ${respuesta.status()})`).toBe(true);

    return placa;
  }


  /**
   * Confirma el SweetAlert real de "Convertir a orden de reparación"
   * (mismo patrón _confirmarSweetAlertV1() ya establecido) y espera la
   * respuesta real del AJAX que efectivamente crea la orden
   * (AJAX_CONVERTIR_PROFORMA_ORDEN, `pos/convertProformToOrder`) — confirmado
   * en vivo interceptando la red completa tras confirmar.
   */
  async confirmarConversionAOrdenDeReparacionYObtenerRespuesta(): Promise<Response> {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_CONVERTIR_PROFORMA_ORDEN),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.core._confirmarSweetAlertV1('No apareció la confirmación "¿Esta seguro convertir esta proforma a orden?"');
    return respuestaPromise;
  }
}
