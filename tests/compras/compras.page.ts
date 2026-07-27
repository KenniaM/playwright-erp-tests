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
 * Los 7 submódulos del menú "Compras" (URLs confirmadas en vivo desde el
 * menú lateral del dashboard). Cada uno define, además del título de página
 * esperado, un locator propio de su contenido — no compartido con ningún
 * otro submódulo — para confirmar que cargó su pantalla real y no solo que
 * el layout general (header/sidebar) respondió.
 */
export type SubmoduloCompras = {
  nombre: string;
  url: string;
  // Substring que debe contener la URL final tras navegar, para detectar
  // redirecciones inesperadas (p.ej. a login por sesión expirada).
  rutaEsperada: string;
  tituloEsperado: RegExp;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

/** Locator del breadcrumb/encabezado de contenido, reutilizado por la mayoría de submódulos. */
const contentHeaderConTexto = (page: Page, texto: RegExp) => page.locator('.content-header', { hasText: texto });

export const SUBMODULOS_COMPRAS: SubmoduloCompras[] = [
  {
    nombre: 'Administrar Compras',
    url: BASE_URL + '/purchase/purchase',
    rutaEsperada: 'purchase/purchase',
    tituloEsperado: /administrar compras/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar compras/i),
  },
  {
    nombre: 'Abono Cuentas por Pagar',
    url: BASE_URL + '/credit_purchase/providerCreditPurchase',
    rutaEsperada: 'providerCreditPurchase',
    tituloEsperado: /cuentas por pagar/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /cuentas por pagar/i),
  },
  {
    nombre: 'Orden de Compra',
    url: BASE_URL + '/purchaseProform/purchaseProform',
    rutaEsperada: 'purchaseProform',
    tituloEsperado: /orden de compras/i,
    obtenerLocatorDeCarga: (page) => page.locator('input[placeholder="search..."]'),
  },
  {
    nombre: 'Devoluciones',
    url: BASE_URL + '/pRefound/refund_purchase',
    rutaEsperada: 'refund_purchase',
    tituloEsperado: /devoluci[oó]n compras/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /devoluciones de compras/i),
  },
  {
    nombre: 'Nota de crédito',
    url: BASE_URL + '/purchaseCreditNote/creditNote',
    rutaEsperada: 'purchaseCreditNote',
    tituloEsperado: /notas de cr[eé]dito de compras/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_search_refound'),
  },
  {
    nombre: 'Agregar gastos',
    url: BASE_URL + '/expense/expense',
    rutaEsperada: 'expense/expense',
    tituloEsperado: /gastos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /gastos/i),
  },
  {
    nombre: 'Factura de compra',
    url: BASE_URL + '/ElectronicBilling/ElectronicBillingPurchase',
    rutaEsperada: 'ElectronicBillingPurchase',
    tituloEsperado: /factura electr[oó]nica de compra/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /factura electr[oó]nica de compra/i),
  },
];

// ─── Page Object ──────────────────────────────────────────────────────────────

export class ComprasPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Compras. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
