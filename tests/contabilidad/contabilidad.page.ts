import { Locator, Page } from '@playwright/test';

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
 * raíz), "Tipo de activos" (sección "Activo Fijo"), "Sub Cuentas" y
 * "Configuración de Reportes" (sección "Configuraciones adicionales"), que
 * se omiten a propósito por no estar en la lista pedida.
 *
 * La mayoría de estas pantallas no usan `.content-header` (a diferencia de
 * la mayoría de módulos anteriores) sino un encabezado real visible — la
 * mayoría es un `<h2>`, salvo "Dashboard Contable" que sí es `<h1>`
 * (confirmado en vivo elemento por elemento, tras un primer intento fallido
 * asumiendo `<h1>` para todos). "Cuentas bancarias", "Tipo de movimiento",
 * "Solicitudes" y "Depósitos y transferencias" reutilizan los mismos
 * locators ya confirmados en bancos.page.ts (mismas URLs, mismo menú
 * duplicado entre "Bancos" y "Contabilidad").
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
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/acaccountingdashboard/index',
    rutaEsperada: 'acaccountingdashboard',
    tituloEsperado: /dashboard contable/i,
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /dashboard contable/i }),
  },
  {
    nombre: 'Asiento de diario',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/acjournalentry/ac_journal_entry',
    rutaEsperada: 'ac_journal_entry',
    tituloEsperado: /asientos de diario/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /asientos de diario/i }),
  },
  // ─── Bancos ───────────────────────────────────────────────────────────────
  {
    nombre: 'Cuentas bancarias',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/bank_account/bank_account',
    rutaEsperada: 'bank_account/bank_account',
    tituloEsperado: /cuentas bancarias/i,
    obtenerLocatorDeCarga: (page) => page.locator('input[placeholder="Buscar por banco o número de cuenta..."]'),
  },
  {
    nombre: 'Tipo de movimiento',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/bnkmovementtype/bnk_movement_type',
    rutaEsperada: 'bnk_movement_type',
    tituloEsperado: /tipos de movimientos/i,
    obtenerLocatorDeCarga: (page) => page.locator('#v_search'),
  },
  {
    nombre: 'Solicitudes',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/bnkpaymentrequest/bnk_payment_request',
    rutaEsperada: 'bnk_payment_request',
    tituloEsperado: /solicitudes de cheque/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btnRequest'),
  },
  {
    nombre: 'Depósitos y transferencias',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/depositsAndTransfers/depositsAndTransfersList',
    rutaEsperada: 'depositsAndTransfersList',
    tituloEsperado: /dep[oó]sitos y transferencias/i,
    // `\s+` entre palabras porque el texto real del DOM tiene saltos de
    // línea entre ellas (mismo hallazgo documentado en tienda.page.ts).
    obtenerLocatorDeCarga: (page) => page.locator('.content-header', { hasText: /dep[oó]sitos\s+y\s+transferencias/i }).first(),
  },
  // ─── Activo fijo ──────────────────────────────────────────────────────────
  {
    nombre: 'Activos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/faassets/fa_assets',
    rutaEsperada: 'faassets/fa_assets',
    tituloEsperado: /activos fijos/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /activos fijos/i }),
  },
  // ─── Reportes ─────────────────────────────────────────────────────────────
  {
    nombre: 'Balance de comprobación',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/ac_trial_balance_report',
    rutaEsperada: 'ac_trial_balance_report',
    tituloEsperado: /balanza de comprobaci[oó]n/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /balanza de comprobaci[oó]n/i }),
  },
  {
    nombre: 'Estado de resultado',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/acprofitlossreport/ac_profit_loss_report',
    rutaEsperada: 'ac_profit_loss_report',
    tituloEsperado: /estado de resultados/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /estado de resultados/i }),
  },
  {
    nombre: 'Estado de situación financiera',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/acfinancialpositionreport/index',
    rutaEsperada: 'acfinancialpositionreport',
    tituloEsperado: /estado de situaci[oó]n financiera/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /estado de situaci[oó]n financiera/i }),
  },
  // ─── Configuraciones adicionales ─────────────────────────────────────────
  {
    nombre: 'Centro de costo',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/accocenter/ac_cost_center',
    rutaEsperada: 'ac_cost_center',
    tituloEsperado: /centro de costo/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /centro de costo/i }),
  },
  {
    // Sin `<h1>`/`<h2>` visible en esta pantalla (confirmado en vivo, el
    // título real es un `<h4>` sin id) — se valida con el buscador real.
    nombre: 'Tipos de diario',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/acjournaltype/ac_journal_type',
    rutaEsperada: 'ac_journal_type',
    tituloEsperado: /tipos de diarios/i,
    obtenerLocatorDeCarga: (page) => page.locator('#v_search'),
  },
  {
    nombre: 'Catalogo de cuentas',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/accatalogaccount/ac_catalog_account',
    rutaEsperada: 'ac_catalog_account',
    tituloEsperado: /cat[aá]logo de cuentas/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /cat[aá]logo de cuentas/i }),
  },
  {
    nombre: 'Numeración de documentos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/acdocumentnumber/ac_document_number',
    rutaEsperada: 'ac_document_number',
    tituloEsperado: /numeraci[oó]n de documentos/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /numeraci[oó]n de documentos/i }),
  },
  {
    // El encabezado real visible dice "Período Contable" (confirmado en
    // vivo), no "Mes Fiscal" como el link del menú — se valida con el texto
    // real de la pantalla, no con el nombre del menú.
    nombre: 'Mes fiscal',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/acfiscalmonth/ac_fiscal_month',
    rutaEsperada: 'ac_fiscal_month',
    tituloEsperado: /mes fiscal/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /per[ií]odo contable/i }),
  },
  {
    nombre: 'Configuración de asientos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/acjournalconfiguration/ac_journal_configuration',
    rutaEsperada: 'ac_journal_configuration',
    tituloEsperado: /configuraci[oó]n de asientos/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /configuraci[oó]n de asientos/i }),
  },
  {
    nombre: 'Tipo de cambio',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/acexchangerate/ac_exchange_rate',
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
