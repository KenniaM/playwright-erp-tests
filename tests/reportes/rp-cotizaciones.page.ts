import { Download, expect, Locator, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';
import { contentHeaderConTexto, SubmoduloReportes, TIMEOUTS } from './reportes.page';

export const SUBMODULOS_REPORTES_COTIZACIONES: SubmoduloReportes[] = [
  {
    nombre: 'Cotizaciones',
    url: BASE_URL + '/reports/seeProformaReport',
    rutaEsperada: 'seeProformaReport',
    tituloEsperado: /reporte de proformas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de proformas/i),
  },
  {
    nombre: 'Comisiones por meta',
    url: BASE_URL + '/reports/seeCommissionGoalReport',
    rutaEsperada: 'seeCommissionGoalReport',
    tituloEsperado: /comisiones/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /comisiones por metas/i),
  },
  {
    nombre: 'Análisis de Cotizaciones',
    url: BASE_URL + '/reports/proformAnalysis',
    rutaEsperada: 'proformAnalysis',
    tituloEsperado: /an[aá]lisis de cotizaciones/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /an[aá]lisis de cotizaciones/i),
  },
  {
    nombre: 'Productos mas cotizados',
    url: BASE_URL + '/reports/productsMostQuoted',
    rutaEsperada: 'productsMostQuoted',
    tituloEsperado: /productos m[aá]s cotizados/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /productos m[aá]s cotizados/i),
  },
];

const URL_COTIZACIONES = SUBMODULOS_REPORTES_COTIZACIONES[0].url;
const URL_COMISIONES_META = SUBMODULOS_REPORTES_COTIZACIONES[1].url;
const URL_ANALISIS_COTIZACIONES = SUBMODULOS_REPORTES_COTIZACIONES[2].url;
const URL_PRODUCTOS_MAS_COTIZADOS = SUBMODULOS_REPORTES_COTIZACIONES[3].url;

// ─── Utilidades de fecha ────────────────────────────────────────────────────
// Mismo criterio que rp-clientes.page.ts/rp-gastos-operativos.page.ts: cada
// archivo de reporte define sus propias utilidades de fecha en vez de
// compartirlas desde reportes.page.ts (convención ya establecida).

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

// ─── Utilidades compartidas entre los 4 reportes ───────────────────────────

/** Convierte un monto mostrado en pantalla (p.ej. "₡26,609,270,415.08", "$0.00 USD") a number. */
function montoANumero(texto: string): number {
  return parseFloat(texto.replace(/[^\d.-]/g, ''));
}

/** No hay ningún mensaje de error de aplicación (`.noty_bar`) visible en pantalla. */
async function validarSinErrores(page: Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

/**
 * El layout general del ERP puede mostrar un banner de "Activar
 * notificaciones" al cargar la página, que intercepta clics sobre controles
 * reales si queda visible (confirmado en vivo, mismo tratamiento que el
 * resto de la suite de Reportes).
 */
async function cerrarBannerNotificaciones(page: Page) {
  await page.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 3000 }).catch(() => {});
}

/**
 * Los campos `<input type="date">` de estos reportes tienen además un
 * datepicker de terceros enganchado por JS. Al llenarlos con `.fill()` el
 * datepicker se abre y, si el campo queda enfocado, su overlay intercepta
 * clics posteriores sobre otros controles reales (confirmado en vivo —
 * bloqueó el botón "Buscar" hasta hacer timeout). Mismo tratamiento que
 * `rp-clientes.page.ts`: se fuerza Escape + `blur()` tras llenar el campo.
 */
async function seleccionarFecha(page: Page, input: Locator, fecha: string) {
  await input.fill(fecha);
  await page.keyboard.press('Escape');
  await input.evaluate((el) => (el as HTMLElement).blur());
}

/**
 * Cierra el SweetAlert v1 real de confirmación de exportación ("¡Listo! El
 * Excel se generó correctamente", botón "OK") que muestran tanto Cotizaciones
 * como Análisis de Cotizaciones tras cada descarga real (confirmado en vivo).
 * El botón real de confirmación tiene la clase `.confirm` — `button:first()`
 * resolvía al botón "Cancel", que aparece antes en el DOM aunque no sea el
 * primero visualmente (confirmado en vivo).
 */
async function cerrarConfirmacionExportacion(page: Page) {
  const confirmacion = page.locator('.sweet-alert.visible', { hasText: 'generó correctamente' });
  await expect(confirmacion, 'No apareció la confirmación "El Excel se generó correctamente"').toBeVisible({ timeout: TIMEOUTS.CARGA });
  await confirmacion.locator('button.confirm').click();
  await expect(confirmacion).toBeHidden({ timeout: TIMEOUTS.CARGA });
}

// ─── Reporte de Cotizaciones (Proformas) ───────────────────────────────────

/**
 * Reporte de Cotizaciones (reports/seeProformaReport) — título real "Reporte
 * de Proformas".
 *
 * Analizado en vivo (scripts de investigación descartados tras extraer la
 * evidencia, no forman parte de esta suite):
 *
 * - Filtros: buscador de texto libre (`#proform_search`), rango de fechas
 *   (`#proform_start_date`/`#proform_end_date`, por defecto hoy-15 días a
 *   hoy) y 4 chips de estado mutuamente excluyentes (`#proform_state_all`
 *   "Todos", `#proform_state_cash` "Facturados", `#proform_state_pending`
 *   "Pendientes", `#proform_state_deleted` "Anuladas", clase `active` real
 *   en el chip vigente). Todos se aplican al presionar "Buscar"
 *   (`#btn_search_receip`, dispara POST real `getPosProformSearch`). La
 *   pantalla carga sus primeros registros automáticamente al abrir, sin
 *   necesidad de presionar "Buscar".
 * - Tabla (`#table_proform`, dentro de `#proforma_table_container`): sin
 *   ordenamiento (encabezados sin `onclick`) y SIN paginación tradicional —
 *   en su lugar usa scroll infinito real (confirmado en vivo: hacer scroll
 *   hasta el fondo del contenedor carga más filas via AJAX, mensaje propio
 *   "Scroll infinito activo. Se cargan más proformas al llegar al 80%...").
 *   No tiene columna de Acciones (no hay menú por fila).
 * - Totales: el propio `<tfoot id="table_proform_totals">` trae 2 filas
 *   reales con el total agrupado por moneda ("Total CRC"/"Total USD").
 * - Exportación: dropdown "Descargar" (`#btn_export_proform`) con 2 opciones
 *   reales (`li.btn_export_proform[data-type]`): "Exportar proformas"
 *   (`data-type="0"`) y "Exportar proformas con productos" (`data-type="1"`)
 *   — ambas descargan un `.xlsx` real y, al completar, muestran un
 *   SweetAlert v1 "¡Listo! El Excel se generó correctamente" (hay que
 *   cerrarlo con "OK" o queda un overlay bloqueando el resto de la
 *   pantalla, confirmado en vivo). No existe ninguna opción de PDF.
 * - Sin resultados: mensaje real en `#proforma_empty_state` ("No se
 *   encontraron proformas para los filtros seleccionados...").
 */
export class ReporteCotizacionesPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#proform_search');
  private readonly fechaInicial = () => this.page.locator('#proform_start_date');
  private readonly fechaFinal = () => this.page.locator('#proform_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_receip');
  private readonly chipEstado = (estado: 'all' | 'cash' | 'pending' | 'deleted') => this.page.locator(`#proform_state_${estado}`);
  private readonly btnDescargarToggle = () => this.page.locator('#btn_export_proform');
  private readonly opcionExportar = (tipo: '0' | '1') => this.page.locator(`li.btn_export_proform[data-type="${tipo}"]`);
  private readonly contenedorTabla = () => this.page.locator('#proforma_table_container');
  private readonly tbody = () => this.page.locator('#table_proform');
  private readonly tfoot = () => this.page.locator('#table_proform_totals');
  private readonly emptyState = () => this.page.locator('#proforma_empty_state');

  /** Columnas (0-based) de cada fila — confirmadas en vivo. */
  static readonly COLUMNA_NUMERO = 0;
  static readonly COLUMNA_CLIENTE = 1;
  static readonly COLUMNA_FECHA = 3;
  static readonly COLUMNA_TOTAL = 11;

  async abrirReporteCotizaciones() {
    await this.page.goto(URL_COTIZACIONES, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  /** Llena el buscador (si se indica término) y ejecuta "Buscar", esperando la respuesta real del listado. */
  async buscar(termino = '') {
    await this.buscador().fill(termino);
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getPosProformSearch'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnBuscar().click();
    await respuestaPromise;
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  /** Selecciona uno de los 4 chips de estado (mutuamente excluyentes) y espera la respuesta real del listado. */
  async seleccionarEstado(estado: 'all' | 'cash' | 'pending' | 'deleted') {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getPosProformSearch'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.chipEstado(estado).click();
    await respuestaPromise;
  }

  /** Restaura fechas/estado/buscador a sus valores por defecto y vuelve a buscar. */
  async limpiarFiltros() {
    await this.aumentarRangoFechas(hoyMenosDiasISO(15), hoyISO());
    await this.seleccionarEstado('all');
    await this.buscar('');
  }

  tabla(): Locator {
    return this.contenedorTabla();
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

  async obtenerNumeroDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteCotizacionesPage.COLUMNA_NUMERO);
  }

  async obtenerClienteDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteCotizacionesPage.COLUMNA_CLIENTE);
  }

  async obtenerFechaDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteCotizacionesPage.COLUMNA_FECHA);
  }

  async obtenerTotalNumericoDeFila(indice: number): Promise<number> {
    return montoANumero(await this.celdaDeFila(indice, ReporteCotizacionesPage.COLUMNA_TOTAL));
  }

  /** Totales reales del pie de tabla, agrupados por moneda ("Total CRC"/"Total USD"). */
  async obtenerTotalesPorMoneda(): Promise<{ etiqueta: string; total: number }[]> {
    const filasFooter = await this.tfoot().locator('tr').all();
    const resultado: { etiqueta: string; total: number }[] = [];
    for (const fila of filasFooter) {
      const etiqueta = (await fila.locator('.pfm-footer-label').innerText()).trim();
      const total = montoANumero(await fila.locator('.pfm-footer-num').last().innerText());
      resultado.push({ etiqueta, total });
    }
    return resultado;
  }

  /**
   * Hace scroll hasta el fondo del contenedor de la tabla para disparar el
   * scroll infinito real (confirmado en vivo) y espera a que se agreguen más
   * filas de las que había antes. No hace nada (ni falla) si ya se cargaron
   * todos los registros disponibles.
   */
  async cargarMasConScrollInfinito(): Promise<void> {
    const filasAntes = await this.contarFilas();
    await this.contenedorTabla().evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect
      .poll(() => this.contarFilas(), { timeout: TIMEOUTS.CARGA })
      .toBeGreaterThanOrEqual(filasAntes);
  }

  /** Abre "Exportar proformas" (sin productos) y devuelve el archivo descargado, cerrando la confirmación real. */
  async descargarProformas(): Promise<Download> {
    await this.btnDescargarToggle().click();
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.opcionExportar('0').click();
    const descarga = await descargaPromise;
    await cerrarConfirmacionExportacion(this.page);
    return descarga;
  }

  /** Abre "Exportar proformas con productos" y devuelve el archivo descargado, cerrando la confirmación real. */
  async descargarProformasConProductos(): Promise<Download> {
    await this.btnDescargarToggle().click();
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.opcionExportar('1').click();
    const descarga = await descargaPromise;
    await cerrarConfirmacionExportacion(this.page);
    return descarga;
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarMensajeSinResultados() {
    await expect(
      this.emptyState(),
      'No apareció el mensaje "No se encontraron proformas para los filtros seleccionados."'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Comisiones por Meta ────────────────────────────────────────

/**
 * Reporte de Comisiones por Meta (reports/seeCommissionGoalReport) —
 * título real "Comisiones".
 *
 * Analizado en vivo (scripts de investigación descartados tras extraer la
 * evidencia, no forman parte de esta suite):
 *
 * - Filtros: Compañía (`#company_select`, chosen — solo "Todas las
 *   compañías"/"HONDURAS" en este ambiente de una sola compañía), Vendedor
 *   (`#user_select`, chosen — SIN vendedores reales configurados, solo
 *   "Todos los vendedores"), buscador de texto libre por nombre
 *   (`#search_seller_name`), Estado de Meta (`#goal_status`, chosen: Todos
 *   los estados/Cumplida/Pendiente) y rango de fechas
 *   (`#p_start_date`/`#p_end_date`, por defecto hoy-15 días a hoy). Se
 *   aplican al presionar "Buscar" (`#btn_search_commission_goal`).
 * - Los `<select>` reales quedan ocultos (`display:none`) porque la
 *   librería "chosen" los reemplaza visualmente — se seleccionan con
 *   `{ force: true }`, mismo criterio ya usado en
 *   `ReporteEstadoCuentaPage` (rp-clientes.page.ts).
 * - Tarjetas KPI (`#cmsm-metas-alcanzadas`, `#cmsm-comisiones-total`,
 *   `#cmsm-progreso-promedio`, `#cmsm-mejor-performer`).
 * - IMPORTANTE (confirmado en vivo, incluso con un rango de casi 3 años,
 *   2023-01-01 a hoy): este ambiente de QA NO tiene ninguna meta de
 *   comisión configurada para ningún vendedor — la tabla
 *   (`#tbody_commission_goal`) siempre muestra el mensaje real "No se
 *   encontraron comisiones por metas para los filtros seleccionados." y
 *   las 4 tarjetas KPI quedan siempre en su valor por defecto (0/0, $0.00,
 *   0.0%, N/A). Por eso las pruebas de este reporte validan que los
 *   filtros se apliquen sin error, no resultados con datos reales (que no
 *   existen en este ambiente).
 * - Sin ordenamiento (encabezados sin `onclick`) y sin paginación (la tabla
 *   nunca tiene más de la fila de "sin resultados" en este ambiente).
 * - No existe ningún botón de exportación (ni Excel ni PDF) en este
 *   reporte.
 */
export class ReporteComisionesMetaPage {
  constructor(private readonly page: Page) {}

  private readonly filtroCompania = () => this.page.locator('#company_select');
  private readonly filtroVendedor = () => this.page.locator('#user_select');
  private readonly buscadorVendedorTexto = () => this.page.locator('#search_seller_name');
  private readonly filtroEstadoMeta = () => this.page.locator('#goal_status');
  private readonly fechaInicial = () => this.page.locator('#p_start_date');
  private readonly fechaFinal = () => this.page.locator('#p_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_commission_goal');
  private readonly tbody = () => this.page.locator('#tbody_commission_goal');
  private readonly kpiMetasAlcanzadas = () => this.page.locator('#cmsm-metas-alcanzadas');
  private readonly kpiComisionesTotal = () => this.page.locator('#cmsm-comisiones-total');
  private readonly kpiProgresoPromedio = () => this.page.locator('#cmsm-progreso-promedio');
  private readonly kpiMejorPerformer = () => this.page.locator('#cmsm-mejor-performer');

  async abrirReporteComisionesMeta() {
    await this.page.goto(URL_COMISIONES_META, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  /** Llena el buscador de vendedor (si se indica término) y ejecuta "Buscar", esperando la respuesta real del dashboard. */
  async buscar(terminoVendedor = '') {
    await this.buscadorVendedorTexto().fill(terminoVendedor);
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getCommissionDashboardStats'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnBuscar().click();
    await respuestaPromise;
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  /** Selecciona el estado de meta ("", "1" Cumplida, "0" Pendiente) — el `<select>` real está oculto por "chosen". */
  async seleccionarEstadoMeta(valor: string) {
    await this.filtroEstadoMeta().selectOption(valor, { force: true });
  }

  /** Selecciona un vendedor por su valor real (id) — el `<select>` real está oculto por "chosen". */
  async seleccionarVendedor(valor: string) {
    await this.filtroVendedor().selectOption(valor, { force: true });
  }

  /** Selecciona la compañía por su valor real (id) — el `<select>` real está oculto por "chosen". */
  async seleccionarCompania(valor: string) {
    await this.filtroCompania().selectOption(valor, { force: true });
  }

  /** Restaura fechas/estado/vendedor/buscador a sus valores por defecto y vuelve a buscar. */
  async limpiarFiltros() {
    await this.aumentarRangoFechas(hoyMenosDiasISO(15), hoyISO());
    await this.seleccionarEstadoMeta('');
    await this.seleccionarVendedor('');
    await this.buscar('');
  }

  /** Filas reales de datos — en este ambiente, sin metas configuradas, siempre es 0 (ver estaVacia()). */
  filas(): Locator {
    return this.tbody().locator('tr:not(:has-text("No se encontraron comisiones"))');
  }

  async contarFilas(): Promise<number> {
    return this.filas().count();
  }

  /** true si la tabla muestra el mensaje real de "sin resultados" (siempre true en este ambiente, ver comentario de la clase). */
  async estaVacia(): Promise<boolean> {
    return (await this.tbody().innerText()).includes('No se encontraron comisiones por metas');
  }

  async obtenerKPIs(): Promise<{ metasAlcanzadas: string; comisionesTotal: string; progresoPromedio: string; mejorPerformer: string }> {
    return {
      metasAlcanzadas: ((await this.kpiMetasAlcanzadas().textContent()) ?? '').trim(),
      comisionesTotal: ((await this.kpiComisionesTotal().textContent()) ?? '').trim(),
      progresoPromedio: ((await this.kpiProgresoPromedio().textContent()) ?? '').trim(),
      mejorPerformer: ((await this.kpiMejorPerformer().textContent()) ?? '').trim(),
    };
  }

  async validarTabla() {
    await expect(this.tbody()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarMensajeSinResultados() {
    await expect(
      this.tbody(),
      'No apareció el mensaje "No se encontraron comisiones por metas para los filtros seleccionados."'
    ).toContainText('No se encontraron comisiones por metas', { timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Análisis de Cotizaciones ───────────────────────────────────

/**
 * Reporte de Análisis de Cotizaciones (reports/proformAnalysis).
 *
 * Analizado en vivo (scripts de investigación descartados tras extraer la
 * evidencia, no forman parte de esta suite):
 *
 * - Filtros: Vendedor (`#pfa_employee_select`, chosen, con vendedores reales)
 *   y rango de fechas (`#pfa_start_date`/`#pfa_end_date`, por defecto los
 *   últimos 30 días). Se aplican al presionar "Buscar" (`#pfa_btn_search`).
 * - 4 tarjetas de métricas reales: "Cotizaciones Totales"
 *   (`#pfa_metric_total`), "Convertidas a Venta" (`#pfa_metric_converted`),
 *   "Pendientes" (`#pfa_metric_pending`), "Eliminadas"
 *   (`#pfa_metric_deleted`). Su alcance NO coincide necesariamente con la
 *   suma de la tabla por vendedor (confirmado en vivo, mismo hallazgo que
 *   en otros reportes de esta suite con tarjetas KPI) — no se asume
 *   igualdad.
 * - 2 gráficos reales Chart.js: "Tendencia Diaria" (`#pfa_trend_chart`) y
 *   "Distribución de Cotizaciones por Estado" (`#pfa_status_chart`) — ambos
 *   permanecen visibles incluso sin datos en el rango.
 * - Tabla "Resumen por Vendedor" (`#pfa_table_body`, dentro de
 *   `#pfa_table_container`): columnas Vendedor/Total/Convertidas/
 *   Pendientes/Eliminadas/% Conversión/Valor Cotizado/Valor Vendido/Días
 *   Prom. Sin ordenamiento ni paginación.
 * - Sin resultados: a diferencia de Cotizaciones, aquí el contenedor
 *   COMPLETO `#pfa_table_container` se oculta (confirmado en vivo,
 *   `display:none`), con el texto real "No hay datos de vendedores" dentro
 *   del `tbody` que queda oculto.
 * - Exportación: botón directo "Exportar Excel" (`#pfa_btn_export`, sin
 *   dropdown) — descarga real `.xlsx` y muestra el mismo SweetAlert v1
 *   "¡Listo! El Excel se generó correctamente" que Cotizaciones. No existe
 *   ninguna opción de PDF.
 */
export class ReporteAnalisisCotizacionesPage {
  constructor(private readonly page: Page) {}

  private readonly filtroVendedor = () => this.page.locator('#pfa_employee_select');
  private readonly fechaInicial = () => this.page.locator('#pfa_start_date');
  private readonly fechaFinal = () => this.page.locator('#pfa_end_date');
  private readonly btnBuscar = () => this.page.locator('#pfa_btn_search');
  private readonly btnExportar = () => this.page.locator('#pfa_btn_export');
  private readonly metricaTotal = () => this.page.locator('#pfa_metric_total');
  private readonly metricaConvertidas = () => this.page.locator('#pfa_metric_converted');
  private readonly metricaPendientes = () => this.page.locator('#pfa_metric_pending');
  private readonly metricaEliminadas = () => this.page.locator('#pfa_metric_deleted');
  private readonly chartTendencia = () => this.page.locator('#pfa_trend_chart');
  private readonly chartEstado = () => this.page.locator('#pfa_status_chart');
  private readonly contenedorTabla = () => this.page.locator('#pfa_table_container');
  private readonly tbody = () => this.page.locator('#pfa_table_body');

  static readonly COLUMNA_VENDEDOR = 0;
  static readonly COLUMNA_TOTAL = 1;

  async abrirReporteAnalisisCotizaciones() {
    await this.page.goto(URL_ANALISIS_COTIZACIONES, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  /** Ejecuta "Buscar", esperando la respuesta real de las métricas. */
  async buscar() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getProformaMetrics'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnBuscar().click();
    await respuestaPromise;
  }

  /** Selecciona un vendedor por su valor real (id) — el `<select>` real está oculto por "chosen". */
  async seleccionarVendedor(valor: string) {
    await this.filtroVendedor().selectOption(valor, { force: true });
  }

  /** Opciones reales del filtro "Vendedor", excluyendo "Todos los vendedores" (value=""). */
  async obtenerOpcionesVendedor(): Promise<{ value: string; label: string }[]> {
    const opciones = await this.filtroVendedor().locator('option').evaluateAll((opts) =>
      opts.map((o) => ({ value: (o as HTMLOptionElement).value, label: (o.textContent ?? '').trim() }))
    );
    return opciones.filter((o) => o.value !== '');
  }

  /** Restaura fechas/vendedor a sus valores por defecto y vuelve a buscar. */
  async limpiarFiltros() {
    await this.aumentarRangoFechas(hoyMenosDiasISO(30), hoyISO());
    await this.seleccionarVendedor('');
    await this.buscar();
  }

  async obtenerMetricas(): Promise<{ total: number; convertidas: number; pendientes: number; eliminadas: number }> {
    return {
      total: montoANumero((await this.metricaTotal().textContent()) ?? ''),
      convertidas: montoANumero((await this.metricaConvertidas().textContent()) ?? ''),
      pendientes: montoANumero((await this.metricaPendientes().textContent()) ?? ''),
      eliminadas: montoANumero((await this.metricaEliminadas().textContent()) ?? ''),
    };
  }

  /**
   * Chart.js redimensiona el `<canvas>` de forma asíncrona tras la respuesta
   * de "Buscar" — comprobar `isVisible()` inmediatamente después puede leer
   * un tamaño todavía en 0 (confirmado en vivo). `isVisible()` no
   * reintenta aunque se le pase `timeout` (esa opción no existe en su
   * firma real); se usa `waitFor({ state: 'visible' })`, que sí sondea de
   * verdad, para esperar por estado en vez de una lectura instantánea.
   */
  async graficosVisibles(): Promise<{ tendencia: boolean; estado: boolean }> {
    const esperarVisible = async (locator: Locator) => {
      try {
        await locator.waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA });
        return true;
      } catch {
        return false;
      }
    };
    const [tendencia, estado] = await Promise.all([
      esperarVisible(this.chartTendencia()),
      esperarVisible(this.chartEstado()),
    ]);
    return { tendencia, estado };
  }

  filas(): Locator {
    return this.tbody().locator('tr');
  }

  async contarFilas(): Promise<number> {
    if (!(await this.contenedorTabla().isVisible())) return 0;
    return this.filas().count();
  }

  private async celdaDeFila(indice: number, columna: number): Promise<string> {
    return (await this.filas().nth(indice).locator('td').nth(columna).innerText()).trim();
  }

  async obtenerVendedorDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteAnalisisCotizacionesPage.COLUMNA_VENDEDOR);
  }

  async obtenerTotalNumericoDeFila(indice: number): Promise<number> {
    return montoANumero(await this.celdaDeFila(indice, ReporteAnalisisCotizacionesPage.COLUMNA_TOTAL));
  }

  /** Descarga el Excel real y cierra la confirmación de éxito. */
  async exportarExcel(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnExportar().click();
    const descarga = await descargaPromise;
    await cerrarConfirmacionExportacion(this.page);
    return descarga;
  }

  async validarTabla() {
    await expect(this.contenedorTabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Sin datos, TODO el contenedor de la tabla se oculta (confirmado en vivo) — no queda solo una fila vacía. */
  async validarMensajeSinResultados() {
    await expect(
      this.contenedorTabla(),
      'El contenedor de la tabla "Resumen por Vendedor" debería ocultarse cuando no hay datos'
    ).toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}

// ─── Reporte de Productos Más Cotizados ────────────────────────────────────

/**
 * Reporte de Productos Más Cotizados (reports/productsMostQuoted).
 *
 * Analizado en vivo (scripts de investigación descartados tras extraer la
 * evidencia, no forman parte de esta suite):
 *
 * - Filtros: Categoría (`#pmq_category_select`, chosen), Vendedor
 *   (`#pmq_vendor_select`, chosen, con vendedores reales), Estado
 *   (`#pmq_status_select`, chosen: Todos los estados/Convertidas
 *   [deshabilitada en el DOM, confirmado en vivo]/Pendientes/Eliminadas),
 *   Límite (`#pmq_limit_select`, chosen: Top 10/20/30/50 — SÍ cambia
 *   realmente la cantidad de productos mostrados, confirmado en vivo:
 *   10→30) y rango de fechas (`#pmq_start_date`/`#pmq_end_date`, por
 *   defecto ~los últimos 17 días). Se aplican al presionar "Buscar"
 *   (`#pmq_btn_search`).
 * - Filtros de Vehículo adicionales, ocultos tras el botón "Filtros de
 *   Vehículos" (`#pmq_btn_toggle_vehicle_filters` → revela
 *   `#pmq_vehicle_filters_container`): Marca (`#pmq_vehicle_brand`, con
 *   marcas reales) y Modelo/Año/Transmisión/Motor/Categoría/Subcategoría en
 *   cascada (deshabilitados con "Seleccione modelo/categoría primero" hasta
 *   elegir la Marca) — solo se prueba que el panel se pueda abrir y que la
 *   Marca se pueda seleccionar, no toda la cascada completa.
 * - 3 pestañas reales (Bootstrap tabs): "Cards" (`#pmq_tab_cards`, activa
 *   por defecto, tarjetas `.pmq-product-card`), "Gráfico" (`#pmq_tab_chart`,
 *   canvas Chart.js `#pmq_products_chart`) y "Tabla" (`#pmq_tab_table`,
 *   tabla real `#pmq_table_body` con columnas #/Código/Producto/Categoría/
 *   Veces Cotizado/Cantidad Total/Valor Cotizado/Conversión/Vendedores/
 *   Clientes). Sin ordenamiento de columnas.
 * - Sin resultados: `#pmq_empty_state` se muestra y `#pmq_tabs_container`
 *   completo se oculta (confirmado en vivo, mismo patrón que Análisis de
 *   Cotizaciones). También existe `#pmq_error_state` para errores de carga
 *   (no se fuerza ningún escenario de error real).
 * - No existe ningún botón de exportación (ni Excel ni PDF) en este
 *   reporte.
 */
export class ReporteProductosMasCotizadosPage {
  constructor(private readonly page: Page) {}

  private readonly filtroCategoria = () => this.page.locator('#pmq_category_select');
  private readonly filtroVendedor = () => this.page.locator('#pmq_vendor_select');
  private readonly filtroEstado = () => this.page.locator('#pmq_status_select');
  private readonly filtroLimite = () => this.page.locator('#pmq_limit_select');
  private readonly fechaInicial = () => this.page.locator('#pmq_start_date');
  private readonly fechaFinal = () => this.page.locator('#pmq_end_date');
  private readonly btnBuscar = () => this.page.locator('#pmq_btn_search');
  private readonly btnToggleFiltrosVehiculo = () => this.page.locator('#pmq_btn_toggle_vehicle_filters');
  private readonly contenedorFiltrosVehiculo = () => this.page.locator('#pmq_vehicle_filters_container');
  private readonly filtroMarcaVehiculo = () => this.page.locator('#pmq_vehicle_brand');
  private readonly tabsContainer = () => this.page.locator('#pmq_tabs_container');
  private readonly tabLink = (nombre: 'Cards' | 'Gráfico' | 'Tabla') => this.page.locator('a[data-toggle="tab"]', { hasText: nombre });
  private readonly cardsContainer = () => this.page.locator('#pmq_cards_container');
  private readonly chartProductos = () => this.page.locator('#pmq_products_chart');
  private readonly tbody = () => this.page.locator('#pmq_table_body');
  private readonly emptyState = () => this.page.locator('#pmq_empty_state');
  private readonly errorState = () => this.page.locator('#pmq_error_state');

  static readonly COLUMNA_CODIGO = 1;
  static readonly COLUMNA_PRODUCTO = 2;

  async abrirReporteProductosMasCotizados() {
    await this.page.goto(URL_PRODUCTOS_MAS_COTIZADOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  /** Ejecuta "Buscar", esperando la respuesta real del listado de productos. */
  async buscar() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getProductsMostQuoted'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnBuscar().click();
    await respuestaPromise;
  }

  /** Los `<select>` reales quedan ocultos por la librería "chosen" — se seleccionan con `{ force: true }`. */
  async seleccionarCategoria(valor: string) {
    await this.filtroCategoria().selectOption(valor, { force: true });
  }

  async seleccionarVendedor(valor: string) {
    await this.filtroVendedor().selectOption(valor, { force: true });
  }

  async seleccionarEstado(valor: string) {
    await this.filtroEstado().selectOption(valor, { force: true });
  }

  /** Cantidad máxima de productos a mostrar: '10' | '20' | '30' | '50'. */
  async seleccionarLimite(valor: '10' | '20' | '30' | '50') {
    await this.filtroLimite().selectOption(valor, { force: true });
  }

  /** Abre el panel de "Filtros de Vehículos" (oculto por defecto). */
  async abrirFiltrosVehiculo() {
    await this.btnToggleFiltrosVehiculo().click();
    await expect(this.contenedorFiltrosVehiculo(), 'El panel de "Filtros de Vehículos" no se abrió').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async seleccionarMarcaVehiculo(valor: string) {
    await this.filtroMarcaVehiculo().selectOption(valor, { force: true });
  }

  /** Valor real de la primera marca de vehículo real (excluyendo el placeholder "Seleccione marca"). */
  async obtenerPrimeraMarcaVehiculoReal(): Promise<string> {
    return (await this.filtroMarcaVehiculo().locator('option').nth(1).getAttribute('value')) ?? '';
  }

  /** Opciones reales del filtro "Vendedor", excluyendo "Todos los vendedores" (value=""). */
  async obtenerOpcionesVendedor(): Promise<{ value: string; label: string }[]> {
    const opciones = await this.filtroVendedor().locator('option').evaluateAll((opts) =>
      opts.map((o) => ({ value: (o as HTMLOptionElement).value, label: (o.textContent ?? '').trim() }))
    );
    return opciones.filter((o) => o.value !== '');
  }

  /** Restaura categoría/vendedor/estado/límite/fechas a sus valores por defecto y vuelve a buscar. */
  async limpiarFiltros() {
    await this.seleccionarCategoria('');
    await this.seleccionarVendedor('');
    await this.seleccionarEstado('0');
    await this.seleccionarLimite('10');
    await this.aumentarRangoFechas(hoyMenosDiasISO(17), hoyISO());
    await this.buscar();
  }

  async irATab(nombre: 'Cards' | 'Gráfico' | 'Tabla') {
    await this.tabLink(nombre).click();
  }

  async contarTarjetas(): Promise<number> {
    return this.cardsContainer().locator('.pmq-product-card').count();
  }

  /** Chart.js redimensiona el `<canvas>` de forma asíncrona al cambiar de pestaña — se espera por estado con `waitFor` en vez de una lectura instantánea. */
  async graficoVisible(): Promise<boolean> {
    try {
      await this.chartProductos().waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA });
      return true;
    } catch {
      return false;
    }
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

  async obtenerCodigoDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteProductosMasCotizadosPage.COLUMNA_CODIGO);
  }

  async obtenerProductoDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteProductosMasCotizadosPage.COLUMNA_PRODUCTO);
  }

  async validarTabla() {
    await expect(this.tabsContainer()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Sin datos, `#pmq_empty_state` aparece y las pestañas completas se ocultan (confirmado en vivo). */
  async validarMensajeSinResultados() {
    await expect(
      this.emptyState(),
      'No apareció el mensaje "No se encontraron productos para los filtros seleccionados."'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await expect(this.tabsContainer()).toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
    await expect(this.errorState()).toBeHidden();
  }
}
