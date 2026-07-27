import { contentHeaderConTexto, SubmoduloReportes } from './reportes.page';
import { BASE_URL } from '../env.config';

export const SUBMODULOS_REPORTES_RIFAS: SubmoduloReportes[] = [
  {
    nombre: 'Rifas',
    url: BASE_URL + '/reports/raffleReport',
    rutaEsperada: 'raffleReport',
    tituloEsperado: /reporte de rifas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de rifas/i),
  },
];
