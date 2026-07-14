import { Locator, Page } from '@playwright/test';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  // Cada submódulo popula su contenido (filtros/tabla) vía AJAX tras cargar
  // la página — se hace polling hasta este límite antes de leer su estado.
  CARGA:    15_000,
  // Timeout corto y explícito para la navegación rota — ver VER_TIENDA_ROTO
  // más abajo. No se usa TIMEOUTS.NAVIGATE porque el hallazgo es un bucle de
  // redirecciones, que falla rápido (net::ERR_TOO_MANY_REDIRECTS) y no
  // necesita 60s para confirmarse.
  NAVEGACION_ROTA: 30_000,
} as const;

// ─── Submódulos ───────────────────────────────────────────────────────────────

/**
 * Submódulos del menú "Tienda en Linea" (URLs confirmadas en vivo desde el
 * menú lateral del dashboard). El sidebar tiene, de forma inusual, **dos**
 * entradas de nivel superior con el mismo nombre "Tienda en Linea" (confirmado
 * explorando el DOM: ambas son `<li>` hijos directos del menú principal, no
 * una anidada dentro de la otra) — esta lista combina los submódulos de
 * ambas, sin duplicar las URLs que coinciden entre las dos (p.ej. "Métodos
 * de Pago"/"Opciones de Pago" y "Admin. Redes Sociales"/"Redes Sociales"
 * apuntan al mismo `pay/payment` y `social/social_accounts`
 * respectivamente). Un tercer grupo, "Despacho de órdenes"/"Órdenes", vive
 * anidado dentro de "Reportes" como categoría de reporte — no es un
 * submódulo propio de "Tienda en Linea" y se deja fuera.
 *
 * Cada entrada define, además del título de página esperado, un locator
 * propio de su contenido para confirmar que cargó su pantalla real. Los
 * patrones de `.content-header` usan `\s+` entre palabras (en vez de un
 * espacio literal) porque el texto real del DOM tiene saltos de línea entre
 * ellas (confirmado en vivo con "Banner"/"Ofertas": `hasText` con RegExp
 * compara contra `textContent` sin colapsar espacios, a diferencia de
 * `innerText`).
 */
export type SubmoduloTienda = {
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

export const SUBMODULOS_TIENDA: SubmoduloTienda[] = [
  {
    nombre: 'Panel de Control',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/soSetting/storeOnlineSetting',
    rutaEsperada: 'storeOnlineSetting',
    tituloEsperado: /panel de control de la tienda/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /panel\s+administrativo/i),
  },
  {
    nombre: 'Tema',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/online_store_appearance/appearance_settings',
    rutaEsperada: 'appearance_settings',
    tituloEsperado: /conf\. de la tienda/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /configuraci[oó]n\s+de\s+la\s+tienda/i),
  },
  {
    nombre: 'Admin. Zonas de Entrega',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/osDeliveryZone/adminDeliveryZone',
    rutaEsperada: 'adminDeliveryZone',
    tituloEsperado: /config\. de entrega/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /config\.\s+de\s+entrega/i),
  },
  {
    nombre: 'Administración de ofertas',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/rest/combosadmin',
    rutaEsperada: 'combosadmin',
    tituloEsperado: /administrar combos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar\s+combos/i),
  },
  {
    nombre: 'Administración de puntos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/rest/adminpointsproduct',
    rutaEsperada: 'adminpointsproduct',
    tituloEsperado: /puntos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administraci[oó]n\s+de\s+puntos/i),
  },
  {
    nombre: 'Admin. Redes Sociales',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/social/social_accounts',
    rutaEsperada: 'social_accounts',
    tituloEsperado: /admin\. redes sociales/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /admin\.\s+redes\s+sociales/i),
  },
  {
    nombre: '(%) Admin. Descuentos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/store_discount/admin',
    rutaEsperada: 'store_discount/admin',
    tituloEsperado: /admin\. descuentos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /admin\.\s+descuentos/i),
  },
  {
    nombre: 'Agregar Productos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/prod/product',
    rutaEsperada: 'prod/product',
    tituloEsperado: /inventario/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administraci[oó]n\s+de\s+productos/i),
  },
  {
    nombre: 'Métodos de Pago',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/pay/payment',
    rutaEsperada: 'pay/payment',
    tituloEsperado: /opciones de pago/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /m[eé]todos\s+de\s+pago/i),
  },
  {
    nombre: 'Ofertas del día',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/deal_products/deal_products',
    rutaEsperada: 'deal_products',
    tituloEsperado: /ofertas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /ofertas\s+del\s+d[ií]a/i),
  },
  {
    nombre: 'Términos y Condiciones',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/tc/terms_and_conditions?type_conditions=1',
    rutaEsperada: 'terms_and_conditions',
    tituloEsperado: /t[eé]rminos y cond/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /t[eé]rminos\s+y\s+condiciones/i),
  },
  {
    nombre: 'Configuración de Horario',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/comp/admin_schedule_company',
    rutaEsperada: 'admin_schedule_company',
    tituloEsperado: /horario compa[ñn]ia/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /configuraci[oó]n\s+de\s+horarios/i),
  },
  {
    nombre: 'Banner',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/banner/banner',
    rutaEsperada: 'banner/banner',
    tituloEsperado: /banners/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /banners\s+panel/i),
  },
  {
    nombre: 'Ofertas',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/off/offer',
    rutaEsperada: 'off/offer',
    tituloEsperado: /ofertas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /^\s*ofertas\s+panel/i),
  },
  {
    nombre: 'Opciones de Envío',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/ship/shipping',
    rutaEsperada: 'ship/shipping',
    tituloEsperado: /opciones de env[ií]o/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /opciones\s+de\s+env[ií]o/i),
  },
  {
    nombre: 'Contacto',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/cont/contact',
    rutaEsperada: 'cont/contact',
    tituloEsperado: /conf\. de contacto/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /configuraci[oó]n\s+de\s+contacto/i),
  },
  {
    nombre: 'Mision y visión',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/mv/mision_and_vision',
    rutaEsperada: 'mision_and_vision',
    tituloEsperado: /mision y vision/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /misi[oó]n\s+y\s+visi[oó]n/i),
  },
  // "Ver la Tienda" queda fuera de este listado — ver hallazgo documentado
  // junto a VER_TIENDA_ROTO más abajo.
];

/**
 * Hallazgo confirmado en vivo (dos veces, en aislamiento): "Ver la Tienda"
 * no carga — la navegación entra en un bucle de redirecciones
 * (`net::ERR_TOO_MANY_REDIRECTS`) y nunca llega a renderizar. Se documenta
 * como hallazgo (mismo criterio que "Reporte de Inspección" en
 * gestion-navegacion.spec.ts) en vez de omitirlo silenciosamente.
 */
export const VER_TIENDA_ROTO = {
  nombre: 'Ver la Tienda',
  url: 'https://dev.designsoftcr.com/qa_talleralpha/public/online_orders/dashboard',
} as const;

// ─── Page Object ──────────────────────────────────────────────────────────────

export class TiendaPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Tienda en Linea. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
