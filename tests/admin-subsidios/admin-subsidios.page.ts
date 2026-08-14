import { Locator, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  CARGA:    15_000,
} as const;

// ─── Submódulos ───────────────────────────────────────────────────────────────

/**
 * Los 3 submódulos del menú "Admin. Subsidios" (URLs y contenido confirmados
 * en vivo desde el menú lateral del dashboard). Módulo nuevo, visible en el
 * Sidebar pero sin ninguna prueba de navegación previa — se agrega siguiendo
 * el patrón 1 "tabla de submódulos" documentado en CLAUDE.md.
 */
export type SubmoduloAdminSubsidios = {
  nombre: string;
  url: string;
  rutaEsperada: string;
  tituloEsperado: RegExp;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

export const SUBMODULOS_ADMIN_SUBSIDIOS: SubmoduloAdminSubsidios[] = [
  {
    nombre: 'Admin. Subsidios',
    url: BASE_URL + '/adminSubsidy/index',
    rutaEsperada: 'adminSubsidy/index',
    tituloEsperado: /admin\.?\s*subsidios/i,
    obtenerLocatorDeCarga: (page) => page.locator('.content-header', { hasText: /administraci[oó]n de subsidios/i }).first(),
  },
  {
    nombre: 'Reporte Subsidios',
    url: BASE_URL + '/adminSubsidy/get_subsidy_report',
    rutaEsperada: 'get_subsidy_report',
    tituloEsperado: /reporte de subsidios/i,
    obtenerLocatorDeCarga: (page) => page.locator('.content-header', { hasText: /reporte de subsidios/i }).first(),
  },
  {
    nombre: 'Reporte recarga de subsidios',
    url: BASE_URL + '/adminSubsidy/get_subsidy_report_recharge',
    rutaEsperada: 'get_subsidy_report_recharge',
    tituloEsperado: /reporte recargas de subsidio/i,
    obtenerLocatorDeCarga: (page) => page.locator('.content-header', { hasText: /reporte recargas de subsidio/i }).first(),
  },
];

// ─── Page Object ──────────────────────────────────────────────────────────────

export class AdminSubsidiosPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Admin. Subsidios. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
