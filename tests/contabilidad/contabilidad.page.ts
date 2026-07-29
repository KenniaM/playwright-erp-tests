import { Locator, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  // Cada submódulo popula su contenido (filtros/tabla) vía AJAX tras cargar
  // la página — se hace polling hasta este límite antes de leer su estado.
  CARGA:    15_000,
} as const;

// ─── Submódulos ───────────────────────────────────────────────────────────────

/**
 * Submódulos del menú "Contabilidad" (URLs confirmadas en vivo desde el menú
 * lateral del dashboard). Esta lista corresponde exactamente a la solicitada
 * por el usuario — el menú real tiene además "Línea de crédito" (sección
 * raíz), "Sub Cuentas" y "Configuración de Reportes" (sección
 * "Configuraciones adicionales"), que se omiten a propósito por no estar en
 * la lista pedida.
 *
 * La mayoría de estas pantallas no usan `.content-header` (a diferencia de
 * la mayoría de módulos anteriores) sino un encabezado real visible — la
 * mayoría es un `<h2>`, salvo "Dashboard Contable" que sí es `<h1>`
 * (confirmado en vivo elemento por elemento, tras un primer intento fallido
 * asumiendo `<h1>` para todos). "Cuentas bancarias", "Tipo de movimiento" y
 * "Depósitos y transferencias" reutilizan los mismos locators ya confirmados
 * en bancos.page.ts (mismas URLs, mismo menú duplicado entre "Bancos" y
 * "Contabilidad").
 *
 * "Solicitudes de bancos" NO reutiliza el locator de "Solicitudes" de
 * bancos.page.ts — son dos entradas de menú reales y DISTINTAS bajo
 * "Contabilidad > Bancos" (confirmado en vivo, ambas visibles en el sidebar
 * al mismo tiempo): "Solicitudes" (`/bnkpaymentrequest/bnk_payment_request`,
 * título de pestaña "Solicitudes de cheque", pantalla antigua con el botón
 * `#btnRequest`) y "Solicitudes de bancos" (`/bank_requests/index_Bank`,
 * título de pestaña "Solicitudes de Bancos", pantalla nueva con filtros,
 * contadores de estado y toggle Tabla/Kanban). Esta lista cubre únicamente
 * la segunda — no tiene `.content-header` (0 en el DOM, confirmado en vivo),
 * así que se valida con `#bnk_btn_new` ("Nueva solicitud"), el único botón
 * del toolbar que solo queda visible una vez que el AJAX real de la lista
 * terminó de cargar.
 */
export type SubmoduloContabilidad = {
  nombre: string;
  url: string;
  // Substring que debe contener la URL final tras navegar, para detectar
  // redirecciones inesperadas (p.ej. a login por sesión expirada).
  rutaEsperada: string;
  tituloEsperado: RegExp;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

export const SUBMODULOS_CONTABILIDAD: SubmoduloContabilidad[] = [
  {
    nombre: 'Dashboard Contable',
    url: BASE_URL + '/acaccountingdashboard/index',
    rutaEsperada: 'acaccountingdashboard',
    tituloEsperado: /dashboard contable/i,
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /dashboard contable/i }),
  },
  {
    // Renombrado en vivo por el sistema (confirmado reproducible 3/3 veces):
    // el link del sidebar y el `<title>` ya no dicen "Asiento de diario" sino
    // "Asientos y contabilización" — misma URL, mismo contenido funcional
    // (IDs `jd_*` de asientos: `jd_new_journal`, `jd_stat_*`, `tJournal`).
    // Sin `<h2>` visible con ese texto (solo aparece "Gestión Contable", el
    // encabezado de la sección del sidebar, no de la pantalla) — se valida
    // con `#jd_new_journal` ("Nuevo asiento"), mismo patrón ya usado para
    // "Solicitudes de bancos" (`#bnk_btn_new`) y "Reporte de bancos"
    // (`#ac_br_search`).
    nombre: 'Asientos y contabilización',
    url: BASE_URL + '/acjournalentry/ac_journal_entry',
    rutaEsperada: 'ac_journal_entry',
    tituloEsperado: /asientos y contabilizaci[oó]n/i,
    obtenerLocatorDeCarga: (page) => page.locator('#jd_new_journal'),
  },
  // ─── Bancos ───────────────────────────────────────────────────────────────
  {
    nombre: 'Cuentas bancarias',
    url: BASE_URL + '/bank_account/bank_account',
    rutaEsperada: 'bank_account/bank_account',
    tituloEsperado: /cuentas bancarias/i,
    obtenerLocatorDeCarga: (page) => page.locator('input[placeholder="Buscar por banco o número de cuenta..."]'),
  },
  {
    nombre: 'Tipo de movimiento',
    url: BASE_URL + '/bnkmovementtype/bnk_movement_type',
    rutaEsperada: 'bnk_movement_type',
    tituloEsperado: /tipos de movimientos/i,
    obtenerLocatorDeCarga: (page) => page.locator('#v_search'),
  },
  {
    nombre: 'Solicitudes de bancos',
    url: BASE_URL + '/bank_requests/index_Bank',
    rutaEsperada: 'bank_requests/index_Bank',
    tituloEsperado: /solicitudes de bancos/i,
    obtenerLocatorDeCarga: (page) => page.locator('#bnk_btn_new'),
  },
  {
    nombre: 'Depósitos y transferencias',
    url: BASE_URL + '/depositsAndTransfers/depositsAndTransfersList',
    rutaEsperada: 'depositsAndTransfersList',
    tituloEsperado: /dep[oó]sitos y transferencias/i,
    // `\s+` entre palabras porque el texto real del DOM tiene saltos de
    // línea entre ellas (mismo hallazgo documentado en tienda.page.ts).
    obtenerLocatorDeCarga: (page) => page.locator('.content-header', { hasText: /dep[oó]sitos\s+y\s+transferencias/i }).first(),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con `#ac_br_search` (botón "Buscar" del toolbar de filtros), presente
    // apenas carga el layout, sin depender de que los KPI/gráficos con datos
    // reales terminen de calcularse.
    nombre: 'Reporte de bancos',
    url: BASE_URL + '/accounting/bank-report',
    rutaEsperada: 'accounting/bank-report',
    tituloEsperado: /reportes de bancos/i,
    obtenerLocatorDeCarga: (page) => page.locator('#ac_br_search'),
  },
  // ─── Activo fijo ──────────────────────────────────────────────────────────
  {
    nombre: 'Activos',
    url: BASE_URL + '/faassets/fa_assets',
    rutaEsperada: 'faassets/fa_assets',
    tituloEsperado: /activos fijos/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /activos fijos/i }),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo, mismo caso
    // que "Tipo de movimiento") — se valida con el buscador real `#v_search`.
    nombre: 'Tipo de activos',
    url: BASE_URL + '/fatypeassets/fa_type_assets',
    rutaEsperada: 'fatypeassets/fa_type_assets',
    tituloEsperado: /tipos de activos/i,
    obtenerLocatorDeCarga: (page) => page.locator('#v_search'),
  },
  // ─── Reportes ─────────────────────────────────────────────────────────────
  {
    nombre: 'Balance de comprobación',
    url: BASE_URL + '/ac_trial_balance_report',
    rutaEsperada: 'ac_trial_balance_report',
    tituloEsperado: /balanza de comprobaci[oó]n/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /balanza de comprobaci[oó]n/i }),
  },
  {
    nombre: 'Estado de resultado',
    url: BASE_URL + '/acprofitlossreport/ac_profit_loss_report',
    rutaEsperada: 'ac_profit_loss_report',
    tituloEsperado: /estado de resultados/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /estado de resultados/i }),
  },
  {
    nombre: 'Estado de situación financiera',
    url: BASE_URL + '/acfinancialpositionreport/index',
    rutaEsperada: 'acfinancialpositionreport',
    tituloEsperado: /estado de situaci[oó]n financiera/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /estado de situaci[oó]n financiera/i }),
  },
  // ─── Configuraciones adicionales ─────────────────────────────────────────
  {
    nombre: 'Centro de costo',
    url: BASE_URL + '/accocenter/ac_cost_center',
    rutaEsperada: 'ac_cost_center',
    tituloEsperado: /centro de costo/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /centro de costo/i }),
  },
  {
    // Sin `<h1>`/`<h2>` visible en esta pantalla (confirmado en vivo, el
    // título real es un `<h4>` sin id) — se valida con el buscador real.
    nombre: 'Tipos de diario',
    url: BASE_URL + '/acjournaltype/ac_journal_type',
    rutaEsperada: 'ac_journal_type',
    tituloEsperado: /tipos de diarios/i,
    obtenerLocatorDeCarga: (page) => page.locator('#v_search'),
  },
  {
    nombre: 'Catalogo de cuentas',
    url: BASE_URL + '/accatalogaccount/ac_catalog_account',
    rutaEsperada: 'ac_catalog_account',
    tituloEsperado: /cat[aá]logo de cuentas/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /cat[aá]logo de cuentas/i }),
  },
  {
    nombre: 'Numeración de documentos',
    url: BASE_URL + '/acdocumentnumber/ac_document_number',
    rutaEsperada: 'ac_document_number',
    tituloEsperado: /numeraci[oó]n de documentos/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /numeraci[oó]n de documentos/i }),
  },
  {
    // El encabezado real visible dice "Período Contable" (confirmado en
    // vivo), no "Mes Fiscal" como el link del menú — se valida con el texto
    // real de la pantalla, no con el nombre del menú.
    nombre: 'Mes fiscal',
    url: BASE_URL + '/acfiscalmonth/ac_fiscal_month',
    rutaEsperada: 'ac_fiscal_month',
    tituloEsperado: /mes fiscal/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /per[ií]odo contable/i }),
  },
  {
    nombre: 'Configuración de asientos',
    url: BASE_URL + '/acjournalconfiguration/ac_journal_configuration',
    rutaEsperada: 'ac_journal_configuration',
    tituloEsperado: /configuraci[oó]n de asientos/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /configuraci[oó]n de asientos/i }),
  },
  {
    nombre: 'Tipo de cambio',
    url: BASE_URL + '/acexchangerate/ac_exchange_rate',
    rutaEsperada: 'ac_exchange_rate',
    tituloEsperado: /tipo de cambio/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /tipo de cambio/i }),
  },
];

// ─── Page Object ──────────────────────────────────────────────────────────────

export class ContabilidadPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Contabilidad. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
