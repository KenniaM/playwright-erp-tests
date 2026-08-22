import { Download, expect, Locator, Page, Response } from '@playwright/test';
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
    // Componente rediseñado por completo ("casv2", ver ReporteEstadoCuentaPage
    // más abajo) — ya no tiene ningún `.content-header` con este texto.
    // `#casv2_general_summary` (las 3 tarjetas KPI) es el contenedor real que
    // confirma que la pantalla propia del submódulo cargó.
    obtenerLocatorDeCarga: (page) => page.locator('#casv2_general_summary'),
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
    // Hallazgo previo (documentado en varias sesiones anteriores, confirmado
    // 3 veces): esta URL redirigía a `/help/unauthorized` ("NO AUTORIZADO")
    // para la cuenta de pruebas pese a que el Sidebar la ofrece — ya NO
    // reproduce (confirmado en vivo: la pantalla real "Reporte de Redes
    // Sociales" carga completa, con tabla/filtros/exportar) — el permiso fue
    // restaurado en el ambiente en algún punto entre sesiones. Se reincorpora
    // al patrón de navegación estándar; cobertura funcional completa en el
    // describe "Reporte de Redes Sociales" más abajo (`ReporteRedesSocialesPage`).
    nombre: 'Redes Sociales',
    url: BASE_URL + '/reports/customerBySocialNetworks',
    rutaEsperada: 'customerBySocialNetworks',
    // Título real confirmado en vivo: "Reporte de ventas por cliente" — el
    // `<title>` del documento no coincide con el nombre visible en el
    // Sidebar/encabezado ("Reporte de Redes Sociales"), confirmado 12/12
    // veces (no es una carrera de carga).
    tituloEsperado: /reporte de ventas por cliente/i,
    obtenerLocatorDeCarga: (page) => page.locator('table.mdl-data-table:visible').first(),
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
 * HALLAZGO MAYOR investigado en vivo (2026-08-20, ambiente qa_restaurant,
 * compañía "Restaurante Rancho Robertos"): esta pantalla fue REDISEÑADA POR
 * COMPLETO por la propia aplicación desde la última vez que se documentó
 * aquí — componente nuevo, prefijo real "casv2" ("Customer Accounting
 * Statement v2"), montado en `#customer_accounting_statement_v2_app`. Todos
 * los ids/clases de la versión anterior (`#accounting_statement_customer_select`,
 * `#btn_search_accounting_statement`, `#table_content`,
 * `#btn_send_massive_email`, `.product_dropdown_options`,
 * `#modal_view_accounting_content`) YA NO EXISTEN. Mismo patrón de
 * redescubrimiento que ya documentó el proyecto para Cuentas por Cobrar
 * ("acr-v2", ver `cuentas-por-cobrar.page.ts`) — es razonable asumir que es
 * un cambio de versión de la aplicación (no específico de esta compañía),
 * pero solo se confirmó en vivo contra qa_restaurant en esta sesión; si se
 * retoma trabajo contra el ambiente original (qa_talleralpha) sin haberlo
 * verificado ahí todavía, revalidar esta clase contra ese ambiente antes de
 * asumir que aplica sin cambios.
 *
 * UI real confirmada en vivo:
 * - Filtros (`.casv2-filters`): "Empresa" (`#casv2_company`, Chosen — una
 *   sola opción cuando la cuenta tiene una compañía), "Cliente"
 *   (`#casv2_customer`, Chosen — solo trae "Todos los clientes" hasta que se
 *   busca/escribe, no lista todos los clientes de antemano), "Moneda"
 *   (`#casv2_currency`, Chosen — "Todas las monedas" + cada moneda con
 *   código real, ej. "₡ - CRC"), "Buscar" (`#casv2_search`, texto libre por
 *   nombre o código de cliente). Se aplican con el botón "Buscar"
 *   (`#casv2_apply_filters`); "Limpiar filtros" (`#casv2_clear_filters`)
 *   restaura cliente/búsqueda/moneda (no la empresa).
 * - Acciones de encabezado: "Envío masivo" (`#casv2_send_all`, correo real a
 *   todos los clientes — mismo criterio que el resto del repo, no se
 *   ejecuta, solo se confirma existencia/habilitado) y "Exportar Excel"
 *   (`#casv2_export_excel`, sí se ejecuta — descarga real).
 * - 3 tarjetas KPI (`#casv2_general_summary`, `article.casv2-general-summary-card`):
 *   "Clientes con créditos", "Clientes con créditos vencidos", "Clientes por
 *   vencer (30 días)" — cada una cuenta CLIENTES únicos, no facturas.
 * - Tabla (`.casv2-table`, dentro de `#casv2_table_region`/`#casv2_table_scroll`,
 *   con scroll — confirmado en el propio tooltip de ayuda del reporte que es
 *   de carga incremental, igual que el Reporte de Cuentas por Cobrar de
 *   Ventas): 8 columnas reales, cada `<td>` con `data-label` propio que
 *   coincide con el título de su columna (fuente confiable para parsear sin
 *   depender del índice): "Cliente y contacto", "Empresa y moneda", "Estado
 *   y vencimientos", "Documentos", "Crédito", "Facturado y pagado",
 *   "Saldos", "Acciones". La columna "Saldos" es la que se corresponde 1:1
 *   con "Facturado y pagado": Facturado − Pagado = Saldo total (= Vencido +
 *   Por vencer).
 * - `.casv2-loaded-count` ("N registros cargados") es el contador real de
 *   filas cargadas (crece con el scroll incremental).
 * - Totales por moneda al pie (`#casv2_currency_totals`,
 *   `article.casv2-currency-total-card` — uno por moneda con datos, código
 *   real en `.casv2-currency-total-code`): Facturado/Pagado/Vencido/Por
 *   vencer/Saldo total — la propia ayuda del reporte documenta la fórmula
 *   real ("Saldo total = Vencido + Por vencer").
 * - Menú de acciones por fila: botón `button.casv2-action-trigger` (uno por
 *   fila, sin id propio — se localiza por índice) abre un popover real
 *   (`.popover.casv2-action-popover .casv2-action-list`, NO un
 *   `.dropdown-menu` — confirmado en vivo que Bootstrap lo monta como
 *   popover) con 5 acciones reales: "Estado de cuenta" (detalle en modal),
 *   "Imprimir", "Descargar PDF" (única con efecto verificable sin side
 *   effects reales — se ejecuta), "Correo" y "Enviar por WhatsApp" (ambas
 *   con efectos secundarios reales, no se ejecutan, mismo criterio que
 *   "Envío masivo").
 * - Ordenamiento/paginación tradicional: no existen (scroll incremental).
 */
export class ReporteEstadoCuentaPage {
  constructor(private readonly page: Page) {}

  private readonly selectCliente = () => this.page.locator('#casv2_customer');
  private readonly selectMoneda = () => this.page.locator('#casv2_currency');
  private readonly campoBuscar = () => this.page.locator('#casv2_search');
  private readonly btnBuscar = () => this.page.locator('#casv2_apply_filters');
  private readonly btnLimpiarFiltros = () => this.page.locator('#casv2_clear_filters');
  private readonly btnEnviarATodos = () => this.page.locator('#casv2_send_all');
  private readonly btnExportarExcel = () => this.page.locator('#casv2_export_excel');
  private readonly contenedorTabla = () => this.page.locator('#casv2_table_region');
  private readonly resumenGeneral = () => this.page.locator('#casv2_general_summary');
  private readonly totalesPorMoneda = () => this.page.locator('#casv2_currency_totals');

  /** Convierte un monto con formato real de la app (`₡11.065,00`, punto de millar + coma decimal) a `number`. */
  private static leerMonto(texto: string | null): number {
    const limpio = (texto ?? '').replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const valor = parseFloat(limpio);
    return Number.isNaN(valor) ? 0 : valor;
  }

  async abrir() {
    await this.page.goto(URL_ESTADO_CUENTA, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
    await this._esperarTablaCargada();
  }

  /**
   * Espera a que la tabla termine de (re)cargar vía AJAX — mismo criterio ya
   * confirmado en `CuentasPorCobrarPage._esperarListadoClientesCargado()`
   * para el componente hermano "acr-v2": el contenedor puede pasar por un
   * estado transitorio antes de poblarse, y `waitForLoadState('networkidle')`
   * no es una señal confiable en este layout con scroll incremental.
   *
   * CORRECCIÓN DE AUTOMATIZACIÓN confirmada en vivo (2/2 corridas idénticas,
   * siempre justo después de crear una factura a crédito nueva y aplicar un
   * abono): tras "Buscar"/"Limpiar filtros", el reporte muestra un overlay
   * real "Cargando saldos" / "Cargando indicadores..." ANTES de poblar la
   * tabla — leer `contarFilas()`/`leerFilaFinanciera()` en ese instante
   * devuelve 0 filas (o datos del resultado ANTERIOR), no un error silencioso
   * sino una carrera real. Se espera la condición real: ese encabezado de
   * carga desaparece.
   */
  private async _esperarTablaCargada() {
    await expect(this.contenedorTabla(), 'El Reporte de Estado de Cuenta no terminó de cargar').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await this.page.getByText('Cargando saldos', { exact: false }).first().waitFor({ state: 'hidden', timeout: TIMEOUTS.CARGA }).catch(() => {});
    await this.page.getByText('Cargando indicadores', { exact: false }).first().waitFor({ state: 'hidden', timeout: TIMEOUTS.CARGA }).catch(() => {});
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  /** Busca dentro del filtro "Cliente" (Chosen con autocompletado AJAX) y selecciona la primera coincidencia real. */
  async seleccionarClientePorBusqueda(termino: string) {
    const contenedor = this.selectCliente().locator('xpath=following-sibling::div[contains(@class,"chosen-container")][1]');
    await contenedor.locator('.chosen-single').click();
    await contenedor.locator('.chosen-search input').fill(termino);
    await expect(contenedor.locator('.chosen-results li').first()).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await contenedor.locator('.chosen-results li').first().click();
  }

  /** Restaura el filtro "Cliente" a "Todos los clientes". */
  async seleccionarTodosLosClientes() {
    const contenedor = this.selectCliente().locator('xpath=following-sibling::div[contains(@class,"chosen-container")][1]');
    await contenedor.locator('.chosen-single').click();
    await contenedor.locator('.chosen-results li', { hasText: 'Todos los clientes' }).first().click();
  }

  /** Selecciona una moneda por su texto visible (ej. "₡ - CRC" o "Todas las monedas") — widget Chosen. */
  async seleccionarMoneda(texto: string | RegExp) {
    const contenedor = this.selectMoneda().locator('xpath=following-sibling::div[contains(@class,"chosen-container")][1]');
    await contenedor.locator('.chosen-single').click();
    await contenedor.locator('.chosen-results li', { hasText: texto }).first().click();
  }

  /** Etiquetas reales de moneda disponibles en el filtro (incluye "Todas las monedas"). */
  async obtenerOpcionesDeMoneda(): Promise<string[]> {
    return (await this.selectMoneda().locator('option').allTextContents()).map((e) => e.trim());
  }

  async buscarPorTexto(termino: string) {
    await this.campoBuscar().fill(termino);
    await this.buscar();
  }

  async buscar() {
    await this.btnBuscar().click();
    await this._esperarTablaCargada();
  }

  async limpiarFiltros() {
    await this.btnLimpiarFiltros().click();
    await this._esperarTablaCargada();
  }

  botonEnviarATodos(): Locator {
    return this.btnEnviarATodos();
  }

  async exportarExcel(): Promise<Download> {
    const descarga = this.page.waitForEvent('download', { timeout: TIMEOUTS.NAVIGATE });
    await this.btnExportarExcel().click();
    return descarga;
  }

  tabla(): Locator {
    return this.contenedorTabla().locator('table.casv2-table');
  }

  filas(): Locator {
    return this.tabla().locator('tbody tr');
  }

  async contarFilas(): Promise<number> {
    return this.filas().count();
  }

  /** Texto del contador real de filas cargadas (`"N registros cargados"`, scroll incremental). */
  async obtenerRegistrosCargadosTexto(): Promise<string> {
    return this.page.locator('.casv2-loaded-count').innerText();
  }

  /** Texto de la columna "Cliente y contacto" (solo el nombre) de la fila indicada (0-based). */
  async obtenerClienteDeFila(indice: number): Promise<string> {
    const texto = await this.filas().nth(indice).locator('td[data-label="Cliente y contacto"] strong').first().innerText();
    return texto.trim();
  }

  /** Lee las 3 tarjetas KPI del resumen general ("Clientes con créditos"/"...vencidos"/"...por vencer"). */
  async leerResumenGeneral(): Promise<ResumenGeneralEstadoCuenta> {
    const leer = async (variante: string) => {
      const valor = await this.resumenGeneral()
        .locator(`article.casv2-general-summary-card--${variante} strong`)
        .innerText()
        .catch(() => '0');
      return parseInt(valor.replace(/[^0-9-]/g, ''), 10) || 0;
    };
    return {
      clientesConCreditos: await leer('credit'),
      clientesConCreditosVencidos: await leer('overdue'),
      clientesPorVencer: await leer('upcoming'),
    };
  }

  /**
   * Lee todas las tarjetas de totales por moneda al pie del reporte
   * (`#casv2_currency_totals`) — una por moneda con datos en el resultado
   * actual, cada una con su propio código real (ej. "CRC", "USD").
   */
  async leerTotalesPorMoneda(): Promise<TotalesMonedaEstadoCuenta[]> {
    const tarjetas = this.totalesPorMoneda().locator('article.casv2-currency-total-card');
    const total = await tarjetas.count();
    const resultado: TotalesMonedaEstadoCuenta[] = [];
    for (let i = 0; i < total; i++) {
      const tarjeta = tarjetas.nth(i);
      const codigo = (await tarjeta.locator('.casv2-currency-total-code').innerText()).trim();
      const spans = tarjeta.locator('> span');
      const totalSpans = await spans.count();
      const valores: number[] = [];
      for (let j = 0; j < totalSpans; j++) {
        valores.push(ReporteEstadoCuentaPage.leerMonto(await spans.nth(j).locator('b').innerText()));
      }
      // Orden real confirmado en vivo: Facturado, Pagado, Vencido, Por vencer, Saldo total.
      resultado.push({
        moneda: codigo,
        facturado: valores[0] ?? 0,
        pagado: valores[1] ?? 0,
        vencido: valores[2] ?? 0,
        porVencer: valores[3] ?? 0,
        saldoTotal: valores[4] ?? 0,
      });
    }
    return resultado;
  }

  /**
   * Lee los datos financieros completos (Facturado/Pagado/Pendiente,
   * Vencido/Por vencer/Saldo total) de la fila indicada (0-based), parseados
   * por su `data-label` real — no por índice de columna, más robusto ante
   * reordenamientos futuros de la tabla.
   */
  async leerFilaFinanciera(indice: number): Promise<FilaEstadoCuenta> {
    const fila = this.filas().nth(indice);
    const cliente = await this.obtenerClienteDeFila(indice);

    // CORRECCIÓN DE AUTOMATIZACIÓN confirmada en vivo: esta celda real tiene
    // 3 `<small>` — el PRIMERO es la ETIQUETA "Facturado" (sin ningún dígito,
    // acompaña al `<strong>` de al lado), el SEGUNDO es el valor real
    // ("Pagado: ₡X"). `.first()` leía la etiqueta (0 dígitos → `leerMonto`
    // devolvía 0 siempre), produciendo `Facturado − Pagado` == `Facturado`
    // en vez de `Saldo total` — confirmado en vivo comparando contra el
    // saldo real de Cuentas por Cobrar (la mitad exacta del valor obtenido
    // con el bug).
    const celdaFacturado = fila.locator('td[data-label="Facturado y pagado"] .casv2-money-stack');
    const facturado = ReporteEstadoCuentaPage.leerMonto(await celdaFacturado.locator('strong').innerText());
    const textoPagado = await celdaFacturado.locator('small').nth(1).innerText();
    const pagado = ReporteEstadoCuentaPage.leerMonto(textoPagado);

    const celdaSaldos = fila.locator('td[data-label="Saldos"] .casv2-money-stack');
    const vencido = ReporteEstadoCuentaPage.leerMonto(await celdaSaldos.locator('.casv2-overdue').innerText());
    const porVencer = ReporteEstadoCuentaPage.leerMonto(await celdaSaldos.locator('small').nth(1).innerText());
    const saldoTotal = ReporteEstadoCuentaPage.leerMonto(await celdaSaldos.locator('strong').innerText());

    const documentosTexto = await fila.locator('td[data-label="Documentos"] strong').innerText();
    const vencidosTexto = await fila.locator('td[data-label="Documentos"] small.casv2-overdue').innerText();

    return {
      cliente,
      facturado,
      pagado,
      vencido,
      porVencer,
      saldoTotal,
      documentosPendientes: parseInt(documentosTexto, 10) || 0,
      documentosVencidos: parseInt(vencidosTexto, 10) || 0,
    };
  }

  private popoverAcciones(): Locator {
    return this.page.locator('.popover.casv2-action-popover');
  }

  /**
   * Abre el popover de acciones de la fila indicada (0-based) — botón
   * `button.casv2-action-trigger` propio por fila, sin id individual (se
   * localiza por índice dentro de la tabla ya renderizada).
   */
  async abrirMenuAccionesFila(indice: number) {
    await this.filas().nth(indice).locator('button.casv2-action-trigger').click();
    await expect(this.popoverAcciones(), 'El popover de acciones de la fila no apareció').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Con el menú de acciones de una fila ya abierto, hace clic en "Estado de cuenta" (ver detalle). */
  async verDetalleDesdeMenu() {
    await this.popoverAcciones().locator('button.casv2-action-item', { hasText: 'Estado de cuenta' }).click();
  }

  /**
   * Con el menú de acciones de una fila ya abierto, hace clic en "Descargar
   * PDF" y devuelve la respuesta HTTP real del PDF.
   *
   * CORRECCIÓN DE AUTOMATIZACIÓN confirmada en vivo: a diferencia del resto
   * de exportaciones de este reporte, "Descargar PDF" NO dispara un evento
   * `download` real — abre una pestaña nueva que navega directo a
   * `reports/downloadCustomerAccountingStatementPdf?...` y Firefox renderiza
   * el PDF con su visor interno en vez de descargarlo (sin
   * `Content-Disposition: attachment`), confirmado en vivo esperando
   * `page.waitForEvent('download')` sin resultado en 60s pese a que la
   * pestaña sí navegó correctamente. La señal real de éxito es la propia
   * respuesta HTTP de esa pestaña nueva (200 + `content-type: application/pdf`).
   */
  async descargarPdfDesdeMenu(): Promise<Response> {
    // Las 3 promesas se arman ANTES del click y se resuelven en paralelo:
    // confirmado en vivo que la pestaña nueva navega al PDF de inmediato
    // (window.open ya con la URL final, sin una navegación posterior
    // separada) — esperar la respuesta DESPUÉS de obtener el `popup` llega
    // tarde casi siempre, la respuesta ya ocurrió.
    const [popup, respuesta] = await Promise.all([
      this.page.context().waitForEvent('page', { timeout: TIMEOUTS.NAVIGATE }),
      this.page.context().waitForEvent('response', (r) => r.url().includes('downloadCustomerAccountingStatementPdf'), { timeout: TIMEOUTS.NAVIGATE }),
      this.popoverAcciones().locator('button.casv2-action-item', { hasText: 'Descargar PDF' }).click(),
    ]);
    await popup.close();
    return respuesta;
  }

  /** Etiquetas reales de las 5 acciones del popover de una fila (para validar que todas existen). */
  async obtenerAccionesDelMenu(): Promise<string[]> {
    return this.popoverAcciones().locator('button.casv2-action-item').allTextContents();
  }

  modalDetalle(): Locator {
    // El propio popover de ayuda del reporte confirma que "Estado de cuenta"
    // abre un modal de detalle — localizado por su encabezado real
    // ("Detalle del estado de cuenta"), sin id propio identificado aún.
    return this.page.locator('.modal', { hasText: 'Detalle del estado de cuenta' });
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

export type ResumenGeneralEstadoCuenta = {
  clientesConCreditos: number;
  clientesConCreditosVencidos: number;
  clientesPorVencer: number;
};

export type TotalesMonedaEstadoCuenta = {
  moneda: string;
  facturado: number;
  pagado: number;
  vencido: number;
  porVencer: number;
  saldoTotal: number;
};

export type FilaEstadoCuenta = {
  cliente: string;
  facturado: number;
  pagado: number;
  vencido: number;
  porVencer: number;
  saldoTotal: number;
  documentosPendientes: number;
  documentosVencidos: number;
};

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
