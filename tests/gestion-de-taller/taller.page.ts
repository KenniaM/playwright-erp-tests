import { Locator, Page } from '@playwright/test';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  // Cada submódulo popula su contenido (filtros/tabla/tablero) vía AJAX tras
  // cargar la página — se hace polling hasta este límite antes de leer su estado.
  CARGA:    15_000,
} as const;

// ─── Submódulos ───────────────────────────────────────────────────────────────

/**
 * Submódulos del menú "Gestión de Taller" (URLs confirmadas en vivo desde el
 * menú lateral del dashboard). Cada uno define, además de la ruta esperada,
 * un locator propio de su contenido — no compartido con ningún otro
 * submódulo — para confirmar que cargó su pantalla real y no solo que el
 * layout general (header/sidebar) respondió.
 *
 * `tituloEsperado` es opcional: dos submódulos (`Servicios End. y Pintura` y
 * `Ajustes de flujo de trabajo`) tienen un <title> de documento que no
 * identifica la página (confirmado en vivo, ver comentarios junto a cada
 * uno) — para esos se omite y se valida solo con el locator de contenido.
 */
export type SubmoduloTaller = {
  nombre: string;
  url: string;
  // Substring que debe contener la URL final tras navegar, para detectar
  // redirecciones inesperadas (p.ej. a login por sesión expirada).
  rutaEsperada: string;
  tituloEsperado?: RegExp;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

/** Locator del breadcrumb/encabezado de contenido, reutilizado por la mayoría de submódulos. */
const contentHeaderConTexto = (page: Page, texto: RegExp) => page.locator('.content-header', { hasText: texto });

export const SUBMODULOS_TALLER_PRINCIPALES: SubmoduloTaller[] = [
  {
    nombre: 'Recepción de Vehículo',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/vehicularReception/vehicularQuickReception',
    rutaEsperada: 'vehicularQuickReception',
    tituloEsperado: /recepci[oó]n vehicular/i,
    obtenerLocatorDeCarga: (page) => page.locator('#repair_order_search'),
  },
  {
    nombre: 'Tablero de Órdenes de Trabajo',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/vehicularReception/workOrderBoard',
    rutaEsperada: 'workOrderBoard',
    tituloEsperado: /tablero kanban/i,
    obtenerLocatorDeCarga: (page) => page.locator('#kanban-config-menu-btn'),
  },
  {
    nombre: 'Estadísticas órdenes',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/vehicularReception/vehicularReceptionDetails',
    rutaEsperada: 'vehicularReceptionDetails',
    tituloEsperado: /reporte de recepci[oó]n vehicular/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /recepci[oó]n vehicular/i),
  },
  {
    nombre: 'Recordatorios RTV',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/rtv/rtvReminder',
    rutaEsperada: 'rtvReminder',
    tituloEsperado: /recordatorios para rtv/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /recordatorios para rtv/i),
  },
  {
    nombre: 'Relacionar servicios a estados de la órden',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/vehicularReception/relationServiceAndOrderState',
    rutaEsperada: 'relationServiceAndOrderState',
    tituloEsperado: /relacionar servicios a estados de la orden/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /relacionar servicios a estados de la orden/i),
  },
  {
    nombre: 'Reporte de órdenes',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/order_report',
    rutaEsperada: 'order_report',
    tituloEsperado: /reporte de [oó]rdenes/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_toggle_advanced_filters'),
  },
  {
    // El <title> del documento en esta página es idéntico al de "Reporte de
    // órdenes" ("Reporte de órdenes | Sistema Web ERP", confirmado en vivo)
    // — no identifica la página, así que se omite `tituloEsperado` y se
    // valida solo con el encabezado de contenido real, que sí es propio.
    nombre: 'Reporte de Inspección',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/order_report_inspection',
    rutaEsperada: 'order_report_inspection',
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de inspecci[oó]n/i),
  },
  {
    nombre: 'Listado de Vehículo',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/reports/vehicle_report',
    rutaEsperada: 'vehicle_report',
    tituloEsperado: /reporte de veh[ií]culos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /reporte de veh[ií]culos/i),
  },
];

export const SUBMODULOS_TALLER_CONFIGURACION: SubmoduloTaller[] = [
  {
    nombre: 'Servicios de Reparación',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/WorkshopServices/adminWorkshopServices',
    rutaEsperada: 'adminWorkshopServices',
    tituloEsperado: /administrar servicios reparaci[oó]n/i,
    obtenerLocatorDeCarga: (page) => page.locator('input[placeholder="Buscar..."]').first(),
  },
  {
    // El <title> del documento en esta página es idéntico al de "Servicios
    // de Reparación" ("Administrar Servicios Reparación", confirmado en
    // vivo) — no identifica la página, así que se omite `tituloEsperado` y
    // se valida solo con el encabezado de contenido real, que sí es propio.
    nombre: 'Servicios End. y Pintura',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/WorkshopServices/adminServicesEP',
    rutaEsperada: 'adminServicesEP',
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /enderezado y pintura/i),
  },
  {
    nombre: 'Servicios de Revisión',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/WorkshopServices/adminWorkshopServices?service_type_id=3',
    rutaEsperada: 'service_type_id=3',
    tituloEsperado: /servicios revision/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar servicios revisi[oó]n/i),
  },
  {
    nombre: 'Paquetes de inspección',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/WorkshopServices/inspectionPackagemanagement',
    rutaEsperada: 'inspectionPackagemanagement',
    tituloEsperado: /paquetes de inspecci[oó]n/i,
    obtenerLocatorDeCarga: (page) => page.locator('#ipmConfigBtn'),
  },
  {
    nombre: 'Admin. Tipo de Vehículo',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/adminVehicleType/vehicleType',
    rutaEsperada: 'adminVehicleType',
    tituloEsperado: /administrar tipo de veh[ií]culo/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar tipo de veh[ií]culo/i),
  },
  {
    nombre: 'Admin. Marcas y modelos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/brand/vehicle-brands',
    rutaEsperada: 'vehicle-brands',
    tituloEsperado: /gesti[oó]n de marcas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar marcas de veh[ií]culos/i),
  },
  {
    nombre: 'Admin. Estilos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/style/adminVehicleStyle',
    rutaEsperada: 'adminVehicleStyle',
    tituloEsperado: /administrar estilos/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar estilos/i),
  },
  {
    nombre: 'Admin. Combustibles',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/fuel/adminFuel',
    rutaEsperada: 'adminFuel',
    tituloEsperado: /combustible/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /tipos de combustibles/i),
  },
  {
    nombre: 'Admin. Transmisión',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/adminTrans/adminTransmission',
    rutaEsperada: 'adminTransmission',
    tituloEsperado: /tipo de transmisi[oó]n/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /tipos de transmisi[oó]n/i),
  },
  {
    nombre: 'Admin. Tipo de motor',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/adminVehicleEngine/AdminVehicleEngine',
    rutaEsperada: 'AdminVehicleEngine',
    tituloEsperado: /tipos de motor/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /tipos de motor/i),
  },
  {
    nombre: 'Admin. Partes del vehículo',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/ass/adminCarAssets',
    rutaEsperada: 'adminCarAssets',
    // El título/encabezado real tiene una errata propia de la app
    // ("Administracíón" en vez de "Administración", confirmada en vivo) —
    // el patrón evita depender de esa palabra y usa el resto del texto.
    tituloEsperado: /partes de veh[ií]culo/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /partes de veh[ií]culo/i),
  },
  {
    nombre: 'Admin. Aseguradoras',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/insurance/adminInsurancePolicy',
    rutaEsperada: 'adminInsurancePolicy',
    tituloEsperado: /administrar aseguradoras/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /administrar aseguradoras/i),
  },
  {
    nombre: 'Admin. Etiquetas fotos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/repairOrderCategory/adminRepairOrderCategory',
    rutaEsperada: 'adminRepairOrderCategory',
    tituloEsperado: /etiquetas/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /etiquetas fotos de recepci[oó]n de veh[ií]culos/i),
  },
  {
    nombre: 'Admin. Opciones pintura',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/serviceReparationState/adminServiceReparationState',
    rutaEsperada: 'adminServiceReparationState',
    tituloEsperado: /opciones/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /opciones para enderezado y pintura/i),
  },
  {
    nombre: 'Términos y Condiciones',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/tc/terms_and_conditions?type_conditions=2',
    rutaEsperada: 'terms_and_conditions',
    // El <title> de esta página tiene una errata propia de la app
    // ("Condciones", confirmada en vivo) — el patrón se detiene antes de esa
    // palabra para no depender de ella.
    tituloEsperado: /t[eé]rminos y cond/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /t[eé]rminos y condiciones/i),
  },
  {
    // El <title> del documento no cambia al entrar a este submódulo (queda
    // como "Dashboard", confirmado en vivo — probablemente una SPA que no
    // actualiza document.title) y no identifica la página, así que se omite
    // `tituloEsperado` y se valida solo con el contenido propio.
    nombre: 'Ajustes de flujo de trabajo',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/new-workflow-reception/adjust-workflow',
    rutaEsperada: 'adjust-workflow',
    obtenerLocatorDeCarga: (page) => page.locator('#aw-search-btn'),
  },
  {
    nombre: 'Config. Horarios',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/schedule/get_mechanic_schedule',
    rutaEsperada: 'get_mechanic_schedule',
    tituloEsperado: /configuraci[oó]n de horarios/i,
    obtenerLocatorDeCarga: (page) => contentHeaderConTexto(page, /configuraci[oó]n de horarios/i),
  },
];

// ─── Page Object ──────────────────────────────────────────────────────────────

export class TallerPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Gestión de Taller. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
