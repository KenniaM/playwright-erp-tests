import { expect, Locator, Page } from '@playwright/test';
import { espiarErroresJS, esperarQuedaActivo } from '../pos/pos.page';

// espiarErroresJS/esperarQuedaActivo se reexportan tal cual desde pos.page.ts
// (funciones independientes, no atadas a PosPage — no dependen de `this`,
// solo reciben un Page o un predicado) en vez de duplicarlas: son el único
// lugar del proyecto donde existen hoy.
export { espiarErroresJS, esperarQuedaActivo };

// ─── URL ──────────────────────────────────────────────────────────────────────

export const RECEPCION_VEHICULAR_URL =
  'https://dev.designsoftcr.com/qa_talleralpha/public/vehicularReception/vehicularQuickReception';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  // Cada tab/búsqueda popula su contenido vía AJAX — se hace polling hasta
  // este límite antes de leer su estado, nunca una pausa fija.
  CARGA:    15_000,
} as const;

// ─── Tabs principales ───────────────────────────────────────────────────────

export type TabRecepcion = {
  selector: string;           // id del <a> del tab — nunca el texto visible
  etiqueta: string;            // solo para logs y mensajes de error
  contenedorContenido: string; // contenedor que debe quedar visible cuando el tab termina de cargar
};

/**
 * Los 6 tabs principales del modo básico de Recepción Vehicular (confirmados
 * en vivo: ids técnicos estables en vehicular_quick_reception.js, no el
 * texto visible). El módulo también puede exponer un segundo grupo de tabs
 * ("workflow-stage-tab": Recepción, Diagnóstico, Presupuesto, etc.) cuando
 * el flujo avanzado está habilitado — coexisten en el DOM con estos 6 sin
 * afectarlos, así que la navegación aquí no depende de qué modo esté activo
 * ni intenta activarlo/desactivarlo.
 *
 * Cada `contenedorContenido` fue confirmado en vivo como mutuamente
 * excluyente entre sí (visible solo cuando su propio tab está activo, oculto
 * en los otros 5) — mismo criterio de verificación que
 * `PESTANAS_POS_A_RECORRER` en pos.page.ts.
 */
export const TAB_DASHBOARD: TabRecepcion = {
  selector: '#tab_color_action_dashboard',
  etiqueta: 'Dashboard',
  contenedorContenido: '#div_quick_reception_dashboard',
};

export const TAB_TABLERO: TabRecepcion = {
  selector: '#tab_color_action_board',
  etiqueta: 'Tablero',
  contenedorContenido: '#div_quick_reception_content',
};

export const TAB_ORDENES: TabRecepcion = {
  selector: '#tab_color_action_order',
  etiqueta: 'Órdenes',
  contenedorContenido: '#company_repair_order_list',
};

export const TAB_REPUESTOS: TabRecepcion = {
  selector: '#tab_spare_parts',
  etiqueta: 'Repuestos',
  contenedorContenido: '#div_content_spare_parts',
};

export const TAB_GRAFICOS: TabRecepcion = {
  selector: '#tab_color_action_graphics',
  etiqueta: 'Gráficos',
  contenedorContenido: '#div_quick_reception_content_graphics',
};

export const TAB_TABLA_INFORMATIVA: TabRecepcion = {
  selector: '#tab_color_action_services',
  etiqueta: 'Tabla informativa',
  contenedorContenido: '#table_service_id_select_chosen',
};

export const TABS_MODO_BASICO: TabRecepcion[] = [
  TAB_DASHBOARD,
  TAB_TABLERO,
  TAB_ORDENES,
  TAB_REPUESTOS,
  TAB_GRAFICOS,
  TAB_TABLA_INFORMATIVA,
];

// ─── Locators ─────────────────────────────────────────────────────────────────

const L = {
  BUSCADOR:          '#repair_order_search',
  // Dos clases distintas según la vista, confirmado en vivo:
  // `.reception-order-number-badge` solo en la vista Lista de Órdenes;
  // `.ervk-order-badge` tanto en Tablero como en la vista Caja de Órdenes
  // (comparten el mismo componente de tarjeta "ervk"). `:visible` es
  // necesario porque el contenedor de la vista Lista queda oculto (no
  // desmontado) al cambiar a Caja o a Tablero, y sus badges seguirían
  // coincidiendo por texto si no se filtran por visibilidad real.
  BADGE_ORDEN:        '.reception-order-number-badge:visible, .ervk-order-badge:visible',
  // Misma dualidad que BADGE_ORDEN, un nivel más arriba: la tarjeta completa
  // de la orden (incluye la placa del vehículo, no solo el número).
  TARJETA_ORDEN:       '.reception-order-card:visible, .ervk-kanban-card:visible',
  CONTENEDOR_ORDENES: '#company_repair_order_list',
  BTN_VISTA_LISTA:    '.view-repair-order-list',
  BTN_VISTA_CAJA:     '#btn_getRepairOrderViewBox',
  TOGGLE_TEMA:        '#theme-toggle-button',
  // Clase exacta que la app agrega al <a> del tab activo (confirmado en
  // vivo: token propio en la lista de clases, nunca concatenado a otro) y a
  // los botones de vista Lista/Caja cuando quedan seleccionados.
  CLASE_TAB_ACTIVO:    'tab_color_action',
} as const;

export type VistaOrdenes = 'lista' | 'caja';

// ─── Page Object ──────────────────────────────────────────────────────────────

export class RecepcionPage {
  constructor(private readonly page: Page) {}

  get buscador(): Locator {
    return this.page.locator(L.BUSCADOR);
  }

  get contenedorOrdenes(): Locator {
    return this.page.locator(L.CONTENEDOR_ORDENES);
  }

  /**
   * Único punto de entrada al módulo Recepción Vehicular. Espera además a
   * que la red quede en reposo (`networkidle`, con tolerancia si nunca lo
   * hace del todo) antes de devolver el control: confirmado en vivo que
   * interactuar con los tabs demasiado pronto tras `domcontentloaded` —
   * mientras algunos scripts de la propia página todavía están cargando —
   * puede disparar un error real de la aplicación al activar el tab
   * "Dashboard" (`$(...).steps is not a function`, intermitente, ~1 de cada
   * 5 intentos). Es una espera funcional real sobre el estado de red, no una
   * pausa fija.
   */
  async ir() {
    await this.page.goto(RECEPCION_VEHICULAR_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  // ─── Tabs ───────────────────────────────────────────────────────────────────

  /** Indica si el tab existe en el DOM en este momento — detecta tabs ocultos por permisos/configuración sin fallar. */
  async existeTab(tab: TabRecepcion): Promise<boolean> {
    return (await this.page.locator(tab.selector).count()) > 0;
  }

  /** Indica si el tab dado está activo ahora mismo (clase `tab_color_action` presente). */
  async tabEstaActivo(tab: TabRecepcion): Promise<boolean> {
    const clases = await this.page.locator(tab.selector).getAttribute('class');
    return (clases ?? '').split(/\s+/).includes(L.CLASE_TAB_ACTIVO);
  }

  /**
   * Visita un tab ya confirmado existente: click real (sin force), confirma
   * que quedó activo y que su contenedor de contenido propio quedó visible.
   * A diferencia de `visitarPestanaPos` (POS), estos 6 tabs no comparten un
   * único endpoint AJAX común entre sí (cada uno dispara sus propias
   * llamadas — confirmado en vivo: Dashboard, Repuestos, Gráficos y Tabla
   * informativa sí disparan peticiones propias, pero Órdenes normalmente no
   * dispara ninguna por tener su contenido ya precargado) — por eso la
   * espera funcional aquí es siempre sobre el contenedor de contenido, señal
   * válida para los 6 casos por igual.
   */
  async visitarTab(tab: TabRecepcion) {
    await this.page.locator(tab.selector).click();

    await esperarQuedaActivo(() => this.tabEstaActivo(tab));

    await expect(
      this.page.locator(tab.contenedorContenido),
      `Tras activar "${tab.etiqueta}", su contenedor de contenido (${tab.contenedorContenido}) no quedó visible`
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  // ─── Búsqueda de órdenes (compartida entre Tablero y Órdenes) ────────────────

  /**
   * Busca órdenes con el término dado. El input `#repair_order_search` solo
   * dispara la búsqueda con la tecla Enter (`keypress`, `e.which === 13` en
   * vehicular_quick_reception.js) — confirmado en vivo que `fill()` por sí
   * solo (evento `input`) no la activa.
   */
  async buscarOrden(termino: string) {
    await this.buscador.fill(termino);
    await this.buscador.press('Enter');
  }

  /** Limpia la búsqueda y restaura el listado sin filtrar. */
  async limpiarBusqueda() {
    await this.buscarOrden('');
  }

  /** Locator del badge circular con el número de una orden específica — mismo elemento en Tablero y en Órdenes. */
  badgeOrden(numero: string): Locator {
    return this.page.locator(L.BADGE_ORDEN, { hasText: new RegExp(`^${numero}$`) });
  }

  /** Números de orden actualmente visibles (en cualquiera de los dos tabs que comparten este badge). */
  async obtenerNumerosOrdenVisibles(): Promise<string[]> {
    return this.page.locator(L.BADGE_ORDEN).allTextContents();
  }

  /**
   * Toma la primera orden real visible en el tab activo (Tablero u Órdenes)
   * — nunca un número fijo: el set de datos varía según el ambiente.
   */
  async obtenerPrimeraOrdenVisible(): Promise<string> {
    const primerBadge = this.page.locator(L.BADGE_ORDEN).first();
    await expect(primerBadge, 'No hay ninguna orden visible para tomar como base de la prueba').toBeVisible({ timeout: TIMEOUTS.CARGA });
    return (await primerBadge.textContent())?.trim() ?? '';
  }

  /**
   * Igual que `obtenerPrimeraOrdenVisible()`, pero además lee la placa del
   * vehículo desde la tarjeta completa — necesaria para probar búsqueda
   * parcial: confirmado en vivo que el buscador de Tablero
   * (`getRepairOrderBoardList`) filtra por coincidencia parcial de placa,
   * pero NO por coincidencia parcial del número de orden (una búsqueda
   * parcial del número, p.ej. "30" de la orden "307", puede coincidir con
   * otra orden real distinta —la "30"— y ocultar la original en vez de
   * incluirla), a diferencia del buscador de Órdenes
   * (`getOrderSearch`), que sí hace ambos.
   */
  async obtenerPrimeraOrdenYPlaca(): Promise<{ numero: string; placa: string }> {
    const primeraTarjeta = this.page.locator(L.TARJETA_ORDEN).first();
    await expect(primeraTarjeta, 'No hay ninguna orden visible para tomar como base de la prueba').toBeVisible({ timeout: TIMEOUTS.CARGA });

    const texto = (await primeraTarjeta.innerText()).replace(/\s+/g, ' ');
    const numero = texto.match(/^(\d+)/)?.[1] ?? '';
    const placa = texto.match(/Placa:\s*([A-Za-z0-9-]+)/)?.[1] ?? '';
    return { numero, placa };
  }

  // ─── Vista del tab Órdenes: Lista / Caja ─────────────────────────────────────

  /** Vista actualmente activa en el tab Órdenes, leída del contenedor real (no asumida). */
  async vistaOrdenesActiva(): Promise<VistaOrdenes> {
    const clases = (await this.contenedorOrdenes.getAttribute('class')) ?? '';
    if (clases.includes('repair-order-grid-active')) return 'caja';
    return 'lista';
  }

  /** Cambia la vista del tab Órdenes (Lista/Caja) y espera a que el contenedor confirme el cambio real. */
  async cambiarVistaOrdenes(vista: VistaOrdenes) {
    const boton = vista === 'caja' ? this.page.locator(L.BTN_VISTA_CAJA) : this.page.locator(L.BTN_VISTA_LISTA);
    await boton.click();

    await esperarQuedaActivo(async () => (await this.vistaOrdenesActiva()) === vista);
  }

  // ─── Modo oscuro ──────────────────────────────────────────────────────────────

  /** Indica si el modo oscuro está activo ahora mismo (clase `dark-mode` en `<body>`). */
  async modoOscuroActivo(): Promise<boolean> {
    const clases = await this.page.locator('body').getAttribute('class');
    return (clases ?? '').split(/\s+/).includes('dark-mode');
  }

  /**
   * Alterna el modo oscuro/claro. El toggle no dispara ninguna petición de
   * red (confirmado en vivo): actualiza `<body>` y `localStorage` de forma
   * síncrona — la espera funcional es directamente sobre la clase real de
   * `<body>`, sin necesidad de `waitForResponse` ni pausa alguna.
   */
  async alternarModoOscuro() {
    const activoAntes = await this.modoOscuroActivo();
    await this.page.locator(L.TOGGLE_TEMA).click();

    await esperarQuedaActivo(async () => (await this.modoOscuroActivo()) === !activoAntes);
  }
}
