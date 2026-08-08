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
 * Los 3 submódulos del menú "Marketing" (URLs y contenido confirmados en
 * vivo desde el menú lateral del dashboard). Módulo nuevo, visible en el
 * Sidebar pero sin ninguna prueba de navegación previa — se agrega siguiendo
 * el patrón 1 "tabla de submódulos" documentado en CLAUDE.md.
 *
 * "Administrar Encuestas" también aparece como una entrada de nivel
 * superior independiente en el Sidebar (mismo href exacto,
 * `/survey/adminfeedback`) — es un acceso directo a la misma pantalla, no
 * una pantalla distinta, así que no se duplica su prueba.
 */
export type SubmoduloMarketing = {
  nombre: string;
  url: string;
  rutaEsperada: string;
  tituloEsperado: RegExp;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

export const SUBMODULOS_MARKETING: SubmoduloMarketing[] = [
  {
    nombre: 'Administrar Encuestas',
    url: BASE_URL + '/survey/adminfeedback',
    rutaEsperada: 'survey/adminfeedback',
    tituloEsperado: /admin\.?\s*encuestas/i,
    obtenerLocatorDeCarga: (page) => page.locator('.content-header', { hasText: /administrar encuestas/i }).first(),
  },
  {
    nombre: 'Feedback de Clientes',
    url: BASE_URL + '/marketing/report',
    rutaEsperada: 'marketing/report',
    tituloEsperado: /feedback de clientes/i,
    obtenerLocatorDeCarga: (page) => page.locator('.content-header', { hasText: /feedback de clientes/i }).first(),
  },
  {
    nombre: 'Marketing',
    url: BASE_URL + '/marketing/marketing',
    rutaEsperada: 'marketing/marketing',
    tituloEsperado: /^marketing/i,
    obtenerLocatorDeCarga: (page) => page.locator('.content-header', { hasText: /marketing/i }).first(),
  },
];

// ─── Page Object ──────────────────────────────────────────────────────────────

export class MarketingPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Marketing. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
