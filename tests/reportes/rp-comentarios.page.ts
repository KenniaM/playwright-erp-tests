import { contentHeaderConTexto, SubmoduloReportes } from './reportes.page';

export const SUBMODULOS_REPORTES_COMENTARIOS: SubmoduloReportes[] = [
  {
    nombre: 'Comentarios',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/feedback/service_feedback_report',
    rutaEsperada: 'service_feedback_report',
    tituloEsperado: /feedback/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /feedback de clientes/i),
  },
];
