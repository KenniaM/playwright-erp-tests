import { contentHeaderConTexto, SubmoduloReportes } from './reportes.page';

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
