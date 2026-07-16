import { contentHeaderConTexto, SubmoduloReportes } from './reportes.page';

export const SUBMODULOS_REPORTES_TIENDA_EN_LINEA: SubmoduloReportes[] = [
  {
    nombre: 'Despacho de órdenes',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/online_store_order_dispatch_report',
    rutaEsperada: 'online_store_order_dispatch_report',
    tituloEsperado: /despacho de [oó]rdenes/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /despacho de [oó]rdenes/i),
  },
  {
    nombre: 'Órdenes',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/store_online_order_report',
    rutaEsperada: 'store_online_order_report',
    tituloEsperado: /^[oó]rdenes\s*\|/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /[oó]rdenes\s+tienda\s+en\s+l[ií]nea/i),
  },
];
