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
 * Los 21 submódulos del menú "Inventario" (URLs confirmadas en vivo desde el
 * menú lateral del dashboard). Cada uno define, además del título de página
 * esperado, un locator propio de su contenido — no compartido con ningún
 * otro submódulo — para confirmar que cargó su pantalla real y no solo que
 * el layout general (header/sidebar) respondió.
 *
 * "Editar Precios" y "Perfil de producto" comparten título de documento
 * ("Producto"/"Perfil de producto" son distintos, en realidad no colisionan),
 * pero "Productos Externos" y "Listado Productos Externos" sí comparten el
 * mismo <title> ("Productos Externos", confirmado en vivo) — para esos dos
 * el título no distingue por sí solo, así que la validación real recae en el
 * encabezado de contenido (`.content-header`), que sí es propio de cada uno.
 */
export type SubmoduloInventario = {
  nombre: string;
  url: string;
  // Substring que debe contener la URL final tras navegar, para detectar
  // redirecciones inesperadas (p.ej. a login por sesión expirada).
  rutaEsperada: string;
  tituloEsperado: RegExp;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

/**
 * Locator del breadcrumb/encabezado de contenido, reutilizado por la mayoría
 * de submódulos. `.first()` porque "Bodegas" renderiza dos
 * `.content-header` en la misma pantalla (un segundo panel "Asignar
 * productos a Bodegas", confirmado en vivo) — ambos contienen "Bodegas", así
 * que sin `.first()` Playwright falla en modo estricto por ambigüedad.
 */
const contentHeaderConTexto = (page: Page, texto: RegExp) => page.locator('.content-header', { hasText: texto }).first();

export const SUBMODULOS_INVENTARIO: SubmoduloInventario[] = [
  {
    nombre: 'Crear Producto',
    url: BASE_URL + '/prod/product',
    rutaEsperada: 'prod/product',
    tituloEsperado: /inventario/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administraci[oó]n de productos/i),
  },
  {
    nombre: 'Administrar Productos',
    url: BASE_URL + '/manage/index',
    rutaEsperada: 'manage/index',
    tituloEsperado: /administrar productos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar productos/i),
  },
  {
    nombre: 'Traslado entre sucursales',
    url: BASE_URL + '/pTransfer/TransferList',
    rutaEsperada: 'pTransfer/TransferList',
    tituloEsperado: /transferencias de productos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /transferencias de productos/i),
  },
  {
    nombre: 'Despacho de ordenes de transferencia',
    url: BASE_URL + '/pTransfer/warehouse_transfer_order_dispatch',
    rutaEsperada: 'warehouse_transfer_order_dispatch',
    tituloEsperado: /despacho de [oó]rdenes de transferencia/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /despacho de [oó]rdenes de transferencia/i),
  },
  {
    nombre: 'Bodegas',
    url: BASE_URL + '/company_warehouse/warehouses',
    rutaEsperada: 'company_warehouse/warehouses',
    tituloEsperado: /bodegas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /bodegas/i),
  },
  {
    nombre: 'Editar Precios',
    url: BASE_URL + '/prod/getViewProductUpdateList',
    rutaEsperada: 'getViewProductUpdateList',
    tituloEsperado: /producto/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /lista de productos/i),
  },
  {
    nombre: 'Toma Física',
    url: BASE_URL + '/inv/inventory',
    rutaEsperada: 'inv/inventory',
    tituloEsperado: /toma f[ií]sica/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /toma f[ií]sica/i),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el botón real de guardado, que sí es visible.
    nombre: 'Producción y Transformación',
    url: BASE_URL + '/inv/production/new',
    rutaEsperada: 'inv/production/new',
    tituloEsperado: /producci[oó]n y transformaci[oó]n/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_save_pending'),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el tab de registros, que sí es visible.
    nombre: 'Historial de Producción',
    url: BASE_URL + '/inv/production/history',
    rutaEsperada: 'inv/production/history',
    tituloEsperado: /historial de producci[oó]n/i,
    obtenerLocatorDeCarga: (page) => page.locator('#ptx_tab_btn_records'),
  },
  {
    nombre: 'Perfil de producto',
    url: BASE_URL + '/prod/product_profile',
    rutaEsperada: 'product_profile',
    tituloEsperado: /perfil de producto/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /perfil de producto/i),
  },
  {
    nombre: 'Crear Categorías',
    url: BASE_URL + '/cat/adminCategory',
    rutaEsperada: 'cat/adminCategory',
    tituloEsperado: /categorias/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar categor[ií]as/i),
  },
  {
    nombre: 'Crear Combos',
    url: BASE_URL + '/rest/combosadmin',
    rutaEsperada: 'rest/combosadmin',
    tituloEsperado: /administrar combos/i,
    // El `.content-header` original ("Administrar combos Inicio Combos") es
    // el correcto y sigue confirmado en vivo para compañías tipo taller. En
    // compañías tipo restaurante (company-theme-rest) esta misma pantalla
    // confirmado en vivo, ambiente qa_restaurant: muestra en su lugar
    // "Restaurante Inicio Combos" — no reemplaza el original, se agrega como
    // alternativa real para no perder la validación del ambiente taller.
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar combos|restaurante/i),
  },
  {
    nombre: 'Lista de Precios',
    url: BASE_URL + '/prod/productPriceList',
    rutaEsperada: 'productPriceList',
    tituloEsperado: /lista de precios/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar lista de precios/i),
  },
  {
    nombre: 'Administrar Impuestos',
    url: BASE_URL + '/prod/companyTaxAdmin',
    rutaEsperada: 'companyTaxAdmin',
    tituloEsperado: /administrador de impuestos para productos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrador de impuestos para productos/i),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el botón real de búsqueda de producto, que sí es visible.
    nombre: 'Etiquetar Productos',
    url: BASE_URL + '/label/label',
    rutaEsperada: 'label/label',
    tituloEsperado: /etiquetar productos/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_product_search'),
  },
  {
    nombre: 'Asignar Productos Vendedor',
    url: BASE_URL + '/assign_seller_product/assign_seller_product',
    rutaEsperada: 'assign_seller_product',
    tituloEsperado: /asignar productos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /asignar productos a vendedor/i),
  },
  {
    // El <title> ("Productos Externos") es idéntico al de "Listado Productos
    // Externos" (confirmado en vivo) — no distingue por sí solo; se valida
    // con el botón real de agregar producto externo, propio de esta pantalla.
    nombre: 'Productos Externos',
    url: BASE_URL + '/ext_product/externalProduct',
    rutaEsperada: 'ext_product/externalProduct',
    tituloEsperado: /productos externos/i,
    obtenerLocatorDeCarga: (page) => page.locator('#add_sc_product'),
  },
  {
    // Mismo <title> compartido que "Productos Externos" (ver nota arriba) —
    // se distingue por el encabezado de contenido real de esta pantalla.
    nombre: 'Listado Productos Externos',
    url: BASE_URL + '/ext_product/externalProductList',
    rutaEsperada: 'externalProductList',
    tituloEsperado: /productos externos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar lista de productos externos/i),
  },
  {
    nombre: 'Productos dañados',
    url: BASE_URL + '/prod/damaged',
    rutaEsperada: 'prod/damaged',
    tituloEsperado: /productos da[ñn]ados/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /productos da[ñn]ados/i),
  },
  {
    nombre: 'Admin. unidades medición',
    url: BASE_URL + '/prod/admin_measurement_units',
    rutaEsperada: 'admin_measurement_units',
    tituloEsperado: /unidades de medici[oó]n/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /unidades de medici[oó]n/i),
  },
  {
    nombre: 'Variantes',
    url: BASE_URL + '/variant/variant',
    rutaEsperada: 'variant/variant',
    tituloEsperado: /variantes/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_search_variant'),
  },
];

// ─── Page Object ──────────────────────────────────────────────────────────────

export class InventarioPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Inventario. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
