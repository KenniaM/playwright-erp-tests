import { expect, Download, Locator, Page, Response } from '@playwright/test';
import { L } from './pos.locators';
import {
  TIMEOUTS, PAUSES, CAJA_TEXTO, CHECKBOX_ID, PestanaPos, PESTANA_POS_FACTURACION,
  PESTANAS_POS_A_RECORRER, MetodoPago, METODO, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT,
  TipoPagoOrdenCaja, TipoProforma, VEHICULO_PINTURA_TIPO, COMPANIA_POS, CABYS_BUSQUEDA,
  CABYS_BUSQUEDA_SIN_IVA, PRECIO_PRODUCTO_RAPIDO, EscenarioDescuento, ResultadoDescuento,
  EstadoCheckIva, ConfigBusquedaCabys, LineaCarrito, MetadatoProducto, DASHBOARD_URL,
} from './pos.types';
import { PosCore } from './pos-core.page';
import { PosPayment } from './pos-payment.page';

// Parte del plan de migración a composición: dominio "PROFORMA" extraído
// de pos.page.ts. Depende de core, payment por inyección de
// constructor (composición, no herencia) — nunca al revés. Miembros que eran
// 'private' en el monolito pasan a públicos aquí por el mismo motivo que en
// PosCore: los llama la fachada por composición, no por herencia.
export class PosProforma {
  private readonly core: PosCore;
  private readonly payment: PosPayment;

  constructor(core: PosCore, payment: PosPayment) {
    this.core = core;
    this.payment = payment;
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
}
