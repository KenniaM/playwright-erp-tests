import { expect, Locator, Page } from '@playwright/test';
import { PosPage } from './pos/pos.page';
import { FacturarPage } from './facturar.page';
import { COMPANIA_POS } from './pos/pos.types';

// Page Object de "Despacho de Órdenes de Caja" (`cashOrderDispath/dispath`,
// link directo del sidebar "FACTURAR" — NO la pestaña interna "Órdenes de
// caja" del POS, que ya cubre pos-orden-caja.page.ts/spec.ts). Investigado en
// vivo con la cuenta Super Administrador + compañía HONDURAS (única
// combinación bajo la que este spec corre — ver el comentario de cabecera de
// facturar-despacho-ordenes-caja.spec.ts).
//
// Patrón de flujo de negocio (composición, no tabla de submódulos — CLAUDE.md
// patrón 2): se compone contra FacturarPage (navegación + selección de
// compañía, ya reutilizadas tal cual) + PosPage (para crear una Orden de Caja
// de respaldo vía "Enviar a caja" cuando el ambiente no tenga ninguna
// pendiente) + Page, mismo criterio ya usado por PosCrearCliente.
export const TIMEOUTS = {
  // 300s, no 120s: igual que TIMEOUTS.TEST de pos.types.ts — confirmado en
  // vivo que cualquier escenario que llame a crearOrdenDeCajaDeRespaldo()
  // pasa por el mismo camino real y costoso de entrada al POS
  // (cargarPosDesdeDashboard() → resolución de compañía, hasta 90s solo esa
  // navegación) antes de siquiera llegar al ciclo de despacho — 120s no
  // alcanzaba (test timeout real observado a mitad de la creación de la
  // orden de respaldo).
  TEST:     300_000,
  NAVIGATE:  90_000,
  MODAL:     15_000,
  AJAX:      20_000,
} as const;

// Estados reales confirmados en vivo del `<select id="select_order_status">`
// (Chosen `#select_order_status_chosen`): value → texto visible exacto.
export type EstadoOrdenDespacho = 'Todas' | 'Pendiente' | 'En proceso' | 'Aprobado' | 'Eliminado';

export type DatosOrdenDespacho = {
  id: string;
  numero: string;
  cliente: string;
  estado: string;
};

export class FacturarDespachoOrdenesCajaPage {
  constructor(
    private readonly facturar: FacturarPage,
    private readonly pos: PosPage,
    private readonly page: Page,
  ) {}

  // ─── Navegación ─────────────────────────────────────────────────────────

  /**
   * Abre "Despacho de Órdenes de Caja" y deja la pantalla lista para
   * trabajar: cierra los overlays conocidos del POS (notificaciones, aviso
   * de consecutivo, toasts — `PosCore.cerrarOverlaysConocidos()`, mismo
   * mecanismo que ya usa el resto de la suite) y selecciona la compañía
   * HONDURAS en el filtro propio de esta pantalla (`FacturarPage.
   * seleccionarCompaniaEnDespacho()`) — confirmado en vivo que esta pantalla
   * es cross-company para la cuenta Super Administrador y no hereda la
   * compañía resuelta al hacer login.
   */
  async abrir() {
    await this.facturar.abrirDespachoDeOrdenesCaja();
    await this.pos.cerrarOverlaysConocidos();
    await this.facturar.seleccionarCompaniaEnDespacho(COMPANIA_POS);
  }


  // ─── Locators ───────────────────────────────────────────────────────────

  get campoBuscar(): Locator { return this.page.locator('#order_search'); }
  get botonBuscar(): Locator { return this.page.locator('#btn_search_order'); }
  get campoFechaDesde(): Locator { return this.page.locator('#start_date'); }
  get campoFechaHasta(): Locator { return this.page.locator('#end_date'); }

  /** Tarjetas de la lista — confirmado en vivo: cada una lleva `onclick="get_cash_order_detail(<id>)"`. */
  get tarjetas(): Locator { return this.page.locator('[onclick*="get_cash_order_detail"]'); }

  /** Panel de detalle vacío ("Seleccionar Orden...") — estado inicial antes de elegir una tarjeta. */
  get panelSeleccionarOrden(): Locator { return this.page.getByText('Seleccionar Orden...'); }

  /** Encabezado real del panel de detalle una vez cargado ("Orden No. <num>"). */
  get panelDetalle(): Locator { return this.page.locator('text=/^Orden No\\. \\d+/'); }

  get botonTomarOrden(): Locator { return this.page.locator('a.btn.btn-primary', { hasText: 'Tomar Orden' }); }
  get botonFinalizar(): Locator { return this.page.locator('a.btn, button', { hasText: 'Finalizar' }); }

  /** Botón "⋮" (tres puntos) del panel de detalle — id real confirmado en vivo. */
  get botonMenuDetalle(): Locator { return this.page.locator('button#dLabel'); }
  get menuDetalleAbierto(): Locator { return this.page.locator('.dropdown-menu').filter({ hasText: 'Imprimir orden' }); }


  // ─── Filtros ────────────────────────────────────────────────────────────

  /** Filtra por "Estado orden" (Todas/Pendiente/En proceso/Aprobado/Eliminado) — reutiliza el Chosen-por-texto genérico de FacturarPage. */
  async filtrarPorEstado(estado: EstadoOrdenDespacho) {
    await this.facturar._seleccionarOpcionChosenPorTexto('#select_order_status_chosen', estado);
  }

  /**
   * Busca por texto libre — el mismo campo (`#order_search`) indexa tanto el
   * número de orden como el nombre del cliente (confirmado en vivo: ambos
   * aparecen en la misma tarjeta y no hay un campo separado por tipo de
   * búsqueda), así que un único método sirve para "buscar por texto/número/
   * cliente" del escenario mínimo pedido.
   */
  async buscarPorTexto(texto: string) {
    await this.campoBuscar.fill(texto);
    await this._clickConReintentosCerrandoOverlays(this.botonBuscar, 'botón "Buscar"');
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.AJAX }).catch(() => {});
  }

  /**
   * Limpia el buscador de texto y vuelve a consultar — no se confirmó en
   * vivo ningún botón dedicado "Limpiar filtros" en esta pantalla (a
   * diferencia de otros módulos del repo que sí lo tienen); vaciar el campo
   * y volver a buscar es el mecanismo real equivalente confirmado en vivo.
   */
  async limpiarBusqueda() {
    await this.buscarPorTexto('');
  }

  /**
   * `#start_date`/`#end_date` son `<input type="date">` reales — confirmado
   * en vivo que `.fill()` exige el formato ISO `YYYY-MM-DD` (un valor
   * `MM/DD/YYYY` como el que muestra la UI produce "Malformed value" y
   * lanza), aunque el propio campo se muestre en pantalla como `07/30/2026`.
   * Confirmado en vivo (también) que cambiar estos campos NO dispara la
   * consulta por sí solo (a diferencia del filtro de Compañía/Estado, que sí
   * son reactivos) — hace falta el mismo botón "Buscar" que el texto libre.
   *
   * HALLAZGO DE SISTEMA/AMBIENTE confirmado en vivo (2 corridas
   * independientes, interceptando la red): tras `fill()` ambos campos SÍ
   * quedan con el valor nuevo en el DOM (confirmado leyendo `.value`
   * inmediatamente después), pero el payload real que finalmente viaja en
   * `getCashOrderDispathSearch` al presionar "Buscar" trae de vuelta las
   * fechas ORIGINALES por defecto (`start_date=2026-07-15&end_date=2026-07-30`,
   * no las recién asignadas) — algo en esta pantalla revierte ambos campos a
   * su valor inicial en la ventana entre `fill()` y que el click en
   * "Buscar" efectivamente dispara la consulta. No es un problema del
   * selector ni del formato (ambos ya descartados con evidencia): es un
   * comportamiento real de la propia pantalla, no reproducible de forma
   * aislada con más precisión dentro del tiempo de esta investigación. Por
   * eso este método NO garantiza que el rango solicitado sea el que
   * realmente se aplique — los escenarios que lo usan validan el
   * comportamiento resiliente del filtro (acepta un rango válido y dispara
   * una búsqueda sin error), no un conteo exacto de resultados esperado.
   */
  async establecerRangoFechas(desdeISO: string, hastaISO: string) {
    await this.campoFechaDesde.fill(desdeISO);
    await this.campoFechaHasta.fill(hastaISO);
    await this._clickConReintentosCerrandoOverlays(this.botonBuscar, 'botón "Buscar" (tras cambiar el rango de fechas)');
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.AJAX }).catch(() => {});
  }


  /**
   * Click con reintentos acotados cerrando los overlays conocidos del POS
   * antes de cada intento — mismo patrón ya documentado en CLAUDE.md/
   * CLAUDE_CONTEXT.md (`PosCore.abrirProductoRapido()`/`_cerrarOverlayDashboardSiAparece()`):
   * el banner de permisos de notificaciones del navegador
   * (`#workshop-web-notification-permission`) y la campana de notificaciones
   * del header pueden reaparecer de forma asíncrona e interceptar el click,
   * incluso cuando el elemento ya pasó los chequeos de actionability de
   * Playwright — confirmado en vivo en esta pantalla (el botón "Buscar" y el
   * menú de tres puntos del detalle quedaban reintentando indefinidamente
   * contra ese banner hasta agotar el timeout completo del test).
   */
  private async _clickConReintentosCerrandoOverlays(locator: Locator, descripcion: string) {
    const MAX_INTENTOS = 5;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      await this.pos.cerrarOverlaysConocidos().catch(() => {});
      const clickeado = await locator.click({ timeout: 3_000 }).then(() => true).catch(() => false);
      if (clickeado) return;
    }
    throw new Error(`No se pudo clickear ${descripcion} tras ${MAX_INTENTOS} intentos cerrando overlays conocidos`);
  }


  // ─── Listado ────────────────────────────────────────────────────────────

  async contarOrdenesVisibles(): Promise<number> {
    return this.tarjetas.count();
  }

  /**
   * Recarga la pantalla completa (F5 real) — "Actualizar listado" pedido por
   * el escenario mínimo. Confirmado en vivo que el reload no conserva el
   * filtro de Compañía ya elegido (vuelve a su compañía por defecto), así
   * que se reselecciona HONDURAS tras recargar para dejar la pantalla en el
   * mismo estado de trabajo, no uno stale.
   */
  async actualizarListado() {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.pos.cerrarOverlaysConocidos();
    await this.facturar.seleccionarCompaniaEnDespacho(COMPANIA_POS);
  }


  // ─── Detalle ────────────────────────────────────────────────────────────

  /** Abre el detalle de la primera orden visible y espera que el panel derecho termine de cargar. */
  async abrirDetallePrimeraOrden(): Promise<DatosOrdenDespacho> {
    const tarjeta = this.tarjetas.first();
    await expect(tarjeta, 'No hay ninguna Orden de Caja disponible en Despacho de Órdenes de Caja').toBeVisible({ timeout: TIMEOUTS.AJAX });

    const onclick = await tarjeta.getAttribute('onclick') ?? '';
    const id = (onclick.match(/get_cash_order_detail\((\d+)\)/) ?? [, ''])[1];
    const numero = (await tarjeta.locator('strong').first().innerText().catch(() => '')).replace(/[^\d]/g, '');
    const cliente = (await tarjeta.innerText()).split('\n').map(l => l.trim()).filter(Boolean)[1] ?? '';

    await tarjeta.click();
    await expect(this.panelDetalle, 'El panel de detalle no mostró "Orden No. <num>" tras seleccionar la tarjeta').toBeVisible({ timeout: TIMEOUTS.AJAX });

    const estado = await this._leerEstadoTarjetaSeleccionada();
    return { id, numero, cliente, estado };
  }

  /**
   * Lee el badge de estado de la tarjeta actualmente seleccionada en la
   * lista. Confirmado en vivo (creando y despachando una Orden de Caja real)
   * que este badge NO se actualiza en vivo tras "Tomar Orden"/"Finalizar":
   * sigue mostrando el estado ANTERIOR a la acción hasta que la lista se
   * vuelve a consultar contra el servidor (recargar/buscar de nuevo) — la
   * acción sí persiste correctamente (confirmado recargando y volviendo a
   * buscar la orden), es únicamente el texto de esta tarjeta en memoria el
   * que queda obsoleto. Por eso NO es la fuente de verdad para validar un
   * cambio de estado recién aplicado (usar `actualizarListado()` +
   * `buscarPorTexto()` para eso, como hace el spec) — solo sirve para leer
   * el estado real de una tarjeta que ya viene de una consulta fresca.
   */
  async _leerEstadoTarjetaSeleccionada(): Promise<string> {
    const badge = this.page.locator('.selected_receip [class*="order_estatus"]').first();
    return (await badge.textContent().catch(() => ''))?.trim() ?? '';
  }


  // ─── Ciclo de despacho: Tomar Orden → Finalizar ────────────────────────────
  //
  // Confirmado en vivo (creando una Orden de Caja real e interceptando la
  // red completa mientras se llevaba de Pendiente a Aprobado): "Despachar"
  // en esta pantalla es un flujo de DOS pasos, cada uno con su propio
  // SweetAlert de confirmación (`PosCore._confirmarSweetAlertV1()`, mismo
  // mecanismo ya usado en el resto de la suite):
  //   1. "Tomar Orden" (confirm_update_order_status(id, 2)): POST real
  //      `cashOrderDispath/updateCashOrderDispathStatus` (status_id=2),
  //      Pendiente → En proceso.
  //   2. "Finalizar" (confirm_update_order_status(id, 3)): mismo endpoint
  //      con status_id=3, En proceso → Aprobado.
  // Cada paso dispara, tras el POST de actualización, un SEGUNDO POST real
  // (`getCashOrderDispathDetail`) que re-renderiza el panel de detalle
  // completo (reemplaza su HTML, incluido el botón primario) — confirmado
  // en vivo como la causa raíz de una falla intermitente real: sin esperar
  // ESTA respuesta antes de interactuar con el botón siguiente, el click
  // sobre "Finalizar" podía landear sobre el nodo viejo justo cuando el
  // panel se estaba reemplazando, perdiéndose sin lanzar ningún error
  // (Playwright no detecta el reemplazo de un ancestro mientras no cambie el
  // propio elemento clickeado) y dejando la orden atascada en "En proceso"
  // en vez de "Aprobado" — reproducido 2 veces seguidas antes de esta
  // corrección. `esperarPanelDetalleActualizado()` espera la respuesta real
  // de `getCashOrderDispathDetail` en vez de `networkidle` (que en esta app
  // puede resolver antes de que ese POST siquiera se dispare, por el resto
  // de tráfico de fondo del Dashboard — notificaciones, calendario, etc.).

  private async _esperarPanelDetalleActualizado(accion: () => Promise<void>) {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('getCashOrderDispathDetail') && res.request().method() === 'POST',
      { timeout: TIMEOUTS.AJAX }
    );
    await accion();
    await respuestaPromise;
  }

  async tomarOrden() {
    await expect(this.botonTomarOrden, 'El botón "Tomar Orden" no está disponible — la orden ya no está Pendiente').toBeVisible({ timeout: TIMEOUTS.MODAL });
    await this._esperarPanelDetalleActualizado(async () => {
      await this.botonTomarOrden.click();
      await this.pos._confirmarSweetAlertV1('No apareció la confirmación "¿Está seguro de TOMAR esta orden?"');
    });
  }

  async finalizarOrden() {
    await expect(this.botonFinalizar, 'El botón "Finalizar" no está disponible — la orden no está En proceso').toBeVisible({ timeout: TIMEOUTS.MODAL });
    await this._esperarPanelDetalleActualizado(async () => {
      await this.botonFinalizar.click();
      await this.pos._confirmarSweetAlertV1('No apareció la confirmación "¿Está seguro de FINALIZAR esta orden?"');
    });
  }

  /** Recorre el ciclo completo (Tomar Orden → Finalizar) sobre la orden actualmente en detalle — equivalente real de "Despachar" pedido por el escenario mínimo. */
  async despacharOrdenEnDetalle() {
    await this.tomarOrden();
    await expect(this.botonFinalizar, 'El botón "Finalizar" no apareció tras "Tomar Orden"').toBeVisible({ timeout: TIMEOUTS.AJAX });
    await this.finalizarOrden();
  }


  // ─── Menú de tres puntos ────────────────────────────────────────────────

  /**
   * Confirmado en vivo (aislado) que un único click sobre `button#dLabel` sí
   * abre el menú correctamente (`.dropdown_custom` gana la clase `open`,
   * el `<ul>` pasa a `display:block`) — pero, dentro del flujo completo del
   * spec (varios pasos antes), el mismo click podía no dejar el menú
   * visible de forma intermitente. Mismo patrón ya documentado en
   * `PosOrdenCaja.abrirMenuOrdenCaja()` para el menú de acciones del
   * carrito (otro dropdown Bootstrap con el mismo síntoma real: overlays
   * asíncronos del Dashboard reapareciendo justo antes/durante el click) —
   * se reintenta el CICLO completo (cerrar overlays → click → comprobar que
   * el menú realmente quedó visible), no solo el click en sí.
   */
  async abrirMenuDetalle() {
    const MAX_INTENTOS = 4;
    let abierto = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierto; intento++) {
      await this.pos.cerrarOverlaysConocidos().catch(() => {});
      await this.botonMenuDetalle.click({ timeout: 3_000 }).catch(() => {});
      abierto = await this.menuDetalleAbierto.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    }
    expect(abierto, `El menú de tres puntos del detalle no se abrió tras ${MAX_INTENTOS} intentos`).toBe(true);
  }

  /** Href real de "Imprimir orden" del menú de tres puntos — confirmado en vivo: `cashOrderDispath/printCashOrderDispath?...`. */
  async obtenerHrefImprimirOrden(): Promise<string> {
    await this.abrirMenuDetalle();
    const href = await this.menuDetalleAbierto.getByText('Imprimir orden').getAttribute('href');
    return href ?? '';
  }

  /** Href real de "Descargar PDF de orden" del menú de tres puntos — confirmado en vivo: `cashOrderDispath/downloadCashOrderDispathPdf?...`. */
  async obtenerHrefDescargarPdf(): Promise<string> {
    await this.abrirMenuDetalle();
    const href = await this.menuDetalleAbierto.getByText('Descargar PDF de orden').getAttribute('href');
    return href ?? '';
  }


  // ─── Creación de datos de respaldo vía POS ─────────────────────────────────

  /**
   * Crea una Orden de Caja real desde el POS (flujo "Enviar a caja" ya
   * probado por pos-orden-caja.spec.ts: `PosOrdenCaja.abrirMenuOrdenCaja()` →
   * `seleccionarClienteExistente()` → `seleccionarTipoPagoOrdenCaja('contado')`
   * → `llenarObservacionesOrdenCaja()` → `enviarOrdenCaja()` →
   * `validarOrdenCajaCreada()`) para que este módulo tenga al menos un
   * registro real que listar — instrucción explícita del usuario ("si no
   * existen órdenes, crearlas desde el POS"). No duplica ninguna lógica de
   * negocio: compone únicamente métodos públicos ya existentes de `PosPage`.
   */
  async crearOrdenDeCajaDeRespaldo(observacion: string) {
    await this.pos.cargarPosDesdeDashboard();
    await this.pos.cerrarOverlaysConocidos();
    await this.pos.agregarPrimerProductoDePrecioFijo();
    await this.pos.seleccionarClienteExistente();
    await this.pos.abrirMenuOrdenCaja();
    await this.pos.seleccionarTipoPagoOrdenCaja('contado');
    await this.pos.llenarObservacionesOrdenCaja(observacion);
    const respuesta = await this.pos.enviarOrdenCaja();
    await this.pos.validarOrdenCajaCreada(respuesta);
  }
}
