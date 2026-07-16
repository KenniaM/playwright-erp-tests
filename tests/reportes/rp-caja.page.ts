import { Download, expect, Locator, Page } from '@playwright/test';
import { contentHeaderConTexto, SubmoduloReportes, TIMEOUTS } from './reportes.page';

export const SUBMODULOS_REPORTES_CAJA: SubmoduloReportes[] = [
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el buscador real, que sí es visible.
    nombre: 'Cierres de Caja',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/cashReport',
    rutaEsperada: 'cashReport',
    tituloEsperado: /reporte de cierre/i,
    obtenerLocatorDeCarga: (page: Page) => page.locator('#newSearchInput'),
  },
  {
    nombre: 'Movimientos de Caja',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/cash_movement_report',
    rutaEsperada: 'cash_movement_report',
    tituloEsperado: /movimientos de caja/i,
    obtenerLocatorDeCarga: (page: Page) => contentHeaderConTexto(page, /movimientos de caja/i),
  },
];

const URL_CIERRES_DE_CAJA = SUBMODULOS_REPORTES_CAJA[0].url;
const URL_MOVIMIENTOS_DE_CAJA = SUBMODULOS_REPORTES_CAJA[1].url;

// ─── Utilidades de fecha ────────────────────────────────────────────────────

/** Formatea una fecha como YYYY-MM-DD, el formato que aceptan los `<input type="date">`. */
function fechaISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Fecha de hoy en formato YYYY-MM-DD. */
export function hoyISO(): string {
  return fechaISO(new Date());
}

/** Fecha de hace `dias` días (desde hoy) en formato YYYY-MM-DD — útil para ampliar rangos sin fechas fijas. */
export function hoyMenosDiasISO(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return fechaISO(fecha);
}

/** No hay ningún mensaje de error de aplicación (`.noty_bar`) visible en pantalla. */
async function validarSinErrores(page: Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

/**
 * El layout general (compartido por todo el ERP, no solo Reportes > Caja)
 * puede mostrar un banner de "Activar notificaciones" al cargar la página.
 * Confirmado en vivo que intercepta clics sobre controles reales (p.ej. el
 * menú de exportar Excel) cuando queda visible — se descarta de forma
 * best-effort tras cada navegación, igual que los modales de compañía/caja
 * que ya maneja el resto de la suite (ver CLAUDE.md).
 */
async function cerrarBannerNotificaciones(page: Page) {
  await page.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 3000 }).catch(() => {});
}

// ─── Reporte de Movimientos de Caja ────────────────────────────────────────

/**
 * Reporte de Movimientos de Caja (reports/cash_movement_report).
 *
 * Confirmado en vivo:
 * - Filtros: rango de fechas (#cash_start_date/#cash_end_date, ambos
 *   `<input type="date">`, por defecto el día de hoy) + buscador de texto
 *   libre (#cash_movement_search). Ambos se aplican al hacer clic en
 *   "Buscar" (#btn_search_cash_movement). No existe ningún otro filtro
 *   (usuario/caja/estado/sucursal) pese a que la tabla sí tiene columna
 *   "Compañía".
 * - Exportación: únicamente "Descargar" en Excel
 *   (#btn_cash_movement_excel_report). No existe botón de exportar a PDF en
 *   este reporte.
 * - Sin resultados: no hay mensaje de "sin resultados" — la tabla queda con
 *   `tbody` vacío bajo el mismo encabezado de columnas.
 * - En el ambiente de QA no hay ningún movimiento de caja registrado en
 *   ningún rango de fechas (confirmado en vivo probando desde 2020-01-01
 *   hasta 2026-12-31). Aun así, "Descargar" sí genera un Excel real (con
 *   solo encabezados) cuando la tabla está vacía — no existe una guardia que
 *   lo bloquee por falta de resultados.
 */
export class ReporteMovimientosCajaPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#cash_movement_search');
  private readonly fechaInicial = () => this.page.locator('#cash_start_date');
  private readonly fechaFinal = () => this.page.locator('#cash_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_cash_movement');
  private readonly btnDescargarExcel = () => this.page.locator('#btn_cash_movement_excel_report');
  private readonly contenedorTabla = () => this.page.locator('#div_content_table_cash_movement');

  async abrir() {
    await this.page.goto(URL_MOVIMIENTOS_DE_CAJA, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  /** Fija ambas fechas del rango de una sola vez (no ejecuta la búsqueda). */
  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  tabla(): Locator {
    return this.contenedorTabla().locator('table').first();
  }

  filas(): Locator {
    return this.tabla().locator('tbody tr');
  }

  async contarFilas(): Promise<number> {
    return this.filas().count();
  }

  /** Hace clic en "Descargar" y devuelve el Excel generado (incluso con la tabla vacía). */
  async descargarExcel(): Promise<Download> {
    const descarga = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargarExcel().click();
    return descarga;
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Cierres de Caja ────────────────────────────────────────────

/**
 * Reporte de Cierres de Caja (reports/cashReport).
 *
 * Confirmado en vivo:
 * - Filtros: rango de fechas (#ui_start_date/#ui_end_date, `<input
 *   type="date">`, por defecto el mes en curso) + buscador de texto libre
 *   (#newSearchInput, placeholder "Buscar cierres..."). Ambos se aplican al
 *   hacer clic en "Aplicar Filtros" (#applyFiltersNew) — escribir en el
 *   buscador por sí solo no filtra la tabla (confirmado esperando sin
 *   resultado). No existe ningún otro filtro (usuario/caja/estado/sucursal).
 * - Exportación: solo Excel, con un menú de 2 variantes tras el botón toggle
 *   "Descargar Excel" (#btn_cash_excel_toggle): "Solo cierre de caja"
 *   (#btn_cash_excel_summary) y "Detallado" (#btn_cash_excel_detail). No
 *   existe botón de exportar a PDF en este reporte.
 * - Sin resultados: igual que Movimientos de Caja, no hay mensaje explícito
 *   de "sin resultados"; la tabla queda con `tbody` vacío.
 * - Cada fila tiene un menú de acciones (ícono de 3 puntos,
 *   `.btn-dropdown-trigger`) con "Ver Detalle", "Enviar por correo" y
 *   "Enviar por WhatSapp". Las dos últimas envían comunicaciones reales, así
 *   que las pruebas solo verifican que el menú se despliegue con las
 *   opciones esperadas, sin ejecutar el envío.
 */
export class ReporteCierreCajaPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#newSearchInput');
  private readonly fechaInicial = () => this.page.locator('#ui_start_date');
  private readonly fechaFinal = () => this.page.locator('#ui_end_date');
  private readonly btnAplicarFiltros = () => this.page.locator('#applyFiltersNew');
  private readonly btnDescargarExcelToggle = () => this.page.locator('#btn_cash_excel_toggle');
  private readonly opcionExcelResumen = () => this.page.locator('#btn_cash_excel_summary');
  private readonly opcionExcelDetalle = () => this.page.locator('#btn_cash_excel_detail');
  private readonly contenedorTabla = () => this.page.locator('#div_content_table_cash');
  private readonly menuAccionesAbierto = () => this.page.locator('.dropdown-actions-menu.show');

  /** Índice de columna (0-based) del cajero en cada fila — confirmado en vivo. */
  static readonly COLUMNA_CAJERO = 4;

  async abrir() {
    await this.page.goto(URL_CIERRES_DE_CAJA, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  /** Fija ambas fechas del rango de una sola vez (no ejecuta la búsqueda). */
  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnAplicarFiltros().click();
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  tabla(): Locator {
    return this.contenedorTabla().locator('table.cash-table');
  }

  filas(): Locator {
    return this.tabla().locator('tbody tr');
  }

  async contarFilas(): Promise<number> {
    return this.filas().count();
  }

  /** Texto de la columna "Cajero" de la fila indicada (0-based). */
  async obtenerCajeroDeFila(indice: number): Promise<string> {
    return this.filas().nth(indice).locator('td').nth(ReporteCierreCajaPage.COLUMNA_CAJERO).innerText();
  }

  async descargarExcelResumen(): Promise<Download> {
    await this.btnDescargarExcelToggle().click();
    const descarga = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.opcionExcelResumen().click();
    return descarga;
  }

  async descargarExcelDetalle(): Promise<Download> {
    await this.btnDescargarExcelToggle().click();
    const descarga = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.opcionExcelDetalle().click();
    return descarga;
  }

  /** Abre el menú de acciones de la fila indicada (0-based) y devuelve el texto de sus opciones. */
  async obtenerOpcionesAccionesFila(indice = 0): Promise<string[]> {
    await this.filas().nth(indice).locator('.btn-dropdown-trigger').click();
    await expect(this.menuAccionesAbierto()).toBeVisible({ timeout: TIMEOUTS.CARGA });
    return this.menuAccionesAbierto().locator('.dropdown-item').allInnerTexts();
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}
