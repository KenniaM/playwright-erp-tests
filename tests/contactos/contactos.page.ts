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
 * Submódulos del menú "Contactos" (URLs confirmadas en vivo desde el menú
 * lateral del dashboard). Cada uno define, además del título de página
 * esperado, un locator propio de su contenido — no compartido con ningún
 * otro submódulo — para confirmar que cargó su pantalla real y no solo que
 * el layout general (header/sidebar) respondió.
 */
export type SubmoduloContactos = {
  nombre: string;
  url: string;
  // Substring que debe contener la URL final tras navegar, para detectar
  // redirecciones inesperadas (p.ej. a login por sesión expirada).
  rutaEsperada: string;
  tituloEsperado: RegExp;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

export const SUBMODULOS_CONTACTOS: SubmoduloContactos[] = [
  // "Clientes" RESTAURADO a este listado (2026-08-07): el hallazgo antes
  // documentado aquí ("la navegación se queda colgada indefinidamente sin
  // respuesta del servidor", confirmado en vivo 3 veces) ya NO reproduce —
  // confirmado en vivo que la página carga con normalidad. Era un bug real
  // de sistema/ambiente (nunca de automatización), ya sea corregido por el
  // equipo de desarrollo o resuelto junto con alguna otra causa del
  // ambiente; no queda evidencia de que sea automatización lo que cambió.
  {
    nombre: 'Clientes',
    url: BASE_URL + '/cust/customer',
    rutaEsperada: 'cust/customer',
    tituloEsperado: /clientes/i,
    obtenerLocatorDeCarga: (page) => page.locator('.content-header', { hasText: /clientes/i }).first(),
  },
  {
    nombre: 'Proveedores',
    url: BASE_URL + '/prov/provider',
    rutaEsperada: 'prov/provider',
    tituloEsperado: /proveedores/i,
    obtenerLocatorDeCarga: (page) => page.locator('.content-header', { hasText: /proveedores/i }).first(),
  },
];

// ─── Page Object ──────────────────────────────────────────────────────────────

export class ContactosPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Contactos. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
