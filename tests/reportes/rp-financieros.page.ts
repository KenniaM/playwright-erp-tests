import { Download, expect, Locator, Page } from '@playwright/test';
import { contentHeaderConTexto, SubmoduloReportes, TIMEOUTS } from './reportes.page';

export const SUBMODULOS_REPORTES_FINANCIEROS: SubmoduloReportes[] = [
  {
    nombre: 'Reporte Financiero',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/reportFinancialIndex',
    rutaEsperada: 'reportFinancialIndex',
    tituloEsperado: /reporte financiero/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte financiero/i),
  },
];

const URL_FINANCIERO = SUBMODULOS_REPORTES_FINANCIEROS[0].url;

// ─── Utilidades compartidas ─────────────────────────────────────────────────

/** Convierte un monto mostrado en pantalla (p.ej. "$ 18,309,586,518,576.63") a number. */
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

// ─── Reporte Financiero ─────────────────────────────────────────────────────

/**
 * Reporte Financiero (reports/reportFinancialIndex).
 *
 * Analizado en vivo (scripts de investigación descartados tras extraer la
 * evidencia, no forman parte de esta suite):
 *
 * - Filtro principal de rango: `#resume` (chosen) con 6 opciones reales —
 *   Hoy(0)/Ayer(1)/Últimos 7 días(2)/Últimos 14 días(3)/Últimos 30 días(4)/
 *   Rango de fecha(5). Elegir cualquiera de ellas DISPARA la búsqueda
 *   automáticamente (`onchange="change_resume()"` → AJAX real
 *   `getReportFinancialTotals` + `getReportFinancialDays`), sin necesidad de
 *   presionar "Buscar". Al elegir "Rango de fecha" se habilitan
 *   `#start_date`/`#end_date`, pero son campos de texto con un date-time
 *   picker de terceros que IGNORA `.fill()` (confirmado en vivo: concatena
 *   el texto en vez de reemplazar el valor, p.ej.
 *   `"2026-07-17 04:32 PM2023-01-01"`) — por eso este Page Object controla
 *   el rango únicamente a través de los presets de `#resume` (Hoy vs Últimos
 *   30 días cumple el mismo propósito de "rango corto vs. rango amplio" sin
 *   depender de un calendario JS frágil de automatizar).
 * - Otros filtros reales: buscador de texto libre (`#search`,
 *   `onchange="get_search()"` — también autodispara, filtra por
 *   cliente/factura dentro de cada día), Cliente (`#client_id`, chosen),
 *   Vendedor (`#seller_id`, chosen), Caja (`#cash_id`, chosen), Tipo de
 *   venta (`#type_sell_id`, chosen: Todas/Contado/Crédito(Pago)/
 *   Crédito(Pendiente)), Moneda (menú propio `#currency_report_financial`,
 *   NO es un `<select>`, con enlaces `onclick="filterByCurrency(id,label)"`:
 *   Todas/₡ CRC/D STD/$ USD/€ EUR/L HNL/R DOP) y Tipo de ítem (3 botones
 *   toggle reales con atributo `type_id`: Todas/Productos/Servicios).
 *   "Buscar" (`#btn_search`, `onclick="validateAndSearch()"`) existe como
 *   disparador manual adicional, aunque la mayoría de los filtros ya
 *   autodisparan la búsqueda al cambiar.
 * - Tabla (`#tableBody`, dentro de `#table-scroll-wrapper` con scroll
 *   interno): una fila por día (`tr.expandable`) con ícono ▶ que expande una
 *   sección real `#facturas-<indice>` con las facturas de ese día; cada
 *   factura es a su vez expandible (`toggleProductos`) mostrando sus
 *   productos/servicios. Las facturas con saldo pendiente muestran un botón
 *   real "Abonar factura pendiente" (`pay_customer_invoice(...)`) — ACCIÓN
 *   DESTRUCTIVA real (cobra la factura): no se ejecuta en los tests, solo se
 *   confirma que la sección de facturas se puede expandir/colapsar.
 *     - Sin ordenamiento: los `<th>` son texto plano sin `onclick`.
 *     - Sin paginación tradicional: todo el rango cabe en el contenedor con
 *       scroll interno (confirmado en vivo hasta 30 filas con "Últimos 30
 *       días"), sin controles de "página X".
 *     - Sin resultados: NO existe ningún mensaje dedicado (a diferencia de
 *       Cotizaciones/Proformas) — el `tbody` simplemente queda vacío
 *       (innerHTML `""`), la tabla contenedora sigue visible y las tarjetas
 *       KPI se resetean a 0 (confirmado en vivo buscando un término
 *       inexistente).
 * - Totales: `<tfoot id="tableFooterFixed">` trae 2 filas reales
 *   ("TOTALES ($)" y "TOTAL GENERAL ($)") que coinciden exactamente con las
 *   tarjetas KPI de arriba (confirmado en vivo).
 * - Tarjetas KPI: "Total Ventas" (`#totalVentas` + `#totalContado`/
 *   `#totalCredito`), "Total Ganancia" (`#totalGanancia` + `#totalCostos`),
 *   "Utilidad Promedio" (`#avgUtilityValue` + semáforo de color/estado
 *   `#avgUtilityStatus`) e "Impuesto" (`#totalImpuesto` + `#totalDiferencia`).
 *   `#date-range-label` muestra el período efectivo en texto libre.
 * - Gráfico real (ECharts): "Ingresos por Día" (`#incomeChart`).
 * - "Semáforo de Utilidad" (botón `toggleSemaphoreSettings()` →
 *   `#semaphore-settings-line`): panel con 3 umbrales configurables
 *   (`#greenThreshold`/`#yellowThreshold`/`#redThreshold`) y un botón
 *   "Guardar" (`saveSemaphoreThresholds()`) que persiste una configuración
 *   GLOBAL y compartida del ambiente de QA — los tests solo abren/cierran el
 *   panel y confirman que los campos son editables, nunca presionan
 *   "Guardar" para no alterar la configuración compartida de otros tests.
 * - Exportación: dropdown "Descargar" (`#btn_download_financial_report`)
 *   con 2 opciones reales, ambas descargan un `.xlsx` real SIN mostrar
 *   ninguna confirmación adicional (a diferencia de Cotizaciones):
 *   "Excel - Reporte Financiero Detallado" y "Excel - Reporte Financiero
 *   Consolidado". Además, el botón "Exportar" (`exportReportImage()`)
 *   descarga una imagen real (`reporte-financiero.png`) con una captura
 *   visual del reporte. No existe ninguna opción de PDF.
 */
export class ReporteFinancieroPage {
  constructor(private readonly page: Page) {}

  private readonly filtroResumen = () => this.page.locator('#resume');
  private readonly buscador = () => this.page.locator('#search');
  private readonly btnBuscar = () => this.page.locator('#btn_search');
  private readonly filtroCliente = () => this.page.locator('#client_id');
  private readonly filtroVendedor = () => this.page.locator('#seller_id');
  private readonly filtroCaja = () => this.page.locator('#cash_id');
  private readonly filtroTipoVenta = () => this.page.locator('#type_sell_id');
  private readonly menuMoneda = () => this.page.locator('#currency_report_financial');
  private readonly btnMonedaToggle = () => this.page.locator('#span_selected_currency');
  private readonly btnTipoItem = (tipoId: '0' | '1' | '2') => this.page.locator(`button[type_id="${tipoId}"]`);
  private readonly btnDescargarToggle = () => this.page.locator('#btn_download_financial_report');
  private readonly opcionExcelDetallado = () => this.page.locator('#btn_download_report_financial_excel_detail');
  private readonly opcionExcelConsolidado = () => this.page.locator('#btn_download_report_financial_excel_consolidated');
  private readonly btnExportarImagen = () => this.page.locator('button', { hasText: 'Exportar' });
  private readonly btnSemaforoToggle = () => this.page.locator('button', { hasText: 'Semáforo de Utilidad' });
  private readonly panelSemaforo = () => this.page.locator('#semaphore-settings-line');
  private readonly contenedorTabla = () => this.page.locator('#table-scroll-wrapper');
  private readonly tbody = () => this.page.locator('#tableBody');
  private readonly tfoot = () => this.page.locator('#tableFooterFixed');
  private readonly chartIngresos = () => this.page.locator('#incomeChart');
  private readonly etiquetaRangoFechas = () => this.page.locator('#date-range-label');
  private readonly kpiTotalVentas = () => this.page.locator('#totalVentas');
  private readonly kpiTotalContado = () => this.page.locator('#totalContado');
  private readonly kpiTotalCredito = () => this.page.locator('#totalCredito');
  private readonly kpiTotalGanancia = () => this.page.locator('#totalGanancia');
  private readonly kpiTotalCostos = () => this.page.locator('#totalCostos');
  private readonly kpiUtilidadPromedio = () => this.page.locator('#avgUtilityValue');
  private readonly kpiUtilidadEstado = () => this.page.locator('#avgUtilityStatus');
  private readonly kpiTotalImpuesto = () => this.page.locator('#totalImpuesto');
  private readonly kpiTotalDiferencia = () => this.page.locator('#totalDiferencia');

  async abrirReporteFinanciero() {
    await this.page.goto(URL_FINANCIERO, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await cerrarBannerNotificaciones(this.page);
  }

  /**
   * Selecciona un preset de rango real del filtro "Resumen" — dispara la
   * búsqueda automáticamente, esperando la respuesta real de
   * `getReportFinancialDays`. Valores reales: '0' Hoy, '1' Ayer, '2' Últimos
   * 7 días, '3' Últimos 14 días, '4' Últimos 30 días, '5' Rango de fecha.
   */
  async seleccionarResumen(valor: '0' | '1' | '2' | '3' | '4' | '5') {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getReportFinancialDays'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.filtroResumen().selectOption(valor, { force: true });
    await respuestaPromise;
    await this.esperarRenderizadoTabla();
  }

  /** Llena el buscador (autodispara la búsqueda al cambiar, sin necesitar "Buscar") y espera la respuesta real. */
  async buscar(termino = '') {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getReportFinancialDays'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.buscador().fill(termino);
    await this.buscador().dispatchEvent('change');
    await respuestaPromise;
    await this.esperarRenderizadoTabla();
  }

  /**
   * Cada fila de día incluye, ya renderizado dentro del propio HTML de la
   * respuesta, el desglose completo de facturas y productos de ese día —
   * tras recibir la respuesta de `getReportFinancialDays`, el navegador
   * todavía necesita insertar ese HTML (potencialmente grande) en el
   * `tbody`, lo que puede tardar un instante más (confirmado en vivo:
   * `contarFilas()` leído inmediatamente después de la respuesta a veces
   * devolvía 0 con datos reales disponibles, incluso con datos reales
   * confirmados por otra vía). Se espera a que la red quede inactiva como
   * señal de que el renderizado (y cualquier llamada secundaria) terminó,
   * en vez de leer el DOM al instante.
   */
  private async esperarRenderizadoTabla() {
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  /** Los `<select>` reales quedan ocultos por la librería "chosen" — se seleccionan con `{ force: true }`. */
  async seleccionarCliente(valor: string) {
    await this.filtroCliente().selectOption(valor, { force: true });
  }

  async seleccionarVendedor(valor: string) {
    await this.filtroVendedor().selectOption(valor, { force: true });
  }

  async seleccionarCaja(valor: string) {
    await this.filtroCaja().selectOption(valor, { force: true });
  }

  async seleccionarTipoVenta(valor: string) {
    await this.filtroTipoVenta().selectOption(valor, { force: true });
  }

  /** Selecciona una moneda real por su etiqueta visible (p.ej. "Todas", "₡ CRC", "$ USD"). */
  async seleccionarMoneda(etiqueta: string) {
    await this.btnMonedaToggle().click();
    await this.menuMoneda().locator('a', { hasText: etiqueta }).click();
  }

  /** Selecciona el tipo de ítem real: Todas/Productos/Servicios. */
  async seleccionarTipoItem(tipo: 'todas' | 'productos' | 'servicios') {
    const tipoId = { todas: '0', productos: '1', servicios: '2' }[tipo] as '0' | '1' | '2';
    await this.btnTipoItem(tipoId).click();
  }

  /** Opciones reales del filtro "Cliente", excluyendo "Todos los clientes" (value="0"). */
  async obtenerOpcionesCliente(): Promise<{ value: string; label: string }[]> {
    const opciones = await this.filtroCliente().locator('option').evaluateAll((opts) =>
      opts.map((o) => ({ value: (o as HTMLOptionElement).value, label: (o.textContent ?? '').trim() }))
    );
    return opciones.filter((o) => o.value !== '0');
  }

  /** Opciones reales del filtro "Vendedor", excluyendo "Todos los vendedores" (value="0"). */
  async obtenerOpcionesVendedor(): Promise<{ value: string; label: string }[]> {
    const opciones = await this.filtroVendedor().locator('option').evaluateAll((opts) =>
      opts.map((o) => ({ value: (o as HTMLOptionElement).value, label: (o.textContent ?? '').trim() }))
    );
    return opciones.filter((o) => o.value !== '0');
  }

  /** Opciones reales del filtro "Caja", excluyendo "Todas" (value="0"). */
  async obtenerOpcionesCaja(): Promise<{ value: string; label: string }[]> {
    const opciones = await this.filtroCaja().locator('option').evaluateAll((opts) =>
      opts.map((o) => ({ value: (o as HTMLOptionElement).value, label: (o.textContent ?? '').trim() }))
    );
    return opciones.filter((o) => o.value !== '0');
  }

  /** Restaura todos los filtros a sus valores por defecto (Hoy/Todos/Todas) y vuelve a buscar. */
  async limpiarFiltros() {
    await this.seleccionarCliente('0');
    await this.seleccionarVendedor('0');
    await this.seleccionarCaja('0');
    await this.seleccionarTipoVenta('0');
    await this.seleccionarMoneda('Todas');
    await this.seleccionarTipoItem('todas');
    await this.seleccionarResumen('0');
    await this.buscar('');
  }

  tabla(): Locator {
    return this.contenedorTabla();
  }

  /** Filas reales de día (excluye las filas internas de facturas/productos expandidas, que no tienen la clase `.expandable`). */
  filas(): Locator {
    return this.tbody().locator('tr.expandable');
  }

  async contarFilas(): Promise<number> {
    return this.filas().count();
  }

  private async celdaDeFila(indice: number, columna: number): Promise<string> {
    return (await this.filas().nth(indice).locator('td').nth(columna).innerText()).trim();
  }

  static readonly COLUMNA_FECHA = 0;
  static readonly COLUMNA_TOTAL = 3;

  async obtenerFechaDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteFinancieroPage.COLUMNA_FECHA);
  }

  async obtenerTotalNumericoDeFila(indice: number): Promise<number> {
    return montoANumero(await this.celdaDeFila(indice, ReporteFinancieroPage.COLUMNA_TOTAL));
  }

  /**
   * Expande (o colapsa, si ya estaba expandida) la fila de día indicada
   * (0-based), revelando su sección real de facturas del día.
   */
  async alternarExpansionFila(indice: number) {
    await this.filas().nth(indice).click();
  }

  /** Sección real de facturas del día de la fila indicada (0-based). */
  seccionFacturasDeFila(indice: number): Locator {
    return this.page.locator(`#facturas-${indice}`);
  }

  async obtenerKPIs(): Promise<{
    totalVentas: number;
    totalContado: number;
    totalCredito: number;
    totalGanancia: number;
    totalCostos: number;
    totalImpuesto: number;
    totalDiferencia: number;
  }> {
    return {
      totalVentas: montoANumero((await this.kpiTotalVentas().textContent()) ?? ''),
      totalContado: montoANumero((await this.kpiTotalContado().textContent()) ?? ''),
      totalCredito: montoANumero((await this.kpiTotalCredito().textContent()) ?? ''),
      totalGanancia: montoANumero((await this.kpiTotalGanancia().textContent()) ?? ''),
      totalCostos: montoANumero((await this.kpiTotalCostos().textContent()) ?? ''),
      totalImpuesto: montoANumero((await this.kpiTotalImpuesto().textContent()) ?? ''),
      totalDiferencia: montoANumero((await this.kpiTotalDiferencia().textContent()) ?? ''),
    };
  }

  async obtenerUtilidadPromedio(): Promise<{ valor: string; estado: string }> {
    return {
      valor: ((await this.kpiUtilidadPromedio().textContent()) ?? '').trim(),
      estado: ((await this.kpiUtilidadEstado().textContent()) ?? '').trim(),
    };
  }

  async obtenerEtiquetaRangoFechas(): Promise<string> {
    return (await this.etiquetaRangoFechas().innerText()).trim();
  }

  /**
   * Totales reales del pie de tabla. Cuando el rango incluye ventas en más
   * de una moneda, el pie trae UNA fila de subtotal real por moneda
   * ("TOTALES (₡)", "TOTALES ($)", etc. — cada una en su propia moneda, sin
   * convertir) MÁS una fila final "TOTAL GENERAL ($)" con el gran total ya
   * convertido a dólares (confirmado en vivo) — esta última es la única que
   * coincide con las tarjetas KPI, ver `obtenerTotalGeneralFooter()`.
   */
  async obtenerTotalesFooter(): Promise<{ etiqueta: string; totalVentas: number }[]> {
    const filasFooter = await this.tfoot().locator('tr').all();
    const resultado: { etiqueta: string; totalVentas: number }[] = [];
    for (const fila of filasFooter) {
      const celdas = await fila.locator('td').allInnerTexts();
      resultado.push({ etiqueta: celdas[0].trim(), totalVentas: montoANumero(celdas[3] ?? '') });
    }
    return resultado;
  }

  /** El gran total real ("TOTAL GENERAL"), ya convertido a una sola moneda — el único que coincide con las tarjetas KPI (confirmado en vivo). */
  async obtenerTotalGeneralFooter(): Promise<number> {
    const totales = await this.obtenerTotalesFooter();
    const totalGeneral = totales.find((t) => t.etiqueta.toUpperCase().includes('TOTAL GENERAL'));
    return totalGeneral?.totalVentas ?? NaN;
  }

  async graficoIngresosVisible(): Promise<boolean> {
    try {
      await this.chartIngresos().waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Abre (o cierra) el panel de "Semáforo de Utilidad". Nunca presiona
   * "Guardar" — persistiría una configuración global compartida del
   * ambiente de QA (ver comentario de la clase).
   */
  async alternarPanelSemaforo() {
    await this.btnSemaforoToggle().click();
  }

  async panelSemaforoVisible(): Promise<boolean> {
    return this.panelSemaforo().isVisible();
  }

  /** Descarga real "Excel - Reporte Financiero Detallado". */
  async descargarExcelDetallado(): Promise<Download> {
    await this.btnDescargarToggle().click();
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.opcionExcelDetallado().click();
    return descargaPromise;
  }

  /** Descarga real "Excel - Reporte Financiero Consolidado". */
  async descargarExcelConsolidado(): Promise<Download> {
    await this.btnDescargarToggle().click();
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.opcionExcelConsolidado().click();
    return descargaPromise;
  }

  /** Descarga real una imagen `.png` con la captura visual del reporte. */
  async descargarImagenReporte(): Promise<Download> {
    const descargaPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.btnExportarImagen().click();
    return descargaPromise;
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}
