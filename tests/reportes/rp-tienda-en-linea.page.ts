import { Download, expect, Locator, Page } from '@playwright/test';
import { contentHeaderConTexto, SubmoduloReportes, TIMEOUTS } from './reportes.page';

export const SUBMODULOS_REPORTES_TIENDA_EN_LINEA: SubmoduloReportes[] = [
  {
    nombre: 'Despacho de órdenes',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/online_store_order_dispatch_report',
    rutaEsperada: 'online_store_order_dispatch_report',
    tituloEsperado: /despacho de [oó]rdenes/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /despacho de [oó]rdenes/i),
  },
  {
    nombre: 'Órdenes',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/store_online_order_report',
    rutaEsperada: 'store_online_order_report',
    tituloEsperado: /^[oó]rdenes\s*\|/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /[oó]rdenes\s+tienda\s+en\s+l[ií]nea/i),
  },
];

// ─── Utilidades compartidas ─────────────────────────────────────────────────

/** Convierte un monto mostrado en pantalla (p.ej. "$ 1,234.56") a number. */
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
 * patrón estructural usado en el resto del proyecto: botón + `<ul>`
 * hermano).
 */
async function seleccionarMonedaGenerica(page: Page, etiqueta: string) {
  const boton = page.locator('button', { hasText: 'Moneda:' }).first();
  await cerrarBannerNotificaciones(page);
  await boton.click({ force: true });
  const menu = boton.locator('xpath=following-sibling::ul[1]');
  await menu.locator('a', { hasText: etiqueta }).click();
}

/**
 * Ambos reportes de Tienda en Línea tienen, además de los `<input
 * type="date">` nativos, un widget bootstrap-datepicker redundante que
 * queda abierto/huérfano tras escribir con `.fill()` (confirmado en vivo:
 * `.datepicker-dropdown` count = 2 tras rellenar ambos campos) — su
 * `hide()` sobrescribe el valor con su propio estado interno obsoleto al
 * cerrarse (mismo bug documentado en Ventas > Ventas por Cliente/Notas de
 * Crédito y en Taller > Órdenes). Cerrarlo con un clic neutral es lo único
 * que permite continuar interactuando con el resto del formulario.
 */
async function cerrarDatepickerHuerfano(page: Page) {
  await page.locator('.content-header').first().click({ timeout: 5000 }).catch(() => {});
}

/**
 * Lógica común a ambos reportes de Tienda en Línea (Despacho de Órdenes y
 * Órdenes): comparten exactamente los mismos ids de buscador, fechas,
 * cliente, botón de búsqueda/exportación y chips de estado (confirmado en
 * vivo). Se centraliza aquí para no duplicarla entre las dos clases.
 */
class ReporteTiendaEnLineaBase {
  constructor(protected readonly page: Page, private readonly tabla_: () => Locator) {}

  protected readonly buscador = () => this.page.locator('#invoice_search');
  protected readonly fechaInicial = () => this.page.locator('#start_date');
  protected readonly fechaFinal = () => this.page.locator('#end_date');
  protected readonly btnBuscar = () => this.page.locator('#btn_search_client_sale');
  protected readonly btnDescargar = () => this.page.locator('#btn_download_client_sale_excel_report');
  protected readonly filtroCliente = () => this.page.locator('#client_select');
  protected readonly chipTodos = () => this.page.locator('#state_all');
  protected readonly chipPendientes = () => this.page.locator('#state_is_pending');
  protected readonly chipAprobadas = () => this.page.locator('#state_is_approve');
  protected readonly chipFacturadas = () => this.page.locator('#state_is_paid');
  protected readonly chipEntregadas = () => this.page.locator('#state_is_delivered');
  protected readonly chipCanceladas = () => this.page.locator('#state_is_canceled');

  protected async abrir(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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
    await cerrarBannerNotificaciones(this.page);
    await this.btnBuscar().click({ force: true });
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

  async seleccionarEstadoTodos() {
    await this.chipTodos().click();
  }

  async seleccionarEstadoPendientes() {
    await this.chipPendientes().click();
  }

  async seleccionarEstadoAprobadas() {
    await this.chipAprobadas().click();
  }

  async seleccionarEstadoFacturadas() {
    await this.chipFacturadas().click();
  }

  async seleccionarEstadoEntregadas() {
    await this.chipEntregadas().click();
  }

  async seleccionarEstadoCanceladas() {
    await this.chipCanceladas().click();
  }

  async validarTabla() {
    await expect(this.tabla_()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla_().locator('tbody tr').count();
  }

  /**
   * No existe ningún mensaje "sin resultados" dedicado (confirmado en
   * vivo) — la única señal observable de que una búsqueda no encontró
   * coincidencias es que la tabla quede sin filas.
   */
  async validarMensajeSinResultados() {
    expect(await this.contarFilas()).toBe(0);
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

// ─── Reporte de Despacho de Órdenes ─────────────────────────────────────────

const URL_DESPACHO_ORDENES = SUBMODULOS_REPORTES_TIENDA_EN_LINEA[0].url;

/**
 * Reporte de Despacho de Órdenes (reports/online_store_order_dispatch_report).
 *
 * Analizado en vivo:
 * - Buscador (`#invoice_search`), rango de fechas (`#start_date`/
 *   `#end_date`, nativos — con el mismo widget bootstrap-datepicker
 *   redundante y su bug de revert confirmado, ver `cerrarDatepickerHuerfano`),
 *   Cliente (`#client_select`, ~494 opciones) y Moneda (menú compartido).
 * - 6 chips de estado: "Todos"/"Pendientes"/"Aprobadas"/"Facturadas"/
 *   "Entregadas"/"Canceladas" (`#state_all/is_pending/is_approve/is_paid/
 *   is_delivered/is_canceled`).
 * - "Buscar" (`#btn_search_client_sale`, ícono sin texto). Exportación
 *   real: único botón "Exportar reporte actual" (`#btn_download_client_
 *   sale_excel_report`, ícono sin texto).
 * - Tabla real, columnas: (vacía), # de Orden, Cliente, Envío, Método de
 *   pago, Fecha, Dirección, Estado, # de Guía, Fecha Guía. Sin columnas
 *   ordenables (sin `onclick` ni `cursor: pointer` en los `<th>`,
 *   confirmado en vivo) y sin paginación (confirmado en vivo).
 * - El ambiente de QA actual no tiene órdenes que coincidan con ningún
 *   rango de fechas probado (confirmado en vivo, 0 filas de forma
 *   consistente) — no se asume una cantidad fija de registros.
 */
export class ReporteDespachoOrdenesPage extends ReporteTiendaEnLineaBase {
  constructor(page: Page) {
    super(page, () => page.locator('table', { hasText: 'Método de pago' }).first());
  }

  async abrirReporteDespachoOrdenes() {
    await this.abrir(URL_DESPACHO_ORDENES);
  }
}

// ─── Reporte de Órdenes ─────────────────────────────────────────────────────

const URL_ORDENES = SUBMODULOS_REPORTES_TIENDA_EN_LINEA[1].url;

/**
 * Reporte de Órdenes (reports/store_online_order_report).
 *
 * Analizado en vivo:
 * - Misma estructura de filtros que Despacho de Órdenes: buscador
 *   (`#invoice_search`), rango de fechas (`#start_date`/`#end_date`,
 *   mismo bug de datepicker huérfano confirmado), Cliente
 *   (`#client_select`) y Moneda (menú compartido).
 * - 6 chips de estado, mismos ids que Despacho de Órdenes pero con
 *   textos ligeramente distintos: "Todas"/"Pendiente"/"Aprobadas"/
 *   "Facturadas"/"Entregadas"/"Canceladas".
 * - "Buscar" (`#btn_search_client_sale`). Exportación real: único botón
 *   "Exportar reporte actual" (`#btn_download_client_sale_excel_report`).
 * - Tabla real, columnas: (vacía), No. orden, Cliente, Envío, Método de
 *   pago, Fecha, Dirección, Estado, Subtotal, IVA, Descuento, Total — a
 *   diferencia de Despacho de Órdenes, sí expone montos por fila. Sin
 *   `<tfoot>` ni fila de totales generales (confirmado en vivo) — la
 *   validación de totales se hace por fila. Sin columnas ordenables ni
 *   paginación (confirmado en vivo).
 * - Mismo problema de datos del ambiente de QA: 0 filas de forma
 *   consistente independientemente del rango de fechas — no se asume una
 *   cantidad fija de registros.
 */
export class ReporteOrdenesPage extends ReporteTiendaEnLineaBase {
  private static readonly COLUMNA_TOTAL = 11;

  constructor(page: Page) {
    super(page, () => page.locator('table', { hasText: 'Subtotal' }).first());
  }

  async abrirReporteOrdenes() {
    await this.abrir(URL_ORDENES);
  }

  private tabla() {
    return this.page.locator('table', { hasText: 'Subtotal' }).first();
  }

  private async celdaDeFila(indice: number, columna: number): Promise<string> {
    return (await this.tabla().locator('tbody tr').nth(indice).locator('td').nth(columna).innerText()).trim();
  }

  async obtenerTotalNumericoDeFila(indice: number): Promise<number> {
    return montoANumero(await this.celdaDeFila(indice, ReporteOrdenesPage.COLUMNA_TOTAL));
  }
}
