import { expect, Download, Locator, Page, Response } from '@playwright/test';
import { L } from './pos.locators';
import {
  TIMEOUTS, PAUSES, CAJA_TEXTO, CHECKBOX_ID, PestanaPos, PESTANA_POS_FACTURACION,
  PESTANAS_POS_A_RECORRER, MetodoPago, METODO, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT,
  TipoPagoOrdenCaja, TipoProforma, VEHICULO_PINTURA_TIPO, COMPANIA_POS, CABYS_BUSQUEDA,
  CABYS_BUSQUEDA_SIN_IVA, PRECIO_PRODUCTO_RAPIDO, EscenarioDescuento, ResultadoDescuento,
  EstadoCheckIva, ConfigBusquedaCabys, LineaCarrito, MetadatoProducto, DASHBOARD_URL,
} from './pos.types';
import { PosCore } from './pos-core.page';

// Parte del plan de migración a composición: dominio "PAYMENT" extraído
// de pos.page.ts. Depende de core por inyección de
// constructor (composición, no herencia) — nunca al revés. Miembros que eran
// 'private' en el monolito pasan a públicos aquí por el mismo motivo que en
// PosCore: los llama la fachada por composición, no por herencia.
export class PosPayment {
  private readonly core: PosCore;

  constructor(core: PosCore) {
    this.core = core;
  }

  private get page() { return this.core.page; }


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


  /**
   * Presiona "Facturar" para abrir el modal de pago. La apertura de caja, si es
   * necesaria, solo puede ocurrir más adelante al confirmar el pago —no aquí—.
   */
  async presionarFacturar() {
    // No-op en compañías sin flujo de restaurante (ver el comentario de
    // asegurarTipoOrdenRestauranteSiEsNecesario en PosCore) — mismo código
    // para ambos tipos de ambiente.
    await this.core.asegurarTipoOrdenRestauranteSiEsNecesario();
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
  async _localizarSelectorDocumentoElectronico(): Promise<Locator | null> {
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
  async _cambiarATiqueteElectronicoSiEsPosible(): Promise<boolean> {
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
  async _leerOpcionesDocumentoElectronico(select: Locator): Promise<{ opciones: string[]; seleccionada: number }> {
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
  async _seleccionarOpcionDocumentoElectronicoPorIndice(select: Locator, indice: number) {
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


  /**
   * Llena el monto en efectivo y el dinero recibido. Efectivo permite superar el total.
   *
   * Asegura primero que el checkbox de Efectivo (`CHECKBOX_ID.EFECTIVO`)
   * quede marcado — confirmado en vivo (ambiente qa_restaurant) que, a
   * diferencia del ambiente original (donde nace marcado por defecto, ver el
   * comentario de `_cambiarMetodoPago`), aquí el modal de pago puede abrir
   * sin ningún método preseleccionado, dejando `#payment_cash_total`
   * deshabilitado. No-op si ya está marcado (ambiente original): mismo
   * código para ambos.
   */
  async seleccionarPagoEfectivo(monto: string) {
    await this.core._asegurarCheckboxEstado(this.page.locator(`#${CHECKBOX_ID.EFECTIVO}`), CHECKBOX_ID.EFECTIVO, true);
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


  /**
   * Presiona el botón "Facturar" del modal de pago (confirma el pago), sin esperar
   * su resultado. Es este botón —no el que abre el modal de pago— el que puede
   * mostrar el modal "Abrir Caja" si la caja está cerrada.
   */
  async presionarConfirmarPago() {
    await this.page.locator(L.BTN_CONFIRMAR).click();
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
  async _confirmarPagoConReintentosDeCaja() {
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
      await this.core.cerrarAvisoConsecutivoSiAparece();

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
        await this.core.mostrarYCerrarVentanaImpresion(resultado.printPage);

        // El sistema puede mostrar además un SweetAlert "¿Desea imprimir copia?"
        // independiente del popup ya cerrado (confirmado en vivo) — la venta ya
        // se completó, así que se descarta con "Cancelar" en vez de pedir una
        // copia extra. Su overlay, si queda abierto, bloquea clicks posteriores.
        // Espera TIMEOUTS.PRODUCTS_LOAD (120s), no PAYMENT_MODAL (15s): confirmado
        // en vivo, en más de una corrida, que bajo la lentitud real del
        // ambiente/backend ya documentada en esta suite este aviso puede tardar
        // más de 15s en aparecer tras cerrar el popup — con un valor más corto,
        // la función retornaba antes de que el aviso apareciera, dejando el
        // SweetAlert abierto (detectado luego como "modal inesperado" al final
        // del escenario).
        const avisoCopia = this.page.locator('.sweet-alert.visible', { hasText: '¿Desea imprimir copia?' });
        const aparecioAvisoCopia = await avisoCopia
          .waitFor({ state: 'visible', timeout: TIMEOUTS.PRODUCTS_LOAD })
          .then(() => true)
          .catch(() => false);
        if (aparecioAvisoCopia) {
          await avisoCopia.locator('button.cancel').click();
          await avisoCopia.waitFor({ state: 'hidden', timeout: TIMEOUTS.PAYMENT_MODAL }).catch(() => {});

          // Confirmado en vivo: el backdrop propio de SweetAlert v1
          // (.sweet-overlay) puede quedar visible incluso después de que el
          // propio .sweet-alert ya se ocultó — sin ningún .sweet-alert.visible
          // activo, no hay forma legítima de "cerrarlo" desde la UI (no tiene
          // su propio botón), así que se oculta directo si sigue ahí. De no
          // hacerlo, bloquea clicks de acciones posteriores en la misma
          // página (confirmado en vivo: intercepta el click del menú de tres
          // puntos al restaurar Vista Expandida al final del escenario).
          const overlay = this.page.locator('.sweet-overlay');
          const overlayVisible = await overlay.isVisible().catch(() => false);
          if (overlayVisible) {
            await overlay.evaluate((el) => { (el as HTMLElement).style.display = 'none'; });
          }
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
      await expect(this.core.modalAbrirCaja).toBeVisible();
      await this.core.completarAperturaCaja();
      await expect(this.core.modalAbrirCaja).toBeHidden();
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
  async _armarCarreraFacturacion(accionClick: () => Promise<void>, incluirConfirmacionPago: boolean) {
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP })
      .then((printPage) => ({ tipo: 'popup' as const, printPage }));
    const modalPromise = this.core.modalAbrirCaja.waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP })
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


  /**
   * Pago mixto: activa tarjeta manteniendo efectivo, luego llena ambos montos.
   *
   * Asegura primero que AMBOS checkboxes (Efectivo y Tarjeta) queden
   * marcados — confirmado en vivo (ambiente qa_restaurant) que, a diferencia
   * del ambiente original (donde Efectivo nace marcado por defecto), aquí el
   * modal puede abrir sin ningún método preseleccionado: activar solo
   * Tarjeta (como asumía este método) deja Efectivo sin marcar y
   * `#payment_credit_card_total` deshabilitado. No-op si ya están marcados
   * (ambiente original): mismo código para ambos.
   */
  async seleccionarPagoMixto(montoTarjeta: string, montoEfectivo: string) {
    await this.core._asegurarCheckboxEstado(this.page.locator(`#${CHECKBOX_ID.EFECTIVO}`), CHECKBOX_ID.EFECTIVO, true);
    await this.core._asegurarCheckboxEstado(this.page.locator(`#${CHECKBOX_ID.TARJETA}`), CHECKBOX_ID.TARJETA, true);
    await this.page.waitForTimeout(PAUSES.CAMPO_HABILITADO);
    await this.page.locator('#payment_credit_card_total').fill(montoTarjeta);
    await this.page.getByPlaceholder('Referencia pago en tarjeta').fill('AUTOMATIZADO');
    await this.page.locator(L.EFECTIVO_MONTO).fill(montoEfectivo);
    await this.page.waitForTimeout(PAUSES.VER_MONTO);
  }


  /**
   * Cambia el método activo de efectivo (predeterminado) al indicado.
   * Usa evaluate() porque los checkboxes tienen slider CSS y están fuera del viewport.
   */
  async _cambiarMetodoPago(checkboxId: string) {
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
      await this.core._asegurarCheckboxEstado(this.page.locator(L.DIALOG_PAGO_CHECK_CREDITO), 'ck_is_payment_credit', true);
      await expect(
        this.page.locator(L.DIALOG_PAGO_FECHA_VENCIMIENTO),
        '"Fecha de Vencimiento" no apareció tras seleccionar Crédito en el modal de pago'
      ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    } else {
      await this.core._asegurarCheckboxEstado(this.page.locator(L.DIALOG_PAGO_CHECK_CONTADO), 'ck_is_payment_cash', true);
    }
  }


  /** Lee el vendedor actualmente seleccionado en el modal de pago (reutiliza el mismo lector de Chosen que "Enviar a caja"). */
  async obtenerVendedorEnModalPago(): Promise<string> {
    return this.core._obtenerTextoChosenSeleccionado(L.DIALOG_PAGO_VENDEDOR_CHOSEN);
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
    await this.core._seleccionarPrimeraOpcionChosen(L.DIALOG_PAGO_VENDEDOR_CHOSEN);
    const nombreVendedor = await this.obtenerVendedorEnModalPago();
    expect(nombreVendedor, 'El vendedor seleccionado en el modal de pago no quedó visible').not.toBe('');
    console.log(`[seleccionarVendedorEnModalPago] Vendedor seleccionado: "${nombreVendedor}"`);
    return nombreVendedor;
  }


  // ─── Modal de Pago: "Fecha de facturación" ─────────────────────────────────
  // `#date_invoice_manually` — investigado en vivo (pos-facturar.spec.ts):
  // input[type="date"] nativo, SIEMPRE visible dentro de #dialog_payment (no
  // depende de ningún checkbox ni tipo de documento electrónico), prellenado
  // con la fecha real del día al abrir el modal.

  /** Lee la fecha de facturación actual del modal de pago (formato `YYYY-MM-DD`, el mismo de un `<input type="date">`). */
  async obtenerFechaFacturacion(): Promise<string> {
    return this.page.locator(L.DIALOG_PAGO_FECHA_FACTURACION).inputValue();
  }


  /**
   * Cambia la fecha de facturación del modal de pago. `fecha` en formato
   * `YYYY-MM-DD` (el que espera `fill()` sobre un `input[type="date"]`
   * nativo). Valida que el valor realmente quedó aplicado antes de
   * devolver el control — un `fill()` sobre un campo de fecha con un
   * formato inválido puede no lanzar pero tampoco aplicar el cambio.
   *
   * `scrollIntoViewIfNeeded()` antes del `fill()` — confirmado en vivo
   * (pos-facturar.spec.ts, Escenario 4) que, cuando este mismo modal de pago
   * ya se abrió y se cerró antes en la misma página (fixture worker
   * compartida entre varios escenarios), puede conservar una posición de
   * scroll interna que deja este campo fuera del área realmente visible del
   * modal aunque su `display`/`boundingBox` reporten un layout normal —
   * mismo criterio defensivo que ya usa el resto de la suite para campos de
   * formularios dentro de modales largos (ver `_seleccionarPrimeraOpcionChosen()`).
   */
  async establecerFechaFacturacion(fecha: string) {
    const campo = this.page.locator(L.DIALOG_PAGO_FECHA_FACTURACION);
    await campo.scrollIntoViewIfNeeded({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await campo.fill(fecha);
    await expect(campo, `La fecha de facturación no quedó en "${fecha}"`).toHaveValue(fecha);
  }


  // ─── Modal de Pago: "Fecha de Vencimiento" (crédito) ───────────────────────
  // Solo visible/interactuable tras cambiarTipoPagoEnModalPago('credito') —
  // ese método ya valida que el CONTENEDOR (L.DIALOG_PAGO_FECHA_VENCIMIENTO)
  // aparezca; estos dos leen/escriben el `input[type="date"]` real dentro.

  /** Lee la fecha de vencimiento actual del modal de pago (formato `YYYY-MM-DD`). Requiere Crédito ya activo. */
  async obtenerFechaVencimiento(): Promise<string> {
    return this.page.locator(L.DIALOG_PAGO_INPUT_FECHA_VENCIMIENTO).inputValue();
  }


  /** Cambia la fecha de vencimiento del modal de pago. Requiere Crédito ya activo (ver cambiarTipoPagoEnModalPago). */
  async establecerFechaVencimiento(fecha: string) {
    const campo = this.page.locator(L.DIALOG_PAGO_INPUT_FECHA_VENCIMIENTO);
    await campo.scrollIntoViewIfNeeded({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await campo.fill(fecha);
    await expect(campo, `La fecha de vencimiento no quedó en "${fecha}"`).toHaveValue(fecha);
  }


  // ─── Modal de Pago: "Opciones avanzadas" propias del modal ─────────────────
  // Distinto de mostrarDetalleAvanzadoFactura() (detalle de totales del
  // carrito, fuera de este modal) — ver el comentario de
  // L.DIALOG_PAGO_CK_OPCIONES_AVANZADAS para la evidencia completa.

  /** Expande (si no lo está ya) el panel "Opciones avanzadas" del modal de pago — revela "A nombre de terceros". */
  async abrirOpcionesAvanzadasModalPago() {
    const checkbox = this.page.locator(L.DIALOG_PAGO_CK_OPCIONES_AVANZADAS);
    if (await checkbox.isChecked().catch(() => false)) return;
    await checkbox.evaluate((el: HTMLElement) => el.click());
    await expect(
      this.page.locator(L.DIALOG_PAGO_INPUT_TERCERO),
      'El campo "Factura a nombre de terceros" no apareció tras abrir "Opciones avanzadas"'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Activa "Factura a nombre de terceros" (dentro de "Opciones avanzadas" del
   * modal de pago directo — distinto de activarNombreTercerosOrdenCaja(),
   * que es el mismo concepto pero en el modal "Enviar a caja") y llena el
   * nombre. abrirOpcionesAvanzadasModalPago() debe llamarse antes (o se llama
   * aquí mismo si no se hizo).
   */
  async activarFacturarATerceros(nombre: string) {
    await this.abrirOpcionesAvanzadasModalPago();
    await this.core._asegurarCheckboxEstado(this.page.locator(L.DIALOG_PAGO_CK_TERCERO), 'ck_third_person_name', true);
    const input = this.page.locator(L.DIALOG_PAGO_INPUT_TERCERO);
    await expect(input, 'El campo "Factura a nombre de terceros" no quedó habilitado').toBeEnabled({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await input.fill(nombre);
    await expect(input, `El nombre de terceros no quedó en "${nombre}"`).toHaveValue(nombre);
  }


  /** Lee el nombre de terceros actualmente ingresado en el modal de pago (cadena vacía si el campo está deshabilitado/vacío). */
  async obtenerNombreTerceros(): Promise<string> {
    return this.page.locator(L.DIALOG_PAGO_INPUT_TERCERO).inputValue();
  }


  // ─── Modal de Pago: "No. Pedido" / "Orden de compra" ───────────────────────
  // Ambos SIEMPRE visibles (no dependen de "Opciones avanzadas" pese a la
  // clase real de su contenedor — ver el comentario de L.DIALOG_PAGO_NO_PEDIDO).

  /** Llena el número de pedido del modal de pago. */
  async establecerNumeroPedido(numero: string) {
    const campo = this.page.locator(L.DIALOG_PAGO_NO_PEDIDO);
    await campo.fill(numero);
    await expect(campo, `El número de pedido no quedó en "${numero}"`).toHaveValue(numero);
  }


  /** Lee el número de pedido actual del modal de pago. */
  async obtenerNumeroPedido(): Promise<string> {
    return this.page.locator(L.DIALOG_PAGO_NO_PEDIDO).inputValue();
  }


  /** Llena la orden de compra del modal de pago. */
  async establecerOrdenDeCompra(texto: string) {
    const campo = this.page.locator(L.DIALOG_PAGO_ORDEN_COMPRA);
    await campo.fill(texto);
    await expect(campo, `La orden de compra no quedó en "${texto}"`).toHaveValue(texto);
  }


  /** Lee la orden de compra actual del modal de pago. */
  async obtenerOrdenDeCompra(): Promise<string> {
    return this.page.locator(L.DIALOG_PAGO_ORDEN_COMPRA).inputValue();
  }


  // ─── Modal de Pago: "Nota" (observación general de la factura) ────────────
  // Ver el comentario de L.DIALOG_PAGO_OBSERVACION: required=true real, pero
  // no bloquea la venta (los 16 escenarios previos de esta suite nunca lo
  // llenan y facturan con éxito) — se llena en todos los escenarios nuevos
  // por instrucción explícita del usuario, no por necesidad técnica.

  /** Llena la observación/nota general de la factura en el modal de pago. */
  async agregarObservacionFactura(texto: string) {
    const campo = this.page.locator(L.DIALOG_PAGO_OBSERVACION);
    await campo.fill(texto);
    await expect(campo, `La observación de factura no quedó en "${texto}"`).toHaveValue(texto);
  }


  /** Lee la observación/nota general de la factura actualmente en el modal de pago. */
  async obtenerObservacionFactura(): Promise<string> {
    return this.page.locator(L.DIALOG_PAGO_OBSERVACION).inputValue();
  }


  // ─── Crédito: "Días de cobro (Opcional)" — variante Semanal ────────────────
  // Master switch (DIALOG_PAGO_CK_DIAS_DE_COBRO) + elegir "Semanal"
  // (DIALOG_PAGO_CK_DIAS_COBRO_SEMANAL) + monto de cobro — ver el comentario
  // de L.DIALOG_PAGO_CK_DIAS_DE_COBRO para la evidencia completa (3
  // periodicidades mutuamente excluyentes, solo Semanal usada por esta suite).
  // Requiere Crédito ya activo (cambiarTipoPagoEnModalPago('credito')).

  /**
   * Activa "Días de cobro" en modalidad Semanal y establece el monto de
   * cobro — dos checkboxes en cascada (master + Semanal, cada uno revela el
   * siguiente) más el campo de monto, mismo patrón de checkbox-slider que el
   * resto de la suite.
   */
  async activarDiasDeCobroSemanal(montoCobro: string) {
    await this.core._asegurarCheckboxEstado(this.page.locator(L.DIALOG_PAGO_CK_DIAS_DE_COBRO), 'ck_is_payment_credit_option', true);
    const ckSemanal = this.page.locator(L.DIALOG_PAGO_CK_DIAS_COBRO_SEMANAL);
    await expect(ckSemanal, '"Días de cobro" no reveló la opción Semanal').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.core._asegurarCheckboxEstado(ckSemanal, 'ck_is_payment_credit_week', true);

    const montoInput = this.page.locator(L.DIALOG_PAGO_DIAS_COBRO_SEMANAL_MONTO);
    await expect(montoInput, 'El campo "Monto de cobro" semanal no quedó visible').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await montoInput.fill(montoCobro);
    await expect(montoInput, `El monto de cobro semanal no quedó en "${montoCobro}"`).toHaveValue(montoCobro);
  }


  // ─── Crédito: "Abono inicial (Opcional)" ───────────────────────────────────
  // Vive dentro de L.DIALOG_PAGO_OPCIONES_AVANZADAS_CONTENEDOR
  // (#advance_options_modal) y reutiliza LOS MISMOS ids que el pago de
  // contado normal — ver el comentario de L.ABONO_INICIAL_TOTAL_LABEL para
  // la evidencia de la colisión real. Toda interacción aquí escopa
  // explícitamente dentro de ese contenedor, nunca con el id plano.

  /**
   * Aplica un abono inicial en efectivo (dentro de Crédito) por el monto
   * indicado. No reutiliza `_asegurarCheckboxEstado()` (que clickea vía
   * `document.getElementById()` por id global): `#is_payment_cash`/
   * `#payment_cash_total` están DUPLICADOS en el DOM mientras Crédito está
   * activo (ver el comentario de L.ABONO_INICIAL_TOTAL_LABEL) y
   * `getElementById()` siempre resolvería al primero (el del pago de
   * contado normal, no el de este abono) — el click aquí se dispara sobre
   * el propio locator ya escopado dentro del contenedor real, nunca por id
   * global.
   */
  async seleccionarAbonoInicialEfectivo(monto: string) {
    const contenedor = this.page.locator(L.DIALOG_PAGO_OPCIONES_AVANZADAS_CONTENEDOR);
    const checkbox = contenedor.locator(`#${CHECKBOX_ID.EFECTIVO}`);
    await expect.poll(async () => {
      if (!(await checkbox.isChecked())) {
        await checkbox.evaluate((el: HTMLElement) => el.click());
      }
      return checkbox.isChecked();
    }, { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El checkbox de Efectivo del abono inicial no quedó marcado' }).toBe(true);

    const montoInput = contenedor.locator(L.EFECTIVO_MONTO);
    await montoInput.fill(monto);
    // blur() tras fill(): confirmado en vivo que el recálculo real de
    // "TOTAL PAGO INICIAL" (L.ABONO_INICIAL_TOTAL_LABEL) no se dispara solo
    // con el evento "input"/"change" que fill() ya emite — necesita el
    // mismo blur() que ya usa establecerPorcentajeDescuentoGeneral()/
    // establecerCantidadProducto() para el mismo tipo de campo en esta app.
    await montoInput.blur();
    await expect(montoInput, `El monto del abono inicial en efectivo no quedó en "${monto}"`).toHaveValue(monto);
    await expect.poll(
      () => this.obtenerTotalPagoInicialNumerico(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El total de pago inicial no reflejó el monto ingresado' }
    ).toBeGreaterThan(0);
  }


  /** Lee el total de pago inicial (abono) mostrado actualmente en el modal de pago. */
  async obtenerTotalPagoInicialNumerico(): Promise<number> {
    const texto = await this.page.locator(L.ABONO_INICIAL_TOTAL_LABEL).textContent() ?? '$0.00';
    return this.core._leerMontoDeTexto(texto);
  }
}
