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
 * Submódulos del menú "Configuración" (nivel superior, URLs confirmadas en
 * vivo desde el menú lateral del dashboard). No incluye "Panel de control"
 * (`sett/setting`): ese submódulo ya tiene su propia suite completa en
 * `panel-control.spec.ts` dentro de esta misma carpeta — aquí se agrega solo
 * un test de carga básico para no duplicar esa cobertura (ver
 * `configuraciones-navegacion.spec.ts`).
 *
 * Varias URLs coinciden con submódulos ya cubiertos en otros módulos (p.ej.
 * "Admin. Impuestos"/`prod/companyTaxAdmin` con Inventario, "Admin. Cuentas
 * Bancarias"/`bank_account/bank_account` con Bancos, "Facturación
 * Electrónica"/`comp/electronicBilling` con facturacion-electronica,
 * "Config. Horarios"/`comp/admin_schedule_company` con Tienda en Linea,
 * "Términos y Condiciones"/`tc/terms_and_conditions?type_conditions=1` con
 * Tienda en Linea) — se incluyen igual porque este menú también las enlaza
 * (mismo criterio usado en los módulos anteriores).
 */
export type SubmoduloConfiguraciones = {
  nombre: string;
  url: string;
  // Substring que debe contener la URL final tras navegar, para detectar
  // redirecciones inesperadas (p.ej. a login por sesión expirada).
  rutaEsperada: string;
  tituloEsperado: RegExp;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

/**
 * Locator del breadcrumb/encabezado de contenido, propio de cada submódulo.
 * `\s+` entre palabras porque el texto real del DOM tiene saltos de línea
 * entre ellas (confirmado en vivo, mismo hallazgo documentado en
 * tienda.page.ts) — `hasText` con RegExp compara contra `textContent` sin
 * colapsar espacios como sí hace `innerText`.
 */
const contentHeaderConTexto = (page: Page, texto: RegExp) => page.locator('.content-header', { hasText: texto }).first();

export const SUBMODULOS_CONFIGURACIONES: SubmoduloConfiguraciones[] = [
  {
    nombre: 'Admin. Activos',
    url: BASE_URL + '/bussinesAssets/bussines_assets',
    rutaEsperada: 'bussinesAssets',
    tituloEsperado: /activos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /activos\s+panel/i),
  },
  {
    // Sin `.content-header`/`button[id]`/`input[placeholder]` en esta
    // pantalla (confirmado en vivo, estructura distinta al resto) — se
    // valida con un campo real del formulario de metas.
    nombre: 'Admin Dashboard',
    url: BASE_URL + '/dashboard_setting/index',
    rutaEsperada: 'dashboard_setting/index',
    tituloEsperado: /configuraci[oó]n dashboard/i,
    obtenerLocatorDeCarga: (page) => page.locator('#daily_goal'),
  },
  {
    // El `.content-header` de esta pantalla existe pero NO es visible
    // (confirmado en vivo: el título real vive en un `<h1>` fuera de él,
    // mismo patrón documentado en ventas.page.ts para "Histórico de
    // Ventas"/"Nota de crédito") — se valida con el buscador real.
    nombre: 'Administrador de textos',
    url: BASE_URL + '/textAdmin',
    rutaEsperada: 'textAdmin',
    tituloEsperado: /administrador de textos/i,
    obtenerLocatorDeCarga: (page) => page.locator('#ta_search'),
  },
  {
    nombre: 'Administrador de Notificaciones',
    url: BASE_URL + '/web_notification_manager',
    rutaEsperada: 'web_notification_manager',
    tituloEsperado: /administrador de notificaciones/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrador\s+de\s+notificaciones/i),
  },
  {
    nombre: 'Compañías',
    url: BASE_URL + '/comp/company',
    rutaEsperada: 'comp/company',
    tituloEsperado: /compa[ñn]ías/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /compa[ñn]ías/i),
  },
  {
    nombre: 'Plantillas de Facturas',
    url: BASE_URL + '/invoiceSetting/invoiceSetting',
    rutaEsperada: 'invoiceSetting',
    tituloEsperado: /configuraci[oó]n de factura/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar\s+factura/i),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se
    // valida con el botón real de agregar.
    nombre: 'Crear usuarios',
    url: BASE_URL + '/emp/employee',
    rutaEsperada: 'emp/employee',
    tituloEsperado: /usuarios/i,
    obtenerLocatorDeCarga: (page) => page.locator('#add_company'),
  },
  {
    nombre: 'Roles y permisos',
    url: BASE_URL + '/roleAdmin/roleAdmin',
    rutaEsperada: 'roleAdmin',
    tituloEsperado: /admin\. roles/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /admin\.\s+roles/i),
  },
  {
    nombre: 'Crear y asignar cajas',
    url: BASE_URL + '/adminCash/adminCash',
    rutaEsperada: 'adminCash',
    tituloEsperado: /admin\. cajas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /admin\.\s+cajas/i),
  },
  {
    nombre: 'Admin. Impuestos',
    url: BASE_URL + '/prod/companyTaxAdmin',
    rutaEsperada: 'companyTaxAdmin',
    tituloEsperado: /administrador de impuestos para productos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrador\s+de\s+impuestos\s+para\s+productos/i),
  },
  {
    nombre: 'Admin. Moneda',
    url: BASE_URL + '/adminCurr/adminCurrency',
    rutaEsperada: 'adminCurrency',
    tituloEsperado: /monedas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar\s+monedas/i),
  },
  {
    nombre: 'Admin. Tipos Identificación',
    url: BASE_URL + '/cust/adminCustomerType',
    rutaEsperada: 'adminCustomerType',
    tituloEsperado: /admin\. tipos identificaci[oó]n/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /admin\.\s+tipos\s+identificaci[oó]n/i),
  },
  {
    nombre: 'Configuración SMTP',
    url: BASE_URL + '/smtp_config/smtpConfig',
    rutaEsperada: 'smtpConfig',
    tituloEsperado: /configuraci[oó]n smtp/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /configuraci[oó]n\s+de\s+smtp/i),
  },
  {
    nombre: 'Tipos de Compañías',
    url: BASE_URL + '/comp/companyType',
    rutaEsperada: 'companyType',
    tituloEsperado: /tipos de compa[ñn]ía/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /tipos\s+de\s+compa[ñn]ía/i),
  },
  {
    nombre: 'Admin. Comisiones',
    url: BASE_URL + '/commissions/admin_commissions',
    rutaEsperada: 'admin_commissions',
    tituloEsperado: /comisiones/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /admin\.\s+comisiones/i),
  },
  {
    nombre: 'Admin. Gastos y Servicios',
    url: BASE_URL + '/expensetype_services/admin_expense_type_service',
    rutaEsperada: 'admin_expense_type_service',
    tituloEsperado: /gastos y servicios/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /admin\.\s+gastos\s+y\s+servicios/i),
  },
  {
    nombre: 'Admin. Secciones de prod',
    url: BASE_URL + '/pSection/productSection',
    rutaEsperada: 'productSection',
    tituloEsperado: /secciones de productos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /secciones\s+de\s+productos/i),
  },
  {
    nombre: 'Admin. Impresoras',
    url: BASE_URL + '/CommandPrinter/config',
    rutaEsperada: 'CommandPrinter',
    tituloEsperado: /configuraci[oó]n de impresora/i,
    // Confirmado en vivo (ambos ambientes, taller y qa_restaurant): esta
    // pantalla nunca tuvo un `.content-header` real (countContentHeader=0 en
    // los dos) — no es una diferencia entre ambientes, el selector original
    // simplemente nunca fue válido para esta pantalla específica. Usa el
    // `h1` real de la página en su lugar, mismo criterio ya usado en
    // contabilidad.page.ts para el mismo problema.
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /configuraci[oó]n de impresora/i }),
  },
  {
    nombre: 'Admin. Prod. más vendidos',
    url: BASE_URL + '/adminMostSelled/adminMostSelled',
    rutaEsperada: 'adminMostSelled',
    tituloEsperado: /productos m[aá]s vendidos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /prod\.\s+m[aá]s\s+vendidos/i),
  },
  {
    nombre: 'Admin. CABYS',
    url: BASE_URL + '/adminCabys/adminCaby',
    rutaEsperada: 'adminCabys/adminCaby',
    tituloEsperado: /admin cabys/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar\s+cabys/i),
  },
  {
    nombre: 'Admin. Zonas',
    url: BASE_URL + '/zone/admin',
    rutaEsperada: 'zone/admin',
    tituloEsperado: /admin\. zonas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar\s+zonas/i),
  },
  {
    nombre: 'Admin. Estado Civil',
    url: BASE_URL + '/cStatus/adminCivilStatus',
    rutaEsperada: 'adminCivilStatus',
    tituloEsperado: /estado civil/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar\s+estado\s+civil/i),
  },
  {
    nombre: 'Admin. Títulos',
    url: BASE_URL + '/adminTitle/adminTitle',
    rutaEsperada: 'adminTitle',
    tituloEsperado: /t[ií]tulos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar\s+t[ií]tulos/i),
  },
  {
    nombre: 'Facturación Electrónica',
    url: BASE_URL + '/comp/electronicBilling',
    rutaEsperada: 'electronicBilling',
    tituloEsperado: /facturaci[oó]n electr[oó]nica/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /configuraci[oó]n\s+de\s+facturaci[oó]n\s+electr[oó]nica/i),
  },
  {
    nombre: 'Config. Horarios',
    url: BASE_URL + '/comp/admin_schedule_company',
    rutaEsperada: 'admin_schedule_company',
    tituloEsperado: /horario compa[ñn]ia/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /configuraci[oó]n\s+de\s+horarios/i),
  },
  {
    nombre: 'Img. defecto',
    url: BASE_URL + '/image/default_image',
    rutaEsperada: 'default_image',
    tituloEsperado: /admin imagenes defecto/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /imagenes\s+por\s+defecto/i),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo, mismo
    // hallazgo documentado en bancos.page.ts) — se valida con el buscador real.
    nombre: 'Admin. Cuentas Bancarias',
    url: BASE_URL + '/bank_account/bank_account',
    rutaEsperada: 'bank_account/bank_account',
    tituloEsperado: /cuentas bancarias/i,
    obtenerLocatorDeCarga: (page) => page.locator('input[placeholder="Buscar por banco o número de cuenta..."]'),
  },
  {
    nombre: 'Admin. Redes Sociales',
    url: BASE_URL + '/adminsocialnetworks/adminSocialNetwork',
    rutaEsperada: 'adminSocialNetwork',
    tituloEsperado: /admin\. redes sociales/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /admin\.\s+redes\s+sociales/i),
  },
  {
    nombre: 'Config. Woocommerce',
    url: BASE_URL + '/woocommerce/adminWooCommerce',
    rutaEsperada: 'adminWooCommerce',
    tituloEsperado: /config\. woocommerce/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /configuraci[oó]n\s+de\s+woocommerce/i),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se
    // valida con el botón real de agregar plan.
    nombre: 'Config. Módulo de créditos',
    url: BASE_URL + '/credit_module_config/adminCreditModule',
    rutaEsperada: 'adminCreditModule',
    tituloEsperado: /m[oó]dulo de cr[eé]ditos/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_add_plan'),
  },
  {
    nombre: 'Términos y Condiciones',
    url: BASE_URL + '/tc/terms_and_conditions?type_conditions=1',
    rutaEsperada: 'terms_and_conditions',
    tituloEsperado: /t[eé]rminos y cond/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /t[eé]rminos\s+y\s+condiciones/i),
  },
];
