import { Download, expect, Locator, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';
import { contentHeaderConTexto, SubmoduloReportes, TIMEOUTS } from './reportes.page';

export const SUBMODULOS_REPORTES_CAJA: SubmoduloReportes[] = [
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el buscador real, que sí es visible.
    nombre: 'Cierres de Caja',
    url: BASE_URL + '/reports/cashReport',
    rutaEsperada: 'cashReport',
    tituloEsperado: /reporte de cierre/i,
    obtenerLocatorDeCarga: (page: Page) => page.locator('#newSearchInput'),
  },
  {
    nombre: 'Movimientos de Caja',
    url: BASE_URL + '/reports/cash_movement_report',
    rutaEsperada: 'cash_movement_report',
    tituloEsperado: /movimientos de caja/i,
    obtenerLocatorDeCarga: (page: Page) => contentHeaderConTexto(page, /movimientos de caja/i),
  },
];

const URL_CIERRES_DE_CAJA = SUBMODULOS_REPORTES_CAJA[0].url;
const URL_MOVIMIENTOS_DE_CAJA = SUBMODULOS_REPORTES_CAJA[1].url;

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

/** No hay ningún mensaje de error de aplicación (`.noty_bar`) visible en pantalla. */
async function validarSinErrores(page: Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

/**
 * El layout general (compartido por todo el ERP, no solo Reportes > Caja)
 * puede mostrar un banner de "Activar notificaciones" al cargar la página.
 * Confirmado en vivo que intercepta clics sobre controles reales (p.ej. el
 * menú de exportar Excel) cuando queda visible — se descarta de forma
 * best-effort tras cada navegación, igual que los modales de compañía/caja
 * que ya maneja el resto de la suite (ver CLAUDE.md).
 */
async function cerrarBannerNotificaciones(page: Page) {
  await page.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 3000 }).catch(() => {});
}

// ─── Reporte de Movimientos de Caja ────────────────────────────────────────

/**
 * Reporte de Movimientos de Caja (reports/cash_movement_report).
 *
 * Confirmado en vivo:
 * - Filtros: rango de fechas (#cash_start_date/#cash_end_date, ambos
 *   `<input type="date">`, por defecto el día de hoy) + buscador de texto
 *   libre (#cash_movement_search). Ambos se aplican al hacer clic en
 *   "Buscar" (#btn_search_cash_movement). No existe ningún otro filtro
 *   (usuario/caja/estado/sucursal) pese a que la tabla sí tiene columna
 *   "Compañía".
 * - Exportación: únicamente "Descargar" en Excel
 *   (#btn_cash_movement_excel_report). No existe botón de exportar a PDF en
 *   este reporte.
 * - Sin resultados: no hay mensaje de "sin resultados" — la tabla queda con
 *   `tbody` vacío bajo el mismo encabezado de columnas.
 * - En el ambiente de QA no hay ningún movimiento de caja registrado en
 *   ningún rango de fechas (confirmado en vivo probando desde 2020-01-01
 *   hasta 2026-12-31). Aun así, "Descargar" sí genera un Excel real (con
 *   solo encabezados) cuando la tabla está vacía — no existe una guardia que
 *   lo bloquee por falta de resultados.
 */
export class ReporteMovimientosCajaPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#cash_movement_search');
  private readonly fechaInicial = () => this.page.locator('#cash_start_date');
  private readonly fechaFinal = () => this.page.locator('#cash_end_date');
  private readonly btnBuscar = () => this.page.locator('#btn_search_cash_movement');
  private readonly btnDescargarExcel = () => this.page.locator('#btn_cash_movement_excel_report');
  private readonly contenedorTabla = () => this.page.locator('#div_content_table_cash_movement');

  async abrir() {
    await this.page.goto(URL_MOVIMIENTOS_DE_CAJA, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  /**
   * Corrección de automatización confirmada en vivo: el click en "Buscar"
   * (`#btn_search_cash_movement`) puede quedar bloqueado indefinidamente por
   * el mismo banner de notificaciones ya documentado en el resto de la
   * suite (`#workshop-web-notification-permission`, puede reaparecer de
   * forma asíncrona) — reproducido con el timeout completo del test
   * (90s) agotado en un único intento largo. Mismo patrón de reintentos
   * cortos cerrando el banner antes de cada uno ya usado en
   * `ReporteCierreCajaPage.buscar()`, que sí lo tenía.
   */
  async buscar(termino = '') {
    await this.buscador().fill(termino);

    const MAX_INTENTOS = 5;
    let ultimoError: unknown;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      await cerrarBannerNotificaciones(this.page);
      try {
        await this.btnBuscar().click({ timeout: 5_000 });
        return;
      } catch (e) {
        ultimoError = e;
      }
    }
    throw ultimoError instanceof Error
      ? ultimoError
      : new Error(`ReporteMovimientosCajaPage.buscar() falló tras ${MAX_INTENTOS} intentos: ${String(ultimoError)}`);
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

  /** Hace clic en "Descargar" y devuelve el Excel generado (incluso con la tabla vacía). */
  async descargarExcel(): Promise<Download> {
    const descarga = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
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

// ─── Reporte de Cierres de Caja ────────────────────────────────────────────

/**
 * Reporte de Cierres de Caja (reports/cashReport).
 *
 * Confirmado en vivo:
 * - Filtros: rango de fechas (#ui_start_date/#ui_end_date, `<input
 *   type="date">`, por defecto el mes en curso) + buscador de texto libre
 *   (#newSearchInput, placeholder "Buscar cierres..."). Ambos se aplican al
 *   hacer clic en "Aplicar Filtros" (#applyFiltersNew) — escribir en el
 *   buscador por sí solo no filtra la tabla (confirmado esperando sin
 *   resultado). No existe ningún otro filtro (usuario/caja/estado/sucursal).
 * - Exportación: solo Excel, con un menú de 2 variantes tras el botón toggle
 *   "Descargar Excel" (#btn_cash_excel_toggle): "Solo cierre de caja"
 *   (#btn_cash_excel_summary) y "Detallado" (#btn_cash_excel_detail). No
 *   existe botón de exportar a PDF en este reporte.
 * - Sin resultados: igual que Movimientos de Caja, no hay mensaje explícito
 *   de "sin resultados"; la tabla queda con `tbody` vacío.
 * - Cada fila tiene un menú de acciones (ícono de 3 puntos,
 *   `.btn-dropdown-trigger`) con "Ver Detalle", "Enviar por correo" y
 *   "Enviar por WhatSapp". Las dos últimas envían comunicaciones reales, así
 *   que las pruebas solo verifican que el menú se despliegue con las
 *   opciones esperadas, sin ejecutar el envío.
 * - "Ver Detalle" (`getCashClosureDetail(id, monedas)`, investigado en vivo)
 *   NO navega a otra página ni abre un `<div class="modal">` de Bootstrap:
 *   inyecta un `.cash-closure-modal-content` propio (sin backdrop conocido,
 *   sin clase "modal") directamente en el DOM de la misma página. Su
 *   contenido — confirmado en vivo, ver `DetalleCierreReporte` — es
 *   exactamente el mismo "Detalle de Cierre" que ya expone el propio POS
 *   (`PosCierreCaja.leerResumenTabGeneral()`), pero ya PERSISTIDO como cierre
 *   real: la fuente correcta para la validación cruzada POS vs. Reporte que
 *   pide CLAUDE.md (comparar lo que el cajero vio al cerrar contra lo que el
 *   reporte muestra después). Soporta alternar entre la moneda "GENERAL"
 *   (agregada, la que se lee por defecto) y cada moneda individual de la
 *   compañía vía un radio `.currency-toggle` por moneda.
 */
export type DetalleCierreReporte = {
  compania: string;
  caja: string;
  responsable: string;
  noCierre: string;
  informacionGeneral: {
    fecha: string;
    hora: string;
    transacciones: number;
    ventaPromedioPorTransaccion: number;
  };
  flujoEfectivo: {
    saldoAperturaCaja: number;
    efectivoCierreCaja: number;
    diferenciaCierre: number;
    efectivoSiguienteCaja: number;
  };
  metodosPago: {
    efectivo: number;
    tarjeta: number;
    transaccion: number;
    sinpeMovil: number;
    total: number;
  };
  analisisIngresos: {
    ventasDirectas: number;
    ingresosTaller: number;
    salidasCaja: number;
    devoluciones: number;
    totalSalida: number;
  };
};

/** Convierte a número un monto monetario de este reporte (p. ej. "$ 1,234.56", "-$ 0.00"), preservando el signo. */
function leerMonto(texto: string): number {
  return parseFloat(texto.replace(/[^0-9.-]/g, '')) || 0;
}

export class ReporteCierreCajaPage {
  constructor(private readonly page: Page) {}

  private readonly buscador = () => this.page.locator('#newSearchInput');
  private readonly fechaInicial = () => this.page.locator('#ui_start_date');
  private readonly fechaFinal = () => this.page.locator('#ui_end_date');
  private readonly btnAplicarFiltros = () => this.page.locator('#applyFiltersNew');
  private readonly btnDescargarExcelToggle = () => this.page.locator('#btn_cash_excel_toggle');
  private readonly opcionExcelResumen = () => this.page.locator('#btn_cash_excel_summary');
  private readonly opcionExcelDetalle = () => this.page.locator('#btn_cash_excel_detail');
  private readonly contenedorTabla = () => this.page.locator('#div_content_table_cash');
  private readonly menuAccionesAbierto = () => this.page.locator('.dropdown-actions-menu.show');

  /**
   * Índice de columna (0-based) de "Caja / Cajero" en cada fila — confirmado en
   * vivo volcando los `<th>` reales de la tabla: ["/ FECHA", "CAJA / CAJERO",
   * "APERTURA", "VENTAS / EFECTIVO", "CIERRE", "SIGUIENTE CAJA", "ACCIONES"].
   * Corrección de automatización confirmada en vivo: el valor anterior (4)
   * apuntaba en realidad a la columna "CIERRE" (monto de cierre + diferencia),
   * no a "Caja / Cajero" — causaba que `obtenerCajeroDeFila()` devolviera un
   * texto de montos en vez de un nombre, rompiendo la búsqueda por cajero.
   */
  static readonly COLUMNA_CAJERO = 1;

  async abrir() {
    await this.page.goto(URL_CIERRES_DE_CAJA, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
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

  /**
   * Corrección de automatización confirmada en vivo (corrida real con
   * `--workers=2`): el click en "Aplicar Filtros" (`#applyFiltersNew`) puede
   * quedar bloqueado de forma intermitente por el mismo banner de
   * notificaciones ya documentado en el resto de la suite
   * (`#workshop-web-notification-permission`, que puede reaparecer de forma
   * asíncrona) y también, bajo carga, por el propio encabezado fijo de la
   * app (`<header class="main-header">`) interceptando el punto de click —
   * mismo patrón de overlay transitorio ya resuelto en
   * `PosCierreCaja.abrirMenuCaja()`. Se aplican reintentos cortos y
   * acotados cerrando el banner conocido antes de cada uno, en vez de un
   * único click con timeout largo.
   */
  async buscar(termino = '') {
    await this.buscador().fill(termino);

    const MAX_INTENTOS = 5;
    let ultimoError: unknown;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      await cerrarBannerNotificaciones(this.page);
      try {
        await this.btnAplicarFiltros().click({ timeout: 5_000 });
        return;
      } catch (e) {
        ultimoError = e;
      }
    }
    throw ultimoError instanceof Error
      ? ultimoError
      : new Error(`ReporteCierreCajaPage.buscar() falló tras ${MAX_INTENTOS} intentos: ${String(ultimoError)}`);
  }

  async limpiarBusqueda() {
    await this.buscar('');
  }

  tabla(): Locator {
    return this.contenedorTabla().locator('table.cash-table');
  }

  /**
   * Filas de datos reales — excluye la fila placeholder "sin resultados"
   * (`tr.cash-empty-row`, confirmada en vivo con una única `<td>` y el texto
   * "No se encontraron cierres de caja para los filtros seleccionados...").
   * Corrección de automatización confirmada en vivo: sin este filtro,
   * `contarFilas()` devolvía 1 (esa fila placeholder) en vez de 0 cuando una
   * búsqueda no encuentra resultados, contradiciendo el criterio real de
   * "sin resultados" del resto de la suite.
   */
  filas(): Locator {
    return this.tabla().locator('tbody tr:not(.cash-empty-row)');
  }

  async contarFilas(): Promise<number> {
    return this.filas().count();
  }

  /**
   * Texto compuesto completo de la columna "Caja / Cajero" de la fila
   * indicada (0-based) — incluye tanto "Caja: X" como "Cajero: Y". Ver
   * `obtenerNombreCajeroDeFila()` para el nombre del cajero aislado.
   */
  async obtenerCajaCajeroDeFila(indice: number): Promise<string> {
    return this.filas().nth(indice).locator('td').nth(ReporteCierreCajaPage.COLUMNA_CAJERO).innerText();
  }

  /**
   * Nombre real del cajero de la fila indicada (0-based), aislado del resto
   * de la celda compuesta "Caja / Cajero" — confirmado en vivo que esa celda
   * es `<div class="cash-row-title">Caja: X</div><div class="cash-row-meta">
   * <i.../><span>Cajero:</span> <span class="cash-row-value">Y</span></div>`,
   * así que el nombre real vive en el SEGUNDO `.cash-row-value` de la celda
   * (el primero, dentro de `.cash-row-title`, es el nombre de la CAJA, no del
   * cajero). Corrección de automatización confirmada en vivo: leer
   * `innerText()` de la celda completa (como hacía `obtenerCajeroDeFila()`
   * antes de esta corrección) devuelve "Caja: X\nCajero: \nY" — tomar la
   * primera palabra de ese texto (como hace el spec) aísla "Caja:", no el
   * nombre real.
   */
  async obtenerNombreCajeroDeFila(indice: number): Promise<string> {
    const celda = this.filas().nth(indice).locator('td').nth(ReporteCierreCajaPage.COLUMNA_CAJERO);
    return celda.locator('.cash-row-meta .cash-row-value').innerText();
  }

  /** Nombre real de la caja (no del cajero) de la fila indicada (0-based). */
  async obtenerNombreCajaDeFila(indice: number): Promise<string> {
    const celda = this.filas().nth(indice).locator('td').nth(ReporteCierreCajaPage.COLUMNA_CAJERO);
    return celda.locator('.cash-row-title .cash-row-value').innerText();
  }

  /**
   * Lee los 3 montos de la columna "APERTURA" del listado (columna 2,
   * confirmada en vivo) — "Caja Ant." (el efectivo tomado como referencia
   * del cierre anterior de la misma caja), "Saldo" (el monto digitado al
   * abrir esta caja) y "Dif. Apert." (Saldo - Caja Ant.), en ese mismo
   * orden real del DOM (confirmado volcando el `outerHTML` completo de la
   * celda: 3 `<div class="cash-amount-line">`, cada uno con su etiqueta
   * seguida de su propio `.cash-amount-value`).
   *
   * BUG DE SISTEMA CONFIRMADO — causa raíz exacta localizada leyendo el
   * código fuente real (`js/report_cash.js`, función que arma esta fila) y
   * comparándolo contra el JSON crudo real de `getCashSearch` (endpoint que
   * alimenta este listado) en 3 casos controlados con montos de apertura
   * conocidos y verificados de forma independiente (vía el propio "Resumen
   * de cierre: + Apertura" del Tab General del POS):
   *
   *   var openingComparisonBalance = parseFloat(c.previous_cash_balance || c.previous_cash || c.previous_balance || '');
   *   if (isNaN(openingComparisonBalance)) {
   *       openingComparisonBalance = (parseFloat(c.open_balance || 0) - openingDifference); // openingDifference = c.missing_cash_balance
   *   }
   *   // "Caja ant." muestra openingComparisonBalance; "Saldo" muestra fmt(c.open_balance); "Dif. apert." muestra openingDifference.
   *
   * El backend (`getCashSearch`) JAMÁS envía ninguno de los 3 campos que el
   * frontend intenta leer primero para "Caja ant." (`previous_cash_balance`
   * / `previous_cash` / `previous_balance` — ausentes de la respuesta real
   * en TODAS las filas observadas), así que siempre cae al fallback de
   * arriba. Esa parte del frontend NO está rota: es matemáticamente
   * correcta — confirmado inyectando `open_balance` real vía fetch directo
   * a `openPosCash` (mismo payload exacto del handler real): con
   * `open_balance`/`missing_cash_balance` correctos, el fallback SÍ
   * reproduce la Caja Ant. real exacta, confirmado tanto en HONDURAS como
   * en TALLER ALPHA PREMIUM (cuenta Super Administrador).
   *
   * La causa raíz real está en el BACKEND, y es más sutil que "el campo se
   * pierde": interceptando con `page.on('request')` el payload que el
   * navegador envía al hacer clic NATIVO en "Abrir Caja" se confirmó que
   * `open_balance` SIEMPRE llega correcto al servidor — descarta cualquier
   * causa de automatización o de la app cliente. El problema aparece en
   * secuencias de VARIAS aperturas/cierres seguidos de la misma caja: la
   * fila del cierre de una sesión terminó mostrando el `open_balance` de
   * la apertura de la SESIÓN ANTERIOR, no la suya propia (`total` de esa
   * misma fila sí mostró el valor correcto) — un bug de ASOCIACIÓN/JOIN
   * entre la tabla de cierres y la de aperturas (parece emparejar por
   * orden/fecha, no por un ID de sesión explícito), no una pérdida del
   * dato. Es INTERMITENTE: no se reprodujo en secuencias limpias de una
   * sola apertura+cierre (ahí `open_balance` llegó correcto, en ambas
   * compañías), solo tras varias operaciones seguidas — no se confirmó si
   * depende de la velocidad/cantidad de aperturas recientes. "Dif. Apert."
   * es la única de las 3 que consistentemente calculó bien, porque usa
   * `missing_cash_balance`, un campo que no depende de este join. Ver el
   * test `test.fail()` dedicado en rp-caja.spec.ts ("BUG CONOCIDO: la
   * columna APERTURA...") y la memoria de esta sesión para el detalle
   * completo de ambas rondas de investigación.
   */
  async obtenerAperturaDeFila(indice: number): Promise<{ cajaAnterior: number; saldo: number; diferenciaApertura: number }> {
    const celda = this.filas().nth(indice).locator('td').nth(2);
    const valores = await celda.locator('.cash-amount-value').allInnerTexts();
    return {
      cajaAnterior: leerMonto(valores[0] ?? '0'),
      saldo: leerMonto(valores[1] ?? '0'),
      diferenciaApertura: leerMonto(valores[2] ?? '0'),
    };
  }

  /**
   * Texto crudo de la columna "CIERRE" (monto de cierre + diferencia) de la
   * fila indicada (0-based) — columna 4, confirmada en vivo. Útil para
   * localizar de forma determinística, SIN abrir "Ver Detalle" de cada fila,
   * la fila que corresponde a un cierre real recién generado con un monto de
   * efectivo de cierre conocido (ver el escenario de validación cruzada en
   * rp-caja.spec.ts).
   */
  async obtenerTextoCierreDeFila(indice: number): Promise<string> {
    return this.filas().nth(indice).locator('td').nth(4).innerText();
  }

  /** Texto crudo de la columna "SIGUIENTE CAJA" de la fila indicada (0-based) — columna 5, confirmada en vivo. */
  async obtenerTextoSiguienteCajaDeFila(indice: number): Promise<string> {
    return this.filas().nth(indice).locator('td').nth(5).innerText();
  }

  /**
   * Localiza el índice (0-based) de la primera fila cuya columna "CIERRE"
   * contiene el monto indicado (formateado con 2 decimales, sin importar el
   * signo `$`/separadores de miles) — pensado para encontrar, entre los
   * cierres del rango buscado, el que corresponde a un efectivo de cierre
   * único generado por la propia prueba. Devuelve `null` si no aparece en
   * ninguna fila visible.
   */
  async localizarFilaPorMontoCierre(monto: number): Promise<number | null> {
    const totalFilas = await this.contarFilas();
    const montoTexto = monto.toFixed(2);
    for (let i = 0; i < totalFilas; i++) {
      const texto = await this.obtenerTextoCierreDeFila(i);
      if (texto.includes(montoTexto)) return i;
    }
    return null;
  }

  async descargarExcelResumen(): Promise<Download> {
    await this.btnDescargarExcelToggle().click();
    const descarga = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.opcionExcelResumen().click();
    return descarga;
  }

  async descargarExcelDetalle(): Promise<Download> {
    await this.btnDescargarExcelToggle().click();
    const descarga = this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA });
    await this.opcionExcelDetalle().click();
    return descarga;
  }

  /** Abre el menú de acciones de la fila indicada (0-based) y devuelve el texto de sus opciones. */
  async obtenerOpcionesAccionesFila(indice = 0): Promise<string[]> {
    await this.filas().nth(indice).locator('.btn-dropdown-trigger').click();
    await expect(this.menuAccionesAbierto()).toBeVisible({ timeout: TIMEOUTS.CARGA });
    return this.menuAccionesAbierto().locator('.dropdown-item').allInnerTexts();
  }

  // ─── Modal "Ver Detalle" ──────────────────────────────────────────────────

  /** El propio contenedor inyectado por `getCashClosureDetail()` — ver el comentario de la clase. */
  modalDetalle(): Locator {
    return this.page.locator('.cash-closure-modal-content');
  }

  /**
   * Abre "Ver Detalle" de la fila indicada (0-based) desde su menú de
   * acciones y espera a que el contenido quede visible. `getCashClosureDetail`
   * es una petición AJAX real (confirmada en vivo con `page.on('response')`);
   * `expect().toBeVisible()` sobre el propio contenido (no un timeout fijo)
   * es lo que absorbe esa latencia.
   */
  async abrirDetalleFila(indice = 0): Promise<void> {
    await this.filas().nth(indice).locator('.btn-dropdown-trigger').click();
    await expect(this.menuAccionesAbierto()).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await this.menuAccionesAbierto().locator('.dropdown-item', { hasText: /ver detalle/i }).click();
    await expect(this.modalDetalle(), '"Detalle de cierre" no apareció').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Cierra "Ver Detalle" con su botón "×" real (`closeCashClosureModal()`, confirmado en vivo). */
  async cerrarDetalleFila(): Promise<void> {
    await this.modalDetalle().locator('.cash-closure-close').click();
    await expect(this.modalDetalle()).toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Cambia la moneda mostrada dentro de "Ver Detalle" ya abierto —
   * `codigo` es el `data-code` real del radio (p. ej. "ALL" para GENERAL,
   * "USD", "CRC", confirmados en vivo). Los montos de las 4 tarjetas se
   * recalculan en el propio cliente (sin nueva petición AJAX, confirmado en
   * vivo) al togglear.
   */
  async seleccionarMonedaEnDetalle(codigo: string): Promise<void> {
    await this.modalDetalle().locator(`.currency-toggle input[data-code="${codigo}"]`).evaluate(
      (el) => (el as HTMLElement).click()
    );
  }

  /** Lee TODOS los valores de "Ver Detalle" (ya abierto) en un solo snapshot — ver `DetalleCierreReporte`. */
  async leerDetalleCierre(): Promise<DetalleCierreReporte> {
    const modal = this.modalDetalle();

    const meta = await modal.locator('.cash-closure-header-meta p').allInnerTexts();
    const leerMeta = (etiqueta: string) => {
      const linea = meta.find((l) => l.toLowerCase().startsWith(etiqueta.toLowerCase()));
      return linea?.replace(new RegExp(`^${etiqueta}:?`, 'i'), '').trim() ?? '';
    };

    const leerItem = async (tituloCard: RegExp, etiqueta: RegExp): Promise<string> => {
      const card = modal.locator('.cash-closure-card', { has: this.page.locator('h3', { hasText: tituloCard }) });
      const item = card.locator('.cash-closure-item', { has: this.page.locator('.label', { hasText: etiqueta }) });
      return item.locator('.value').innerText();
    };

    return {
      compania: leerMeta('Compañía'),
      caja: leerMeta('Caja'),
      responsable: leerMeta('Responsable'),
      noCierre: leerMeta('No. cierre'),
      informacionGeneral: {
        fecha: await leerItem(/información general/i, /^fecha/i),
        hora: await leerItem(/información general/i, /^hora/i),
        transacciones: leerMonto(await leerItem(/información general/i, /^transacciones/i)),
        ventaPromedioPorTransaccion: leerMonto(await leerItem(/información general/i, /venta promedio/i)),
      },
      flujoEfectivo: {
        saldoAperturaCaja: leerMonto(await leerItem(/flujo de efectivo/i, /saldo apertura/i)),
        efectivoCierreCaja: leerMonto(await leerItem(/flujo de efectivo/i, /efectivo del cierre/i)),
        diferenciaCierre: leerMonto(await leerItem(/flujo de efectivo/i, /diferencia de cierre/i)),
        efectivoSiguienteCaja: leerMonto(await leerItem(/flujo de efectivo/i, /efectivo para siguiente caja/i)),
      },
      metodosPago: {
        efectivo: leerMonto(await leerItem(/métodos de pago/i, /^\s*efectivo\s*$/i)),
        tarjeta: leerMonto(await leerItem(/métodos de pago/i, /^\s*tarjeta\s*$/i)),
        transaccion: leerMonto(await leerItem(/métodos de pago/i, /^\s*transacción\s*$/i)),
        sinpeMovil: leerMonto(await leerItem(/métodos de pago/i, /sinpe/i)),
        total: leerMonto(await leerItem(/métodos de pago/i, /total/i)),
      },
      analisisIngresos: {
        ventasDirectas: leerMonto(await leerItem(/análisis de ingresos/i, /ventas directas/i)),
        ingresosTaller: leerMonto(await leerItem(/análisis de ingresos/i, /ingresos de taller/i)),
        salidasCaja: leerMonto(await leerItem(/análisis de ingresos/i, /salidas de caja/i)),
        devoluciones: leerMonto(await leerItem(/análisis de ingresos/i, /devoluciones/i)),
        totalSalida: leerMonto(await leerItem(/análisis de ingresos/i, /total de salida/i)),
      },
    };
  }

  async validarTabla() {
    await expect(this.tabla()).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async validarSinErrores() {
    await validarSinErrores(this.page);
  }
}
