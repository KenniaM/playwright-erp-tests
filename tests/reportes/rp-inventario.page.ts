import { Download, expect, Page } from '@playwright/test';
import { contentHeaderConTexto, SubmoduloReportes, TIMEOUTS } from './reportes.page';

export const SUBMODULOS_REPORTES_INVENTARIO: SubmoduloReportes[] = [
  {
    nombre: 'Inventario',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productReport',
    rutaEsperada: 'productReport',
    tituloEsperado: /reporte de productos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de productos/i),
  },
  {
    // El <title> de esta pantalla es "Reporte de antigüedad de crédito"
    // (confirmado en vivo) — no corresponde a "Análisis de productos", queda
    // igual que en otras pantallas de Reportes con el mismo tipo de
    // desajuste (ver comentario en "Redes Sociales" y "Productos a pedir").
    // La validación real recae en el encabezado de contenido.
    nombre: 'Análisis de productos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productGeneralQuantityReport',
    rutaEsperada: 'productGeneralQuantityReport',
    tituloEsperado: /antig[üu]edad de cr[eé]dito/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /an[aá]lisis de productos/i),
  },
  {
    nombre: 'Tasa Rotacion de inventario',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/inventory_turnover_rate',
    rutaEsperada: 'inventory_turnover_rate',
    tituloEsperado: /tasa rotaci[oó]n de inventario/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /tasa rotaci[oó]n de inventario/i),
  },
  {
    nombre: 'Catálogo de Productos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productsCatalog',
    rutaEsperada: 'productsCatalog',
    tituloEsperado: /cat[aá]logo de productos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /cat[aá]logo de productos/i),
  },
  {
    nombre: 'Apartados',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/layawayReport',
    rutaEsperada: 'layawayReport',
    tituloEsperado: /reporte de apartados/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de apartados/i),
  },
  {
    nombre: 'Toma Física',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/inventoryReport',
    rutaEsperada: 'inventoryReport',
    tituloEsperado: /toma f[ií]sica/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /toma f[ií]sica/i),
  },
  {
    nombre: 'Movimientos de productos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productMovementReportSearch',
    rutaEsperada: 'productMovementReportSearch',
    tituloEsperado: /movimientos de productos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /movimientos de productos/i),
  },
  {
    nombre: 'Disponibilidad de productos vendidos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/best_selling_products',
    rutaEsperada: 'best_selling_products',
    tituloEsperado: /disponibilidad de productos vendidos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /disponibilidad de productos vendidos/i),
  },
  {
    nombre: 'Productos Externos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/externalProductReport',
    rutaEsperada: 'externalProductReport',
    tituloEsperado: /productos externos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /productos externos/i),
  },
  {
    nombre: 'Productos vendidos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/products_details_sales',
    rutaEsperada: 'products_details_sales',
    tituloEsperado: /productos vendidos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /productos vendidos/i),
  },
  {
    // El <title> de esta pantalla es "Reporte de productos vendidos"
    // (confirmado en vivo) — no corresponde a "Productos a pedir", mismo
    // tipo de desajuste que "Redes Sociales" y "Análisis de productos".
    nombre: 'Productos a pedir',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productsToOrder',
    rutaEsperada: 'productsToOrder',
    tituloEsperado: /productos vendidos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /productos a pedir/i),
  },
  {
    nombre: 'Productos por tallas',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productBySizeReport',
    rutaEsperada: 'productBySizeReport',
    tituloEsperado: /productos por tallas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /productos por tallas/i),
  },
  {
    nombre: 'Productos por vencer',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productsToExpire',
    rutaEsperada: 'productsToExpire',
    tituloEsperado: /productos por vencer/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /productos por vencer/i),
  },
];

const URL_INVENTARIO = SUBMODULOS_REPORTES_INVENTARIO[0].url;
const URL_ANALISIS_PRODUCTOS = SUBMODULOS_REPORTES_INVENTARIO[1].url;
const URL_ROTACION_INVENTARIO = SUBMODULOS_REPORTES_INVENTARIO[2].url;
const URL_CATALOGO_PRODUCTOS = SUBMODULOS_REPORTES_INVENTARIO[3].url;
const URL_APARTADOS = SUBMODULOS_REPORTES_INVENTARIO[4].url;
const URL_TOMA_FISICA = SUBMODULOS_REPORTES_INVENTARIO[5].url;
const URL_MOVIMIENTOS_PRODUCTOS = SUBMODULOS_REPORTES_INVENTARIO[6].url;
const URL_DISPONIBILIDAD_VENDIDOS = SUBMODULOS_REPORTES_INVENTARIO[7].url;
const URL_PRODUCTOS_EXTERNOS = SUBMODULOS_REPORTES_INVENTARIO[8].url;
const URL_PRODUCTOS_VENDIDOS = SUBMODULOS_REPORTES_INVENTARIO[9].url;
const URL_PRODUCTOS_A_PEDIR = SUBMODULOS_REPORTES_INVENTARIO[10].url;
const URL_PRODUCTOS_POR_TALLAS = SUBMODULOS_REPORTES_INVENTARIO[11].url;
const URL_PRODUCTOS_POR_VENCER = SUBMODULOS_REPORTES_INVENTARIO[12].url;

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
 * patrón estructural usado en Compras/Taller: botón + `<ul>` hermano).
 */
async function seleccionarMonedaGenerica(page: Page, etiqueta: string) {
  const boton = page.locator('button', { hasText: 'Moneda:' }).first();
  await boton.click();
  const menu = boton.locator('xpath=following-sibling::ul[1]');
  await menu.locator('a', { hasText: etiqueta }).click();
}

/**
 * Varios campos de fecha nativos (`<input type="date">`) tienen además un
 * widget bootstrap-datepicker enganchado que puede quedar como un
 * calendario huérfano tras `.fill()` (mismo patrón que en Compras/Taller),
 * bloqueando clics posteriores. `Escape` no siempre lo cierra de forma
 * confiable (confirmado en vivo) — un clic real en un elemento neutro
 * (el encabezado de contenido) sí lo cierra consistentemente.
 */
async function cerrarDatepickerHuerfano(page: Page) {
  await page.locator('.content-header').first().click({ timeout: TIMEOUTS.CARGA });
}

// ─── Reporte de Inventario ──────────────────────────────────────────────────

/**
 * Reporte de Inventario (reports/productReport).
 *
 * Analizado en vivo:
 * - Buscador de texto libre (`#product_search`). Filtros: Categoría
 *   (`#company_category`), Subcategoría (`#company_subcategory`, con
 *   niveles 3 y 4 adicionales), Proveedor (`#company_provider`) — selects
 *   nativos con clase `prd-select`.
 * - "Buscar" (`#btn_search_product`).
 * - BUG confirmado en vivo: el botón "Descargar"
 *   (`#btn_download_receivable_excel_report`) no tiene ningún atributo
 *   `onclick` ni `href`, y el clic no dispara ninguna petición de red, ni
 *   descarga, ni error en consola — no está conectado a ninguna función
 *   real en este ambiente.
 * - Resultados como tarjetas por producto (NO una `<table>`), agrupadas por
 *   categoría con un botón real "Mostrar detalles" para expandir cada
 *   grupo — confirmado en vivo.
 * - Sin filtro de fechas (confirmado en vivo, no existe ningún campo de
 *   rango de fechas en esta pantalla).
 */
export class ReporteInventarioPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#product_search');
  private readonly btnBuscar = () => this.page.locator('#btn_search_product');
  private readonly btnDescargar = () => this.page.locator('#btn_download_receivable_excel_report');
  private readonly filtroCategoria = () => this.page.locator('#company_category');
  private readonly filtroSubcategoria = () => this.page.locator('#company_subcategory');
  private readonly filtroProveedor = () => this.page.locator('#company_provider');
  private readonly tarjetas = () => this.page.locator('.product_report_card');
  private readonly btnMostrarDetalles = () => this.page.locator('button', { hasText: 'Mostrar detalles' });

  async abrirReporteInventario() {
    await this.page.goto(URL_INVENTARIO, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarCategoria(etiqueta: string) {
    await this.filtroCategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarSubcategoria(etiqueta: string) {
    await this.filtroSubcategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarProveedor(etiqueta: string) {
    await this.filtroProveedor().selectOption({ label: etiqueta }, { force: true });
  }

  async limpiarFiltros() {
    await this.seleccionarCategoria('Todas las categorías');
    await this.seleccionarProveedor('Todos los proveedores');
    await this.buscar('');
  }

  async contarTarjetas(): Promise<number> {
    return this.tarjetas().count();
  }

  async mostrarDetalles(indice = 0) {
    await this.btnMostrarDetalles().nth(indice).click();
  }

  /** Ver bug documentado en el comentario de la clase: el botón no tiene ningún `onclick`/`href` y el clic no produce ninguna descarga real. */
  async clicEnDescargar() {
    await this.btnDescargar().click();
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Análisis de Productos ──────────────────────────────────────

/**
 * Reporte de Análisis de Productos (reports/productGeneralQuantityReport).
 *
 * Analizado en vivo:
 * - Buscador (`#report_search`), rango de fechas (`#start_date`/`#end_date`,
 *   `<input type="date">` nativos), Compañía (`#company_select`), Categoría
 *   (`#company_category`), Subcategoría (`#company_subcategory`), Proveedor
 *   (`#company_provider`).
 * - "Buscar" (`#btn_search_receip`). Exportación real: único botón
 *   "Descargar" (`#btn_export_report`).
 * - Tabla real (dinámica: es una tabla pivote con Código/Producto fijos y
 *   luego un bloque de columnas "Total actual/Total vendido/Cantidad
 *   actual/Cantidad vendida" repetido por cada compañía registrada) — no se
 *   asume un número fijo de columnas, solo que las columnas fijas
 *   (Código/Producto) existen.
 */
export class ReporteAnalisisProductosPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#report_search');
  private readonly fechaInicial = () => this.page.locator('#start_date');
  private readonly fechaFinal = () => this.page.locator('#end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_receip');
  private readonly btnDescargar = () => this.page.locator('#btn_export_report');
  private readonly filtroCompania = () => this.page.locator('#company_select');
  private readonly filtroCategoria = () => this.page.locator('#company_category');
  private readonly filtroSubcategoria = () => this.page.locator('#company_subcategory');
  private readonly filtroProveedor = () => this.page.locator('#company_provider');
  private readonly tabla = () => this.page.locator('table', { hasText: 'Código' }).first();

  async abrirReporteAnalisisProductos() {
    await this.page.goto(URL_ANALISIS_PRODUCTOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  async seleccionarCategoria(etiqueta: string) {
    await this.filtroCategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarSubcategoria(etiqueta: string) {
    await this.filtroSubcategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarProveedor(etiqueta: string) {
    await this.filtroProveedor().selectOption({ label: etiqueta }, { force: true });
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

// ─── Reporte de Tasa de Rotación de Inventario ─────────────────────────────

/**
 * Reporte de Tasa de Rotación de Inventario (reports/inventory_turnover_rate).
 *
 * Analizado en vivo:
 * - Buscador (`#input_search_inventory_turnover_rate`), rango de fechas
 *   (`#inventory_turnover_rate_start_date`/`_end_date`, nativos), Ordenar
 *   por cantidad (`#select_order_by_quantity`), Categoría
 *   (`#select_category_product`), Subcategoría
 *   (`#select_subcategory_product`), Producto (`#select_product_itr`), y
 *   Moneda (menú compartido).
 * - "Buscar" (`#btn_search_inventory_turnover_rate`). Exportación real:
 *   único botón "Descargar" (`#btn_export_inventory_turnover_rate`).
 * - Tabla real, columnas: Fecha, Producto, Código, Cód CABYS, Categoría,
 *   Subcategoría, Cant. Disponible, Cantidad comprada, Total, Anterior.
 *   Cantidad vendida, Actual. Cantidad vendida, Total, Utilidad Total.
 * - BUG confirmado en vivo (mismo patrón que Órdenes en Taller): los campos
 *   de fecha nativos tienen además un widget bootstrap-datepicker
 *   enganchado; tras llenar ambos campos con `.fill()` y hacer clic en
 *   "Buscar", el valor revierte a un rango por defecto — el widget
 *   sobrescribe el valor real al cerrarse.
 */
export class ReporteRotacionInventarioPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#input_search_inventory_turnover_rate');
  private readonly fechaInicial = () => this.page.locator('#inventory_turnover_rate_start_date');
  private readonly fechaFinal = () => this.page.locator('#inventory_turnover_rate_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_inventory_turnover_rate');
  private readonly btnDescargar = () => this.page.locator('#btn_export_inventory_turnover_rate');
  private readonly filtroOrdenCantidad = () => this.page.locator('#select_order_by_quantity');
  private readonly filtroCategoria = () => this.page.locator('#select_category_product');
  private readonly filtroSubcategoria = () => this.page.locator('#select_subcategory_product');
  private readonly filtroProducto = () => this.page.locator('#select_product_itr');
  private readonly tabla = () => this.page.locator('table', { hasText: 'Cant. Disponible' }).first();

  async abrirReporteRotacionInventario() {
    await this.page.goto(URL_ROTACION_INVENTARIO, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  /**
   * Igual que en Compras/Taller, estos campos nativos `<input type="date">`
   * tienen además un widget bootstrap-datepicker enganchado que puede
   * quedar abierto (confirmado en vivo, hasta 2 calendarios huérfanos
   * simultáneos) y bloquear el clic en "Buscar" — se cierra antes de buscar.
   */
  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await cerrarDatepickerHuerfano(this.page);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarOrdenPorCantidad(etiqueta: string) {
    await this.filtroOrdenCantidad().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarCategoria(etiqueta: string) {
    await this.filtroCategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarSubcategoria(etiqueta: string) {
    await this.filtroSubcategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarProducto(etiqueta: string) {
    await this.filtroProducto().selectOption({ label: etiqueta }, { force: true });
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

// ─── Reporte de Catálogo de Productos ──────────────────────────────────────

/**
 * Reporte de Catálogo de Productos (reports/productsCatalog).
 *
 * Analizado en vivo:
 * - Buscador (`#product_search`), Categoría/Subcategoría/Proveedor (mismos
 *   ids que Inventario), y 2 chips de estado: "Todos"/"Stock positivo".
 * - "Buscar" (`#btn_search_product`).
 * - BUG confirmado en vivo: el botón "Descargar"
 *   (`#btn_download_receivable_pdf_report`) no tiene ningún atributo
 *   `onclick` ni `href`, y el clic no dispara ninguna petición de red, ni
 *   descarga, ni navegación — mismo comportamiento que en Inventario.
 * - Resultados como tarjetas por producto (código, cantidad, precio) — NO
 *   una `<table>`, confirmado en vivo.
 * - Sin filtro de fechas (confirmado en vivo).
 */
export class ReporteCatalogoProductosPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#product_search');
  private readonly btnBuscar = () => this.page.locator('#btn_search_product');
  private readonly btnDescargar = () => this.page.locator('#btn_download_receivable_pdf_report');
  private readonly filtroCategoria = () => this.page.locator('#company_category');
  private readonly filtroSubcategoria = () => this.page.locator('#company_subcategory');
  private readonly filtroProveedor = () => this.page.locator('#company_provider');
  private readonly chipTodos = () => this.page.locator('#product_state_all');
  private readonly chipStockPositivo = () => this.page.locator('#product_state_positive');
  private readonly tarjetas = () => this.page.locator('.product_report_card');

  async abrirReporteCatalogoProductos() {
    await this.page.goto(URL_CATALOGO_PRODUCTOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarCategoria(etiqueta: string) {
    await this.filtroCategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarSubcategoria(etiqueta: string) {
    await this.filtroSubcategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarProveedor(etiqueta: string) {
    await this.filtroProveedor().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarSoloStockPositivo() {
    await this.chipStockPositivo().click();
  }

  async seleccionarTodos() {
    await this.chipTodos().click();
  }

  async limpiarFiltros() {
    await this.seleccionarTodos();
    await this.seleccionarCategoria('Todas las categorías');
    await this.seleccionarProveedor('Todos los proveedores');
    await this.buscar('');
  }

  async contarTarjetas(): Promise<number> {
    return this.tarjetas().count();
  }

  /** Ver bug documentado en el comentario de la clase: el botón no tiene ningún `onclick`/`href` y el clic no produce ninguna descarga real. */
  async clicEnDescargar() {
    await this.btnDescargar().click();
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Apartados ───────────────────────────────────────────────────

/**
 * Reporte de Apartados (reports/layawayReport).
 *
 * Analizado en vivo:
 * - Buscador (`#search_layaway`), rango de fechas (`#start_date`/`#end_date`,
 *   nativos) y Moneda (menú compartido).
 * - "Buscar" (`#btn_search`, un `<a>` con solo ícono de lupa, sin texto).
 * - Tabla real, columnas: (columna de expandir), # Apartado, Hecho por,
 *   Vendedor, Cliente, Fecha, Fecha de Vencimiento, Tipo Moneda, Saldo
 *   Actual, Total.
 * - Totales reales por moneda visibles en pantalla ("Total USD: $...",
 *   "Total CRC: ₡...") — confirmado en vivo.
 */
export class ReporteApartadosPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#search_layaway');
  private readonly fechaInicial = () => this.page.locator('#start_date');
  private readonly fechaFinal = () => this.page.locator('#end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search');
  private readonly tabla = () => this.page.locator('table', { hasText: '# Apartado' }).first();
  // "Total USD:"/"Total CRC:" son la etiqueta (<strong>); el monto real
  // ("Saldo: $X" y "Total: $X") vive en un `<span>` hermano dentro del
  // mismo contenedor — se sube al contenedor para leer el texto completo.
  private readonly totalUsd = () => this.page.locator('text=/Total USD:/').locator('xpath=..');
  private readonly totalCrc = () => this.page.locator('text=/Total CRC:/').locator('xpath=..');

  async abrirReporteApartados() {
    await this.page.goto(URL_APARTADOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  async totalesVisibles(): Promise<boolean> {
    return (await this.totalUsd().isVisible()) && (await this.totalCrc().isVisible());
  }

  async obtenerTotalUsd(): Promise<number> {
    const texto = await this.totalUsd().innerText();
    return montoANumero(texto.match(/Total:\s*([^\s]+)/)?.[1] ?? '');
  }

  async obtenerTotalCrc(): Promise<number> {
    const texto = await this.totalCrc().innerText();
    return montoANumero(texto.match(/Total:\s*([^\s]+)/)?.[1] ?? '');
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Toma Física ─────────────────────────────────────────────────

/**
 * Reporte de Toma Física (reports/inventoryReport).
 *
 * Analizado en vivo:
 * - Buscador (`#product_inventory_search`) y rango de fechas
 *   (`#inventory_start_date`/`#inventory_end_date`, nativos). Sin más
 *   filtros de selección (confirmado en vivo).
 * - "Buscar" (`#btn_search_receip`). Exportación real: único botón
 *   "Descargar" (`#btn_export_inventory`).
 * - Tabla real, columnas: Código, Compañía, Creado por, Fecha,
 *   Observaciones — es un listado de documentos de toma física, no el
 *   detalle de productos contados.
 */
export class ReporteTomaFisicaPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#product_inventory_search');
  private readonly fechaInicial = () => this.page.locator('#inventory_start_date');
  private readonly fechaFinal = () => this.page.locator('#inventory_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_receip');
  private readonly btnDescargar = () => this.page.locator('#btn_export_inventory');
  private readonly tabla = () => this.page.locator('table', { hasText: 'Observaciones' }).first();

  async abrirReporteTomaFisica() {
    await this.page.goto(URL_TOMA_FISICA, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

// ─── Reporte de Movimientos de Productos ───────────────────────────────────

/**
 * Reporte de Movimientos de Productos (reports/productMovementReportSearch).
 *
 * Analizado en vivo:
 * - Buscador (`#product_search`), rango de fechas (`#product_start_date`/
 *   `#product_end_date`, nativos) y Tipo de movimiento (`#movement_type_id`).
 * - "Buscar" y exportación real: único botón "Descargar"
 *   (`#btn_export_product`).
 * - Tabla real, columnas: No. Factura, Movimiento, Fecha, Cantidad, Código,
 *   Producto, Costo.
 */
export class ReporteMovimientosProductosPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#product_search');
  private readonly fechaInicial = () => this.page.locator('#product_start_date');
  private readonly fechaFinal = () => this.page.locator('#product_end_date');
  private readonly btnBuscar = () => this.page.locator('a._btn_search, button._btn_search').first();
  private readonly btnDescargar = () => this.page.locator('#btn_export_product');
  private readonly filtroTipoMovimiento = () => this.page.locator('#movement_type_id');
  private readonly tabla = () => this.page.locator('table', { hasText: 'Movimiento' }).first();

  async abrirReporteMovimientosProductos() {
    await this.page.goto(URL_MOVIMIENTOS_PRODUCTOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  async seleccionarTipoMovimiento(etiqueta: string) {
    await this.filtroTipoMovimiento().selectOption({ label: etiqueta }, { force: true });
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

// ─── Reporte de Disponibilidad de Productos Vendidos ───────────────────────

/**
 * Reporte de Disponibilidad de Productos Vendidos (reports/best_selling_products).
 *
 * Analizado en vivo:
 * - Buscador (`#product_search`), rango de fechas (`#product_start_date`/
 *   `#product_end_date`, nativos) y "Filtros avanzados"
 *   (`#advanced_filter_toggle`) que revela selects de variante de producto.
 * - "Buscar" es un `<a>` con ícono + texto " Buscar" (con espacio inicial
 *   por el ícono, confirmado en vivo — se localiza por substring, no por
 *   texto exacto). Exportación real: único botón "Descargar"
 *   (`#btn_export_product`).
 */
export class ReporteDisponibilidadProductosVendidosPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#product_search');
  private readonly fechaInicial = () => this.page.locator('#product_start_date');
  private readonly fechaFinal = () => this.page.locator('#product_end_date');
  private readonly btnBuscar = () => this.page.locator('a, button').filter({ hasText: 'Buscar' }).first();
  private readonly btnDescargar = () => this.page.locator('#btn_export_product');
  private readonly btnFiltrosAvanzados = () => this.page.locator('#advanced_filter_toggle');

  async abrirReporteDisponibilidadProductosVendidos() {
    await this.page.goto(URL_DISPONIBILIDAD_VENDIDOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async mostrarFiltrosAvanzados() {
    await this.btnFiltrosAvanzados().click();
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

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Productos Externos ──────────────────────────────────────────

/**
 * Reporte de Productos Externos (reports/externalProductReport).
 *
 * Analizado en vivo:
 * - Buscador (`#product_external_search`), rango de fechas
 *   (`#export_product_start_date`/`#export_product_end_date`, nativos),
 *   Moneda (menú compartido) y 3 chips de estado: "Todos"/"Vendidos"/
 *   "Pendientes".
 * - "Buscar" (`#btn_search_product_external`). Sin ningún botón de
 *   exportación (PDF/Excel) — confirmado en vivo, no se crea ninguna
 *   prueba ficticia para exportar.
 * - Resultados como tarjetas por producto (código, proveedor, costo,
 *   utilidad, precio, total, estado) — NO una `<table>`.
 * - Mismo widget bootstrap-datepicker huérfano que en Rotación de
 *   Inventario: tras llenar las fechas puede quedar un calendario abierto
 *   que bloquea clics posteriores — los chips de estado cierran ese
 *   calendario con Escape antes de hacer clic.
 */
export class ReporteProductosExternosPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#product_external_search');
  private readonly fechaInicial = () => this.page.locator('#export_product_start_date');
  private readonly fechaFinal = () => this.page.locator('#export_product_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_product_external');
  private readonly chipTodos = () => this.page.locator('#product_external_state_all');
  private readonly chipVendidos = () => this.page.locator('#product_external_state_sold');
  private readonly chipPendientes = () => this.page.locator('#product_external_state_pending');
  private readonly tarjetas = () => this.page.locator('.product_report_card');

  async abrirReporteProductosExternos() {
    await this.page.goto(URL_PRODUCTOS_EXTERNOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  async seleccionarEstadoTodos() {
    await cerrarDatepickerHuerfano(this.page);
    await this.chipTodos().click();
  }

  async seleccionarEstadoVendidos() {
    await cerrarDatepickerHuerfano(this.page);
    await this.chipVendidos().click();
  }

  async seleccionarEstadoPendientes() {
    await cerrarDatepickerHuerfano(this.page);
    await this.chipPendientes().click();
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMonedaGenerica(this.page, etiqueta);
  }

  async contarTarjetas(): Promise<number> {
    return this.tarjetas().count();
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Productos Vendidos (Inventario) ────────────────────────────

/**
 * Reporte de Productos Vendidos (reports/products_details_sales) — dentro
 * del módulo Inventario (distinto del "Productos Vendidos" de Taller,
 * cubierto en rp-taller.page.ts).
 *
 * Analizado en vivo:
 * - Buscador (`#proform_search`), rango de fechas (`#proform_start_date`/
 *   `#proform_end_date`, nativos), Categoría (`#select_category_product`),
 *   Subcategoría (`#select_subcategory_product`) y Moneda (menú
 *   compartido).
 * - "Buscar" (`#btn_search_receip`). Exportación real: único botón
 *   "Descargar" (`#btn_export_proform`, endpoint
 *   `exportProductSaleReport`). Se observó un único `500 Internal Server
 *   Error` transitorio en una ejecución aislada, no reproducible en
 *   ejecuciones posteriores (3/3 exitosas) — se documenta como posible
 *   inestabilidad puntual del ambiente, no como bug confirmado.
 * - Tabla real, columnas: Fecha, No. Factura, No. Consecutivo, Cliente,
 *   Código Producto, Cód CABYS, Producto, Tipo Moneda, Costo, Cantidad,
 *   Precio sin iva, IVA, Precio + iva, Total, Marca, Proveedor, Fecha de
 *   Vencimiento, # de Lote.
 */
export class ReporteProductosVendidosPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#proform_search');
  private readonly fechaInicial = () => this.page.locator('#proform_start_date');
  private readonly fechaFinal = () => this.page.locator('#proform_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_receip');
  private readonly btnDescargar = () => this.page.locator('#btn_export_proform');
  private readonly filtroCategoria = () => this.page.locator('#select_category_product');
  private readonly filtroSubcategoria = () => this.page.locator('#select_subcategory_product');
  private readonly tabla = () => this.page.locator('table', { hasText: 'No. Factura' }).first();

  static readonly COLUMNA_PRODUCTO = 6;
  static readonly COLUMNA_TOTAL = 13;

  async abrirReporteProductosVendidos() {
    await this.page.goto(URL_PRODUCTOS_VENDIDOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  async seleccionarCategoria(etiqueta: string) {
    await this.filtroCategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarSubcategoria(etiqueta: string) {
    await this.filtroSubcategoria().selectOption({ label: etiqueta }, { force: true });
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
    return montoANumero(await this.celdaDeFila(indice, ReporteProductosVendidosPage.COLUMNA_TOTAL));
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

// ─── Reporte de Productos a Pedir ───────────────────────────────────────────

/**
 * Reporte de Productos a Pedir (reports/productsToOrder).
 *
 * Analizado en vivo:
 * - Buscador (`#search_product`) y rango de fechas (`#start_date`/
 *   `#end_date`, nativos). Sin más filtros de selección (confirmado en
 *   vivo).
 * - "Buscar" (`#btn_search_receip`). Exportación real: único botón
 *   "Descargar" (`#btn_export_products`).
 * - Tabla real, columnas: Código, Producto, Categoría, Subcategoría,
 *   Proveedor, Cantidad en inventario, Cantidad vendida, Costo, Precio,
 *   Utilidad.
 */
export class ReporteProductosAPedirPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#search_product');
  private readonly fechaInicial = () => this.page.locator('#start_date');
  private readonly fechaFinal = () => this.page.locator('#end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_receip');
  private readonly btnDescargar = () => this.page.locator('#btn_export_products');
  private readonly tabla = () => this.page.locator('table', { hasText: 'Cantidad en inventario' }).first();

  static readonly COLUMNA_PRODUCTO = 1;
  static readonly COLUMNA_UTILIDAD = 9;

  async abrirReporteProductosAPedir() {
    await this.page.goto(URL_PRODUCTOS_A_PEDIR, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

// ─── Reporte de Productos por Tallas ────────────────────────────────────────

/**
 * Reporte de Productos por Tallas (reports/productBySizeReport).
 *
 * Analizado en vivo:
 * - Buscador (`#product_search`), Categoría (`#company_category`),
 *   Subcategoría (`#company_subcategory`), Variaciones (`#variant-select`:
 *   Talla/Color/Material) y Combinaciones (`#variant-options-select`), más
 *   3 chips de estado: "Todos"/"Stock mínimo"/"Stock en negativo".
 * - "Buscar" (`#btn_search_product`). Exportación real: único botón
 *   "Descargar" (`#btn_export_product`, tooltip "Exportar esta búsqueda").
 * - Resultados como tarjetas por producto (cantidad, código, cód CABYS,
 *   categoría, subcategoría, costo, utilidad, precio) — NO una `<table>`.
 * - Sin filtro de fechas (confirmado en vivo).
 */
export class ReporteProductosPorTallasPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#product_search');
  private readonly btnBuscar = () => this.page.locator('#btn_search_product');
  private readonly btnDescargar = () => this.page.locator('#btn_export_product');
  private readonly filtroCategoria = () => this.page.locator('#company_category');
  private readonly filtroSubcategoria = () => this.page.locator('#company_subcategory');
  private readonly filtroVariacion = () => this.page.locator('#variant-select');
  private readonly filtroCombinacion = () => this.page.locator('#variant-options-select');
  private readonly chipTodos = () => this.page.locator('#product_state_all');
  private readonly chipStockMinimo = () => this.page.locator('#product_state_min');
  private readonly chipStockNegativo = () => this.page.locator('#product_state_negative');
  private readonly tarjetas = () => this.page.locator('.product_report_card');

  async abrirReporteProductosPorTallas() {
    await this.page.goto(URL_PRODUCTOS_POR_TALLAS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarCategoria(etiqueta: string) {
    await this.filtroCategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarSubcategoria(etiqueta: string) {
    await this.filtroSubcategoria().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarVariacion(etiqueta: string) {
    await this.filtroVariacion().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarCombinacion(etiqueta: string) {
    await this.filtroCombinacion().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarEstadoTodos() {
    await this.chipTodos().click();
  }

  async seleccionarEstadoStockMinimo() {
    await this.chipStockMinimo().click();
  }

  async seleccionarEstadoStockNegativo() {
    await this.chipStockNegativo().click();
  }

  async contarTarjetas(): Promise<number> {
    return this.tarjetas().count();
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

// ─── Reporte de Productos por Vencer ───────────────────────────────────────

/**
 * Reporte de Productos por Vencer (reports/productsToExpire).
 *
 * Analizado en vivo:
 * - Buscador de texto libre: el `<input>` real tiene el id `#btn_search`
 *   (nombre engañoso, confirmado en vivo — no es un botón). Rango de
 *   fechas (`#start_date`/`#end_date`, nativos).
 * - "Buscar" real: `#btn_search_products_to_expire`. Exportación real: un
 *   único botón "Descargar" (`#btn_download_expire_products_excel_report`,
 *   pese al nombre del id) que en realidad es el TOGGLE de un dropdown
 *   (`data-toggle="dropdown"`) con 2 opciones reales dentro:
 *   "Descargar Excel" (`#btn_export_product`) y "Descargar PDF"
 *   (`#btn_export_product_detail`) — confirmado en vivo.
 * - 4 indicadores reales con conteos ("PRODUCTOS VIGENTES", "PRÓXIMOS A
 *   VENCER", "VENCIDOS", "TOTAL DE PRODUCTOS"), cada uno con su propio
 *   número de lotes.
 * - Resultados como tarjetas por producto (cantidad, lotes, código de
 *   barras, proveedor, utilidad, descuento, precio) — NO una `<table>`.
 */
export class ReporteProductosPorVencerPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#btn_search');
  private readonly fechaInicial = () => this.page.locator('#start_date');
  private readonly fechaFinal = () => this.page.locator('#end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_products_to_expire');
  private readonly btnDescargarDropdown = () => this.page.locator('#btn_download_expire_products_excel_report');
  private readonly opcionDescargarExcel = () => this.page.locator('#btn_export_product');
  private readonly opcionDescargarPdf = () => this.page.locator('#btn_export_product_detail');
  private readonly tarjetas = () => this.page.locator('.product_report_card');
  private readonly kpiVigentes = () => this.page.locator('text=/PRODUCTOS VIGENTES/i').locator('xpath=ancestor::*[self::div or self::section][1]');
  private readonly kpiProximosVencer = () => this.page.locator('text=/PR[OÓ]XIMOS A VENCER/i').locator('xpath=ancestor::*[self::div or self::section][1]');
  private readonly kpiVencidos = () => this.page.locator('text=/VENCIDOS/i').first().locator('xpath=ancestor::*[self::div or self::section][1]');
  private readonly kpiTotal = () => this.page.locator('text=/TOTAL DE PRODUCTOS/i').locator('xpath=ancestor::*[self::div or self::section][1]');

  async abrirReporteProductosPorVencer() {
    await this.page.goto(URL_PRODUCTOS_POR_VENCER, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  async contarTarjetas(): Promise<number> {
    return this.tarjetas().count();
  }

  async indicadoresVisibles(): Promise<boolean> {
    return (
      (await this.kpiVigentes().isVisible()) &&
      (await this.kpiProximosVencer().isVisible()) &&
      (await this.kpiVencidos().isVisible()) &&
      (await this.kpiTotal().isVisible())
    );
  }

  /**
   * El propio botón toggle del dropdown queda superpuesto visualmente sobre
   * sus opciones (confirmado en vivo: intercepta el clic incluso con
   * `aria-expanded="true"`) — se hace clic en el `<li>` real vía JS para no
   * depender de su posición visual, mismo criterio que en Compras Externas.
   */
  async descargarExcel(): Promise<Download> {
    await this.btnDescargarDropdown().click();
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.opcionDescargarExcel().evaluate((el) => (el as HTMLElement).click());
    return descargaPromise;
  }

  async descargarPDF(): Promise<Download> {
    await this.btnDescargarDropdown().click();
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.opcionDescargarPdf().evaluate((el) => (el as HTMLElement).click());
    return descargaPromise;
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}
