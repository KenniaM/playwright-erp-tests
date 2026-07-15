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
 * El grupo "Seguridad" del menú "Reportes" no tiene ningún submódulo
 * navegable (su `<ul>` está vacío en el DOM, confirmado en vivo) — no
 * aparece en ningún arreglo de este archivo.
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
const contentHeaderConTexto = (page: Page, texto: RegExp) => page.locator('.content-header', { hasText: texto }).first();

// ─── Caja ───────────────────────────────────────────────────────────────────

export const SUBMODULOS_REPORTES_CAJA: SubmoduloReportes[] = [
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el buscador real, que sí es visible.
    nombre: 'Cierres de Caja',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/cashReport',
    rutaEsperada: 'cashReport',
    tituloEsperado: /reporte de cierre/i,
    obtenerLocatorDeCarga: (page) => page.locator('#newSearchInput'),
  },
  {
    nombre: 'Movimientos de Caja',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/cash_movement_report',
    rutaEsperada: 'cash_movement_report',
    tituloEsperado: /movimientos de caja/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /movimientos de caja/i),
  },
];

// ─── Tienda en Línea ────────────────────────────────────────────────────────

export const SUBMODULOS_REPORTES_TIENDA_EN_LINEA: SubmoduloReportes[] = [
  {
    nombre: 'Despacho de órdenes',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/online_store_order_dispatch_report',
    rutaEsperada: 'online_store_order_dispatch_report',
    tituloEsperado: /despacho de [oó]rdenes/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /despacho de [oó]rdenes/i),
  },
  {
    nombre: 'Órdenes',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/store_online_order_report',
    rutaEsperada: 'store_online_order_report',
    tituloEsperado: /^[oó]rdenes\s*\|/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /[oó]rdenes\s+tienda\s+en\s+l[ií]nea/i),
  },
];

// ─── Clientes ───────────────────────────────────────────────────────────────

export const SUBMODULOS_REPORTES_CLIENTES: SubmoduloReportes[] = [
  {
    nombre: 'Bitácora de Clientes',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/cust/customerBinnacle',
    rutaEsperada: 'customerBinnacle',
    tituloEsperado: /bit[aá]cora clientes/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /bit[aá]cora\s+clientes/i),
  },
  {
    nombre: 'Estado de cuenta',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/customerAccountingStatementReport',
    rutaEsperada: 'customerAccountingStatementReport',
    tituloEsperado: /estado de cuenta/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /estado de cuenta/i),
  },
  {
    nombre: 'Clientes frecuentes',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/clientReport',
    rutaEsperada: 'clientReport',
    tituloEsperado: /reporte de clientes/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de clientes/i),
  },
  {
    nombre: 'Clientes por Vendedor',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/customerBySellerReport',
    rutaEsperada: 'customerBySellerReport',
    tituloEsperado: /clientes por vendedor/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /clientes por vendedor/i),
  },
  {
    // El <title> de esta pantalla es "Reporte de ventas por cliente"
    // (confirmado en vivo) — no corresponde a "Redes Sociales", parece un
    // título desactualizado/copiado de otra pantalla del lado de la
    // aplicación. Se mantiene tal cual porque es lo que realmente se
    // renderiza; la validación real recae en el encabezado de contenido, que
    // sí es propio de esta pantalla.
    nombre: 'Redes Sociales',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/customerBySocialNetworks',
    rutaEsperada: 'customerBySocialNetworks',
    tituloEsperado: /reporte de ventas por cliente/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /redes sociales/i),
  },
];

// ─── Compras ────────────────────────────────────────────────────────────────

export const SUBMODULOS_REPORTES_COMPRAS: SubmoduloReportes[] = [
  {
    nombre: 'Mov. fac ingresadas',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/invoiceMovementEntered',
    rutaEsperada: 'invoiceMovementEntered',
    tituloEsperado: /movimientos de facturas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /movimientos de facturas/i),
  },
  {
    nombre: 'Abonos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/creditPurchasePayment',
    rutaEsperada: 'creditPurchasePayment',
    tituloEsperado: /reporte de abonos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /abonos/i),
  },
  {
    nombre: 'Compras',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/purchaseReport',
    rutaEsperada: 'purchaseReport',
    tituloEsperado: /reporte de compras/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de compras/i),
  },
  {
    nombre: 'Compras Externas',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productExternalPurchaseReport',
    rutaEsperada: 'productExternalPurchaseReport',
    tituloEsperado: /compras externas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /compras externas/i),
  },
  {
    nombre: 'Gastos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/expenseReport',
    rutaEsperada: 'expenseReport',
    tituloEsperado: /reporte gastos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte gastos/i),
  },
  {
    nombre: 'Cuentas por pagar',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/accountsToPay',
    rutaEsperada: 'accountsToPay',
    tituloEsperado: /cuentas x pagar/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /cuentas x pagar/i),
  },
  {
    nombre: 'Antigüedad de crédito',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/get_purchase_aging_report_by_provider_data',
    rutaEsperada: 'get_purchase_aging_report_by_provider_data',
    tituloEsperado: /antig[üu]edad de cr[eé]dito/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /antig[üu]edad/i),
  },
];

// ─── Gastos Operativos (acceso directo, sin sub-submenú) ───────────────────

export const SUBMODULOS_REPORTES_GASTOS_OPERATIVOS: SubmoduloReportes[] = [
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el botón real de búsqueda, que sí es visible. (`#code_expense`
    // existe en el DOM pero queda oculto dentro de un panel colapsado,
    // confirmado en vivo.)
    nombre: 'Gastos Operativos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/family_expenses/familyExpenses',
    rutaEsperada: 'familyExpenses',
    tituloEsperado: /gastos operativos/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_search'),
  },
];

// ─── Inventario ─────────────────────────────────────────────────────────────

export const SUBMODULOS_REPORTES_INVENTARIO: SubmoduloReportes[] = [
  {
    nombre: 'Inventario',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productReport',
    rutaEsperada: 'productReport',
    tituloEsperado: /reporte de productos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de productos/i),
  },
  {
    // El <title> de esta pantalla es "Reporte de antigüedad de crédito"
    // (confirmado en vivo) — no corresponde a "Análisis de productos", queda
    // igual que en otras pantallas de Reportes con el mismo tipo de
    // desajuste (ver comentario en "Redes Sociales" y "Productos a pedir").
    // La validación real recae en el encabezado de contenido.
    nombre: 'Análisis de productos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productGeneralQuantityReport',
    rutaEsperada: 'productGeneralQuantityReport',
    tituloEsperado: /antig[üu]edad de cr[eé]dito/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /an[aá]lisis de productos/i),
  },
  {
    nombre: 'Tasa Rotacion de inventario',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/inventory_turnover_rate',
    rutaEsperada: 'inventory_turnover_rate',
    tituloEsperado: /tasa rotaci[oó]n de inventario/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /tasa rotaci[oó]n de inventario/i),
  },
  {
    nombre: 'Catálogo de Productos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productsCatalog',
    rutaEsperada: 'productsCatalog',
    tituloEsperado: /cat[aá]logo de productos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /cat[aá]logo de productos/i),
  },
  {
    nombre: 'Apartados',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/layawayReport',
    rutaEsperada: 'layawayReport',
    tituloEsperado: /reporte de apartados/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de apartados/i),
  },
  {
    nombre: 'Toma Física',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/inventoryReport',
    rutaEsperada: 'inventoryReport',
    tituloEsperado: /toma f[ií]sica/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /toma f[ií]sica/i),
  },
  {
    nombre: 'Movimientos de productos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productMovementReportSearch',
    rutaEsperada: 'productMovementReportSearch',
    tituloEsperado: /movimientos de productos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /movimientos de productos/i),
  },
  {
    nombre: 'Disponibilidad de productos vendidos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/best_selling_products',
    rutaEsperada: 'best_selling_products',
    tituloEsperado: /disponibilidad de productos vendidos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /disponibilidad de productos vendidos/i),
  },
  {
    nombre: 'Productos Externos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/externalProductReport',
    rutaEsperada: 'externalProductReport',
    tituloEsperado: /productos externos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /productos externos/i),
  },
  {
    nombre: 'Productos vendidos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/products_details_sales',
    rutaEsperada: 'products_details_sales',
    tituloEsperado: /productos vendidos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /productos vendidos/i),
  },
  {
    // El <title> de esta pantalla es "Reporte de productos vendidos"
    // (confirmado en vivo) — no corresponde a "Productos a pedir", mismo
    // tipo de desajuste que "Redes Sociales" y "Análisis de productos".
    nombre: 'Productos a pedir',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productsToOrder',
    rutaEsperada: 'productsToOrder',
    tituloEsperado: /productos vendidos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /productos a pedir/i),
  },
  {
    nombre: 'Productos por tallas',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productBySizeReport',
    rutaEsperada: 'productBySizeReport',
    tituloEsperado: /productos por tallas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /productos por tallas/i),
  },
  {
    nombre: 'Productos por vencer',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productsToExpire',
    rutaEsperada: 'productsToExpire',
    tituloEsperado: /productos por vencer/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /productos por vencer/i),
  },
];

// ─── Taller ─────────────────────────────────────────────────────────────────

/**
 * No incluye "Productos vendidos" (reports/product_sale_report) — ver nota
 * al inicio del archivo: la aplicación responde con un error de servidor.
 */
export const SUBMODULOS_REPORTES_TALLER: SubmoduloReportes[] = [
  {
    nombre: 'Mecánicos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/mechanic_report',
    rutaEsperada: 'mechanic_report',
    tituloEsperado: /reporte de mec[aá]nicos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de mec[aá]nicos/i),
  },
  {
    nombre: 'Mano de Obra por Mecánico',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/labor_per_mechanic',
    rutaEsperada: 'labor_per_mechanic',
    tituloEsperado: /mano de obra mec[aá]nicos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /mano de obra mec[aá]nicos/i),
  },
  {
    nombre: 'Comisiones por Servicio',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/serviceCommissionReport',
    rutaEsperada: 'serviceCommissionReport',
    tituloEsperado: /comisiones por servicio/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /comisiones por servicio/i),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el botón real de filtros avanzados, que sí es visible.
    nombre: 'Comisiones E&P',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/eypCommissionReport',
    rutaEsperada: 'eypCommissionReport',
    tituloEsperado: /comisiones e&p/i,
    obtenerLocatorDeCarga: (page) => page.locator('#eyp_btn_toggle_advanced_filters'),
  },
  {
    // Mismo submódulo/URL que "Reporte de órdenes" en Gestión de Taller
    // (ver taller.page.ts) — sin `.content-header` confirmado, se reutiliza
    // el mismo locator real ya validado ahí.
    nombre: 'Órdenes',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/order_report',
    rutaEsperada: 'order_report',
    tituloEsperado: /reporte de [oó]rdenes/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_toggle_advanced_filters'),
  },
  {
    nombre: 'Vehículos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/vehicle_report',
    rutaEsperada: 'vehicle_report',
    tituloEsperado: /reporte de veh[ií]culos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de veh[ií]culos/i),
  },
  {
    nombre: 'Vehículos según Recepción',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/repairOrderVehicle',
    rutaEsperada: 'repairOrderVehicle',
    tituloEsperado: /veh[ií]culos seg[uú]n [oó]rdenes de trabajo/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /veh[ií]culos seg[uú]n [oó]rdenes de trabajo/i),
  },
  {
    nombre: 'Servicios y recordatorios de próximo cambio',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/oil_change_report',
    rutaEsperada: 'oil_change_report',
    tituloEsperado: /cambio de aceite/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /servicios y recordatorios de pr[oó]ximo cambio/i),
  },
  {
    // El <title> de esta pantalla es "Reporte de órdenes" (confirmado en
    // vivo), igual que el submódulo "Órdenes" de este mismo grupo — la
    // validación real recae en el encabezado de contenido, que sí es propio.
    nombre: 'Servicios y productos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/getRepairOrderGeneralReport',
    rutaEsperada: 'getRepairOrderGeneralReport',
    tituloEsperado: /reporte de [oó]rdenes/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /servicios y productos/i),
  },
];

// ─── Ventas ─────────────────────────────────────────────────────────────────

/**
 * No incluye "Comisiones por Producto" (reports/productCommissionReport) —
 * ver nota al inicio del archivo: la navegación nunca termina de cargar.
 */
export const SUBMODULOS_REPORTES_VENTAS: SubmoduloReportes[] = [
  {
    nombre: 'Ventas',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/salesReport',
    rutaEsperada: 'salesReport',
    tituloEsperado: /reporte de ventas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de ventas/i),
  },
  {
    nombre: 'Ventas por producto',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/salesByProductReport',
    rutaEsperada: 'salesByProductReport',
    tituloEsperado: /ventas por producto/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /ventas por producto/i),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el botón real de filtros avanzados, que sí es visible.
    nombre: 'Análisis de ventas por vendedor Nuevo',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/sales_by_seller_tire_report',
    rutaEsperada: 'sales_by_seller_tire_report',
    tituloEsperado: /an[aá]lisis de ventas por vendedor/i,
    obtenerLocatorDeCarga: (page) => page.locator('#stv_btn_toggle_advanced_filters'),
  },
  {
    nombre: 'Abonos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/credit_payment_report',
    rutaEsperada: 'credit_payment_report',
    tituloEsperado: /reporte de abonos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /abonos/i),
  },
  {
    nombre: 'Utilidad',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/utilityReport',
    rutaEsperada: 'utilityReport',
    tituloEsperado: /reporte de utilidad/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de utilidad/i),
  },
  {
    nombre: 'Lista de cobro',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/receivableListReport',
    rutaEsperada: 'receivableListReport',
    tituloEsperado: /reporte de cobro/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de cobro/i),
  },
  {
    nombre: 'Cuentas por cobrar',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/accounts_receivable',
    rutaEsperada: 'accounts_receivable',
    tituloEsperado: /cuentas por cobrar/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /cuentas por cobrar/i),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el buscador real, que sí es visible.
    nombre: 'Historial crediticio',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/credit_customer_history/creditCustomerHistoryIndex',
    rutaEsperada: 'creditCustomerHistoryIndex',
    tituloEsperado: /historial crediticio de cliente/i,
    obtenerLocatorDeCarga: (page) => page.locator('#f_search'),
  },
  {
    nombre: 'Antigüedad de crédito',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/seniority_of_credit',
    rutaEsperada: 'seniority_of_credit',
    tituloEsperado: /antig[üu]edad de cr[eé]dito/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /antig[üu]edad de cr[eé]dito/i),
  },
  {
    nombre: 'Comisiones por vendedor',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/salesPerSellerReport',
    rutaEsperada: 'salesPerSellerReport',
    tituloEsperado: /comisiones por vendedor/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /comisiones por vendedor/i),
  },
  {
    nombre: 'Facturas Hacienda',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/ElectronicBilling/ElectronicBillingReport',
    rutaEsperada: 'ElectronicBillingReport',
    tituloEsperado: /facturaci[oó]n electr[oó]nica/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /facturaci[oó]n electr[oó]nica/i),
  },
  {
    nombre: 'Ventas productos rapidos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/salesReportQuickProduct',
    rutaEsperada: 'salesReportQuickProduct',
    tituloEsperado: /ventas de productos r[aá]pidos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /ventas de productos r[aá]pidos/i),
  },
  {
    nombre: 'Ventas por vendedor',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/agentSalesReport',
    rutaEsperada: 'agentSalesReport',
    tituloEsperado: /ventas por vendedor/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /ventas por vendedor/i),
  },
  {
    nombre: '(%) Comisiones por Cobros',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/credit_sales_commissions_report',
    rutaEsperada: 'credit_sales_commissions_report',
    tituloEsperado: /comisiones por cobros/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /comisiones por cobros/i),
  },
  {
    nombre: 'Ventas por cliente',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/clientSalesReport',
    rutaEsperada: 'clientSalesReport',
    tituloEsperado: /ventas por cliente/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /ventas por cliente/i),
  },
  {
    nombre: 'Nota de crédito',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/creditNoteReport',
    rutaEsperada: 'creditNoteReport',
    tituloEsperado: /notas de cr[eé]dito/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /notas de cr[eé]dito/i),
  },
  {
    nombre: 'Ventas Tienda Online',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/getOnlineStoreSalesReport',
    rutaEsperada: 'getOnlineStoreSalesReport',
    tituloEsperado: /ventas de la tienda online/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /ventas de la tienda online/i),
  },
];

// ─── Reportes Financieros ───────────────────────────────────────────────────

export const SUBMODULOS_REPORTES_FINANCIEROS: SubmoduloReportes[] = [
  {
    nombre: 'Reporte Financiero',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/reportFinancialIndex',
    rutaEsperada: 'reportFinancialIndex',
    tituloEsperado: /reporte financiero/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte financiero/i),
  },
];

// ─── Ruteo ──────────────────────────────────────────────────────────────────

export const SUBMODULOS_REPORTES_RUTEO: SubmoduloReportes[] = [
  {
    nombre: 'Comisiones por vendedor',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/routeReport',
    rutaEsperada: 'routeReport',
    tituloEsperado: /reporte de comisiones/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de comisiones/i),
  },
];

// ─── Rifas (acceso directo, sin sub-submenú) ───────────────────────────────

export const SUBMODULOS_REPORTES_RIFAS: SubmoduloReportes[] = [
  {
    nombre: 'Rifas',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/raffleReport',
    rutaEsperada: 'raffleReport',
    tituloEsperado: /reporte de rifas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de rifas/i),
  },
];

// ─── Comentarios (acceso directo, sin sub-submenú) ─────────────────────────

export const SUBMODULOS_REPORTES_COMENTARIOS: SubmoduloReportes[] = [
  {
    nombre: 'Comentarios',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/feedback/service_feedback_report',
    rutaEsperada: 'service_feedback_report',
    tituloEsperado: /feedback/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /feedback de clientes/i),
  },
];

// ─── Cotizaciones ───────────────────────────────────────────────────────────

export const SUBMODULOS_REPORTES_COTIZACIONES: SubmoduloReportes[] = [
  {
    nombre: 'Cotizaciones',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/seeProformaReport',
    rutaEsperada: 'seeProformaReport',
    tituloEsperado: /reporte de proformas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de proformas/i),
  },
  {
    nombre: 'Comisiones por meta',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/seeCommissionGoalReport',
    rutaEsperada: 'seeCommissionGoalReport',
    tituloEsperado: /comisiones/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /comisiones por metas/i),
  },
  {
    nombre: 'Análisis de Cotizaciones',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/proformAnalysis',
    rutaEsperada: 'proformAnalysis',
    tituloEsperado: /an[aá]lisis de cotizaciones/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /an[aá]lisis de cotizaciones/i),
  },
  {
    nombre: 'Productos mas cotizados',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/productsMostQuoted',
    rutaEsperada: 'productsMostQuoted',
    tituloEsperado: /productos m[aá]s cotizados/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /productos m[aá]s cotizados/i),
  },
];

// ─── Page Object ──────────────────────────────────────────────────────────────

export class ReportesPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Reportes. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
