import { expect, Page } from '@playwright/test';

// ─── URL ──────────────────────────────────────────────────────────────────────

export const POS_URL =
  'https://dev.designsoftcr.com/qa_talleralpha/public/pos/pointOfSale?company_pos=37&pos_type_option=1';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:          300_000,
  NAVIGATE:       90_000,
  PRODUCTS_LOAD: 120_000,
  PAYMENT_MODAL:  15_000,
  PRINT_POPUP:    15_000,
} as const;

// ─── Pausas visuales ──────────────────────────────────────────────────────────
// Permiten ver cada paso en la pantalla durante la ejecución en modo headed.

const PAUSES = {
  VER_PRODUCTOS:        2_000,
  VER_CARRITO:          2_500,
  VER_MODAL:            1_500,
  CHECKBOX_ACTIVACION:    800,
  CAMPO_HABILITADO:     1_000,
  VER_MONTO:            1_500,
  VER_FACTURA:          4_000,
  POST_CIERRE:          2_000,
  ESTADO_FINAL:         3_000,
} as const;

// ─── Locators ─────────────────────────────────────────────────────────────────

const L = {
  // POS principal
  PRODUCTO:          '.product_box_name',
  BTN_FACTURAR:      '#btn_pay_sale',
  CARRITO_FILAS:     '#table_sale_pos tbody tr',
  CARRITO_CLAVES:    '#table_buy_list p[id^="drag_and_drop_"]',
  TOTAL_SUB:         '#total_sub',
  DESCUENTO_GENERAL: '#apply_general_discount',

  // Modal de pago
  TOTAL_MODAL:       'total_sale_txt',         // ID sin # — se lee vía evaluate()
  BTN_CONFIRMAR:     '#make_payment',
  EFECTIVO_MONTO:    '#payment_cash_total',    // señal confiable de apertura del modal
  EFECTIVO_RECIBIDO: '#received_mount',

  // Apertura de caja — un único contenedor cubre tanto "Caja: Cerrada" (sin
  // discrepancia) como el aviso de diferencia de efectivo al intentar abrirla.
  DIALOG_ABRIR_CAJA: '#dialog_cash_opening',
  CAJA_TEXTO:        'Caja: Cerrada',
  CAJA_BTN_ABRIR:    '#btn_open_cash',
  CAJA_MONTO:        'input[placeholder="0.00"]',
  CAJA_OBSERVACION:  'Ingrese sus observaciones aquí',

  // Menú "Caja" → "(F12) Abrir/Cerrar Caja". El mismo ítem de menú despliega el
  // modal "Abrir Caja" si la caja está cerrada, o "Detalle de Cierre" si está
  // abierta — descubierto inspeccionando el DOM real, no asumido.
  MENU_CAJA_BTN:        '#menu_cash',
  MENU_CAJA_ITEM_F12:   'Abrir/Cerrar Caja',

  // Modal "Detalle de Cierre" (cerrar caja)
  DIALOG_CERRAR_CAJA:      '#dialog_cash_closing',
  CIERRE_EFECTIVO_CAJA:    '#closure_posted_balance',
  CIERRE_EFECTIVO_SIGUIENTE: '#next_cash_closing',
  CIERRE_OBSERVACION:      '#closuse_cash_observation', // sic: typo real de la app ("closuse")
  CIERRE_BTN_CERRAR:       '#btn_close_cash',
  CIERRE_BTN_CANCELAR:     'button[data-dismiss="modal"]',
} as const;

// IDs de checkboxes de métodos de pago.
// Usan slider CSS y están fuera del viewport del modal — se acceden via evaluate().
const CHECKBOX_ID = {
  EFECTIVO:    'is_payment_cash',
  TARJETA:     'is_payment_credit_card',
  SINPE:       'is_payment_check',
  TRANSACCION: 'is_payment_transaction',
} as const;

// ─── Tipos y configuración de métodos de pago ─────────────────────────────────

export type MetodoPago = {
  checkboxId: string;
  montoLocator: string;
};

// Tarjeta, SINPE y transacción bancaria requieren el monto exacto de la factura.
export const METODO: Record<string, MetodoPago> = {
  TARJETA:     { checkboxId: CHECKBOX_ID.TARJETA,     montoLocator: '#payment_credit_card_total' },
  SINPE:       { checkboxId: CHECKBOX_ID.SINPE,        montoLocator: '#payment_check_total'       },
  TRANSACCION: { checkboxId: CHECKBOX_ID.TRANSACCION, montoLocator: '#payment_transaction_total'  },
};

// Efectivo permite superar el total (el sistema calcula el vuelto).
export const MONTO_EFECTIVO = '100';
export const DESCUENTO_INDIVIDUAL_PCT = '5';

// ─── Tipos de resultado del descuento individual ───────────────────────────────

export type EscenarioDescuento =
  | 'aplicado'        // descuento aplicado exactamente como se solicitó
  | 'maximo_superado' // porcentaje mayor al máximo; se aplicó el máximo permitido
  | 'sin_descuento';  // producto no permite descuento (máximo = 0)

export type ResultadoDescuento = {
  clave: string;
  porcentajeSolicitado: string;
  porcentajeAplicado: string;
  escenario: EscenarioDescuento;
  mensajeAlerta?: string;  // texto del diálogo que apareció, si hubo uno
};

// ─── Page Object ──────────────────────────────────────────────────────────────

export class PosPage {
  constructor(private readonly page: Page) {}

  /** Locator del modal "Abrir Caja", expuesto para que los tests validen su contenido. */
  get modalAbrirCaja() {
    return this.page.locator(L.DIALOG_ABRIR_CAJA);
  }

  /** Locator del primer producto disponible en el grid del POS. */
  get primerProducto() {
    return this.page.locator(L.PRODUCTO).first();
  }

  /** Navega al POS. No decide nada sobre el modal "Abrir Caja"; eso es responsabilidad del test. */
  async irAlPos() {
    await this.page.goto(POS_URL, { waitUntil: 'commit', timeout: TIMEOUTS.NAVIGATE });
  }

  /**
   * Espera a que el POS resuelva su estado inicial: el modal "Abrir Caja" (si la caja
   * está cerrada) o el grid de productos (si no hay nada que resolver). Es necesario
   * porque `irAlPos()` resuelve apenas el navegador recibe la respuesta
   * (`waitUntil: 'commit'`), antes de que la comprobación asíncrona del estado de la
   * caja termine de decidir cuál de los dos se renderiza.
   */
  async esperarEstadoInicial() {
    // Ambos locators son independientes (no un `.or()` combinado): con dos elementos
    // en el DOM a la vez, `.or()` viola el modo estricto de Playwright aunque solo
    // uno esté visible. Se corre una carrera entre las dos esperas explícitas y se
    // continúa apenas la primera de las dos efectivamente se vuelve visible.
    await Promise.race([
      this.modalAbrirCaja.waitFor({ state: 'visible', timeout: TIMEOUTS.PRODUCTS_LOAD }),
      this.primerProducto.waitFor({ state: 'visible', timeout: TIMEOUTS.PRODUCTS_LOAD }),
    ]);
  }

  /** Indica si el modal "Abrir Caja" está visible en este momento (chequeo puntual, sin esperar). */
  async modalAbrirCajaVisible(): Promise<boolean> {
    return this.modalAbrirCaja.isVisible();
  }

  /**
   * Cierra el modal "Abrir Caja" con su botón "Cancelar", sin completar la apertura.
   * Útil cuando el flujo no depende de tener la caja abierta.
   */
  async cerrarModalAbrirCaja() {
    await expect(this.modalAbrirCaja).toBeVisible();
    await this.modalAbrirCaja.getByRole('button', { name: 'Cancelar' }).click();
    await expect(this.modalAbrirCaja).toBeHidden();
  }

  /**
   * Completa la apertura de caja desde el modal "Abrir Caja": monto en efectivo,
   * observaciones y confirmación. No hay evidencia confirmada de que el sistema
   * requiera más de una confirmación para cerrar el modal, así que se hace un único
   * click; si el modal no se cierra, la aserción de visibilidad del test debe fallar
   * para exponer la causa real (p. ej. un monto o una diferencia de efectivo no
   * contemplados) en vez de enmascararla con reintentos.
   */
  async completarAperturaCaja() {
    await expect(this.modalAbrirCaja).toBeVisible();

    await this.modalAbrirCaja.locator(L.CAJA_MONTO).first().fill('0');
    await this.modalAbrirCaja.getByPlaceholder(L.CAJA_OBSERVACION).fill('Apertura automatizada');
    await this.modalAbrirCaja.locator(L.CAJA_BTN_ABRIR).click();
  }

  /** Locator del modal "Detalle de Cierre" (cerrar caja). */
  get modalCerrarCaja() {
    return this.page.locator(L.DIALOG_CERRAR_CAJA);
  }

  /** Modal para activar las notificaciones del navegador: elemento opcional, ajeno al flujo de caja. */
  get modalNotificaciones() {
    return this.page.locator('#workshop-web-notification-permission');
  }

  /**
   * Cierra el modal de activar notificaciones si aparece. Es un elemento opcional
   * del sistema (puede o no aparecer) que puede quedar sobre el encabezado e
   * interceptar clicks; no tiene relación con ningún flujo de negocio, así que su
   * aparición o ausencia nunca debe hacer fallar el test.
   */
  async cerrarModalNotificacionesSiAparece() {
    if (await this.modalNotificaciones.isVisible().catch(() => false)) {
      await this.modalNotificaciones
        .getByRole('button', { name: 'Cerrar' })
        .first()
        .click()
        .catch(() => {});
      await expect(this.modalNotificaciones).toBeHidden().catch(() => {});
    }
  }

  /** Abre el menú "Caja" del encabezado del POS. */
  async abrirMenuCaja() {
    // El aviso de permisos de notificación del navegador puede quedar sobre el
    // encabezado e interceptar el click; se descarta aquí como parte de la propia
    // acción, sin importar el estado de la caja.
    await this.cerrarModalNotificacionesSiAparece();

    await this.page.locator(L.MENU_CAJA_BTN).click();
  }

  /**
   * Selecciona "(F12) Abrir/Cerrar Caja" del menú "Caja" ya desplegado. Este único
   * ítem muestra el modal "Abrir Caja" si la caja está cerrada, o "Detalle de
   * Cierre" si está abierta — el sistema decide cuál, no el test.
   */
  async seleccionarAbrirCerrarCaja() {
    await this.cerrarModalNotificacionesSiAparece();
    await this.page.locator('li', { hasText: L.MENU_CAJA_ITEM_F12 }).click();
  }

  /**
   * Espera a que "Abrir/Cerrar Caja (F12)" resuelva cuál de los dos modales
   * corresponde. El click solo dispara la decisión; el propio modal puede tardar
   * en aparecer, así que se corre una carrera entre ambos en vez de asumir que ya
   * está resuelta justo después del click.
   */
  async esperarResultadoMenuCaja() {
    await Promise.race([
      this.modalAbrirCaja.waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL }),
      this.modalCerrarCaja.waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL }),
    ]);
  }

  /** Indica si el modal "Detalle de Cierre" está visible en este momento (chequeo puntual, sin esperar). */
  async modalCerrarCajaVisible(): Promise<boolean> {
    return this.modalCerrarCaja.isVisible();
  }

  /**
   * Completa el formulario de cierre: efectivo en caja, efectivo para la
   * siguiente caja y observaciones. No confirma el cierre.
   */
  async completarFormularioCerrarCaja(efectivoEnCaja: string, efectivoSiguienteCaja: string, observacion: string) {
    await expect(this.modalCerrarCaja).toBeVisible();

    await this.modalCerrarCaja.locator(L.CIERRE_EFECTIVO_CAJA).fill(efectivoEnCaja);
    await this.modalCerrarCaja.locator(L.CIERRE_EFECTIVO_SIGUIENTE).fill(efectivoSiguienteCaja);
    await this.modalCerrarCaja.locator(L.CIERRE_OBSERVACION).fill(observacion);
  }

  /**
   * Confirma el cierre de caja: presiona "Cerrar Caja" y acepta el diálogo de
   * confirmación ("¿Está seguro(a) de que desea cerrar esta caja?") que el sistema
   * siempre muestra a continuación.
   *
   * El diálogo (SweetAlert v1) agrega la clase "visible" recién cuando termina su
   * animación de entrada; antes de eso su propio manejador de click no procesa la
   * confirmación (queda visible para Playwright por tamaño, pero el click no
   * dispara nada). Por eso se espera explícitamente esa clase antes de hacer click,
   * en vez de confiar en la visibilidad genérica.
   *
   * La señal de éxito real es la respuesta del propio cierre (`closePosCash`), no
   * la ventana de reporte: en un reintento (si el ciclo ya intentó cerrar antes en
   * esta misma página) el navegador puede reutilizar una ventana ya abierta en vez
   * de emitir un nuevo evento "popup", lo que dejaría la espera del popup colgada
   * para siempre aunque el cierre haya sido exitoso. Si sí aparece una ventana
   * nueva, se muestra y se cierra para volver al POS; si no aparece, el cierre
   * igualmente se considera exitoso en base a la respuesta del servidor.
   */
  async confirmarCerrarCaja() {
    const cierreConfirmadoPromise = this.page.waitForResponse(
      (res) => res.url().includes('closePosCash'),
      { timeout: TIMEOUTS.PRINT_POPUP }
    );
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP }).catch(() => null);

    // Ambos avisos opcionales se descartan ANTES de confirmar, nunca después: el
    // cierre exitoso recarga la página (confirmado inspeccionando el DOM real tras
    // el click de confirmación — "Execution context was destroyed... navigation"),
    // lo que vuelve a generar el mismo aviso de consecutivo desde cero. Intentar
    // cerrarlo después del click compite con esa recarga en vez de resolverlo.
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarAvisoConsecutivoSiAparece();
    await this.modalCerrarCaja.locator(L.CIERRE_BTN_CERRAR).click();
    await this.page.locator('.sweet-alert.visible').waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.page.locator('.sweet-alert.visible button.confirm').click();

    await cierreConfirmadoPromise;

    const printPage = await popupPromise;
    if (printPage) {
      await this.mostrarYCerrarVentanaImpresion(printPage);
    }
  }

  /** Cancela el cierre de caja cerrando el modal "Detalle de Cierre" sin confirmar. */
  async cancelarCerrarCaja() {
    await expect(this.modalCerrarCaja).toBeVisible();
    await this.modalCerrarCaja.locator(L.CIERRE_BTN_CANCELAR).click();
    await expect(this.modalCerrarCaja).toBeHidden();
  }

  /**
   * Presiona "Facturar" para abrir el modal de pago. La apertura de caja, si es
   * necesaria, solo puede ocurrir más adelante al confirmar el pago —no aquí—.
   */
  async presionarFacturar() {
    await this.page.locator(L.BTN_FACTURAR).click();
  }

  /** Espera a que el modal de pago esté listo para recibir el método de pago. */
  async esperarModalPago() {
    await this.page.locator(L.EFECTIVO_MONTO).waitFor({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.page.waitForTimeout(PAUSES.VER_MODAL);
  }

  /** Espera el primer producto visible, lo agrega al carrito y pausa para verlo. */
  async agregarPrimerProducto() {
    await this.page.locator(L.PRODUCTO).first().waitFor({ timeout: TIMEOUTS.PRODUCTS_LOAD });
    await this.page.waitForTimeout(PAUSES.VER_PRODUCTOS);
    await this.page.locator(L.PRODUCTO).first().click();
    await this.page.waitForTimeout(PAUSES.VER_CARRITO);
  }

  /** Llena el monto en efectivo y el dinero recibido. Efectivo permite superar el total. */
  async seleccionarPagoEfectivo(monto: string) {
    await this.page.locator(L.EFECTIVO_MONTO).fill(monto);
    await this.page.locator(L.EFECTIVO_RECIBIDO).fill(monto);
    await this.page.waitForTimeout(PAUSES.VER_MONTO);
  }

  /**
   * Selecciona un método de pago que requiere monto exacto (tarjeta, SINPE, transacción).
   * Lee el total de la factura desde el DOM y lo aplica al input del método indicado.
   */
  async seleccionarPagoExacto(metodo: MetodoPago) {
    // textContent vía evaluate para leer el valor aunque el elemento esté hidden
    const textoTotal = await this.page.evaluate(
      (id) => document.getElementById(id)?.textContent ?? '',
      L.TOTAL_MODAL
    );
    const monto = textoTotal.replace(/[^0-9.]/g, '');

    await this._cambiarMetodoPago(metodo.checkboxId);
    await this.page.locator(metodo.montoLocator).fill(monto);
    await this.page.waitForTimeout(PAUSES.VER_MONTO);
  }

  /** Aviso de "consecutivo de facturación fuera de rango": advertencia informativa del sistema, no bloqueante. */
  get avisoConsecutivoFueraDeRango() {
    return this.page.locator('.noty_bar').filter({ hasText: /consecutivo/i });
  }

  /**
   * Cierra el aviso de consecutivo fuera de rango si aparece (los "noty" se cierran
   * al hacer click). Es un aviso puramente informativo del sistema (no bloquea
   * ninguna acción) que puede volver a generarse por su cuenta —p. ej. tras una
   * recarga de página no relacionada—, así que ni el click ni la validación de que
   * desapareció usan aserciones duras: su reaparición no debe hacer fallar el test.
   */
  async cerrarAvisoConsecutivoSiAparece() {
    const aviso = this.avisoConsecutivoFueraDeRango;
    const aparecio = await aviso.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false);
    if (aparecio) {
      await aviso.click().catch(() => {});
      await aviso.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    }
  }

  /**
   * Presiona el botón "Facturar" del modal de pago (confirma el pago), sin esperar
   * su resultado. Es este botón —no el que abre el modal de pago— el que puede
   * mostrar el modal "Abrir Caja" si la caja está cerrada.
   */
  async presionarConfirmarPago() {
    await this.page.locator(L.BTN_CONFIRMAR).click();
  }

  /**
   * Muestra la ventana de impresión de la factura (señal de que se generó
   * correctamente) 4 segundos y la cierra para volver al POS.
   */
  async mostrarYCerrarVentanaImpresion(printPage: Page) {
    await printPage.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(PAUSES.VER_FACTURA);
    await printPage.close();
    await this.page.waitForTimeout(PAUSES.POST_CIERRE);
  }

  /** Verifica que no quedan filas en el carrito tras la venta. */
  async validarCarritoVacio() {
    const filas = await this.page.locator(L.CARRITO_FILAS).count();
    expect(filas).toBe(0);
    await this.page.waitForTimeout(PAUSES.ESTADO_FINAL);
  }

  /** Agrega el producto en la posición n del grid (0-indexed). Cierra el modal
   *  "Monto a comprar" si aparece para productos sin precio fijo. */
  async agregarProductoPorIndice(n: number) {
    await this.page.locator(L.PRODUCTO).nth(n).click();
    await this.page.waitForTimeout(1_500);
    const modalMonto = this.page.getByText('Monto a comprar', { exact: false });
    if (await modalMonto.isVisible().catch(() => false)) {
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(500);
    }
    await this.page.waitForTimeout(PAUSES.VER_CARRITO);
  }

  /** Devuelve las claves únicas de los productos actualmente en el carrito. */
  async obtenerClavesProductos(): Promise<string[]> {
    return this.page.evaluate(() =>
      [...document.querySelectorAll('#table_buy_list p[id^="drag_and_drop_"]')]
        .map(el => el.id.replace('drag_and_drop_', ''))
    );
  }

  /** Indica si el checkbox de descuento general está activo. */
  async estaDescuentoGeneralActivo(): Promise<boolean> {
    return this.page.evaluate(
      () => (document.getElementById('apply_general_discount') as HTMLInputElement)?.checked ?? false
    );
  }

  /** Desactiva el descuento general para habilitar los descuentos individuales. */
  async desactivarDescuentoGeneral() {
    if (await this.estaDescuentoGeneralActivo()) {
      await this.page.evaluate(
        () => (document.getElementById('apply_general_discount') as HTMLInputElement).click()
      );
      await this.page.waitForTimeout(1_000);
    }
  }

  /**
   * Intenta aplicar un porcentaje de descuento individual al producto indicado.
   * Maneja tres escenarios sin fallar:
   *   - El sistema no permite descuento en el producto (retorna escenario 'sin_descuento').
   *   - El porcentaje supera el máximo permitido; el sistema lo corrige (retorna 'maximo_superado').
   *   - El descuento se aplica exactamente como se pidió (retorna 'aplicado').
   * Si aparece un diálogo, lo valida, lo cierra y reintenta con el máximo extraído o 1 %.
   */
  async aplicarDescuentoIndividual(clave: string, porcentaje: string): Promise<ResultadoDescuento> {
    await this._llamarSetProductTotal(clave, porcentaje);
    await this.page.waitForTimeout(PAUSES.CAMPO_HABILITADO);

    const mensajeAlerta = await this._leerYCerrarAlerta();
    let porcentajeAplicado = await this._leerValorDescuentoInput(clave);

    if (mensajeAlerta) {
      const pctActual = parseFloat(porcentajeAplicado);
      const pctSolicitado = parseFloat(porcentaje);

      if (pctActual === 0) {
        // El sistema rechazó el descuento completamente.
        return { clave, porcentajeSolicitado: porcentaje, porcentajeAplicado: '0', escenario: 'sin_descuento', mensajeAlerta };
      }

      if (pctActual >= pctSolicitado) {
        // El sistema mostró un diálogo pero no corrigió el input: intentar con el máximo del mensaje.
        const match = mensajeAlerta.match(/(\d+(?:[.,]\d+)?)\s*%/);
        const retryPct = match ? match[1].replace(',', '.') : '1';
        await this._llamarSetProductTotal(clave, retryPct);
        await this.page.waitForTimeout(PAUSES.CAMPO_HABILITADO);
        await this._leerYCerrarAlerta();
        porcentajeAplicado = await this._leerValorDescuentoInput(clave);

        if (parseFloat(porcentajeAplicado) === 0) {
          return { clave, porcentajeSolicitado: porcentaje, porcentajeAplicado: '0', escenario: 'sin_descuento', mensajeAlerta };
        }
      }
    }

    const pctAplicado = parseFloat(porcentajeAplicado);
    const pctSolicitado = parseFloat(porcentaje);
    const escenario: EscenarioDescuento =
      pctAplicado <= 0               ? 'sin_descuento'  :
      pctAplicado < pctSolicitado - 0.01 ? 'maximo_superado' :
                                        'aplicado';

    await this.page.waitForTimeout(PAUSES.VER_MONTO);
    return { clave, porcentajeSolicitado: porcentaje, porcentajeAplicado, escenario, mensajeAlerta: mensajeAlerta ?? undefined };
  }

  /** Lee el total de una línea del carrito como número. */
  async obtenerTotalProducto(clave: string): Promise<number> {
    const texto = await this.page.locator(`#total_by_product_${clave}`).textContent() ?? '0';
    return parseFloat(texto.replace(/[^0-9.]/g, '')) || 0;
  }

  /** Lee el subtotal base del carrito como número (no refleja descuentos individuales). */
  async obtenerSubtotalNumerico(): Promise<number> {
    const texto = await this.page.locator(L.TOTAL_SUB).textContent() ?? '$0.00';
    return parseFloat(texto.replace(/[^0-9.]/g, '')) || 0;
  }

  /** Lee el total final de venta como número (sí refleja descuentos individuales). */
  async obtenerTotalVentaNumerico(): Promise<number> {
    const texto = await this.page.evaluate(
      (id) => document.getElementById(id)?.textContent ?? '$0.00',
      L.TOTAL_MODAL
    );
    return parseFloat(texto.replace(/[^0-9.]/g, '')) || 0;
  }

  /** Pago mixto: activa tarjeta manteniendo efectivo, luego llena ambos montos. */
  async seleccionarPagoMixto(montoTarjeta: string, montoEfectivo: string) {
    await this.page.evaluate(
      (id) => (document.getElementById(id) as HTMLInputElement).click(),
      CHECKBOX_ID.TARJETA
    );
    await this.page.waitForTimeout(PAUSES.CAMPO_HABILITADO);
    await this.page.locator('#payment_credit_card_total').fill(montoTarjeta);
    await this.page.getByPlaceholder('Referencia pago en tarjeta').fill('AUTOMATIZADO');
    await this.page.locator(L.EFECTIVO_MONTO).fill(montoEfectivo);
    await this.page.waitForTimeout(PAUSES.VER_MONTO);
  }

  // ─── Métodos privados ────────────────────────────────────────────────────────

  private async _llamarSetProductTotal(clave: string, porcentaje: string) {
    await this.page.evaluate(
      ({ key, value }) => {
        const el = document.getElementById(`input_product_discount_${key}`) as HTMLInputElement;
        if (el) el.value = value;
        (window as any).set_product_total(key);
      },
      { key: clave, value: porcentaje }
    );
  }

  private async _leerValorDescuentoInput(clave: string): Promise<string> {
    return this.page.evaluate(
      (key) => (document.getElementById(`input_product_discount_${key}`) as HTMLInputElement)?.value ?? '0',
      clave
    );
  }

  /**
   * Detecta y cierra un diálogo de alerta (SweetAlert2 o Bootstrap modal visible).
   * Devuelve el texto completo del diálogo, o null si no había ninguno.
   */
  private async _leerYCerrarAlerta(): Promise<string | null> {
    // SweetAlert2
    const swal2 = this.page.locator('.swal2-popup');
    if (await swal2.isVisible().catch(() => false)) {
      const titulo  = await this.page.locator('.swal2-title').textContent().catch(() => '') ?? '';
      const cuerpo  = await this.page.locator('.swal2-html-container, .swal2-content').first().textContent().catch(() => '') ?? '';
      const texto   = `${titulo} ${cuerpo}`.trim();
      const btnOk   = this.page.locator('.swal2-confirm');
      if (await btnOk.isVisible().catch(() => false)) {
        await btnOk.click();
      } else {
        await this.page.keyboard.press('Escape');
      }
      await this.page.waitForTimeout(PAUSES.VER_MODAL);
      return texto || null;
    }

    // Bootstrap modal (si el framework usa uno en lugar de SweetAlert2)
    const modalBody = await this.page.evaluate(() => {
      const modal = [...document.querySelectorAll('.modal')].find(
        m => window.getComputedStyle(m).display !== 'none'
      );
      if (!modal) return null;
      const titulo = modal.querySelector('.modal-title')?.textContent?.trim() ?? '';
      const cuerpo = modal.querySelector('.modal-body')?.textContent?.trim() ?? '';
      return `${titulo} ${cuerpo}`.trim() || null;
    });
    if (modalBody) {
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(PAUSES.VER_MODAL);
      return modalBody;
    }

    return null;
  }

  /**
   * Cambia el método activo de efectivo (predeterminado) al indicado.
   * Usa evaluate() porque los checkboxes tienen slider CSS y están fuera del viewport.
   */
  private async _cambiarMetodoPago(checkboxId: string) {
    await this.page.evaluate(
      (id) => (document.getElementById(id) as HTMLInputElement).click(),
      CHECKBOX_ID.EFECTIVO
    );
    await this.page.waitForTimeout(PAUSES.CHECKBOX_ACTIVACION);

    await this.page.evaluate(
      (id) => (document.getElementById(id) as HTMLInputElement).click(),
      checkboxId
    );
    await this.page.waitForTimeout(PAUSES.CAMPO_HABILITADO);
  }
}
