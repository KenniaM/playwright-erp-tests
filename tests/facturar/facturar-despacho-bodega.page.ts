import { expect, Locator, Page } from '@playwright/test';
import { PosPage } from './pos/pos.page';
import { FacturarPage } from './facturar.page';
import { COMPANIA_POS } from './pos/pos.types';

// Page Object de "Despacho de Bodega" (`PosDispatchOrder/dispatchOrder`, link
// del sidebar "FACTURAR" — "Despacho de bodega", marcado "Nuevo" en el
// sidebar). Investigado en vivo con la cuenta Super Administrador + compañía
// HONDURAS (única combinación bajo la que este spec corre — ver el
// comentario de cabecera de facturar-despacho-bodega.spec.ts), mismo
// criterio que facturar-despacho-ordenes-caja.page.ts.
//
// HALLAZGO CLAVE confirmado en vivo (con evidencia de red, no supuesto):
// pese a llamarse "Despacho de BODEGA" (sugiriendo que lista facturas), esta
// pantalla es en realidad la MISMA familia de componente que "Despacho de
// Órdenes de Caja" — comparte el panel titulado literalmente "Órdenes de
// caja", las mismas tarjetas `receip_item` con el mismo
// `onclick="get_cash_order_detail(<id>)"`, y una Orden de Caja creada vía
// "Enviar a Caja" en el POS (`PosOrdenCaja`) aparece aquí y es completamente
// despachable — confirmado en vivo creando y llevando una orden real de
// Pendiente → Entregado en esta misma pantalla. Por eso
// `crearOrdenDeCajaDeRespaldoParaBodega()` reutiliza EXACTAMENTE el mismo
// flujo de "Enviar a Caja" ya usado por
// `FacturarDespachoOrdenesCajaPage.crearOrdenDeCajaDeRespaldo()`, en vez de
// forzar el flujo de pago directo (que además demostró ser
// significativamente más lento/frágil en este ambiente compartido durante
// la investigación en vivo — timeouts repetidos de 5 minutos esperando el
// grid de productos, documentados en el informe de la sesión — mientras que
// "Enviar a Caja" ya es el mecanismo probado y estable del resto de la
// suite).
//
// A diferencia de Despacho de Órdenes de Caja, esta pantalla SÍ tiene una
// capa adicional real: cada Orden de Caja se despacha por LÍNEA DE PRODUCTO
// (escaneo de código de barras), no solo a nivel de orden completa — ver
// `escanearTodosLosProductosPendientes()` más abajo.
export const TIMEOUTS = {
  // Mismo criterio que TIMEOUTS.TEST de facturar-despacho-ordenes-caja.page.ts:
  // cualquier escenario que use crearOrdenDeCajaDeRespaldoParaBodega() pasa
  // por el mismo camino costoso de entrada al POS (hasta 90s solo la
  // navegación) antes de llegar al ciclo de despacho.
  TEST:     300_000,
  NAVIGATE:  90_000,
  MODAL:     15_000,
  AJAX:      20_000,
  // Timeout dedicado (levemente mayor que AJAX) para el render del panel de
  // detalle tras seleccionar una tarjeta — la causa real de los timeouts
  // vistos durante la investigación no era este valor sino el locator
  // `panelDetalle` en sí (ver su comentario más abajo); este margen extra
  // sobre AJAX.20_000 solo cubre la latencia normal del ambiente compartido.
  DETALLE:   30_000,
} as const;

// Estados reales confirmados en vivo del `<select id="select_order_status">`
// de esta pantalla — DISTINTOS a los de Despacho de Órdenes de Caja (no hay
// "Aprobado"/"Eliminado" aquí, hay "Entregadas" en su lugar).
export type EstadoOrdenBodega = 'Todas' | 'Pendientes' | 'En proceso' | 'Entregadas';

export type DatosOrdenBodega = {
  id: string;
  numero: string;
  cliente: string;
  estado: string;
};

export class FacturarDespachoBodegaPage {
  constructor(
    private readonly facturar: FacturarPage,
    private readonly pos: PosPage,
    private readonly page: Page,
  ) {}

  // ─── Navegación ─────────────────────────────────────────────────────────

  /**
   * Abre "Despacho de bodega" y deja la pantalla lista para trabajar.
   * Requiere que `FacturarPage.abrirDespachoDeBodega()` haya devuelto
   * `'pantalla_real'` (el complemento "Control de Despacho" está habilitado
   * para la cuenta) — confirmado en vivo, RE-CONFIRMADO en esta sesión, que
   * ya no es exclusivo de la cuenta Super Administrador: el módulo también
   * quedó habilitado para la cuenta admin por defecto (`kadmin`), a
   * diferencia del hallazgo original documentado en
   * facturar-navegacion.spec.ts (que esperaba el modal "Módulos
   * Adicionales" para esa cuenta) — el estado real del complemento cambió
   * en el ambiente entre esa investigación y esta.
   *
   * El filtro de Compañía (`#company_select_chosen`) resultó ser EXCLUSIVO
   * de sesiones cross-company (cuenta Super Administrador, 17+ compañías):
   * confirmado en vivo que con la cuenta admin por defecto (una sola
   * compañía, ya HONDURAS) esa pantalla no renderiza ningún selector de
   * compañía — no hay nada que elegir. Por eso este método comprueba si el
   * Chosen existe antes de usarlo (`Promise.race`-like con un timeout
   * corto, no un `expect` duro) en vez de asumir que toda cuenta es
   * cross-company como se asumía antes.
   */
  async abrir() {
    const resultado = await this.facturar.abrirDespachoDeBodega();
    expect(resultado, 'Se esperaba la pantalla real de Despacho de Bodega — el complemento salió como no habilitado').toBe('pantalla_real');
    await this.pos.cerrarOverlaysConocidos();
    await this._seleccionarCompaniaSiAplica();
  }

  /**
   * Selecciona la compañía SOLO si el filtro cross-company existe en esta
   * sesión (ver el comentario de `abrir()`) — `isVisible({timeout})` en vez
   * de un `expect` duro, para no fallar en cuentas de una sola compañía
   * donde el Chosen simplemente no se renderiza.
   */
  private async _seleccionarCompaniaSiAplica() {
    const tieneFiltroCompania = await this.page.locator('#company_select_chosen')
      .isVisible({ timeout: TIMEOUTS.MODAL })
      .catch(() => false);
    if (tieneFiltroCompania) {
      await this.facturar.seleccionarCompaniaEnDespacho(COMPANIA_POS);
    }
  }


  // ─── Locators ───────────────────────────────────────────────────────────

  get campoBuscar(): Locator { return this.page.locator('#order_search'); }
  get botonBuscar(): Locator { return this.page.locator('#btn_search_order'); }
  get campoFechaDesde(): Locator { return this.page.locator('#start_date'); }
  get campoFechaHasta(): Locator { return this.page.locator('#end_date'); }

  /** Tarjetas de la lista "Órdenes de caja" — mismo mecanismo real que Despacho de Órdenes de Caja: `onclick="get_cash_order_detail(<id>)"`. */
  get tarjetas(): Locator { return this.page.locator('[onclick*="get_cash_order_detail"]'); }

  /** Panel de detalle vacío ("Seleccionar Orden") — estado inicial antes de elegir una tarjeta. */
  get panelSeleccionarOrden(): Locator { return this.page.getByText('Seleccionar Orden'); }

  /**
   * Encabezado real del panel de detalle una vez cargado ("Factura No.
   * <num>") — confirmado en vivo, distinto del texto "Orden No." de
   * Despacho de Órdenes de Caja. Estructura real confirmada en vivo:
   * `<h4><strong>Factura No. 1179</strong></h4>`.
   *
   * CORRECCIÓN DE AUTOMATIZACIÓN confirmada en vivo, en dos capas: (1) el
   * locator `text=/^.../` (motor `text=` de Playwright con regex ancladas)
   * nunca llegó a resolverse contra este heading real, aunque el heading sí
   * existía en el DOM (confirmado con capturas de red y snapshots de
   * accesibilidad tomados en el momento exacto del timeout); (2) incluso
   * reemplazándolo por `locator('h4', { hasText: /^Factura No\.\s*\d+/ })`
   * (con el mismo anclado `^`), el mismo síntoma se repitió de forma
   * reproducible pese a que el heading estaba completamente renderizado
   * (confirmado leyendo el snapshot de error: "Factura No. 1175" con toda
   * la línea de producto ya presente). Quitar el anclado `^` (quedarse solo
   * con `hasText: /Factura No\.\s*\d+/`, sin exigir que sea el INICIO del
   * texto normalizado del `<h4>`) resolvió el problema de forma consistente
   * — la causa real parece ser cómo Playwright normaliza/ancla el texto
   * agregado de un `<h4>` cuyo contenido vive en un `<strong>` hijo, no una
   * condición de carrera ni de ambiente lento.
   */
  get panelDetalle(): Locator { return this.page.locator('h4', { hasText: /Factura No\.\s*\d+/ }); }

  get botonTomarOrden(): Locator { return this.page.locator('.a_status_order', { hasText: 'Tomar Orden' }); }
  get botonFinalizar(): Locator { return this.page.locator('.a_status_order', { hasText: 'Finalizar' }); }

  /** Botón "☰" del panel de detalle — mismo id real `#dLabel` que Despacho de Órdenes de Caja, confirmado en vivo. */
  get botonMenuDetalle(): Locator { return this.page.locator('button#dLabel'); }
  get menuDetalleAbierto(): Locator { return this.page.locator('.dropdown-menu').filter({ hasText: 'Imprimir orden' }); }

  /** Input real del "Lector de código de barras" — confirmado en vivo: `#barcode_searchs`. Escribir el código y presionar Enter dispara el despacho de esa línea. */
  get campoLectorCodigoBarras(): Locator { return this.page.locator('#barcode_searchs'); }

  /** Tarjetas de línea de producto dentro del detalle — confirmado en vivo: clase real `.product_dispatch_item`, con `data-barcode`/`data-quantity` propios. */
  get lineasProducto(): Locator { return this.page.locator('.product_dispatch_item'); }


  // ─── Filtros ────────────────────────────────────────────────────────────

  /** Filtra por "Estado orden" (Todas/Pendientes/En proceso/Entregadas) — reutiliza el Chosen-por-texto genérico de FacturarPage. */
  async filtrarPorEstado(estado: EstadoOrdenBodega) {
    await this.facturar._seleccionarOpcionChosenPorTexto('#select_order_status_chosen', estado);
  }

  /** Busca por texto libre — mismo campo único (`#order_search`) que indexa número de orden y cliente, confirmado en vivo (mismo mecanismo que Despacho de Órdenes de Caja). */
  async buscarPorTexto(texto: string) {
    await this.campoBuscar.fill(texto);
    await this._clickConReintentosCerrandoOverlays(this.botonBuscar, 'botón "Buscar"');
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.AJAX }).catch(() => {});
  }

  /** Limpia el buscador de texto y vuelve a consultar — no se confirmó en vivo ningún botón dedicado "Limpiar filtros" en esta pantalla, mismo hallazgo que Despacho de Órdenes de Caja. */
  async limpiarBusqueda() {
    await this.buscarPorTexto('');
  }

  /**
   * MISMO hallazgo de sistema/ambiente ya documentado en
   * `FacturarDespachoOrdenesCajaPage.establecerRangoFechas()`, confirmado en
   * vivo también en esta pantalla (interceptando la red): tras `fill()`
   * ambos campos quedan con el valor nuevo en el DOM, pero el payload real
   * que viaja en `getDispatchOrderSearch` al presionar "Buscar" sigue
   * trayendo las fechas por defecto (`start_date=2026-07-16&end_date=
   * 2026-07-31`), no las recién asignadas — la pantalla revierte ambos
   * campos entre `fill()` y que el click en "Buscar" dispara la consulta.
   * No es un problema de selector ni de formato: es el mismo comportamiento
   * real de la pantalla ya documentado para Despacho de Órdenes de Caja, y
   * consistente con que ambas pantallas comparten el mismo componente base.
   */
  async establecerRangoFechas(desdeISO: string, hastaISO: string) {
    await this.campoFechaDesde.fill(desdeISO);
    await this.campoFechaHasta.fill(hastaISO);
    await this._clickConReintentosCerrandoOverlays(this.botonBuscar, 'botón "Buscar" (tras cambiar el rango de fechas)');
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.AJAX }).catch(() => {});
  }


  /**
   * Click con reintentos acotados cerrando los overlays conocidos del POS
   * antes de cada intento — mismo patrón exacto ya documentado en
   * `FacturarDespachoOrdenesCajaPage._clickConReintentosCerrandoOverlays()`:
   * confirmado en vivo también aquí que el banner de permisos de
   * notificaciones del navegador puede reaparecer de forma asíncrona e
   * interceptar el click sobre "Buscar"/el menú de tres puntos, dejándolo
   * reintentando indefinidamente contra ese banner hasta agotar el
   * presupuesto completo del test (reproducido en vivo durante la
   * investigación: un único intento con `page.click({button:'right'})`/
   * click directo sin reintentos quedó colgado 5 minutos completos contra
   * este mismo overlay).
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
   * Recarga la pantalla completa (F5 real) y reselecciona HONDURAS — mismo
   * mecanismo y mismo hallazgo ya documentado en
   * `FacturarDespachoOrdenesCajaPage.actualizarListado()` (el reload no
   * conserva el filtro de Compañía).
   */
  async actualizarListado() {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.pos.cerrarOverlaysConocidos();
    await this._seleccionarCompaniaSiAplica();
  }


  // ─── Detalle ────────────────────────────────────────────────────────────

  /** Abre el detalle de la primera orden visible y espera que el panel derecho ("Factura No. <num>") termine de cargar. */
  async abrirDetallePrimeraOrden(): Promise<DatosOrdenBodega> {
    const tarjeta = this.tarjetas.first();
    await expect(tarjeta, 'No hay ninguna Orden de Caja disponible en Despacho de Bodega').toBeVisible({ timeout: TIMEOUTS.AJAX });

    const onclick = await tarjeta.getAttribute('onclick') ?? '';
    const id = (onclick.match(/get_cash_order_detail\((\d+)\)/) ?? [, ''])[1];
    const numero = (await tarjeta.locator('strong').first().innerText().catch(() => '')).replace(/[^\d]/g, '');
    const cliente = (await tarjeta.innerText()).split('\n').map(l => l.trim()).filter(Boolean)[1] ?? '';

    await tarjeta.click();
    await expect(this.panelDetalle, 'El panel de detalle no mostró "Factura No. <num>" tras seleccionar la tarjeta').toBeVisible({ timeout: TIMEOUTS.DETALLE });

    const estado = await this._leerEstadoTarjetaSeleccionada();
    return { id, numero, cliente, estado };
  }

  /**
   * Lee el badge de estado de la tarjeta actualmente seleccionada. Mismo
   * hallazgo ya documentado en `FacturarDespachoOrdenesCajaPage
   * ._leerEstadoTarjetaSeleccionada()`, confirmado en vivo también aquí:
   * este badge NO se actualiza en vivo tras "Tomar Orden"/escanear
   * productos/"Finalizar" — sigue mostrando el estado ANTERIOR hasta que la
   * lista se vuelve a consultar contra el servidor. No es la fuente de
   * verdad para validar un cambio de estado recién aplicado (usar
   * `actualizarListado()` + `buscarPorTexto()` para eso).
   */
  async _leerEstadoTarjetaSeleccionada(): Promise<string> {
    const badge = this.page.locator('.selected_receip [class*="order_estatus"]').first();
    return (await badge.textContent().catch(() => ''))?.trim() ?? '';
  }


  // ─── Ciclo de despacho: Tomar Orden → escanear productos → Finalizar ───────
  //
  // Confirmado en vivo (creando una Orden de Caja real, escaneando su único
  // producto e interceptando la red completa): a diferencia de Despacho de
  // Órdenes de Caja (2 pasos: Tomar Orden → Finalizar), esta pantalla añade
  // un paso intermedio real — el botón "Finalizar" (`confirm_update_order_
  // status(id, 3)`, MISMA función real que Despacho de Órdenes de Caja) NO
  // aparece hasta que TODAS las líneas de producto de la orden quedan en
  // estado "Entregado" vía el lector de código de barras
  // (`#barcode_searchs` + Enter → POST real
  // `PosDispatchOrder/changeStatusDispathProductSalesItem`). El ciclo
  // completo real confirmado en vivo es:
  //   1. "Tomar Orden" (`confirm_update_order_status(id, 2)`): Pendiente → En
  //      proceso — mismo POST `PosDispatchOrder/updateOrderDispatchState`.
  //   2. Escanear cada línea de producto pendiente (barcode + Enter).
  //   3. "Finalizar" (`confirm_update_order_status(id, 3)`): En proceso →
  //      Entregado — solo visible una vez el paso 2 completó todas las
  //      líneas.

  async tomarOrden() {
    await expect(this.botonTomarOrden, 'El botón "Tomar Orden" no está disponible — la orden ya no está Pendiente').toBeVisible({ timeout: TIMEOUTS.MODAL });
    await this._clickConReintentosCerrandoOverlays(this.botonTomarOrden, 'botón "Tomar Orden"');
    await this.pos._confirmarSweetAlertV1('No apareció la confirmación "¿Está seguro de TOMAR esta orden?"');
  }

  /**
   * Escanea (vía `#barcode_searchs` + Enter) todas las líneas de producto
   * que sigan en estado "Pendiente" en el detalle actual, usando el
   * `data-barcode` real de cada línea — confirmado en vivo con "Producto
   * Rápido" (`data-barcode="0"`): tras el Enter, la línea pasa a "Entregado"
   * y, una vez agotadas todas, el botón "Finalizar" aparece.
   */
  async escanearTodosLosProductosPendientes() {
    const MAX_LINEAS = 20;
    for (let i = 0; i < MAX_LINEAS; i++) {
      const pendiente = this.lineasProducto.filter({ hasText: 'Pendiente' }).first();
      if (!(await pendiente.isVisible().catch(() => false))) break;

      const codigo = await pendiente.getAttribute('data-barcode') ?? '';
      const respuestaPromise = this.page.waitForResponse(
        (res) => res.url().includes('changeStatusDispathProductSalesItem') && res.request().method() === 'POST',
        { timeout: TIMEOUTS.AJAX }
      );
      await this.campoLectorCodigoBarras.fill(codigo);
      await this.campoLectorCodigoBarras.press('Enter');
      await respuestaPromise;
    }
  }

  async finalizarOrden() {
    await expect(this.botonFinalizar, 'El botón "Finalizar" no está disponible — faltan productos por escanear o la orden no está En proceso').toBeVisible({ timeout: TIMEOUTS.MODAL });
    await this._clickConReintentosCerrandoOverlays(this.botonFinalizar, 'botón "Finalizar"');
    await this.pos._confirmarSweetAlertV1('No apareció la confirmación "¿Está seguro de FINALIZAR esta orden?"');
  }

  /** Recorre el ciclo completo (Tomar Orden → escanear productos → Finalizar) sobre la orden actualmente en detalle — equivalente real de "Despachar" pedido por el escenario mínimo. */
  async despacharOrdenEnDetalle() {
    await this.tomarOrden();
    await this.escanearTodosLosProductosPendientes();
    await this.finalizarOrden();
  }


  // ─── Menú de tres puntos ────────────────────────────────────────────────

  /** Mismo patrón de reintento acotado ya documentado en `FacturarDespachoOrdenesCajaPage.abrirMenuDetalle()`. */
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

  /** Href real de "Imprimir orden" — confirmado en vivo: `PosDispatchOrder/printPosDispatchOrder?order_id=...` (distinto endpoint al de Despacho de Órdenes de Caja, mismo texto de menú). */
  async obtenerHrefImprimirOrden(): Promise<string> {
    await this.abrirMenuDetalle();
    const href = await this.menuDetalleAbierto.getByText('Imprimir orden').getAttribute('href');
    return href ?? '';
  }

  /** Href real de "Descargar PDF de orden" — confirmado en vivo: `PosDispatchOrder/downloadPosDispatchOrder?order_id=...`. */
  async obtenerHrefDescargarPdf(): Promise<string> {
    await this.abrirMenuDetalle();
    const href = await this.menuDetalleAbierto.getByText('Descargar PDF de orden').getAttribute('href');
    return href ?? '';
  }


  // ─── Creación de datos de respaldo vía POS ─────────────────────────────────

  /**
   * Crea una Orden de Caja real desde el POS (mismo flujo "Enviar a caja"
   * probado por pos-orden-caja.spec.ts, reutilizado tal cual — ver el
   * comentario de cabecera de este archivo para la evidencia en vivo de por
   * qué esta es la fuente de datos correcta para Despacho de Bodega,
   * ninguna lógica de negocio nueva). Reutiliza los mismos métodos públicos
   * de `PosPage` que ya usa
   * `FacturarDespachoOrdenesCajaPage.crearOrdenDeCajaDeRespaldo()`.
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
