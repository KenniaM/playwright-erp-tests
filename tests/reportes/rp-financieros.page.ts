import { contentHeaderConTexto, SubmoduloReportes } from './reportes.page';

export const SUBMODULOS_REPORTES_FINANCIEROS: SubmoduloReportes[] = [
  {
    nombre: 'Reporte Financiero',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/reportFinancialIndex',
    rutaEsperada: 'reportFinancialIndex',
    tituloEsperado: /reporte financiero/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte financiero/i),
  },
];
