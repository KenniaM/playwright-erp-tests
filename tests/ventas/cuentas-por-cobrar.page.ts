import { expect, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';

// Page Object dedicado al submódulo "Cuentas por Cobrar" (Ventas).
//
// HALLAZGO MAYOR investigado en vivo (2026-08-08): esta pantalla fue
// REDISEÑADA POR COMPLETO por la propia aplicación (componente nuevo
// "acr-v2" — Account Credit Row v2) desde la última vez que se investigó
// este flujo (ver memoria `abono_flow_investigation.md`, ~4 días antes de
// esta sesión): la lista de clientes YA NO usa `div.brand-card`/botón
// "Abonar" — hoy es una tabla real (`table.acr-v2-table`) con una fila por
// cliente y un menú de acciones propio por fila (dropdown Bootstrap
// estándar) cuyo único ítem es "Gestionar facturas, saldos y abonos"
// (`[data-action="manage-account"]`). Ese ítem abre un modal con la lista de
// facturas pendientes del cliente (`table.acr-v2-payment-table`), y CADA
// factura tiene su propio menú de acciones (mismo patrón dropdown) con
// "Registrar abono" (`[data-action="pay-invoice"]`), que a su vez abre el
// modal final de pago.
//
// Ese modal final (`.credit-payment-redesign-modal`) SÍ reutiliza,
// confirmado en vivo campo por campo, los mismos ids que el flujo legado ya
// documentado (`is_payment_cash`/`payment_cash_total`/`add_credit_payment_btn`/
// `add_payment()`/POST a `addPosSalesCreditInvoice`) — es decir, solo cambió
// la forma de LLEGAR a este modal, no su mecánica interna ni el bug de
// sistema ya confirmado (backdrop de Bootstrap tapando el SweetAlert de
// confirmación, ver `confirmarAbono()`).
export class CuentasPorCobrarPage {
  constructor(private readonly page: Page) {}

  async irA() {
    await this.page.goto(CUENTAS_POR_COBRAR_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
    await this._esperarListadoClientesCargado();
  }

  // ─── Filtros del listado de clientes ───────────────────────────────────────
  // Panel real: `form.acr-v2-filters` — investigado en vivo volcando su HTML
  // completo. "Compañía" y "Condición de la cuenta" son selects Chosen
  // (nativos ocultos + `.chosen-container`); fechas y búsqueda son inputs
  // nativos con `data-filter` propio (sin id).

  /** Selecciona la condición de la cuenta ("Todo"/"En morosidad"/"Al día") — widget Chosen. */
  async filtrarPorCondicion(condicion: CondicionCuenta) {
    const contenedor = this.page.locator('select[data-filter="account_condition"]').locator('xpath=following-sibling::div[contains(@class,"chosen-container")][1]');
    await contenedor.locator('.chosen-single').click();
    await contenedor.locator('.chosen-results li', { hasText: condicion }).first().click();
    await this.presionarBuscar();
  }

  /** Establece el rango de emisión ("Emisión desde"/"Emisión hasta"), formato `YYYY-MM-DD`. */
  async filtrarPorRangoEmision(desde: string, hasta: string) {
    await this.page.locator('input[data-filter="start_date"]').fill(desde);
    await this.page.locator('input[data-filter="end_date"]').fill(hasta);
    await this.presionarBuscar();
  }

  /** Busca por cliente, identificación, correo, teléfono o número de factura (placeholder real confirmado en vivo). */
  async buscar(termino: string) {
    await this.page.locator('input[data-filter="search"]').fill(termino);
    await this.presionarBuscar();
  }

  /**
   * Cierra el banner "Activar notificaciones" del navegador si aparece —
   * elemento ajeno a Cuentas por Cobrar que puede quedar sobre el
   * encabezado e interceptar el primer click real de un test (mismo
   * hallazgo ya documentado en varios módulos de esta suite, p. ej.
   * `rutas.page.ts`/`historico-ventas.page.ts`).
   */
  private async _cerrarBannerNotificacionesSiAparece() {
    const banner = this.page.locator('#workshop-web-notification-permission');
    if (await banner.isVisible().catch(() => false)) {
      await banner.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 3_000 }).catch(() => {});
    }
  }

  /**
   * Presiona el botón real "Buscar" (submit del formulario de filtros).
   * Reintentos acotados cerrando el banner de notificaciones y el menú de
   * usuario del encabezado antes de cada intento — confirmado en vivo que
   * ambos pueden interceptar este click (mismo patrón ya usado en el resto
   * de la suite en vez de un único intento con timeout largo).
   */
  async presionarBuscar() {
    const boton = this.page.locator('form.acr-v2-filters button[type="submit"]');
    const MAX_INTENTOS = 5;
    let exito = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !exito; intento++) {
      await this._cerrarBannerNotificacionesSiAparece();
      exito = await boton.click({ timeout: 5_000 }).then(() => true).catch(() => false);
    }
    expect(exito, `El botón "Buscar" no respondió tras ${MAX_INTENTOS} intentos`).toBe(true);
    await this._esperarListadoClientesCargado();
  }

  /** Limpia todos los filtros aplicados (`data-action="clear-filters"`). */
  async limpiarFiltros() {
    await this._cerrarBannerNotificacionesSiAparece();
    await this.page.locator('[data-action="clear-filters"]').click({ timeout: 5_000 });
    await this._esperarListadoClientesCargado();
  }

  /**
   * Espera a que el listado de clientes termine de (re)cargar vía AJAX tras
   * aplicar/limpiar un filtro — CORRECCIÓN DE AUTOMATIZACIÓN confirmada en
   * vivo: `waitForLoadState('networkidle')` no alcanza aquí. El listado pasa
   * por un estado transitorio real "Cargando cuentas por cobrar..." con "0
   * registros cargados" ANTES de poblarse con el resultado real — leer el
   * DOM justo después de ese estado (confirmado en un intento sin esta
   * espera: devolvía 0 clientes de forma reproducible, incluso tras
   * `networkidle`) da un falso "sin resultados". Se espera la condición
   * real: el texto "Cargando..." desaparece.
   */
  private async _esperarListadoClientesCargado() {
    await expect(
      this.page.getByText('Cargando cuentas por cobrar...').first(),
      'El listado de Cuentas por Cobrar quedó cargando indefinidamente'
    ).toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  // ─── Listado de clientes ────────────────────────────────────────────────────

  /** Cuenta las filas de cliente actualmente visibles en el listado. */
  async contarClientesVisibles(): Promise<number> {
    return this.page.locator('tr.acr-v2-record-row').count();
  }

  /**
   * Lee el bloque "Resumen por moneda" (Clientes/Saldo pendiente/Vencido/Por
   * vencer) — investigado en vivo, texto real sin clase CSS propia por
   * campo; se parsea por proximidad a sus propias etiquetas.
   */
  async leerResumenPorMoneda(): Promise<ResumenPorMonedaCxC> {
    const texto = await this.page.locator('body').innerText();
    const inicio = texto.indexOf('Resumen por moneda');
    // CORRECCIÓN DE AUTOMATIZACIÓN confirmada en vivo (ambiente qa_restaurant):
    // el encabezado real del listado es "Cuentas por cobrar por cliente" —
    // "Cuentas pendientes por cliente" (el texto asumido originalmente) no
    // existe en el DOM, dejando `fin` siempre en -1 y `bloque` sin acotar.
    // Inofensivo mientras el resumen sea el primer bloque de la página (sigue
    // siéndolo hoy en ambos ambientes), pero se prueban ambos textos para no
    // depender de esa casualidad de orden.
    const fin = ['Cuentas pendientes por cliente', 'Cuentas por cobrar por cliente']
      .map((candidato) => texto.indexOf(candidato, inicio))
      .find((idx) => idx >= 0) ?? -1;
    const bloque = inicio >= 0 ? texto.slice(inicio, fin >= 0 ? fin : undefined) : texto;

    const leerMonto = (etiqueta: string): number => {
      // CORRECCIÓN DE AUTOMATIZACIÓN confirmada en vivo (ambiente qa_restaurant,
      // moneda ₡): el regex original solo toleraba un "$" opcional entre la
      // etiqueta y el número — con cualquier otro símbolo real (₡, €, L...)
      // el match completo fallaba y `leerMonto` devolvía 0 siempre, pese a que
      // el monto real sí estaba en el DOM. `[^0-9]*` tolera cualquier símbolo
      // de moneda real, no solo "$".
      const m = new RegExp(`${etiqueta}[^0-9]*([0-9.,]+)`, 'i').exec(bloque);
      if (!m) return 0;
      const limpio = m[1].replace(/\./g, '').replace(',', '.');
      const valor = parseFloat(limpio);
      return Number.isNaN(valor) ? 0 : valor;
    };
    const clientesMatch = /Clientes:\s*(\d+)/i.exec(bloque);

    return {
      clientes: clientesMatch ? parseInt(clientesMatch[1], 10) : 0,
      saldoPendiente: leerMonto('SALDO PENDIENTE'),
      vencido: leerMonto('VENCIDO'),
      porVencer: leerMonto('POR VENCER'),
    };
  }

  /**
   * Lee todas las filas de cliente actualmente visibles — cada `tr` real
   * expone sus datos en `<span>`/`<strong>` propios sin clase CSS estable
   * por campo, así que se parsea por texto (mismo criterio ya usado en
   * `HistoricoVentasPage.leerFormaDePagoFacturaAbierta()` cuando el marcado
   * real no ofrece un selector confiable).
   */
  async leerClientesVisibles(): Promise<FilaClienteCxC[]> {
    return this.page.evaluate(() => {
      const leerMonto = (texto: string): number => {
        const limpio = texto.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
        const valor = parseFloat(limpio);
        return Number.isNaN(valor) ? 0 : valor;
      };
      const filas = Array.from(document.querySelectorAll('tr.acr-v2-record-row'));
      return filas.map((fila) => {
        const texto = (fila as HTMLElement).innerText;
        const nombre = fila.querySelector('.acr-v2-client-name')?.textContent?.trim() ?? '';
        const facturasMatch = /(\d+)\s*Facturas/i.exec(texto);
        // CORRECCIÓN DE AUTOMATIZACIÓN confirmada en vivo (ambiente
        // qa_restaurant, moneda ₡): "$" opcional no cubre otros símbolos
        // reales (₡, €, L...) — con cualquiera de esos el match completo
        // fallaba y el monto quedaba siempre en 0 pese a estar presente en el
        // DOM. `[^0-9]*` tolera cualquier símbolo de moneda real.
        const totalMatch = /TOTAL[^0-9]*([0-9.,]+)/i.exec(texto);
        const abonadoMatch = /ABONADO[^0-9]*([0-9.,]+)/i.exec(texto);
        const saldoMatch = /SALDO[^0-9]*([0-9.,]+)/i.exec(texto);
        const vencidoMatch = /VENCIDO[^0-9]*([0-9.,]+)/i.exec(texto);
        const porVencerMatch = /POR VENCER[^0-9]*([0-9.,]+)/i.exec(texto);
        const estado = /En morosidad|Al día/i.exec(texto)?.[0] ?? '';
        return {
          cliente: nombre,
          cantidadFacturas: facturasMatch ? parseInt(facturasMatch[1], 10) : 0,
          total: totalMatch ? leerMonto(totalMatch[1]) : 0,
          abonado: abonadoMatch ? leerMonto(abonadoMatch[1]) : 0,
          saldo: saldoMatch ? leerMonto(saldoMatch[1]) : 0,
          vencido: vencidoMatch ? leerMonto(vencidoMatch[1]) : 0,
          porVencer: porVencerMatch ? leerMonto(porVencerMatch[1]) : 0,
          estado,
        };
      });
    });
  }

  // ─── Modal "Facturas, saldos y abonos del cliente" ─────────────────────────

  /**
   * Abre "Gestionar facturas, saldos y abonos" de la fila `indice` (0 =
   * primera) — dropdown real por fila (`.acr-v2-action-toggle`), cierra
   * primero el banner de notificaciones si está tapando el toggle
   * (confirmado en vivo que puede interceptar el click, mismo hallazgo ya
   * documentado en otros módulos de esta suite). Espera a que la tabla de
   * facturas pendientes del cliente termine de poblarse vía AJAX antes de
   * devolver el control.
   */
  async abrirGestionCliente(indice = 0) {
    const banner = this.page.locator('#workshop-web-notification-permission');
    if (await banner.isVisible().catch(() => false)) {
      await banner.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 3_000 }).catch(() => {});
    }

    // CORRECCIÓN DE AUTOMATIZACIÓN confirmada en vivo: cada fila tiene su
    // propio `[data-action="manage-account"]` en el DOM (todas presentes a
    // la vez, solo la del dropdown ABIERTO queda visible) — usar
    // `page.locator(...).first()` sin escopar a `fila` siempre resuelve al
    // de la fila 0, sin importar cuál fila se abrió realmente. Causaba un
    // timeout real al gestionar cualquier fila que no fuera la primera.
    const fila = this.page.locator('tr.acr-v2-record-row').nth(indice);
    await fila.locator('.acr-v2-action-toggle').click();
    await fila.locator('[data-action="manage-account"]').first().click();

    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.MODAL }).catch(() => {});
    await expect
      .poll(() => this.page.locator('table.acr-v2-payment-table tbody tr').count(), {
        timeout: TIMEOUTS.MODAL,
        message: 'La tabla de facturas pendientes del cliente nunca se pobló',
      })
      .toBeGreaterThan(0);
  }

  /** Busca dentro del modal de gestión ya abierto (por producto/servicio/combo/código/descripción — placeholder real). */
  async buscarFacturaEnGestion(termino: string) {
    await this.page.locator('#acr-v2-invoice-search-input').fill(termino);
    await this.page.locator('[data-action="search-invoice-content"]').click();
    await this.page.waitForTimeout(500); // recarga vía AJAX de la tabla, sin evento de red propio identificado para esperar
  }

  /** Cuenta las facturas pendientes visibles en el modal de gestión ya abierto. */
  async contarFacturasPendientesEnGestion(): Promise<number> {
    return this.page.locator('tr.invoice_list').count();
  }

  /** Devuelve los `data-invoice-id` reales de las facturas pendientes visibles en el modal de gestión ya abierto. */
  async obtenerIdsFacturasPendientes(): Promise<string[]> {
    const filas = this.page.locator('tr.invoice_list');
    const total = await filas.count();
    const ids: string[] = [];
    for (let i = 0; i < total; i++) {
      const id = await filas.nth(i).getAttribute('data-invoice-id');
      if (id) ids.push(id);
    }
    return ids;
  }

  /** Lee el saldo pendiente real (`.acr-v2-modal-balance`) de una factura del modal de gestión ya abierto. */
  async leerSaldoFacturaPendiente(idFactura: string): Promise<number> {
    const texto = await this.page.locator(`tr.invoice_list[data-invoice-id="${idFactura}"] .acr-v2-modal-balance`).textContent();
    const limpio = (texto ?? '').replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const valor = parseFloat(limpio);
    return Number.isNaN(valor) ? 0 : valor;
  }

  /**
   * Marca el checkbox "Seleccionar" de una factura del modal de gestión ya
   * abierto — habilita su campo de monto (`establecerMontoAbono()`).
   * Confirmado en vivo que nace deshabilitado (clase `un_enable`) y que un
   * click real/programático simple no lo habilita: requiere fijar `.checked`
   * y despachar `change` manualmente (mismo patrón de checkbox-slider ya
   * usado en el resto de esta suite para widgets que no responden a un
   * click nativo).
   */
  async seleccionarFacturaParaAbono(idFactura: string) {
    const checkbox = this.page.locator(`#invoice_check_${idFactura}`);
    await checkbox.evaluate((el: HTMLInputElement) => {
      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const monto = this.page.locator(`#invoice_input_${idFactura}`);
    await expect(monto, `El campo de monto de la factura ${idFactura} no se habilitó tras marcarla`).toBeEnabled({ timeout: TIMEOUTS.CARGA });
  }

  /** Establece el monto a abonar de una factura YA SELECCIONADA (`seleccionarFacturaParaAbono()` primero) del modal de gestión. */
  async establecerMontoAbono(idFactura: string, monto: string) {
    await this.page.locator(`#invoice_input_${idFactura}`).fill(monto);
  }

  /**
   * Abre "Registrar abono" de una factura del modal de gestión ya abierto —
   * dropdown propio por fila (mismo patrón `.dropdown-toggle` que
   * `abrirGestionCliente()`), cierra el banner de notificaciones si
   * intercepta el click (confirmado en vivo). Deja abierto el modal final de
   * pago (`.credit-payment-redesign-modal`).
   */
  async abrirRegistrarAbono(idFactura: string) {
    const banner = this.page.locator('#workshop-web-notification-permission');
    if (await banner.isVisible().catch(() => false)) {
      await banner.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 3_000 }).catch(() => {});
    }

    const fila = this.page.locator(`tr.invoice_list[data-invoice-id="${idFactura}"]`);
    await fila.locator('.dropdown-toggle, [data-toggle="dropdown"]').first().click({ timeout: 5_000 });
    await fila.locator('[data-action="pay-invoice"]').first().waitFor({ state: 'visible', timeout: 5_000 });
    await fila.locator('[data-action="pay-invoice"]').first().click();

    await expect(
      this.modalRegistrarAbono,
      'El modal "Registrar abono" no apareció tras "Registrar abono"'
    ).toBeVisible({ timeout: TIMEOUTS.MODAL });
  }

  /**
   * Abre "Ver historial de abonos" de una factura del modal de gestión ya
   * abierto — mismo dropdown por fila que `abrirRegistrarAbono()`, acción
   * real `[data-action="view-history"]`. Deja abierto el modal
   * `.acr-v2-history-table` (reutiliza el mismo `pms-header`/`pms-close` que
   * el resto de modales secundarios de este componente).
   */
  async abrirHistorialAbonos(idFactura: string) {
    const fila = this.page.locator(`tr.invoice_list[data-invoice-id="${idFactura}"]`);
    await this._abrirDropdownFilaConReintentos(fila);
    await fila.locator('[data-action="view-history"]').first().waitFor({ state: 'visible', timeout: 5_000 });
    await fila.locator('[data-action="view-history"]').first().click();
    await expect(this.page.locator('.acr-v2-history-table'), 'La tabla de historial de abonos no apareció').toBeVisible({ timeout: TIMEOUTS.MODAL });
  }

  /**
   * Abre el dropdown de acciones de una fila (`.dropdown-toggle`) con
   * reintentos acotados — necesario tras cerrar un modal secundario
   * (`cerrarModalSecundario()`): confirmado en vivo que un `.modal-backdrop`
   * residual de Bootstrap puede seguir intercepting clicks un instante
   * después de que el modal ya reporta oculto (mismo mecanismo ya
   * documentado en `confirmarAbono()`), colgando un único intento largo.
   */
  private async _abrirDropdownFilaConReintentos(fila: Locator) {
    const banner = this.page.locator('#workshop-web-notification-permission');
    const MAX_INTENTOS = 4;
    let abierto = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierto; intento++) {
      if (await banner.isVisible().catch(() => false)) {
        await banner.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 3_000 }).catch(() => {});
      }
      abierto = await fila.locator('.dropdown-toggle, [data-toggle="dropdown"]').first().click({ timeout: 5_000 }).then(() => true).catch(() => false);
    }
    expect(abierto, 'El dropdown de acciones de la fila no se pudo abrir tras varios intentos').toBe(true);
  }

  /**
   * Lee todas las filas del modal "Historial de abonos" ya abierto —
   * columnas reales confirmadas en vivo: Fecha del abono, Monto abonado,
   * Método/Referencia, Responsable, Estado/Observaciones.
   */
  async leerHistorialAbonos(): Promise<HistorialAbonoCxC[]> {
    const filas = this.page.locator('.acr-v2-history-table tbody tr');
    const total = await filas.count();
    const resultado: HistorialAbonoCxC[] = [];
    for (let i = 0; i < total; i++) {
      const texto = await filas.nth(i).innerText();
      const fechaMatch = /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/.exec(texto);
      // El monto es el único token con símbolo real de moneda (₡/$/€/L) —
      // más robusto que separar por columnas/tabs (frágiles ante espacios
      // en blanco reales del propio `innerText`).
      const montoMatch = /[₡$€L]\s*([0-9][0-9.,]*)/.exec(texto);
      const metodoMatch = /Efectivo|Tarjeta|SINPE|Transacci[oó]n/i.exec(texto);
      resultado.push({
        fecha: fechaMatch ? fechaMatch[1] : '',
        monto: montoMatch ? this._leerMontoDeTexto(montoMatch[0]) : 0,
        metodo: metodoMatch ? metodoMatch[0] : '',
        textoCompleto: texto,
      });
    }
    return resultado;
  }

  /**
   * Cierra POR COMPLETO el modal de gestión (Historial de abonos / Productos
   * y servicios incluidos) con su botón real "×" (`.pms-close`) y espera a
   * que el `.modal-backdrop` de Bootstrap realmente desaparezca.
   *
   * CORRECCIÓN DE AUTOMATIZACIÓN confirmada en vivo: "Historial de abonos" y
   * "Productos y servicios" NO son modales independientes apilados sobre el
   * de gestión — son VISTAS que reemplazan el contenido del MISMO modal real
   * (`data-dismiss="modal"` cierra el modal completo, no solo la vista
   * actual) — confirmado en vivo: tras `cerrarModalSecundario()` la fila
   * `tr.invoice_list` deja de existir por completo (no queda oculta, se
   * pierde el modal de gestión entero). Para volver al listado de facturas
   * del MISMO cliente sin perder el contexto, usar `volverAFacturasDesdeSubmodal()`.
   */
  async cerrarModalSecundario() {
    await this.page.locator('.pms-close').first().click({ timeout: 5_000 }).catch(() => {});
    await this.page.locator('.modal-backdrop').first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }

  /**
   * Vuelve del "Historial de abonos"/"Productos y servicios" al listado de
   * facturas pendientes del MISMO cliente, dentro del mismo modal — botón
   * real "Volver a facturas" (`[data-action="back-account"]`), a diferencia
   * de `cerrarModalSecundario()` (cierra todo el modal de gestión).
   */
  async volverAFacturasDesdeSubmodal() {
    await this.page.locator('[data-action="back-account"]').first().click({ timeout: 5_000 });
    await expect(this.page.locator('tr.invoice_list').first(), 'El listado de facturas pendientes no reapareció tras "Volver a facturas"').toBeVisible({ timeout: TIMEOUTS.MODAL });
  }

  /**
   * Abre "Ver productos y servicios" de una factura del modal de gestión ya
   * abierto — mismo dropdown por fila, acción real
   * `[data-action="view-invoice-items"]`.
   */
  async abrirDetalleFactura(idFactura: string) {
    const fila = this.page.locator(`tr.invoice_list[data-invoice-id="${idFactura}"]`);
    await this._abrirDropdownFilaConReintentos(fila);
    await fila.locator('[data-action="view-invoice-items"]').first().waitFor({ state: 'visible', timeout: 5_000 });
    await fila.locator('[data-action="view-invoice-items"]').first().click();
    await expect(this.page.locator('.acr-v2-invoice-items-table'), 'La tabla de productos y servicios no apareció').toBeVisible({ timeout: TIMEOUTS.MODAL });
  }

  /**
   * Lee el resumen financiero (Subtotal/Descuento/Impuesto/Total/Saldo) del
   * modal "Productos y servicios de la factura" ya abierto — permite validar
   * matemáticamente Subtotal − Descuento + Impuesto = Total sin depender de
   * datos creados en esta misma sesión.
   */
  async leerResumenDetalleFactura(): Promise<ResumenDetalleFacturaCxC> {
    const resumen = this.page.locator('.acr-v2-invoice-items-summary');
    const leer = async (etiqueta: string) => {
      const texto = await resumen.locator('div', { hasText: etiqueta }).last().innerText();
      return this._leerMontoDeTexto(texto);
    };
    return {
      subtotal: await leer('Subtotal'),
      descuento: await leer('Descuento'),
      impuesto: await leer('Impuesto'),
      total: await leer('Total'),
      saldo: await leer('Saldo'),
    };
  }

  private _leerMontoDeTexto(texto: string): number {
    const limpio = texto.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const valor = parseFloat(limpio);
    return Number.isNaN(valor) ? 0 : valor;
  }

  // ─── Modal final "Registrar abono" (credit-payment-redesign-modal) ────────
  // Reutiliza, confirmado en vivo campo por campo, los MISMOS ids que el
  // modal de pago legado ya documentado (ver la nota de cabecera) — nunca
  // asumidos, cada uno confirmado en el DOM real de este modal.

  get modalRegistrarAbono() {
    return this.page.locator('.credit-payment-redesign-modal');
  }

  /** Lee el monto que el modal "Registrar abono" precarga por defecto (100% del saldo de la factura, en Efectivo). */
  async obtenerMontoPrellenado(): Promise<number> {
    const valor = await this.page.locator('#payment_cash_total').inputValue();
    const limpio = valor.replace(/[^0-9.-]/g, '');
    const numero = parseFloat(limpio);
    return Number.isNaN(numero) ? 0 : numero;
  }

  /**
   * Selecciona Efectivo (ya marcado por defecto, confirmado en vivo) con el
   * monto indicado — permite abono parcial o total según el monto pasado.
   */
  async seleccionarAbonoEfectivo(monto: string) {
    await this._asegurarMetodoAbono('is_payment_cash', true);
    await this.page.locator('#payment_cash_total').fill(monto);
  }

  /**
   * Cambia el método a Tarjeta/Transacción/SINPE con el monto EXACTO del
   * saldo total de la factura (leído de `#total_hide`, mismo campo real que
   * usa el modal de pago del POS para el mismo propósito) — desmarca
   * Efectivo primero (mismo criterio que `PosPayment._cambiarMetodoPago()`).
   */
  async seleccionarAbonoMetodoExacto(metodo: MetodoAbono) {
    const total = await this.page.locator('#total_hide').inputValue();
    await this._asegurarMetodoAbono('is_payment_cash', false);
    await this._asegurarMetodoAbono(CHECKBOX_METODO_ABONO[metodo], true);
    await this.page.locator(MONTO_METODO_ABONO[metodo]).fill(total);
  }

  /**
   * Variante de `seleccionarAbonoMetodoExacto()` con un monto EXPLÍCITO
   * (abono PARCIAL con un método distinto a Efectivo) en vez del 100% del
   * saldo — mismo mecanismo real (desmarca Efectivo primero, marca el
   * método destino), solo cambia el monto escrito en el campo.
   */
  async seleccionarAbonoMetodoConMonto(metodo: MetodoAbono, monto: string) {
    await this._asegurarMetodoAbono('is_payment_cash', false);
    await this._asegurarMetodoAbono(CHECKBOX_METODO_ABONO[metodo], true);
    await this.page.locator(MONTO_METODO_ABONO[metodo]).fill(monto);
  }

  private async _asegurarMetodoAbono(checkboxId: string, activo: boolean) {
    const checkbox = this.page.locator(`#${checkboxId}`);
    await expect.poll(async () => {
      if ((await checkbox.isChecked()) !== activo) {
        await checkbox.evaluate((el: HTMLElement) => el.click());
      }
      return checkbox.isChecked();
    }, { timeout: TIMEOUTS.CARGA, message: `El checkbox "${checkboxId}" no quedó en estado ${activo}` }).toBe(activo);
  }

  /**
   * Confirma el abono ("Realizar abono", `#add_credit_payment_btn`).
   *
   * **Bug de sistema confirmado en vivo (heredado sin cambios del flujo
   * legado, ver la memoria del proyecto)**: un `.modal-backdrop` de
   * Bootstrap residual queda con z-index mayor que el SweetAlert de
   * confirmación ("¡Realizar abono!", botón real "Abonar") e intercepta el
   * click en sus coordenadas reales. Se intenta primero el click nativo
   * (a veces sí funciona); si no se observa la respuesta real del POST a
   * `addPosSalesCreditInvoice` en un margen corto, se invoca directamente
   * `add_payment()` (función real de la app, ya expuesta en `window`) como
   * red de seguridad — seguro de hacer porque el SweetAlert ya visible
   * confirma que las validaciones previas del botón ya pasaron.
   *
   * Devuelve la respuesta cruda del backend (id numérico > 0 en texto plano
   * si el abono se guardó).
   */
  async confirmarAbono(): Promise<string> {
    const btnRealizarAbono = this.page.locator('#add_credit_payment_btn');
    await expect(btnRealizarAbono, 'El botón "Realizar Abono" no apareció').toBeVisible({ timeout: TIMEOUTS.MODAL });
    await btnRealizarAbono.click();

    const confirmBtn = this.page.locator('.sa-button-container button.confirm');
    await expect(confirmBtn, 'El SweetAlert de confirmación de abono no apareció').toBeVisible({ timeout: TIMEOUTS.MODAL });

    const esperaRespuestaClick = this.page
      .waitForResponse((r) => r.url().includes('addPosSalesCreditInvoice') && r.request().method() === 'POST', { timeout: 6_000 })
      .then((r) => r.text())
      .catch(() => null);
    await confirmBtn.evaluate((el) => (el as HTMLElement).click());
    let respuesta = await esperaRespuestaClick;

    if (respuesta === null) {
      const esperaRespuestaDirecta = this.page
        .waitForResponse((r) => r.url().includes('addPosSalesCreditInvoice') && r.request().method() === 'POST', { timeout: TIMEOUTS.MODAL })
        .then((r) => r.text());
      await this.page.evaluate(() => {
        // @ts-expect-error función global real de la app, no expuesta por tipos
        if (typeof add_payment === 'function') add_payment();
      });
      respuesta = await esperaRespuestaDirecta;
    }

    expect(parseInt(respuesta ?? '0', 10), `El backend respondió "${respuesta}" (0/no numérico = abono no guardado)`).toBeGreaterThan(0);
    return respuesta;
  }

  /**
   * Cierra el modal "Registrar abono" con "Cancelar", sin confirmar ningún
   * abono. Localizado por su clase real (`.pms-btn-cancel`, confirmada en
   * vivo) — el botón combina el texto "Cancelar" con el atajo "Esc" en el
   * mismo nodo, lo que hacía que localizarlo por texto fuera ambiguo/frágil.
   */
  async cancelarAbono() {
    await this.modalRegistrarAbono.locator('.pms-btn-cancel').click();
    await expect(this.modalRegistrarAbono, 'El modal "Registrar abono" no se cerró con "Cancelar"').toBeHidden({ timeout: TIMEOUTS.MODAL });
  }
}

// ─── Constantes y tipos ─────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:     90_000,
  NAVIGATE: 60_000,
  CARGA:    15_000,
  MODAL:    15_000,
} as const;

export const CUENTAS_POR_COBRAR_URL = BASE_URL + '/credit_sale/clientCreditSales';

export type CondicionCuenta = 'Todo' | 'En morosidad' | 'Al día';

export type ResumenPorMonedaCxC = {
  clientes: number;
  saldoPendiente: number;
  vencido: number;
  porVencer: number;
};

export type FilaClienteCxC = {
  cliente: string;
  cantidadFacturas: number;
  total: number;
  abonado: number;
  saldo: number;
  vencido: number;
  porVencer: number;
  estado: string;
};

export type HistorialAbonoCxC = {
  fecha: string;
  monto: number;
  metodo: string;
  textoCompleto: string;
};

export type ResumenDetalleFacturaCxC = {
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  saldo: number;
};

// Métodos de abono reales confirmados en vivo dentro del modal "Registrar
// abono" — MISMOS ids que el modal de pago del POS (coincidencia de
// plantilla compartida, no una dependencia real entre módulos; se declaran
// aquí en vez de importarlos desde `pos.types.ts` para no acoplar Ventas a
// POS por una simple coincidencia de nombres — ver CLAUDE.md sobre
// reutilización cruzada entre módulos).
export type MetodoAbono = 'tarjeta' | 'sinpe' | 'transaccion';
const CHECKBOX_METODO_ABONO: Record<MetodoAbono, string> = {
  tarjeta: 'is_payment_credit_card',
  sinpe: 'is_payment_check',
  transaccion: 'is_payment_transaction',
};
const MONTO_METODO_ABONO: Record<MetodoAbono, string> = {
  tarjeta: '#payment_credit_card_total',
  sinpe: '#payment_check_total',
  transaccion: '#payment_transaction_total',
};
