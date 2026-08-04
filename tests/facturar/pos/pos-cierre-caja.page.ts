import { expect, Download, Locator, Page, Response } from '@playwright/test';
import { L } from './pos.locators';
import {
  TIMEOUTS, PAUSES, CAJA_TEXTO, CHECKBOX_ID, PestanaPos, PESTANA_POS_FACTURACION,
  PESTANAS_POS_A_RECORRER, MetodoPago, METODO, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT,
  TipoPagoOrdenCaja, TipoProforma, VEHICULO_PINTURA_TIPO, COMPANIA_POS, CABYS_BUSQUEDA,
  CABYS_BUSQUEDA_SIN_IVA, PRECIO_PRODUCTO_RAPIDO, EscenarioDescuento, ResultadoDescuento,
  EstadoCheckIva, ConfigBusquedaCabys, LineaCarrito, MetadatoProducto, DASHBOARD_URL,
  ResumenTabGeneral, ReporteAvanzado, FilaFacturaVenta, FilaFacturaSimple, FilaMovimientoCaja,
  SubTabFacturas,
} from './pos.types';
import { PosCore } from './pos-core.page';

// Parte del plan de migración a composición: dominio "CIERRE_CAJA" extraído
// de pos.page.ts. Depende de core por inyección de
// constructor (composición, no herencia) — nunca al revés. Miembros que eran
// 'private' en el monolito pasan a públicos aquí por el mismo motivo que en
// PosCore: los llama la fachada por composición, no por herencia.
export class PosCierreCaja {
  private readonly core: PosCore;

  constructor(core: PosCore) {
    this.core = core;
  }

  private get page() { return this.core.page; }


  /** Locator del modal "Detalle de Cierre" (cerrar caja). */
  get modalCerrarCaja() {
    return this.page.locator(L.DIALOG_CERRAR_CAJA);
  }


  /**
   * Indica si el menú "Caja" está actualmente desplegado, leyendo el estado real
   * del DOM (clase "is-visible" en el div.mdl-menu__container que envuelve el
   * <ul>) en vez de asumirlo — confirmado en vivo que este es el indicador real;
   * ni el <ul> ni el <li> usan aria-expanded.
   *
   * Corrección de automatización confirmada en vivo (corrida completa de la
   * suite, 8/8 escenarios verdes salvo este): el test "Fact. Entradas y Fact.
   * Salidas" agotó los 300 s completos del test con
   * `Error: page.evaluate: Target page, context or browser has been closed`
   * apuntando exactamente a este método — confirmado con el screenshot real
   * al momento del fallo (test-results/.../error-context.md) que el POS
   * estaba en un estado completamente normal (grid de productos cargado,
   * carrito vacío, sin overlay/modal/toast visible), descartando un overlay
   * bloqueando un click como causa. La causa raíz real es que `Page.evaluate()`
   * (a diferencia de `Locator.evaluate()`) no acepta un `{timeout}` propio en
   * absoluto — mismo gotcha ya documentado y corregido en este repo para
   * `PosProforma.abrirCrearProforma()` — así que, bajo la misma lentitud real
   * de backend ya documentada para otros AJAX de este archivo, esta única
   * llamada podía colgarse indefinidamente en CADA una de las 8 vueltas del
   * bucle de `abrirMenuCaja()`, anulando por completo su propio presupuesto
   * de reintentos acotados. Se reemplaza por `Locator.evaluate()` (que sí
   * acepta `{timeout}`) sobre el propio `<ul>`, con el mismo criterio
   * "null-safe" que la version original (si el elemento no aparece a tiempo,
   * se asume el menú cerrado en vez de propagar el error).
   */
  async menuCajaEstaAbierto(): Promise<boolean> {
    return this.page.locator(L.MENU_CAJA_UL).evaluate((ul) => {
      const container = ul.closest('.mdl-menu__container');
      return container?.classList.contains('is-visible') ?? false;
    }, undefined, { timeout: 5_000 }).catch(() => false);
  }


  /**
   * Abre el menú "Caja" del encabezado del POS. #menu_cash es un botón de
   * alternancia (toggle), no una acción idempotente de "asegurar abierto": si el
   * menú ya está desplegado (p. ej. un click anterior sí llegó a ejecutarse pese
   * a haber sido reportado como fallido), volver a pulsarlo lo cerraría en vez de
   * dejarlo abierto — confirmado en vivo. Por eso se comprueba el estado real
   * antes de decidir si hace falta el click.
   *
   * Corrección de automatización confirmada en vivo: el click sobre
   * #menu_cash no tenía timeout propio. El banner de permisos de
   * notificación (#workshop-web-notification-permission) puede reaparecer de
   * forma asíncrona DESPUÉS de cerrarlo aquí mismo y ANTES de que el click
   * termine de ejecutarse — con eso, el mecanismo de reintento interno de
   * Playwright (sin límite, mismo patrón ya documentado en
   * abrirProductoRapido()) queda reintentando contra un overlay que se sigue
   * regenerando, sin que este método vuelva a tener oportunidad de cerrarlo,
   * agotando el presupuesto completo del test en una sola línea (confirmado
   * en vivo: 70+ reintentos internos de Playwright sin que
   * abrirDetalleDeCierre() —que sí reintenta este método completo— llegara a
   * un segundo intento real). Mismo patrón de corrección ya usado en
   * abrirProductoRapido(): reintentos cortos y acotados, cerrando el overlay
   * antes de cada uno.
   */
  async abrirMenuCaja() {
    const MAX_INTENTOS = 8;

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      if (await this.menuCajaEstaAbierto()) return;

      // Los overlays conocidos (aviso de notificaciones, cualquier toast
      // "noty") pueden quedar sobre el encabezado e interceptar el click,
      // sin importar el estado de la caja.
      await this.core.cerrarModalNotificacionesSiAparece();
      await this.core.cerrarTodosLosToastsSiAparecen();
      await this.page.locator(L.MENU_CAJA_BTN).click({ timeout: 3_000 }).catch(() => {});

      if (await this.menuCajaEstaAbierto()) return;
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
    await this.core.cerrarModalNotificacionesSiAparece();
    await this.core.cerrarTodosLosToastsSiAparecen();
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
      this.core.modalAbrirCaja.waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL }),
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
    await this.core.cerrarModalNotificacionesSiAparece();
    await this.core.cerrarAvisoConsecutivoSiAparece();
    await this.modalCerrarCaja.locator(L.CIERRE_BTN_CERRAR).click();
    await this.core._confirmarSweetAlertV1();

    await cierreConfirmadoPromise;

    const printPage = await popupPromise;
    if (printPage) {
      await this.core.mostrarYCerrarVentanaImpresion(printPage);
    }
  }


  /**
   * Registra un movimiento de caja MANUAL real (Entrada o Salida) desde el
   * menú "Caja" → "(F9) Movimientos de caja" — deja la caja abierta y
   * disponible para seguir facturando (a diferencia de
   * `abrirDetalleDeCierre()`, este modal no tiene relación directa con el
   * cierre en sí, solo alimenta sus tablas "Entradas"/"Salidas").
   *
   * El checkbox real de "Salidas" (#movenment_cash_out) es, igual que el
   * resto de checkboxes-slider de esta suite, visualmente OCULTO — un click
   * normal de Playwright falla ("Element is outside of the viewport");
   * confirmado en vivo que necesita el mismo click programático. "Entradas"
   * es el estado por defecto del modal (checked, #cash_movement_type = "1"),
   * así que solo hace falta togglear cuando se pide una Salida
   * (#cash_movement_type pasa a "2", confirmado en vivo).
   *
   * **Bug de sistema confirmado en vivo (no de automatización) — causa raíz
   * real del "colgado de 300s" que este método sufría antes**: se leyó el
   * `pos.js` real de la app (fetch directo del bundle servido,
   * `js/pos.js?v=9.6.238`) y el handler real de `#btn_send_movement` hace
   * `$.ajax({ url: 'addMovementPosCash', ..., async: false })` — una
   * petición **SÍNCRONA** que congela el hilo principal del navegador
   * ENTERO hasta que el backend responde. Confirmado con un diagnóstico
   * instrumentado (checkpoints con timestamp en cada `await`): bajo la
   * latencia real de este ambiente compartido, ese único click puede colgar
   * el proceso completo del navegador durante minutos, y MIENTRAS TANTO
   * ningún comando de Playwright puede ejecutarse contra esa página — ni
   * siquiera su propio mecanismo de cancelación por `{timeout}`, que
   * también depende de poder comunicarse con un navegador que en ese
   * momento no está respondiendo. Por eso ningún `{timeout}` local (ya
   * probados: 5s/10s/15s en cada paso) ni un reintento posterior podían
   * arreglar esto — el navegador sigue congelado durante el reintento
   * también; solo el timeout GLOBAL del test (aplicado desde fuera del
   * proceso del navegador) lograba recuperar el control, tras haber
   * quemado el presupuesto completo. Es el mismo patrón de bug ya
   * documentado en CLAUDE.md para `validate_cash()` (XHR síncrono en el
   * flujo de aprobar cierres pendientes) — aquí confirmado por segunda vez,
   * en un flujo distinto.
   *
   * A diferencia del resto de "bugs de click nativo" de esta suite (donde
   * SÍ vale la pena reintentar el click real primero, ver
   * `abrirProductoRapido()`/`abrirMenuCaja()`), un reintento no puede
   * mitigar este: el navegador sigue congelado durante todo el reintento
   * también, así que reintentar solo pospone el mismo colgado. La única
   * mitigación real es NUNCA disparar el handler nativo del botón — se
   * reutiliza el patrón ya establecido en
   * `PosPermisos.establecerPermisoViaApiDirecta()` (llamar directo al
   * mismo endpoint real que el propio handler invoca, por `fetch`
   * asíncrono, con el mismo payload), pero aquí como mecanismo PRINCIPAL en
   * vez de red de seguridad — la diferencia frente a ese otro caso es que
   * ahí el fallback nunca es necesario si el camino normal funciona; aquí
   * el camino normal es el que rompe el navegador, así que no hay nada que
   * "intentar primero". El resto del flujo (abrir el menú, abrir el modal,
   * togglear Entrada/Salida, llenar cantidad/observación) sigue siendo 100%
   * interacción real de UI — solo el submit final evita el botón roto.
   *
   * Señal de éxito real: la respuesta del propio POST a
   * `addMovementPosCash` (un id numérico > 0 en texto plano) — mismo
   * criterio que el resto de flujos de esta suite con este bug de sistema.
   */
  async registrarMovimientoCaja(tipo: 'entrada' | 'salida', cantidad: string, observacion: string): Promise<number> {
    const MAX_INTENTOS = 3;
    let ultimoError: unknown;

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      try {
        await this.abrirMenuCaja();
        await this.core.cerrarModalNotificacionesSiAparece();
        await this.core.cerrarTodosLosToastsSiAparecen();
        await this.page.locator(L.MENU_CAJA_ITEM_MOVIMIENTOS).click({ timeout: 5_000 });

        const modal = this.page.locator(L.DIALOG_MOVIMIENTO_CAJA);
        await expect(modal, 'El modal "Movimientos de caja" no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

        if (tipo === 'salida') {
          await this.page.locator(L.MOVIMIENTO_CAJA_TIPO_SALIDA)
            .evaluate((el) => (el as HTMLElement).click(), undefined, { timeout: 10_000 });
        }

        await modal.locator(L.MOVIMIENTO_CAJA_CANTIDAD).fill(cantidad, { timeout: 10_000 });
        await modal.locator(L.MOVIMIENTO_CAJA_OBSERVACION).fill(observacion, { timeout: 10_000 });

        // Submit real vía fetch asíncrono directo a addMovementPosCash —
        // mismo payload exacto que arma el handler real de #btn_send_movement
        // en pos.js, leído del propio DOM/variables globales de la app (nunca
        // hardcodeado), evitando el $.ajax({async:false}) que congela el
        // navegador (ver docstring del método).
        const textoRespuesta = await this.page.evaluate(
          async ({ cantidad, observacion, movimientoCajaTipoSelector }) => {
            const token = (document.querySelector('#_token') as HTMLInputElement | null)?.value ?? '';
            const companyId = document.querySelector('#current_pos_company')?.textContent?.trim() ?? '';
            const movementType = (document.querySelector(movimientoCajaTipoSelector) as HTMLInputElement | null)?.value ?? '1';
            // @ts-expect-error variables globales reales de pos.js, no expuestas por tipos
            const currencyId = window.global_current_pos_exchange_id;
            // @ts-expect-error variables globales reales de pos.js, no expuestas por tipos
            const currencyExchange = window.global_current_pos_exchange;

            const body = new URLSearchParams({
              _token: token,
              quantity: cantidad,
              description: observacion,
              movement_type: String(movementType),
              company_id: String(companyId),
              currency_id: String(currencyId),
              currency_exchange: String(currencyExchange),
            });

            const res = await fetch('addMovementPosCash', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
              body: body.toString(),
              credentials: 'same-origin',
            });
            return res.text();
          },
          { cantidad, observacion, movimientoCajaTipoSelector: L.MOVIMIENTO_CAJA_TIPO_HIDDEN }
        );

        const idMovimiento = parseInt(textoRespuesta.trim(), 10);
        if (!(idMovimiento > 0)) {
          throw new Error(`El backend no confirmó el movimiento de caja (respuesta: "${textoRespuesta}")`);
        }

        // El endpoint real no cierra el modal por sí solo (eso lo hacía el
        // callback .done() del botón real, evitado a propósito arriba) — se
        // cierra manualmente para dejar el POS en el mismo estado final que
        // el flujo real de la UI habría dejado.
        await this.page.keyboard.press('Escape').catch(() => {});
        await modal.locator('[data-dismiss="modal"]').first().click({ timeout: 3_000 }).catch(() => {});
        await expect(modal, 'El modal "Movimientos de caja" no se cerró tras procesar').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

        return idMovimiento;
      } catch (e) {
        ultimoError = e;
        console.log(`[registrarMovimientoCaja] intento ${intento}/${MAX_INTENTOS} (${tipo}) falló: ${(e as Error).message}`);
        // Recuperación acotada antes del siguiente intento: cerrar el modal
        // (si quedó abierto/colgado) sin depender de que su propio botón
        // "Cerrar" responda, para no repetir el mismo bloqueo.
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.locator(L.DIALOG_MOVIMIENTO_CAJA).locator('[data-dismiss="modal"]')
          .first().click({ timeout: 3_000 }).catch(() => {});
      }
    }

    throw ultimoError instanceof Error
      ? ultimoError
      : new Error(`registrarMovimientoCaja() falló tras ${MAX_INTENTOS} intentos: ${String(ultimoError)}`);
  }


  /**
   * Abre "Detalle de Cierre" SIN confirmar ningún cierre — a diferencia del
   * flujo de `confirmarCerrarCaja()` (pensado para cerrar la caja de verdad),
   * este método es para INSPECCIONAR el modal (leer Tab General, Reporte
   * Avanzado, Tab Facturas) dejando la caja abierta y disponible para seguir
   * facturando. Reutiliza el mismo ciclo de reintentos ya confirmado en vivo
   * en pos-cierre-caja.spec.ts (el ítem "(F12) Abrir/Cerrar Caja" resuelve a
   * uno de dos modales distintos, y el click puede quedar bloqueado por un
   * overlay transitorio del encabezado) — si la caja aparece cerrada, la abre
   * con `completarAperturaCaja()` y vuelve a intentar el ciclo completo desde
   * el menú, nunca asume que un solo intento basta.
   */
  async abrirDetalleDeCierre(): Promise<void> {
    const MAX_INTENTOS = 5;

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      if (await this.modalCerrarCaja.isVisible().catch(() => false)) {
        return;
      }

      if (!(await this.core.modalAbrirCajaVisible())) {
        await this.abrirMenuCaja();
        await this.seleccionarAbrirCerrarCaja().catch((e) => {
          console.log(`[abrirDetalleDeCierre] click en "Abrir/Cerrar Caja" no tuvo éxito en el intento ${intento}: ${e.message}`);
        });
        await this.esperarResultadoMenuCaja().catch(() => {});
      }

      if (await this.core.modalAbrirCajaVisible()) {
        await this.core.completarAperturaCaja();
        await expect(this.core.modalAbrirCaja).toBeHidden();
        continue;
      }
    }

    await expect(this.modalCerrarCaja, `"Detalle de Cierre" no quedó visible tras ${MAX_INTENTOS} intentos`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /** Cierra "Detalle de Cierre" con "Cancelar" (data-dismiss), sin cerrar la caja — para flujos de solo inspección. */
  async cancelarModalCerrarCaja(): Promise<void> {
    const btnCancelar = this.modalCerrarCaja.locator(L.CIERRE_BTN_CANCELAR).first();
    if (await btnCancelar.isVisible().catch(() => false)) {
      await btnCancelar.click();
      await expect(this.modalCerrarCaja).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
    }
  }


  /**
   * Activa la tab "General" de "Detalle de Cierre" si no está ya activa —
   * confirmado en vivo que ambas tabs propias (a diferencia de las de
   * moneda, ver L.CIERRE_TAB_MONEDA) sí tienen clase "active" real y estable
   * sobre el <li>.
   */
  async irATabGeneralCierre(): Promise<void> {
    const tab = this.modalCerrarCaja.locator(L.CIERRE_TAB_GENERAL);
    const yaActiva = (await tab.getAttribute('class'))?.includes(L.CIERRE_TAB_CLASE_ACTIVA) ?? false;
    if (!yaActiva) {
      await tab.click();
    }
  }


  /** Lee un monto de un elemento identificado por selector dentro del modal, 0.00 si no existe/no es visible. */
  private async _leerMontoDelModal(selector: string): Promise<number> {
    const locator = this.modalCerrarCaja.locator(selector);
    const texto = await locator.textContent().catch(() => null);
    return this.core._leerMontoDeTexto(texto ?? '0');
  }


  /**
   * Lee TODOS los valores numéricos de la Tab General de "Detalle de Cierre"
   * en un solo snapshot — pensado para comparar un ANTES vs. un DESPUÉS de
   * una operación conocida (venta, abono, movimiento de caja) y validar el
   * DELTA, nunca un total absoluto (ver el comentario de ResumenTabGeneral
   * en pos.types.ts: el ambiente compartido no garantiza una caja "limpia").
   *
   * "Utilidad" y "Total general" pueden no existir en el DOM en absoluto
   * (gobernados por los permisos 619 y 558 respectivamente, ver
   * pos-permisos.page.ts) — se leen con `count()` antes de leer su texto en
   * vez de asumir su presencia, devolviendo `null` cuando no aplican.
   */
  async leerResumenTabGeneral(): Promise<ResumenTabGeneral> {
    await this.irATabGeneralCierre();

    const utilidadLocator = this.modalCerrarCaja.locator(L.CIERRE_UTILIDAD);
    const utilidad = (await utilidadLocator.count()) > 0
      ? this.core._leerMontoDeTexto(await utilidadLocator.textContent() ?? '0')
      : null;

    const totalGeneralLocator = this.page.locator(L.CIERRE_TOTAL_GENERAL);
    const totalGeneralVisible = await totalGeneralLocator.isVisible().catch(() => false);
    const totalGeneral = totalGeneralVisible
      ? this.core._leerMontoDeTexto(await totalGeneralLocator.textContent() ?? '0')
      : null;

    return {
      ventasTotales: await this._leerMontoDelModal(L.CIERRE_VENTAS_TOTALES),
      ventasContado: await this._leerMontoDelModal(L.CIERRE_VENTAS_CONTADO),
      ventasContadoCantidad: await this._leerMontoDelModal(L.CIERRE_VENTAS_CONTADO_CANTIDAD),
      ventasCredito: await this._leerMontoDelModal(L.CIERRE_VENTAS_CREDITO),
      descuento: await this._leerMontoDelModal(L.CIERRE_DESCUENTO),
      impuestos: await this._leerMontoDelModal(L.CIERRE_IMPUESTOS),
      utilidad,
      consolidadoTarjeta: {
        ingreso: await this._leerMontoDelModal(L.CIERRE_CONSOLIDADO_TARJETA_INGRESO),
        abonos: await this._leerMontoDelModal(L.CIERRE_CONSOLIDADO_TARJETA_ABONOS),
        pagoInicial: await this._leerMontoDelModal(L.CIERRE_CONSOLIDADO_TARJETA_PAGO_INICIAL),
        total: await this._leerMontoDelModal(L.CIERRE_CONSOLIDADO_TARJETA_TOTAL),
      },
      metodoPago: {
        efectivo: await this._leerMontoDelModal(L.CIERRE_METODO_PAGO_EFECTIVO),
        tarjeta: await this._leerMontoDelModal(L.CIERRE_METODO_PAGO_TARJETA),
        sinpe: await this._leerMontoDelModal(L.CIERRE_METODO_PAGO_SINPE),
        transaccion: await this._leerMontoDelModal(L.CIERRE_METODO_PAGO_TRANSACCION),
      },
      resumenCierre: {
        apertura: await this._leerMontoDelModal(L.CIERRE_RESUMEN_APERTURA),
        ventasEfectivo: await this._leerMontoDelModal(L.CIERRE_RESUMEN_VENTAS_EFECTIVO),
        ingresoPagoInicial: await this._leerMontoDelModal(L.CIERRE_RESUMEN_INGRESO_PAGO_INICIAL),
        ingresoAbonos: await this._leerMontoDelModal(L.CIERRE_RESUMEN_INGRESO_ABONOS),
        entradasMovCaja: await this._leerMontoDelModal(L.CIERRE_RESUMEN_ENTRADAS_MOV_CAJA),
        totalSalidas: await this._leerMontoDelModal(L.CIERRE_RESUMEN_TOTAL_SALIDAS),
      },
      datosCierre: {
        total: await this._leerMontoDelModal(L.CIERRE_DATOS_TOTAL),
        diferencia: await this._leerMontoDelModal(L.CIERRE_DATOS_DIFERENCIA),
      },
      totalGeneral,
    };
  }


  /** Estado actual (marcado/no) del checkbox "Mostrar Reporte Avanzado". */
  async reporteAvanzadoEstaActivo(): Promise<boolean> {
    return this.modalCerrarCaja.locator(L.CIERRE_TOGGLE_REPORTE_AVANZADO).isChecked();
  }


  /**
   * Activa "Mostrar Reporte Avanzado" si no lo está ya — confirmado en vivo
   * que es un `<input type="checkbox">` real, pero visualmente OCULTO
   * (`custom-switch-input_cash_closing`, mismo patrón de slider CSS ya
   * documentado para el resto de checkboxes de esta suite — p. ej.
   * `check_quick_product_apply_tax`): un click normal de Playwright falla
   * porque el elemento nunca es "visible" en el sentido de actionability.
   * Se reutiliza `_asegurarCheckboxEstado()` (click programático real vía
   * `document.getElementById(id).click()`), en vez de duplicar ese mismo
   * mecanismo aquí.
   */
  async activarReporteAvanzado(): Promise<void> {
    await this.core._asegurarCheckboxEstado(
      this.modalCerrarCaja.locator(L.CIERRE_TOGGLE_REPORTE_AVANZADO),
      'checkbox_more_details_cash',
      true
    );
    await expect(
      this.modalCerrarCaja.locator(L.REPORTE_AVANZADO_TOTAL_ENTRADAS),
      '"Reporte Avanzado" no reveló su sección de Entradas tras activar el checkbox'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Lee TODOS los valores numéricos del "Reporte Avanzado" en un solo
   * snapshot — activa la sección si no lo está ya. Mismo criterio que
   * `leerResumenTabGeneral()`: pensado para comparar un ANTES vs. un DESPUÉS
   * por delta, nunca un total absoluto (ambiente compartido sin limpieza).
   *
   * `totalEntradas` es el campo pedido explícitamente para validar contra
   * `ResumenTabGeneral.ventasTotales` — misma cifra real del cierre.
   */
  async leerReporteAvanzado(): Promise<ReporteAvanzado> {
    await this.activarReporteAvanzado();

    return {
      totalEntradas: await this._leerMontoDelModal(L.REPORTE_AVANZADO_TOTAL_ENTRADAS),
      ventasEfectivo: await this._leerMontoDelModal(L.REPORTE_AVANZADO_VENTAS_EFECTIVO),
      ventasTarjeta: await this._leerMontoDelModal(L.REPORTE_AVANZADO_VENTAS_TARJETA),
      ventasSinpe: await this._leerMontoDelModal(L.REPORTE_AVANZADO_VENTAS_SINPE),
      ventasTransaccion: await this._leerMontoDelModal(L.REPORTE_AVANZADO_VENTAS_TRANSACCION),
      ventasCredito: await this._leerMontoDelModal(L.REPORTE_AVANZADO_VENTAS_CREDITO),
      notasDebito: await this._leerMontoDelModal(L.REPORTE_AVANZADO_NOTAS_DEBITO),
      totalDevoluciones: await this._leerMontoDelModal(L.REPORTE_AVANZADO_TOTAL_DEVOLUCIONES),
      impuestosAdicionales: await this._leerMontoDelModal(L.REPORTE_AVANZADO_IMPUESTOS_ADICIONALES),
      totalConsolidadoOtros: await this._leerMontoDelModal(L.REPORTE_AVANZADO_TOTAL_CONSOLIDADO_OTROS),
      totalConsolidadoTarjeta: await this._leerMontoDelModal(L.REPORTE_AVANZADO_TOTAL_CONSOLIDADO_TARJETA),
      otrasEntradas: await this._leerMontoDelModal(L.REPORTE_AVANZADO_OTRAS_ENTRADAS),
      totalOtrasVentas: await this._leerMontoDelModal(L.REPORTE_AVANZADO_TOTAL_OTRAS_VENTAS),
      totalFacturas: await this._leerMontoDelModal(L.REPORTE_AVANZADO_TOTAL_FACTURAS),
      totalSalidas: await this._leerMontoDelModal(L.REPORTE_AVANZADO_TOTAL_SALIDAS),
      totalAbonos: await this._leerMontoDelModal(L.REPORTE_AVANZADO_TOTAL_ABONOS),
    };
  }


  /** Activa la tab "Facturas" de "Detalle de Cierre" si no está ya activa (mismo patrón que irATabGeneralCierre()). */
  async irATabFacturas(): Promise<void> {
    const tab = this.modalCerrarCaja.locator(L.CIERRE_TAB_FACTURAS);
    const yaActiva = (await tab.getAttribute('class'))?.includes(L.CIERRE_TAB_CLASE_ACTIVA) ?? false;
    if (!yaActiva) {
      await tab.click();
    }
  }


  /**
   * Activa una de las 7 sub-tabs reales de la Tab Facturas
   * (Contado/Crédito/Devoluciones/Eliminadas/Abonos/Entradas/Salidas) —
   * activa primero la Tab Facturas si hiciera falta.
   */
  async irASubTabFacturas(subtab: SubTabFacturas): Promise<void> {
    await this.irATabFacturas();

    const selectorPorSubtab: Record<SubTabFacturas, string> = {
      contado: L.FACTURAS_SUBTAB_CONTADO,
      credito: L.FACTURAS_SUBTAB_CREDITO,
      devoluciones: L.FACTURAS_SUBTAB_DEVOLUCIONES,
      eliminadas: L.FACTURAS_SUBTAB_ELIMINADAS,
      abonos: L.FACTURAS_SUBTAB_ABONOS,
      entradas: L.FACTURAS_SUBTAB_ENTRADAS,
      salidas: L.FACTURAS_SUBTAB_SALIDAS,
    };
    const tab = this.modalCerrarCaja.locator(selectorPorSubtab[subtab]);
    const yaActiva = (await tab.getAttribute('class'))?.includes(L.FACTURAS_SUBTAB_CLASE_ACTIVA) ?? false;
    if (!yaActiva) {
      await tab.click();
    }
    await expect(
      tab,
      `La sub-tab "${subtab}" de Tab Facturas no quedó activa`
    ).toHaveClass(new RegExp(L.FACTURAS_SUBTAB_CLASE_ACTIVA), { timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Lee las filas de datos REALES de una tabla de Tab Facturas, como texto
   * crudo por celda — cada tabla real de este modal usa el mismo patrón:
   * un primer `<tbody>` con solo la fila de encabezados (se ignora), un
   * `<thead>` con el título de sección (se ignora), y un segundo `<tbody>`
   * con las filas de datos reales seguidas de UNA fila final "Total" (con
   * `<strong>`, a diferencia de las filas de datos reales que no usan esa
   * etiqueta) — se descarta por esa señal, no por posición fija, para no
   * asumir cuántas filas de datos hay.
   */
  private async _leerFilasCrudas(tablaSelector: string): Promise<string[][]> {
    const tabla = this.modalCerrarCaja.locator(tablaSelector);
    const filasCandidatas = tabla.locator('tbody').nth(1).locator('tr');
    const total = await filasCandidatas.count();

    const filas: string[][] = [];
    for (let i = 0; i < total; i++) {
      const fila = filasCandidatas.nth(i);
      const esFilaTotal = (await fila.locator('strong').count()) > 0;
      if (esFilaTotal) continue;
      const celdas = await fila.locator('td').allTextContents();
      filas.push(celdas.map((c) => c.trim()));
    }
    return filas;
  }


  /** Fact. Contado → tabla "Ventas directas" (facturación directa en el POS, sin pasar por una Orden de Taller). */
  async leerFacturasContadoDirectas(): Promise<FilaFacturaVenta[]> {
    await this.irASubTabFacturas('contado');
    const filas = await this._leerFilasCrudas(L.TABLA_FACTURAS_CONTADO_DIRECTAS);
    return filas.map(([consecutivo, numeroFactura, fecha, observacion, tipoPago, montoTexto]) => ({
      consecutivo, numeroFactura, fecha, observacion, tipoPago,
      monto: this.core._leerMontoDeTexto(montoTexto),
    }));
  }


  /** Fact. Contado → tabla "Órdenes de Taller" (facturación proveniente de una Orden de Taller ya facturada). */
  async leerFacturasContadoOrdenes(): Promise<FilaFacturaVenta[]> {
    await this.irASubTabFacturas('contado');
    const filas = await this._leerFilasCrudas(L.TABLA_FACTURAS_CONTADO_ORDENES);
    return filas.map(([consecutivo, numeroFactura, fecha, observacion, tipoPago, numeroOrden, montoTexto]) => ({
      consecutivo, numeroFactura, fecha, observacion, tipoPago, numeroOrden,
      monto: this.core._leerMontoDeTexto(montoTexto),
    }));
  }


  /** Fact. Crédito → tabla "Ventas directas". */
  async leerFacturasCreditoDirectas(): Promise<FilaFacturaVenta[]> {
    await this.irASubTabFacturas('credito');
    const filas = await this._leerFilasCrudas(L.TABLA_FACTURAS_CREDITO_DIRECTAS);
    return filas.map(([consecutivo, numeroFactura, fecha, observacion, tipoPago, montoTexto]) => ({
      consecutivo, numeroFactura, fecha, observacion, tipoPago,
      monto: this.core._leerMontoDeTexto(montoTexto),
    }));
  }


  /** Fact. Crédito → tabla "Órdenes de Taller". */
  async leerFacturasCreditoOrdenes(): Promise<FilaFacturaVenta[]> {
    await this.irASubTabFacturas('credito');
    const filas = await this._leerFilasCrudas(L.TABLA_FACTURAS_CREDITO_ORDENES);
    return filas.map(([consecutivo, numeroFactura, fecha, observacion, tipoPago, numeroOrden, montoTexto]) => ({
      consecutivo, numeroFactura, fecha, observacion, tipoPago, numeroOrden,
      monto: this.core._leerMontoDeTexto(montoTexto),
    }));
  }


  /** Fact. Devoluciones. */
  async leerFacturasDevoluciones(): Promise<FilaFacturaSimple[]> {
    await this.irASubTabFacturas('devoluciones');
    const filas = await this._leerFilasCrudas(L.TABLA_FACTURAS_DEVOLUCIONES);
    return filas.map(([consecutivo, numeroFactura, fecha, observacion, montoTexto]) => ({
      consecutivo, numeroFactura, fecha, observacion,
      monto: this.core._leerMontoDeTexto(montoTexto),
    }));
  }


  /** Fact. Eliminadas (facturas anuladas desde Histórico de Ventas). */
  async leerFacturasEliminadas(): Promise<FilaFacturaSimple[]> {
    await this.irASubTabFacturas('eliminadas');
    const filas = await this._leerFilasCrudas(L.TABLA_FACTURAS_ELIMINADAS);
    return filas.map(([consecutivo, numeroFactura, fecha, observacion, montoTexto]) => ({
      consecutivo, numeroFactura, fecha, observacion,
      monto: this.core._leerMontoDeTexto(montoTexto),
    }));
  }


  /** Fact. Abonos. */
  async leerFacturasAbonos(): Promise<FilaFacturaSimple[]> {
    await this.irASubTabFacturas('abonos');
    const filas = await this._leerFilasCrudas(L.TABLA_FACTURAS_ABONOS);
    return filas.map(([consecutivo, numeroFactura, fecha, observacion, montoTexto]) => ({
      consecutivo, numeroFactura, fecha, observacion,
      monto: this.core._leerMontoDeTexto(montoTexto),
    }));
  }


  /** Entradas (Movimientos de Caja). */
  async leerEntradasCaja(): Promise<FilaMovimientoCaja[]> {
    await this.irASubTabFacturas('entradas');
    const filas = await this._leerFilasCrudas(L.TABLA_FACTURAS_ENTRADAS);
    return filas.map(([comprobante, fecha, observacion, montoTexto]) => ({
      comprobante, fecha, observacion,
      monto: this.core._leerMontoDeTexto(montoTexto),
    }));
  }


  /** Salidas (Movimientos de Caja). */
  async leerSalidasCaja(): Promise<FilaMovimientoCaja[]> {
    await this.irASubTabFacturas('salidas');
    const filas = await this._leerFilasCrudas(L.TABLA_FACTURAS_SALIDAS);
    return filas.map(([comprobante, fecha, observacion, montoTexto]) => ({
      comprobante, fecha, observacion,
      monto: this.core._leerMontoDeTexto(montoTexto),
    }));
  }
}
