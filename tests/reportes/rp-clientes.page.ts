import { Download, expect, Locator, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';
import { contentHeaderConTexto, SubmoduloReportes, TIMEOUTS } from './reportes.page';

export const SUBMODULOS_REPORTES_CLIENTES: SubmoduloReportes[] = [
  {
    nombre: 'Bitácora de Clientes',
    url: BASE_URL + '/cust/customerBinnacle',
    rutaEsperada: 'customerBinnacle',
    tituloEsperado: /bit[aá]cora clientes/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /bit[aá]cora\s+clientes/i),
  },
  {
    nombre: 'Estado de cuenta',
    url: BASE_URL + '/reports/customerAccountingStatementReport',
    rutaEsperada: 'customerAccountingStatementReport',
    tituloEsperado: /estado de cuenta/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /estado de cuenta/i),
  },
  {
    nombre: 'Clientes frecuentes',
    url: BASE_URL + '/reports/clientReport',
    rutaEsperada: 'clientReport',
    tituloEsperado: /reporte de clientes/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de clientes/i),
  },
  {
    nombre: 'Clientes por Vendedor',
    url: BASE_URL + '/reports/customerBySellerReport',
    rutaEsperada: 'customerBySellerReport',
    tituloEsperado: /clientes por vendedor/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /clientes por vendedor/i),
  },
  {
    // El <title> de esta pantalla es "Reporte de ventas por cliente"
    // (confirmado en vivo) — no corresponde a "Redes Sociales", parece un
    // título desactualizado/copiado de otra pantalla del lado de la
    // aplicación. Se mantiene tal cual porque es lo que realmente se
    // renderiza; la validación real recae en el encabezado de contenido, que
    // sí es propio de esta pantalla.
    nombre: 'Redes Sociales',
    url: BASE_URL + '/reports/customerBySocialNetworks',
    rutaEsperada: 'customerBySocialNetworks',
    tituloEsperado: /reporte de ventas por cliente/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /redes sociales/i),
  },
];

const URL_BITACORA_CLIENTES = SUBMODULOS_REPORTES_CLIENTES[0].url;
const URL_ESTADO_CUENTA = SUBMODULOS_REPORTES_CLIENTES[1].url;
const URL_CLIENTES_FRECUENTES = SUBMODULOS_REPORTES_CLIENTES[2].url;
const URL_CLIENTES_POR_VENDEDOR = SUBMODULOS_REPORTES_CLIENTES[3].url;
const URL_REDES_SOCIALES = SUBMODULOS_REPORTES_CLIENTES[4].url;

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

// ─── Utilidades compartidas entre los 5 reportes ───────────────────────────

/** No hay ningún mensaje de error de aplicación (`.noty_bar`) visible en pantalla. */
async function validarSinErrores(page: Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

/**
 * El layout general del ERP puede mostrar un banner de "Activar
 * notificaciones" al cargar la página, que intercepta clics sobre controles
 * reales si queda visible (confirmado en vivo). Se descarta de forma
 * best-effort tras cada navegación — mismo tratamiento que en
 * rp-caja.page.ts.
 */
async function cerrarBannerNotificaciones(page: Page) {
  await page.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 3000 }).catch(() => {});
}

/**
 * Los campos `<input type="date">` de estos reportes tienen además un
 * datepicker de terceros enganchado por JS. Al llenarlos con `.fill()` el
 * datepicker se abre y, si el campo queda enfocado, su overlay (o el propio
 * input expandido) intercepta clics posteriores sobre otros controles reales
 * (confirmado en vivo — bloqueó el botón "Buscar" hasta hacer timeout).
 * Presionar Escape no basta en todos los reportes; se fuerza además el
 * `blur()` del campo para garantizar que el datepicker se cierre.
 */
async function seleccionarFecha(page: Page, input: Locator, fecha: string) {
  await input.fill(fecha);
  await page.keyboard.press('Escape');
  await input.evaluate((el) => (el as HTMLElement).blur());
}

/**
 * Filtro de moneda compartido por Bitácora de Clientes, Estado de Cuenta,
 * Clientes Frecuentes y Redes Sociales (ausente en Clientes por Vendedor).
 * Es un botón "Moneda: <actual>" que despliega un menú
 * (`#company_currency_report`) con las monedas de la compañía + "Todas".
 * Se ubica el botón por su relación estructural con el menú (hermano
 * anterior dentro del mismo contenedor) en vez de por texto: el texto
 * "Moneda: Todas" no es único en el DOM y un locator por `hasText` queda
 * esperando indefinidamente una coincidencia visible que nunca resuelve
 * sola (confirmado en vivo).
 */
async function seleccionarMoneda(page: Page, texto: string | RegExp) {
  const menu = page.locator('#company_currency_report');
  const toggle = menu.locator('xpath=preceding-sibling::button[1]');
  await toggle.click();
  await menu.locator('a', { hasText: texto }).click();
}

// ─── Reporte de Clientes Frecuentes ────────────────────────────────────────

/**
 * Reporte de Clientes Frecuentes (reports/clientReport).
 *
 * Confirmado en vivo:
 * - Filtros: rango de fechas (`#cash_start_date`/`#cash_end_date`, ambos
 *   `<input type="date">`) + buscador de texto libre (`#customer_search`) +
 *   moneda (botón "Moneda: Todas"). El botón "Buscar"
 *   (`#btn_search_customer`) resultó no ser funcional: al hacer clic (incluso
 *   forzado) no dispara ninguna petición de red ni cambia la tabla. El único
 *   disparador real confirmado es presionar Enter dentro del buscador de
 *   texto — y ese mismo Enter también aplica el rango de fechas vigente en
 *   ese momento, así que se usa como único mecanismo de búsqueda.
 * - Exportación: no existe ningún botón de exportar (ni Excel ni PDF) en
 *   este reporte.
 * - Ordenamiento/paginación: no existen — los encabezados de la tabla no
 *   tienen ningún control de orden y no hay controles de paginación.
 * - Sin resultados: no hay mensaje de "sin resultados"; la tabla queda con
 *   `tbody` vacío.
 * - La tabla incluye, dentro del mismo `tbody`, filas de totales por moneda
 *   ("Total CRC"/"Total USD") — se excluyen de `filas()` porque no son
 *   registros de cliente.
 */
export class ReporteClientesFrecuentesPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#customer_search');
  private readonly fechaInicial = () => this.page.locator('#cash_start_date');
  private readonly fechaFinal = () => this.page.locator('#cash_end_date');

  /** Columna (0-based) del nombre del cliente en cada fila — confirmado en vivo. */
  static readonly COLUMNA_NOMBRE = 2;

  async abrir() {
    await this.page.goto(URL_CLIENTES_FRECUENTES, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await seleccionarFecha(this.page, this.fechaInicial(), fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await seleccionarFecha(this.page, this.fechaFinal(), fecha);
  }

  /** Fija ambas fechas del rango de una sola vez (no ejecuta la búsqueda). */
  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  /** El botón "Buscar" no es funcional en este reporte — Enter en el buscador es el disparador real (ver comentario de la clase). */
  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.buscador().press('Enter');
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarMoneda(texto: string | RegExp) {
    await seleccionarMoneda(this.page, texto);
  }

  tabla(): Locator {
    return this.page.locator('table.mdl-data-table:visible').first();
  }

  filas(): Locator {
    // Las filas de totales ("Total USD"/"Total CRC") viven en el mismo
    // `tbody` que los clientes, con varias celdas vacías antes de la
    // etiqueta — por eso se excluyen por substring ("Total"), no con un
    // regex anclado al inicio (el `textContent` real arrastra el espacio en
    // blanco de esas celdas vacías antes de la palabra).
    return this.tabla().locator('tbody tr').filter({ hasText: /\S/ }).filter({ hasNotText: 'Total' });
  }

  async contarFilas(): Promise<number> {
    return this.filas().count();
  }

  /** Texto de la columna "Nombre" de la fila indicada (0-based). */
  async obtenerNombreDeFila(indice: number): Promise<string> {
    return this.filas().nth(indice).locator('td').nth(ReporteClientesFrecuentesPage.COLUMNA_NOMBRE).innerText();
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Bitácora de Clientes ───────────────────────────────────────

/**
 * Reporte de Bitácora de Clientes (cust/customerBinnacle).
 *
 * Confirmado en vivo:
 * - Filtros: rango de fechas (`#binnacle_start_date`/`#binnacle_end_date`) +
 *   buscador de texto libre (`#binnacle_search`) + moneda (botón "Moneda:
 *   Todas"). Se aplican al hacer clic en "Buscar" (`#btn_search_binnacle`).
 * - Exportación: únicamente "Descargar Excel"
 *   (`#btn_download_binnacle_excel_report`). No existe botón de exportar a
 *   PDF en este reporte.
 * - Pestañas: además de la tabla principal (pestaña "Ventas", activa por
 *   defecto), la pantalla tiene pestañas "Proformas", "Estadísticas" y
 *   "Recordatorios" que muestran/ocultan paneles alternativos del mismo
 *   cliente (`#sales`, `#proform`, `#div_show_hide_statistics`,
 *   `#div_show_hide_reminder`).
 * - Ordenamiento/paginación: no existen en la tabla principal.
 * - Sin resultados: no hay mensaje de "sin resultados"; la tabla queda con
 *   `tbody` vacío.
 */
export class ReporteBitacoraClientesPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#binnacle_search');
  private readonly fechaInicial = () => this.page.locator('#binnacle_start_date');
  private readonly fechaFinal = () => this.page.locator('#binnacle_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_binnacle');
  private readonly btnDescargarExcel = () => this.page.locator('#btn_download_binnacle_excel_report');
  private readonly contenedorTabla = () => this.page.locator('#binnacle_table_list_content');

  private readonly tabVentas = () => this.page.locator('#tab_color_action_board');
  private readonly tabProformas = () => this.page.locator('#tab_color_action_order');
  private readonly tabEstadisticas = () => this.page.locator('#div_tabs_remove_add_class');
  private readonly panelVentas = () => this.page.locator('#sales');
  private readonly panelProformas = () => this.page.locator('#proform');
  private readonly panelEstadisticas = () => this.page.locator('#div_show_hide_statistics');

  /** Columna (0-based) del nombre del cliente en cada fila — confirmado en vivo. */
  static readonly COLUMNA_CLIENTE = 1;

  async abrir() {
    await this.page.goto(URL_BITACORA_CLIENTES, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await seleccionarFecha(this.page, this.fechaInicial(), fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await seleccionarFecha(this.page, this.fechaFinal(), fecha);
  }

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

  async seleccionarMoneda(texto: string | RegExp) {
    await seleccionarMoneda(this.page, texto);
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

  /** Texto de la columna "Cliente" de la fila indicada (0-based). */
  async obtenerClienteDeFila(indice: number): Promise<string> {
    return this.filas().nth(indice).locator('td').nth(ReporteBitacoraClientesPage.COLUMNA_CLIENTE).innerText();
  }

  async descargarExcel(): Promise<Download> {
    const descarga = this.page.waitForEvent('download', { timeout: TIMEOUTS.NAVIGATE });
    await this.btnDescargarExcel().click();
    return descarga;
  }

  async irAPestanaProformas() {
    await this.tabProformas().click();
  }

  async irAPestanaEstadisticas() {
    await this.tabEstadisticas().click();
  }

  async irAPestanaVentas() {
    await this.tabVentas().click();
  }

  panelVentasEsVisible(): Locator {
    return this.panelVentas();
  }

  panelProformasEsVisible(): Locator {
    return this.panelProformas();
  }

  panelEstadisticasEsVisible(): Locator {
    return this.panelEstadisticas();
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Estado de Cuenta ───────────────────────────────────────────

/**
 * Reporte de Estado de Cuenta (reports/customerAccountingStatementReport).
 *
 * Confirmado en vivo:
 * - Filtros: no tiene buscador de texto libre ni rango de fechas. El único
 *   filtro real es "Cliente" — un `<select>` (`#accounting_statement_customer_select`,
 *   estilizado con la librería "chosen") con "Todas" + cada cliente de la
 *   compañía — más el filtro de moneda compartido (botón "Moneda: Todas").
 *   Se aplican al hacer clic en "Buscar" (`#btn_search_accounting_statement`).
 * - No existe exportación a nivel de reporte (ni Excel ni PDF); la
 *   exportación es por fila, vía el menú de acciones (ver abajo).
 * - "Enviar a todos" (`#btn_send_massive_email`) envía un correo masivo real
 *   a todos los clientes — no se ejecuta en las pruebas por ser una acción
 *   con efectos secundarios reales (spam), solo se confirma que el botón
 *   existe y está habilitado.
 * - Cada fila tiene un menú de acciones (ícono "more_vert") con: "Estado de
 *   cuenta" (abre un modal de detalle vía `show_customer_accounting_statement_detail`),
 *   "Imprimir" (enlace real a `printCustomerAccountingStatement`, se abre en
 *   pestaña nueva), "Descargar PDF" (enlace real a
 *   `downloadCustomerAccountingStatementPdf`, se abre en pestaña nueva y
 *   descarga un PDF), "Correo" y "Enviar por WhatsApp" (ambas con efectos
 *   secundarios reales — no se ejecutan). "Impresión general"/"Descargar PDF
 *   general" quedan ocultas por defecto (`display:none`) y no se prueban.
 * - Ordenamiento/paginación: no existen.
 * - Sin resultados: no hay mensaje de "sin resultados"; la tabla queda con
 *   `tbody` vacío.
 */
export class ReporteEstadoCuentaPage {
  constructor(private readonly page: Page) {}

  private readonly selectCliente = () => this.page.locator('#accounting_statement_customer_select');
  private readonly btnBuscar = () => this.page.locator('#btn_search_accounting_statement');
  private readonly btnEnviarATodos = () => this.page.locator('#btn_send_massive_email');
  private readonly contenedorTabla = () => this.page.locator('#table_content');
  private readonly menuAccionesAbierto = () => this.page.locator('.product_dropdown_options.open .dropdown-menu');

  /** Columna (0-based) del nombre del cliente en cada fila — confirmado en vivo. */
  static readonly COLUMNA_CLIENTE = 1;

  async abrir() {
    await this.page.goto(URL_ESTADO_CUENTA, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  /** Selecciona un cliente por su texto visible en el filtro "Cliente" (p.ej. "Todas" o el nombre exacto). */
  async seleccionarCliente(etiqueta: string) {
    // El `<select>` real queda oculto (`display:none`) porque la librería
    // "chosen" lo reemplaza visualmente por un widget propio — sigue siendo
    // el control funcional, por lo que se omite el chequeo de visibilidad.
    await this.selectCliente().selectOption({ label: etiqueta }, { force: true });
  }

  /** Etiquetas de los clientes disponibles en el filtro, excluyendo la opción "Todas". */
  async obtenerOpcionesDeCliente(): Promise<string[]> {
    const etiquetas = await this.selectCliente().locator('option').allTextContents();
    return etiquetas.map((e) => e.trim()).filter((e) => e && e !== 'Todas');
  }

  /** Texto de la columna "Cliente" de la fila indicada (0-based). */
  async obtenerClienteDeFila(indice: number): Promise<string> {
    return this.filas().nth(indice).locator('td').nth(ReporteEstadoCuentaPage.COLUMNA_CLIENTE).innerText();
  }

  async buscar() {
    await this.btnBuscar().click();
  }

  async seleccionarMoneda(texto: string | RegExp) {
    await seleccionarMoneda(this.page, texto);
  }

  botonEnviarATodos(): Locator {
    return this.btnEnviarATodos();
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

  private async abrirMenuAccionesFila(indice: number) {
    await this.filas().nth(indice).locator('button[id="order_analitics_button_"]').click();
    await expect(this.menuAccionesAbierto()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Abre el menú de acciones de la fila y hace clic en "Estado de cuenta" (ver detalle). */
  async verDetalleDeFila(indice: number) {
    await this.abrirMenuAccionesFila(indice);
    await this.menuAccionesAbierto().locator('a', { hasText: 'Estado de cuenta' }).click();
  }

  /** Abre el menú de acciones de la fila y descarga el PDF individual. */
  async descargarPdfDeFila(indice: number): Promise<Download> {
    await this.abrirMenuAccionesFila(indice);
    const descarga = this.page.waitForEvent('download', { timeout: TIMEOUTS.NAVIGATE });
    await this.menuAccionesAbierto().locator('a', { hasText: 'Descargar PDF' }).first().click();
    return descarga;
  }

  modalDetalle(): Locator {
    return this.page.locator('#modal_view_accounting_content');
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Clientes por Vendedor ──────────────────────────────────────

/**
 * Reporte de Clientes por Vendedor (reports/customerBySellerReport).
 *
 * Confirmado en vivo:
 * - Filtros: únicamente buscador de texto libre (`#customer_search`),
 *   aplicado al hacer clic en "Buscar" (`#btn_search_customer`). No tiene
 *   rango de fechas ni filtro de moneda (a diferencia de los otros 4
 *   reportes de este módulo).
 * - Exportación: únicamente "Descargar" en Excel
 *   (`#btn_export_customer_by_seller`). No existe botón de exportar a PDF.
 * - Ordenamiento/paginación: no existen.
 * - Sin resultados: no hay mensaje de "sin resultados"; la tabla queda con
 *   `tbody` vacío.
 */
export class ReporteClientesPorVendedorPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#customer_search');
  private readonly btnBuscar = () => this.page.locator('#btn_search_customer');
  private readonly btnDescargarExcel = () => this.page.locator('#btn_export_customer_by_seller');
  private readonly contenedorTabla = () => this.page.locator('#table_customer_by_seller_content');

  /** Columna (0-based) del nombre del cliente en cada fila — confirmado en vivo. */
  static readonly COLUMNA_NOMBRE = 1;

  async abrir() {
    await this.page.goto(URL_CLIENTES_POR_VENDEDOR, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
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

  /** Texto de la columna "Nombre" de la fila indicada (0-based). */
  async obtenerNombreDeFila(indice: number): Promise<string> {
    return this.filas().nth(indice).locator('td').nth(ReporteClientesPorVendedorPage.COLUMNA_NOMBRE).innerText();
  }

  async descargarExcel(): Promise<Download> {
    const descarga = this.page.waitForEvent('download', { timeout: TIMEOUTS.NAVIGATE });
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

// ─── Reporte de Redes Sociales ─────────────────────────────────────────────

/**
 * Reporte de Redes Sociales (reports/customerBySocialNetworks).
 *
 * Confirmado en vivo:
 * - Filtros: rango de fechas (`#start_date`/`#end_date`) + buscador de texto
 *   libre (`#search`) + moneda (botón "Moneda: Todas") + estado del cliente
 *   ("Todas"/"Clientes"/"Prospectos", botones `#state_all`/`#state_client`/
 *   `#state_prospect`). Fecha y buscador se aplican con "Buscar"
 *   (`#btn_search`); el filtro de estado ejecuta la búsqueda al hacer clic
 *   directamente, sin pasar por "Buscar".
 * - Exportación: únicamente "Descargar" en Excel
 *   (`#btn_export_report_customer_social_network`). No existe botón de
 *   exportar a PDF.
 * - Ordenamiento/paginación: no existen.
 * - Sin resultados: no hay mensaje de "sin resultados"; la tabla queda con
 *   `tbody` vacío. En el ambiente de QA no hay clientes con redes sociales
 *   registradas en ningún rango de fechas probado.
 */
export class ReporteRedesSocialesPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#search');
  private readonly fechaInicial = () => this.page.locator('#start_date');
  private readonly fechaFinal = () => this.page.locator('#end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search');
  private readonly btnDescargarExcel = () => this.page.locator('#btn_export_report_customer_social_network');
  private readonly btnEstadoTodas = () => this.page.locator('#state_all');
  private readonly btnEstadoClientes = () => this.page.locator('#state_client');
  private readonly btnEstadoProspectos = () => this.page.locator('#state_prospect');

  /** Columna (0-based) del nombre del cliente en cada fila — confirmado en vivo. */
  static readonly COLUMNA_CLIENTE = 1;

  async abrir() {
    await this.page.goto(URL_REDES_SOCIALES, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await seleccionarFecha(this.page, this.fechaInicial(), fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await seleccionarFecha(this.page, this.fechaFinal(), fecha);
  }

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

  async seleccionarMoneda(texto: string | RegExp) {
    await seleccionarMoneda(this.page, texto);
  }

  async filtrarPorEstado(estado: 'Todas' | 'Clientes' | 'Prospectos') {
    const boton = estado === 'Todas' ? this.btnEstadoTodas() : estado === 'Clientes' ? this.btnEstadoClientes() : this.btnEstadoProspectos();
    await boton.click();
  }

  tabla(): Locator {
    return this.page.locator('table.mdl-data-table:visible').first();
  }

  filas(): Locator {
    return this.tabla().locator('tbody tr');
  }

  async contarFilas(): Promise<number> {
    return this.filas().count();
  }

  async descargarExcel(): Promise<Download> {
    const descarga = this.page.waitForEvent('download', { timeout: TIMEOUTS.NAVIGATE });
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
