import { contentHeaderConTexto, SubmoduloReportes } from './reportes.page';

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
