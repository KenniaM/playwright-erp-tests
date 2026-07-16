import { expect, Download, Locator, Page, Response } from '@playwright/test';
import { L } from './pos.locators';
import {
  TIMEOUTS, PAUSES, CAJA_TEXTO, CHECKBOX_ID, PestanaPos, PESTANA_POS_FACTURACION,
  PESTANAS_POS_A_RECORRER, MetodoPago, METODO, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT,
  TipoPagoOrdenCaja, TipoProforma, VEHICULO_PINTURA_TIPO, COMPANIA_POS, CABYS_BUSQUEDA,
  CABYS_BUSQUEDA_SIN_IVA, PRECIO_PRODUCTO_RAPIDO, EscenarioDescuento, ResultadoDescuento,
  EstadoCheckIva, ConfigBusquedaCabys, LineaCarrito, MetadatoProducto, DASHBOARD_URL,
} from './pos.types';
import { espiarErroresJS, esperarQuedaActivo } from './pos.utils';
import { PosCore } from './pos-core.page';

// Pasos 0-1 de la migración a composición (ver el plan aprobado en
// /Users/mobileimacimac/.claude/plans/hazy-noodling-stream.md): tipos,
// constantes y locators se movieron a pos.types.ts/pos.locators.ts, y las 2
// funciones sueltas a pos.utils.ts. Este archivo sigue siendo el punto de
// entrada público único (barrel): re-exporta todo para que ningún import
// existente en los .spec.ts, ni el cruzado desde
// tests/gestion-de-taller/recepcion.page.ts, tenga que cambiar. Próximos
// pasos del plan: PosCore (helpers transversales) ya se extrajo a
// pos-core.page.ts — PosPage delega a `this.core` cada uno de sus
// miembros. Quedan por extraer: Cierre de Caja, Navegación, Pago,
// Proforma, Crear Producto, Importar Factura, Orden de Caja, Apartado y
// Ruteo, cada uno a su propia clase compuesta de la misma forma.
export * from './pos.types';
export { espiarErroresJS, esperarQuedaActivo };


// ─── Page Object ──────────────────────────────────────────────────────────────

export class PosPage {
  private readonly core: PosCore;

  constructor(private readonly page: Page) {
    this.core = new PosCore(page);
  }
  get modalAbrirCaja() { return this.core.modalAbrirCaja; }

  /**
   * Locator del SweetAlert opcional "Información de pago" que puede aparecer
   * tras presionar "Facturar", pidiendo confirmar con "Pagar" antes de que la
   * venta continúe. Confirmado en vivo (con la cuenta QA/HONDURAS) que es
   * distinto del aviso "¿Desea imprimir copia?" (otro `.sweet-alert` ya
   * manejado aparte): éste usa la clase custom `confirm-complete-sale` en vez
   * de `visible`, por lo que se filtra por esa clase para no confundirlos.
   */
  get confirmacionPago() {
    return this.page.locator('.sweet-alert.confirm-complete-sale');
  }

  /**
   * Locator del panel "Información del Cliente" (`#myNavClient`) que puede
   * aparecer, DENTRO del propio modal de pago (`#dialog_payment`, nunca un
   * modal ni SweetAlert separado — confirmado en vivo inspeccionando su
   * `outerHTML`: es un `<div class="overlay overlay-hgt overlay-hgt-efect">`
   * anidado en `#dialog_payment`), cuando el documento electrónico
   * seleccionado (confirmado en vivo con "Factura Electrónica" en TALLER
   * ALPHA PREMIUM) exige datos del cliente (nombre, identificación, correo,
   * dirección, etc.) para completar la venta. No siempre aparece — depende
   * del documento electrónico activo y, aun con el mismo documento, no es
   * consistente entre intentos (confirmado en vivo: dos corridas
   * consecutivas con "Factura Electrónica", una lo mostró y la otra no).
   */
  get panelInformacionCliente() {
    return this.page.locator('#myNavClient');
  }
  get primerProducto() { return this.core.primerProducto; }
  async irAlPos(...args: Parameters<PosCore['irAlPos']>) {
    return this.core.irAlPos(...args);
  }
  async esperarEstadoInicial(...args: Parameters<PosCore['esperarEstadoInicial']>) {
    return this.core.esperarEstadoInicial(...args);
  }
  async modalAbrirCajaVisible(...args: Parameters<PosCore['modalAbrirCajaVisible']>) {
    return this.core.modalAbrirCajaVisible(...args);
  }
  async cargarPosYCerrarModalSiAparece(...args: Parameters<PosCore['cargarPosYCerrarModalSiAparece']>) {
    return this.core.cargarPosYCerrarModalSiAparece(...args);
  }
  async cargarPosDesdeDashboard(...args: Parameters<PosCore['cargarPosDesdeDashboard']>) {
    return this.core.cargarPosDesdeDashboard(...args);
  }
  async _cerrarModalMonedaSiAparece(...args: Parameters<PosCore['_cerrarModalMonedaSiAparece']>) {
    return this.core._cerrarModalMonedaSiAparece(...args);
  }
  async _cerrarModalSetupInicialSiAparece(...args: Parameters<PosCore['_cerrarModalSetupInicialSiAparece']>) {
    return this.core._cerrarModalSetupInicialSiAparece(...args);
  }
  async _cerrarOverlayDashboardSiAparece(...args: Parameters<PosCore['_cerrarOverlayDashboardSiAparece']>) {
    return this.core._cerrarOverlayDashboardSiAparece(...args);
  }
  async _irAlPosResolviendoCompania(...args: Parameters<PosCore['_irAlPosResolviendoCompania']>) {
    return this.core._irAlPosResolviendoCompania(...args);
  }
  async cerrarModalAbrirCaja(...args: Parameters<PosCore['cerrarModalAbrirCaja']>) {
    return this.core.cerrarModalAbrirCaja(...args);
  }
  async completarAperturaCaja(...args: Parameters<PosCore['completarAperturaCaja']>) {
    return this.core.completarAperturaCaja(...args);
  }

  /** Locator del modal "Detalle de Cierre" (cerrar caja). */
  get modalCerrarCaja() {
    return this.page.locator(L.DIALOG_CERRAR_CAJA);
  }
  get modalNotificaciones() { return this.core.modalNotificaciones; }
  async cerrarModalNotificacionesSiAparece(...args: Parameters<PosCore['cerrarModalNotificacionesSiAparece']>) {
    return this.core.cerrarModalNotificacionesSiAparece(...args);
  }

  /**
   * Indica si el menú "Caja" está actualmente desplegado, leyendo el estado real
   * del DOM (clase "is-visible" en el div.mdl-menu__container que envuelve el
   * <ul>) en vez de asumirlo — confirmado en vivo que este es el indicador real;
   * ni el <ul> ni el <li> usan aria-expanded.
   */
  async menuCajaEstaAbierto(): Promise<boolean> {
    return this.page.evaluate((selector) => {
      const ul = document.querySelector(selector);
      const container = ul?.closest('.mdl-menu__container');
      return container?.classList.contains('is-visible') ?? false;
    }, L.MENU_CAJA_UL);
  }

  /**
   * Abre el menú "Caja" del encabezado del POS. #menu_cash es un botón de
   * alternancia (toggle), no una acción idempotente de "asegurar abierto": si el
   * menú ya está desplegado (p. ej. un click anterior sí llegó a ejecutarse pese
   * a haber sido reportado como fallido), volver a pulsarlo lo cerraría en vez de
   * dejarlo abierto — confirmado en vivo. Por eso se comprueba el estado real
   * antes de decidir si hace falta el click.
   */
  async abrirMenuCaja() {
    // Los overlays conocidos (aviso de notificaciones, cualquier toast "noty")
    // pueden quedar sobre el encabezado e interceptar el click, sin importar el
    // estado de la caja.
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarTodosLosToastsSiAparecen();

    if (!(await this.menuCajaEstaAbierto())) {
      await this.page.locator(L.MENU_CAJA_BTN).click();
    }
  }

  /**
   * Selecciona "(F12) Abrir/Cerrar Caja" del menú "Caja" ya desplegado. Este único
   * ítem muestra el modal "Abrir Caja" si la caja está cerrada, o "Detalle de
   * Cierre" si está abierta — el sistema decide cuál, no el test.
   *
   * El click se acota a 5 s (en vez de heredar el timeout completo del test):
   * si un overlay transitorio del encabezado (banner de notificaciones, un
   * toast) está tapando el <li> en ese instante, un click sin límite propio
   * puede quedar bloqueado hasta agotar los 300 s del test entero — confirmado
   * en vivo. Con un límite corto, el bucle de reintento que llama a este método
   * puede volver a intentar en vez de quedar colgado en un único click.
   */
  async seleccionarAbrirCerrarCaja() {
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarTodosLosToastsSiAparecen();
    await this.page.locator('li', { hasText: L.MENU_CAJA_ITEM_F12 }).click({ timeout: 5_000 });
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
      { timeout: TIMEOUTS.CIERRE_CAJA }
    );
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.CIERRE_CAJA }).catch(() => null);

    // Ambos avisos opcionales se descartan ANTES de confirmar, nunca después: el
    // cierre exitoso recarga la página (confirmado inspeccionando el DOM real tras
    // el click de confirmación — "Execution context was destroyed... navigation"),
    // lo que vuelve a generar el mismo aviso de consecutivo desde cero. Intentar
    // cerrarlo después del click compite con esa recarga en vez de resolverlo.
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarAvisoConsecutivoSiAparece();
    await this.modalCerrarCaja.locator(L.CIERRE_BTN_CERRAR).click();
    await this._confirmarSweetAlertV1();

    await cierreConfirmadoPromise;

    const printPage = await popupPromise;
    if (printPage) {
      await this.mostrarYCerrarVentanaImpresion(printPage);
    }
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

  /**
   * Presiona el primer "Facturar" (abre el modal de pago). Este botón nunca requiere
   * abrir la caja —eso solo puede ocurrir al confirmar el pago, más adelante— así que
   * aquí no se valida ni se intenta abrir la caja en ningún caso. Centralizado aquí:
   * existía duplicado de forma idéntica como función local en pos-crear.spec.ts,
   * pos-facturar.spec.ts, pos-navegacion.spec.ts y pos.spec.ts.
   *
   * No toca el tipo de documento electrónico aquí: la opción que el ambiente
   * ya trae seleccionada por defecto se deja tal cual — solo
   * confirmarPagoAbriendoCajaSiEsNecesario() la cambia, y solo si esa opción
   * demuestra en la práctica que no deja completar la venta (ver
   * _localizarSelectorDocumentoElectronico()).
   */
  async abrirModalDePago() {
    await this.presionarFacturar();
    await this.esperarModalPago();
  }

  /**
   * Ubica (si existe) el control de tipo de documento electrónico del modal
   * de pago — `#payment_electronic_document_type` dentro de `#dialog_payment`.
   * Confirmado en vivo (TALLER ALPHA PREMIUM, leyendo el bundle real
   * `pos.js` servido por el ambiente, no asumido) que este id es una
   * constante del propio template de facturación electrónica de Costa Rica,
   * no un valor específico de esta compañía: `pos.js` lo referencia por ese
   * mismo id de forma hardcodeada decenas de veces (p. ej.
   * `$('#payment_electronic_document_type').val(...)`) para inicializarlo y
   * para leerlo en la validación de la venta — cualquier compañía con
   * `is_electronic_billing_cr()` activo lo sirve con este mismo id. Devuelve
   * null si el modal no tiene ningún control de este tipo — comportamiento
   * válido (Escenario 5): la compañía no tiene facturación electrónica,
   * continuar normalmente.
   */
  private async _localizarSelectorDocumentoElectronico(): Promise<Locator | null> {
    const select = this.page.locator(`${L.DIALOG_PAGO} #payment_electronic_document_type`);
    return (await select.count()) > 0 ? select : null;
  }

  /**
   * Cambia el documento electrónico a "Tiquete Electrónico" si el select
   * tiene esa opción y no está ya seleccionada. Se busca por su texto visible
   * (nunca por posición): confirmado en vivo que "Tiquete Electrónico" es
   * terminología fija de Hacienda (Costa Rica) — el mismo nombre para
   * cualquier compañía costarricense con facturación electrónica, no un
   * valor propio de esta compañía. Confirmado también en vivo, leyendo
   * `pos.js`, que esta opción es la única con esa propiedad: la validación
   * que exige datos del cliente (`get_and_validate_client_pos`, disparada
   * desde `confirm_add_sale_validate()`) solo se ejecuta cuando
   * `payment_electronic_document_type === 1` ("Factura Electrónica"); ninguna
   * otra opción —incluida "Tiquete Electrónico"— entra a esa validación.
   *
   * Devuelve false (sin lanzar) si no hay select, si no existe la opción
   * "Tiquete Electrónico" en este ambiente, o si ya estaba seleccionada —
   * quien llama decide entonces que no hay forma automática de continuar.
   */
  private async _cambiarATiqueteElectronicoSiEsPosible(): Promise<boolean> {
    const select = await this._localizarSelectorDocumentoElectronico();
    if (!select) return false;

    const { opciones, seleccionada } = await this._leerOpcionesDocumentoElectronico(select);
    const indiceTiquete = opciones.findIndex((o) => /tiquete/i.test(o));
    if (indiceTiquete === -1 || indiceTiquete === seleccionada) return false;

    await this._seleccionarOpcionDocumentoElectronicoPorIndice(select, indiceTiquete);
    await expect
      .poll(() => select.evaluate((el: HTMLSelectElement) => el.selectedIndex))
      .toBe(indiceTiquete);
    return true;
  }

  /**
   * Lee todas las opciones del selector de documento electrónico y cuál está
   * seleccionada actualmente (por posición real en el DOM — `selectedIndex`
   * del `<select>` real, que el widget "Chosen" ya mantiene sincronizado con
   * la opción visible — nunca asumida por nombre).
   */
  private async _leerOpcionesDocumentoElectronico(select: Locator): Promise<{ opciones: string[]; seleccionada: number }> {
    const opciones = await select.locator('option').allTextContents();
    const seleccionada = await select.evaluate((el: HTMLSelectElement) => el.selectedIndex);
    return { opciones: opciones.map((o) => o.trim()), seleccionada };
  }

  /**
   * Selecciona una opción del documento electrónico por su POSICIÓN real en
   * el `<select>` (nunca por el texto de la opción). Widget real confirmado
   * en vivo: `<select>` oculto sincronizado con un dropdown "Chosen" (mismo
   * patrón que el resto de esta clase: nunca `selectOption()` sobre el
   * `<select>` oculto, se opera sobre `.chosen-single`/`.chosen-results`).
   * Variante defensiva incluida para un `<select>` nativo visible (sin
   * Chosen), por si algún otro ambiente no usa este widget — sin evidencia
   * propia de que exista, solo cobertura acorde a "no asumir un único
   * widget posible".
   */
  private async _seleccionarOpcionDocumentoElectronicoPorIndice(select: Locator, indice: number) {
    const id = await select.getAttribute('id');
    const contenedorChosen = id ? this.page.locator(`#${id}_chosen`) : null;

    if (contenedorChosen && (await contenedorChosen.isVisible().catch(() => false))) {
      await contenedorChosen.locator('.chosen-single').click();
      await contenedorChosen.locator('.chosen-results li').nth(indice).click();
      return;
    }

    if (await select.isVisible().catch(() => false)) {
      await select.selectOption({ index: indice });
    }
  }
  async agregarPrimerProductoDePrecioFijo(...args: Parameters<PosCore['agregarPrimerProductoDePrecioFijo']>) {
    return this.core.agregarPrimerProductoDePrecioFijo(...args);
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
   * Variante de seleccionarPagoExacto() con un monto explícito en vez del
   * total de la factura — necesaria para el abono inicial de Apartado con
   * tarjeta/SINPE/transacción: a diferencia de Facturar (donde estos 3
   * métodos siempre exigen el monto exacto del total), el abono de un
   * Apartado nunca puede ser igual ni mayor al total (confirmado en vivo,
   * Fase 1 — ver make_layaway()/confirm_add_layaway() en pos_layaway.js),
   * así que reutiliza el mismo cambio de checkbox (_cambiarMetodoPago) pero
   * sin forzar el monto al total completo.
   */
  async seleccionarPagoParcial(metodo: MetodoPago, monto: string) {
    await this._cambiarMetodoPago(metodo.checkboxId);
    await this.page.locator(metodo.montoLocator).fill(monto);
    await this.page.waitForTimeout(PAUSES.VER_MONTO);
  }
  get avisoConsecutivoFueraDeRango() { return this.core.avisoConsecutivoFueraDeRango; }
  async cerrarAvisoConsecutivoSiAparece(...args: Parameters<PosCore['cerrarAvisoConsecutivoSiAparece']>) {
    return this.core.cerrarAvisoConsecutivoSiAparece(...args);
  }
  async cerrarTodosLosToastsSiAparecen(...args: Parameters<PosCore['cerrarTodosLosToastsSiAparecen']>) {
    return this.core.cerrarTodosLosToastsSiAparecen(...args);
  }
  async cerrarOverlaysConocidos(...args: Parameters<PosCore['cerrarOverlaysConocidos']>) {
    return this.core.cerrarOverlaysConocidos(...args);
  }

  /**
   * Presiona el botón "Facturar" del modal de pago (confirma el pago), sin esperar
   * su resultado. Es este botón —no el que abre el modal de pago— el que puede
   * mostrar el modal "Abrir Caja" si la caja está cerrada.
   */
  async presionarConfirmarPago() {
    await this.page.locator(L.BTN_CONFIRMAR).click();
  }
  async mostrarYCerrarVentanaImpresion(...args: Parameters<PosCore['mostrarYCerrarVentanaImpresion']>) {
    return this.core.mostrarYCerrarVentanaImpresion(...args);
  }

  /**
   * Presiona el "Facturar" del modal de pago (confirma el pago) y monitorea lo que
   * ocurre después, sin asumir que el modal "Abrir Caja" —si aparece— lo hace
   * inmediatamente: el backend puede tardar en procesar la solicitud antes de
   * mostrarlo. Por la misma razón, la ventana de impresión puede abrirse de forma
   * síncrona junto con la respuesta del click, así que la espera de ambos eventos
   * (popup y modal) se arma ANTES de cada click —incluidos los reintentos—, nunca
   * después: un listener registrado después del click puede perderse el evento.
   *
   * Si el modal "Abrir Caja" aparece en cualquier momento antes de terminar la
   * facturación (comportamiento esperado, no un error), se valida, se completa la
   * apertura, se confirma que desapareció y se vuelve a presionar "Facturar" —con
   * las esperas nuevamente armadas antes de ese click— hasta obtener el resultado
   * final: la ventana de impresión, que sí forma parte del flujo real del sistema.
   *
   * Un tercer resultado posible, igual de válido, es el SweetAlert opcional
   * "Información de pago" (ver `confirmacionPago`): no todos los ambientes lo
   * muestran (confirmado en vivo con la cuenta QA/HONDURAS que aparece en
   * algunas corridas y en otras no), así que no se asume ni su presencia ni su
   * ausencia. Cuando aparece, se confirma con "Pagar" —con la carrera vuelta a
   * armar antes de ESE click, por la misma razón que antes de "Facturar": la
   * ventana de impresión puede abrirse de forma síncrona junto con la
   * respuesta del click— y se sigue esperando el resultado real, sin volver a
   * presionar "Facturar" (el pago ya fue iniciado).
   *
   * Centralizado aquí: existía duplicado (idéntico salvo un puñado de líneas de
   * comentario) como función local en pos-crear.spec.ts, pos-facturar.spec.ts,
   * pos-navegacion.spec.ts y pos.spec.ts.
   *
   * No toca el tipo de documento electrónico de entrada — la opción que el
   * ambiente ya trae seleccionada se deja tal cual (Escenario 1: continuar
   * normalmente; Escenario 4: si ya es "Tiquete Electrónico", no hacer nada;
   * Escenario 5: si la compañía no tiene facturación electrónica, no hay
   * ningún select que tocar). Solo si, ya confirmando el pago, aparece el
   * panel "Información del Cliente" (Escenario 3) se cambia el documento a
   * "Tiquete Electrónico" — ver `_confirmarPagoConReintentosDeCaja()`.
   */
  async confirmarPagoAbriendoCajaSiEsNecesario() {
    await this._confirmarPagoConReintentosDeCaja();
  }

  /**
   * Intenta completar la facturación con el método de pago ya elegido,
   * reintentando ante dos situaciones que pueden alargar el flujo sin ser un
   * error:
   *
   * - El modal "Abrir Caja" (hasta `MAX_INTENTOS_CAJA` veces).
   * - El panel "Información del Cliente" (Escenario 3, como mucho una vez):
   *   confirmado en vivo, leyendo el `pos.js` real de este ambiente, que solo
   *   aparece cuando el documento electrónico activo es "Factura Electrónica"
   *   (`payment_electronic_document_type === 1` es la única condición que
   *   dispara `get_and_validate_client_pos()`) y que NINGUNA otra opción,
   *   incluida "Tiquete Electrónico", entra a esa validación. Nunca se llena
   *   el formulario (no es responsabilidad de esta suite); se cierra con el
   *   botón real "Cancelar" del panel (`onclick="closeNavClient()"`,
   *   confirmado en vivo — nunca "Guardar", que sí lo completaría) y se
   *   cambia el documento a "Tiquete Electrónico" antes de reintentar
   *   "Facturar". Si ese cambio no es posible (el ambiente no ofrece esa
   *   opción, o el panel reaparece incluso con ella activa) se lanza un
   *   error explícito: no hay una tercera alternativa definida por el
   *   negocio para no perder la venta.
   *
   * Lanza un error si ninguna señal real (popup, confirmación opcional o
   * carrito vacío) confirma que la venta se completó.
   */
  private async _confirmarPagoConReintentosDeCaja() {
    const MAX_INTENTOS_CAJA = 3;
    let intentosCaja = 0;
    let yaSeIntentoTiqueteElectronico = false;

    while (true) {
      let resultado:
        | { tipo: 'popup'; printPage: Page }
        | { tipo: 'modalAbrirCaja' }
        | { tipo: 'confirmacionPago' }
        | { tipo: 'clienteInfoRequerido' }
        | { tipo: 'ventaCompletadaSinPopup' };
      try {
        resultado = await this._armarCarreraFacturacion(() => this.presionarConfirmarPago(), true);
      } catch (e) {
        // Ninguna de las señales esperadas (popup, modal "Abrir Caja",
        // confirmación opcional o panel de cliente) llegó dentro del
        // timeout: antes de asumir un error, se comprueba la señal funcional
        // real de que la venta sí se completó — el carrito quedó vacío
        // (mismo selector que obtenerCantidadFilasCarrito(), cuenta TODAS
        // las filas sin importar su origen). Cubre ambientes que confirman
        // la venta sin abrir ninguna ventana de impresión ni ningún modal —
        // comportamiento válido, no hay que asumir que el popup siempre
        // aparece.
        const filasRestantes = await this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).count();
        if (filasRestantes === 0) {
          resultado = { tipo: 'ventaCompletadaSinPopup' };
        } else if (!yaSeIntentoTiqueteElectronico && (await this._cambiarATiqueteElectronicoSiEsPosible())) {
          // El carrito sigue con líneas y ninguna señal llegó: confirmado en
          // vivo, leyendo el pos.js real, que esto también ocurre cuando el
          // documento activo ("Factura Electrónica") exige un cliente
          // asociado a la venta (payment_credit_client) que no existe —
          // a diferencia del panel "Información del Cliente"
          // (clienteInfoRequerido), esta rama de la misma validación no
          // muestra ningún panel ni deja ninguna señal observable, solo un
          // toast informativo que no bloquea la venta de forma permanente.
          // Ambos bloqueos —el panel y este— viven dentro del mismo `if`
          // que solo se ejecuta con payment_electronic_document_type === 1,
          // así que cambiar a "Tiquete Electrónico" los evita por igual;
          // se reintenta con el mismo mecanismo y el mismo límite de un
          // solo cambio ya usado para clienteInfoRequerido.
          yaSeIntentoTiqueteElectronico = true;
          continue;
        } else {
          throw e;
        }
      }
      await this.cerrarAvisoConsecutivoSiAparece();

      // Si "confirmacionPago" ya estaba visible al armar la carrera anterior,
      // no se vuelve a incluir en la siguiente: su `waitFor({state:'visible'})`
      // resolvería de inmediato contra el MISMO modal todavía abierto (en vez
      // de esperar una aparición nueva), lo que produciría un loop infinito de
      // clicks en "Pagar" sin nunca progresar. Se asume una sola confirmación
      // por intento de facturación — no hay evidencia de que el sistema la
      // muestre dos veces seguidas.
      if (resultado.tipo === 'confirmacionPago') {
        try {
          resultado = await this._armarCarreraFacturacion(
            () => this.confirmacionPago.locator('button.confirm').click(),
            false
          );
        } catch (e) {
          const filasRestantes = await this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).count();
          if (filasRestantes > 0) throw e;
          resultado = { tipo: 'ventaCompletadaSinPopup' };
        }
      }

      if (resultado.tipo === 'clienteInfoRequerido') {
        const btnCancelar = this.panelInformacionCliente.locator('a[onclick="closeNavClient()"]');
        await btnCancelar.click().catch(() => {});
        await this.panelInformacionCliente.waitFor({ state: 'hidden', timeout: TIMEOUTS.PAYMENT_MODAL }).catch(() => {});

        if (yaSeIntentoTiqueteElectronico) {
          throw new Error(
            'El panel "Información del Cliente" volvió a exigirse incluso con "Tiquete Electrónico" ya seleccionado — no hay otra alternativa automática para no perder la venta.'
          );
        }
        const cambiado = await this._cambiarATiqueteElectronicoSiEsPosible();
        if (!cambiado) {
          throw new Error(
            'El documento electrónico actual exige información del cliente (panel "Información del Cliente") y este ambiente no ofrece la opción "Tiquete Electrónico" para evitarlo.'
          );
        }
        yaSeIntentoTiqueteElectronico = true;
        continue; // reintentar "Facturar" ya con "Tiquete Electrónico" seleccionado
      }

      if (resultado.tipo === 'popup') {
        await this.mostrarYCerrarVentanaImpresion(resultado.printPage);

        // El sistema puede mostrar además un SweetAlert "¿Desea imprimir copia?"
        // independiente del popup ya cerrado (confirmado en vivo) — la venta ya
        // se completó, así que se descarta con "Cancelar" en vez de pedir una
        // copia extra. Su overlay, si queda abierto, bloquea clicks posteriores.
        const avisoCopia = this.page.locator('.sweet-alert.visible', { hasText: '¿Desea imprimir copia?' });
        const aparecioAvisoCopia = await avisoCopia
          .waitFor({ state: 'visible', timeout: 5_000 })
          .then(() => true)
          .catch(() => false);
        if (aparecioAvisoCopia) {
          await avisoCopia.locator('button.cancel').click();
          await avisoCopia.waitFor({ state: 'hidden', timeout: TIMEOUTS.PAYMENT_MODAL }).catch(() => {});
        }

        return;
      }

      if (resultado.tipo === 'ventaCompletadaSinPopup') {
        console.log('[confirmarPagoAbriendoCajaSiEsNecesario] Venta completada sin ventana de impresión (carrito vacío detectado) — comportamiento válido de este ambiente.');
        return;
      }

      // El modal "Abrir Caja" apareció: se valida, se completa la apertura y se
      // confirma que desapareció antes de volver al inicio del ciclo, donde se arma
      // una nueva espera de popup/modal antes del siguiente click en "Facturar".
      intentosCaja++;
      if (intentosCaja > MAX_INTENTOS_CAJA) {
        throw new Error(
          `La facturación no se completó tras ${MAX_INTENTOS_CAJA} intentos de abrir la caja: ` +
          'el sistema siguió pidiendo abrir la caja o nunca mostró la ventana de impresión.'
        );
      }
      await expect(this.modalAbrirCaja).toBeVisible();
      await this.completarAperturaCaja();
      await expect(this.modalAbrirCaja).toBeHidden();
    }
  }

  /**
   * Arma la carrera entre los resultados válidos tras confirmar un pago
   * (popup de impresión, modal "Abrir Caja", el panel "Información del
   * Cliente" y, opcionalmente, el SweetAlert "Información de pago") ANTES de
   * ejecutar `accionClick`, para no perder un evento que puede dispararse de
   * forma síncrona junto con la respuesta del click — usado tanto para el
   * click inicial en "Facturar" como para el click en "Pagar" cuando la
   * confirmación opcional aparece.
   *
   * `incluirConfirmacionPago` se desactiva para el click en "Pagar": el modal
   * de confirmación sigue técnicamente visible en el instante en que se arma
   * esa segunda carrera (recién se está cerrando), así que incluirlo ahí
   * resolvería la carrera de inmediato contra el mismo modal en vez de
   * esperar una aparición nueva.
   *
   * Si NINGUNA de estas señales llega (ni popup, ni modal, ni confirmación
   * opcional, ni el panel de cliente), esta función deja que el timeout se
   * propague como rechazo — quien llama
   * (confirmarPagoAbriendoCajaSiEsNecesario()) decide entonces, de forma
   * secuencial y solo en ese momento, si el carrito ya quedó vacío (ambiente
   * que confirma la venta sin ningún popup ni modal) antes de darlo por
   * error real. No se agrega esa comprobación a esta misma carrera para no
   * arriesgar que "carrito vacío" gane la carrera antes de tiempo en
   * ambientes donde el popup sí llega, solo un poco más tarde.
   */
  private async _armarCarreraFacturacion(accionClick: () => Promise<void>, incluirConfirmacionPago: boolean) {
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP })
      .then((printPage) => ({ tipo: 'popup' as const, printPage }));
    const modalPromise = this.modalAbrirCaja.waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP })
      .then(() => ({ tipo: 'modalAbrirCaja' as const }));
    const clienteInfoPromise = this.panelInformacionCliente.waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP })
      .then(() => ({ tipo: 'clienteInfoRequerido' as const }));
    const promesas: Promise<
      { tipo: 'popup'; printPage: Page } | { tipo: 'modalAbrirCaja' } | { tipo: 'confirmacionPago' } | { tipo: 'clienteInfoRequerido' }
    >[] = [popupPromise, modalPromise, clienteInfoPromise];
    if (incluirConfirmacionPago) {
      promesas.push(
        this.confirmacionPago.waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP })
          .then(() => ({ tipo: 'confirmacionPago' as const }))
      );
    }
    const carrera = Promise.race(promesas);

    await accionClick();
    return carrera;
  }

  /** Verifica que no quedan filas en el carrito tras la venta. */
  async validarCarritoVacio() {
    const claves = await this.page.locator(L.CARRITO_CLAVES).count();
    expect(claves).toBe(0);
    await this.page.waitForTimeout(PAUSES.ESTADO_FINAL);
  }
  async buscarProductoEnGrid(...args: Parameters<PosCore['buscarProductoEnGrid']>) {
    return this.core.buscarProductoEnGrid(...args);
  }
  productoPorNombre(...args: Parameters<PosCore['productoPorNombre']>) {
    return this.core.productoPorNombre(...args);
  }
  async agregarProductoPorNombre(...args: Parameters<PosCore['agregarProductoPorNombre']>) {
    return this.core.agregarProductoPorNombre(...args);
  }
  async agregarProductoFraccionadoPorNombre(...args: Parameters<PosCore['agregarProductoFraccionadoPorNombre']>) {
    return this.core.agregarProductoFraccionadoPorNombre(...args);
  }
  async obtenerClavesProductos(...args: Parameters<PosCore['obtenerClavesProductos']>) {
    return this.core.obtenerClavesProductos(...args);
  }
  async obtenerClavesFilasCarrito(...args: Parameters<PosCore['obtenerClavesFilasCarrito']>) {
    return this.core.obtenerClavesFilasCarrito(...args);
  }
  async _extraerArgumentosAddToTable(...args: Parameters<PosCore['_extraerArgumentosAddToTable']>) {
    return this.core._extraerArgumentosAddToTable(...args);
  }
  async obtenerMetadatosProductosVisibles(...args: Parameters<PosCore['obtenerMetadatosProductosVisibles']>) {
    return this.core.obtenerMetadatosProductosVisibles(...args);
  }
  async _cargarMasProductosScrolleando(...args: Parameters<PosCore['_cargarMasProductosScrolleando']>) {
    return this.core._cargarMasProductosScrolleando(...args);
  }
  async localizarPrimerProducto(...args: Parameters<PosCore['localizarPrimerProducto']>) {
    return this.core.localizarPrimerProducto(...args);
  }
  async obtenerPrimerProductoNormal(...args: Parameters<PosCore['obtenerPrimerProductoNormal']>) {
    return this.core.obtenerPrimerProductoNormal(...args);
  }
  async obtenerPrimerProductoNormalConCodigo(...args: Parameters<PosCore['obtenerPrimerProductoNormalConCodigo']>) {
    return this.core.obtenerPrimerProductoNormalConCodigo(...args);
  }
  async obtenerSegundoProductoNormalDistinto(...args: Parameters<PosCore['obtenerSegundoProductoNormalDistinto']>) {
    return this.core.obtenerSegundoProductoNormalDistinto(...args);
  }
  async obtenerPrimerProductoFraccionado(...args: Parameters<PosCore['obtenerPrimerProductoFraccionado']>) {
    return this.core.obtenerPrimerProductoFraccionado(...args);
  }
  async obtenerPrimerProductoConIva(...args: Parameters<PosCore['obtenerPrimerProductoConIva']>) {
    return this.core.obtenerPrimerProductoConIva(...args);
  }
  async obtenerPrimerProductoSinIva(...args: Parameters<PosCore['obtenerPrimerProductoSinIva']>) {
    return this.core.obtenerPrimerProductoSinIva(...args);
  }
  async obtenerPrimerProductoConInventario(...args: Parameters<PosCore['obtenerPrimerProductoConInventario']>) {
    return this.core.obtenerPrimerProductoConInventario(...args);
  }
  async obtenerPrimerServicio(...args: Parameters<PosCore['obtenerPrimerServicio']>) {
    return this.core.obtenerPrimerServicio(...args);
  }
  async obtenerPrimerCombo(...args: Parameters<PosCore['obtenerPrimerCombo']>) {
    return this.core.obtenerPrimerCombo(...args);
  }
  async agregarProductoAlCarrito(...args: Parameters<PosCore['agregarProductoAlCarrito']>) {
    return this.core.agregarProductoAlCarrito(...args);
  }
  async agregarProductoFraccionadoAlCarrito(...args: Parameters<PosCore['agregarProductoFraccionadoAlCarrito']>) {
    return this.core.agregarProductoFraccionadoAlCarrito(...args);
  }
  async agregarProductoDelGridAlCarrito(...args: Parameters<PosCore['agregarProductoDelGridAlCarrito']>) {
    return this.core.agregarProductoDelGridAlCarrito(...args);
  }
  async eliminarProductoDelCarrito(...args: Parameters<PosCore['eliminarProductoDelCarrito']>) {
    return this.core.eliminarProductoDelCarrito(...args);
  }
  async agregarObservacionAProducto(...args: Parameters<PosCore['agregarObservacionAProducto']>) {
    return this.core.agregarObservacionAProducto(...args);
  }
  async obtenerObservacionDeProducto(...args: Parameters<PosCore['obtenerObservacionDeProducto']>) {
    return this.core.obtenerObservacionDeProducto(...args);
  }
  async estaDescuentoGeneralActivo(...args: Parameters<PosCore['estaDescuentoGeneralActivo']>) {
    return this.core.estaDescuentoGeneralActivo(...args);
  }
  async desactivarDescuentoGeneral(...args: Parameters<PosCore['desactivarDescuentoGeneral']>) {
    return this.core.desactivarDescuentoGeneral(...args);
  }
  async aplicarDescuentoIndividual(...args: Parameters<PosCore['aplicarDescuentoIndividual']>) {
    return this.core.aplicarDescuentoIndividual(...args);
  }
  async obtenerTotalProducto(...args: Parameters<PosCore['obtenerTotalProducto']>) {
    return this.core.obtenerTotalProducto(...args);
  }
  async obtenerTotalVentaNumerico(...args: Parameters<PosCore['obtenerTotalVentaNumerico']>) {
    return this.core.obtenerTotalVentaNumerico(...args);
  }

  /**
   * Lee el "Saldo Actual" real de un Apartado ya reabierto (L.TOTAL_LAYAWAY_SALDO_ACTUAL),
   * la fila del footer principal que sí refleja el total original menos los
   * abonos ya aplicados — a diferencia de obtenerTotalVentaNumerico(), que lee
   * el total del modal de pago (L.TOTAL_MODAL) y no se actualiza fuera de ese
   * modal.
   */
  async obtenerSaldoActualApartado(): Promise<number> {
    const texto = await this.page.locator(L.TOTAL_LAYAWAY_SALDO_ACTUAL).textContent();
    return this._leerMontoDeTexto(texto ?? '$0.00');
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

  // ─── Menú de tres puntos: Historial de Facturas / Proformas ──────────────────

  /**
   * Abre el menú de tres puntos del encabezado del POS (Historial de Facturas,
   * Historial de Proformas, Producto externo, etc.).
   *
   * La inestabilidad de este menú tiene dos causas distintas, confirmadas por
   * inspección en vivo del DOM real (cronometraje del upgrade de MDL,
   * document.elementFromPoint en el punto de click, y sondeo de reaparición
   * de overlays):
   *
   *   1. MDL registra el listener que realmente ABRE el menú sobre el <ul
   *      for="demo-menu-lower-left"> (componente "MaterialMenu"), no sobre el
   *      botón (que solo recibe "MaterialButton", puramente visual). Ese
   *      registro es asíncrono y puede tardar segundos tras la navegación.
   *      Por eso se espera explícitamente esa condición real —el atributo
   *      data-upgraded del <ul> conteniendo "MaterialMenu"— antes del primer
   *      intento, en vez de depender únicamente de reintentos.
   *
   *   2. Incluso con MDL ya listo, el modal de permisos de notificación del
   *      navegador puede aparecer de forma asíncrona en cualquier momento
   *      —incluso justo después de haber sido revisado y no encontrado— y
   *      queda físicamente ENCIMA del botón, interceptando el click sin
   *      importar force:true (confirmado con elementFromPoint: el navegador
   *      entrega el evento al elemento que está arriba en esa coordenada, no
   *      al que Playwright pretendía clickear). Por eso los overlays
   *      conocidos se vuelven a comprobar y cerrar en CADA iteración del
   *      bucle, no solo una vez antes de entrar a él.
   *
   * La apertura nunca se asume: se valida contra el DOM real después de cada
   * click, y si ningún intento funciona, el error final incluye un
   * diagnóstico concreto (no un simple "no se abrió") para no tener que
   * repetir esta investigación la próxima vez que ocurra.
   */
  async abrirMenuTresPuntos() {
    // Condición real de que MDL ya registró el listener de apertura —no una
    // pausa arbitraria. Si por algún motivo nunca aparece, no se aborta aquí:
    // el bucle de abajo, con su propio diagnóstico, sigue siendo la fuente de
    // verdad final (no se depende únicamente de esta espera).
    await this.page.locator(L.MENU_TRES_PUNTOS_INICIALIZADO)
      .waitFor({ state: 'attached', timeout: TIMEOUTS.PRODUCTS_LOAD })
      .catch(() => {});

    const MAX_INTENTOS = 4;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      // Overlays conocidos: pueden aparecer en cualquier momento, incluso a
      // mitad de este bucle, así que se revisan de nuevo en cada vuelta.
      await this.cerrarModalNotificacionesSiAparece();
      await this.cerrarAvisoConsecutivoSiAparece();

      // force:true porque el botón tiene una animación CSS continua
      // ("badge-pulse", para destacar ítems "Nuevo" del menú) que lo mantiene
      // permanentemente "inestable" para las validaciones de Playwright —
      // confirmado que es una animación real de la app, no un bug transitorio.
      await this.page.locator(L.MENU_TRES_PUNTOS).click({ force: true });

      // Nunca se asume que abrió: se valida contra el DOM real.
      const abierto = await this.page.locator(L.HISTORIAL_FACTURAS)
        .waitFor({ state: 'visible', timeout: 2_000 })
        .then(() => true)
        .catch(() => false);

      if (abierto) return;
    }

    // Diagnóstico del fallo final: por qué se considera fallido, no solo que lo fue.
    const materialMenuInicializado = await this.page.locator(L.MENU_TRES_PUNTOS_INICIALIZADO).count() > 0;
    const modalNotificacionesVisible = await this.modalNotificaciones.isVisible().catch(() => false);
    const avisoConsecutivoVisible = await this.avisoConsecutivoFueraDeRango.isVisible().catch(() => false);
    const elementoEnElPuntoDeClick = await this.page.evaluate((selector) => {
      const boton = document.querySelector(selector);
      if (!boton) return '(el botón no está en el DOM)';
      const rect = boton.getBoundingClientRect();
      const el = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      if (!el) return '(ningún elemento en ese punto)';
      const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
      const clase = el.className ? `.${el.className.toString().trim().replace(/\s+/g, '.')}` : '';
      return `${el.tagName.toLowerCase()}${id}${clase}`;
    }, L.MENU_TRES_PUNTOS);

    throw new Error(
      `El menú de tres puntos no se abrió tras ${MAX_INTENTOS} intentos.\n` +
      `  - MaterialMenu inicializado (data-upgraded en el <ul>): ${materialMenuInicializado}\n` +
      `  - Modal de notificaciones visible: ${modalNotificacionesVisible}\n` +
      `  - Aviso de consecutivo visible: ${avisoConsecutivoVisible}\n` +
      `  - Elemento que realmente recibiría el click (elementFromPoint): ${elementoEnElPuntoDeClick}`
    );
  }

  /**
   * Presiona "Historial de Facturas" en el menú de tres puntos (ya abierto) y
   * devuelve la ventana emergente que el sistema abre en una pestaña nueva.
   * Click normal (sin force): a diferencia del botón del menú, el ítem ya
   * confirmado visible y asentado sí pasa las validaciones de accionabilidad,
   * y un click real (no forzado) es la señal más confiable de que el evento
   * llega al enlace para disparar la apertura de la pestaña nueva.
   */
  async abrirHistorialFacturas(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.HISTORIAL_FACTURAS).click({ timeout: 5_000 });
    return popupPromise;
  }

  /**
   * Presiona "Historial de Proformas" en el menú de tres puntos (ya abierto) y
   * devuelve la ventana emergente que el sistema abre en una pestaña nueva.
   */
  async abrirHistorialProformas(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.HISTORIAL_PROFORMAS).click({ timeout: 5_000 });
    return popupPromise;
  }
  get categoriaTodos() { return this.core.categoriaTodos; }
  get categoriaCombos() { return this.core.categoriaCombos; }
  categoriaOpcionalPorNombre(...args: Parameters<PosCore['categoriaOpcionalPorNombre']>) {
    return this.core.categoriaOpcionalPorNombre(...args);
  }
  get categoriaTipo() { return this.core.categoriaTipo; }
  get categoriaProductosFraccionados() { return this.core.categoriaProductosFraccionados; }
  get categoriaProductosVariantes() { return this.core.categoriaProductosVariantes; }
  async categoriaEstaActiva(...args: Parameters<PosCore['categoriaEstaActiva']>) {
    return this.core.categoriaEstaActiva(...args);
  }
  get botonVistaLista() { return this.core.botonVistaLista; }
  get botonVistaCuadricula() { return this.core.botonVistaCuadricula; }
  async vistaEstaActiva(...args: Parameters<PosCore['vistaEstaActiva']>) {
    return this.core.vistaEstaActiva(...args);
  }
  async estiloVistaTexto(...args: Parameters<PosCore['estiloVistaTexto']>) {
    return this.core.estiloVistaTexto(...args);
  }
  get tabProductos() { return this.core.tabProductos; }
  get tabServicios() { return this.core.tabServicios; }
  get tabPintura() { return this.core.tabPintura; }
  async tabEstaActivo(...args: Parameters<PosCore['tabEstaActivo']>) {
    return this.core.tabEstaActivo(...args);
  }

  // ─── Wizard "End. Pintura": Vehículo → Parte → Pieza → Servicio → Precio ──────

  /** Locator del modal "Selecciona un precio" que abre un servicio de End. Pintura. */
  get modalSeleccionarPrecio() {
    return this.page.locator(L.DIALOG_SELECCIONAR_PRECIO);
  }

  /**
   * Selecciona el tipo de vehículo en el wizard "End. Pintura". El <select> real
   * está oculto (display:none); el widget "Chosen" que lo reemplaza visualmente
   * es lo único clickeable, confirmado inspeccionando el DOM en vivo — de ahí
   * que se opere sobre `.chosen-single`/`.chosen-results` en vez de `selectOption()`.
   */
  async seleccionarVehiculoPintura(tipo: string) {
    await this.page.locator(L.PINTURA_VEHICULO_TRIGGER).click();
    await this.page.locator(L.PINTURA_VEHICULO_RESULTADO, { hasText: tipo }).click();
  }

  /**
   * Selecciona la primera parte disponible para el vehículo ya elegido (p. ej.
   * "Puerta"). Falla con un mensaje explícito si no aparece ninguna, en vez de
   * dejar que un click a ciegas produzca un timeout genérico más adelante.
   */
  async seleccionarPrimeraParte() {
    await this._clickPrimeraOpcionDisponible(L.PINTURA_PARTE, 'parte');
  }

  /** Selecciona la primera pieza disponible para la parte ya elegida. */
  async seleccionarPrimeraPieza() {
    await this._clickPrimeraOpcionDisponible(L.PINTURA_PIEZA, 'pieza');
  }

  /**
   * Selecciona el primer servicio disponible para la pieza ya elegida. Este
   * paso abre el modal "Selecciona un precio" — no se espera aquí porque cuál
   * de los dos (precio único auto-aplicado o modal con opciones) depende de
   * datos del servicio, y es responsabilidad de quien llama decidir qué esperar.
   */
  async seleccionarPrimerServicioPintura() {
    await this._clickPrimeraOpcionDisponible(L.PINTURA_SERVICIO, 'servicio');
  }

  /**
   * Selecciona el primer precio real disponible en el modal "Selecciona un
   * precio" y espera a que el modal se cierre. Excluye por selector la tarjeta
   * "Agregar precio a este servicio" (crea un precio nuevo, no selecciona uno
   * existente) — esa tarjeta es fija en la interfaz, su rótulo no lo es.
   */
  async seleccionarPrimerPrecioDisponible() {
    await expect(this.modalSeleccionarPrecio).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const precio = this.page.locator(L.PINTURA_PRECIO_OPCION).first();
    await expect(precio, 'No hay ningún precio disponible para este servicio').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await precio.click();

    await expect(this.modalSeleccionarPrecio).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Tras seleccionarPrimerServicioPintura(), determina cuál de los dos
   * caminos válidos tomó el sistema — investigado en vivo (request/response
   * reales de getServiceByPiece + DOM de la tarjeta del servicio):
   *
   * - "agregado_directo": la tarjeta del servicio ya trae el primer precio
   *   pre-cableado como su propio onclick (fillContainerPrices() en
   *   pos_straightening_and_painting.js asigna
   *   prepare_service_before_add_item_to_table(prices[0].sip_id, ...) a la
   *   tarjeta completa apenas se renderiza) — el click en
   *   seleccionarPrimerServicioPintura() ya agregó la línea al carrito, sin
   *   ningún modal de por medio.
   * - "requiere_modal": el servicio no dejó ese onclick directo (o el
   *   sistema decide mostrar el modal "Selecciona un precio" por alguna otra
   *   condición de negocio) y #dialog_select_prices sí aparece — el
   *   elemento sigue existiendo en el DOM (confirmado en vivo) aunque en el
   *   camino de agregado directo nunca se abra.
   *
   * Se arman ambas esperas ANTES de decidir cuál ganó (mismo patrón que
   * confirmarPagoAbriendoCajaSiEsNecesario() usa para popup/modalAbrirCaja),
   * nunca con waitForTimeout(): cada rama se resuelve con su propio
   * expect.poll()/locator.waitFor(), y la que no ocurre expira sola en
   * background sin bloquear el resultado.
   */
  async esperarServicioPinturaAgregadoOModalPrecio(clavesAntes: string[]): Promise<'agregado_directo' | 'requiere_modal'> {
    const agregadoDirecto = expect.poll(
      async () => (await this.obtenerClavesProductos()).length,
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    ).toBeGreaterThan(clavesAntes.length)
      .then(() => 'agregado_directo' as const)
      .catch(() => null);

    const requiereModal = this.modalSeleccionarPrecio
      .waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL })
      .then(() => 'requiere_modal' as const)
      .catch(() => null);

    const resultado = await Promise.race([agregadoDirecto, requiereModal]);
    if (!resultado) {
      throw new Error(
        'Tras seleccionar el servicio de End. Pintura, ni el carrito creció ni apareció el modal "Selecciona un precio" — revisar manualmente.'
      );
    }
    return resultado;
  }
  get modalProductoRapido() { return this.core.modalProductoRapido; }
  get modalBusquedaCabys() { return this.core.modalBusquedaCabys; }
  async abrirProductoRapido(...args: Parameters<PosCore['abrirProductoRapido']>) {
    return this.core.abrirProductoRapido(...args);
  }
  async llenarDatosBasicosProductoRapido(...args: Parameters<PosCore['llenarDatosBasicosProductoRapido']>) {
    return this.core.llenarDatosBasicosProductoRapido(...args);
  }
  async existeCampoCabys(...args: Parameters<PosCore['existeCampoCabys']>) {
    return this.core.existeCampoCabys(...args);
  }
  async manejarCabysSiAplica(...args: Parameters<PosCore['manejarCabysSiAplica']>) {
    return this.core.manejarCabysSiAplica(...args);
  }
  async buscarYAplicarCabys(...args: Parameters<PosCore['buscarYAplicarCabys']>) {
    return this.core.buscarYAplicarCabys(...args);
  }
  get configCabysProductoRapido() { return this.core.configCabysProductoRapido; }
  get configCabysCombo() { return this.core.configCabysCombo; }
  get configCabysProducto() { return this.core.configCabysProducto; }
  async esperarIvaAutocompletado(...args: Parameters<PosCore['esperarIvaAutocompletado']>) {
    return this.core.esperarIvaAutocompletado(...args);
  }

  /**
   * Espera a que el checkbox "¿Aplicar impuesto?" de "Crear Combo" quede
   * marcado tras aplicar un CABYS — homólogo de esperarIvaAutocompletado()
   * para Producto Rápido, pero para el checkbox propio del combo.
   *
   * Contradice lo que se había asumido inicialmente ("el de Combo no tiene
   * ese autocompletado"): confirmado en vivo monitoreando el checkbox cada
   * 500ms tras aplicar un CABYS con el checkbox inicialmente desmarcado, SÍ
   * se autoactiva —con ~500ms de desfase, no instantáneo—, y el select de
   * tasa (`#tax_rate_list`) se sincroniza a la vez con la tasa real del
   * CABYS. Por eso es indispensable esperar este autocompletado ANTES de
   * intentar desactivar el checkbox otra vez (ver crearComboSinIva() en
   * pos.spec.ts): desactivarlo de inmediato, sin esperar, corre el riesgo
   * de ganarle la carrera a esta activación automática y terminar con el
   * checkbox marcado de todos modos.
   */
  async esperarIvaAutocompletadoCombo() {
    await expect.poll(
      () => this.checkboxIvaCombo.isChecked(),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    ).toBe(true);
  }
  async _normalizarPorcentajeCabys(...args: Parameters<PosCore['_normalizarPorcentajeCabys']>) {
    return this.core._normalizarPorcentajeCabys(...args);
  }
  async validarIvaCoincideConCabys(...args: Parameters<PosCore['validarIvaCoincideConCabys']>) {
    return this.core.validarIvaCoincideConCabys(...args);
  }
  async obtenerTasaIvaSeleccionadaPct(...args: Parameters<PosCore['obtenerTasaIvaSeleccionadaPct']>) {
    return this.core.obtenerTasaIvaSeleccionadaPct(...args);
  }

  /**
   * Lee el `percent` de la opción de tasa de IVA realmente seleccionada en
   * "Crear Combo" (`#tax_rate_list`) — homólogo de obtenerTasaIvaSeleccionadaPct()
   * pero para el select propio del combo, que solo queda sincronizado con el
   * CABYS aplicado si el checkbox ya estaba activado ANTES de aplicar ese
   * CABYS (ver el comentario de L.COMBO_TASA_IVA).
   */
  async obtenerTasaIvaSeleccionadaComboPct(): Promise<number> {
    return this.page.locator(L.COMBO_TASA_IVA).evaluate(
      (el) => parseFloat((el as HTMLSelectElement).selectedOptions[0]?.getAttribute('percent') ?? 'NaN')
    );
  }

  /**
   * Valida que la tasa de IVA realmente seleccionada en "Crear Combo"
   * coincide con el IVA que el propio CABYS aplicado sugiere. Solo tiene
   * sentido llamarla cuando el checkbox "¿Aplicar impuesto?" se activó
   * ANTES de aplicar el CABYS (ver activarIvaCombo() + el comentario de
   * L.COMBO_TASA_IVA) — con el checkbox desmarcado en ese momento, el
   * select nunca se sincroniza y esta comparación fallaría sin que sea un
   * error real del sistema.
   *
   * La sincronización no es instantánea (confirmado en vivo: leerla justo
   * después de que el sub-modal de CABYS se cierra todavía puede devolver el
   * valor por defecto "0%", el mismo desfase de un tick de JS que ya obliga
   * a esperarIvaAutocompletado() en Producto Rápido), así que se usa
   * expect.poll() en vez de una lectura + comparación inmediata.
   */
  async validarIvaCoincideConCabysCombo() {
    const cabysTaxTexto = (await this.page.locator(L.COMBO_CABYS_TAX_SUGERIDO).textContent())?.trim() ?? '';
    const cabysTaxPct = this._normalizarPorcentajeCabys(cabysTaxTexto);

    await expect.poll(
      () => this.obtenerTasaIvaSeleccionadaComboPct(),
      {
        timeout: TIMEOUTS.PAYMENT_MODAL,
        message: `La tasa de IVA seleccionada en el combo no coincidió con el IVA definido por el CABYS aplicado (${cabysTaxPct}%)`,
      }
    ).toBeCloseTo(cabysTaxPct, 1);
  }
  async obtenerTotalIvaGeneral(...args: Parameters<PosCore['obtenerTotalIvaGeneral']>) {
    return this.core.obtenerTotalIvaGeneral(...args);
  }
  async establecerCantidadProductoRapido(...args: Parameters<PosCore['establecerCantidadProductoRapido']>) {
    return this.core.establecerCantidadProductoRapido(...args);
  }
  async estaMostrandoPrecioConIva(...args: Parameters<PosCore['estaMostrandoPrecioConIva']>) {
    return this.core.estaMostrandoPrecioConIva(...args);
  }
  async establecerMostrarPrecioConIva(...args: Parameters<PosCore['establecerMostrarPrecioConIva']>) {
    return this.core.establecerMostrarPrecioConIva(...args);
  }
  async obtenerDatosLineaCarrito(...args: Parameters<PosCore['obtenerDatosLineaCarrito']>) {
    return this.core.obtenerDatosLineaCarrito(...args);
  }
  async obtenerClaveDeLineaPorNombre(...args: Parameters<PosCore['obtenerClaveDeLineaPorNombre']>) {
    return this.core.obtenerClaveDeLineaPorNombre(...args);
  }
  async validarLineaCarrito(...args: Parameters<PosCore['validarLineaCarrito']>) {
    return this.core.validarLineaCarrito(...args);
  }
  async validarLineasCarrito(...args: Parameters<PosCore['validarLineasCarrito']>) {
    return this.core.validarLineasCarrito(...args);
  }
  calcularTotalImpuestosEsperado(...args: Parameters<PosCore['calcularTotalImpuestosEsperado']>) {
    return this.core.calcularTotalImpuestosEsperado(...args);
  }
  calcularSubtotalEsperado(...args: Parameters<PosCore['calcularSubtotalEsperado']>) {
    return this.core.calcularSubtotalEsperado(...args);
  }
  async validarResumenImpuestos(...args: Parameters<PosCore['validarResumenImpuestos']>) {
    return this.core.validarResumenImpuestos(...args);
  }
  async seleccionarIvaManualmente(...args: Parameters<PosCore['seleccionarIvaManualmente']>) {
    return this.core.seleccionarIvaManualmente(...args);
  }
  async guardarProductoRapido(...args: Parameters<PosCore['guardarProductoRapido']>) {
    return this.core.guardarProductoRapido(...args);
  }
  async guardarProductoRapidoYObtenerRespuesta(...args: Parameters<PosCore['guardarProductoRapidoYObtenerRespuesta']>) {
    return this.core.guardarProductoRapidoYObtenerRespuesta(...args);
  }
  async agregarProductoRapidoParaValidacionIva(...args: Parameters<PosCore['agregarProductoRapidoParaValidacionIva']>) {
    return this.core.agregarProductoRapidoParaValidacionIva(...args);
  }

  // ─── "Crear Combo" ──────────────────────────────────────────────────────────

  /** Locator del modal "Crear Combo". */
  get modalCrearCombo() {
    return this.page.locator(L.DIALOG_CREAR_COMBO);
  }

  /**
   * Expande el FAB y abre el modal "Crear Combo". El ítem "Agregar combo"
   * queda con bounding box 0×0 de forma efímera (confirmado en vivo con
   * getBoundingClientRect: el estado "visible" que reporta Playwright puede
   * durar apenas milisegundos antes de volver a colapsar), así que —a
   * diferencia de abrirProductoRapido()— la comprobación de expansión usa
   * isVisible() puntual (sin esperar/poll) dentro de un ciclo corto y
   * frecuente, en vez de waitFor(): un poll que tarda en resolver puede
   * capturar el ítem apenas antes de que vuelva a colapsar, dejando el click
   * posterior actuando sobre un box ya vacío de nuevo.
   *
   * A diferencia de "Producto Rápido" (que usa `data-toggle="modal"` sobre
   * contenido ya presente en el DOM), el ítem "Agregar combo" dispara
   * `add_restaurant_combo(0)`, que carga el contenido del modal por AJAX
   * antes de mostrarlo —confirmado en vivo, incluye su propia llamada a
   * `get_combo_pharmaceutical()`—, así que el modal puede tardar bastante
   * más en aparecer que el de Producto Rápido: se espera con un timeout
   * generoso (TIMEOUTS.PRODUCTS_LOAD) después del único click sobre el ítem.
   */
  async abrirCrearCombo() {
    const toggle = this.page.locator(L.FAB_TOGGLE);
    const item = this.page.locator(L.FAB_ITEM_CREAR_COMBO);

    const MAX_INTENTOS = 15;
    let expandido = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !expandido; intento++) {
      await this.cerrarModalNotificacionesSiAparece();
      await toggle.click({ force: true });
      expandido = await item.isVisible().catch(() => false);
      if (!expandido) await this.page.waitForTimeout(300);
    }

    if (!expandido) {
      throw new Error(`El botón flotante del POS no se pudo expandir tras ${MAX_INTENTOS} intentos.`);
    }

    await item.click({ force: true });
    await expect(
      this.modalCrearCombo,
      'El modal "Crear Combo" no apareció tras clickear "Agregar combo" en el FAB'
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
  }

  /**
   * Llena nombre y cantidad en el formulario "Crear Combo" ya abierto. El
   * precio final NO se llena aquí: debe fijarse después de agregar los
   * productos (ver establecerPrecioValidoCombo()), porque el sistema lo
   * valida contra la suma de sus precios.
   */
  async llenarDatosBasicosCombo(nombre: string, cantidad = '1') {
    await this.page.locator(L.COMBO_NOMBRE).fill(nombre);
    await this.page.locator(L.COMBO_CANTIDAD).fill(cantidad);
  }

  /**
   * Busca un producto por texto en el buscador propio de "Crear Combo"
   * (Enter dispara la búsqueda — confirmado en vivo, no hay botón submit) y
   * agrega el primer resultado disponible: mismo criterio de "primera opción
   * disponible" que ya usa el resto de la suite para catálogos configurables
   * por compañía sin nombre estable (CABYS, IVA, parte/pieza/servicio de End.
   * Pintura). Los resultados son `<div onclick="get_product_combo(...)">`,
   * no `<a>` ni filas con un botón propio — confirmado inspeccionando el DOM
   * en vivo — así que se clickean vía evaluate() en vez de un locator.click()
   * normal, que no encuentra un target accionable estándar ahí.
   */
  async buscarYAgregarPrimerProductoAlCombo(termino: string) {
    const buscador = this.page.locator(L.COMBO_BUSCADOR_PRODUCTO);
    await buscador.fill(termino);
    await buscador.press('Enter');

    const resultado = this.page.locator(L.COMBO_RESULTADO_ITEM).first();
    await expect(resultado, `No hubo resultados de producto para "${termino}" al crear el combo`).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const productosAntes = await this.page.locator(L.COMBO_PRODUCTO_EN_LISTA).count();
    await this.page.evaluate((selector) => {
      (document.querySelector(selector) as HTMLElement | null)?.click();
    }, L.COMBO_RESULTADO_ITEM);

    await expect(
      this.page.locator(L.COMBO_PRODUCTO_EN_LISTA),
      `El producto buscado ("${termino}") no se agregó a la lista del combo`
    ).toHaveCount(productosAntes + 1, { timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /** Lee el "Precio real" del combo: la suma de precios de los productos ya agregados. */
  async obtenerPrecioRealCombo(): Promise<number> {
    const texto = await this.page.locator(L.COMBO_PRECIO_REAL).textContent();
    return parseFloat((texto ?? '0').replace(/[^0-9.]/g, '')) || 0;
  }

  /**
   * Fija un precio final válido para el combo, a partir del "Precio real"
   * (suma de precios de los productos ya agregados) — nunca un monto fijo
   * arbitrario. Regla de negocio descubierta inspeccionando la app en vivo
   * (no documentada): si el precio final supera esa suma, el sistema
   * rechaza el guardado en el propio cliente, sin disparar ningún request
   * de red, mostrando solo el toast "El precio del combo es mayor al precio
   * del producto" — confirmado interceptando la red y la consola tras el
   * click en "Guardar combo". Devuelve el precio fijado, por si el test
   * necesita usarlo para validar el carrito después.
   */
  async establecerPrecioValidoCombo(porcentajeDelPrecioReal = 0.8): Promise<number> {
    const precioReal = await this.obtenerPrecioRealCombo();
    expect(precioReal, 'El "Precio real" del combo es 0 — no se agregó ningún producto todavía').toBeGreaterThan(0);

    const precioValido = parseFloat((precioReal * porcentajeDelPrecioReal).toFixed(2));
    await this.page.locator(L.COMBO_PRECIO_FINAL).fill(String(precioValido));
    return precioValido;
  }

  /**
   * Presiona "Guardar combo" y devuelve la respuesta real de la petición que
   * lo persiste (save_company_combo) — misma señal de éxito a nivel de red
   * que ya usa guardarProductoRapidoYObtenerRespuesta() para Producto
   * Rápido, no solo el efecto visual de que el modal se cerró.
   */
  async guardarComboYObtenerRespuesta() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_COMBO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.COMBO_BTN_GUARDAR).click({ force: true });
    return respuestaPromise;
  }

  /**
   * Fija un precio válido y guarda el combo ya configurado, validando la
   * respuesta real de red (save_company_combo) — mismo cierre reutilizado
   * por crearComboConIva()/crearComboSinIva(). Centralizado aquí: existía
   * duplicado de forma idéntica como función local en pos-crear.spec.ts y
   * pos.spec.ts.
   */
  async guardarComboConfigurado() {
    await this.establecerPrecioValidoCombo();

    const respuesta = await this.guardarComboYObtenerRespuesta();
    expect(respuesta.ok(), `La petición a save_company_combo no respondió OK (status ${respuesta.status()})`).toBe(true);
    await expect(this.modalCrearCombo).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Pasos comunes a ambos escenarios de "Crear Combo": abrir el modal, llenar
   * nombre/cantidad y agregar un producto real. El manejo del checkbox de IVA
   * y de CABYS es responsabilidad de cada escenario (crearComboConIva /
   * crearComboSinIva), porque el orden entre ambos —no solo su presencia—
   * determina el resultado (ver el comentario de activarIvaCombo()):
   * factorizarlo aquí evitaría poder expresar ese orden.
   *
   * El producto que se agrega al combo se localiza por característica
   * funcional (obtenerPrimerProductoNormal()) ANTES de abrir el modal —el
   * propio grid del POS, no el buscador del combo—, y su nombre real se usa
   * como término de búsqueda dentro de "Crear Combo"
   * (buscarYAgregarPrimerProductoAlCombo ya toma "el primer resultado
   * disponible", nunca un nombre exacto): garantiza una coincidencia real sin
   * depender de ningún nombre fijo del catálogo.
   *
   * Centralizado aquí: existía duplicado de forma idéntica como función
   * local en pos-crear.spec.ts y pos.spec.ts.
   */
  async abrirCrearComboConProducto(nombre: string) {
    const productoReal = await this.obtenerPrimerProductoNormal();
    await this.abrirCrearCombo();
    await this.llenarDatosBasicosCombo(nombre);
    await this.buscarYAgregarPrimerProductoAlCombo(productoReal.nombre);
  }

  /**
   * Escenario "Crear Combo con IVA": activa el checkbox "¿Aplicar impuesto?"
   * PRIMERO y verifica que quedó marcado, y solo después maneja CABYS (si el
   * formulario lo ofrece en este ambiente — depende del país configurado para
   * la compañía, no es fijo). Ese orden es obligatorio, no cosmético:
   * confirmado en vivo que el select de tasa (`#tax_rate_list`) SOLO se
   * autosincroniza con la tasa real del CABYS aplicado si el checkbox ya
   * estaba activado en ese momento — con el checkbox desmarcado, aplicar el
   * mismo CABYS deja el select en su valor por defecto ("0% Exento") sin
   * tocarlo. Por eso, a diferencia de una versión anterior de este helper,
   * activarIvaCombo() ya no se limita a ser un respaldo para cuando CABYS no
   * aparece: es el primer paso siempre.
   *
   * Si CABYS aparece, se aplica (CABYS_BUSQUEDA = "aceite", tasa 13%) y se
   * valida que la tasa seleccionada en el combo coincide exactamente con la
   * tasa que el propio CABYS sugiere (validarIvaCoincideConCabysCombo()) — no
   * solo que "algo" quedó aplicado. Si CABYS no aparece, no se lo toca: el
   * checkbox ya activado en el paso anterior es la única señal de "con IVA"
   * disponible en ese ambiente.
   *
   * Devuelve si CABYS terminó aplicado, para que el test lo registre.
   * Centralizado aquí: existía duplicado de forma idéntica como función
   * local en pos-crear.spec.ts y pos.spec.ts.
   */
  async crearComboConIva(nombre: string): Promise<boolean> {
    await this.abrirCrearComboConProducto(nombre);

    await this.activarIvaCombo();
    await expect(
      this.checkboxIvaCombo,
      'El checkbox "¿Aplicar impuesto?" de "Crear Combo" no quedó activado'
    ).toBeChecked();

    const cabysAplicado = await this.manejarCabysSiAplica(CABYS_BUSQUEDA, this.configCabysCombo);
    if (cabysAplicado) {
      await this.validarIvaCoincideConCabysCombo();
    }

    await this.guardarComboConfigurado();
    return cabysAplicado;
  }

  /**
   * Escenario "Crear Combo sin IVA": "sin IVA" es simplemente no agregarlo —
   * el checkbox "¿Aplicar impuesto?" ya está desactivado por defecto al abrir
   * el modal, así que no hace falta tocarlo de entrada. "Sin IVA" tampoco se
   * simula buscando deliberadamente un CABYS de clasificación "Exento":
   * CABYS es un campo fiscal obligatorio independiente del checkbox, así que
   * se usa el mismo término que el escenario "con IVA" (CABYS_BUSQUEDA,
   * "aceite") si el formulario lo ofrece en este ambiente.
   *
   * Aplicar ese CABYS SÍ activa el checkbox de IVA como efecto secundario —
   * confirmado en vivo, con un desfase de ~500ms (ver
   * esperarIvaAutocompletadoCombo(), homóloga de esperarIvaAutocompletado()
   * de Producto Rápido) — así que hay que ESPERAR esa activación automática
   * antes de revertirla: desactivar el checkbox de inmediato, sin esperar,
   * corre el riesgo de ganarle la carrera al propio sistema y terminar con
   * el checkbox marcado de todos modos.
   *
   * Nota de comportamiento real del sistema (confirmado en vivo): esperando
   * correctamente esa auto-activación antes de revertirla, el checkbox
   * termina realmente desactivado, y el combo queda guardado con
   * `product_hide_apply_iva_<clave>="0"` e IVA real = 0 en el carrito, sin
   * importar si se aplicó un CABYS o no.
   *
   * Devuelve si CABYS terminó aplicado, para que el test lo registre.
   * Centralizado aquí: existía duplicado de forma idéntica como función
   * local en pos-crear.spec.ts y pos.spec.ts.
   */
  async crearComboSinIva(nombre: string): Promise<boolean> {
    await this.abrirCrearComboConProducto(nombre);

    const cabysAplicado = await this.manejarCabysSiAplica(CABYS_BUSQUEDA, this.configCabysCombo);
    if (cabysAplicado) {
      await this.esperarIvaAutocompletadoCombo();
      await this.desactivarIvaCombo();
    }

    await expect(
      this.checkboxIvaCombo,
      'El checkbox "¿Aplicar impuesto?" de "Crear Combo" no quedó desactivado'
    ).not.toBeChecked();

    await this.guardarComboConfigurado();
    return cabysAplicado;
  }

  /**
   * Busca por nombre exacto el combo recién creado en la categoría "Combos"
   * (reutilizando productoPorNombre/agregarProductoPorNombre, igual que el
   * resto de la suite para cualquier producto del catálogo) y devuelve la
   * clave de la línea que se agregó al carrito. Centralizado aquí: existía
   * duplicado de forma idéntica como función local en pos-crear.spec.ts y
   * pos.spec.ts.
   */
  async buscarComboYAgregarAlCarrito(nombre: string): Promise<string> {
    await this.categoriaCombos.click();
    await esperarQuedaActivo(() => this.categoriaEstaActiva(this.categoriaCombos));
    await expect(
      this.productoPorNombre(nombre),
      `El combo "${nombre}" no aparece en la categoría "Combos"`
    ).toHaveCount(1, { timeout: TIMEOUTS.PRODUCTS_LOAD });

    const clavesAntes = await this.obtenerClavesProductos();
    await this.agregarProductoPorNombre(nombre);
    await expect.poll(async () => (await this.obtenerClavesProductos()).length).toBeGreaterThan(clavesAntes.length);
    const clavesDespues = await this.obtenerClavesProductos();
    return clavesDespues.find((c) => !clavesAntes.includes(c))!;
  }

  // ─── "Crear Producto" (primera tarjeta del grid de productos del POS) ──────
  //
  // Confirmado en vivo que este flujo NO es el mismo que "Inventario → Crear
  // Producto" del menú lateral (esa es una página completamente distinta,
  // /prod/product, con su propio wizard de 6 pasos) — este es un modal
  // embebido en el propio POS, con la misma arquitectura de wizard jQuery
  // Steps de 3 pasos que ya usa "Crear Combo" (Anterior/Guardar/Siguiente/
  // Finalizar/Cancelar), abierto desde la primera tarjeta especial del grid
  // de productos (`.product_box_new_item`, onclick="add_product_modal(...)").

  /** Locator del modal "Crear Producto". */
  get modalCrearProducto() {
    return this.page.locator(L.DIALOG_CREAR_PRODUCTO);
  }

  /** Locator del checkbox "¿Aplica Impuesto?" propio de "Crear Producto". */
  get checkboxIvaProducto() {
    return this.page.locator(L.PRODUCTO_APLICAR_IVA);
  }

  /**
   * Abre el modal "Crear Producto" desde la primera tarjeta del grid de
   * productos del POS. A diferencia del FAB (Producto Rápido/Combo), esta
   * tarjeta es parte del grid normal — un click simple basta, sin el ciclo
   * de expansión/reintento que sí necesita el FAB.
   */
  async abrirCrearProducto() {
    await this.cerrarModalNotificacionesSiAparece();
    await this.page.locator(L.PRODUCTO_TARJETA_CREAR).click();
    await expect(
      this.modalCrearProducto,
      'El modal "Crear Producto" no apareció tras clickear la tarjeta "Crear Producto" del grid'
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
  }

  /** Llena únicamente el nombre del producto (paso "Inf. General") — lo único obligatorio de ese paso. */
  async llenarNombreProducto(nombre: string) {
    await this.page.locator(L.PRODUCTO_NOMBRE).fill(nombre);
  }

  /**
   * Llena los campos adicionales de "Inf. General" para un producto Completo
   * o Fraccionado: marca, categoría/subcategoría/proveedor (Chosen, primera
   * opción real disponible — mismo criterio que el resto de la suite para
   * catálogos sin nombre estable), código de proveedor y código de barras.
   * Categoría y Proveedor NO son realmente obligatorios para guardar
   * (confirmado en vivo: el paso avanza igual sin seleccionarlos), pero el
   * escenario "Completo"/"Fraccionado" los llena de todos modos porque el
   * usuario los pidió explícitamente en la lista de campos.
   */
  async llenarDatosCompletosProducto(marca: string, codigoProveedor: string, codigoBarras: string) {
    await this.page.locator(L.PRODUCTO_MARCA).fill(marca);
    await this._seleccionarPrimeraOpcionChosen(L.PRODUCTO_CATEGORIA_CHOSEN);
    await this._seleccionarPrimeraOpcionChosenSiHayOpciones(L.PRODUCTO_SUBCATEGORIA_CHOSEN);
    await this._seleccionarPrimeraOpcionChosen(L.PRODUCTO_PROVEEDOR_CHOSEN);
    await this.page.locator(L.PRODUCTO_PROVEEDOR_CODIGO).fill(codigoProveedor);
    await this.page.locator(L.PRODUCTO_CODIGO_BARRAS).fill(codigoBarras);
  }

  /**
   * Avanza del paso "Inf. General" al paso "Costos" y espera la respuesta
   * real de red que efectivamente crea el producto (saveProductStepOne,
   * responde con `product_id`) — confirmado en vivo interceptando la red,
   * no solo el efecto visual del wizard.
   */
  async avanzarPasoInfoGeneralProducto() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_PRODUCTO_PASO1),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.PRODUCTO_WIZARD_SIGUIENTE).click();
    const respuesta = await respuestaPromise;
    const cuerpo = await respuesta.json();
    expect(cuerpo.status, `saveProductStepOne no respondió status=1: ${JSON.stringify(cuerpo)}`).toBe(1);
    await expect(this.page.locator(L.PRODUCTO_COSTO)).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /** Llena únicamente el Costo (paso "Costos") — el único campo común entre el modo simple y el fraccionado, ver L.PRODUCTO_FRACCIONAR. */
  async llenarCostoProducto(costo: string) {
    await this.page.locator(L.PRODUCTO_COSTO).fill(costo);
  }

  /** Llena costo, precio de venta y cantidad (paso "Costos", producto Sencillo/Completo — sin fraccionar). */
  async llenarCostosBasicosProducto(costo: string, precioVenta: string, cantidad: string) {
    await this.llenarCostoProducto(costo);
    await this.page.locator(L.PRODUCTO_PRECIO_VENTA).fill(precioVenta);
    await this.page.locator(L.PRODUCTO_CANTIDAD).fill(cantidad);
  }

  /**
   * Llena los campos adicionales de "Costos" para un producto Completo o
   * Fraccionado: stock mínimo, descuento de proveedor, descuento máximo,
   * tipo de unidad y sección/sub sección (Chosen, primera opción real).
   *
   * "Descuento de proveedor" (#product_discount_app) se omite si no está
   * interactuable — confirmado en vivo (reproducido de forma determinística,
   * esperando hasta 120s sin recuperación): cuando el producto tiene un
   * CABYS aplicado Y "¿Fraccionar?" activado A LA VEZ, este campo colapsa a
   * ancho 0 de forma PERMANENTE, no transitoria (sin CABYS aplicado se
   * mantiene interactuable sin importar el estado de IVA — probado
   * explícitamente activando IVA manualmente sin CABYS, y también sin IVA).
   * No es un problema de timing de este lado: es un efecto real y
   * reproducible de la propia app al combinar esos dos estados. El campo no
   * es obligatorio para guardar (solo precio por caja y precio por fracción
   * lo son en un producto Fraccionado), así que se omite en vez de fallar.
   */
  async llenarCostosCompletosProducto(stockMinimo: string, descuentoProveedor: string, descuentoMaximo: string) {
    await this.page.locator(L.PRODUCTO_STOCK_MINIMO).fill(stockMinimo);
    await this._llenarDescuentoProveedorSiEsPosible(descuentoProveedor);
    await this.page.locator(L.PRODUCTO_DESCUENTO_MAXIMO).fill(descuentoMaximo);
    await this._seleccionarPrimeraOpcionChosen(L.PRODUCTO_TIPO_UNIDAD_CHOSEN);
    await this._seleccionarPrimeraOpcionChosen(L.PRODUCTO_SECCION_CHOSEN);
    await this._seleccionarPrimeraOpcionChosenSiHayOpciones(L.PRODUCTO_SUBSECCION_CHOSEN);
  }

  /**
   * Ver el comentario de llenarCostosCompletosProducto(): omite el campo si
   * quedó permanentemente no interactuable (CABYS + Fraccionado a la vez).
   *
   * Intenta el fill() directamente, con un timeout propio acotado, en vez
   * de comprobar isVisible() primero y llenar después: separar "verificar"
   * de "actuar" deja una ventana real donde el campo puede leerse visible
   * en el chequeo y volverse no interactuable un instante después (el mismo
   * colapso de layout, a mitad de camino) — confirmado en vivo: ese orden
   * dejó pasar la condición y el fill() posterior, sin timeout propio,
   * esperó los 300s completos del test. Intentar el fill() de una sola vez
   * con su propio límite corto evita esa ventana.
   */
  private async _llenarDescuentoProveedorSiEsPosible(descuentoProveedor: string) {
    const campo = this.page.locator(L.PRODUCTO_DESCUENTO_PROVEEDOR);
    const relleno = await campo.fill(descuentoProveedor, { timeout: 5_000 }).then(() => true).catch(() => false);
    if (!relleno) {
      console.log('[llenarCostosCompletosProducto] "Descuento de proveedor" no quedó interactuable a tiempo (CABYS + Fraccionado a la vez) — se omite, no es obligatorio.');
    }
  }

  /**
   * Activa el checkbox "¿Aplica Impuesto?" de "Crear Producto". Reutiliza el
   * mismo helper genérico que ya usan Producto Rápido y Combo.
   */
  async activarIvaProducto() {
    await this._asegurarCheckboxEstado(this.checkboxIvaProducto, 'apply_tax_check_app', true);
  }

  /** Desactiva el checkbox "¿Aplica Impuesto?" de "Crear Producto" — contraparte de activarIvaProducto(). */
  async desactivarIvaProducto() {
    await this._asegurarCheckboxEstado(this.checkboxIvaProducto, 'apply_tax_check_app', false);
  }

  /**
   * Selecciona manualmente el primer tipo y la primera tasa de IVA reales
   * disponibles en "Crear Producto" (excluyendo el placeholder "Seleccione
   * una opción"). A diferencia de Producto Rápido/Combo, estos son
   * `<select>` NATIVOS sin Chosen (ver L.PRODUCTO_TIPO_IVA/PRODUCTO_TASA_IVA),
   * así que se usa `selectOption({index: 1})` directo en vez del clic-y-
   * elegir de un widget Chosen.
   *
   * Confirmado en vivo que hace falta: activar el checkbox NO deja ninguna
   * opción real preseleccionada (a diferencia de "Crear Combo", donde sí
   * queda una opción real apenas se marca el checkbox) — dejarlo así
   * bloqueaba silenciosamente el avance del wizard al presionar "Siguiente"
   * (sin error visible, solo nunca llegaba la petición de red esperada).
   * Solo tiene sentido llamarlo cuando el CABYS NO se aplicó — si se aplicó,
   * el IVA debe venir de él, no de una selección manual.
   */
  async seleccionarIvaManualmenteProducto() {
    await this.page.locator(L.PRODUCTO_TIPO_IVA).selectOption({ index: 1 });
    await this.page.locator(L.PRODUCTO_TASA_IVA).selectOption({ index: 1 });
  }

  /**
   * Activa el checkbox "¿Fraccionar?" de "Crear Producto". Al marcarlo, el
   * sistema reemplaza los campos simples de precio por los grupos "por
   * caja" y "por fracción" — confirmado en vivo comparando el DOM antes/
   * después (ver el comentario de L.PRODUCTO_FRACCIONAR).
   */
  async activarFraccionarProducto() {
    await this._asegurarCheckboxEstado(this.page.locator(L.PRODUCTO_FRACCIONAR), 'is_fragment_app', true);
    await expect(this.page.locator(L.PRODUCTO_PRECIO_CAJA)).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Llena los campos obligatorios que aparecen al activar "¿Fraccionar?":
   * precio por caja y precio por fracción (los únicos con `required` real,
   * confirmado en vivo comparando el DOM antes/después del checkbox — no
   * asumido), más cantidad por caja y fracciones por unidad para que los
   * precios tengan sentido de negocio.
   */
  async llenarCostosFraccionadoProducto(precioCaja: string, precioFraccion: string, cantidadCaja: string, fraccionesPorUnidad: string) {
    await this.page.locator(L.PRODUCTO_PRECIO_CAJA).fill(precioCaja);
    await this.page.locator(L.PRODUCTO_CANTIDAD_CAJA).fill(cantidadCaja);
    await this.page.locator(L.PRODUCTO_FRACCIONES_POR_UNIDAD).fill(fraccionesPorUnidad);
    await this.page.locator(L.PRODUCTO_PRECIO_FRACCION).fill(precioFraccion);
  }

  /** Lee el `percent` de la opción de tasa de IVA realmente seleccionada en "Crear Producto" (select nativo, sin Chosen). */
  async obtenerTasaIvaSeleccionadaProductoPct(): Promise<number> {
    return this.page.locator(L.PRODUCTO_TASA_IVA).evaluate(
      (el) => parseFloat((el as HTMLSelectElement).selectedOptions[0]?.getAttribute('percent') ?? 'NaN')
    );
  }

  /**
   * Valida que la tasa de IVA realmente seleccionada en "Crear Producto"
   * coincide con el IVA que el propio CABYS aplicado sugiere — mismo
   * criterio que validarIvaCoincideConCabysCombo(). Usa expect.poll() por
   * la misma razón (la sincronización tras aplicar el CABYS no es
   * necesariamente instantánea en los otros formularios de esta suite).
   */
  async validarIvaCoincideConCabysProducto() {
    const cabysTaxTexto = (await this.page.locator(L.PRODUCTO_CABYS_TAX_SUGERIDO).textContent())?.trim() ?? '';
    const cabysTaxPct = this._normalizarPorcentajeCabys(cabysTaxTexto);

    await expect.poll(
      () => this.obtenerTasaIvaSeleccionadaProductoPct(),
      {
        timeout: TIMEOUTS.PAYMENT_MODAL,
        message: `La tasa de IVA seleccionada en "Crear Producto" no coincidió con el IVA definido por el CABYS aplicado (${cabysTaxPct}%)`,
      }
    ).toBeCloseTo(cabysTaxPct, 1);
  }

  /**
   * Avanza del paso "Costos" al paso "Desc. Producto" y espera la respuesta
   * real de red (updateProductSteptwo) — confirmado en vivo interceptando
   * la red.
   */
  async avanzarPasoCostosProducto() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_PRODUCTO_PASO2),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.PRODUCTO_WIZARD_SIGUIENTE).click();
    await respuestaPromise;
    await expect(this.page.locator(L.PRODUCTO_DESCRIPCION)).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /** Llena tamaño y descripción (paso "Desc. Producto", producto Completo/Fraccionado). */
  async llenarDescripcionProducto(tamano: string, descripcion: string) {
    await this.page.locator(L.PRODUCTO_TAMANO).fill(tamano);
    await this.page.locator(L.PRODUCTO_DESCRIPCION).fill(descripcion);
  }

  /**
   * Presiona "Finalizar" (solo visible en el último paso) y espera la
   * respuesta real de red que cierra el wizard (updateProductStepthree) —
   * confirmado en vivo que tras esta petición el modal se cierra solo.
   */
  async finalizarCrearProducto() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_PRODUCTO_PASO3),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.PRODUCTO_WIZARD_FINALIZAR).click();
    const respuesta = await respuestaPromise;
    expect(respuesta.ok(), `La petición a updateProductStepthree no respondió OK (status ${respuesta.status()})`).toBe(true);
    await expect(this.modalCrearProducto).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }
  async existePestanaPos(...args: Parameters<PosCore['existePestanaPos']>) {
    return this.core.existePestanaPos(...args);
  }
  async visitarPestanaPos(...args: Parameters<PosCore['visitarPestanaPos']>) {
    return this.core.visitarPestanaPos(...args);
  }
  async pestanaPosActiva(...args: Parameters<PosCore['pestanaPosActiva']>) {
    return this.core.pestanaPosActiva(...args);
  }
  async localizarPestanaApartados(...args: Parameters<PosCore['localizarPestanaApartados']>) {
    return this.core.localizarPestanaApartados(...args);
  }
  async seleccionarClienteExistente(...args: Parameters<PosCore['seleccionarClienteExistente']>) {
    return this.core.seleccionarClienteExistente(...args);
  }
  async seleccionarClienteExistenteDistintoDe(...args: Parameters<PosCore['seleccionarClienteExistenteDistintoDe']>) {
    return this.core.seleccionarClienteExistenteDistintoDe(...args);
  }
  async ingresarNombreCliente(...args: Parameters<PosCore['ingresarNombreCliente']>) {
    return this.core.ingresarNombreCliente(...args);
  }
  async _clickPrimeraOpcionDisponible(...args: Parameters<PosCore['_clickPrimeraOpcionDisponible']>) {
    return this.core._clickPrimeraOpcionDisponible(...args);
  }
  async _seleccionarPrimeraOpcionChosen(...args: Parameters<PosCore['_seleccionarPrimeraOpcionChosen']>) {
    return this.core._seleccionarPrimeraOpcionChosen(...args);
  }
  async _seleccionarPrimeraOpcionChosenSiHayOpciones(...args: Parameters<PosCore['_seleccionarPrimeraOpcionChosenSiHayOpciones']>) {
    return this.core._seleccionarPrimeraOpcionChosenSiHayOpciones(...args);
  }
  async _asegurarCheckboxEstado(...args: Parameters<PosCore['_asegurarCheckboxEstado']>) {
    return this.core._asegurarCheckboxEstado(...args);
  }
  async asegurarCheckboxIvaMarcado(...args: Parameters<PosCore['asegurarCheckboxIvaMarcado']>) {
    return this.core.asegurarCheckboxIvaMarcado(...args);
  }

  /** Locator del checkbox "¿Aplicar impuesto?" propio de "Crear Combo", expuesto para que los tests verifiquen su estado directamente. */
  get checkboxIvaCombo() {
    return this.page.locator(L.COMBO_APLICAR_IVA);
  }

  /**
   * Activa el checkbox "¿Aplicar impuesto?" de "Crear Combo". A diferencia
   * del checkbox de "Producto Rápido", este NO tiene el bug de reseteo de
   * pos.js:680-699 (confirmado en vivo: permanece marcado incluso varios
   * segundos después de activarlo), así que no hace falta la espera de 5s ni
   * el doble reafirmado que sí necesita seleccionarIvaManualmente(). Tampoco
   * hace falta interactuar con los "Chosen" de tipo/tasa de impuesto: ambos
   * ya quedan en una opción real (no en un placeholder "Seleccionar...")
   * apenas se marca el checkbox — confirmado en vivo leyendo su `value`
   * inmediatamente después del click.
   *
   * IMPORTANTE (confirmado en vivo, contradice lo asumido originalmente):
   * si este checkbox se activa ANTES de aplicar un CABYS, el select de tasa
   * (`#tax_rate_list`) SÍ se autosincroniza con la tasa real del CABYS —
   * ver L.COMBO_TASA_IVA y validarIvaCoincideConCabysCombo(). El orden
   * activar→CABYS es entonces obligatorio para el escenario "con IVA".
   */
  async activarIvaCombo() {
    await this._asegurarCheckboxEstado(this.page.locator(L.COMBO_APLICAR_IVA), 'apply_tax_combo', true);
  }

  /**
   * Desactiva el checkbox "¿Aplicar impuesto?" de "Crear Combo" — contraparte
   * de activarIvaCombo(), reutilizando el mismo helper genérico
   * (_asegurarCheckboxEstado) en vez de duplicar la lógica de click/poll.
   * Usada tanto para dejar el combo explícitamente "sin IVA" como para
   * re-forzar ese estado después de aplicar un CABYS (defensivo: aunque no
   * se confirmó en vivo que aplicar un CABYS reactive este checkbox por su
   * cuenta, tampoco hay garantía de que no lo haga en otro ambiente/versión).
   */
  async desactivarIvaCombo() {
    await this._asegurarCheckboxEstado(this.page.locator(L.COMBO_APLICAR_IVA), 'apply_tax_combo', false);
  }
  async _llamarSetProductTotal(...args: Parameters<PosCore['_llamarSetProductTotal']>) {
    return this.core._llamarSetProductTotal(...args);
  }
  async _leerValorDescuentoInput(...args: Parameters<PosCore['_leerValorDescuentoInput']>) {
    return this.core._leerValorDescuentoInput(...args);
  }
  async _leerYCerrarAlerta(...args: Parameters<PosCore['_leerYCerrarAlerta']>) {
    return this.core._leerYCerrarAlerta(...args);
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

  // ─── "Orden de Caja" (Enviar a caja) ───────────────────────────────────────
  //
  // Alternativa a facturar de inmediato: registra la venta actual del
  // carrito como pendiente de cobro (queda listada luego en la pestaña
  // "Órdenes de caja", PESTANAS_POS_A_RECORRER). Confirmado en vivo que el
  // botón real NO está junto a "Facturar" como botón independiente — vive
  // dentro del menú desplegable propio que abre ORDEN_CAJA_MENU_BTN
  // (distinto del menú de tres puntos del encabezado — ver
  // abrirMenuTresPuntos()).

  /** Locator del modal "Enviar a caja" (Orden de Caja). */
  get modalOrdenCaja() {
    return this.page.locator(L.DIALOG_ORDEN_CAJA);
  }

  /** Locator del campo "Factura a nombre de terceros" del modal "Enviar a caja". */
  get campoTercerosOrdenCaja() {
    return this.page.locator(L.ORDEN_CAJA_INPUT_TERCERO);
  }

  /**
   * Abre el menú de acciones junto a "Facturar" y selecciona "Enviar a
   * caja". El botón (ORDEN_CAJA_MENU_BTN) es el mismo tipo de FAB de
   * Material Design que MENU_TRES_PUNTOS —con ripple continuo, que lo
   * mantiene "inestable" para Playwright— así que reutiliza el mismo patrón
   * ya probado en abrirMenuTresPuntos(): esperar (sin abortar si nunca
   * llega) a que MDL termine de "upgradear" su <ul> asociado, y reintentar
   * el click unas cuantas veces en vez de asumir que el primero alcanza.
   *
   * Confirmado en vivo (no asumido, corrigiendo una versión anterior más
   * simple de este método que fallaba de forma intermitente): sin esta
   * espera y reintento, el click vía evaluate() puede no disparar nada — el
   * listener de MDL todavía no estaba ligado en ese instante. El atributo
   * de este menú es "data-mdl-for" (no simplemente "for", a diferencia de
   * MENU_TRES_PUNTOS_INICIALIZADO) — confirmado inspeccionando el DOM real.
   * Nunca se usa force:true: el click nativo vía evaluate() es la misma
   * técnica que el resto de la suite ya usa para checkboxes de slider CSS.
   */
  async abrirMenuOrdenCaja() {
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarAvisoConsecutivoSiAparece();

    await this.page.locator('ul.mdl-menu[data-mdl-for="demo-menu-top-right"][data-upgraded*="MaterialMenu"]')
      .waitFor({ state: 'attached', timeout: TIMEOUTS.PRODUCTS_LOAD })
      .catch(() => {});

    const item = this.page.locator(L.ORDEN_CAJA_MENU_ITEM);
    const MAX_INTENTOS = 4;
    let abierto = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierto; intento++) {
      await this.cerrarModalNotificacionesSiAparece();
      await this.cerrarAvisoConsecutivoSiAparece();

      await this.page.evaluate(
        (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
        L.ORDEN_CAJA_MENU_BTN
      );
      abierto = await item.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    }
    expect(abierto, `La opción "Enviar a caja" no apareció en el menú de acciones tras ${MAX_INTENTOS} intentos`).toBe(true);

    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      L.ORDEN_CAJA_MENU_ITEM
    );

    await expect(this.modalOrdenCaja, 'El modal "Enviar a caja" no apareció tras seleccionar la opción del menú').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Busca y selecciona un cliente DENTRO del modal "Enviar a caja" (Forma 2)
   * — confirmado en vivo que usa un control distinto al panel de arriba del
   * carrito (seleccionarClienteExistente(), Forma 1): un <select> Chosen
   * (ORDEN_CAJA_CLIENTE_CHOSEN) poblado por el mismo AJAX
   * (CLIENTE_AJAX_BUSQUEDA), no el panel de tarjetas .customer-list-pos.
   * Una búsqueda vacía trae todos los clientes disponibles — confirmado en
   * vivo. Reutiliza _seleccionarPrimeraOpcionChosen() para elegir la primera
   * opción real (no el placeholder "Seleccionar cliente"), mismo criterio
   * que el resto de la suite para catálogos sin nombre estable por el cual
   * filtrar. Devuelve el nombre del cliente realmente seleccionado.
   */
  async seleccionarClienteEnOrdenCaja(terminoBusqueda = ''): Promise<string> {
    await this.page.locator(L.ORDEN_CAJA_CLIENTE_INPUT_BUSQUEDA).fill(terminoBusqueda);

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.CLIENTE_AJAX_BUSQUEDA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.ORDEN_CAJA_CLIENTE_BTN_BUSCAR).click();
    await respuestaPromise;

    await this._seleccionarPrimeraOpcionChosen(L.ORDEN_CAJA_CLIENTE_CHOSEN);

    const nombreCliente = await this._obtenerTextoChosenSeleccionado(L.ORDEN_CAJA_CLIENTE_CHOSEN);
    expect(nombreCliente, 'El nombre del cliente seleccionado en "Enviar a caja" no quedó visible').not.toBe('');
    console.log(`[seleccionarClienteEnOrdenCaja] Cliente seleccionado: "${nombreCliente}"`);
    return nombreCliente;
  }

  /**
   * Lee el nombre del cliente actualmente reflejado en el modal "Enviar a
   * caja" — sirve tanto para confirmar lo elegido por seleccionarClienteEnOrdenCaja()
   * (Forma 2) como para confirmar que un cliente elegido arriba del carrito
   * (seleccionarClienteExistente(), Forma 1) sí se propagó aquí, ya que
   * ambas formas comparten el mismo <select> subyacente — confirmado en
   * vivo.
   */
  async obtenerClienteEnOrdenCaja(): Promise<string> {
    return this._obtenerTextoChosenSeleccionado(L.ORDEN_CAJA_CLIENTE_CHOSEN);
  }

  /**
   * Selecciona el primer vendedor real disponible en "Enviar a caja" —
   * catálogo configurable por la empresa sin nombre estable, mismo criterio
   * que el resto de la suite (CABYS, tipo/tasa de IVA, parte/pieza/servicio
   * de End. Pintura). Opcional: confirmado en vivo que el modal se puede
   * enviar sin tocarlo (queda en su placeholder "Seleccionar Vendedor").
   * Devuelve el nombre realmente seleccionado.
   */
  async seleccionarVendedorOrdenCaja(): Promise<string> {
    await this._seleccionarPrimeraOpcionChosen(L.ORDEN_CAJA_VENDEDOR_CHOSEN);
    const nombreVendedor = await this._obtenerTextoChosenSeleccionado(L.ORDEN_CAJA_VENDEDOR_CHOSEN);
    expect(nombreVendedor, 'El vendedor seleccionado en "Enviar a caja" no quedó visible').not.toBe('');
    console.log(`[seleccionarVendedorOrdenCaja] Vendedor seleccionado: "${nombreVendedor}"`);
    return nombreVendedor;
  }

  /**
   * Selecciona "Contado" o "Crédito" en "Enviar a caja". Ambos checkboxes
   * usan slider CSS (mismo patrón que el resto de checkboxes de esta
   * suite) — se accionan reutilizando _asegurarCheckboxEstado() tal cual,
   * nunca con un click directo de Playwright ni force:true.
   *
   * Confirmado en vivo: elegir "Crédito" revela "Fecha de Vencimiento" (ya
   * con un valor por defecto) y cambia el campo oculto
   * ORDEN_CAJA_TIPO_PAGO_HIDE a "2" ("1" = Contado). También confirmado:
   * "Crédito" EXIGE un cliente real seleccionado — con nombre de terceros
   * únicamente, o sin cliente, "Enviar a caja" no dispara ninguna petición
   * ni alerta (bloqueo silencioso). Seleccionar el cliente antes de enviar
   * es responsabilidad de quien orquesta el test: esta función no lo exige
   * porque "Contado" sí es válido sin cliente.
   */
  async seleccionarTipoPagoOrdenCaja(tipo: TipoPagoOrdenCaja) {
    if (tipo === 'credito') {
      await this._asegurarCheckboxEstado(this.page.locator(L.ORDEN_CAJA_CHECK_CREDITO), 'ck_is_send_sale_payment_credit', true);
      await expect(
        this.page.locator(L.ORDEN_CAJA_FECHA_VENCIMIENTO_CONTENEDOR),
        '"Fecha de Vencimiento" no apareció tras seleccionar Crédito'
      ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    } else {
      await this._asegurarCheckboxEstado(this.page.locator(L.ORDEN_CAJA_CHECK_CONTADO), 'ck_is_send_sale_payment_cash', true);
    }

    await expect(
      this.page.locator(L.ORDEN_CAJA_TIPO_PAGO_HIDE),
      `El tipo de pago no quedó registrado como "${tipo}"`
    ).toHaveValue(tipo === 'credito' ? '2' : '1');
  }

  /**
   * Activa "A nombre de terceros" en "Enviar a caja" y llena el nombre.
   * Checkbox de slider CSS (mismo patrón, reutiliza _asegurarCheckboxEstado()):
   * confirmado en vivo que el campo de texto nace deshabilitado y solo se
   * habilita tras activar el checkbox (enable_send_sale_third_customer()).
   */
  async activarNombreTercerosOrdenCaja(nombre: string) {
    await this._asegurarCheckboxEstado(this.page.locator(L.ORDEN_CAJA_CHECK_TERCERO), 'ck_send_sale_third_person_name', true);

    const campo = this.campoTercerosOrdenCaja;
    await expect(campo, 'El campo "Factura a nombre de terceros" no se habilitó tras activar el checkbox').toBeEnabled({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await campo.fill(nombre);
  }

  /** Llena las observaciones de "Enviar a caja" — marcado como obligatorio en el propio formulario. */
  async llenarObservacionesOrdenCaja(texto: string) {
    await this.page.locator(L.ORDEN_CAJA_OBSERVACIONES).fill(texto);
  }

  /**
   * Presiona "Enviar a caja", confirma el SweetAlert de advertencia
   * ("¿Está seguro de enviar esta venta a caja?") y espera la respuesta
   * real de red que efectivamente crea la orden (AJAX_ENVIAR_ORDEN_CAJA) —
   * confirmado en vivo interceptando la red tras confirmar. La espera del
   * AJAX se arma ANTES de confirmar el SweetAlert, no después — mismo
   * motivo que el resto de la suite: un listener registrado después del
   * click puede perderse la respuesta si esta llega demasiado rápido.
   */
  async enviarOrdenCaja(): Promise<Response> {
    await this.page.locator(L.ORDEN_CAJA_BTN_ENVIAR).click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_ENVIAR_ORDEN_CAJA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this._confirmarSweetAlertV1('No apareció la confirmación "¿Está seguro de enviar esta venta a caja?"');
    return respuestaPromise;
  }

  /**
   * Valida que "Enviar a caja" terminó exitosamente, sin depender
   * únicamente del toast: la respuesta real de AJAX_ENVIAR_ORDEN_CAJA
   * respondió OK, el modal se cerró, apareció el toast de confirmación y el
   * carrito quedó vacío (mismo criterio de cierre que la facturación
   * normal — ver validarCarritoVacio()).
   */
  async validarOrdenCajaCreada(respuesta: Response) {
    expect(respuesta.ok(), `${L.AJAX_ENVIAR_ORDEN_CAJA} no respondió OK (status ${respuesta.status()})`).toBe(true);

    await expect(
      this.modalOrdenCaja,
      'El modal "Enviar a caja" no se cerró tras confirmar el envío'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await expect(
      this.page.locator('.noty_bar', { hasText: /enviado a caja/i }),
      'No apareció el toast de confirmación de "Enviar a caja"'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await this.validarCarritoVacio();
  }
  async _obtenerTextoChosenSeleccionado(...args: Parameters<PosCore['_obtenerTextoChosenSeleccionado']>) {
    return this.core._obtenerTextoChosenSeleccionado(...args);
  }
  async activarDescuentoGeneral(...args: Parameters<PosCore['activarDescuentoGeneral']>) {
    return this.core.activarDescuentoGeneral(...args);
  }
  async mostrarDetalleAvanzadoFactura(...args: Parameters<PosCore['mostrarDetalleAvanzadoFactura']>) {
    return this.core.mostrarDetalleAvanzadoFactura(...args);
  }
  async establecerPorcentajeDescuentoGeneral(...args: Parameters<PosCore['establecerPorcentajeDescuentoGeneral']>) {
    return this.core.establecerPorcentajeDescuentoGeneral(...args);
  }
  async obtenerMontoDescuentoGeneralNumerico(...args: Parameters<PosCore['obtenerMontoDescuentoGeneralNumerico']>) {
    return this.core.obtenerMontoDescuentoGeneralNumerico(...args);
  }
  async _leerMontoDeTexto(...args: Parameters<PosCore['_leerMontoDeTexto']>) {
    return this.core._leerMontoDeTexto(...args);
  }
  async _confirmarSweetAlertV1(...args: Parameters<PosCore['_confirmarSweetAlertV1']>) {
    return this.core._confirmarSweetAlertV1(...args);
  }
  async agregarProductoRapidoSimple(...args: Parameters<PosCore['agregarProductoRapidoSimple']>) {
    return this.core.agregarProductoRapidoSimple(...args);
  }
  async agregarProductoFraccionadoExistente(...args: Parameters<PosCore['agregarProductoFraccionadoExistente']>) {
    return this.core.agregarProductoFraccionadoExistente(...args);
  }
  async agregarProductoNormalFraccionadoYRapido(...args: Parameters<PosCore['agregarProductoNormalFraccionadoYRapido']>) {
    return this.core.agregarProductoNormalFraccionadoYRapido(...args);
  }
  async abrirModalExoneracion(...args: Parameters<PosCore['abrirModalExoneracion']>) {
    return this.core.abrirModalExoneracion(...args);
  }
  async aplicarExoneracion(...args: Parameters<PosCore['aplicarExoneracion']>) {
    return this.core.aplicarExoneracion(...args);
  }
  async obtenerMontoExoneracionNumerico(...args: Parameters<PosCore['obtenerMontoExoneracionNumerico']>) {
    return this.core.obtenerMontoExoneracionNumerico(...args);
  }
  async cancelarExoneracionSiEstaAplicada(...args: Parameters<PosCore['cancelarExoneracionSiEstaAplicada']>) {
    return this.core.cancelarExoneracionSiEstaAplicada(...args);
  }

  // ─── Modal de Pago: "Tipo de pago" y "Asignar vendedor" ────────────────────
  // Controles propios de #dialog_payment (Facturar) — ver el comentario de
  // L.DIALOG_PAGO_CHECK_CONTADO para la evidencia de por qué son distintos de
  // los homólogos de "Enviar a caja" (ORDEN_CAJA_CHECK_CONTADO/CREDITO,
  // ORDEN_CAJA_VENDEDOR_CHOSEN). abrirModalDePago() (ya existente) debe
  // llamarse antes.

  /** Lee cuál "Tipo de pago" está actualmente marcado en el modal de pago, sin tocarlo. */
  async obtenerTipoPagoEnModalPago(): Promise<TipoPagoOrdenCaja> {
    const credito = await this.page.locator(L.DIALOG_PAGO_CHECK_CREDITO).isChecked();
    return credito ? 'credito' : 'contado';
  }

  /**
   * Cambia el "Tipo de pago" del modal de pago al indicado — mismo patrón de
   * checkbox de slider CSS (_asegurarCheckboxEstado()) que el resto de la
   * suite. Confirmado en vivo que elegir "Crédito" aquí también revela
   * DIALOG_PAGO_FECHA_VENCIMIENTO, igual que en "Enviar a caja".
   */
  async cambiarTipoPagoEnModalPago(tipo: TipoPagoOrdenCaja) {
    if (tipo === 'credito') {
      await this._asegurarCheckboxEstado(this.page.locator(L.DIALOG_PAGO_CHECK_CREDITO), 'ck_is_payment_credit', true);
      await expect(
        this.page.locator(L.DIALOG_PAGO_FECHA_VENCIMIENTO),
        '"Fecha de Vencimiento" no apareció tras seleccionar Crédito en el modal de pago'
      ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    } else {
      await this._asegurarCheckboxEstado(this.page.locator(L.DIALOG_PAGO_CHECK_CONTADO), 'ck_is_payment_cash', true);
    }
  }

  /** Lee el vendedor actualmente seleccionado en el modal de pago (reutiliza el mismo lector de Chosen que "Enviar a caja"). */
  async obtenerVendedorEnModalPago(): Promise<string> {
    return this._obtenerTextoChosenSeleccionado(L.DIALOG_PAGO_VENDEDOR_CHOSEN);
  }

  /**
   * Selecciona explícitamente el primer vendedor real disponible en el modal
   * de pago — mismo criterio que seleccionarVendedorOrdenCaja() (catálogo
   * configurable por la empresa, sin nombre estable, primera opción real).
   * Complementa a obtenerVendedorEnModalPago() (que solo lee): necesario para
   * escenarios que además de validar el vendedor, lo eligen de forma
   * explícita (a diferencia del ya prellenado automáticamente al cargar una
   * venta pendiente — ver el comentario de L.DIALOG_PAGO_VENDEDOR_CHOSEN).
   */
  async seleccionarVendedorEnModalPago(): Promise<string> {
    await this._seleccionarPrimeraOpcionChosen(L.DIALOG_PAGO_VENDEDOR_CHOSEN);
    const nombreVendedor = await this.obtenerVendedorEnModalPago();
    expect(nombreVendedor, 'El vendedor seleccionado en el modal de pago no quedó visible').not.toBe('');
    console.log(`[seleccionarVendedorEnModalPago] Vendedor seleccionado: "${nombreVendedor}"`);
    return nombreVendedor;
  }

  // ─── "Orden de Ruteo" ───────────────────────────────────────────────────────

  /** Locator del modal "Crear Orden de Ruteo". */
  get modalRuteo() {
    return this.page.locator(L.DIALOG_RUTEO);
  }

  /**
   * Abre "Crear Orden de Ruteo" desde el menú desplegable junto a "Facturar"
   * (mismo menú que Proforma/Apartado/Enviar a caja, #demo-menu-top-right).
   * Mismo patrón de reintento (hasta 4 intentos, cerrando overlays conocidos
   * en cada vuelta) que abrirMenuOrdenCaja()/abrirCrearProforma()/
   * abrirCrearApartado() ya usan cada uno por su cuenta para este mismo
   * menú — necesario porque el modal requiere al menos un producto en el
   * carrito (create_routing_order() lo valida y aborta con un aviso si no lo
   * hay, dejando el modal sin abrir), así que quien llama debe agregar
   * producto(s) antes.
   */
  async abrirCrearOrdenRuteo() {
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarAvisoConsecutivoSiAparece();

    await this.page.locator('ul.mdl-menu[data-mdl-for="demo-menu-top-right"][data-upgraded*="MaterialMenu"]')
      .waitFor({ state: 'attached', timeout: TIMEOUTS.PRODUCTS_LOAD })
      .catch(() => {});

    const item = this.page.locator(L.RUTEO_MENU_ITEM);
    const MAX_INTENTOS = 4;
    let abierto = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierto; intento++) {
      await this.cerrarModalNotificacionesSiAparece();
      await this.cerrarAvisoConsecutivoSiAparece();

      await this.page.evaluate(
        (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
        L.ORDEN_CAJA_MENU_BTN
      );
      abierto = await item.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    }
    expect(abierto, `La opción "Orden de Ruteo" no apareció en el menú de acciones tras ${MAX_INTENTOS} intentos`).toBe(true);

    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      L.RUTEO_MENU_ITEM
    );

    await expect(this.modalRuteo, 'El modal "Crear Orden de Ruteo" no apareció tras seleccionar la opción del menú').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Busca y selecciona un cliente DENTRO del modal "Crear Orden de Ruteo"
   * (Forma 2) — confirmado en vivo (no asumido de Apartado/Enviar a caja) que
   * usa su propio input (RUTEO_CLIENTE_INPUT_BUSQUEDA, distinto de ambos) pero
   * dispara el mismo AJAX compartido (CLIENTE_AJAX_BUSQUEDA) y llena un
   * <select> Chosen propio (RUTEO_CLIENTE_CHOSEN) — mismo mecanismo general
   * que seleccionarClienteEnOrdenCaja()/seleccionarClienteEnModalApartado(),
   * aplicado a los selectores reales de este modal. Una búsqueda vacía trae
   * todos los clientes disponibles — confirmado en vivo. Reutiliza
   * _seleccionarPrimeraOpcionChosen() para elegir la primera opción real (no
   * el placeholder "Seleccionar cliente"). Devuelve el nombre del cliente
   * realmente seleccionado.
   */
  async seleccionarClienteEnRuteo(terminoBusqueda = ''): Promise<string> {
    await this.page.locator(L.RUTEO_CLIENTE_INPUT_BUSQUEDA).fill(terminoBusqueda);

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.CLIENTE_AJAX_BUSQUEDA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.RUTEO_CLIENTE_BTN_BUSCAR).click();
    await respuestaPromise;

    await this._seleccionarPrimeraOpcionChosen(L.RUTEO_CLIENTE_CHOSEN);

    const nombreCliente = await this._obtenerTextoChosenSeleccionado(L.RUTEO_CLIENTE_CHOSEN);
    expect(nombreCliente, 'El nombre del cliente seleccionado en "Crear Orden de Ruteo" no quedó visible').not.toBe('');
    console.log(`[seleccionarClienteEnRuteo] Cliente seleccionado: "${nombreCliente}"`);
    return nombreCliente;
  }

  /**
   * Lee el nombre del cliente actualmente reflejado en el modal "Crear Orden
   * de Ruteo" — sirve tanto para confirmar lo elegido por
   * seleccionarClienteEnRuteo() (Forma 2) como para confirmar que un cliente
   * elegido arriba del carrito (seleccionarClienteExistente(), Forma 1) sí se
   * propagó aquí: confirmado en vivo (show_create_routing_order_modal() en
   * pos_routing.js) que ambas formas comparten el mismo cliente ya
   * seleccionado en el carrito (#customer_select/#customer_json_selected).
   */
  async obtenerClienteEnRuteo(): Promise<string> {
    return this._obtenerTextoChosenSeleccionado(L.RUTEO_CLIENTE_CHOSEN);
  }

  /**
   * Selecciona la primera ruta real disponible — catálogo configurable por la
   * empresa sin nombre estable, mismo criterio que el resto de la suite
   * (CABYS, tipo/tasa de IVA, vendedor de Enviar a caja). Obligatorio:
   * confirmado en vivo (confirm_send_routing_order() en pos_routing.js) que
   * el envío se rechaza con un aviso si queda en su placeholder. Devuelve el
   * nombre de la ruta realmente seleccionada.
   */
  async seleccionarRutaRuteo(): Promise<string> {
    await this._seleccionarPrimeraOpcionChosen(L.RUTEO_RUTA_CHOSEN);
    const nombreRuta = await this._obtenerTextoChosenSeleccionado(L.RUTEO_RUTA_CHOSEN);
    expect(nombreRuta, 'La ruta seleccionada en "Crear Orden de Ruteo" no quedó visible').not.toBe('');
    console.log(`[seleccionarRutaRuteo] Ruta seleccionada: "${nombreRuta}"`);
    return nombreRuta;
  }

  /**
   * Selecciona el primer repartidor real disponible — mismo criterio que
   * seleccionarRutaRuteo(). Obligatorio, igual que la ruta. No depende del
   * autocompletado que set_agent_in_modal_routing_order() intenta tras elegir
   * una ruta (ver el comentario de L.RUTEO_RUTA_CHOSEN): se selecciona
   * siempre de forma explícita, sin asumir que la ruta ya lo dejó listo.
   * Devuelve el nombre del repartidor realmente seleccionado.
   */
  async seleccionarRepartidorRuteo(): Promise<string> {
    await this._seleccionarPrimeraOpcionChosen(L.RUTEO_REPARTIDOR_CHOSEN);
    const nombreRepartidor = await this._obtenerTextoChosenSeleccionado(L.RUTEO_REPARTIDOR_CHOSEN);
    expect(nombreRepartidor, 'El repartidor seleccionado en "Crear Orden de Ruteo" no quedó visible').not.toBe('');
    console.log(`[seleccionarRepartidorRuteo] Repartidor seleccionado: "${nombreRepartidor}"`);
    return nombreRepartidor;
  }

  /**
   * Selecciona la primera dirección real del cliente si tiene alguna
   * registrada, sin fallar si no tiene ninguna — a diferencia de Ruta/
   * Repartidor, este campo es OPCIONAL (ver el comentario de
   * L.RUTEO_DIRECCION_CHOSEN).
   *
   * NO reutiliza _seleccionarPrimeraOpcionChosenSiHayOpciones() (la variante
   * "tolerante" que sí usan Subcategoría/Sub sección de "Crear Producto"):
   * confirmado en vivo que su fallback de "abrir el Chosen y presionar
   * Escape cuando no hay opciones" deja un backdrop huérfano cubriendo todo
   * el modal de Ruteo (ver el comentario de L.RUTEO_DIRECCION_CHOSEN) — un
   * problema propio de estar dentro de un modal ya abierto que Subcategoría/
   * Sub sección no tienen. En su lugar, se comprueba de antemano sobre el
   * <select> real (sin abrir nunca el Chosen) si existe alguna opción
   * distinta del placeholder, y solo se abre el Chosen cuando sí la hay —
   * evita por completo la necesidad de cancelarlo.
   *
   * Devuelve el texto actualmente reflejado (una dirección real, o el
   * placeholder "Seleccionar dirección" si el cliente no tiene ninguna).
   */
  async seleccionarDireccionRuteoSiExiste(): Promise<string> {
    const hayDirecciones = (await this.page.locator(`${L.RUTEO_DIRECCION_SELECT} option:not([value="0"])`).count()) > 0;
    if (hayDirecciones) {
      await this._seleccionarPrimeraOpcionChosen(L.RUTEO_DIRECCION_CHOSEN);
    }
    return this._obtenerTextoChosenSeleccionado(L.RUTEO_DIRECCION_CHOSEN);
  }

  /**
   * Llena las observaciones de "Crear Orden de Ruteo" — mismo patrón de
   * llenarObservacionesOrdenCaja() (un simple fill()), pero sobre el textarea
   * propio de este modal (RUTEO_OBSERVACION, id distinto). A diferencia de
   * ese método, devuelve el valor que realmente quedó en el campo: necesario
   * porque esta suite sí debe validar explícitamente que la observación se
   * registró, y no existía ningún método existente que expusiera ese valor
   * sin tocar el locator crudo desde el test.
   */
  async llenarObservacionesRuteo(texto: string): Promise<string> {
    const campo = this.page.locator(L.RUTEO_OBSERVACION);
    await campo.fill(texto);
    return campo.inputValue();
  }

  /**
   * Presiona "Enviar Orden" y confirma el SweetAlert de advertencia
   * ("¿Enviar órden a ruteo?") — mismo patrón que enviarOrdenCaja()/
   * guardarProformaYObtenerRespuesta()/guardarApartadoYObtenerRespuesta():
   * arma la espera de la respuesta AJAX ANTES del click, confirma el
   * SweetAlert reutilizando _confirmarSweetAlertV1(), y devuelve la
   * respuesta cruda para que el test decida cómo validarla.
   */
  async guardarOrdenRuteoYObtenerRespuesta(): Promise<Response> {
    await this.page.locator(L.RUTEO_BTN_ENVIAR).click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_RUTEO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this._confirmarSweetAlertV1('No apareció la confirmación "¿Enviar órden a ruteo?"');
    return respuestaPromise;
  }

  /**
   * Valida que "Crear Orden de Ruteo" terminó exitosamente: la respuesta real
   * de AJAX_GUARDAR_RUTEO respondió OK con un id numérico (>=1, mismo
   * contrato que AJAX_GUARDAR_APARTADO), el modal se cerró y el carrito quedó
   * vacío (clear_product_table() en pos_routing.js, confirmado en vivo). Sin
   * ventana de impresión que esperar ni cerrar (ver el comentario de
   * L.AJAX_GUARDAR_RUTEO): a diferencia de Facturar/Cerrar Caja, este
   * ambiente no tiene la impresión automática de comanda activada.
   */
  /**
   * Cierra el modal de Ruteo (creación/edición) a la fuerza si quedó
   * abierto — necesario tras un intento de guardar en moneda no base que el
   * ambiente bloquea en silencio (confirmado en vivo: el modal permanece
   * abierto, sin ningún AJAX_GUARDAR_RUTEO ni SweetAlert que lo cierre).
   */
  async cerrarModalRuteoForzado() {
    const modal = this.modalRuteo;
    if (!(await modal.isVisible().catch(() => false))) return;
    await modal.locator('[data-dismiss="modal"]').first().click({ force: true }).catch(() => {});
    await expect(modal, 'El modal de Ruteo no se cerró al forzar su cierre').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  async validarOrdenRuteoCreada(respuesta: Response) {
    expect(respuesta.ok(), `${L.AJAX_GUARDAR_RUTEO} no respondió OK (status ${respuesta.status()})`).toBe(true);

    const cuerpo = (await respuesta.text()).trim();
    expect(parseInt(cuerpo, 10), `${L.AJAX_GUARDAR_RUTEO} no devolvió un id válido (respondió "${cuerpo}")`).toBeGreaterThanOrEqual(1);

    await expect(
      this.modalRuteo,
      'El modal "Crear Orden de Ruteo" no se cerró tras confirmar el envío'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await this.validarCarritoVacio();
  }

  // ─── Listado de Órdenes de Ruteo YA CREADAS: "Ver Orden"/"Editar Orden"/estado ──
  // Ver el comentario de L.RUTEO_LISTA_TARJETA_PREFIJO para la evidencia
  // completa (estructura real de la tarjeta, opciones del menú, códigos de
  // estado). Cada Orden se localiza SIEMPRE por su id real (el mismo que
  // devuelve guardarOrdenRuteoYObtenerRespuesta()), nunca por posición en el
  // listado: bajo `fullyParallel`, otro worker puede estar creando/editando
  // sus propias órdenes en la misma pestaña "Ruteo" al mismo tiempo, así que
  // depender de "la primera tarjeta" sería una condición de carrera real.

  /** Locator de una tarjeta de Orden de Ruteo ya creada, por su id real. */
  tarjetaRuteo(ordenId: string): Locator {
    return this.page.locator(`#${L.RUTEO_LISTA_TARJETA_PREFIJO}${ordenId}`);
  }

  /**
   * Abre la pestaña superior "Ruteo" (listado de órdenes YA creadas —
   * distinta del menú "Crear Orden de Ruteo"/RUTEO_MENU_ITEM), reutilizando
   * visitarPestanaPos() con la entrada ya registrada en
   * PESTANAS_POS_A_RECORRER, sin duplicar esa lógica.
   */
  async abrirListadoOrdenesRuteo() {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Ruteo')!;
    await this.visitarPestanaPos(pestana);
  }

  /**
   * Indica si el tab superior "Ruteo" sigue activo — mismo criterio que
   * pestanaPosActiva(), con la pestaña ya resuelta. Confirmado en vivo que
   * seleccionarOrdenRuteoParaFacturar() y alternarVistaExpandida() NO sacan
   * al usuario de este tab (a diferencia de abrirAgregarItem(), que activa
   * el tab "Productos" — ver su comentario): útil para escenarios que deben
   * facturar una Orden de Ruteo sin abandonar esta pestaña.
   */
  async pestanaRuteoActiva(): Promise<boolean> {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Ruteo')!;
    return this.pestanaPosActiva(pestana);
  }

  /**
   * Presiona "Volver" desde el catálogo (abierto con abrirAgregarItem())
   * hacia el tab "Ruteo", reutilizando volverDesdeAgregarItem() con la
   * pestaña ya resuelta — mismo patrón que abrirListadoOrdenesRuteo()/
   * pestanaRuteoActiva(), sin necesitar que el archivo de test importe
   * PESTANAS_POS_A_RECORRER solo para esto.
   */
  async volverDesdeAgregarItemHaciaRuteo() {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Ruteo')!;
    await this.volverDesdeAgregarItem(pestana);
  }

  /**
   * Indica si la tarjeta de una Orden de Ruteo (por id) aparece visible
   * dentro del filtro real "Entregado" (FILTRO_RUTEO_ENTREGADO) — cambia a
   * ese filtro primero. Útil para confirmar explícitamente que una orden
   * SALIÓ de "Entregado" tras un cambio de estado o facturación (a
   * diferencia de asegurarOrdenRuteoVisibleEnListado(), que solo garantiza
   * que la tarjeta aparezca EN ALGÚN LADO, sin importar cuál).
   */
  async ordenVisibleEnFiltroEntregado(ordenId: string): Promise<boolean> {
    await this.page.locator(L.FILTRO_RUTEO_ENTREGADO).click();
    return this.tarjetaRuteo(ordenId).isVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD }).catch(() => false);
  }

  /**
   * Indica si la tarjeta de una Orden de Ruteo (por id) aparece visible
   * dentro del filtro real "H. de Órdenes" (FILTRO_RUTEO_HISTORIAL) —
   * cambia a ese filtro primero. Ver el comentario de
   * ordenVisibleEnFiltroEntregado() para el criterio general.
   */
  async ordenVisibleEnHistorial(ordenId: string): Promise<boolean> {
    await this.page.locator(L.FILTRO_RUTEO_HISTORIAL).click();
    return this.tarjetaRuteo(ordenId).isVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD }).catch(() => false);
  }

  /**
   * Asegura que la tarjeta de una Orden de Ruteo (por su id real) quede
   * visible en el listado, sin importar qué filtro esté activo en este
   * momento — confirmado en vivo (investigado a fondo, no asumido) que una
   * orden que llega al estado Entregado + Facturado se MUEVE de "Todos" a
   * "H. de Órdenes" (FILTRO_RUTEO_HISTORIAL): comparando el mismo id de
   * orden en ambas vistas, la tarjeta deja de existir/verse en "Todos" y
   * aparece en "H. de Órdenes". Los métodos que localizan una tarjeta por
   * id (tarjetaRuteo()) asumían implícitamente que "Todos" siempre era el
   * lugar correcto — bajo `fullyParallel`/corridas largas donde varios
   * escenarios comparten el mismo pool de órdenes (p. ej. un escenario que
   * marca una orden como Entregada y otro que ya la había facturado antes),
   * eso deja de ser cierto y la tarjeta puede esperar su timeout completo
   * sin nunca aparecer.
   *
   * Estrategia (sin excepciones para distinguir casos, solo waitFor con
   * timeouts cortos vía `.catch(() => false)`, mismo criterio que el resto
   * de esta clase): probar primero la vista ya activa (corto, la mayoría de
   * los casos no necesitan cambiar nada), luego "H. de Órdenes", y si
   * tampoco aparece ahí, volver a "Todos" — el mismo estado por defecto que
   * el resto de la suite espera — y dejar que el propio caller reporte el
   * error real con su propio mensaje (esta orden simplemente no existe o el
   * ambiente tiene un problema genuino, no un filtro mal ubicado).
   */
  async asegurarOrdenRuteoVisibleEnListado(ordenId: string): Promise<void> {
    const tarjeta = this.tarjetaRuteo(ordenId);
    const yaVisible = await tarjeta.isVisible({ timeout: 5_000 }).catch(() => false);
    if (yaVisible) return;

    const visibleEnHistorial = await this.page.locator(L.FILTRO_RUTEO_HISTORIAL).click()
      .then(() => tarjeta.isVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD }))
      .catch(() => false);
    if (visibleEnHistorial) return;

    await this.page.locator(L.FILTRO_RUTEO_TODOS).click().catch(() => {});
  }

  /**
   * Abre el menú de acciones (ícono "more_vert") de una Orden de Ruteo ya
   * creada, localizada por su id real — falla con un mensaje claro si la
   * tarjeta no aparece en el listado ya cargado. Antes de buscarla,
   * asegura que esté visible en la vista correcta (ver el comentario de
   * asegurarOrdenRuteoVisibleEnListado(): puede haberse movido a "H. de
   * Órdenes" si ya está Entregada + Facturada).
   */
  async abrirMenuAccionesOrdenRuteo(ordenId: string) {
    await this.asegurarOrdenRuteoVisibleEnListado(ordenId);
    const tarjeta = this.tarjetaRuteo(ordenId);
    await expect(tarjeta, `La orden de Ruteo #${ordenId} no aparece en el listado "Ruteo" (ni en "Todos" ni en "H. de Órdenes")`).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
    await tarjeta.locator(L.RUTEO_LISTA_BTN_MENU).click();
    await expect(
      tarjeta.locator('ul.dropdown-menu'),
      `El menú de acciones de la orden #${ordenId} no se abrió`
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Con el menú de acciones ya abierto (abrirMenuAccionesOrdenRuteo()),
   * selecciona "Ver órden" y lee los datos reales mostrados en el modal de
   * detalle (#dialog_view_routing_order_detail), cerrándolo al terminar.
   * Confirmado en vivo que este detalle no incluye "Vendedor" (solo
   * "Repartidor") ni etiqueta explícita de moneda/estado/fecha — esos solo
   * se reflejan en la propia tarjeta del listado (fecha) o se infieren del
   * símbolo en los montos (moneda); el estado se lee aparte con
   * obtenerEstadoTarjetaRuteo().
   */
  async verOrdenRuteo(ordenId: string) {
    await this.page.locator(`li[onclick="show_routing_order_detail(${ordenId});"]`).click();

    const modal = this.page.locator(L.DIALOG_VER_ORDEN_RUTEO);
    await expect(modal, 'El modal "Ver Orden" no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const leerMonto = async (selector: string) =>
      parseFloat(((await this.page.locator(selector).textContent()) ?? '0').replace(/[^0-9.]/g, '')) || 0;

    const datos = {
      numero: ((await this.page.locator(L.VER_RUTEO_NUMERO).textContent()) ?? '').trim(),
      repartidor: ((await this.page.locator(L.VER_RUTEO_REPARTIDOR).textContent()) ?? '').trim(),
      clienteNombre: ((await this.page.locator(L.VER_RUTEO_CLIENTE_NOMBRE).textContent()) ?? '').trim(),
      direccion: ((await this.page.locator(L.VER_RUTEO_CLIENTE_DIRECCION).textContent()) ?? '').trim(),
      observacion: ((await this.page.locator(L.VER_RUTEO_OBSERVACION).textContent()) ?? '').trim(),
      cantidadProductos: await this.page.locator(L.VER_RUTEO_FILAS_PRODUCTO).count(),
      subtotal: await leerMonto(L.VER_RUTEO_SUBTOTAL),
      descuento: await leerMonto(L.VER_RUTEO_DESCUENTO),
      impuesto: await leerMonto(L.VER_RUTEO_IMPUESTO),
      total: await leerMonto(L.VER_RUTEO_TOTAL),
    };

    await modal.locator('.btn_dvrod_close, [data-dismiss="modal"]').first().click();
    await expect(modal, 'El modal "Ver Orden" no se cerró').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    return datos;
  }

  /**
   * Con el menú de acciones ya abierto, selecciona "Editar órden" (reutiliza
   * el mismo modal #dialog_add_routing_order y los mismos ids/botón que
   * crear una Orden de Ruteo — ver el comentario de
   * L.RUTEO_LISTA_TARJETA_PREFIJO) y modifica Ruta, Repartidor y
   * Observaciones: los ÚNICOS campos realmente editables en este ambiente,
   * confirmado en vivo — el bloque de cliente permanece oculto
   * (display:none) y no existe ningún campo de productos/cantidades/
   * vendedor en este modal. Guarda reutilizando
   * guardarOrdenRuteoYObtenerRespuesta() tal cual (mismo botón, misma
   * petición AJAX_GUARDAR_RUTEO que la creación, confirmado en vivo).
   */
  async editarOrdenRuteo(ordenId: string, nuevaObservacion: string) {
    await this.page.locator(`li[onclick="show_create_routing_order_modal(${ordenId});"]`).click();

    const modal = this.modalRuteo;
    await expect(modal, 'El modal "Editar Orden de Ruteo" no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const ruta = await this.seleccionarRutaRuteo();
    const repartidor = await this.seleccionarRepartidorRuteo();
    const observacionRegistrada = await this.llenarObservacionesRuteo(nuevaObservacion);

    const respuesta = await this.guardarOrdenRuteoYObtenerRespuesta();
    expect(respuesta.ok(), `El guardado de la edición no respondió OK (status ${respuesta.status()})`).toBe(true);
    await expect(modal, 'El modal "Editar Orden de Ruteo" no se cerró tras guardar').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    return { ruta, repartidor, observacionRegistrada };
  }

  /**
   * Con el menú de acciones ya abierto, selecciona "Marcar como <estado>"
   * (change_routing_order_status(id, código)) y espera la respuesta real de
   * AJAX_CAMBIO_ESTADO_RUTEO. Códigos confirmados en vivo: 1=Pendiente,
   * 2=En camino, 3=Entregado. Sin SweetAlert de por medio (confirmado en
   * vivo, a diferencia del resto de acciones de Ruteo).
   */
  async cambiarEstadoOrdenRuteo(ordenId: string, estado: 1 | 2 | 3) {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_CAMBIO_ESTADO_RUTEO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(`li[onclick="change_routing_order_status(${ordenId},${estado});"]`).click();
    const respuesta = await respuestaPromise;
    expect(respuesta.ok(), `El cambio de estado de la orden #${ordenId} a ${estado} no respondió OK`).toBe(true);
  }

  /**
   * Lee el estado real de una tarjeta de Ruteo ya visible en el listado
   * desde su propia clase (delivery-status-1/2/3) — nunca asumido a partir
   * de la última acción ejecutada, mismo criterio de "leer el DOM real" que
   * el resto de la suite. Antes de leerla, asegura que esté visible en la
   * vista correcta (ver el comentario de asegurarOrdenRuteoVisibleEnListado()).
   */
  async obtenerEstadoTarjetaRuteo(ordenId: string): Promise<1 | 2 | 3> {
    await this.asegurarOrdenRuteoVisibleEnListado(ordenId);
    const clase = (await this.tarjetaRuteo(ordenId).getAttribute('class')) ?? '';
    const match = clase.match(/delivery-status-(\d)/);
    expect(match, `No se pudo leer el estado de la orden #${ordenId} desde su clase: "${clase}"`).not.toBeNull();
    return Number(match![1]) as 1 | 2 | 3;
  }

  // ─── Facturar una Orden de Ruteo ya creada ─────────────────────────────────
  // Ver el comentario de L.RUTEO_LISTA_BTN_SELECCIONAR para la evidencia
  // completa: el botón "Seleccionar órden" (fuera del menú de acciones) es el
  // único mecanismo real para llevar una Orden de Ruteo a facturación.

  /**
   * Localiza el id real de la primera Orden de Ruteo del listado que
   * TODAVÍA puede seleccionarse para facturar (botón "Seleccionar órden"
   * visible en su tarjeta — ver L.RUTEO_LISTA_BTN_SELECCIONAR) — para
   * escenarios que no necesitan crear su propia orden porque cualquier
   * orden Pendiente de facturar ya sirve (este ambiente ya trae un listado
   * grande de órdenes previas). Requiere que el listado "Ruteo" ya esté
   * abierto (abrirListadoOrdenesRuteo()). Localiza SIEMPRE leyendo el id
   * real del propio DOM (RUTEO_LISTA_TARJETA_PREFIJO + id numérico), nunca
   * por posición fija — mismo criterio "por id real" que el resto de los
   * métodos de listado de Ruteo (ver el comentario de
   * abrirMenuAccionesOrdenRuteo()).
   *
   * Nota: bajo `fullyParallel`, todos los workers comparten la misma cuenta/
   * sesión (ver el comentario de la fixture "pos" en pos-ruteo.spec.ts), así
   * que dos workers podrían intentar seleccionar la MISMA orden "primera
   * disponible" al mismo tiempo — un escenario que prefiere crear su propia
   * orden evita ese riesgo por completo; este método es para cuando esa
   * garantía no es necesaria.
   */
  async obtenerPrimeraOrdenRuteoSeleccionable(idAExcluir?: string): Promise<string> {
    const selectorBase = idAExcluir
      ? `[id^="${L.RUTEO_LISTA_TARJETA_PREFIJO}"]:not(#${L.RUTEO_LISTA_TARJETA_PREFIJO}${idAExcluir})`
      : `[id^="${L.RUTEO_LISTA_TARJETA_PREFIJO}"]`;
    const tarjetaConBoton = this.page
      .locator(selectorBase)
      .filter({ has: this.page.locator(L.RUTEO_LISTA_BTN_SELECCIONAR) })
      .first();

    await expect(
      tarjetaConBoton,
      `No se encontró ninguna Orden de Ruteo seleccionable (Pendiente de facturar)${idAExcluir ? ` distinta de #${idAExcluir}` : ''} en el listado`
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const idCompleto = await tarjetaConBoton.getAttribute('id');
    const ordenId = (idCompleto ?? '').replace(L.RUTEO_LISTA_TARJETA_PREFIJO, '');
    expect(ordenId.length, `No se pudo extraer un id numérico del atributo id="${idCompleto}"`).toBeGreaterThan(0);
    return ordenId;
  }

  /**
   * Localiza el id real de la primera Orden de Ruteo del listado que
   * actualmente tiene el estado de envío pedido (1=Pendiente, 2=En camino,
   * 3=Entregado — mismo código que obtenerEstadoTarjetaRuteo() ya usa) —
   * para escenarios que necesitan una orden YA EXISTENTE en un estado
   * específico (p. ej. "En camino" para poder marcarla como "Entregado", o
   * "Pendiente" para marcarla como "En camino") en vez de crear su propia
   * orden y llevarla paso a paso hasta ese estado. No filtra por
   * facturación: puede devolver una orden ya Facturada (ver
   * obtenerPrimeraOrdenRuteoConEstadoYSeleccionable() para cuando también
   * debe poder facturarse).
   *
   * Nota: filtra directamente sobre las tarjetas ya cargadas por su propia
   * clase (mismo criterio que obtenerEstadoTarjetaRuteo()), sin pasar por
   * los filtros reales FILTRO_RUTEO_* — evita el side-effect de dejar el
   * listado en un filtro distinto de "Todos" para escenarios (12/13/14) que
   * después necesitan localizar la MISMA orden por id sin importar el
   * filtro activo (ya cubierto por asegurarOrdenRuteoVisibleEnListado()).
   */
  async obtenerPrimeraOrdenRuteoConEstado(estado: 1 | 2 | 3): Promise<string> {
    const tarjetaConEstado = this.page
      .locator(`[id^="${L.RUTEO_LISTA_TARJETA_PREFIJO}"].delivery-status-${estado}`)
      .first();

    await expect(
      tarjetaConEstado,
      `No se encontró ninguna Orden de Ruteo con estado de envío ${estado} en el listado`
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const idCompleto = await tarjetaConEstado.getAttribute('id');
    const ordenId = (idCompleto ?? '').replace(L.RUTEO_LISTA_TARJETA_PREFIJO, '');
    expect(ordenId.length, `No se pudo extraer un id numérico del atributo id="${idCompleto}"`).toBeGreaterThan(0);
    return ordenId;
  }

  /**
   * Localiza el id real de la primera Orden de Ruteo que, dentro del filtro
   * REAL "Pendientes"/"En Camino"/"Entregado" (FILTRO_RUTEO_*, botones con
   * id técnico estable — corrige una conclusión anterior de este mismo
   * archivo que los daba por una simple leyenda decorativa, confirmado en
   * vivo que sí filtran), todavía puede seleccionarse para facturar (botón
   * "Seleccionar órden" visible) — a diferencia de
   * obtenerPrimeraOrdenRuteoConEstado() (no filtra por facturación) y de
   * obtenerPrimeraOrdenRuteoSeleccionable() (no filtra por estado de
   * envío), este combina ambos criterios: necesario para escenarios que
   * piden explícitamente una orden de un estado de envío dado que además se
   * pueda facturar de verdad (p. ej. una orden Entregada aún sin facturar).
   * Restaura el filtro "Todos" antes de devolver el id, dejando el listado
   * en el estado que el resto de la suite espera.
   */
  async obtenerPrimeraOrdenRuteoConEstadoYSeleccionable(estado: 1 | 2 | 3): Promise<string> {
    const filtro = estado === 1 ? L.FILTRO_RUTEO_PENDIENTE : estado === 2 ? L.FILTRO_RUTEO_EN_CAMINO : L.FILTRO_RUTEO_ENTREGADO;
    await this.page.locator(filtro).click();

    const tarjetaConBoton = this.page
      .locator(`[id^="${L.RUTEO_LISTA_TARJETA_PREFIJO}"]`)
      .filter({ has: this.page.locator(L.RUTEO_LISTA_BTN_SELECCIONAR) })
      .first();

    await expect(
      tarjetaConBoton,
      `No se encontró ninguna Orden de Ruteo con estado de envío ${estado} que todavía pueda seleccionarse para facturar`
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const idCompleto = await tarjetaConBoton.getAttribute('id');
    const ordenId = (idCompleto ?? '').replace(L.RUTEO_LISTA_TARJETA_PREFIJO, '');
    expect(ordenId.length, `No se pudo extraer un id numérico del atributo id="${idCompleto}"`).toBeGreaterThan(0);

    await this.page.locator(L.FILTRO_RUTEO_TODOS).click();
    return ordenId;
  }

  /**
   * Selecciona ("Seleccionar órden") una Orden de Ruteo YA CREADA, localizada
   * por su id real (mismo criterio "siempre por id real, nunca por posición"
   * que el resto de los métodos de listado de Ruteo — ver el comentario de
   * abrirMenuAccionesOrdenRuteo()), y la carga al carrito del POS. Deja el
   * carrito, el cliente ya asociado a la orden y el resto de controles del
   * POS (Facturar, "AGREGAR ITEMS") exactamente en el mismo estado que
   * cargarPrimeraOrdenCajaDisponible()/importarPrimeraFacturaDisponible()
   * (confirmado en vivo) — mismo flujo genérico de "venta pendiente cargada
   * al carrito", solo con un origen distinto: desde aquí aplica el resto de
   * la infraestructura ya existente (abrirAgregarItem(), presionarFacturar(),
   * cambiarTipoPagoEnModalPago(), quitarClienteSeleccionado(), etc.) sin
   * necesitar nada propio de Ruteo.
   */
  async seleccionarOrdenRuteoParaFacturar(ordenId: string) {
    const tarjeta = this.tarjetaRuteo(ordenId);
    await expect(tarjeta, `La orden de Ruteo #${ordenId} no aparece en el listado "Ruteo"`).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_CARGAR_RUTEO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await tarjeta.locator(L.RUTEO_LISTA_BTN_SELECCIONAR).click();
    await respuestaPromise;

    await expect(
      this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
      'No se cargó ninguna línea de producto tras seleccionar la Orden de Ruteo'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    // El cliente ya asociado a la orden se propaga con una llamada AJAX
    // propia (getCustomerByPosOption) que corre DESPUÉS de la respuesta de
    // AJAX_CARGAR_RUTEO ya esperada arriba — confirmado en vivo (2 corridas)
    // que leer el cliente inmediatamente tras esa primera respuesta puede
    // atrapar el estado transitorio "Cliente de contado" (el placeholder por
    // defecto) en vez del cliente real de la orden, ya en vuelo pero sin
    // resolver todavía. Toda Orden de Ruteo exige un cliente real para
    // crearse (create_routing_order()/confirm_send_routing_order() en
    // pos_routing.js lo validan), así que se espera aquí, de forma explícita,
    // a que ese cliente real quede reflejado antes de devolver el control.
    await expect.poll(
      () => this.hayClienteRealSeleccionado(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El cliente real de la orden no se propagó al carrito tras seleccionarla' }
    ).toBe(true);
  }

  /**
   * Lee el estado de facturación mostrado en la propia tarjeta ("Pendiente"/
   * "Facturado", L.RUTEO_LISTA_LBL_FACTURA) — independiente del estado de
   * envío (obtenerEstadoTarjetaRuteo()): una orden puede estar Entregada y
   * seguir con la factura Pendiente, o viceversa (ver el comentario de
   * L.RUTEO_LISTA_LBL_FACTURA). Antes de leerla, asegura que esté visible
   * en la vista correcta (ver el comentario de
   * asegurarOrdenRuteoVisibleEnListado()): una orden ya Entregada +
   * Facturada vive en "H. de Órdenes", no en "Todos".
   */
  async obtenerEstadoFacturacionOrdenRuteo(ordenId: string): Promise<string> {
    await this.asegurarOrdenRuteoVisibleEnListado(ordenId);
    const texto = await this.tarjetaRuteo(ordenId).locator(L.RUTEO_LISTA_LBL_FACTURA).textContent();
    return (texto ?? '').trim();
  }

  /**
   * Indica si una Orden de Ruteo todavía puede seleccionarse para facturar
   * (el botón "Seleccionar órden" sigue visible en su tarjeta) — confirmado
   * en vivo que este botón desaparece de la tarjeta apenas la orden ya fue
   * facturada, en el mismo momento en que obtenerEstadoFacturacionOrdenRuteo()
   * pasa a "Facturado".
   */
  async ordenRuteoSeleccionable(ordenId: string): Promise<boolean> {
    return this.tarjetaRuteo(ordenId).locator(L.RUTEO_LISTA_BTN_SELECCIONAR).isVisible().catch(() => false);
  }

  /** Cambia al filtro real indicado del listado "Ruteo" (ver el comentario de FILTRO_RUTEO_TODOS). */
  async irAFiltroRuteo(filtro: 'Todos' | 'Pendiente' | 'En Camino' | 'Entregado' | 'H. de Órdenes') {
    const selector = {
      'Todos': L.FILTRO_RUTEO_TODOS,
      'Pendiente': L.FILTRO_RUTEO_PENDIENTE,
      'En Camino': L.FILTRO_RUTEO_EN_CAMINO,
      'Entregado': L.FILTRO_RUTEO_ENTREGADO,
      'H. de Órdenes': L.FILTRO_RUTEO_HISTORIAL,
    }[filtro];
    await this.page.locator(selector).click();
  }

  // ─── Acciones masivas del listado "Ruteo" (menú "Acciones": selección
  // múltiple + Enviar a Ruteo/Cambiar Repartidor/Eliminar + reporte PDF) ─────
  // Ver el comentario de RUTEO_MASIVO_LI_SELECCIONAR para la evidencia
  // completa de cómo se abre/cierra este dropdown.

  /** Ancla estable al botón `[data-toggle="dropdown"]` real del menú "Acciones" del listado Ruteo. */
  private get _btnAccionesMasivasRuteo(): Locator {
    return this.page
      .locator(L.RUTEO_MASIVO_LI_SELECCIONAR)
      .locator('xpath=ancestor::div[contains(@class,"dropdown")][1]//button[@data-toggle="dropdown"]')
      .first();
  }

  /**
   * Abre (o reabre) el dropdown "Acciones" del listado Ruteo — necesario
   * antes de CADA click dentro de él, no solo el primero: Bootstrap lo cierra
   * ante cualquier click fuera, incluido el que marca un checkbox de tarjeta
   * más abajo en la página (confirmado en vivo).
   */
  private async _abrirMenuAccionesMasivasRuteo() {
    await this._btnAccionesMasivasRuteo.click();
    await expect(
      this.page.locator(L.RUTEO_MASIVO_LI_SELECCIONAR),
      'El menú "Acciones" del listado Ruteo no se abrió'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Activa el modo de selección múltiple del listado Ruteo ("Seleccionar"):
   * revela el checkbox de cada tarjeta y los 3 `<li>` de acción masiva.
   * Llamar una sola vez por escenario, después de abrirListadoOrdenesRuteo()/
   * el filtro real que corresponda, antes de marcar ninguna orden.
   */
  async entrarModoSeleccionMasivaRuteo() {
    await this._abrirMenuAccionesMasivasRuteo();
    await this.page.locator(L.RUTEO_MASIVO_LI_SELECCIONAR).click();
  }

  /**
   * Indica si el modo de selección múltiple del listado Ruteo (activado con
   * entrarModoSeleccionMasivaRuteo()) sigue habilitado AHORA MISMO: los 3
   * `<li>` de acción masiva visibles (sin clase `hide`) y al menos un
   * checkbox de tarjeta realmente visible en el DOM. Útil tras cambiar de
   * filtro real (irAFiltroRuteo()) sin volver a clickear "Seleccionar" —
   * confirmado en vivo que `select_orders()` es un TOGGLE cuyo estado
   * persiste entre filtros (no hay que reactivarlo en cada uno).
   */
  async seleccionMasivaRuteoHabilitada(): Promise<boolean> {
    return this.page.evaluate(
      ({ eliminar, cambiarRepartidor, enviar, checkboxPrefijo }) => {
        const acciones = [eliminar, cambiarRepartidor, enviar].map((sel) => document.querySelector(sel));
        if (acciones.some((a) => !a || a.classList.contains('hide'))) return false;
        const checkboxes = Array.from(document.querySelectorAll(`[id^="${checkboxPrefijo}"]`));
        return checkboxes.some((cb) => (cb as HTMLElement).offsetParent !== null);
      },
      {
        eliminar: L.RUTEO_MASIVO_LI_ELIMINAR,
        cambiarRepartidor: L.RUTEO_MASIVO_LI_CAMBIAR_REPARTIDOR,
        enviar: L.RUTEO_MASIVO_LI_ENVIAR,
        checkboxPrefijo: L.RUTEO_MASIVO_CHECKBOX_PREFIJO,
      }
    );
  }

  /**
   * Marca (checkbox) una Orden de Ruteo, localizada por su id real, para una
   * acción masiva ya con entrarModoSeleccionMasivaRuteo() activo. Usa
   * evaluate() como el resto de checkboxes "outside of viewport" de esta
   * clase (ver el comentario de RUTEO_MASIVO_CHECKBOX_PREFIJO) — nunca
   * `.check()`/`.click()` directos, que fallan contra este listado con
   * cientos de tarjetas.
   */
  async marcarOrdenParaAccionMasivaRuteo(ordenId: string) {
    await this.asegurarOrdenRuteoVisibleEnListado(ordenId);
    const checkboxId = `${L.RUTEO_MASIVO_CHECKBOX_PREFIJO}${ordenId}`;
    await this.page.evaluate(
      (id) => (document.getElementById(id) as HTMLInputElement | null)?.click(),
      checkboxId
    );
    await expect(
      this.page.locator(`#${checkboxId}`),
      `El checkbox de selección de la Orden de Ruteo #${ordenId} no quedó marcado`
    ).toBeChecked();
  }

  /**
   * Completa el modal `#modal_change_sellers` compartido por "Enviar a
   * Ruteo"/"Cambiar Repartidor" masivos (ver el comentario de
   * RUTEO_MASIVO_MODAL): elige el primer repartidor real disponible (mismo
   * criterio que seleccionarRepartidorRuteo()) y guarda, esperando la
   * respuesta real del endpoint AJAX correspondiente — nunca solo el toast.
   * Devuelve la respuesta cruda (el caller decide cómo validarla: los dos
   * endpoints NO tienen el mismo contrato de éxito/fallo, ver el comentario
   * de RUTEO_MASIVO_MODAL) y el nombre del repartidor elegido.
   */
  private async _confirmarModalAccionMasivaRuteo(fragmentoUrlAjax: string): Promise<{ respuesta: Response; repartidorSeleccionado: string }> {
    const modal = this.page.locator(L.RUTEO_MASIVO_MODAL);
    await expect(
      modal,
      'El modal de acción masiva del listado Ruteo ("Enviar a Ruteo"/"Cambiar Repartidor") no se abrió'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    // _seleccionarPrimeraOpcionChosen() (NO un `.chosen-results li` "a mano"):
    // confirmado en vivo (root-cause real, no asumido — mismo hallazgo ya
    // documentado en el comentario de ese método) que el primer <li> de este
    // Chosen recién abierto puede ser el propio placeholder "Seleccione un
    // repartidor" en vez de una opción real, dejando la orden sin repartidor
    // nuevo asignado y el assert posterior comparando contra ese texto en
    // vez del repartidor realmente elegido.
    await this._seleccionarPrimeraOpcionChosen(L.RUTEO_MASIVO_MODAL_REPARTIDOR_CHOSEN);
    const repartidorSeleccionado = await this._obtenerTextoChosenSeleccionado(L.RUTEO_MASIVO_MODAL_REPARTIDOR_CHOSEN);
    expect(repartidorSeleccionado, 'El repartidor seleccionado en el modal de acción masiva de Ruteo no quedó visible').not.toBe('');

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(fragmentoUrlAjax),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.RUTEO_MASIVO_MODAL_BTN_GUARDAR).click();
    const respuesta = await respuestaPromise;

    return { respuesta, repartidorSeleccionado };
  }

  /**
   * "Enviar a Ruteo" masivo — ADVERTENCIA (confirmado en vivo, ver el
   * comentario de RUTEO_MASIVO_MODAL): NO reasigna in-place las órdenes ya
   * marcadas con marcarOrdenParaAccionMasivaRuteo(). Crea una orden NUEVA por
   * cada una (con el repartidor elegido aquí), DUPLICANDO en vez de
   * reemplazar — la orden original permanece intacta en el listado. La
   * respuesta responde un array JSON
   * `[{old_order_id, new_order_id, order_number, items_created}]` — el test
   * debe leer `new_order_id` para localizar la orden resultante real.
   */
  async enviarOrdenesRuteoMasivamente() {
    await this._abrirMenuAccionesMasivasRuteo();
    await this.page.locator(L.RUTEO_MASIVO_LI_ENVIAR).click();
    return this._confirmarModalAccionMasivaRuteo(L.AJAX_ENVIAR_RUTEO_MASIVO);
  }

  /**
   * "Cambiar Repartidor" masivo — a diferencia de "Enviar a Ruteo", esta
   * reasigna in-place (mismo id de orden). Ver el comentario de
   * RUTEO_MASIVO_MODAL: usar una orden PROPIA (no la "primera seleccionable"
   * de un listado compartido con ~200+ órdenes) es necesario para obtener
   * una señal confiable — confirmado en vivo que reutilizar una orden ajena
   * puede fallar en silencio ("0") sin que el endpoint tenga la culpa.
   */
  async cambiarRepartidorOrdenesRuteoMasivamente() {
    await this._abrirMenuAccionesMasivasRuteo();
    await this.page.locator(L.RUTEO_MASIVO_LI_CAMBIAR_REPARTIDOR).click();
    return this._confirmarModalAccionMasivaRuteo(L.AJAX_CAMBIAR_REPARTIDOR_MASIVO);
  }

  /**
   * "Eliminar" masivo — confirma el SweetAlert real ("Eliminar Órdenes"/
   * "¿Estás seguro de eliminar la(s) orden(es)?", botón "Enviar") reutilizando
   * _confirmarSweetAlertV1() (mismo widget que el resto de la suite), y
   * espera la respuesta real de AJAX_ELIMINAR_RUTEO_MASIVO — confirmado en
   * vivo que responde "1" (éxito) y elimina la(s) orden(es) por completo del
   * listado (ni siquiera quedan en "H. de Órdenes"). Por ser irreversible,
   * los tests que la usan deben crear sus propias órdenes desechables — nunca
   * reutilizar una orden real ya existente del ambiente QA compartido.
   */
  async eliminarOrdenesRuteoMasivamente(): Promise<Response> {
    await this._abrirMenuAccionesMasivasRuteo();
    await this.page.locator(L.RUTEO_MASIVO_LI_ELIMINAR).click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_ELIMINAR_RUTEO_MASIVO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this._confirmarSweetAlertV1('No apareció la confirmación "Eliminar Órdenes"');
    return respuestaPromise;
  }

  /**
   * Descarga el reporte PDF fijo "Ruteo Sin Repartidor" desde el menú
   * "Acciones" del listado Ruteo — ver el comentario de
   * RUTEO_REPORTE_LI_DESCARGAR_PDF: el mismo reporte sin importar el filtro
   * real activo, así que no valida "pertenece al tab actual" (no aplica en
   * este ambiente).
   */
  async descargarReporteRuteoPDF(): Promise<Download> {
    await this._abrirMenuAccionesMasivasRuteo();
    const downloadPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.RUTEO_REPORTE_LI_DESCARGAR_PDF).click();
    return downloadPromise;
  }

  /**
   * Presiona "Imprimir" (data-mode=0) del menú "Acciones" del listado Ruteo —
   * genera el MISMO reporte fijo "Ruteo Sin Repartidor" que
   * descargarReporteRuteoPDF() (ver la corrección en el comentario de
   * RUTEO_REPORTE_LI_IMPRIMIR: confirmado en vivo comparando ambos PDF byte
   * a byte). Chromium headless entrega el resultado como evento `download`
   * (nombre de archivo aleatorio, no el nombre descriptivo de "Descargar
   * PDF") en vez de `popup`, al interceptar la respuesta PDF que el botón
   * intenta abrir en una ventana nueva.
   */
  async imprimirReporteRuteoPDF(): Promise<Download> {
    await this._abrirMenuAccionesMasivasRuteo();
    const downloadPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.RUTEO_REPORTE_LI_IMPRIMIR).click();
    return downloadPromise;
  }
  async _seleccionarOpcionMoneda(...args: Parameters<PosCore['_seleccionarOpcionMoneda']>) {
    return this.core._seleccionarOpcionMoneda(...args);
  }
  async obtenerInfoMoneda(...args: Parameters<PosCore['obtenerInfoMoneda']>) {
    return this.core.obtenerInfoMoneda(...args);
  }
  async cambiarMoneda(...args: Parameters<PosCore['cambiarMoneda']>) {
    return this.core.cambiarMoneda(...args);
  }
  async asegurarMonedaBaseActiva(...args: Parameters<PosCore['asegurarMonedaBaseActiva']>) {
    return this.core.asegurarMonedaBaseActiva(...args);
  }
  async obtenerSimboloMonedaEnTotal(...args: Parameters<PosCore['obtenerSimboloMonedaEnTotal']>) {
    return this.core.obtenerSimboloMonedaEnTotal(...args);
  }

  // ─── "Crear Proforma" ───────────────────────────────────────────────────────

  /** Locator del modal "Agregar Proforma". */
  get modalCrearProforma() {
    return this.page.locator(L.DIALOG_PROFORMA);
  }

  /**
   * Abre el menú de acciones junto a "Facturar" (mismo menú MDL que "Enviar
   * a caja", L.ORDEN_CAJA_MENU_BTN) y selecciona "PROFORMA". Reutiliza el
   * mismo patrón de reintento + cierre de overlays ya probado en
   * abrirMenuOrdenCaja(), cambiando únicamente el ítem de éxito esperado.
   */
  async abrirCrearProforma() {
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarAvisoConsecutivoSiAparece();

    await this.page.locator('ul.mdl-menu[data-mdl-for="demo-menu-top-right"][data-upgraded*="MaterialMenu"]')
      .waitFor({ state: 'attached', timeout: TIMEOUTS.PRODUCTS_LOAD })
      .catch(() => {});

    const item = this.page.locator(L.PROFORMA_MENU_ITEM);
    const MAX_INTENTOS = 4;
    let abierto = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierto; intento++) {
      await this.cerrarModalNotificacionesSiAparece();
      await this.cerrarAvisoConsecutivoSiAparece();

      await this.page.evaluate(
        (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
        L.ORDEN_CAJA_MENU_BTN
      );
      abierto = await item.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    }
    expect(abierto, `La opción "Proforma" no apareció en el menú de acciones tras ${MAX_INTENTOS} intentos`).toBe(true);

    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      L.PROFORMA_MENU_ITEM
    );

    await expect(this.modalCrearProforma, 'El modal "Agregar Proforma" no apareció tras seleccionar la opción del menú').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Selecciona el tipo de documento en el modal "Agregar Proforma". Las 3
   * tarjetas son mutuamente excluyentes por comportamiento propio de la
   * aplicación (confirmado en vivo: clickear una desmarca automáticamente
   * las otras dos) — pero "Proforma" (Normal) ya viene activa por defecto al
   * abrir el modal, y al ser un checkbox real (no un radio button), clickear
   * una tarjeta YA marcada la desmarca en vez de dejarla igual — confirmado
   * en vivo que este es exactamente el caso al pedir "normal" explícitamente.
   * Por eso solo se clickea si el checkbox no está ya en el estado
   * esperado, mismo criterio que _asegurarCheckboxEstado() ya usa para el
   * resto de checkboxes de la suite. Valida el checkbox real que la tarjeta
   * envuelve (no solo la clase CSS "active-*" de la tarjeta), que es la
   * fuente real del estado.
   */
  async seleccionarTipoProforma(tipo: TipoProforma) {
    const opciones = {
      normal:       { tarjeta: L.PROFORMA_CARD_NORMAL,       checkbox: L.PROFORMA_CHECK_NORMAL },
      consignacion: { tarjeta: L.PROFORMA_CARD_CONSIGNACION, checkbox: L.PROFORMA_CHECK_CONSIGNACION },
      taller:       { tarjeta: L.PROFORMA_CARD_TALLER,       checkbox: L.PROFORMA_CHECK_TALLER },
    } as const;
    const { tarjeta, checkbox } = opciones[tipo];

    const checkboxLocator = this.page.locator(checkbox);
    if (!(await checkboxLocator.isChecked())) {
      await this.page.locator(tarjeta).click();
    }
    await expect(
      checkboxLocator,
      `El checkbox interno de la tarjeta de tipo de Proforma "${tipo}" no quedó marcado`
    ).toBeChecked();
  }

  /** Locator del campo "Nombre del cliente" del modal "Agregar Proforma" — expuesto para que los tests validen su valor directamente. */
  get campoNombreClienteProforma() {
    return this.page.locator(L.PROFORMA_CLIENTE_INPUT);
  }

  /** Llena el campo "Nombre del cliente" del modal "Agregar Proforma" con texto libre. */
  async llenarNombreClienteProforma(nombre: string) {
    await this.campoNombreClienteProforma.fill(nombre);
  }

  /**
   * Selecciona el primer vendedor real disponible en "Agregar Proforma" —
   * mismo criterio que seleccionarVendedorOrdenCaja() (catálogo
   * configurable por la empresa, sin nombre estable). Devuelve el nombre
   * realmente seleccionado.
   */
  async seleccionarVendedorProforma(): Promise<string> {
    await this._seleccionarPrimeraOpcionChosen(L.PROFORMA_VENDEDOR_CHOSEN);
    const nombreVendedor = await this._obtenerTextoChosenSeleccionado(L.PROFORMA_VENDEDOR_CHOSEN);
    expect(nombreVendedor, 'El vendedor seleccionado en "Agregar Proforma" no quedó visible').not.toBe('');
    return nombreVendedor;
  }

  /**
   * Presiona "Crear Proforma", confirma el SweetAlert de advertencia
   * ("¿Esta seguro de crear esta proforma?") y espera la respuesta real de
   * red que efectivamente la guarda (addPosProductProform) — mismo patrón
   * ya usado en enviarOrdenCaja(): la espera del AJAX se arma ANTES de
   * confirmar el SweetAlert, no después, para no perderse la respuesta si
   * llega muy rápido.
   */
  async guardarProformaYObtenerRespuesta(): Promise<Response> {
    await this.page.locator(L.PROFORMA_BTN_GUARDAR).click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_PROFORMA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this._confirmarSweetAlertV1('No apareció la confirmación "¿Esta seguro de crear esta proforma?"');
    return respuestaPromise;
  }

  /**
   * Valida que "Crear Proforma" terminó exitosamente, sin depender
   * únicamente del toast: la respuesta real de addPosProductProform
   * respondió OK, el modal de captura se cerró, y el modal de Gestión de
   * Proforma apareció automáticamente.
   */
  async validarProformaCreada(respuesta: Response) {
    expect(respuesta.ok(), `${L.AJAX_GUARDAR_PROFORMA} no respondió OK (status ${respuesta.status()})`).toBe(true);

    await expect(
      this.modalCrearProforma,
      'El modal "Agregar Proforma" no se cerró tras confirmar el guardado'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await expect(
      this.modalGestionProforma,
      'El modal "Gestión de Proforma" no apareció tras crear la proforma'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  // ─── Gestión de Proforma (modal posterior al guardado) ─────────────────────

  /** Locator del modal "Gestión de Proforma" que aparece automáticamente tras guardar. */
  get modalGestionProforma() {
    return this.page.locator(L.DIALOG_GESTION_PROFORMA);
  }

  /**
   * Cierra el modal de Gestión de Proforma con su botón "Cerrar" — necesario
   * antes de cualquier interacción posterior con el resto del POS (p. ej.
   * el menú de moneda): confirmado en vivo que este modal usa
   * `data-backdrop="static"` y, mientras sigue abierto, intercepta clicks en
   * cualquier otro elemento de la página, incluido `#menu_type_currency`.
   */
  async cerrarModalGestionProforma() {
    await this.modalGestionProforma.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(this.modalGestionProforma).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Presiona "Enviar por correo" en el modal de Gestión de Proforma y
   * devuelve la respuesta real del AJAX (sendProformByEmail, cuerpo crudo
   * "1"=éxito / "0"=fallo, no JSON) — confirmado en vivo que solo responde
   * éxito si la Proforma se creó con un cliente existente (con nombre libre
   * responde "0" y el sistema muestra el toast "Error al enviar
   * proforma!").
   */
  async enviarProformaPorCorreo(): Promise<Response> {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_ENVIAR_PROFORMA_CORREO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.GESTION_PROFORMA_BTN_CORREO).click();
    return respuestaPromise;
  }

  /**
   * Presiona "Descargar PDF" en el modal de Gestión de Proforma y devuelve
   * el evento de descarga real del navegador — confirmado en vivo que el
   * nombre sugerido sigue el patrón "PROFORMA #<número>.pdf".
   */
  async descargarPdfProforma(): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.GESTION_PROFORMA_BTN_PDF).click();
    return downloadPromise;
  }

  /**
   * Presiona "Imprimir" en el modal de Gestión de Proforma y devuelve la
   * ventana emergente ya cargada — confirmado en vivo que su contenido se
   * renderiza vía document.write() (la URL queda en "about:blank", igual
   * que el resto de ventanas de impresión de esta suite), así que quien
   * llama puede validar el contenido antes de cerrarla con
   * mostrarYCerrarVentanaImpresion().
   */
  async imprimirProforma(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.GESTION_PROFORMA_BTN_IMPRIMIR).click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    return popup;
  }

  /**
   * Presiona "Ver todas" en el modal de Gestión de Proforma y devuelve la
   * ventana emergente — confirmado en vivo que lleva al mismo destino real
   * (proform/printPosProform) que ya valida abrirHistorialProformas() desde
   * el menú de tres puntos, aunque el elemento que dispara el click es
   * distinto (el propio modal de gestión, no el menú de tres puntos), por
   * lo que no puede reutilizarse ese método tal cual.
   */
  async verTodasLasProformas(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.GESTION_PROFORMA_BTN_VER_TODAS).click();
    return popupPromise;
  }

  // ─── "Generar Apartado" ─────────────────────────────────────────────────────
  //
  // A diferencia de Proforma y Enviar a caja, "Generar Apartado" NO abre un
  // modal propio: reutiliza el modal de pago normal (#dialog_payment),
  // mostrando #make_layaway en vez de #make_payment (confirmado en vivo,
  // Fase 1). Todo lo demás del modal (cliente Forma 1/2, vendedor, métodos de
  // pago, descuentos) son los MISMOS campos que ya usa el resto de la suite —
  // ver seleccionarClienteExistente(), seleccionarPagoEfectivo(),
  // seleccionarPagoExacto()/seleccionarPagoParcial(), seleccionarPagoMixto(),
  // aplicarDescuentoIndividual(), activarDescuentoGeneral().

  /** Locator del botón "GENERAR APARTADO" — única señal confiable de que el modal de pago quedó en modo Apartado. */
  get botonGenerarApartado() {
    return this.page.locator(L.APARTADO_BTN_GENERAR);
  }

  /**
   * Abre el menú de acciones junto a "Facturar" (mismo menú MDL que "Enviar a
   * caja"/"Proforma", L.ORDEN_CAJA_MENU_BTN) y selecciona "Generar Apartado".
   * Reutiliza el mismo patrón de reintento + cierre de overlays ya probado en
   * abrirMenuOrdenCaja()/abrirCrearProforma(), cambiando únicamente el ítem y
   * la señal de éxito esperada (el botón #make_layaway, no un modal propio).
   *
   * IMPORTANTE (confirmado en vivo tras investigar a fondo un falso positivo):
   * el POS debe haberse cargado con cargarPosDesdeDashboard() —no con
   * cargarPosYCerrarModalSiAparece()—, igual que ya hacen pos-proforma.spec.ts
   * y pos-orden-caja.spec.ts. Cargar directo a la URL del POS dispara una
   * condición de carga en frío ya documentada (ver el comentario de
   * cargarPosDesdeDashboard()) que puede abortar la inicialización de un
   * widget no relacionado (Selectize de #invoice_customer_email) y, por
   * efecto colateral, impedir que este botón llegue a mostrarse.
   */
  async abrirCrearApartado() {
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarAvisoConsecutivoSiAparece();

    await this.page.locator('ul.mdl-menu[data-mdl-for="demo-menu-top-right"][data-upgraded*="MaterialMenu"]')
      .waitFor({ state: 'attached', timeout: TIMEOUTS.PRODUCTS_LOAD })
      .catch(() => {});

    const item = this.page.locator(L.APARTADO_MENU_ITEM);
    const MAX_INTENTOS = 4;
    let abierto = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierto; intento++) {
      await this.cerrarModalNotificacionesSiAparece();
      await this.cerrarAvisoConsecutivoSiAparece();

      await this.page.evaluate(
        (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
        L.ORDEN_CAJA_MENU_BTN
      );
      abierto = await item.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    }
    expect(abierto, `La opción "Generar Apartado" no apareció en el menú de acciones tras ${MAX_INTENTOS} intentos`).toBe(true);

    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      L.APARTADO_MENU_ITEM
    );

    await expect(this.botonGenerarApartado, 'El botón "GENERAR APARTADO" no apareció tras seleccionar la opción del menú').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Busca y selecciona un cliente DENTRO del modal de pago (Forma 2): escribe
   * en el input propio del modal (APARTADO_CLIENTE_INPUT_BUSQUEDA, distinto al
   * de arriba del carrito), dispara el mismo AJAX (CLIENTE_AJAX_BUSQUEDA) y
   * elige la primera opción real de un Chosen (APARTADO_CLIENTE_CHOSEN).
   *
   * Confirmado en vivo, corrigiendo un supuesto inicial equivocado: NO
   * reutiliza las tarjetas .customer-list-pos de Forma 1 —esas sí se
   * renderizan con los datos correctos, pero quedan anidadas dentro de un
   * contenedor que permanece display:none mientras el modal está abierto, así
   * que no son clickeables ni visibles para un usuario real—. El control
   * realmente visible es el Chosen #payment_credit_client_chosen (mismo
   * patrón que seleccionarClienteEnOrdenCaja()); confirmado en vivo que elegir
   * una opción ahí sí sincroniza #customer_select, el campo que add_layaway()
   * efectivamente lee al guardar.
   */
  async seleccionarClienteEnModalApartado(terminoBusqueda = ''): Promise<string> {
    await this.page.locator(L.APARTADO_CLIENTE_INPUT_BUSQUEDA).fill(terminoBusqueda);

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.CLIENTE_AJAX_BUSQUEDA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.APARTADO_CLIENTE_BTN_BUSCAR).click();
    await respuestaPromise;

    await this._seleccionarPrimeraOpcionChosen(L.APARTADO_CLIENTE_CHOSEN);

    const nombreCliente = await this._obtenerTextoChosenSeleccionado(L.APARTADO_CLIENTE_CHOSEN);
    expect(nombreCliente, 'El nombre del cliente seleccionado en "Generar Apartado" no quedó visible').not.toBe('');

    await expect(
      this.page.locator(L.CLIENTE_SELECT_OCULTO),
      'El cliente elegido en el modal no quedó registrado en #customer_select'
    ).not.toHaveValue('');

    console.log(`[seleccionarClienteEnModalApartado] Cliente seleccionado: "${nombreCliente}"`);
    return nombreCliente;
  }

  /**
   * Presiona "GENERAR APARTADO", confirma el SweetAlert de advertencia
   * ("¿Está seguro de realizar este Apartado?") y espera la respuesta real de
   * red que efectivamente lo crea (AJAX_GUARDAR_APARTADO) — mismo patrón ya
   * usado en enviarOrdenCaja()/guardarProformaYObtenerRespuesta(): la espera
   * del AJAX se arma ANTES de confirmar el SweetAlert, no después.
   *
   * El sistema abre además una ventana de impresión del Apartado tras crearlo
   * (confirmado en vivo) que este método no cerraba — quedaba abierta de
   * fondo mientras el resto del escenario seguía interactuando con la página
   * original. Mismo patrón ya usado en confirmarCerrarCaja(): el listener de
   * "popup" se arma ANTES del click (con `.catch(() => null)`, nunca
   * bloqueante, porque no todos los ambientes la muestran) y se cierra con
   * mostrarYCerrarVentanaImpresion() recién después de confirmar el éxito
   * real vía AJAX_GUARDAR_APARTADO, para no competir con la propia creación
   * del Apartado.
   */
  async guardarApartadoYObtenerRespuesta(): Promise<Response> {
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP }).catch(() => null);

    await this.botonGenerarApartado.click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_APARTADO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this._confirmarSweetAlertV1('No apareció la confirmación "¿Está seguro de realizar este Apartado?"');
    const respuesta = await respuestaPromise;

    const printPage = await popupPromise;
    if (printPage) {
      await this.mostrarYCerrarVentanaImpresion(printPage);
    }

    return respuesta;
  }

  /**
   * Valida que "Generar Apartado" terminó exitosamente: la respuesta real de
   * AJAX_GUARDAR_APARTADO respondió OK con un id numérico (>=1, mismo
   * contrato que el resto de la suite), el modal de pago se cerró y el
   * carrito quedó vacío. A diferencia de Proforma, Apartado NO tiene un modal
   * de "Gestión" posterior (confirmado en vivo, Fase 1) — solo cierra
   * #dialog_payment y limpia el carrito.
   */
  async validarApartadoCreado(respuesta: Response) {
    expect(respuesta.ok(), `${L.AJAX_GUARDAR_APARTADO} no respondió OK (status ${respuesta.status()})`).toBe(true);

    const cuerpo = (await respuesta.text()).trim();
    expect(parseInt(cuerpo, 10), `${L.AJAX_GUARDAR_APARTADO} no devolvió un id válido (respondió "${cuerpo}")`).toBeGreaterThanOrEqual(1);

    await expect(
      this.botonGenerarApartado,
      'El modal de pago no se cerró tras confirmar el Apartado'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await this.validarCarritoVacio();
  }

  // ─── Apartado YA EXISTENTE: localizar, cargar y "Abonar" ───────────────────
  // Mismo criterio "primera disponible, sin buscar" que cargarPrimeraOrdenCajaDisponible()
  // — ver el comentario de L.AJAX_CARGAR_APARTADO para la evidencia de por qué
  // se reutilizan L.IMPORTAR_FACTURA_FILA/L.ORDEN_CAJA_LISTA_BTN_CARGAR tal
  // cual en vez de declarar un selector nuevo idéntico.

  /**
   * Carga el primer Apartado disponible en la pestaña ya abierta — mismo
   * patrón exacto que cargarPrimeraOrdenCajaDisponible(), solo que espera
   * AJAX_CARGAR_APARTADO en vez de AJAX_CARGAR_ORDEN_CAJA.
   */
  async cargarPrimerApartadoDisponible() {
    const filas = this.page.locator(L.IMPORTAR_FACTURA_FILA);
    const primeraFila = filas.first();
    await expect(primeraFila, 'No hay ningún Apartado disponible').toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_CARGAR_APARTADO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await primeraFila.locator(L.ORDEN_CAJA_LISTA_BTN_CARGAR).click();
    await respuestaPromise;

    await expect(
      this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
      'No se cargó ninguna línea de producto tras seleccionar el Apartado'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Busca Apartados usando el campo de búsqueda REAL de esta pestaña:
   * `#product_search` (L.PRODUCTO_BUSCADOR_GRID), el mismo input reutilizado
   * por buscarProductoEnGrid()/buscarOrdenesCajaPorTexto() — persiste en el
   * header del POS sin importar el tab activo. CORRECCIÓN: un comentario
   * previo en este archivo (igual que el que existía para Órdenes de Caja
   * antes de buscarOrdenesCajaPorTexto()) afirmaba que esta pestaña no tenía
   * campo de búsqueda propio; confirmado en vivo interceptando la red que sí
   * lo tiene — mientras "Apartados" está activa dispara su propio AJAX real
   * (`getPosLayawaySearch`, L.AJAX_BUSCAR_APARTADO, con `search=<texto>` y
   * `state=pending`) que reemplaza el listado de tarjetas por el resultado
   * filtrado en el servidor. Confirmado en vivo que este buscador indexa el
   * "Apartado No" (el número real, sin el prefijo "Apartado No:" que sí
   * muestra la tarjeta — buscar con ese prefijo devuelve 0 resultados) y el
   * nombre del cliente.
   */
  async buscarApartadosPorTexto(texto: string) {
    const totalAntes = await this.contarApartadosVisibles();

    // Mismo cuidado que buscarOrdenesCajaPorTexto(): la carga inicial de la
    // pestaña ya dispara su propia llamada a este mismo endpoint (con
    // `search=` vacío), cuya respuesta puede seguir en vuelo y resolver
    // después de que este método ya empezó a esperar la próxima — se
    // distingue por el contenido real de la petición, no solo por la URL.
    const respuestaPromise = this.page.waitForResponse((res) => {
      if (!res.url().includes(L.AJAX_BUSCAR_APARTADO)) return false;
      const post = decodeURIComponent((res.request().postData() ?? '').replace(/\+/g, ' '));
      return post.includes(texto);
    }, { timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.buscarProductoEnGrid(texto);
    await respuestaPromise;

    // La respuesta ya resuelta no garantiza que el DOM ya haya reemplazado
    // las tarjetas con el resultado filtrado — se espera la condición real:
    // que el total de tarjetas cambie del valor previo a buscar.
    await expect.poll(
      () => this.contarApartadosVisibles(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El resultado de la búsqueda no terminó de renderizarse' }
    ).not.toBe(totalAntes);
  }

  /** Cuenta las tarjetas de Apartado actualmente renderizadas en la pestaña — útil antes/después de buscarApartadosPorTexto() para validar que la búsqueda realmente redujo el conjunto. */
  async contarApartadosVisibles(): Promise<number> {
    return this.page.locator(L.IMPORTAR_FACTURA_FILA).count();
  }

  /**
   * Cuenta, sobre las tarjetas de Apartado YA renderizadas (p. ej. tras un
   * buscarApartadosPorTexto() con un resultado más amplio que 1), cuántas
   * contienen `texto` en su contenido visible — util para confirmar que un
   * Apartado puntual sigue presente dentro de un resultado de búsqueda
   * parcial más amplio, sin volver a golpear el servidor.
   */
  async contarApartadosConTexto(texto: string): Promise<number> {
    return this.page.locator(L.IMPORTAR_FACTURA_FILA).filter({ hasText: texto }).count();
  }

  /**
   * Lee el "Apartado No: X" (número real y visible) de la primera tarjeta de
   * la pestaña "Apartados" ya abierta. Necesario porque el id que devuelve
   * AJAX_GUARDAR_APARTADO es un id interno de base de datos (confirmado en
   * vivo: p. ej. "670") que NO coincide con el "Apartado No" que la propia
   * tarjeta muestra (p. ej. "120", un consecutivo aparte) ni aparece en
   * ningún texto — visible u oculto — de la tarjeta por el que
   * filtrarApartadosPorTexto() pueda localizarlo. Confirmado en vivo que la
   * pestaña ordena de más reciente a más antiguo: tras crear un Apartado y
   * (re)visitar esta pestaña, el recién creado siempre queda de primero.
   */
  async obtenerNumeroApartadoTarjetaMasReciente(): Promise<string> {
    const texto = await this.page.locator(L.IMPORTAR_FACTURA_FILA).first().innerText();
    const coincidencia = texto.match(/Apartado No:\s*(\d+)/);
    expect(coincidencia, `No se pudo leer "Apartado No" de la primera tarjeta: "${texto}"`).not.toBeNull();
    return coincidencia![1];
  }

  /**
   * Carga el primer Apartado disponible cuyo "Total" visible en la tarjeta
   * sea razonable (< 100,000) — confirmado en vivo (2 hallazgos
   * independientes, en dos monedas distintas: "₡6,656,677,711.25" y
   * "$14,557,786.76") que este ambiente compartido de QA tiene Apartados ya
   * existentes con un Total corrupto, inflado varios órdenes de magnitud
   * por un bug real del sistema al leer un Apartado guardado en una moneda
   * distinta a la que esté activa en ese momento (ver el comentario del
   * describe "Apartados — Moneda contraria a la base" en
   * pos-apartado.spec.ts). cargarPrimerApartadoDisponible() sigue siendo
   * correcto para escenarios que no comparan totales numéricos (agregar
   * ítems, abonar, facturar sin comparar antes/después); este método es
   * para los que sí lo hacen, y evita heredar ese dato corrupto sin
   * necesidad de "arreglar" el Apartado en sí (fuera del alcance de esta
   * suite).
   */
  async cargarPrimerApartadoConTotalRazonable() {
    const UMBRAL_TOTAL_SOSPECHOSO = 100_000;
    const MAX_INTENTOS = 5;

    // El Total corrupto NO es detectable leyendo la tarjeta antes de cargarla
    // (su "Total:" visible ahí ya es incorrecto/inflado también, confirmado
    // en vivo) — solo se confirma tras cargar el Apartado al carrito. Por
    // eso se carga primero y se valida después, reintentando con el
    // siguiente candidato (por posición: el Apartado corrupto sigue
    // "pendiente" en el sistema tras vaciarCarrito(), así que seguiría
    // apareciendo de primero si se repitiera tarjetas.first() — se avanza
    // por índice para no reintentar siempre el mismo).
    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      const tarjetas = this.page.locator(L.IMPORTAR_FACTURA_FILA);
      await expect(
        tarjetas.nth(intento),
        `No hay un Apartado en la posición ${intento} para reintentar`
      ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

      const respuestaPromise = this.page.waitForResponse(
        (res) => res.url().includes(L.AJAX_CARGAR_APARTADO),
        { timeout: TIMEOUTS.PAYMENT_MODAL }
      );
      await tarjetas.nth(intento).locator(L.ORDEN_CAJA_LISTA_BTN_CARGAR).click();
      await respuestaPromise;

      await expect(
        this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
        'No se cargó ninguna línea de producto tras seleccionar el Apartado'
      ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

      // Confirmado en vivo: el Total corrupto no siempre está reflejado en
      // el instante justo en que la primera línea aparece — una recalculación
      // asíncrona posterior (disparada por el propio conflicto de moneda) lo
      // termina de inflar unos instantes después. Se espera a que el carrito
      // "asiente" (mismo criterio que el resto de la suite tras un cambio de
      // carrito) antes de leer el total, para no dejar pasar un Apartado que
      // en realidad sí está corrupto.
      await this.page.waitForTimeout(PAUSES.VER_CARRITO);

      const totalCargado = await this.obtenerTotalVentaNumerico();
      if (totalCargado < UMBRAL_TOTAL_SOSPECHOSO) return;

      console.log(`[cargarPrimerApartadoConTotalRazonable] Apartado en posición ${intento} cargó con un Total corrupto (${totalCargado}) — se descarta y se reintenta con el siguiente.`);
      await this.vaciarCarrito();
      const pestanaApartados = await this.localizarPestanaApartados();
      if (pestanaApartados) await this.visitarPestanaPos(pestanaApartados);
    }
    throw new Error(`No se encontró ningún Apartado con un Total razonable (< ${UMBRAL_TOTAL_SOSPECHOSO}) entre los primeros ${MAX_INTENTOS} disponibles.`);
  }

  /**
   * Abre el menú de acciones junto a "Facturar" y selecciona "Abonar" — mismo
   * patrón de reintento que abrirCrearApartado()/abrirMenuOrdenCaja(),
   * cambiando únicamente el ítem (L.ABONO_MENU_ITEM) y la señal de éxito
   * esperada (L.ABONO_BTN_REALIZAR, "REALIZAR ABONO" — el modal de pago
   * normal reutilizado una vez más, ver el comentario de L.ABONO_MENU_ITEM).
   * Requiere un Apartado ya cargado al carrito (cargarPrimerApartadoDisponible());
   * "Abonar" no aparece visible en el menú si el carrito está vacío o si el
   * carrito no proviene de un Apartado ya existente (confirmado en vivo).
   */
  async abrirRealizarAbono() {
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarAvisoConsecutivoSiAparece();

    await this.page.locator('ul.mdl-menu[data-mdl-for="demo-menu-top-right"][data-upgraded*="MaterialMenu"]')
      .waitFor({ state: 'attached', timeout: TIMEOUTS.PRODUCTS_LOAD })
      .catch(() => {});

    const item = this.page.locator(L.ABONO_MENU_ITEM);
    const MAX_INTENTOS = 4;
    let abierto = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierto; intento++) {
      await this.cerrarModalNotificacionesSiAparece();
      await this.cerrarAvisoConsecutivoSiAparece();

      await this.page.evaluate(
        (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
        L.ORDEN_CAJA_MENU_BTN
      );
      abierto = await item.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    }
    expect(abierto, `La opción "Abonar" no apareció en el menú de acciones tras ${MAX_INTENTOS} intentos`).toBe(true);

    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      L.ABONO_MENU_ITEM
    );

    await expect(
      this.page.locator(L.ABONO_BTN_REALIZAR),
      'El botón "REALIZAR ABONO" no apareció tras seleccionar la opción del menú'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Presiona "REALIZAR ABONO", confirma el SweetAlert de advertencia
   * ("¿Está seguro(a) de realizar este abono?" — mismo widget SweetAlert v1,
   * reutiliza _confirmarSweetAlertV1() tal cual pese a que el botón real dice
   * "Continuar" en vez de "Aceptar": confirmado en vivo que el selector
   * `.sweet-alert.visible button.confirm` no depende del texto visible) y
   * espera la respuesta real de red que efectivamente registra el abono
   * (AJAX_APLICAR_ABONO).
   */
  async aplicarAbonoYObtenerRespuesta(): Promise<Response> {
    // El sistema abre una ventana de impresión del comprobante de abono tras
    // aplicarlo (confirmado en vivo: es la causa real de que el modal
    // "REALIZAR ABONO" pareciera no cerrarse — quedaba abierta de fondo,
    // mismo hallazgo ya corregido en guardarApartadoYObtenerRespuesta()). El
    // listener de "popup" se arma ANTES del click (con `.catch(() => null)`,
    // nunca bloqueante, porque no todos los ambientes la muestran) y se
    // cierra con mostrarYCerrarVentanaImpresion() recién después de
    // confirmar el éxito real vía AJAX_APLICAR_ABONO.
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP }).catch(() => null);

    await this.page.locator(L.ABONO_BTN_REALIZAR).click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_APLICAR_ABONO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this._confirmarSweetAlertV1('No apareció la confirmación "¿Está seguro(a) de realizar este abono?"');
    const respuesta = await respuestaPromise;

    // El toast de confirmación es transitorio (se autodesvanece a los pocos
    // segundos) — confirmado en vivo que revisarlo DESPUÉS de cerrar la
    // ventana de impresión (mostrarYCerrarVentanaImpresion() por sí sola ya
    // toma ~6s de esperas propias) puede perderlo por completo, aunque el
    // abono se haya aplicado correctamente. Se verifica aquí, apenas llega
    // la respuesta real, antes de gastar tiempo cerrando el popup — la
    // misma validación que antes vivía en validarAbonoAplicado(), reubicada
    // por la carrera de tiempo real que introdujo el manejo del popup.
    await expect(
      this.page.locator('.noty_bar', { hasText: /abono/i }),
      'No apareció el toast de confirmación del abono'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const printPage = await popupPromise;
    if (printPage) {
      await this.mostrarYCerrarVentanaImpresion(printPage);
    }

    return respuesta;
  }

  /**
   * Valida que "Abonar" terminó exitosamente: la respuesta real de
   * AJAX_APLICAR_ABONO respondió OK y el modal de pago se cerró (el toast de
   * confirmación ya se verificó en aplicarAbonoYObtenerRespuesta(), antes de
   * cerrar la ventana de impresión — ver su comentario). A diferencia de
   * validarApartadoCreado()/validarOrdenCajaCreada(), NO valida carrito
   * vacío: confirmado en vivo que las líneas del Apartado permanecen en el
   * carrito tras aplicar un abono (el Apartado sigue pendiente, solo se
   * registró un pago parcial).
   */
  async validarAbonoAplicado(respuesta: Response) {
    expect(respuesta.ok(), `${L.AJAX_APLICAR_ABONO} no respondió OK (status ${respuesta.status()})`).toBe(true);

    await expect(
      this.page.locator(L.ABONO_BTN_REALIZAR),
      'El modal de pago no se cerró tras confirmar el abono'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  // ─── "Importar Factura" ─────────────────────────────────────────────────────

  /**
   * Visita la pestaña "Importar factura". A diferencia de Proforma/Apartado/
   * Enviar a caja (que abren un ítem del menú desplegable junto a "Facturar"),
   * esta es una pestaña superior con id técnico estable, ya registrada en
   * PESTANAS_POS_A_RECORRER (confirmado en vivo). Envuelve visitarPestanaPos()
   * únicamente para mantener la misma simetría de nombres ("abrirX") que
   * abrirCrearProforma()/abrirMenuOrdenCaja()/abrirCrearApartado() — no
   * duplica ninguna lógica propia.
   */
  async abrirImportarFactura() {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Importar factura')!;
    await this.visitarPestanaPos(pestana);
  }

  /**
   * Selecciona la primera factura disponible en la pestaña ya abierta
   * (abrirImportarFactura()) y la importa — mismo criterio "primera
   * disponible" que el resto de la suite ya usa para catálogos sin nombre
   * estable (clientes, productos, vendedores). Funciona igual sin importar si
   * la factura tiene un cliente asociado o es "Cliente de contado": confirmado
   * en vivo que la propia app sincroniza #customer_select en ambos casos
   * (con el id real, o dejándolo en 0), sin necesitar lógica especial aquí.
   *
   * Confirmado en vivo, a diferencia de Apartado/Enviar a caja/Proforma: NO
   * hay SweetAlert de confirmación antes de importar — el click en "IMPORTAR"
   * ejecuta directo. Valida que las líneas de producto realmente se cargaron
   * usando IMPORTAR_FACTURA_CARRITO_FILAS (tr.main_row), no CARRITO_CLAVES:
   * confirmado en vivo que las filas importadas no llevan el id
   * "drag_and_drop_" que sí usa el resto de la suite.
   *
   * Selecciona SIEMPRE la primera fila tal como aparece en la lista (índice
   * 0), sin ordenar ni filtrar por monto ni por ningún otro criterio de
   * búsqueda. Motivo (indicado explícitamente para esta suite, no inferido
   * aquí): el catálogo compartido de este ambiente de QA tiene facturas con
   * descripciones de producto extremadamente largas que rompen selectores y
   * validaciones del carrito ajenos al objetivo de estas pruebas — elegir por
   * otro criterio (p. ej. la vieja lógica de "menor monto visible") puede
   * aterrizar en una de esas sin ninguna forma de evitarlo de antemano,
   * mientras que la primera de la lista no presenta ese problema. Si la lista
   * está vacía, falla explícitamente en vez de buscar una alternativa.
   */
  async importarPrimeraFacturaDisponible() {
    const filas = this.page.locator(L.IMPORTAR_FACTURA_FILA);
    const primeraFila = filas.first();
    await expect(primeraFila, 'No hay ninguna factura disponible para importar').toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const respuestaDetalle = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_DETALLE_IMPORTAR_FACTURA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await primeraFila.click();
    await respuestaDetalle;

    const botonImportar = this.page.locator(L.IMPORTAR_FACTURA_BTN_IMPORTAR);
    await expect(botonImportar, 'El botón "IMPORTAR" no apareció en el modal de detalle de la factura').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const respuestaImportar = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_IMPORTAR_FACTURA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await botonImportar.click();
    await respuestaImportar;

    await expect(
      this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
      'No se cargó ninguna línea de producto tras importar la factura'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Indica si hay un cliente REAL seleccionado en el carrito ahora mismo
   * (ver el comentario de L.CLIENTE_BTN_QUITAR) — "Cliente de contado" (el
   * placeholder por defecto, p. ej. de una factura recién importada sin
   * cliente propio) devuelve false.
   */
  async hayClienteRealSeleccionado(): Promise<boolean> {
    return this.page.locator(L.CLIENTE_BTN_QUITAR).isVisible().catch(() => false);
  }

  /**
   * Lee el nombre del cliente actualmente mostrado arriba del carrito
   * (L.CLIENTE_NOMBRE_SELECCIONADO) — mismo campo que seleccionarClienteExistente()/
   * seleccionarClienteExistenteDistintoDe() ya leen justo después de elegir
   * uno, expuesto aquí como lectura independiente para validar qué cliente
   * quedó asociado a una venta ya cargada al carrito (p. ej. una Orden de
   * Ruteo seleccionada con seleccionarOrdenRuteoParaFacturar()) sin tener que
   * volver a elegir ninguno.
   */
  async obtenerClienteSeleccionado(): Promise<string> {
    return ((await this.page.locator(L.CLIENTE_NOMBRE_SELECCIONADO).textContent()) ?? '').trim();
  }

  /**
   * Quita el cliente real actualmente seleccionado del carrito (ícono "X"
   * junto a su nombre), dejándolo en "Cliente de contado". Sin SweetAlert de
   * confirmación que esperar (confirmado en vivo, ver el comentario de
   * L.CLIENTE_BTN_QUITAR) — solo se espera a que el propio ícono desaparezca,
   * señal real de que el cliente ya no está seleccionado.
   */
  async quitarClienteSeleccionado() {
    await this.page.locator(L.CLIENTE_BTN_QUITAR).click();
    await expect(
      this.page.locator(L.CLIENTE_BTN_QUITAR),
      'El cliente no se quitó: el ícono "X" sigue visible'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Importa la factura en la posición `indice` de la lista ya renderizada —
   * mismo click+espera de AJAX que importarPrimeraFacturaDisponible() (no se
   * reutiliza esa función tal cual porque siempre opera sobre `.first()`;
   * ver el comentario de _cargarOrdenCajaQueCumpla() en esta misma clase para
   * el mismo criterio ya aplicado a Órdenes de Caja: se prefiere una pequeña
   * duplicación puntual a modificar un método público ya en uso por varios
   * tests).
   */
  private async _importarFacturaEnPosicion(indice: number) {
    const filas = this.page.locator(L.IMPORTAR_FACTURA_FILA);
    await expect(
      filas.nth(indice),
      `No hay una factura en la posición ${indice} para reintentar`
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const respuestaDetalle = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_DETALLE_IMPORTAR_FACTURA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await filas.nth(indice).click();
    await respuestaDetalle;

    const botonImportar = this.page.locator(L.IMPORTAR_FACTURA_BTN_IMPORTAR);
    await expect(botonImportar, 'El botón "IMPORTAR" no apareció en el modal de detalle de la factura').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const respuestaImportar = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_IMPORTAR_FACTURA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await botonImportar.click();
    await respuestaImportar;

    await expect(
      this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
      'No se cargó ninguna línea de producto tras importar la factura'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Importa la primera factura disponible que cumpla `predicado` (evaluado
   * DESPUÉS de importarla — no hay forma de saber si una factura trae
   * cliente sin importarla primero, a diferencia de Órdenes de Caja/Apartado
   * que sí exponen esos datos en la propia tarjeta). Si `predicado` no se
   * cumple, vacía el carrito y reintenta con la siguiente factura de la
   * lista — mismo patrón de reintento por posición ya usado en
   * cargarPrimerApartadoConTotalRazonable().
   */
  private async _importarFacturaQueCumpla(predicado: () => Promise<boolean>, descripcion: string) {
    const MAX_INTENTOS = 10;
    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      await this._importarFacturaEnPosicion(intento);

      // Confirmado en vivo (2 corridas de la MISMA factura, una recién tras
      // importar y otra momentos después): si el import trae un cliente real
      // vinculado, ese vínculo puede tardar un instante más en reflejarse en
      // el DOM que las líneas de producto (una llamada async independiente,
      // posterior a getPosImportInvoiceItemList) — leer
      // hayClienteRealSeleccionado() de inmediato puede dar un falso "no
      // tiene cliente". Se espera a que el carrito "asiente" (mismo criterio
      // ya usado en cargarPrimerApartadoConTotalRazonable()) antes de evaluar
      // el predicado.
      await this.page.waitForTimeout(PAUSES.VER_CARRITO);

      if (await predicado()) return;

      await this.vaciarCarrito();
      await this.abrirImportarFactura();
    }
    throw new Error(`No se encontró ninguna factura que ${descripcion} entre las primeras ${MAX_INTENTOS} disponibles.`);
  }

  /** Importa la primera factura disponible que YA tenga un cliente real asociado. */
  async importarPrimeraFacturaConCliente() {
    await this._importarFacturaQueCumpla(() => this.hayClienteRealSeleccionado(), 'tenga un cliente real asociado');
  }

  /** Importa la primera factura disponible que NO tenga cliente asociado (queda en "Cliente de contado"). */
  async importarPrimeraFacturaSinCliente() {
    await this._importarFacturaQueCumpla(async () => !(await this.hayClienteRealSeleccionado()), 'NO tenga cliente asociado (Cliente de contado)');
  }

  /** Cuenta las tarjetas de factura actualmente renderizadas en la pestaña "Importar factura". */
  async contarFacturasVisibles(): Promise<number> {
    return this.page.locator(L.IMPORTAR_FACTURA_FILA).count();
  }

  /**
   * Lee el "No." (número real y visible) de la primera tarjeta de la pestaña
   * "Importar factura" ya abierta — mismo criterio que
   * obtenerNumeroApartadoTarjetaMasReciente(). Confirmado en vivo (volcando
   * el texto real de la tarjeta, formato "No. 811 - Factura Electrónica -
   * Crédito - 14/07/2026") que es el único campo que el buscador real
   * (buscarFacturasPorTexto()) indexa de forma discriminante — a diferencia
   * del nombre de cliente, compartido por la mayoría de las facturas de este
   * ambiente QA y por lo tanto inútil para localizar una factura puntual.
   */
  async obtenerNumeroFacturaTarjetaMasReciente(): Promise<string> {
    const texto = await this.page.locator(L.IMPORTAR_FACTURA_FILA).first().innerText();
    const coincidencia = texto.match(/No\.\s*(\d+)/);
    expect(coincidencia, `No se pudo leer "No." de la primera tarjeta: "${texto}"`).not.toBeNull();
    return coincidencia![1];
  }

  /**
   * Busca facturas usando el campo de búsqueda REAL de esta pestaña:
   * `#product_search` (L.PRODUCTO_BUSCADOR_GRID), el mismo input reutilizado
   * por buscarProductoEnGrid()/buscarOrdenesCajaPorTexto()/buscarApartadosPorTexto()
   * — persiste en el header del POS sin importar el tab activo. Confirmado en
   * vivo interceptando la red que, con "Importar factura" activa, dispara su
   * propio AJAX real (`getPosSaleReceipList`, L.AJAX_BUSCAR_IMPORTAR_FACTURA,
   * con `search=<texto>` e `import_invoice_state` — el mismo parámetro que
   * usan los botones de filtro de estado) que reemplaza el listado de
   * tarjetas por el resultado filtrado en el servidor.
   */
  async buscarFacturasPorTexto(texto: string) {
    const totalAntes = await this.contarFacturasVisibles();

    const respuestaPromise = this.page.waitForResponse((res) => {
      if (!res.url().includes(L.AJAX_BUSCAR_IMPORTAR_FACTURA)) return false;
      const post = decodeURIComponent((res.request().postData() ?? '').replace(/\+/g, ' '));
      return post.includes(texto);
    }, { timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.buscarProductoEnGrid(texto);
    await respuestaPromise;

    await expect.poll(
      () => this.contarFacturasVisibles(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El resultado de la búsqueda no terminó de renderizarse' }
    ).not.toBe(totalAntes);
  }

  /**
   * Cuenta, sobre las tarjetas de factura YA renderizadas (p. ej. tras un
   * buscarFacturasPorTexto() con un resultado más amplio que 1), cuántas
   * contienen `texto` en su contenido visible — mismo criterio ya usado en
   * contarApartadosConTexto(), útil para confirmar que una factura puntual
   * sigue presente dentro de un resultado de búsqueda parcial más amplio.
   */
  async contarFacturasConTexto(texto: string): Promise<number> {
    return this.page.locator(L.IMPORTAR_FACTURA_FILA).filter({ hasText: texto }).count();
  }

  /**
   * Presiona uno de los botones de filtro de estado del documento electrónico
   * (L.IMPORTAR_FACTURA_ESTADO_BOTON: "Todos"/"Aceptado"/"Rechazadas"/
   * "Reenviar"/"No aplica") y espera la respuesta real de
   * AJAX_BUSCAR_IMPORTAR_FACTURA que efectivamente re-renderiza el listado —
   * confirmado en vivo que cada botón dispara ese mismo endpoint con un
   * `import_invoice_state` distinto (all/accepted/rejected/resend/not_apply).
   * Devuelve la cantidad de tarjetas que quedaron visibles tras filtrar — en
   * este ambiente compartido, "Aceptado"/"Rechazadas" pueden legítimamente
   * devolver 0 (ningún documento en ese estado real todavía), así que quien
   * llama no debe asumir un conteo fijo.
   */
  async filtrarFacturasPorEstado(estado: keyof typeof L.IMPORTAR_FACTURA_ESTADO_BOTON): Promise<number> {
    const totalAntes = await this.contarFacturasVisibles();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_BUSCAR_IMPORTAR_FACTURA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.IMPORTAR_FACTURA_ESTADO_BOTON[estado]).click();
    await respuestaPromise;

    // La respuesta ya resuelta no garantiza que el DOM ya haya reemplazado
    // las tarjetas con el resultado filtrado — mismo cuidado que
    // buscarFacturasPorTexto()/buscarApartadosPorTexto(): se espera la
    // condición real (el conteo cambia respecto al filtro anterior), nunca
    // una pausa fija. Si el filtro elegido resulta en el mismo conteo que el
    // anterior (p. ej. dos estados con igual cantidad real de documentos),
    // el propio conteo ya estable se devuelve sin bloquear: la respuesta de
    // red ya confirmó que el filtro correcto se aplicó.
    await expect.poll(
      () => this.contarFacturasVisibles(),
      { timeout: 5_000 }
    ).not.toBe(totalAntes).catch(() => {});
    return this.contarFacturasVisibles();
  }

  // ─── "Órdenes de Caja" (seleccionar una ya existente) ──────────────────────

  /**
   * Visita la pestaña "Órdenes de caja" — mismo patrón que abrirImportarFactura(),
   * envuelve visitarPestanaPos() con la entrada ya registrada en
   * PESTANAS_POS_A_RECORRER, sin duplicar esa lógica.
   */
  async abrirOrdenesCaja() {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Órdenes de caja')!;
    await this.visitarPestanaPos(pestana);
  }

  /**
   * Selecciona la primera Orden de Caja disponible en la pestaña ya abierta y
   * la carga al carrito — mismo criterio "primera disponible, sin buscar"
   * adoptado para Importar Factura (ver el comentario de
   * importarPrimeraFacturaDisponible(): elegir por otro criterio, p. ej.
   * menor monto, puede aterrizar en una orden con líneas problemáticas sin
   * ninguna forma de evitarlo de antemano).
   *
   * A diferencia de importarPrimeraFacturaDisponible(), el click real está en
   * un ícono anidado dentro de la tarjeta (L.ORDEN_CAJA_LISTA_BTN_CARGAR,
   * confirmado en vivo que la tarjeta en sí no tiene onclick propio) y carga
   * directo al carrito sin modal de detalle ni botón de confirmación aparte
   * — confirmado en vivo interceptando la red (getPosCashItemList, sin
   * ningún SweetAlert de por medio).
   */
  async cargarPrimeraOrdenCajaDisponible() {
    const filas = this.page.locator(L.IMPORTAR_FACTURA_FILA);
    const primeraFila = filas.first();
    await expect(primeraFila, 'No hay ninguna Orden de Caja disponible').toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_CARGAR_ORDEN_CAJA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await primeraFila.locator(L.ORDEN_CAJA_LISTA_BTN_CARGAR).click();
    await respuestaPromise;

    await expect(
      this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
      'No se cargó ninguna línea de producto tras seleccionar la Orden de Caja'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Carga la primera Orden de Caja, entre las ya renderizadas en la pestaña,
   * que cumpla `predicado` — mismo click real que cargarPrimeraOrdenCajaDisponible()
   * (ORDEN_CAJA_LISTA_BTN_CARGAR dentro de la tarjeta, AJAX_CARGAR_ORDEN_CAJA),
   * pero sobre una tarjeta elegida por criterio en vez de siempre `.first()`.
   *
   * Sirve para localizar una Orden de Caja por una característica propia de
   * la tarjeta (tipo de pago, vendedor asignado) que el buscador real de esta
   * pestaña (`#product_search` / L.PRODUCTO_BUSCADOR_GRID, ver
   * buscarOrdenesCajaPorTexto()) no indexa — cada tarjeta expone esos datos
   * en su propio HTML (confirmado en vivo), así que se filtra sobre las ya
   * renderizadas en vez de depender de ese buscador para estos casos.
   */
  private async _cargarOrdenCajaQueCumpla(
    predicado: (tarjeta: Locator) => Promise<boolean>,
    descripcion: string
  ) {
    const tarjetas = this.page.locator(L.IMPORTAR_FACTURA_FILA);
    // Mismo criterio que cargarPrimeraOrdenCajaDisponible(): esperar
    // explícitamente (hasta PRODUCTS_LOAD) a que la primera tarjeta esté
    // realmente renderizada antes de contar — un .count() inmediato tras
    // abrirOrdenesCaja() puede correr antes de que el AJAX que llena la
    // lista termine, devolviendo 0 en falso (confirmado en vivo: causaba
    // "No hay ninguna Orden de Caja disponible" incluso habiendo decenas
    // disponibles).
    await expect(tarjetas.first(), 'No hay ninguna Orden de Caja disponible').toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
    const total = await tarjetas.count();

    for (let i = 0; i < total; i++) {
      const tarjeta = tarjetas.nth(i);
      if (await predicado(tarjeta)) {
        const respuestaPromise = this.page.waitForResponse(
          (res) => res.url().includes(L.AJAX_CARGAR_ORDEN_CAJA),
          { timeout: TIMEOUTS.PAYMENT_MODAL }
        );
        await tarjeta.locator(L.ORDEN_CAJA_LISTA_BTN_CARGAR).click();
        await respuestaPromise;

        await expect(
          this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
          'No se cargó ninguna línea de producto tras seleccionar la Orden de Caja'
        ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
        return;
      }
    }
    throw new Error(`No se encontró ninguna Orden de Caja que ${descripcion} entre las ${total} tarjetas ya cargadas.`);
  }

  /** Carga la primera Orden de Caja ya renderizada que se haya creado a Crédito (ver el comentario de _cargarOrdenCajaQueCumpla()). */
  async cargarPrimeraOrdenCajaACreditoDisponible() {
    await this._cargarOrdenCajaQueCumpla(
      async (tarjeta) => (await tarjeta.locator(L.ORDEN_CAJA_TARJETA_TIPO_PAGO_HIDE).textContent().catch(() => null))?.trim() === '2',
      'se haya creado a Crédito'
    );
  }

  /**
   * Carga la primera Orden de Caja ya renderizada que tenga un vendedor real
   * asignado — la propia tarjeta solo imprime la línea "Vendedor: <nombre>"
   * cuando la orden tiene uno (confirmado en vivo), así que basta con
   * filtrar por ese texto visible.
   */
  async cargarPrimeraOrdenCajaConVendedorDisponible() {
    await this._cargarOrdenCajaQueCumpla(
      async (tarjeta) => /Vendedor:\s*\S/.test(await tarjeta.innerText().catch(() => '')),
      'tenga un vendedor asignado'
    );
  }

  /**
   * Busca Órdenes de Caja usando el campo de búsqueda REAL de esta pestaña:
   * `#product_search` (L.PRODUCTO_BUSCADOR_GRID), el mismo input que
   * buscarProductoEnGrid() usa para el catálogo de productos — persiste en
   * el header del POS sin importar el tab activo, y mientras "Órdenes de
   * caja" está activa dispara su propio AJAX real (`getPosCashSearch`,
   * L.AJAX_BUSCAR_ORDEN_CAJA) que reemplaza el listado de tarjetas por el
   * resultado filtrado en el servidor.
   *
   * CORRECCIÓN: un comentario previo en este archivo (y el test que lo usaba)
   * afirmaban que esta pestaña no tenía ningún campo de búsqueda propio —
   * confirmado en vivo que sí lo tiene, solo que no estaba en
   * `#content_invoice_order_list` (donde se buscó originalmente) sino en el
   * header persistente del POS. También confirmado en vivo que este buscador
   * indexa el nombre del cliente (real o de texto libre vía
   * ingresarNombreCliente()) pero NO la observación oculta de la tarjeta
   * (buscar por una observación única devolvió "No se encontraron órdenes
   * que mostrar").
   */
  async buscarOrdenesCajaPorTexto(texto: string) {
    const totalAntes = await this.contarOrdenesCajaVisibles();

    // abrirOrdenesCaja() ya dispara su propia llamada a este mismo endpoint
    // (con `search=` vacío, para la carga inicial de la pestaña) — confirmado
    // en vivo que su RESPUESTA puede seguir en vuelo y resolver DESPUÉS de
    // que este método ya empezó a esperar "la próxima respuesta de
    // getPosCashSearch", haciendo que `waitForResponse` atrape por error esa
    // respuesta vieja (sin filtrar) en vez de la de esta búsqueda. Se
    // distingue por el contenido real de la petición (su `search=<texto>`),
    // no solo por la URL.
    const respuestaPromise = this.page.waitForResponse((res) => {
      if (!res.url().includes(L.AJAX_BUSCAR_ORDEN_CAJA)) return false;
      const post = decodeURIComponent((res.request().postData() ?? '').replace(/\+/g, ' '));
      return post.includes(texto);
    }, { timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.buscarProductoEnGrid(texto);
    await respuestaPromise;

    // La respuesta ya resuelta no garantiza que el DOM ya haya reemplazado
    // las tarjetas con el resultado filtrado — ese re-render corre en un
    // callback aparte, después de recibir la respuesta. Se espera la
    // condición real: que el total de tarjetas cambie del valor previo a
    // buscar.
    await expect.poll(
      () => this.contarOrdenesCajaVisibles(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El resultado de la búsqueda no terminó de renderizarse' }
    ).not.toBe(totalAntes);
  }

  /** Cuenta las tarjetas de Orden de Caja actualmente renderizadas en la pestaña — útil antes/después de buscarOrdenesCajaPorTexto() para validar que la búsqueda realmente redujo el conjunto. */
  async contarOrdenesCajaVisibles(): Promise<number> {
    return this.page.locator(L.IMPORTAR_FACTURA_FILA).count();
  }
  async obtenerCantidadFilasCarrito(...args: Parameters<PosCore['obtenerCantidadFilasCarrito']>) {
    return this.core.obtenerCantidadFilasCarrito(...args);
  }
  async obtenerTextoCarrito(...args: Parameters<PosCore['obtenerTextoCarrito']>) {
    return this.core.obtenerTextoCarrito(...args);
  }
  async obtenerPrimerProductoNoPresenteEnCarrito(...args: Parameters<PosCore['obtenerPrimerProductoNoPresenteEnCarrito']>) {
    return this.core.obtenerPrimerProductoNoPresenteEnCarrito(...args);
  }
  async obtenerPrimerProductoFraccionadoNoPresenteEnCarrito(...args: Parameters<PosCore['obtenerPrimerProductoFraccionadoNoPresenteEnCarrito']>) {
    return this.core.obtenerPrimerProductoFraccionadoNoPresenteEnCarrito(...args);
  }
  async obtenerPrimerProductoConIvaNoPresenteEnCarrito(...args: Parameters<PosCore['obtenerPrimerProductoConIvaNoPresenteEnCarrito']>) {
    return this.core.obtenerPrimerProductoConIvaNoPresenteEnCarrito(...args);
  }
  async abrirAgregarItem(...args: Parameters<PosCore['abrirAgregarItem']>) {
    return this.core.abrirAgregarItem(...args);
  }

  /** @deprecated Usar abrirAgregarItem() — se mantiene únicamente por compatibilidad con pos-importar-factura.spec.ts, sin duplicar lógica. */
  async abrirAgregarItemImportarFactura() {
    return this.abrirAgregarItem();
  }
  async seEncuentraEnVistaAgregarItem(...args: Parameters<PosCore['seEncuentraEnVistaAgregarItem']>) {
    return this.core.seEncuentraEnVistaAgregarItem(...args);
  }
  async volverDesdeAgregarItem(...args: Parameters<PosCore['volverDesdeAgregarItem']>) {
    return this.core.volverDesdeAgregarItem(...args);
  }

  /** @deprecated Usar volverDesdeAgregarItem(pestana) — se mantiene únicamente por compatibilidad con pos-importar-factura.spec.ts, sin duplicar lógica. */
  async volverDesdeAgregarItemImportarFactura() {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Importar factura')!;
    return this.volverDesdeAgregarItem(pestana);
  }
  precioVisibleProducto(...args: Parameters<PosCore['precioVisibleProducto']>) {
    return this.core.precioVisibleProducto(...args);
  }
  async obtenerPrecioVisibleProducto(...args: Parameters<PosCore['obtenerPrecioVisibleProducto']>) {
    return this.core.obtenerPrecioVisibleProducto(...args);
  }
  async obtenerCodigoProducto(...args: Parameters<PosCore['obtenerCodigoProducto']>) {
    return this.core.obtenerCodigoProducto(...args);
  }

  // ─── Vista Expandida / Vista Normal ─────────────────────────────────────────

  /**
   * Indica si Vista Expandida está activa consultando el efecto real en el
   * DOM (visibilidad de L.PRODUCT_CONTENT), no solo una clase CSS aislada:
   * confirmado en vivo que al activarse, PRODUCT_CONTENT dejar de ser
   * visible (oculta también el buscador de la grilla, que vive dentro).
   */
  async vistaExpandidaActiva(): Promise<boolean> {
    return !(await this.page.locator(L.PRODUCT_CONTENT).isVisible());
  }

  /**
   * Abre el menú de tres puntos (reutiliza abrirMenuTresPuntos()) y clickea
   * "Expandir/Encoger", reintentando de forma acotada — mismo patrón de
   * overlays ya usado en el resto de menús MDL de esta clase, confirmado en
   * vivo que #switch_compress sufre la misma inestabilidad intermitente.
   * Valida el cambio real combinando la respuesta de AJAX_VISTA_COMPRIMIDA
   * (persistida por el servidor) con el estado real de vistaExpandidaActiva()
   * — no solo una clase CSS — y devuelve el nuevo estado.
   */
  async alternarVistaExpandida(): Promise<boolean> {
    const estadoAntes = await this.vistaExpandidaActiva();
    const MAX_INTENTOS = 8;

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      await this.cerrarModalNotificacionesSiAparece();
      await this.cerrarTodosLosToastsSiAparecen();
      await this.abrirMenuTresPuntos();

      const visible = await this.page.locator(L.SWITCH_COMPRESS)
        .waitFor({ state: 'visible', timeout: 2_000 })
        .then(() => true)
        .catch(() => false);
      if (!visible) continue;

      const respuestaPromise = this.page.waitForResponse(
        (res) => res.url().includes(L.AJAX_VISTA_COMPRIMIDA),
        { timeout: 4_000 }
      ).catch(() => null);
      const clickeado = await this.page.locator(L.SWITCH_COMPRESS)
        .click({ timeout: 4_000 })
        .then(() => true)
        .catch(() => false);

      if (clickeado) {
        const respuesta = await respuestaPromise;
        if (respuesta) {
          await expect.poll(() => this.vistaExpandidaActiva(), { timeout: 3_000 }).toBe(!estadoAntes);
          return !estadoAntes;
        }
      }
    }
    throw new Error(`No se pudo alternar Vista Expandida tras ${MAX_INTENTOS} intentos`);
  }

  /**
   * Busca un producto por su código exacto (interno o de barras) usando el
   * buscador interno que solo aparece con Vista Expandida activa
   * (L.BUSCADOR_INTERNO_VISTA_EXPANDIDA) y espera a que quede agregado al
   * carrito. Confirmado en vivo (código fuente + red) que este buscador NO
   * usa el mismo autocomplete que el de la grilla: dispara un AJAX distinto
   * (AJAX_BUSCADOR_INTERNO) y filtra por código, no por nombre. Con un único
   * resultado coincidente —el caso normal al buscar por código exacto—, la
   * propia aplicación autoselecciona el resultado y lo agrega llamando a la
   * misma función add_to_table() que usa el click normal de la grilla; por
   * eso la confirmación de que se agregó reutiliza el mismo criterio ya
   * usado en el resto de la suite (crecimiento de L.CARRITO_CLAVES), sin
   * duplicar esa lógica de validación.
   */
  async agregarProductoPorCodigoEnVistaExpandida(codigo: string, montoSiEsPorMonto = PRECIO_PRODUCTO_RAPIDO): Promise<void> {
    // obtenerClavesFilasCarrito() (no obtenerClavesProductos()): confirmado
    // en vivo (Escenario 16 de pos-ruteo.spec.ts, root-cause investigado a
    // fondo, no asumido) que este método causaba un timeout de 120s
    // permanente al buscar un producto sobre el carrito de una Orden de
    // Ruteo ya cargada — el producto SÍ se agregaba correctamente (visible
    // en el DOM, con su precio/código reales), pero obtenerClavesProductos()
    // solo cuenta filas con id "drag_and_drop_" (ver su propio comentario:
    // ausente en líneas IMPORTADAS, como las de una Orden de Ruteo/Caja/
    // factura ya cargada) — con clavesAntes ya en 0 por ese motivo,
    // clavesDespues también podía quedar en 0 si la fila recién agregada
    // tampoco quedaba marcada así en este contexto, dejando la condición
    // ">0" imposible de cumplir para siempre. obtenerClavesFilasCarrito()
    // cubre ambos tipos de fila (documentado en su propio comentario) y es
    // la fuente ya usada por el resto de la suite para este mismo problema.
    const clavesAntes = await this.obtenerClavesFilasCarrito();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_BUSCADOR_INTERNO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.BUSCADOR_INTERNO_VISTA_EXPANDIDA).fill(codigo);
    await this.page.locator(L.BUSCADOR_INTERNO_VISTA_EXPANDIDA).press('Enter');
    await respuestaPromise;

    // Modal "Monto a comprar" (ver L.DIALOG_MONTO_A_COMPRAR y el comentario
    // de agregarProductoDelGridAlCarrito(), que ya maneja este mismo caso
    // para el click directo del grid): confirmado en vivo (root-cause real,
    // reportado en vivo por el usuario mientras corría este mismo
    // escenario) que el buscador interno de Vista Expandida puede
    // encontrar un producto que se vende "por monto"/peso y abrir este
    // modal en vez de agregar la línea directo — sin manejarlo, el poll de
    // abajo esperaría para siempre una línea que nunca llega porque el
    // modal queda abierto sin confirmar. No es anticipable de antemano
    // (mismo motivo ya documentado en L.DIALOG_MONTO_A_COMPRAR: no viene
    // como argumento de add_to_table()), así que se espera con el timeout
    // completo de PAYMENT_MODAL y se completa si aparece, igual criterio
    // que la versión de grid.
    const modalMontoACompra = this.page.locator(L.DIALOG_MONTO_A_COMPRAR);
    const abrioModalMonto = await modalMontoACompra
      .waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL })
      .then(() => true)
      .catch(() => false);
    if (abrioModalMonto) {
      await this.page.locator(L.MONTO_A_COMPRAR_INPUT_MONTO).fill(montoSiEsPorMonto);
      await this.page.locator(L.MONTO_A_COMPRAR_BTN_CONFIRMAR).click();
      await expect(modalMontoACompra, 'El modal "Monto a comprar" no se cerró tras presionar "Continuar"').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
    }

    await expect.poll(
      async () => (await this.obtenerClavesFilasCarrito()).length,
      { timeout: TIMEOUTS.PRODUCTS_LOAD }
    ).toBeGreaterThan(clavesAntes.length);
  }
  async vaciarCarrito(...args: Parameters<PosCore['vaciarCarrito']>) {
    return this.core.vaciarCarrito(...args);
  }
  async obtenerTotalVisiblePosNumerico(...args: Parameters<PosCore['obtenerTotalVisiblePosNumerico']>) {
    return this.core.obtenerTotalVisiblePosNumerico(...args);
  }
  async facturarEstaDeshabilitado(...args: Parameters<PosCore['facturarEstaDeshabilitado']>) {
    return this.core.facturarEstaDeshabilitado(...args);
  }
}
