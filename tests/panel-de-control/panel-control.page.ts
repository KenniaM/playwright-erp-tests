import { expect, Locator, Page } from '@playwright/test';

// ─── URL ──────────────────────────────────────────────────────────────────────

export const PANEL_CONTROL_URL =
  'https://dev.designsoftcr.com/qa_talleralpha/public/sett/setting';

// Primera sección del acordeón del tab Dashboard ("Dashboard" propiamente),
// donde vive el select de idioma.
export const SECCION_DASHBOARD = {
  BOTON:     'dashboard_button_setting_1',
  CONTENIDO: 'dashboard_content_settings_1',
} as const;

// Sección "Configuración general de ventas" del acordeón del tab Dashboard,
// donde viven el documento electrónico por defecto y el checkbox de
// seguridad de descuento excedido.
export const SECCION_VENTAS = {
  BOTON:     'dashboard_button_setting_8',
  CONTENIDO: 'dashboard_content_settings_8',
} as const;

// Sección "Tracking de órdenes online para clientes" del acordeón del tab
// Dashboard. Tiene además un checkbox (#enable_hide_fields_online_repair_order)
// que revela una tabla anidada de ~23 checkboxes sin id propio respaldados por
// un campo hidden JSON — sub-funcionalidad distinta, no cubierta aquí.
export const SECCION_TRACKING_ORDENES = {
  BOTON:     'dashboard_button_setting_11',
  CONTENIDO: 'dashboard_content_settings_11',
} as const;

// Sección "Compras" del acordeón del tab Dashboard.
export const SECCION_COMPRAS = {
  BOTON:     'dashboard_button_setting_17',
  CONTENIDO: 'dashboard_content_settings_17',
} as const;

// Sección "Impresión de cierres de caja" del acordeón del tab Dashboard.
export const SECCION_IMPRESION_CIERRES_CAJA = {
  BOTON:     'dashboard_button_setting_3',
  CONTENIDO: 'dashboard_content_settings_3',
} as const;

// Resto de secciones del acordeón del tab Dashboard, mapeadas mediante
// exploración en vivo del módulo (ver informe de la suite CHECKBOXES_DASHBOARD
// más abajo). Cada una expone el mismo patrón botón/contenido numerado.
export const SECCION_IMPRESION_FACTURA = {
  BOTON:     'dashboard_button_setting_2',
  CONTENIDO: 'dashboard_content_settings_2',
} as const;

export const SECCION_INVENTARIO = {
  BOTON:     'dashboard_button_setting_4',
  CONTENIDO: 'dashboard_content_settings_4',
} as const;

export const SECCION_POS = {
  BOTON:     'dashboard_button_setting_5',
  CONTENIDO: 'dashboard_content_settings_5',
} as const;

export const SECCION_RECEPCION_VEHICULAR = {
  BOTON:     'dashboard_button_setting_6',
  CONTENIDO: 'dashboard_content_settings_6',
} as const;

export const SECCION_ENVIO_FACTURAS = {
  BOTON:     'dashboard_button_setting_7',
  CONTENIDO: 'dashboard_content_settings_7',
} as const;

export const SECCION_VENTAS_CREDITO = {
  BOTON:     'dashboard_button_setting_9',
  CONTENIDO: 'dashboard_content_settings_9',
} as const;

export const SECCION_PLANTILLAS_PDF_ORDENES = {
  BOTON:     'dashboard_button_setting_10',
  CONTENIDO: 'dashboard_content_settings_10',
} as const;

export const SECCION_ASADA = {
  BOTON:     'dashboard_button_setting_12',
  CONTENIDO: 'dashboard_content_settings_12',
} as const;

export const SECCION_MODULOS_MOBILE = {
  BOTON:     'dashboard_button_setting_13',
  CONTENIDO: 'dashboard_content_settings_13',
} as const;

export const SECCION_CONSECUTIVOS_COMPROBANTES = {
  BOTON:     'dashboard_button_setting_15',
  CONTENIDO: 'dashboard_content_settings_15',
} as const;

export const SECCION_TERMINOS_FIRMA = {
  BOTON:     'dashboard_button_setting_16',
  CONTENIDO: 'dashboard_content_settings_16',
} as const;

export const SECCION_COMPRAS_EXTERNAS = {
  BOTON:     'dashboard_button_setting_18',
  CONTENIDO: 'dashboard_content_settings_18',
} as const;

export const SECCION_FIDELIDAD_CLIENTES = {
  BOTON:     'dashboard_button_setting_19',
  CONTENIDO: 'dashboard_content_settings_19',
} as const;

export const SECCION_COMISIONES = {
  BOTON:     'dashboard_button_setting_20',
  CONTENIDO: 'dashboard_content_settings_20',
} as const;

export const SECCION_CREDITO_CLIENTES = {
  BOTON:     'dashboard_button_setting_21',
  CONTENIDO: 'dashboard_content_settings_21',
} as const;

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:       60_000,
  NAVIGATE:   60_000,
  // Las pestañas y el acordeón de secciones se popula tras cargar la página
  // y puede tardar en aparecer — se hace polling hasta este límite antes de
  // leer el estado del módulo.
  TABLE_LOAD: 15_000,
} as const;

// ─── Locators ─────────────────────────────────────────────────────────────────

const L = {
  NAV_TABS:        '.nav-tabs',
  TAB_LINKS:       '.nav-tabs a[data-toggle="tab"]',
  BUSCADOR:        '#input_search_setting',
  BTN_GUARDAR:     '#save_settings',
  // Cada sección del acordeón del tab Dashboard expone un botón con este
  // prefijo de id.
  SECCIONES:       '[id^="dashboard_button_setting_"]',
  NOTIF_DISMISS:   '#workshop-web-notification-permission-dismiss',
  TAB_DASHBOARD:   'a[href="#dash"]',
  TAB_TIENDA:      'a[href="#store"]',
  TAB_TWILIO:      'a[href="#twilio_config"]',
  PANE_DASHBOARD:  '#dash',
  PANE_TIENDA:     '#store',
  PANE_TWILIO:     '#twilio_config',
  SELECT_IDIOMA:           '#language_select',
  SELECT_DOC_ELECTRONICO:  '#default_electronic_document_type',
  CHECKBOX_SEGURIDAD_DESCUENTO: '#seller_confirmation_an_order_exceeds_max_discount',
  INPUT_DESCUENTO_GENERAL:      '#max_general_discount',
  CHECKBOX_LIMITE_DESCUENTO_ROL: '#limit_discount_by_role',
  // Solo se usa para verificar que la tabla de descuento por rol se revela/oculta
  // al togglear el checkbox de arriba — no se le asigna valor (ver nota en el spec).
  INPUT_DESCUENTO_ROL_1:         '#role_discount_1',
  CHECKBOX_STOCK_NEGATIVO:       '#allow_negative_product_sale',
  CHECKBOX_TOTAL_DOLARES:        '#show_total_dolar',
  CHECKBOX_PRECIOS_TRACKING_ORDENES: '#show_prices_totals_customer_order_tracking_checkbox',
  CHECKBOX_IMAGEN_ORDENES_COMPRA: '#show_image_purchase_proform_checkbox',
  CHECKBOX_CUADRE_POR_DENOMINACION: '#enable_cash_counting_by_denomination',
} as const;

// ─── Page Object ──────────────────────────────────────────────────────────────

export class PanelControlPage {
  constructor(private readonly page: Page) {}

  get navTabs() {
    return this.page.locator(L.NAV_TABS);
  }

  get pestañasLinks(): Locator {
    return this.page.locator(L.TAB_LINKS);
  }

  get buscador() {
    return this.page.locator(L.BUSCADOR);
  }

  get botonGuardar() {
    return this.page.locator(L.BTN_GUARDAR);
  }

  get secciones(): Locator {
    return this.page.locator(L.SECCIONES);
  }

  get pestañaDashboard() {
    return this.page.locator(L.TAB_DASHBOARD);
  }

  get pestañaTienda() {
    return this.page.locator(L.TAB_TIENDA);
  }

  get pestañaTwilio() {
    return this.page.locator(L.TAB_TWILIO);
  }

  get paneDashboard() {
    return this.page.locator(L.PANE_DASHBOARD);
  }

  get paneTienda() {
    return this.page.locator(L.PANE_TIENDA);
  }

  /** Pane de Twilio: en este módulo el tab existe pero no llega a renderizar su contenido. */
  get paneTwilio() {
    return this.page.locator(L.PANE_TWILIO);
  }

  get selectIdioma() {
    return this.page.locator(L.SELECT_IDIOMA);
  }

  get selectDocumentoElectronico() {
    return this.page.locator(L.SELECT_DOC_ELECTRONICO);
  }

  get checkboxSeguridadDescuento() {
    return this.page.locator(L.CHECKBOX_SEGURIDAD_DESCUENTO);
  }

  get inputDescuentoGeneral() {
    return this.page.locator(L.INPUT_DESCUENTO_GENERAL);
  }

  get checkboxLimiteDescuentoRol() {
    return this.page.locator(L.CHECKBOX_LIMITE_DESCUENTO_ROL);
  }

  /** Primer campo de la tabla de descuento por rol, oculta hasta que se activa `checkboxLimiteDescuentoRol`. */
  get inputDescuentoRol1() {
    return this.page.locator(L.INPUT_DESCUENTO_ROL_1);
  }

  get checkboxStockNegativo() {
    return this.page.locator(L.CHECKBOX_STOCK_NEGATIVO);
  }

  get checkboxTotalDolares() {
    return this.page.locator(L.CHECKBOX_TOTAL_DOLARES);
  }

  get checkboxPreciosTrackingOrdenes() {
    return this.page.locator(L.CHECKBOX_PRECIOS_TRACKING_ORDENES);
  }

  get checkboxImagenOrdenesCompra() {
    return this.page.locator(L.CHECKBOX_IMAGEN_ORDENES_COMPRA);
  }

  get checkboxCuadrePorDenominacion() {
    return this.page.locator(L.CHECKBOX_CUADRE_POR_DENOMINACION);
  }

  /**
   * Acceso genérico a cualquier checkbox del acordeón del Dashboard por su id.
   * Se usa desde la suite data-driven `CHECKBOXES_DASHBOARD` (panel-control.spec.ts)
   * para no tener que declarar un getter dedicado por cada uno de los ~130
   * checkboxes del tab — evita duplicar ~130 getters casi idénticos.
   */
  checkbox(id: string): Locator {
    return this.page.locator(`#${id}`);
  }

  /**
   * Marca/desmarca un checkbox del acordeón por id sin depender de que su
   * `<input>` nativo sea clickeable. Varios de estos checkboxes se apoyan en
   * un widget que oculta visualmente el input (tamaño cero en el layout), lo
   * que hace que `locator.setChecked({ force: true })` falle con "Element is
   * outside of the viewport" al intentar hacer scroll hacia él — confirmado
   * en vivo contra el ambiente real. Se ajusta la propiedad `checked` y se
   * disparan los eventos `click`/`change` igual que haría una interacción
   * real con el control visible, sin pasar por las comprobaciones de
   * actionability de Playwright.
   */
  async marcarCheckbox(idOLocator: string | Locator, valor: boolean) {
    const locator = typeof idOLocator === 'string' ? this.checkbox(idOLocator) : idOLocator;
    await locator.evaluate((el: HTMLInputElement, checked) => {
      if (el.checked === checked) return;
      el.checked = checked;
      el.dispatchEvent(new Event('click', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, valor);
  }

  /** Único punto de entrada al módulo Panel de Control. */
  async irAPanelControl() {
    await this.page.goto(PANEL_CONTROL_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }

  /** Espera hasta que las pestañas del módulo estén presentes en el DOM. */
  async esperarCarga() {
    await expect(this.navTabs).toBeAttached({ timeout: TIMEOUTS.TABLE_LOAD });
  }

  /** Cierra el popup de permiso de notificaciones del navegador, si aparece. */
  async cerrarNotificacionPermiso() {
    await this.page.evaluate((selector) => {
      document.querySelector<HTMLElement>(selector)?.click();
    }, L.NOTIF_DISMISS);
  }

  /** Textos limpios de las pestañas visibles (Dashboard/Tienda online/Twilio). */
  async nombresPestañas(): Promise<string[]> {
    const textos = await this.pestañasLinks.allTextContents();
    return textos.map((t) => t.replace(/\s+/g, ' ').trim());
  }

  /** Indica si un pane de contenido (`.tab-pane`) está actualmente activo. */
  async estaActivo(pane: Locator): Promise<boolean> {
    const clases = await pane.getAttribute('class');
    return (clases ?? '').split(/\s+/).includes('active');
  }

  /** Cantidad de campos editables (input/select/textarea) dentro de un pane. */
  async cantidadCampos(pane: Locator): Promise<number> {
    return pane.locator('input, select, textarea').count();
  }

  /**
   * Estado de un campo cuya visibilidad o habilitación depende de otro
   * checkbox (confirmado por exploración en vivo, ver informe de
   * CHECKBOXES_DASHBOARD en panel-control.spec.ts): "visible" reporta si el
   * campo está renderizado en pantalla; "habilitado" reporta si NO está
   * disabled (algunos checkboxes no ocultan el campo dependiente, solo
   * habilitan su edición — p.ej. los consecutivos de Honduras).
   */
  async estadoCampoDependiente(id: string, efecto: 'visible' | 'habilitado'): Promise<boolean> {
    const campo = this.checkbox(id);
    return efecto === 'visible' ? campo.isVisible() : campo.isEnabled();
  }

  /**
   * Expande una sección del acordeón (botón + contenido colapsable) si no
   * está ya abierta. El acordeón alterna la visibilidad del contenido al
   * hacer clic en su botón, en vez de navegar o abrir un modal.
   */
  async abrirSeccion(seccion: { BOTON: string; CONTENIDO: string }) {
    const contenido = this.page.locator(`#${seccion.CONTENIDO}`);
    if (!(await contenido.isVisible())) {
      await this.page.locator(`#${seccion.BOTON}`).click();
    }
    await expect(contenido).toBeVisible({ timeout: TIMEOUTS.TABLE_LOAD });
  }

  /**
   * Igual que `abrirSeccion`, pero no falla si el contenido nunca queda
   * visible. Confirmado en vivo: el botón de acordeón de
   * SECCION_CREDITO_CLIENTES ("Módulo de Crédito para clientes") no quita la
   * clase `hide` de su contenido pase lo que pase (bug de la app, no de esta
   * suite) — pero los campos existen en el DOM y se pueden leer/marcar/
   * guardar igual sin que la sección esté visualmente abierta. Se usa desde
   * la suite data-driven `CHECKBOXES_DASHBOARD` para no depender de que el
   * acordeón realmente abra.
   */
  async abrirSeccionTolerante(seccion: { BOTON: string; CONTENIDO: string }) {
    const contenido = this.page.locator(`#${seccion.CONTENIDO}`);
    if (!(await contenido.isVisible())) {
      await this.page.locator(`#${seccion.BOTON}`).click();
    }
    await expect(contenido).toBeVisible({ timeout: TIMEOUTS.TABLE_LOAD }).catch(() => {});
  }

  /** Guarda la configuración y espera a que la petición AJAX de guardado termine. */
  async guardarConfiguracion() {
    await this.botonGuardar.click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.TABLE_LOAD }).catch(() => {});
  }

  /**
   * Devuelve el `value` de una opción del select distinta a la actualmente
   * seleccionada, descartando el placeholder vacío — usado para probar que
   * un cambio de valor persiste sin depender de una opción fija.
   */
  async opcionDistinta(select: Locator): Promise<string> {
    const valorActual = await select.inputValue();
    const opciones = await select.locator('option').all();
    for (const opcion of opciones) {
      const valor = await opcion.getAttribute('value');
      if (valor && valor !== valorActual) return valor;
    }
    throw new Error('No hay ninguna opción alternativa disponible en el select');
  }
}
