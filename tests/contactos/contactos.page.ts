import { Locator, Page } from '@playwright/test';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  // Cada submódulo popula su contenido (filtros/tabla) vía AJAX tras cargar
  // la página — se hace polling hasta este límite antes de leer su estado.
  CARGA:    15_000,
  // Timeout corto y explícito para la navegación a "Clientes" — ver
  // CLIENTES_ROTO más abajo. No se usa TIMEOUTS.NAVIGATE (60s) porque el
  // hallazgo es que la página nunca responde; esperar el timeout completo
  // en cada corrida de la suite sería un costo innecesario.
  NAVEGACION_ROTA: 30_000,
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
  // "Clientes" queda fuera de este listado — ver hallazgo documentado junto
  // a CLIENTES_ROTO más abajo.
  {
    nombre: 'Proveedores',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/prov/provider',
    rutaEsperada: 'prov/provider',
    tituloEsperado: /proveedores/i,
    obtenerLocatorDeCarga: (page) => page.locator('.content-header', { hasText: /proveedores/i }).first(),
  },
];

/**
 * Hallazgo confirmado en vivo (tres veces, en aislamiento, en intentos
 * separados en el tiempo): "Clientes" no carga — la navegación se queda
 * colgada indefinidamente (sin respuesta del servidor, ni siquiera un error
 * HTTP) hasta agotar el timeout. Se descartó que fuera lentitud general del
 * ambiente comparando contra Dashboard y Proveedores, que sí cargaron con
 * normalidad en la misma sesión. Se documenta como hallazgo (mismo criterio
 * que "Reporte de Inspección" en gestion-navegacion.spec.ts) en vez de
 * omitirlo silenciosamente.
 */
export const CLIENTES_ROTO = {
  nombre: 'Clientes',
  url: 'https://dev.designsoftcr.com/qa_talleralpha/public/cust/customer',
} as const;

// ─── Page Object ──────────────────────────────────────────────────────────────

export class ContactosPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Contactos. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
