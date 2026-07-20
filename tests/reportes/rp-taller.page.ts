import { Download, expect, Locator, Page } from '@playwright/test';
import { contentHeaderConTexto, SubmoduloReportes, TIMEOUTS } from './reportes.page';

export const SUBMODULOS_REPORTES_TALLER: SubmoduloReportes[] = [
  {
    nombre: 'Mecánicos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/mechanic_report',
    rutaEsperada: 'mechanic_report',
    tituloEsperado: /reporte de mec[aá]nicos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de mec[aá]nicos/i),
  },
  {
    nombre: 'Mano de Obra por Mecánico',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/labor_per_mechanic',
    rutaEsperada: 'labor_per_mechanic',
    tituloEsperado: /mano de obra mec[aá]nicos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /mano de obra mec[aá]nicos/i),
  },
  {
    nombre: 'Comisiones por Servicio',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/serviceCommissionReport',
    rutaEsperada: 'serviceCommissionReport',
    tituloEsperado: /comisiones por servicio/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /comisiones por servicio/i),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el botón real de filtros avanzados, que sí es visible.
    nombre: 'Comisiones E&P',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/eypCommissionReport',
    rutaEsperada: 'eypCommissionReport',
    tituloEsperado: /comisiones e&p/i,
    obtenerLocatorDeCarga: (page) => page.locator('#eyp_btn_toggle_advanced_filters'),
  },
  {
    // Mismo submódulo/URL que "Reporte de órdenes" en Gestión de Taller
    // (ver taller.page.ts) — sin `.content-header` confirmado, se reutiliza
    // el mismo locator real ya validado ahí.
    nombre: 'Órdenes',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/order_report',
    rutaEsperada: 'order_report',
    tituloEsperado: /reporte de [oó]rdenes/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_toggle_advanced_filters'),
  },
  {
    nombre: 'Vehículos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/vehicle_report',
    rutaEsperada: 'vehicle_report',
    tituloEsperado: /reporte de veh[ií]culos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de veh[ií]culos/i),
  },
  {
    nombre: 'Vehículos según Recepción',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/repairOrderVehicle',
    rutaEsperada: 'repairOrderVehicle',
    tituloEsperado: /veh[ií]culos seg[uú]n [oó]rdenes de trabajo/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /veh[ií]culos seg[uú]n [oó]rdenes de trabajo/i),
  },
  {
    nombre: 'Servicios y recordatorios de próximo cambio',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/oil_change_report',
    rutaEsperada: 'oil_change_report',
    tituloEsperado: /cambio de aceite/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /servicios y recordatorios de pr[oó]ximo cambio/i),
  },
  {
    // El <title> de esta pantalla es "Reporte de órdenes" (confirmado en
    // vivo), igual que el submódulo "Órdenes" de este mismo grupo — la
    // validación real recae en el encabezado de contenido, que sí es propio.
    nombre: 'Servicios y productos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/getRepairOrderGeneralReport',
    rutaEsperada: 'getRepairOrderGeneralReport',
    tituloEsperado: /reporte de [oó]rdenes/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /servicios y productos/i),
  },
  {
    // Reportado antes como roto (error de servidor "Invalid argument
    // supplied for foreach()") — re-verificado en vivo en esta sesión: la
    // pantalla ya carga correctamente, con datos reales al ampliar el rango
    // de fechas. Se reincorpora al listado.
    nombre: 'Productos Vendidos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/product_sale_report',
    rutaEsperada: 'product_sale_report',
    tituloEsperado: /reporte producto-venta/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de productos vendidos/i),
  },
];

const URL_COMISIONES_SERVICIO = SUBMODULOS_REPORTES_TALLER[2].url;
const URL_COMISIONES_EP = SUBMODULOS_REPORTES_TALLER[3].url;
const URL_ORDENES = SUBMODULOS_REPORTES_TALLER[4].url;
const URL_VEHICULOS = SUBMODULOS_REPORTES_TALLER[5].url;
const URL_VEHICULOS_RECEPCION = SUBMODULOS_REPORTES_TALLER[6].url;
const URL_PRODUCTOS_VENDIDOS = SUBMODULOS_REPORTES_TALLER[9].url;

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
 * Selecciona una moneda del menú "Moneda: <actual>" propio de Productos
 * Vendidos (estructuralmente igual al de Compras, pero sin el id
 * `#company_currency_report` — su `<ul>` no tiene id propio, confirmado en
 * vivo — se localiza por relación con el botón, que sí es único en esta
 * pantalla).
 */
async function seleccionarMonedaProductosVendidos(page: Page, etiqueta: string) {
  // `hasText` con regex ancorado (`^`) no coincidía: el texto real del botón
  // trae espacios/saltos de línea antes de "Moneda:" en el HTML fuente
  // (confirmado en vivo) — se usa una cadena simple (substring, insensible a
  // ese espaciado) en vez de un regex anclado al inicio.
  const boton = page.locator('button', { hasText: 'Moneda:' }).first();
  await boton.click();
  const menu = boton.locator('xpath=following-sibling::ul[1]');
  await menu.locator('a', { hasText: etiqueta }).click();
}

// ─── Reporte de Comisiones por Servicio ────────────────────────────────────

/**
 * Reporte de Comisiones por Servicio (reports/serviceCommissionReport).
 *
 * Analizado en vivo:
 * - Filtros: Rol (`#sc_role_select`, select nativo) y Usuario
 *   (`#sc_seller_select`, select nativo), rango de fechas (`#sc_start_date`/
 *   `#sc_end_date`, `<input type="date">` nativos) y buscador de texto libre
 *   (`#sc_search_input`).
 * - "Buscar" es un `<a>` (`#btn_sc_search`, sin la clase `btn`) que dispara
 *   AJAX real `getServiceCommissionSearch`.
 * - Resultados en `#sc_table_list` (no es una `<table>`, es un contenedor
 *   `div.sc-table-shell`); su estado vacío real es `div.sc-empty` con el
 *   texto "No hay comisiones por servicio para los filtros seleccionados.".
 * - Este ambiente de QA no tiene ninguna comisión por servicio registrada
 *   (confirmado en vivo incluso con rango 2020-2026) — no se puede confirmar
 *   la estructura de columnas de la tabla con datos reales.
 * - Sin exportación de ningún tipo (PDF/Excel/impresión) — confirmado en
 *   vivo que no existe ningún botón de este tipo en la pantalla.
 * - BUG confirmado en vivo: la fecha escrita en el rango revierte al valor
 *   por defecto tras hacer clic en "Buscar" (probado con `.fill()`, la forma
 *   correcta de interactuar con un `<input type="date">` nativo).
 */
export class ReporteComisionesServicioPage {
  constructor(private readonly page: Page) {}

  private readonly fechaInicial = () => this.page.locator('#sc_start_date');
  private readonly fechaFinal = () => this.page.locator('#sc_end_date');
  private readonly buscador = () => this.page.locator('#sc_search_input');
  private readonly btnBuscar = () => this.page.locator('#btn_sc_search');
  private readonly filtroRol = () => this.page.locator('#sc_role_select');
  private readonly filtroUsuario = () => this.page.locator('#sc_seller_select');
  private readonly resultados = () => this.page.locator('#sc_table_list');
  private readonly estadoVacio = () => this.page.locator('#sc_table_list .sc-empty');

  async abrirReporteComisionesServicio() {
    await this.page.goto(URL_COMISIONES_SERVICIO, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getServiceCommissionSearch'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnBuscar().click();
    await respuestaPromise;
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarRol(etiqueta: string) {
    await this.filtroRol().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarUsuario(etiqueta: string) {
    await this.filtroUsuario().selectOption({ label: etiqueta }, { force: true });
  }

  async limpiarFiltros() {
    await this.seleccionarRol('Todos');
    await this.seleccionarUsuario('Todos');
    await this.buscar('');
  }

  async validarMensajeSinResultados() {
    await expect(this.estadoVacio()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarResultadosVisibles() {
    await expect(this.resultados()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Comisiones E&P ──────────────────────────────────────────────

/**
 * Reporte de Comisiones E&P — Enderezado y Pintura (reports/eypCommissionReport).
 *
 * Analizado en vivo:
 * - Sin `.content-header` propio — el encabezado se valida vía el botón de
 *   filtros avanzados, único en esta pantalla.
 * - Filtros básicos siempre visibles: rango de fechas (`#eyp_date_from`/
 *   `#eyp_date_to`, `<input type="date">` nativos) y buscador de texto libre
 *   (`#eyp_search_text`, placeholder "Ej: 1542, 7890, ABC123").
 * - Filtros avanzados (tras expandir `#eyp_btn_toggle_advanced_filters`):
 *   Tipo de vehículo (`#eyp_vehicle_type_select`), Parte (`#eyp_part_select`),
 *   Pieza (`#eyp_piece_select`), Servicio (`#eyp_service_select`), Mecánico
 *   (`#eyp_mechanic_select`) y Tipo de comisión (`#eyp_commission_type`).
 *   Parte/Pieza/Servicio están encadenados (confirmado en vivo: elegir una
 *   Parte concreta puede reducir las opciones reales de Servicio) — los
 *   tests combinan estos filtros usando siempre su opción "Todos/Todas" por
 *   defecto para no depender de qué combinación concreta queda disponible.
 * - "Buscar" (`#eyp_btn_search`) dispara AJAX real `getEypCommissionSummary`.
 *   "Limpiar" (`#eyp_btn_clear`) restaura los filtros por defecto.
 * - "Exportar PDF" (`#eyp_btn_export_pdf`) y "Exportar Excel"
 *   (`#eyp_btn_export_excel`) existen y aparentan estar listos, pero
 *   confirmado en vivo que ambos permanecen con el atributo `disabled`
 *   siempre — antes de buscar, después de buscar sin resultados y después
 *   de buscar con un rango amplio. Como este ambiente de QA nunca tiene
 *   comisiones E&P registradas, no se pudo confirmar si se habilitan al
 *   existir resultados reales — se documenta el estado observado
 *   (permanentemente deshabilitados) en vez de forzar una descarga que la
 *   propia interfaz impide.
 * - Resultados en una grilla por divs (no `<table>`): encabezado
 *   `.eyp-grid-header` con columnas Mecánico/Total de Órdenes/Total
 *   Servicios/Total Dinero Generado/Total de Comisión por Monto/Total de
 *   Comisión por Porcentaje, cuerpo `#eyp_table_body`; cada fila tiene una
 *   celda de expandir/colapsar (`.toggle-cell`) — no se confirmó su
 *   comportamiento real por falta de datos.
 * - Estado vacío real: `#eyp_empty_state`, "No se encontraron datos para los
 *   filtros seleccionados." Este ambiente de QA no tiene ninguna comisión
 *   E&P registrada (confirmado en vivo incluso con rango 2020-2026).
 * - A diferencia de Comisiones por Servicio, el rango de fechas SÍ persiste
 *   correctamente tras "Buscar" (confirmado en vivo con `.fill()`).
 */
export class ReporteComisionesEPPage {
  constructor(private readonly page: Page) {}

  private readonly fechaInicial = () => this.page.locator('#eyp_date_from');
  private readonly fechaFinal = () => this.page.locator('#eyp_date_to');
  private readonly buscador = () => this.page.locator('#eyp_search_text');
  private readonly btnBuscar = () => this.page.locator('#eyp_btn_search');
  private readonly btnLimpiar = () => this.page.locator('#eyp_btn_clear');
  private readonly btnFiltrosAvanzados = () => this.page.locator('#eyp_btn_toggle_advanced_filters');
  private readonly btnExportarPdf = () => this.page.locator('#eyp_btn_export_pdf');
  private readonly btnExportarExcel = () => this.page.locator('#eyp_btn_export_excel');
  private readonly filtroTipoVehiculo = () => this.page.locator('#eyp_vehicle_type_select');
  private readonly filtroParte = () => this.page.locator('#eyp_part_select');
  private readonly filtroPieza = () => this.page.locator('#eyp_piece_select');
  private readonly filtroServicio = () => this.page.locator('#eyp_service_select');
  private readonly filtroMecanico = () => this.page.locator('#eyp_mechanic_select');
  private readonly filtroTipoComision = () => this.page.locator('#eyp_commission_type');
  private readonly tableBody = () => this.page.locator('#eyp_table_body');
  private readonly estadoVacio = () => this.page.locator('#eyp_empty_state');

  async abrirReporteComisionesEP() {
    await this.page.goto(URL_COMISIONES_EP, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async mostrarFiltrosAvanzados() {
    await this.btnFiltrosAvanzados().click();
    await expect(this.filtroTipoVehiculo()).toBeVisible();
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
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getEypCommissionSummary'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnBuscar().click();
    await respuestaPromise;
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarTipoVehiculo(etiqueta: string) {
    await this.filtroTipoVehiculo().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarParte(etiqueta: string) {
    await this.filtroParte().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarPieza(etiqueta: string) {
    await this.filtroPieza().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarServicio(etiqueta: string) {
    await this.filtroServicio().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarMecanico(etiqueta: string) {
    await this.filtroMecanico().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarTipoComision(etiqueta: string) {
    await this.filtroTipoComision().selectOption({ label: etiqueta }, { force: true });
  }

  async limpiarFiltros() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getEypCommissionSummary'),
      { timeout: TIMEOUTS.CARGA }
    ).catch(() => null);
    await this.btnLimpiar().click();
    await respuestaPromise;
  }

  /** Ver bug documentado en el comentario de la clase: permanece deshabilitado en este ambiente sin datos. */
  async botonExportarPdfDeshabilitado(): Promise<boolean> {
    return this.btnExportarPdf().isDisabled();
  }

  /** Ver bug documentado en el comentario de la clase: permanece deshabilitado en este ambiente sin datos. */
  async botonExportarExcelDeshabilitado(): Promise<boolean> {
    return this.btnExportarExcel().isDisabled();
  }

  async validarMensajeSinResultados() {
    await expect(this.estadoVacio()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tableBody().locator('> *').count();
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Órdenes ─────────────────────────────────────────────────────

/**
 * Reporte de Órdenes (reports/order_report) — mismo submódulo/URL que
 * "Reporte de órdenes" en Gestión de Taller.
 *
 * Analizado en vivo:
 * - Filtro de rango rápido "Resumen" (`#resume`, select nativo): Hoy/Ayer/
 *   Últimos 7 días/Últimos 14 días/Últimos 30 días/Rango de fecha — los
 *   campos de fecha (`#start_date`/`#end_date`, `<input type="date">`
 *   nativos) solo son visibles cuando se selecciona "Rango de fecha".
 * - Otros filtros: Mecánico (`#mechanic`), Tipo de fecha (`#type_of_date`:
 *   Creación/Facturación), Garantía (`#warrantly`: No/Sí), Marca (`#brand`),
 *   Estado (`#filter_status_select`: Todos/Finalizadas/Pendientes/
 *   Canceladas/Facturación masiva) — todos selects nativos — y buscador de
 *   texto libre (`#search`).
 * - "Buscar" (`#btn_search`) dispara AJAX real `get_table_view` (tabla) y
 *   `get_order_dashboard_analytics` (gráficos de resumen).
 * - 3 tarjetas de resumen con gráfico (`#orp_orders_orders_overview_grid`):
 *   por estado (`#orders_overview_status_chart`), por mecánico
 *   (`#orders_overview_mechanic_chart`) y de tendencia — confirmadas en vivo.
 * - Exportación real: dropdown de Excel (`.orp-btn-excel`) con 4 opciones
 *   reales: "Excel de órdenes", "Excel de órdenes y vehículos", "Excel de
 *   abonos" y "Excel de facturación masiva". Sin exportación a PDF.
 * - Tabla real (`.orp-orders-table`), columnas: Orden, Resumen, Cliente /
 *   Vehículo, S / P, Fechas, Financiero, Total, (acciones). Sin columnas
 *   ordenables, sin fila de totales/tfoot y sin paginación (confirmado en
 *   vivo) — no se crean pruebas ficticias para ninguna de las tres.
 * - BUG confirmado en vivo: al escribir un rango de fechas y hacer clic en
 *   "Buscar", el modo "Rango de fecha" del select `#resume` sí se mantiene,
 *   pero los propios campos `#start_date`/`#end_date` quedan vacíos (no
 *   revierten a un valor por defecto, se limpian por completo).
 */
export class ReporteOrdenesPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#search');
  private readonly fechaInicial = () => this.page.locator('#start_date');
  private readonly fechaFinal = () => this.page.locator('#end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search');
  private readonly btnFiltrosAvanzados = () => this.page.locator('#btn_toggle_advanced_filters');
  private readonly filtroResumen = () => this.page.locator('#resume');
  private readonly filtroMecanico = () => this.page.locator('#mechanic');
  private readonly filtroTipoFecha = () => this.page.locator('#type_of_date');
  private readonly filtroGarantia = () => this.page.locator('#warrantly');
  private readonly filtroMarca = () => this.page.locator('#brand');
  private readonly filtroEstado = () => this.page.locator('#filter_status_select');
  private readonly btnExportarExcel = () => this.page.locator('.orp-btn-excel');
  private readonly tabla = () => this.page.locator('table.orp-orders-table');
  private readonly graficoEstado = () => this.page.locator('#orders_overview_status_chart');
  private readonly graficoMecanico = () => this.page.locator('#orders_overview_mechanic_chart');

  async abrirReporteOrdenes() {
    await this.page.goto(URL_ORDENES, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async mostrarFiltrosAvanzados() {
    await this.btnFiltrosAvanzados().click();
  }

  /** Selecciona un rango rápido (Hoy/Ayer/Últimos N días/Rango de fecha). Al elegir "Rango de fecha" se revelan los campos de fecha. */
  async seleccionarResumen(etiqueta: string) {
    await this.filtroResumen().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarFechaInicial(fecha: string) {
    await this.fechaInicial().fill(fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await this.fechaFinal().fill(fecha);
  }

  /** Requiere haber seleccionado antes `seleccionarResumen('Rango de fecha')` para que los campos sean visibles. */
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
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('get_table_view'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnBuscar().click();
    await respuestaPromise;
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarMecanico(etiqueta: string) {
    await this.filtroMecanico().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarTipoFecha(etiqueta: string) {
    await this.filtroTipoFecha().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarGarantia(etiqueta: string) {
    await this.filtroGarantia().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarMarca(etiqueta: string) {
    await this.filtroMarca().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarEstado(etiqueta: string) {
    await this.filtroEstado().selectOption({ label: etiqueta }, { force: true });
  }

  async limpiarFiltros() {
    await this.seleccionarResumen('Hoy');
    await this.seleccionarMecanico('Todos');
    await this.seleccionarEstado('Todos');
    await this.buscar('');
  }

  /** Abre el dropdown de exportación y descarga una de las 4 variantes reales de Excel. */
  async descargarExcel(
    variante: 'Excel de órdenes' | 'Excel de órdenes y vehículos' | 'Excel de abonos' | 'Excel de facturación masiva'
  ): Promise<Download> {
    await this.btnExportarExcel().click();
    const opcion = this.page.locator('.dropdown-menu:visible', { hasText: variante }).locator('a', { hasText: variante }).first();
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await opcion.click();
    return descargaPromise;
  }

  tablaLocator(): Locator {
    return this.tabla();
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilas(): Promise<number> {
    return this.tabla().locator('tbody tr').count();
  }

  async graficosVisibles(): Promise<boolean> {
    return (await this.graficoEstado().isVisible()) && (await this.graficoMecanico().isVisible());
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Vehículos ───────────────────────────────────────────────────

/**
 * Reporte de Vehículos (reports/vehicle_report).
 *
 * Analizado en vivo:
 * - Filtros: Cliente (`#vehicle_customer_select`), Tipo de vehículo
 *   (`#vehicle_type_select`: Todos/combustión/híbrido/eléctrico), Tipo de
 *   fecha (`#vehicle_date_type_select`) y Sucursal (`#vehicle_branch_select`)
 *   — todos selects "chosen" — más rango de fechas (`#vehicle_start_date`/
 *   `#vehicle_end_date`, `<input type="date">` nativos) y buscador de texto
 *   libre (`#vehicle_search`).
 * - "Buscar" (`#btn_search_vehicle`, un `<a>`) no dispara ninguna petición
 *   AJAX propia detectable (confirmado en vivo con listener de red) — filtra
 *   sobre los datos ya cargados en la propia página. Buscar por una placa
 *   real SÍ filtra correctamente. BUG confirmado en vivo de forma
 *   reproducible: al buscar un término que no coincide con ninguna placa,
 *   el listado no siempre queda en 0 tarjetas — en la práctica puede seguir
 *   mostrando el listado completo sin filtrar (posible condición de carrera
 *   entre el filtro cliente y la carga de datos).
 * - Resultados como tarjetas (`.product_report_card`, NO una `<table>`)
 *   dentro de `#vehicle_list_content`; sin datos no muestra ningún mensaje
 *   de estado vacío explícito (confirmado en vivo, el contenedor solo queda
 *   vacío) — no se asume un mensaje que no existe.
 * - Clic en una tarjeta abre un modal de detalle real (`#dialog_vehicle_report_detail`).
 * - Exportación real: dropdown "Descargar por tipo"
 *   (`#btn_vehicle_export_dropdown`) con 3 opciones: "Solo vehículos de
 *   combustión", "Solo vehículos híbridos", "Solo vehículos eléctricos".
 * - Sin tabla tradicional: sin fila de totales, sin columnas ordenables y
 *   sin paginación (el contenedor de tarjetas hace scroll interno) —
 *   confirmado en vivo, no se crean pruebas ficticias para ninguna.
 * - BUG confirmado en vivo: la fecha escrita en el rango revierte al valor
 *   por defecto tras hacer clic en "Buscar" (probado con `.fill()` limpio,
 *   sin mezclar métodos de interacción).
 */
export class ReporteVehiculosPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#vehicle_search');
  private readonly fechaInicial = () => this.page.locator('#vehicle_start_date');
  private readonly fechaFinal = () => this.page.locator('#vehicle_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_vehicle');
  private readonly filtroCliente = () => this.page.locator('#vehicle_customer_select');
  private readonly filtroTipo = () => this.page.locator('#vehicle_type_select');
  private readonly filtroTipoFecha = () => this.page.locator('#vehicle_date_type_select');
  private readonly filtroSucursal = () => this.page.locator('#vehicle_branch_select');
  private readonly btnExportarDropdown = () => this.page.locator('#btn_vehicle_export_dropdown');
  private readonly listaTarjetas = () => this.page.locator('#vehicle_list_content');
  private readonly tarjetas = () => this.page.locator('.product_report_card');
  private readonly modalDetalle = () => this.page.locator('#dialog_vehicle_report_detail');

  async abrirReporteVehiculos() {
    await this.page.goto(URL_VEHICULOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  /** Sin AJAX propio detectado (confirmado en vivo) — se espera a que la propia lista termine de re-renderizar. */
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

  async seleccionarTipo(etiqueta: string) {
    await this.filtroTipo().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarTipoFecha(etiqueta: string) {
    await this.filtroTipoFecha().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarSucursal(etiqueta: string) {
    await this.filtroSucursal().selectOption({ label: etiqueta }, { force: true });
  }

  async limpiarFiltros() {
    await this.seleccionarCliente('Todos');
    await this.seleccionarTipo('Todos');
    await this.seleccionarSucursal('Todos');
    await this.buscar('');
  }

  async contarTarjetas(): Promise<number> {
    return this.tarjetas().count();
  }

  /** Extrae la placa real desde el encabezado de la tarjeta ("Placa: HK-9877" → "HK-9877"). */
  async obtenerPlacaDeTarjeta(indice: number): Promise<string> {
    const texto = await this.tarjetas().nth(indice).locator('h5').innerText();
    return texto.replace(/^Placa:\s*/i, '').trim();
  }

  async abrirDetalleTarjeta(indice = 0) {
    await this.tarjetas().nth(indice).click();
    await expect(this.modalDetalle()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async cerrarDetalleTarjeta() {
    await this.page.keyboard.press('Escape');
    await expect(this.modalDetalle()).not.toBeVisible();
  }

  async descargarPorTipo(tipo: 'Solo vehículos de combustión' | 'Solo vehículos híbridos' | 'Solo vehículos eléctricos'): Promise<Download> {
    await this.btnExportarDropdown().click();
    const opcion = this.page.locator('.dropdown-menu:visible a', { hasText: tipo }).first();
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await opcion.click();
    return descargaPromise;
  }

  listaTarjetasLocator(): Locator {
    return this.listaTarjetas();
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Vehículos según Recepción ──────────────────────────────────

/**
 * Reporte de Vehículos según Recepción (reports/repairOrderVehicle) — tabla
 * agregada de vehículos recibidos en órdenes de trabajo, agrupada por
 * Marca/Modelo/Año.
 *
 * Analizado en vivo:
 * - Sin filtros de selección (ni Cliente, ni Estado, ni Técnico) — solo
 *   rango de fechas (`#sales_start_date`/`#sales_end_date`). A diferencia
 *   del resto del módulo, estos son `<input type="text">` planos SIN ningún
 *   widget de calendario asociado (confirmado en vivo: no aparece ningún
 *   `.datepicker-dropdown` al hacer clic) — `.fill()` es la única forma de
 *   interactuar con ellos y de hecho persiste correctamente tras "Buscar".
 * - Sin buscador de texto libre (confirmado en vivo, no hay ningún `<input>`
 *   de búsqueda en esta pantalla).
 * - "Buscar" (`#btn_search_receip`) dispara AJAX real `getRepairOrderVehicle`.
 * - Con el rango por defecto no hay resultados en este ambiente de QA; con
 *   un rango amplio (2020-2026) sí aparecen filas reales (77 confirmadas en
 *   vivo).
 * - BUG confirmado en vivo: "Descargar" (`#btn_download_report`,
 *   `onclick="download_report()"`) no está deshabilitado y el clic no
 *   produce ningún error, pero tampoco dispara ninguna descarga real, ni
 *   abre una pestaña/popup nueva, ni deja ningún error en la consola del
 *   navegador — no genera ningún efecto observable con datos reales en
 *   pantalla (rango amplio, 77 filas). El botón parece no estar conectado a
 *   ninguna función real de descarga en este ambiente.
 * - Tabla real con columnas Marca/Modelo/Año/Frecuencia. Sin fila de
 *   totales/tfoot, sin columnas ordenables y sin paginación (confirmado en
 *   vivo) — no se crean pruebas ficticias para ninguna.
 */
export class ReporteVehiculosRecepcionPage {
  constructor(private readonly page: Page) {}

  private readonly fechaInicial = () => this.page.locator('#sales_start_date');
  private readonly fechaFinal = () => this.page.locator('#sales_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_receip');
  private readonly btnDescargar = () => this.page.locator('#btn_download_report');
  private readonly tabla = () => this.page.locator('table', { hasText: 'Marca' }).first();

  static readonly COLUMNA_MARCA = 0;
  static readonly COLUMNA_MODELO = 1;
  static readonly COLUMNA_ANIO = 2;
  static readonly COLUMNA_FRECUENCIA = 3;

  async abrirReporteVehiculosRecepcion() {
    await this.page.goto(URL_VEHICULOS_RECEPCION, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  async buscar() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getRepairOrderVehicle'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnBuscar().click();
    await respuestaPromise;
  }

  /** Ver bug documentado en el comentario de la clase: el clic no produce ninguna descarga real ni error. */
  async clicEnDescargar() {
    await this.btnDescargar().click();
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

  async obtenerMarcaDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteVehiculosRecepcionPage.COLUMNA_MARCA);
  }

  async obtenerFrecuenciaDeFila(indice: number): Promise<number> {
    return montoANumero(await this.celdaDeFila(indice, ReporteVehiculosRecepcionPage.COLUMNA_FRECUENCIA));
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Productos Vendidos ─────────────────────────────────────────

/**
 * Reporte de Productos Vendidos (reports/product_sale_report).
 *
 * Analizado en vivo: reportado en una investigación anterior como roto en
 * este ambiente ("Whoops... Invalid argument supplied for foreach()") — al
 * re-verificar en vivo en esta sesión, la pantalla carga correctamente y
 * devuelve datos reales al ampliar el rango de fechas (15 filas confirmadas).
 *
 * - Filtros: rango de fechas (`#proform_start_date`/`#proform_end_date`,
 *   `<input type="date">` nativos), buscador de texto libre
 *   (`#proform_search`) y Moneda (botón "Moneda: <actual>" + `<ul
 *   class="dropdown-menu">` hermano, mismo patrón estructural que en
 *   Compras pero sin id propio en el `<ul>`).
 * - "Buscar" (`#btn_search_receip`) dispara AJAX real
 *   `getProductSaleSearchDetails`.
 * - Exportación real: único botón directo "Descargar" (`#btn_export_proform`,
 *   un `<a>` sin dropdown), descarga real.
 * - Tabla real (`table.mdl-data-table`) — sus encabezados están en celdas
 *   `<td>` en vez de `<th>` (confirmado en vivo): Producto, # de Orden,
 *   Placa, Cliente, No. Consecutivo, No. Factura, Moneda, Cantidad, IVA,
 *   Precio. Sin fila de totales/tfoot, sin columnas ordenables y sin
 *   paginación (confirmado en vivo) — no se crean pruebas ficticias para
 *   ninguna.
 * - BUG confirmado en vivo: la fecha escrita en el rango revierte al valor
 *   por defecto tras hacer clic en "Buscar" (probado con `.fill()` limpio).
 */
export class ReporteProductosVendidosPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#proform_search');
  private readonly fechaInicial = () => this.page.locator('#proform_start_date');
  private readonly fechaFinal = () => this.page.locator('#proform_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_receip');
  private readonly btnDescargar = () => this.page.locator('#btn_export_proform');
  private readonly tabla = () => this.page.locator('table.mdl-data-table');

  static readonly COLUMNA_PRODUCTO = 0;
  static readonly COLUMNA_ORDEN = 1;
  static readonly COLUMNA_PLACA = 2;
  static readonly COLUMNA_CLIENTE = 3;

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
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getProductSaleSearchDetails'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnBuscar().click();
    await respuestaPromise;
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMonedaProductosVendidos(this.page, etiqueta);
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
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

  async obtenerProductoDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteProductosVendidosPage.COLUMNA_PRODUCTO);
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}
