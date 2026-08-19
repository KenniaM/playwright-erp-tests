import { expect, BrowserContext, Locator, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';

// Page Object dedicado al submódulo "Histórico de Ventas" (Ventas), separado
// de `ventas.page.ts` por escala real (mismo criterio que documenta
// CLAUDE.md para módulos que crecen más allá de "todo cabe en un único
// archivo") — investigación exhaustiva en vivo confirmó filtros, acciones y
// estados propios suficientes para justificar un archivo aparte.
//
// Métodos migrados TAL CUAL (mismo comportamiento, solo relocalizados) desde:
//  - `tests/ventas/ventas.page.ts` (VentasPage): buscarEnHistoricoVentas,
//    abrirFacturaEnHistorico, leerDetalleFacturaAbierta,
//    leerFormaDePagoFacturaAbierta.
//  - `tests/facturar/pos/pos-cierre-caja.spec.ts` (funciones locales,
//    duplicadas ahí porque no existía este Page Object): la lógica real de
//    anular factura y aplicar devolución completa (antes
//    `anularFacturaMasReciente()`/`aplicarDevolucionCompletaFacturaMasReciente()`),
//    adaptada aquí para operar sobre una página YA ABIERTA (`this.page`) en
//    vez de recibir un `PosPage` — la apertura real (desde POS, vía menú de
//    tres puntos → "Historial de Facturas", O por navegación directa a esta
//    URL) queda fuera de este Page Object, que no debe conocer ni el POS ni
//    ningún otro punto de entrada.

export const TIMEOUTS = {
  TEST:     90_000,
  NAVIGATE: 60_000,
  CARGA:    15_000,
  MODAL:    15_000,
} as const;

export const HISTORICO_VENTAS_URL = BASE_URL + '/receip/printPosReceip';

// ─── Filtros (investigados en vivo, panel real sobre el listado) ──────────────
// Confirmado en vivo: #payed_with, #receip_search_document_type y
// #electronic_billing_state_filter son <select> nativos (a diferencia de los
// selects de Cuentas por Cobrar, que sí usan el widget Chosen) — sin
// contenedor ".chosen-container" asociado en el DOM real, así que se operan
// con selectOption() directo.
export type MetodoPagoFiltro = 'Todas' | 'Efectivo' | 'Tarjeta' | 'SINPE MOVIL' | 'Transacción';
export type TipoDocumentoFiltro = 'Todas' | 'Facturas' | 'Órdenes de compra' | 'Orden de reparación' | 'Proforma';
export type EstadoElectronicoFiltro = 'Todos los estados' | 'No Aplica' | 'En Reenvío' | 'Aprobada' | 'Rechazada' | 'Pendiente';

// Pills de estado sobre el listado — ids reales confirmados en vivo
// (sale_state_all/cash/credit/pending/deleted), sin relación con el select
// "Tipo de documento" (filtro distinto y combinable).
export type EstadoFactura = 'todas' | 'contado' | 'credito' | 'pendientes' | 'anuladas';
const ID_ESTADO_FACTURA: Record<EstadoFactura, string> = {
  todas: 'sale_state_all',
  contado: 'sale_state_cash',
  credito: 'sale_state_credit',
  pendientes: 'sale_state_pending',
  anuladas: 'sale_state_deleted',
};

// ─── Detalle de factura ─────────────────────────────────────────────────────

/**
 * Datos reales del panel de detalle de una factura en Histórico de Ventas
 * (`.receip-v2-order-item`, confirmado en vivo volcando su DOM real: dos
 * bloques `<span class="order-label">`/`<span class="order-value">`, uno
 * para "Número Orden de Compra" y otro para "Número Orden de Reparación").
 * Ambos campos vienen vacíos ("—") cuando la factura no tiene ese origen —
 * nunca `undefined`, el propio template siempre renderiza el bloque.
 */
export type DetalleFacturaHistorico = {
  numeroOrdenCompra: string;
  numeroOrdenReparacion: string;
};

/**
 * Sección "Forma de pago" del detalle de una factura en Histórico de Ventas.
 * A diferencia de `.receip-v2-order-item` (usado por `leerDetalleFacturaAbierta()`),
 * esta sección NO expone una clase CSS propia y predecible por bloque
 * (confirmado en vivo intentando localizarla por `.receip-v2-order-item` —
 * cuenta 0) — se parsea desde el texto plano del panel, mismo criterio ya
 * usado en otras investigaciones de este repo cuando el marcado real no
 * ofrece un selector estable (ver `pos-permisos.page.ts`). Cada monto queda
 * `null` cuando ese método no aparece en la factura (nunca "0.00": la propia
 * plantilla solo imprime la línea de un método si se usó).
 */
export type FormaDePagoFacturaHistorico = {
  estado: string;
  efectivoRecibido: number | null;
  vuelto: number | null;
  tarjeta: number | null;
  sinpe: number | null;
  transaccion: number | null;
};

/**
 * Sección "Resumen de totales" del detalle de factura — investigada en vivo
 * (factura Consec. 1470, contado/efectivo, sin descuento ni impuestos): 6
 * campos reales, siempre presentes ("Abono" aparece incluso en 0,00 para una
 * factura de contado sin abonos). Mismo criterio de parseo por texto que
 * `leerFormaDePagoFacturaAbierta()` (sin clase CSS propia por campo).
 */
export type ResumenTotalesFactura = {
  otrosCargos: number;
  subtotal: number;
  descuento: number;
  impuestos: number;
  abono: number;
  total: number;
};

// ─── Page Object ──────────────────────────────────────────────────────────────

export class HistoricoVentasPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada directo a Histórico de Ventas (navegación, sin pasar por POS). */
  async irA() {
    await this.page.goto(HISTORICO_VENTAS_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }

  // ─── Consulta: búsqueda y filtros ──────────────────────────────────────────

  /**
   * Abre "Histórico de Ventas" y busca por el término dado usando el
   * buscador real de la pantalla (soporta número de factura, orden de
   * compra, orden de reparación o proforma — confirmado en vivo por su
   * propio placeholder). Espera la respuesta real de red antes de continuar
   * en vez de un tiempo fijo. (Migrado tal cual desde `VentasPage`.)
   */
  async buscarEnHistoricoVentas(termino: string) {
    await this.irA();
    const buscador = this.page.locator('input[placeholder="Buscar por factura, orden de compra, orden de reparación o proforma..."]');
    await buscador.waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA });

    await buscador.fill(termino);
    await buscador.press('Enter');
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  /**
   * Selecciona una opción por texto visible en un `<select>` que un widget
   * propio de la app mantiene visualmente OCULTO (confirmado en vivo:
   * `#payed_with`/`#receip_search_document_type`/`#electronic_billing_state_filter`
   * nunca quedan "visible" para Playwright pese a estar en el DOM — mismo
   * patrón que el resto de checkboxes-slider de esta suite, aquí aplicado a
   * un `<select>`). `selectOption()` normal cuelga esperando visibilidad
   * indefinidamente; se fija `.value` real (resuelto por texto de opción) y
   * se despacha `change` manualmente, para que el widget que lo envuelve
   * quede sincronizado igual que con una interacción real.
   */
  private async _seleccionarOpcionOculta(selectorId: string, textoOpcion: string) {
    await this.page.locator(selectorId).evaluate((el: HTMLSelectElement, texto) => {
      const opcion = Array.from(el.options).find((o) => o.textContent?.trim() === texto);
      if (!opcion) throw new Error(`No existe la opción "${texto}" en ${el.id}`);
      el.value = opcion.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, textoOpcion);
  }

  /** Filtra el listado por método de pago ("PAGÓ CON") — investigado en vivo: Todas/Efectivo/Tarjeta/SINPE MOVIL/Transacción. */
  async filtrarPorMetodoPago(metodo: MetodoPagoFiltro) {
    await this._seleccionarOpcionOculta('#payed_with', metodo);
    await this.presionarBuscar();
  }

  /** Filtra por tipo de documento — investigado en vivo: Todas/Facturas/Órdenes de compra/Orden de reparación/Proforma. */
  async filtrarPorTipoDocumento(tipo: TipoDocumentoFiltro) {
    await this._seleccionarOpcionOculta('#receip_search_document_type', tipo);
    await this.presionarBuscar();
  }

  /** Filtra por estado de facturación electrónica — investigado en vivo. */
  async filtrarPorEstadoElectronico(estado: EstadoElectronicoFiltro) {
    await this._seleccionarOpcionOculta('#electronic_billing_state_filter', estado);
    await this.presionarBuscar();
  }

  /** Establece el rango de fechas ("FECHA DESDE"/"FECHA HASTA"), formato `YYYY-MM-DD`. */
  async filtrarPorRangoFechas(desde: string, hasta: string) {
    await this.page.locator('#start_date').fill(desde);
    await this.page.locator('#end_date').fill(hasta);
    await this.presionarBuscar();
  }

  /**
   * Cierra el banner "Activar notificaciones" del navegador si aparece —
   * elemento ajeno a Histórico de Ventas que puede quedar sobre el
   * encabezado e interceptar el primer click real de un test (mismo
   * hallazgo ya documentado en varios módulos de esta suite, p. ej.
   * `rutas.page.ts`).
   */
  private async _cerrarBannerNotificacionesSiAparece() {
    const banner = this.page.locator('#workshop-web-notification-permission');
    if (await banner.isVisible().catch(() => false)) {
      await banner.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 3_000 }).catch(() => {});
    }
  }

  /**
   * Presiona el botón real "Buscar" (`#btn_search_receip`) que aplica los
   * filtros ya establecidos. Reintentos acotados cerrando el banner de
   * notificaciones y el menú de usuario del encabezado antes de cada
   * intento — confirmado en vivo que ambos pueden interceptar este click
   * (mismo patrón de reintentos ya usado en el resto de la suite en vez de
   * un único intento con timeout largo).
   */
  async presionarBuscar() {
    const boton = this.page.locator('#btn_search_receip');
    const MAX_INTENTOS = 5;
    let exito = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !exito; intento++) {
      await this._cerrarBannerNotificacionesSiAparece();
      exito = await boton.click({ timeout: 5_000 }).then(() => true).catch(() => false);
    }
    expect(exito, `El botón "Buscar" no respondió tras ${MAX_INTENTOS} intentos`).toBe(true);
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  /**
   * Selecciona una de las 5 pills de estado sobre el listado (Todas/Contado/
   * Crédito/Pendientes/Anuladas) — filtro combinable con los de arriba,
   * investigado en vivo con ids reales estables.
   */
  async filtrarPorEstado(estado: EstadoFactura) {
    await this._cerrarBannerNotificacionesSiAparece();
    await this.page.locator(`#${ID_ESTADO_FACTURA[estado]}`).click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  /** Cuenta las tarjetas de factura actualmente visibles en el listado. */
  async contarFacturasVisibles(): Promise<number> {
    return this.page.locator('.receip-v2-sale-consecutive').count();
  }

  // ─── Detalle de factura ─────────────────────────────────────────────────────

  /**
   * Abre el detalle de una factura ya visible en la lista filtrada
   * (`buscarEnHistoricoVentas()` primero), localizándola por su propio
   * consecutivo real (`span.receip-v2-sale-consecutive`, texto real
   * "Consec. <numeroFactura>" — confirmado en vivo volcando su DOM) en vez
   * de buscar el texto en toda la página, que puede coincidir con otros
   * elementos (fecha, monto) que contengan el mismo número. (Migrado tal
   * cual desde `VentasPage`.)
   */
  async abrirFacturaEnHistorico(numeroFactura: string) {
    const tarjeta = this.page.locator('.receip-v2-sale-consecutive', { hasText: `Consec. ${numeroFactura}` }).first();
    await tarjeta.waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA });
    await tarjeta.click();

    await this.page.getByText('Forma de pago', { exact: true })
      .waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA });
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  /**
   * Abre el detalle de la PRIMERA factura del listado ya cargado (la más
   * reciente, orden confirmado en vivo) — usado por flujos que no conocen de
   * antemano el número exacto (anular/devolver "la última factura creada").
   */
  async abrirPrimeraFacturaDelListado() {
    const primera = this.page.locator('.receip-v2-sale-consecutive').first();
    await primera.waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA });
    await primera.click();
    await this.page.getByText('Forma de pago', { exact: true })
      .waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA });
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  /**
   * Lee "Número Orden de Compra"/"Número Orden de Reparación" del panel de
   * detalle YA ABIERTO (`abrirFacturaEnHistorico()`). (Migrado tal cual
   * desde `VentasPage`.)
   */
  async leerDetalleFacturaAbierta(): Promise<DetalleFacturaHistorico> {
    const leerValor = async (etiqueta: string) => {
      const bloque = this.page.locator('.receip-v2-order-item', { hasText: etiqueta }).first();
      const valor = await bloque.locator('.order-value').textContent();
      return (valor ?? '').trim();
    };

    return {
      numeroOrdenCompra: await leerValor('Número Orden de Compra'),
      numeroOrdenReparacion: await leerValor('Número Orden de Reparación'),
    };
  }

  /**
   * Lee la sección "Forma de pago" del detalle de factura YA ABIERTO.
   * (Migrado tal cual desde `VentasPage`.)
   */
  async leerFormaDePagoFacturaAbierta(): Promise<FormaDePagoFacturaHistorico> {
    const bodyTexto = await this.page.locator('body').innerText();

    const inicio = bodyTexto.indexOf('Forma de pago');
    const fin = bodyTexto.indexOf('Resumen de totales', inicio);
    const texto = inicio >= 0
      ? bodyTexto.slice(inicio, fin >= 0 ? fin : undefined)
      : bodyTexto;

    const leerMonto = (etiqueta: string): number | null => {
      const m = new RegExp(`${etiqueta}[^:\\n]*:?\\s*[A-Za-z$₡]*\\s*([0-9.,]+)`, 'i').exec(texto);
      if (!m) return null;
      const crudo = m[1];
      const limpio = crudo.lastIndexOf(',') > crudo.lastIndexOf('.')
        ? crudo.replace(/\./g, '').replace(',', '.')
        : crudo.replace(/,/g, '');
      const valor = parseFloat(limpio);
      return Number.isNaN(valor) ? null : valor;
    };
    const leerTexto = (etiqueta: string): string => {
      const m = new RegExp(`${etiqueta}:?\\s*([^\\n|]+)`, 'i').exec(texto);
      return m ? m[1].trim() : '';
    };

    return {
      estado: leerTexto('Estado'),
      efectivoRecibido: leerMonto('Efectivo recibido'),
      vuelto: leerMonto('Vuelto'),
      tarjeta: leerMonto('Tarjeta'),
      sinpe: leerMonto('SINPE'),
      transaccion: leerMonto('Transacci[oó]n'),
    };
  }

  /**
   * Lee la sección "Resumen de totales" del detalle YA ABIERTO — nuevo,
   * investigado en vivo. Mismo criterio de parseo por texto que
   * `leerFormaDePagoFacturaAbierta()` (sin clase CSS propia por campo,
   * acotado entre el encabezado real "Resumen de totales" y el pie de
   * página real "TallerAlpha - Versión", presente en toda la pantalla).
   *
   * CORRECCIÓN DE AUTOMATIZACIÓN CONFIRMADA EN VIVO (bug real, root-cause de
   * `resumen.total` devolviendo el mismo valor que `resumen.subtotal` — hallazgo
   * de la auditoría de Restaurante, Escenario 28 de pos-restaurante-mesas.spec.ts:
   * "El total en Histórico (4500) debe coincidir con el facturado (4825)",
   * con `subtotal` e `impuestos:0` sugiriendo el mismo número mal leído dos
   * veces): `leerMonto('TOTAL')` (la versión anterior, sin límite de
   * palabra) buscaba la subcadena "total" en CUALQUIER posición del texto,
   * case-insensitive — y "Subtotal" CONTIENE literalmente "total" como
   * subcadena. Como "Subtotal" siempre aparece ANTES que "TOTAL" en la
   * sección "Resumen de totales", `.exec()` (sin flag `g`, se queda con el
   * PRIMER match) encontraba y devolvía el valor del Subtotal disfrazado de
   * TOTAL, siempre — nunca llegaba a leer la línea real de TOTAL. El único
   * test que ya validaba este método (`historico-ventas.spec.ts`, "Detalle
   * de factura") usa deliberadamente un escenario sin descuento ni impuestos
   * (subtotal===total), así que el bug quedaba enmascarado ahí: ambos
   * campos coincidían igual, por la razón equivocada. Se agrega un límite de
   * palabra real (lookbehind negativo: la etiqueta no puede estar precedida
   * de una letra) para que "TOTAL" nunca matchee dentro de "Subtotal".
   */
  async leerResumenTotalesFactura(): Promise<ResumenTotalesFactura> {
    const bodyTexto = await this.page.locator('body').innerText();
    const inicio = bodyTexto.indexOf('Resumen de totales');
    const fin = bodyTexto.indexOf('TallerAlpha - Versión', inicio);
    const texto = inicio >= 0 ? bodyTexto.slice(inicio, fin >= 0 ? fin : undefined) : bodyTexto;

    const leerMonto = (etiqueta: string): number => {
      const m = new RegExp(`(?<![A-Za-z])${etiqueta}:?\\s*[A-Za-z$₡]*\\s*(-?[0-9.,]+)`, 'i').exec(texto);
      if (!m) return 0;
      const crudo = m[1];
      const limpio = crudo.lastIndexOf(',') > crudo.lastIndexOf('.')
        ? crudo.replace(/\./g, '').replace(',', '.')
        : crudo.replace(/,/g, '');
      const valor = parseFloat(limpio);
      return Number.isNaN(valor) ? 0 : valor;
    };

    return {
      otrosCargos: leerMonto('Otros Cargos'),
      subtotal: leerMonto('Subtotal'),
      descuento: leerMonto('Descuento'),
      impuestos: leerMonto('Impuestos'),
      abono: leerMonto('Abono'),
      total: leerMonto('TOTAL'),
    };
  }

  /**
   * Expande (si no lo está ya) la sección "Ver detalles" del detalle de
   * factura YA ABIERTO, que revela la tabla "Detalle de productos y
   * servicios" — investigado en vivo: toggle real por texto visible, sin id
   * propio confirmado.
   */
  async expandirDetalleProductos() {
    const toggle = this.page.getByText('Ver detalles', { exact: true }).first();
    if (await toggle.count() > 0) {
      await toggle.click();
    }
    await expect(
      this.page.getByText('Detalle de productos y servicios', { exact: true }),
      'La sección "Detalle de productos y servicios" no quedó visible tras "Ver detalles"'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Cuenta las líneas de producto/servicio reales de la tabla "Detalle de
   * productos y servicios" (ya expandida vía `expandirDetalleProductos()`) —
   * localiza la tabla real por cercanía a su propio encabezado ("CANTIDAD"),
   * nunca por una clase CSS asumida.
   */
  async contarLineasDetalleProductos(): Promise<number> {
    // CORRECCIÓN DE AUTOMATIZACIÓN confirmada en vivo: "Detalle de productos
    // y servicios" NO es una tabla HTML — es un layout de tarjetas por
    // línea (`div.receip_detail_product_item`, confirmado en vivo volcando
    // el DOM real), a diferencia de lo asumido inicialmente.
    return this.page.locator('.receip_detail_product_item').count();
  }

  /**
   * Click con reintentos acotados cerrando el banner "Activar
   * notificaciones" antes de cada intento — confirmado en vivo que puede
   * interceptar acciones destructivas reales de esta página (Anular
   * Factura, Apl. Devolución), especialmente cuando el detalle se abrió
   * dentro de una ventana emergente NUEVA (popup de "Historial de
   * Facturas" del POS), donde el banner del navegador puede reaparecer sin
   * haberse cerrado antes (mismo hallazgo ya documentado en otros módulos
   * de esta suite, p. ej. `rutas.page.ts`).
   */
  private async _clickConReintentosCerrandoBanner(locator: Locator) {
    const banner = this.page.locator('#workshop-web-notification-permission');
    const MAX_INTENTOS = 5;
    let exito = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !exito; intento++) {
      if (await banner.isVisible().catch(() => false)) {
        await banner.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 3_000 }).catch(() => {});
      }
      exito = await locator.click({ timeout: 5_000 }).then(() => true).catch(() => false);
    }
    expect(exito, `El click no tuvo éxito tras ${MAX_INTENTOS} intentos (posible interferencia del banner de notificaciones)`).toBe(true);
  }

  // ─── Acciones sobre una factura YA ABIERTA ─────────────────────────────────
  // El detalle debe estar abierto (abrirFacturaEnHistorico()/
  // abrirPrimeraFacturaDelListado()) antes de llamar cualquiera de estos.

  /** Locator del botón real "Anular Factura" del detalle de factura ya abierto. */
  get botonAnularFactura() {
    return this.page.locator('#delete_invoice_btn').first();
  }

  /**
   * Anula la factura cuyo detalle está actualmente abierto — botón "Anular
   * Factura" (`#delete_invoice_btn`, confirmado en vivo con un `id`
   * DUPLICADO real en el DOM — hay una segunda copia dentro de un menú
   * `<li>` — de ahí `.first()`), dispara el SweetAlert v1 estándar
   * ("¿Está seguro de eliminar la factura No.X?", con el mismo texto sin
   * traducir "Not valid!" ya documentado como bug de i18n en otro flujo de
   * este proyecto — no bloquea la eliminación). Migrado desde
   * `anularFacturaMasReciente()` (antes local en `pos-cierre-caja.spec.ts`).
   */
  async anularFacturaAbierta() {
    await expect(this.botonAnularFactura, 'El botón "Anular Factura" no apareció en el detalle de la factura').toBeVisible({ timeout: TIMEOUTS.MODAL });
    await this._clickConReintentosCerrandoBanner(this.botonAnularFactura);

    const sweetAlert = this.page.locator('.sweet-alert.visible');
    await expect(sweetAlert, 'El SweetAlert de confirmación de eliminar factura no apareció').toBeVisible({ timeout: TIMEOUTS.MODAL });
    await sweetAlert.locator('button.confirm').click();

    await expect(
      this.page.locator('.noty_bar', { hasText: /elimin|anul/i }),
      'No apareció el toast de confirmación de factura eliminada'
    ).toBeVisible({ timeout: TIMEOUTS.MODAL }).catch(() => {});
  }

  /**
   * Aplica una devolución COMPLETA sobre la factura cuyo detalle está
   * actualmente abierto, vía "Apl. Devolución" → página nueva
   * (`refund/addRefund?invoice_number=<id>`). Flujo real completo
   * investigado en vivo (más de una decena de intentos, ver el informe de
   * esta suite): marcar la línea, resolver el modal "Tipo de devolución"
   * (Reembolso + método de pago Efectivo) y confirmar. Migrado desde
   * `aplicarDevolucionCompletaFacturaMasReciente()` (antes local en
   * `pos-cierre-caja.spec.ts`), mismo comportamiento — solo deja de recibir
   * un `PosPage` (esta clase no conoce el POS, ver la nota de cabecera).
   */
  async aplicarDevolucionCompleta(context: BrowserContext, montoFactura: number): Promise<void> {
    const btnDevolucion = this.page.locator('a[title="Aplicar Devolución"]').first();
    await expect(btnDevolucion, 'El botón "Apl. Devolución" no apareció en el detalle de la factura').toBeVisible({ timeout: TIMEOUTS.MODAL });

    const popupPromise = context.waitForEvent('page', { timeout: TIMEOUTS.MODAL });
    await this._clickConReintentosCerrandoBanner(btnDevolucion);
    const devolucionPage = await popupPromise;
    await devolucionPage.waitForLoadState('domcontentloaded').catch(() => {});

    // Marcar el checkbox de la línea (slider CSS oculto, click programático).
    const checkboxId = await devolucionPage.evaluate(() => {
      const el = document.querySelector('.refund_checkbox');
      return el ? el.id : null;
    });
    expect(checkboxId, 'No se encontró ninguna línea de producto para devolver').not.toBeNull();
    await devolucionPage.evaluate((id) => {
      (document.getElementById(id as string) as HTMLInputElement).click();
    }, checkboxId);

    await expect(
      devolucionPage.locator('.quantity_to_refund').first(),
      'El campo de cantidad a devolver no se habilitó tras marcar la línea'
    ).toBeEnabled({ timeout: TIMEOUTS.MODAL });

    // Modal "Tipo de devolución" — Reembolso + método de pago Efectivo.
    await devolucionPage.locator('.sr-refund-type-btn').first().click({ force: true });
    await expect(
      devolucionPage.locator('#sr_refund_type_modal'),
      'El modal "Tipo de devolución" no apareció'
    ).toBeVisible({ timeout: TIMEOUTS.MODAL });

    await devolucionPage.evaluate(() => {
      const check = document.getElementById('sr_pay_cash_check') as HTMLInputElement;
      check.checked = true;
      check.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(
      devolucionPage.locator('#sr_pay_cash_amount'),
      'El campo de monto en efectivo no se reveló tras marcar "Efectivo"'
    ).toBeVisible({ timeout: TIMEOUTS.MODAL });
    await devolucionPage.locator('#sr_pay_cash_amount').fill(String(montoFactura));

    await devolucionPage.locator('#sr_refund_type_modal button[onclick="saveRowRefundType()"]').click({ force: true });
    await expect(
      devolucionPage.locator('#sr_refund_type_modal'),
      'El modal "Tipo de devolución" no se cerró tras "Aplicar"'
    ).toBeHidden({ timeout: TIMEOUTS.MODAL });

    // Procesar y confirmar.
    const respuestaPromise = devolucionPage.waitForResponse(
      (res) => res.url().includes('addSaleRefund'),
      { timeout: TIMEOUTS.MODAL }
    );
    await devolucionPage.locator('#refund_sale').click();
    await expect(
      devolucionPage.locator('.sweet-alert.visible'),
      'El SweetAlert de confirmación de devolución no apareció'
    ).toBeVisible({ timeout: TIMEOUTS.MODAL });
    await devolucionPage.locator('.sweet-alert.visible button.confirm').click();

    const respuesta = await respuestaPromise;
    expect(respuesta.ok(), `addSaleRefund no respondió OK (status ${respuesta.status()})`).toBe(true);

    await devolucionPage.close();
  }
}
