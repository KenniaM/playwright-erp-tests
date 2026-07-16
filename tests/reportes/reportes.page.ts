import { Locator, Page } from '@playwright/test';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  // Más alto que en otros módulos (60_000) porque varios reportes de este
  // menú (p.ej. "Despacho de órdenes" y "Órdenes" de Tienda en Línea)
  // tardaron más de 45s solo en el `goto` durante la investigación en vivo.
  TEST:     90_000,
  NAVIGATE: 60_000,
  // Cada submódulo popula su contenido (filtros/tabla/gráficos) vía AJAX tras
  // cargar la página — se hace polling hasta este límite antes de leer su estado.
  CARGA:    15_000,
} as const;

// ─── Submódulos ───────────────────────────────────────────────────────────────

/**
 * Submódulos del menú "Reportes" (URLs confirmadas en vivo desde el menú
 * lateral del dashboard, agrupadas por el mismo submenú que usa la propia
 * aplicación — Caja, Tienda en Línea, Clientes, Compras, Inventario, Taller,
 * Ventas, Reportes Financieros, Ruteo, Cotizaciones — más 3 accesos directos
 * sin sub-submenú: Gastos Operativos, Rifas y Comentarios).
 *
 * Cada grupo vive en su propio `rp-<submodulo>.page.ts` (p.ej.
 * `rp-caja.page.ts`). Este archivo solo contiene lo reutilizable entre todos
 * ellos: tipos, helpers de locators, timeouts y el page object de navegación.
 *
 * El grupo "Seguridad" del menú "Reportes" no tiene ningún submódulo
 * navegable (su `<ul>` está vacío en el DOM, confirmado en vivo) — no
 * aparece en ningún archivo `rp-*.page.ts`.
 *
 * Dos submódulos confirmados en el menú quedaron fuera de estos arreglos
 * porque, al navegar a su URL real, la aplicación no entrega la pantalla del
 * reporte (confirmado en vivo, repetido varias veces):
 *   - Taller > "Productos vendidos" (reports/product_sale_report): la
 *     aplicación responde con una pantalla de error de servidor ("Whoops...
 *     ErrorException ... Invalid argument supplied for foreach()").
 *   - Ventas > "Comisiones por Producto" (reports/productCommissionReport):
 *     la navegación nunca termina de cargar (probado hasta 90s sin resultado).
 * Ambos parecen bugs del ambiente QA más que fallas de este test — repetir la
 * investigación en vivo antes de agregarlos de vuelta.
 */
export type SubmoduloReportes = {
  nombre: string;
  url: string;
  // Substring que debe contener la URL final tras navegar, para detectar
  // redirecciones inesperadas (p.ej. a login por sesión expirada).
  rutaEsperada: string;
  tituloEsperado: RegExp;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

/** Locator del breadcrumb/encabezado de contenido, reutilizado por la mayoría de submódulos. */
export const contentHeaderConTexto = (page: Page, texto: RegExp) => page.locator('.content-header', { hasText: texto }).first();

// ─── Page Object ──────────────────────────────────────────────────────────────

export class ReportesPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Reportes. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
