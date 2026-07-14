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
 * Submódulos del menú "Bancos" (URLs confirmadas en vivo desde el menú
 * lateral del dashboard). Igual que "Tienda en Linea", el sidebar tiene dos
 * entradas de nivel superior con el mismo nombre "Bancos" (una con 2 links,
 * otra anidada con 4) — esta lista combina ambas sin duplicar las URLs que
 * coinciden ("Admin. Cuentas Bancarias"/"Cuentas bancarias" y "Depósitos y
 * transferencias" apuntan a las mismas dos URLs en ambos menús).
 *
 * Cada entrada define, además del título de página esperado, un locator
 * propio de su contenido para confirmar que cargó su pantalla real.
 */
export type SubmoduloBancos = {
  nombre: string;
  url: string;
  // Substring que debe contener la URL final tras navegar, para detectar
  // redirecciones inesperadas (p.ej. a login por sesión expirada).
  rutaEsperada: string;
  tituloEsperado: RegExp;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

export const SUBMODULOS_BANCOS: SubmoduloBancos[] = [
  {
    nombre: 'Admin. Cuentas Bancarias',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/bank_account/bank_account',
    rutaEsperada: 'bank_account/bank_account',
    tituloEsperado: /cuentas bancarias/i,
    obtenerLocatorDeCarga: (page) => page.locator('input[placeholder="Buscar por banco o número de cuenta..."]'),
  },
  {
    nombre: 'Depósitos y transferencias',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/depositsAndTransfers/depositsAndTransfersList',
    rutaEsperada: 'depositsAndTransfersList',
    tituloEsperado: /dep[oó]sitos y transferencias/i,
    // `\s+` entre palabras porque el texto real del DOM tiene saltos de
    // línea entre ellas (mismo hallazgo documentado en tienda.page.ts) —
    // `hasText` con RegExp compara contra `textContent` sin colapsar espacios.
    obtenerLocatorDeCarga: (page) => page.locator('.content-header', { hasText: /dep[oó]sitos\s+y\s+transferencias/i }).first(),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se
    // valida con el buscador real, que sí es visible.
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
];

// ─── Page Object ──────────────────────────────────────────────────────────────

export class BancosPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Bancos. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
