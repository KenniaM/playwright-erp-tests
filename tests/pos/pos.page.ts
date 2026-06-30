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

  // Apertura de caja
  CAJA_TEXTO:       'Caja: Cerrada',
  CAJA_BTN_ABRIR:   '#btn_open_cash',
  CAJA_MONTO:       'input[placeholder="0.00"]',
  CAJA_OBSERVACION: 'Ingrese sus observaciones aquí',
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

  /** Navega al POS y abre la caja si el modal aparece. */
  async navegar() {
    await this.page.goto(POS_URL, { waitUntil: 'commit', timeout: TIMEOUTS.NAVIGATE });
    await this._abrirCajaSiEstaCerrada();
  }

  /** Espera el primer producto visible, lo agrega al carrito y pausa para verlo. */
  async agregarPrimerProducto() {
    await this.page.locator(L.PRODUCTO).first().waitFor({ timeout: TIMEOUTS.PRODUCTS_LOAD });
    await this.page.waitForTimeout(PAUSES.VER_PRODUCTOS);
    await this.page.locator(L.PRODUCTO).first().click();
    await this.page.waitForTimeout(PAUSES.VER_CARRITO);
  }

  /**
   * Abre el modal de pago.
   * Usa #payment_cash_total como señal de apertura porque #total_sale_txt
   * puede estar hidden durante el render inicial del modal.
   */
  async abrirModalPago() {
    await this.page.locator(L.BTN_FACTURAR).click();
    await this.page.locator(L.EFECTIVO_MONTO).waitFor({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.page.waitForTimeout(PAUSES.VER_MODAL);
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

  /**
   * Confirma la factura, espera la ventana de impresión, la muestra 4 segundos
   * y la cierra para volver al POS.
   */
  async confirmarFactura() {
    const [printPage] = await Promise.all([
      this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP }),
      this.page.locator(L.BTN_CONFIRMAR).click(),
    ]);
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

  private async _abrirCajaSiEstaCerrada() {
    // Escenario 1: caja cerrada (apertura normal)
    const modalCerrada = this.page.getByText(L.CAJA_TEXTO);
    if (await modalCerrada.isVisible().catch(() => false)) {
      await this.page.locator(L.CAJA_MONTO).fill('0');
      await this.page.getByPlaceholder(L.CAJA_OBSERVACION).fill('Apertura automatizada');
      await this.page.locator(L.CAJA_BTN_ABRIR).click();
      await this.page.waitForTimeout(2_000);
      return;
    }

    // Escenario 2: modal de apertura con discrepancia de efectivo (#dialog_cash_opening visible)
    const dialogApertura = this.page.locator('#dialog_cash_opening');
    if (await dialogApertura.isVisible().catch(() => false)) {
      const montoInput = dialogApertura.locator('input[placeholder="0.00"]').first();
      if (await montoInput.isVisible().catch(() => false)) {
        await montoInput.fill('0');
      }
      const obsInput = dialogApertura.locator('textarea, input[type="text"]').last();
      if (await obsInput.isVisible().catch(() => false)) {
        await obsInput.fill('Apertura automatizada');
      }
      await this.page.locator(L.CAJA_BTN_ABRIR).click();
      await this.page.waitForTimeout(2_000);
    }
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
