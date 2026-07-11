import { expect, Locator, Page } from '@playwright/test';

// ─── URL ──────────────────────────────────────────────────────────────────────

export const RUTAS_URL =
  'https://dev.designsoftcr.com/qa_talleralpha/public/route/adminRoute';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:       60_000,
  NAVIGATE:   60_000,
  // Tras cargar la página, la tabla de rutas se popula vía AJAX y puede
  // tardar en aparecer — se hace polling hasta este límite antes de leer
  // el estado del módulo.
  TABLE_LOAD: 15_000,
} as const;

// ─── Locators ─────────────────────────────────────────────────────────────────

const L = {
  BUSCADOR:      '#search_route',
  BTN_BUSCAR:    '#btn_search_route',
  BTN_AGREGAR:   '#btn_add_route',
  TABLA:         '.pce-table',
} as const;

// ─── Page Object ──────────────────────────────────────────────────────────────

export class RutasPage {
  constructor(private readonly page: Page) {}

  get buscador() {
    return this.page.locator(L.BUSCADOR);
  }

  get botonBuscar() {
    return this.page.locator(L.BTN_BUSCAR);
  }

  get botonAgregar() {
    return this.page.locator(L.BTN_AGREGAR);
  }

  get tabla() {
    return this.page.locator(L.TABLA);
  }

  /**
   * Filas de datos reales de la tabla. No necesariamente usan `<td>` — se
   * identifican por contener el badge "Clientes" que acompaña a cada ruta.
   */
  get filasRutas(): Locator {
    return this.tabla.locator('tr').filter({ hasText: /clientes/i });
  }

  /** Único punto de entrada al módulo Admin. Rutas. */
  async irARutas() {
    await this.page.goto(RUTAS_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }

  /**
   * Espera hasta que la tabla de rutas tenga al menos una fila real cargada
   * vía AJAX, en vez de asumir que ya están presentes apenas navega la página.
   */
  async esperarFilasCargadas() {
    await expect
      .poll(() => this.filasRutas.count(), { timeout: TIMEOUTS.TABLE_LOAD })
      .toBeGreaterThan(0);
  }

  /** Nombres visibles (truncados) de cada ruta listada, para depuración/logs. */
  async nombresRutas(): Promise<string[]> {
    const textos = await this.filasRutas.allTextContents();
    return textos.map((t) => t.replace(/\s+/g, ' ').trim().substring(0, 60));
  }
}
