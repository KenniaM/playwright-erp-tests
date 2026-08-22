import { expect, Locator, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  CARGA:    15_000,
} as const;

// ─── URLs ─────────────────────────────────────────────────────────────────────

export const URL_PANEL_GASTOS = BASE_URL + '/expense/expense';
export const URL_AGREGAR_GASTO = BASE_URL + '/expense/expenseInvoice';

// ─── Page Object: Compras > Agregar gastos ─────────────────────────────────
//
// "Panel de Gastos" (`/expense/expense`, botón "Agregar" del sidebar
// "Compras") — analizado en vivo (ambiente qa_restaurant, compañía
// "Restaurante Rancho Robertos"; scripts de investigación descartados tras
// extraer la evidencia):
//
// - El listado (`/expense/expense`) tiene: buscador (`#invoice_search`),
//   rango de fechas (`#start_date`/`#end_date`), botón "Agregar"
//   (`#add_purchase`, un <a href> real que NAVEGA a `/expense/expenseInvoice`
//   — NO abre un modal) y botón "Abonar" (`#add_payment_btn`, no investigado
//   en esta sesión — fuera de alcance). La tabla real de la lista tiene las
//   columnas #Factura/Proveedor/Fecha/Tipo Compra/Estado/Servicio/
//   Subservicio/Descuento/IVA/Subtotal/Total/Pago Inicial/Saldo.
// - El formulario "Agregar gasto" (`/expense/expenseInvoice`) es una
//   FACTURA DE GASTO A PROVEEDOR completa, con: Factura/Guía, Tipo de
//   Gasto/Tipo de Servicio (Chosen, catálogo vacío en este ambiente — solo
//   el placeholder, sin ninguna opción real configurada), Asignar Proveedor
//   (Chosen — un único proveedor real en este ambiente: "Proveedor 1"),
//   Fecha de Facturación, Cuenta Bancaria Origen + "Transferencia entre
//   cuentas" (revela Empresa/Cuenta Bancaria Destino), Moneda (Chosen — 5
//   monedas reales: CRC/USD/EUR/HNL/MXN) + Tipo de cambio, tipo de pago
//   Contado/Crédito (checkboxes — Crédito revela Días de Plazo/Fecha de
//   Inicio/Fecha de Caducidad/Pago Inicial), Monto, Descuento General (%),
//   "¿Aplicar Impuesto?" (revela Tarifa de Impuesto, 15 tarifas reales
//   configuradas), "¿Agregar Productos?" (alterna entre modo con líneas de
//   producto real vs. campos libres "Nombre del gasto"/"Nombre del
//   servicio" — no se logró hacer visible ninguno de los dos en las
//   condiciones probadas, ver hallazgo de sistema abajo) y Observaciones.
//
// BUG DE SISTEMA CONFIRMADO EN VIVO (múltiples intentos, ambiente
// restaurante): el botón "Guardar" (`#save_purchase`, `type="submit"`, SIN
// `onclick`) no está dentro de ningún `<form>` real del documento
// (confirmado con `closest('form')` → null). Al hacer click, NO se dispara
// ninguna request de red (confirmado registrando TODAS las requests de la
// página sin filtro), NO aparece ningún SweetAlert2 ni `.noty_bar`, NO
// cambia la URL y NO se dispara ningún error de consola ni evento `invalid`
// nativo — el botón es efectivamente NO FUNCIONAL en este ambiente: no hay
// forma de crear un gasto real desde esta pantalla. Esto bloquea cualquier
// validación de integración (crear gasto → validar en Reportes > Compras >
// Gastos) para este módulo en este ambiente — documentado, no ocultado.
export class ComprasAgregarGastosPage {
  constructor(private readonly page: Page) {}

  // ─── Listado (Panel de Gastos) ───────────────────────────────────────
  private readonly buscadorListado = () => this.page.locator('#invoice_search');
  private readonly fechaInicialListado = () => this.page.locator('#start_date');
  private readonly fechaFinalListado = () => this.page.locator('#end_date');
  private readonly btnBuscarListado = () => this.page.locator('#btn_search');
  private readonly btnAgregar = () => this.page.locator('#add_purchase');
  private readonly btnAbonar = () => this.page.locator('#add_payment_btn');

  async abrirPanelGastos() {
    await this.page.goto(URL_PANEL_GASTOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await this.cerrarBannerNotificaciones();
  }

  /**
   * El banner "Activar notificaciones" puede reaparecer de forma asíncrona
   * justo antes del click (mismo patrón ya documentado en otras partes de
   * la suite, p. ej. `PosCore.abrirProductoRapido()`) — `abrirPanelGastos()`
   * ya lo cierra una vez al cargar, pero eso no garantiza que siga cerrado
   * para este segundo click. Reintento acotado cerrando el banner antes de
   * cada intento, en vez de un único click con timeout largo.
   */
  async irAAgregarGasto() {
    const MAX_INTENTOS = 5;
    let clickeado = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !clickeado; intento++) {
      await this.cerrarBannerNotificaciones();
      clickeado = await this.btnAgregar()
        .click({ timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
    }
    expect(clickeado, `El botón "Agregar" no se pudo clickear tras ${MAX_INTENTOS} intentos`).toBe(true);

    await this.page.waitForURL(/expenseInvoice/, { timeout: TIMEOUTS.NAVIGATE });
    await this.cerrarBannerNotificaciones();
  }

  botonAbonarVisible(): Promise<boolean> {
    return this.btnAbonar().isVisible();
  }

  // ─── Formulario "Agregar gasto" ──────────────────────────────────────

  private readonly campoFactura = () => this.page.locator('#purchase_invoice');
  private readonly campoGuia = () => this.page.locator('#purchase_guide');
  private readonly campoFechaFacturacion = () => this.page.locator('#purchase_date');
  private readonly checkboxContado = () => this.page.locator('#is_contado');
  private readonly checkboxCredito = () => this.page.locator('#is_credit');
  private readonly campoMonto = () => this.page.locator('#expense_amount');
  private readonly campoDescuentoGeneral = () => this.page.locator('#purchase_discount');
  private readonly checkboxAplicarDescuento = () => this.page.locator('#apply_general_discount');
  private readonly checkboxAplicarImpuesto = () => this.page.locator('#search_product_apply_tax');
  private readonly checkboxAgregarProductos = () => this.page.locator('#search_product_has_items');
  private readonly campoObservaciones = () => this.page.locator('#purchase_comment');
  private readonly campoTipoCambio = () => this.page.locator('#expense_currency_exchange');
  private readonly btnGuardar = () => this.page.locator('#save_purchase');
  private readonly btnLimpiar = () => this.page.locator('#cancel_purchase');

  async llenarFactura(texto: string) {
    await this.campoFactura().fill(texto);
  }

  async llenarFechaFacturacion(fechaISO: string) {
    await this.campoFechaFacturacion().fill(fechaISO);
  }

  /** Selecciona una opción real de un Chosen por su texto visible (widget jQuery Chosen estándar de este ERP). */
  async seleccionarChosenPorTexto(idSelectReal: string, texto: string) {
    const contenedor = `#${idSelectReal}_chosen`;
    const trigger = this.page.locator(`${contenedor} .chosen-single`);
    await expect(trigger, `El Chosen "${idSelectReal}" nunca quedó visible`).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await trigger.click();
    const opcion = this.page.locator(`${contenedor} .chosen-results li`, { hasText: texto });
    await expect(opcion, `El Chosen "${idSelectReal}" no tiene ninguna opción real con el texto "${texto}"`).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await opcion.click();
  }

  /** Devuelve las opciones reales (texto) disponibles en un Chosen, sin seleccionar ninguna — útil para confirmar catálogos vacíos. */
  async obtenerOpcionesRealesDeSelect(idSelectReal: string): Promise<string[]> {
    return this.page.locator(`#${idSelectReal} option:not([value=""])`).allInnerTexts();
  }

  async seleccionarProveedor(nombre: string) {
    await this.seleccionarChosenPorTexto('purchase_provider', nombre);
  }

  async seleccionarMoneda(codigoOrTexto: string) {
    await this.seleccionarChosenPorTexto('expense_currency_select', codigoOrTexto);
  }

  async marcarContado() {
    await this.checkboxContado().check({ force: true });
  }

  async marcarCredito() {
    await this.checkboxCredito().check({ force: true });
  }

  async llenarMonto(monto: string) {
    await this.campoMonto().fill(monto);
  }

  async llenarObservaciones(texto: string) {
    await this.campoObservaciones().fill(texto);
  }

  async obtenerTipoCambio(): Promise<string> {
    return this.campoTipoCambio().inputValue();
  }

  /**
   * Presiona "Guardar" y reporta si produjo algún efecto observable
   * (request de red, SweetAlert2, `.noty_bar` o cambio de URL) dentro de un
   * margen de espera acotado. Ver el hallazgo de sistema documentado en el
   * encabezado de esta clase: en el ambiente restaurante, ningún intento
   * produjo ningún efecto — este método existe para que el propio test lo
   * confirme (y lo re-confirme automáticamente si algún día se corrige),
   * nunca para forzar una validación de éxito inexistente.
   */
  async presionarGuardarYObservarEfecto(): Promise<{ huboRequest: boolean; huboSwal: boolean; huboNoty: boolean; urlCambio: boolean }> {
    const urlAntes = this.page.url();
    let huboRequest = false;
    const listener = () => { huboRequest = true; };
    this.page.on('request', listener);

    await this.btnGuardar().scrollIntoViewIfNeeded();
    await this.btnGuardar().click();

    // Espera activa y acotada a que ocurra CUALQUIER efecto real (request o
    // cambio de URL) — nunca un tiempo fijo: si nunca ocurre nada (el
    // hallazgo real confirmado en vivo), el poll simplemente agota su
    // timeout y este método sigue de largo para que el test lea el estado
    // final tal cual quedó.
    await expect.poll(() => huboRequest || this.page.url() !== urlAntes, { timeout: 5_000 }).toBe(true).catch(() => {});

    this.page.off('request', listener);

    const huboSwal = await this.page.locator('.swal2-popup').isVisible().catch(() => false);
    const huboNoty = await this.page.locator('.noty_bar').isVisible().catch(() => false);
    const urlCambio = this.page.url() !== urlAntes;

    return { huboRequest, huboSwal, huboNoty, urlCambio };
  }

  async validarSinErrores() {
    await expect(this.page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  }

  private async cerrarBannerNotificaciones() {
    await this.page.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 3_000 }).catch(() => {});
  }
}
