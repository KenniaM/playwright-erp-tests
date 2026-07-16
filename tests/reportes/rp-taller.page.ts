import { contentHeaderConTexto, SubmoduloReportes } from './reportes.page';

/**
 * No incluye "Productos vendidos" (reports/product_sale_report) — ver nota
 * en reportes.page.ts: la aplicación responde con un error de servidor.
 */
export const SUBMODULOS_REPORTES_TALLER: SubmoduloReportes[] = [
  {
    nombre: 'Mecánicos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/mechanic_report',
    rutaEsperada: 'mechanic_report',
    tituloEsperado: /reporte de mec[aá]nicos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de mec[aá]nicos/i),
  },
  {
    nombre: 'Mano de Obra por Mecánico',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/labor_per_mechanic',
    rutaEsperada: 'labor_per_mechanic',
    tituloEsperado: /mano de obra mec[aá]nicos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /mano de obra mec[aá]nicos/i),
  },
  {
    nombre: 'Comisiones por Servicio',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/serviceCommissionReport',
    rutaEsperada: 'serviceCommissionReport',
    tituloEsperado: /comisiones por servicio/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /comisiones por servicio/i),
  },
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el botón real de filtros avanzados, que sí es visible.
    nombre: 'Comisiones E&P',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/eypCommissionReport',
    rutaEsperada: 'eypCommissionReport',
    tituloEsperado: /comisiones e&p/i,
    obtenerLocatorDeCarga: (page) => page.locator('#eyp_btn_toggle_advanced_filters'),
  },
  {
    // Mismo submódulo/URL que "Reporte de órdenes" en Gestión de Taller
    // (ver taller.page.ts) — sin `.content-header` confirmado, se reutiliza
    // el mismo locator real ya validado ahí.
    nombre: 'Órdenes',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/order_report',
    rutaEsperada: 'order_report',
    tituloEsperado: /reporte de [oó]rdenes/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_toggle_advanced_filters'),
  },
  {
    nombre: 'Vehículos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/vehicle_report',
    rutaEsperada: 'vehicle_report',
    tituloEsperado: /reporte de veh[ií]culos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de veh[ií]culos/i),
  },
  {
    nombre: 'Vehículos según Recepción',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/repairOrderVehicle',
    rutaEsperada: 'repairOrderVehicle',
    tituloEsperado: /veh[ií]culos seg[uú]n [oó]rdenes de trabajo/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /veh[ií]culos seg[uú]n [oó]rdenes de trabajo/i),
  },
  {
    nombre: 'Servicios y recordatorios de próximo cambio',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/oil_change_report',
    rutaEsperada: 'oil_change_report',
    tituloEsperado: /cambio de aceite/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /servicios y recordatorios de pr[oó]ximo cambio/i),
  },
  {
    // El <title> de esta pantalla es "Reporte de órdenes" (confirmado en
    // vivo), igual que el submódulo "Órdenes" de este mismo grupo — la
    // validación real recae en el encabezado de contenido, que sí es propio.
    nombre: 'Servicios y productos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/getRepairOrderGeneralReport',
    rutaEsperada: 'getRepairOrderGeneralReport',
    tituloEsperado: /reporte de [oó]rdenes/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /servicios y productos/i),
  },
];
