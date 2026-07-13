import { expect, Locator, Page } from '@playwright/test';

// ─── URL ──────────────────────────────────────────────────────────────────────

export const COMISIONES_URL =
  'https://dev.designsoftcr.com/qa_talleralpha/public/route/adminCommission';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:       60_000,
  NAVIGATE:   60_000,
  // La tabla de comisiones se popula vía AJAX tras cargar la página y puede
  // tardar en aparecer — se hace polling hasta este límite antes de leer
  // el estado del módulo.
  TABLE_LOAD: 15_000,
} as const;

// ─── Locators ─────────────────────────────────────────────────────────────────

const L = {
  TABLA:                  '#table_products',
  CUERPO_TABLA:           '#commission_content',
  BTN_MENU_ACCIONES:      'button.mdl-button--icon',
  DIALOG_COMISION:        '#dialog_add_commission',
  INPUT_MONTO:            '#modal_input_commission_amount',
  SWEET_ALERT:            '.sweet-alert.visible',
  // El nombre del tipo de documento vive en un <p id="document_type_id_{id}">
  // dedicado dentro de cada fila.
  NOMBRE_DOCUMENTO:       'p[id^="document_type_id_"]',
} as const;

// ─── Page Object ──────────────────────────────────────────────────────────────

export class ComisionPage {
  constructor(private readonly page: Page) {}

  get tabla() {
    return this.page.locator(L.TABLA);
  }

  get modalComision() {
    return this.page.locator(L.DIALOG_COMISION);
  }

  get inputMonto() {
    return this.modalComision.locator(L.INPUT_MONTO);
  }

  /** Botón "Guardar" del modal "Agregar comisión". */
  get botonGuardar() {
    return this.modalComision.locator('button', { hasText: /guardar/i });
  }

  /**
   * Filas de datos reales de la tabla (una por tipo de documento electrónico:
   * Factura Electrónica, Tiquete Electrónico, etc). Se identifican por el
   * badge "Tipo comisión" que acompaña a cada una.
   */
  get filasComision(): Locator {
    return this.page.locator(L.CUERPO_TABLA).locator('tr').filter({ hasText: /tipo comisi/i });
  }

  /** Único punto de entrada al módulo Admin. Comisiones. */
  async irAComisiones() {
    await this.page.goto(COMISIONES_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }

  /**
   * Espera hasta que la tabla de comisiones tenga al menos una fila real
   * cargada vía AJAX, en vez de asumir que ya están presentes apenas navega
   * la página.
   */
  async esperarFilasCargadas() {
    await expect
      .poll(() => this.filasComision.count(), { timeout: TIMEOUTS.TABLE_LOAD })
      .toBeGreaterThan(0);
  }

  /** Fila correspondiente a un tipo de documento por nombre (p.ej. "Factura Electrónica"). */
  filaDocumento(nombreDocumento: string): Locator {
    return this.filasComision.filter({ hasText: nombreDocumento });
  }

  /** Nombre del tipo de documento de una fila. */
  async nombreDocumento(fila: Locator): Promise<string> {
    return ((await fila.locator(L.NOMBRE_DOCUMENTO).textContent()) ?? '').trim();
  }

  /** Valor de la comisión de una fila ("N/A" o un número), leído del badge "Valor: X". */
  async valorComision(fila: Locator): Promise<string | null> {
    const texto = await fila.textContent();
    const match = texto?.match(/Valor:\s*([\d.,]+|N\/A)/i);
    return match ? match[1] : null;
  }

  /** Abre el menú de acciones de una fila y hace clic en "Editar Comision". */
  async abrirModalEditar(fila: Locator) {
    await fila.locator(L.BTN_MENU_ACCIONES).click();
    await fila.getByRole('link', { name: /editar comisi/i }).click();
    await expect(this.modalComision).toBeVisible({ timeout: TIMEOUTS.TABLE_LOAD });
  }

  /** Ingresa el monto de la comisión y guarda. */
  async guardarMonto(monto: number) {
    await this.inputMonto.fill(String(monto));
    await this.botonGuardar.click();
    await this.cerrarAlertaConfirmacion();
  }

  /** Cierra el sweet-alert de confirmación que aparece tras guardar, si aparece. */
  async cerrarAlertaConfirmacion() {
    const alerta = this.page.locator(L.SWEET_ALERT);
    if (await alerta.isVisible({ timeout: TIMEOUTS.TABLE_LOAD }).catch(() => false)) {
      await alerta.locator('button.confirm').click();
    }
  }
}
