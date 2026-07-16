import { contentHeaderConTexto, SubmoduloReportes } from './reportes.page';

export const SUBMODULOS_REPORTES_RIFAS: SubmoduloReportes[] = [
  {
    nombre: 'Rifas',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/raffleReport',
    rutaEsperada: 'raffleReport',
    tituloEsperado: /reporte de rifas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de rifas/i),
  },
];
