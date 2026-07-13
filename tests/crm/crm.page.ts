import { Locator, Page } from '@playwright/test';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  // Cada submódulo popula su contenido (filtros/tablero/tabla) vía AJAX tras
  // cargar la página — se hace polling hasta este límite antes de leer su estado.
  CARGA:    15_000,
} as const;

// ─── Submódulos ───────────────────────────────────────────────────────────────

/**
 * Submódulos del menú "CRM" (URLs confirmadas en vivo desde el menú lateral
 * del dashboard). Cada uno define, además de la ruta esperada, un locator
 * propio de su contenido — no compartido con ningún otro submódulo — para
 * confirmar que cargó su pantalla real y no solo que el layout general
 * (header/sidebar) respondió.
 *
 * No se valida `<title>` en ninguno de estos: los 5 submódulos comparten el
 * mismo <title> de documento ("Dashboard | Sistema Web ERP", confirmado en
 * vivo) — son SPAs que no actualizan document.title al navegar, igual que
 * "Ajustes de flujo de trabajo" en Gestión de Taller. La validación depende
 * solo de la URL final y del contenido propio visible.
 */
export type SubmoduloCRM = {
  nombre: string;
  url: string;
  // Substring que debe contener la URL final tras navegar, para detectar
  // redirecciones inesperadas (p.ej. a login por sesión expirada).
  rutaEsperada: string;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

export const SUBMODULOS_CRM: SubmoduloCRM[] = [
  {
    nombre: 'Pipeline de ventas',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/CRM/pipeline',
    rutaEsperada: 'CRM/pipeline',
    obtenerLocatorDeCarga: (page) => page.locator('input[placeholder="Buscar prospecto..."]'),
  },
  {
    nombre: 'Seguimiento colaborativo',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/collaborativeMonitoringCRM/index',
    rutaEsperada: 'collaborativeMonitoringCRM',
    obtenerLocatorDeCarga: (page) => page.locator('#cm-btn-new-task'),
  },
  {
    nombre: 'Plantillas de comunicación',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/CRMCommunicationTemplates/index',
    rutaEsperada: 'CRMCommunicationTemplates',
    obtenerLocatorDeCarga: (page) => page.locator('#ct-btn-new-template'),
  },
  {
    nombre: 'Entidades Financieras',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/FinancialEntities/index',
    rutaEsperada: 'FinancialEntities',
    obtenerLocatorDeCarga: (page) => page.locator('#fe-btn-new-entity'),
  },
  {
    nombre: 'Inventario de Vehículos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/CRM/vehicleInventory',
    rutaEsperada: 'CRM/vehicleInventory',
    obtenerLocatorDeCarga: (page) => page.locator('input[placeholder="Placa, marca, modelo..."]'),
  },
  // "Reportes" queda fuera de este listado — ver hallazgo documentado junto a
  // REPORTES_ROTO más abajo.
];

/**
 * Hallazgo confirmado en vivo (goto directo y también siguiendo el href real
 * del link del menú): "Reportes" no carga — la petición a `CRM/report`
 * responde 302 y termina redirigiendo a la página 404 del sistema
 * (`/error/404`, título "404 - Página no encontrada"). Se documenta como
 * hallazgo (mismo criterio que "Reporte de Inspección" en
 * gestion-navegacion.spec.ts) en vez de omitirlo silenciosamente.
 */
export const REPORTES_ROTO = {
  nombre: 'Reportes',
  url: 'https://dev.designsoftcr.com/qa_talleralpha/public/CRM/report',
} as const;

// ─── Page Object ──────────────────────────────────────────────────────────────

export class CRMPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de CRM. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
