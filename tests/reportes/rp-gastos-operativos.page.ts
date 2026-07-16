import { Download, expect, Locator, Page } from '@playwright/test';
import { SubmoduloReportes, TIMEOUTS } from './reportes.page';

export const SUBMODULOS_REPORTES_GASTOS_OPERATIVOS: SubmoduloReportes[] = [
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el botón real de búsqueda, que sí es visible. (`#code_expense`
    // existe en el DOM pero queda oculto dentro de un panel colapsado,
    // confirmado en vivo.)
    nombre: 'Gastos Operativos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/family_expenses/familyExpenses',
    rutaEsperada: 'familyExpenses',
    tituloEsperado: /gastos operativos/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_search'),
  },
];

const URL_GASTOS_OPERATIVOS = SUBMODULOS_REPORTES_GASTOS_OPERATIVOS[0].url;

// ─── Utilidades de fecha ────────────────────────────────────────────────────
// Mismo criterio que rp-caja.page.ts/rp-clientes.page.ts: cada archivo de
// reporte define sus propias utilidades de fecha en vez de compartirlas desde
// reportes.page.ts (convención ya establecida en este directorio).

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

/** No hay ningún mensaje de error de aplicación (`.noty_bar`) visible en pantalla. */
async function validarSinErrores(page: Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

/**
 * El layout general del ERP puede mostrar un banner de "Activar
 * notificaciones" al cargar la página, que intercepta clics sobre controles
 * reales si queda visible (confirmado en vivo, mismo tratamiento que
 * rp-caja.page.ts/rp-clientes.page.ts).
 */
async function cerrarBannerNotificaciones(page: Page) {
  await page.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 3000 }).catch(() => {});
}

// ─── Reporte de Gastos Operativos ──────────────────────────────────────────

/**
 * Reporte de Gastos Operativos (family_expenses/familyExpenses).
 *
 * Analizado en vivo (scripts de investigación descartados tras extraer la
 * evidencia, no forman parte de esta suite):
 *
 * - Filtros: rango de fechas (`#start_date`/`#end_date`, ambos
 *   `<input type="date">`, por defecto el día de hoy) + buscador de texto
 *   libre (`#product_search`, placeholder "Buscar..."). Ambos se aplican al
 *   hacer clic en "Buscar" (`#btn_search`, dispara
 *   `getSeacrhFamilyExpensesHeader` — nombre real del endpoint, con el typo
 *   incluido). No existe ningún otro filtro (tipo de gasto/categoría/
 *   estado/usuario/sucursal/caja/centro de costo): no hay ningún control
 *   real para ellos en el DOM.
 * - Exportación: únicamente "Descargar Excel" dentro del menú toggle
 *   "Descargar" (`#btn_download_report` → `#li_download_report1`,
 *   dispara `get_products_family_expense_to_excel(1)`). No existe botón de
 *   exportar a PDF ni CSV a nivel de listado (solo existe "Imprimir" por
 *   registro individual, ver abajo).
 * - Ordenamiento: no existe — los `<th>` de la tabla son `<span>` con ícono
 *   decorativo, sin `onclick` ni atributo de orden.
 * - Paginación: no se encontró ningún control de paginación en el DOM (ni
 *   siquiera oculto) con los registros reales disponibles en este ambiente.
 *   El propio `onclick` de "Buscar" (`search_family_expenses(0)`) sugiere que
 *   el backend podría soportar páginas, pero no se pudo confirmar ningún
 *   control de UI real sin crear decenas de registros adicionales en el
 *   ambiente compartido — no se crean pruebas de paginación por esto.
 * - Sin resultados: la tabla queda con una única fila real
 *   `tr.fem-empty-row` (colspan 5) con el texto "No se encontraron gastos
 *   operativos para los filtros seleccionados." — confirmado en vivo
 *   buscando un término inexistente.
 * - Cada fila tiene un menú de acciones (ícono de 3 puntos, `.pce-btn-more`)
 *   con 3 opciones reales: "Ver detalles" (abre el modal
 *   `#product_expense_family_detail` vía AJAX
 *   `getProductsFamilyExpensesHeader`, con Responsable/Fecha/Total y una
 *   tabla de productos del gasto), "Imprimir" (dispara AJAX
 *   `getprintVoucherFamilyExpense` y abre una pestaña nueva — igual que el
 *   resto de la suite, esa pestaña queda en `about:blank` en este ambiente,
 *   sin impresión automática configurada, no bloqueante) y "Eliminar"
 *   (`confirm_delete_subsidy`, ACCIÓN DESTRUCTIVA real). Mismo criterio que
 *   `ReporteCierreCajaPage` con "Enviar por correo"/"Enviar por WhatsApp":
 *   los tests solo verifican que "Eliminar" exista en el menú, nunca la
 *   ejecutan sobre datos reales del ambiente compartido.
 * - "Agregar" (`#add_family_expenses`) crea un gasto operativo nuevo — acción
 *   de escritura fuera del alcance de este reporte (ningún otro `rp-*` crea
 *   datos); no se prueba aquí. Ya hay registros reales en el ambiente para
 *   probar búsqueda/filtros/exportación/detalle/impresión sin necesidad de
 *   crear ninguno.
 * - Totales: `.fem-total` es simplemente el valor de la columna "Total" de
 *   cada fila — no existe ningún resumen/total agregado del listado
 *   completo aparte de la suma visible fila por fila.
 */
export class ReporteGastosOperativosPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#product_search');
  private readonly fechaInicial = () => this.page.locator('#start_date');
  private readonly fechaFinal = () => this.page.locator('#end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search');
  private readonly btnDescargarToggle = () => this.page.locator('#btn_download_report');
  private readonly opcionDescargarExcel = () => this.page.locator('#li_download_report1');
  private readonly contenedorTabla = () => this.page.locator('#table_family_expenses');
  private readonly filaSinResultados = () => this.page.locator('tr.fem-empty-row');
  private readonly modalDetalle = () => this.page.locator('#product_expense_family_detail');

  /** Columnas (0-based) de cada fila — confirmadas en vivo. */
  static readonly COLUMNA_CODIGO = 1;
  static readonly COLUMNA_FECHA = 2;
  static readonly COLUMNA_OBSERVACIONES = 3;
  static readonly COLUMNA_TOTAL = 4;

  async abrirReporteGastosOperativos() {
    await this.page.goto(URL_GASTOS_OPERATIVOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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
      (res) => res.url().includes('getSeacrhFamilyExpensesHeader'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnBuscar().click();
    await respuestaPromise;
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  /** Restaura el rango de fechas a "hoy" (valor por defecto real de la pantalla) y limpia el buscador. */
  async limpiarFiltros() {
    await this.aumentarRangoFechas(hoyISO(), hoyISO());
    await this.buscar('');
  }

  tabla(): Locator {
    return this.contenedorTabla().locator('xpath=ancestor::table[1]');
  }

  /** Filas reales de datos — excluye la fila `.fem-empty-row` del estado "sin resultados". */
  filas(): Locator {
    return this.contenedorTabla().locator('tr:not(.fem-empty-row)');
  }

  async contarFilas(): Promise<number> {
    return this.filas().count();
  }

  private async celdaDeFila(indice: number, columna: number): Promise<string> {
    return (await this.filas().nth(indice).locator('td').nth(columna).innerText()).trim();
  }

  async obtenerCodigoDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteGastosOperativosPage.COLUMNA_CODIGO);
  }

  async obtenerFechaDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteGastosOperativosPage.COLUMNA_FECHA);
  }

  async obtenerObservacionDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteGastosOperativosPage.COLUMNA_OBSERVACIONES);
  }

  async obtenerTotalDeFila(indice: number): Promise<string> {
    return this.celdaDeFila(indice, ReporteGastosOperativosPage.COLUMNA_TOTAL);
  }

  /**
   * Menú de acciones (ícono de 3 puntos) de la fila indicada (0-based) —
   * localizado dentro de la propia fila (`.dropdown .dropdown-menu`, ver el
   * HTML real documentado arriba), nunca por una clase global "abierto":
   * confirmado en vivo que Bootstrap no agrega ninguna clase `.show` al
   * `<ul>` de este menú al abrirlo (solo cambia su visibilidad real), así
   * que un locator global ambiguaría entre este menú y los demás menús
   * `.dropdown-menu` del layout (notificaciones, usuario, calendario).
   */
  private menuAccionesDeFila(indice: number): Locator {
    return this.filas().nth(indice).locator('.dropdown-menu');
  }

  /** Hace clic en "Descargar Excel" y devuelve el archivo generado. */
  async descargarExcel(): Promise<Download> {
    await this.btnDescargarToggle().click();
    const descarga = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.opcionDescargarExcel().click();
    return descarga;
  }

  /** Abre el menú de acciones (ícono de 3 puntos) de la fila indicada (0-based) y devuelve el texto de sus opciones. */
  async obtenerOpcionesAccionesFila(indice = 0): Promise<string[]> {
    await this.filas().nth(indice).locator('.pce-btn-more').click();
    await expect(this.menuAccionesDeFila(indice)).toBeVisible({ timeout: TIMEOUTS.CARGA });
    return this.menuAccionesDeFila(indice).locator('a').allInnerTexts();
  }

  /**
   * Abre "Ver detalles" de la fila indicada (0-based): despliega el menú de
   * acciones y selecciona la opción, esperando la respuesta real de
   * `getProductsFamilyExpensesHeader` y el modal visible. Devuelve el
   * Responsable/Fecha/Total mostrados y la cantidad de productos listados.
   */
  async abrirDetalle(indice = 0): Promise<{ responsable: string; fecha: string; total: string; cantidadProductos: number }> {
    await this.filas().nth(indice).locator('.pce-btn-more').click();
    await expect(this.menuAccionesDeFila(indice)).toBeVisible({ timeout: TIMEOUTS.CARGA });

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getProductsFamilyExpensesHeader'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.menuAccionesDeFila(indice).locator('a', { hasText: 'Ver detalles' }).click();
    await respuestaPromise;

    await expect(this.modalDetalle()).toBeVisible({ timeout: TIMEOUTS.CARGA });

    const cajas = this.modalDetalle().locator('.family-expenses-detail-box');
    const responsable = (await cajas.nth(0).locator('.family-expenses-detail-value').innerText()).trim();
    const fecha = (await cajas.nth(1).locator('.family-expenses-detail-value').innerText()).trim();
    const total = (await cajas.nth(2).locator('.family-expenses-detail-value').innerText()).trim();
    const cantidadProductos = await this.modalDetalle().locator('.opex-table tbody tr').count();

    return { responsable, fecha, total, cantidadProductos };
  }

  async cerrarDetalle() {
    await this.modalDetalle().locator('button.close, [data-dismiss="modal"]').first().click();
    await expect(this.modalDetalle()).toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * "Imprimir" de la fila indicada (0-based): dispara el AJAX real
   * (`getprintVoucherFamilyExpense`) y abre una pestaña nueva — confirmado
   * en vivo que esa pestaña queda en `about:blank` en este ambiente (sin
   * impresión automática configurada), mismo hallazgo ya documentado para
   * el resto de la suite (ver `mostrarYCerrarVentanaImpresion` en
   * pos-core.page.ts). Se cierra sin bloquear el test si no carga contenido.
   */
  async imprimirFila(indice = 0): Promise<{ seAbrioVentanaNueva: boolean }> {
    await this.filas().nth(indice).locator('.pce-btn-more').click();
    await expect(this.menuAccionesDeFila(indice)).toBeVisible({ timeout: TIMEOUTS.CARGA });

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getprintVoucherFamilyExpense'),
      { timeout: TIMEOUTS.CARGA }
    );
    const popupPromise = this.page.context().waitForEvent('page', { timeout: TIMEOUTS.CARGA }).catch(() => null);
    await this.menuAccionesDeFila(indice).locator('a', { hasText: 'Imprimir' }).click();
    await respuestaPromise;

    const popup = await popupPromise;
    if (popup) await popup.close().catch(() => {});
    return { seAbrioVentanaNueva: !!popup };
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarMensajeSinResultados() {
    await expect(
      this.filaSinResultados(),
      'El mensaje "No se encontraron gastos operativos para los filtros seleccionados." no apareció'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}
