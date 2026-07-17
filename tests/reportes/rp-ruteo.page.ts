import { Download, expect, Locator, Page } from '@playwright/test';
import { contentHeaderConTexto, SubmoduloReportes, TIMEOUTS } from './reportes.page';

export const SUBMODULOS_REPORTES_RUTEO: SubmoduloReportes[] = [
  {
    // El grupo "Ruteo" del menú lateral de Reportes solo tiene un submódulo
    // real (confirmado en vivo: su <ul> del menú solo contiene este único
    // <li>): "Comisiones por vendedor", cuya pantalla real se titula
    // "Reporte de Comisiones".
    nombre: 'Comisiones por vendedor',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/routeReport',
    rutaEsperada: 'routeReport',
    tituloEsperado: /reporte de comisiones/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de comisiones/i),
  },
];

const URL_RUTEO = SUBMODULOS_REPORTES_RUTEO[0].url;

// ─── Utilidades de fecha ────────────────────────────────────────────────────
// Mismo criterio que rp-gastos-operativos.page.ts/rp-caja.page.ts: cada
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

// ─── Utilidades compartidas ─────────────────────────────────────────────────

/** Convierte un monto mostrado en pantalla (p.ej. "76,945,116,277.60") a number, ignorando separadores de miles. */
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

// ─── Reporte de Comisiones (grupo "Ruteo") ─────────────────────────────────

/**
 * Reporte de Comisiones (reports/routeReport) — único submódulo real del
 * grupo "Ruteo" del menú Reportes.
 *
 * Analizado en vivo (scripts de investigación descartados tras extraer la
 * evidencia, no forman parte de esta suite):
 *
 * - Filtros reales (`.filtros-reporte`): buscador de texto libre (`#search`,
 *   filtra por nombre de vendedor), rango de fechas (`#start_dates`/
 *   `#end_date`, ambos `<input type="date">`, por defecto hoy), "Tipo de
 *   Venta" (`#sale_state_option`: Todas/Contado/Crédito(Pago)/
 *   Crédito(Pendiente)), "Vendedores" (`#employee`: Todos + lista real de
 *   vendedores), "Tipo de factura" (`#invoice_type`: Todos/Factura
 *   Electrónica/Tiquete Electrónico/Factura Electrónica Exportación), "Tipo
 *   Comision" (`#comission_type`: Por Productos=1/Por Vendedor=0 —
 *   confirmado en vivo que cambiar este valor NO altera ni las columnas ni
 *   los datos de la tabla "Detalle por Empleado" en este ambiente; se deja
 *   fijar el filtro pero no se le asume ningún efecto visible) y "Ruta"
 *   (`#route_id`: Todas + lista real de rutas — esta pantalla no muestra
 *   ninguna columna de Ruta, así que no se puede validar visualmente el
 *   efecto exacto del filtro, solo que la búsqueda se ejecute sin errores).
 *   Todos se aplican al presionar "Buscar" (`#btn_search`, dispara
 *   `get_commissions_report()` → AJAX real
 *   `routeReportSearchComissionProduct`).
 * - No existe ningún botón "Limpiar filtros" en esta pantalla: limpiar
 *   significa restaurar cada campo a su valor por defecto y volver a buscar
 *   (mismo criterio que el resto de la suite de Reportes).
 * - Tabla "Detalle por Empleado" (`#tbody_commissions`): columnas Acciones/
 *   Vendedor/Cantidad de Ventas/Subtotal de Venta/Comisión.
 *     - Ordenamiento: no existe — los `<th>` son texto plano sin `onclick`
 *       ni atributo de orden.
 *     - Paginación: no existe ningún control en el DOM con los datos reales
 *       disponibles en este ambiente.
 *     - Sin resultados: a diferencia de otros reportes de esta suite
 *       (p.ej. rp-gastos-operativos), aquí NO existe ninguna fila/mensaje de
 *       "sin resultados" — con un rango de fechas sin datos, el `<tbody>`
 *       queda completamente vacío (0 `<tr>`), la tabla sigue visible y las
 *       tarjetas KPI + totales quedan en 0.00 (confirmado en vivo).
 * - Tarjetas KPI (arriba de la tabla): "Total Ventas Con Impuesto"
 *   (`#h2_total_sales`), "Cantidad ventas" (`#h2_total_sales_count`), "Pago
 *   de Comisión" (`#h2_avg_commission`) y "Cantidad vendedores"
 *   (`#h2_total_vendedores`). Su alcance es más amplio que el de la tabla:
 *   confirmado en vivo que la suma real de la columna "Subtotal de Venta"
 *   de las filas visibles NO coincide con `#h2_total_sales` (los KPI
 *   parecen incluir ventas fuera del agrupamiento por vendedor) — no se
 *   asume igualdad entre ambos, solo que sean numéricos y reaccionen a
 *   "Buscar".
 * - Totales fijos al pie de la tabla (`.totales-fijos`): `#fixed_total_subtotal`
 *   y `#fixed_total_commission` SÍ coinciden exactamente con la suma real
 *   de las columnas "Subtotal de Venta"/"Comisión" de las filas visibles
 *   (confirmado en vivo). `#total_commissions` (debajo de la tabla) coincide
 *   con `#fixed_total_commission`.
 * - Exportación global ("Descargar" arriba a la derecha): su única opción
 *   real es "Exportar Excel (pronto)" — confirmado en vivo que es un
 *   placeholder sin `onclick` real (el propio texto ya indica "(pronto)"):
 *   NO dispara ninguna descarga. No existe ninguna opción de exportar PDF a
 *   nivel de listado completo.
 * - Cada fila tiene su propio menú de acciones real (ícono de 3 puntos
 *   verticales, `.dropdown-trigger` + `.custom-dropdown-menu`) con 5
 *   opciones, TODAS funcionales (confirmado en vivo, a diferencia del botón
 *   "Descargar" global):
 *     - "Descargar PDF Detallado" → descarga real (`exportCommissionsPDF(false, id)`).
 *     - "Imprimir Reporte Detallado" → descarga real + intenta abrir una
 *       pestaña nueva (`exportCommissionsPDF(true, id)`) que queda en blanco
 *       en este ambiente (sin impresión automática configurada, mismo
 *       hallazgo ya documentado en el resto de la suite), no bloqueante.
 *     - "Descargar PDF Consolidado" → descarga real (`exportCommissionsConsolidatedPDF(false, id)`).
 *     - "Imprimir Reporte Consolidado" → mismo patrón que su versión
 *       detallada (`exportCommissionsConsolidatedPDF(true, id)`).
 *     - "Exportar Excel Reporte Consolidado" → descarga real `.xlsx`
 *       (`exportCommissionsConsolidatedExcel(id)`), con el nombre del
 *       vendedor incluido en el nombre del archivo.
 */
export class ReporteRuteoPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#search');
  private readonly fechaInicial = () => this.page.locator('#start_dates');
  private readonly fechaFinal = () => this.page.locator('#end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search');
  private readonly filtroTipoVenta = () => this.page.locator('#sale_state_option');
  private readonly filtroVendedor = () => this.page.locator('#employee');
  private readonly filtroTipoFactura = () => this.page.locator('#invoice_type');
  private readonly filtroTipoComision = () => this.page.locator('#comission_type');
  private readonly filtroRuta = () => this.page.locator('#route_id');
  private readonly btnDescargarToggle = () => this.page.locator('button.dropdown-toggle', { hasText: 'Descargar' });
  private readonly opcionDescargarExcelGlobal = () => this.page.locator('a', { hasText: 'Exportar Excel' });
  private readonly tbody = () => this.page.locator('#tbody_commissions');
  private readonly contenedorTabla = () => this.page.locator('table.mdl-data-table');
  private readonly kpiTotalVentas = () => this.page.locator('#h2_total_sales');
  private readonly kpiCantidadVentas = () => this.page.locator('#h2_total_sales_count');
  private readonly kpiPagoComision = () => this.page.locator('#h2_avg_commission');
  private readonly kpiCantidadVendedores = () => this.page.locator('#h2_total_vendedores');
  private readonly totalFijoSubtotal = () => this.page.locator('#fixed_total_subtotal');
  private readonly totalFijoComision = () => this.page.locator('#fixed_total_commission');
  private readonly totalComisionesGlobal = () => this.page.locator('#total_commissions');

  /** Columnas (0-based) de cada fila — confirmadas en vivo. */
  static readonly COLUMNA_VENDEDOR = 1;
  static readonly COLUMNA_CANTIDAD_VENTAS = 2;
  static readonly COLUMNA_SUBTOTAL = 3;
  static readonly COLUMNA_COMISION = 4;

  async abrirReporteRuteo() {
    await this.page.goto(URL_RUTEO, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  /** Llena el buscador (si se indica término) y ejecuta "Buscar", esperando la respuesta real del listado. */
  async buscar(termino = '') {
    await this.buscador().fill(termino);
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('routeReportSearchComissionProduct'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnBuscar().click();
    await respuestaPromise;
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  async seleccionarTipoVenta(valor: string) {
    await this.filtroTipoVenta().selectOption(valor);
  }

  async seleccionarVendedor(valor: string) {
    await this.filtroVendedor().selectOption(valor);
  }

  async seleccionarTipoFactura(valor: string) {
    await this.filtroTipoFactura().selectOption(valor);
  }

  async seleccionarTipoComision(valor: string) {
    await this.filtroTipoComision().selectOption(valor);
  }

  async seleccionarRuta(valor: string) {
    await this.filtroRuta().selectOption(valor);
  }

  /** Opciones reales del filtro "Vendedores", excluyendo "Todos" (value="0"). */
  async obtenerOpcionesVendedor(): Promise<{ value: string; label: string }[]> {
    const opciones = await this.filtroVendedor().locator('option').evaluateAll((opts) =>
      opts.map((o) => ({ value: (o as HTMLOptionElement).value, label: (o.textContent ?? '').trim() }))
    );
    return opciones.filter((o) => o.value !== '0');
  }

  /** Opciones reales del filtro "Ruta", excluyendo "Todas" (value="0"). */
  async obtenerOpcionesRuta(): Promise<{ value: string; label: string }[]> {
    const opciones = await this.filtroRuta().locator('option').evaluateAll((opts) =>
      opts.map((o) => ({ value: (o as HTMLOptionElement).value, label: (o.textContent ?? '').trim() }))
    );
    return opciones.filter((o) => o.value !== '0');
  }

  /**
   * Restaura todos los filtros a sus valores por defecto (hoy/Todos) y
   * vuelve a buscar — no existe un botón real "Limpiar filtros" en esta
   * pantalla (confirmado en vivo).
   */
  async limpiarFiltros() {
    await this.aumentarRangoFechas(hoyISO(), hoyISO());
    await this.filtroTipoVenta().selectOption('all');
    await this.filtroVendedor().selectOption('0');
    await this.filtroTipoFactura().selectOption('0');
    await this.filtroRuta().selectOption('0');
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

  async obtenerVendedorDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteRuteoPage.COLUMNA_VENDEDOR);
  }

  async obtenerCantidadVentasNumericaDeFila(indice: number): Promise<number> {
    return montoANumero(await this.celdaDeFila(indice, ReporteRuteoPage.COLUMNA_CANTIDAD_VENTAS));
  }

  async obtenerSubtotalNumericoDeFila(indice: number): Promise<number> {
    return montoANumero(await this.celdaDeFila(indice, ReporteRuteoPage.COLUMNA_SUBTOTAL));
  }

  async obtenerComisionNumericaDeFila(indice: number): Promise<number> {
    return montoANumero(await this.celdaDeFila(indice, ReporteRuteoPage.COLUMNA_COMISION));
  }

  /** Tarjetas KPI de la parte superior (alcance más amplio que la tabla, ver comentario de la clase). */
  async obtenerKPIs(): Promise<{ totalVentas: number; cantidadVentas: number; pagoComision: number; cantidadVendedores: number }> {
    return {
      totalVentas: montoANumero((await this.kpiTotalVentas().textContent()) ?? ''),
      cantidadVentas: montoANumero((await this.kpiCantidadVentas().textContent()) ?? ''),
      pagoComision: montoANumero((await this.kpiPagoComision().textContent()) ?? ''),
      cantidadVendedores: montoANumero((await this.kpiCantidadVendedores().textContent()) ?? ''),
    };
  }

  /** Totales fijos al pie de la tabla — coinciden exactamente con la suma real de las filas visibles (confirmado en vivo). */
  async obtenerTotalesFijos(): Promise<{ subtotal: number; comision: number }> {
    return {
      subtotal: montoANumero((await this.totalFijoSubtotal().textContent()) ?? ''),
      comision: montoANumero((await this.totalFijoComision().textContent()) ?? ''),
    };
  }

  async obtenerTotalComisionesGlobal(): Promise<number> {
    return montoANumero((await this.totalComisionesGlobal().textContent()) ?? '');
  }

  /**
   * Menú de acciones (ícono de 3 puntos verticales) de la fila indicada
   * (0-based) — localizado dentro de la propia fila (`.custom-dropdown-menu`).
   */
  private menuAccionesDeFila(indice: number): Locator {
    return this.filas().nth(indice).locator('.custom-dropdown-menu');
  }

  /** Abre el menú de acciones de la fila indicada (0-based) — se debe llamar antes de cada acción, ya que el propio menú se cierra solo tras seleccionar una opción (confirmado en vivo). */
  async abrirMenuAccionesFila(indice = 0) {
    await this.filas().nth(indice).locator('.dropdown-trigger').click();
    await expect(this.menuAccionesDeFila(indice)).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Devuelve el texto de las opciones del menú de acciones de la fila indicada (0-based). */
  async obtenerOpcionesAccionesFila(indice = 0): Promise<string[]> {
    await this.abrirMenuAccionesFila(indice);
    return this.menuAccionesDeFila(indice).locator('a').allInnerTexts();
  }

  /** "Descargar PDF Detallado" de la fila indicada (0-based): descarga real, confirmada en vivo. */
  async descargarPDFDetalladoFila(indice = 0): Promise<Download> {
    await this.abrirMenuAccionesFila(indice);
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.menuAccionesDeFila(indice).locator('a', { hasText: 'Descargar PDF Detallado' }).click();
    return descargaPromise;
  }

  /** "Descargar PDF Consolidado" de la fila indicada (0-based): descarga real, confirmada en vivo. */
  async descargarPDFConsolidadoFila(indice = 0): Promise<Download> {
    await this.abrirMenuAccionesFila(indice);
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.menuAccionesDeFila(indice).locator('a', { hasText: 'Descargar PDF Consolidado' }).click();
    return descargaPromise;
  }

  /** "Exportar Excel Reporte Consolidado" de la fila indicada (0-based): descarga real `.xlsx`, confirmada en vivo. */
  async descargarExcelConsolidadoFila(indice = 0): Promise<Download> {
    await this.abrirMenuAccionesFila(indice);
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.menuAccionesDeFila(indice).locator('a', { hasText: 'Exportar Excel Reporte Consolidado' }).click();
    return descargaPromise;
  }

  /**
   * "Imprimir Reporte Detallado"/"Imprimir Reporte Consolidado" de la fila
   * indicada (0-based): ambas abren una pestaña nueva que queda en blanco en
   * este ambiente (sin impresión automática configurada, mismo hallazgo ya
   * documentado en el resto de la suite). Solo "Detallado" dispara además una
   * descarga real del PDF — "Consolidado" genera el PDF del lado del cliente
   * dentro de esa misma pestaña y NUNCA llega a disparar el evento
   * `download` (confirmado en vivo, con avisos reales en consola de
   * "table content ... could not fit page" mientras renderiza) — por eso la
   * descarga es opcional (`null` si no llegó) y solo se exige la pestaña.
   */
  private async imprimirFila(indice: number, textoOpcion: string): Promise<{ descarga: Download | null; seAbrioVentanaNueva: boolean }> {
    await this.abrirMenuAccionesFila(indice);
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA }).catch(() => null);
    const popupPromise = this.page.context().waitForEvent('page', { timeout: TIMEOUTS.CARGA }).catch(() => null);
    await this.menuAccionesDeFila(indice).locator('a', { hasText: textoOpcion }).click();
    const [descarga, popup] = await Promise.all([descargaPromise, popupPromise]);
    if (popup) await popup.close().catch(() => {});
    return { descarga, seAbrioVentanaNueva: !!popup };
  }

  async imprimirReporteDetalladoFila(indice = 0) {
    return this.imprimirFila(indice, 'Imprimir Reporte Detallado');
  }

  async imprimirReporteConsolidadoFila(indice = 0) {
    return this.imprimirFila(indice, 'Imprimir Reporte Consolidado');
  }

  /**
   * Único botón de exportación global ("Descargar" arriba a la derecha):
   * su única opción real es "Exportar Excel (pronto)", un placeholder sin
   * `onclick` real (confirmado en vivo) — NO dispara ninguna descarga.
   */
  async abrirMenuDescargaGlobal() {
    await this.btnDescargarToggle().click();
    await expect(this.opcionDescargarExcelGlobal()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async obtenerTextoOpcionDescargaGlobal(): Promise<string> {
    return (await this.opcionDescargarExcelGlobal().innerText()).trim();
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}
