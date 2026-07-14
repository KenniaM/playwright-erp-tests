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
 * Los 8 submódulos del menú "Facturación Electrónica" (URLs confirmadas en
 * vivo desde el menú lateral del dashboard). Cada uno define, además del
 * título de página esperado, un locator propio de su contenido — no
 * compartido con ningún otro submódulo — para confirmar que cargó su
 * pantalla real y no solo que el layout general (header/sidebar) respondió.
 *
 * "Factura de compra" también aparece en el menú "Compras" (misma URL,
 * cubierta en tests/compras/compras-navegacion.spec.ts) — se incluye aquí
 * también porque este menú la enlaza igualmente.
 */
export type SubmoduloFacturacion = {
  nombre: string;
  url: string;
  // Substring que debe contener la URL final tras navegar, para detectar
  // redirecciones inesperadas (p.ej. a login por sesión expirada).
  rutaEsperada: string;
  tituloEsperado: RegExp;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

/** Locator del breadcrumb/encabezado de contenido, propio de cada submódulo. */
const contentHeaderConTexto = (page: Page, texto: RegExp) => page.locator('.content-header', { hasText: texto }).first();

export const SUBMODULOS_FACTURACION: SubmoduloFacturacion[] = [
  {
    nombre: 'Configuración',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/comp/electronicBilling',
    rutaEsperada: 'comp/electronicBilling',
    tituloEsperado: /facturaci[oó]n electr[oó]nica/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /configuraci[oó]n de facturaci[oó]n electr[oó]nica/i),
  },
  {
    nombre: 'Reporte Facturas',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/ElectronicBilling/ElectronicBillingReport',
    rutaEsperada: 'ElectronicBillingReport',
    tituloEsperado: /reporte facturaci[oó]n electr[oó]nica/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte facturaci[oó]n electr[oó]nica/i),
  },
  {
    nombre: 'Re-envío de Facturas',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/ElectronicBilling/pendingInvoice',
    rutaEsperada: 'pendingInvoice',
    tituloEsperado: /re-env[ií]o de facturas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /re-env[ií]o de facturas/i),
  },
  {
    nombre: 'Recepción de Documentos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/ElectronicBilling/ElectronicBillingReceptor',
    rutaEsperada: 'ElectronicBillingReceptor',
    tituloEsperado: /recepci[oó]n de documentos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /recepci[oó]n de documentos/i),
  },
  {
    nombre: 'Factura de compra',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/ElectronicBilling/ElectronicBillingPurchase',
    rutaEsperada: 'ElectronicBillingPurchase',
    tituloEsperado: /factura electr[oó]nica de compra/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /factura electr[oó]nica de compra/i),
  },
  {
    nombre: 'Prorrata',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/ElectronicBilling/Prorrata',
    rutaEsperada: 'Prorrata',
    tituloEsperado: /prorrata/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /prorrata/i),
  },
  {
    nombre: 'Reporte D-151',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/ElectronicBilling/D151',
    rutaEsperada: 'D151',
    tituloEsperado: /d-151/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte d-151/i),
  },
  {
    nombre: 'Admin Productos con Código CABYS',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/prod/adminCabys',
    rutaEsperada: 'adminCabys',
    tituloEsperado: /administrar c[oó]digo cabys/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar c[oó]digo cabys/i),
  },
];

// ─── Page Object ──────────────────────────────────────────────────────────────

export class FacturacionPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Facturación Electrónica. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
