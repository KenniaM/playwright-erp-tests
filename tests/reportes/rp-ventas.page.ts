import { contentHeaderConTexto, SubmoduloReportes } from './reportes.page';

/**
 * No incluye "Comisiones por Producto" (reports/productCommissionReport) —
 * ver nota en reportes.page.ts: la navegación nunca termina de cargar.
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
