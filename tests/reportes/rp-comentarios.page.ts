import { contentHeaderConTexto, SubmoduloReportes } from './reportes.page';
import { BASE_URL } from '../env.config';

export const SUBMODULOS_REPORTES_COMENTARIOS: SubmoduloReportes[] = [
  {
    nombre: 'Comentarios',
    url: BASE_URL + '/feedback/service_feedback_report',
    rutaEsperada: 'service_feedback_report',
    tituloEsperado: /feedback/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /feedback de clientes/i),
  },
];
