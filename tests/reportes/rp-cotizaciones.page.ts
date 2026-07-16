import { contentHeaderConTexto, SubmoduloReportes } from './reportes.page';

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
