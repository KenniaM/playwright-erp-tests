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
 * Los 6 submódulos del menú "Ventas" (URLs confirmadas en vivo desde el menú
 * lateral del dashboard). Cada uno define, además del título de página
 * esperado, un locator propio de su contenido — no compartido con ningún
 * otro submódulo — para confirmar que cargó su pantalla real y no solo que
 * el layout general (header/sidebar) respondió.
 */
export type SubmoduloVentas = {
  nombre: string;
  url: string;
  // Substring que debe contener la URL final tras navegar, para detectar
  // redirecciones inesperadas (p.ej. a login por sesión expirada).
  rutaEsperada: string;
  tituloEsperado: RegExp;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

export const SUBMODULOS_VENTAS: SubmoduloVentas[] = [
  {
    nombre: 'Histórico de Ventas',
    url: BASE_URL + '/receip/printPosReceip',
    rutaEsperada: 'printPosReceip',
    tituloEsperado: /facturas/i,
    obtenerLocatorDeCarga: (page) =>
      page.locator('input[placeholder="Buscar por factura, orden de compra, orden de reparación o proforma..."]'),
  },
  {
    nombre: 'Abono Cuentas por Cobrar',
    url: BASE_URL + '/credit_sale/clientCreditSales',
    rutaEsperada: 'clientCreditSales',
    tituloEsperado: /cuentas por cobrar/i,
    // CORRECCIÓN DE AUTOMATIZACIÓN confirmada en vivo: esta pantalla fue
    // rediseñada por la propia aplicación (mismo hallazgo que "Bodegas" en
    // inventario.page.ts) — `#btn_search` ya no existe; el contenido real
    // hoy es un encabezado `<h1>Cuentas por cobrar</h1>` dentro de una UI de
    // filtros/tabla completamente nueva.
    obtenerLocatorDeCarga: (page) => page.getByRole('heading', { name: 'Cuentas por cobrar', level: 1 }),
  },
  {
    nombre: 'Lista de Cobros',
    url: BASE_URL + '/receip/receivableList',
    rutaEsperada: 'receivableList',
    tituloEsperado: /lista de cobro/i,
    obtenerLocatorDeCarga: (page) => page.locator('#show_list_status_0'),
  },
  {
    nombre: 'Historial Mov. de Caja',
    url: BASE_URL + '/cash_movement/movements',
    rutaEsperada: 'cash_movement/movements',
    tituloEsperado: /movimientos de caja/i,
    obtenerLocatorDeCarga: (page) => page.locator('input[placeholder="Fecha inicio"]'),
  },
  {
    nombre: 'Devoluciones',
    url: BASE_URL + '/refund/refund',
    rutaEsperada: 'refund/refund',
    tituloEsperado: /devoluciones/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_add_refund'),
  },
  {
    nombre: 'Nota de crédito',
    url: BASE_URL + '/creditNote/creditNote',
    rutaEsperada: 'creditNote/creditNote',
    tituloEsperado: /registro de notas de crédito/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_credit_note_actions'),
  },
];

// ─── Page Object ──────────────────────────────────────────────────────────────

export class VentasPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Ventas. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
