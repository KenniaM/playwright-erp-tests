import { expect, Locator, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  CARGA:    15_000,
} as const;

// ─── URLs ─────────────────────────────────────────────────────────────────────

export const URL_PANEL_GASTOS = BASE_URL + '/expense/expense';
export const URL_AGREGAR_GASTO = BASE_URL + '/expense/expenseInvoice';

// ─── Page Object: Compras > Agregar gastos ─────────────────────────────────
//
// "Panel de Gastos" (`/expense/expense`, botón "Agregar" del sidebar
// "Compras") — analizado en vivo (ambiente qa_restaurant, compañía
// "Restaurante Rancho Robertos"; scripts de investigación descartados tras
// extraer la evidencia):
//
// - El listado (`/expense/expense`) tiene: buscador (`#invoice_search`),
//   rango de fechas (`#start_date`/`#end_date`), botón "Agregar"
//   (`#add_purchase`, un <a href> real que NAVEGA a `/expense/expenseInvoice`
//   — NO abre un modal) y botón "Abonar" (`#add_payment_btn`, no investigado
//   en esta sesión — fuera de alcance). La tabla real de la lista tiene las
//   columnas #Factura/Proveedor/Fecha/Tipo Compra/Estado/Servicio/
//   Subservicio/Descuento/IVA/Subtotal/Total/Pago Inicial/Saldo.
// - El formulario "Agregar gasto" (`/expense/expenseInvoice`) es una
//   FACTURA DE GASTO A PROVEEDOR completa, con: Factura/Guía, Tipo de
//   Gasto/Tipo de Servicio (Chosen — botón "+" real junto a cada uno para
//   crear una opción nueva si el catálogo no tiene ninguna, ver
//   `crearTipoGastoNuevo()`), Asignar Proveedor (Chosen — un único
//   proveedor real en este ambiente: "Proveedor 1"), Fecha de Facturación,
//   Cuenta Bancaria Origen + "Transferencia entre cuentas" (revela
//   Empresa/Cuenta Bancaria Destino), Moneda (Chosen — 5 monedas reales:
//   CRC/USD/EUR/HNL/MXN) + Tipo de cambio, tipo de pago Contado/Crédito
//   (checkboxes — Crédito revela Días de Plazo/Fecha de Inicio/Fecha de
//   Caducidad/Pago Inicial), Monto, Descuento General (%), "¿Aplicar
//   Impuesto?" (revela Tarifa de Impuesto, 15 tarifas reales configuradas),
//   "¿Agregar Productos?" (oculta Monto/Impuesto y revela una tabla de
//   líneas de texto libre — Nombre/Cantidad/IVA/Precio/Descuento/Total,
//   ver el bloque "Modo ¿Agregar Productos?" más abajo para el detalle
//   completo con evidencia) y Observaciones.
//
// CORRECCIÓN de un falso "bug de sistema" documentado en una sesión previa
// (leer `js/expense.js` real, `curl` directo — ver el handler real de
// `#save_purchase` y `validate_invoice_detail()`): el botón "Guardar" SÍ es
// funcional — confirmado en vivo creando un gasto real de punta a punta
// (`addExpense` respondió 200/"1", SweetAlert "¡Agregado! La factura ha
// sido agregada correctamente!"). La sesión previa concluyó "no funcional"
// porque nunca llenaba el campo obligatorio **"Tipo de Gasto"**
// (`#expense_type`) — `validate_invoice_detail()` lo exige junto con
// Proveedor/Moneda/Tipo de cambio/Fecha/Monto, y si CUALQUIERA falla, el
// handler de `#save_purchase` tiene un `else {}` completamente VACÍO: no
// dispara ningún SweetAlert2, `.noty_bar`, request de red ni cambio de URL
// — el único efecto real es una clase CSS `.error` + scroll automático al
// primer campo inválido (`markAsInvalid()`/`highlightAndScrollToElement()`),
// invisible para cualquier verificación que solo mire red/toasts/URL como
// hacía la sesión anterior. Es UX pobre del lado de la app (falta de
// feedback), no un botón roto. `guardarGasto()` es el flujo real completo
// (Guardar → confirmar SweetAlert "¿Está seguro de procesar esta compra?" →
// esperar `addExpense` → SweetAlert de éxito/error).
export class ComprasAgregarGastosPage {
  constructor(private readonly page: Page) {}

  // ─── Listado (Panel de Gastos) ───────────────────────────────────────
  private readonly buscadorListado = () => this.page.locator('#invoice_search');
  private readonly fechaInicialListado = () => this.page.locator('#start_date');
  private readonly fechaFinalListado = () => this.page.locator('#end_date');
  private readonly btnBuscarListado = () => this.page.locator('#btn_search');
  private readonly btnAgregar = () => this.page.locator('#add_purchase');
  private readonly btnAbonar = () => this.page.locator('#add_payment_btn');

  async abrirPanelGastos() {
    await this.page.goto(URL_PANEL_GASTOS, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await this.cerrarBannerNotificaciones();
  }

  /**
   * El banner "Activar notificaciones" puede reaparecer de forma asíncrona
   * justo antes del click (mismo patrón ya documentado en otras partes de
   * la suite, p. ej. `PosCore.abrirProductoRapido()`) — `abrirPanelGastos()`
   * ya lo cierra una vez al cargar, pero eso no garantiza que siga cerrado
   * para este segundo click. Reintento acotado cerrando el banner antes de
   * cada intento, en vez de un único click con timeout largo.
   */
  async irAAgregarGasto() {
    const MAX_INTENTOS = 5;
    let clickeado = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !clickeado; intento++) {
      await this.cerrarBannerNotificaciones();
      clickeado = await this.btnAgregar()
        .click({ timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
    }
    expect(clickeado, `El botón "Agregar" no se pudo clickear tras ${MAX_INTENTOS} intentos`).toBe(true);

    await this.page.waitForURL(/expenseInvoice/, { timeout: TIMEOUTS.NAVIGATE });
    await this.cerrarBannerNotificaciones();
  }

  botonAbonarVisible(): Promise<boolean> {
    return this.btnAbonar().isVisible();
  }

  // ─── Formulario "Agregar gasto" ──────────────────────────────────────

  private readonly campoFactura = () => this.page.locator('#purchase_invoice');
  private readonly campoGuia = () => this.page.locator('#purchase_guide');
  private readonly campoFechaFacturacion = () => this.page.locator('#purchase_date');
  private readonly checkboxContado = () => this.page.locator('#is_contado');
  private readonly checkboxCredito = () => this.page.locator('#is_credit');
  private readonly campoMonto = () => this.page.locator('#expense_amount');
  private readonly campoDescuentoGeneral = () => this.page.locator('#purchase_discount');
  private readonly checkboxAplicarDescuento = () => this.page.locator('#apply_general_discount');
  private readonly checkboxAplicarImpuesto = () => this.page.locator('#search_product_apply_tax');
  private readonly checkboxAgregarProductos = () => this.page.locator('#search_product_has_items');
  private readonly campoObservaciones = () => this.page.locator('#purchase_comment');
  private readonly campoTipoCambio = () => this.page.locator('#expense_currency_exchange');
  private readonly btnGuardar = () => this.page.locator('#save_purchase');
  private readonly btnLimpiar = () => this.page.locator('#cancel_purchase');
  private readonly campoTipoGasto = () => this.page.locator('#expense_type');
  private readonly btnAgregarTipoGasto = () => this.page.locator('#add_expense_type');
  private readonly modalAgregarTipoGasto = () => this.page.locator('#dialog_add_expense_type');
  private readonly campoNombreTipoGastoModal = () => this.page.locator('#md_expense_name');
  private readonly contenedorTablaProductos = () => this.page.locator('#product_table_content');
  private readonly filasProducto = () => this.page.locator('#table_body_products_content > tr');
  private readonly btnAgregarFilaProducto = () => this.page.locator('a.pdt-btn-add-product');
  private readonly subtotalHide = () => this.page.locator('#subtotal_hide');
  private readonly totalHide = () => this.page.locator('#total_hide');

  async llenarFactura(texto: string) {
    await this.campoFactura().fill(texto);
  }

  async llenarFechaFacturacion(fechaISO: string) {
    await this.campoFechaFacturacion().fill(fechaISO);
  }

  /** Selecciona una opción real de un Chosen por su texto visible (widget jQuery Chosen estándar de este ERP). */
  async seleccionarChosenPorTexto(idSelectReal: string, texto: string) {
    const contenedor = `#${idSelectReal}_chosen`;
    const trigger = this.page.locator(`${contenedor} .chosen-single`);
    await expect(trigger, `El Chosen "${idSelectReal}" nunca quedó visible`).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await trigger.click();
    const opcion = this.page.locator(`${contenedor} .chosen-results li`, { hasText: texto });
    await expect(opcion, `El Chosen "${idSelectReal}" no tiene ninguna opción real con el texto "${texto}"`).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await opcion.click();
  }

  /** Devuelve las opciones reales (texto) disponibles en un Chosen, sin seleccionar ninguna — útil para confirmar catálogos vacíos. */
  async obtenerOpcionesRealesDeSelect(idSelectReal: string): Promise<string[]> {
    return this.page.locator(`#${idSelectReal} option:not([value=""])`).allInnerTexts();
  }

  async seleccionarProveedor(nombre: string) {
    await this.seleccionarChosenPorTexto('purchase_provider', nombre);
  }

  async seleccionarMoneda(codigoOrTexto: string) {
    await this.seleccionarChosenPorTexto('expense_currency_select', codigoOrTexto);
  }

  /** Selecciona un "Tipo de Gasto" ya existente en el catálogo, por su texto real. */
  async seleccionarTipoGasto(texto: string) {
    await this.seleccionarChosenPorTexto('expense_type', texto);
  }

  /**
   * Crea un "Tipo de Gasto" nuevo real vía el botón "+" (`#add_expense_type`
   * → modal `#dialog_add_expense_type` → `addExpenseType`) y lo deja
   * seleccionado (la app misma lo selecciona tras guardarlo). Nunca asume
   * un nombre fijo — recibe el nombre a usar (normalmente generado con
   * `Date.now()` por el llamador, ver [[feedback_tests_no_dependen_nombre_especifico]]).
   */
  async crearTipoGastoNuevo(nombre: string) {
    await this.btnAgregarTipoGasto().click();
    await expect(this.modalAgregarTipoGasto(), 'El modal "Agregar Tipo de Gasto" no apareció').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await this.campoNombreTipoGastoModal().fill(nombre);
    await this.modalAgregarTipoGasto().locator('button', { hasText: /guardar/i }).click();
    await expect(this.modalAgregarTipoGasto(), 'El modal "Agregar Tipo de Gasto" no se cerró tras guardar').toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Garantiza que "Tipo de Gasto" quede seleccionado con una opción REAL:
   * usa la primera opción real ya existente en el catálogo si hay alguna
   * (nunca un nombre fijo), o crea una nueva vía `crearTipoGastoNuevo()` si
   * el catálogo está vacío (solo el placeholder "Seleccionar Tipo de
   * Gasto"). Devuelve el texto real que quedó seleccionado.
   */
  async asegurarTipoGastoSeleccionado(): Promise<string> {
    const opciones = await this.campoTipoGasto().locator('option').evaluateAll((els) =>
      els
        .map((e) => ({ value: (e as HTMLOptionElement).value, text: (e.textContent ?? '').trim() }))
        .filter((o) => o.value !== '' && o.value !== '0')
    );
    if (opciones.length > 0) {
      await this.seleccionarTipoGasto(opciones[0].text);
      return opciones[0].text;
    }
    const nombreNuevo = `QA Tipo de Gasto ${Date.now()}`;
    await this.crearTipoGastoNuevo(nombreNuevo);
    return nombreNuevo;
  }

  async marcarContado() {
    await this.checkboxContado().check({ force: true });
  }

  async marcarCredito() {
    await this.checkboxCredito().check({ force: true });
  }

  /**
   * Bug de automatización real corregido en vivo: `#expense_amount` tiene
   * `onkeyup="set_new_total()"` (confirmado leyendo el HTML real del
   * elemento) — `.fill()` de Playwright NO dispara `keyup`, así que
   * `#total_hide` (el campo real que `add_purchase()` envía como `total`)
   * quedaba en "0.0000" pese al Monto llenado correctamente en pantalla.
   * Confirmado en vivo: un gasto guardado sin este fix mostraba "¡Agregado!"
   * (éxito) pero quedaba persistido con Total 0 — el SweetAlert de éxito
   * NO garantiza que el monto real se haya guardado correctamente. Se
   * invoca `set_new_total()` explícitamente tras `.fill()`, mismo criterio
   * ya usado para las líneas de producto (`llenarFilaProducto()`).
   */
  async llenarMonto(monto: string) {
    await this.campoMonto().fill(monto);
    await this.page.evaluate(() => (window as any).set_new_total());
  }

  async llenarObservaciones(texto: string) {
    await this.campoObservaciones().fill(texto);
  }

  async obtenerTipoCambio(): Promise<string> {
    return this.campoTipoCambio().inputValue();
  }

  /**
   * Presiona "Guardar" con el formulario deliberadamente incompleto (algún
   * campo obligatorio de `validate_invoice_detail()` sin llenar) y reporta
   * si produjo algún efecto observable por red/SweetAlert2/`.noty_bar`/URL.
   * Confirmado en vivo (ver el encabezado de esta clase): cuando la
   * validación client-side falla, el handler de `#save_purchase` tiene un
   * `else {}` vacío — no dispara NINGUNO de estos efectos, el único rastro
   * real es la clase CSS `.error` en el campo inválido (ver
   * `campoTieneErrorValidacion()`). Este método sirve para documentar ESE
   * comportamiento silencioso de validación, nunca para "probar que Guardar
   * está roto" — con el formulario completo, usar `guardarGasto()`.
   */
  async presionarGuardarYObservarEfecto(): Promise<{ huboRequest: boolean; huboSwal: boolean; huboNoty: boolean; urlCambio: boolean }> {
    const urlAntes = this.page.url();
    let huboRequest = false;
    const listener = () => { huboRequest = true; };
    this.page.on('request', listener);

    await this.btnGuardar().scrollIntoViewIfNeeded();
    await this.btnGuardar().click();

    // Espera activa y acotada a que ocurra CUALQUIER efecto real (request o
    // cambio de URL) — nunca un tiempo fijo: si nunca ocurre nada (el
    // hallazgo real confirmado en vivo), el poll simplemente agota su
    // timeout y este método sigue de largo para que el test lea el estado
    // final tal cual quedó.
    await expect.poll(() => huboRequest || this.page.url() !== urlAntes, { timeout: 5_000 }).toBe(true).catch(() => {});

    this.page.off('request', listener);

    const huboSwal = await this.page.locator('.swal2-popup').isVisible().catch(() => false);
    const huboNoty = await this.page.locator('.noty_bar').isVisible().catch(() => false);
    const urlCambio = this.page.url() !== urlAntes;

    return { huboRequest, huboSwal, huboNoty, urlCambio };
  }

  /** Confirma si el campo real (id sin "#") quedó marcado inválido por `validate_invoice_detail()` (clase CSS `.error`). */
  async campoTieneErrorValidacion(idSelectorReal: string): Promise<boolean> {
    return this.page.locator(idSelectorReal).evaluate((el) => el.classList.contains('error'));
  }

  /**
   * Flujo REAL completo de "Guardar" con el formulario ya válido: presiona
   * `#save_purchase`, confirma el SweetAlert "¿Está seguro de procesar esta
   * compra?" (real, aparece SOLO si `validate_invoice_detail()` pasó),
   * espera la respuesta real de `addExpense` y lee el SweetAlert final
   * (éxito "¡Agregado! La factura ha sido agregada correctamente!" o error
   * real — número de factura duplicado, etc.), cerrándolo con su botón.
   * Confirmado en vivo de punta a punta (capturas + respuesta 200/"1").
   */
  async guardarGasto(): Promise<{ exito: boolean; mensaje: string }> {
    const respuestaPromise = this.page.waitForResponse((res) => res.url().includes('addExpense'), { timeout: TIMEOUTS.CARGA });

    await this.btnGuardar().scrollIntoViewIfNeeded();
    await this.btnGuardar().click();

    const confirmacion = this.page.locator('.swal2-popup, .sweet-alert');
    await expect(confirmacion, 'No apareció el SweetAlert de confirmación "¿Está seguro de procesar esta compra?" — revisar si algún campo obligatorio quedó sin llenar').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await confirmacion.locator('button', { hasText: /procesar/i }).click();

    await respuestaPromise;

    const resultado = this.page.locator('.swal2-popup, .sweet-alert');
    await expect(resultado).toBeVisible({ timeout: TIMEOUTS.CARGA });
    const titulo = (await resultado.locator('h2, .swal2-title, .sweet-alert h2').innerText().catch(() => '')).trim();
    const exito = /agregad/i.test(titulo);
    await resultado.locator('button', { hasText: /ok|aceptar/i }).click();

    return { exito, mensaje: titulo };
  }

  // ─── Modo "¿Agregar Productos?" (líneas de producto en vez de Monto libre) ──
  //
  // Investigado en vivo leyendo `js/expense.js` real: al activar
  // `#search_product_has_items`, la app OCULTA "Monto"/"¿Aplicar Impuesto?"
  // y muestra una tabla de líneas libres (`ProductItemList`, `set_new_total()`
  // usa `calculateProductItemsList()` en vez de `calculateSingleAmount()`).
  // No es un buscador de inventario — cada línea es texto libre: "Nombre"
  // (input, id `product_item_list_name_<n>`), "Cant." (`product_item_list_qty_id_<n>`,
  // default "1"), "IVA" (Chosen), "Precio Unid" (`product_item_list_price_id_<n>`),
  // "Descuento %" (`product_item_list_discount_id_<n>`), "Total" (autocalculado).
  // Este ambiente además muestra "Centro de Costo"/"Detalle Cuenta" (Chosen,
  // módulo contable activo) ANTES de "Nombre" — comparten el prefijo de id
  // `product_item_list_name_` con el input real de texto libre
  // (`product_item_list_name_id_<n>` el Chosen vs. `product_item_list_name_<n>`
  // el input), por eso todo selector de "Nombre" debe filtrar por el tag
  // `input`, nunca solo el prefijo del id (confirmado en vivo: sin el filtro
  // por tag, Playwright resuelve el `<select>` oculto de Chosen y `.fill()`
  // queda esperando indefinidamente su propia accionabilidad).
  //
  // BUG DE AUTOMATIZACIÓN real descubierto y corregido en el camino:
  // `.fill()` de Playwright en Precio/Cantidad NO dispara el `keyup` real
  // del que depende `onkeyup="set_item_total(<n>)"` (confirmado en vivo:
  // tras `.fill()`, "Total" de la fila y el Subtotal general quedaban en 0
  // pese a que el gasto se guardaba igual, con montos en cero) — hay que
  // invocar `set_item_total(<n>)` explícitamente vía `evaluate()` tras
  // llenar cada campo (mismo criterio que otros casos de este repo donde un
  // handler legacy no reacciona a eventos sintéticos, ver `guardarGasto()`).

  /**
   * Activa "¿Agregar Productos?" — el checkbox real tiene bounding box
   * 0×0 (patrón Material Design Lite con un `<label>` visual aparte),
   * confirmado en vivo que ni `.click({force:true})` ni `.check({force:true})`
   * logran clickearlo ("Element is outside of the viewport" incluso
   * forzado) — se activa marcando `checked` y disparando el evento `change`
   * real del que depende `set_product_has_items()`.
   */
  async activarAgregarProductos() {
    await this.checkboxAgregarProductos().evaluate((el) => {
      (el as HTMLInputElement).checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(this.contenedorTablaProductos(), 'La tabla de líneas de producto no quedó visible').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await expect(this.filasProducto().first(), 'No se agregó la primera fila automática de producto').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async contarFilasProducto(): Promise<number> {
    return this.filasProducto().count();
  }

  /** Agrega una fila nueva de producto (botón real "+ Agregar Producto") y devuelve su índice (0-based). */
  async agregarFilaProducto(): Promise<number> {
    const antes = await this.contarFilasProducto();
    await this.btnAgregarFilaProducto().click();
    await expect.poll(() => this.contarFilasProducto(), { timeout: TIMEOUTS.CARGA }).toBe(antes + 1);
    return antes;
  }

  /** Extrae el contador real (`product_item_list_<n>`) de la fila visible en el índice dado (0-based). */
  private async contadorRealDeFila(indice: number): Promise<number> {
    const id = await this.filasProducto().nth(indice).getAttribute('id');
    const match = id?.match(/product_item_list_(\d+)/);
    if (!match) throw new Error(`No se pudo leer el contador real de la fila de producto en el índice ${indice} (id="${id}")`);
    return Number(match[1]);
  }

  /**
   * Llena una línea de producto ya existente (0-based, ver `agregarFilaProducto()`
   * para filas adicionales — la primera ya existe automáticamente tras
   * `activarAgregarProductos()`) y dispara `set_item_total()` explícitamente
   * (ver el hallazgo del encabezado — `.fill()` no dispara el `keyup` real).
   */
  async llenarFilaProducto(indice: number, datos: { nombre: string; cantidad: number; precio: number; descuento?: number }) {
    const n = await this.contadorRealDeFila(indice);
    await this.page.locator(`input#product_item_list_name_${n}`).fill(datos.nombre);
    await this.page.locator(`#product_item_list_qty_id_${n}`).fill(String(datos.cantidad));
    await this.page.locator(`#product_item_list_price_id_${n}`).fill(String(datos.precio));
    if (datos.descuento !== undefined) {
      await this.page.locator(`#product_item_list_discount_id_${n}`).fill(String(datos.descuento));
    }
    await this.page.evaluate((id) => (window as any).set_item_total(id), n);
  }

  /** Total real ya calculado de la línea (0-based) — numérico. */
  async obtenerTotalFilaProducto(indice: number): Promise<number> {
    const n = await this.contadorRealDeFila(indice);
    const valor = await this.page.locator(`#product_item_list_total_id_${n}`).inputValue();
    return parseFloat(valor) || 0;
  }

  async obtenerSubtotalGeneral(): Promise<number> {
    return parseFloat((await this.subtotalHide().innerText()).replace(/[^\d.-]/g, '')) || 0;
  }

  async obtenerTotalGeneral(): Promise<number> {
    return parseFloat((await this.totalHide().innerText()).replace(/[^\d.-]/g, '')) || 0;
  }

  async validarSinErrores() {
    await expect(this.page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  }

  private async cerrarBannerNotificaciones() {
    await this.page.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 3_000 }).catch(() => {});
  }
}
