import { contentHeaderConTexto, SubmoduloReportes } from './reportes.page';

export const SUBMODULOS_REPORTES_RUTEO: SubmoduloReportes[] = [
  {
    nombre: 'Comisiones por vendedor',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/routeReport',
    rutaEsperada: 'routeReport',
    tituloEsperado: /reporte de comisiones/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de comisiones/i),
  },
];
