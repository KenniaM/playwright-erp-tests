import { Download, expect, Locator, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';
import { SubmoduloReportes, TIMEOUTS } from './reportes.page';

export const SUBMODULOS_REPORTES_GASTOS_OPERATIVOS: SubmoduloReportes[] = [
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el botón real de búsqueda, que sí es visible. (`#code_expense`
    // existe en el DOM pero queda oculto dentro de un panel colapsado,
    // confirmado en vivo.)
    nombre: 'Gastos Operativos',
    url: BASE_URL + '/family_expenses/familyExpenses',
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

/** Convierte un monto mostrado en pantalla (p.ej. "$ 1,000.00", "$600.00") a number, para comparar montos sin importar espacios/símbolo de moneda. */
function montoANumero(texto: string): number {
  return parseFloat(texto.replace(/[^\d.-]/g, ''));
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
 *   (ACCIÓN DESTRUCTIVA real, ver `eliminarFila()` abajo). A diferencia del
 *   resto de la suite (donde "Eliminar" nunca se ejecuta por ser destructivo
 *   sobre datos compartidos), aquí SÍ se ejecuta en los tests — pero
 *   únicamente sobre gastos que el propio test crea primero con
 *   `guardarGastoModal()`, nunca sobre registros preexistentes del ambiente.
 * - "Agregar" (`#add_family_expenses`) abre el modal `#dialog_add_family_expenses`
 *   ("Agregar gasto operativo"): un gasto operativo es, en este ERP, una
 *   salida de productos reales del inventario (no un monto libre) — se busca
 *   un producto (`#search_parameter` + `#basic-addon3`, resultados reales
 *   `.afe-product-search-card` con `onclick="get_product_to_add(...)"`), se
 *   agrega a `#report_expense_table` (fila `tr#product_row_<id>` con cantidad
 *   editable `#product_quantity_<id>`, min 1) y el total del modal
 *   (`#opex-total-amount`) se recalcula en vivo como costo unitario ×
 *   cantidad. El único campo de texto libre es "Observaciones"
 *   (`#product_observation`); "# Código reporte" (`#code_expense`) es el
 *   único campo opcional adicional. "Guardar" dispara
 *   `validate_add_product_family_expenses()`, que exige confirmar un
 *   SweetAlert2 real ("¿Esta seguro de agregar este gasto operativo?", botón
 *   "Procesar") antes de llamar `addReportFamilyExpensesHeader` (responde
 *   `[{ family_expenses_header_id: N }]`); el éxito se anuncia con un
 *   `.noty_bar` ("¡Se ha guardado exitosamente!") y el modal se cierra solo.
 *   Ver `guardarGastoModal()` y el resto de métodos de esta sección.
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

  // Modal "Agregar gasto operativo" (`#dialog_add_family_expenses`).
  private readonly btnAgregarGasto = () => this.page.locator('#add_family_expenses');
  private readonly modalAgregarGasto = () => this.page.locator('#dialog_add_family_expenses');
  private readonly buscadorProductoModal = () => this.modalAgregarGasto().locator('#search_parameter');
  private readonly btnBuscarProductoModal = () => this.modalAgregarGasto().locator('#basic-addon3');
  private readonly resultadosProductoModal = () => this.modalAgregarGasto().locator('#product_option_view .afe-product-search-card');
  private readonly filasProductoModal = () => this.modalAgregarGasto().locator('#report_expense_table tr.product_row_table');
  private readonly totalMontoModal = () => this.modalAgregarGasto().locator('#opex-total-amount');
  private readonly campoCodigoReporteModal = () => this.modalAgregarGasto().locator('#code_expense');
  private readonly campoObservacionesModal = () => this.modalAgregarGasto().locator('#product_observation');
  private readonly btnGuardarModal = () => this.modalAgregarGasto().locator('.family-expenses-btn--success');

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

  /** Igual que obtenerTotalDeFila pero como number, para comparar montos exactos (ignora símbolo de moneda/espacios). */
  async obtenerTotalNumericoDeFila(indice: number): Promise<number> {
    return montoANumero(await this.obtenerTotalDeFila(indice));
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

  // ─── Agregar gasto operativo ──────────────────────────────────────────

  /** Abre el modal real "Agregar gasto operativo" (`#dialog_add_family_expenses`) presionando "+ Agregar". */
  async abrirModalAgregarGasto() {
    await this.btnAgregarGasto().click();
    await expect(this.modalAgregarGasto(), 'El modal "Agregar gasto operativo" no se abrió').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Busca un producto real por texto libre dentro del modal
   * (`#search_parameter` + botón de lupa `#basic-addon3`) y espera a que
   * aparezca al menos un resultado real (`.afe-product-search-card`).
   */
  async buscarProductoEnModalAgregar(termino: string) {
    await this.buscadorProductoModal().fill(termino);
    await this.btnBuscarProductoModal().click();
    await expect.poll(() => this.resultadosProductoModal().count(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThan(0);
  }

  /**
   * Agrega a la tabla del modal el primer producto real de los resultados de
   * búsqueda (`get_product_to_add(...)`) y devuelve el id real del producto
   * agregado junto con su costo unitario (campo oculto
   * `#product_hide_cost_<id>`, leído justo tras agregarlo, cuando la
   * cantidad todavía es 1) — necesario para calcular el total esperado tras
   * fijar la cantidad.
   */
  async agregarPrimerProductoResultadoModal(): Promise<{ productId: string; costoUnitario: number }> {
    const filasAntes = await this.filasProductoModal().count();
    await this.resultadosProductoModal().first().click();
    await expect.poll(() => this.filasProductoModal().count(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThan(filasAntes);

    const filaNueva = this.filasProductoModal().last();
    const idFila = await filaNueva.getAttribute('id'); // "product_row_<id>"
    const productId = (idFila ?? '').replace('product_row_', '');
    const costoUnitario = montoANumero(await this.modalAgregarGasto().locator(`#product_hide_cost_${productId}`).inputValue());
    return { productId, costoUnitario };
  }

  /**
   * Cambia la cantidad del producto agregado (por su id real) y espera a que
   * el total del modal (`#opex-total-amount`) refleje el nuevo monto
   * esperado (costo unitario × cantidad) — valida en vivo que el cálculo se
   * actualiza correctamente antes de guardar.
   */
  async fijarCantidadProductoModal(productId: string, cantidad: number, costoUnitario: number) {
    const cantidadInput = this.modalAgregarGasto().locator(`#product_quantity_${productId}`);
    await cantidadInput.fill(String(cantidad));
    await cantidadInput.dispatchEvent('change');
    await expect
      .poll(async () => montoANumero((await this.totalMontoModal().textContent()) ?? ''), { timeout: TIMEOUTS.CARGA })
      .toBe(costoUnitario * cantidad);
  }

  /** Llena el campo opcional "# Código reporte" del modal "Agregar gasto operativo". */
  async llenarCodigoReporteModal(texto: string) {
    await this.campoCodigoReporteModal().fill(texto);
  }

  /** Llena el campo "Observaciones" del modal "Agregar gasto operativo". */
  async llenarObservacionesModal(texto: string) {
    await this.campoObservacionesModal().fill(texto);
  }

  /**
   * Presiona "Guardar", confirma el SweetAlert2 real ("¿Esta seguro de
   * agregar este gasto operativo?", botón "Procesar") y espera la respuesta
   * real de `addReportFamilyExpensesHeader` (`[{ family_expenses_header_id:
   * N }]`). El propio modal se cierra solo tras el guardado exitoso — no
   * hace falta cerrarlo manualmente. Devuelve el id real del gasto creado.
   */
  async guardarGastoModal(): Promise<number> {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('addReportFamilyExpensesHeader'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.btnGuardarModal().click();

    const confirmacion = this.page.locator('.swal2-popup', { hasText: 'agregar este gasto operativo' });
    await expect(confirmacion, 'No apareció la confirmación "¿Esta seguro de agregar este gasto operativo?"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await confirmacion.locator('.swal2-confirm').click();

    const respuesta = await respuestaPromise;
    const cuerpo = (await respuesta.json()) as Array<{ family_expenses_header_id: number }>;

    await expect(
      this.page.locator('.noty_bar', { hasText: 'guardado exitosamente' }),
      'No apareció el mensaje "¡Se ha guardado exitosamente!"'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await expect(this.modalAgregarGasto(), 'El modal "Agregar gasto operativo" no se cerró tras guardar').toBeHidden({ timeout: TIMEOUTS.CARGA });

    return cuerpo[0].family_expenses_header_id;
  }

  // ─── Eliminar gasto operativo ─────────────────────────────────────────

  /**
   * Elimina la fila indicada (0-based) desde su menú de acciones: abre el
   * menú, presiona "Eliminar", confirma el SweetAlert2 real ("¡Eliminar
   * gasto operativo! ¿Desea continuar?", botón "Eliminar") y espera la
   * respuesta real de `delete_operating_expense`. A diferencia del SweetAlert2
   * de "Agregar", el de éxito de esta acción ("¡Éxito! El gasto operativo se
   * eliminó correctamente...") NO se autocierra — hay que presionar
   * "Aceptar" (confirmado en vivo).
   */
  async eliminarFila(indice = 0) {
    await this.filas().nth(indice).locator('.pce-btn-more').click();
    await expect(this.menuAccionesDeFila(indice)).toBeVisible({ timeout: TIMEOUTS.CARGA });

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('delete_operating_expense'),
      { timeout: TIMEOUTS.CARGA }
    );
    await this.menuAccionesDeFila(indice).locator('a', { hasText: 'Eliminar' }).click();

    const confirmacion = this.page.locator('.swal2-popup', { hasText: 'Eliminar gasto operativo' });
    await expect(confirmacion, 'No apareció la confirmación "¡Eliminar gasto operativo!"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await confirmacion.locator('.swal2-confirm').click();

    await respuestaPromise;

    const exito = this.page.locator('.swal2-popup', { hasText: 'se eliminó correctamente' });
    await expect(exito, 'No apareció el mensaje de éxito de la eliminación').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await exito.locator('.swal2-confirm').click();
    await expect(exito).toBeHidden({ timeout: TIMEOUTS.CARGA });
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
