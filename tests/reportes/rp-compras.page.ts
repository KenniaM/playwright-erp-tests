import { Download, expect, Locator, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';
import { contentHeaderConTexto, SubmoduloReportes, TIMEOUTS } from './reportes.page';

export const SUBMODULOS_REPORTES_COMPRAS: SubmoduloReportes[] = [
  {
    nombre: 'Mov. fac ingresadas',
    url: BASE_URL + '/reports/invoiceMovementEntered',
    rutaEsperada: 'invoiceMovementEntered',
    tituloEsperado: /movimientos de facturas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /movimientos de facturas/i),
  },
  {
    nombre: 'Abonos',
    url: BASE_URL + '/reports/creditPurchasePayment',
    rutaEsperada: 'creditPurchasePayment',
    tituloEsperado: /reporte de abonos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /abonos/i),
  },
  {
    nombre: 'Compras',
    url: BASE_URL + '/reports/purchaseReport',
    rutaEsperada: 'purchaseReport',
    tituloEsperado: /reporte de compras/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de compras/i),
  },
  {
    nombre: 'Compras Externas',
    url: BASE_URL + '/reports/productExternalPurchaseReport',
    rutaEsperada: 'productExternalPurchaseReport',
    tituloEsperado: /compras externas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /compras externas/i),
  },
  {
    nombre: 'Gastos',
    url: BASE_URL + '/reports/expenseReport',
    rutaEsperada: 'expenseReport',
    tituloEsperado: /reporte gastos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte gastos/i),
  },
  {
    nombre: 'Cuentas por pagar',
    url: BASE_URL + '/reports/accountsToPay',
    rutaEsperada: 'accountsToPay',
    tituloEsperado: /cuentas x pagar/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /cuentas x pagar/i),
  },
  {
    nombre: 'Antigüedad de crédito',
    url: BASE_URL + '/reports/get_purchase_aging_report_by_provider_data',
    rutaEsperada: 'get_purchase_aging_report_by_provider_data',
    tituloEsperado: /antig[üu]edad de cr[eé]dito/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /antig[üu]edad/i),
  },
];

const URL_MOV_FAC_INGRESADAS = SUBMODULOS_REPORTES_COMPRAS[0].url;
const URL_ABONOS = SUBMODULOS_REPORTES_COMPRAS[1].url;
const URL_COMPRAS = SUBMODULOS_REPORTES_COMPRAS[2].url;
const URL_COMPRAS_EXTERNAS = SUBMODULOS_REPORTES_COMPRAS[3].url;
const URL_GASTOS = SUBMODULOS_REPORTES_COMPRAS[4].url;
const URL_CUENTAS_POR_PAGAR = SUBMODULOS_REPORTES_COMPRAS[5].url;
const URL_ANTIGUEDAD_CREDITO = SUBMODULOS_REPORTES_COMPRAS[6].url;

// ─── Utilidades compartidas ─────────────────────────────────────────────────

/**
 * Convierte un monto mostrado en pantalla a number, tolerando AMBOS formatos
 * reales de este ERP: "$1,234.56" (punto decimal, coma de miles) Y
 * "₡4.000,00" (coma decimal, punto de miles — confirmado en vivo leyendo
 * `formatMoney()` real de `js/expense_report_v2/ExpenseReportV2Utils.js`:
 * usa SIEMPRE "." de miles + "," decimal, sin importar la moneda real).
 * Bug real encontrado al validar el Reporte de Gastos (V2): el regex viejo
 * (`[^\d.-]`) solo eliminaba el símbolo de moneda pero dejaba AMBOS
 * separadores como si fueran puntos decimales — "₡4.000,00" quedaba como
 * "4.000.00" y `parseFloat` lo truncaba a 4 en vez de 4000. Se detecta el
 * separador decimal real como el ÚLTIMO de "," o "." en el texto (el otro,
 * si aparece antes, es de miles).
 */
function montoANumero(texto: string): number {
  const limpio = texto.replace(/[^\d.,-]/g, '');
  const ultimaComa = limpio.lastIndexOf(',');
  const ultimoPunto = limpio.lastIndexOf('.');
  if (ultimaComa === -1 && ultimoPunto === -1) return parseFloat(limpio) || 0;
  const separadorDecimal = ultimaComa > ultimoPunto ? ',' : '.';
  const separadorMiles = separadorDecimal === ',' ? '.' : ',';
  const normalizado = limpio.split(separadorMiles).join('').replace(separadorDecimal, '.');
  return parseFloat(normalizado) || 0;
}

/** No hay ningún mensaje de error de aplicación (`.noty_bar`) visible en pantalla. */
async function validarSinErrores(page: Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

/**
 * El layout general del ERP puede mostrar un banner de "Activar
 * notificaciones" al cargar la página, que intercepta clics sobre controles
 * reales si queda visible. En el módulo de Compras este banner resultó más
 * persistente que en el resto de la suite (confirmado en vivo: el clic de
 * cierre por sí solo no bastaba de forma consistente bajo carga), así que
 * además de intentar cerrarlo se lo oculta por completo vía JS como
 * salvaguarda adicional.
 */
async function cerrarBannerNotificaciones(page: Page) {
  await page.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 8000 }).catch(() => {});
  await page.evaluate(() => {
    const el = document.getElementById('workshop-web-notification-permission');
    if (el) el.style.display = 'none';
  }).catch(() => {});
}

/**
 * Selecciona una moneda real del menú compartido "Moneda: <actual>"
 * (`#company_currency_report`, presente en Abonos/Compras/Gastos/Cuentas por
 * Pagar/Antigüedad de Crédito — Compras Externas y Mov. Fac. Ingresadas NO
 * tienen este filtro, confirmado en vivo). Se localiza el botón por su
 * relación estructural con el propio menú (hermano anterior dentro del
 * mismo contenedor) en vez de por texto genérico "Moneda:": ese texto no es
 * único en el DOM (confirmado en vivo que un locator genérico por texto
 * puede resolver a un botón oculto y ajeno en otra parte de la página),
 * mismo criterio ya usado en `rp-clientes.page.ts`.
 */
async function seleccionarMoneda(page: Page, etiqueta: string) {
  const menu = page.locator('#company_currency_report');
  const toggle = menu.locator('xpath=preceding-sibling::button[1]');
  await toggle.click();
  await page.locator('#company_currency_report a', { hasText: etiqueta }).click();
}

const MESES_ABREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Selecciona una fecha haciendo clic en el propio widget de calendario
 * (bootstrap-datepicker) en vez de escribir directamente en el `<input>`.
 * Confirmado en vivo: escribir con `.fill()` solo cambia el texto visual del
 * campo, pero el backend lee el estado interno del plugin — al hacer clic en
 * "Buscar" la fecha "escrita" revertía al valor por defecto. Haciendo clic
 * real en un día del calendario (navegando Días → Meses → Años igual que un
 * usuario) el filtro sí se aplica y persiste tras la búsqueda.
 */
async function seleccionarFechaCalendario(page: Page, input: Locator, fechaISO: string) {
  const [anioStr, mesStr, diaStr] = fechaISO.split('-');
  const anio = Number(anioStr);
  const dia = Number(diaStr);
  const mesAbrev = MESES_ABREV[Number(mesStr) - 1];

  await input.click();
  const dp = page.locator('.datepicker-dropdown:visible').last();

  await dp.locator('.datepicker-days:visible .datepicker-switch').click();
  await dp.locator('.datepicker-months:visible .datepicker-switch').click();

  for (let intentos = 0; intentos < 30; intentos++) {
    const rango = await dp.locator('.datepicker-years:visible .datepicker-switch').innerText();
    const [desde, hasta] = rango.split('-').map(Number);
    if (anio >= desde && anio <= hasta) break;
    await dp.locator(anio < desde ? '.datepicker-years:visible .prev' : '.datepicker-years:visible .next').click();
  }
  await dp.locator('.datepicker-years:visible .year', { hasText: new RegExp(`^${anio}$`) }).click();
  await dp.locator('.datepicker-months:visible .month', { hasText: new RegExp(`^${mesAbrev}$`) }).click();
  await dp.locator('.datepicker-days:visible td.day:not(.old):not(.new)', { hasText: new RegExp(`^${dia}$`) }).click();
}

// ─── Reporte Mov. Fac. Ingresadas ──────────────────────────────────────────

/**
 * Reporte Mov. Fac. Ingresadas (reports/invoiceMovementEntered) — título real
 * "Reporte de movimientos de facturas".
 *
 * Analizado en vivo (scripts de investigación descartados tras extraer la
 * evidencia, no forman parte de esta suite):
 *
 * - En realidad es un documento de "Cierre de documentos de proveedores
 *   diario" pensado para imprimirse (confirmado en vivo dentro del propio
 *   HTML de impresión), no un listado filtrable típico: solo tiene rango de
 *   fechas (`#start_date`/`#end_date`, `<input type="date">`) y buscador de
 *   texto libre (`#search`) — sin Proveedor/Estado/Moneda/exportación a
 *   Excel o PDF.
 * - 4 pestañas de "vista" (`#all`/`#purchase_invoice`/
 *   `#external_purchase_invoice`/`#expense_invoices`, función real
 *   `change_view()`): confirmado en vivo que NO disparan ninguna petición
 *   AJAX nueva y que las secciones `.content_view_type` de los 3 tipos de
 *   movimiento (Compras/Compras Externas/Gastos) permanecen visibles en la
 *   página sin importar la pestaña activa — solo actualizan el campo oculto
 *   `#filter_view` y la clase "activa" del botón. No se les asume ningún
 *   efecto de filtrado real.
 * - "Imprimir" (`print_content('div_print_content')`) SÍ es una función real:
 *   abre una pestaña nueva con el documento de cierre.
 * - IMPORTANTE (bug de sistema, no de automatización — ver informe final):
 *   escribir una fecha distinta en `#start_date` y presionar "Buscar" NO
 *   persiste el valor escrito; el campo vuelve a su valor por defecto
 *   (confirmado en vivo de forma reproducible con múltiples valores). Por
 *   eso los tests de rango de fechas de este reporte solo validan que la
 *   búsqueda se ejecute sin errores, no que el rango realmente cambie.
 */
export class ReporteMovFacIngresadasPage {
  constructor(private readonly page: Page) {}

  private readonly fechaInicial = () => this.page.locator('#start_date');
  private readonly fechaFinal = () => this.page.locator('#end_date');
  private readonly buscador = () => this.page.locator('#search');
  private readonly btnBuscar = () => this.page.locator('a._btn_search');
  private readonly btnImprimir = () => this.page.locator('button', { hasText: 'Imprimir' });
  private readonly contenedorImpresion = () => this.page.locator('#div_print_content');
  private readonly vistaBtn = (vista: 'all' | 'purchase_invoice' | 'external_purchase_invoice' | 'expense_invoices') =>
    this.page.locator(`#${vista}`);
  private readonly filtroView = () => this.page.locator('#filter_view');

  async abrirReporteMovFacIngresadas() {
    await this.page.goto(URL_MOV_FAC_INGRESADAS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  /** A diferencia del resto del módulo, `#start_date`/`#end_date` son `<input type="date">` nativos (no un widget bootstrap-datepicker) — `.fill()` es la forma correcta de interactuar con ellos. */
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

  /** Llena el buscador (si se indica término) y ejecuta "Buscar". */
  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.btnBuscar().click({ force: true });
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  /** Selecciona una de las 4 pestañas de vista — no se le asume ningún efecto de filtrado real (ver comentario de la clase). */
  async seleccionarVista(vista: 'all' | 'purchase_invoice' | 'external_purchase_invoice' | 'expense_invoices') {
    await this.vistaBtn(vista).click();
  }

  async obtenerVistaActiva(): Promise<string> {
    return this.filtroView().inputValue();
  }

  /** Presiona "Imprimir" y devuelve la pestaña nueva con el documento de cierre. */
  async imprimir(): Promise<Page> {
    const popupPromise = this.page.context().waitForEvent('page', { timeout: TIMEOUTS.CARGA });
    await this.btnImprimir().click();
    return popupPromise;
  }

  async validarTabla() {
    await expect(this.contenedorImpresion()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Abonos ─────────────────────────────────────────────────────

/**
 * Reporte de Abonos (reports/creditPurchasePayment).
 *
 * Analizado en vivo:
 * - Filtros: buscador (`#credit_payment_invoice_search`), rango de fechas
 *   (`#start_date`/`#end_date`), Proveedor (`#credit_payment_provider_select`,
 *   chosen, con proveedores reales), Tipo de pago
 *   (`#payment_type_select`, chosen: Todas/Efectivo/Tarjeta/Transacción
 *   Bancaria/SINPE MOVIL/Nota de crédito), Tipo de documento (4 botones:
 *   Todas/Compra/Compra Externa/Gasto) y Moneda (menú compartido).
 * - "Buscar" (`#btn_credit_payment_search`) dispara AJAX real
 *   `creditPurchasePaymentSearch`.
 * - Exportación: único botón directo "Descargar" (`#btn_download_credit_payment_excel_report`,
 *   sin dropdown), descarga real `.xlsx`, sin SweetAlert de confirmación.
 * - Este ambiente de QA no tiene ningún abono registrado (confirmado en
 *   vivo incluso con rango amplio) — los tests validan filtros/exportación
 *   sin asumir datos reales.
 */
export class ReporteAbonosPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#credit_payment_invoice_search');
  private readonly fechaInicial = () => this.page.locator('#start_date');
  private readonly fechaFinal = () => this.page.locator('#end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_credit_payment_search');
  private readonly filtroProveedor = () => this.page.locator('#credit_payment_provider_select');
  private readonly filtroTipoPago = () => this.page.locator('#payment_type_select');
  private readonly btnDescargar = () => this.page.locator('#btn_download_credit_payment_excel_report');
  private readonly tbody = () => this.page.locator('#table_list');

  static readonly COLUMNA_FACTURA = 0;
  static readonly COLUMNA_PROVEEDOR = 6;
  static readonly COLUMNA_TOTAL_ABONO = 10;
  static readonly COLUMNA_SALDO_ACTUAL = 12;

  async abrirReporteAbonos() {
    await this.page.goto(URL_ABONOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await seleccionarFechaCalendario(this.page, this.fechaInicial(), fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await seleccionarFechaCalendario(this.page, this.fechaFinal(), fecha);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
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

  /** El `<select>` real está oculto por la librería "chosen" — se selecciona con `{ force: true }`. */
  async seleccionarProveedor(etiqueta: string) {
    await this.filtroProveedor().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarTipoPago(etiqueta: string) {
    await this.filtroTipoPago().selectOption({ label: etiqueta }, { force: true });
  }

  /**
   * Selecciona por `type_id` real (0=Todas/1=Compra/2=Compra Externa/
   * 3=Gasto) — un selector genérico por texto ("Todas") puede coincidir con
   * elementos ajenos y ocultos en otras partes de la página (confirmado en
   * vivo: coincidió con una pestaña oculta del widget de notificaciones).
   */
  async seleccionarTipoDocumento(tipo: 'Todas' | 'Compra' | 'Compra Externa' | 'Gasto') {
    const typeId = { Todas: '0', Compra: '1', 'Compra Externa': '2', Gasto: '3' }[tipo];
    await this.page.locator(`button[type_id="${typeId}"]`).click();
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMoneda(this.page, etiqueta);
  }

  /** Restaura fechas/proveedor/tipo de pago/tipo de documento/moneda/buscador a sus valores por defecto y vuelve a buscar. */
  async limpiarFiltros() {
    await this.seleccionarProveedor('Todas');
    await this.seleccionarTipoPago('Todas');
    await this.seleccionarTipoDocumento('Todas');
    await this.seleccionarMoneda('Todas');
    await this.buscar('');
  }

  /** Un `tbody` vacío (sin filas) colapsa a 0px de alto y Playwright lo reporta como "hidden" aunque no tenga `display:none` (confirmado en vivo) — se valida la `<table>` completa (encabezados incluidos), que permanece visible con o sin datos. */
  tabla(): Locator {
    return this.tbody().locator('xpath=ancestor::table[1]');
  }

  filas(): Locator {
    return this.tbody().locator('tr');
  }

  async contarFilas(): Promise<number> {
    return this.filas().count();
  }

  private async celdaDeFila(indice: number, columna: number): Promise<string> {
    return (await this.filas().nth(indice).locator('td').nth(columna).innerText()).trim();
  }

  async obtenerProveedorDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteAbonosPage.COLUMNA_PROVEEDOR);
  }

  async obtenerTotalAbonoNumericoDeFila(indice: number): Promise<number> {
    return montoANumero(await this.celdaDeFila(indice, ReporteAbonosPage.COLUMNA_TOTAL_ABONO));
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Compras ────────────────────────────────────────────────────

/**
 * Reporte de Compras (reports/purchaseReport).
 *
 * Analizado en vivo:
 * - Filtros: buscador (`#purchase_invoice_search`), rango de fechas
 *   (`#purchase_start_date`/`#purchase_end_date`), Tipo de pago
 *   (`#purchase_method_pay_name`, chosen: Todos/Efectivo/Transferencia
 *   Bancaria/Tarjeta/SINPE MOVIL), 4 chips de estado (Todos/Crédito/Contado/
 *   Eliminadas) y Moneda (menú compartido).
 * - "Buscar" (`#btn_search_receip2`) dispara AJAX real `getPurchaseSeacrh`
 *   (nombre real del endpoint, con el typo incluido).
 * - Exportación: dropdown "Descargar" (`#btn_export_purchase`) con 2
 *   opciones reales: "Exportar compras" (`data-type="1"`) y "Exportar
 *   compras con detalles" (`data-type="2"`), ambas descargan un archivo
 *   real (`.xls`), sin SweetAlert de confirmación.
 */
export class ReporteComprasPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#purchase_invoice_search');
  private readonly fechaInicial = () => this.page.locator('#purchase_start_date');
  private readonly fechaFinal = () => this.page.locator('#purchase_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_receip2');
  private readonly filtroTipoPago = () => this.page.locator('#purchase_method_pay_name');
  private readonly chipEstado = (estado: 'all' | 'pending' | 'paid' | 'deleted') => this.page.locator(`#purchase_${estado}`);
  private readonly btnDescargarToggle = () => this.page.locator('#btn_export_purchase');
  private readonly opcionExportar = (tipo: '1' | '2') => this.page.locator(`li.btn_export_purchase_li[data-type="${tipo}"]`);
  private readonly tbody = () => this.page.locator('#table_purchase');

  static readonly COLUMNA_FACTURA = 1;
  static readonly COLUMNA_PROVEEDOR = 4;
  static readonly COLUMNA_TOTAL = 10;

  async abrirReporteCompras() {
    await this.page.goto(URL_COMPRAS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await seleccionarFechaCalendario(this.page, this.fechaInicial(), fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await seleccionarFechaCalendario(this.page, this.fechaFinal(), fecha);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getPurchaseSeacrh'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnBuscar().click();
    await respuestaPromise;
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarTipoPago(etiqueta: string) {
    await this.filtroTipoPago().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarEstado(estado: 'all' | 'pending' | 'paid' | 'deleted') {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getPurchaseSeacrh'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.chipEstado(estado).click();
    await respuestaPromise;
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMoneda(this.page, etiqueta);
  }

  async limpiarFiltros() {
    await this.seleccionarTipoPago('Todos');
    await this.seleccionarEstado('all');
    await this.seleccionarMoneda('Todos');
    await this.buscar('');
  }

  /** Un `tbody` vacío (sin filas) colapsa a 0px de alto y Playwright lo reporta como "hidden" aunque no tenga `display:none` (confirmado en vivo) — se valida la `<table>` completa (encabezados incluidos), que permanece visible con o sin datos. */
  tabla(): Locator {
    return this.tbody().locator('xpath=ancestor::table[1]');
  }

  filas(): Locator {
    return this.tbody().locator('tr');
  }

  async contarFilas(): Promise<number> {
    return this.filas().count();
  }

  private async celdaDeFila(indice: number, columna: number): Promise<string> {
    return (await this.filas().nth(indice).locator('td').nth(columna).innerText()).trim();
  }

  async obtenerProveedorDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteComprasPage.COLUMNA_PROVEEDOR);
  }

  async obtenerTotalNumericoDeFila(indice: number): Promise<number> {
    return montoANumero(await this.celdaDeFila(indice, ReporteComprasPage.COLUMNA_TOTAL));
  }

  async descargarCompras(): Promise<Download> {
    await this.btnDescargarToggle().click();
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.opcionExportar('1').click();
    return descargaPromise;
  }

  async descargarComprasConDetalles(): Promise<Download> {
    await this.btnDescargarToggle().click();
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.opcionExportar('2').click();
    return descargaPromise;
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Compras Externas ───────────────────────────────────────────

/**
 * Reporte de Compras Externas (reports/productExternalPurchaseReport).
 *
 * Analizado en vivo:
 * - Filtros: buscador (`#purchase_invoice_search`), rango de fechas
 *   (`#purchase_start_date`/`#purchase_end_date`) y 3 chips de estado
 *   (Todos/Crédito/Contado). NO tiene filtro de Moneda (confirmado en vivo).
 * - "Buscar" (`#btn_search_receip`) dispara AJAX real
 *   `getExternalPurchaseSeacrh`.
 * - Exportación: único botón directo "Descargar"
 *   (`#btn_export_external_purchase`, sin dropdown), descarga real, sin
 *   SweetAlert de confirmación.
 */
export class ReporteComprasExternasPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#purchase_invoice_search');
  private readonly fechaInicial = () => this.page.locator('#purchase_start_date');
  private readonly fechaFinal = () => this.page.locator('#purchase_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_receip');
  private readonly chipEstado = (estado: 'all' | 'pending' | 'paid') => this.page.locator(`#purchase_${estado}`);
  private readonly btnDescargar = () => this.page.locator('#btn_export_external_purchase');
  private readonly tbody = () => this.page.locator('#table_purchase');

  static readonly COLUMNA_FACTURA = 1;
  static readonly COLUMNA_PROVEEDOR = 4;
  static readonly COLUMNA_TOTAL = 11;

  async abrirReporteComprasExternas() {
    await this.page.goto(URL_COMPRAS_EXTERNAS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await seleccionarFechaCalendario(this.page, this.fechaInicial(), fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await seleccionarFechaCalendario(this.page, this.fechaFinal(), fecha);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getExternalPurchaseSeacrh'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnBuscar().click();
    await respuestaPromise;
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarEstado(estado: 'all' | 'pending' | 'paid') {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getExternalPurchaseSeacrh'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.chipEstado(estado).click();
    await respuestaPromise;
  }

  async limpiarFiltros() {
    await this.seleccionarEstado('all');
    await this.buscar('');
  }

  /** Un `tbody` vacío (sin filas) colapsa a 0px de alto y Playwright lo reporta como "hidden" aunque no tenga `display:none` (confirmado en vivo) — se valida la `<table>` completa (encabezados incluidos), que permanece visible con o sin datos. */
  tabla(): Locator {
    return this.tbody().locator('xpath=ancestor::table[1]');
  }

  filas(): Locator {
    return this.tbody().locator('tr');
  }

  async contarFilas(): Promise<number> {
    return this.filas().count();
  }

  private async celdaDeFila(indice: number, columna: number): Promise<string> {
    return (await this.filas().nth(indice).locator('td').nth(columna).innerText()).trim();
  }

  async obtenerProveedorDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteComprasExternasPage.COLUMNA_PROVEEDOR);
  }

  async obtenerTotalNumericoDeFila(indice: number): Promise<number> {
    return montoANumero(await this.celdaDeFila(indice, ReporteComprasExternasPage.COLUMNA_TOTAL));
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Gastos ──────────────────────────────────────────────────────

/**
 * Reporte de Gastos (reports/expenseReport) — reporte de facturas de gasto
 * a proveedores dentro del módulo Compras (distinto del Reporte de Gastos
 * Operativos, cubierto en rp-gastos-operativos.page.ts).
 *
 * REDISEÑADO POR COMPLETO — componente nuevo "ExpenseReportV2" (mismo
 * patrón de rediseño ya documentado en este repo para acr-v2/casv2).
 * Confirmado leyendo `js/expense_report_v2/*.js` real (`curl` directo): el
 * Page Object viejo (`#expense_invoice_search`, `#btn_search_receip2`,
 * endpoint `getExpenseSeacrh`) ya NO EXISTE — causaba que `buscar()` se
 * quedara colgada indefinidamente esperando una respuesta de red que nunca
 * llega (confirmado en vivo: el test completo agotaba su timeout de 120s
 * dentro de `buscar()`, sin ningún error intermedio porque el `.fill()`
 * sobre el selector viejo simplemente reintentaba sin fin contra un
 * elemento inexistente).
 *
 * Raíz real: `#expense_report_v2_app`.
 * - Búsqueda REACTIVA (no hay botón "Buscar"): `#erv2_search_input`
 *   dispara `refresh()` tras 350ms de debounce sobre el evento `input` —
 *   nunca un `.click()` en un botón de búsqueda.
 * - Filtros reales: Compañía (`#erv2_company_select`, `<select>` Chosen
 *   solo si la cuenta tiene más de una compañía — si no, es un
 *   `<input type="hidden">`), rango de fechas (`#erv2_start_date`/
 *   `#erv2_end_date`), "Tipo de compra" (`#erv2_state_select`, Chosen —
 *   el nombre interno "state" es engañoso: sus 3 opciones reales son
 *   "Todas"(2, por defecto)/"Crédito"(1)/"Contado"(0), NO un estado de
 *   pago pendiente/pagado), Moneda (`#erv2_currency_select`, Chosen,
 *   poblada vía AJAX `getReportCurrencyCompany` al cargar/cambiar
 *   compañía). "Limpiar" (`#btn_erv2_clear`).
 * - Endpoint real de búsqueda/filtrado: `getExpenseReportSearchData`
 *   (POST) — usar ESTE en `page.waitForResponse`, nunca `getExpenseSeacrh`
 *   (ya no existe en absoluto).
 * - Tabla `#erv2_table_body` (scroll incremental dentro de
 *   `#erv2_table_container`, contador real `#erv2_loaded_count`) — 7
 *   columnas por fila (Factura/Fechas/Proveedor/Tipo y Estado/Servicio/
 *   Resumen financiero/Acciones) generadas por JS, sin `id` individual por
 *   celda: el nombre del proveedor vive en `.erv2-cell-primary` de la
 *   columna 2 (0-based), el monto total real en `.erv2-cell-primary--money`
 *   de la columna 5. Estado vacío real `#erv2_empty_state`, estado de
 *   error `#erv2_error_state` (ambos con `display:flex`/`none`, nunca
 *   `hidden` de Playwright — confirmar por CSS, no por visibilidad).
 * - Menú de acciones por fila: botón `.erv2-action-toggle` (dropdown
 *   Bootstrap) → único ítem real "Ver detalles" (`.erv2-view-detail`,
 *   `data-expense-id`) abre el modal `#erv2_expense_detail_modal` (AJAX
 *   `getExpenseReportDetailData`).
 * - Resumen por moneda: `#erv2_summary_content`, un bloque
 *   `.erv2-summary-currency` por moneda con datos reales — mismo patrón ya
 *   usado en `casv2` (`rp-clientes.page.ts`): `<span><small>etiqueta</small><b>valor</b></span>`
 *   por métrica, en orden fijo Total/Subtotal/IVA/Descuento.
 * - "Descargar" (`#btn_erv2_export`) genera el Excel 100% client-side
 *   (ExcelJS + Blob, mismo patrón que casv2/acr-v2) — SÍ dispara un evento
 *   `download` real (`<a download>` con click programático), a diferencia
 *   del componente viejo (descarga directa del backend).
 * - El bug de "Moneda no funcional" documentado para el componente viejo
 *   YA NO APLICA — el filtro de Moneda de ExpenseReportV2 es un `<select>`
 *   Chosen normal, visible y funcional (confirmado en vivo).
 */
export class ReporteGastosComprasPage {
  constructor(private readonly page: Page) {}

  private readonly appRoot = () => this.page.locator('#expense_report_v2_app');
  private readonly buscador = () => this.page.locator('#erv2_search_input');
  private readonly fechaInicial = () => this.page.locator('#erv2_start_date');
  private readonly fechaFinal = () => this.page.locator('#erv2_end_date');
  private readonly btnLimpiar = () => this.page.locator('#btn_erv2_clear');
  private readonly filtroTipoCompra = () => this.page.locator('#erv2_state_select');
  private readonly filtroMoneda = () => this.page.locator('#erv2_currency_select');
  private readonly btnDescargar = () => this.page.locator('#btn_erv2_export');
  private readonly contenedorTabla = () => this.page.locator('#erv2_table_container');
  private readonly tablaBody = () => this.page.locator('#erv2_table_body');
  private readonly estadoVacio = () => this.page.locator('#erv2_empty_state');
  private readonly resumenPorMoneda = () => this.page.locator('#erv2_summary_content');

  static readonly COLUMNA_PROVEEDOR = 2;
  static readonly COLUMNA_TOTAL = 5;

  async abrirReporteGastos() {
    await this.page.goto(URL_GASTOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
    await expect(this.appRoot(), 'La raíz real #expense_report_v2_app no quedó visible').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async seleccionarFechaInicial(fecha: string) {
    await seleccionarFechaCalendario(this.page, this.fechaInicial(), fecha);
    await this._esperarRespuestaBusqueda();
  }

  async seleccionarFechaFinal(fecha: string) {
    await seleccionarFechaCalendario(this.page, this.fechaFinal(), fecha);
    await this._esperarRespuestaBusqueda();
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await seleccionarFechaCalendario(this.page, this.fechaInicial(), fechaInicial);
    await seleccionarFechaCalendario(this.page, this.fechaFinal(), fechaFinal);
    await this._esperarRespuestaBusqueda();
  }

  /**
   * Escribe en el buscador real (`#erv2_search_input`) — la búsqueda es
   * REACTIVA (debounce de 350ms sobre `input`, sin botón "Buscar" que
   * disparar). Espera la respuesta real de `getExpenseReportSearchData`
   * (el endpoint real, no `getExpenseSeacrh`).
   */
  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this._esperarRespuestaBusqueda();
  }

  private async _esperarRespuestaBusqueda() {
    await this.page.waitForResponse((res) => res.url().includes('getExpenseReportSearchData'), { timeout: TIMEOUTS.CARGA });
    // Margen corto para que la tabla ya renderizada por `renderRows()` quede pintada en el DOM.
    await this.page.waitForTimeout(200);
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  /** "Tipo de compra" real (no un estado de pago) — opciones reales: "Todas"/"Crédito"/"Contado". */
  async seleccionarTipoCompra(texto: 'Todas' | 'Crédito' | 'Contado') {
    await this._seleccionarChosen('erv2_state_select', texto);
    await this._esperarRespuestaBusqueda();
  }

  async seleccionarMoneda(texto: string) {
    await this._seleccionarChosen('erv2_currency_select', texto);
    await this._esperarRespuestaBusqueda();
  }

  private async _seleccionarChosen(idSelectReal: string, texto: string) {
    const contenedor = `#${idSelectReal}_chosen`;
    await this.page.locator(`${contenedor} .chosen-single`).click();
    await this.page.locator(`${contenedor} .chosen-results li`, { hasText: texto }).click();
  }

  /**
   * Confirmado en vivo: el filtro de Moneda de ExpenseReportV2 SÍ es un
   * Chosen visible y funcional (a diferencia del componente viejo, ver el
   * comentario de la clase). Chosen oculta el `<select>` real
   * (`display:none`) y lo reemplaza visualmente con `.chosen-container` —
   * hay que comprobar ESE contenedor, nunca el `<select>` subyacente
   * (confirmado en vivo: `filtroMoneda().isVisible()` siempre da `false`
   * pese a que el usuario sí lo ve y puede usarlo).
   */
  async monedaEsVisible(): Promise<boolean> {
    return this.page.locator('#erv2_currency_select_chosen').isVisible();
  }

  async limpiarFiltros() {
    const respuestaPromise = this.page.waitForResponse((res) => res.url().includes('getExpenseReportSearchData'), { timeout: TIMEOUTS.CARGA });
    await this.btnLimpiar().click();
    await respuestaPromise;
    await this.page.waitForTimeout(200);
  }

  /** El contenedor con scroll (`#erv2_table_container`) permanece visible con o sin datos — la tabla interna puede colapsar a 0 filas sin `display:none`. */
  tabla(): Locator {
    return this.contenedorTabla();
  }

  filas(): Locator {
    return this.tablaBody().locator('tr');
  }

  async contarFilas(): Promise<number> {
    return this.filas().count();
  }

  async sinResultadosVisible(): Promise<boolean> {
    return this.estadoVacio().evaluate((el) => getComputedStyle(el).display !== 'none');
  }

  async obtenerProveedorDeFila(indice: number): Promise<string> {
    const texto = await this.filas().nth(indice).locator('td').nth(ReporteGastosComprasPage.COLUMNA_PROVEEDOR).locator('.erv2-cell-primary').innerText();
    return texto.trim();
  }

  async obtenerTotalNumericoDeFila(indice: number): Promise<number> {
    const texto = await this.filas().nth(indice).locator('td').nth(ReporteGastosComprasPage.COLUMNA_TOTAL).locator('.erv2-cell-primary--money').innerText();
    return montoANumero(texto);
  }

  /** Lee el bloque real de resumen por moneda (`.erv2-summary-currency`) — mismo patrón de lectura ya usado para `casv2` en `rp-clientes.page.ts`. */
  async obtenerResumenPorMoneda(): Promise<{ codigo: string; total: number; subtotal: number; iva: number; descuento: number }[]> {
    const bloques = this.resumenPorMoneda().locator('.erv2-summary-currency');
    const total = await bloques.count();
    const resultado: { codigo: string; total: number; subtotal: number; iva: number; descuento: number }[] = [];
    for (let i = 0; i < total; i++) {
      const bloque = bloques.nth(i);
      const codigo = (await bloque.locator('.erv2-summary-currency-title strong').innerText()).trim();
      const valores = bloque.locator('.erv2-summary-values span b');
      resultado.push({
        codigo,
        total: montoANumero(await valores.nth(0).innerText()),
        subtotal: montoANumero(await valores.nth(1).innerText()),
        iva: montoANumero(await valores.nth(2).innerText()),
        descuento: montoANumero(await valores.nth(3).innerText()),
      });
    }
    return resultado;
  }

  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Cuentas por Pagar ──────────────────────────────────────────

/**
 * Reporte de Cuentas por Pagar (reports/accountsToPay).
 *
 * Analizado en vivo:
 * - A diferencia del resto del módulo, NO usa una tabla HTML tradicional:
 *   los registros son tarjetas dentro de `#accounts_to_pay_table_body`
 *   (clase `atp-records-list`). Tiene su propio estado vacío real
 *   (`#accounts_to_pay_empty_state`, "No se encontraron cuentas por pagar
 *   para los filtros seleccionados.") y de error (`#accounts_to_pay_error_state`).
 * - Tarjetas KPI reales: "Total por Pagar" (`#accounts_to_pay_kpi_total`),
 *   "Total abonado" (`#accounts_to_pay_kpi_paid`), "Saldo pendiente"
 *   (`#accounts_to_pay_kpi_balance`), más un resumen "Consolidados por
 *   moneda" (`#accounts_to_pay_currency_totals`) y un gráfico real
 *   (`#cashChartContainerCanvas`).
 * - Filtros: buscador (`#credit_provider_invoice_search`), rango de fechas
 *   (`#cash_start_date`/`#cash_end_date`), Proveedor
 *   (`#credit_provider_select`, chosen), Tipo de documento
 *   (`#credit_selected_invoice_type`, chosen: Todas/Compra/Compra
 *   Externa/Gasto), Modo de consulta (`#credit_provider_query_mode`, chosen:
 *   Actual/Saldo al corte), Tipo de fecha (`#credit_provider_date_type`,
 *   chosen: Fecha de creación/Canceladas), 3 chips de estado (Todas/
 *   Pendiente [activo por defecto]/Canceladas) y Moneda (menú compartido).
 * - IMPORTANTE (confirmado en vivo): el botón "Buscar"
 *   (`#btn_credit_provider_search`) queda DESHABILITADO transitoriamente
 *   (~1 segundo) justo después de cambiar cualquier filtro, mientras la
 *   pantalla revalida su estado — se espera activamente a que vuelva a
 *   habilitarse antes de hacer clic (`buscar()` ya lo maneja).
 * - "Excel" (`#btn_download_provider_excel_report`) descarga un archivo
 *   real, sin SweetAlert de confirmación.
 */
export class ReporteCuentasPorPagarPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#credit_provider_invoice_search');
  private readonly fechaInicial = () => this.page.locator('#cash_start_date');
  private readonly fechaFinal = () => this.page.locator('#cash_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_credit_provider_search');
  private readonly filtroProveedor = () => this.page.locator('#credit_provider_select');
  private readonly filtroTipoDocumento = () => this.page.locator('#credit_selected_invoice_type');
  private readonly filtroModoConsulta = () => this.page.locator('#credit_provider_query_mode');
  private readonly filtroTipoFecha = () => this.page.locator('#credit_provider_date_type');
  private readonly chipEstado = (estado: 'all' | 'pending' | 'paid') => this.page.locator(`#accounts_to_pay_${estado}`);
  private readonly btnDescargar = () => this.page.locator('#btn_download_provider_excel_report');
  private readonly listaRegistros = () => this.page.locator('#accounts_to_pay_table_body');
  private readonly estadoVacio = () => this.page.locator('#accounts_to_pay_empty_state');
  private readonly estadoError = () => this.page.locator('#accounts_to_pay_error_state');
  private readonly kpiTotal = () => this.page.locator('#accounts_to_pay_kpi_total');
  private readonly kpiAbonado = () => this.page.locator('#accounts_to_pay_kpi_paid');
  private readonly kpiSaldo = () => this.page.locator('#accounts_to_pay_kpi_balance');
  private readonly chart = () => this.page.locator('#cashChartContainerCanvas');

  async abrirReporteCuentasPorPagar() {
    await this.page.goto(URL_CUENTAS_POR_PAGAR, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await seleccionarFechaCalendario(this.page, this.fechaInicial(), fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await seleccionarFechaCalendario(this.page, this.fechaFinal(), fecha);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  /** Espera a que "Buscar" vuelva a habilitarse (queda deshabilitado ~1s tras cualquier cambio de filtro, confirmado en vivo) y hace clic. */
  private async clicBuscarCuandoHabilitado() {
    await this.page.waitForFunction(
      () => !(document.getElementById('btn_credit_provider_search') as HTMLButtonElement)?.disabled,
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnBuscar().click({ force: true });
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    await this.clicBuscarCuandoHabilitado();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarProveedor(etiqueta: string) {
    await this.filtroProveedor().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarTipoDocumento(etiqueta: string) {
    await this.filtroTipoDocumento().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarModoConsulta(etiqueta: string) {
    await this.filtroModoConsulta().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarTipoFecha(etiqueta: string) {
    await this.filtroTipoFecha().selectOption({ label: etiqueta }, { force: true });
  }

  async seleccionarEstado(estado: 'all' | 'pending' | 'paid') {
    await this.chipEstado(estado).click();
    await this.clicBuscarCuandoHabilitado().catch(() => {});
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMoneda(this.page, etiqueta);
  }

  async limpiarFiltros() {
    await this.seleccionarProveedor('Todas');
    await this.seleccionarTipoDocumento('Todas');
    await this.seleccionarMoneda('Todas');
    await this.buscar('');
  }

  async contarFilas(): Promise<number> {
    return this.listaRegistros().locator('> *').count();
  }

  async obtenerKPIs(): Promise<{ total: number; abonado: number; saldo: number }> {
    return {
      total: montoANumero((await this.kpiTotal().textContent()) ?? ''),
      abonado: montoANumero((await this.kpiAbonado().textContent()) ?? ''),
      saldo: montoANumero((await this.kpiSaldo().textContent()) ?? ''),
    };
  }

  async graficoVisible(): Promise<boolean> {
    try {
      await this.chart().waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA });
      return true;
    } catch {
      return false;
    }
  }

  /** Descarga real (a diferencia del resto del módulo, aquí SÍ se confirma que aparece un SweetAlert de éxito). */
  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    return descargaPromise;
  }

  /**
   * A diferencia del resto del módulo, la "tabla" de este reporte es un
   * `<div class="atp-records-list">` sin filas cuando no hay datos — un
   * contenedor vacío colapsa a 0px de alto y Playwright lo reporta como
   * "hidden" aunque no tenga `display:none` (confirmado en vivo). Por eso
   * se valida la grilla de tarjetas KPI (siempre presente, con o sin datos)
   * como señal real de que el reporte cargó correctamente.
   */
  async validarTabla() {
    await expect(this.kpiTotal()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarMensajeSinResultados() {
    await expect(
      this.estadoVacio(),
      'No apareció el mensaje "No se encontraron cuentas por pagar para los filtros seleccionados."'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async estadoErrorVisible(): Promise<boolean> {
    return this.estadoError().isVisible();
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
    expect(await this.estadoErrorVisible()).toBe(false);
  }
}

// ─── Reporte de Antigüedad de Crédito ──────────────────────────────────────

/**
 * Reporte de Antigüedad de Crédito (reports/get_purchase_aging_report_by_provider_data).
 *
 * Analizado en vivo:
 * - Filtros: buscador (`#seniority_search`), rango de fechas
 *   (`#seniority_start_date`/`#seniority_end_date`) y Moneda (menú
 *   compartido, con más monedas reales que el resto del módulo: VEF/CRC/
 *   SVC/MKD/STD/USD/EUR).
 * - Tabla real (`#purchase_aging_table_body`, con fila de totales
 *   `#purchase_aging_table_totals`): columnas Acciones/Proveedor/Contacto/
 *   Moneda/Saldo pendiente/Sin vencer/Vencido 1-30/31-60/61-90/>90 —
 *   agrupa la deuda pendiente por antigüedad.
 * - "Buscar" (`#btn_search_seniority`) dispara AJAX real
 *   `getPurchaseAgingProviderSummaryView` (mismo endpoint que la carga
 *   inicial).
 * - Exportación: único botón directo "Descargar Excel"
 *   (`#btn_export_seniority`), descarga real, CON SweetAlert de
 *   confirmación (a diferencia del resto del módulo).
 * - Este ambiente de QA no tiene ningún proveedor con saldo pendiente
 *   (confirmado en vivo incluso con rango amplio 2023-hoy) — los tests
 *   validan filtros/exportación sin asumir datos reales.
 */
export class ReporteAntiguedadCreditoPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#seniority_search');
  private readonly fechaInicial = () => this.page.locator('#seniority_start_date');
  private readonly fechaFinal = () => this.page.locator('#seniority_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_seniority');
  private readonly btnDescargar = () => this.page.locator('#btn_export_seniority');
  private readonly tbody = () => this.page.locator('#purchase_aging_table_body');
  private readonly tfoot = () => this.page.locator('#purchase_aging_table_totals');

  static readonly COLUMNA_PROVEEDOR = 1;
  static readonly COLUMNA_SALDO_PENDIENTE = 4;

  async abrirReporteAntiguedadCredito() {
    await this.page.goto(URL_ANTIGUEDAD_CREDITO, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  async seleccionarFechaInicial(fecha: string) {
    await seleccionarFechaCalendario(this.page, this.fechaInicial(), fecha);
  }

  async seleccionarFechaFinal(fecha: string) {
    await seleccionarFechaCalendario(this.page, this.fechaFinal(), fecha);
  }

  async obtenerFechaInicial(): Promise<string> {
    return this.fechaInicial().inputValue();
  }

  async obtenerFechaFinal(): Promise<string> {
    return this.fechaFinal().inputValue();
  }

  async aumentarRangoFechas(fechaInicial: string, fechaFinal: string) {
    await this.seleccionarFechaInicial(fechaInicial);
    await this.seleccionarFechaFinal(fechaFinal);
  }

  async buscar(termino = '') {
    await this.buscador().fill(termino);
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getPurchaseAgingProviderSummaryView'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnBuscar().click();
    await respuestaPromise;
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarMoneda(etiqueta: string) {
    await seleccionarMoneda(this.page, etiqueta);
  }

  async limpiarFiltros() {
    await this.seleccionarMoneda('Todas');
    await this.buscar('');
  }

  /** Un `tbody` vacío (sin filas) colapsa a 0px de alto y Playwright lo reporta como "hidden" aunque no tenga `display:none` (confirmado en vivo) — se valida la `<table>` completa (encabezados incluidos), que permanece visible con o sin datos. */
  tabla(): Locator {
    return this.tbody().locator('xpath=ancestor::table[1]');
  }

  filas(): Locator {
    return this.tbody().locator('tr');
  }

  async contarFilas(): Promise<number> {
    return this.filas().count();
  }

  private async celdaDeFila(indice: number, columna: number): Promise<string> {
    return (await this.filas().nth(indice).locator('td').nth(columna).innerText()).trim();
  }

  async obtenerProveedorDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteAntiguedadCreditoPage.COLUMNA_PROVEEDOR);
  }

  async obtenerSaldoPendienteNumericoDeFila(indice: number): Promise<number> {
    return montoANumero(await this.celdaDeFila(indice, ReporteAntiguedadCreditoPage.COLUMNA_SALDO_PENDIENTE));
  }

  async contarFilasTotales(): Promise<number> {
    return this.tfoot().locator('tr').count();
  }

  /** Descarga real y cierra el SweetAlert de confirmación (a diferencia del resto del módulo, aquí SÍ aparece). */
  async descargarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnDescargar().click();
    const descarga = await descargaPromise;
    const confirmacion = this.page.locator('.sweet-alert.visible, .swal2-popup');
    if (await confirmacion.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmacion.first().locator('button.confirm, .swal2-confirm').first().click().catch(() => {});
    }
    return descarga;
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}
