import { Locator, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  CARGA:    15_000,
} as const;

// ─── Submódulos ───────────────────────────────────────────────────────────────

/**
 * Submódulos del menú "Recursos Humanos" (URLs, títulos y encabezados
 * confirmados en vivo contra el ambiente POSMOVI — BASE_URL=qa_posmovi,
 * --project=firefox-posmovi — cuenta Super Admin, compañía "POSMOVI TIENDA").
 *
 * El Sidebar real de este ambiente tiene, además de "Recursos Humanos", dos
 * entradas relacionadas que NO se incluyen aquí (mismo patrón ya documentado
 * para Contabilidad/Tienda en Línea en `auditoria_navegacion_sidebar`):
 *   - "RRHH": duplicado de este mismo menú, confirmado en vivo con
 *     `getComputedStyle(li).display === 'none'` (`offsetParent === null`) —
 *     no está realmente visible/accesible, es un remanente oculto del DOM.
 *   - "RH" (standalone, 3 links: Administrador/Solicitud/Aprobar
 *     vacaciones): también confirmado `display: none` — oculto igual que
 *     "RRHH", no accesible en este ambiente pese a estar en el DOM.
 * "Planillas" (sidebar, sí visible) es un módulo HERMANO distinto — nombre
 * propio en el menú, URLs bajo `/human_resources/*`, no anidado dentro de
 * "Recursos Humanos" — fuera de alcance de esta suite (ver reporte).
 */
export type SubmoduloRecursosHumanos = {
  nombre: string;
  url: string;
  // Substring que debe contener la URL final tras navegar, para detectar
  // redirecciones inesperadas (p.ej. a login por sesión expirada).
  rutaEsperada: string;
  tituloEsperado: RegExp;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

export const SUBMODULOS_RECURSOS_HUMANOS: SubmoduloRecursosHumanos[] = [
  {
    nombre: 'Dashboard',
    url: BASE_URL + '/hremp/hr_get_main_dashboard',
    rutaEsperada: 'hr_get_main_dashboard',
    tituloEsperado: /dashboard/i,
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /dashboard de recursos humanos/i }),
  },
  {
    nombre: 'Empleados',
    url: BASE_URL + '/hremp/hremployee',
    rutaEsperada: 'hremployee',
    tituloEsperado: /empleados/i,
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /^empleados$/i }),
  },
  {
    // El sidebar expone 10 entradas separadas que apuntan todas a esta misma
    // URL base con distinto `?module_load=N` (Marcadas=9, Vacaciones=3,
    // Incapacidades=16, Licencias Especiales=15, Administración de
    // Planilla=1, Procesar Planilla=2, Amonestaciones=6, Préstamos=13,
    // Liquidaciones=5, Planilla de Viáticos=14). Confirmado en vivo
    // navegando directo a cada una: el parámetro `module_load` NO cambia el
    // contenido servido en una carga fresca — las 10 URLs renderizan
    // exactamente el mismo tab por defecto ("Calendario de Actividades de
    // Empleados"), con título de página idéntico. El cambio real de tab
    // depende de un click en vivo dentro de la SPA (no es deep-linkable),
    // así que probar las 10 por separado con `page.goto()` sólo repetiría
    // la misma aserción 10 veces sin validar nada distinto — se colapsan en
    // un único submódulo de navegación real.
    nombre: 'Administrador de Planillas',
    url: BASE_URL + '/hr_pay_man/hr_payroll_manager?module_load=1',
    rutaEsperada: 'hr_payroll_manager',
    tituloEsperado: /administrador de planillas/i,
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /administrador de planillas/i }),
  },
  {
    nombre: 'Panel de Control de Solicitudes',
    url: BASE_URL + '/hr_pay_man/hr_payroll_approval_panel',
    rutaEsperada: 'hr_payroll_approval_panel',
    tituloEsperado: /panel de control de solicitudes/i,
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /panel de control de solicitudes/i }),
  },
  {
    nombre: 'Reporte de Préstamos',
    url: BASE_URL + '/hr_pay_man/hr_loan_report',
    rutaEsperada: 'hr_loan_report',
    tituloEsperado: /reporte de pr[eé]stamos/i,
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /reporte de pr[eé]stamos/i }),
  },
  {
    nombre: 'Reporte de Planillas',
    url: BASE_URL + '/hr_pay_man/hr_payroll_report',
    rutaEsperada: 'hr_payroll_report',
    tituloEsperado: /reporte de planillas/i,
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /reporte de planillas/i }),
  },
  {
    nombre: 'Cierre de Horas',
    url: BASE_URL + '/hr_pay_man/hr_labor_closure_report',
    rutaEsperada: 'hr_labor_closure_report',
    tituloEsperado: /cierre de horas/i,
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /cierre de horas/i }),
  },
  {
    nombre: 'Reporte de Ausencias',
    url: BASE_URL + '/hr_pay_man/hr_absence_report',
    rutaEsperada: 'hr_absence_report',
    tituloEsperado: /reporte de ausencias/i,
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /reporte de ausencias/i }),
  },
  {
    nombre: 'Reporte de Vacaciones',
    url: BASE_URL + '/hr_pay_man/hr_vacation_report',
    rutaEsperada: 'hr_vacation_report',
    tituloEsperado: /reporte de vacaciones/i,
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /reporte de vacaciones/i }),
  },
  {
    nombre: 'Reporte de Empleados',
    url: BASE_URL + '/hr_pay_man/hr_employee_report',
    rutaEsperada: 'hr_employee_report',
    tituloEsperado: /reporte de empleados/i,
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /reporte de empleados/i }),
  },
  {
    nombre: 'Cat. Nómina',
    url: BASE_URL + '/hrpaycat/hrpayrollcatalogue',
    rutaEsperada: 'hrpayrollcatalogue',
    tituloEsperado: /cat[aá]logos de n[oó]mina/i,
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /cat[aá]logos de n[oó]mina/i }),
  },
  {
    // Sin `<h1>` en esta pantalla (confirmado en vivo, el título real es un
    // `<h2>`) — mismo hallazgo ya documentado en otros módulos (contabilidad,
    // bancos) donde no todas las pantallas usan el mismo nivel de encabezado.
    nombre: 'Cat. Viáticos',
    url: BASE_URL + '/hrpaycat/hrviacticscatalogue',
    rutaEsperada: 'hrviacticscatalogue',
    tituloEsperado: /catalogos? de vi[aá]ticos/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /cat[aá]logos de vi[aá]ticos/i }),
  },
  {
    nombre: 'Cat. Marcadas',
    url: BASE_URL + '/hrpaycat/hrmarkedcatalogue',
    rutaEsperada: 'hrmarkedcatalogue',
    tituloEsperado: /cat[aá]logo de marcada/i,
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /cat[aá]logo de marcada/i }),
  },
  {
    // Sin `<h1>` (confirmado en vivo, el título real es un `<h2>`).
    nombre: 'Dashboard RH',
    url: BASE_URL + '/hr_dashboard_setting/index',
    rutaEsperada: 'hr_dashboard_setting',
    tituloEsperado: /configuraci[oó]n dashboard rh/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /configuraci[oó]n dashboard rh/i }),
  },
  {
    // Sin ningún `<h1>`/`<h2>`/`<h3>` visible en esta pantalla (confirmado en
    // vivo) — se valida con el buscador real (mismo patrón que
    // `bancos.page.ts`/`contabilidad.page.ts` para pantallas sin encabezado).
    nombre: 'Ajustes Generales',
    url: BASE_URL + '/hr_gen_conf/hr_general_config',
    rutaEsperada: 'hr_general_config',
    tituloEsperado: /configuraci[oó]n general/i,
    obtenerLocatorDeCarga: (page) => page.locator('#v_search'),
  },
  {
    nombre: 'Asistente de Configuración',
    url: BASE_URL + '/hr_wiz_conf/hr_wizard_config',
    rutaEsperada: 'hr_wizard_config',
    tituloEsperado: /configuraci[oó]n inicial/i,
    obtenerLocatorDeCarga: (page) => page.locator('h1', { hasText: /configuraci[oó]n inicial/i }),
  },
  {
    // Sin `<h1>` (confirmado en vivo, el título real es un `<h2>`).
    nombre: 'Adelanto de Salario',
    url: BASE_URL + '/hrsaladv/hr_salary_advance',
    rutaEsperada: 'hr_salary_advance',
    tituloEsperado: /adelantos? de salario/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /adelanto de salario/i }),
  },
  {
    // Sin `<h1>` (confirmado en vivo, el título real es un `<h2>`). Esta
    // pantalla dispara en vivo un error JS real ("can't access property
    // 'defaults', DataTable is undefined") — confirmado con `espiarErroresJS`
    // en la corrida real (ver reporte); no impide que el encabezado y el
    // resto del contenido carguen, se documenta como hallazgo de sistema.
    nombre: 'Permiso de Ausencia',
    url: BASE_URL + '/hr_per_req/hr_permit_request',
    rutaEsperada: 'hr_permit_request',
    tituloEsperado: /permiso de ausencia/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /permiso de ausencia/i }),
  },
  {
    // Sin `<h1>` (confirmado en vivo, el título real es un `<h2>`).
    nombre: 'Vacaciones (solicitudes)',
    url: BASE_URL + '/hrvac/hrvacation',
    rutaEsperada: 'hrvacation',
    tituloEsperado: /solicitud de vacaciones/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /^vacaciones$/i }),
  },
  {
    // Sin `<h1>` (confirmado en vivo, el título real es un `<h2>`).
    nombre: 'Horas Extras',
    url: BASE_URL + '/hrehhr/hr_extra_hour_hr_request',
    rutaEsperada: 'hr_extra_hour_hr_request',
    tituloEsperado: /horas extras/i,
    obtenerLocatorDeCarga: (page) => page.locator('h2', { hasText: /horas extras/i }),
  },
];

// ─── Page Object ──────────────────────────────────────────────────────────────

export class RecursosHumanosPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Recursos Humanos. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
