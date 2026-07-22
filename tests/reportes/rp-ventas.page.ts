import { Download, expect, Page } from '@playwright/test';
import { contentHeaderConTexto, SubmoduloReportes, TIMEOUTS } from './reportes.page';

/**
 * No incluye "Comisiones por Producto" (reports/productCommissionReport) —
 * ver nota en reportes.page.ts: la navegación nunca termina de cargar.
 * Re-confirmado en vivo en esta sesión (timeout de 90s+ sin resultado).
 */
export const SUBMODULOS_REPORTES_VENTAS: SubmoduloReportes[] = [
  {
    nombre: 'Ventas',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/salesReport',
    rutaEsperada: 'salesReport',
    tituloEsperado: /reporte de ventas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de ventas/i),
  },
  {
    nombre: 'Ventas por producto',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/salesByProductReport',
    rutaEsperada: 'salesByProductReport',
    tituloEsperado: /ventas por producto/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /ventas por producto/i),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el botón real de filtros avanzados, que sí es visible.
    nombre: 'Análisis de ventas por vendedor Nuevo',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/sales_by_seller_tire_report',
    rutaEsperada: 'sales_by_seller_tire_report',
    tituloEsperado: /an[aá]lisis de ventas por vendedor/i,
    obtenerLocatorDeCarga: (page) => page.locator('#stv_btn_toggle_advanced_filters'),
  },
  {
    nombre: 'Abonos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/credit_payment_report',
    rutaEsperada: 'credit_payment_report',
    tituloEsperado: /reporte de abonos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /abonos/i),
  },
  {
    nombre: 'Utilidad',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/utilityReport',
    rutaEsperada: 'utilityReport',
    tituloEsperado: /reporte de utilidad/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de utilidad/i),
  },
  {
    nombre: 'Lista de cobro',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/receivableListReport',
    rutaEsperada: 'receivableListReport',
    tituloEsperado: /reporte de cobro/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de cobro/i),
  },
  {
    nombre: 'Cuentas por cobrar',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/accounts_receivable',
    rutaEsperada: 'accounts_receivable',
    tituloEsperado: /cuentas por cobrar/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /cuentas por cobrar/i),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el buscador real, que sí es visible.
    nombre: 'Historial crediticio',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/credit_customer_history/creditCustomerHistoryIndex',
    rutaEsperada: 'creditCustomerHistoryIndex',
    tituloEsperado: /historial crediticio de cliente/i,
    obtenerLocatorDeCarga: (page) => page.locator('#f_search'),
  },
  {
    nombre: 'Antigüedad de crédito',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/seniority_of_credit',
    rutaEsperada: 'seniority_of_credit',
    tituloEsperado: /antig[üu]edad de cr[eé]dito/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /antig[üu]edad de cr[eé]dito/i),
  },
  {
    nombre: 'Comisiones por vendedor',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/salesPerSellerReport',
    rutaEsperada: 'salesPerSellerReport',
    tituloEsperado: /comisiones por vendedor/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /comisiones por vendedor/i),
  },
  {
    nombre: 'Facturas Hacienda',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/ElectronicBilling/ElectronicBillingReport',
    rutaEsperada: 'ElectronicBillingReport',
    tituloEsperado: /facturaci[oó]n electr[oó]nica/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /facturaci[oó]n electr[oó]nica/i),
  },
  {
    nombre: 'Ventas productos rapidos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/salesReportQuickProduct',
    rutaEsperada: 'salesReportQuickProduct',
    tituloEsperado: /ventas de productos r[aá]pidos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /ventas de productos r[aá]pidos/i),
  },
  {
    nombre: 'Ventas por vendedor',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/agentSalesReport',
    rutaEsperada: 'agentSalesReport',
    tituloEsperado: /ventas por vendedor/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /ventas por vendedor/i),
  },
  {
    nombre: '(%) Comisiones por Cobros',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/credit_sales_commissions_report',
    rutaEsperada: 'credit_sales_commissions_report',
    tituloEsperado: /comisiones por cobros/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /comisiones por cobros/i),
  },
  {
    nombre: 'Ventas por cliente',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/clientSalesReport',
    rutaEsperada: 'clientSalesReport',
    tituloEsperado: /ventas por cliente/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /ventas por cliente/i),
  },
  {
    nombre: 'Nota de crédito',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/creditNoteReport',
    rutaEsperada: 'creditNoteReport',
    tituloEsperado: /notas de cr[eé]dito/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /notas de cr[eé]dito/i),
  },
  {
    nombre: 'Ventas Tienda Online',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/getOnlineStoreSalesReport',
    rutaEsperada: 'getOnlineStoreSalesReport',
    tituloEsperado: /ventas de la tienda online/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /ventas de la tienda online/i),
  },
];

const URL_VENTAS = SUBMODULOS_REPORTES_VENTAS[0].url;
const URL_VENTAS_PRODUCTO = SUBMODULOS_REPORTES_VENTAS[1].url;
const URL_ANALISIS_VENTAS_VENDEDOR = SUBMODULOS_REPORTES_VENTAS[2].url;
const URL_ABONOS = SUBMODULOS_REPORTES_VENTAS[3].url;
const URL_UTILIDAD = SUBMODULOS_REPORTES_VENTAS[4].url;
const URL_LISTA_COBRO = SUBMODULOS_REPORTES_VENTAS[5].url;
const URL_CUENTAS_POR_COBRAR = SUBMODULOS_REPORTES_VENTAS[6].url;
const URL_ANTIGUEDAD_CREDITO = SUBMODULOS_REPORTES_VENTAS[8].url;
const URL_COMISIONES_VENDEDOR = SUBMODULOS_REPORTES_VENTAS[9].url;
const URL_FACTURAS_HACIENDA = SUBMODULOS_REPORTES_VENTAS[10].url;
const URL_VENTAS_PRODUCTOS_RAPIDOS = SUBMODULOS_REPORTES_VENTAS[11].url;
const URL_VENTAS_VENDEDOR = SUBMODULOS_REPORTES_VENTAS[12].url;
const URL_COMISIONES_POR_COBROS = SUBMODULOS_REPORTES_VENTAS[13].url;
const URL_VENTAS_CLIENTE = SUBMODULOS_REPORTES_VENTAS[14].url;
const URL_NOTAS_CREDITO = SUBMODULOS_REPORTES_VENTAS[15].url;
const URL_VENTAS_TIENDA_ONLINE = SUBMODULOS_REPORTES_VENTAS[16].url;
const URL_COMISIONES_PRODUCTO = 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productCommissionReport';

// ─── Utilidades compartidas ─────────────────────────────────────────────────

/** Convierte un monto mostrado en pantalla (p.ej. "$ 1,234.56", "₡ 500.00") a number. */
function montoANumero(texto: string): number {
  return parseFloat(texto.replace(/[^\d.-]/g, ''));
}

/** No hay ningún mensaje de error de aplicación (`.noty_bar`) visible en pantalla. */
async function validarSinErrores(page: Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

/** Mismo banner de notificaciones que el resto de la suite de Reportes. */
async function cerrarBannerNotificaciones(page: Page) {
  await page.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 8000 }).catch(() => {});
  await page.evaluate(() => {
    const el = document.getElementById('workshop-web-notification-permission');
    if (el) el.style.display = 'none';
  }).catch(() => {});
}

/**
 * Selecciona una moneda del menú compartido "Moneda: <actual>" (mismo
 * patrón estructural usado en Compras/Taller/Inventario: botón + `<ul>`
 * hermano).
 */
async function seleccionarMonedaGenerica(page: Page, etiqueta: string) {
  const boton = page.locator('button', { hasText: 'Moneda:' }).first();
  // El banner de notificaciones puede reaparecer sobre el header e
  // interceptar este clic (confirmado en vivo) — se vuelve a descartar
  // justo antes de clicar.
  await cerrarBannerNotificaciones(page);
  await boton.click({ force: true });
  const menu = boton.locator('xpath=following-sibling::ul[1]');
  await menu.locator('a', { hasText: etiqueta }).click();
}

/**
 * Algunos reportes de Ventas (confirmado en vivo: "Ventas por Cliente" y
 * "Nota de Crédito") tienen, además del `<input type="date">` nativo, un
 * widget bootstrap-datepicker redundante que queda abierto/huérfano tras
 * escribir con `.fill()` e intercepta clics posteriores (mismo patrón
 * documentado en Compras/Taller/Inventario). Clicar un elemento neutral
 * como `.content-header` lo cierra de forma confiable.
 */
async function cerrarDatepickerHuerfano(page: Page) {
  await page.locator('.content-header').first().click({ timeout: 5000 }).catch(() => {});
}

// ─── Reporte de Ventas ──────────────────────────────────────────────────────

/**
 * Reporte de Ventas (reports/salesReport).
 *
 * Analizado en vivo:
 * - Buscador (`#sales_invoice_search`), rango de fechas
 *   (`#sales_start_date`/`#sales_end_date`, `<input type="text">` — al
 *   escribir con `.fill()` el propio campo autocompleta la hora
 *   ("2020-01-15 12:00 AM") y el valor persiste correctamente tras
 *   "Buscar", confirmado en vivo — no es el mismo bug de datepicker
 *   huérfano visto en Compras/Taller/Inventario).
 * - 5 chips de estado: "Todas"/"Contado"/"Crédito"/"Créditos pendientes"/
 *   "Anuladas" (`#sale_state_all/cash/credit/pending/deleted`). Filtros:
 *   Tipo de pago (`#payment_type`), Categoría (`#company_category`),
 *   Subcategoría (`#company_subcategory`) y Moneda (menú compartido). Un
 *   botón adicional "Filtros de Vehículos" (`#btn_toggle_vehicle_filters`)
 *   revela filtros de marca/modelo/estilo de vehículo — no cubiertos aquí
 *   por no ser el caso de uso principal del reporte.
 * - "Buscar" (`#btn_search_receip`). Exportación real: único botón
 *   "Descargar" (`#btn_download_receivable_excel_report`).
 * - 2 tablas reales: la principal (facturas) y un resumen fiscal por
 *   moneda/impuesto.
 */
export class ReporteVentasPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#sales_invoice_search');
  private readonly fechaInicial = () => this.page.locator('#sales_start_date');
  private readonly fechaFinal = () => this.page.locator('#sales_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_receip');
  private readonly btnDescargar = () => this.page.locator('#btn_download_receivable_excel_report');
  private readonly filtroTipoPago = () => this.page.locator('#payment_type');
  private readonly filtroCategoria = () => this.page.locator('#company_category');
  private readonly filtroSubcategoria = () => this.page.locator('#company_subcategory');
  private readonly chipTodas = () => this.page.locator('#sale_state_all');
  private readonly chipContado = () => this.page.locator('#sale_state_cash');
  private readonly chipCredito = () => this.page.locator('#sale_state_credit');
  private readonly chipCreditosPendientes = () => this.page.locator('#sale_state_pending');
  private readonly chipAnuladas = () => this.page.locator('#sale_state_deleted');
  private readonly tabla = () => this.page.locator('table', { hasText: 'No. Factura Electrónica' }).first();

  async abrirReporteVentas() {
    await this.page.goto(URL_VENTAS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarTipoPago(etiqueta: string) {
    await this.filtroTipoPago().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarCategoria(etiqueta: string) {
    await this.filtroCategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarSubcategoria(etiqueta: string) {
    await this.filtroSubcategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMonedaGenerica(this.page, etiqueta);
  }

  async seleccionarEstadoTodas() {
    await this.chipTodas().click();
  }

  async seleccionarEstadoContado() {
    await this.chipContado().click();
  }

  async seleccionarEstadoCredito() {
    await this.chipCredito().click();
  }

  async seleccionarEstadoCreditosPendientes() {
    await this.chipCreditosPendientes().click();
  }

  async seleccionarEstadoAnuladas() {
    await this.chipAnuladas().click();
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla().locator('tbody tr').count();
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  /** BUG confirmado en vivo: el clic no dispara ninguna descarga real ni popup. */
  async clicEnDescargar() {
    await this.btnDescargar().click();
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Ventas por Producto ─────────────────────────────────────────

/**
 * Reporte de Ventas por Producto (reports/salesByProductReport).
 *
 * Analizado en vivo:
 * - Buscador (`#report_search`), rango de fechas (`#start_date`/
 *   `#end_date`, nativos), Compañía (`#company_select`) y Moneda (menú
 *   compartido).
 * - "Buscar" (`#btn_search_receip`). Exportación real: único botón
 *   "Descargar Excel" (`#btn_export_report`).
 * - Tabla pivote dinámica (un bloque de columnas por mes del año en curso)
 *   — no se asume un número fijo de columnas.
 */
export class ReporteVentasProductoPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#report_search');
  private readonly fechaInicial = () => this.page.locator('#start_date');
  private readonly fechaFinal = () => this.page.locator('#end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_receip');
  private readonly btnDescargar = () => this.page.locator('#btn_export_report');
  private readonly filtroCompania = () => this.page.locator('#company_select');
  private readonly tabla = () => this.page.locator('table', { hasText: 'Nombre de Producto' }).first();

  async abrirReporteVentasProducto() {
    await this.page.goto(URL_VENTAS_PRODUCTO, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarCompania(etiqueta: string) {
    await this.filtroCompania().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMonedaGenerica(this.page, etiqueta);
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla().locator('tbody tr').count();
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Análisis de Ventas por Vendedor ────────────────────────────

/**
 * Reporte de Análisis de Ventas por Vendedor (reports/sales_by_seller_tire_report).
 *
 * Analizado en vivo:
 * - Sin `.content-header` propio — se valida con el botón real de filtros
 *   avanzados (`#stv_btn_toggle_advanced_filters`).
 * - Buscador (`#stv_search`), rango de fechas (`#stv_start_date`/
 *   `#stv_end_date`, nativos), Compañía (`#stv_company_id`), Vendedor
 *   (`#stv_seller_ids`), Tipo de resumen (`#stv_summary_type`), Categoría
 *   (`#stv_category_id`) y Subcategoría (`#stv_subcategory_id`) — todos
 *   selects "chosen".
 * - "Buscar" (`#stv_btn_search`). Exportación real: único botón "Descargar
 *   Excel" (`#stv_btn_export_excel`).
 */
export class ReporteAnalisisVentasVendedorPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#stv_search');
  private readonly fechaInicial = () => this.page.locator('#stv_start_date');
  private readonly fechaFinal = () => this.page.locator('#stv_end_date');
  private readonly btnBuscar = () => this.page.locator('#stv_btn_search');
  private readonly btnDescargar = () => this.page.locator('#stv_btn_export_excel');
  private readonly filtroCompania = () => this.page.locator('#stv_company_id');
  private readonly filtroVendedor = () => this.page.locator('#stv_seller_ids');
  private readonly filtroTipoResumen = () => this.page.locator('#stv_summary_type');
  private readonly filtroCategoria = () => this.page.locator('#stv_category_id');
  private readonly filtroSubcategoria = () => this.page.locator('#stv_subcategory_id');

  async abrirReporteAnalisisVentasVendedor() {
    await this.page.goto(URL_ANALISIS_VENTAS_VENDEDOR, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarCompania(etiqueta: string) {
    await this.filtroCompania().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarVendedor(etiqueta: string) {
    await this.filtroVendedor().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarTipoResumen(etiqueta: string) {
    await this.filtroTipoResumen().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarCategoria(etiqueta: string) {
    await this.filtroCategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarSubcategoria(etiqueta: string) {
    await this.filtroSubcategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Abonos (Ventas) ────────────────────────────────────────────

/**
 * Reporte de Abonos (reports/credit_payment_report) — dentro del módulo
 * Ventas (distinto del "Abonos" de Compras, cubierto en rp-compras.page.ts).
 *
 * Analizado en vivo:
 * - Buscador (`#credit_payment_invoice_search`), rango de fechas
 *   (`#cash_start_date`/`#cash_end_date`, nativos), Cliente
 *   (`#credit_payment_customer_select`) y Moneda (menú compartido).
 * - "Buscar" (`#btn_credit_payment_search`). Exportación real: único botón
 *   "Descargar" (`#btn_download_report`).
 * - Tabla real, columnas: (expandir), #, Fecha, Recibo, Cliente, Compañía,
 *   Factura abonada, No Consecutivo, Tipo moneda, Monto.
 */
export class ReporteAbonosVentasPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#credit_payment_invoice_search');
  private readonly fechaInicial = () => this.page.locator('#cash_start_date');
  private readonly fechaFinal = () => this.page.locator('#cash_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_credit_payment_search');
  private readonly btnDescargar = () => this.page.locator('#btn_download_report');
  private readonly filtroCliente = () => this.page.locator('#credit_payment_customer_select');
  private readonly tabla = () => this.page.locator('table', { hasText: 'Recibo' }).first();

  async abrirReporteAbonos() {
    await this.page.goto(URL_ABONOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarCliente(etiqueta: string) {
    await this.filtroCliente().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMonedaGenerica(this.page, etiqueta);
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla().locator('tbody tr').count();
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  /** BUG confirmado en vivo: el clic no dispara ninguna descarga real ni popup. */
  async clicEnDescargar() {
    await this.btnDescargar().click();
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Utilidad ────────────────────────────────────────────────────

/**
 * Reporte de Utilidad (reports/utilityReport).
 *
 * Analizado en vivo:
 * - Buscador (`#search`), rango de fechas (`#start_date`/`#end_date`,
 *   `<input type="text">`), Resumen (`#resume`), Cliente (`#client_id`),
 *   Vendedor (`#seller_id`), Caja (`#cash_id`), Tipo de venta
 *   (`#type_sell_id`), Tipo de margen (`#margin_type`), Categoría
 *   (`#category_id`) y Subcategoría (`#sub_category_id`).
 * - "Buscar" (`#btn_search`). Exportación real: único botón "Descargar"
 *   (`#btn_download_receivable_excel_report`).
 * - Tabla real con columnas financieras completas (costos, precios,
 *   descuentos, impuestos, utilidad).
 */
export class ReporteUtilidadPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#search');
  private readonly fechaInicial = () => this.page.locator('#start_date');
  private readonly fechaFinal = () => this.page.locator('#end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search');
  private readonly btnDescargar = () => this.page.locator('#btn_download_receivable_excel_report');
  private readonly filtroResumen = () => this.page.locator('#resume');
  private readonly filtroCliente = () => this.page.locator('#client_id');
  private readonly filtroVendedor = () => this.page.locator('#seller_id');
  private readonly filtroCaja = () => this.page.locator('#cash_id');
  private readonly filtroTipoVenta = () => this.page.locator('#type_sell_id');
  private readonly filtroTipoMargen = () => this.page.locator('#margin_type');
  private readonly filtroCategoria = () => this.page.locator('#category_id');
  private readonly filtroSubcategoria = () => this.page.locator('#sub_category_id');
  private readonly tabla = () => this.page.locator('table', { hasText: 'Total de Utilidad' }).first();

  async abrirReporteUtilidad() {
    await this.page.goto(URL_UTILIDAD, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarResumen(etiqueta: string) {
    await this.filtroResumen().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarCliente(etiqueta: string) {
    await this.filtroCliente().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarVendedor(etiqueta: string) {
    await this.filtroVendedor().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarCaja(etiqueta: string) {
    await this.filtroCaja().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarTipoVenta(etiqueta: string) {
    await this.filtroTipoVenta().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarTipoMargen(etiqueta: string) {
    await this.filtroTipoMargen().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarCategoria(etiqueta: string) {
    await this.filtroCategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarSubcategoria(etiqueta: string) {
    await this.filtroSubcategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla().locator('tbody tr').count();
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  /** BUG confirmado en vivo: el clic no dispara ninguna descarga real ni popup. */
  async clicEnDescargar() {
    await this.btnDescargar().click();
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Lista de Cobro ──────────────────────────────────────────────

/**
 * Reporte de Lista de Cobro (reports/receivableListReport).
 *
 * Analizado en vivo:
 * - Buscador (`#receivable_search`), rango de fechas (`#start_date`/
 *   `#end_date`, nativos), Cliente (`#customer_select`), Vendedor
 *   (`#seller_select`), Zona (`#zone_select`) y Moneda (menú compartido).
 * - 2 presets rápidos: "Hoy"/"Semana" (`#show_list_0`/`#show_list_1`) y 3
 *   chips de estado: "Todas"/"Pendientes"/"Abonado" (`#show_list_status_0/1/2`).
 * - "Buscar" (`#btn_search_receip`). Sin botón de exportación (PDF/Excel)
 *   — confirmado en vivo. En su lugar, un menú de opciones (ícono
 *   `more_vert`, `#product_advanced_options_receivale_list`) con una
 *   función real "Imprimir reporte" (`#print_btn`), que abre una pestaña
 *   nueva con el documento.
 * - Tabla real, columnas: # Doc., Cliente, Nombre comercial, Zona,
 *   Vendedor, Fecha inicio, Fecha Vencimiento, Plazo, Retraso, Estado,
 *   Cuota, Total, Saldo, Teléfono.
 */
export class ReporteListaCobroPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#receivable_search');
  private readonly fechaInicial = () => this.page.locator('#start_date');
  private readonly fechaFinal = () => this.page.locator('#end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_receip');
  private readonly filtroCliente = () => this.page.locator('#customer_select');
  private readonly filtroVendedor = () => this.page.locator('#seller_select');
  private readonly filtroZona = () => this.page.locator('#zone_select');
  private readonly presetHoy = () => this.page.locator('#show_list_0');
  private readonly presetSemana = () => this.page.locator('#show_list_1');
  private readonly chipTodas = () => this.page.locator('#show_list_status_0');
  private readonly chipPendientes = () => this.page.locator('#show_list_status_1');
  private readonly chipAbonado = () => this.page.locator('#show_list_status_2');
  private readonly btnOpciones = () => this.page.locator('#product_advanced_options_receivale_list');
  private readonly btnImprimir = () => this.page.locator('#print_btn');
  private readonly tabla = () => this.page.locator('table', { hasText: 'Fecha Vencimiento' }).first();

  async abrirReporteListaCobro() {
    await this.page.goto(URL_LISTA_COBRO, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarCliente(etiqueta: string) {
    await this.filtroCliente().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarVendedor(etiqueta: string) {
    await this.filtroVendedor().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarZona(etiqueta: string) {
    await this.filtroZona().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMonedaGenerica(this.page, etiqueta);
  }

  async seleccionarPresetHoy() {
    await this.presetHoy().click();
  }

  async seleccionarPresetSemana() {
    await this.presetSemana().click();
  }

  async seleccionarEstadoTodas() {
    await this.chipTodas().click();
  }

  async seleccionarEstadoPendientes() {
    await this.chipPendientes().click();
  }

  async seleccionarEstadoAbonado() {
    await this.chipAbonado().click();
  }

  async imprimir() {
    await this.btnOpciones().click();
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.CARGA });
    await this.btnImprimir().click();
    return popupPromise;
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla().locator('tbody tr').count();
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Cuentas por Cobrar (Ventas) ────────────────────────────────

/**
 * Reporte de Cuentas por Cobrar (reports/accounts_receivable) — dentro del
 * módulo Ventas (distinto de "Cuentas por Pagar" de Compras).
 *
 * Analizado en vivo:
 * - Buscador (`#receivable_invoice_search_input`), rango de fechas
 *   (`#receivable_start_date`/`#receivable_end_date`, nativos), Compañía
 *   (`#receivable_company_select`), Cliente (`#receivable_customer_select`),
 *   Modo de consulta (`#receivable_query_mode`) y Moneda (menú compartido).
 * - 3 chips de estado: "Todas"/"Pendiente"/"Canceladas"
 *   (`#accounts_receivable_all/pending/paid`).
 * - "Buscar" (`#btn_receivable_search`). Exportación real: único botón
 *   "Excel" (`#btn_receivable_excel`).
 * - NO es una tabla tradicional: tarjetas con scroll infinito ("Se cargan
 *   más filas al llegar al 85% del contenedor", confirmado en vivo) y 3
 *   indicadores reales: "Total Facturado", "Total Abonado", "Saldo
 *   Pendiente". Cada tarjeta tiene una acción real "Ver abonos".
 */
export class ReporteCuentasPorCobrarVentasPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#receivable_invoice_search_input');
  private readonly fechaInicial = () => this.page.locator('#receivable_start_date');
  private readonly fechaFinal = () => this.page.locator('#receivable_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_receivable_search');
  private readonly btnDescargar = () => this.page.locator('#btn_receivable_excel');
  private readonly filtroCompania = () => this.page.locator('#receivable_company_select');
  private readonly filtroCliente = () => this.page.locator('#receivable_customer_select');
  private readonly filtroModoConsulta = () => this.page.locator('#receivable_query_mode');
  private readonly chipTodas = () => this.page.locator('#accounts_receivable_all');
  private readonly chipPendiente = () => this.page.locator('#accounts_receivable_pending');
  private readonly chipCanceladas = () => this.page.locator('#accounts_receivable_paid');
  private readonly kpiTotalFacturado = () => this.page.locator('text=/TOTAL FACTURADO/i').locator('xpath=ancestor::*[self::div][1]');
  private readonly kpiTotalAbonado = () => this.page.locator('text=/TOTAL ABONADO/i').locator('xpath=ancestor::*[self::div][1]');
  private readonly kpiSaldoPendiente = () => this.page.locator('text=/SALDO PENDIENTE/i').locator('xpath=ancestor::*[self::div][1]');
  private readonly tarjetas = () => this.page.locator('.product_report_card');
  private readonly btnVerAbonos = () => this.page.locator('button, a', { hasText: 'Ver abonos' });

  async abrirReporteCuentasPorCobrar() {
    await this.page.goto(URL_CUENTAS_POR_COBRAR, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    // El banner de notificaciones puede reaparecer sobre el header e
    // interceptar este clic (confirmado en vivo) — se vuelve a descartar
    // justo antes de clicar.
    await cerrarBannerNotificaciones(this.page);
    await this.btnBuscar().click({ force: true });
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarCompania(etiqueta: string) {
    await this.filtroCompania().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarCliente(etiqueta: string) {
    await this.filtroCliente().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarModoConsulta(etiqueta: string) {
    await this.filtroModoConsulta().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMonedaGenerica(this.page, etiqueta);
  }

  async seleccionarEstadoTodas() {
    await this.chipTodas().click();
  }

  async seleccionarEstadoPendiente() {
    await this.chipPendiente().click();
  }

  async seleccionarEstadoCanceladas() {
    await this.chipCanceladas().click();
  }

  async indicadoresVisibles(): Promise<boolean> {
    return (
      (await this.kpiTotalFacturado().isVisible()) &&
      (await this.kpiTotalAbonado().isVisible()) &&
      (await this.kpiSaldoPendiente().isVisible())
    );
  }

  async contarTarjetas(): Promise<number> {
    return this.tarjetas().count();
  }

  async abrirVerAbonos(indice = 0) {
    await this.btnVerAbonos().nth(indice).click();
  }

  async descargarExcel(): Promise<Download> {
    await cerrarBannerNotificaciones(this.page);
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click({ force: true });
    return descargaPromise;
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Antigüedad de Crédito (Ventas) ─────────────────────────────

/**
 * Reporte de Antigüedad de Crédito (reports/seniority_of_credit) — dentro
 * del módulo Ventas (distinto del de Compras, cubierto en
 * rp-compras.page.ts).
 *
 * Analizado en vivo:
 * - Buscador (`#seniority_search`), rango de fechas
 *   (`#seniority_start_date`/`#seniority_end_date`, nativos) y Moneda
 *   (menú compartido).
 * - "Buscar" (`#btn_search_receip`). Exportación real: único botón
 *   "Descargar" (`#btn_export_seniority`).
 * - Tabla real con columnas de antigüedad por rango: Sin vencer, 1 A 30,
 *   31 A 60, 61 A 90, Mayor a 91.
 */
export class ReporteAntiguedadCreditoVentasPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#seniority_search');
  private readonly fechaInicial = () => this.page.locator('#seniority_start_date');
  private readonly fechaFinal = () => this.page.locator('#seniority_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_receip');
  private readonly btnDescargar = () => this.page.locator('#btn_export_seniority');
  private readonly tabla = () => this.page.locator('table', { hasText: 'Sin vencer' }).first();

  static readonly COLUMNA_CLIENTE = 0;
  static readonly COLUMNA_TOTAL = 5;

  async abrirReporteAntiguedadCredito() {
    await this.page.goto(URL_ANTIGUEDAD_CREDITO, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMonedaGenerica(this.page, etiqueta);
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla().locator('tbody tr').count();
  }

  private async celdaDeFila(indice: number, columna: number): Promise<string> {
    return (await this.tabla().locator('tbody tr').nth(indice).locator('td').nth(columna).innerText()).trim();
  }

  async obtenerTotalNumericoDeFila(indice: number): Promise<number> {
    return montoANumero(await this.celdaDeFila(indice, ReporteAntiguedadCreditoVentasPage.COLUMNA_TOTAL));
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Comisiones por Vendedor ────────────────────────────────────

/**
 * Reporte de Comisiones por Vendedor (reports/salesPerSellerReport).
 *
 * Analizado en vivo:
 * - Buscador (`#agent_sale_invoice_search`), rango de fechas
 *   (`#cash_start_date`/`#cash_end_date`, nativos), Usuario
 *   (`#agent_sale_user_select`), Zona (`#agent_sale_zone_select`) y
 *   Cliente (`#agent_sale_customer_select`).
 * - "Buscar" (`#btn_search_agent_sale`). Sin ningún botón de exportación
 *   (PDF/Excel) — confirmado en vivo, no se crea ninguna prueba ficticia.
 * - Tabla real, columnas: (expandir), Nombre vendedor, Zona, Facturas,
 *   Total, Comisión, Total comisión.
 */
export class ReporteComisionesVendedorPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#agent_sale_invoice_search');
  private readonly fechaInicial = () => this.page.locator('#cash_start_date');
  private readonly fechaFinal = () => this.page.locator('#cash_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_agent_sale');
  private readonly filtroUsuario = () => this.page.locator('#agent_sale_user_select');
  private readonly filtroZona = () => this.page.locator('#agent_sale_zone_select');
  private readonly filtroCliente = () => this.page.locator('#agent_sale_customer_select');
  private readonly tabla = () => this.page.locator('table', { hasText: 'COMISIÓN' }).first();

  async abrirReporteComisionesVendedor() {
    await this.page.goto(URL_COMISIONES_VENDEDOR, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarUsuario(etiqueta: string) {
    await this.filtroUsuario().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarZona(etiqueta: string) {
    await this.filtroZona().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarCliente(etiqueta: string) {
    await this.filtroCliente().selectOption({ label: etiqueta }, { force: true });
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla().locator('tbody tr').count();
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Facturas Hacienda ───────────────────────────────────────────

/**
 * Reporte de Facturación Electrónica / Facturas Hacienda
 * (ElectronicBilling/ElectronicBillingReport).
 *
 * Analizado en vivo:
 * - Buscador (`#electronic_billing_search`), rango de fechas
 *   (`#electronic_billing_start_date`/`#electronic_billing_end_date`,
 *   nativos), Tipo de documento
 *   (`#electronic_billing_documrnt_type_select`), Tipo de factura
 *   (`#electronic_billing_invoice_type`) y Moneda (menú compartido).
 * - 3 chips de estado: "Todas"/"Aceptado"/"Rechazado"
 *   (`#electronic_billing_state_all/success/error`).
 * - "Buscar" (`#btn_electronic_billing_search`). Exportación real: único
 *   botón "Descargar" (`#btn_export_electronic_billing`).
 * - Tabla real, columnas: Doc. Relacionado, Tipo de documento, Receptor,
 *   Fecha Respuesta, Estado Hacienda, Estado Confirmación, más columnas de
 *   desglose de impuestos.
 */
export class ReporteFacturasHaciendaPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#electronic_billing_search');
  private readonly fechaInicial = () => this.page.locator('#electronic_billing_start_date');
  private readonly fechaFinal = () => this.page.locator('#electronic_billing_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_electronic_billing_search');
  private readonly btnDescargar = () => this.page.locator('#btn_export_electronic_billing');
  private readonly filtroTipoDocumento = () => this.page.locator('#electronic_billing_documrnt_type_select');
  private readonly filtroTipoFactura = () => this.page.locator('#electronic_billing_invoice_type');
  private readonly chipTodas = () => this.page.locator('#electronic_billing_state_all');
  private readonly chipAceptado = () => this.page.locator('#electronic_billing_state_success');
  private readonly chipRechazado = () => this.page.locator('#electronic_billing_state_error');
  private readonly tabla = () => this.page.locator('table', { hasText: 'Estado Hacienda' }).first();

  async abrirReporteFacturasHacienda() {
    await this.page.goto(URL_FACTURAS_HACIENDA, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarTipoDocumento(etiqueta: string) {
    await this.filtroTipoDocumento().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarTipoFactura(etiqueta: string) {
    await this.filtroTipoFactura().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMonedaGenerica(this.page, etiqueta);
  }

  async seleccionarEstadoTodas() {
    await this.chipTodas().click();
  }

  async seleccionarEstadoAceptado() {
    await this.chipAceptado().click();
  }

  async seleccionarEstadoRechazado() {
    await this.chipRechazado().click();
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla().locator('tbody tr').count();
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  /** BUG confirmado en vivo: el clic no dispara ninguna descarga real ni popup. */
  async clicEnDescargar() {
    await this.btnDescargar().click();
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Ventas de Productos Rápidos ────────────────────────────────

/**
 * Reporte de Ventas de Productos Rápidos (reports/salesReportQuickProduct).
 *
 * Analizado en vivo:
 * - Mismo patrón que Ventas: buscador (`#sales_invoice_search`), rango de
 *   fechas (`#sales_start_date`/`#sales_end_date`, `<input type="text">`
 *   con autocompletado de hora, persiste correctamente) y los mismos 5
 *   chips de estado (`#sale_state_all/cash/credit/pending/deleted`) y
 *   Moneda (menú compartido).
 * - "Buscar" (`#btn_search_receip`). Exportación real: único botón
 *   "Descargar" (`#btn_download_receivable_excel_report`).
 */
export class ReporteVentasProductosRapidosPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#sales_invoice_search');
  private readonly fechaInicial = () => this.page.locator('#sales_start_date');
  private readonly fechaFinal = () => this.page.locator('#sales_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_receip');
  private readonly btnDescargar = () => this.page.locator('#btn_download_receivable_excel_report');
  private readonly chipTodas = () => this.page.locator('#sale_state_all');
  private readonly chipContado = () => this.page.locator('#sale_state_cash');
  private readonly chipCredito = () => this.page.locator('#sale_state_credit');
  private readonly tabla = () => this.page.locator('table', { hasText: 'No Consecutivo' }).first();

  async abrirReporteVentasProductosRapidos() {
    await this.page.goto(URL_VENTAS_PRODUCTOS_RAPIDOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMonedaGenerica(this.page, etiqueta);
  }

  async seleccionarEstadoTodas() {
    await this.chipTodas().click();
  }

  async seleccionarEstadoContado() {
    await this.chipContado().click();
  }

  async seleccionarEstadoCredito() {
    await this.chipCredito().click();
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla().locator('tbody tr').count();
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Ventas por Vendedor ─────────────────────────────────────────

/**
 * Reporte de Ventas por Vendedor (reports/agentSalesReport).
 *
 * Analizado en vivo:
 * - Buscador (`#agent_sale_invoice_search`), rango de fechas
 *   (`#cash_start_date`/`#cash_end_date`, nativos), Usuario
 *   (`#agent_sale_user_select`), Zona (`#agent_sale_zone_select`), Cliente
 *   (`#agent_sale_customer_select`), Tipo de pago
 *   (`#agent_payment_type_select`) y Moneda (menú compartido).
 * - "Buscar" (`#btn_search_agent_sale`). Exportación real: único botón
 *   "Descargar" (`#btn_download_agent_sale_excel_report`).
 * - 2 tablas reales: la principal (facturas) y una segunda que actúa como
 *   fila de totales reales ("Saldo"/"Total" con fila "Total:").
 */
export class ReporteVentasVendedorPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#agent_sale_invoice_search');
  private readonly fechaInicial = () => this.page.locator('#cash_start_date');
  private readonly fechaFinal = () => this.page.locator('#cash_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_agent_sale');
  private readonly btnDescargar = () => this.page.locator('#btn_download_agent_sale_excel_report');
  private readonly filtroUsuario = () => this.page.locator('#agent_sale_user_select');
  private readonly filtroZona = () => this.page.locator('#agent_sale_zone_select');
  private readonly filtroCliente = () => this.page.locator('#agent_sale_customer_select');
  private readonly filtroTipoPago = () => this.page.locator('#agent_payment_type_select');
  private readonly tabla = () => this.page.locator('table', { hasText: 'No. de Factura' }).first();
  private readonly tablaTotales = () => this.page.locator('table', { hasText: 'Total:' }).first();

  async abrirReporteVentasVendedor() {
    await this.page.goto(URL_VENTAS_VENDEDOR, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarUsuario(etiqueta: string) {
    await this.filtroUsuario().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarZona(etiqueta: string) {
    await this.filtroZona().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarCliente(etiqueta: string) {
    await this.filtroCliente().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarTipoPago(etiqueta: string) {
    await this.filtroTipoPago().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMonedaGenerica(this.page, etiqueta);
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla().locator('tbody tr').count();
  }

  async totalesVisibles(): Promise<boolean> {
    return this.tablaTotales().isVisible();
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Comisiones por Cobros ──────────────────────────────────────

/**
 * Reporte de (%) Comisiones por Cobros (reports/credit_sales_commissions_report).
 *
 * Analizado en vivo:
 * - Buscador (`#agent_sale_invoice_search`), rango de fechas
 *   (`#start_date`/`#end_date`, nativos), Zona (`#agent_sale_zone_select`)
 *   y Moneda (menú compartido).
 * - "Buscar" (`#btn_search_agent_sale`). Sin ningún botón de exportación
 *   (PDF/Excel) — confirmado en vivo, no se crea ninguna prueba ficticia.
 * - Tabla real, columnas: (expandir), Identificación, Agente, Código,
 *   Correo, Compañía, Total.
 */
export class ReporteComisionesPorCobrosPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#agent_sale_invoice_search');
  private readonly fechaInicial = () => this.page.locator('#start_date');
  private readonly fechaFinal = () => this.page.locator('#end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_agent_sale');
  private readonly filtroZona = () => this.page.locator('#agent_sale_zone_select');
  private readonly tabla = () => this.page.locator('table', { hasText: 'Identificación' }).first();

  async abrirReporteComisionesPorCobros() {
    await this.page.goto(URL_COMISIONES_POR_COBROS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarZona(etiqueta: string) {
    await this.filtroZona().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMonedaGenerica(this.page, etiqueta);
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla().locator('tbody tr').count();
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Ventas por Cliente ──────────────────────────────────────────

/**
 * Reporte de Ventas por Cliente (reports/clientSalesReport).
 *
 * Analizado en vivo:
 * - Buscador (`#client_sale_invoice_search`), rango de fechas
 *   (`#start_date`/`#end_date`, nativos), Cliente (`#client_select`),
 *   Grupo (`#group_select`) y Moneda (menú compartido).
 * - 4 chips de estado: "Todas"/"Contado"/"Crédito"/"Créditos pendientes"
 *   (`#sale_state_all/cash/credit/pending`).
 * - "Buscar" (`#btn_search_client_sale`). Exportación real: único botón
 *   "Descargar" (`#btn_download_client_sale_excel_report`).
 * - Tabla real, columnas: (expandir), Lote, Cliente, Correo, Compañía,
 *   Grupo, Total.
 */
export class ReporteVentasClientePage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#client_sale_invoice_search');
  private readonly fechaInicial = () => this.page.locator('#start_date');
  private readonly fechaFinal = () => this.page.locator('#end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_client_sale');
  private readonly btnDescargar = () => this.page.locator('#btn_download_client_sale_excel_report');
  private readonly filtroCliente = () => this.page.locator('#client_select');
  private readonly filtroGrupo = () => this.page.locator('#group_select');
  private readonly chipTodas = () => this.page.locator('#sale_state_all');
  private readonly chipContado = () => this.page.locator('#sale_state_cash');
  private readonly chipCredito = () => this.page.locator('#sale_state_credit');
  private readonly chipCreditosPendientes = () => this.page.locator('#sale_state_pending');
  private readonly tabla = () => this.page.locator('table', { hasText: 'Lote' }).first();

  async abrirReporteVentasCliente() {
    await this.page.goto(URL_VENTAS_CLIENTE, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
    // Este reporte tiene un widget bootstrap-datepicker redundante que
    // queda abierto tras el `.fill()` e intercepta clics posteriores
    // (confirmado en vivo) — se cierra antes de continuar.
    await cerrarDatepickerHuerfano(this.page);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarCliente(etiqueta: string) {
    await this.filtroCliente().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarGrupo(etiqueta: string) {
    await this.filtroGrupo().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMonedaGenerica(this.page, etiqueta);
  }

  async seleccionarEstadoTodas() {
    await this.chipTodas().click();
  }

  async seleccionarEstadoContado() {
    await this.chipContado().click();
  }

  async seleccionarEstadoCredito() {
    await this.chipCredito().click();
  }

  async seleccionarEstadoCreditosPendientes() {
    await this.chipCreditosPendientes().click();
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla().locator('tbody tr').count();
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Notas de Crédito ────────────────────────────────────────────

/**
 * Reporte de Notas de Crédito (reports/creditNoteReport).
 *
 * Analizado en vivo:
 * - Buscador (`#credit_note_invoice_search`), rango de fechas
 *   (`#cash_start_date`/`#cash_end_date`, nativos), Cliente
 *   (`#credit_note_customer_select`), Zona (`#credit_note_zone`), Estado
 *   (`#credit_note_state`) y Moneda (menú compartido).
 * - 3 chips de tipo: "Todas"/"Factura"/"Órdenes de entrega"
 *   (`#invoice_type_all/bills/delivery_orders`).
 * - "Buscar" (`#btn_search_credit_note`). Exportación real: único botón
 *   "Descargar" (`#btn_download_credit_note_excel_report`).
 * - Tabla real, columnas: (expandir), # Doc., Fact. aplicada, Fecha,
 *   Cuenta, Cliente, Responsable, Boleta, Tipo de nota, Observaciones,
 *   Estatus, Tipo moneda, Costo, Monto, Impuesto, Total.
 */
export class ReporteNotasCreditoPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#credit_note_invoice_search');
  private readonly fechaInicial = () => this.page.locator('#cash_start_date');
  private readonly fechaFinal = () => this.page.locator('#cash_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_credit_note');
  private readonly btnDescargar = () => this.page.locator('#btn_download_credit_note_excel_report');
  private readonly filtroCliente = () => this.page.locator('#credit_note_customer_select');
  private readonly filtroZona = () => this.page.locator('#credit_note_zone');
  private readonly filtroEstado = () => this.page.locator('#credit_note_state');
  private readonly chipTodas = () => this.page.locator('#invoice_type_all');
  private readonly chipFactura = () => this.page.locator('#invoice_type_bills');
  private readonly chipOrdenesEntrega = () => this.page.locator('#invoice_type_delivery_orders');
  private readonly tabla = () => this.page.locator('table', { hasText: 'Fact. aplicada' }).first();

  static readonly COLUMNA_CLIENTE = 5;
  static readonly COLUMNA_TOTAL = 15;

  async abrirReporteNotasCredito() {
    await this.page.goto(URL_NOTAS_CREDITO, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
    // Este reporte tiene un widget bootstrap-datepicker redundante que
    // queda abierto tras el `.fill()` e intercepta clics posteriores
    // (confirmado en vivo) — se cierra antes de continuar.
    await cerrarDatepickerHuerfano(this.page);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarCliente(etiqueta: string) {
    await this.filtroCliente().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarZona(etiqueta: string) {
    await this.filtroZona().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarEstado(etiqueta: string) {
    await this.filtroEstado().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMonedaGenerica(this.page, etiqueta);
  }

  async seleccionarTipoTodas() {
    await this.chipTodas().click();
  }

  async seleccionarTipoFactura() {
    await this.chipFactura().click();
  }

  async seleccionarTipoOrdenesEntrega() {
    await this.chipOrdenesEntrega().click();
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla().locator('tbody tr').count();
  }

  private async celdaDeFila(indice: number, columna: number): Promise<string> {
    return (await this.tabla().locator('tbody tr').nth(indice).locator('td').nth(columna).innerText()).trim();
  }

  async obtenerTotalNumericoDeFila(indice: number): Promise<number> {
    return montoANumero(await this.celdaDeFila(indice, ReporteNotasCreditoPage.COLUMNA_TOTAL));
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  /** BUG confirmado en vivo: el clic no dispara ninguna descarga real ni popup. */
  async clicEnDescargar() {
    await this.btnDescargar().click();
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Ventas de Tienda Online ─────────────────────────────────────

/**
 * Reporte de Ventas de la Tienda Online (reports/getOnlineStoreSalesReport).
 *
 * Analizado en vivo:
 * - Buscador (`#online_store_invoice_search`), rango de fechas
 *   (`#online_store_start_date`/`#online_store_end_date`, nativos) y Tipo
 *   de pago (`#online_store_payment_select`).
 * - "Buscar" es un `<a class="_btn_search">` sin id propio
 *   (`onclick="get_store_online_report_search()"`, confirmado en vivo).
 *   Exportación real: único botón "Descargar" (`#btn_export_online_store`,
 *   solo ícono, sin texto).
 * - Tabla real, columnas: (expandir), No. Factura, Cliente, Compañía,
 *   Fecha, Tipo Pago, Estado, Total.
 */
export class ReporteVentasTiendaOnlinePage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#online_store_invoice_search');
  private readonly fechaInicial = () => this.page.locator('#online_store_start_date');
  private readonly fechaFinal = () => this.page.locator('#online_store_end_date');
  private readonly btnBuscar = () => this.page.locator('a._btn_search');
  private readonly btnDescargar = () => this.page.locator('#btn_export_online_store');
  private readonly filtroTipoPago = () => this.page.locator('#online_store_payment_select');
  private readonly tabla = () => this.page.locator('table', { hasText: 'No. Factura' }).first();

  async abrirReporteVentasTiendaOnline() {
    await this.page.goto(URL_VENTAS_TIENDA_ONLINE, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarTipoPago(etiqueta: string) {
    await this.filtroTipoPago().selectOption({ label: etiqueta }, { force: true });
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla().locator('tbody tr').count();
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  /** BUG confirmado en vivo: el clic no dispara ninguna descarga real ni popup. */
  async clicEnDescargar() {
    await this.btnDescargar().click();
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

/**
 * BUG confirmado en vivo (documentado también en reportes.page.ts): al
 * navegar a "Comisiones por Producto" (reports/productCommissionReport),
 * la pantalla nunca termina de cargar (probado repetidamente hasta 90s+
 * sin resultado) — no se crea ningún Page Object para este reporte, solo
 * un test dedicado en rp-ventas.spec.ts que documenta el comportamiento.
 */
export { URL_COMISIONES_PRODUCTO };
